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

/**
 * 표준 카테고리 — 엑셀 제품군 표기(냉장고 / 가전 / 냉장고 / 일반냉장고 컨버터블 Fit&Max …)를 상담용 분류로 정리.
 * 순서가 우선순위다(김치냉장고가 냉장고보다 먼저).
 */
export const CATEGORIES = [
  ['fridge', '냉장고·냉동고', /얼정냉|퓨어 프레시|정수기?냉장고/],   // LG 얼음정수냉장고는 냉장고
  ['water-purifier', '정수기', /정수기|냉온정|얼음정수|직수|탱크형|워터|얼음.{0,3}(데스크|스탠드)|POU|정수 필터|휘카페|에스프레카페/],
  ['air-purifier', '공기청정기', /공기청정|청정기|에어케어|공기살균/],
  ['bidet', '비데', /비데/],
  ['softener', '연수기·샤워', /연수기|샤워/],
  ['dehumidifier', '제습기', /제습/],
  ['humidifier', '가습기', /가습/],
  ['aircon', '에어컨·냉난방기', /에어컨|냉난방|냉방기|시스템에어/],
  ['fan', '선풍기·서큘레이터', /선풍기|서큘레이터|써큘레이터|냉풍기/],
  ['kimchi-fridge', '김치냉장고', /김치/],
  ['fridge', '냉장고·냉동고', /냉장|냉동|Fit&Max|와인셀러|퓨어 프레시|쇼케이스/i],
  ['washer', '세탁기·건조기', /세탁|건조기|워시|드럼|세건|통돌이/],
  ['clothes-care', '의류관리기', /스타일러|의류관리|슈케어|에어드레서/],
  ['tv', 'TV·모니터', /TV|OLED|QNED|NANO|UHD|ULTRA|MRGB|스탠바이미|스바미|모니터/i],
  ['cleaner', '청소기', /청소기|로봇청소|HOM-BOT|로니/i],
  ['dishwasher', '식기세척기', /식기세척|식세기/],
  ['food-waste', '음식물처리기', /음식물/],
  ['kitchen', '주방가전', /밥솥|레인지|오븐|에어프라이|커피|블랜더|블렌더|그리들|조리기|인덕션|가스렌지|가스레인지|쿠킹|식물재배|씽크|식기소독|튀김기|그릴/],
  ['furniture', '매트리스·침대·가구', /매트리스|침대|프레임|소파|가구|식탁|체어|의자(?!.*안마)|헤드보드|파운데이션|베개|필로우/],
  ['massage', '안마의자·헬스케어', /안마|힐링|건강|의료|마사지|헬스|운동|홈메디|테라솔|반신욕|런닝머신|체지방|뷰티|미용|다한증|전기요/],
  ['it', 'PC·IT·카메라', /노트북|PC|워치|태블릿|게임|촬영|카메라|빔|프로젝터|플스|엑박|아이패드|갤럭시탭|프린터|피아노|악기|전자칠판|복합기|미싱/i],
  ['mobility', '전기자전거·스쿠터', /자전거|스쿠터|킥보드/],
  ['business', '업소용·제빙기', /업소용|제빙기|김밥|사업자/],
  ['facility', '보일러·환기·설비', /보일러|환기|전열교환|온수기|휴벤|휴젠뜨|양변기|난방기|도어락/],
  ['pest', '해충방제·위생', /해충|방제|방역|에어커튼|핸드\s?드라이|안전용품|향기/],
  ['pet', '반려동물', /반려|펫|애완|리터로봇/],
];
/** 셀 안 글머리표(● ■ ▶ ※ -)를 뗀다 — 쿠쿠 타사보상 시트는 '● 미니100' 처럼 적혀 있다 */
export function tidyName(name) {
  return clean(name).replace(/^[●•■□▶▷※★☆\-\s]+/, '').trim();
}

/** 상품명이 모델코드뿐인가 — 한글이 없고 코드와 같으면 사람이 읽을 이름이 아니다 */
export function isCodeName(name, code, key) {
  const n = clean(name);
  if (!n) return true;
  if (/[가-힣]/.test(n)) return false;
  if (/\s/.test(n)) return false;   // 'Skycamp R' 같은 영문 상품명은 이름으로 둔다
  return n === clean(code) || n === clean(key) || /\d/.test(n);   // 띄어쓰기 없는 영문+숫자 = 코드
}

/** 상품명 칸이 없는 시트(LG구독 TV·리빙·쿠킹·냉장고, 쿠쿠, 루헨스 …)는 브랜드 + 품목으로 이름을 만든다 */
export function composeProductName({ product_name, model_code, model_key, brand, category_raw, spec_name }) {
  if (!isCodeName(product_name, model_code, model_key)) return tidyName(product_name);
  const kind = clean(spec_name) || clean(category_raw).replace(/\s+/g, ' ');
  const b = clean(brand);
  const composed = [b && !kind.startsWith(b) ? b : null, kind].filter(Boolean).join(' ');
  return composed || clean(product_name) || clean(model_code) || null;
}

// 렌탈사마다 품목 표기가 엇갈리는 상품 — 이름으로 먼저 정한다
//   LG 하이드로타워·하이드로에센셜 = 퓨리케어 가습기 (LG구독은 제품군을 '하이드로타워', BS 는 '공기청정기'로 적는다)
const CATEGORY_OVERRIDES = [
  ['humidifier', /하이드로\s?(타워|에센셜)/],
];
export function categorize(categoryRaw, productName) {
  const hay = `${categoryRaw || ''} ${productName || ''}`;
  for (const [slug, re] of CATEGORY_OVERRIDES) if (re.test(hay)) return slug;
  for (const [slug, , re] of CATEGORIES) if (re.test(categoryRaw || '')) return slug;
  for (const [slug, , re] of CATEGORIES) if (re.test(hay)) return slug;
  return 'etc';
}
export const CATEGORY_LABEL = Object.fromEntries([...CATEGORIES.map(([slug, label]) => [slug, label]), ['etc', '기타']]);
