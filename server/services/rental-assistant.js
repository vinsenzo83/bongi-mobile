/**
 * rental-assistant.js — 렌탈 상담 AI (상담원 보조)
 *
 * 상품·조건이 수만 건이라 상담원이 통화 중에 필터로만 찾기 어렵다.
 * AI 는 기억으로 답하지 않고, 아래 도구로 우리 DB 를 조회한 결과만 근거로 답한다.
 *   search_products · get_conditions · get_ticket · get_cards · get_promotions · get_signup_policy
 * 리베이트는 도구 결과에 넣지 않는다(상담원 권한 밖). MAX 는 상담원 전용으로 표시해 준다.
 */
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../db/supabase.js';
import { CATEGORIES, CATEGORY_LABEL } from './rental-import/core.js';

const MODEL = process.env.RENTAL_ASSIST_MODEL || 'claude-sonnet-5';
const client = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
export const assistantEnabled = () => !!client;

const TYPE = { normal: '일반', package: '패키지', bundle: '결합', trade_in: '타사보상', half: '반값할인', prepay: '선납', promo: '프로모션', special: '특가', field: '현장', staff: '임직원', purchase: '일시불' };
const CARE = { visit: '방문관리', self: '자가관리', delivery: '택배(필터배송)', none: '관리없음' };
const clip = (s, n) => (s == null ? null : String(s).length > n ? `${String(s).slice(0, n)}…` : String(s));
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });

export const SYSTEM = `당신은 봉이 콜센터 렌탈 상담원을 돕는 상담 AI입니다. 상담원이 고객과 통화하면서 묻습니다.

## 절대 규칙
- 상품·요금·조건·카드·프로모션·가입기준은 반드시 도구로 조회한 결과만 근거로 말합니다. 기억·추측으로 사양이나 금액을 만들지 않습니다.
- 도구 결과에 없는 사양(용량·크기·기능)은 "등록된 정보 없음"이라고 말합니다.
- 조건을 말할 때는 티켓번호(R000000)를 함께 적습니다. 상담원이 바로 열어볼 수 있게.
- 결과의 notes 에 "확인필요"가 있으면 그대로 알려 줍니다(빌리고/렌탈사 확인 필요 사항).
- 리베이트·수수료는 알 수 없고 말하지 않습니다.
- MAX(최대 지급액)는 상담원 전용입니다. 언급할 때는 "(상담원 전용 — 고객 안내 금지)"를 붙입니다. 가이드 지급액과 "N개월 무료"는 고객에게 안내해도 됩니다.

## 계산 규칙
- 월 렌탈료 = display_fee(첫 달 요금). 반값·할인은 price_phases 구간(from~to 회차 fee)으로 설명합니다.
- N개월 무료 = 지급액 ÷ display_fee (버림).
- 제휴카드 적용 월 납부 = 월 렌탈료 − 카드의 전월실적 구간 할인액(total). 전월실적 미달이면 할인 없음을 함께 말합니다.
- 실질 월 부담 = (약정 전체 렌탈료(반값·카드 할인 반영) − 우리 페이백 지급액) ÷ 약정 개월. effective_monthly_after_guide 로 제공된다.
  고객 예산과 비교할 때는 첫 달 요금만이 아니라 할인 뒤 정상 요금과 실질 월 부담(페이백 반영)을 함께 보고, 추천 문장에도 "페이백까지 치면 한 달에 약 N원꼴"로 안내한다.
- 프로모션은 기간·대상·중복 가능 여부를 확인하고 말합니다.

## 자동 추천
- 상담원이 고객 상태·니즈(가족 수, 공간, 예산, 관리 선호, 기존 제품, 카드 등)를 말하면: search_products 를 카테고리·예산(max_monthly_fee)·관리방식·약정 필터로 한두 번 호출해 best_conditions 에서 고르고, 필요할 때만 get_conditions 를 씁니다. 카드 보유가 언급되면 get_cards. 그다음 반드시 submit_recommendations 로 1~3개를 제출합니다. 조회는 최소한으로(통화 중이라 빨라야 함).
- 추천 우선순위: 고객 니즈를 만족하는 것 중에서 ① 가장 많이 팔리는 것(sales_90d·주력·집중모델·우선판매) ② 가장 많이 남는 것(margin_grade 상 > 중 > 하). search_products 는 기본으로 이 순서로 준다.
  같은 모델 안에서는 조건(약정·관리·할인유형)도 고객 예산을 맞추는 범위에서 마진이 높은 쪽(가이드 대비 여유가 큰 쪽)을 먼저 고른다.
- margin_grade 는 내부 순위 정보다. 금액·리베이트로 바꿔 말하지 말고, 고객 안내 문장에는 절대 넣지 않는다.
- 추천 조건은 판매중 티켓만. 예산이 있으면 월 요금(카드 할인 전·후)을 맞추고, 제휴카드로 예산을 맞출 수 있으면 card 에 카드사·카드명·전월실적 구간을 적습니다(get_cards 로 확인한 것만).
- 정보가 모자라 추천 품질이 떨어지면 questions 에 고객에게 물어볼 질문 1~3개를 넣습니다.
- 타사보상은 고객이 다른 브랜드 제품을 쓰고 있을 때만(그 브랜드 렌탈사는 exclude_supplier_id 로 빼고 — 코웨이 사용 고객에게 코웨이 타사보상은 안 됨), 임직원·현장·일시불·선납은 고객 상황이 그럴 때만 offer_type 을 지정해 찾습니다.
- submit_recommendations 를 낼 때는 글 답변을 쓰지 않습니다(화면에 추천 카드로 나옴). 필요한 설명은 why·customer_script·cautions 에 짧게.
- 상품 사양 질문은 get_ticket(상세 사양 포함)으로 확인합니다.
- 일반 질문(사양·서류·프로모션 설명 등)은 submit_recommendations 없이 글로 짧게 답합니다.

## 답변 형식
- 한국어, 짧고 바로 쓸 수 있게. 추천은 2~3개 이하, 각각 "상품명 · 렌탈사 · 티켓 · 월 요금 · 관리방식 · 핵심 이유" 한 줄.
- 고객에게 그대로 읽어줄 문장이 필요하면 "고객 안내:" 로 한두 문장 따로 적습니다.
- 모르는 것은 모른다고 하고, 무엇을 확인해야 하는지 적습니다.`;

