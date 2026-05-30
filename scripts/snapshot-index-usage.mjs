// 봉이모바일 — 인덱스 사용 stats 주간 스냅샷
// pg_stat_user_indexes를 JSON으로 저장 → R15 baseline 자동 추적
//
// 사용법:
//   node scripts/snapshot-index-usage.mjs
//
// 산출: backups/index-usage/YYYY-MM-DD.json
//   - 변경 없으면(sha 동일) skip
//   - idx_scan·idx_tup_read·index size 모두 기록

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const ENV_FILE = process.env.ENV_FILE || '.env';

dotenv.config({ path: join(REPO_ROOT, ENV_FILE) });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(`❌ SUPABASE_URL / SUPABASE_SERVICE_KEY 누락 (env file: ${ENV_FILE})`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const kstDate = () => new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

async function fetchIndexStats() {
  // 라이브 SQL RPC가 없어서 PostgREST로 직접 query 어려움 → SQL execute API 사용
  // Supabase는 임의 SQL을 client 쪽에서 실행 못 함 → service_role JWT로 rest API
  // 대안: pg_stat 데이터를 view로 미리 노출하거나, RPC 함수 만들기.
  //
  // 가장 단순: ?select=...&order=... 방식으로 view 만들고 query.
  // 여기선 RPC 함수 호출 가정.
  const { data, error } = await supabase.rpc('snapshot_index_usage');
  if (error) {
    // RPC 함수 없으면 fall-back으로 빈 결과
    console.warn(`⚠️  RPC snapshot_index_usage 없음 — view/RPC 사전 생성 필요`);
    console.warn(`   SQL: docs/specs/INDEX_USAGE_RPC.sql 참고`);
    throw new Error(`RPC 실행 실패: ${error.message}`, { cause: error });
  }
  return data || [];
}

function sha256(s) {
  return createHash('sha256').update(s).digest('hex');
}

async function main() {
  console.log(`📊 인덱스 사용 stats 스냅샷 — ${kstDate()}`);

  const stats = await fetchIndexStats();
  console.log(`  → ${stats.length} 인덱스 stats 수집`);

  // unused (idx_scan = 0) 카운트
  const unused = stats.filter(s => s.idx_scan === 0);
  const used = stats.length - unused.length;
  console.log(`  · 사용됨: ${used} · 미사용: ${unused.length}`);

  // 큰 unused 상위 5 식별 (관심 candidate)
  const bigUnused = unused
    .filter(s => s.index_size_bytes >= 32768)
    .sort((a, b) => b.index_size_bytes - a.index_size_bytes)
    .slice(0, 5);
  if (bigUnused.length) {
    console.log(`  ⚠️  큰 unused 상위 5:`);
    for (const u of bigUnused) {
      console.log(`     - ${u.table_name}.${u.index_name} (${(u.index_size_bytes / 1024).toFixed(1)} KB)`);
    }
  }

  const snapshot = {
    snapshot_date_kst: kstDate(),
    total_indexes: stats.length,
    used_indexes: used,
    unused_indexes: unused.length,
    big_unused_top5: bigUnused.map(u => ({
      table: u.table_name, index: u.index_name, size_bytes: u.index_size_bytes,
    })),
    all_stats: stats,
  };
  const snapshotStr = JSON.stringify(snapshot, null, 2);

  // sha 비교 — 어제와 동일하면 skip
  const outDir = join(REPO_ROOT, 'backups', 'index-usage');
  mkdirSync(outDir, { recursive: true });
  const yesterday = new Date(Date.now() + 9 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);
  const yesterdayPath = join(outDir, `${yesterday}.json`);
  if (existsSync(yesterdayPath)) {
    const ySha = sha256(readFileSync(yesterdayPath, 'utf8'));
    if (ySha === sha256(snapshotStr)) {
      console.log(`✅ 어제와 동일 — skip`);
      process.exit(0);
    }
  }

  const todayPath = join(outDir, `${kstDate()}.json`);
  writeFileSync(todayPath, snapshotStr);
  console.log(`  💾 ${todayPath}`);

  // R15 baseline과 diff (선택 — 정보용)
  const baselinePath = join(REPO_ROOT, 'docs', 'specs', 'UNUSED_INDEX_BASELINE_2026_05_30.md');
  if (existsSync(baselinePath)) {
    console.log(`  📋 baseline: ${baselinePath} (수동 diff 가능)`);
  }

  console.log(`✅ 스냅샷 완료`);
}

main().catch((e) => {
  console.error(`❌ 스냅샷 실패:`, e);
  process.exit(1);
});
