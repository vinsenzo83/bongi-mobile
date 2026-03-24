// 채팅 AI 도구 정의 + 실행 — 3사 실제 데이터 기반
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { stores } from '../data/stores.js';
import { customers } from '../data/mock/store.js';
import { supabase } from '../db/supabase.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const providerDir = join(__dirname, '..', 'data', 'providers');

// 데이터 로드 (서버 시작 시 1회)
const allProviders = JSON.parse(readFileSync(join(providerDir, 'all_providers.json'), 'utf8'));
const productCatalog = JSON.parse(readFileSync(join(providerDir, 'product_catalog.json'), 'utf8'));
const bundleDiscount = JSON.parse(readFileSync(join(providerDir, 'bundle_discount_detail.json'), 'utf8'));
const mobilePlans = {
  skt: JSON.parse(readFileSync(join(providerDir, 'skt_mobile.json'), 'utf8')),
  kt: JSON.parse(readFileSync(join(providerDir, 'kt_mobile.json'), 'utf8')),
  lg: JSON.parse(readFileSync(join(providerDir, 'lguplus_mobile.json'), 'utf8')),
};

// 모바일(핸드폰) 판매 시세 데이터
let mobilePrices = {};
try {
  mobilePrices = JSON.parse(readFileSync(join(providerDir, 'mobile_prices.json'), 'utf8'));
} catch { /* 파일 없으면 빈 객체 */ }

// 중고폰 매입 시세 데이터
let tradeinPhones = [];
try {
  tradeinPhones = JSON.parse(readFileSync(join(providerDir, 'tradein_phones.json'), 'utf8'));
} catch { /* 파일 없으면 빈 배열 */ }

// 가전렌탈 상품 데이터 (rentre.kr)
let rentalProducts = {};
try {
  rentalProducts = JSON.parse(readFileSync(join(providerDir, 'rental_products.json'), 'utf8'));
} catch { /* 파일 없으면 빈 객체 */ }

// 렌탈 제휴카드 데이터
let rentalCards = [];
try {
  const rentalCardsData = JSON.parse(readFileSync(join(providerDir, 'rental_cards.json'), 'utf8'));
  rentalCards = rentalCardsData.cards || rentalCardsData;
} catch { /* 파일 없으면 빈 배열 */ }

const mobileCount = Object.values(mobilePrices.carriers || {}).reduce((s, c) => s + (c.plans?.length || 0), 0);
const rentalCount = Object.values(rentalProducts).reduce((s, arr) => s + arr.length, 0);
console.log(`✅ 3사 데이터 로드: 상품 ${Object.keys(productCatalog).length}개, 모바일요금제 ${mobilePlans.skt.length + mobilePlans.kt.length + mobilePlans.lg.length}개, 핸드폰시세 ${mobileCount}개, 중고폰매입 ${tradeinPhones.length}개, 가전렌탈 ${rentalCount}개, 제휴카드 ${rentalCards.length}개`);

