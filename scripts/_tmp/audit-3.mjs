import fs from 'fs'; import dotenv from 'dotenv'; import { createClient } from '@supabase/supabase-js';
const e = dotenv.parse(fs.readFileSync('.env')); const sb = createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY || e.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
let rows = []; for (let i = 0; ; i += 1000) { const { data } = await sb.from('rental_cat_offers').select('ticket_number, supplier_id, offer_type, offer_label, display_fee, monthly_fee, price_phases, notes, guide_payout, max_payout, contract_months, total_fee').eq('status', 'active').eq('crm_enabled', true).order('id').range(i, i + 999); rows = rows.concat(data); if (data.length < 1000) break; }
const g = (arr, k) => arr.reduce((a, o) => ((a[k(o)] = (a[k(o)] || 0) + 1), a), {});
const halfNoPh = rows.filter((o) => o.offer_type === 'half' && !(o.price_phases || []).length);
console.log('반값인데 구간 없음', halfNoPh.length, JSON.stringify(g(halfNoPh, (o) => o.supplier_id)), JSON.stringify(halfNoPh.slice(0, 3).map((o) => [o.ticket_number, o.offer_label, o.display_fee, o.monthly_fee, (o.notes || '').slice(0, 60)])));
const zeroPay = rows.filter((o) => o.max_payout === 0 || (o.guide_payout === 0 && o.max_payout > 0));
console.log('가이드 0원(지원금 없음 또는 MAX만)', zeroPay.length, JSON.stringify(g(zeroPay, (o) => `${o.supplier_id}/${o.guide_payout === 0 && o.max_payout > 0 ? '가이드0·MAX>0' : '둘다0'}`)));
const purch = rows.filter((o) => o.offer_type === 'purchase');
console.log('일시불', purch.length, '일시불 금액 있음', purch.filter((o) => o.total_fee > 0).length);
const tiny = rows.filter((o) => o.guide_payout > 0 && o.guide_payout < 10000);
console.log('가이드 1만원 미만', tiny.length);
process.exit(0);
