import fs from 'fs'; import dotenv from 'dotenv'; import { createClient } from '@supabase/supabase-js';
const e = dotenv.parse(fs.readFileSync('.env.dev')); const sb = createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY || e.SUPABASE_SERVICE_KEY);
const { data: t } = await sb.from('rental_cat_offers').select('model_id').eq('ticket_number', 'R024138').single();
const { data } = await sb.from('rental_cat_offers').select('ticket_number, offer_type, offer_label, contract_months, care_type, cycle_months, variant_code, prepay_amount, display_fee, status, crm_enabled').eq('model_id', t.model_id).eq('status', 'active').eq('offer_type', 'prepay');
console.log(JSON.stringify(data, null, 0));
process.exit(0);
