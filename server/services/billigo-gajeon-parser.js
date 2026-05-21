/**
 * billigo-gajeon-parser.js
 * ------------------------------------------------------------------
 * 빌리고 "가전" 엑셀(그 외 렌탈사 그룹)을 봉이 DB 구조
 * (rental_products / rental_product_options)로 정규화하는 파서.
 *
 * - 입력: 빌리고 가전 엑셀 (1 수수료율표 + 23 렌탈사 시트)
 * - 출력: { companies, products, options, stats, warnings, bySheet, keyCollisions }
 *   ※ 정수기 파서(billigo-rental-parser.js)와 동일 출력 인터페이스.
 *      import preview/commit(rental.js)은 products·options·companies 만 소비한다.
 *
 * PRD: docs/specs/billigo-rental-system.md (§4 데이터모델, §5 import 워크플로, P7·P8)
 *
 * ⭐ 자연키 (options 전체에서 유일 보장) — 정수기 파서와 동일 7-tuple:
 *   (company_name, model, months, care_service, inspection_cycle,
 *    ownership_months, variant_code)
 *   - care_service / inspection_cycle / ownership_months 의 null 은
 *     비교 시 각각 '' / -1 / -1 로 정규화한다.
 *   - variant_code: 시트별 변형 차원 — 행 누락 0 을 위한 키.
 *     같은 모델·약정·케어인데 결합형/선납형/등급/설치타입/회선유무 등으로
 *     값이 다르면 variant_code 로 구분해 모든 조합을 옵션 1행으로 만든다.
 *   - 그래도 자연키가 겹치면 finalizeVariants() 가 monthly_fee 내림차순
 *     v1/v2… 접미사를 붙여 충돌 0 을 보장한다.
 *
 * ⚠️ 가전은 수수료가 "금액 직접"이 아니라 "수수료율(%)"이 다수다.
 *   - (2605)렌탈사별 수수료율 시트에서 렌탈사별 commission 을 추출 → companies.
 *   - 옵션 rebate 는 commission_method 에 따라 산정:
 *       rate     → rebate = total_fee × rate          (commission_rate)
 *       flat     → rebate = commission_flat           (건당 고정)
 *       multiple → rebate = monthly_fee × multiple    (월렌탈료 배수)
 *   - 옵션에 commission_method 를 박제한다.
 * ------------------------------------------------------------------
 */

import xlsx from 'xlsx';

// ==================================================================
// 1. 공통 상수
// ==================================================================

/** 메타/수수료율 시트 — 상품 파싱 대상 아님 */
const COMMISSION_SHEET = '(2605)렌탈사별 수수료율';

/**
 * 봉이 rental_categories slug(38종) — 매핑은 normalizeCategory() 가 수행.
 */
const CATEGORY_SLUGS = new Set([
  'water-purifier', 'ice-purifier', 'hotcold-purifier', 'air-purifier',
  'dehumidifier', 'bidet', 'water-softener', 'shower', 'mattress',
  'bed-frame', 'induction', 'oven', 'coffee-machine', 'food-waste',
  'plant-grower', 'refrigerator', 'kimchi-fridge', 'aircon', 'washer',
  'dryer', 'tv', 'vacuum', 'robot-vacuum', 'styler', 'clothes-purifier',
  'massage-chair', 'healing-care', 'beauty-medical', 'dishwasher',
  'computer', 'monitor', 'game-console', 'projector', 'speaker',
  'pet-care', 'pest-control', 'air-freshener', 'hand-dryer',
]);

/**
 * 38 slug 에 없는 가전 품목은 행 누락 방지를 위해 가장 가까운 slug 로 흡수한다.
 * (전기자전거·런닝머신·소파 등 봉이 카테고리 미존재 품목 → 임시 흡수)
 *  - 정확히 매핑되면 그 slug, 안 되면 'misc-appliance' 임시 slug.
 */
const MISC_SLUG = 'misc-appliance';

// ==================================================================
// 2. 공통 정규화 헬퍼  (정수기 파서와 동일 시그니처)
// ==================================================================

/** 공백·개행 정리 */
function clean(v) {
  if (v == null) return '';
  return String(v).replace(/\s+/g, ' ').trim();
}

/** 셀이 의미있는 값을 가졌는지 */
function hasVal(v) {
  return v != null && String(v).trim() !== '';
}

/** 숫자 파싱 (콤마·원·텍스트 제거). Math.round 로 정수화. 실패 시 null */
function toNum(v) {
  // 빌리고 금액은 원 단위 정수 — VAT/계산 잔여 소수는 반올림 제거 (정수기 파서 동일)
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : null;
  const m = String(v).replace(/[, 원]/g, '').match(/-?\d+(\.\d+)?/);
  return m ? Math.round(parseFloat(m[0])) : null;
}

/** 텍스트에서 개월 수 추출 ("36개월"→36, "5년"→60, "72"→72) */
function extractMonths(v) {
  if (v == null) return null;
  const s = String(v);
  const yr = s.match(/(\d+)\s*년/);
  if (yr) return parseInt(yr[1], 10) * 12;
  const mo = s.match(/(\d+)\s*개?\s*월/);
  if (mo) return parseInt(mo[1], 10);
  const bare = s.match(/\b(\d{2,3})\b/);
  if (bare) return parseInt(bare[1], 10);
  return null;
}

/**
 * model_key — 모델코드에서 채널/약정/색상/옵션 suffix 제거한 정규화 코드.
 * 예: WHB-5300 / WHB-5300(자가) / CMC-A110_36 / 27LX6TPGA(R) → 채널·약정 제거.
 */
function toModelKey(model) {
  if (!model) return null;
  let k = String(model).trim();
  k = k.split(/[\n※]/)[0];               // 개행·비고 마커 제거
  k = k.replace(/^\s*\([^)]*\)\s*/, '');  // 선행 채널 prefix 제거
  k = k.replace(/\(R\)\s*$/i, '');        // KT 가전구독 (R) 구분자 제거
  k = k.split(/[(_]/)[0];                 // 괄호·언더스코어 뒷부분 제거
  k = k.replace(/\s+/g, '').toUpperCase();
  return k || null;
}

/**
 * 점검주기 1컬럼 → { care_service, inspection_cycle } (PRD §4.5)
 *  - care_service: '방문' | '셀프' | null
 *  - inspection_cycle: 텍스트에서 추출한 개월 수, 미검출 null
 * @param {boolean} numericVisitMode  숫자(>0=방문, 0=셀프)인 시트
 */
function splitInspection(raw, numericVisitMode = false) {
  const s = clean(raw);
  if (!s) return { care_service: null, inspection_cycle: null };

  if (numericVisitMode) {
    const n = extractMonths(s) ?? toNum(s);
    if (n != null) {
      return {
        care_service: n > 0 ? '방문' : '셀프',
        inspection_cycle: n > 0 ? n : null,
      };
    }
  }

  const SELF = /(자가|셀프|필터\s*발송|필터\s*배송|필터\s*증정|필터\s*교체|택배|배송|서비스\s*프리|서비스프리|없음|해당없음|미포함|모종발송)/;
  const VISIT = /(방문|관리|케어|방문형|회\s*서비스|서비스|점검|포함)/;

  let cycle = extractMonths(s);
  if (cycle == null) {
    const mUnit = s.match(/(\d+)\s*M\b/i);
    if (mUnit) cycle = parseInt(mUnit[1], 10);
  }

  let care = null;
  if (SELF.test(s)) care = '셀프';
  else if (VISIT.test(s)) care = '방문';
  else if (cycle != null && cycle > 0) care = '방문';

  return { care_service: care, inspection_cycle: cycle };
}

/**
 * 임의 텍스트에서 care_service 키워드를 찾는다.
 *  - 셀프: "셀프형" "셀프" "자가" "미포함"
 *  - 방문: "관리형" "방문형" "관리" "방문" "케어" "포함"
 */
function careFromText(...texts) {
  const s = texts.map((t) => clean(t)).join(' ');
  if (!s) return null;
  if (/셀프형|셀프|자가|미포함/.test(s)) return '셀프';
  if (/관리형|방문형|관리|방문|케어|포함/.test(s)) return '방문';
  return null;
}

/**
 * 제품군 텍스트 → 봉이 카테고리 slug. 매핑 실패 시 null.
 */