export const TOOLS = [
  {
    name: 'search_products',
    description: '판매중 렌탈 상품(모델) 검색. 키워드는 상품명·브랜드·모델코드·제품설명에서 찾는다. 결과는 최대 limit 개로, 많이 팔리는·많이 남는 순. 각 상품에 조건 필터(예산·관리·약정·유형)에 맞는 best_conditions(티켓·월요금·구간·가이드) 상위 3개가 들어 있으니, 대부분은 get_conditions 없이 바로 추천할 수 있다.',
    input_schema: {
      type: 'object',
      properties: {
        keywords: { type: 'string', description: '공백으로 구분한 검색어 (예: "얼음 정수기", "스타일러", "CHP-7220N")' },
        category: { type: 'string', enum: CATEGORIES.map(([slug]) => slug).filter((v, i, a) => a.indexOf(v) === i).concat('etc'), description: '카테고리 slug' },
        supplier_id: { type: 'string', description: '렌탈사 id (coway, cuckoo, chungho, skmagic, wells, luhens, cuming, ubus, lg-subscribe, lg-hello, kt, smart, bs, ini, rentana, carrier, cesco, renple)' },
        max_monthly_fee: { type: 'integer', description: '월 렌탈료 예산 상한(원) — 할인 기간이 끝난 뒤 정상 요금까지 예산 안인 조건만' },
        exclude_supplier_id: { type: 'string', description: '제외할 렌탈사 id (타사보상 추천 시 고객이 지금 쓰는 렌탈사)' },
        care_type: { type: 'string', enum: ['visit', 'self', 'delivery', 'none'], description: '관리방식' },
        contract_months: { type: 'integer', description: '약정 개월' },
        offer_type: { type: 'string', enum: Object.keys(TYPE), description: '할인유형' },
        sort: { type: 'string', enum: ['recommend', 'popular', 'margin', 'fee'], description: 'recommend(기본: 많이 팔린·주력 → 마진 높은 순) / popular / margin / fee(월요금 낮은 순)' },
        limit: { type: 'integer', description: '최대 개수 (기본 8, 최대 20)' },
      },
    },
  },
  {
    name: 'get_conditions',
    description: '모델 하나의 판매중 조건 목록(티켓·할인유형·약정·관리방식·주기·월요금·요금구간·가이드·MAX·무료개월·비고). 필터로 좁힐 수 있다.',
    input_schema: {
      type: 'object', required: ['model_id'],
      properties: {
        model_id: { type: 'string' },
        contract_months: { type: 'integer' },
        care_type: { type: 'string', enum: ['visit', 'self', 'delivery', 'none'] },
        offer_type: { type: 'string', enum: Object.keys(TYPE) },
      },
    },
  },
  { name: 'get_ticket', description: '티켓번호(R000000)로 조건과 모델 정보 조회', input_schema: { type: 'object', required: ['ticket'], properties: { ticket: { type: 'string' } } } },
  { name: 'get_cards', description: '렌탈사 제휴카드 목록(전월실적 구간별 월 할인액·할인 개월·연회비)', input_schema: { type: 'object', required: ['supplier_id'], properties: { supplier_id: { type: 'string' } } } },
  { name: 'get_promotions', description: '렌탈사의 진행 중 프로모션(기간·혜택·대상·중복 조건)', input_schema: { type: 'object', required: ['supplier_id'], properties: { supplier_id: { type: 'string' } } } },
  {
    name: 'submit_recommendations',
    description: '고객 니즈에 맞는 조건 추천을 최종 제출한다(자동 추천 카드로 화면에 표시). 조회로 확인한 판매중 티켓만.',
    input_schema: {
      type: 'object', required: ['summary', 'recommendations'],
      properties: {
        summary: { type: 'string', description: '고객 니즈 요약 한 줄' },
        questions: { type: 'array', items: { type: 'string' }, description: '추가로 고객에게 물어볼 질문(선택)' },
        recommendations: {
          type: 'array', maxItems: 3,
          items: {
            type: 'object', required: ['ticket', 'why'],
            properties: {
              ticket: { type: 'string', description: 'R000000' },
              why: { type: 'string', description: '이 고객에게 맞는 이유 한두 줄 (조회 결과 근거)' },
              customer_script: { type: 'string', description: '고객에게 읽어줄 안내 문장 (MAX 금지)' },
              card: { type: 'object', properties: { card_issuer: { type: 'string' }, card_name: { type: 'string' }, min_spend: { type: 'integer' } } },
              cautions: { type: 'string', description: '확인필요·조건 제한 등 주의' },
            },
          },
        },
      },
    },
  },
  { name: 'get_signup_policy', description: '렌탈사 가입기준 요약(가입 가능 명의·연령·신용·납부방법·필요 서류·해피콜)', input_schema: { type: 'object', required: ['supplier_id'], properties: { supplier_id: { type: 'string' } } } },
];

