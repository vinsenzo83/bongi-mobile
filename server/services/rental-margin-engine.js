/**
 * rental-margin-engine.js — 렌탈 가이드·MAX 마진 설계 엔진
 *
 * 계산은 순수 함수(simulate)로만 한다 — DB·HTTP 와 분리해서 단위 테스트하고, 규칙을 바꿀 때 버전을 올린다.
 * 데이터 적재(loadDataset)는 판매중 조건의 리베이트와 경쟁사 벤치마크를 한 번 읽어 10분 캐시한다.
 *
 * 급여 구조 (정산 규칙 6.0-residual):  상담사 월급 = 기본급 + Σ(MAX − 실제 지급액) × 개인 배분율
 * 회사 몫(건당)  = 공급가 리베이트 − 고객 지급액 − 상담사 인센티브
 * 가이드 = 공급가 × (1 − 가이드마진) 만원 버림 (MAX 초과 불가) · MAX = 공급가 × (1 − MAX마진) 천원 버림  ← DB 함수 rental_cat_apply_margin 과 같은 식
 *
 * 버전 기록
 *   1.0.0  2026-09-17  균등/판매량 가중, 재량 사용률, 누진 배분율, 1인 생산성, 판매량 곡선, 손익분기, 카테고리별, 경쟁사 비교
 *   1.1.0  2026-09-17  금액 하한(max_floor·guide_floor) — 리베이트가 작은 조건도 건당 인건비를 남긴다 · optimize() 제약 최적화
 */
import { supabase } from '../db/supabase.js';

export const ENGINE_VERSION = '1.1.0';

export const DEFAULTS = {
  max_margin: 0.15,
  guide_margin: 0.33,
  max_floor: 0,                    // MAX 를 줘도 회사에 최소 이만큼(원)은 남긴다 — 마진%와 둘 중 큰 쪽
  guide_floor: 0,                  // 가이드만 줄 때 최소로 남길 금액(원) — 가이드마진%와 둘 중 큰 쪽
  basis: 'supply',                 // supply = 리베이트 ÷ 1.1 · vat = 리베이트 그대로
  rate_tiers: [{ min: 0, rate: 0.30 }],   // 1인 월 설치 건수 → 배분율 (min 이상이면 그 rate)
  productivity: 50,                // 1인 월 설치
  discretion: 0.3,                 // 가이드~MAX 구간 중 고객에게 더 얹어주는 비율 (0 = 가이드만, 1 = MAX 까지)
  base_salary: 2300000,
  overhead_per_head: 0,            // 1인당 월 운영비 (자리·장비·관리)
  fixed_overhead: 0,               // 월 고정비 (판매량과 무관)
  volumes: [100, 300, 500, 700, 1000, 1500, 2000, 3000, 5000, 7000, 10000],
  weight: 'equal',                 // equal = 조건 균등 · sales = 실제 렌탈 판매(티켓) 비중
  current_rate: 0.2,               // '지금' 비교에 쓰는 실제 배분율 (incentive_agents.incentive_rate 기본 20)
};

const num = (v, d) => (v === '' || v == null || !Number.isFinite(Number(v)) ? d : Number(v));

