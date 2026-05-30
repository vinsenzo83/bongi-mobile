/**
 * rental-register-parser.js
 * ------------------------------------------------------------------
 * 봉이 "표준 상품등록 양식" 엑셀을 봉이 DB 구조
 * (rental_products / rental_product_options / rental_companies)로
 * 정규화하는 파서.
 *
 * - 입력: 봉이 표준 양식 엑셀 (시트 `등록확정_상세` 1개 필수,
 *         `README`·`수수료정책` 선택)
 * - 출력: { companies, products, options, warnings, bySheet,
 *          keyCollisions, stats }
 *   ※ 빌리고 파서(billigo-rental-parser.js / billigo-gajeon-parser.js)와
 *      동일 출력 인터페이스 — import preview/commit(rental.js
 *      runImportCommit)이 products·options·companies 를 그대로 소비한다.
 *
 * 사양서: docs/specs/rental-register-form.md
 *   §2 시트 구성 · §3 표준 컬럼 사전 · §5 작성 규칙 · §6 매핑 규칙
 *
 * ⭐ 핵심 동작
 *   - `등록확정_상세` 시트에서 표준 헤더("브랜드"·"모델명"·"약정기간" 등)가
 *     있는 행을 찾아 헤더로 인식 (제목 행이 1행에 올 수 있어 동적 탐지).
 *   - 헤더명 → DB 필드 자동 매핑. 별칭 수용(시장성/시장성_⭐ 등).
 *   - 정수기 그룹 24컬럼·가전 그룹 28컬럼이 한 파서로 처리.
 *   - 모델 그룹핑: 시리즈키 > (브랜드+모델명). 모델 단위 값은 직전 모델 상속.
 *
 * ⭐ 자연키 (options 전체에서 유일 보장) — 빌리고 파서와 동일 7-tuple:
 *   (company_name, model, months, care_service, inspection_cycle,
 *    ownership_months, variant_code)
 *   - null 은 비교 시 각각 '' / -1 / -1 로 정규화.
 *   - 같은 키 행이 값까지 같으면 dedup, 값이 다르면 finalizeVariants 가
 *     monthly_fee 내림차순 v1/v2… 접미사를 붙여 충돌 0 을 보장한다.
 * ------------------------------------------------------------------
 */

import xlsx from 'xlsx';

// ==================================================================
// 1. 공통 상수
// ==================================================================

/** 상품 데이터 시트명 (필수) */
const DETAIL_SHEET = '등록확정_상세';

/** 봉이 rental_categories slug(38+1종) — billigo 파서와 동일 */
const CATEGORY_SLUGS = new Set([
  'water-purifier', 'ice-purifier', 'hotcold-purifier', 'air-purifier',
  'dehumidifier', 'bidet', 'water-softener', 'shower', 'mattress',
  'bed-frame', 'induction', 'oven', 'coffee-machine', 'food-waste',
  'plant-grower', 'refrigerator', 'kimchi-fridge', 'aircon', 'washer',
  'dryer', 'tv', 'vacuum', 'robot-vacuum', 'styler', 'clothes-purifier',
  'massage-chair', 'healing-care', 'beauty-medical', 'dishwasher',
  'computer', 'monitor', 'game-console', 'projector', 'speaker',
  'pet-care', 'pest-control', 'air-freshener', 'hand-dryer',
  'misc-appliance',
]);

/**
 * 표준 컬럼 사전 (사양서 §3) — 헤더명/별칭 → 내부 표준 필드.
 * 키 = 정규화 헤더(공백 제거·소문자 무관), 값 = 내부 필드명.
 */
const HEADER_MAP = {
  // ─── 모델 단위 (M) — rental_products ───
  '노출순위': 'display_rank',
  '최종랭킹': 'final_rank',
  '시장성': 'market_score',
  '시장성_⭐': 'market_score',
  '시장성⭐': 'market_score',
  '브랜드': 'brand',
  '모델군': 'model_group',
  '대분류': 'category_raw',
  '중분류(상품명)': 'name_mid',
  '중분류': 'name_mid',
  '상품명': 'name_full',
  '모델명': 'model',
  '모델명_정규화': 'model_key',
  '시리즈키': 'series_key',
  '상품URL': 'product_url',
  '상품 URL': 'product_url',
  '상품이미지': 'image_url',
  '상품 이미지': 'image_url',
  '이미지URL': 'image_url',
  '이미지 URL': 'image_url',
  '이미지': 'image_url',
  '등록상태': 'registration_status',
  '평가메모': 'evaluation_memo',
  // ─── 옵션 단위 (O) — rental_product_options ───
  '렌탈사': 'company_raw',
  '색상/규격': 'variant_spec',
  '색상규격': 'variant_spec',
  '사용면적': 'area',
  '약정기간': 'months',
  '약정기간(개월)': 'months',
  '소유권이전': 'ownership_months',
  '케어서비스': 'care_raw',
  '점검주기': 'inspection_cycle',
  'A/S기간': 'as_period',
  'AS기간': 'as_period',
  '가입가능연령': 'age_limit',
  '정상가': 'normal_price',
  '월 납부액': 'monthly_fee',
  '월납부액': 'monthly_fee',
  '월렌탈료': 'monthly_fee',
  '월 렌탈료': 'monthly_fee',
  '월 납부액 증감': 'monthly_diff',
  '월납부액증감': 'monthly_diff',
  '총렌탈료': 'total_fee',
  '반값할인 렌탈료': 'half_fee',
  '반값할인렌탈료': 'half_fee',
  '반값할인적용기간': 'half_period',
  '기본설치비': 'install_fee',
  '수수료율(%)': 'commission_rate_pct',
  '수수료율': 'commission_rate_pct',
  '수수료 기준': 'commission_basis',
  '수수료기준': 'commission_basis',
  '리베이트': 'rebate',
  '타사보상 리베이트': 'rebate_otherco',
  '타사보상리베이트': 'rebate_otherco',
  '반값 리베이트': 'rebate_half',
  '반값리베이트': 'rebate_half',
  '결합지급률(%)': 'bundle_rate',
  '결합지급률': 'bundle_rate',
  '프로모션태그': 'promo_tag',
  '비고': 'note',
};