const OFFER_COLS = 'id, ticket_number, model_id, supplier_id, contract_months, obligation_months, ownership_months, care_type, care_label, cycle_months, offer_type, offer_tags, offer_label, monthly_fee, price_phases, display_fee, prepay_amount, guide_payout, max_payout, free_months, notes, valid_to';

function slimModel(m, full = false) {
  const sp = m.specs || {};
  return {
    model_id: m.id, supplier_id: m.supplier_id, supplier: m.supplier_name, product_name: m.product_name, model_code: m.model_code,
    category: CATEGORY_LABEL[m.category] || m.category, min_monthly_fee: m.min_display_fee, max_free_months: m.max_free_months,
    description: clip(sp.description, full ? 300 : 90), features: (sp.feature_tags || []).slice(0, full ? 8 : 4),
    specs: full && sp.specifications ? Object.fromEntries(Object.entries(sp.specifications).filter(([, v]) => v != null && v !== '').slice(0, 12)) : undefined,
    size_mm: full ? sp.size_mm : undefined, notes: full ? clip(sp.spec_notes, 200) : undefined, product_url: full ? sp.product_url : undefined,
  };
}
/**
 * 실질 월 부담 — 약정 전체 렌탈료(반값 구간·카드 할인 반영) − 우리 페이백(지급액) ÷ 약정 개월
 *   카드 할인은 매달 전월실적을 채운다고 가정하고, 카드의 할인 개월(discount_months) 까지만 뺀다
 */
