// 제품정보(사진·사양·특징·설명) → rental_cat_models.image_url / specs
//   node scripts/rental-catalog-load-product-info.mjs --env .env.dev --backup ~/Desktop/봉이_렌탈포인트_백업_20260824/rental_products.json [--apply]
// 매칭: 모델키 정확 일치만 (접미사 다른 모델은 자동 연결하지 않는다). 사람이 고친 specs 는 덮지 않는다(specs.source='manual').
import fs from 'fs'; import dotenv from 'dotenv'; import { createClient } from '@supabase/supabase-js';
import { modelKey } from '../server/services/rental-import/core.js';

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const env = dotenv.parse(fs.readFileSync(arg('--env')));
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const backup = JSON.parse(fs.readFileSync(arg('--backup')));
const byKey = new Map();
for (const p of backup) {
  const k = modelKey(p.model_key || p.model);
  if (k && !byKey.has(k)) byKey.set(k, p);
}
const models = [];
for (let from = 0; ; from += 1000) {
  const { data } = await sb.from('rental_cat_models').select('id, model_key, specs, image_url').order('id').range(from, from + 999).throwOnError();
  models.push(...data);
  if (data.length < 1000) break;
}
let matched = 0; const updates = [];
for (const m of models) {
  const p = byKey.get(m.model_key);
  if (!p) continue;
  matched++;
  if (m.specs?.source === 'manual') continue;
  updates.push({ id: m.id, image_url: m.image_url || p.image_url || null, specs: {
    source: 'backup-20260824', brand: p.brand, name: p.name, description: p.description, feature_tags: p.feature_tags,
    specifications: p.specifications, spec_notes: p.spec_notes, size_mm: p.size_mm, weight_kg: p.weight_kg,
    recommended_capacity: p.recommended_capacity, recommended_usage: p.recommended_usage, product_url: p.product_url,
  } });
}
console.log(`모델 ${models.length} / 백업 ${backup.length} / 일치 ${matched} / 반영 예정 ${updates.length}`);
if (process.argv.includes('--apply')) {
  for (const u of updates) await sb.from('rental_cat_models').update({ image_url: u.image_url, specs: u.specs }).eq('id', u.id).throwOnError();
  console.log('반영 완료');
}
process.exit(0);
