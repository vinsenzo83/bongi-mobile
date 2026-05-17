#!/usr/bin/env node
/**
 * Supabase 마이그레이션 헬퍼 — 라이브 + 데브 양쪽 자동 적용
 *
 * 사용:
 *   npm run db:migrate -- --file=server/db/2026-05-17-foo.sql --env=all
 *   npm run db:migrate -- --file=server/db/foo.sql --env=dev
 *   npm run db:migrate -- --file=server/db/foo.sql --env=live --dry-run
 *
 * 환경변수 (.env):
 *   SUPABASE_PAT          — Personal Access Token (https://supabase.com/dashboard/account/tokens)
 *   SUPABASE_PROJECT_LIVE — dugaqvvnhsgenhmhuyju (default)
 *   SUPABASE_PROJECT_DEV  — sesgdqbmophgmombelmn (default)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const PAT = process.env.SUPABASE_PAT;
const LIVE = process.env.SUPABASE_PROJECT_LIVE || 'dugaqvvnhsgenhmhuyju';
const DEV  = process.env.SUPABASE_PROJECT_DEV  || 'sesgdqbmophgmombelmn';

if (!PAT) {
  console.error('❌ SUPABASE_PAT 미설정');
  console.error('   1. https://supabase.com/dashboard/account/tokens 에서 발급');
  console.error('   2. .env에 SUPABASE_PAT=sbp_xxx 추가');
  process.exit(1);
}

// CLI 파싱
const args = process.argv.slice(2);
const opts = {};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a.startsWith('--')) {
    const [k, v] = a.slice(2).split('=');
    opts[k] = v || args[++i] || true;
  }
}
const env = opts.env || 'all';
const dryRun = !!opts['dry-run'];
const file = opts.file;
if (!file) { console.error('❌ --file=<sql_path> 필수'); process.exit(1); }
if (!['all', 'live', 'dev', 'both'].includes(env)) {
  console.error('❌ --env=all|live|dev'); process.exit(1);
}

const sqlPath = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
if (!fs.existsSync(sqlPath)) { console.error('❌ 파일 없음:', sqlPath); process.exit(1); }
const sql = fs.readFileSync(sqlPath, 'utf-8');
console.log(`📄 SQL: ${sqlPath} (${sql.length} chars)`);

const targets = env === 'all' || env === 'both'
  ? [['LIVE', LIVE], ['DEV', DEV]]
  : env === 'live' ? [['LIVE', LIVE]] : [['DEV', DEV]];

async function runMigration(label, projectId) {
  console.log(`\n═══ ${label} (${projectId}) ═══`);
  if (dryRun) { console.log('  🟡 dry-run — 실제 적용 안 함'); return { ok: true, dryRun: true }; }

  const res = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PAT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql })
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`  ❌ HTTP ${res.status}`);
    console.error('  응답:', text.slice(0, 500));
    return { ok: false, error: text };
  }
  try {
    const data = JSON.parse(text);
    if (Array.isArray(data) && data.length > 0) {
      console.log(`  ✅ 성공 (반환 ${data.length} rows, 샘플: ${JSON.stringify(data[0]).slice(0, 100)}...)`);
    } else {
      console.log('  ✅ 성공 (DDL/UPDATE, no rows)');
    }
    return { ok: true, data };
  } catch {
    console.log('  ✅ 성공');
    return { ok: true };
  }
}

console.log(`\n환경: ${env.toUpperCase()} ${dryRun ? '[DRY RUN]' : ''}`);
console.log(`대상: ${targets.map(t => t[0]).join(', ')}`);

const results = [];
for (const [label, pid] of targets) {
  results.push([label, await runMigration(label, pid)]);
}

console.log('\n═══ 결과 ═══');
let allOk = true;
for (const [label, r] of results) {
  const icon = r.ok ? '✅' : '❌';
  console.log(`  ${icon} ${label}: ${r.ok ? 'OK' : r.error?.slice(0, 80)}`);
  if (!r.ok) allOk = false;
}

if (!allOk) process.exit(1);
console.log('\n전체 적용 완료. 라이브·데브 schema 일치 확인 권장: npm run db:diff');