function normalizeCategory(raw) {
  if (!raw) return null;
  let s = String(raw).replace(/\s+/g, '').replace(/[≫>·/\-+]/g, ' ').trim();
  const parts = s.split(/\s+/).filter(Boolean);
  const detail = parts.length > 1 ? parts[parts.length - 1] : parts[0] || '';
  const full = parts.join('');
  const test = (re) => re.test(detail) || re.test(full);

  // --- 정수기 계열 ---
  if (test(/얼음.*정수|얼음정수기|얼음(데스크|스탠드)/)) return 'ice-purifier';
  if (test(/제빙기/)) return 'ice-purifier';
  if (test(/냉온.*정수|냉온정수기|냉정수기|냉.?정수/)) return 'hotcold-purifier';
  if (test(/정수기|정수/)) return 'water-purifier';

  // --- 공기 ---
  if (test(/제습기/)) return 'dehumidifier';
  if (test(/공기청정|청정기|공청|공기살균|살균기|에어커튼|향기/)) return 'air-purifier';

  // --- 생활위생 ---
  if (test(/비데|양변기/)) return 'bidet';
  if (test(/연수기/)) return 'water-softener';
  if (test(/샤워|클린샤워/)) return 'shower';
  if (test(/핸드드라이어|바디드라이|손건조/)) return 'hand-dryer';

  // --- 침구 ---
  if (test(/매트리스/)) return 'mattress';
  if (test(/프레임|침대|소파/)) return 'bed-frame';

  // --- 주방 ---
  if (test(/전기레인지|인덕션|레인지|쿡탑|하이라이트/)) return 'induction';
  if (test(/식기세척|식세기/)) return 'dishwasher';
  if (test(/오븐|에어프라이|광파/)) return 'oven';
  if (test(/커피머신|커피|에스프레소|텀블러세척/)) return 'coffee-machine';
  if (test(/음식물|음처기|음식물처리/)) return 'food-waste';
  if (test(/식물재배|식물/)) return 'plant-grower';
  if (test(/전기밥솥|밥솥|발효기|블렌더|믹서|블랜더|라면조리/)) return 'oven';

  // --- 대형가전 ---
  if (test(/김치냉장고|김치톡톡|김치냉/)) return 'kimchi-fridge';
  if (test(/와인냉장고|와인셀러|쇼케이스|냉동고|숙성고|냉장고/)) return 'refrigerator';
  if (test(/냉난방기|냉방기|에어컨/)) return 'aircon';
  if (test(/세탁기/)) return 'washer';
  if (test(/건조기/)) return 'dryer';
  if (test(/워시콤보|워시타워|콤보/)) return 'washer';
  if (test(/^tv$|티비|TV$|스탠바이미|영상가전|led.?tv|uhd.?tv|qled|oled/i)) return 'tv';

  // --- 생활가전 ---
  if (test(/로봇청소|로봇/)) return 'robot-vacuum';
  if (test(/무선청소|청소기/)) return 'vacuum';
  if (test(/스타일러|의류관리/)) return 'styler';
  if (test(/의류청정/)) return 'clothes-purifier';

  // --- 헬스/뷰티 ---
  if (test(/안마의자|안마/)) return 'massage-chair';
  if (test(/힐링케어|힐링|베개|필로우|건강기기|운동기기|헬스기구|런닝머신|러닝머신/)) return 'healing-care';
  if (test(/의료기기|미용기기|뷰티디바이스|이미용|미용|의료|홈메디|드라이기|드라이어|에어랩/)) return 'beauty-medical';

  // --- 디지털 ---
  if (test(/노트북|데스크탑|컴퓨터|^pc$/i)) return 'computer';
  if (test(/모니터/)) return 'monitor';
  if (test(/게임기|스위치|콘솔/)) return 'game-console';
  if (test(/빔프로젝터|프로젝터/)) return 'projector';
  if (test(/스피커|사운드바|디지털피아노|전자악기|피아노/)) return 'speaker';

  // --- 기타 ---
  if (test(/펫케어|펫드라이|펫급수|펫유모차|반려|펫/)) return 'pet-care';
  if (test(/포충|해충방제|해충|포충등/)) return 'pest-control';
  if (test(/방향기|버블클렌저|클렌저|디퓨저/)) return 'air-freshener';

  // --- 가습/환기 등 보조 가전 → 가장 가까운 slug ---
  if (test(/가습기/)) return 'air-purifier';
  if (test(/복합환풍기|환풍기|전열교환기|후드/)) return 'air-purifier';
  if (test(/선풍기|난방기/)) return 'aircon';

  return null;
}

/**
 * 카테고리 해석 — 제품군 컬럼이 판매형태로 적혀 매핑 실패할 때
 * 모델명·상품명 텍스트로 fallback 추론. 모두 실패 시 null.
 */
function resolveCategory(productGroup, ...fallbackTexts) {
  const primary = normalizeCategory(productGroup);
  if (primary) return primary;
  for (const t of fallbackTexts) {
    const slug = normalizeCategory(t);
    if (slug) return slug;
  }
  return null;
}

/** forward-fill: 병합셀로 빈 칸을 직전 값으로 채운다 */
function makeFiller() {
  const last = {};
  return (key, val) => {
    if (hasVal(val)) { last[key] = val; return val; }
    return last[key];
  };
}

/**
 * 자연키 문자열 생성 — null 정규화 포함. (정수기 파서와 동일)
 */
function naturalKey(o, withVariant) {
  const care = o.care_service ?? '';
  const insp = o.inspection_cycle == null ? -1 : o.inspection_cycle;
  const own = o.ownership_months == null ? -1 : o.ownership_months;
  const base = [o.company_name, o.model, o.months, care, insp, own];
  if (withVariant) base.push(o.variant_code ?? '');
  return base.join('|');
}

// ==================================================================
// 3. 수수료율 시트 파서
// ==================================================================

/**
 * (2605)렌탈사별 수수료율 시트 → 렌탈사별 commission 정책.
 * 헤더 r2(렌탈사·수수료율·특이사항), 데이터 r3~.
 *  - 렌탈사 셀은 병합 → forward-fill. 여러 행(이원화)은 첫 행 정책 채택.
 *  - "수수료율" 컬럼 텍스트로 method/basis 판정:
 *      "총 렌탈료" + 율(0~1)       → rate, basis=total
 *      "월 렌탈료" + 배수(>1)      → multiple, basis=monthly
 *      "건 당" + 정액              → flat
 *      "구좌 당" + 정액            → account
 *      "일시불가" + 율             → rate, basis=total
 *
 * @returns {Map<string,object>}  렌탈사명 → commission 정보
 */
function parseCommissionSheet(aoa, warnings) {
  const byName = new Map();
  const fill = makeFiller();
  let curName = null;

  for (let r = 3; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const rawName = clean(row[0]);
    const basisText = clean(row[1]);   // "총 렌탈료" "월 렌탈료" "건 당" "구좌 당" "일시불가" …
    const val = row[2];                 // 0.13 / 150000 / 6 …
    const notes = clean(row[3]);

    if (rawName) curName = rawName;
    if (!curName) continue;
    if (!basisText && val == null) continue;

    // 렌탈사명 정규화 — "LG 헬로비젼" / "현대유버스(가전)" 등 괄호 제거
    const name = curName;

    let method = 'rate';
    let basis = 'total';
    let rate = null, flat = null, multiple = null;

    const numVal = typeof val === 'number'
      ? val
      : (toNum(val) != null ? toNum(val) : null);

    if (/건\s*당/.test(basisText)) {
      method = 'flat';
      flat = numVal;
    } else if (/구좌\s*당/.test(basisText)) {
      method = 'account';
      flat = numVal;
    } else if (/월\s*렌탈료/.test(basisText)) {
      // 월 렌탈료 기준 — 값이 1 초과면 배수(세스코 6·CCTV 5), 1 이하면 율
      basis = 'monthly';
      if (numVal != null && numVal > 1) {
        method = 'multiple';
        multiple = numVal;
      } else {
        method = 'rate';
        rate = numVal;
      }
    } else if (/총\s*렌탈료|일시불가/.test(basisText)) {
      method = 'rate';
      basis = 'total';
      rate = numVal;
    } else if (numVal != null && numVal <= 1) {
      method = 'rate';
      rate = numVal;
    } else if (numVal != null) {
      method = 'flat';
      flat = numVal;
    } else {
      // "최저 40만원 + @ (별도견적)" 같은 텍스트 정액 — flat 0 + notes
      method = 'flat';
      flat = null;
      warnings.notes.push(`수수료율: ${name} "${basisText}" 값 해석불가(${clean(val)})`);
    }

    // 정산기준 추출
    let settle = '설치완료';
    if (/출금일/.test(notes)) settle = '출금일';
    else if (/DB\s*접수|접수\s*기준/i.test(notes)) settle = 'DB접수';

    // 첫 행 정책만 채택. 이미 있으면 이원화 → has_dual_pricing 표시.
    if (byName.has(name)) {
      const ex = byName.get(name);
      ex.has_dual_pricing = true;
      if (notes && !ex.notes) ex.notes = notes;
      continue;
    }
    byName.set(name, {
      name,
      category_group: '가전렌탈사',
      commission_method: method,
      commission_rate: rate,
      commission_flat: flat,
      commission_multiple: multiple,
      rental_fee_basis: basis,
      has_dual_pricing: false,
      settle_basis: settle,
      notes: notes || null,
    });
  }
  return byName;
}

/**
 * 시트명(렌탈사) → 수수료율 시트의 렌탈사 키 매핑.
 * 시트명과 수수료율 시트 명칭이 다를 수 있어 별칭 테이블로 연결.
 */
