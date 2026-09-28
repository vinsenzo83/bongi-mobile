import fs from 'fs'; import dotenv from 'dotenv'; import { createClient } from '@supabase/supabase-js';
const e = dotenv.parse(fs.readFileSync('.env')); const sb = createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY || e.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
let rows = []; for (let i = 0; ; i += 1000) { const { data } = await sb.from('rental_cat_offers').select('id, ticket_number, supplier_id, model_id, offer_type, offer_label, contract_months, care_type, care_label, cycle_months, display_fee, monthly_fee, price_phases, notes').eq('status', 'active').eq('crm_enabled', true).order('id').range(i, i + 999).throwOnError(); rows = rows.concat(data); if (data.length < 1000) break; }
const { data: mods } = await sb.from('rental_cat_models').select('id, supplier_id, product_name, model_code, category');
const m = new Map(mods.map((x) => [x.id, x]));
const dir = '/private/tmp/claude-501/-Users-vinsenzo/88fff588-4fb8-4c65-8825-95625f74aae7/scratchpad/gaps'; fs.mkdirSync(dir, { recursive: true });
const half = rows.filter((o) => (o.offer_type === 'half' || /반값/.test(o.offer_label || '')) && !(o.price_phases || []).length)
  .map((o) => ({ offer_id: o.id, ticket: o.ticket_number, supplier_id: o.supplier_id, product_name: m.get(o.model_id)?.product_name, model_code: m.get(o.model_id)?.model_code, category: m.get(o.model_id)?.category, offer_label: o.offer_label, contract_months: o.contract_months, care_type: o.care_type, cycle_months: o.cycle_months, monthly_fee: o.monthly_fee, notes: o.notes }));
fs.writeFileSync(`${dir}/half_missing_months.json`, JSON.stringify(half, null, 1));
const careCats = ['water-purifier', 'bidet', 'air-purifier', 'softener'];
const care = rows.filter((o) => !o.care_type && !o.care_label && careCats.includes(m.get(o.model_id)?.category))
  .map((o) => ({ offer_id: o.id, ticket: o.ticket_number, supplier_id: o.supplier_id, product_name: m.get(o.model_id)?.product_name, model_code: m.get(o.model_id)?.model_code, category: m.get(o.model_id)?.category, contract_months: o.contract_months, monthly_fee: o.monthly_fee, offer_label: o.offer_label, notes: o.notes }));
fs.writeFileSync(`${dir}/care_missing.json`, JSON.stringify(care, null, 1));
const { data: cards } = await sb.from('rental_cat_cards').select('id, supplier_id, card_issuer, card_name, tiers, max_discount, discount_months, annual_fee, notes, card_url').eq('is_active', true);
fs.writeFileSync(`${dir}/cards_no_tiers.json`, JSON.stringify(cards.filter((c) => !(c.tiers || []).some((t) => t.total > 0)), null, 1));
console.log('반값 개월 없음', half.length, '관리방식 없음', care.length, '구간 없는 카드', cards.filter((c) => !(c.tiers || []).some((t) => t.total > 0)).length);
process.exit(0);