export function contractCost(o, { payout = null, cardDiscount = 0, cardMonths = null } = {}) {
  const months = o.contract_months || 0;
  if (!months || o.monthly_fee == null) return null;
  const phases = o.price_phases || [];
  let total = 0; let withCard = 0;
  for (let m = 1; m <= months; m++) {
    const p = phases.find((x) => m >= x.from && m <= x.to);
    const fee = p ? p.fee : o.monthly_fee;
    total += fee;
    withCard += Math.max(0, fee - (cardDiscount && (!cardMonths || m <= cardMonths) ? cardDiscount : 0));
  }
  const pay = payout ?? o.guide_payout ?? 0;
  return {
    total_rent: total,
    total_with_card: cardDiscount ? withCard : undefined,
    payback: pay,
    effective_monthly: Math.round(((cardDiscount ? withCard : total) - pay) / months),
  };
}

function slimOffer(o) {
  return {
    ticket: o.ticket_number, type: TYPE[o.offer_type] || o.offer_type, label: o.offer_label, contract_months: o.contract_months,
    ownership_months: o.ownership_months !== o.contract_months ? o.ownership_months : undefined,
    care: CARE[o.care_type] || o.care_label || '미표기', cycle_months: o.cycle_months,
    display_fee: o.display_fee, monthly_fee_after: o.monthly_fee, price_phases: o.price_phases?.length ? o.price_phases : undefined,
    prepay_amount: o.prepay_amount || undefined, guide_payout: o.guide_payout, max_payout_counselor_only: o.max_payout, free_months_at_guide: o.free_months,
    // 페이백(가이드) 반영 실질 월 부담 — 예산 비교는 이 값도 같이 본다
    effective_monthly_after_guide: contractCost(o)?.effective_monthly, total_rent: contractCost(o)?.total_rent,
    notes: clip(o.notes, 200), valid_to: o.valid_to || undefined,
  };
}

/**
 * 추천 순위 — "가장 많이 팔리는 것, 가장 많이 남는 것" (대표 지시 2026-09-17)
 *   판매: 최근 90일 우리 렌탈 계약 수(모델 기준) + 렌탈사 주력·집중모델·우선판매 표시
 *   마진: 조건별 (리베이트 공급가 − 가이드 지급액) 중 최댓값 → 상담원에게는 금액이 아니라 상/중/하 등급만
 */
