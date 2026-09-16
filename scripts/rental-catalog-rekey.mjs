// 적재 규칙(어댑터)이 바뀌어 조건키가 달라질 때, 기존 조건의 티켓번호·가이드·MAX·관리자 상태를 지키며 조건키와 값을 새 규칙으로 옮긴다.
//   node scripts/rental-catalog-rekey.mjs --env .env.dev --month 2026-09 --file "<xlsx>" --supplier chungho [--commit]
//   · 같은 엑셀 행(시트·행번호)끼리 짝짓는다. 1:1 로 짝지어지지 않는 조건이 하나라도 있으면 반영하지 않는다
//   · 가이드·MAX·status_locked·admin_notes·ticket_number 는 건드리지 않는다
import fs from 'fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { parseRentalWorkbook } from '../server/services/rental-import/index.js';
import { supplierId, displayFee } from '../server/services/rental-import/commit.js';

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const envFile = arg('--env'); const month = arg('--month'); const file = arg('--file'); const sup = arg('--supplier');
if (!envFile || !month || !file || !sup) { console.error('--env --month --file --supplier 필수'); process.exit(1); }
const env = dotenv.parse(fs.readFileSync(envFile));
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
console.log('대상 DB:', new URL(env.SUPABASE_URL).host.split('.')[0], '· 렌탈사:', sup);

const parsed = parseRentalWorkbook(fs.readFileSync(file), { month });
const offers = parsed.offers.filter((o) => supplierId(o.supplier) === sup);
const existing = [];
for (let from = 0; ; from += 1000) {
  const { data } = await sb.from('rental_cat_offers').select('id, ticket_number, condition_key, status, source').eq('supplier_id', sup).order('id').range(from, from + 999).throwOnError();
  existing.push(...data);
  if (data.length < 1000) break;
}
const rowKey = (s) => `${s?.sheet}|${s?.row}`;
const byRow = new Map();
for (const e of existing.filter((e) => e.status !== 'discontinued')) {
  const k = rowKey(e.source);
  if (byRow.has(k)) { console.error('같은 엑셀 행에 조건이 둘 이상:', k); process.exit(1); }
  byRow.set(k, e);
}
const pairs = []; const unmatched = [];
for (const o of offers) {
  const e = byRow.get(rowKey(o.source));
  if (!e) unmatched.push(rowKey(o.source)); else { pairs.push({ e, o }); byRow.delete(rowKey(o.source)); }
}
const changedKeys = pairs.filter(({ e, o }) => e.condition_key !== o.condition_key);
console.log(`엑셀 조건 ${offers.length} · DB 판매중 조건 ${existing.filter((e) => e.status !== 'discontinued').length} · 짝 ${pairs.length} · 조건키 변경 ${changedKeys.length} · 엑셀에만 ${unmatched.length} · DB에만 ${byRow.size}`);
for (const { e, o } of changedKeys.slice(0, 5)) console.log(' ', e.ticket_number, e.condition_key, '→', o.condition_key);
if (unmatched.length || byRow.size) { console.error('1:1 로 짝지어지지 않아 중단'); process.exit(1); }
const newKeys = new Set(pairs.map(({ o }) => o.condition_key));
if (newKeys.size !== pairs.length) { console.error('새 조건키 중복 — 중단'); process.exit(1); }
if (!process.argv.includes('--commit')) process.exit(0);

// 1단계: 임시 키로 비워 unique 충돌을 피한다  2단계: 새 키·값 기록
for (const { e } of changedKeys) await sb.from('rental_cat_offers').update({ condition_key: `rekey:${e.id}` }).eq('id', e.id).throwOnError();
const now = new Date().toISOString();
let n = 0;
for (const { e, o } of pairs) {
  await sb.from('rental_cat_offers').update({
    condition_key: o.condition_key, variant_code: o.variant_code ?? null, care_type: o.care_type ?? null, care_label: o.care_label ?? null,
    cycle_months: o.cycle_months ?? null, offer_type: o.offer_type, offer_tags: o.offer_tags || [], offer_label: o.offer_label ?? null,
    price_phases: o.price_phases || [], display_fee: displayFee(o), notes: o.notes ?? null, updated_at: now,
  }).eq('id', e.id).throwOnError();
  if (++n % 500 === 0) console.log(`  ${n}/${pairs.length}`);
}
await sb.from('rental_cat_offer_changes').insert(changedKeys.slice(0, 1).length ? changedKeys.map(({ e, o }) => ({
  offer_id: e.id, change_type: 'changed', changed_by: 'rekey(적재규칙 변경)', before: { condition_key: e.condition_key }, after: { condition_key: o.condition_key },
})) : []).throwOnError();
console.log('반영', n, '· 조건키 변경', changedKeys.length);
