// 봉이모바일 — 정수기 product 이미지 자동 다운로드
// product_url에서 og:image meta 추출 → 다운로드 → ~/Downloads/water-purifiers/
//
// 사용법: node scripts/download-water-purifier-images.mjs

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..');
dotenv.config({ path: join(REPO, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_KEY 누락');
  process.exit(1);
}

const FOLDER = process.env.HOME + '/Downloads/water-purifiers';
mkdirSync(FOLDER, { recursive: true });

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko)';

const cleanFn = (s) => String(s||'').replace(/[\/\\:*?"<>|]/g, '_').replace(/\s+/g, '_').slice(0, 60);

async function fetchOgImage(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const html = await res.text();
    const m = html.match(/<meta[^>]+og:image[^>]+content=["']([^"']+)/i)
           || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+og:image/i)
           || html.match(/<meta[^>]+twitter:image[^>]+content=["']([^"']+)/i);
    if (!m) return { ok: false, reason: 'og:image 없음' };
    let img = m[1];
    if (img.startsWith('//')) img = 'https:' + img;
    else if (img.startsWith('/')) img = new URL(url).origin + img;
    return { ok: true, img };
  } catch (e) {
    return { ok: false, reason: e.message.slice(0, 60) };
  }
}

async function downloadImage(imgUrl) {
  try {
    const res = await fetch(imgUrl, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const buf = Buffer.from(await res.arrayBuffer());
    let ext = (imgUrl.split('?')[0].split('.').pop() || 'jpg').toLowerCase();
    if (!/^(jpg|jpeg|png|webp|gif)$/.test(ext)) ext = 'jpg';
    return { ok: true, buf, ext };
  } catch (e) {
    return { ok: false, reason: e.message.slice(0, 60) };
  }
}

async function main() {
  console.log('📦 정수기 product fetch...');
  const { data, error } = await supabase
    .from('rental_products')
    .select('id, brand, model, product_url, image_url, category_id, rental_categories!inner(name)')
    .eq('rental_categories.name', '정수기')
    .order('brand').order('model');
  if (error) throw error;
  console.log(`  → ${data.length} 정수기`);

  const queue = data.filter(p => p.product_url);
  const skipped = data.length - queue.length;
  console.log(`  → ${queue.length} (product_url 있음) · ${skipped} skip`);

  let ok = 0, fail = 0;
  const failLog = [];

  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    const fname = `${p.id}_${cleanFn(p.brand)}_${cleanFn(p.model)}`;
    const existing = ['jpg','jpeg','png','webp','gif'].find(e => existsSync(join(FOLDER, `${fname}.${e}`)));
    if (existing) {
      ok++;
      if (i % 10 === 0) console.log(`  [${i+1}/${queue.length}] ${p.brand} ${p.model} — already exists (${existing})`);
      continue;
    }

    const og = await fetchOgImage(p.product_url);
    if (!og.ok) {
      fail++;
      failLog.push({ id: p.id, brand: p.brand, model: p.model, reason: og.reason });
      console.log(`  [${i+1}/${queue.length}] ❌ ${p.brand} ${p.model}: ${og.reason}`);
      continue;
    }

    const dl = await downloadImage(og.img);
    if (!dl.ok) {
      fail++;
      failLog.push({ id: p.id, brand: p.brand, model: p.model, reason: `img download: ${dl.reason}` });
      console.log(`  [${i+1}/${queue.length}] ❌ ${p.brand} ${p.model}: img download ${dl.reason}`);
      continue;
    }

    writeFileSync(join(FOLDER, `${fname}.${dl.ext}`), dl.buf);
    ok++;
    if ((i+1) % 10 === 0 || i === queue.length-1) {
      console.log(`  [${i+1}/${queue.length}] ✅ ${ok} 다운로드 · ${fail} 실패`);
    }
    // 약한 rate limit (서버 부담 회피)
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n═════════════════════════════════════`);
  console.log(`  최종: ✅ ${ok} · ❌ ${fail} · ⏭️ ${skipped}`);
  console.log(`  폴더: ${FOLDER}`);
  console.log(`═════════════════════════════════════`);

  if (failLog.length) {
    console.log(`\n실패 목록 (${failLog.length}건):`);
    for (const f of failLog) console.log(`  - ${f.id} ${f.brand} ${f.model}: ${f.reason}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
