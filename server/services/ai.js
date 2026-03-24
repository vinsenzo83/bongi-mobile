import Anthropic from '@anthropic-ai/sdk';
import { products, categories } from '../data/products.js';

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

if (!client) console.warn('⚠ ANTHROPIC_API_KEY 미설정 — AI 기능 비활성화');

const SYSTEM_PROMPT = `당신은 리턴AI의 AI 상담 어시스턴트입니다.

## 리턴AI 소개
- 광주/전라 8개 직영 매장을 운영하는 통신 판매 전문 기업
- 인터넷+TV, 가전렌탈, 알뜰폰(유심), 중고폰 매입 4가지 상품을 취급
- 대표번호: 1600-XXXX

## 상품 데이터
${JSON.stringify(products, null, 2)}

## 역할
1. 고객의 질문에 친절하고 정확하게 답변
2. 고객의 상황에 맞는 최적의 상품 추천
3. 요금 비교 및 할인 혜택 안내
4. 신청 유도 (티켓번호 안내 → 전화 연결 또는 셀프가입)
5. 복잡한 질문은 상담사 연결 유도

## 규칙
- 항상 한국어로 답변
- 가격/요금 정보는 정확하게 (데이터에 있는 것만)
- 모르는 것은 "상담사에게 확인해드리겠습니다"로 안내
- 추천 시 반드시 티켓번호(예: K227)를 함께 안내
- 답변은 간결하게 (3~5문장 이내)
- 경쟁사 비방 금지
`;

// 고객용 AI 채팅
export async function chat(messages) {
  if (!client) {
    return { role: 'assistant', content: 'AI 서비스가 현재 비활성화 상태입니다. 1600-XXXX로 전화주시면 상담사가 도와드리겠습니다.' };
  }

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    });

    const text = response?.content?.[0]?.text;
    if (!text) throw new Error('빈 응답');
    return { role: 'assistant', content: text };
  } catch (e) {
    console.error('AI 채팅 에러:', e.message);
    return { role: 'assistant', content: '죄송합니다. 일시적인 오류가 발생했습니다. 1600-XXXX로 전화주시면 상담사가 도와드리겠습니다.' };
  }
}

// CRM 상담사용 — 업셀링 추천
export async function getUpsellRecommendation(customer) {
  if (!client) {
    return getStaticRecommendation(customer);
  }

  const prompt = `다음 고객 정보를 분석하고 업셀링 추천을 해주세요.

고객 정보:
- 이름: ${customer.name}
- DB 유형: ${customer.db_type} (mnp=통신사변경, device_change=기기변경, new=신규)
- 유입: ${customer.source}
- 상태: ${customer.status}
- 메모: ${customer.memo || '없음'}

다음 JSON 형식으로만 답변해주세요:
{
  "score": 0~100 (계약 확률),
  "topProducts": ["추천 상품 1", "추천 상품 2", "추천 상품 3"],
  "script": "상담사가 사용할 멘트 (1~2문장)",
  "reason": "추천 근거 (1문장)"
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('AI 추천 실패:', e.message);
  }

  return getStaticRecommendation(customer);
}

// AI 없을 때 정적 추천
function getStaticRecommendation(customer) {
  const recs = {
    mnp: {
      score: 75,
      topProducts: ['인터넷+TV 결합 (K227)', '가족 회선 추가', '중고폰 매입'],
      script: '개통 잘 되셨나요? 인터넷도 함께 결합하시면 추가 할인이 가능합니다.',
      reason: 'MNP 고객은 결합 상품 전환 확률이 높음',
    },
    device_change: {
      score: 60,
      topProducts: ['인터넷 결합 확인', '가전렌탈 (R001)', '중고폰 매입'],
      script: '기기변경 잘 되셨죠? 현재 인터넷 결합 여부를 확인해보니 추가 혜택이 있으십니다.',
      reason: '기변 고객은 기존 서비스 업그레이드 가능성 높음',
    },
    new: {
      score: 50,
      topProducts: ['전체 상품 안내', '결합할인 (K310)', '알뜰폰 (U001)'],
      script: '가입 감사합니다! 고객님께 맞는 최적의 결합상품을 안내해드릴 수 있습니다.',
      reason: '신규 고객은 전체 상품 노출이 효과적',
    },
  };
  return recs[customer.db_type] || recs.new;
}

// CRM 상담사용 — 상담 스크립트 생성
export async function generateScript(customer, product) {
  if (!client) {
    return `안녕하세요 ${customer.name}님, 리턴AI입니다. ${product ? product.name + ' 상품에 관심을 가져주셔서 감사합니다.' : '무엇을 도와드릴까요?'}`;
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `리턴AI 상담사 스크립트를 생성해주세요.
고객: ${customer.name} (${customer.db_type === 'mnp' ? '통신사 변경' : customer.db_type === 'device_change' ? '기기변경' : '신규'})
${product ? '관심 상품: ' + product.name : ''}
3문장 이내의 자연스러운 상담 오프닝 멘트를 만들어주세요.`,
    }],
  });

  return response.content[0].text;
}
