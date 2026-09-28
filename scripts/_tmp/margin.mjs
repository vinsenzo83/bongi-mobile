import fs from 'fs'; import dotenv from 'dotenv'; import { createClient } from '@supabase/supabase-js';
const e = dotenv.parse(fs.readFileSync(process.argv[2])); const sb = createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY || e.SUPABASE_SERVICE_KEY);
const { data } = await sb.from('rental_cat_offers').select('ticket_number, rebate, guide_payout, max_payout, display_fee, payout_updated_by').in('ticket_number', ['R008367', 'R006159', 'R000885', 'R020295']);
for (const o of data) { const b = o.rebate / 1.1; console.log(o.ticket_number, 'rebate', o.rebate, 'supply', Math.round(b), 'guide', o.guide_payout, `(${(100 - o.guide_payout / b * 100).toFixed(1)}% 남김)`, 'max', o.max_payout, `(${(100 - o.max_payout / b * 100).toFixed(1)}% 남김)`, '|', o.payout_updated_by); }
const { data: by } = await sb.from('rental_cat_offers').select('payout_updated_by').eq('status', 'active').not('guide_payout', 'is', null).limit(1000);
console.log(Object.entries(by.reduce((a, x) => ((a[x.payout_updated_by] = (a[x.payout_updated_by] || 0) + 1), a), {})));
