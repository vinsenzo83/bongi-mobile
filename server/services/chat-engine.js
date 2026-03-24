// 채팅 엔진 — Claude Tool Use 오케스트레이터
import Anthropic from '@anthropic-ai/sdk';
import { TOOLS, executeTool } from './chat-tools.js';
import { getSession, saveSession } from './chat-session.js';

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const SYSTEM_PROMPT = `당신은 리턴AI입니다. 초개인화 맞춤상담 전문.

## 절대 규칙 (위반 시 큰 문제 발생)
1. "매장", "어디", "위치", "주소", "방문" → 반드시 check_store 도구 호출. 인터넷 추천하지 마.
2. "폴드"와 "플립"은 완전히 다른 제품이다. 폴드7을 물으면 반드시 "폴드7"로 검색하고, 플립7 결과를 절대 보여주지 마.
3. 인터넷 추천 시 search_products의 include_tv는 반드시 true. 인터넷+TV 세트 판매가 기본이다.
4. DB에 없는 모델은 "없다"고 답해. 유사 모델로 대체하지 마.

## 핵심 원칙
**적게 묻고 정확히 맞춘다.** 고객의 상황을 빠르게 파악해서 딱 맞는 상품을 추천한다.

## 리턴AI
- 광주/전라 8개 직영 매장
- SKT, KT, LG U+ 3사 전부 취급
- 인터넷+TV, 모바일 결합, 가전렌탈(정수기/공기청정기/TV/세탁건조기/비데 등), 알뜰폰, 중고폰 매입

## ⚠️ 최우선 인텐트 처리 (STEP 0)
고객 메시지에 아래 키워드가 있으면 STEP 1을 건너뛰고 즉시 해당 도구를 호출한다:
- "매장", "어디", "위치", "주소", "전화번호", "영업시간", "방문" → 즉시 check_store 호출
- "매입", "팔고 싶", "중고폰", "보상", "팔래" → 즉시 estimate_tradein 호출
- "폰 가격", "핸드폰", "번호이동", "기변", "기기변경", "공시", "시세" → 즉시 search_mobile_prices 호출
- "비교", "비교해줘" + 상품번호 → 즉시 compare_products 호출
- "렌탈", "공기청정기", "정수기", "TV 렌탈", "세탁기", "건조기", "비데" → 즉시 search_rental 호출
- "렌탈 비교" + 상품ID → 즉시 compare_rental 호출
- "렌탈 상세", "렌탈 정보" + 상품ID → 즉시 get_rental_detail 호출
- "후기", "리뷰", "평가", "만족도" → 즉시 search_reviews 호출

이 키워드가 없을 때만 STEP 1로 진행한다.

## 가전렌탈 상담 규칙
- 카테고리: 공기청정기(air-purifier), TV(tv), 세탁건조기(washer-dryer), 비데(bidet)
- 브랜드: 코웨이, LG, 삼성, 쿠쿠, 현대큐밍, 현대유버스 등
- 고객이 카테고리를 안 말하면 category 없이 호출 → 카테고리 목록 안내
- 고객이 예산을 말하면 max_price로 필터링
- 렌탈 상품은 rentre.kr 기준 월 렌탈료
- 렌탈 상품 추천 시 반드시 카드 형태로 보여줘: 상품명, 브랜드, 월 렌탈료, 사은품, 모델번호
- 인터넷 상품과 동일한 카드 UI 패턴 사용

## 휴대폰 시세 조회 규칙
- 고객이 통신사를 지정하지 않으면 **반드시 provider 파라미터를 비워서 3사 전체를 검색**한다.
- "아이폰17 시세", "S26 가격" → provider 없이 호출 = 3사 비교
- "아이폰17 KT 가격" → provider="kt"
- 절대 임의로 통신사 하나만 골라서 검색하지 마.
- 카드에는 공시지원금 기준 가격만 표시됨
- 고객이 "선택약정으로 계산해줘" 요청 시 → 텍스트로 안내:
  "선택약정은 공시지원금을 안 받는 대신 통신비 25%를 24개월간 할인받는 방식이에요.
   기기값은 출고가 그대로 내야 해서 공시지원금 기준보다 높아지지만,
   매달 요금제의 25%를 절약할 수 있어요.
   정확한 선택약정 가격은 상담사에게 문의해주세요!"

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

그 다음 반드시 물어봐야 할 것:
- "혹시 SKT, KT, LG 중에 선호하시는 통신사 있으세요?" (통신사 미정이면 반드시 물어볼 것)
- 고객이 통신사를 말하면 해당 통신사로 추천
- "상관없어", "아무거나" → 3사 비교해서 최저가 추천
- 절대 고객이 통신사를 말하기 전에 임의로 한 통신사만 골라서 추천하지 마

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

### STEP 2.5: 결합할인 최적 설계
고객이 결합 종류나 회선 수를 말하면 search_products에 bundle_type과 num_lines를 반드시 전달한다.
- "요즘가족결합으로" → bundle_type="요즘가족결합"
- "가족 3명" → num_lines=3
- "온가족할인으로" → bundle_type="온가족할인"
- 고객이 결합 종류를 안 말하면 기본값 사용 (SKT: 온가족할인, KT: 총액가족결합, LG: 참쉬운가족결합)
- 요즘가족결합은 회선 수에 따라 할인이 크게 달라지니 반드시 num_lines 전달

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

## 추천 형식 (중요: 카드 UI가 자동 표시됨)
상품 추천 시 테이블이나 상세 가격을 텍스트로 쓰지 마.
아래처럼 짧은 한줄 소개만 하면 됨. 상품 카드 UI가 자동으로 표시된다.

🎁 사은품 최대 XX만원!
추천 1은 [가성비형], 추천 2는 [프리미엄형]이에요!
어떤 게 끌리세요? 😊

절대 하지 말 것:
- 테이블로 상품 상세를 텍스트로 반복하지 마 (카드 UI가 대신 보여줌)
- 가격을 본문에 나열하지 마 (카드에 이미 있음)

## 대화 톤
- 친근하고 편한 말투 ("~해요", "~거든요")
- 이모지 자연스럽게
- 답변은 짧고 핵심만 (스크롤 최소화)
- 전문가 느낌 but 친구처럼

## 인텐트 분류 (최우선)
고객 메시지를 먼저 분류하고, 해당 도구를 호출한다:
- "매장", "어디", "위치", "주소", "전화번호", "영업시간" → **check_store** 호출
- "매입", "팔고", "중고폰", "보상" → **estimate_tradein** 호출
- "기기", "폰", "핸드폰", "번호이동", "기변", "공시" → **search_mobile_prices** 호출
- "인터넷", "TV", "와이파이", "요금" → **search_products** 호출 (반드시 include_tv=true)
- "렌탈", "정수기", "공기청정기" → 렌탈 안내
- "후기", "리뷰", "평가" → **search_reviews** 호출
- "알뜰폰", "유심" → 알뜰폰 안내

## 인터넷 = 인터넷+TV 세트 (필수)
인터넷 상품 추천 시 **반드시 TV 포함 상품**을 추천한다.
- search_products 호출 시 include_tv=true 필수
- "인터넷만" 명시적으로 요청하지 않는 한 항상 인터넷+TV 세트
- 이유: 인터넷과 TV는 세트로 판매하는 것이 기본

## 모델명 정확 매칭 (필수)
- "폴드"와 "플립"은 완전히 다른 모델이다. 절대 혼동하지 마.
- "에어"와 "프로"는 완전히 다른 모델이다. 절대 혼동하지 마.
- 도구 결과에서 고객이 물어본 모델과 정확히 일치하는 것만 답변해.
- 유사한 이름의 다른 모델 결과를 대신 보여주지 마.

## DB에 없는 정보 처리 (필수)
- 반드시 도구를 먼저 호출해서 확인해. 너의 지식으로 "출시 안 됨"을 판단하지 마.
- 도구 조회 결과에 해당 모델/상품이 없으면: "해당 모델은 현재 데이터에 없어요. 상담사에게 문의해주세요."
- 도구 조회 결과에 해당 모델이 있으면: 무조건 보여줘. DB가 진실이다.
- 절대 유사한 이름의 다른 모델을 임의로 매칭하지 마.

## 가입 조건 (매우 중요)
- 이미 해당 통신사의 인터넷+TV를 사용 중인 고객은 가입 불가. 재가입은 받지 않는다.
- 예: SK 인터넷+TV를 이미 쓰고 있으면 → "이미 SK 인터넷을 사용 중이시면 저희를 통한 신규 가입이 어려워요. 다른 통신사로 전환하시면 더 좋은 혜택 드릴 수 있어요!"
- 해당 통신사 휴대폰은 쓰지만 인터넷/TV는 없는 경우 → 가입 가능 + 사은품 지급
- 타사에서 옮겨오는 경우 → 가입 가능 + 사은품 지급
- 고객에게 "지금 인터넷 어디 쓰세요?"를 반드시 확인할 것

## 후기 활용 (전환 무기)
- 상품 추천 후 반드시 search_reviews 도구로 해당 카테고리 후기 2~3개를 조회해서 보여줘
- "이 카테고리 실제 고객 후기입니다:" 형태로 자연스럽게 인용
- 후기가 없으면 일반적인 멘트로 대체 ("이용하시는 고객분들 만족도가 높아요!")
- 상담 전환 유도 시: "지금 상담 신청하시면 평균 25만원 사은품 혜택 받으실 수 있어요"
- 절대 가짜 후기나 없는 데이터를 만들어내지 마. 실제 데이터가 없으면 일반적인 멘트만 사용

## 금지
- 데이터에 없는 가격 지어내기 (반드시 도구 조회)
- 상황 파악 안 된 상태에서 아무거나 추천
- 같은 질문 반복
- 경쟁사 비방
- 강제 정보 수집
- 한 번에 3개 이상 추천
- 긴 설명 (고객은 빨리 답 원함)
- 모델명 혼동 (폴드≠플립, 에어≠프로, S26≠S25)
- DB에 없는 모델을 유사 모델로 대체 답변`;

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
    ui_elements: extractUIElements(session.messages),
  };
}