/** 모델 단위 필드 — 모델 첫 행에만 있을 수 있어 직전 값 상속 (§5.1) */
const MODEL_FIELDS = new Set([
  'display_rank', 'final_rank', 'market_score', 'brand', 'model_group',
  'category_raw', 'name_mid', 'name_full', 'model', 'model_key',
  'series_key', 'product_url', 'image_url', 'registration_status', 'evaluation_memo',
]);

/**
 * 옵션 변별 필드 — dedup/variant_code 서명에 쓰는 "옵션 단위 컬럼 전부".
 * 한 행을 다른 옵션과 구별하는 값이 하나라도 다르면 별개 옵션으로 보존하고,
 * 이 필드들이 전부 같을 때만 완전 동일 행으로 dedup 한다 (정수기·가전 공통).
 *
 * ⚠️ 모델 단위 컬럼은 제외 — 단, `model`(모델명, 색상 SKU 포함)은
 *    에어컨 시리즈키 그룹에서 색상별 옵션을 가르는 변별값이라 포함한다.
 *    (노출순위·시장성·시리즈키·상품URL 등 진열/메타 컬럼만 제외)
 */
const OPTION_SIG_FIELDS = [
  'model',              // 모델명 — 색상 SKU 포함 (에어컨 색상 변별)
  'variant_spec',       // 색상/규격
  'area',               // 사용면적
  'company_raw',        // 렌탈사
  'months',             // 약정기간
  'ownership_months',   // 소유권이전
  'care_raw',           // 케어서비스 (원본)
  'inspection_cycle',   // 점검주기
  'as_period',          // A/S기간
  'age_limit',          // 가입가능연령
  'normal_price',       // 정상가
  'monthly_fee',        // 월 납부액 / 월렌탈료
  'monthly_diff',       // 월 납부액 증감
  'total_fee',          // 총렌탈료
  'half_fee',           // 반값할인 렌탈료
  'half_period',        // 반값할인적용기간
  'install_fee',        // 기본설치비
  'commission_rate_pct', // 수수료율(%)
  'commission_basis',   // 수수료 기준
  'rebate',             // 리베이트
  'rebate_otherco',     // 타사보상 리베이트
  'rebate_half',        // 반값 리베이트
  'bundle_rate',        // 결합지급률(%)
  'promo_tag',          // 프로모션태그
  'note',               // 비고
];

/** 필수 컬럼 (사양서 §5.3) — 누락 시 오류 행 */
const REQUIRED_FIELDS = ['brand', 'category_raw', 'model', 'months', 'care_raw', 'monthly_fee', 'rebate'];

// ==================================================================
// 2. 공통 정규화 헬퍼 (빌리고 파서와 동일 시그니처)
// ==================================================================

/** 공백·개행 정리 */
function clean(v) {
  if (v == null) return '';
  return String(v).replace(/\s+/g, ' ').trim();
}

/** 헤더 키 정규화 — 공백 제거, 후행 별표/기호 유지(별칭은 HEADER_MAP 에서 처리) */
function normHeader(v) {
  if (v == null) return '';
  return String(v).replace(/\s+/g, '').trim();
}

/** 셀이 의미있는 값을 가졌는지 */
function hasVal(v) {
  return v != null && String(v).trim() !== '';
}

/** 숫자 파싱 (콤마·"원"·텍스트 제거). Math.round 로 정수화. 실패 시 null */
function toNum(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : null;
  const m = String(v).replace(/[, 원]/g, '').match(/-?\d+(\.\d+)?/);
  return m ? Math.round(parseFloat(m[0])) : null;
}

