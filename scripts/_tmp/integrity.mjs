import fs from 'fs'; import dotenv from 'dotenv'; import { createClient } from '@supabase/supabase-js';
const envf = process.argv[2]; const e = dotenv.parse(fs.readFileSync(envf));
const sb = createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY || e.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
const c = async (t, f = (q) => q) => (await f(sb.from(t).select('*', { count: 'exact', head: true }))).count;
const out = { db: new URL(e.SUPABASE_URL).host.split('.')[0] };
out.offers = await c('rental_cat_offers'); out.offers_active = await c('rental_cat_offers', (q) => q.eq('status', 'active'));
out.offers_active_no_guide = await c('rental_cat_offers', (q) => q.eq('status', 'active').is('guide_payout', null));
out.offers_max_lt_guide = null;
out.offers_no_ticket = await c('rental_cat_offers', (q) => q.is('ticket_number', null));
out.offers_zero_display = await c('rental_cat_offers', (q) => q.eq('status', 'active').eq('display_fee', 0));
out.models = await c('rental_cat_models'); out.models_img = await c('rental_cat_models', (q) => q.not('image_url', 'is', null));
out.models_etc = await c('rental_cat_models', (q) => q.eq('category', 'etc'));
out.cards_active = await c('rental_cat_cards', (q) => q.eq('is_active', true)); out.promotions = await c('rental_cat_promotions');
// 모델코드만 이름인 것
let codeNames = 0, from = 0, maxLt = 0, dupTk = new Map();
for (;;) { const { data } = await sb.from('rental_cat_models').select('product_name, model_code').order('id').range(from, from + 999); if (!data.length) break; codeNames += data.filter((m) => m.product_name && m.model_code && m.product_name.trim() === m.model_code.trim()).length; from += 1000; }
out.models_name_eq_code = codeNames;
from = 0;
for (;;) { const { data } = await sb.from('rental_cat_offers').select('ticket_number, guide_payout, max_payout, status').order('id').range(from, from + 999); if (!data.length) break; for (const o of data) { if (o.status === 'active' && o.max_payout != null && o.guide_payout != null && o.max_payout < o.guide_payout) maxLt++; dupTk.set(o.ticket_number, (dupTk.get(o.ticket_number) || 0) + 1); } from += 1000; }
out.offers_max_lt_guide = maxLt; out.dup_tickets = [...dupTk.values()].filter((n) => n > 1).length;
let cats=[]; for (let f=0;;f+=1000){const {data}=await sb.from('rental_cat_models').select('category').order('id').range(f,f+999); if(!data.length)break; cats=cats.concat(data);}
out.categories = Object.fromEntries(Object.entries(cats.reduce((a, m) => ((a[m.category] = (a[m.category] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1]));
console.log(JSON.stringify(out));