async function rankModels(models, mode, filter = {}) {
  if (!models.length) return [];
  const ids = models.map((m) => m.id);
  const { data: offers } = await supabase.from('rental_cat_offers').select(`${OFFER_COLS}, rebate, crm_enabled`)
    .in('model_id', ids).eq('status', 'active');
  const since = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  const offerIds = (offers || []).map((o) => o.id);
  const { data: sales } = offerIds.length
    ? await supabase.from('incentive_sales').select('rental_offer_id').eq('sale_kind', 'rental').is('deleted_at', null).neq('status', 'cancelled').gte('contract_date', since).in('rental_offer_id', offerIds.slice(0, 900))
    : { data: [] };
  const offerModel = new Map((offers || []).map((o) => [o.id, o.model_id]));
  const stat = new Map(ids.map((id) => [id, { sales: 0, margin: null, focus: new Set() }]));
  for (const s of sales || []) { const st = stat.get(offerModel.get(s.rental_offer_id)); if (st) st.sales++; }
  for (const o of offers || []) {
    const st = stat.get(o.model_id);
    if (o.rebate != null && o.guide_payout != null) st.margin = Math.max(st.margin ?? -Infinity, Math.floor(o.rebate / 1.1) - o.guide_payout);
    if ((o.offer_tags || []).includes('집중모델')) st.focus.add('집중모델');
    if (/주력\s*:\s*●|주력/.test(o.notes || '')) st.focus.add('주력');
    if (/우선판매/.test(o.notes || '')) st.focus.add('우선판매');
  }
  const margins = [...stat.values()].map((s) => s.margin).filter((v) => v != null).sort((a, b) => a - b);
  const grade = (v) => {
    if (v == null || !margins.length) return null;
    const p = margins.findIndex((x) => x >= v) / Math.max(1, margins.length - 1);
    return p >= 0.67 ? '상' : p >= 0.34 ? '중' : '하';
  };
  // 모델마다 조건 필터(예산·관리·약정·유형)에 맞는 조건 중 남는 순 상위 3개를 같이 준다 → 모델별 get_conditions 호출을 줄인다
  const d = today();
  // 타사보상·임직원·현장·일시불·선납은 고객 상황이 맞을 때만 — 유형을 지정하지 않으면 추천 후보에서 뺀다
  const SPECIAL = ['trade_in', 'staff', 'field', 'purchase', 'prepay'];
  const fits = (o) => o.crm_enabled !== false && (!o.valid_to || o.valid_to >= d)
    && (filter.offer_type ? true : !SPECIAL.includes(o.offer_type) && !/타사/.test(`${o.offer_label || ''} ${(o.offer_tags || []).join(' ')}`))
    && (!filter.care_type || o.care_type === filter.care_type)
    && (!filter.contract_months || o.contract_months === filter.contract_months)
    && (!filter.offer_type || o.offer_type === filter.offer_type)
    // 예산은 할인 끝난 뒤 요금까지 — 반값 첫 달만 싸고 이후 예산을 넘는 조건은 빼야 한다
    && (!filter.max_monthly_fee || (o.display_fee != null && Math.max(o.display_fee, o.monthly_fee || 0) <= filter.max_monthly_fee));
  const best = new Map();
  for (const o of offers || []) {
    if (!fits(o)) continue;
    const list = best.get(o.model_id) || best.set(o.model_id, []).get(o.model_id);
    list.push({ o, m: o.rebate != null && o.guide_payout != null ? Math.floor(o.rebate / 1.1) - o.guide_payout : -Infinity });
  }
  const rows = models.map((m) => {
    const st = stat.get(m.id);
    // 요금·구간·약정·관리·유형이 같은 조건(색상·반복행 차이)은 하나만
    const seenSig = new Set();
    const top = (best.get(m.id) || []).sort((a, b) => b.m - a.m || (a.o.display_fee ?? 1e9) - (b.o.display_fee ?? 1e9))
      .filter((x) => { const k = [x.o.offer_type, x.o.offer_label, x.o.contract_months, x.o.care_type, x.o.cycle_months, x.o.display_fee, x.o.monthly_fee, JSON.stringify(x.o.price_phases)].join('|'); if (seenSig.has(k)) return false; seenSig.add(k); return true; })
      .slice(0, 3).map((x) => slimOffer(x.o));
    return { ...slimModel(m), sales_90d: st.sales, focus: [...st.focus], margin_grade: grade(st.margin), matching_conditions: (best.get(m.id) || []).length, best_conditions: top, _margin: st.margin ?? -Infinity };
  }).filter((r) => !(filter.care_type || filter.contract_months || filter.offer_type || filter.max_monthly_fee) || r.best_conditions.length);
  const popularity = (r) => r.sales_90d * 10 + r.focus.length * 3;
  rows.sort((a, b) => {
    if (mode === 'margin') return b._margin - a._margin;
    if (mode === 'popular') return popularity(b) - popularity(a) || b._margin - a._margin;
    if (mode === 'fee') return (a.min_monthly_fee ?? 1e9) - (b.min_monthly_fee ?? 1e9);
    // recommend: 판매·주력 우선, 같으면 마진
    return popularity(b) - popularity(a) || b._margin - a._margin;
  });
  return rows.map(({ _margin, ...r }) => r);
}

