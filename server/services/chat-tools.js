// 채팅 AI 도구 정의 + 실행
import { products, categories } from '../data/products.js';
import { stores } from '../data/stores.js';
import { customers } from '../data/mock/store.js';

// Claude Tool Use 도구 정의
export const TOOLS = [
  {
    name: 'search_products',
    description: '봉이모바일 상품을 검색합니다. 카테고리(internet/rental/usim/usedPhone), 통신사, 속도, 가격 범위로 필터링.',
    input_schema: {
      type: 'object',
      properties: {
        category: { type: 'string', enum: ['internet', 'rental', 'usim', 'usedPhone'], description: '상품 카테고리' },
        carrier: { type: 'string', description: '통신사 (KT/SK/LG)' },
        max_price: { type: 'number', description: '월 최대 요금' },
        speed: { type: 'string', description: '인터넷 속도 (100Mbps/500Mbps/1Gbps)' },
      },
    },
  },
  {
    name: 'compare_products',
    description: '2~3개 상품을 비교표로 보여줍니다.',
    input_schema: {
      type: 'object',
      properties: {
        product_tickets: {
          type: 'array',
          items: { type: 'string' },
          description: '비교할 상품 티켓 코드 (예: ["K227", "K310"])',
        },
      },
      required: ['product_tickets'],
    },
  },
  {
    name: 'calculate_price',
    description: '상품의 할인/캐시백 포함 실제 월 납부액을 계산합니다.',
    input_schema: {
      type: 'object',
      properties: {
        product_ticket: { type: 'string', description: '상품 티켓 코드' },
      },
      required: ['product_ticket'],
    },
  },
  {
    name: 'create_lead',
    description: '고객이 상담/가입을 원할 때 CRM에 리드를 등록합니다.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '고객 이름' },
        phone: { type: 'string', description: '연락처' },
        interested_product: { type: 'string', description: '관심 상품 티켓' },
        message: { type: 'string', description: '요청 요약' },
      },
      required: ['phone'],
    },
  },
  {
    name: 'request_callback',
    description: '상담사가 고객에게 전화하도록 콜백 요청을 등록합니다.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        phone: { type: 'string' },
        preferred_time: { type: 'string', description: '희망 시간 (오전/오후/저녁/가능한빨리)' },
        product_ticket: { type: 'string' },
      },
      required: ['phone'],
    },
  },
  {
    name: 'check_store',
    description: '봉이모바일 직영 매장 정보를 조회합니다. 지역으로 필터링 가능.',
    input_schema: {
      type: 'object',
      properties: {
        region: { type: 'string', description: '지역 (광주/전주/목포/여수/순천)' },
      },
    },
  },
  {
    name: 'estimate_tradein',
    description: '중고폰 매입 예상 가격을 안내합니다.',
    input_schema: {
      type: 'object',
      properties: {
        brand: { type: 'string', description: '브랜드 (삼성/애플 등)' },
        model: { type: 'string', description: '모델명' },
        condition: { type: 'string', enum: ['상', '중', '하'], description: '기기 상태' },
      },
      required: ['model'],
    },
  },
];

// 도구 실행
export async function executeTool(name, input) {
  switch (name) {
    case 'search_products': return searchProducts(input);
    case 'compare_products': return compareProducts(input);
    case 'calculate_price': return calculatePrice(input);
    case 'create_lead': return createLead(input);
    case 'request_callback': return requestCallback(input);
    case 'check_store': return checkStore(input);
    case 'estimate_tradein': return estimateTradein(input);
    default: return { error: `알 수 없는 도구: ${name}` };
  }
}

// ─── 도구 구현 ───

