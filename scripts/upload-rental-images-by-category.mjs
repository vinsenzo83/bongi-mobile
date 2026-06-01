// 봉이모바일 — 카테고리별 폴더 → Storage 업로드 + DB image_url update
// 정수기 upload script 일반화
//
// 사용법:
//   node scripts/upload-rental-images-by-category.mjs 공기청정기 비데
//   node scripts/upload-rental-images-by-category.mjs --all  # 모든 카테고리 폴더

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const SLUG = {
  '정수기': 'water-purifiers',
  '공기청정기': 'air-purifiers',
  '비데': 'bidets',
  '에어컨': 'air-conditioners',
  '안마의자': 'massage-chairs',
  '매트리스': 'mattresses',
};

const args = process.argv.slice(2);
let categories;
if (args[0] === '--all') {
  categories = Object.keys(SLUG);
} else if (args.length) {
  categories = args;
} else {
  console.error('사용: node scripts/upload-rental-images-by-category.mjs <카테고리> ... | --all');
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});
const BUCKET = 'product-images';
const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };

async function uploadCategory(category) {
  const folderSlug = SLUG[category] || category;
  const FOLDER = process.env.HOME + '/Downloads/' + folderSlug;
  if (!existsSync(FOLDER)) {
    console.log(`\n📦 ${category} → 폴더 없음 (${FOLDER}) — skip`);
    return { category, ok: 0, fail: 0 };
  }

  const files = readdirSync(FOLDER).filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));
  console.log(`\n📦 ${category} → 폴더 파일 ${files.length}`);

  let ok = 0, fail = 0;
  const failLog = [];

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const m = f.match(/^(\d+)_/);
    if (!m) continue;
    const id = parseInt(m[1], 10);
    const ext = f.split('.').pop().toLowerCase();
    const buf = readFileSync(join(FOLDER, f));
    const path = `rental/${id}.${ext}`;

    const { error: upErr } = await supabase.storage.from(BUCKET)
      .upload(path, buf, { contentType: MIME[ext] || 'image/jpeg', upsert: true });
    if (upErr) { fail++; failLog.push({ id, reason: upErr.message }); continue; }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const { error: dbErr } = await supabase
      .from('rental_products')
      .update({ image_url: pub.publicUrl, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (dbErr) { fail++; failLog.push({ id, reason: dbErr.message }); continue; }
    ok++;
  }

  console.log(`  결과: ✅ ${ok} · ❌ ${fail}`);
  if (failLog.length) for (const f of failLog) console.log(`    - id=${f.id}: ${f.reason}`);
  return { category, ok, fail };
}

async function main() {
  const results = [];
  for (const cat of categories) {
    const r = await uploadCategory(cat);
    results.push(r);
  }

  console.log(`\n═════════════════════════════════════`);
  console.log(`  종합 업로드 결과:`);
  let totalOk = 0, totalFail = 0;
  for (const r of results) {
    console.log(`    ${r.category}: ✅ ${r.ok} · ❌ ${r.fail}`);
    totalOk += r.ok; totalFail += r.fail;
  }
  console.log(`    ─────────────`);
  console.log(`    합계: ✅ ${totalOk} · ❌ ${totalFail}`);

  // 카테고리별 image_url 채워진 통계
  const { data } = await supabase
    .from('rental_products')
    .select('id, image_url, rental_categories!inner(name)');
  if (data) {
    const byCategory = {};
    for (const p of data) {
      const c = p.rental_categories.name;
      if (!byCategory[c]) byCategory[c] = { total: 0, withImg: 0 };
      byCategory[c].total++;
      if (p.image_url) byCategory[c].withImg++;
    }
    console.log(`\n📊 라이브 카테고리별 image_url 채워진 통계:`);
    for (const [c, s] of Object.entries(byCategory).sort()) {
      const pct = s.total ? ((s.withImg / s.total) * 100).toFixed(1) : 0;
      console.log(`    ${c}: ${s.withImg}/${s.total} (${pct}%)`);
    }
  }
  console.log(`═════════════════════════════════════`);
}

main().catch(e => { console.error(e); process.exit(1); });