// Claude Tool Use 도구 정의
export const TOOLS = [
  {
    name: 'search_products',
    description: '인터넷/TV 상품을 검색합니다. 결합 종류와 회선 수에 따라 할인이 달라집니다.',
    input_schema: {
      type: 'object',
      properties: {
        provider: { type: 'string', enum: ['skt', 'kt', 'lg'], description: '통신사' },
        speed: { type: 'string', description: '속도 (100M/500M/1G)' },
        include_tv: { type: 'boolean', description: 'TV 포함 여부 (기본 true)' },
        include_wifi: { type: 'boolean', description: '와이파이 포함 여부' },
        bundle_type: { type: 'string', description: 'SKT: 온가족할인/요즘가족결합, KT: 총액가족결합, LG: 참쉬운가족결합. 고객 상황에 맞게 선택.' },
        num_lines: { type: 'number', description: '결합 회선 수 (1~5). 요즘가족결합 등에서 회선 수별 할인이 다름.' },
      },
    },
  },
  {
    name: 'get_product_detail',
    description: '상품번호로 상세 정보를 조회합니다. 예: S001, K016, L034',
    input_schema: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: '상품번호 (S001, K016, L034 등)' },
      },
      required: ['product_id'],
    },
  },
  {
    name: 'compare_products',
    description: '2~3개 상품을 비교표로 보여줍니다.',
    input_schema: {
      type: 'object',
      properties: {
        product_ids: {
          type: 'array',
          items: { type: 'string' },
          description: '비교할 상품번호 배열',
        },
      },
      required: ['product_ids'],
    },
  },
  {
    name: 'get_bundle_discount',
    description: '결합할인 정보를 조회합니다. 통신사별 결합 유형, 회선 수별 할인 금액.',
    input_schema: {
      type: 'object',
      properties: {
        provider: { type: 'string', enum: ['skt', 'kt', 'lg'] },
        num_lines: { type: 'number', description: '결합 회선 수 (1~5)' },
      },
      required: ['provider'],
    },
  },
  {
    name: 'search_mobile_plans',
    description: '모바일 요금제를 검색합니다. 결합할인 계산에 필요.',
    input_schema: {
      type: 'object',
      properties: {
        provider: { type: 'string', enum: ['skt', 'kt', 'lg'] },
        max_fee: { type: 'number', description: '월 최대 요금' },
        network: { type: 'string', enum: ['5G', 'LTE'], description: '네트워크 유형' },
      },
      required: ['provider'],
    },
  },
  {
    name: 'get_card_discounts',
    description: '통신사별 제휴카드 할인 정보를 조회합니다.',
    input_schema: {
      type: 'object',
      properties: {
        provider: { type: 'string', enum: ['skt', 'kt', 'lg'] },
      },
      required: ['provider'],
    },
  },
  {
    name: 'search_mobile_prices',
    description: '핸드폰 기기 판매 가격(번호이동/기기변경)을 조회합니다. 공시지원금 기준. 중요: 폴드와 플립은 완전히 다른 모델이므로 정확히 구분해서 입력하세요.',
    input_schema: {
      type: 'object',
      properties: {
        provider: { type: 'string', enum: ['skt', 'kt', 'lg'], description: '통신사' },
        model: { type: 'string', description: '정확한 모델명. 폴드7=Z Fold7, 플립7=Z Flip7 (완전히 다른 모델). 예: 갤럭시 Z 폴드7, 갤럭시 Z 플립7, 아이폰 17 에어' },
      },
    },
  },
  {
    name: 'create_lead',
    description: '고객이 상담/가입을 원할 때 CRM에 리드를 등록합니다.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        phone: { type: 'string' },
        product_id: { type: 'string', description: '관심 상품번호' },
        message: { type: 'string' },
      },
      required: ['phone'],
    },
  },
  {
    name: 'request_callback',
    description: '상담사 콜백을 요청합니다.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        phone: { type: 'string' },
        preferred_time: { type: 'string', description: '희망 시간' },
        product_id: { type: 'string' },
      },
      required: ['phone'],
    },
  },
  {
    name: 'check_store',
    description: '리턴AI 직영 매장 정보를 조회합니다.',
    input_schema: {
      type: 'object',
      properties: {
        region: { type: 'string', description: '지역' },
      },
    },
  },
  {
    name: 'estimate_tradein',
    description: '중고폰 매입 예상 가격을 안내합니다. 실시간 트레딧 시세 기반.',
    input_schema: {
      type: 'object',
      properties: {
        brand: { type: 'string', description: '제조사 (Apple, 삼성전자, LG)' },
        model: { type: 'string', description: '모델명 (예: 아이폰 16 프로 맥스, 갤럭시 S25 울트라)' },
        condition: { type: 'string', enum: ['상', '중', '하', 'A', 'B', 'C', 'D', 'E'], description: '기기 상태' },
        storage: { type: 'string', description: '용량 (예: 256G, 512G, 1T)' },
      },
      required: ['model'],
    },
  },
  {
    name: 'search_rental',
    description: '가전렌탈 상품을 검색합니다. 공기청정기, TV, 세탁건조기, 비데 카테고리.',
    input_schema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['air-purifier', 'tv', 'washer-dryer', 'bidet', 'water-purifier', 'fridge', 'air-conditioner', 'dish-washer', 'robot-cleaner', 'massage-chair', 'dryer', 'dresser'],
          description: '카테고리: water-purifier(정수기), air-purifier(공기청정기), tv(TV), washer-dryer(세탁건조기), bidet(비데), fridge(냉장고), air-conditioner(에어컨), dish-washer(식기세척기), robot-cleaner(로봇청소기), massage-chair(안마의자), dryer(건조기), dresser(의류관리기)',
        },
        brand: { type: 'string', description: '브랜드 (코웨이, LG, 삼성, 쿠쿠, 현대큐밍, 현대유버스 등)' },
        max_price: { type: 'number', description: '월 렌탈료 상한 (원)' },
      },
    },
  },
  {
    name: 'compare_rental',
    description: '2~3개 렌탈 상품을 비교합니다. 상품 ID로 비교.',
    input_schema: {
      type: 'object',
      properties: {
        product_ids: {
          type: 'array',
          items: { type: 'string' },
          description: '비교할 상품 ID 배열 (예: ["1522012053", "1600003603"])',
        },
      },
      required: ['product_ids'],
    },
  },
  {
    name: 'get_rental_detail',
    description: '렌탈 상품 ID로 상세 정보를 조회합니다.',
    input_schema: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: '상품 ID' },
      },
      required: ['product_id'],
    },
  },
];

// 도구 실행
export async function executeTool(name, input) {
  switch (name) {
    case 'search_products': return searchProducts(input);
    case 'get_product_detail': return getProductDetail(input);
    case 'compare_products': return compareProducts(input);
    case 'get_bundle_discount': return getBundleDiscount(input);
    case 'search_mobile_plans': return searchMobilePlans(input);
    case 'get_card_discounts': return getCardDiscounts(input);
    case 'search_mobile_prices': return searchMobilePrices(input);
    case 'create_lead': return createLead(input);
    case 'request_callback': return requestCallback(input);
    case 'check_store': return checkStore(input);
    case 'estimate_tradein': return estimateTradein(input);
    case 'search_rental': return searchRental(input);
    case 'compare_rental': return compareRental(input);
    case 'get_rental_detail': return getRentalDetail(input);
    default: return { error: `알 수 없는 도구: ${name}` };
  }
}

// ─── 도구 구현 ───

