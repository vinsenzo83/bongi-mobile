/**
 * rental-import/core.js
 * ------------------------------------------------------------------
 * 빌리고 월별 엑셀 → 표준 "조건(offer)" 레코드 변환의 공통 계약·헬퍼.
 *
 * 구조: 파일 → 시트별 어댑터(adapters/*.js) → offer[] + skipped[]
 *   - 조건 1개 = 렌탈사·모델·약정·의무·소유·관리·주기·할인유형 조합 1개.
 *   - 월 렌탈료·리베이트·가격구간은 조건마다 다르다(상품 단위 값 없음).
 *   - 가이드·MAX 는 엑셀에 없다 → import 가 절대 덮어쓰지 않는다(DB 쪽 책임).
 *
 * 어댑터 계약:
 *   export default {
 *     id: 'coway',                          // 어댑터 고유 id
 *     file: 'water' | 'appliance',          // 어느 파일 시트인지
 *     match: (sheetName) => boolean,        // "(9월)" 등 월 접미사가 바뀌어도 매칭
 *     parse: (rows, ctx) => ({ offers, skipped }),
 *   }
 *   rows: sheet_to_json(header:1, defval:null) 결과(0-based 배열). 엑셀 행번호 = index+1.
 *   ctx:  { sheetName, month, supplierRules }   supplierRules = 수수료율 시트 파싱 결과
 *   skipped: [{ row, reason }]  — 데이터가 있는데 offer 로 안 만든 행은 전부 사유와 함께 남긴다.
 *                                 (헤더·안내문·빈행도 포함. 검증기가 "사라진 행 0" 을 확인한다)
 * ------------------------------------------------------------------
 */

export const CARE_TYPES = ['visit', 'self', 'delivery', 'none'];
export const OFFER_TYPES = [
  'normal',      // 일반/단품/기본
  'package',     // 패키지(쿠쿠 P 등)
  'bundle',      // 결합(신규/기존 결합은 offer_tags 로 구분)
  'trade_in',    // 타사보상
  'half',        // 반값할인
  'prepay',      // 선납
  'promo',       // 기타 프로모션(렌탈료 할인·회차 면제 등, offer_label 에 원문)
  'special',     // 특가/한정/콜특가
  'field',       // 현장상품(LG헬로 "(현장)")
  'staff',       // 임직원가
  'purchase',    // 일시불/즉납 구매
];

/** 공백·개행 정리 */
export function clean(v) {
  if (v == null) return '';
  return String(v).replace(/\s+/g, ' ').trim();
}

export function hasVal(v) {
  if (v == null) return false;
  const t = String(v).replace(/[\s\u00a0\u3000]/g, '');
  return t !== '' && t !== '-';
}

/** 금액 → 원 정수. VAT 계산 잔여 소수(432520.00000000006)는 반올림. 실패 null */
export function toWon(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : null;
  const s = String(v).replace(/[,\s원]/g, '');
  const m = s.match(/^-?\d+(\.\d+)?$/) || s.match(/-?\d+(\.\d+)?/);
  return m ? Math.round(parseFloat(m[0])) : null;
}

/** "36개월"→36, "5년"→60, 72→72. 실패 null */
export function toMonths(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : null;
  const s = String(v);
  const yr = s.match(/(\d+)\s*년/);
  if (yr) return parseInt(yr[1], 10) * 12;
  const mo = s.match(/(\d+)\s*(개월|M\b|m\b)/);
  if (mo) return parseInt(mo[1], 10);
  const bare = s.match(/^\s*(\d{1,3})\s*$/);
  return bare ? parseInt(bare[1], 10) : null;
}

/** 모델코드 정규화 키: 공백 제거·대문자·괄호/언더스코어 이후 제거 */
export function modelKey(model) {
  if (!model) return null;
  let k = String(model).split(/[\n※]/)[0].trim();
  k = k.replace(/^\s*\([^)]*\)\s*/, '');
  k = k.split('(')[0].replace(/\s+/g, '').toUpperCase();  // '_' 는 코드 일부(LG헬로 ND_A0610FG)
  return k || null;
}

/** 시트명에서 월 접미사 제거: "쿠쿠(9월)" → "쿠쿠", "(2609)렌탈사별 수수료율" → "렌탈사별 수수료율" */
export function sheetBase(name) {
  return clean(name).replace(/\(\s*\d{1,2}월\s*\)/g, '').replace(/^\(\d{4}\)/, '').trim();
}

/** 반값 가격구간: 앞 N개월 = 기준요금/2, 이후 기준요금. 모요 실측 102/102 "이후 = 할인 × 2" */
export function halfPhases(monthlyFee, halfMonths, startMonth = 1) {
  if (!monthlyFee || !halfMonths) return [];
  const half = Math.round(monthlyFee / 2);
  return [{ from: startMonth, to: startMonth + halfMonths - 1, fee: half }];
}

/** 병합셀·빈칸 전방채움: rows[r][c] 가 비면 위 값 사용 (cols 만) */
export function forwardFill(rows, startRow, cols) {
  const last = {};
  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    for (const c of cols) {
      if (hasVal(row[c])) last[c] = row[c];
      else if (last[c] !== undefined) row[c] = last[c];
    }
  }
  return rows;
}

/** 헤더 행 찾기: 필수 라벨들이 모두 포함된 첫 행 index */
export function findHeaderRow(rows, labels, maxScan = 60) {
  for (let r = 0; r < Math.min(rows.length, maxScan); r++) {
    const cells = (rows[r] || []).map((v) => clean(v).replace(/\s/g, ''));
    if (labels.every((l) => cells.some((c) => c.includes(l)))) return r;
  }
  return -1;
}

