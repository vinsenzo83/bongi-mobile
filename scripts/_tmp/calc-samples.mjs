import fs from 'fs'; import dotenv from 'dotenv'; import { createClient } from '@supabase/supabase-js';
const e = dotenv.parse(fs.readFileSync('.env.dev')); const sb = createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY || e.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
const { data: sups } = await sb.from('rental_cat_suppliers').select('id');
const picks = [];
for (const s of sups) for (const t of ['normal', 'half', 'bundle', 'trade_in', 'prepay', 'purchase', 'promo', 'package', 'special']) {
  const { data } = await sb.from('rental_cat_offers').select('ticket_number, offer_type, display_fee, monthly_fee, contract_months, guide_payout, max_payout, price_phases, prepay_amount, care_type, supplier_id')
    .eq('supplier_id', s.id).eq('status', 'active').eq('crm_enabled', true).eq('offer_type', t).limit(40);
  if (!data?.length) continue;
  // 반값 구간 있는 것 우선, 없으면 첫 번째
  const withPh = data.find((o) => (o.price_phases || []).length) || data[0];
  picks.push(withPh);
  const noCare = data.find((o) => !o.care_type && o !== withPh); if (noCare && picks.filter((p) => p.supplier_id === s.id && !p.care_type).length === 0) picks.push(noCare);
}
fs.writeFileSync('/private/tmp/claude-501/-Users-vinsenzo/88fff588-4fb8-4c65-8825-95625f74aae7/scratchpad/calc_samples.json', JSON.stringify(picks));
console.log(picks.length, JSON.stringify(picks.reduce((a, p) => ((a[p.offer_type] = (a[p.offer_type] || 0) + 1), a), {})));
process.exit(0);
