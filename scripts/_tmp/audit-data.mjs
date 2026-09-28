import fs from 'fs'; import dotenv from 'dotenv'; import { createClient } from '@supabase/supabase-js';
const e = dotenv.parse(fs.readFileSync(process.argv[2] || '.env')); const sb = createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY || e.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
const all = async (t, cols, f = (q) => q) => { let out = []; for (let i = 0; ; i += 1000) { const { data, error } = await f(sb.from(t).select(cols)).order('id').range(i, i + 999); if (error) throw error; out = out.concat(data); if (data.length < 1000) break; } return out; };
const models = await all('rental_cat_models', 'id, supplier_id, category, product_name, model_code, image_url, specs, status');
const offers = await all('rental_cat_offers', 'id, model_id, supplier_id, status, crm_enabled, offer_type, display_fee, monthly_fee, price_phases, guide_payout, max_payout, rebate, contract_months, care_type, valid_to', (q) => q.eq('status', 'active'));
const sups = Object.fromEntries((await sb.from('rental_cat_suppliers').select('id, name')).data.map((s) => [s.id, s.name]));
const activeModelIds = new Set(offers.filter((o) => o.crm_enabled).map((o) => o.model_id));
const sellable = models.filter((m) => m.status === 'active' && activeModelIds.has(m.id));
const desc = (m) => { const s = m.specs || {}; return !!(s.description || (s.feature_tags || []).length || (s.specifications && Object.keys(s.specifications).length)); };
const bySup = {};
for (const m of sellable) {
  const k = sups[m.supplier_id] || m.supplier_id; const x = bySup[k] ||= { 판매모델: 0, 이미지없음: 0, 설명없음: 0, 둘다없음: 0, 이름코드만: 0 };
  x.판매모델++; if (!m.image_url) x.이미지없음++; if (!desc(m)) x.설명없음++; if (!m.image_url && !desc(m)) x.둘다없음++;
  if (m.product_name && m.model_code && m.product_name.trim() === m.model_code.trim()) x.이름코드만++;
}
console.log('■ 판매중 모델 이미지·설명 누락 (렌탈사별)'); console.table(bySup);
const byCat = {};
for (const m of sellable) { const x = byCat[m.category] ||= { 판매모델: 0, 이미지없음: 0, 설명없음: 0 }; x.판매모델++; if (!m.image_url) x.이미지없음++; if (!desc(m)) x.설명없음++; }
console.log('■ 카테고리별'); console.table(byCat);
const today = new Date().toISOString().slice(0, 10);
const o2 = offers.filter((o) => o.crm_enabled);
const issues = {
  '가이드·MAX 미설정(계약 불가)': o2.filter((o) => o.guide_payout == null || o.max_payout == null).length,
  '리베이트 없음': o2.filter((o) => !(o.rebate > 0)).length,
  '월요금 0·없음': o2.filter((o) => !(o.display_fee > 0)).length,
  '약정개월 없음': o2.filter((o) => !o.contract_months).length,
  '관리방식 없음': o2.filter((o) => !o.care_type).length,
  'MAX<가이드': o2.filter((o) => o.max_payout < o.guide_payout).length,
  '가이드 만원단위 아님': o2.filter((o) => o.guide_payout != null && o.guide_payout % 10000).length,
  '유효기간 지남(판매중 표시)': o2.filter((o) => o.valid_to && o.valid_to < today).length,
  '할인구간인데 첫달요금≠구간요금': o2.filter((o) => (o.price_phases || []).length && !o.price_phases.some((p) => p.from === 1 && p.fee === o.display_fee) && o.price_phases.some((p) => p.from === 1)).length,
  '할인구간 요금 > 정상요금': o2.filter((o) => (o.price_phases || []).some((p) => p.fee > o.monthly_fee)).length,
  '가이드 ≥ 약정 총 렌탈료': o2.filter((o) => o.guide_payout && o.monthly_fee && o.contract_months && o.guide_payout >= o.monthly_fee * o.contract_months).length,
  '무료개월 36개월 초과(가이드÷첫달요금)': o2.filter((o) => o.guide_payout && o.display_fee > 0 && Math.floor(o.guide_payout / o.display_fee) > 36).length,
};
console.log('■ 판매중 조건 이상치', o2.length); console.table(issues);
const ex = (f) => o2.filter(f).slice(0, 3).map((o) => o.id);
console.log('예: 무료개월>36', JSON.stringify(o2.filter((o) => o.guide_payout && o.display_fee > 0 && Math.floor(o.guide_payout / o.display_fee) > 36).slice(0, 3).map((o) => [o.offer_type, o.display_fee, o.monthly_fee, o.guide_payout])));
console.log('예: 구간>정상', JSON.stringify(o2.filter((o) => (o.price_phases || []).some((p) => p.fee > o.monthly_fee)).slice(0, 3).map((o) => [o.offer_type, o.display_fee, o.monthly_fee, o.price_phases])));
const noImgList = sellable.filter((m) => !m.image_url).slice(0, 0);
fs.writeFileSync('/private/tmp/claude-501/-Users-vinsenzo/88fff588-4fb8-4c65-8825-95625f74aae7/scratchpad/missing_models.json', JSON.stringify(sellable.filter((m) => !m.image_url || !desc(m)).map((m) => ({ supplier: sups[m.supplier_id], category: m.category, name: m.product_name, code: m.model_code, image: !!m.image_url, desc: desc(m) }))));
const cards = (await sb.from('rental_cat_cards').select('supplier_id, card_name, tiers, is_active').eq('is_active', true)).data;
console.log('■ 카드', cards.length, '구간 없음', cards.filter((c) => !(c.tiers || []).some((t) => t.total > 0)).length);
const supWithOffers = new Set(o2.map((o) => o.supplier_id)); const supCards = new Set(cards.map((c) => c.supplier_id));
console.log('카드 없는 렌탈사', [...supWithOffers].filter((s) => !supCards.has(s)).map((s) => sups[s]).join(', '));