/** 율 파싱 — 정수화하지 않음 (0.13 같은 율 보존). "%" 제거 */
function toRate(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const m = String(v).replace(/[, %]/g, '').match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

/** 텍스트에서 개월 수 추출 ("36개월"→36, "5년"→60, "72"→72, "36M"→36) */
function extractMonths(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : null;
  const s = String(v);
  const yr = s.match(/(\d+)\s*년/);
  if (yr) return parseInt(yr[1], 10) * 12;
  const mo = s.match(/(\d+)\s*개?\s*월/);
  if (mo) return parseInt(mo[1], 10);
  const mUnit = s.match(/(\d+)\s*M\b/i);
  if (mUnit) return parseInt(mUnit[1], 10);
  const bare = s.match(/-?\d+/);
  if (bare) return parseInt(bare[0], 10);
  return null;
}

/**
 * model_key — 모델코드에서 채널/색상/옵션 suffix 제거한 정규화 코드.
 * 예: WHB-5300 / WHB-5300(자가) / 27LX6TPGA(R) → WHB-5300
 */
function toModelKey(model) {
  if (!model) return null;
  let k = String(model).trim();
  k = k.split(/[\n※]/)[0];                 // 개행·비고 마커 제거
  k = k.replace(/^\s*\([^)]*\)\s*/, '');    // 선행 채널 prefix 제거
  k = k.replace(/\(R\)\s*$/i, '');          // (R) 구분자 제거
  k = k.split(/[(_]/)[0];                   // 괄호·언더스코어 뒷부분 제거
  k = k.replace(/\s+/g, '').toUpperCase();
  return k || null;
}

/**
 * 케어서비스 정규화 (사양서 §6.3) — 양식 원본값 → 방문/셀프/null.
 * DB CHECK 제약상 rental_product_options.care_service 는 방문·셀프·null 만 허용.
 *  - 셀프: 자가·셀프·미포함 키워드
 *  - 방문: 관리·점검·방문·설치·케어 키워드 (그리고 셀프 키워드가 없을 때)
 * 원본 텍스트는 호출부가 metadata.care_raw / variant 에 보존한다.
 */
function normalizeCare(raw) {
  const s = clean(raw);
  if (!s) return null;
  // 셀프 마커 우선 — "미포함"·"자가"·"셀프"
  if (/자가|셀프|미포함|미설치|없음|해당없음/.test(s)) return '셀프';
  // 방문 마커 — 관리·점검·방문·설치·케어·서비스·기사
  if (/관리|점검|방문|설치|케어|서비스|기사|포함|프리미엄|라이트|플러스|스탠다드/.test(s)) return '방문';
  // 표준값이 이미 '방문'/'셀프' 인 경우는 위에서 잡힘. 미판정 시 null.
  return null;
}

/**
 * 제품군 텍스트 → 봉이 카테고리 slug (사양서 §6.1).
 * 빌리고 파서 normalizeCategory 와 동일 규칙 (가전 그룹 슈퍼셋).
 * 매핑 실패 시 null (호출부에서 경고).
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

  // --- 가습/환기 등 보조 가전 ---
  if (test(/가습기/)) return 'air-purifier';
  if (test(/복합환풍기|환풍기|전열교환기|후드/)) return 'air-purifier';
  if (test(/선풍기|난방기/)) return 'aircon';

  return null;
}

/** forward-fill: 모델 단위 컬럼의 빈 칸을 직전 모델 값으로 채운다 (§5.1) */
function makeFiller() {
  const last = {};
  return (key, val) => {
    if (hasVal(val)) { last[key] = val; return val; }
    return last[key];
  };
}

/**
 * 자연키 문자열 생성 — null 정규화 포함 (빌리고 파서와 동일 7-tuple).
 * variant_code 포함 여부를 인자로 받아 1차/최종 키를 모두 만들 수 있다.
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
// 3. 헤더 행 탐지 + 컬럼 매핑
// ==================================================================

/**
 * `등록확정_상세` 시트에서 헤더 행을 찾는다.
 * 제목 행이 1행에 올 수 있어 — "브랜드"·"모델명"·"약정기간" 같은
 * 표준 헤더 키워드가 가장 많이 든 행을 헤더로 인식한다 (사양서 §2 ⚠️).
 *
 * @returns {{ headerRow:number, fieldByCol:Object<number,string>,
 *             recognized:Array, unmapped:Array }}
 */
function detectHeader(aoa) {
  const ANCHOR = new Set(['브랜드', '모델명', '약정기간', '대분류', '케어서비스']);
  let bestRow = -1, bestScore = 0;
  // 상위 10행 안에서 앵커 헤더가 가장 많은 행 탐색
  const scanLimit = Math.min(10, aoa.length);
  for (let r = 0; r < scanLimit; r++) {
    const row = aoa[r] || [];
    let score = 0;
    for (const cell of row) {
      const nh = normHeader(cell);
      // 별칭까지 흡수해 앵커 판정
      const f = HEADER_MAP[nh];
      if (f && (ANCHOR.has(nh) || ['brand', 'model', 'months', 'category_raw', 'care_raw'].includes(f))) {
        score++;
      }
    }
    if (score > bestScore) { bestScore = score; bestRow = r; }
  }
  if (bestRow < 0 || bestScore < 3) {
    return { headerRow: -1, fieldByCol: {}, recognized: [], unmapped: [] };
  }

  const headerRow = aoa[bestRow] || [];
  const fieldByCol = {};
  const recognized = [];
  const unmapped = [];
  const usedField = new Set();
  for (let c = 0; c < headerRow.length; c++) {
    const raw = headerRow[c];
    if (!hasVal(raw)) continue;
    const nh = normHeader(raw);
    const field = HEADER_MAP[nh];
    if (field) {
      // 같은 필드에 매핑되는 헤더가 둘 이상이면 첫 컬럼만 채택
      if (usedField.has(field)) {
        unmapped.push({ col: c, header: clean(raw), reason: `중복 필드(${field})` });
        continue;
      }
      fieldByCol[c] = field;
      usedField.add(field);
      recognized.push({ col: c, header: clean(raw), field });
    } else {
      unmapped.push({ col: c, header: clean(raw), reason: '표준 사전에 없음' });
    }
  }
  return { headerRow: bestRow, fieldByCol, recognized, unmapped };
}

// ==================================================================
// 4. 수수료정책 시트 파서
// ==================================================================

/**
 * `수수료정책` 시트 → 렌탈사별 commission 정책 (사양서 §4.2).
 * 헤더: 렌탈사 · 수수료 기준 · 수수료율 · 정액(원/건) · 비고.
 * 헤더 행도 동적 탐지("렌탈사" 앵커).
 *
 * @returns {Map<string,object>} 렌탈사명 → commission 정보
 */
function parseCommissionSheet(aoa, warnings) {
  const byName = new Map();
  // 헤더 행 탐지 — "렌탈사" 가 든 행
  let hr = -1;
  for (let r = 0; r < Math.min(10, aoa.length); r++) {
    const row = (aoa[r] || []).map(normHeader);
    if (row.includes('렌탈사')) { hr = r; break; }
  }
  if (hr < 0) {
    warnings.notes.push('수수료정책 시트: 헤더 행 미발견 — 무시');
    return byName;
  }
  const header = (aoa[hr] || []).map(normHeader);
  const cName = header.indexOf('렌탈사');
  const cBasis = header.findIndex((h) => /수수료기준|기준/.test(h));
  const cRate = header.findIndex((h) => /수수료율|율/.test(h));
  const cFlat = header.findIndex((h) => /정액/.test(h));
  const cNote = header.findIndex((h) => /비고/.test(h));

  const fill = makeFiller();
  for (let r = hr + 1; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const name = clean(fill('name', cName >= 0 ? row[cName] : null));
    if (!name) continue;
    const basisText = cBasis >= 0 ? clean(row[cBasis]) : '';
    const rateVal = cRate >= 0 ? toRate(row[cRate]) : null;
    const flatVal = cFlat >= 0 ? toNum(row[cFlat]) : null;
    const note = cNote >= 0 ? clean(row[cNote]) : '';
    if (!hasVal(basisText) && rateVal == null && flatVal == null) continue;

    let method;
    let basis = 'total';
    let rate = null, flat = null, multiple = null;

    if (/건\s*당/.test(basisText) || (flatVal != null && rateVal == null)) {
      method = 'flat';
      flat = flatVal;
    } else if (/구좌\s*당/.test(basisText)) {
      method = 'account';
      flat = flatVal;
    } else if (/월\s*렌탈료/.test(basisText)) {
      basis = 'monthly';
      if (rateVal != null && rateVal > 1) { method = 'multiple'; multiple = rateVal; }
      else { method = 'rate'; rate = rateVal; }
    } else {
      // "총 렌탈료" 등 — 율 기준
      method = 'rate';
      basis = 'total';
      rate = rateVal;
    }

    // 첫 행 정책 채택. 중복(이원화)이면 has_dual_pricing 표시.
    if (byName.has(name)) {
      byName.get(name).has_dual_pricing = true;
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
      notes: note || null,
    });
  }
  return byName;
}