function searchProducts({ provider, speed, include_tv, include_wifi, bundle_type, num_lines }) {
  if (!provider) {
    return {
      message: '통신사를 선택해주세요. SKT, KT, LG U+ 3사 모두 취급합니다.',
      providers: {
        SKT: { 상품수: Object.values(productCatalog).filter(p => p.provider === 'SKT').length },
        KT: { 상품수: Object.values(productCatalog).filter(p => p.provider === 'KT').length },
        'LG U+': { 상품수: Object.values(productCatalog).filter(p => p.provider === 'LG U+').length },
      },
    };
  }

  const provData = allProviders[provider];
  if (!provData) return { error: '해당 통신사 데이터가 없습니다' };

  const provName = provData.provider;
  const itvList = provData.internet_tv || [];
  const cards = provData.cards || [];

  // 최고 카드할인 찾기
  const bestCard = cards.reduce((best, c) => (c.discount_amount > (best?.discount_amount || 0) ? c : best), null);
  const cardDiscount = bestCard?.discount_amount || 0;

  // 결합할인 (고객 조건에 따라 동적 계산)
  const bd = bundleDiscount[provider] || {};
  let bundleDiscountAmount = 0;
  let bundleDiscountName = '';
  let iptvDiscount = 0;
  let phoneDiscount = 0;

  // 결합 종류 결정 (고객 지정 or 기본값 = 요즘가족결합 계열)
  const defaultBundle = { skt: '요즘가족결합', kt: '총액가족결합', lg: '참쉬운가족결합' };
  const selectedBundle = bundle_type || defaultBundle[provider] || '';
  const lines = num_lines || 1;

  const bundleData = bd[selectedBundle];
  if (bundleData) {
    bundleDiscountName = selectedBundle;

    // 테이블 기반 결합 (요즘가족결합 등 — 속도/회선별 할인)
    if (bundleData.table && Array.isArray(bundleData.table)) {
      const speedMap = { '100M': '에코노미', '500M': '라이트', '1G': '기가' };
      const selectedSpeed = speed || '500M';
      // 속도에 맞는 테이블 찾기
      const speedTable = bundleData.table.find(t =>
        t.internet?.includes(selectedSpeed) || t.internet?.includes(speedMap[selectedSpeed])
      ) || bundleData.table[0];

      if (speedTable?.rows) {
        const lineStr = `${lines}회선`;
        const row = speedTable.rows.find(r => r['회선수'] === lineStr) || speedTable.rows[speedTable.rows.length - 1];
        bundleDiscountAmount = Math.abs(row?.인터넷할인 || 0);
        iptvDiscount = Math.abs(row?.IPTV할인 || 0);
        phoneDiscount = Math.abs(row?.휴대폰할인 || 0);
      }
    }
    // 단순 고정 할인 (온가족할인, 총액가족결합 등)
    else if (bundleData.인터넷할인) {
      bundleDiscountAmount = Math.abs(bundleData.인터넷할인);
    }
    // KT 총액가족결합
    else if (bundleData['프리미엄_에센스_베이직']) {
      bundleDiscountAmount = 5500;
    }
    // fallback
    else {
      bundleDiscountAmount = 5500;
    }
  }

  // 속도 키 매핑
  const speedKey = {
    '100M': 'price_100m', '100m': 'price_100m',
    '500M': 'price_500m', '500m': 'price_500m',
    '1G': 'price_1g', '1g': 'price_1g',
  };
  const giftKey = {
    '100M': 'gift_100m', '100m': 'gift_100m',
    '500M': 'gift_500m', '500m': 'gift_500m',
    '1G': 'gift_1g', '1g': 'gift_1g',
  };

  // 1대결합 상품만 (실제 고객이 가입하는 가격)
  let results = itvList.filter(p => p.type === '1대결합');

  // TV 필터
  if (include_tv === true) {
    results = results.filter(p =>
      p.name.includes('TV') || p.name.includes('Btv') || p.name.includes('지니') ||
      p.name.includes('실속') || p.name.includes('기본형') || p.name.includes('프리미엄') ||
      p.name.includes('넷플릭스') || p.name.includes('디즈니') ||
      (p.channels && p.channels !== '')
    );
  } else if (include_tv === false) {
    results = results.filter(p => p.name === '인터넷');
  }

  // 미결합 상품에서 사은품 가져오기
  const unconbinedList = itvList.filter(p => p.type === '미결합');

  // 속도별 계산
  const speeds = speed ? [speed] : ['500M']; // 기본 500M

  // 인터넷 단독 1대결합 가격 (TV 요금 분리용)
  const internetOnly = itvList.find(p => p.type === '1대결합' && p.name === '인터넷');

  // 셋탑박스 기본 요금 (스마트3 기본)
  const settopBoxes = provData.settop_box || [];
  const defaultSettop = settopBoxes.find(s => (s['셋톱박스'] || s.name || '').includes('스마트3') && !(s['셋톱박스'] || s.name || '').includes('미니'));
  const settopFee = defaultSettop ? parseInt(String(defaultSettop['월 임대료'] || '0').replace(/[^0-9]/g, '')) : 4400;

  // WiFi 기본 요금
  const wifiOptions = provData.wifi || [];
  const defaultWifi = wifiOptions.find(w => (w.구분 || '').includes('WiFi 6') || (w.구분 || '').includes('기가')) || wifiOptions[0];
  const wifiFee = include_wifi && defaultWifi ? parseInt(String(defaultWifi['100M'] || '0').replace(/[^0-9]/g, '')) : 0;

  const products = results.map(p => {
    const sk = speedKey[speeds[0]] || 'price_500m';
    const gk = giftKey[speeds[0]] || 'gift_500m';
    const monthlyFee = p[sk];
    if (!monthlyFee) return null;

    // 인터넷/TV 요금 분리
    const internetFee = internetOnly?.[sk] || monthlyFee;
    const hasTV = p.name.includes('TV') || p.name.includes('Btv') || p.name.includes('지니');
    const tvFee = hasTV ? (monthlyFee - internetFee) : 0;

    // 사은품은 미결합 상품에서 가져옴 (이름 긴 순서 우선)
    const uncombinedMatches = unconbinedList
      .filter(u => p.name.includes(u.name) || u.name.includes(p.name))
      .sort((a, b) => b.name.length - a.name.length);
    const uncombined = uncombinedMatches[0];
    const gift = uncombined?.[gk] || p[gk] || '-';

    // 최종 요금 = 인터넷+TV + 셋탑 + WiFi - 결합할인 - 카드할인
    const totalBeforeDiscount = monthlyFee + (hasTV ? settopFee : 0) + wifiFee;
    const finalPrice = totalBeforeDiscount - bundleDiscountAmount - iptvDiscount - cardDiscount;

    // 상품번호 찾기
    const catalogEntries = Object.entries(productCatalog).filter(([, v]) =>
      v.provider === provName && v.speed === speeds[0] &&
      (v.name === p.name || v.name.includes(p.name) || p.name.includes(v.name))
    );
    const catalogEntry = catalogEntries.sort((a, b) => b[1].name.length - a[1].name.length)[0];
    const productId = catalogEntry ? catalogEntry[0] : '-';

    return {
      상품번호: productId,
      통신사: provName,
      상품명: p.name,
      속도: speeds[0],
      채널수: p.channels || '-',
      인터넷요금: `${internetFee.toLocaleString()}원`,
      ...(hasTV ? { TV요금: `${tvFee.toLocaleString()}원` } : {}),
      ...(hasTV ? { 셋탑박스: `${settopFee.toLocaleString()}원 (${defaultSettop?.['셋톱박스'] || '기본'})` } : {}),
      ...(wifiFee > 0 ? { WiFi: `${wifiFee.toLocaleString()}원 (${defaultWifi?.구분 || '기본'})` } : {}),
      '소계': `${totalBeforeDiscount.toLocaleString()}원`,
      결합할인: bundleDiscountAmount > 0 ? `-${(bundleDiscountAmount + iptvDiscount).toLocaleString()}원 (${bundleDiscountName}${lines > 1 ? ` ${lines}회선` : ''})` : '없음',
      ...(phoneDiscount > 0 ? { 휴대폰할인: `-${phoneDiscount.toLocaleString()}원/회선` } : {}),
      카드할인: cardDiscount > 0 ? `-${cardDiscount.toLocaleString()}원 (${bestCard.name})` : '없음',
      '★최종_월요금': `${Math.max(0, finalPrice).toLocaleString()}원`,
      사은품: gift,
    };
  }).filter(Boolean);

  return {
    provider: provName,
    속도: speeds[0],
    count: products.length,
    결합종류: bundleDiscountName || '없음',
    결합회선: lines,
    결합할인: bundleDiscountAmount > 0 ? `인터넷 -${bundleDiscountAmount.toLocaleString()}원${iptvDiscount > 0 ? ` + TV -${iptvDiscount.toLocaleString()}원` : ''}${phoneDiscount > 0 ? ` + 휴대폰 -${phoneDiscount.toLocaleString()}원/회선` : ''}` : '없음',
    최고카드: bestCard ? `${bestCard.name} (-${cardDiscount.toLocaleString()}원/월, ${bestCard.min_performance})` : '없음',
    '요금계산': `1대결합가 - 결합할인(${(bundleDiscountAmount + iptvDiscount).toLocaleString()}원) - 카드할인(${cardDiscount.toLocaleString()}원) = 최종요금`,
    products,
  };
}

