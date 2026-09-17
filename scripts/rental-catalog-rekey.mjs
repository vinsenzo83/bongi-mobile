// 적재 규칙(어댑터)이 바뀌어 조건키가 달라질 때, 기존 조건의 티켓번호·가이드·MAX·관리자 상태를 지키도록 조건키만 새 규칙 키로 옮긴다.
// 값(요금·리베이트·관리·라벨 등)은 이 스크립트 다음에 돌리는 월 적재(rental-catalog-import --commit)가 '변경'으로 반영한다.
//   node scripts/rental-catalog-rekey.mjs --env .env.dev --month 2026-09 --file "<xlsx>" [--suppliers coway,cuckoo] [--commit]
//
// 짝짓기 — 같은 엑셀 행(시트·행번호) 안에서만
//   1) 조건키가 그대로 같은 것
//   2) 남은 것끼리 점수: 약정·의무·소유권 같음(필수: 약정) + 요금·리베이트·유형·태그·세부코드 유사
//      점수가 기준 미만이면 짝짓지 않는다 → 새 조건(새 티켓) / 옛 조건은 적재 때 단종
import fs from 'fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { parseRentalWorkbook } from '../server/services/rental-import/index.js';
import { supplierId } from '../server/services/rental-import/commit.js';

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const envFile = arg('--env'); const month = arg('--month'); const file = arg('--file');
if (!envFile || !month || !file) { console.error('--env --month --file 필수'); process.exit(1); }
const env = dotenv.parse(fs.readFileSync(envFile));
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

const parsed = parseRentalWorkbook(fs.readFileSync(file), { month });
const only = arg('--suppliers') ? new Set(arg('--suppliers').split(',')) : null;
const offers = parsed.offers.filter((o) => !only || only.has(supplierId(o.supplier)));
const suppliers = [...new Set(offers.map((o) => supplierId(o.supplier)))];
console.log('대상 DB:', new URL(env.SUPABASE_URL).host.split('.')[0], '· 파일:', parsed.file, '· 렌탈사:', suppliers.join(','));

const existing = [];
for (let from = 0; ; from += 1000) {
  const { data } = await sb.from('rental_cat_offers')
    .select('id, ticket_number, condition_key, status, source, contract_months, obligation_months, ownership_months, monthly_fee, rebate, offer_type, offer_tags, variant_code, care_type')
    .in('supplier_id', suppliers).order('id').range(from, from + 999).throwOnError();
  existing.push(...data);
  if (data.length < 1000) break;
}
const mine = existing.filter((e) => (e.source?.file_kind || parsed.file) === parsed.file);
const allKeys = new Set(existing.map((e) => e.condition_key));

const rowKey = (s) => `${s?.sheet}|${s?.row}`;
const group = (list) => list.reduce((m, x) => { const k = rowKey(x.source); (m.get(k) || m.set(k, []).get(k)).push(x); return m; }, new Map());
const oldByRow = group(mine);   // 단종 조건도 포함 — 엑셀에 단종으로 계속 적혀 있으면 같은 티켓을 유지해야 한다
const newByRow = group(offers);

const same = (a, b) => (a ?? null) === (b ?? null);
function score(e, o) {
  if (!same(e.contract_months, o.contract_months)) return -1;
  let s = 3;
  if (same(e.obligation_months, o.obligation_months)) s += 1;
  if (same(e.ownership_months, o.ownership_months)) s += 1;
  if (same(e.monthly_fee, o.monthly_fee)) s += 3;
  if (same(e.rebate, o.rebate)) s += 3;
  if (e.offer_type === o.offer_type) s += 2;
  if (same(e.variant_code, o.variant_code)) s += 2;
  if (same(e.care_type, o.care_type)) s += 1;
  const et = new Set(e.offer_tags || []); const ot = o.offer_tags || [];
  s += ot.filter((t) => et.has(t)).length;
  return s;
}
const MIN_SCORE = 8;   // 약정(3) + 요금·리베이트 중 하나(3) + 유형·세부코드 중 하나(2) 이상

const moves = []; let exact = 0; let fresh = 0; let orphan = 0;
for (const [rk, news] of newByRow) {
  const olds = [...(oldByRow.get(rk) || [])];
  const left = [];
  for (const o of news) {
    const i = olds.findIndex((e) => e.condition_key === o.condition_key);
    if (i >= 0) { exact++; olds.splice(i, 1); } else left.push(o);
  }
  const cand = [];
  for (const o of left) for (const e of olds) { const s = score(e, o); if (s >= MIN_SCORE) cand.push({ s, e, o }); }
  cand.sort((a, b) => b.s - a.s);
  const usedE = new Set(); const usedO = new Set();
  for (const c of cand) {
    if (usedE.has(c.e.id) || usedO.has(c.o)) continue;
    // 새 키가 이미 다른 조건(다른 행)에 있으면 옮기지 않는다
    if (allKeys.has(c.o.condition_key)) continue;
    usedE.add(c.e.id); usedO.add(c.o);
    moves.push({ e: c.e, o: c.o, s: c.s });
  }
  fresh += left.filter((o) => !usedO.has(o)).length;
  orphan += olds.filter((e) => !usedE.has(e.id)).length;
}
const dupNew = moves.length - new Set(moves.map((m) => m.o.condition_key)).size;
console.log(`엑셀 조건 ${offers.length} · 키 그대로 ${exact} · 키 이전 ${moves.length} · 새 조건 ${fresh} · 짝 없는 기존(적재 때 단종) ${orphan}${dupNew ? ` · 새 키 중복 ${dupNew}` : ''}`);
for (const m of moves.slice(0, 6)) console.log(`  ${m.e.ticket_number} [${m.s}] ${m.e.condition_key}\n      → ${m.o.condition_key}`);
if (dupNew) { console.error('새 조건키 중복 — 중단'); process.exit(1); }
if (!process.argv.includes('--commit')) process.exit(0);

// 네트워크가 끊겨도 다시 돌리면 된다 — 임시키(rekey:id)로 남은 조건도 같은 엑셀 행 짝짓기로 다시 잡힌다. 건마다 3회 재시도
async function retry(fn) {
  for (let k = 1; ; k++) {
    try { return await fn(); } catch (e) { if (k >= 3) throw e; await new Promise((res) => setTimeout(res, 2000 * k)); }
  }
}
// 25건씩 동시에 — 한 건씩이면 수천 건에 수십 분 걸린다
async function inParallel(list, fn, size = 25) {
  for (let i = 0; i < list.length; i += size) {
    await Promise.all(list.slice(i, i + size).map((x) => retry(() => fn(x))));
    if ((i / size) % 20 === 0) console.log(`  ${Math.min(i + size, list.length)}/${list.length}`);
  }
}
await inParallel(moves.filter((m) => !m.e.condition_key.startsWith('rekey:')), (m) => sb.from('rental_cat_offers').update({ condition_key: `rekey:${m.e.id}` }).eq('id', m.e.id).throwOnError());
await inParallel(moves, (m) => sb.from('rental_cat_offers').update({ condition_key: m.o.condition_key, updated_at: new Date().toISOString() }).eq('id', m.e.id).throwOnError());
for (let i = 0; i < moves.length; i += 500) {
  await sb.from('rental_cat_offer_changes').insert(moves.slice(i, i + 500).map((m) => ({
    offer_id: m.e.id, change_type: 'changed', changed_by: 'rekey(적재규칙 변경)', before: { condition_key: m.e.condition_key }, after: { condition_key: m.o.condition_key },
  }))).throwOnError();
}
console.log('조건키 이전 반영', moves.length, '— 이어서 rental-catalog-import --commit 으로 값 반영');
