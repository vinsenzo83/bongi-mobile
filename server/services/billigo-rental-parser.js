/**
 * billigo-rental-parser.js
 * ------------------------------------------------------------------
 * 빌리고 "정수기" 엑셀(렌탈사 메이커 그룹)을 봉이 DB 구조
 * (rental_products / rental_product_options)로 정규화하는 파서.
 *
 * - 입력: 빌리고 정수기 엑셀 (10개 브랜드 시트 + 2개 프로모션 시트)
 * - 출력: { companies, products, options, warnings }
 *
 * PRD: docs/specs/billigo-rental-system.md (§4.4 컬럼 매핑, §4.5 점검주기 분해)
 *
 * ⭐ 자연키 (options 전체에서 유일 보장):
 *   (company_name, model, months, care_service, inspection_cycle,
 *    ownership_months, variant_code)
 *   - care_service / inspection_cycle / ownership_months 의 null 은
 *     비교 시 각각 '' / -1 / -1 로 정규화한다.
 *   - variant_code: 시트별 변형 차원(청호 규정·쿠쿠 구분·SK매직 채널 등).
 *     빈값은 '' (null 금지).
 *   - 시트 어댑터가 1차 variant_code 를 매기고, 그래도 자연키가 겹치면
 *     finalizeVariants() 가 monthly_fee 내림차순 v1/v2… 접미사를 붙여
 *     충돌 0 을 보장한다.
 *
 * 구조: 시트별 어댑터(adapter)가 raw 행을 표준 record 로 변환하고,
 *       공통 정규화 헬퍼가 카테고리·점검주기·model_key 를 처리한다.
 * ------------------------------------------------------------------
 */

import xlsx from 'xlsx';

// ==================================================================
// 1. 공통 상수 / 카테고리 매핑
// ==================================================================

/** 파싱 대상이 아닌 시트 (프로모션 시트는 건너뜀) */
const SKIP_SHEET_PATTERNS = [/프로모션/];

/** 시트명 → 렌탈사(회사) + 제조사 */
const SHEET_META = {
  '코웨이':       { company: '코웨이',   manufacturer: '코웨이' },
  '청호':         { company: '청호',     manufacturer: '청호나이스' },
  'LG구독':       { company: 'LG구독',   manufacturer: 'LG전자' },
  '루헨스':       { company: '루헨스',   manufacturer: '루헨스' },
  '웰스':         { company: '웰스',     manufacturer: '교원웰스' },
  '쿠쿠':         { company: '쿠쿠',     manufacturer: '쿠쿠' },
  '쿠쿠타사보상': { company: '쿠쿠',     manufacturer: '쿠쿠' },
  'SK매직':       { company: 'SK매직',   manufacturer: 'SK매직' },
  '유버스':       { company: '유버스',   manufacturer: '현대유버스' },
  '큐밍':         { company: '큐밍',     manufacturer: '현대큐밍' },
};

