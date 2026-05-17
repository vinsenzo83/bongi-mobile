#!/usr/bin/env node
/**
 * 라이브 ↔ 데브 Supabase schema·정책·테이블 row 수 자동 비교
 *
 * 사용:
 *   npm run db:diff
 *   npm run db:diff -- --json
 *
 * 출력:
 *   ✅ 양쪽 일치 / ⚠️ 차이 항목 + drift 상세
 *   - 테이블 목록 차이
 *   - 컬럼 추가/제거
 *   - RLS 정책 차이
 *   - row 수 차이 (incentive_*만)
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const PAT = process.env.SUPABASE_PAT;
const LIVE = process.env.SUPABASE_PROJECT_LIVE || 'dugaqvvnhsgenhmhuyju';
const DEV  = process.env.SUPABASE_PROJECT_DEV  || 'sesgdqbmophgmombelmn';
if (!PAT) { console.error('❌ SUPABASE_PAT 미설정'); process.exit(1); }

const opts = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
  const [k, v] = a.slice(2).split('='); return [k, v ?? true];
}));

async function query(projectId, sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${PAT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

const Q_TABLES = `
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='public' AND table_name LIKE 'incentive_%'
  ORDER BY table_name;
`;
const Q_COLS = (t) => `
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_schema='public' AND table_name='${t}' ORDER BY ordinal_position;
`;
const Q_POLICIES = `
  SELECT tablename, policyname FROM pg_policies
  WHERE schemaname='public' AND tablename LIKE 'incentive_%'
  ORDER BY tablename, policyname;
`;
const Q_ROWS = (t) => `SELECT COUNT(*) AS c FROM ${t};`;

console.log('═══ 라이브 ↔ 데브 schema diff ═══\n');

// 1. 테이블 목록
const [liveT, devT] = await Promise.all([
  query(LIVE, Q_TABLES).then(r => r.map(x => x.table_name)),
  query(DEV,  Q_TABLES).then(r => r.map(x => x.table_name)),
]);
const liveOnly = liveT.filter(t => !devT.includes(t));
const devOnly  = devT.filter(t => !liveT.includes(t));
const common   = liveT.filter(t => devT.includes(t));

console.log(`📊 incentive_* 테이블`);
console.log(`  공통: ${common.length} / 라이브 전체: ${liveT.length} / 데브 전체: ${devT.length}`);
if (liveOnly.length) console.log(`  ⚠️ 라이브에만: ${liveOnly.join(', ')}`);
if (devOnly.length)  console.log(`  ⚠️ 데브에만:  ${devOnly.join(', ')}`);

// 2. 공통 테이블의 컬럼·row 비교
let colDiffs = 0, rowDiffs = 0;
const issues = [];
for (const t of common) {
  const [lc, dc, lr, dr] = await Promise.all([
    query(LIVE, Q_COLS(t)), query(DEV, Q_COLS(t)),
    query(LIVE, Q_ROWS(t)).then(r => r[0].c).catch(() => '?'),
    query(DEV,  Q_ROWS(t)).then(r => r[0].c).catch(() => '?'),
  ]);
  const lcs = new Set(lc.map(x => x.column_name));
  const dcs = new Set(dc.map(x => x.column_name));
  const onlyL = [...lcs].filter(c => !dcs.has(c));
  const onlyD = [...dcs].filter(c => !lcs.has(c));
  if (onlyL.length || onlyD.length) {
    colDiffs++;
    issues.push(`  ⚠️ ${t}: cols 라이브만=${onlyL.join(',')||'∅'} / 데브만=${onlyD.join(',')||'∅'}`);
  }
  if (String(lr) !== String(dr)) {
    rowDiffs++;
    issues.push(`  🟡 ${t}: rows 라이브=${lr} / 데브=${dr}`);
  }
}
console.log(`\n📋 컬럼·row 비교 (${common.length} 테이블)`);
console.log(`  컬럼 차이: ${colDiffs} 테이블`);
console.log(`  row 차이:  ${rowDiffs} 테이블`);
issues.slice(0, 20).forEach(s => console.log(s));

// 3. RLS 정책 비교
const [livePol, devPol] = await Promise.all([query(LIVE, Q_POLICIES), query(DEV, Q_POLICIES)]);
const lpSet = new Set(livePol.map(p => `${p.tablename}.${p.policyname}`));
const dpSet = new Set(devPol.map(p => `${p.tablename}.${p.policyname}`));
const polOnlyL = [...lpSet].filter(p => !dpSet.has(p));
const polOnlyD = [...dpSet].filter(p => !lpSet.has(p));
console.log(`\n🔐 RLS 정책 비교`);
console.log(`  공통: ${lpSet.size - polOnlyL.length} / 라이브 전체: ${lpSet.size} / 데브 전체: ${dpSet.size}`);
if (polOnlyL.length) console.log(`  ⚠️ 라이브에만: ${polOnlyL.slice(0,10).join(', ')}`);
if (polOnlyD.length) console.log(`  ⚠️ 데브에만:   ${polOnlyD.slice(0,10).join(', ')}`);

const totalIssues = liveOnly.length + devOnly.length + colDiffs + polOnlyL.length + polOnlyD.length;
console.log(`\n${totalIssues === 0 ? '✅ schema 일치' : `⚠️ ${totalIssues} 항목 drift (row 차이 ${rowDiffs} 제외 — 시드 차이일 수 있음)`}`);

if (opts.json) {
  console.log('\nJSON:');
  console.log(JSON.stringify({ tables: { liveOnly, devOnly, common: common.length }, colDiffs, rowDiffs, polOnlyL, polOnlyD }, null, 2));
}

process.exit(totalIssues > rowDiffs ? 1 : 0);