// ==================================================================
// 5. variant 마감 — 자연키 충돌 0 보장 (빌리고 파서와 동일 로직)
// ==================================================================

/**
 * 옵션 단위 값 서명 — `등록확정_상세` 한 행의 OPTION_SIG_FIELDS(옵션 단위
 * 컬럼 전부) raw 값을 정규화해 이어붙인다.
 *
 * 두 행이 "완전히 같은 옵션"인지 판정하는 유일한 기준.
 *  - 정수기: 프로모션태그만 달라도 서명이 달라 별개 옵션으로 보존.
 *  - 가전:  모델명(색상 SKU)·색상/규격·총렌탈료·기본설치비 등이 달라도 보존.
 * 모델 단위(노출순위·시장성·시리즈키·상품URL 등)는 서명에서 제외 — 그 값들은
 * 옵션 변별과 무관하다.
 *
 * @param {object} rec  헤더 매핑된 원시 필드값 객체 (forward-fill 이후)
 */
function buildOptionSig(rec) {
  const norm = (v) => {
    if (v == null || v === '') return '';
    if (typeof v === 'number') return String(v);
    return String(v).replace(/\s+/g, ' ').trim();
  };
  return OPTION_SIG_FIELDS.map((f) => norm(rec[f])).join('');
}

/**
 * 7튜플 자연키가 겹치는 옵션을 처리해 충돌 0 을 보장한다.
 *
 *  - 같은 7튜플 base 키 + 옵션값 서명(OPTION_SIG_FIELDS 전부)까지 완전 동일
 *    → 같은 옵션이 중복 기재된 것 → 1개로 dedup.
 *  - 같은 7튜플 base 키인데 옵션값 서명이 하나라도 다름
 *    → 별개 옵션 → 서명별로 고유 variant_code(v1/v2/v3…) 부여해 모두 보존.
 *
 * variant_code 는 "옵션값 서명" 단위로 부여한다 — 한 서명 = 한 코드라
 * 7튜플+variant_code 가 항상 유일해진다 (행 누락 0).
 * 각 옵션은 `_optSig`(buildOptionSig 결과)를 미리 달고 들어온다.
 *
 * @returns {{ collisions:number, deduped:number }}
 */
