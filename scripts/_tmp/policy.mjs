import fs from 'fs'; import dotenv from 'dotenv'; import { createClient } from '@supabase/supabase-js';
const e = dotenv.parse(fs.readFileSync('.env.dev')); const sb = createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY || e.SUPABASE_SERVICE_KEY);
for (const id of process.argv.slice(2)) {
  const { data } = await sb.from('rental_cat_suppliers').select('id, file_kind, signup_policy').eq('id', id).single();
  for (const [k, p] of Object.entries(data.signup_policy || {})) {
    console.log('==', id, data.file_kind, k, 'as_of', p.as_of);
    console.log(' docs', JSON.stringify((p.application_fields || []).filter((f) => /_doc|proof/.test(f.key)).map((f) => [f.key, f.label, f.applies_to])));
  }
}
