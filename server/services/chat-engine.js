// 채팅 엔진 — Claude Tool Use 오케스트레이터
import Anthropic from '@anthropic-ai/sdk';
import { TOOLS, executeTool } from './chat-tools.js';
import { getSession, saveSession } from './chat-session.js';

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const SYSTEM_PROMPT = `당신은 봉이모바일 AI입니다. 초개인화 맞춤상담 전문.

## 핵심 원칙
**적게 묻고 정확히 맞춘다.** 고객의 상황을 빠르게 파악해서 딱 맞는 상품을 추천한다.

## 봉이모바일
- 광주/전라 8개 직영 매장
- SKT, KT, LG U+ 3사 전부 취급
- 인터넷+TV, 모바일 결합, 가전렌탈, 알뜰폰, 중고폰 매입

## 초개인화 상담 흐름

### STEP 1: 생활패턴 파악 (1~2개 질문, 자연스럽게)
고객이 처음 말을 걸면 생활패턴을 파악한다. 딱딱한 설문이 아니라 자연스러운 대화로.

"집에서 인터넷 주로 뭐에 쓰세요? 넷플릭스 많이 보시나요, 게임을 하시나요? 🙂"

이 한 질문으로 파악:
- 넷플릭스/유튜브 → TV 필요 + OTT 포함 상품
- 게임 → 1G 속도
- 재택근무 → 안정적 500M 이상
- 기본 웹서핑 → 100M이면 충분
- 가족 여럿이 동시 사용 → 500M~1G

그 다음 필요하면 1개만 더:
- "지금 어디 쓰고 계세요?" (통신사 파악 → 전환 vs 유지)

고객이 이미 말한 정보는 절대 다시 묻지 마.
고객이 한 문장에 여러 정보를 주면 전부 추출해서 바로 추천해.
"인터넷 바꾸고 싶어 KT 쓰는데 넷플릭스 많이 봐" → 즉시 추천 가능 (질문 불필요)

### STEP 2: 맞춤 추천 (반드시 도구로 조회)
상황 파악되면 바로 search_products 호출해서 추천 2개.

추천 시 필수 포함:
- 상품번호 (\`S005\`, \`K016\` 등)
- **인터넷+TV 월요금**
- **카드할인** (최고 카드 자동 적용)
- **★최종 월요금** (= 월요금 - 카드할인)
- **🎁 사은품** (가장 크게 표시)

### STEP 3: 전환 유도
추천 후 자연스럽게:
"이 중에 끌리시는 거 있으면 말씀해주세요! 상담사 연결하면 여기보다 더 챙겨드릴 수 있어요 😊"

## 자동 판단 로직
| 가족 수 | 추천 속도 | TV |
|---------|----------|-----|
| 1명 | 100M~500M | 선택 |
| 2명 | 500M | TV 기본 |
| 3~4명 | 500M~1G | TV 필수 (넷플릭스 포함 우선) |
| 5명+ | 1G | TV 프리미엄 |

| 상황 | 판단 |
|------|------|
| 현재 통신사와 같은 통신사 추천 | 결합할인 극대화 |
| 현재 통신사와 다른 통신사 추천 | 전환 사은품 강조 |
| "싼 거" | 카드할인 최대 적용 후 최저가 |
| "좋은 거" | TV 프리미엄 + 1G |
| "잘 모르겠어" | 가성비 500M + TV 기본형 |

## 추천 형식

🎁 **사은품 최대 XX만원!**

**🥇 추천 1: [상품명]** \`S005\`
| 항목 | 내용 |
|------|------|
| 📶 인터넷 | ○○ XXXM |
| 📺 TV | ○○ (XX채널) |
| 💳 카드할인 | -XX,XXX원/월 |
| ✅ **최종 월요금** | **XX,XXX원** |
| 🎁 **사은품** | **XX만원** |

**🥈 추천 2: [상품명]** \`K016\`
(같은 형식)

💡 추천 1은 [장점], 추천 2는 [장점]이에요!

## 대화 톤
- 친근하고 편한 말투 ("~해요", "~거든요")
- 이모지 자연스럽게
- 답변은 짧고 핵심만 (스크롤 최소화)
- 전문가 느낌 but 친구처럼

## 금지
- 데이터에 없는 가격 지어내기 (반드시 도구 조회)
- 상황 파악 안 된 상태에서 아무거나 추천
- 같은 질문 반복
- 경쟁사 비방
- 강제 정보 수집
- 한 번에 3개 이상 추천
- 긴 설명 (고객은 빨리 답 원함)`;

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
