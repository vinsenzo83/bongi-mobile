// 청호·세스코 반값 개월 반영 — 근거: 청호나이스 공식몰 ERP 규칙(GAPS/half_months_found.json)
import fs from 'fs'; import dotenv from 'dotenv'; import { createClient } from '@supabase/supabase-js';
const G = '/private/tmp/claude-501/-Users-vinsenzo/88fff588-4fb8-4c65-8825-95625f74aae7/scratchpad/gaps';
const envf = process.argv[2]; const commit = process.argv.includes('--commit');
const e = dotenv.parse(fs.readFileSync(envf)); const sb = createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY || e.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
const found = JSON.parse(fs.readFileSync(`${G}/half_months_found.json`, 'utf8'));
const unknown = JSON.parse(fs.readFileSync(`${G}/half_months_unknown.json`, 'utf8'));
const ids = [...new Set(found.map((r) => r.offer_id).concat(unknown.map((r) => r.offer_id)))];
const cur = new Map();
for (let i = 0; i < ids.length; i += 200) { const { data } = await sb.from('rental_cat_offers').select('id, ticket_number, offer_type, offer_label, display_fee, monthly_fee, price_phases, notes').in('id', ids.slice(i, i + 200)).throwOnError(); for (const o of data) cur.set(o.id, o); }
let withFee = 0, monthsOnly = 0, tagOff = 0, skip = 0;
const plan = [];
for (const r of found) {
  const o = cur.get(r.offer_id); if (!o) { skip++; continue; }
  if ((o.price_phases || []).length) { skip++; continue; }
  const note = `반값 ${r.half_months}개월(1~${r.half_months}회차) — 청호 공식몰 렌탈규칙 확인(${new Date().toLocaleDateString('sv-SE')})`;
  if (r.half_fee && o.monthly_fee && r.half_fee * 2 === o.monthly_fee) {           // 시트 월요금과 정확히 맞는 것만 요금까지
    plan.push({ id: o.id, price_phases: [{ from: 1, to: r.half_months, fee: r.half_fee }], display_fee: r.half_fee, notes: [o.notes, note].filter(Boolean).join(' / ') });
    withFee++;
  } else {                                                                          // 금액은 추정하지 않고 개월만 라벨에
    const label = /반값\s*\d+개월/.test(o.offer_label || '') ? o.offer_label : `${o.offer_label || '반값'} ${r.half_months}개월`;
    plan.push({ id: o.id, offer_label: label, notes: [o.notes, `${note} · 반값 월 요금은 시트값과 달라 미반영`].filter(Boolean).join(' / ') });
    monthsOnly++;
  }
}
for (const r of unknown) {
  const o = cur.get(r.offer_id); if (!o) { skip++; continue; }
  const label = (o.offer_label || '').replace(/\s*·?\s*반값(프로모션 종료)?/g, '').replace(/\s{2,}/g, ' ').trim() || null;
  plan.push({ id: o.id, offer_type: o.offer_type === 'half' ? (/재렌탈|타사보상/.test(o.offer_label || '') ? 'trade_in' : 'promo') : o.offer_type, offer_label: label, notes: [o.notes, `반값 아님 확인(${r.reason ? r.reason.slice(0, 60) : '공식 규칙에 반값 없음'}) — 반값 표기 제거`].filter(Boolean).join(' / ') });
  tagOff++;
}
console.log(new URL(e.SUPABASE_URL).host.split('.')[0], '요금+개월', withFee, '개월만', monthsOnly, '반값표기 제거', tagOff, '건너뜀', skip);
console.log('예시', JSON.stringify(plan.slice(0, 2)));
if (commit) { for (const p of plan) { const { id, ...u } = p; await sb.from('rental_cat_offers').update({ ...u, updated_at: new Date().toISOString() }).eq('id', id).throwOnError(); } console.log('반영', plan.length); }
process.exit(0);