const COMPANY_ALIAS = {
  '캐리어': '캐리어',
  '스마트': '스마트',
  'LG헬로': 'LG 헬로비젼',
  '유버스': '현대유버스(가전)',
  'BS': 'BS',
  'KT회선O': 'KT가전구독',
  'KT회선X': 'KT가전구독',
  'KT구독형(R)': 'KT가전구독',
  'KT구독케어형(R)': 'KT가전구독',
  'LG구독냉장고': 'LG전자구독',
  'LG구독쿠킹': 'LG전자구독',
  'LG구독TV': 'LG전자구독',
  'LG구독공청기': 'LG전자구독',
  'LG구독에어컨': 'LG전자구독',
  'LG구독리빙': 'LG전자구독',
  '세스코': '세스코',
  '렌플': '렌플',
  '렌타나': '렌타나',
  '이니렌탈삼성': '이니',
  '이니렌탈LG': '이니',
  '이니렌탈기타': '이니',
  '이니렌탈위닉스': '이니',
  '위덱': '위덱',
};

// ==================================================================
// 4. 시트별 어댑터
// ==================================================================
//  각 어댑터: (aoa, ctx) => { products, options, skipped, skipReason }
//  ctx = { sheetName, company, commission, warnings }
//  company       — 봉이 rental_companies.name 으로 쓸 렌탈사명
//  commission    — 해당 렌탈사 commission 정보 (parseCommissionSheet 결과)

/** 표준 product/option 누적기. (정수기 파서 makeCollector 와 동일 구조) */
function makeCollector(ctx) {
  const products = new Map();   // model → product
  const options = [];
  const company = ctx.company;
  const cm = ctx.commission?.commission_method || 'rate';

  function addProduct({ model, name, category_slug, manufacturer, billigo_status }) {
    const key = model;
    if (!products.has(key)) {
      products.set(key, {
        company_name: company,
        brand: company,
        manufacturer: manufacturer ?? null,
        category_slug: category_slug ?? null,
        name: name || model,
        model,
        model_key: toModelKey(model),
        billigo_status: billigo_status || '동일',
      });
    } else {
      const p = products.get(key);
      if (!p.category_slug && category_slug) p.category_slug = category_slug;
      if ((!p.name || p.name === p.model) && name) p.name = name;
      if (!p.manufacturer && manufacturer) p.manufacturer = manufacturer;
    }
    return products.get(key);
  }

  function addOption(opt) {
    options.push({
      company_name: company,
      commission_method: cm,
      promo_type: null,
      half_fee: null,
      half_period: null,
      ownership_months: null,
      normal_price: null,
      rebate: null,
      rebate_otherco: null,
      rebate_half: null,
      total_fee: null,
      variant_code: '',
      variant_label: '',
      ...opt,
    });
  }

  return {
    addProduct,
    addOption,
    result: () => ({ products: [...products.values()], options }),
  };
}

/**
 * 렌탈사 commission 으로 옵션의 rebate(봉이 수수료) 산정.
 *  - rate     : total_fee(없으면 monthly×months) × rate
 *  - multiple : monthly_fee × multiple
 *  - flat/account : commission_flat
 */
function computeRebate(commission, monthlyFee, totalFee, months) {
  if (!commission) return null;
  const m = commission.commission_method;
  if (m === 'rate') {
    const base = commission.rental_fee_basis === 'monthly'
      ? monthlyFee
      : (totalFee != null ? totalFee
          : (monthlyFee != null && months ? monthlyFee * months : null));
    if (base == null || commission.commission_rate == null) return null;
    return Math.round(base * commission.commission_rate);
  }
  if (m === 'multiple') {
    if (monthlyFee == null || commission.commission_multiple == null) return null;
    return Math.round(monthlyFee * commission.commission_multiple);
  }
  if (m === 'flat' || m === 'account') {
    return commission.commission_flat ?? null;
  }
  return null;
}

/**
 * 캐리어 — 헤더 r1. 약정이 행(merged cell — 모델명 null 행은 직전 상속).
 * cols: 0품목 1모델구분 2등급 3사용면적 4모델명 5케어 6계약기간(개월) 7월렌탈료 8기본설치비 9비고
 * 시트 중간 ■섹션·반복헤더·노트행 존재 → 모델명 forward-fill + 데이터 판정.
 * variant_code: 등급(인버터/스탠다드/대형) — 같은 면적 다른 등급 구분.
 */
function adaptCarrier(aoa, ctx) {
  const col = makeCollector(ctx);
  const fill = makeFiller();
  let skipped = 0;

  for (let r = 2; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const c0 = clean(row[0]);
    // ■섹션 헤더 / 반복 헤더 / 노트행 스킵
    if (c0 === '품목' || c0.startsWith('■') || c0.startsWith('※')) { skipped++; continue; }
    const months = toNum(row[6]);
    const fee = toNum(row[7]);
    if (months == null || fee == null) { skipped++; continue; }

    const pg     = fill('pg', row[0]);
    const mgubun = fill('mgubun', row[1]);
    const grade  = fill('grade', row[2]);
    const area   = fill('area', row[3]);
    const model  = fill('model', row[4]);
    const care   = fill('care', row[5]);
    if (!hasVal(model)) { skipped++; continue; }

    const slug = resolveCategory(pg, mgubun, model) || MISC_SLUG;
    const name = [clean(pg), clean(mgubun), clean(grade), clean(area)]
      .filter((x) => x && x !== '-').join(' ') || clean(model);
    col.addProduct({ model: clean(model), name, category_slug: slug, manufacturer: '캐리어' });

    const insp = splitInspection(care);
    // 등급 + 면적 → variant (같은 모델은 보통 1개지만 안전하게 등급 박제)
    const variantParts = [clean(grade), clean(area)].filter((x) => x && x !== '-');
    const variant = variantParts.join('/');
    col.addOption({
      model: clean(model),
      months,
      ownership_months: months,
      care_service: insp.care_service ?? careFromText(care) ?? '셀프',
      inspection_cycle: insp.inspection_cycle,
      monthly_fee: fee,
      total_fee: fee * months,
      rebate: computeRebate(ctx.commission, fee, fee * months, months),
      promo_type: null,
      variant_code: variant,
      variant_label: variant || '기본',
    });
  }
  return { ...col.result(), skipped, skipReason: '■섹션·반복헤더·노트·빈행' };
}

/**
 * 스마트 — 헤더 r4(서브헤더 r5). 약정이 컬럼(가로 피벗 24/36/48/60).
 * cols: 0NO 1구분 2제조사 3품목 4상태 5A/S 6고객프로모션 8상품명 9모델명
 *       10월(24) 11총(24) 12월(36) 13총(36) 14월(48) 15총(48) 16월(60) 17총(60)
 *       18비고 19CMS 20노출 21적용일
 * 약정 컬럼쌍 → 월렌탈료 0/null 인 약정은 옵션 생성 안 함.
 */
function adaptSmart(aoa, ctx) {
  const HEADER = 4;
  const col = makeCollector(ctx);
  const fill = makeFiller();
  let skipped = 0;
  const TERMS = [
    { months: 24, mCol: 10, tCol: 11 },
    { months: 36, mCol: 12, tCol: 13 },
    { months: 48, mCol: 14, tCol: 15 },
    { months: 60, mCol: 16, tCol: 17 },
  ];

  for (let r = HEADER + 2; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const model = fill('model', row[9]);
    const name  = fill('name', row[8]);
    if (!hasVal(model)) { skipped++; continue; }
    const pg     = clean(row[3]);
    const maker  = clean(row[2]);
    const promo  = [clean(row[6]), clean(row[7])].filter(Boolean).join(' ') || null;

    const slug = resolveCategory(pg, name, model) || MISC_SLUG;
    let hadOption = false;
    col.addProduct({
      model: clean(model), name: clean(name) || clean(model),
      category_slug: slug, manufacturer: maker || null,
    });

    for (const t of TERMS) {
      const mFee = toNum(row[t.mCol]);
      const tFee = toNum(row[t.tCol]);
      if (mFee == null || mFee <= 0) continue;   // 해당 약정 미운영
      hadOption = true;
      col.addOption({
        model: clean(model),
        months: t.months,
        ownership_months: t.months,
        care_service: '셀프',
        inspection_cycle: null,
        monthly_fee: mFee,
        total_fee: tFee ?? mFee * t.months,
        rebate: computeRebate(ctx.commission, mFee, tFee ?? mFee * t.months, t.months),
        promo_type: promo,
        variant_code: '',
        variant_label: '',
      });
    }
    if (!hadOption) skipped++;
  }
  return { ...col.result(), skipped, skipReason: '모델명없음·전약정0' };
}

