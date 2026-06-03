// 누락 39 product image apply — 정수기 16 + 매트리스 8 + TV 15 (5 model × variant)
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import fs from 'fs';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const BUCKET = 'product-images';

async function fetchImage(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  let ct = r.headers.get('content-type') || '';
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

async function applyWaterPurifier() {
  console.log('\n💧 정수기 이미지 적용');
  const data = JSON.parse(fs.readFileSync('/tmp/water-purifier-image-urls.json'))
    .filter(x => x.ok && x.og_image && x.id);
  console.log(`  매칭 대상 ${data.length}개`);
  let ok = 0, fail = 0;
  for (const item of data) {
    const r = await uploadAndUpdate(item.id, item.og_image, 'water-purifier', `${item.brand}/${item.model}`);
    if (r) ok++; else fail++;
  }
  console.log(`💧 정수기 완료: 성공 ${ok} / 실패 ${fail}`);
}

async function applyMattress() {
  console.log('\n🛏️ 매트리스 이미지 적용 (코웨이 누락 8장)');
  const missing = JSON.parse(fs.readFileSync('/tmp/missing-mattress-8.json'));
  const urls = JSON.parse(fs.readFileSync('/tmp/mattress-image-urls.json'));
  let ok = 0, fail = 0;
  for (const m of missing) {
    // 매칭: brand + name 정확 매칭 (코웨이 컬러 variant는 model 다르지만 name 동일)
    const match = urls.find(u => u.ok !== false && u.og_image && u.brand === m.brand && u.name === m.name);
    if (!match) {
      console.log(`  ⚠️ #${m.id} ${m.brand}/${m.name}: URL 매칭 실패`);
      fail++;
      continue;
    }
    const r = await uploadAndUpdate(m.id, match.og_image, 'mattress', `${m.brand}/${m.name}`);
    if (r) ok++; else fail++;
  }
  console.log(`🛏️ 매트리스 완료: 성공 ${ok} / 실패 ${fail}`);
}

async function applyTV() {
  console.log('\n📺 TV 이미지 적용 (삼성 5 model × variant = 15장)');
  const missing = JSON.parse(fs.readFileSync('/tmp/missing-tv-15.json'));
  const urls = JSON.parse(fs.readFileSync('/tmp/tv-image-urls.json'));
  let ok = 0, fail = 0;
  for (const m of missing) {
    const match = urls.find(u => u.ok !== false && u.og_image && u.model === m.model);
    if (!match) {
      console.log(`  ⚠️ #${m.id} ${m.model}: URL 매칭 실패`);
      fail++;
      continue;
    }
    const r = await uploadAndUpdate(m.id, match.og_image, 'tv', `${m.model}`);
    if (r) ok++; else fail++;
  }
  console.log(`📺 TV 완료: 성공 ${ok} / 실패 ${fail}`);
}

await applyWaterPurifier();
await applyMattress();
await applyTV();

// 최종 검증
const { data: stats } = await sb.from('rental_products')
  .select('category:rental_categories!inner(name), image_url')
  .in('category.name', ['정수기', '매트리스', 'TV', '에어컨', '공기청정기', '비데']);
const byCat = {};
for (const p of stats || []) {
  const c = p.category.name;
  if (!byCat[c]) byCat[c] = { total: 0, has_img: 0 };
  byCat[c].total++;
  if (p.image_url) byCat[c].has_img++;
}
console.log('\n🏁 최종 카테고리별 image 보유율:');
for (const [c, v] of Object.entries(byCat)) {
  const pct = (v.has_img / v.total * 100).toFixed(1);
  console.log(`  ${c}: ${v.has_img}/${v.total} (${pct}%)`);
}
