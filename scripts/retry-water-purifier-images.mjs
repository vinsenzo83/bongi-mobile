// 봉이모바일 — 실패한 정수기 이미지 재시도
// 1차 다운로드에서 실패한 11건만 retry
// - HTTP 429: 30초 대기 + 강화 headers
// - og:image 없음: 사이트별 fallback selector (image_src·json-ld·product img)

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });
const FOLDER = process.env.HOME + '/Downloads/water-purifiers';
mkdirSync(FOLDER, { recursive: true });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

// 실패 11건 — 1차 다운로드 결과
const FAILED_IDS = [388, 389, 390, 392, 393, 405, 410, 348, 87, 363, 374];

// 강화 headers — 일반 브라우저 가장 가깝게
const headers = (referer) => ({
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
  'Cache-Control': 'no-cache',
  ...(referer ? { 'Referer': referer } : {}),
});

const cleanFn = (s) => String(s||'').replace(/[\/\\:*?"<>|]/g, '_').replace(/\s+/g, '_').slice(0, 60);

async function fetchWithRetry(url, opts = {}, maxRetry = 3) {
  for (let i = 0; i < maxRetry; i++) {
    try {
      const res = await fetch(url, { redirect: 'follow', ...opts });
      if (res.status === 429) {
        const wait = (i + 1) * 30_000;
        console.log(`     ⏳ HTTP 429 — ${wait/1000}s 대기 후 재시도`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      return res;
    } catch (e) {
      if (i === maxRetry - 1) throw e;
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  return null;
}

// 사이트별 image extraction fallback chain
function extractImage(html, baseUrl) {
  const patterns = [
    /<meta[^>]+og:image[^>]+content=["']([^"']+)/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+og:image/i,
    /<meta[^>]+twitter:image[^>]+content=["']([^"']+)/i,
    /<meta[^>]+og:image:url[^>]+content=["']([^"']+)/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)/i,
    /"image"\s*:\s*"([^"]+\.(?:jpg|jpeg|png|webp))"/i,
    /"image"\s*:\s*\[\s*"([^"]+\.(?:jpg|jpeg|png|webp))"/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) {
      let img = m[1].replace(/\\\//g, '/');
      if (img.startsWith('//')) img = 'https:' + img;
      else if (img.startsWith('/')) img = new URL(baseUrl).origin + img;
      return { ok: true, img };
    }
  }
  // 마지막 fallback: <img> 태그 중 product/upload 디렉토리
  const imgMatch = html.match(/<img[^>]+src=["']([^"']*(?:product|upload|prd|goods)[^"']*\.(?:jpg|jpeg|png|webp))/i);
  if (imgMatch) {
    let img = imgMatch[1];
    if (img.startsWith('//')) img = 'https:' + img;
    else if (img.startsWith('/')) img = new URL(baseUrl).origin + img;
    return { ok: true, img, fallback: 'img-tag' };
  }
  return { ok: false };
}

async function main() {
  console.log('🔄 실패 11건 재시도');
  const { data, error } = await supabase
    .from('rental_products')
    .select('id, brand, model, product_url')
    .in('id', FAILED_IDS);
  if (error) throw error;

  let ok = 0, fail = 0;
  const newFails = [];

  for (let i = 0; i < data.length; i++) {
    const p = data[i];
    if (!p.product_url) { fail++; newFails.push({...p, reason:'url null'}); continue; }
    const baseRef = new URL(p.product_url).origin;
    console.log(`\n[${i+1}/${data.length}] ${p.brand} ${p.model}`);
    console.log(`     URL: ${p.product_url.slice(0,80)}`);

    // 1차: 페이지 HTML fetch
    const res = await fetchWithRetry(p.product_url, { headers: headers(baseRef) });
    if (!res || !res.ok) {
      fail++;
      newFails.push({...p, reason: `HTTP ${res?.status || 'fail'}`});
      console.log(`     ❌ page HTTP ${res?.status || 'fail'}`);
      continue;
    }
    const html = await res.text();
    const ex = extractImage(html, p.product_url);
    if (!ex.ok) {
      fail++;
      newFails.push({...p, reason: 'image 추출 실패 (all selectors)'});
      console.log(`     ❌ image selector 모두 실패`);
      continue;
    }
    console.log(`     📷 img: ${ex.img.slice(0,80)} ${ex.fallback ? '(' + ex.fallback + ')' : ''}`);

    // 2차: 이미지 다운로드
    const imgRes = await fetchWithRetry(ex.img, { headers: headers(p.product_url) });
    if (!imgRes || !imgRes.ok) {
      fail++;
      newFails.push({...p, reason: `img HTTP ${imgRes?.status}`});
      console.log(`     ❌ img download HTTP ${imgRes?.status}`);
      continue;
    }
    const buf = Buffer.from(await imgRes.arrayBuffer());
    let ext = (ex.img.split('?')[0].split('.').pop() || 'jpg').toLowerCase();
    if (!/^(jpg|jpeg|png|webp|gif)$/.test(ext)) ext = 'jpg';
    const fname = `${p.id}_${cleanFn(p.brand)}_${cleanFn(p.model)}.${ext}`;
    writeFileSync(join(FOLDER, fname), buf);
    ok++;
    console.log(`     ✅ ${fname} (${(buf.length/1024).toFixed(1)} KB)`);

    // smartstore.naver 등은 rate limit 회피 위해 더 긴 wait
    const wait = /smartstore\.naver|ubusmall/.test(p.product_url) ? 3000 : 1000;
    await new Promise(r => setTimeout(r, wait));
  }

  console.log(`\n═════════════════════════════════════`);
  console.log(`  재시도 결과: ✅ ${ok} · ❌ ${fail}`);
  console.log(`═════════════════════════════════════`);
  if (newFails.length) {
    console.log(`\n여전히 실패 (${newFails.length}건):`);
    for (const f of newFails) console.log(`  - ${f.id} ${f.brand} ${f.model}: ${f.reason}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
