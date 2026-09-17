/**
 * rental-recommend.js — AI 없이 내부 로직으로 하는 자동 추천 (기본 추천)
 *
 * 상담원 입력(선택 칩 또는 한 줄 문장) → 조건 필터 → 많이 팔리는·많이 남는 순 → 제휴카드·페이백 반영 실질 월 부담
 * AI(rental-assistant) 는 긴 문장·사양 질문 등 필요할 때만 쓰고, 추천의 기본은 이 파일이다. (대표 지시 2026-09-17: AI 최소 사용)
 */
import { supabase } from '../db/supabase.js';
import { categorize, CATEGORY_LABEL } from './rental-import/core.js';
import { rankModels, contractCost } from './rental-assistant.js';

const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });

// 문장에서 뽑는 사전 — 렌탈사(지금 쓰는 브랜드) · 카드사
const BRANDS = [
  ['coway', /코웨이/], ['cuckoo', /쿠쿠/], ['chungho', /청호/], ['skmagic', /SK\s*매직|에스케이\s*매직|SK인텔릭스/i], ['wells', /웰스|교원/],
  ['luhens', /루헨스/], ['cuming', /큐밍/], ['lg-subscribe', /LG|엘지/i], ['cesco', /세스코/], ['carrier', /캐리어/],
];
const ISSUERS = [['신한', /신한/], ['KB', /KB|국민/i], ['삼성', /삼성\s*카드/], ['현대', /현대\s*카드/], ['롯데', /롯데/], ['하나', /하나/], ['우리', /우리\s*카드|우리카드/], ['NH', /NH|농협/i], ['BC', /BC|비씨/i], ['IBK', /IBK|기업/i]];
// 상품명·설명에서 찾을 기능어
const FEATURES = ['얼음', '직수', '냉온', '온수', '냉정', '탄산', '스파클링', '스탠드', '빌트인', '언더싱크', '미니', '슬림', '대용량', '바리스타', '커피', '가습', '제습', '무풍', '로봇', '건조', '워시타워', '스타일러', '안마', '매트리스', '킹', '퀸'];

/** 한 줄 문장 → 필터 (선택 칩 값이 있으면 칩이 우선) */
export function parseNeeds(text = '') {
  const t = String(text);
  const out = {};
  const cat = categorize(t, t);
  if (cat && cat !== 'etc') out.category = cat;
  const man = t.match(/(\d+(?:\.\d+)?)\s*만\s*원?\s*(?:이하|이내|대|까지|안쪽|아래)?/);
  if (man) out.budget = Math.round(parseFloat(man[1]) * 10000) + (/대/.test(man[0]) ? 9999 : 0);
  if (/방문/.test(t)) out.care_type = 'visit'; else if (/자가|셀프/.test(t)) out.care_type = 'self';
  const yr = t.match(/(\d)\s*년\s*(?:약정)?/); if (yr) out.contract_months = +yr[1] * 12;
  // "코웨이 쓰는/사용 중/쓰다가" → 지금 쓰는 브랜드 = 타사보상 대상
  for (const [id, re] of BRANDS) if (new RegExp(`${re.source}[^,.]{0,6}(쓰|사용|이용|렌탈\\s*중)`, re.flags).test(t)) { out.current_brand = id; break; }
  for (const [issuer, re] of ISSUERS) if (re.test(t) && /카드/.test(t)) { out.card_issuer = issuer; break; }
  const pyeong = t.match(/(\d+)\s*평/); if (pyeong) out.area_pyeong = +pyeong[1];
  out.keywords = FEATURES.filter((f) => t.includes(f));
  return out;
}

const BRAND_LABEL = { coway: '코웨이', cuckoo: '쿠쿠', chungho: '청호', skmagic: 'SK매직', wells: '웰스', luhens: '루헨스', cuming: '큐밍', 'lg-subscribe': 'LG', cesco: '세스코', carrier: '캐리어' };
const TYPE = { normal: '일반', package: '패키지', bundle: '결합', trade_in: '타사보상', half: '반값할인', prepay: '선납', promo: '프로모션', special: '특가' };
const won = (n) => (n == null ? '—' : `${Number(n).toLocaleString()}원`);

/**
 * input: { text?, category?, budget?, care_type?, contract_months?, current_brand?, card_issuer?, keywords?[] }
 */