/** 입력 정리 — 범위를 벗어나면 에러 (조용히 고치지 않는다) */
export function normalizeParams(input = {}) {
  const p = { ...DEFAULTS, ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined && v !== '')) };
  const errors = [];
  p.max_margin = num(p.max_margin, NaN); p.guide_margin = num(p.guide_margin, NaN);
  if (!(p.max_margin >= 0 && p.max_margin < 1)) errors.push('MAX 마진은 0~99%');
  if (!(p.guide_margin >= p.max_margin && p.guide_margin < 1)) errors.push('가이드 마진은 MAX 마진 이상 99% 이하');
  p.max_floor = num(p.max_floor, 0); p.guide_floor = num(p.guide_floor, 0);
  if (!(p.max_floor >= 0 && p.guide_floor >= 0)) errors.push('금액 하한은 0 이상');
  p.basis = p.basis === 'vat' ? 'vat' : 'supply';
  p.productivity = num(p.productivity, NaN); if (!(p.productivity >= 1 && p.productivity <= 1000)) errors.push('1인 생산성은 1~1000건');
  p.discretion = num(p.discretion, NaN); if (!(p.discretion >= 0 && p.discretion <= 1)) errors.push('재량 사용률은 0~100%');
  p.base_salary = num(p.base_salary, NaN); if (!(p.base_salary >= 0 && p.base_salary <= 50000000)) errors.push('기본급 범위 오류');
  p.overhead_per_head = num(p.overhead_per_head, 0); p.fixed_overhead = num(p.fixed_overhead, 0);
  if (p.overhead_per_head < 0 || p.fixed_overhead < 0) errors.push('운영비는 0 이상');
  if (!Array.isArray(p.rate_tiers) || !p.rate_tiers.length) errors.push('배분율 구간이 필요합니다');
  else {
    p.rate_tiers = p.rate_tiers.map((t) => ({ min: num(t.min, NaN), rate: num(t.rate, NaN) })).sort((a, b) => a.min - b.min);
    if (p.rate_tiers.some((t) => !(t.min >= 0) || !(t.rate >= 0 && t.rate <= 1))) errors.push('배분율 구간: 건수 0 이상, 배분율 0~100%');
  }
  if (!Array.isArray(p.volumes)) p.volumes = DEFAULTS.volumes;
  p.volumes = [...new Set(p.volumes.map(Number).filter((v) => Number.isInteger(v) && v > 0 && v <= 100000))].sort((a, b) => a - b).slice(0, 30);
  p.weight = p.weight === 'sales' ? 'sales' : 'equal';
  p.current_rate = num(p.current_rate, 0.2); if (!(p.current_rate >= 0 && p.current_rate <= 1)) errors.push('지금 배분율은 0~100%');
  return { params: p, errors };
}

export const rateFor = (tiers, installs) => tiers.reduce((r, t) => (installs >= t.min ? t.rate : r), tiers[0].rate);
// DB(numeric)와 같은 값이 되게 ÷1.1 의 부동소수 오차를 소수 6자리에서 정리 (1,100,000 ÷ 1.1 = 999999.9999… → 1,000,000)
const base = (row, basis) => (basis === 'vat' ? row.rebate : Math.round((row.rebate / 1.1) * 1e6) / 1e6);
export function ruleGuideMax(row, p) {
  const b = base(row, p.basis);
  return guideMaxFromBase(b, p);
}
const r6 = (x) => Math.round(x * 1e6) / 1e6;   // 1 − 0.33 = 0.66999… 같은 오차로 만원 버림이 한 단계 내려가지 않게
/** DB 함수 rental_cat_apply_margin 과 같은 식: 남길 몫 = max(공급가×마진, 금액 하한) */
export function guideMaxFromBase(b, p) {
  const keepMax = Math.max(r6(b * p.max_margin), p.max_floor || 0);
  const keepGuide = Math.max(r6(b * p.guide_margin), p.guide_floor || 0, keepMax);
  const max = Math.max(0, Math.floor(r6(b - keepMax) / 1000) * 1000);
  const guide = Math.max(0, Math.min(max, Math.floor(r6(b - keepGuide) / 10000) * 10000));
  return { b, guide, max };
}

/** 건당 가중 평균 — rule: 'proposed'(입력 규칙으로 재계산) | 'live'(DB 에 들어 있는 가이드·MAX 그대로) */
function perSale(rows, p, rule, rate) {
  let w = 0, rebate = 0, guide = 0, max = 0, pay = 0, inc = 0;
  for (const r of rows) {
    const wt = r.weight ?? 1;
    if (!wt) continue;
    let g, m, b;
    if (rule === 'live') { b = base(r, p.basis); g = r.guide_payout; m = r.max_payout; if (g == null || m == null) continue; }
    else ({ b, guide: g, max: m } = ruleGuideMax(r, p));
    const paid = g + (m - g) * p.discretion;
    w += wt; rebate += b * wt; guide += g * wt; max += m * wt; pay += paid * wt; inc += (m - paid) * rate * wt;
  }
  if (!w) return null;
  const s = { rebate: rebate / w, guide: guide / w, max: max / w, customer_pay: pay / w, counselor_incentive: inc / w };
  s.company = s.rebate - s.customer_pay - s.counselor_incentive;          // 기본급·운영비 전
  s.customer_pct = s.customer_pay / s.rebate; s.company_pct = s.company / s.rebate;
  return s;
}

