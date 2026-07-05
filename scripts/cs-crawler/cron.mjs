#!/usr/bin/env node
// cs-crawler 자동 감지 크론 (MVP: 감지 + 알림 + 승인게이트)
// ─────────────────────────────────────────────────────────────────────────
// 하는 일 : 6영역×3사 목록을 BFF/DOM 으로 수집 → fingerprint 비교 → 변경/개편 감지
//           → 변경분 cs.*_staging 적재(승인 대기) + cs.crawl_log 기록 + 콘솔 알림
// 안 하는 일: cs.plans/bundles/faqs(published) 자동 반영 절대 없음. 반드시 사람 승인.
//
// 사용:
//   node scripts/cs-crawler/cron.mjs                 # enabled·daily probe 전체 (pg sink)
//   node scripts/cs-crawler/cron.mjs --weekly        # weekly(부가/FAQ) 포함
//   node scripts/cs-crawler/cron.mjs --all           # disabled 스텁 포함(경보 확인용)
//   node scripts/cs-crawler/cron.mjs --only skt:plans,lgu:vas
//   node scripts/cs-crawler/cron.mjs --dry           # 아무 기록 없음(콘솔만)
//   node scripts/cs-crawler/cron.mjs --emit-sql out.sql --meta-in meta.json   # dev/MCP 검증
//
// sink(기록 대상):
//   프로덕션 : 환경변수 CS_DATABASE_URL (직접 Postgres, service 자격) — cs 스키마 미노출이라 pg 직결
//   dev 검증 : --emit-sql <파일> (+ --meta-in <crawl_meta export>) → Supabase MCP execute_sql 로 적용
// ─────────────────────────────────────────────────────────────────────────
import { randomUUID } from 'crypto';
import { launch } from './lib/browser.mjs';
import { PROBES } from './lib/probes.mjs';
import { detect } from './lib/fingerprint.mjs';
import { logResult, summarize, notifyExternal } from './lib/notify.mjs';
import { makeSink } from './lib/sink.mjs';

const args = process.argv.slice(2);
const has = f => args.includes(f);
const val = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const CODE = { 'KT': 'kt', 'SKT': 'skt', 'LG U+': 'lgu' };

const DRY = has('--dry');
const emitFile = val('--emit-sql');
const metaIn = val('--meta-in');
const pgUrl = process.env.CS_DATABASE_URL;
const only = val('--only') ? new Set(val('--only').split(',').map(s => s.trim())) : null;

// probe 선택
const selected = PROBES.filter(p => {
  if (only) return only.has(`${CODE[p.carrier]}:${p.area}`);
  if (has('--all')) return true;
  if (!p.enabled) return false;
  if (p.freq === 'weekly' && !has('--weekly')) return false;
  return true;
});

const sink = await makeSink({ dry: DRY, emitFile, metaIn, pgUrl });

// ── 실행 ───────────────────────────────────────────────────────────────
const batch_id = randomUUID();
const t0 = Date.now();
const mode = DRY ? 'DRY(콘솔만)' : emitFile ? `SQL emit(${emitFile})` : pgUrl ? 'PG 직결' : 'sink없음';
console.error(`\n🔎 CS 크롤 감지 시작 — batch ${batch_id.slice(0, 8)} | probe ${selected.length}개 | ${mode}`);
console.error(`   대상: ${selected.map(p => `${CODE[p.carrier]}:${p.area}`).join(', ')}\n`);

const meta = await sink.loadMeta();

// lgu:vas 는 fetch만 — 그 외가 하나라도 있으면 브라우저 기동
const needsBrowser = selected.some(p => !(p.carrier === 'LG U+' && p.area === 'vas') && p.enabled);
let browser = null;
if (needsBrowser) { try { browser = await launch(); } catch (e) { console.error('브라우저 기동 실패:', e.message); } }

const results = [];
for (const probe of selected) {
  const prevRow = meta.get(`${probe.carrier}|${probe.area}`);
  const prev = prevRow ? { fingerprint: prevRow.fingerprint, item_count: prevRow.item_count, sample_names: prevRow.sample || [] } : null;
  let c;
  try { c = await probe.collect(browser); }
  catch (e) { c = { items: [], ok: false, note: 'collect 예외: ' + e.message }; }

  const res = detect(c.items, prev, { ok: c.ok, note: c.note });
  res.carrier = probe.carrier; res.area = probe.area; res.batch_id = batch_id;
  // names_full(표시 라벨)은 detect()가 fingerprint 라벨로 채움

  // 변경(기존 기준선 대비 delta)만 staging 적재 (승인 대기).
  // 'new'(첫 기준선)·무변경·경보는 적재 안 함 — 첫 실행 staging 폭주 방지.
  if (res.outcome === 'changed') res.staged = await sink.stageDelta(probe, res);

  await sink.writeLog(probe, res);
  await sink.upsertMeta(probe, res);
  logResult(res);
  results.push(res);
}
if (browser) await browser.close();

const digest = summarize(results);
await notifyExternal(digest, results);
await sink.finalize();
console.error(`\n⏱  ${((Date.now() - t0) / 1000).toFixed(0)}s · batch ${batch_id.slice(0, 8)}`);

// 경보 있으면 non-zero exit (cron/CI 가시성). 변경 자체는 정상(0).
process.exit(digest.alertCount > 0 ? 2 : 0);
