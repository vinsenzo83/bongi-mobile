// 채팅 엔진 — Claude Tool Use 오케스트레이터
import Anthropic from '@anthropic-ai/sdk';
import { TOOLS, executeTool } from './chat-tools.js';
import { getSession, saveSession, persistMessage, updateSessionTitle } from './chat-session.js';
import { getCachedResponse, setCachedResponse, isCacheable } from './cache.js';

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const SYSTEM_PROMPT = `당신은 봉이모바일 리턴AI입니다. 광주/전라 8개 직영매장. SKT·KT·LGU+ 3사 취급.

## 핵심 규칙
1. 가격/시세는 **반드시 도구 호출**. 텍스트로 가격 나열 절대 금지.
2. 도구 결과는 카드 UI가 자동 표시됨. 짧은 멘트만 쓰면 됨.
3. HTML 태그 출력 금지. 순수 텍스트+마크다운만.
4. 데이터에 없는 가격/모델 지어내기 금지. 도구 결과만 신뢰.
5. 모델명 혼동 금지: 폴드≠플립, 에어≠프로, S26≠S25.
6. 응답은 3줄 이내 + 선택 칩/카드. 긴 설명 금지.

## 업계 용어
차비=공짜폰+현금, 번이=번호이동, 기변=기기변경, 공시=공시지원금, 선약=선택약정(월25%할인)

---

## 카테고리 1: 휴대폰 시세 (정보제공 → 매장 연결)

**규칙:** 유저가 모델명+통신사+개통유형을 말하면 **즉시** search_mobile_prices 호출. 질문하지 마. 바로 도구 호출해.
- "갤럭시 S25 SKT 번호이동 시세" → 즉시 search_mobile_prices(model="갤럭시 S25", provider="skt") 호출
- "아이폰17 프로 시세" → 즉시 search_mobile_prices(model="아이폰17 프로") 호출
- 절대 다시 묻지 마. 모델명이 있으면 바로 도구 호출.
**시세 카드 후:** check_store도 호출 → 매장 카드 → "매장에서 구매하세요!"
**금지:** 온라인 신청서 없음. "어떤 제조사" 텍스트 출력 금지. 추가 질문 금지.

---

## 카테고리 2: 렌탈 (상담 → 셀프신청)

**카테고리 미지정:** "어떤 제품이요?" + 칩(정수기/공기청정기/TV/세탁기/건조기/비데/로봇청소기/안마의자)
**카테고리 확정:** search_rental 호출 → 상품 카드
**결과 후:** 버튼("가입 상담받기"/"다른 제품 보기")

---

## 카테고리 3: 중고폰 매입 (접수 신청)

**모델 미지정:** 프론트에서 모달로 모델 선택을 처리함. "어떤 제조사" 같은 텍스트를 출력하지 마.
**모델 확정 (유저가 모델명을 말한 경우):** estimate_tradein 호출 → A~E 등급별 매입가 카드
**결과 후:** 버튼("접수 신청하기"/"다른 모델 보기")
**금지:** 매장 안내 하지 마! 중고폰은 온라인 접수 → 수거 → 검수 → 입금.

---

## 카테고리 4: 인터넷/인터넷+TV (상세 신청)

**의도 파악:** 생활패턴 1~2개 질문 (넷플릭스? 게임? 가족 몇명?)
**통신사:** 미정이면 칩("SKT"/"KT"/"LGU+") 제공. 임의 선택 금지.
**조건 확정:** search_products 호출 (include_tv=true 필수) → 추천 카드 2개
**추천 멘트:** "사은품 최대 XX만원! 추천1은 가성비, 추천2는 프리미엄!" (짧게!)
**결과 후:** 버튼("가입 상담받기"/"다른 상품 보기")
**재가입 불가:** 이미 해당 통신사 인터넷 사용중이면 다른 통신사 전환 유도

---

## 공통: 매장 안내
"매장"/"어디"/"위치" → check_store 호출 → 전체 매장 카드 표시. 가짜 번호 금지.

## 공통: 돈지키미
약정/만료 언급 시: "돈지키미에 등록하면 미리 알려드려요!" → set_alarm 유도

## 공통: 친구초대
1단계: 친구 가입 → 추천인 2,000원 / 2단계: 친구 계약 → 추천인 20,000원 + 친구 10,000원
리턴캐쉬 현금 출금 가능. 추천 횟수 무제한.

## 공통: 알뜰폰
알뜰폰 질문 → 인터넷 추천 절대 금지! 알뜰폰 요금제 텍스트 안내만.`;

