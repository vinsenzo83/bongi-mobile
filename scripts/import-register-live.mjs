// 일회성 — 라이브에 봉이 표준 등록폼 적재. service key 는 .env 에서 로드(하드코딩 X).
// 라이브 rental_* 는 옛 데이터 제거 완료(sales 참조 2+2행만 단종 잔존).
// 실행: node scripts/import-register-live.mjs
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { parseRentalRegisterExcel } from '../server/services/rental-register-parser.js';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
if (!URL || !KEY) { console.error('❌ SUPABASE_URL/SERVICE_KEY 누락'); process.exit(1); }
if (!URL.includes('dugaqvvnhsgenhmhuyju')) { console.error('❌ 라이브 URL 아님: ' + URL); process.exit(1); }

const FILES = [
  { path: '/Users/vinsenzo/Downloads/★20260522_렌탈_정수기,공청기,비데 상품등록DB_최종.xlsx',
    ym: '2026-05', name: '★20260522_렌탈_정수기,공청기,비데 상품등록DB_최종.xlsx' },
  { path: '/Users/vinsenzo/Downloads/★20260520_렌탈_에어컨상품등록DB(최종).xlsx',
    ym: '2026-05', name: '★20260520_렌탈_에어컨상품등록DB(최종).xlsx' },
];

const sb = createClient(URL, KEY, { auth: { persistSession: false } });
const die = (m) => { console.error('❌ ' + m); process.exit(1); };
const toInt = (v) => (v == null ? null : Math.round(Number(v)));

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

  const { data: batch, error: bErr } = await sb.from('rental_import_batches').insert({
    year_month: file.ym, file_type: '등록폼', source_filename: file.name,
    sheet_count: 1, row_count: options.length, status: 'committing',
  }).select().single();
  if (bErr) die('batch: ' + bErr.message);
  const batchId = batch.id;

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

  const prodMap = new Map();
  for (const p of products) {
    const cid = coId.get(p.company_name);
    if (cid == null) { console.warn('  ⚠️ company 미매핑: ' + p.company_name); continue; }
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

// 집계 컬럼 — RPC 가 없으니 옵션 집계는 어드민 GET 이 product 컬럼 사용. 여기선 채움.
console.log('\n집계·티켓·recalc 는 후속 SQL 로 처리');
console.log('✅ 적재 완료');