function finalizeVariants(options) {
  // base 키(variant 제외 6요소) 단위로 그룹화
  const groups = new Map();
  for (const o of options) {
    const bk = naturalKey(o, false);
    if (!groups.has(bk)) groups.set(bk, []);
    groups.get(bk).push(o);
  }

  const kept = [];
  let deduped = 0;

  for (const list of groups.values()) {
    // 그룹 내 옵션값 서명별로 묶는다.
    //  - 같은 서명 = 완전 동일 옵션 → 첫 행만 유지 (나머지 dedup)
    //  - 서로 다른 서명 = 별개 옵션 → 각각 고유 variant_code
    const bySig = new Map();   // _optSig → 대표 옵션 (첫 행)
    for (const o of list) {
      const sig = o._optSig ?? '';
      if (bySig.has(sig)) { deduped++; continue; }   // 완전 동일 행 dedup
      bySig.set(sig, o);
    }

    const distinct = [...bySig.values()];
    if (distinct.length === 1) {
      // 충돌 없음 — 유일 옵션. 어댑터가 매긴 variant_code 그대로 둔다.
      kept.push(distinct[0]);
      continue;
    }

    // 충돌 그룹 — 서명이 다른 옵션이 둘 이상.
    // 어댑터가 매긴 variant_code 가 이미 그룹 내에서 전부 유일하면 그대로 둔다
    // (에어컨 색상/규격처럼 행마다 다른 variant 가 이미 자연키를 분리한 경우).
    const presetCodes = distinct.map((o) => o.variant_code ?? '');
    const presetUnique = presetCodes.every((c) => c !== '')
      && new Set(presetCodes).size === presetCodes.length;
    if (presetUnique) {
      for (const o of distinct) kept.push(o);
      continue;
    }

    // variant_code 가 비었거나 충돌 → monthly_fee 내림차순으로 v1/v2… 부여
    // (가격 높은 쪽이 정상가). 서명별 1코드라 7튜플+variant_code 가 유일해진다.
    distinct.sort((a, b) => (b.monthly_fee ?? 0) - (a.monthly_fee ?? 0));
    distinct.forEach((o, i) => {
      const rank = i + 1;
      const preset = o.variant_code ?? '';
      if (preset === '') {
        o.variant_code = `v${rank}`;
        if (!o.variant_label || o.variant_label === '기본') {
          o.variant_label = rank === 1 ? '정상가' : `할인${rank - 1}`;
        }
      } else {
        // 어댑터가 매긴 변형코드가 있는데도 충돌 → 뒤에 #N 접미사로 유일화
        o.variant_code = `${preset}#${rank}`;
        o.variant_label = `${o.variant_label || preset} (${rank})`;
      }
      kept.push(o);
    });
  }

  options.length = 0;
  options.push(...kept);

  // 마감 후 잔여 충돌 확인 (항상 0 기대)
  const seen = new Set();
  let collisions = 0;
  for (const o of options) {
    const k = naturalKey(o, true);
    if (seen.has(k)) collisions++;
    else seen.add(k);
    delete o._optSig;   // 내부 헬퍼 필드 — DB 적재 전 제거
  }
  return { collisions, deduped };
}

// ==================================================================
// 6. 메인 파서
// ==================================================================

/**
 * 봉이 표준 상품등록 양식 엑셀을 파싱해 정규화 배열을 반환한다.
 *
 * @param {string|Buffer} input 파일 경로 또는 엑셀 Buffer
 * @returns {{
 *   companies: Array<object>,
 *   products:  Array<object>,
 *   options:   Array<object>,
 *   warnings:  { unmapped:string[], notes:string[] },
 *   bySheet:   Object,
 *   keyCollisions: number,
 *   stats:     object
 * }}
 */