/**
 * LG헬로 — 헤더 3행(r0~r2). 약정 24/36/39/48/60 컬럼쌍(일반가/총액).
 * cols: 0EQPID 2구분 3상세 4무료개월 8품목종류 9브랜드 11모델코드 12모델명
 *       13규격 14색상 16~25 약정쌍(일반가,총액) 26일시불가 27수수료정책 …
 * 약정쌍: 24=(17,18) 36=(19,20) 39=(21,22) 48=(23,24) 60=(25,26)?
 *   r3 실측: idx17,18 = 24개월 (일반가,총액) … 짝수=일반가, 다음=총액.
 * variant_code: 구분(신규/단종/프로모션 등)은 변형 아님 → ''.
 *   같은 모델코드 다채널(일반/특가/직영/현장)은 모델명 prefix 로 행 분리되어
 *   model 식별이 다르므로 별도 product. 변형 충돌은 finalizeVariants 처리.
 */
function adaptLgHello(aoa, ctx) {
  const HEADER = 2;
  const col = makeCollector(ctx);
  const fill = makeFiller();
  let skipped = 0;
  // 약정 컬럼쌍 (월일반가, 총액) — 실측(2026-05-20):
  //   r2 헤더 "24개월"=col16 "36개월"=col18 "39개월"=col20 "48개월"=col22 "60개월"=col24
  //   각 약정 = (월렌탈료=base, 총액=base+1). col26 은 일시불가(별도).
  const TERMS = [
    { months: 24, mCol: 16, tCol: 17 },
    { months: 36, mCol: 18, tCol: 19 },
    { months: 39, mCol: 20, tCol: 21 },
    { months: 48, mCol: 22, tCol: 23 },
    { months: 60, mCol: 24, tCol: 25 },
  ];

  for (let r = HEADER + 1; r < aoa.length; r++) {
    const row = aoa[r] || [];
    // 모델코드/모델명 forward-fill (병합 EQPID 행 구조)
    const code   = fill('code', row[11]);
    const modelN = fill('modelN', row[12]);
    // model 식별자 = 모델명(채널 prefix 포함, 다채널 행 분리)
    const model = clean(modelN) || clean(code);
    if (!hasVal(model)) { skipped++; continue; }
    const pg    = clean(row[8]);
    const brand = clean(row[9]);
    const freeM = row[4];          // 무료개월
    const promo = clean(row[38]) || null;

    const slug = resolveCategory(pg, modelN, code) || MISC_SLUG;
    let hadOption = false;
    col.addProduct({
      model, name: clean(modelN) || model,
      category_slug: slug, manufacturer: brand || null,
    });

    // 무료개월 = 케어 무관, inspection 아님 → care_service 셀프 기본
    for (const t of TERMS) {
      const mFee = toNum(row[t.mCol]);
      const tFee = toNum(row[t.tCol]);
      if (mFee == null || mFee <= 0) continue;
      hadOption = true;
      col.addOption({
        model,
        months: t.months,
        ownership_months: t.months,
        care_service: '셀프',
        inspection_cycle: null,
        monthly_fee: mFee,
        total_fee: tFee ?? mFee * t.months,
        rebate: computeRebate(ctx.commission, mFee, tFee ?? mFee * t.months, t.months),
        promo_type: promo,
        variant_code: hasVal(freeM) ? `무료${toNum(freeM)}개월` : '',
        variant_label: hasVal(freeM) ? `무료개월 ${toNum(freeM)}` : '',
      });
    }
    if (!hadOption) skipped++;
  }
  return { ...col.result(), skipped, skipReason: '모델없음·전약정0' };
}

/**
 * 유버스 — 헤더 r2. 약정이 행(렌탈기간 컬럼 = 세로).
 * cols: 1적용일자 2안내사항 3제조사 4품목 5규정명 6모델명 7렌탈기간 8렌탈료
 *       9도서산간 10제주도 11AS기간 12특이사항 …
 * 규정명에 약정·구성이 인코딩 → variant. 모델명은 색상/약정 공유 가능.
 */
function adaptUbus(aoa, ctx) {
  const HEADER = 2;
  const col = makeCollector(ctx);
  let skipped = 0;

  for (let r = HEADER + 1; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const months = toNum(row[7]);
    const fee = toNum(row[8]);
    const maker = clean(row[3]);
    const pg    = clean(row[4]);
    const ruleName = clean(row[5]);   // 규정명 — 약정·구성 인코딩 (모델명 없을 때 식별자)
    // 모델명(idx6) 비어있어도 규정명이 있으면 규정명을 model 식별자로 사용
    // (헨지디자인 소파·침대세트 등 406행 — 행 누락 0 보장)
    const model = clean(row[6]) || ruleName;
    if (!hasVal(model) || months == null || fee == null || fee <= 0) { skipped++; continue; }

    const slug = resolveCategory(pg, ruleName, model) || MISC_SLUG;
    col.addProduct({
      model, name: ruleName || model,
      category_slug: slug, manufacturer: maker || null,
    });

    col.addOption({
      model,
      months,
      ownership_months: months,
      care_service: careFromText(ruleName) ?? '셀프',
      inspection_cycle: null,
      monthly_fee: fee,
      total_fee: fee * months,
      rebate: computeRebate(ctx.commission, fee, fee * months, months),
      promo_type: null,
      variant_code: '',          // finalizeVariants 가 잔여 충돌 처리
      variant_label: '',
    });
  }
  return { ...col.result(), skipped, skipReason: '모델없음·렌탈료0' };
}

/**
 * BS — 헤더 r3. 약정이 행(기간 컬럼 = 세로).
 * cols: 0일자 1구분 2판매채널 3운영여부 4브랜드 5모델명 6모델코드
 *       7상품명/모델명(전산) 8월렌탈료 9기간 10총렌탈료 11as 12사은품 13비고
 * model 식별 = 모델코드(색상별 별도). 운영여부 "판매중" 외는 단종 마킹.
 */
function adaptBS(aoa, ctx) {
  const HEADER = 3;
  const col = makeCollector(ctx);
  let skipped = 0;

  for (let r = HEADER + 1; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const months = toNum(row[9]);
    const fee = toNum(row[8]);
    if (months == null || fee == null || fee <= 0) { skipped++; continue; }
    const brand   = clean(row[4]);
    const modelN  = clean(row[5]);
    const code    = clean(row[6]);
    const prodNm  = clean(row[7]);
    const gubun   = clean(row[1]);          // 세탁기+건조기 등 = 품목
    const channel = clean(row[2]);
    const oper    = clean(row[3]);
    // model 식별자 — 모델명(색상 공유) + 채널 구분 위해 코드는 variant 로
    const model = modelN || code || prodNm;
    if (!hasVal(model)) { skipped++; continue; }

    const slug = resolveCategory(gubun, prodNm, modelN) || MISC_SLUG;
    const status = /판매중/.test(oper) ? '동일' : '단종';
    col.addProduct({
      model, name: prodNm || modelN,
      category_slug: slug, manufacturer: brand || null,
      billigo_status: status,
    });

    const total = toNum(row[10]) ?? fee * months;
    col.addOption({
      model,
      months,
      ownership_months: months,
      care_service: '셀프',
      inspection_cycle: null,
      monthly_fee: fee,
      total_fee: total,
      rebate: computeRebate(ctx.commission, fee, total, months),
      promo_type: channel || null,
      variant_code: channel && channel !== '전체판매' ? channel : '',
      variant_label: channel || '',
    });
  }
  return { ...col.result(), skipped, skipReason: '약정·렌탈료없음·빈행' };
}

/**
 * KT회선O / KT회선X — 헤더 3행. 가로 피벗(즉납/36/48/60).
 * 회선O cols: 0상품명 1비고 2설치비 3모델코드 4즉납 5총(36) 6월(36) 7총(48) 8월(48) 9총(60) 10월(60)
 * 회선X cols: A열 한 칸 밀림 — 1상품명 2비고 3설치비 4모델코드 5즉납 6총(36) 7월(36) 8총(48) 9월(48) 10총(60) 11월(60)
 * 즉납 = 일시불(months=0). variant_code: 회선O/회선X.
 *
 * @param {number} off  컬럼 오프셋 (회선O=0, 회선X=1)
 * @param {string} lineVariant  '회선보유' | '회선미보유'
 */
