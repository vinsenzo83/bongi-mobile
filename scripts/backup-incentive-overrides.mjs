// 봉이모바일 — incentive_calculator_overrides 테이블 JSON 백업
// 즉시 1회 실행 + 일일 자동 백업(GitHub Actions cron) 양쪽에서 재사용
//
// 사용법:
//   node scripts/backup-incentive-overrides.mjs           # .env(라이브) 사용
//   ENV_FILE=.env.staging node scripts/backup-incentive-overrides.mjs
//
// 산출: backups/incentive/YYYY-MM-DD_HHMMSS_KST_calc-overrides.json
//   - 변경분 없으면 파일 작성 안 함 (sha 비교) — Actions에서 빈 커밋 방지

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, writeFileSync, readdirSync, readFileSync, existsSync as _existsSync } from 'fs';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const ENV_FILE = process.env.ENV_FILE || '.env';

dotenv.config({ path: join(REPO_ROOT, ENV_FILE) });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_KEY 누락 (env file:', ENV_FILE, ')');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const KNOWN_SECTIONS = ['tv','bundle','device','install','card','gift','gift-catalog-custom','sales'];

function kstTimestamp() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  const yyyy = kst.getUTCFullYear();
  const mm = p(kst.getUTCMonth() + 1);
  const dd = p(kst.getUTCDate());
  const HH = p(kst.getUTCHours());
  const MM = p(kst.getUTCMinutes());
  const SS = p(kst.getUTCSeconds());
  return { iso: `${yyyy}-${mm}-${dd}T${HH}:${MM}:${SS}+09:00`, file: `${yyyy}-${mm}-${dd}_${HH}${MM}${SS}_KST` };
}

function sha256(s) { return createHash('sha256').update(s).digest('hex'); }

async function main() {
  console.log(`▶ backup start (env: ${ENV_FILE}, host: ${SUPABASE_URL.replace(/^https?:\/\//, '').split('.')[0]})`);

  const { data: rows, error } = await supabase
    .from('incentive_calculator_overrides')
    .select('section, data, updated_at, updated_by_user_id, updated_by_name')
    .order('section', { ascending: true });

  if (error) {
    console.error('❌ SELECT 실패:', error.message);
    process.exit(2);
  }

  const ts = kstTimestamp();
  const present = new Set((rows || []).map(r => r.section));
  const missing = KNOWN_SECTIONS.filter(s => !present.has(s));

  const snapshot = {
    snapshot_at: ts.iso,
    env_file: ENV_FILE,
    supabase_host: SUPABASE_URL.replace(/^https?:\/\//, '').split('.')[0],
    total_sections: (rows || []).length,
    known_section_count: KNOWN_SECTIONS.length,
    missing_sections: missing,
    rows: rows || [],
  };

  const json = JSON.stringify(snapshot, null, 2);
  const newHash = sha256(JSON.stringify({ rows: snapshot.rows }));

  // backups/incentive/ 디렉토리 보장
  const dir = join(REPO_ROOT, 'backups', 'incentive');
  mkdirSync(dir, { recursive: true });

  // 직전 백업과 비교: data 부분이 동일하면 새 파일 작성 안 함 (Actions noop)
  const existing = readdirSync(dir).filter(f => f.endsWith('_calc-overrides.json')).sort();
  const last = existing[existing.length - 1];
  if (last) {
    try {
      const prev = JSON.parse(readFileSync(join(dir, last), 'utf8'));
      const prevHash = sha256(JSON.stringify({ rows: prev.rows || [] }));
      if (prevHash === newHash) {
        console.log(`= 변경 없음 (직전 백업과 동일: ${last}) — 새 파일 미작성`);
        process.exit(0);
      }
    } catch (e) {
      console.warn('직전 백업 파싱 실패, 그대로 진행:', e.message);
    }
  }

  const filename = `${ts.file}_calc-overrides.json`;
  const path = join(dir, filename);
  writeFileSync(path, json + '\n', 'utf8');

  console.log('');
  console.log(`✅ 백업 완료: backups/incentive/${filename}`);
  console.log(`   섹션 수: ${snapshot.total_sections} / 알려진 섹션 ${KNOWN_SECTIONS.length}개`);
  if (missing.length) console.log(`   ⚠️  누락 섹션: ${missing.join(', ')}`);
  (rows || []).forEach(r => {
    const size = JSON.stringify(r.data).length;
    const updBy = r.updated_by_name || '?';
    const updAt = r.updated_at || '?';
    console.log(`   • ${r.section.padEnd(22)} ${String(size).padStart(6)} bytes  by ${updBy}  @ ${updAt}`);
  });
}

main().catch(e => { console.error('❌ unhandled:', e); process.exit(99); });