export async function runTool(name, input) {
  switch (name) {
    case 'search_products': {
      const limit = Math.min(20, Math.max(1, input.limit || 8));
      let q = supabase.from('rental_cat_model_summary').select('*').eq('status', 'active').gt('offer_count', 0);
      const rankMode = input.sort || 'recommend';
      for (const w of String(input.keywords || '').split(/\s+/).map((x) => x.replace(/[%,()]/g, '')).filter(Boolean).slice(0, 4)) {
        q = q.or(`product_name.ilike.%${w}%,brand.ilike.%${w}%,model_code.ilike.%${w}%,model_key.ilike.%${w}%,category_raw.ilike.%${w}%,specs->>description.ilike.%${w}%,specs->>name.ilike.%${w}%`);
      }
      if (input.category) q = q.eq('category', input.category);
      if (input.supplier_id) q = q.eq('supplier_id', input.supplier_id);
      if (input.exclude_supplier_id) q = q.neq('supplier_id', input.exclude_supplier_id);   // 타사보상: 고객이 지금 쓰는 렌탈사는 제외
      if (input.max_monthly_fee) q = q.lte('min_display_fee', input.max_monthly_fee);
      // 후보를 넉넉히 가져와 판매량·마진으로 다시 줄 세운다
      const { data, error } = await q.order('max_free_months', { ascending: false, nullsFirst: false }).limit(80);
      if (error) return { error: error.message };
      const ranked = await rankModels(data, rankMode, input);
      return { count: ranked.length, sort: rankMode, products: ranked.slice(0, limit) };
    }
    case 'get_conditions': {
      let q = supabase.from('rental_cat_offers').select(`${OFFER_COLS}, rebate`).eq('model_id', input.model_id).eq('status', 'active').eq('crm_enabled', true)
        .or(`valid_to.is.null,valid_to.gte.${today()}`);
      if (input.contract_months) q = q.eq('contract_months', input.contract_months);
      if (input.care_type) q = q.eq('care_type', input.care_type);
      if (input.offer_type) q = q.eq('offer_type', input.offer_type);
      const { data, error } = await q.order('display_fee').limit(60);
      if (error) return { error: error.message };
      // 같은 모델 안에서 남는 순위(1 = 가장 많이 남음) — 리베이트 금액은 내보내지 않는다
      const byMargin = data.filter((o) => o.rebate != null && o.guide_payout != null)
        .map((o) => ({ id: o.id, m: Math.floor(o.rebate / 1.1) - o.guide_payout })).sort((a, b) => b.m - a.m);
      const rank = new Map(byMargin.map((x, i) => [x.id, i + 1]));
      return {
        count: data.length,
        conditions: data.map((o) => ({ ...slimOffer(o), margin_rank: rank.get(o.id) || null })),
        note: data.length === 60 ? '60개까지만 — 약정·관리·유형으로 좁혀서 다시 조회' : undefined,
      };
    }
    case 'get_ticket': {
      const t = String(input.ticket || '').toUpperCase().replace(/[^R0-9]/g, '');
      const { data: o } = await supabase.from('rental_cat_offers').select(`${OFFER_COLS}, status`).eq('ticket_number', t).maybeSingle();
      if (!o) return { error: '티켓 없음' };
      const { data: m } = await supabase.from('rental_cat_model_summary').select('*').eq('id', o.model_id).maybeSingle();
      return { condition: { ...slimOffer(o), status: o.status }, product: m ? slimModel(m, true) : null };
    }
    case 'get_cards': {
      const { data } = await supabase.from('rental_cat_cards').select('card_issuer, card_name, tiers, discount_months, annual_fee, categories, notes, verify_status')
        .eq('supplier_id', input.supplier_id).eq('is_active', true).order('max_discount', { ascending: false });
      return { cards: (data || []).map((c) => ({ ...c, notes: clip(c.notes, 160) })) };
    }
    case 'get_promotions': {
      const d = today();
      const { data } = await supabase.from('rental_cat_promotions').select('title, summary, benefit, targets, stacking, period_from, period_to')
        .eq('supplier_id', input.supplier_id).eq('is_active', true)
        .or(`and(or(period_to.is.null,period_to.gte.${d}),or(period_from.is.null,period_from.lte.${d}))`);
      return { promotions: data || [] };
    }
    case 'get_signup_policy': {
      const { data } = await supabase.from('rental_cat_suppliers').select('name, signup_policy, signup_policy_as_of').eq('id', input.supplier_id).maybeSingle();
      if (!data) return { error: '렌탈사 없음' };
      const p = data.signup_policy?.water || data.signup_policy?.appliance || {};
      return {
        supplier: data.name, as_of: data.signup_policy_as_of,
        eligibility: p.eligibility, credit: p.credit, payment: p.payment,
        documents: (p.required_documents || []).slice(0, 20), contacts: p.contacts,
      };
    }
    default: return { error: `알 수 없는 도구 ${name}` };
  }
}

