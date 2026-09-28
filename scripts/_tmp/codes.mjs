import fs from 'fs'; import dotenv from 'dotenv'; import { createClient } from '@supabase/supabase-js';
const e = dotenv.parse(fs.readFileSync('.env.dev')); const sb = createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY || e.SUPABASE_SERVICE_KEY);
for (const c of ['CHPI-7410N','CP-AMS100','CBT-QSB1041W','P-350N','DH-WF21561EB','CFD-C151MODG']) { const { data } = await sb.from('rental_cat_models').select('supplier_id, model_code, model_key').or(`model_code.ilike.%${c}%,model_key.ilike.%${c.replace(/-/g,'')}%`).limit(5); console.log(c, JSON.stringify(data)); }
