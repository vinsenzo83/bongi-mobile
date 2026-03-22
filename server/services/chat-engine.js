// 채팅 엔진 — Claude Tool Use 오케스트레이터
import Anthropic from '@anthropic-ai/sdk';
import { TOOLS, executeTool } from './chat-tools.js';
import { getSession, saveSession } from './chat-session.js';

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const SYSTEM_PROMPT = `당신은 봉이모바일 AI입니다. 인터넷/TV 사은품 전문 상담.

## 봉이모바일
- 광주/전라 8개 직영 매장
- SKT, KT, LG U+ 3사 전부 취급
- 아정당(ajd.co.kr) 기준 사은품 지급
- 인터넷+TV, 모바일 결합, 가전렌탈, 알뜰폰, 중고폰 매입

## 상품 데이터
- 3사 인터넷/TV 상품 51개 (상품번호: S001~S017, K001~K020, L001~L014)
- 3사 모바일 요금제 273개 (결합할인 계산용)
- 결합할인 상세 (요금제별/회선별)
- 제휴카드 할인 (통신사별)
- 모든 데이터는 반드시 도구로 조회. 절대 추측하지 마.

## 대화 규칙

1. 한국어, 친근한 대화체 ("~해요", "~거든요")
2. **정보가 부족하면 짧게 질문한다. 추측 추천 금지.**
   - 통신사 미선택 → "선호하시는 통신사 있으세요? (SKT/KT/LG 다 가능!)"
   - 용도 모르면 → "몇 분이 쓰시나요? TV도 필요하세요?"
   - 질문은 한 번에 1개만, 최대 2~3번이면 추천 가능
3. 추천 시 반드시:
   - 상품번호 포함 (예: \`S005\`, \`K016\`)
   - 1대결합 월요금
   - 사은품 금액 (가장 중요!)
   - 카드할인 적용 시 최종 월요금
4. 추천은 2개까지. "🥇 추천 1", "🥈 추천 2" 형식
5. 사은품/캐시백을 최우선 강조 — 고객은 사은품 받으러 온 사람
6. 고객이 관심 보이면 자연스럽게: "상담사 연결하면 추가 혜택도 있어요!"
7. "전화주세요" → request_callback 호출
8. 결합할인 질문 → get_bundle_discount + search_mobile_plans
9. 카드할인 질문 → get_card_discounts
10. 답변은 짧고 핵심만. 스크롤 최소화.

## 추천 형식 (이것만 출력!)

🎁 **사은품 최대 XX만원!**

**🥇 추천 1: [상품명]** \`S005\`
| 항목 | 내용 |
|------|------|
| 📶 인터넷 | ○○ XXXM |
| 📺 TV | ○○ (XX채널) |
| 🎁 **사은품** | **XX만원** |
| 💳 카드할인 | -XX,XXX원/월 |
| ✅ **월 요금** | **XX,XXX원** |

## 금지
- 데이터에 없는 가격/혜택 지어내기
- 통신사 미확인 상태에서 특정 통신사 추천
- 경쟁사 비방
- 강제 정보 수집
- 한 번에 3개 이상 추천`;

// 메시지 처리
export async function processMessage(sessionId, userMessage) {
  const session = getSession(sessionId);
  if (!session) throw new Error('세션을 찾을 수 없습니다');

  session.messages.push({ role: 'user', content: userMessage });

  // API 키 없으면 Mock 응답
  if (!client) {
    const mockReply = getMockReply(userMessage);
    session.messages.push({ role: 'assistant', content: mockReply });
    await saveSession(session);
    return { reply: mockReply, ui_elements: [] };
  }

  // Claude Tool Use 호출
  let response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: TOOLS,
    messages: session.messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
  });

  // Tool Use 루프
  let loopCount = 0;
  while (response.stop_reason === 'tool_use' && loopCount < 5) {
    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
    const toolResults = [];

    for (const block of toolUseBlocks) {
      const result = await executeTool(block.name, block.input);
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(result),
      });
    }

    session.messages.push({ role: 'assistant', content: response.content });
    session.messages.push({ role: 'user', content: toolResults });

    response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages: session.messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    });

    loopCount++;
  }

  // 최종 응답 추출
  const textBlocks = response.content.filter(b => b.type === 'text');
  const reply = textBlocks.map(b => b.text).join('\n');

  session.messages.push({ role: 'assistant', content: response.content });
  await saveSession(session);

  return {
    reply,
    ui_elements: extractUIElements(response.content),
  };
}

// UI 요소 추출 (도구 결과에서)
function extractUIElements(content) {
  const elements = [];
  // 향후: 도구 결과에서 상품 카드, 비교표 등 추출
  // Phase B에서 구현
  return elements;
}

// Mock 응답 (API 키 없을 때)
function getMockReply(message) {
  const q = message.toLowerCase();

  if (q.includes('인터넷') || q.includes('tv')) {
    return '안녕하세요! 봉이모바일이에요 🐟\n\n인터넷+TV 상품 추천드릴게요!\n\n**🥇 추천 1: KT 인터넷+TV 500Mbps** `K227`\n- 월 실납부: 14,700원\n- 🎁 현금 사은품: **370,000원**\n\n**🥈 추천 2: KT 인터넷+TV 1Gbps** `K310`\n- 월 실납부: 20,200원\n- 🎁 현금 사은품: **420,000원**\n\n어떤 게 끌리세요? 상담사 연결하면 추가 혜택도 있어요! 😊';
  }

  if (q.includes('렌탈') || q.includes('정수기') || q.includes('공기청정기')) {
    return '가전렌탈도 준비되어 있어요!\n\n**🥇 코웨이 정수기 아이콘2** `R001`\n- 월 35,900원 / 5년\n- 🎁 현금 150,000원\n\n**🥈 LG 공기청정기** `R002`\n- 월 29,900원 / 5년\n- 🎁 현금 100,000원\n\n관심 있으시면 상담사가 더 자세히 안내해드릴 수 있어요!';
  }

  if (q.includes('알뜰') || q.includes('유심')) {
    return '알뜰폰 추천드려요!\n\n**데이터 11GB** `U001` — 월 12,100원\n**데이터 무제한** `U003` — 월 19,800원\n\n번호이동도 간편하게 도와드려요!';
  }

  if (q.includes('중고폰') || q.includes('팔') || q.includes('매입')) {
    return '중고폰 매입도 가능해요!\n\n기기 모델명을 알려주시면 예상 매입가를 알려드릴게요.\n예: "아이폰 15 팔고 싶어"';
  }

  if (q.includes('매장') || q.includes('어디')) {
    return '광주/전라에 8개 직영 매장이 있어요!\n\n📍 광주: 충장로점, 상무점, 수완점, 첨단점\n📍 전남: 목포점, 여수점, 순천점\n📍 전북: 전주점\n\n가까운 매장이 어디세요?';
  }

  if (q.includes('상담') || q.includes('전화') || q.includes('연결')) {
    return '상담사 연결해드릴게요!\n\n📞 대표번호: **1600-XXXX**\n\n또는 연락처 남겨주시면 상담사가 전화드릴게요!';
  }

  return '안녕하세요! 봉이모바일 AI에요 🐟\n\n인터넷+TV, 가전렌탈, 알뜰폰, 중고폰 매입까지!\n무엇이든 편하게 물어보세요.\n\n예시:\n• "인터넷 추천해줘"\n• "정수기 렌탈 얼마야?"\n• "알뜰폰 저렴한 거"\n• "아이폰 15 매입가"';
}