export async function verifyRecommendations(input) {
  const recs = [];
  for (const rec of (input.recommendations || []).slice(0, 3)) {
    const t = String(rec.ticket || '').toUpperCase();
    const { data: o } = await supabase.from('rental_cat_offers').select(`${OFFER_COLS}, status, crm_enabled`).eq('ticket_number', t).maybeSingle();
    if (!o || o.status !== 'active' || o.crm_enabled === false || (o.valid_to && o.valid_to < today())) { recs.push({ ticket: t, invalid: '판매중 조건이 아님 — 제외' }); continue; }
    const { data: m } = await supabase.from('rental_cat_model_summary').select('id, supplier_id, supplier_name, product_name, model_code, image_url, category').eq('id', o.model_id).maybeSingle();
    let card = null;
    if (rec.card?.card_name) {
      const { data: cards } = await supabase.from('rental_cat_cards').select('card_issuer, card_name, tiers, discount_months').eq('supplier_id', o.supplier_id).eq('is_active', true);
      const c = (cards || []).find((x) => x.card_name === rec.card.card_name || `${x.card_issuer} ${x.card_name}` === `${rec.card.card_issuer} ${rec.card.card_name}`);
      const tier = c && ((c.tiers || []).find((x) => x.min_spend === rec.card.min_spend) || (c.tiers || []).find((x) => x.total));
      if (c && tier) {
        const cost = contractCost(o, { cardDiscount: tier.total || 0, cardMonths: c.discount_months });
        card = { card_issuer: c.card_issuer, card_name: c.card_name, tier, discount_months: c.discount_months, fee_with_card: Math.max(0, (o.display_fee || 0) - (tier.total || 0)), effective_monthly_with_card: cost?.effective_monthly };
      }
    }
    recs.push({
      ticket: t, model_id: o.model_id, supplier_id: o.supplier_id, supplier: m?.supplier_name, product_name: m?.product_name, model_code: m?.model_code, image_url: m?.image_url,
      condition: slimOffer(o), why: rec.why, customer_script: rec.customer_script, cautions: rec.cautions, card,
    });
  }
  return { summary: input.summary, questions: (input.questions || []).slice(0, 3), recommendations: recs };
}

/**
 * messages: [{role:'user'|'assistant', content:string}] (최근 대화)
 * context: { model_id?, ticket? } 화면에서 보고 있는 상품·조건
 */
export async function assist({ messages, context = {}, agentName }) {
  if (!client) throw Object.assign(new Error('AI 비활성화(ANTHROPIC_API_KEY 없음)'), { status: 503 });
  const ctxText = [
    context.ticket ? `상담원이 지금 보고 있는 조건 티켓: ${context.ticket}` : null,
    context.model_id ? `상담원이 지금 보고 있는 모델 id: ${context.model_id}` : null,
    `오늘: ${today()}`, agentName ? `상담원: ${agentName}` : null,
  ].filter(Boolean).join('\n');
  const convo = messages.slice(-10).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: clip(m.content, 2000) }));
  const used = [];
  for (let step = 0; step < 8; step++) {
    // 마지막 단계는 반드시 결론을 내게 한다 (조회만 반복하다 끝나지 않게)
    const lastStep = step === 7;
    const r = await client.messages.create({
      model: MODEL, max_tokens: 4000, system: `${SYSTEM}\n\n## 지금 화면\n${ctxText}`, tools: TOOLS, messages: convo,
      ...(lastStep ? { tool_choice: { type: 'tool', name: 'submit_recommendations' } } : {}),
    });
    const toolUses = r.content.filter((b) => b.type === 'tool_use');
    if (r.stop_reason !== 'tool_use' || !toolUses.length) {
      const answer = r.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
      if (!answer) console.warn('[rental-assist] empty answer stop_reason=', r.stop_reason, 'blocks=', r.content.map((b) => b.type).join(','));
      return { answer: answer || `답변을 만들지 못했습니다(${r.stop_reason}). 질문을 조금 좁혀 다시 시도해 주세요.`, tools: used, tickets: [...new Set(answer.match(/R\d{6}/g) || [])] };
    }
    // 추천 제출 → 티켓을 DB 로 다시 확인·보강해서 끝낸다 (AI 가 없는 티켓·판매중지 조건을 내지 못하게)
    const submit = toolUses.find((t) => t.name === 'submit_recommendations');
    if (submit) {
      used.push('submit_recommendations');
      const text = r.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
      return { answer: text, tools: used, recommendation: await verifyRecommendations(submit.input || {}) };
    }
    convo.push({ role: 'assistant', content: r.content });
    const results = [];
    for (const tu of toolUses) {
      used.push(tu.name);
      let out;
      try { out = await runTool(tu.name, tu.input || {}); } catch (e) { out = { error: e.message }; }
      results.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(out).slice(0, 30000) });
    }
    convo.push({ role: 'user', content: results });
  }
  return { answer: '조회가 길어져 중단했습니다. 질문을 좁혀 주세요(렌탈사·카테고리·월 요금 등).', tools: used, tickets: [] };
}
