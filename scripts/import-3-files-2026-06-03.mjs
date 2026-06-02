// 데브에 3 파일 (에어컨·TV·매트리스) 일괄 import
// 실행: node scripts/import-3-files-dev.mjs

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { parseRentalRegisterExcel } from '../server/services/rental-register-parser.js';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
if (!URL || !KEY) { console.error('❌ SUPABASE URL/KEY 누락'); process.exit(1); }
if (!URL.includes('dugaqvvnhsgenhmhuyju')) { console.error('❌ 라이브 URL 아님: ' + URL); process.exit(1); }
console.log('🔴 라이브 import 시작 — UPSERT 패턴 (기존 모델은 UPDATE)');

const FILES = [
  { path: '/tmp/매트리스_정규화_v2.xlsx', ym: '2026-05', name: '매트리스_5/28' },
];

const sb = createClient(URL, KEY, { auth: { persistSession: false } });
const die = (m) => { console.error('❌ ' + m); process.exit(1); };
const toInt = (v) => (v == null || v === '' ? null : Math.round(Number(v)));

const { data: cats, error: cErr } = await sb.from('rental_categories').select('id, slug');
if (cErr) die('categories: ' + cErr.message);
const catId = new Map((cats || []).map((c) => [c.slug, c.id]));
console.log('카테고리 ' + catId.size + '종 로드');

let totalNewProducts = 0, totalNewOptions = 0;

for (const file of FILES) {
  console.log('\n━━━ ' + file.name + ' ━━━');
  let parsed;
  try {
    parsed = parseRentalRegisterExcel(file.path);
  } catch (e) {
    console.log('❌ parse 실패: ' + e.message);
    continue;
  }
  const { companies, products, options } = parsed;
  console.log(`파싱: products=${products.length} options=${options.length} companies=${companies.length} collisions=${parsed.keyCollisions ?? 0}`);
  if (parsed.warnings?.length) {
    console.log('경고 ' + parsed.warnings.length + '건 (첫 3): ' + parsed.warnings.slice(0,3).map(w=>w.message||w).join(' | '));
  }

  const { data: batch, error: bErr } = await sb.from('rental_import_batches').insert({
    year_month: file.ym, file_type: '등록폼', source_filename: file.name,
    sheet_count: 1, row_count: options.length, status: 'committing',
  }).select().single();
  if (bErr) die('batch: ' + bErr.message);
  const batchId = batch.id;

  // companies
  const { data: dbCo } = await sb.from('rental_companies').select('id, name');
  const coId = new Map((dbCo || []).map((c) => [c.name, c.id]));
  const newCo = companies.filter((c) => !coId.has(c.name)).map((c) => ({
    name: c.name, category_group: c.category_group || '정수기메이커',
    commission_method: c.commission_method || 'direct',
    commission_rate: c.commission_rate ?? null,
    commission_flat: c.commission_flat ?? null,
    commission_multiple: c.commission_multiple ?? null,
    rental_fee_basis: c.rental_fee_basis || 'total',
    has_dual_pricing: c.has_dual_pricing ?? false,
    settle_basis: c.settle_basis || '설치완료',
    notes: c.notes ?? null, is_active: true,
  }));
  if (newCo.length) {
    const { data, error } = await sb.from('rental_companies').insert(newCo).select('id, name');
    if (error) die('companies: ' + error.message);
    for (const c of data) coId.set(c.name, c.id);
  }
  console.log('companies 신규 ' + newCo.length);

  // products (UPSERT)
  const prodMap = new Map();
  for (const p of products) {
    const cid = coId.get(p.company_name);
    if (cid == null) continue;
    prodMap.set(cid + '|' + p.model, {
      company_id: cid, brand: p.brand ?? p.company_name, name: p.name,
      model: p.model, model_key: p.model_key ?? null, manufacturer: p.manufacturer ?? null,
      category_id: p.category_slug ? (catId.get(p.category_slug) ?? null) : null,
      product_url: p.product_url ?? null,
      display_rank: p.display_rank ?? null, market_score: p.market_score ?? null,
      registration_status: p.registration_status ?? null,
      evaluation_memo: p.evaluation_memo ?? null,
      is_active: p.is_active !== false,
      billigo_status: '신규', source_batch_id: batchId,
      metadata: p.metadata ?? {},
    });
  }
  const prodRows = [...prodMap.values()];
  const prodId = new Map();
  for (let i = 0; i < prodRows.length; i += 500) {
    const { data, error } = await sb.from('rental_products')
      .upsert(prodRows.slice(i, i + 500), { onConflict: 'company_id,model' })
      .select('id, company_id, model');
    if (error) die(`products chunk ${i}: ${error.message}`);
    for (const p of data) prodId.set(p.company_id + '|' + p.model, p.id);
  }
  console.log('products 적재 ' + prodId.size);
  totalNewProducts += prodId.size;

  // options
  const optRows = [];
  for (const o of options) {
    const cid = coId.get(o.company_name);
    const pid = cid != null ? prodId.get(cid + '|' + o.model) : null;
    if (pid == null) continue;
    optRows.push({
      product_id: pid, months: toInt(o.months) ?? 0,
      care_service: o.care_service ?? null,
      inspection_cycle: toInt(o.inspection_cycle), ownership_months: toInt(o.ownership_months),
      normal_price: toInt(o.normal_price), monthly_fee: toInt(o.monthly_fee) ?? 0,
      monthly_diff: toInt(o.monthly_diff), half_fee: toInt(o.half_fee), half_period: toInt(o.half_period),
      rebate: o.rebate ?? null, rebate_otherco: o.rebate_otherco ?? null, rebate_half: o.rebate_half ?? null,
      bundle_rate: toInt(o.bundle_rate),
      promo_type: o.promo_type ?? null, commission_method: o.commission_method || 'direct',
      variant_code: o.variant_code ?? '', variant_label: o.variant_label ?? '',
      is_active: true, source_batch_id: batchId, metadata: o.metadata ?? {},
    });
  }
  let done = 0;
  for (let i = 0; i < optRows.length; i += 500) {
    const slice = optRows.slice(i, i + 500);
    const { error } = await sb.from('rental_product_options').insert(slice);
    if (error) { console.log(`❌ options chunk ${i}: ${error.message}`); break; }
    done += slice.length;
  }
  console.log('options 적재 ' + done);
  totalNewOptions += done;

  await sb.from('rental_import_batches').update({ status: 'committed', upsert_new: prodId.size + done }).eq('id', batchId);
  console.log(`✅ batch ${batchId} committed`);
}

console.log(`\n═════════════════════════════════════`);
console.log(`  합계: products ${totalNewProducts} · options ${totalNewOptions}`);
console.log(`═════════════════════════════════════`);