/**
 * 봉이 rental_categories slug(38종).
 * 매핑은 normalizeCategory() 가 규칙 기반으로 수행한다.
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

// ==================================================================
// 2. 공통 정규화 헬퍼
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

/** 숫자 파싱 (콤마·원·텍스트 제거). 실패 시 null */
function toNum(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
  const m = String(v).replace(/[, 원]/g, '').match(/-?\d+(\.\d+)?/);
  return m ? Math.round(parseFloat(m[0]) * 100) / 100 : null;
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
 * model_key — 모델코드에서 채널/색상/옵션 suffix 제거한 정규화 코드.
 * 예: WHB-5300 / WHB-5300(자가) / WHB-5300_60 → WHB-5300
 */
function toModelKey(model) {
  if (!model) return null;
  let k = String(model).trim();
  k = k.split(/[\n※]/)[0];               // 개행·비고 마커 제거
  // 선행 채널 prefix 제거 — 유버스 "(39/39)UBUS-..." 같이 코드 앞 괄호
  k = k.replace(/^\s*\([^)]*\)\s*/, '');
  k = k.split(/[(_]/)[0];                // 괄호·언더스코어 뒷부분 제거
  k = k.replace(/\s+/g, '').toUpperCase();
  return k || null;
}

/**
 * §4.5 점검주기 분해 — 1개 컬럼 → { care_service, inspection_cycle }
 *  - care_service: '방문' | '셀프' | null
 *  - inspection_cycle: 텍스트에서 추출한 개월 수 (정수), 미검출 null
 *
 * 판정 규칙 (PRD §4.5):
 *  - 방문: "방문" "관리" "케어" "방문형" "N M(N개월점검주기)" / 청호 숫자(>0)
 *  - 셀프: "자가" "셀프" "필터발송" "택배" "서비스프리" "없음" / 청호 "0"
 *  - 정수기는 점검주기(개월)만 있고 키워드가 없는 경우(쿠쿠 "4개월" 등)
 *    = 방문 점검 주기로 본다.
 *
 * @param {*} raw            점검주기 셀 값
 * @param {boolean} numericVisitMode  청호처럼 숫자(>0=방문, 0=셀프)인 시트
 */
function splitInspection(raw, numericVisitMode = false) {
  const s = clean(raw);
  if (!s) return { care_service: null, inspection_cycle: null };

  // 청호: 점검주기가 순수 숫자 → >0 방문, 0 셀프
  if (numericVisitMode) {
    const n = extractMonths(s) ?? toNum(s);
    if (n != null) {
      return {
        care_service: n > 0 ? '방문' : '셀프',
        inspection_cycle: n > 0 ? n : null,
      };
    }
  }

  // 셀프 마커가 방문 마커보다 우선 — "서비스프리"는 "서비스"보다 먼저 매칭
  const SELF = /(자가|셀프|필터\s*발송|필터\s*배송|필터\s*증정|필터\s*교체|택배|배송|서비스\s*프리|서비스프리|없음|해당없음|모종발송)/;
  const VISIT = /(방문|관리|케어|방문형|회\s*서비스|서비스|점검)/;

  // 개월 수 추출 — "N M(N개월점검주기)" / "4개월" / "6M"
  let cycle = extractMonths(s);
  if (cycle == null) {
    const mUnit = s.match(/(\d+)\s*M\b/i);
    if (mUnit) cycle = parseInt(mUnit[1], 10);
  }

  let care = null;
  if (SELF.test(s)) care = '셀프';
  else if (VISIT.test(s)) care = '방문';
  else if (cycle != null && cycle > 0) care = '방문';  // 키워드 없이 점검주기만 → 방문

  return { care_service: care, inspection_cycle: cycle };
}

/**
 * 제품군 텍스트 → 봉이 카테고리 slug.
 * 매핑 실패 시 null 반환 (호출부에서 경고 로그).
 */
function normalizeCategory(raw) {
  if (!raw) return null;
  // "정수기 ≫ 냉온정수기", "(홈케어)매트리스", "공 청 기", "얼음- 데스크형" 등 정리
  // 구분자(≫ > · -)를 공백으로 통일 후 토큰화
  let s = String(raw).replace(/\s+/g, '').replace(/[≫>·\-]/g, ' ').trim();
  const parts = s.split(/\s+/).filter(Boolean);
  const detail = parts.length > 1 ? parts[parts.length - 1] : parts[0] || '';
  const full = parts.join('');

  const test = (re) => re.test(detail) || re.test(full);

  // --- 정수기 계열 (순서 중요: 더 구체적인 것 먼저) ---
  if (test(/얼음.*정수|얼음정수기|얼음(데스크|스탠드)/)) return 'ice-purifier';
  if (test(/제빙기/)) return 'ice-purifier';
  if (test(/냉온.*정수|냉온정수기|냉정수기|냉.?정수/)) return 'hotcold-purifier';
  if (test(/정수/)) return 'water-purifier';
  // 정수기 세부 분류 — 빌트인·언더싱크·POU·직수·데스크형/스탠드형 (PRD: metadata 세분류)
  if (test(/빌트인|언더싱크|pou|직수|데스크형|스탠드형/i)) return 'water-purifier';

  // --- 공기 ---
  if (test(/제습기/)) return 'dehumidifier';
  if (test(/공청기|공기청정|청정기|공청|펫공청/)) return 'air-purifier';

  // --- 생활위생 ---
  if (test(/비데/)) return 'bidet';
  if (test(/연수기/)) return 'water-softener';
  if (test(/샤워|클린샤워/)) return 'shower';
  if (test(/핸드드라이어/)) return 'hand-dryer';

  // --- 침구 ---
  if (test(/매트리스/)) return 'mattress';
  if (test(/프레임|침대/)) return 'bed-frame';

  // --- 주방 ---
  if (test(/전기레인지|인덕션|레인지/)) return 'induction';
  if (test(/오븐/)) return 'oven';
  if (test(/식기세척/)) return 'dishwasher';
  if (test(/커피머신|커피/)) return 'coffee-machine';
  if (test(/음식물|음처기|음식물처리/)) return 'food-waste';
  if (test(/식물재배|식물/)) return 'plant-grower';

  // --- 대형가전 ---
  if (test(/김치냉장고/)) return 'kimchi-fridge';
  if (test(/냉장고/)) return 'refrigerator';
  if (test(/에어컨/)) return 'aircon';
  if (test(/세탁기/)) return 'washer';
  if (test(/건조기/)) return 'dryer';
  if (test(/^tv$|티비/i)) return 'tv';

  // --- 생활가전 ---
  if (test(/로봇청소|로봇/)) return 'robot-vacuum';
  if (test(/청소기/)) return 'vacuum';
  if (test(/스타일러|의류관리/)) return 'styler';
  if (test(/의류청정/)) return 'clothes-purifier';

  // --- 헬스 ---
  if (test(/안마의자|안마/)) return 'massage-chair';
  if (test(/힐링케어|힐링/)) return 'healing-care';
  if (test(/미용기기|의료기기|미용|의료|홈메디/)) return 'beauty-medical';

  // --- 기타 ---
  if (test(/펫드라이|펫급수|펫/)) return 'pet-care';
  if (test(/포충|해충방제|해충|포충등/)) return 'pest-control';
  if (test(/방향기/)) return 'air-freshener';

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
 * 자연키 문자열 생성 — null 정규화 포함.
 * variant_code 포함 여부를 인자로 받아 1차/최종 키를 모두 만들 수 있다.
 */
function naturalKey(o, withVariant) {
  const care = o.care_service ?? '';
  const insp = o.inspection_cycle == null ? -1 : o.inspection_cycle;
  const own = o.ownership_months == null ? -1 : o.ownership_months;
  const base = [o.company_name, o.model, o.months, care, insp, own];
  if (withVariant) base.push(o.variant_code ?? '');
  return base.join('');
}

// ==================================================================
// 3. 시트별 어댑터
// ==================================================================
//  각 어댑터는 (aoa, sheetName, warnings) => { products, options }

/**
 * 표준 product/option 누적기.
 * 동일 (model) 1개당 product 1건, 옵션행마다 option 1건.
 */
function makeCollector(company, manufacturer) {
  const products = new Map();   // model → product
  const options = [];

  function addProduct({ model, name, category_slug, billigo_status }) {
    const key = model;
    if (!products.has(key)) {
      products.set(key, {
        company_name: company,
        manufacturer,
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
    }
    return products.get(key);
  }

  function addOption(opt) {
    options.push({
      company_name: company,
      commission_method: 'direct',
      promo_type: null,
      half_fee: null,
      half_period: null,
      ownership_months: null,
      rebate_otherco: null,
      rebate_half: null,
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
 * 코웨이 — 헤더 r9. 수수료 컬럼 다수.
 * cols: 0제품군 1상품명 2모델명 3약정기간 4반값할인적용기간 5점검주기
 *       6약정할인가 14총수수료(vat) 15타사보상(vat) 16반값할인(vat)
 * variant_code: 점검주기 원본 텍스트 (자가관리·서비스프리·베이직케어(4M) 등을
 *   inspection_cycle 만으로 구분 못 하므로 원본 텍스트로 변형 식별).
 */
function adaptCoway(aoa, sheetName, warnings) {
  const HEADER = 9;
  const { company, manufacturer } = SHEET_META['코웨이'];
  const col = makeCollector(company, manufacturer);
  const fill = makeFiller();

  for (let r = HEADER + 1; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const pg     = fill('pg', row[0]);
    const name   = fill('name', row[1]);
    const model  = fill('model', row[2]);
    const months = toNum(row[3]);
    const fee    = toNum(row[6]);
    const rebate = toNum(row[14]);
    if (!hasVal(model) || months == null || fee == null) continue;

    const slug = normalizeCategory(pg);
    if (!slug && hasVal(pg)) warnings.unmapped.add(`${sheetName}:${clean(pg)}`);
    col.addProduct({ model: clean(model), name: clean(name), category_slug: slug });

    const cycleText = clean(row[5]);
    const insp = splitInspection(cycleText);
    const halfText = clean(row[4]);
    // variant_code: 점검주기 원본 + (있으면) 반값적용기간 → 1차 변형 식별
    const variant = [cycleText, halfText ? `반값${halfText}` : ''].filter(Boolean).join('/');
    col.addOption({
      model: clean(model),
      months,
      ownership_months: months,         // 코웨이는 별도 소유권 컬럼 없음 → 약정과 동일
      care_service: insp.care_service,
      inspection_cycle: insp.inspection_cycle,
      monthly_fee: fee,
      half_fee: null,
      half_period: extractMonths(row[4]),
      rebate,
      rebate_otherco: toNum(row[15]),
      rebate_half: toNum(row[16]),
      promo_type: null,
      variant_code: variant,
      variant_label: variant || '기본',
    });
  }
  return col.result();
}

/**
 * 청호 — 헤더 r8.
 * cols: 1제품군 2프로모션 3상품코드 4모델명 5모델명(세부) 6규정 7의무 8소유권
 *       9점검주기(숫자) 10렌탈료 11총수수료(v+)
 *
 * ⚠️ 같은 모델명(WI-37C90720N)이 색상(상품코드 Z10666·Z10652)마다 별도 행 →
 *    model 식별자는 "상품코드"를 쓴다 (모델명은 색상 공유라 충돌).
 * variant_code: "규정" 컬럼 (A0364·J0604(타사)·P0604 등 — 채널/약정/주기 인코딩).
 */
function adaptCheongho(aoa, sheetName, warnings) {
  const HEADER = 8;
  const { company, manufacturer } = SHEET_META['청호'];
  const col = makeCollector(company, manufacturer);
  const fill = makeFiller();

  for (let r = HEADER + 1; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const pg       = fill('pg', row[1]);
    const promo    = fill('promo', row[2]);
    const prodCode = fill('prodCode', row[3]);   // 상품코드 = SKU/색상 단위 식별자
    const modelNm  = fill('modelNm', row[4]);    // 모델명 (색상 공유)
    const detail   = fill('detail', row[5]);     // 모델명(세부) = 색상/이름
    const months = toNum(row[7]);
    const fee    = toNum(row[10]);
    const rebate = toNum(row[11]);
    const reg    = clean(row[6]);                // 규정
    if (!hasVal(prodCode) || months == null || fee == null) continue;

    const slug = normalizeCategory(pg);
    if (!slug && hasVal(pg)) warnings.unmapped.add(`${sheetName}:${clean(pg)}`);

    const model = clean(prodCode);
    col.addProduct({
      model,
      name: [clean(detail), clean(modelNm)].filter(Boolean).join(' ') || model,
      category_slug: slug,
    });

    const insp = splitInspection(row[9], true);   // 청호 = 숫자 방문판정
    col.addOption({
      model,
      months,
      ownership_months: toNum(row[8]),
      care_service: insp.care_service,
      inspection_cycle: insp.inspection_cycle,
      monthly_fee: fee,
      rebate,
      promo_type: clean(promo) || null,
      variant_code: reg,
      variant_label: reg || '기본',
    });
  }
  return col.result();
}

/**
 * LG구독 — 헤더 r10. 가로 펼침에서 약정(72/60/48) × 결합유형(단품/신규결합/기존결합)
 * 을 모두 unpivot → 한 행 → 최대 9 옵션.
 * 시트 중간 2번째 헤더 블록(r42~)은 레이아웃이 다름(1년차/2~6년차) → 헤더를
 * 동적 탐지하고, 각 약정 블록 안에서 "단품/1년차/신규결합/기존결합" 서브헤더와
 * 그 다음 "수수료(vat포함)" 열을 짝지어 (fee,rebate) 쌍을 모두 모은다.
 * variant_code: 결합유형 (단품·신규결합·기존결합).
 */
function adaptLgSubscription(aoa, sheetName, warnings) {
  const { company, manufacturer } = SHEET_META['LG구독'];
  const col = makeCollector(company, manufacturer);

  // 결합유형 라벨 정규화
  const COMBO_MAP = [
    { re: /단품|1년차|2~?6?년차|2~?5?년차/, code: '단품' },
    { re: /신규결합/, code: '신규결합' },
    { re: /기존결합/, code: '기존결합' },
  ];
  function comboOf(text) {
    const t = clean(text);
    if (/신규결합/.test(t)) return '신규결합';
    if (/기존결합/.test(t)) return '기존결합';
    if (/단품|1년차|년차/.test(t)) return '단품';
    return null;
  }

  // 헤더 행(="제품군"으로 시작) 인덱스 수집
  const headerRows = [];
  for (let r = 0; r < aoa.length; r++) {
    if (clean(aoa[r] && aoa[r][0]) === '제품군') headerRows.push(r);
  }
  if (headerRows.length === 0) {
    warnings.notes.push(`${sheetName}: 헤더 행 미발견`);
    return col.result();
  }

  for (let hi = 0; hi < headerRows.length; hi++) {
    const HEADER = headerRows[hi];
    const blockEnd = hi + 1 < headerRows.length ? headerRows[hi + 1] : aoa.length;
    const topRow = aoa[HEADER] || [];        // "계약/의무, 6년/6년" 등
    const subRow = aoa[HEADER + 1] || [];    // "단품 / 수수료(vat포함) / 신규결합 …"

    // 약정 블록: top 행에서 "계약/의무 … N년" 라벨이 있는 열 시작점
    const termBlocks = [];
    for (let c = 0; c < topRow.length; c++) {
      const t = clean(topRow[c]);
      const ym = t.match(/(\d+)\s*년/);
      if (ym && /계약|의무/.test(t)) {
        termBlocks.push({ months: parseInt(ym[1], 10) * 12, start: c });
      }
    }
    termBlocks.sort((a, b) => a.start - b.start);

    // 각 약정 블록 내부: 결합유형 서브헤더 열 → 바로 다음이 수수료 열
    for (let bi = 0; bi < termBlocks.length; bi++) {
      const b = termBlocks[bi];
      const limit = bi + 1 < termBlocks.length ? termBlocks[bi + 1].start : subRow.length;
      const combos = [];
      for (let c = b.start; c < limit; c++) {
        const combo = comboOf(subRow[c]);
        if (combo) combos.push({ combo, feeCol: c, rebateCol: c + 1 });
      }
      // 서브헤더 탐지 실패 시 블록 첫 칸을 단품으로
      if (combos.length === 0) {
        combos.push({ combo: '단품', feeCol: b.start, rebateCol: b.start + 1 });
      }
      b.combos = combos;
    }

    const fill = makeFiller();
    for (let r = HEADER + 2; r < blockEnd; r++) {
      const row = aoa[r] || [];
      if (clean(row[0]) === '제품군') continue;
      const pg    = fill('pg', row[0]);
      const line  = fill('line', row[1]);
      const g1    = fill('g1', row[2]);
      const model = fill('model', row[4]);
      const visit = row[5];   // 방문주기
      if (!hasVal(model)) continue;

      const slug = normalizeCategory(pg);
      if (!slug && hasVal(pg)) warnings.unmapped.add(`${sheetName}:${clean(pg)}`);
      const name = [clean(line), clean(g1)].filter(Boolean).join(' ') || clean(model);
      const insp = splitInspection(visit);

      // unpivot: 약정 × 결합유형
      for (const b of termBlocks) {
        for (const cm of b.combos) {
          const fee = toNum(row[cm.feeCol]);
          const rebate = toNum(row[cm.rebateCol]);
          if (fee == null) continue;
          col.addProduct({ model: clean(model), name, category_slug: slug });
          col.addOption({
            model: clean(model),
            months: b.months,
            ownership_months: b.months,
            care_service: insp.care_service,
            inspection_cycle: insp.inspection_cycle,
            monthly_fee: fee,
            rebate,
            promo_type: null,
            variant_code: cm.combo,
            variant_label: cm.combo,
          });
        }
      }
    }
  }
  return col.result();
}

/**
 * 루헨스 — 헤더 r9.
 * cols: 1제품군 2모델명 3의무 4소유권 5점검주기 6렌탈료 7총수수료(v+) 8비고
 * 식별 컬럼 없음 → 같은 (모델·약정·점검·소유) 그룹 안에서 fee 내림차순 v1/v2…
 * (variant_code 는 finalizeVariants 가 일괄 부여 — 어댑터는 '' 로 둔다.)
 */
function adaptLuhens(aoa, sheetName, warnings) {
  const HEADER = 9;
  const { company, manufacturer } = SHEET_META['루헨스'];
  const col = makeCollector(company, manufacturer);
  const fill = makeFiller();

  for (let r = HEADER + 1; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const pg     = fill('pg', row[1]);
    const model  = fill('model', row[2]);
    const cycle  = fill('cycle', row[5]);
    const months = toNum(row[3]);
    const fee    = toNum(row[6]);
    const rebate = toNum(row[7]);
    if (!hasVal(model) || months == null || fee == null) continue;

    // 루헨스 시트는 정수기(WHP-) 행에 제품군이 비어있음 → 기본 정수기로 보정
    let slug = normalizeCategory(pg);
    if (!slug) {
      if (hasVal(pg)) warnings.unmapped.add(`${sheetName}:${clean(pg)}`);
      else slug = 'water-purifier';
    }
    col.addProduct({ model: clean(model), name: clean(model), category_slug: slug });

    const insp = splitInspection(cycle);
    col.addOption({
      model: clean(model),
      months,
      ownership_months: toNum(row[4]),
      care_service: insp.care_service,
      inspection_cycle: insp.inspection_cycle,
      monthly_fee: fee,
      rebate,
      promo_type: null,
      variant_code: '',                 // finalizeVariants 가 v1/v2… 부여
      variant_label: '',
    });
  }
  return col.result();
}

/**
 * 웰스 — 헤더 r10.
 * cols: 0제품군 1프로모션 2상품명 3모델명 4의무 5점검주기 6렌탈료 7수수료(vat) 8비고
 * 식별 컬럼 없음 → 같은 (모델·약정·점검) 그룹 안에서 fee 내림차순 v1/v2…
 */
function adaptWells(aoa, sheetName, warnings) {
  const HEADER = 10;
  const { company, manufacturer } = SHEET_META['웰스'];
  const col = makeCollector(company, manufacturer);
  const fill = makeFiller();

  for (let r = HEADER + 1; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const pg     = fill('pg', row[0]);
    const promo  = fill('promo', row[1]);
    const name   = fill('name', row[2]);
    const model  = fill('model', row[3]);
    const months = extractMonths(row[4]);
    const fee    = toNum(row[6]);
    const rebate = toNum(row[7]);
    if (!hasVal(model) || months == null || fee == null) continue;

    const slug = normalizeCategory(pg);
    if (!slug && hasVal(pg)) warnings.unmapped.add(`${sheetName}:${clean(pg)}`);
    col.addProduct({ model: clean(model), name: clean(name) || clean(model), category_slug: slug });

    const insp = splitInspection(row[5]);
    col.addOption({
      model: clean(model),
      months,
      ownership_months: months,
      care_service: insp.care_service,
      inspection_cycle: insp.inspection_cycle,
      monthly_fee: fee,
      rebate,
      promo_type: clean(promo) || null,
      variant_code: '',                 // finalizeVariants 가 v1/v2… 부여
      variant_label: '',
    });
  }
  return col.result();
}

/**
 * 쿠쿠 / 쿠쿠타사보상 — 헤더 r9 (동일 레이아웃).
 * cols: 1제품군 2모델명 3모델명(세부) 4구분 5의무 6소유권 7점검주기 8렌탈료 9총수수료(v+) 10비고
 * variant_code: "구분" 컬럼 (일반·패키지·패키지10%).
 * - 쿠쿠타사보상 시트의 수수료는 타사보상 수수료 → rebate_otherco 로도 채운다.
 */
function adaptCuckoo(aoa, sheetName, warnings, isOthercoSheet) {
  const HEADER = 9;
  const { company, manufacturer } = SHEET_META[isOthercoSheet ? '쿠쿠타사보상' : '쿠쿠'];
  const col = makeCollector(company, manufacturer);
  const fill = makeFiller();

  for (let r = HEADER + 1; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const pg     = fill('pg', row[1]);
    const model  = fill('model', row[2]);
    const detail = fill('detail', row[3]);
    const gubun  = clean(row[4]);                // 구분 = variant
    const months = extractMonths(row[5]);
    const fee    = toNum(row[8]);
    const rebate = toNum(row[9]);
    if (!hasVal(model) || months == null || fee == null) continue;

    const slug = normalizeCategory(pg);
    if (!slug && hasVal(pg)) warnings.unmapped.add(`${sheetName}:${clean(pg)}`);
    col.addProduct({
      model: clean(model),
      name: clean(detail) || clean(model),
      category_slug: slug,
    });

    const insp = splitInspection(row[7]);
    col.addOption({
      model: clean(model),
      months,
      ownership_months: extractMonths(row[6]),
      care_service: insp.care_service,
      inspection_cycle: insp.inspection_cycle,
      monthly_fee: fee,
      rebate,
      rebate_otherco: isOthercoSheet ? rebate : null,
      promo_type: gubun || null,
      variant_code: gubun,
      variant_label: gubun || '일반',
    });
  }
  return col.result();
}

/**
 * 여러 줄짜리 셀에서 모델 코드 토큰을 추출한다.
 * 예: "WPUIAC425S\n원코크 플러스 얼음물 정수기" → WPUIAC425S
 */
function extractModelCode(raw) {
  if (!raw) return '';
  const lines = String(raw).split(/[\r\n]+/).map((s) => s.trim()).filter(Boolean);
  for (const ln of lines) {
    if (/^[A-Za-z][A-Za-z0-9\-/]{2,}$/.test(ln) && /\d/.test(ln)) return ln;
  }
  for (const ln of lines) {
    const m = ln.match(/\b[A-Z]{2,}[A-Z0-9\-/]*\d[A-Z0-9\-/]*\b/);
    if (m) return m[0];
  }
  return clean(raw);
}

/**
 * SK매직 — 헤더 r7. 제품군 컬럼 없음, 의무는 모델명(세부) 텍스트에 내장.
 * cols: 1프로모션 2모델명 3채널구분(방문할인/셀프할인/+타사보상) 4모델명(세부)
 *       5소유권 6점검주기 7렌탈료 8총수수료(v+) 9비고
 * variant_code: 채널구분 정규화 (방문할인·방문할인+타사보상·셀프할인·셀프할인+타사보상).
 *   채널 셀은 블록 첫 행에만 있고 forward-fill 됨.
 */
function adaptSkMagic(aoa, sheetName, warnings) {
  const HEADER = 7;
  const { company, manufacturer } = SHEET_META['SK매직'];
  const col = makeCollector(company, manufacturer);
  const fill = makeFiller();

  // 채널 텍스트 정규화 → variant_code
  // 방문/셀프/무방문 + 타사보상 + (있으면) 주기/약정 토큰을 구조화한다.
  // 케어 키워드가 전혀 없는 순수 비고/색상 텍스트는 '' 반환 →
  // finalizeVariants 가 v1/v2… 를 부여하게 둔다.
  function normChannel(raw) {
    const t = clean(raw);
    if (!t) return '';
    const otherco = /타사보상/.test(t);
    let base = '';
    if (/무방문/.test(t)) base = '무방문';
    else if (/방문/.test(t)) base = '방문';
    else if (/셀프|자가/.test(t)) base = '셀프';
    // 괄호 안 주기/약정 토큰 (예: "(4개월)", "5년(방문형)") 보존
    const paren = t.match(/\(([^)]*)\)/);
    const extra = paren ? paren[1].trim() : '';
    if (!base && !otherco) return '';        // 케어 키워드 없음 → 빈값
    const parts = [base || (otherco ? '타사보상' : '')];
    if (otherco && base) parts.push('타사보상');
    if (extra) parts.push(extra);
    return parts.filter(Boolean).join('+');
  }

  for (let r = HEADER + 1; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const modelRaw = fill('modelRaw', row[2]);
    const promo  = fill('promo', row[1]);
    const channel = fill('channel', row[3]);
    const detail = clean(row[4]);
    const fee    = toNum(row[7]);
    const rebate = toNum(row[8]);
    if (!hasVal(modelRaw) || !detail || fee == null) continue;

    const model = extractModelCode(modelRaw);
    if (!model) continue;

    // 의무(months): 모델명(세부)의 "N년의무" → 개월, 없으면 소유권
    let months = null;
    const ym = detail.match(/(\d+)\s*년\s*의무/);
    if (ym) months = parseInt(ym[1], 10) * 12;
    if (months == null) months = extractMonths(row[5]);
    if (months == null) continue;

    const slug = normalizeCategory(detail) || normalizeCategory(clean(modelRaw)) || 'water-purifier';
    col.addProduct({
      model,
      name: clean(String(modelRaw).split(/[\r\n]+/).slice(0, 2).join(' ')) || model,
      category_slug: slug,
    });

    // care_service: 채널구분/세부 텍스트에 방문/셀프
    const careSource = [clean(channel), detail, clean(row[6])].join(' ');
    const insp = splitInspection(careSource);
    const variant = normChannel(channel);
    col.addOption({
      model,
      months,
      ownership_months: extractMonths(row[5]),
      care_service: insp.care_service,
      inspection_cycle: splitInspection(row[6]).inspection_cycle,
      monthly_fee: fee,
      rebate,
      promo_type: clean(channel) || clean(promo) || null,
      variant_code: variant,
      variant_label: variant || clean(channel) || '기본',
    });
  }
  return col.result();
}

/**
 * 유버스 — 헤더 r9.
 * cols: 1제품군 2프로모션 3모델명 4의무 5소유권 6관리(배송)주기 7렌탈료 8총수수료(v+) 9비고
 * 모델명 자체가 약정·옵션을 모두 인코딩 → 완전 유일. variant_code=''.
 */
function adaptUbus(aoa, sheetName, warnings) {
  const HEADER = 9;
  const { company, manufacturer } = SHEET_META['유버스'];
  const col = makeCollector(company, manufacturer);
  const fill = makeFiller();

  for (let r = HEADER + 1; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const pg     = fill('pg', row[1]);
    const promo  = fill('promo', row[2]);
    const model  = fill('model', row[3]);
    const months = extractMonths(row[4]);
    const fee    = toNum(row[7]);
    const rebate = toNum(row[8]);
    if (!hasVal(model) || months == null || fee == null) continue;

    const slug = normalizeCategory(pg);
    if (!slug && hasVal(pg)) warnings.unmapped.add(`${sheetName}:${clean(pg)}`);
    col.addProduct({ model: clean(model), name: clean(model), category_slug: slug });

    const insp = splitInspection(row[6]);
    col.addOption({
      model: clean(model),
      months,
      ownership_months: extractMonths(row[5]),
      care_service: insp.care_service,
      inspection_cycle: insp.inspection_cycle,
      monthly_fee: fee,
      rebate,
      promo_type: clean(promo) || null,
      variant_code: '',
      variant_label: '',
    });
  }
  return col.result();
}

/**
 * 큐밍 — 헤더 r8. 의무 컬럼 없음 — "기간" 컬럼이 약정.
 * cols: 0제품군 1프로모션 2모델명 3모델명(세부) 4기간 6렌탈료 7총수수료(v+)
 *       8일시불금액(v+) 9일시불총수수료(v+) 10전사프로모션
 * variant_code: 전사프로모션 텍스트 (6개월반값·12개월반값 등) — 같은 모델·기간에
 *   프로모션별 다른 행이 존재. 점검주기 컬럼 없음 → 그래도 충돌하면
 *   finalizeVariants 가 fee 순위 접미사를 추가한다.
 */
function adaptQming(aoa, sheetName, warnings) {
  const HEADER = 8;
  const { company, manufacturer } = SHEET_META['큐밍'];
  const col = makeCollector(company, manufacturer);
  const fill = makeFiller();

  for (let r = HEADER + 1; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const pg     = fill('pg', row[0]);
    const promo  = fill('promo', row[1]);
    const model  = fill('model', row[2]);
    const detail = fill('detail', row[3]);
    const months = extractMonths(row[4]);
    const fee    = toNum(row[6]);
    const rebate = toNum(row[7]);
    if (!hasVal(model) || months == null || fee == null) continue;

    const slug = normalizeCategory(pg);
    if (!slug && hasVal(pg)) warnings.unmapped.add(`${sheetName}:${clean(pg)}`);
    col.addProduct({
      model: clean(model),
      name: clean(detail) || clean(model),
      category_slug: slug,
    });

    // 전사프로모션을 1차 variant 로 (6개월 반값 등)
    const corpPromo = clean(row[10]);
    const variant = corpPromo && corpPromo !== '-' ? corpPromo : '';
    col.addOption({
      model: clean(model),
      months,
      ownership_months: null,
      care_service: null,
      inspection_cycle: null,
      monthly_fee: fee,
      rebate,
      promo_type: [clean(promo), corpPromo].filter((x) => x && x !== '-').join(' / ') || null,
      variant_code: variant,
      variant_label: variant || '기본',
    });
  }
  return col.result();
}

// ==================================================================
// 4. 어댑터 디스패치
// ==================================================================

/** 시트명(괄호 안 월 제거) → 어댑터 함수 */
function pickAdapter(sheetName) {
  const base = sheetName.replace(/\(.*?\)/g, '').trim();
  switch (base) {
    case '코웨이':       return (aoa, sn, w) => adaptCoway(aoa, sn, w);
    case '청호':         return (aoa, sn, w) => adaptCheongho(aoa, sn, w);
    case 'LG구독':       return (aoa, sn, w) => adaptLgSubscription(aoa, sn, w);
    case '루헨스':       return (aoa, sn, w) => adaptLuhens(aoa, sn, w);
    case '웰스':         return (aoa, sn, w) => adaptWells(aoa, sn, w);
    case '쿠쿠':         return (aoa, sn, w) => adaptCuckoo(aoa, sn, w, false);
    case '쿠쿠타사보상': return (aoa, sn, w) => adaptCuckoo(aoa, sn, w, true);
    case 'SK매직':       return (aoa, sn, w) => adaptSkMagic(aoa, sn, w);
    case '유버스':       return (aoa, sn, w) => adaptUbus(aoa, sn, w);
    case '큐밍':         return (aoa, sn, w) => adaptQming(aoa, sn, w);
    default:             return null;
  }
}

// ==================================================================
// 5. variant 마감 처리 — 자연키 충돌 0 보장
// ==================================================================

/**
 * 어댑터가 1차 variant_code 를 매긴 뒤에도 7튜플 자연키가 겹치면,
 * 충돌 그룹 안에서 monthly_fee 내림차순으로 v1/v2/v3… 접미사를 부여한다.
 *
 * 접미사 부여 규칙:
 *  - 1차 variant_code 가 빈값인 그룹    → variant_code 자체를 v1/v2…
 *    variant_label = 정상가/할인1/할인2…
 *  - 1차 variant_code 가 있는데도 충돌  → variant_code 뒤에 #N 접미사
 *    (동일 변형코드에 fee 만 다른 잔여 행)
 *
 * @param {Array} options
 * @returns {{collisions:number}}  마감 후 잔여 충돌(항상 0 기대)
 */
function finalizeVariants(options) {
  // base 키(variant 제외)별로 그룹화
  const groups = new Map();
  for (const o of options) {
    const bk = naturalKey(o, false);
    if (!groups.has(bk)) groups.set(bk, []);
    groups.get(bk).push(o);
  }

  for (const list of groups.values()) {
    if (list.length === 1) continue;

    // 1차 variant_code 기준으로 다시 묶어, 그 안에서 fee 순위를 매긴다
    const byVariant = new Map();
    for (const o of list) {
      const v = o.variant_code ?? '';
      if (!byVariant.has(v)) byVariant.set(v, []);
      byVariant.get(v).push(o);
    }
    for (const [vcode, rows] of byVariant.entries()) {
      if (rows.length === 1) continue;
      // 같은 1차 variant_code 안에서 fee 내림차순 순위 부여
      rows.sort((a, b) => (b.monthly_fee ?? 0) - (a.monthly_fee ?? 0));
      rows.forEach((o, i) => {
        const rank = i + 1;
        if (vcode === '') {
          o.variant_code = `v${rank}`;
          o.variant_label = rank === 1 ? '정상가' : `할인${rank - 1}`;
        } else {
          // 변형코드가 있는데도 잔여 충돌 → #N 접미사
          o.variant_code = `${vcode}#${rank}`;
          o.variant_label = `${o.variant_label || vcode} (${rank})`;
        }
      });
    }
  }

  // 마감 후 잔여 충돌 확인
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
// 6. 메인 파서
// ==================================================================

/**
 * 빌리고 정수기 엑셀을 파싱해 정규화 배열을 반환한다.
 *
 * @param {string|Buffer} input 파일 경로 또는 엑셀 Buffer
 * @returns {{
 *   companies: Array<{name:string, category_group:string}>,
 *   products:  Array<object>,
 *   options:   Array<object>,
 *   warnings:  {unmapped:string[], notes:string[]},
 *   bySheet:   Object<string,{products:number, options:number}>,
 *   keyCollisions: number
 * }}
 */
export function parseBilligoRentalExcel(input) {
  const wb = typeof input === 'string'
    ? xlsx.readFile(input)
    : xlsx.read(input, { type: 'buffer' });

  const warnings = { unmapped: new Set(), notes: [] };
  const allProducts = [];
  const allOptions = [];
  const companies = new Map();
  const bySheet = {};

  for (const sheetName of wb.SheetNames) {
    if (SKIP_SHEET_PATTERNS.some((re) => re.test(sheetName))) {
      bySheet[sheetName] = { products: 0, options: 0, skipped: true };
      continue;
    }
    const adapter = pickAdapter(sheetName);
    if (!adapter) {
      warnings.notes.push(`알 수 없는 시트(어댑터 없음): ${sheetName}`);
      bySheet[sheetName] = { products: 0, options: 0, skipped: true };
      continue;
    }

    const aoa = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], {
      header: 1, raw: true, defval: null,
    });
    const { products, options } = adapter(aoa, sheetName, warnings);

    for (const p of products) {
      if (!companies.has(p.company_name)) {
        companies.set(p.company_name, { name: p.company_name, category_group: '정수기메이커' });
      }
    }

    allProducts.push(...products);
    allOptions.push(...options);
    bySheet[sheetName] = { products: products.length, options: options.length };
  }

  // variant 마감 — 자연키 7튜플 충돌 0 보장
  const { collisions } = finalizeVariants(allOptions);
  if (collisions > 0) {
    warnings.notes.push(`⚠️ 자연키 잔여 충돌 ${collisions}건 — finalizeVariants 검토 필요`);
  }

  return {
    companies: [...companies.values()],
    products: allProducts,
    options: allOptions,
    warnings: { unmapped: [...warnings.unmapped].sort(), notes: warnings.notes },
    bySheet,
    keyCollisions: collisions,
  };
}

export default parseBilligoRentalExcel;

// 내부 헬퍼는 검증/테스트용으로도 노출
export {
  normalizeCategory,
  splitInspection,
  toModelKey,
  extractMonths,
  naturalKey,
  finalizeVariants,
  CATEGORY_SLUGS,
};
