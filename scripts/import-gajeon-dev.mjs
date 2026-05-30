// 일회성 — 빌리고 가전 파일을 데브(sesgdqbmophgmombelmn)에 직접 적재.
// 봉이 Express rate limiter 우회 위해 Supabase PostgREST 직결.
// 데브 import 4테이블 RLS off 상태라 anon key 로 INSERT 가능.
// 실행: node scripts/import-gajeon-dev.mjs
import { createClient } from '@supabase/supabase-js';
import { parseBilligoGajeonExcel } from '../server/services/billigo-gajeon-parser.js';

const DEV_URL = 'https://sesgdqbmophgmombelmn.supabase.co';
const DEV_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlc2dkcWJtb3BoZ21vbWJlbG1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzc5ODAsImV4cCI6MjA5MzY1Mzk4MH0.k75sBCMrw9OozakxVlwfYUhsb5aG4eatDLTk8PeWk1U';
const GAJEON = '/Users/vinsenzo/Downloads/★ 26.05(빌리고_가전) 수수료율 및 상품리스트_3차 .xlsx';

const sb = createClient(DEV_URL, DEV_KEY, { auth: { persistSession: false } });
const die = (m) => { console.error('❌ ' + m); process.exit(1); };

const parsed = parseBilligoGajeonExcel(GAJEON);
const { companies, products, options } = parsed;
console.log(`파싱: products=${products.length} options=${options.length} companies=${companies.length} collisions=${parsed.keyCollisions}`);
if (parsed.keyCollisions > 0) die('7-tuple 충돌 ' + parsed.keyCollisions);

// ── 사전 검증 ──
const careSet = {};
for (const o of options) { const k = o.care_service ?? 'NULL'; careSet[k] = (careSet[k] || 0) + 1; }
console.log('care_service 분포:', JSON.stringify(careSet));
const badCare = Object.keys(careSet).filter((k) => k !== '방문' && k !== '셀프' && k !== 'NULL');
if (badCare.length) die('care_service CHECK 위반 값: ' + badCare.join(' / '));
const mMin = Math.min(...options.map((o) => o.months ?? 0));
console.log('months 최소:', mMin);
if (mMin < 0) die('months 음수 존재');

// ── 1. batch ──
const { data: batch, error: bErr } = await sb.from('rental_import_batches').insert({
  year_month: '2026-05', file_type: '가전',
  source_filename: '★ 26.05(빌리고_가전) 수수료율 및 상품리스트_3차.xlsx',
  sheet_count: 24, row_count: options.length, status: 'committing',
}).select().single();
if (bErr) die('batch INSERT: ' + bErr.message);
const batchId = batch.id;
console.log('batch_id:', batchId);

const fail = async (msg) => {
  await sb.from('rental_import_batches').update({ status: 'failed', error_message: msg }).eq('id', batchId);
  die(msg);
};

// ── 2. companies (신규만) ──
const { data: dbCo, error: coErr } = await sb.from('rental_companies').select('id,name');
if (coErr) await fail('companies SELECT: ' + coErr.message);
const coId = new Map((dbCo || []).map((c) => [c.name, c.id]));
const newCo = companies.filter((c) => !coId.has(c.name)).map((c) => ({
  name: c.name, category_group: c.category_group || '가전렌탈사',
  commission_method: c.commission_method || 'rate',
  commission_rate: c.commission_rate ?? null,
  commission_flat: c.commission_flat ?? null,
  commission_multiple: c.commission_multiple ?? null,
  rental_fee_basis: c.rental_fee_basis || 'total',
  has_dual_pricing: c.has_dual_pricing ?? false,
  settle_basis: c.settle_basis || '설치완료',
  notes: c.notes ?? null, is_active: true,
}));
if (newCo.length) {
  const { data, error } = await sb.from('rental_companies').insert(newCo).select('id,name');
  if (error) await fail('companies INSERT: ' + error.message);
  for (const c of data) coId.set(c.name, c.id);
}
console.log('companies 신규:', newCo.length);

// ── 3. categories slug→id ──
const { data: cats, error: catErr } = await sb.from('rental_categories').select('id,slug');
if (catErr) await fail('categories SELECT: ' + catErr.message);
const catId = new Map((cats || []).map((c) => [c.slug, c.id]));

// ── 4. products (dedup company_id|model, upsert) ──
const prodMap = new Map();
let noCo = 0;
for (const p of products) {
  const cid = coId.get(p.company_name);
  if (cid == null) { noCo++; continue; }
  prodMap.set(cid + '|' + p.model, {
    company_id: cid, model: p.model, name: p.name, brand: p.company_name,
    manufacturer: p.manufacturer ?? null, model_key: p.model_key ?? null,
    category_id: p.category_slug ? (catId.get(p.category_slug) ?? null) : null,
    source_batch_id: batchId, billigo_status: p.billigo_status || '신규', is_active: true,
  });
}
if (noCo) console.warn('⚠️ company 미매핑 product:', noCo);
const prodRows = [...prodMap.values()];
console.log('products dedup 후:', prodRows.length);

const prodId = new Map();
for (let i = 0; i < prodRows.length; i += 500) {
  const slice = prodRows.slice(i, i + 500);
  const { data, error } = await sb.from('rental_products')
    .upsert(slice, { onConflict: 'company_id,model' }).select('id,company_id,model');
  if (error) await fail(`products chunk ${i}: ${error.message}`);
  for (const p of data) prodId.set(p.company_id + '|' + p.model, p.id);
}
console.log('products 적재:', prodId.size);

// ── 5. options (chunk insert) ──
const optRows = [];
let noProd = 0;
for (const o of options) {
  const cid = coId.get(o.company_name);
  const pid = cid != null ? prodId.get(cid + '|' + o.model) : null;
  if (pid == null) { noProd++; continue; }
  optRows.push({
    product_id: pid, months: Math.round(o.months || 0),
    care_service: o.care_service ?? null,
    inspection_cycle: o.inspection_cycle != null ? Math.round(o.inspection_cycle) : null,
    ownership_months: o.ownership_months != null ? Math.round(o.ownership_months) : null,
    variant_code: o.variant_code ?? '', variant_label: o.variant_label ?? '',
    monthly_fee: Math.round(o.monthly_fee || 0),
    rebate: o.rebate ?? null, rebate_otherco: o.rebate_otherco ?? null, rebate_half: o.rebate_half ?? null,
    half_fee: o.half_fee != null ? Math.round(o.half_fee) : null,
    half_period: o.half_period != null ? Math.round(o.half_period) : null,
    promo_type: o.promo_type ?? null, commission_method: o.commission_method || 'direct',
    source_batch_id: batchId, is_active: true,
  });
}
if (noProd) console.warn('⚠️ product 미매핑 option:', noProd);
console.log('options 매핑:', optRows.length);

let done = 0;
for (let i = 0; i < optRows.length; i += 500) {
  const slice = optRows.slice(i, i + 500);
  const { error } = await sb.from('rental_product_options').insert(slice);
  if (error) await fail(`options chunk ${i} (첫행 pid=${slice[0].product_id} months=${slice[0].months}): ${error.message}`);
  done += slice.length;
  if (i % 5000 === 0) console.log(`  ... options ${done}/${optRows.length}`);
}
console.log('options 적재:', done);

// ── 6. batch committed ──
await sb.from('rental_import_batches').update({
  status: 'committed', upsert_new: prodId.size + done, upsert_updated: 0,
}).eq('id', batchId);
console.log(`✅ DONE — batch ${batchId}: products ${prodId.size}, options ${done}`);
