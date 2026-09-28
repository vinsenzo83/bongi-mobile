import fs from 'fs'; import dotenv from 'dotenv'; import { createClient } from '@supabase/supabase-js';
const e = dotenv.parse(fs.readFileSync('.env')); const sb = createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY || e.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
const all = async (t, cols, f) => { let out = []; for (let i = 0; ; i += 1000) { const { data } = await f(sb.from(t).select(cols)).order('id').range(i, i + 999).throwOnError(); out = out.concat(data); if (data.length < 1000) break; } return out; };
const models = await all('rental_cat_models', 'id, supplier_id, category, category_raw, brand, product_name, model_code, model_key, image_url, specs, status', (q) => q.eq('status', 'active'));
const offers = await all('rental_cat_offers', 'model_id, notes, source', (q) => q.eq('status', 'active').eq('crm_enabled', true));
const selling = new Set(offers.map((o) => o.model_id));
const desc = (m) => { const s = m.specs || {}; return !!(s.description || (s.feature_tags || []).length || (s.specifications && Object.keys(s.specifications).length)); };
const out = {};
for (const m of models) {
  if (!selling.has(m.id) || (m.image_url && desc(m))) continue;
  (out[m.supplier_id] ||= []).push({ model_id: m.id, supplier_id: m.supplier_id, category: m.category, category_raw: m.category_raw, brand: m.brand, product_name: m.product_name, model_code: m.model_code, model_key: m.model_key, need_image: !m.image_url, need_desc: !desc(m) });
}
const dir = '/private/tmp/claude-501/-Users-vinsenzo/88fff588-4fb8-4c65-8825-95625f74aae7/scratchpad/product_info/_p3'; fs.mkdirSync(dir, { recursive: true });
for (const [k, v] of Object.entries(out)) fs.writeFileSync(`${dir}/${k}_missing.json`, JSON.stringify(v, null, 1));
console.log(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length])));
process.exit(0);