function adaptKtLine(aoa, ctx, off, lineVariant) {
  const HEADER = 2;
  const col = makeCollector(ctx);
  let skipped = 0;
  const TERMS = [
    { months: 36, tCol: 5 + off, mCol: 6 + off },
    { months: 48, tCol: 7 + off, mCol: 8 + off },
    { months: 60, tCol: 9 + off, mCol: 10 + off },
  ];

  for (let r = HEADER + 1; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const name = clean(row[0 + off]);
    const code = clean(row[3 + off]);
    const model = code || name;
    if (!hasVal(model) || !hasVal(name)) { skipped++; continue; }
    const memo = clean(row[1 + off]);
    const lumpSum = toNum(row[4 + off]);   // 즉납가

    const slug = resolveCategory(null, name, code) || MISC_SLUG;
    let hadOption = false;
    col.addProduct({
      model, name, category_slug: slug, manufacturer: null,
    });

    // 즉납(일시불) 옵션
    if (lumpSum != null && lumpSum > 0) {
      hadOption = true;
      col.addOption({
        model, months: 0, ownership_months: 0,
        care_service: '셀프', inspection_cycle: null,
        monthly_fee: lumpSum, total_fee: lumpSum,
        rebate: computeRebate(ctx.commission, lumpSum, lumpSum, 0),
        promo_type: memo || null,
        variant_code: `${lineVariant}/즉납`,
        variant_label: `${lineVariant} 즉납`,
      });
    }
    // 할부 약정 옵션
    for (const t of TERMS) {
      const total = toNum(row[t.tCol]);
      const monthly = toNum(row[t.mCol]);
      if (monthly == null || monthly <= 0) continue;
      hadOption = true;
      col.addOption({
        model, months: t.months, ownership_months: t.months,
        care_service: '셀프', inspection_cycle: null,
        monthly_fee: monthly, total_fee: total ?? monthly * t.months,
        rebate: computeRebate(ctx.commission, monthly, total ?? monthly * t.months, t.months),
        promo_type: memo || null,
        variant_code: lineVariant,
        variant_label: lineVariant,
      });
    }
    if (!hadOption) skipped++;
  }
  return { ...col.result(), skipped, skipReason: '모델/상품명없음·전약정0' };
}

/**
 * KT구독형(R) / KT구독케어형(R) — 메타 多, 카테고리 구분행 존재.
 * 헤더 r5(서브 r6). 데이터 r7~. 약정이 컬럼(즉납/할부 24·36·48·60),
 * 셀이 "할부금총액\r\n(월할부금)" 멀티라인 → 총액/월 분리 파싱.
 * 구독형 cols: 1제조사 2모델명 3모델코드 4모델코드(R) 5출고가 …
 *   11즉납 12할부24 13할부36 14할부48 15할부60
 * 케어형 cols: 1제조사 2모델명 3모델코드(R) 4정책 5비고 … 8즉납 9할부36 10할부60
 * 카테고리 구분행: 제조사 컬럼에 공백+"TV, 영상가전" 같은 텍스트만, 모델 없음.
 *
 * @param {object} layout  { codeCol, lumpCol, terms:[{months,col}], careForm }
 */
function adaptKtSubscription(aoa, ctx, layout) {
  const HEADER = 5;
  const col = makeCollector(ctx);
  let skipped = 0;
  let curCategory = null;

  // "할부금총액\r\n(월할부금)" → { total, monthly }
  function splitInstallment(raw) {
    if (raw == null) return { total: null, monthly: null };
    if (typeof raw === 'number') return { total: Math.round(raw), monthly: null };
    const s = String(raw);
    if (/미운영/.test(s)) return { total: null, monthly: null };
    const lines = s.split(/[\r\n]+/).map((x) => x.trim()).filter(Boolean);
    const total = toNum(lines[0]);
    let monthly = null;
    if (lines[1]) {
      const m = lines[1].match(/\(?\s*([\d,]+)\s*\)?/);
      if (m) monthly = toNum(m[1]);
    }
    return { total, monthly };
  }

  for (let r = HEADER + 2; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const maker = clean(row[1]);
    const modelN = clean(row[2]);
    const codeR = clean(row[layout.codeCol]);
    // 카테고리 구분행: 제조사 칸에만 텍스트, 모델명/코드 비어있음
    if (maker && !modelN && !codeR) { curCategory = maker; skipped++; continue; }
    // 케어서비스 소개 안내행 등
    if (!codeR && !modelN) { skipped++; continue; }

    const model = codeR || modelN;
    if (!hasVal(model)) { skipped++; continue; }
    const memo = clean(row[layout.memoCol]) || null;

    const slug = resolveCategory(curCategory, modelN, model) || MISC_SLUG;
    let hadOption = false;
    col.addProduct({
      model, name: modelN || model,
      category_slug: slug, manufacturer: maker || null,
    });

    // 즉납(일시불) 옵션
    const lump = toNum(row[layout.lumpCol]);
    if (lump != null && lump > 0) {
      hadOption = true;
      col.addOption({
        model, months: 0, ownership_months: 0,
        care_service: layout.careForm === 'care' ? '방문' : '셀프',
        inspection_cycle: null,
        monthly_fee: lump, total_fee: lump,
        rebate: computeRebate(ctx.commission, lump, lump, 0),
        promo_type: memo,
        variant_code: '즉납',
        variant_label: '즉납(일시불)',
      });
    }
    // 할부 약정 옵션
    for (const t of layout.terms) {
      const { total, monthly } = splitInstallment(row[t.col]);
      const mFee = monthly ?? (total != null && t.months ? Math.round(total / t.months) : null);
      if (mFee == null || mFee <= 0) continue;
      hadOption = true;
      col.addOption({
        model, months: t.months, ownership_months: t.months,
        care_service: layout.careForm === 'care' ? '방문' : '셀프',
        inspection_cycle: null,
        monthly_fee: mFee,
        total_fee: total ?? mFee * t.months,
        rebate: computeRebate(ctx.commission, mFee, total ?? mFee * t.months, t.months),
        promo_type: memo,
        variant_code: '할부',
        variant_label: '할부',
      });
    }
    if (!hadOption) skipped++;
  }
  return { ...col.result(), skipped, skipReason: '카테고리구분행·안내행·전약정미운영' };
}

/**
 * LG구독 6시트 공통 어댑터 — 다단 헤더(r0~r3), 약정 컬럼(36/48/60/72) +
 * 결합유형(구독료/신규결합/기존결합) + 선납(30%/50%) 변형.
 * 시트마다 컬럼 위치가 달라 layout 으로 받는다.
 *
 * 헤더 행 중 "구독료/구독요금/원요금" 이 들어간 행에서 약정 블록을 동적 탐지:
 *   각 약정(36/48/60/72) 블록 = 구독료 1열 + (있으면) 신규결합/기존결합 열.
 * variant_code: 결합유형(단품/신규결합/기존결합) + 케어 서비스타입 + 방문주기.
 *   같은 모델·약정에 서비스타입(라이트/프리미엄)·방문주기로 행이 갈리므로 박제.
 *
 * @param {object} layout  { dataStart, modelCol, brandCol, pgCol, visitCol,
 *                            careTypeCol, manufacturer, channelCol? }
 */