function getProductDetail({ product_id }) {
  const id = product_id.toUpperCase();
  const product = productCatalog[id];
  if (!product) return { error: `상품번호 ${id}를 찾을 수 없습니다` };

  const provKey = { 'SKT': 'skt', 'KT': 'kt', 'LG U+': 'lg' }[product.provider];
  const provData = allProviders[provKey] || {};
  const itvList = provData.internet_tv || [];

  // 상품 매칭 (1대결합 우선)
  let matchedProduct = null;
  for (const itv of itvList) {
    if (itv.type === '1대결합' && product.name.includes(itv.name)) {
      matchedProduct = itv;
      break;
    }
  }
  if (!matchedProduct) {
    for (const itv of itvList) {
      if (product.name.includes(itv.name) || itv.name.includes(product.name.split('+')[0].trim())) {
        matchedProduct = itv;
        break;
      }
    }
  }

  // 미결합 상품에서 사은품 (이름이 가장 긴 = 정확한 매칭)
  const uncombinedList = itvList
    .filter(itv => itv.type === '미결합' && product.name.includes(itv.name))
    .sort((a, b) => b.name.length - a.name.length);
  const uncombined = uncombinedList[0] || null;
  const speedGiftKey = { '100M': 'gift_100m', '500M': 'gift_500m', '1G': 'gift_1g' }[product.speed] || 'gift_500m';
  const gift = uncombined?.[speedGiftKey] || matchedProduct?.[speedGiftKey] || '-';

  // 카드할인
  const cards = provData.cards || [];
  const bestCard = cards.reduce((best, c) => (c.discount_amount > (best?.discount_amount || 0) ? c : best), null);

  // 결합할인 정보 (bundle_discount_detail.json에서)
  const bdDetail = bundleDiscount[provKey] || {};
  const bundleOptions = Object.entries(bdDetail)
    .filter(([k]) => k !== 'provider')
    .map(([name, info]) => ({
      이름: name,
      설명: info.description || '',
      조건: info.conditions || '',
    }));

  // 셋탑박스
  const settopBoxes = provData.settop_box || [];

  // OTT 지원
  const ottSupport = provData.ott_support || [];

  // WiFi
  const wifiOptions = provData.wifi || [];

  // 설치비
  const installFee = provData.install_fee || {};

  // 속도별 가격 키
  const speedPriceKey = { '100M': 'price_100m', '500M': 'price_500m', '1G': 'price_1g' }[product.speed] || 'price_500m';
  const monthlyFee = matchedProduct?.[speedPriceKey] || product.price;

  return {
    상품번호: id,
    통신사: product.provider,
    상품명: product.name,
    속도: product.speed,

    // 요금 정보
    요금: {
      '1대결합_월요금': `${monthlyFee.toLocaleString()}원`,
      카드할인: bestCard ? { 카드명: bestCard.name, 할인: `-${bestCard.discount_amount?.toLocaleString()}원/월`, 실적조건: bestCard.min_performance || '-' } : '없음',
      최종월요금: bestCard ? `${(monthlyFee - (bestCard.discount_amount || 0)).toLocaleString()}원` : `${monthlyFee.toLocaleString()}원`,
    },
    사은품: gift,

    // TV 정보
    TV정보: matchedProduct ? {
      채널수: matchedProduct.channels || '-',
      상품명: matchedProduct.name,
    } : null,

    // 셋탑박스 옵션
    셋탑박스: settopBoxes.map(s => ({
      이름: s['셋톱박스'] || s.name,
      월임대료: s['월 임대료'] || s.fee,
      특징: s['특징'] || s.feature,
    })),

    // OTT 지원 현황
    OTT지원: ottSupport.slice(0, 3).map(o => ({
      셋탑: o.구분,
      넷플릭스: o.넷플릭스,
      유튜브: o.유튜브,
      디즈니플러스: o['디즈니+'],
      티빙: o.티빙,
      쿠팡플레이: o.쿠팡플레이,
    })),

    // 설치비
    설치비: {
      '평일_인터넷+TV': installFee['평일_인터넷+ TV'] || installFee['평일_인터넷+TV'] || '-',
      '주말_인터넷+TV': installFee['주말_인터넷+ TV'] || installFee['주말_인터넷+TV'] || '-',
      'TV추가_1대당': installFee['평일_TV추가(1대 당)'] || '-',
    },

    // WiFi 옵션
    WiFi: wifiOptions.slice(0, 3).map(w => ({
      이름: w.구분,
      특징: w.특징,
      요금: w['100M'] || w.fee || '-',
    })),

    // 결합할인 비교 (고객이 선택할 수 있도록)
    결합할인_옵션: bundleOptions,
  };
}