function scenario(rows, p, rule) {
  const rate = rateFor(p.rate_tiers, p.productivity);
  const s = perSale(rows, p, rule, rate);
  if (!s) return null;
  const headCost = p.base_salary + p.overhead_per_head;
  const perHead = {
    installs: p.productivity, rate,
    salary: p.base_salary + s.counselor_incentive * p.productivity,
    company: s.company * p.productivity - headCost,
  };
  // 손익분기: 1인이 몇 건 팔아야 기본급·운영비를 회수하나 (배분율 구간이 건수에 따라 바뀌므로 1건씩 올려 찾는다)
  const breakEven = (disc) => {
    for (let n = 1; n <= 1000; n++) {
      const r = rateFor(p.rate_tiers, n);
      const x = perSale(rows, { ...p, discretion: disc }, rule, r);
      if (x.company * n >= headCost) return n;
    }
    return null;
  };
  const volumes = p.volumes.map((v) => {
    const heads = Math.ceil(v / p.productivity);
    const per = v / heads; const r = rateFor(p.rate_tiers, per);
    const x = r === rate ? s : perSale(rows, p, rule, r);
    const company = x.company * v - headCost * heads - p.fixed_overhead;
    return { volume: v, heads, rate: r, salary: p.base_salary + x.counselor_incentive * per, company, company_pct: company / (x.rebate * v), rebate_total: x.rebate * v, customer_total: x.customer_pay * v };
  });
  return { per_sale: s, per_head: perHead, break_even: { at_discretion: breakEven(p.discretion), at_max: breakEven(1), at_guide: breakEven(0) }, volumes };
}

/**
 * dataset: { rows: [{rebate, supplier_id, category, guide_payout, max_payout, weight?}], benchmarks: [{..., rebate, live_guide, live_max}] }
 */
export function simulate(dataset, input) {
  const { params: p, errors } = normalizeParams(input);
  if (errors.length) return { ok: false, errors };
  let rows = dataset.rows.filter((r) => r.rebate > 0);
  if (p.filter?.supplier_id) rows = rows.filter((r) => r.supplier_id === p.filter.supplier_id);
  if (p.filter?.category) rows = rows.filter((r) => r.category === p.filter.category);
  const salesKnown = rows.some((r) => r.sales > 0);
  const weight = p.weight === 'sales' && salesKnown ? 'sales' : 'equal';
  rows = rows.map((r) => ({ ...r, weight: weight === 'sales' ? r.sales || 0 : 1 }));
  if (!rows.length) return { ok: false, errors: ['조건에 맞는 판매중 조건이 없습니다'] };

  const proposed = scenario(rows, p, 'proposed');
  const live = scenario(rows, { ...p, rate_tiers: [{ min: 0, rate: p.current_rate }] }, 'live');   // 지금 = 조건에 든 가이드·MAX + 지금 배분율

  // 카테고리별 (제안 규칙)
  const byCat = new Map();
  for (const r of rows) { if (!byCat.has(r.category)) byCat.set(r.category, []); byCat.get(r.category).push(r); }
  const rate = rateFor(p.rate_tiers, p.productivity);
  const categories = [...byCat].map(([category, list]) => ({ category, conditions: list.length, ...perSale(list, p, 'proposed', rate) }))
    .sort((a, b) => b.conditions - a.conditions);

  // 경쟁사 비교 (같은 모델·약정·관리·요금 구조로 매칭된 조건)
  const benchmarks = (dataset.benchmarks || []).map((bm) => {
    if (!bm.rebate) return { ...bm, matched: false };
    const { b, guide, max } = ruleGuideMax(bm, p);
    return { ...bm, matched: true, supply: b, guide, max, guide_gap: guide - bm.support_amount, max_gap: max - bm.support_amount, competitor_pct: bm.support_amount / b };
  });
  const matched = benchmarks.filter((x) => x.matched);
  const competitor = matched.length ? {
    count: matched.length,
    avg_pct: matched.reduce((a, x) => a + x.competitor_pct, 0) / matched.length,
    guide_below: matched.filter((x) => x.guide_gap < 0).length,
    max_below: matched.filter((x) => x.max_gap < 0).length,
  } : null;

  return {
    ok: true, engine_version: ENGINE_VERSION, params: p,
    dataset: { conditions: rows.length, weight, sales_known: salesKnown },
    proposed, live, categories, benchmarks, competitor,
  };
}

