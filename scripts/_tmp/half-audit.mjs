import fs from 'fs'; import dotenv from 'dotenv'; import { createClient } from '@supabase/supabase-js';
const e = dotenv.parse(fs.readFileSync('.env')); const sb = createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY || e.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
let rows = []; for (let i = 0; ; i += 1000) { const { data } = await sb.from('rental_cat_offers').select('ticket_number, supplier_id, offer_type, offer_label, display_fee, monthly_fee, price_phases, notes, source').eq('status', 'active').eq('crm_enabled', true).order('id').range(i, i + 999).throwOnError(); rows = rows.concat(data); if (data.length < 1000) break; }
const half = rows.filter((o) => o.offer_type === 'half' || /반값/.test(o.offer_label || ''));
const noPh = half.filter((o) => !(o.price_phases || []).length);
const g = (a, k) => a.reduce((m, o) => ((m[k(o)] = (m[k(o)] || 0) + 1), m), {});
console.log('반값 조건', half.length, '구간 없음', noPh.length);
console.log('구간 없는 것 렌탈사별', JSON.stringify(g(noPh, (o) => o.supplier_id)));
console.log('라벨에 개월 있는 것', noPh.filter((o) => /개월|회차/.test(o.offer_label || '')).length);
console.log(JSON.stringify(noPh.slice(0, 4).map((o) => ({ t: o.ticket_number, label: o.offer_label, fee: o.display_fee, monthly: o.monthly_fee, notes: (o.notes || '').slice(0, 90), sheet: o.source?.sheet, row: o.source?.row })), null, 1));
process.exit(0);
