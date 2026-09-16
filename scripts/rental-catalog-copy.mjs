// 렌탈 카탈로그를 한 DB 에서 다른 DB 로 복사 (데브에서 검증한 상품·조건을 라이브로 옮길 때)
//   node scripts/rental-catalog-copy.mjs --from .env.dev --to .env [--commit]
//   · 티켓번호를 그대로 옮긴다 — 이미 전달한 티켓 목록(R000001~)과 번호가 같아야 한다
//   · 대상 DB 에 렌탈 조건이 이미 있으면 멈춘다 (덮어쓰기 금지)
//   · 계약·사은품·변경이력은 옮기지 않는다. 가이드·MAX 는 옮긴 뒤 마진 규칙으로 대상 DB 에서 다시 계산한다
import fs from 'fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const client = (file) => {
  const env = dotenv.parse(fs.readFileSync(file));
  return { host: new URL(env.SUPABASE_URL).host.split('.')[0], sb: createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } }) };
};
if (!arg('--from') || !arg('--to')) { console.error('--from <env> --to <env> 필수'); process.exit(1); }
const src = client(arg('--from'));
const dst = client(arg('--to'));
if (src.host === dst.host) { console.error('원본과 대상이 같은 DB'); process.exit(1); }
const commit = process.argv.includes('--commit');
console.log(`원본 ${src.host} → 대상 ${dst.host}${commit ? '' : ' (미리보기)'}`);

async function readAll(table, cols) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await src.sb.from(table).select(cols).order('id').range(from, from + 999).throwOnError();
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}
async function writeAll(table, rows, size = 500) {
  for (let i = 0; i < rows.length; i += size) {
    await dst.sb.from(table).insert(rows.slice(i, i + size)).throwOnError();
    if ((i / size) % 20 === 0) console.log(`  ${table} ${Math.min(i + size, rows.length)}/${rows.length}`);
  }
}

const { count: existing } = await dst.sb.from('rental_cat_offers').select('id', { count: 'exact', head: true }).throwOnError();
if (existing) { console.error(`대상 DB 에 조건 ${existing}건이 이미 있습니다 — 중단`); process.exit(1); }

const suppliers = await readAll('rental_cat_suppliers', '*');
const batches = await readAll('rental_cat_batches', '*');
const models = await readAll('rental_cat_models', '*');
const offerCols = 'id,model_id,supplier_id,condition_key,variant_code,contract_months,obligation_months,ownership_months,care_type,care_label,cycle_months,offer_type,offer_tags,offer_label,monthly_fee,price_phases,display_fee,prepay_amount,total_fee,rebate,rebate_basis,rebate_rate,rebate_detail,rebate_changed,status,crm_enabled,valid_from,valid_to,notes,source,first_batch_id,last_batch_id,created_at,updated_at,ticket_number,source_status,status_locked,admin_notes';
const offers = (await readAll('rental_cat_offers', offerCols)).map((o) => ({ ...o, admin_notes: null, status_locked: false }));
const promotions = await readAll('rental_cat_promotions', '*');
const maxTicket = Math.max(...offers.map((o) => parseInt(o.ticket_number.slice(1), 10)));
console.log(`렌탈사 ${suppliers.length} · 배치 ${batches.length} · 모델 ${models.length} · 조건 ${offers.length} · 프로모션 ${promotions.length} · 마지막 티켓 R${String(maxTicket).padStart(6, '0')}`);
if (!commit) process.exit(0);

await writeAll('rental_cat_suppliers', suppliers);
await writeAll('rental_cat_batches', batches);
await writeAll('rental_cat_models', models);
await writeAll('rental_cat_offers', offers);
if (promotions.length) await writeAll('rental_cat_promotions', promotions);
console.log('복사 완료 — 대상 DB 에서 티켓 시퀀스를', maxTicket, '로 맞추고 마진 규칙을 적용하세요');