function compareProducts({ product_ids }) {
  const items = product_ids.map(id => {
    const p = productCatalog[id.toUpperCase()];
    if (!p) return { 상품번호: id, error: '찾을 수 없음' };
    return { 상품번호: id.toUpperCase(), 통신사: p.provider, 상품명: p.name, 속도: p.speed, '1대결합가': `${p.price.toLocaleString()}원` };
  });
  return { 비교: items };
}

function getBundleDiscount({ provider, num_lines }) {
  const data = bundleDiscount[provider];
  if (!data) return { error: '결합할인 데이터가 없습니다' };
  const notes = bundleDiscount['유의사항'] || {};

  // 회선 수별 요약 생성
  const summary = {};
  for (const [name, info] of Object.entries(data)) {
    if (name === 'provider') continue;
    summary[name] = {
      설명: info.description || '',
      조건: info.conditions || info.할인 || '',
    };
    if (info.table) {
      summary[name].회선별_할인 = info.table;
    }
    if (info['프리미엄_에센스_베이직']) {
      summary[name].총액별_할인 = info['프리미엄_에센스_베이직'];
    }
  }

  return {
    provider: data.provider || provider,
    결합_종류: Object.keys(summary),
    상세: summary,
    유의사항: notes,
    안내: num_lines
      ? `${num_lines}회선 결합 기준으로 가장 유리한 할인을 적용해드립니다.`
      : '회선 수를 알려주시면 정확한 결합할인을 계산해드릴게요.',
  };
}

function searchMobilePlans({ provider, max_fee, network }) {
  const plans = mobilePlans[provider] || [];
  let filtered = plans;

  if (max_fee) {
    filtered = filtered.filter(p => {
      const fee = parseInt(String(p.monthly_fee).replace(/,/g, ''));
      return !isNaN(fee) && fee <= max_fee;
    });
  }
  if (network) {
    filtered = filtered.filter(p => p.network === network || p.category?.includes(network));
  }

  return {
    provider,
    count: filtered.length,
    plans: filtered.slice(0, 10).map(p => ({
      이름: p.name,
      월정액: p.monthly_fee,
      네트워크: p.network || '',
      할인: p.discount_fee || '',
    })),
  };
}

function getCardDiscounts({ provider }) {
  const provData = allProviders[provider];
  if (!provData) return { error: '데이터 없음' };
  return {
    provider: provData.provider,
    cards: (provData.cards || []).map(c => ({
      카드사: c.issuer,
      카드명: c.name,
      할인금액: c.discount_amount ? `${c.discount_amount.toLocaleString()}원/월` : '-',
      실적조건: c.min_performance || '-',
      기간: c.period || '-',
    })),
  };
}

async function createLead({ name, phone, product_id, message }) {
  // 전화번호 형식 검증
  if (!phone || !/^01[016789]-?\d{3,4}-?\d{4}$/.test(phone.replace(/\*/g, '0'))) {
    return { success: false, error: '올바른 전화번호를 입력해주세요 (예: 010-1234-5678)' };
  }

  const leadId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // Supabase에 저장
  if (supabase) {
    try {
      const { data, error } = await supabase.from('bongi_applications').insert({
        type: 'ai_chat',
        channel: 'ai_chat',
        name: name || '',
        phone,
        product_ticket: product_id || null,
        form_data: { message: message || '', source: 'chat_ai' },
        status: 'new',
      }).select('id').single();

      if (!error && data) {
        // Mock 고객 DB에도 추가 (어드민에서 보이도록)
        const exists = customers.find(c => c.phone === phone);
        if (!exists) {
          customers.unshift({
            name: name || '채팅고객',
            source: 'kakao_chat',
            phone,
            type: '자연유입',
            product: product_id ? '인터넷/TV' : '미정',
            agent: '미배정',
            status: '신규유입',
            time: '방금 (AI채팅)',
          });
        }
        console.log(`📥 AI채팅 리드 등록: ${name || phone} (${product_id || '미정'})`);
        return {
          success: true,
          lead_id: data.id,
          message: `상담 신청이 접수되었습니다! 상담사가 곧 연락드릴게요. 😊`,
          ui: { type: 'lead_confirmed', lead_id: data.id, phone },
        };
      }
    } catch (e) {
      console.warn('Supabase 리드 저장 실패:', e.message);
    }
  }

  // Supabase 없으면 Mock
  customers.unshift({
    name: name || '채팅고객',
    source: 'kakao_chat',
    phone,
    type: '자연유입',
    product: product_id ? '인터넷/TV' : '미정',
    agent: '미배정',
    status: '신규유입',
    time: '방금 (AI채팅)',
  });

  return {
    success: true,
    lead_id: leadId,
    message: '상담 신청이 접수되었습니다! 상담사가 곧 연락드릴게요. 😊',
    ui: { type: 'lead_confirmed', lead_id: leadId, phone },
  };
}

