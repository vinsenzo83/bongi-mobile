// 봉이모바일 — Supabase Storage product-images bucket 일일 백업
// 사용법:
//   node scripts/backup-storage.mjs                # .env(라이브) 사용
//   ENV_FILE=.env.staging node scripts/backup-storage.mjs
//
// 산출: backups/storage/YYYY-MM-DD_product-images.tar.gz
//   - bucket 0건이면 manifest 파일만 작성 (sha 비교로 빈 커밋 방지)
//   - 30일 보관 (cron workflow에서 prune)

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs';
import { createHash } from 'crypto';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const ENV_FILE = process.env.ENV_FILE || '.env';
const BUCKET = process.env.STORAGE_BUCKET || 'product-images';

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

// KST 날짜 (UTC + 9)
const kstDate = () => {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
};

async function listAllObjects(prefix = '', acc = []) {
  let offset = 0;
  const LIMIT = 1000;
  while (true) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
      limit: LIMIT, offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw new Error(`list 실패: ${error.message}`, { cause: error });
    if (!data || data.length === 0) break;
    for (const obj of data) {
      const path = prefix ? `${prefix}/${obj.name}` : obj.name;
      if (obj.id === null) {
        // folder — recurse
        await listAllObjects(path, acc);
      } else {
        acc.push({ path, size: obj.metadata?.size || 0, updated_at: obj.updated_at });
      }
    }
    if (data.length < LIMIT) break;
    offset += LIMIT;
  }
  return acc;
}

async function downloadObject(path) {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) throw new Error(`download 실패 (${path}): ${error.message}`, { cause: error });
  return Buffer.from(await data.arrayBuffer());
}

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

async function main() {
  console.log(`📦 Supabase Storage 백업 시작 — bucket: ${BUCKET}`);
  const objects = await listAllObjects();
  console.log(`  → ${objects.length} objects 발견`);

  const dateStr = kstDate();
  const backupDir = join(REPO_ROOT, 'backups', 'storage', dateStr);
  const tarPath = join(REPO_ROOT, 'backups', 'storage', `${dateStr}_${BUCKET}.tar.gz`);
  const manifestPath = join(REPO_ROOT, 'backups', 'storage', `${dateStr}_${BUCKET}.manifest.json`);

  const manifest = {
    bucket: BUCKET,
    backup_date_kst: dateStr,
    total_objects: objects.length,
    total_bytes: objects.reduce((s, o) => s + (o.size || 0), 0),
    objects: objects.map(o => ({ path: o.path, size: o.size, updated_at: o.updated_at })),
  };
  const manifestStr = JSON.stringify(manifest, null, 2);
  const manifestSha = sha256(Buffer.from(manifestStr));

  // 어제 manifest와 sha 비교 — 변경 없으면 skip
  const yesterday = new Date(Date.now() + 9 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);
  const prevManifestPath = join(REPO_ROOT, 'backups', 'storage', `${yesterday}_${BUCKET}.manifest.json`);
  if (existsSync(prevManifestPath)) {
    const prevSha = sha256(readFileSync(prevManifestPath));
    if (prevSha === manifestSha) {
      console.log(`✅ 변경 없음 (어제와 동일 manifest sha) — backup skip`);
      process.exit(0);
    }
  }

  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, manifestStr);
  console.log(`  📋 manifest: ${manifestPath}`);

  if (objects.length === 0) {
    console.log(`📭 bucket empty — manifest만 저장하고 종료`);
    process.exit(0);
  }

  // 모든 object 다운로드 → 임시 폴더
  mkdirSync(backupDir, { recursive: true });
  let i = 0;
  for (const obj of objects) {
    i++;
    process.stdout.write(`  ⬇️  [${i}/${objects.length}] ${obj.path} (${(obj.size / 1024).toFixed(1)} KB)\r`);
    const buf = await downloadObject(obj.path);
    const filePath = join(backupDir, obj.path);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, buf);
  }
  console.log(`\n  ✅ ${i} objects 다운로드 완료`);

  // tar.gz 압축
  execSync(`tar -czf "${tarPath}" -C "${dirname(backupDir)}" "${dateStr}"`, { stdio: 'inherit' });
  console.log(`  📦 압축: ${tarPath}`);

  // 임시 폴더 삭제
  rmSync(backupDir, { recursive: true, force: true });
  console.log(`✅ 백업 완료`);
}

main().catch((e) => {
  console.error(`❌ 백업 실패:`, e);
  process.exit(1);
});
