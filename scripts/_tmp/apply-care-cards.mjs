// 관리방식·제휴카드 구간 반영 — 근거: 렌탈사/카드사 공식 페이지 (GAPS/care_found.json, card_tiers_found.json)
import fs from 'fs'; import dotenv from 'dotenv'; import { createClient } from '@supabase/supabase-js';
const G = '/private/tmp/claude-501/-Users-vinsenzo/88fff588-4fb8-4c65-8825-95625f74aae7/scratchpad/gaps';
const envf = process.argv[2]; const commit = process.argv.includes('--commit');
const e = dotenv.parse(fs.readFileSync(envf)); const sb = createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY || e.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
const CARE = ['visit', 'self', 'delivery', 'none'];
const care = JSON.parse(fs.readFileSync(`${G}/care_found.json`, 'utf8')).filter((r) => CARE.includes(r.care_type));
const ids = care.map((r) => r.offer_id);
const cur = new Map();
for (let i = 0; i < ids.length; i += 200) { const { data } = await sb.from('rental_cat_offers').select('id, ticket_number, care_type, care_label, cycle_months, notes').in('id', ids.slice(i, i + 200)).throwOnError(); for (const o of data) cur.set(o.id, o); }
let careN = 0, careSkip = 0;
const careUpd = [];
for (const r of care) {
  const o = cur.get(r.offer_id); if (!o) { careSkip++; continue; }
  if (o.care_type) { careSkip++; continue; }                        // 이미 값이 있으면 건드리지 않는다
  const src = (r.source_url || '').slice(0, 120);
  const note = `관리방식 ${r.care_type === 'self' ? '자가관리' : r.care_type === 'visit' ? '방문관리' : r.care_type} — 렌탈사 공식 안내 확인 2026-09-18${r.confidence === 'medium' ? ' (확인필요: 공식 표기 없음, 상품 유형으로 판단)' : ''} ${src}`;
  careUpd.push({ id: o.id, care_type: r.care_type, cycle_months: r.cycle_months ?? o.cycle_months ?? null, notes: [o.notes, note].filter(Boolean).join(' / ') });
  careN++;
}
const cards = JSON.parse(fs.readFileSync(`${G}/card_tiers_found.json`, 'utf8'));
const cardUpd = [];
for (const c of cards) {
  if (!Array.isArray(c.tiers) || !c.tiers.some((t) => t.total > 0)) continue;
  const tiers = c.tiers.map((t) => ({ min_spend: t.min_spend ?? null, base: t.base ?? null, promo: t.promo ?? null, total: t.total }));
  cardUpd.push({ id: c.id, tiers, max_discount: Math.max(...tiers.map((t) => t.total)), annual_fee: c.annual_fee ?? null, discount_months: c.discount_months ?? null,
    notes: `카드사 공식 안내 확인 2026-09-18 · 전월실적 구간 ${tiers.map((t) => `${Math.round((t.min_spend || 0) / 10000)}만↑ ${t.total.toLocaleString()}원`).join(' / ')}${c.applies_to_rental === true ? ' · 가전구독(렌탈) 요금 할인 대상' : c.applies_to_rental === false ? ' · 통신요금 전용(렌탈 할인 아님)' : ' · 렌탈 요금 적용 여부 확인필요'} ${(c.source_url || '').slice(0, 100)}` });
}
console.log(new URL(e.SUPABASE_URL).host.split('.')[0], '관리방식', careN, '(건너뜀', careSkip, ') 카드', cardUpd.length);
console.log('예시', JSON.stringify(careUpd[0]).slice(0, 220));
console.log('카드예시', JSON.stringify(cardUpd[0]).slice(0, 260));
if (commit) {
  for (const u of careUpd) { const { id, ...v } = u; await sb.from('rental_cat_offers').update({ ...v, updated_at: new Date().toISOString() }).eq('id', id).throwOnError(); }
  for (const u of cardUpd) { const { id, ...v } = u; await sb.from('rental_cat_cards').update(v).eq('id', id).throwOnError(); }
  console.log('반영 관리방식', careUpd.length, '카드', cardUpd.length);
}
process.exit(0);