export async function recommend(input = {}) {
  const parsed = parseNeeds(input.text || '');
  const need = {
    category: input.category || parsed.category || null,
    budget: Number(input.budget) || parsed.budget || null,
    care_type: input.care_type || parsed.care_type || null,
    contract_months: Number(input.contract_months) || parsed.contract_months || null,
    current_brand: input.current_brand || parsed.current_brand || null,
    card_issuer: input.card_issuer || parsed.card_issuer || null,
    keywords: [...new Set([...(input.keywords || []), ...(parsed.keywords || [])])].slice(0, 4),
    area_pyeong: parsed.area_pyeong || null,
  };
  if (!need.category && !need.keywords.length) {
    return { need, summary: '카테고리나 찾는 기능(예: 정수기·얼음·공기청정기)을 알려주세요', questions: ['어떤 제품을 찾으세요? (정수기·공기청정기·비데·안마의자 …)'], recommendations: [] };
  }

  // 후보 모델 — 카테고리 + 기능어(상품명·설명). 기능어는 모두 맞아야 한다
  let q = supabase.from('rental_cat_model_summary').select('*').eq('status', 'active').gt('offer_count', 0);
  if (need.category) q = q.eq('category', need.category);
  for (const w of need.keywords) q = q.or(`product_name.ilike.%${w}%,category_raw.ilike.%${w}%,specs->>description.ilike.%${w}%,specs->>name.ilike.%${w}%`);
  if (need.current_brand) q = q.neq('supplier_id', need.current_brand);
  if (need.budget) q = q.lte('min_display_fee', need.budget);
  const { data: models, error } = await q.order('max_free_months', { ascending: false, nullsFirst: false }).limit(300);
  if (error) throw error;

  const filter = { max_monthly_fee: need.budget, care_type: need.care_type, contract_months: need.contract_months };
  // 지금 쓰는 브랜드가 있으면 타사보상 조건을 먼저, 모자라면 일반 조건
  let ranked = need.current_brand ? (await rankModels(models, 'recommend', { ...filter, offer_type: 'trade_in' })).filter((r) => r.best_conditions.length) : [];
  if (ranked.length < 3) {
    const more = (await rankModels(models, 'recommend', filter)).filter((r) => r.best_conditions.length && !ranked.some((x) => x.model_id === r.model_id));
    ranked = ranked.concat(more);
  }

  // 같은 렌탈사만 3개 나오지 않게 — 렌탈사당 최대 2개, 색상만 다른 같은 상품(같은 요금)은 하나만
  const picked = []; const perSupplier = {}; const family = new Set();
  const baseName = (n) => String(n || '').replace(/\([^)]*\)/g, '').replace(/_[^_]*$/, '').replace(/\s+/g, '');
  for (const r of ranked) {
    if (/^\s*\[현장/.test(r.product_name || '')) continue;   // 현장 판매 전용 상품은 콜센터 추천에서 제외
    const c0 = r.best_conditions[0];
    const fam = `${r.supplier_id}|${baseName(r.product_name)}|${c0.display_fee}|${c0.monthly_fee_after}|${c0.contract_months}`;
    if (family.has(fam)) continue;
    if ((perSupplier[r.supplier_id] || 0) >= 2) continue;
    family.add(fam);
    picked.push(r); perSupplier[r.supplier_id] = (perSupplier[r.supplier_id] || 0) + 1;
    if (picked.length === 3) break;
  }

  // 카드 — 보유 카드사의 그 렌탈사 제휴카드, 가장 낮은 실적 구간(보수적으로)
  const cardsBy = {};
  if (need.card_issuer && picked.length) {
    const { data: cards } = await supabase.from('rental_cat_cards').select('supplier_id, card_issuer, card_name, tiers, discount_months, annual_fee')
      .in('supplier_id', [...new Set(picked.map((p) => p.supplier_id))]).eq('is_active', true);
    for (const c of cards || []) {
      if (!`${c.card_issuer} ${c.card_name}`.includes(need.card_issuer)) continue;
      const tier = (c.tiers || []).filter((t) => t.total).sort((a, b) => (a.min_spend || 0) - (b.min_spend || 0))[0];
      if (tier && !cardsBy[c.supplier_id]) cardsBy[c.supplier_id] = { ...c, tier };
    }
  }

  const { data: offerRows } = picked.length
    ? await supabase.from('rental_cat_offers').select('id, ticket_number, contract_months, monthly_fee, price_phases, display_fee, guide_payout').in('ticket_number', picked.map((p) => p.best_conditions[0].ticket))
    : { data: [] };
  const offerByTicket = new Map((offerRows || []).map((o) => [o.ticket_number, o]));

  const recommendations = picked.map((r, i) => {
    const c = r.best_conditions[0];
    const o = offerByTicket.get(c.ticket) || {};
    const card = cardsBy[r.supplier_id];
    const cardCost = card ? contractCost(o, { cardDiscount: card.tier.total, cardMonths: card.discount_months }) : null;
    const reasons = [];
    if (r.sales_90d) reasons.push(`최근 90일 ${r.sales_90d}건 판매`);
    if (r.focus.length) reasons.push(`렌탈사 ${r.focus.join('·')}`);
    if (r.margin_grade) reasons.push(`마진 ${r.margin_grade}`);
    if (need.budget) reasons.push(`예산 ${won(need.budget)} 이내(할인 끝난 뒤 ${won(c.monthly_fee_after)})`);
    if (c.type === '반값할인' && c.price_phases?.length) reasons.push(`${c.price_phases[0].from}~${c.price_phases[0].to}회차 ${won(c.price_phases[0].fee)}`);
    if (c.type === '타사보상') reasons.push('타사 제품 사용 고객 조건');
    const eff = cardCost?.effective_monthly ?? c.effective_monthly_after_guide;
    return {
      ticket: c.ticket, model_id: r.model_id, supplier_id: r.supplier_id, supplier: r.supplier, product_name: r.product_name, model_code: r.model_code,
      image_url: null, condition: c, rank: i + 1, sales_90d: r.sales_90d, focus: r.focus, margin_grade: r.margin_grade,
      why: reasons.join(' · '),
      customer_script: `${r.product_name} ${c.contract_months}개월${c.care && c.care !== '미표기' ? ` ${c.care}${c.cycle_months ? ` ${c.cycle_months}개월` : ''}` : ''} 조건으로 월 ${won(c.display_fee)}${c.price_phases?.length ? `(할인 뒤 ${won(c.monthly_fee_after)})` : ''}입니다.`
        + (card ? ` ${card.card_name}로 내시면 전월 ${Math.round((card.tier.min_spend || 0) / 10000)}만원 이상 쓰실 때 매달 ${won(card.tier.total)} 더 빠집니다.` : '')
        + (eff != null ? ` 페이백까지 치면 한 달에 약 ${won(eff)}꼴입니다.` : ''),
      cautions: /확인필요/.test(c.notes || '') ? c.notes.match(/확인필요[^/]*/)[0] : undefined,
      card: card ? { card_issuer: card.card_issuer, card_name: card.card_name, tier: card.tier, discount_months: card.discount_months, fee_with_card: Math.max(0, (c.display_fee || 0) - card.tier.total), effective_monthly_with_card: cardCost?.effective_monthly } : null,
    };
  });
  // 이미지 붙이기
  if (recommendations.length) {
    const { data: imgs } = await supabase.from('rental_cat_models').select('id, image_url').in('id', recommendations.map((x) => x.model_id));
    const im = new Map((imgs || []).map((x) => [x.id, x.image_url]));
    for (const x of recommendations) x.image_url = im.get(x.model_id) || null;
  }

  const summaryParts = [need.category && (CATEGORY_LABEL[need.category] || need.category), need.keywords.join('·'), need.budget && `월 ${won(need.budget)} 이하`,
    need.care_type && { visit: '방문관리', self: '자가관리' }[need.care_type], need.contract_months && `${need.contract_months / 12}년 약정`,
    need.current_brand && `지금 ${BRAND_LABEL[need.current_brand] || need.current_brand} 사용(타사보상)`, need.card_issuer && `${need.card_issuer}카드 보유`].filter(Boolean);
  const questions = [];
  if (!need.budget) questions.push('월 예산이 어느 정도세요?');
  if (!need.care_type && /water|air|bidet/.test(need.category || '')) questions.push('방문관리와 자가관리 중 어떤 걸 원하세요?');
  if (!need.card_issuer) questions.push('자동이체할 신용카드가 있으세요? (제휴카드 할인)');
  return {
    need, summary: summaryParts.join(' · '), questions: recommendations.length ? questions.slice(0, 2) : ['조건에 맞는 상품이 없습니다 — 예산·관리방식·약정을 넓혀 보세요'],
    recommendations, date: today(),
  };
}