export function parseRentalRegisterExcel(input) {
  const wb = typeof input === 'string'
    ? xlsx.readFile(input)
    : xlsx.read(input, { type: 'buffer' });

  const warnings = { unmapped: new Set(), notes: [] };
  const bySheet = {};
  const stats = {
    headerRow: null,
    realRows: 0,
    errorRows: 0,
    errors: [],          // { row, missing:[...] }
    columnMapping: [],    // { col, header, field }
    unmappedHeaders: [],  // { col, header, reason }
    categoryDist: {},
    careServiceDist: {},
    careRawSamples: {},   // 원본 케어값 → 정규화 결과
    modelGrouping: { key: null, modelCount: 0 },
    commissionRows: 0,
  };

  // ─── 시트 존재 확인 ───
  if (!wb.SheetNames.includes(DETAIL_SHEET)) {
    warnings.notes.push(`필수 시트 '${DETAIL_SHEET}' 없음 — 파싱 중단`);
    return {
      companies: [], products: [], options: [],
      warnings: { unmapped: [], notes: warnings.notes },
      bySheet, keyCollisions: 0, stats,
    };
  }

  // ─── 수수료정책 시트 (선택) ───
  let commissionByName = new Map();
  if (wb.SheetNames.includes('수수료정책')) {
    const cAoa = xlsx.utils.sheet_to_json(wb.Sheets['수수료정책'], {
      header: 1, raw: true, defval: null,
    });
    commissionByName = parseCommissionSheet(cAoa, warnings);
    stats.commissionRows = commissionByName.size;
    bySheet['수수료정책'] = { commissionRows: commissionByName.size };
  }
  if (wb.SheetNames.includes('README')) {
    bySheet['README'] = { skipped: true, reason: '참고용 — import 무시' };
  }

  // ─── 등록확정_상세 시트 ───
  const aoa = xlsx.utils.sheet_to_json(wb.Sheets[DETAIL_SHEET], {
    header: 1, raw: true, defval: null,
  });
  const { headerRow, fieldByCol, recognized, unmapped } = detectHeader(aoa);
  if (headerRow < 0) {
    warnings.notes.push(`'${DETAIL_SHEET}' 시트: 헤더 행(브랜드·모델명·약정기간) 미발견 — 파싱 중단`);
    return {
      companies: [], products: [], options: [],
      warnings: { unmapped: [], notes: warnings.notes },
      bySheet, keyCollisions: 0, stats,
    };
  }
  stats.headerRow = headerRow;
  stats.columnMapping = recognized;
  stats.unmappedHeaders = unmapped;
  for (const u of unmapped) warnings.unmapped.add(`${DETAIL_SHEET}:${u.header} (${u.reason})`);

  // 데이터 그룹은 (등록폼 정수기) 렌탈사 컬럼 없을 수 있음 → 브랜드를 회사로 사용
  const hasCompanyCol = recognized.some((r) => r.field === 'company_raw');
  // 이 시트에 실제 존재하는 모델 단위 필드 — 매 행 재계산 방지
  const presentModelFields = [...new Set(Object.values(fieldByCol))]
    .filter((f) => MODEL_FIELDS.has(f));
  // 모델 그룹 식별자 자체인 필드 — 그룹 경계 판정용. 이 3개는 항상 forward-fill
  // 하되, 나머지 모델 단위 필드는 그룹이 바뀔 때 fill 상태를 리셋한다 (§5.1).
  const GROUP_KEY_FIELDS = new Set(['brand', 'model', 'series_key']);
  const groupFillFields = presentModelFields.filter((f) => GROUP_KEY_FIELDS.has(f));
  const memberFillFields = presentModelFields.filter((f) => !GROUP_KEY_FIELDS.has(f));

  // ─── 행 순회 — 모델 단위 값 forward-fill, 옵션 record 생성 ───
  // groupFill: 그룹 식별자(브랜드·모델명·시리즈키) 상속 — 모델 경계와 무관하게
  //   연속 유지(연속 옵션 행 묶음 식별용).
  // memberFill: 노출순위·시장성·등록상태·평가메모 등 — 모델 그룹이 바뀌면
  //   리셋해, 직전 모델 값이 다음 모델로 새지 않게 한다.
  const groupFill = makeFiller();
  let memberFill = makeFiller();
  let prevGroupKey = null;
  const products = new Map();   // company|model → product
  const optionsRaw = [];
  const companies = new Map();  // name → company
  const seriesKeyUsed = new Set();
  const modelKeyUsed = new Set();
  let usesSeriesKey = false;

  for (let r = headerRow + 1; r < aoa.length; r++) {
    const row = aoa[r] || [];
    // 행 전체가 빈 칸이면 skip
    if (!row.some((c) => hasVal(c))) continue;

    // 컬럼 → 필드 raw 값 추출
    const rec = {};
    for (const [colStr, field] of Object.entries(fieldByCol)) {
      rec[field] = row[Number(colStr)];
    }
    // 1) 그룹 식별 필드(브랜드·모델명·시리즈키) 먼저 forward-fill
    for (const f of groupFillFields) {
      rec[f] = groupFill(f, rec[f]);
    }
    // 2) 모델 그룹 키 산출 — 시리즈키 우선, 없으면 (브랜드+모델명).
    //    이 키가 바뀌면 = 새 모델 시작 → memberFill 리셋 (직전 모델 값 차단).
    const groupKey = hasVal(rec.series_key)
      ? `S:${clean(rec.series_key)}`
      : `M:${clean(rec.brand)}|${clean(rec.model)}`;
    if (groupKey !== prevGroupKey) {
      memberFill = makeFiller();   // 모델 경계 — fill 상태 리셋 (§5.1)
      prevGroupKey = groupKey;
    }
    // 3) 나머지 모델 단위 필드 — 모델 그룹 안에서만 forward-fill
    for (const f of memberFillFields) {
      rec[f] = memberFill(f, rec[f]);
    }

    const brand = clean(rec.brand);
    const model = clean(rec.model);
    const categoryRaw = clean(rec.category_raw);
    const months = extractMonths(rec.months);
    const careRaw = clean(rec.care_raw);
    const monthlyFee = toNum(rec.monthly_fee);
    const rebate = toNum(rec.rebate);

    // 표 외 노트/제목/소계 행 추정: 핵심 식별값(브랜드+모델)이 모두 비면 skip
    if (!brand && !model) continue;

    stats.realRows++;

    // ─── 필수 컬럼 검증 (§5.3) ───
    const missing = [];
    if (!brand) missing.push('브랜드');
    if (!categoryRaw) missing.push('대분류');
    if (!model) missing.push('모델명');
    if (months == null) missing.push('약정기간');
    if (!careRaw) missing.push('케어서비스');
    if (monthlyFee == null) missing.push('월납부액/월렌탈료');
    if (rebate == null) missing.push('리베이트');
    if (missing.length) {
      stats.errorRows++;
      if (stats.errors.length < 50) {
        stats.errors.push({ row: r + 1, missing });
      }
      continue;   // 적재 보류
    }

    // ─── 카테고리 매핑 (§6.1) ───
    const slug = normalizeCategory(categoryRaw);
    if (!slug) {
      warnings.unmapped.add(`대분류 매핑실패:${categoryRaw}`);
    } else if (!CATEGORY_SLUGS.has(slug)) {
      warnings.notes.push(`카테고리 slug '${slug}' 가 봉이 38카테고리에 없음 (행 ${r + 1})`);
    }
    stats.categoryDist[slug || `(미매핑:${categoryRaw})`] =
      (stats.categoryDist[slug || `(미매핑:${categoryRaw})`] || 0) + 1;

    // ─── 렌탈사 → company (§6.2) ───
    // 렌탈사 컬럼 있으면 그 값, 없으면 브랜드(메이커)를 회사로
    const companyName = hasCompanyCol && hasVal(rec.company_raw)
      ? clean(rec.company_raw)
      : brand;
    if (!companies.has(companyName)) {
      const cm = commissionByName.get(companyName);
      companies.set(companyName, cm
        ? { ...cm, name: companyName }
        : {
            name: companyName,
            category_group: hasCompanyCol ? '가전렌탈사' : '정수기메이커',
          });
    }
    // 행 단위 수수료율(%) — 수수료정책 시트가 없을 때 company commission 보강
    const rowRatePct = toRate(rec.commission_rate_pct);
    if (rowRatePct != null && !commissionByName.has(companyName)) {
      const c = companies.get(companyName);
      if (c.commission_rate == null) {
        c.commission_method = 'rate';
        c.commission_rate = rowRatePct > 1 ? rowRatePct / 100 : rowRatePct;
        c.rental_fee_basis = /월/.test(clean(rec.commission_basis)) ? 'monthly' : 'total';
      }
    }

    // ─── 모델 그룹핑 키 (§5.2) ───
    // 시리즈키 있으면 시리즈키 단위로 1모델 (색상만 다른 모델을 1상품으로),
    // 없으면 (브랜드+모델명) 단위로 1모델.
    //  - product.model = 그룹 대표값(시리즈키 or 모델명).
    //  - 시리즈키 그룹일 때 실제 모델코드(색상)는 옵션 variant 차원으로 보존.
    const seriesKey = clean(rec.series_key);
    if (seriesKey) { usesSeriesKey = true; seriesKeyUsed.add(`${companyName}|${seriesKey}`); }
    modelKeyUsed.add(`${companyName}|${model}`);

    // product 의 model 컬럼 = 그룹 식별자. 옵션도 같은 값으로 link.
    const productModel = seriesKey || model;
    const productKey = `${companyName}|${productModel}`;
    if (!products.has(productKey)) {
      const name = clean(rec.name_full) || clean(rec.name_mid) || model;
      const metadata = {};
      if (hasVal(rec.final_rank)) metadata.final_rank = toNum(rec.final_rank);
      if (hasVal(rec.model_group)) metadata.model_group = clean(rec.model_group);
      if (seriesKey) {
        metadata.series_key = seriesKey;
        metadata.model_codes = [model];   // 시리즈에 묶인 실제 모델코드 목록
      }
      products.set(productKey, {
        company_name: companyName,
        brand,
        manufacturer: hasCompanyCol ? brand : null,   // 가전: 브랜드=제조사, 회사=렌탈사
        category_slug: slug,
        name,
        model: productModel,
        model_key: clean(rec.model_key) || toModelKey(model),
        product_url: clean(rec.product_url) || null,
        image_url: clean(rec.image_url) || null,
        display_rank: toNum(rec.display_rank),
        market_score: toNum(rec.market_score),
        registration_status: clean(rec.registration_status) || null,
        evaluation_memo: clean(rec.evaluation_memo) || null,
        is_active: clean(rec.registration_status).toUpperCase() === 'X' ? false : true,
        billigo_status: '신규',
        metadata,
      });
    } else {
      // 같은 그룹 후속 행 — 비어 있던 모델 필드 보강 + 모델코드 누적
      const p = products.get(productKey);
      if (!p.category_slug && slug) p.category_slug = slug;
      if ((!p.name || p.name === p.model)) {
        const nm = clean(rec.name_full) || clean(rec.name_mid);
        if (nm) p.name = nm;
      }
      if (seriesKey && p.metadata.model_codes && !p.metadata.model_codes.includes(model)) {
        p.metadata.model_codes.push(model);
      }
    }

    // ─── care_service 정규화 (§6.3) ───
    const careService = normalizeCare(careRaw);
    if (careService == null) {
      warnings.notes.push(`케어서비스 정규화 실패 "${careRaw}" → 셀프 기본 (행 ${r + 1})`);
    }
    const finalCare = careService || '셀프';
    stats.careServiceDist[finalCare] = (stats.careServiceDist[finalCare] || 0) + 1;
    if (!(careRaw in stats.careRawSamples)) {
      stats.careRawSamples[careRaw] = finalCare;
    }

    // ─── variant 차원 — 케어 원본 + 색상/규격 + (시리즈그룹이면) 모델코드 ───
    // care_service 가 방문/셀프로 압축되면서 사라진 케어 원본("프리미엄"·"라이트"
    // 같은 등급 차이)을 variant 에 보존 → 같은 약정·케어인데 등급만 다른 행이
    // 7튜플 자연키에서 충돌하지 않게 한다.
    // 시리즈키 그룹은 product.model 이 시리즈키라 색상 모델코드가 옵션 차원이 됨.
    const variantSpec = clean(rec.variant_spec);
    const careRawNorm = careService && careRaw === finalCare ? '' : careRaw;
    const variantParts = [];
    if (seriesKey && model !== productModel) variantParts.push(model);   // 색상 모델코드
    if (variantSpec) variantParts.push(variantSpec);
    if (careRawNorm) variantParts.push(careRawNorm);
    const variant = variantParts.join(' / ');

    // ─── option metadata ───
    const optMeta = {};
    if (careRawNorm) optMeta.care_raw = careRaw;
    if (seriesKey) optMeta.model_code = model;        // 시리즈 그룹 — 실제 모델코드
    if (hasVal(rec.area)) optMeta.area = clean(rec.area);
    if (hasVal(rec.as_period)) optMeta.as_period = clean(rec.as_period);
    if (hasVal(rec.age_limit)) optMeta.age_limit = clean(rec.age_limit);
    if (hasVal(rec.install_fee)) optMeta.install_fee = toNum(rec.install_fee);
    if (hasVal(rec.total_fee)) optMeta.total_fee = toNum(rec.total_fee);   // 검산용 보존 (§F3)
    if (hasVal(rec.note)) optMeta.note = clean(rec.note);

    optionsRaw.push({
      company_name: companyName,
      model: productModel,    // product 와 동일 키 — runImportCommit 의 product 매칭용
      months,
      care_service: finalCare,
      inspection_cycle: rec.inspection_cycle != null ? extractMonths(rec.inspection_cycle) : null,
      ownership_months: rec.ownership_months != null ? extractMonths(rec.ownership_months) : null,
      normal_price: toNum(rec.normal_price),
      monthly_fee: monthlyFee,
      monthly_diff: toNum(rec.monthly_diff),
      half_fee: toNum(rec.half_fee),
      half_period: rec.half_period != null ? extractMonths(rec.half_period) : null,
      rebate,
      rebate_otherco: toNum(rec.rebate_otherco),
      rebate_half: toNum(rec.rebate_half),
      bundle_rate: toNum(rec.bundle_rate),
      promo_type: clean(rec.promo_tag) || null,
      commission_method: commissionByName.get(companyName)?.commission_method
        || (toRate(rec.commission_rate_pct) != null ? 'rate' : 'direct'),
      variant_code: variant,
      variant_label: variant || '기본',
      total_fee: hasVal(rec.total_fee) ? toNum(rec.total_fee) : null,
      metadata: Object.keys(optMeta).length ? optMeta : undefined,
      // 옵션 단위 컬럼 전부 서명 — dedup/variant 변별용 (finalizeVariants 가 제거)
      _optSig: buildOptionSig(rec),
    });
  }

  // ─── variant 마감 — 자연키 7튜플 충돌 0 + dedup ───
  const { collisions, deduped } = finalizeVariants(optionsRaw);
  if (collisions > 0) {
    warnings.notes.push(`⚠️ 자연키 잔여 충돌 ${collisions}건 — finalizeVariants 검토 필요`);
  }

  // ─── 모델 그룹핑 통계 ───
  stats.modelGrouping = usesSeriesKey
    ? { key: '시리즈키', modelCount: products.size, seriesKeyGroups: seriesKeyUsed.size }
    : { key: '(브랜드+모델명)', modelCount: products.size };

  bySheet[DETAIL_SHEET] = {
    headerRow,
    realRows: stats.realRows,
    products: products.size,
    options: optionsRaw.length,
    errorRows: stats.errorRows,
  };

  return {
    companies: [...companies.values()],
    products: [...products.values()],
    options: optionsRaw,
    warnings: {
      unmapped: [...warnings.unmapped].sort(),
      notes: warnings.notes,
    },
    bySheet,
    keyCollisions: collisions,
    stats: { ...stats, dedupedRows: deduped },
  };
}

export default parseRentalRegisterExcel;

// 내부 헬퍼는 검증/테스트용으로도 노출
export {
  normalizeCategory,
  normalizeCare,
  toModelKey,
  extractMonths,
  naturalKey,
  finalizeVariants,
  detectHeader,
  CATEGORY_SLUGS,
  HEADER_MAP,
};
