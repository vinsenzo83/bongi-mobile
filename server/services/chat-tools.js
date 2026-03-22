// 채팅 AI 도구 정의 + 실행 — 3사 실제 데이터 기반
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { stores } from '../data/stores.js';
import { customers } from '../data/mock/store.js';

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

console.log(`✅ 3사 데이터 로드: 상품 ${Object.keys(productCatalog).length}개, 모바일 ${mobilePlans.skt.length + mobilePlans.kt.length + mobilePlans.lg.length}개`);

// Claude Tool Use 도구 정의
export const TOOLS = [
  {
    name: 'search_products',
    description: '인터넷/TV 상품을 검색합니다. 통신사(skt/kt/lg), 속도(100M/500M/1G), TV 포함 여부로 검색.',
    input_schema: {
      type: 'object',
      properties: {
        provider: { type: 'string', enum: ['skt', 'kt', 'lg'], description: '통신사' },
        speed: { type: 'string', description: '속도 (100M/500M/1G)' },
        include_tv: { type: 'boolean', description: 'TV 포함 여부' },
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
    description: '봉이모바일 직영 매장 정보를 조회합니다.',
    input_schema: {
      type: 'object',
      properties: {
        region: { type: 'string', description: '지역' },
      },
    },
  },
  {
    name: 'estimate_tradein',
    description: '중고폰 매입 예상 가격을 안내합니다.',
    input_schema: {
      type: 'object',
      properties: {
        brand: { type: 'string' },
        model: { type: 'string' },
        condition: { type: 'string', enum: ['상', '중', '하'] },
      },
      required: ['model'],
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
    case 'create_lead': return createLead(input);
    case 'request_callback': return requestCallback(input);
    case 'check_store': return checkStore(input);
    case 'estimate_tradein': return estimateTradein(input);
    default: return { error: `알 수 없는 도구: ${name}` };
  }
}

// ─── 도구 구현 ───

function searchProducts({ provider, speed, include_tv }) {
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

  // 결합할인 (1대결합 기준 — 모바일 1회선 가정)
  const bd = bundleDiscount[provider] || {};
  let bundleDiscountAmount = 0;
  let bundleDiscountName = '';

  // KT: 총액가족결합 기본 (22,000원 이상 → -5,500원)
  if (provider === 'kt' && bd['총액가족결합']?.['프리미엄_에센스_베이직']) {
    bundleDiscountAmount = 5500;
    bundleDiscountName = '총액가족결합';
  }
  // SKT: 온가족할인
  if (provider === 'skt' && bd['온가족할인']) {
    const info = bd['온가족할인'];
    bundleDiscountAmount = info.인터넷할인 ? Math.abs(info.인터넷할인) : 5500;
    bundleDiscountName = '온가족할인';
  }
  // LG: 참쉬운가족결합
  if (provider === 'lg' && bd['참쉬운가족결합']) {
    const info = bd['참쉬운가족결합'];
    bundleDiscountAmount = info.인터넷할인 ? Math.abs(info.인터넷할인) : 5500;
    bundleDiscountName = '참쉬운가족결합';
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
    results = results.filter(p => p.name.includes('TV') || p.name.includes('Btv') || p.name.includes('지니'));
  } else if (include_tv === false) {
    results = results.filter(p => p.name === '인터넷');
  }

  // 미결합 상품에서 사은품 가져오기
  const unconbinedList = itvList.filter(p => p.type === '미결합');

  // 속도별 계산
  const speeds = speed ? [speed] : ['500M']; // 기본 500M

  const products = results.map(p => {
    const sk = speedKey[speeds[0]] || 'price_500m';
    const gk = giftKey[speeds[0]] || 'gift_500m';
    const monthlyFee = p[sk];
    if (!monthlyFee) return null;

    // 사은품은 미결합 상품에서 가져옴
    const uncombined = unconbinedList.find(u => u.name === p.name);
    const gift = uncombined?.[gk] || p[gk] || '-';

    // 최종 요금 = 1대결합가 - 결합할인 - 카드할인
    const finalPrice = monthlyFee - bundleDiscountAmount - cardDiscount;

    // 상품번호 찾기
    const catalogEntry = Object.entries(productCatalog).find(([, v]) =>
      v.provider === provName && v.name.includes(p.name.split('+')[0].trim()) && v.speed === speeds[0]
    );
    const productId = catalogEntry ? catalogEntry[0] : '-';

    return {
      상품번호: productId,
      상품명: p.name,
      속도: speeds[0],
      채널수: p.channels || '-',
      '인터넷+TV_월요금': `${monthlyFee.toLocaleString()}원`,
      결합할인: bundleDiscountAmount > 0 ? `-${bundleDiscountAmount.toLocaleString()}원 (${bundleDiscountName})` : '없음',
      카드할인: cardDiscount > 0 ? `-${cardDiscount.toLocaleString()}원 (${bestCard.name})` : '없음',
      '★최종_월요금': `${Math.max(0, finalPrice).toLocaleString()}원`,
      사은품: gift,
    };
  }).filter(Boolean);

  return {
    provider: provName,
    속도: speeds[0],
    count: products.length,
    결합할인: bundleDiscountAmount > 0 ? `${bundleDiscountName} (-${bundleDiscountAmount.toLocaleString()}원/월)` : '없음',
    최고카드: bestCard ? `${bestCard.name} (-${cardDiscount.toLocaleString()}원/월, ${bestCard.min_performance})` : '없음',
    '요금계산': `인터넷+TV - 결합할인(${bundleDiscountAmount.toLocaleString()}원) - 카드할인(${cardDiscount.toLocaleString()}원) = 최종요금`,
    products,
  };
}

function getProductDetail({ product_id }) {
  const id = product_id.toUpperCase();
  const product = productCatalog[id];
  if (!product) return { error: `상품번호 ${id}를 찾을 수 없습니다` };

  // 통신사 데이터에서 상세 정보 찾기
  const provKey = { 'SKT': 'skt', 'KT': 'kt', 'LG U+': 'lg' }[product.provider];
  const provData = allProviders[provKey] || {};
  const itvList = provData.internet_tv || [];

  // 관련 인터넷+TV 상품 매칭
  let detail = null;
  for (const itv of itvList) {
    if (product.name.includes(itv.name) || itv.name.includes(product.speed)) {
      detail = itv;
      break;
    }
  }

  // 카드할인 정보
  const cards = provData.cards || [];
  const bestCard = cards.length > 0 ? cards[0] : null;

  return {
    상품번호: id,
    통신사: product.provider,
    상품명: product.name,
    속도: product.speed,
    '1대결합가': `${product.price.toLocaleString()}원`,
    카드할인: bestCard ? `${bestCard.name} -${bestCard.discount_amount?.toLocaleString()}원/월` : '없음',
    설치비: provData.install_fee || {},
    detail: detail || null,
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

function createLead({ name, phone, product_id, message }) {
  const lead = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: name || '',
    phone,
    productId: product_id || null,
    message: message || '',
    type: 'chat',
    status: 'new',
    createdAt: new Date().toISOString(),
  };

  customers.unshift({
    name: name || '채팅고객',
    source: 'kakao_chat',
    phone,
    type: '자연유입',
    product: product_id ? '인터넷/TV' : '미정',
    agent: '미배정',
    status: '신규유입',
    time: '방금 (채팅)',
  });

  return { success: true, lead_id: lead.id, message: '상담 신청이 접수되었습니다! 상담사가 곧 연락드릴게요.' };
}

function requestCallback({ name, phone, preferred_time, product_id }) {
  return {
    success: true,
    message: `콜백 요청 완료! ${preferred_time || '가능한 빨리'} 연락드리겠습니다.`,
    phone,
    preferred_time: preferred_time || '가능한 빨리',
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

function estimateTradein({ brand, model, condition }) {
  const basePrice = {
    'iphone 15 pro max': 900000, 'iphone 15 pro': 750000, 'iphone 15': 600000,
    'iphone 14 pro max': 650000, 'iphone 14 pro': 550000, 'iphone 14': 450000,
    'iphone 13': 300000, 'iphone 12': 200000,
    'galaxy s24 ultra': 800000, 'galaxy s24+': 600000, 'galaxy s24': 500000,
    'galaxy s23 ultra': 600000, 'galaxy s23': 400000,
    'galaxy z flip5': 450000, 'galaxy z fold5': 700000,
  };

  const key = model.toLowerCase();
  let price = 0;
  for (const [k, v] of Object.entries(basePrice)) {
    if (key.includes(k) || k.includes(key)) { price = v; break; }
  }
  if (!price) price = 150000;

  const mult = { '상': 1.0, '중': 0.7, '하': 0.4 };
  price = Math.round(price * (mult[condition] || 0.7));

  return {
    model, brand: brand || '확인필요', condition: condition || '중',
    estimatedPrice: `${price.toLocaleString()}원`,
    message: `${model} (${condition || '중'} 상태) 예상 매입가: ${price.toLocaleString()}원\n정확한 가격은 매장 방문 또는 상담사 확인이 필요합니다.`,
  };
}
