// 일회성 — 데브 rental_* 를 봉이 표준 등록폼으로 전면 교체.
// 기존 빌리고 직적재분 전체 삭제(별도 mcp DELETE) 후, 등록폼 2파일 적재.
// 실행: node scripts/import-register-dev.mjs
import { createClient } from '@supabase/supabase-js';
import { parseRentalRegisterExcel } from '../server/services/rental-register-parser.js';

const DEV_URL = 'https://sesgdqbmophgmombelmn.supabase.co';
const DEV_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlc2dkcWJtb3BoZ21vbWJlbG1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzc5ODAsImV4cCI6MjA5MzY1Mzk4MH0.k75sBCMrw9OozakxVlwfYUhsb5aG4eatDLTk8PeWk1U';

const FILES = [
  { path: '/Users/vinsenzo/Downloads/★20260522_렌탈_정수기,공청기,비데 상품등록DB_최종.xlsx',
    ym: '2026-05', name: '★20260522_렌탈_정수기,공청기,비데 상품등록DB_최종.xlsx' },
  { path: '/Users/vinsenzo/Downloads/★20260520_렌탈_에어컨상품등록DB(최종).xlsx',
    ym: '2026-05', name: '★20260520_렌탈_에어컨상품등록DB(최종).xlsx' },
];

const sb = createClient(DEV_URL, DEV_KEY, { auth: { persistSession: false } });
const die = (m) => { console.error('❌ ' + m); process.exit(1); };
const toInt = (v) => (v == null ? null : Math.round(Number(v)));

// rental_categories 는 유지 — slug→id
const { data: cats, error: cErr } = await sb.from('rental_categories').select('id, slug');
if (cErr) die('categories: ' + cErr.message);
const catId = new Map((cats || []).map((c) => [c.slug, c.id]));
console.log('카테고리 ' + catId.size + '종 로드');

for (const file of FILES) {
  console.log('\n━━━ ' + file.name + ' ━━━');
  const parsed = parseRentalRegisterExcel(file.path);
  const { companies, products, options } = parsed;
  console.log(`파싱: products=${products.length} options=${options.length} companies=${companies.length} collisions=${parsed.keyCollisions}`);
  if (parsed.keyCollisions > 0) die('7-tuple 충돌 ' + parsed.keyCollisions);

  // ── batch ──
  const { data: batch, error: bErr } = await sb.from('rental_import_batches').insert({
    year_month: file.ym, file_type: '등록폼', source_filename: file.name,
    sheet_count: 1, row_count: options.length, status: 'committing',
  }).select().single();
  if (bErr) die('batch: ' + bErr.message);
  const batchId = batch.id;

  // ── companies (name UPSERT) ──
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

  // ── products (company_id|model dedup, UPSERT) ──
  const prodMap = new Map();
  for (const p of products) {
    const cid = coId.get(p.company_name);
    if (cid == null) { console.warn('  ⚠️ company 미매핑: ' + p.company_name); continue; }
    prodMap.set(cid + '|' + p.model, {
      company_id: cid, brand: p.brand ?? p.company_name, name: p.name,
      model: p.model, model_key: p.model_key ?? null, manufacturer: p.manufacturer ?? null,
      category_id: p.category_slug ? (catId.get(p.category_slug) ?? null) : null,
      product_url: p.product_url ?? null,
      display_rank: p.display_rank ?? null,
      market_score: p.market_score ?? null,
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

  // ── options ──
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
    if (error) die(`options chunk ${i} (첫행 pid=${slice[0].product_id} months=${slice[0].months}): ${error.message}`);
    done += slice.length;
  }
  console.log('options 적재 ' + done);

  await sb.from('rental_import_batches').update({
    status: 'committed', upsert_new: prodId.size + done,
  }).eq('id', batchId);
  console.log(`✅ batch ${batchId} committed`);
}

console.log('\n✅ 전체 완료');
