// TV·매트리스 이미지 121장 다운로드 + Storage 업로드 + DB image_url 갱신
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const BUCKET = 'product-images';

const TV_JSON = '/tmp/tv-image-urls.json';
const MAT_JSON = '/tmp/mattress-image-urls.json';

async function fetchImage(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  let ct = r.headers.get('content-type') || '';
  // 청호 등은 octet-stream을 반환 — URL 확장자로 강제 override
  if (!ct.startsWith('image/')) {
    const ext = (url.match(/\.(png|jpe?g|webp|gif)(\?|$)/i) || [])[1];
    ct = ext ? `image/${ext.toLowerCase().replace('jpg', 'jpeg')}` : 'image/png';
  }
  return { buf, contentType: ct };
}

async function uploadAndUpdate(productId, ogUrl, slug, label) {
  try {
    const { buf, contentType } = await fetchImage(ogUrl);
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    const filePath = `${slug}/${productId}.${ext}`;
    const { error: upErr } = await sb.storage.from(BUCKET).upload(filePath, buf, {
      contentType, upsert: true,
    });
    if (upErr) throw upErr;
    const { data: { publicUrl } } = sb.storage.from(BUCKET).getPublicUrl(filePath);
    const { error: dbErr } = await sb.from('rental_products').update({ image_url: publicUrl }).eq('id', productId);
    if (dbErr) throw dbErr;
    console.log(`  ✅ #${productId} ${label}`);
    return true;
  } catch (e) {
    console.log(`  ❌ #${productId} ${label}: ${e.message}`);
    return false;
  }
}

async function applyTV() {
  console.log('\n📺 TV 이미지 적용');
  const data = JSON.parse(fs.readFileSync(TV_JSON)).filter(x => x.og_image);
  console.log(`  수집된 ${data.length}개 모델·URL`);
  const { data: products } = await sb.from('rental_products')
    .select('id, model, name, category:rental_categories!inner(name)')
    .eq('category.name', 'TV');
  console.log(`  DB TV products: ${products.length}`);
  let ok = 0, fail = 0;
  for (const item of data) {
    // 같은 model의 모든 product에 동일 이미지 적용
    const matched = products.filter(p => p.model === item.model);
    for (const p of matched) {
      const r = await uploadAndUpdate(p.id, item.og_image, 'tv', `${p.model} (${p.name?.slice(0,30)})`);
      if (r) ok++; else fail++;
    }
  }
  console.log(`📺 TV 완료: 성공 ${ok} / 실패 ${fail}`);
}

async function applyMattress() {
  console.log('\n🛏️ 매트리스 이미지 적용');
  const data = JSON.parse(fs.readFileSync(MAT_JSON)).filter(x => x.og_image);
  console.log(`  수집된 ${data.length}개 (name, brand) 그룹`);
  const { data: products } = await sb.from('rental_products')
    .select('id, model, name, brand, category:rental_categories!inner(name)')
    .eq('category.name', '매트리스');
  console.log(`  DB 매트리스 products: ${products.length}`);
  let ok = 0, fail = 0;
  for (const item of data) {
    // 같은 (brand, name)의 모든 product에 동일 이미지 적용
    const matched = products.filter(p => p.brand === item.brand && p.name === item.name);
    for (const p of matched) {
      const r = await uploadAndUpdate(p.id, item.og_image, 'mattress', `${p.brand}/${p.name?.slice(0,25)}`);
      if (r) ok++; else fail++;
    }
  }
  console.log(`🛏️ 매트리스 완료: 성공 ${ok} / 실패 ${fail}`);
}

await applyTV();
await applyMattress();

// 최종 검증
const { data: stats } = await sb.from('rental_products')
  .select('category:rental_categories!inner(name), image_url')
  .in('category.name', ['TV', '매트리스']);
const byCat = {};
for (const p of stats) {
  const c = p.category.name;
  if (!byCat[c]) byCat[c] = { total: 0, has_img: 0 };
  byCat[c].total++;
  if (p.image_url) byCat[c].has_img++;
}
console.log('\n🏁 최종:', byCat);
