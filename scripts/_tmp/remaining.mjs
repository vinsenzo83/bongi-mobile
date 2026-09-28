import fs from 'fs'; import dotenv from 'dotenv'; import { createClient } from '@supabase/supabase-js';
const e = dotenv.parse(fs.readFileSync('.env')); const sb = createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY || e.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
const all = async (t, cols, f) => { let out = []; for (let i = 0; ; i += 1000) { const { data } = await f(sb.from(t).select(cols)).order('id').range(i, i + 999).throwOnError(); out = out.concat(data); if (data.length < 1000) break; } return out; };
const models = await all('rental_cat_models', 'id, supplier_id, category, category_raw, brand, product_name, model_code, model_key, image_url, specs, status', (q) => q.eq('status', 'active'));
const offers = await all('rental_cat_offers', 'model_id', (q) => q.eq('status', 'active').eq('crm_enabled', true));
const selling = new Set(offers.map((o) => o.model_id));
const busy = new Set(['lg-subscribe', 'lg-hello', 'coway', 'carrier', 'cuckoo', 'chungho', 'kt', 'wells', 'cesco', 'skmagic']);   // 마지막 수집 작업이 처리 중
const rows = models.filter((m) => selling.has(m.id) && !m.image_url && !busy.has(m.supplier_id))
  .map((m) => ({ model_id: m.id, supplier_id: m.supplier_id, category: m.category, category_raw: m.category_raw, brand: m.brand, product_name: m.product_name, model_code: m.model_code, model_key: m.model_key }));
const dir = '/private/tmp/claude-501/-Users-vinsenzo/88fff588-4fb8-4c65-8825-95625f74aae7/scratchpad/product_info/_p4'; fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(`${dir}/remaining.json`, JSON.stringify(rows, null, 1));
const g = rows.reduce((a, r) => ((a[r.supplier_id] = (a[r.supplier_id] || 0) + 1), a), {});
console.log('대상', rows.length, JSON.stringify(g));
console.log('브랜드 상위', JSON.stringify(Object.entries(rows.reduce((a, r) => ((a[r.brand || '(없음)'] = (a[r.brand || '(없음)'] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1]).slice(0, 15)));
console.log(JSON.stringify(rows.slice(0, 5).map((r) => [r.supplier_id, r.brand, r.product_name?.slice(0, 40), r.model_code?.slice(0, 30)])));
process.exit(0);