function adaptLgSubscription(aoa, ctx, layout) {
  const col = makeCollector(ctx);
  let skipped = 0;

  // ── 약정 블록 탐지 — 헤더 다단에서 "N개월" + "구독료/구독요금/원요금" 위치 ──
  // 전략: r0~r3 중 숫자형 "36/48/60/72" 헤더가 있는 행에서 약정 시작 컬럼,
  //       그 아래 행에서 "구독료/신규결합/기존결합" 서브헤더로 결합유형 매핑.
  // 실측 구조(LG구독냉장고): r1 에 "36개월/48개월/60개월/72개월" 텍스트,
  //   r2 에 결합유형. → r1 의 약정 라벨 위치 + r2 의 combo 라벨로 컬럼 결정.
  let termHeaderRow = -1, comboHeaderRow = -1;
  for (let r = 0; r < Math.min(5, aoa.length); r++) {
    const row = aoa[r] || [];
    const hasTermLabel = row.some((c) => /^\d{2}개월$/.test(clean(c)));
    if (hasTermLabel && termHeaderRow < 0) termHeaderRow = r;
    const hasCombo = row.some((c) => /^구독료$|^구독요금$|신규결합|기존결합/.test(clean(c)));
    if (hasCombo) comboHeaderRow = r;
  }
  if (termHeaderRow < 0 || comboHeaderRow < 0) {
    ctx.warnings.notes.push(`${ctx.sheetName}: 약정/결합 헤더 탐지 실패`);
    return { products: [], options: [], skipped: aoa.length, skipReason: '헤더탐지실패' };
  }

  // 약정 라벨 위치 — 36/48/60/72 가 등장하는 컬럼 인덱스. 단,
  // "프로모션 적용 최종 월요금" 블록(중복 36/48/60/72)은 제외 — 첫 블록만 채택.
  const termRow = aoa[termHeaderRow] || [];
  const comboRow = aoa[comboHeaderRow] || [];
  const termCols = [];
  for (let c = 0; c < termRow.length; c++) {
    const m = clean(termRow[c]).match(/^(\d{2})개월$/);
    if (m) termCols.push({ months: parseInt(m[1], 10), start: c });
  }
  // 첫 4개(36/48/60/72) 블록만 — 프로모션/선납 중복 블록 제외
  termCols.sort((a, b) => a.start - b.start);
  const seenMonths = new Set();
  const blocks = [];
  for (const t of termCols) {
    if (seenMonths.has(t.months)) break;   // 중복 약정 = 두번째 블록 시작 → 중단
    seenMonths.add(t.months);
    blocks.push(t);
  }
  // 각 블록 끝 = 다음 블록 시작
  for (let i = 0; i < blocks.length; i++) {
    blocks[i].end = i + 1 < blocks.length ? blocks[i + 1].start : comboRow.length;
  }
  // 블록 내부 — combo 라벨로 (combo, feeCol) 매핑
  for (const b of blocks) {
    const combos = [];
    for (let c = b.start; c < b.end; c++) {
      const t = clean(comboRow[c]);
      if (/신규결합/.test(t)) combos.push({ combo: '신규결합', feeCol: c });
      else if (/기존결합/.test(t)) combos.push({ combo: '기존결합', feeCol: c });
      else if (/구독료|구독요금|원요금/.test(t)) combos.push({ combo: '단품', feeCol: c });
    }
    if (combos.length === 0) combos.push({ combo: '단품', feeCol: b.start });
    b.combos = combos;
  }

  const fill = makeFiller();
  for (let r = layout.dataStart; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const model = fill('model', row[layout.modelCol]);
    if (!hasVal(model)) { skipped++; continue; }
    // 적어도 한 약정에 구독료가 있어야 데이터 행
    const anyFee = blocks.some((b) => b.combos.some((cm) => toNum(row[cm.feeCol]) != null && toNum(row[cm.feeCol]) > 0));
    if (!anyFee) { skipped++; continue; }

    const pg      = layout.pgCol != null ? clean(row[layout.pgCol]) : '';
    const visit   = layout.visitCol != null ? row[layout.visitCol] : null;
    const careTyp = layout.careTypeCol != null ? clean(row[layout.careTypeCol]) : '';
    const status  = layout.statusCol != null ? clean(row[layout.statusCol]) : '';

    const slug = resolveCategory(pg, model) || normalizeCategory(ctx.sheetName) || MISC_SLUG;
    col.addProduct({
      model: clean(model), name: clean(model),
      category_slug: slug, manufacturer: layout.manufacturer,
      billigo_status: /단종/.test(status) ? '단종' : (/신규/.test(status) ? '신규' : '동일'),
    });

    // 방문주기 — 숫자(개월) 또는 "자가관리"
    const insp = splitInspection(visit, true);
    const care = insp.care_service ?? careFromText(careTyp, visit) ?? '방문';

    for (const b of blocks) {
      for (const cm of b.combos) {
        const fee = toNum(row[cm.feeCol]);
        if (fee == null || fee <= 0) continue;
        // 변형: 결합유형 + 케어서비스타입(라이트/프리미엄/베이직)
        const vParts = [cm.combo];
        if (careTyp) vParts.push(careTyp);
        const variant = vParts.join('/');
        const total = fee * b.months;
        col.addOption({
          model: clean(model),
          months: b.months,
          ownership_months: b.months,
          care_service: care,
          inspection_cycle: insp.inspection_cycle,
          monthly_fee: fee,
          total_fee: total,
          rebate: computeRebate(ctx.commission, fee, total, b.months),
          promo_type: null,
          variant_code: variant,
          variant_label: variant,
        });
      }
    }
  }
  return { ...col.result(), skipped, skipReason: '모델없음·전약정0' };
}

/**
 * 세스코 — 헤더 r9. 약정이 행(의무사용 컬럼 = 세로). 단가표 메타 r0~r8.
 * cols: 1구분 2품목 4모델명 6의무사용 8관리주기 9렌탈료[기준] 10접수코드 11렌탈료[할인]
 * 품목에 (단품)/(결합)/(타사보상)/(N대 대량) 인코딩 → variant.
 * 렌탈료[기준] 우선, 없으면 [할인] 사용. 둘 다 null → 스킵(수수료종료 미운영행).
 */
function adaptCesco(aoa, ctx) {
  const HEADER = 9;
  const col = makeCollector(ctx);
  let skipped = 0;

  for (let r = HEADER + 1; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const gubun = clean(row[1]);
    const item  = clean(row[2]);
    const model = clean(row[4]);
    const months = toNum(row[6]);
    const cycle  = row[8];
    let fee = toNum(row[9]);
    const discFee = toNum(row[11]);
    if (fee == null) fee = discFee;     // 기준가 없으면 할인가
    if (!hasVal(model) || !hasVal(item) || months == null || fee == null || fee <= 0) {
      skipped++; continue;
    }

    const slug = resolveCategory(gubun, item, model) || MISC_SLUG;
    col.addProduct({
      model, name: item, category_slug: slug, manufacturer: '세스코',
    });

    // 품목 괄호 = 판매형태 → variant. 관리주기도 변형 차원.
    const formMatch = item.match(/\(([^)]+)\)/);
    const form = formMatch ? clean(formMatch[1]) : '';
    const cyc = toNum(cycle);
    const variantParts = [form, cyc != null ? `${cyc}개월주기` : ''].filter(Boolean);
    const variant = variantParts.join('/');
    // 세스코 = 월 렌탈료 × 배수 → total 불필요하나 보관
    col.addOption({
      model,
      months,
      ownership_months: months,
      care_service: '방문',
      inspection_cycle: cyc,
      monthly_fee: fee,
      total_fee: fee * months,
      rebate: computeRebate(ctx.commission, fee, fee * months, months),
      promo_type: discFee != null && fee !== discFee ? '렌탈료할인' : null,
      variant_code: variant,
      variant_label: variant || '기본',
    });
  }
  return { ...col.result(), skipped, skipReason: '메타·렌탈료없음·미운영행' };
}

/**
 * 렌플 — 헤더 r1(B열~). 가로 피벗 단순(36/48/60).
 * cols: 1no 2브랜드 3카테고리 4상품명 5모델명 6약정36 7약정48 8약정60
 */
function adaptRenpl(aoa, ctx) {
  const HEADER = 1;
  const col = makeCollector(ctx);
  let skipped = 0;
  const TERMS = [{ months: 36, col: 6 }, { months: 48, col: 7 }, { months: 60, col: 8 }];

  for (let r = HEADER + 1; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const model = clean(row[5]);
    if (!hasVal(model)) { skipped++; continue; }
    const brand = clean(row[2]);
    const cat   = clean(row[3]);
    const name  = clean(row[4]);

    const slug = resolveCategory(cat, name, model) || MISC_SLUG;
    let hadOption = false;
    col.addProduct({
      model, name: name || model, category_slug: slug, manufacturer: brand || null,
    });

    for (const t of TERMS) {
      const fee = toNum(row[t.col]);
      if (fee == null || fee <= 0) continue;
      hadOption = true;
      col.addOption({
        model, months: t.months, ownership_months: t.months,
        care_service: '셀프', inspection_cycle: null,
        monthly_fee: fee, total_fee: fee * t.months,
        rebate: computeRebate(ctx.commission, fee, fee * t.months, t.months),
        promo_type: null,
        variant_code: '', variant_label: '',
      });
    }
    if (!hadOption) skipped++;
  }
  return { ...col.result(), skipped, skipReason: '모델없음·전약정0' };
}

/**
 * 렌타나 — 헤더 r1. 가로 피벗(24/36/39/48) + 구분행("렌타나 단독 운영 제품" 등).
 * cols: 0브랜드 1A/S 2제품군 3접수대상 4제품명 5모델명 6약정24 7약정36 8약정39 9약정48
 *       10~13수거비 14비고 15상품정보
 * 구분행: 브랜드 칸에 안내문, 그 다음 행이 반복 헤더("브랜드"). 둘 다 스킵.
 * "-" 값은 미운영 약정.
 */
function adaptRentana(aoa, ctx) {
  const col = makeCollector(ctx);
  const fill = makeFiller();
  let skipped = 0;
  const TERMS = [
    { months: 24, col: 6 }, { months: 36, col: 7 },
    { months: 39, col: 8 }, { months: 48, col: 9 },
  ];

  for (let r = 1; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const c0 = clean(row[0]);
    // 반복 헤더 행
    if (c0 === '브랜드') { skipped++; continue; }
    const model = clean(row[5]);
    const name  = clean(row[4]);
    // 구분행: 제품명/모델명 없이 브랜드 칸에만 텍스트
    if (!hasVal(model) && !hasVal(name)) { skipped++; continue; }
    if (!hasVal(model)) { skipped++; continue; }

    const brand = fill('brand', row[0]);
    const pg    = fill('pg', row[2]);
    const slug  = resolveCategory(pg, name, model) || MISC_SLUG;
    let hadOption = false;
    col.addProduct({
      model, name: name || model, category_slug: slug, manufacturer: clean(brand) || null,
    });

    for (const t of TERMS) {
      const fee = toNum(row[t.col]);
      if (fee == null || fee <= 0) continue;   // "-" 또는 0 = 미운영
      hadOption = true;
      col.addOption({
        model, months: t.months, ownership_months: t.months,
        care_service: '셀프', inspection_cycle: null,
        monthly_fee: fee, total_fee: fee * t.months,
        rebate: computeRebate(ctx.commission, fee, fee * t.months, t.months),
        promo_type: null,
        variant_code: '', variant_label: '',
      });
    }
    if (!hadOption) skipped++;
  }
  return { ...col.result(), skipped, skipReason: '구분행·반복헤더·전약정미운영' };
}