// 서버 측 인텐트 감지 → 시스템 프롬프트에 강제 지시 삽입
function detectIntent(message) {
  const q = message.toLowerCase();

  // 휴대폰 시세 — 모델명 있으면 서버에서 강제 도구 호출
  const phoneModels = ['s26', 's25', '폴드7', '폴드', '플립7', '플립', '아이폰17', '아이폰16', '아이폰 17', '아이폰 16', 'iphone'];
  const hasModel = phoneModels.some(m => q.includes(m));
  const isPhonePrice = hasModel && (q.includes('시세') || q.includes('가격') || q.includes('얼마') || q.includes('번이') || q.includes('기변') || q.includes('번호이동') || q.includes('기기변경'));
  if (isPhonePrice) {
    // 모델명 추출
    let model = message.replace(/skt|kt|lgu\+?|lg|번호이동|기기변경|번이|기변|시세|가격|얼마|알려줘|확인/gi, '').trim();
    // provider 추출
    let provider = '';
    if (/skt|sk/i.test(message)) provider = 'skt';
    else if (/kt/i.test(message)) provider = 'kt';
    else if (/lg|lgu/i.test(message)) provider = 'lg';

    return {
      type: 'phone_price',
      forceTool: { name: 'search_mobile_prices', input: { model, provider } },
      formatResult: (result) => {
        if (result.error) return result.error;
        const count = result.count || 0;
        return `${model} 시세를 찾았어요! (${count}건)\n\n가까운 매장에서 구매하세요! 😊`;
      },
      postTool: { name: 'check_store', input: {} },
    };
  }

  // 알뜰폰 (인터넷과 혼동 방지 — 서버 직접 응답)
  if (/알뜰폰|알뜰|유심|mvno|저렴한.?요금/.test(q)) {
    return {
      type: 'budget_phone',
      directReply: `알뜰폰 요금제 안내해드릴게요! 📱

알뜰폰은 SKT/KT/LG 망을 그대로 사용하면서 훨씬 저렴한 요금제예요!

**📊 인기 알뜰폰 요금제:**
• 데이터 3GB — 월 **8,800원**
• 데이터 11GB — 월 **12,100원**
• 데이터 무제한 — 월 **19,800원**

**✅ 알뜰폰 장점:**
• 기존 번호 그대로 사용 가능
• 번호이동 간편 (유심만 교체)
• 통화/문자 기본 제공
• 약정 없는 요금제도 있어요

사용 패턴에 맞는 요금제를 골라드릴 수 있어요! 데이터를 주로 얼마나 쓰시나요? 🙂

상담사에게 연결하면 더 자세한 맞춤 추천을 받으실 수 있어요!`,
    };
  }

  // 후기/리뷰 — 서버에서 직접 도구 호출
  if (/후기|리뷰|평가|만족도/.test(q)) {
    return {
      type: 'review',
      forceTool: { name: 'search_reviews', input: { limit: 5 } },
      formatResult: (result) => {
        if (!result.reviews || result.reviews.length === 0) {
          return '현재 등록된 후기가 없어요. 이용 후 후기를 남겨주시면 다른 고객분들에게 큰 도움이 됩니다! 😊';
        }
        let text = '고객님들의 실제 후기를 보여드릴게요! ⭐\n\n';
        for (const r of result.reviews) {
          const stars = r['별점'] || '★★★★★';
          const product = r['상품'] || '상품';
          const content = r['내용'] || '';
          const author = r['작성자'] || '고객';
          const date = r['작성일'] || '';
          const image = r['이미지'] || '';
          text += `**${stars}** ${product}\n`;
          if (image) text += `![후기](${image})\n`;
          text += `"${content}"\n`;
          text += `— ${author} (${date})\n\n`;
        }
        text += '만족하셨다면 친구분도 소개해주세요! 친구가 가입하면 2천원, 계약까지 하면 2만원 추가 보상! 🎁';
        return text;
      },
    };
  }

  // 친구초대 — 서버 직접 응답
  if (/친구.?초대|추천하면|소개하면|친구.?소개|리퍼럴|추천.?보상/.test(q)) {
    return {
      type: 'referral',
      directReply: `친구초대 보상 안내해드릴게요! 🎁

**📋 친구초대 2단계 보상:**

| 단계 | 조건 | 보상 |
|------|------|------|
| 1단계 | 친구가 **가입** | 추천인에게 **리턴캐쉬 2,000원** 즉시 적립 |
| 2단계 | 친구가 **계약 완료** | 추천인에게 **리턴캐쉬 20,000원** 추가! |

**친구(피추천인)도 리턴캐쉬 10,000원 혜택!**

💰 **총 추천인 보상: 최대 22,000원** (2,000 + 20,000)
💰 **친구 보상: 10,000원**

✅ 리턴캐쉬는 마이페이지에서 **현금 출금** 가능!
✅ 추천 횟수 제한 없음 — 많이 추천할수록 더 많은 보상!

친구에게 추천 링크를 공유하시면 자동으로 연결돼요 😊`,
    };
  }

  // 폴더블폰 비교 (플립 vs 폴드)
  if (/플립.{0,5}폴드|폴드.{0,5}플립/.test(q)) {
    return {
      type: 'foldable_compare',
      instruction: `[시스템 강제 지시] 고객이 플립과 폴드를 비교하려 합니다. search_mobile_prices를 2번 호출하세요 — 한번은 "플립" 모델로, 한번은 "폴드" 모델로. 결과가 없으면 "해당 모델은 현재 시세 데이터에 없어요"라고 솔직히 답하세요. 다른 모델로 대체하지 마세요.`,
    };
  }

  return null;
}