/** 헤더 라벨 → 컬럼 index 맵 (공백 제거 후 includes 매칭, 먼저 나온 컬럼 우선) */
export function colMap(headerRow, spec) {
  const cells = (headerRow || []).map((v) => clean(v).replace(/\s/g, ''));
  const out = {};
  for (const [key, label] of Object.entries(spec)) {
    const labels = Array.isArray(label) ? label : [label];
    const idx = cells.findIndex((c) => labels.some((l) => c.includes(l)));
    out[key] = idx >= 0 ? idx : null;
  }
  return out;
}

/** 표준 offer 레코드 생성 + 필수값 검증. 문제가 있으면 throw 대신 _errors 에 기록 */
export function makeOffer(o) {
  const offer = {
    supplier: o.supplier,                       // 렌탈사(정산 주체) 예: 코웨이
    brand: o.brand ?? null,                     // 제조사
    category_raw: clean(o.category_raw) || null,
    product_name: clean(o.product_name) || null,
    model_code: clean(o.model_code) || null,
    model_key: o.model_key ?? modelKey(o.model_code),
    variant_code: clean(o.variant_code) || null, // 렌탈사 세부코드(쿠쿠 세부모델, 청호 상품코드·규정 등)
    contract_months: o.contract_months ?? null,
    obligation_months: o.obligation_months ?? null,
    ownership_months: o.ownership_months ?? null,
    care_type: o.care_type ?? null,
    care_label: clean(o.care_label) || null,
    cycle_months: o.cycle_months ?? null,
    offer_type: o.offer_type || 'normal',
    offer_tags: o.offer_tags || [],
    offer_label: clean(o.offer_label) || null,  // 프로모션 원문
    monthly_fee: o.monthly_fee ?? null,         // 기준(할인 종료 후) 월 렌탈료
    price_phases: o.price_phases || [],         // [{from,to,fee}] 할인 구간
    prepay_amount: o.prepay_amount ?? null,
    total_fee: o.total_fee ?? null,
    rebate: o.rebate ?? null,                   // 이 조건의 리베이트(원, VAT 포함)
    rebate_basis: o.rebate_basis ?? null,       // amount | rate_total | flat | multiple_monthly
    rebate_rate: o.rebate_rate ?? null,
    rebate_detail: o.rebate_detail || null,     // 원본 수수료 컬럼들(기본/추가/타사보상/반값 등)
    status: o.status || 'active',               // active | paused | discontinued
    notes: clean(o.notes) || null,
    source: o.source,                           // { sheet, row }  row = 엑셀 행번호(1-based)
  };
  const errors = [];
  if (!offer.supplier) errors.push('supplier');
  if (!offer.model_code && !offer.product_name) errors.push('model/product');
  if (!offer.contract_months && offer.offer_type !== 'purchase') errors.push('contract_months');
  if (offer.monthly_fee == null && offer.offer_type !== 'purchase') errors.push('monthly_fee');
  if (!offer.source?.sheet || !offer.source?.row) errors.push('source');
  if (offer.care_type && !CARE_TYPES.includes(offer.care_type)) errors.push('care_type');
  if (!OFFER_TYPES.includes(offer.offer_type)) errors.push('offer_type');
  if (errors.length) offer._errors = errors;
  return offer;
}

/** 조건 자연키 — 월이 바뀌어도 같은 조건이면 같은 키(가이드·MAX 보존의 기준) */
export function conditionKey(o) {
  return [
    o.supplier, o.model_key || o.product_name, o.variant_code || '',
    o.contract_months ?? '', o.obligation_months ?? '', o.ownership_months ?? '',
    o.care_type || '', o.cycle_months ?? '', o.offer_type, (o.offer_tags || []).slice().sort().join('+'),
    o.offer_label || '',
  ].join('|');
}

/**
 * 가전 수수료율 규칙 — "(2609)렌탈사별 수수료율" 시트 파싱 결과 형태:
 *   { rules: [{ supplier: 'LG헬로비전', subtype: '일반'|'현장'|'R'|'노트북'|..., basis: 'rate_total'|'flat'|'multiple_monthly'|'rate_lump', value: 0.16, label: '(일반상품) 총 렌탈료', row: 5 }] }
 * supplier 는 시트 표기 원문을 공백 제거해 비교한다(aliases 로 시트명 쪽 이름을 넘긴다).
 */
export function findRule(supplierRules, aliases, subtype = '일반') {
  const norm = (s) => clean(s).replace(/\s/g, '');
  const names = (Array.isArray(aliases) ? aliases : [aliases]).map(norm);
  const cand = (supplierRules?.rules || []).filter((r) => names.some((n) => norm(r.supplier).includes(n) || n.includes(norm(r.supplier))));
  return cand.find((r) => r.subtype === subtype) || cand.find((r) => r.subtype === '일반') || cand[0] || null;
}

/** 규칙 적용 리베이트(원). total_fee 없으면 monthly×contract */
export function applyRule(rule, { monthly_fee, contract_months, total_fee }) {
  if (!rule) return null;
  const total = total_fee ?? (monthly_fee && contract_months ? monthly_fee * contract_months : null);
  if (rule.basis === 'rate_total') return total != null ? Math.round(total * rule.value) : null;
  if (rule.basis === 'flat') return Math.round(rule.value);
  if (rule.basis === 'multiple_monthly') return monthly_fee != null ? Math.round(monthly_fee * rule.value) : null;
  return null;
}