// ─── 데이터 적재 (10분 캐시) ───
let cache = null;
const TTL = 10 * 60 * 1000;
export function resetDatasetCache() { cache = null; }

export async function loadDataset() {
  if (cache && cache.at > Date.now() - TTL) return cache.data;
  const offers = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from('rental_cat_offers')
      .select('id, ticket_number, model_id, supplier_id, rebate, guide_payout, max_payout, contract_months, care_type, display_fee, monthly_fee')
      .eq('status', 'active').eq('crm_enabled', true).gt('rebate', 0).order('id').range(from, from + 999).throwOnError();
    offers.push(...data);
    if (data.length < 1000) break;
  }
  const cat = new Map();
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from('rental_cat_models').select('id, category, model_code').order('id').range(from, from + 999).throwOnError();
    for (const m of data) cat.set(m.id, m);
    if (data.length < 1000) break;
  }
  // 실제 렌탈 판매(티켓별 건수) — 판매량 가중용
  const sales = new Map();
  const { data: sold } = await supabase.from('incentive_sales').select('rental_ticket_number').eq('sale_kind', 'rental').neq('status', 'cancelled').not('rental_ticket_number', 'is', null).limit(50000);
  for (const s of sold || []) sales.set(s.rental_ticket_number, (sales.get(s.rental_ticket_number) || 0) + 1);

  const rows = offers.map((o) => ({ rebate: o.rebate, supplier_id: o.supplier_id, category: cat.get(o.model_id)?.category || 'etc', guide_payout: o.guide_payout, max_payout: o.max_payout, sales: sales.get(o.ticket_number) || 0 }));

  // 경쟁사 벤치마크 → 우리 조건 매칭 (같은 렌탈사·모델코드·약정·관리, 요금 구조 같으면 우선, 없으면 리베이트 최대)
  const { data: bms } = await supabase.from('rental_competitor_benchmarks').select('*').eq('is_active', true).order('support_amount', { ascending: false });
  const byModelCode = new Map();
  for (const o of offers) {
    const code = String(cat.get(o.model_id)?.model_code || '').toUpperCase();
    if (!code) continue;
    const k = `${o.supplier_id}|${o.contract_months}|${o.care_type}`;
    for (const c of code.split(/[\s/,]+/)) { const key = `${k}|${c}`; if (!byModelCode.has(key)) byModelCode.set(key, []); byModelCode.get(key).push(o); }
  }
  const benchmarks = (bms || []).map((bm) => {
    const list = byModelCode.get(`${bm.supplier_id}|${bm.contract_months}|${bm.care_type}|${String(bm.model_code).toUpperCase()}`) || [];
    const same = list.filter((o) => o.display_fee === bm.monthly_fee && (bm.after_fee == null || o.monthly_fee === bm.after_fee));
    const best = (same.length ? same : list).sort((a, b) => b.rebate - a.rebate)[0];
    return {
      id: bm.id, competitor: bm.competitor, supplier_id: bm.supplier_id, model_code: bm.model_code, product_name: bm.product_name,
      contract_months: bm.contract_months, care_type: bm.care_type, monthly_fee: bm.monthly_fee, after_fee: bm.after_fee, half_months: bm.half_months,
      support_amount: bm.support_amount, observed_at: bm.observed_at, source_url: bm.source_url,
      ticket: best?.ticket_number || null, same_fee: same.length > 0, rebate: best?.rebate || null, live_guide: best?.guide_payout ?? null, live_max: best?.max_payout ?? null,
    };
  });
  const data = { rows, benchmarks, loaded_at: new Date().toISOString() };
  cache = { at: Date.now(), data };
  return data;
}

