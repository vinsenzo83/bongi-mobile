// 회귀 baseline 캡처·검증 — 통합 작업 전후 견적 결과 동일성 보장
//
// 사용법:
//   node scripts/calc-regression.mjs capture        # baseline JSON 저장
//   node scripts/calc-regression.mjs verify         # baseline과 현재 비교 (diff 0이면 OK)
//   node scripts/calc-regression.mjs verify --strict  # diff 발견 시 exit 1
//
// 캡처 대상: D 객체 + TICKETS 배열 (시드 + payback 적용된 상태)
//   D == 시드 데이터 적용 결과물 → 통합 전후 동일하면 calc 함수도 동일 결과
//   TICKETS == 사전 생성된 견적 시나리오 — 직접 비교 가능

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

const PAGES = [
  { name: 'calculator-admin', url: 'http://localhost:3001/docs/calculator.html?admin=1' },
  { name: 'calculator',       url: 'http://localhost:3001/docs/calculator.html' },
  { name: 'tm',               url: 'http://localhost:3001/docs/tm.html' },
  { name: 'tm-counselor',     url: 'http://localhost:3001/docs/tm-counselor.html' },
  { name: 'tm-counselor-v2',  url: 'http://localhost:3001/docs/tm-counselor.html?mode=manual' },
];

function kstFile() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getUTCFullYear()}-${p(now.getUTCMonth()+1)}-${p(now.getUTCDate())}_${p(now.getUTCHours())}${p(now.getUTCMinutes())}${p(now.getUTCSeconds())}_KST`;
}

async function captureOne(page) {
  // D 객체와 TICKETS 추출. TICKETS 없는 페이지는 null.
  return await page.evaluate(() => {
    const safeStringify = (obj) => {
      try { return JSON.parse(JSON.stringify(obj)); } catch (e) { return { __error: String(e) }; }
    };
    return {
      D: typeof window.D !== 'undefined' ? safeStringify(window.D) : null,
      TICKETS: typeof window.TICKETS !== 'undefined' ? safeStringify(window.TICKETS) : null,
      fetchStatus: window._lastDbFetchStatus || null,
      title: document.title,
    };
  });
}

async function captureAll() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const out = { captured_at: new Date().toISOString(), pages: {} };
  for (const { name, url } of PAGES) {
    console.log(`  · ${name} ← ${url}`);
    const page = await ctx.newPage();
    // 콘솔 에러 수집
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    try {
      // load (모든 리소스 로드 끝) + 충분한 sleep — networkidle은 polling 등록 페이지에서 timeout 위험
      await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
      await page.waitForTimeout(3500); // bootstrap + payback polling 첫 호출 + render 여유
      const data = await captureOne(page);
      data.consoleErrors = errors.filter(e => !/cloudflareinsights|beacon\.min\.js/.test(e));
      out.pages[name] = data;
    } catch (e) {
      out.pages[name] = { __error: String(e && e.message || e), consoleErrors: errors };
    } finally {
      await page.close();
    }
  }
  await browser.close();
  return out;
}

function deepDiff(a, b, path = '') {
  const diffs = [];
  if (typeof a !== typeof b) {
    diffs.push({ path, a: typeof a, b: typeof b, kind: 'type-mismatch' });
    return diffs;
  }
  if (a === null || b === null || typeof a !== 'object') {
    if (a !== b) diffs.push({ path, a, b });
    return diffs;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (!(k in a)) { diffs.push({ path: `${path}.${k}`, kind: 'added-in-b', b: b[k] }); continue; }
    if (!(k in b)) { diffs.push({ path: `${path}.${k}`, kind: 'removed-in-b', a: a[k] }); continue; }
    diffs.push(...deepDiff(a[k], b[k], `${path}.${k}`));
  }
  return diffs;
}

const cmd = process.argv[2] || 'capture';

if (cmd === 'capture') {
  console.log('▶ baseline 캡처 시작 (5 pages)');
  const data = await captureAll();
  const dir = join(REPO_ROOT, 'baselines');
  mkdirSync(dir, { recursive: true });
  // latest.json 고정 + timestamp 파일 같이
  const stamped = join(dir, `calc-${kstFile()}.json`);
  const latest = join(dir, 'calc-latest.json');
  const json = JSON.stringify(data, null, 2);
  writeFileSync(stamped, json);
  writeFileSync(latest, json);
  // 요약
  console.log('');
  for (const [name, p] of Object.entries(data.pages)) {
    if (p.__error) { console.log(`  ❌ ${name}: ${p.__error}`); continue; }
    const dSize = p.D ? JSON.stringify(p.D).length : 0;
    const tCount = p.TICKETS ? p.TICKETS.length : '∅';
    const errs = (p.consoleErrors || []).length;
    console.log(`  ✓ ${name.padEnd(20)} D ${String(dSize).padStart(7)}b  TICKETS ${String(tCount).padStart(5)}  errors ${errs}  fetch=${p.fetchStatus}`);
  }
  console.log('');
  console.log('✅ baseline:', stamped);
  console.log('   latest  :', latest);
} else if (cmd === 'verify') {
  const strict = process.argv.includes('--strict');
  const latest = join(REPO_ROOT, 'baselines', 'calc-latest.json');
  if (!existsSync(latest)) {
    console.error('❌ baseline 없음. 먼저 `node scripts/calc-regression.mjs capture` 실행하세요.');
    process.exit(2);
  }
  const baseline = JSON.parse(readFileSync(latest, 'utf8'));
  console.log('▶ verify 시작 (baseline:', baseline.captured_at + ')');
  const current = await captureAll();
  let totalDiff = 0;
  for (const name of Object.keys(baseline.pages)) {
    const a = baseline.pages[name];
    const b = current.pages[name];
    if (!b) { console.log(`  ❌ ${name}: 현재 캡처 누락`); totalDiff += 1; continue; }
    const dDiff = deepDiff(a.D, b.D, `${name}.D`);
    const tDiff = deepDiff(a.TICKETS, b.TICKETS, `${name}.TICKETS`);
    const all = [...dDiff, ...tDiff];
    if (all.length === 0) {
      console.log(`  ✓ ${name}: 동일`);
    } else {
      console.log(`  ❌ ${name}: ${all.length}건 차이`);
      all.slice(0, 10).forEach(d => console.log(`      · ${d.path}: ${JSON.stringify(d.a)} → ${JSON.stringify(d.b)}`));
      if (all.length > 10) console.log(`      … +${all.length - 10}건`);
      totalDiff += all.length;
    }
  }
  console.log('');
  if (totalDiff === 0) {
    console.log('✅ 회귀 없음 — D 객체·TICKETS 모두 baseline과 동일');
    process.exit(0);
  } else {
    console.log(`❌ 회귀 발견: 총 ${totalDiff}건 차이`);
    process.exit(strict ? 1 : 0);
  }
} else {
  console.error('Usage: node scripts/calc-regression.mjs [capture|verify [--strict]]');
  process.exit(1);
}