/**
 * 이니렌탈 4시트(삼성·LG·기타·위닉스) — 헤더 r1. 가로 피벗(36/48/60).
 * cols: 0no 1구분/브랜드 2품목/구분 3모델명 4상품명 5A/S 6비고 7주력 8배송방법
 *       9위탁렌탈료(36) 10총렌탈료(36) 11위탁(48) 12총(48) 13위탁(60) 14총(60)
 *       15 36개월렌탈료 16차이
 * ⭐ 위탁 렌탈료 = 봉이가 받는 값 → monthly_fee 는 위탁렌탈료를 쓴다.
 *   total_fee 는 총렌탈료(고객 총액)를 쓰되, rebate 산정 base 는 위탁×months.
 *   이니 수수료율은 총 렌탈료 13% 이나 위탁 자체가 봉이 몫이라 보수적으로
 *   위탁 기준 total 로 계산(commission 이 위탁=총렌탈료를 의도).
 * 구분/품목 컬럼 위치가 시트마다 미세 차이 — 둘 다 fallback 으로 본다.
 */
function adaptInicis(aoa, ctx) {
  const HEADER = 1;
  const col = makeCollector(ctx);
  const fill = makeFiller();
  let skipped = 0;
  const TERMS = [
    { months: 36, wCol: 9, tCol: 10 },
    { months: 48, wCol: 11, tCol: 12 },
    { months: 60, wCol: 13, tCol: 14 },
  ];

  for (let r = HEADER + 1; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const model = clean(row[3]);
    const name  = clean(row[4]);
    if (!hasVal(model)) { skipped++; continue; }
    // col1·col2 — 시트별로 브랜드/구분/품목 위치 상이 → 둘 다 카테고리 후보
    const c1 = fill('c1', row[1]);
    const c2 = fill('c2', row[2]);

    const slug = resolveCategory(c2, c1, name, model) || MISC_SLUG;
    // c1/c2 중 한글 제품군 아닌 것이 브랜드일 수 있음
    const maker = clean(c1) && !normalizeCategory(c1) ? clean(c1) : null;
    let hadOption = false;
    col.addProduct({
      model, name: name || model, category_slug: slug, manufacturer: maker,
    });

    for (const t of TERMS) {
      const wFee = toNum(row[t.wCol]);   // 위탁 렌탈료 — 봉이가 매월 받는 값
      const tFee = toNum(row[t.tCol]);   // 총 렌탈료(고객 월부담) — 수수료 산정 base
      if (wFee == null || wFee <= 0) continue;
      hadOption = true;
      // monthly_fee = 위탁 렌탈료(봉이 몫). 단, rebate(빌리고 수수료)는
      // 이니 정책 "총 렌탈료 × 13%" 이므로 산정 base 는 총 렌탈료(tFee).
      const custTotal = (tFee ?? wFee) * t.months;
      col.addOption({
        model, months: t.months, ownership_months: t.months,
        care_service: '셀프', inspection_cycle: null,
        monthly_fee: wFee,                   // 위탁 렌탈료
        total_fee: custTotal,                // 총 렌탈료(고객 총액)
        normal_price: tFee ?? null,
        rebate: computeRebate(ctx.commission, tFee ?? wFee, custTotal, t.months),
        promo_type: null,
        variant_code: '', variant_label: '',
      });
    }
    if (!hadOption) skipped++;
  }
  return { ...col.result(), skipped, skipReason: '모델없음·전약정0' };
}

/**
 * 위덱 — 헤더 r1. 패키지 상품(상세모델에 여러 모델 콤마).
 * cols: 0No 1제품군 2렌탈제품명 3상세모델 4월렌탈료 5개월수 6총렌탈료
 * "서비스내역"·"※"·"CHECK POINT" 등 노트행 스킵. 제품군 forward-fill.
 */
function adaptWidek(aoa, ctx) {
  const HEADER = 1;
  const col = makeCollector(ctx);
  const fill = makeFiller();
  let skipped = 0;

  for (let r = HEADER + 1; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const c0 = clean(row[0]);
    if (c0 === '서비스내역' || c0.startsWith('※') || /CHECK\s*POINT/i.test(c0)) {
      skipped++; continue;
    }
    const months = toNum(row[5]);
    const fee = toNum(row[4]);
    const name = clean(row[2]);          // 렌탈제품명
    if (!hasVal(name) || months == null || fee == null || fee <= 0) { skipped++; continue; }

    const pg     = fill('pg', row[1]);
    const detail = clean(row[3]);        // 상세모델(패키지 구성)
    // model 식별자 = 렌탈제품명 (패키지 명칭)
    const model = name;
    const slug = resolveCategory(pg, name, detail) || MISC_SLUG;
    col.addProduct({
      model, name, category_slug: slug, manufacturer: '위덱',
    });

    // 관리형/셀프형 → care_service. 패키지명에 인코딩.
    const care = careFromText(name, detail) ?? '방문';
    const total = toNum(row[6]) ?? fee * months;
    col.addOption({
      model, months, ownership_months: months,
      care_service: care, inspection_cycle: null,
      monthly_fee: fee, total_fee: total,
      rebate: computeRebate(ctx.commission, fee, total, months),
      promo_type: null,
      // 같은 렌탈제품명이 관리형/셀프형으로 갈리면 model 에 이미 포함되므로 ''
      variant_code: '',
      variant_label: '',
    });
  }
  return { ...col.result(), skipped, skipReason: '노트행·렌탈료없음' };
}

// ==================================================================
// 5. 어댑터 디스패치
// ==================================================================

/** 시트명(괄호 안 월 제거) → 어댑터 함수 */
function pickAdapter(sheetName) {
  const base = sheetName.replace(/\(\d*월\)/g, '').trim();
  switch (base) {
    case '캐리어':            return (aoa, ctx) => adaptCarrier(aoa, ctx);
    case '스마트':            return (aoa, ctx) => adaptSmart(aoa, ctx);
    case 'LG헬로':            return (aoa, ctx) => adaptLgHello(aoa, ctx);
    case '유버스':            return (aoa, ctx) => adaptUbus(aoa, ctx);
    case 'BS':                return (aoa, ctx) => adaptBS(aoa, ctx);
    case 'KT회선O':           return (aoa, ctx) => adaptKtLine(aoa, ctx, 0, '회선보유');
    case 'KT회선X':           return (aoa, ctx) => adaptKtLine(aoa, ctx, 1, '회선미보유');
    case 'KT구독형(R)':       return (aoa, ctx) => adaptKtSubscription(aoa, ctx, {
      codeCol: 4, memoCol: 8, lumpCol: 11,
      terms: [{ months: 24, col: 12 }, { months: 36, col: 13 },
              { months: 48, col: 14 }, { months: 60, col: 15 }],
      careForm: 'normal',
    });
    case 'KT구독케어형(R)':   return (aoa, ctx) => adaptKtSubscription(aoa, ctx, {
      codeCol: 3, memoCol: 5, lumpCol: 8,
      terms: [{ months: 36, col: 9 }, { months: 60, col: 10 }],
      careForm: 'care',
    });
    // ⚠️ LG구독 시트별 컬럼 위치 — 실측(2026-05-20):
    //   냉장고: 제품군2 단품모델3 CSMS모델4 방문주기5 서비스타입6
    //   쿠킹  : 제품군2 단품모델3 설치타입4 CSMS모델5(대부분 빈값) 방문주기6 케어타입7
    //          → modelCol=3 (단품모델명, 187/191 채워짐; CSMS 컬럼은 '-')
    //   TV    : 채널2 제품군3 단품모델4 설치타입5 CSMS모델6 방문주기7 서비스타입8
    //   공청기: 채널2 제품군3 설치타입4 단품모델5 방문주기6 서비스타입7
    //   에어컨: 채널2 제품군3 구분1=4 설치타입5 CSMS모델6 방문주기7 서비스타입8
    //   리빙  : 채널2 제품군3 구분1=4 구분2=5 모델6 SIM7 케어십형태8 방문주기9
    case 'LG구독냉장고':      return (aoa, ctx) => adaptLgSubscription(aoa, ctx, {
      dataStart: 4, modelCol: 4, pgCol: 2, visitCol: 5,
      careTypeCol: 6, statusCol: 1, manufacturer: 'LG전자',
    });
    case 'LG구독쿠킹':        return (aoa, ctx) => adaptLgSubscription(aoa, ctx, {
      dataStart: 4, modelCol: 3, pgCol: 2, visitCol: 6,
      careTypeCol: 7, statusCol: 1, manufacturer: 'LG전자',
    });
    case 'LG구독TV':          return (aoa, ctx) => adaptLgSubscription(aoa, ctx, {
      dataStart: 3, modelCol: 6, pgCol: 3, visitCol: 7,
      careTypeCol: 8, statusCol: 1, manufacturer: 'LG전자',
    });
    case 'LG구독공청기':      return (aoa, ctx) => adaptLgSubscription(aoa, ctx, {
      dataStart: 3, modelCol: 4, pgCol: 3, visitCol: 6,
      careTypeCol: 7, statusCol: 1, manufacturer: 'LG전자',
    });
    case 'LG구독에어컨':      return (aoa, ctx) => adaptLgSubscription(aoa, ctx, {
      dataStart: 3, modelCol: 6, pgCol: 3, visitCol: 7,
      careTypeCol: 8, statusCol: 1, manufacturer: 'LG전자',
    });
    case 'LG구독리빙':        return (aoa, ctx) => adaptLgSubscription(aoa, ctx, {
      dataStart: 4, modelCol: 6, pgCol: 3, visitCol: 9,
      careTypeCol: 8, statusCol: 1, manufacturer: 'LG전자',
    });
    case '세스코':            return (aoa, ctx) => adaptCesco(aoa, ctx);
    case '렌플':              return (aoa, ctx) => adaptRenpl(aoa, ctx);
    case '렌타나':            return (aoa, ctx) => adaptRentana(aoa, ctx);
    case '이니렌탈삼성':      return (aoa, ctx) => adaptInicis(aoa, ctx);
    case '이니렌탈LG':        return (aoa, ctx) => adaptInicis(aoa, ctx);
    case '이니렌탈기타':      return (aoa, ctx) => adaptInicis(aoa, ctx);
    case '이니렌탈위닉스':    return (aoa, ctx) => adaptInicis(aoa, ctx);
    case '위덱':              return (aoa, ctx) => adaptWidek(aoa, ctx);
    default:                  return null;
  }
}