/**
 * 제약 최적화 — 판매 전환율 데이터가 없으므로 "팔리는 힘"은 제약으로 둔다.
 *   목적: 1인당 회사 월 이익 최대
 *   제약: ① MAX 까지 줘도 건당 손해 없음 (MAX 하한 ≥ 1인 인건비·운영비 ÷ 생산성)
 *        ② 상담사 월급 ≥ salary_min (기본: 지금 조건 기준 월급)
 *        ③ 경쟁사 벤치마크 중 competitor_max_share 이상에서 우리 MAX ≥ 경쟁사 지원금 (상담사가 재량으로 이길 수 있게)
 *        ④ 경쟁사 벤치마크 중 가이드 ≥ 경쟁사 지원금 × competitor_guide_ratio 인 비율 ≥ competitor_guide_share (기본: 지금 수준 이상)
 *        ⑤ 평균 고객 가이드 ≥ guide_avg_min (기본: 지금 평균 가이드 — 고객 혜택을 깎아 이익을 내지 않는다)
 *   탐색: MAX 마진% × MAX 금액 하한 × 가이드 마진% × 가이드 금액 하한 (배분율·재량·생산성은 정책 입력)
 */
export function optimize(dataset, input = {}) {
  const { params: p, errors } = normalizeParams(input);
  if (errors.length) return { ok: false, errors };
  let rows = dataset.rows.filter((r) => r.rebate > 0);
  if (p.filter?.supplier_id) rows = rows.filter((r) => r.supplier_id === p.filter.supplier_id);
  if (p.filter?.category) rows = rows.filter((r) => r.category === p.filter.category);
  if (!rows.length) return { ok: false, errors: ['조건에 맞는 판매중 조건이 없습니다'] };
  const rate = rateFor(p.rate_tiers, p.productivity);
  const headCost = p.base_salary + p.overhead_per_head;
  // 같은 리베이트끼리 묶어 계산량을 줄인다
  const buckets = new Map();
  for (const r of rows) buckets.set(r.rebate, (buckets.get(r.rebate) || 0) + 1);
  const B = [...buckets].map(([rebate, n]) => ({ b: base({ rebate }, p.basis), n }));
  const N = rows.length;
  const bms = (dataset.benchmarks || []).filter((x) => x.rebate);

  // 지금 상태 = 조건에 들어 있는 가이드·MAX + 지금 정산 배분율(current_rate, 기본 G1 20%)
  const currentRate = p.current_rate;
  const live = scenario(rows.map((r) => ({ ...r, weight: 1 })), { ...p, rate_tiers: [{ min: 0, rate: currentRate }] }, 'live');
  const salaryMin = input.salary_min != null && input.salary_min !== '' ? Number(input.salary_min) : Math.round(live?.per_head.salary || 0);
  const maxShare = input.competitor_max_share != null && input.competitor_max_share !== '' ? Number(input.competitor_max_share) : 0.8;
  const guideRatio = input.competitor_guide_ratio != null && input.competitor_guide_ratio !== '' ? Number(input.competitor_guide_ratio) : 0.9;
  const liveGuideShare = bms.length ? bms.filter((x) => x.live_guide != null && x.live_guide >= x.support_amount * guideRatio).length / bms.length : 0;
  const guideShare = input.competitor_guide_share != null && input.competitor_guide_share !== '' ? Number(input.competitor_guide_share) : liveGuideShare;
  const guideAvgMin = input.guide_avg_min != null && input.guide_avg_min !== '' ? Number(input.guide_avg_min) : Math.round(live?.per_sale.guide || 0);
  const minFloor = Math.ceil(headCost / p.productivity / 1000) * 1000;   // 제약 ①

  const range = (a, b, st) => { const o = []; for (let v = a; v <= b + 1e-9; v += st) o.push(Math.round(v * 1000) / 1000); return o; };
  const maxMargins = range(0, 0.25, 0.01);
  const maxFloors = range(minFloor, minFloor + 60000, 5000);
  const guideMargins = range(0.2, 0.5, 0.01);
  const guideFloors = [0, 20000, 40000, 60000, 80000, 100000];

  let best = null; const top = []; let tried = 0, feasible = 0;
  for (const mm of maxMargins) for (const mf of maxFloors) {
    // MAX 쪽 경쟁사 제약은 가이드와 무관 → 먼저 거른다
    const q0 = { ...p, max_margin: mm, max_floor: mf, guide_margin: 0.99, guide_floor: 0 };
    const maxWin = bms.length ? bms.filter((x) => guideMaxFromBase(base(x, p.basis), q0).max >= x.support_amount).length / bms.length : 1;
    if (maxWin < maxShare) { tried += guideMargins.length * guideFloors.length; continue; }
    for (const gm of guideMargins) {
      if (gm < mm) continue;
      for (const gf of guideFloors) {
        tried++;
        const q = { ...p, max_margin: mm, max_floor: mf, guide_margin: gm, guide_floor: gf };
        let pay = 0, inc = 0, reb = 0, gsum = 0, msum = 0;
        for (const { b, n } of B) {
          const { guide, max } = guideMaxFromBase(b, q);
          const paid = guide + (max - guide) * p.discretion;
          pay += paid * n; inc += (max - paid) * rate * n; reb += b * n; gsum += guide * n; msum += max * n;
        }
        const perSale = (reb - pay - inc) / N;
        const salary = p.base_salary + (inc / N) * p.productivity;
        if (salary < salaryMin || gsum / N < guideAvgMin) continue;
        if (guideShare > 0 && bms.length) {
          const gw = bms.filter((x) => guideMaxFromBase(base(x, p.basis), q).guide >= x.support_amount * guideRatio).length / bms.length;
          if (gw < guideShare) continue;
        }
        feasible++;
        const companyPerHead = perSale * p.productivity - headCost;
        const cand = { max_margin: mm, max_floor: mf, guide_margin: gm, guide_floor: gf, company_per_head: companyPerHead, salary, guide_avg: gsum / N, max_avg: msum / N, competitor_max_win: maxWin };
        if (!best || companyPerHead > best.company_per_head) best = cand;
        top.push(cand);
      }
    }
  }
  if (!best) return { ok: false, errors: ['제약을 모두 만족하는 규칙이 없습니다 — 월급 하한이나 경쟁사 비율을 낮춰 보세요'], constraints: { salary_min: salaryMin, competitor_max_share: maxShare, competitor_guide_share: guideShare, competitor_guide_ratio: guideRatio, guide_avg_min: guideAvgMin, min_max_floor: minFloor } };
  top.sort((a, b) => b.company_per_head - a.company_per_head);
  const detail = simulate(dataset, { ...input, max_margin: best.max_margin, max_floor: best.max_floor, guide_margin: best.guide_margin, guide_floor: best.guide_floor });
  return {
    ok: true, engine_version: ENGINE_VERSION,
    constraints: { salary_min: salaryMin, current_rate: currentRate, competitor_max_share: maxShare, competitor_guide_share: guideShare, competitor_guide_ratio: guideRatio, guide_avg_min: guideAvgMin, min_max_floor: minFloor, rate },
    current: live && { per_sale: live.per_sale, per_head: live.per_head, break_even: live.break_even },
    searched: { tried, feasible }, best, alternatives: top.slice(1, 6), detail,
  };
}