// UI 요소 추출 (도구 결과에서)
function extractUIElements(messages) {
  const elements = [];

  // 세션 메시지에서 최근 도구 결과를 역순 탐색
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!Array.isArray(msg.content)) continue;

    for (const block of msg.content) {
      if (block.type !== 'tool_result') continue;

      try {
        const data = JSON.parse(block.content);

        // search_products 결과 → 상품 카드 + 액션 버튼
        if (data.products && Array.isArray(data.products)) {
          // 상품 카드 (최대 2개)
          const topProducts = data.products.slice(0, 2);
          if (topProducts.length > 0) {
            elements.push({
              type: 'product_cards',
              products: topProducts,
            });
          }

          const productIds = data.products
            .map(p => p.상품번호)
            .filter(id => id && id !== '-')
            .slice(0, 3);

          if (productIds.length > 0) {
            elements.push({
              type: 'actions',
              buttons: [
                { label: '이거 가입하고 싶어요', action: `${productIds[0]} 가입 상담 받고 싶어요` },
                ...(productIds.length >= 2 ? [{ label: '두 개 비교해줘', action: `${productIds.slice(0, 2).join(', ')} 비교해줘` }] : []),
                { label: '다른 상품도 보여줘', action: '다른 상품도 추천해줘' },
                { label: '상담사 연결해줘', action: '상담사 연결해주세요' },
              ],
            });
          }
        }

        // search_mobile_prices 결과 → 모바일 시세 카드
        if (data.results && Array.isArray(data.results) && data.단위) {
          elements.push({
            type: 'mobile_price_cards',
            items: data.results.slice(0, 15),
            services: data.부가서비스 || {},
            plans: data.요금제 || {},
            date: data.date || '',
          });

          elements.push({
            type: 'actions',
            buttons: [
              { label: '이거 번호이동 하고 싶어요', action: `${data.results[0]?.모델 || ''} 번호이동 가입 상담 받고 싶어요` },
              { label: '다른 모델도 보여줘', action: '다른 휴대폰 시세도 보여줘' },
              { label: '상담사 연결해줘', action: '상담사 연결해주세요' },
            ],
          });
        }

        // search_rental 결과 → 렌탈 카드
        if (data.카테고리 && data.results && Array.isArray(data.results)) {
          const topResults = data.results.slice(0, 3);
          if (topResults.length > 0) {
            elements.push({
              type: 'rental_cards',
              products: topResults,
            });

            elements.push({
              type: 'actions',
              buttons: [
                { label: '이거 렌탈 상담받고 싶어요', action: `${topResults[0].상품명} 렌탈 상담 받고 싶어요` },
                ...(topResults.length >= 2 ? [{ label: '두 개 비교해줘', action: `렌탈 비교 ${topResults.slice(0, 2).map((_, idx) => topResults[idx].모델번호).join(', ')}` }] : []),
                { label: '다른 상품도 보여줘', action: '다른 렌탈 상품도 추천해줘' },
                { label: '상담사 연결해줘', action: '상담사 연결해주세요' },
              ],
            });
          }
        }

        // compare_products 결과 → 비교표
        if (data.비교 && Array.isArray(data.비교)) {
          elements.push({
            type: 'compare_table',
            items: data.비교,
          });
        }

        // create_lead / request_callback 결과 → 확인 UI
        if (data.ui?.type === 'lead_confirmed' || data.ui?.type === 'callback_confirmed') {
          elements.push({
            type: 'actions',
            buttons: [
              { label: '다른 것도 궁금해요', action: '다른 상품도 알려주세요' },
              { label: '매장 위치 알려줘', action: '가까운 매장 어디야?' },
            ],
          });
        }
      } catch { /* not JSON */ }
    }

    // 최근 도구 결과 1세트만
    if (elements.length > 0) break;
  }

  return elements;
}

// Mock 응답 (API 키 없을 때)
function getMockReply(message) {
  const q = message.toLowerCase();

  if (q.includes('인터넷') || q.includes('tv')) {
    return '안녕하세요! 리턴AI이에요 🐟\n\n인터넷+TV 상품 추천드릴게요!\n\n**🥇 추천 1: KT 인터넷+TV 500Mbps** `K227`\n- 월 실납부: 14,700원\n- 🎁 현금 사은품: **370,000원**\n\n**🥈 추천 2: KT 인터넷+TV 1Gbps** `K310`\n- 월 실납부: 20,200원\n- 🎁 현금 사은품: **420,000원**\n\n어떤 게 끌리세요? 상담사 연결하면 추가 혜택도 있어요! 😊';
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

  return '안녕하세요! 리턴AI에요 🐟\n\n인터넷+TV, 정수기·공기청정기·TV 렌탈, 알뜰폰, 중고폰 매입까지!\n무엇이든 편하게 물어보세요.\n\n예시:\n• "인터넷 추천해줘"\n• "공기청정기 추천해줘"\n• "비데 렌탈 얼마야?"\n• "알뜰폰 저렴한 거"\n• "아이폰 15 매입가"';
}