/** 시트명 → 봉이 rental_companies.name (회사 단위) */
function companyOfSheet(sheetName) {
  const base = sheetName.replace(/\(\d*월\)/g, '').trim();
  // 이니렌탈 4시트 = 모두 '이니' / KT 4시트 = 모두 'KT가전구독'
  if (base.startsWith('이니렌탈')) return '이니';
  if (base.startsWith('KT')) return 'KT가전구독';
  if (base.startsWith('LG구독')) return 'LG전자구독';
  return base;
}

// ==================================================================
// 6. variant 마감 처리 — 자연키 충돌 0 보장 (정수기 파서와 동일)
// ==================================================================

function finalizeVariants(options) {
  const groups = new Map();
  for (const o of options) {
    const bk = naturalKey(o, false);
    if (!groups.has(bk)) groups.set(bk, []);
    groups.get(bk).push(o);
  }

  for (const list of groups.values()) {
    if (list.length === 1) continue;
    const byVariant = new Map();
    for (const o of list) {
      const v = o.variant_code ?? '';
      if (!byVariant.has(v)) byVariant.set(v, []);
      byVariant.get(v).push(o);
    }
    for (const [vcode, rows] of byVariant.entries()) {
      if (rows.length === 1) continue;
      rows.sort((a, b) => (b.monthly_fee ?? 0) - (a.monthly_fee ?? 0));
      rows.forEach((o, i) => {
        const rank = i + 1;
        if (vcode === '') {
          o.variant_code = `v${rank}`;
          o.variant_label = rank === 1 ? '정상가' : `할인${rank - 1}`;
        } else {
          o.variant_code = `${vcode}#${rank}`;
          o.variant_label = `${o.variant_label || vcode} (${rank})`;
        }
      });
    }
  }

  const seen = new Set();
  let collisions = 0;
  for (const o of options) {
    const k = naturalKey(o, true);
    if (seen.has(k)) collisions++;
    else seen.add(k);
  }
  return { collisions };
}

// ==================================================================
// 7. 메인 파서
// ==================================================================

/**
 * 빌리고 가전 엑셀을 파싱해 정규화 배열을 반환한다.
 * 정수기 파서(parseBilligoRentalExcel)와 동일 출력 인터페이스.
 *
 * @param {string|Buffer} input 파일 경로 또는 엑셀 Buffer
 * @returns {{
 *   companies: Array<object>,
 *   products:  Array<object>,
 *   options:   Array<object>,
 *   stats:     { perSheet:Array, productsTotal:number, optionsTotal:number,
 *                unmappedCategories:string[], collisions7tuple:number },
 *   warnings:  { unmapped:string[], notes:string[] },
 *   bySheet:   Object,
 *   keyCollisions: number
 * }}
 */
export function parseBilligoGajeonExcel(input) {
  const wb = typeof input === 'string'
    ? xlsx.readFile(input)
    : xlsx.read(input, { type: 'buffer' });

  const warnings = { unmapped: new Set(), notes: [] };
  const allProducts = [];
  const allOptions = [];
  const bySheet = {};
  const perSheet = [];

  // ── 1. 수수료율 시트 ──
  let commissionByName = new Map();
  if (wb.SheetNames.includes(COMMISSION_SHEET)) {
    const cAoa = xlsx.utils.sheet_to_json(wb.Sheets[COMMISSION_SHEET], {
      header: 1, raw: true, defval: null, blankrows: false,
    });
    commissionByName = parseCommissionSheet(cAoa, warnings);
    perSheet.push({
      sheet: COMMISSION_SHEET, realRows: cAoa.length,
      products: 0, options: 0, skipped: cAoa.length,
      skipReason: '수수료율 메타시트(상품 아님)',
    });
  } else {
    warnings.notes.push(`수수료율 시트(${COMMISSION_SHEET}) 미발견 — rebate 산정 불가`);
  }

  // companies — 수수료율 시트 전체 (상품 시트가 참조하는 렌탈사 + 그 외 전부)
  const companies = [...commissionByName.values()];

  // ── 2. 상품 시트별 어댑터 ──
  for (const sheetName of wb.SheetNames) {
    if (sheetName === COMMISSION_SHEET) continue;

    const aoa = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], {
      header: 1, raw: true, defval: null, blankrows: false,
    });

    const adapter = pickAdapter(sheetName);
    if (!adapter) {
      warnings.notes.push(`알 수 없는 시트(어댑터 없음): ${sheetName}`);
      bySheet[sheetName] = { products: 0, options: 0, skipped: true };
      perSheet.push({
        sheet: sheetName, realRows: aoa.length,
        products: 0, options: 0, skipped: aoa.length, skipReason: '어댑터 없음',
      });
      continue;
    }

    const company = companyOfSheet(sheetName);
    const aliasKey = COMPANY_ALIAS[sheetName.replace(/\(\d*월\)/g, '').trim()];
    const commission = (aliasKey && commissionByName.get(aliasKey))
      || commissionByName.get(company) || null;
    if (!commission) {
      warnings.notes.push(`${sheetName}: 수수료 정책 미발견 (회사=${company}) — rebate=null`);
    }

    const ctx = { sheetName, company, commission, warnings };
    const { products, options, skipped, skipReason } = adapter(aoa, ctx);

    // 카테고리 매핑 검증 — MISC_SLUG 인 product 의 원본 품목 기록
    for (const p of products) {
      if (p.category_slug === MISC_SLUG) {
        warnings.unmapped.add(`${sheetName}:${clean(p.name).slice(0, 30)}`);
      } else if (!CATEGORY_SLUGS.has(p.category_slug)) {
        warnings.unmapped.add(`${sheetName}:slug=${p.category_slug}`);
      }
    }

    allProducts.push(...products);
    allOptions.push(...options);
    bySheet[sheetName] = { products: products.length, options: options.length };
    perSheet.push({
      sheet: sheetName, realRows: aoa.length,
      products: products.length, options: options.length,
      skipped: skipped ?? 0, skipReason: skipReason ?? '',
    });
  }

  // ── 3. variant 마감 — 자연키 7튜플 충돌 0 보장 ──
  const { collisions } = finalizeVariants(allOptions);
  if (collisions > 0) {
    warnings.notes.push(`⚠️ 자연키 잔여 충돌 ${collisions}건 — finalizeVariants 검토 필요`);
  }

  return {
    companies,
    products: allProducts,
    options: allOptions,
    warnings: { unmapped: [...warnings.unmapped].sort(), notes: warnings.notes },
    bySheet,
    keyCollisions: collisions,
    stats: {
      perSheet,
      productsTotal: allProducts.length,
      optionsTotal: allOptions.length,
      companiesTotal: companies.length,
      unmappedCategories: [...warnings.unmapped].sort(),
      collisions7tuple: collisions,
    },
  };
}

export default parseBilligoGajeonExcel;

// 내부 헬퍼는 검증/테스트용으로도 노출
export {
  normalizeCategory,
  splitInspection,
  toModelKey,
  extractMonths,
  naturalKey,
  finalizeVariants,
  parseCommissionSheet,
  CATEGORY_SLUGS,
};
