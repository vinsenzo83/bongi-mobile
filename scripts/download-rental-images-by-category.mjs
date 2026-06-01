// 봉이모바일 — 카테고리별 rental_products 이미지 자동 다운로드
// 정수기 다운로드 script 일반화 — 카테고리 인자 받음
//
// 사용법:
//   node scripts/download-rental-images-by-category.mjs 공기청정기 비데
//   node scripts/download-rental-images-by-category.mjs 공기청정기

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const CATEGORIES = process.argv.slice(2);
if (!CATEGORIES.length) {
  console.error('사용: node scripts/download-rental-images-by-category.mjs <카테고리1> [<카테고리2> ...]');
  process.exit(1);
}

// 카테고리명 → 폴더 slug (한글 → 영문)
const SLUG = {
  '정수기': 'water-purifiers',
  '공기청정기': 'air-purifiers',
  '비데': 'bidets',
  '에어컨': 'air-conditioners',
  '안마의자': 'massage-chairs',
  '매트리스': 'mattresses',
  '얼음정수기': 'ice-purifiers',
  '냉온정수기': 'hot-cold-purifiers',
  '연수기': 'water-softeners',
};

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const cleanFn = (s) => String(s||'').replace(/[\/\\:*?"<>|]/g, '_').replace(/\s+/g, '_').slice(0, 60);

async function fetchOgImage(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
      },
      redirect: 'follow',
    });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const html = await res.text();
    const patterns = [
      /<meta[^>]+og:image[^>]+content=["']([^"']+)/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+og:image/i,
      /<meta[^>]+twitter:image[^>]+content=["']([^"']+)/i,
      /<meta[^>]+og:image:url[^>]+content=["']([^"']+)/i,
      /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)/i,
      /"image"\s*:\s*"([^"]+\.(?:jpg|jpeg|png|webp))"/i,
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m && m[1]) {
        let img = m[1].replace(/\\\//g, '/');
        if (img.startsWith('//')) img = 'https:' + img;
        else if (img.startsWith('/')) img = new URL(url).origin + img;
        return { ok: true, img };
      }
    }
    // <img> fallback (product/upload/prd/goods 경로)
    const m = html.match(/<img[^>]+src=["']([^"']*(?:product|upload|prd|goods)[^"']*\.(?:jpg|jpeg|png|webp))/i);
    if (m) {
      let img = m[1];
      if (img.startsWith('//')) img = 'https:' + img;
      else if (img.startsWith('/')) img = new URL(url).origin + img;
      return { ok: true, img, fallback: 'img-tag' };
    }
    return { ok: false, reason: 'og:image 없음' };
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

async function downloadCategory(category) {
  const folderSlug = SLUG[category] || cleanFn(category);
  const FOLDER = process.env.HOME + '/Downloads/' + folderSlug;
  mkdirSync(FOLDER, { recursive: true });
  console.log(`\n📦 ${category} → ${FOLDER}`);

  const { data, error } = await supabase
    .from('rental_products')
    .select('id, brand, model, product_url, image_url, rental_categories!inner(name)')
    .eq('rental_categories.name', category);
  if (error) throw error;

  // image_url 없고 product_url 있는 것만
  const queue = data.filter(p => (!p.image_url || p.image_url === '') && p.product_url);
  const skipped = data.length - queue.length;
  console.log(`  → ${data.length} product · 다운로드 대상 ${queue.length} · skip ${skipped} (이미지 있거나 URL 없음)`);

  let ok = 0, fail = 0;
  const failLog = [];

  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    const fname = `${p.id}_${cleanFn(p.brand)}_${cleanFn(p.model)}`;
    const existing = ['jpg','jpeg','png','webp','gif'].find(e => existsSync(join(FOLDER, `${fname}.${e}`)));
    if (existing) {
      ok++;
      continue;
    }

    const og = await fetchOgImage(p.product_url);
    if (!og.ok) {
      fail++;
      failLog.push({ id: p.id, brand: p.brand, model: p.model, reason: og.reason });
      continue;
    }
    const dl = await downloadImage(og.img);
    if (!dl.ok) {
      fail++;
      failLog.push({ id: p.id, brand: p.brand, model: p.model, reason: `img: ${dl.reason}` });
      continue;
    }
    writeFileSync(join(FOLDER, `${fname}.${dl.ext}`), dl.buf);
    ok++;
    if ((i+1) % 5 === 0 || i === queue.length-1) {
      console.log(`  [${i+1}/${queue.length}] ✅ ${ok} 다운로드 · ${fail} 실패`);
    }
    await new Promise(r => setTimeout(r, 250));
  }

  console.log(`  결과: ✅ ${ok} · ❌ ${fail}`);
  if (failLog.length) {
    console.log(`  실패:`);
    for (const f of failLog) console.log(`    - ${f.id} ${f.brand} ${f.model}: ${f.reason}`);
  }
  return { category, ok, fail, failLog };
}

async function main() {
  const results = [];
  for (const cat of CATEGORIES) {
    const r = await downloadCategory(cat);
    results.push(r);
  }
  console.log(`\n═════════════════════════════════════`);
  console.log(`  종합:`);
  for (const r of results) {
    console.log(`    ${r.category}: ✅ ${r.ok} · ❌ ${r.fail}`);
  }
  console.log(`═════════════════════════════════════`);
}

main().catch(e => { console.error(e); process.exit(1); });