async function requestCallback({ name, phone, preferred_time, product_id }) {
  if (!phone || !/^01[016789]-?\d{3,4}-?\d{4}$/.test(phone.replace(/\*/g, '0'))) {
    return { success: false, error: '올바른 전화번호를 입력해주세요 (예: 010-1234-5678)' };
  }

  // Supabase에 저장
  if (supabase) {
    try {
      await supabase.from('bongi_applications').insert({
        type: 'callback',
        channel: 'ai_chat',
        name: name || '',
        phone,
        product_ticket: product_id || null,
        form_data: {
          preferred_time: preferred_time || '가능한 빨리',
          source: 'chat_ai',
        },
        status: 'new',
      });
      console.log(`📞 AI채팅 콜백 요청: ${name || phone} (${preferred_time || 'ASAP'})`);
    } catch (e) {
      console.warn('Supabase 콜백 저장 실패:', e.message);
    }
  }

  // Mock 고객 DB 추가
  const exists = customers.find(c => c.phone === phone);
  if (!exists) {
    customers.unshift({
      name: name || '콜백고객',
      source: 'callback',
      phone,
      type: '자연유입',
      product: product_id ? '인터넷/TV' : '미정',
      agent: '미배정',
      status: '콜백요청',
      time: '방금 (AI채팅)',
    });
  }

  return {
    success: true,
    message: `콜백 요청 완료! ${preferred_time || '가능한 빨리'} 연락드리겠습니다. 😊`,
    phone,
    preferred_time: preferred_time || '가능한 빨리',
    ui: { type: 'callback_confirmed', phone },
  };
}

function searchMobilePrices({ provider, model }) {
  const carriers = mobilePrices.carriers || {};

  // 모델명 정규화
  const normalize = (s) => s.toLowerCase()
    .replace(/갤럭시\s*/g, '').replace(/galaxy\s*/g, '')
    .replace(/아이폰\s*/g, 'iphone').replace(/iphone\s*/g, 'iphone')
    .replace(/프로\s*맥스/g, 'pm').replace(/프로/g, 'p')
    .replace(/울트라/g, 'u').replace(/ultra/g, 'u')
    .replace(/플립/g, 'flip').replace(/flip/g, 'flip')
    .replace(/폴드/g, 'fold').replace(/fold/g, 'fold')
    .replace(/에어/g, 'air').replace(/플러스/g, '+')
    .replace(/\s+/g, '').trim();

  const query = model ? normalize(model) : '';

  // 통신사 필터
  const targetCarriers = provider
    ? { [provider]: carriers[provider] }
    : carriers;

  const results = [];

  for (const [key, carrier] of Object.entries(targetCarriers)) {
    if (!carrier?.plans) continue;

    const filtered = model
      ? carrier.plans.filter(p => {
          const n = normalize(p.model);
          const s = normalize(p.short);
          return n.includes(query) || s.includes(query) || query.includes(s);
        })
      : carrier.plans;

    for (const p of filtered) {
      const fmtPrice = (v) => {
        if (v === 0) return '공짜폰!';
        if (v < 0) return `기기값 0원 + ${Math.abs(v)}만원 캐시백`;
        return `${v}만원`;
      };

      results.push({
        통신사: carrier.name,
        모델: p.model,
        '번호이동(공시)': fmtPrice(p['번이']),
        '기기변경(공시)': fmtPrice(p['기변']),
        '번이_raw': p['번이'],
        '기변_raw': p['기변'],
      });
    }
  }

  // 부가서비스
  const addServices = {};
  const svcData = mobilePrices.additional_services || {};
  for (const [key, svcs] of Object.entries(svcData)) {
    if (key === 'conditions') continue; // 조건 설명은 스킵
    if (!Array.isArray(svcs)) continue;
    if (provider && key !== provider) continue;
    const carrierName = carriers[key]?.name || key;
    addServices[carrierName] = svcs.map(s => ({
      서비스: s.service,
      월정액: typeof s.fee === 'number' ? `${s.fee.toLocaleString()}원` : s.fee,
      유지기간: s.period || '-',
    }));
  }

  if (results.length === 0) {
    return {
      error: `"${model || ''}" 모델을 찾을 수 없습니다.`,
      안내: '정확한 모델명으로 다시 검색해주세요. 폴드와 플립은 다른 모델입니다. 예: 갤럭시 Z 폴드7, 갤럭시 Z 플립7, 아이폰 17 에어',
      available_models: Object.values(carriers).flatMap(c => (c.plans || []).map(p => p.model)),
    };
  }

  return {
    date: mobilePrices.date || '미정',
    count: results.length,
    단위: '만원 (번호이동/기기변경 기준)',
    요금제: Object.fromEntries(
      Object.entries(targetCarriers).map(([key, c]) => [
        c.name,
        { 요금제: c['5g_plan'] || (mobilePrices['5g_plans']?.[key]?.plan || '-'), 월정액: mobilePrices['5g_plans']?.[key]?.fee || 0 }
      ])
    ),
    results: results.slice(0, 15),
    부가서비스: addServices,
    안내: '공시지원금 기준 가격이며 매일 변동됩니다. 정확한 가격은 상담사에게 문의해주세요.',
  };
}

function checkStore({ region }) {
  let result = stores;
  if (region) {
    result = stores.filter(s => s.name.includes(region) || s.address.includes(region));
  }
  return {
    count: result.length,
    stores: result.map(s => ({ name: s.name, address: s.address, phone: s.phone, hours: s.hours })),
  };
}