function searchProducts({ category, carrier, max_price, speed }) {
  let results = [];
  const cats = category ? [category] : Object.keys(products);

  for (const cat of cats) {
    const items = products[cat] || [];
    for (const item of items) {
      let match = true;
      if (carrier && item.carrier && !item.carrier.includes(carrier)) match = false;
      if (max_price && (item.actualPrice || item.monthlyPrice) > max_price) match = false;
      if (speed && item.speed && !item.speed.includes(speed)) match = false;
      if (match) results.push({ ...item, category: cat });
    }
  }

  return {
    count: results.length,
    products: results.map(p => ({
      ticket: p.ticket,
      name: p.name,
      carrier: p.carrier || p.brand || '',
      category: p.category,
      monthlyPrice: p.actualPrice || p.monthlyPrice,
      cashback: p.cashback || 0,
      speed: p.speed || '',
      contract: p.contract || '',
    })),
  };
}

function compareProducts({ product_tickets }) {
  const items = [];
  for (const ticket of product_tickets) {
    for (const cat of Object.values(products)) {
      const found = cat.find(p => p.ticket === ticket);
      if (found) { items.push(found); break; }
    }
  }

  return {
    products: items.map(p => ({
      ticket: p.ticket,
      name: p.name,
      carrier: p.carrier || p.brand || '',
      monthlyPrice: p.actualPrice || p.monthlyPrice,
      originalPrice: p.monthlyPrice,
      cashback: p.cashback || 0,
      speed: p.speed || '',
      type: p.type || '',
      contract: p.contract || '',
      extras: p.extras || p.features || [],
    })),
  };
}

function calculatePrice({ product_ticket }) {
  for (const cat of Object.values(products)) {
    const p = cat.find(item => item.ticket === product_ticket);
    if (p) {
      const bundleDiscount = p.discounts?.bundle || 0;
      const cardDiscount = p.discounts?.card || 0;
      const actual = p.monthlyPrice + bundleDiscount + cardDiscount;
      return {
        ticket: p.ticket,
        name: p.name,
        monthlyPrice: p.monthlyPrice,
        bundleDiscount,
        cardDiscount,
        actualPrice: actual,
        cashback: p.cashback || 0,
      };
    }
  }
  return { error: '상품을 찾을 수 없습니다' };
}

function createLead({ name, phone, interested_product, message }) {
  const lead = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: name || '',
    phone,
    productTicket: interested_product || null,
    message: message || '',
    type: 'chat',
    channel: 'chat',
    status: 'new',
    createdAt: new Date().toISOString(),
  };

  // Mock DB에 추가
  customers.unshift({
    name: name || '채팅고객',
    source: 'kakao_chat',
    phone,
    type: '자연유입',
    product: interested_product ? '인터넷/TV' : '미정',
    agent: '미배정',
    status: '신규유입',
    time: '방금 (채팅)',
  });

  return { success: true, lead_id: lead.id, message: '상담 신청이 접수되었습니다. 상담사가 곧 연락드리겠습니다.' };
}

function requestCallback({ name, phone, preferred_time, product_ticket }) {
  return {
    success: true,
    message: `콜백 요청이 접수되었습니다. ${preferred_time || '가능한 빨리'} ${name ? name + '님에게' : ''} 연락드리겠습니다.`,
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
    stores: result.map(s => ({
      name: s.name,
      address: s.address,
      phone: s.phone,
      hours: s.hours,
    })),
  };
}

function estimateTradein({ brand, model, condition }) {
  // Mock 견적 (실제 연동 시 외부 API 호출)
  const basePrice = {
    'iphone 15': 600000, 'iphone 14': 450000, 'iphone 13': 300000,
    'galaxy s24': 550000, 'galaxy s23': 400000, 'galaxy s22': 250000,
  };

  const key = model.toLowerCase();
  let price = basePrice[key] || 200000;

  const conditionMultiplier = { '상': 1.0, '중': 0.7, '하': 0.4 };
  price = Math.round(price * (conditionMultiplier[condition] || 0.7));

  return {
    model,
    brand: brand || '확인필요',
    condition: condition || '중',
    estimatedPrice: price,
    message: `${model} (${condition || '중'} 상태) 예상 매입가: ${price.toLocaleString()}원. 정확한 가격은 매장 방문 또는 상담사 확인이 필요합니다.`,
  };
}
