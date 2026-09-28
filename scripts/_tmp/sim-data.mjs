import fs from 'fs'; import dotenv from 'dotenv'; import { createClient } from '@supabase/supabase-js';
const e = dotenv.parse(fs.readFileSync('.env')); const sb = createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY || e.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
const { data: rule } = await sb.from('incentive_rules').select('*').eq('active', true).maybeSingle();
console.log('RULE', JSON.stringify(rule));
const { data: ag } = await sb.from('incentive_agents').select('base_salary, role, active').eq('active', true);
console.log('AGENTS', JSON.stringify(ag.reduce((a, x) => ((a[x.role + ':' + x.base_salary] = (a[x.role + ':' + x.base_salary] || 0) + 1), a), {})));
let offers = []; for (let f = 0; ; f += 1000) { const { data } = await sb.from('rental_cat_offers').select('supplier_id, offer_type, rebate, guide_payout, max_payout, display_fee, model_id').eq('status', 'active').eq('crm_enabled', true).not('guide_payout', 'is', null).order('id').range(f, f + 999); if (!data.length) break; offers = offers.concat(data); }
fs.writeFileSync('/private/tmp/claude-501/-Users-vinsenzo/88fff588-4fb8-4c65-8825-95625f74aae7/scratchpad/sim_offers.json', JSON.stringify(offers));
console.log('offers', offers.length);
const { data: rs } = await sb.from('incentive_sales').select('actual_payout, guide_payout_snapshot, max_payout_snapshot, rebate_snapshot').eq('sale_kind', 'rental').neq('customer_name', 'QA렌탈테스트');
console.log('real rental sales', rs?.length);