function estimateTradein({ brand, model, condition, storage }) {
  if (!model) return { error: '모델명을 알려주세요 (예: 아이폰 16 프로, 갤럭시 S25 울트라)' };

  const query = model.toLowerCase()
    .replace(/아이폰/g, 'iphone')
    .replace(/갤럭시/g, 'galaxy')
    .replace(/프로\s*맥스/g, 'pro max')
    .replace(/프로/g, 'pro')
    .replace(/플러스/g, 'plus')
    .replace(/울트라/g, 'ultra')
    .replace(/플립/g, 'flip')
    .replace(/폴드/g, 'fold')
    .replace(/미니/g, 'mini')
    .replace(/에어/g, 'air')
    .trim();

  // 1차: full_name 매칭
  let matches = tradeinPhones.filter(p => {
    const name = p.full_name.toLowerCase();
    return name.includes(query) || query.includes(name.split(' ').slice(0, -1).join(' '));
  });

  // 2차: model 필드 매칭
  if (matches.length === 0) {
    matches = tradeinPhones.filter(p => {
      const name = p.model.toLowerCase();
      return name.includes(query) || query.includes(name);
    });
  }

  // 3차: 키워드 분할 매칭
  if (matches.length === 0) {
    const keywords = query.split(/\s+/).filter(w => w.length > 1);
    matches = tradeinPhones.filter(p => {
      const name = p.full_name.toLowerCase();
      return keywords.every(kw => name.includes(kw));
    });
  }

  if (matches.length === 0) {
    return {
      model,
      error: '해당 모델을 찾을 수 없습니다.',
      message: `"${model}" 모델을 데이터에서 찾지 못했어요.\n정확한 모델명을 알려주시거나, 매장에서 직접 확인해드릴 수 있어요!`,
      available_brands: ['Apple (iPhone)', '삼성전자 (Galaxy)', 'LG'],
    };
  }

  // 용량 필터 (지정된 경우)
  if (storage) {
    const storageQuery = storage.toUpperCase().replace(/GB?/i, 'G').replace(/TB?/i, 'T');
    const storageMatches = matches.filter(p => p.storage.toUpperCase().includes(storageQuery));
    if (storageMatches.length > 0) matches = storageMatches;
  }

  // 등급 매핑 (상/중/하 → A/B/C)
  const gradeMap = { '상': 'A', '중': 'B', '하': 'C', 'A': 'A', 'B': 'B', 'C': 'C', 'D': 'D', 'E': 'E' };
  const grade = gradeMap[condition] || 'B';

  // 용량별로 그룹핑해서 보여주기
  const results = matches.slice(0, 5).map(p => {
    const price = p.prices[grade] || p.prices['B'] || p.prices['A'] || 0;
    return {
      모델명: p.full_name,
      용량: p.storage,
      등급: `${grade}등급`,
      매입가: `${price.toLocaleString()}원`,
      전등급: Object.entries(p.prices)
        .map(([g, v]) => `${g}등급: ${v.toLocaleString()}원`)
        .join(' / '),
    };
  });

  const topPrice = Math.max(...matches.map(p => p.prices['A'] || 0));

  return {
    model,
    brand: matches[0]?.manufacturer || brand || '확인필요',
    condition: condition || '중',
    grade,
    count: results.length,
    '최대매입가(A등급)': `${topPrice.toLocaleString()}원`,
    results,
    message: results.length === 1
      ? `${results[0].모델명} ${grade}등급 매입가: ${results[0].매입가}\n(A등급 최대: ${topPrice.toLocaleString()}원)`
      : `${model} 매입가를 찾았어요! 용량별로 확인해주세요.`,
    안내: '정확한 금액은 매장 방문 시 기기 상태 검수 후 확정됩니다.',
  };
}

// ─── 가전렌탈 검색 ───

const RENTAL_CATEGORY_NAMES = {
  'air-purifier': '공기청정기',
  'tv': 'TV',
  'washer-dryer': '세탁건조기',
  'bidet': '비데',
  'water-purifier': '정수기',
  'fridge': '냉장고',
  'air-conditioner': '에어컨',
  'dish-washer': '식기세척기',
  'robot-cleaner': '로봇청소기',
  'massage-chair': '안마의자',
  'dryer': '건조기',
  'dresser': '의류관리기',
};

function searchRental({ category, brand, max_price }) {
  if (!category) {
    const summary = Object.entries(rentalProducts).map(([cat, items]) => ({
      카테고리: RENTAL_CATEGORY_NAMES[cat] || cat,
      상품수: items.length,
      가격범위: `${Math.min(...items.map(i => i.monthlyRental)).toLocaleString()}원 ~ ${Math.max(...items.map(i => i.monthlyRental)).toLocaleString()}원`,
    }));
    return {
      message: '어떤 가전을 찾으세요? 카테고리를 선택해주세요.',
      categories: summary,
    };
  }

  let items = rentalProducts[category] || [];
  if (items.length === 0) {
    return { error: `${RENTAL_CATEGORY_NAMES[category] || category} 카테고리에 상품이 없습니다.` };
  }

  if (brand) {
    const brandLower = brand.toLowerCase();
    items = items.filter(i =>
      i.brand.toLowerCase().includes(brandLower) ||
      i.name.toLowerCase().includes(brandLower)
    );
  }

  if (max_price) {
    items = items.filter(i => i.monthlyRental <= max_price);
  }

  // 브랜드별 최고 카드할인 매핑
  const brandCardMap = {};
  for (const card of rentalCards) {
    const brand = card.rentalBrand;
    const maxDiscount = card.maxMonthlyDiscount || 0;
    if (!brandCardMap[brand] || maxDiscount > brandCardMap[brand].maxDiscount) {
      brandCardMap[brand] = { name: card.cardName, maxDiscount, condition: card.discountCondition || '' };
    }
  }

  const results = items
    .sort((a, b) => a.monthlyRental - b.monthlyRental)
    .map(i => {
      // 카드할인 매칭 (브랜드명 유연 매칭)
      const cardInfo = brandCardMap[i.brand]
        || brandCardMap[i.brand + '전자']
        || Object.entries(brandCardMap).find(([k]) => k.includes(i.brand))?.[1]
        || null;
      // 부가기능 (additionalFunctions 또는 mainFunctions)
      const funcs = (i.specs?.additionalFunctions || []).map(f => f.funcName || f).filter(Boolean).slice(0, 4);
      const rating = i.rating || {};
      const pricing = i.pricing || {};
      const colors = (i.colorOptions || []).map(c => c.name).filter(Boolean);
      return {
        상품ID: i.id,
        상품명: i.name,
        브랜드: i.brand,
        모델번호: i.model,
        월렌탈료: `${i.monthlyRental.toLocaleString()}원`,
        사은품: i.gift ? `${i.gift.toLocaleString()}원` : '-',
        ...(pricing.halfPricePromotion ? { 반값프로모션: true } : {}),
        ...(cardInfo ? { 카드할인: `최대 -${cardInfo.maxDiscount.toLocaleString()}원 (${cardInfo.name})` } : {}),
        ...(funcs.length > 0 ? { 주요기능: funcs.join(', ') } : {}),
        ...(rating.value ? { 평점: `${rating.value}점 (${rating.reviewCount || 0}건)` } : {}),
        ...(colors.length > 0 ? { 색상: `${colors.length}가지` } : {}),
        상품URL: i.url,
        썸네일: i.thumbnail || '',
        이미지: i.images?.[0] || '',
      };
    });

  return {
    카테고리: RENTAL_CATEGORY_NAMES[category],
    count: results.length,
    results,
  };
}

