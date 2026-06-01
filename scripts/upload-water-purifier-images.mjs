// 봉이모바일 — 정수기 이미지 일괄 Storage 업로드 + DB image_url update
// 파일명 패턴: {id}_{brand}_{model}.{ext} → rental_products.id 기준 업로드
//
// 사용법: node scripts/upload-water-purifier-images.mjs

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });
const FOLDER = process.env.HOME + '/Downloads/water-purifiers';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});
const BUCKET = 'product-images';

const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };

async function main() {
  console.log('📦 정수기 이미지 업로드 시작');

  // 폴더 내 파일 list
  const files = readdirSync(FOLDER).filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));
  console.log(`  → 폴더: ${files.length} 파일`);

  // 파일명에서 product id 추출
  const tasks = [];
  for (const f of files) {
    const m = f.match(/^(\d+)_/);
    if (!m) {
      console.log(`  ⚠️ skip (id 추출 불가): ${f}`);
      continue;
    }
    const id = parseInt(m[1], 10);
    const ext = f.split('.').pop().toLowerCase();
    tasks.push({ id, file: f, ext, size: statSync(join(FOLDER, f)).size });
  }
  console.log(`  → ${tasks.length} 업로드 대상`);

  let ok = 0, fail = 0;
  const failLog = [];

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    try {
      const buf = readFileSync(join(FOLDER, t.file));
      // Storage upload — path: rental/{id}.{ext} (덮어쓰기)
      const path = `rental/${t.id}.${t.ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET)
        .upload(path, buf, {
          contentType: MIME[t.ext] || 'image/jpeg',
          upsert: true,
        });
      if (upErr) {
        fail++;
        failLog.push({ ...t, reason: `storage: ${upErr.message}` });
        console.log(`  [${i+1}/${tasks.length}] ❌ id=${t.id}: ${upErr.message.slice(0,60)}`);
        continue;
      }
      // publicUrl 받기
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const url = pub.publicUrl;

      // DB image_url update
      const { error: dbErr } = await supabase
        .from('rental_products')
        .update({ image_url: url, updated_at: new Date().toISOString() })
        .eq('id', t.id);
      if (dbErr) {
        fail++;
        failLog.push({ ...t, reason: `db: ${dbErr.message}` });
        console.log(`  [${i+1}/${tasks.length}] ❌ id=${t.id}: ${dbErr.message.slice(0,60)}`);
        continue;
      }

      ok++;
      if ((i+1) % 10 === 0 || i === tasks.length-1) {
        console.log(`  [${i+1}/${tasks.length}] ✅ ${ok} 업로드 (이번 id=${t.id} · ${(t.size/1024).toFixed(1)} KB)`);
      }
    } catch (e) {
      fail++;
      failLog.push({ ...t, reason: e.message.slice(0,60) });
    }
  }

  console.log(`\n═════════════════════════════════════`);
  console.log(`  완료: ✅ ${ok} 업로드 + DB update · ❌ ${fail} 실패`);
  console.log(`═════════════════════════════════════`);

  if (failLog.length) {
    console.log(`\n실패 (${failLog.length}건):`);
    for (const f of failLog) console.log(`  - id=${f.id}: ${f.reason}`);
  }

  // 라이브 image_url 채워진 정수기 통계
  const { data: stats } = await supabase
    .from('rental_products')
    .select('id, image_url, rental_categories!inner(name)')
    .eq('rental_categories.name', '정수기');
  if (stats) {
    const withImg = stats.filter(p => p.image_url).length;
    console.log(`\n📊 라이브 정수기 ${stats.length} product 중 image_url 채워진 것: ${withImg}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