// 메시지 처리
export async function processMessage(sessionId, userMessage, context = {}) {
  const session = getSession(sessionId);
  if (!session) throw new Error('세션을 찾을 수 없습니다');

  session.messages.push({ role: 'user', content: userMessage });

  // DB에 유저 메시지 영속화
  persistMessage(sessionId, 'user', userMessage);

  // 첫 메시지면 세션 제목 업데이트
  const isFirstMessage = session.messages.filter(m => m.role === 'user' && typeof m.content === 'string').length === 1;
  if (isFirstMessage) {
    updateSessionTitle(sessionId, userMessage);
  }

  // 인텐트 감지 (캐시/Claude보다 먼저!)
  const intent = detectIntent(userMessage);
  // 확정 인텐트: Claude 거치지 않고 서버에서 직접 응답
  if (intent?.directReply) {
    const reply = intent.directReply;
    session.messages.push({ role: 'assistant', content: reply });
    await saveSession(session);
    persistMessage(sessionId, 'assistant', reply);
    return { reply, ui_elements: intent.ui_elements || [] };
  }

  // 확정 인텐트 중 도구 호출이 필요한 경우 (후기 등)
  if (intent?.forceTool) {
    const toolResult = await executeTool(intent.forceTool.name, intent.forceTool.input, context);
    const toolReply = intent.formatResult(toolResult);
    session.messages.push({ role: 'assistant', content: toolReply });
    await saveSession(session);
    persistMessage(sessionId, 'assistant', toolReply);
    return { reply: toolReply, ui_elements: [] };
  }

  const systemPrompt = intent
    ? `${SYSTEM_PROMPT}\n\n${intent.instruction}`
    : SYSTEM_PROMPT;

  // 캐시 체크
  if (isFirstMessage && !intent) {
    const cached = getCachedResponse(userMessage);
    if (cached) {
      session.messages.push({ role: 'assistant', content: cached.reply });
      await saveSession(session);
      persistMessage(sessionId, 'assistant', cached.reply);
      return { reply: cached.reply, ui_elements: cached.ui_elements || [], fromCache: true };
    }
  }

  // API 키 없으면 Mock 응답
  if (!client) {
    const mockReply = getMockReply(userMessage);
    session.messages.push({ role: 'assistant', content: mockReply });
    await saveSession(session);
    persistMessage(sessionId, 'assistant', mockReply);
    return { reply: mockReply, ui_elements: [] };
  }

  // Claude Tool Use 호출
  let response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
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
      try {
        const result = await executeTool(block.name, block.input, context);
        result._tool = block.name; // UI 추출용 도구명 태깅
        let resultStr = JSON.stringify(result);
        if (resultStr.length > 15000) {
          console.log(`[Tool] ${block.name}: 결과 너무 큼 (${resultStr.length}bytes), 잘라냄`);
          resultStr = JSON.stringify({ _tool: block.name, message: result.message || '결과를 확인했습니다.', count: result.count || result.results?.length || 0, truncated: true });
        }
        console.log(`[Tool] ${block.name}: ${resultStr.length}bytes`);
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: resultStr });
      } catch (toolErr) {
        console.error(`[Tool Error] ${block.name}:`, toolErr.message);
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ _tool: block.name, error: toolErr.message }) });
      }
    }

    session.messages.push({ role: 'assistant', content: response.content });
    session.messages.push({ role: 'user', content: toolResults });

    response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
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

  // DB에 어시스턴트 텍스트 메시지 영속화
  if (reply) {
    persistMessage(sessionId, 'assistant', reply);
  }

  let ui_elements = extractUIElements(session.messages);

  // phone_select / usedphone_select는 프론트 모달에서 처리 (서버 삽입 안 함)

  // 첫 메시지 응답을 캐시에 저장 (다음 동일 질문에서 API 호출 절약)
  if (isFirstMessage && reply) {
    setCachedResponse(userMessage, { reply, ui_elements });
  }

  return {
    reply,
    ui_elements,
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
        if (data._tool === 'search_mobile_prices' && data.results && Array.isArray(data.results)) {
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

        // _tool 기반 UI 매칭
        const tool = data._tool || '';

        // estimate_tradein → 중고폰 매입
        if (tool === 'estimate_tradein' || (data.results?.[0]?.매입가 && data.grade)) {
          elements.push({
            type: 'actions',
            buttons: [
              { label: '♻️ 트레딧 매입 신청', action: '중고폰 매입 신청 링크 알려줘' },
              { label: '다른 모델도 확인', action: '다른 중고폰 매입가도 알려줘' },
              { label: '📍 매장 방문 상담', action: '매장 알려줘' },
            ],
          });
        }

        // get_bundle_discount → 결합할인
        if (tool === 'get_bundle_discount') {
          elements.push({
            type: 'actions',
            buttons: [
              { label: '이 결합으로 가입하기', action: '결합할인 가입 상담 받고 싶어요' },
              { label: '다른 통신사도 비교', action: '3사 결합할인 비교해줘' },
              { label: '상담사 연결해줘', action: '상담사 연결해주세요' },
            ],
          });
        }

        // get_guide → 가이드
        if (tool === 'get_guide') {
          elements.push({
            type: 'actions',
            buttons: [
              { label: '인터넷 사은품 보기', action: '인터넷 사은품 얼마?' },
              { label: '휴대폰 시세 보기', action: '갤럭시 S26 사은품 얼마?' },
              { label: '상담사 연결해줘', action: '상담사 연결해주세요' },
            ],
          });
        }

        // get_fraud_tips → 사기방지
        if (tool === 'get_fraud_tips') {
          elements.push({
            type: 'actions',
            buttons: [
              { label: '인터넷 사은품 보기', action: '인터넷 사은품 얼마?' },
              { label: '📍 매장 방문하기', action: '매장 알려줘' },
              { label: '상담사 연결해줘', action: '상담사 연결해주세요' },
            ],
          });
        }

        // get_subsidy → 공시지원금
        if (tool === 'get_subsidy') {
          elements.push({
            type: 'actions',
            buttons: [
              { label: '이 모델 가입하기', action: '가입 상담 받고 싶어요' },
              { label: '다른 모델도 보기', action: '다른 휴대폰 시세도 보여줘' },
              { label: '상담사 연결해줘', action: '상담사 연결해주세요' },
            ],
          });
        }

        // search_mobile_plans → 요금제 검색
        if (tool === 'search_mobile_plans') {
          elements.push({
            type: 'actions',
            buttons: [
              { label: '이 요금제로 가입', action: '가입 상담 받고 싶어요' },
              { label: '다른 요금제 보기', action: '다른 요금제도 추천해줘' },
              { label: '📍 매장 방문', action: '매장 알려줘' },
            ],
          });
        }

        // get_card_discounts → 제휴카드
        if (tool === 'get_card_discounts') {
          elements.push({
            type: 'actions',
            buttons: [
              { label: '카드 발급 상담', action: '제휴카드 발급 상담 받고 싶어요' },
              { label: '다른 통신사 카드', action: '다른 통신사 제휴카드도 보여줘' },
              { label: '상담사 연결해줘', action: '상담사 연결해주세요' },
            ],
          });
        }

        // compare_products 결과 → 비교표
        if (data.비교 && Array.isArray(data.비교)) {
          elements.push({
            type: 'compare_table',
            items: data.비교,
          });
        }

        // check_store 결과 → 매장 카드
        if (data.stores && Array.isArray(data.stores) && data.stores.length > 0) {
          elements.push({
            type: 'store_cards',
            stores: data.stores,
          });
          elements.push({
            type: 'actions',
            buttons: [
              { label: '인터넷+TV 상담받기', action: '인터넷 추천해줘' },
              { label: '휴대폰 시세 보기', action: '갤럭시 S26 시세 알려줘' },
              { label: '상담사 연결해줘', action: '상담사 연결해주세요' },
            ],
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

  // 도구 호출 없이 텍스트만 응답한 경우에도 기본 액션 버튼 추가
  if (elements.length === 0) {
    elements.push({
      type: 'actions',
      buttons: [
        { label: '📡 인터넷 사은품', action: '인터넷 사은품 얼마?' },
        { label: '📱 휴대폰 시세', action: '갤럭시 S26 사은품 얼마?' },
        { label: '💧 렌탈 사은품', action: '정수기 사은품 얼마?' },
        { label: '📍 매장 안내', action: '매장 알려줘' },
      ],
    });
  }

  return elements;
}

// 스트리밍 메시지 처리
export async function processMessageStream(sessionId, userMessage, context = {}, onChunk) {
  const session = getSession(sessionId);
  if (!session) throw new Error('세션을 찾을 수 없습니다');

  session.messages.push({ role: 'user', content: userMessage });

  // DB에 유저 메시지 영속화
  persistMessage(sessionId, 'user', userMessage);

  // 첫 메시지면 세션 제목 업데이트
  const isFirstMessage = session.messages.filter(m => m.role === 'user' && typeof m.content === 'string').length === 1;
  if (isFirstMessage) {
    updateSessionTitle(sessionId, userMessage);
  }

  // 인텐트 감지 (캐시/Claude보다 먼저!)
  const intent = detectIntent(userMessage);

  // 확정 인텐트: 서버 직접 응답 (스트리밍)
  if (intent?.directReply) {
    onChunk({ type: 'text', text: intent.directReply });
    session.messages.push({ role: 'assistant', content: intent.directReply });
    await saveSession(session);
    persistMessage(sessionId, 'assistant', intent.directReply);
    return { ui_elements: intent.ui_elements || [] };
  }

  // 확정 인텐트 중 도구 호출 필요한 경우
  if (intent?.forceTool) {
    const toolResult = await executeTool(intent.forceTool.name, intent.forceTool.input, context);
    toolResult._tool = intent.forceTool.name;
    const toolReply = intent.formatResult(toolResult);
    onChunk({ type: 'text', text: toolReply });

    // 도구 결과에서 UI 카드 추출
    const ui_elements = [];
    if (toolResult._tool === 'search_mobile_prices' && toolResult.results) {
      ui_elements.push({
        type: 'mobile_price_cards',
        items: toolResult.results.slice(0, 15),
        services: toolResult.부가서비스 || {},
        plans: toolResult.요금제 || {},
        date: toolResult.date || '',
      });
    }

    // 매장 카드도 추가 (postTool)
    if (intent.postTool) {
      const storeResult = await executeTool(intent.postTool.name, intent.postTool.input, context);
      if (storeResult.stores) {
        ui_elements.push({
          type: 'store_cards',
          stores: storeResult.stores,
        });
      }
    }

    session.messages.push({ role: 'assistant', content: toolReply });
    await saveSession(session);
    persistMessage(sessionId, 'assistant', toolReply);
    return { ui_elements };
  }

  const systemPrompt = intent
    ? `${SYSTEM_PROMPT}\n\n${intent.instruction}`
    : SYSTEM_PROMPT;

  // 캐시 체크
  if (isFirstMessage && !intent) {
    const cached = getCachedResponse(userMessage);
    if (cached) {
      onChunk({ type: 'text', text: cached.reply });
      session.messages.push({ role: 'assistant', content: cached.reply });
      await saveSession(session);
      persistMessage(sessionId, 'assistant', cached.reply);
      return { ui_elements: cached.ui_elements || [], fromCache: true };
    }
  }

  // API 키 없으면 Mock 응답 (청크 단위로 전송)
  if (!client) {
    const mockReply = getMockReply(userMessage);
    onChunk({ type: 'text', text: mockReply });
    session.messages.push({ role: 'assistant', content: mockReply });
    await saveSession(session);
    persistMessage(sessionId, 'assistant', mockReply);
    return { ui_elements: [] };
  }

  // 스트리밍 Claude 호출 + Tool Use 루프
  let loopCount = 0;
  let lastResponse = null;

  // 첫 호출 (스트리밍)
  lastResponse = await streamClaudeResponse(session, onChunk, systemPrompt);

  // Tool Use 루프: 도구 호출이 필요하면 실행 후 재호출
  while (lastResponse.stop_reason === 'tool_use' && loopCount < 5) {
    const toolUseBlocks = lastResponse.content.filter(b => b.type === 'tool_use');
    const toolResults = [];

    onChunk({ type: 'tool_start', tools: toolUseBlocks.map(b => b.name) });

    for (const block of toolUseBlocks) {
      const result = await executeTool(block.name, block.input, context);
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(result),
      });
    }

    session.messages.push({ role: 'assistant', content: lastResponse.content });
    session.messages.push({ role: 'user', content: toolResults });

    onChunk({ type: 'tool_done' });

    // 도구 결과 이후 재호출 (스트리밍)
    lastResponse = await streamClaudeResponse(session, onChunk, systemPrompt);
    loopCount++;
  }

  // 최종 응답을 세션에 저장
  session.messages.push({ role: 'assistant', content: lastResponse.content });
  await saveSession(session);

  // DB에 어시스턴트 텍스트 메시지 영속화
  const textBlocks = lastResponse.content.filter(b => b.type === 'text');
  const reply = textBlocks.map(b => b.text).join('\n');
  if (reply) {
    persistMessage(sessionId, 'assistant', reply);
  }

  const ui_elements = extractUIElements(session.messages);

  // 첫 메시지 응답을 캐시에 저장
  if (isFirstMessage && reply) {
    setCachedResponse(userMessage, { reply, ui_elements });
  }

  return {
    ui_elements,
  };
}

// Claude 스트리밍 호출 헬퍼
async function streamClaudeResponse(session, onChunk, sysPrompt = SYSTEM_PROMPT) {
  const stream = client.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: sysPrompt,
    tools: TOOLS,
    messages: session.messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
  });

  stream.on('text', (text) => {
    onChunk({ type: 'text', text });
  });

  const finalMessage = await stream.finalMessage();
  return finalMessage;
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

  if (q.includes('상담') || q.includes('전화') || q.includes('연결')) {
    return '상담사 연결해드릴게요!\n\n연락처 남겨주시면 상담사가 전화드릴게요!\n또는 가까운 매장에 직접 방문해주세요.\n\n매장 정보가 궁금하시면 "매장 알려줘"라고 말씀해주세요!';
  }

  return '안녕하세요! 리턴AI에요 🐟\n\n인터넷+TV, 정수기·공기청정기·TV 렌탈, 알뜰폰, 중고폰 매입까지!\n무엇이든 편하게 물어보세요.\n\n예시:\n• "인터넷 추천해줘"\n• "공기청정기 추천해줘"\n• "비데 렌탈 얼마야?"\n• "알뜰폰 저렴한 거"\n• "아이폰 15 매입가"';
}