// ─── 렌탈 상품 비교 ───

function getAllRentalProducts() {
  return Object.values(rentalProducts).flat();
}

function findRentalById(productId) {
  return getAllRentalProducts().find(item => item.id === productId || item.sku === productId);
}

function compareRental({ product_ids }) {
  if (!Array.isArray(product_ids) || product_ids.length < 2 || product_ids.length > 3) {
    return { error: '2~3개 상품 ID를 입력해주세요.' };
  }

  const found = [];
  const notFound = [];

  for (const pid of product_ids) {
    const item = findRentalById(pid);
    if (item) {
      found.push({
        상품ID: item.id,
        상품명: item.name,
        브랜드: item.brand,
        모델번호: item.model,
        월렌탈료: `${item.monthlyRental.toLocaleString()}원`,
        사은품: item.gift ? `${item.gift.toLocaleString()}원` : '-',
        카테고리: RENTAL_CATEGORY_NAMES[item.category] || item.category,
        상품URL: item.url,
        썸네일: item.thumbnail || '',
      });
    } else {
      notFound.push(pid);
    }
  }

  return {
    비교: found,
    count: found.length,
    ...(notFound.length > 0 ? { error: `찾을 수 없는 상품 ID: ${notFound.join(', ')}` } : {}),
  };
}

// ─── 렌탈 상품 상세 ───

function getRentalDetail({ product_id }) {
  const item = findRentalById(product_id);
  if (!item) {
    return { error: `상품 ID ${product_id}를 찾을 수 없습니다.` };
  }

  const specs = item.specs || {};
  const pricing = item.pricing || {};
  const rating = item.rating || {};

  // 색상 옵션
  const colors = (item.colorOptions || []).map(c => c.name).filter(Boolean);

  // 약정 옵션
  const contracts = (item.contractOptions || []).map(c =>
    (c.details || []).map(d => d.content).join('\n')
  ).filter(Boolean);

  // 관리 서비스
  const services = (item.serviceInfo || []).map(s => ({
    유형: s.tabName,
    내용: (s.details || []).map(d => `${d.title}: ${d.content}`).join('\n'),
  }));

  // 부가기능
  const functions = (specs.additionalFunctions || []).map(f => f.funcName || (typeof f === 'string' ? f : '')).filter(Boolean);

  // 카드할인 매칭
  const brandCards = rentalCards.filter(c =>
    item.brand && c.rentalBrand && (
      c.rentalBrand.includes(item.brand) || item.brand.includes(c.rentalBrand.replace('전자',''))
    )
  );
  const bestCard = brandCards.sort((a, b) => (b.maxMonthlyDiscount || 0) - (a.maxMonthlyDiscount || 0))[0];

  return {
    상품ID: item.id,
    상품명: item.name,
    브랜드: item.brand,
    모델번호: item.model,
    카테고리: RENTAL_CATEGORY_NAMES[item.category] || item.category,
    월렌탈료: `${item.monthlyRental.toLocaleString()}원`,
    사은품: item.gift ? `${item.gift.toLocaleString()}원` : '-',
    ...(pricing.halfPricePromotion ? { 반값프로모션: `${pricing.halfPriceMonths || ''}개월간 반값` } : {}),
    ...(colors.length > 0 ? { 색상옵션: colors.join(', ') } : {}),
    ...(specs.dimensions ? { 크기: `${specs.dimensions.width}x${specs.dimensions.depth}x${specs.dimensions.height}mm` } : {}),
    ...(specs.recommendedAreaPyung ? { 적용면적: `${specs.recommendedAreaPyung}평` } : {}),
    ...(functions.length > 0 ? { 주요기능: functions.join(', ') } : {}),
    ...(rating.value ? { 평점: `${rating.value}점 (${rating.reviewCount || 0}건)` } : {}),
    ...(item.attentionCount ? { 견적비교: item.attentionCount } : {}),
    ...(bestCard ? { 카드할인: `${bestCard.cardName} 최대 ${(bestCard.maxMonthlyDiscount || 0).toLocaleString()}원/월` } : {}),
    ...(contracts.length > 0 ? { 약정혜택: contracts[0] } : {}),
    ...(services.length > 0 ? { 관리서비스: services } : {}),
    상품URL: item.url,
    썸네일: item.thumbnail || '',
    이미지: item.images || [],
  };
}
