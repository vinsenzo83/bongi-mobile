# 리턴AI 생활 서비스 AI 플랫폼 아키텍처 설계서

> 작성일: 2026-03-23 (v3 — 최종 비전 반영)
> 작성: architect 에이전트
> 범위: 생활 서비스 AI 플랫폼 설계 (ChatGPT급 채팅 + 플러그인 확장 구조)
> 참조: smartchoice-v2 (검증된 UX 패턴), ChatGPT/Gemini (플랫폼 참조)

---

## 0. 비전 — 생활 서비스 AI 플랫폼

### "AI에게 물어보면 생활의 모든 것을 해결"

리턴AI는 단순한 통신 챗봇이 아니라, **ChatGPT/Gemini 같은 AI 채팅 플랫폼**을 생활 서비스에 특화한 것이다.

```
┌──────────────────────────────────────────────────────────────┐
│                    리턴AI 플랫폼                        │
│                                                               │
│   "인터넷 추천해줘"  "정수기 렌탈 비교"  "이사 견적 알려줘"     │
│   "보험 비교해줘"    "중고폰 팔래"       "카드 추천"            │
│                                                               │
│          ┌─────────────────────────────────┐                  │
│          │      AI 채팅 엔진 (Claude)       │                  │
│          │    Tool Use + 플러그인 시스템    │                  │
│          └──────────┬──────────────────────┘                  │
│                     │                                         │
│   ┌────────┬────────┼────────┬────────┬────────┐             │
│   ▼        ▼        ▼        ▼        ▼        ▼             │
│ ┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐           │
│ │ 통신 ││ 렌탈 ││알뜰폰││중고폰││ 이사 ││ 보험 │ ...       │
│ │Plugin││Plugin││Plugin││Plugin││Plugin││Plugin│           │
│ └──────┘└──────┘└──────┘└──────┘└──────┘└──────┘           │
│   1차 (현재)                     2차        3차              │
│                                                               │
│          ┌─────────────────────────────────┐                  │
│          │  리드 → CRM → 상담사 → 계약     │                  │
│          │      (공통 파이프라인)           │                  │
│          └─────────────────────────────────┘                  │
└──────────────────────────────────────────────────────────────┘
```

### 로드맵

| Phase | 서비스 | 플러그인 |
|-------|--------|---------|
| **1차 (현재)** | 인터넷+TV, 가전렌탈, 알뜰폰, 중고폰 매입 | telecom, rental, usim, usedPhone |
| **2차** | 이사, 청소, 보험, 카드 | moving, cleaning, insurance, card |
| **3차** | 금융, 물류, 헬스케어, 에너지 | finance, logistics, healthcare, energy |

핵심: **현재는 1차 4개 플러그인으로 시작하되, 도구만 추가하면 서비스가 확장되는 구조를 처음부터 설계한다.**

---

## 1. 개요

### 1.1 플랫폼 구조 원칙 — "채팅이 곧 플랫폼"

```
┌─────────────────────────────────────────────────────────────┐
│                    고객이 보는 것                              │
│                                                               │
│              ┌──────────────────────┐                         │
│              │   채팅 화면 (전체화면)  │  ← 유일한 메인 UI     │
│              │                      │                         │
│              │  상품 탐색 (카드/캐러셀)│                        │
│              │  가격 비교 (비교표)    │                         │
│              │  가입 신청 (인라인 폼) │                         │
│              │  매장 안내 (지도 모달) │                         │
│              │  상담 연결 (CTA 버튼) │                         │
│              └──────────────────────┘                         │
│                                                               │
├───────────────────────────────────────────────────────────────┤
│                    백그라운드 (고객에게 안 보임)                 │
│                                                               │
│  ┌────────────┐  ┌────────────┐  ┌──────────┐  ┌──────────┐ │
│  │ CRM 어드민 │  │ CTI 전화   │  │ 인센티브 │  │ 상담사   │ │
│  │ (상담사용) │  │ (상담사용) │  │ 계산     │  │ 배정     │ │
│  └────────────┘  └────────────┘  └──────────┘  └──────────┘ │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 기존 웹 페이지 (Home, Products, Stores, Apply)         │  │
│  │ → SEO 랜딩 전용, 진입 시 채팅으로 리다이렉트            │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**핵심**: 고객은 채팅 화면 하나만 본다. 기존 웹사이트의 모든 기능(상품 탐색, 비교, 가입, 매장 안내)은 채팅 안의 리치 UI로 대체된다. 기존 페이지들은 SEO 크롤러용 랜딩으로만 유지하며, 실제 고객 진입 시 채팅으로 리다이렉트한다.

### 1.2 방향 전환

| 항목 | AS-IS (전통 웹) | TO-BE (채팅 AI) |
|------|-----------------|-----------------|
| UX | 페이지 탐색, 폼 입력 | **채팅 전체화면 하나** |
| 상품 탐색 | 카테고리 → 목록 → 상세 | 채팅 내 ProductCard / Carousel |
| 가격 비교 | 별도 비교 페이지 | 채팅 내 CompareTable |
| 가입 신청 | Apply 페이지 폼 | 채팅 내 InlineForm |
| 매장 안내 | Stores 페이지 | 채팅 내 MapModal |
| 상담 연결 | 별도 전화/접수 | 채팅 내 CTAButtons (바로상담/연락받기) |
| 기존 웹 페이지 | 메인 UI | **SEO 랜딩 전용 (숨김)** |
| CRM/CTI | 어드민 패널 | **백그라운드 유지 (변경 없음)** |
| **핵심 교훈 (smartchoice-v2)** | — | **사은품 중심, 질문 최소화, 즉시 추천 2개, TM 연결이 최종 목표** |

### 1.3 핵심 플로우 — 이중 경로

smartchoice-v2에서 검증된 **가이디드 플로우**(설문→추천)와 **자유 대화**를 병행한다.

#### 경로 A: 가이디드 플로우 (smartchoice-v2 검증 패턴)

```
진입 → 카테고리 선택 칩 (인터넷+TV / 가전렌탈 / 알뜰폰 / 중고폰)
    ↓
간단 설문 (카테고리별 2~3개 라디오)
  - 인터넷: 가족수 / 용도 / TV여부 / 선호 통신사
  - 가전렌탈: 제품종류 / 브랜드선호
  - 알뜰폰: 데이터용량 / 통신사
    ↓
AI가 즉시 추천 2개 (질문 없이 바로!)
  - 사은품(캐시백) 강조가 핵심
  - 상품번호(K227, R001 등) 필수 포함
    ↓
고객이 상품 선택 (또는 비교 요청)
    ↓
CTA 이중 선택:
  [바로상담] 전화번호 + 티켓 → 즉시 TM 연결
  [연락받기] 이름/연락처/희망시간 → 콜백 예약
    ↓
CRM 리드 자동 등록 + 상담사 배정
```

#### 경로 B: 자유 대화 (확장)

```
진입 → 채팅 입력
    ↓
AI 자유 대화 (Tool Use 기반 상품 검색/비교/계산)
    ↓
관심 감지 → 자연스러운 정보 수집
    ↓
CRM 리드 등록 + 상담사 배정
```

**핵심 원칙 (smartchoice-v2에서 학습):**
- 고객은 "사은품 받으러 온 사람"이다 — 캐시백/할인을 최우선 표시
- 질문하지 말고 바로 추천 2개를 던져라
- 모든 추천에 상품번호(K227, S340 등) 필수 포함
- 답변 마지막에 자연스럽게 상담 유도 ("전문 상담사가 더 좋은 조건 안내 가능!")
- 최종 목표는 TM 상담 연결 (리드 전환)
- **UI 버튼/칩이 대화를 대신한다** — 타이핑보다 터치가 빠르다

---

## 2. 전체 아키텍처 — 플러그인 기반 AI 플랫폼

```
┌──────────────────────────────────────────────────────────────────┐
│                 멀티채널 클라이언트                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐    │
│  │ 웹 (React│  │ 카카오톡 │  │ 앱 웹뷰  │  │ 기타 채널    │    │
│  │ + Vite)  │  │ 챗봇     │  │          │  │ (향후)       │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘    │
│       └──────────────┴──────────────┴───────────────┘            │
│                              │ 통합 Chat API                     │
└──────────────────────────────┼───────────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────────┐
│                    Express Backend (3001)                          │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   Chat Engine Core                           │ │
│  │  ┌──────────────┐ ┌──────────────┐ ┌─────────────────────┐ │ │
│  │  │ Session      │ │ Guided Flow  │ │ Plugin-based Tool   │ │ │
│  │  │ Manager      │ │ Controller   │ │ Router & Executor   │ │ │
│  │  └──────────────┘ └──────────────┘ └──────────┬──────────┘ │ │
│  └───────────────────────────────────────────────│────────────┘ │
│                                                   │              │
│  ┌── Plugin Registry ────────────────────────────▼────────────┐ │
│  │                                                             │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │ │
│  │  │ telecom  │ │ rental   │ │ usim     │ │ usedPhone│     │ │
│  │  │ 인터넷TV │ │ 가전렌탈 │ │ 알뜰폰  │ │ 중고폰   │     │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘     │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │ │
│  │  │ moving   │ │ insurance│ │ card     │ │ ...      │     │ │
│  │  │ 이사     │ │ 보험     │ │ 카드     │ │ (확장)   │     │ │
│  │  │ (2차)    │ │ (2차)    │ │ (2차)    │ │          │     │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘     │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌───────────────┐ ┌───────────────┐ ┌────────────────────────┐ │
│  │ Claude API    │ │ Supabase DB   │ │ 공통 파이프라인         │ │
│  │ (Tool Use)    │ │ (상품+고객)   │ │ 리드→CRM→상담사→계약  │ │
│  └───────────────┘ └───────────────┘ └────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. 백엔드 설계

### 3.1 Chat Engine — 핵심 신규 모듈

#### 파일 구조 — 플러그인 아키텍처

```
server/
├── services/
│   ├── chat-engine.js          # 대화 엔진 (Claude Tool Use 오케스트레이터)
│   ├── chat-tools.js           # 도구 레지스트리 (플러그인에서 도구 수집)
│   ├── plugin-registry.js      # [신규] 플러그인 로더 + 레지스트리
│   ├── chat-session.js         # 세션(대화 상태) 관리
│   ├── rule-engine.js          # [신규] 룰엔진 (상품 매칭/가격 계산/에스컬레이션)
│   └── ai.js                   # 기존 유지 (CRM용)
├── plugins/                     # [신규] 서비스별 플러그인
│   ├── index.js                 # 플러그인 자동 로드 (디렉토리 스캔)
│   ├── telecom/                 # 1차: 인터넷+TV
│   │   ├── manifest.json        # 플러그인 메타 (이름, 버전, 도구 목록)
│   │   ├── tools.js             # search_telecom, compare_telecom 등
│   │   ├── data.js              # 상품 데이터 (기존 products.js 인터넷 부분)
│   │   └── survey.js            # 가이디드 설문 설정
│   ├── rental/                  # 1차: 가전렌탈
│   │   ├── manifest.json
│   │   ├── tools.js
│   │   ├── data.js
│   │   └── survey.js
│   ├── usim/                    # 1차: 알뜰폰
│   │   └── ...
│   ├── usedPhone/               # 1차: 중고폰 매입
│   │   └── ...
│   └── _template/               # 신규 플러그인 템플릿
│       ├── manifest.json
│       ├── tools.js
│       └── survey.js
├── routes/
│   ├── chat.js                  # 채팅 API 엔드포인트
│   └── ai.js                   # 기존 유지 (CRM용)
```

#### 3.1.1 Chat Session Manager (`chat-session.js`)

세션별 대화 상태를 관리한다. Supabase `bongi_chat_sessions` 테이블에 영속화.

```javascript
// 세션 구조
{
  session_id: "uuid",
  mode: "guided",            // "guided" (가이디드 설문) | "free" (자유 대화)
  messages: [],              // Claude messages 배열

  // 가이디드 플로우 상태 (smartchoice-v2 패턴)
  guided_flow: {
    step: "category",        // category → survey → recommendation → cta → done
    category: null,          // "internet" | "rental" | "usim" | "usedPhone"
    survey_answers: {},      // { family_size: "3~4명", usage: "일반", tv: true, carrier: "KT" }
    recommended_products: [],// AI가 추천한 상품 ticket 배열 (최대 2개)
    selected_product: null,  // 고객이 선택한 상품 ticket
  },

  // 수집된 고객 정보
  collected_info: {
    name: null,
    phone: null,
    address: null,
    preferred_callback_time: null, // "연락받기" 시 희망 시간
    interested_products: [],       // 관심 상품 ticket 배열
  },

  lead_status: "browsing",  // browsing → interested → info_collecting → lead_created
  lead_id: null,             // CRM 리드 등록 후 ID
  channel: "web",            // "web" | "kakao" | "app" (향후 멀티채널)
  created_at: "...",
  last_active_at: "...",
}
```

- 메모리 내 Map + Supabase 영속화 (dual-write)
- 비활성 세션 30분 후 자동 정리 (메모리에서만, DB는 유지)
- 세션 ID는 클라이언트 localStorage에 저장 → 재방문 시 대화 이어가기
- `mode`가 "guided"면 설문 칩/라디오 UI 표시, "free"면 자유 입력

#### 3.1.2 NLU 4레이어 채팅 엔진 (`chat-engine.js`)

**핵심 전환**: 이것은 "많이 말하는 챗봇"이 아니라 **"적게 묻고 정확히 연결하는 전환(매출) 중심 AI 엔진"**이다.

```
고객 메시지
    ↓
┌─ Layer 1: Intent Classification (의도 분류) ──────────────┐
│  Claude가 의도 + 신뢰도 판별                               │
│  → internet_tv | appliance_rental | usim | budget_phone   │
│    | used_phone_tradein | mixed_intent                     │
│    | consultation_direct | unknown                         │
└────────────────────────┬──────────────────────────────────┘
                         ↓
┌─ Layer 2: Slot Extraction (슬롯 추출) ────────────────────┐
│  Claude가 발화에서 정보 추출 → 세션에 누적                 │
│  extracted_slots + missing_slots 계산                      │
│  (AI는 추출만, 가격/혜택 판단은 룰엔진)                    │
└────────────────────────┬──────────────────────────────────┘
                         ↓
┌─ Layer 3: Next Question (질문 생성) ──────────────────────┐
│  missing_slots 기반으로 다음 질문 결정                     │
│  규칙: 버튼 우선, 한번에 하나, 재질문 금지                 │
│  목표: 최소 3~5개 질문으로 전환 도달                       │
└────────────────────────┬──────────────────────────────────┘
                         ↓
┌─ Layer 4: Action (추천/상담 연결) ────────────────────────┐
│  슬롯 충족 → 룰엔진으로 상품 매칭 → 상품카드 2개 표시     │
│  복잡/불확실 → 상담사 에스컬레이션                         │
│  관심 확인 → CTA (바로상담/연락받기)                       │
└───────────────────────────────────────────────────────────┘
```

**AI와 비즈니스 로직 분리 원칙:**

| 영역 | AI (Claude) 담당 | 룰엔진 (코드) 담당 |
|------|-----------------|-------------------|
| 의도 분류 | O (자연어 이해) | |
| 슬롯 추출 | O (발화에서 정보 추출) | |
| 질문 생성 | O (자연스러운 대화체) | missing_slots 결정 |
| 상품 추천 | O (설명/비교 문구) | **가격/혜택/정책 매칭** |
| 가격 계산 | | **O (할인/캐시백 = 룰엔진)** |
| 리드 등록 | | **O (CRM 연동 = 코드)** |
| 상담 에스컬레이션 | | **O (조건 판단 = 코드)** |

```javascript
// 핵심 로직 흐름
async function processMessage(sessionId, userMessage) {
  const session = await getSession(sessionId);
  session.messages.push({ role: "user", content: userMessage });

  // ── Layer 1+2: Claude에게 의도 분류 + 슬롯 추출 요청 ──
  const nluResult = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: NLU_SYSTEM_PROMPT,
    tools: [ANALYZE_INTENT_TOOL],  // 구조화된 출력을 강제하는 단일 도구
    tool_choice: { type: "tool", name: "analyze_message" },
    messages: session.messages,
  });

  // Claude의 구조화된 분석 결과
  const analysis = extractToolResult(nluResult);
  // {
  //   detected_intent: "internet_tv",
  //   confidence_score: 0.92,
  //   extracted_slots: { family_size: "3명", tv: true, carrier: null },
  //   missing_slots: ["carrier", "speed_preference"],
  //   recommended_next_action: "ask_question",  // ask_question | show_recommendation | escalate
  //   reasoning: "고객이 3인 가족 인터넷+TV를 찾고 있음, 통신사 미결정"
  // }

  // ── 세션에 슬롯 누적 (이전 대화에서 수집한 것 + 이번 추출) ──
  mergeSlots(session, analysis.detected_intent, analysis.extracted_slots);

  // ── Layer 3+4: 다음 액션 결정 (룰엔진) ──
  const action = determineAction(session, analysis);

  let reply;
  let uiElements = [];

  switch (action.type) {
    case "ask_question":
      // Claude에게 다음 질문 생성 요청 (missing_slots 기반)
      reply = await generateQuestion(session, action.missing_slot, action.options);
      uiElements = [{ type: "actions", buttons: action.options }];
      break;

    case "show_recommendation":
      // 룰엔진으로 상품 매칭 → Claude에게 추천 문구 생성
      const products = ruleEngine.matchProducts(session.intent, session.slots);
      reply = await generateRecommendation(session, products);
      uiElements = products.map(p => ({ type: "product_card", data: p }));
      uiElements.push({ type: "cta", data: { products } });
      break;

    case "escalate":
      // 상담사 연결
      reply = await generateEscalationMessage(session, action.reason);
      uiElements = [{ type: "cta", data: { escalation: true } }];
      break;
  }

  session.messages.push({ role: "assistant", content: reply });
  await saveSession(session);

  return {
    reply,
    ui_elements: uiElements,
    lead_status: session.lead_status,
    // 디버그/분석용 (프론트에서는 사용 안 함)
    _nlu: {
      intent: analysis.detected_intent,
      confidence: analysis.confidence_score,
      filled_slots: session.slots,
      missing_slots: analysis.missing_slots,
      action: action.type,
    },
  };
}
```

#### 3.1.2.1 의도 분류 도구 (`analyze_message`)

Claude에게 구조화된 NLU 분석을 강제하는 단일 도구.

```javascript
const ANALYZE_INTENT_TOOL = {
  name: "analyze_message",
  description: "고객 메시지를 분석하여 의도, 슬롯, 다음 액션을 판별합니다.",
  input_schema: {
    type: "object",
    properties: {
      detected_intent: {
        type: "string",
        enum: [
          "internet_tv",           // 인터넷+TV 상담
          "appliance_rental",      // 가전렌탈 상담
          "usim",                  // 알뜰폰/유심
          "budget_phone",          // 알뜰요금제
          "used_phone_tradein",    // 중고폰 매입
          "mixed_intent",          // 복합 의도 (인터넷+렌탈 등)
          "consultation_direct",   // 즉시 상담 요청
          "unknown",               // 의도 불명확
        ],
        description: "고객의 주요 의도",
      },
      confidence_score: {
        type: "number",
        description: "의도 분류 신뢰도 (0~1)",
      },
      extracted_slots: {
        type: "object",
        description: "이번 메시지에서 새로 추출된 정보 (슬롯)",
      },
      missing_slots: {
        type: "array",
        items: { type: "string" },
        description: "추천을 위해 아직 필요한 정보 목록",
      },
      recommended_next_action: {
        type: "string",
        enum: ["ask_question", "show_recommendation", "escalate"],
        description: "권장 다음 액션",
      },
      reasoning: {
        type: "string",
        description: "판단 근거 (1문장)",
      },
    },
    required: ["detected_intent", "confidence_score", "extracted_slots",
               "missing_slots", "recommended_next_action", "reasoning"],
  },
};
```

#### 3.1.2.2 카테고리별 슬롯 정의

각 의도(Intent)에 필요한 슬롯(Slot) 구조. 모든 슬롯이 채워지면 추천 가능.

**인터넷+TV (`internet_tv`)**

| 슬롯 | 타입 | 필수 | 옵션 | 질문 예시 |
|------|------|------|------|----------|
| `family_size` | string | O | "1~2명", "3~4명", "5명 이상" | "몇 분이서 사용하시나요?" |
| `tv_needed` | boolean | O | true/false | "TV도 함께 필요하세요?" |
| `ott_usage` | boolean | | true/false | "넷플릭스 같은 OTT 많이 보시나요?" |
| `carrier_pref` | string | | "KT", "SK", "LG", "상관없음" | "선호하시는 통신사 있으세요?" |
| `region` | string | | 자유입력 | "설치 지역이 어디쯤이세요?" |
| `speed_pref` | string | | "100M", "500M", "1G" | (가족수/용도로 자동 추론) |

**가전렌탈 (`appliance_rental`)**

| 슬롯 | 타입 | 필수 | 옵션 | 질문 예시 |
|------|------|------|------|----------|
| `product_type` | string | O | "정수기", "공기청정기", "비데" | "어떤 제품이 필요하세요?" |
| `brand_pref` | string | | "코웨이", "LG", "상관없음" | "선호 브랜드 있으세요?" |
| `budget` | string | | "2만원대", "3만원대", "상관없음" | "월 예산이 어느 정도세요?" |
| `features` | array | | "냉온정", "자가관리", "스마트" | (제품 종류로 자동 추론) |

**알뜰폰/유심 (`usim` / `budget_phone`)**

| 슬롯 | 타입 | 필수 | 옵션 | 질문 예시 |
|------|------|------|------|----------|
| `data_usage` | string | O | "적음(6GB)", "보통(11GB)", "많음(무제한)" | "데이터를 얼마나 쓰시나요?" |
| `call_usage` | string | | "적음", "보통", "많음" | (기본 무제한이므로 질문 생략 가능) |
| `carrier_pref` | string | | "KT", "SK", "LG", "상관없음" | "선호 통신사 있으세요?" |
| `number_port` | boolean | | true/false | "기존 번호 유지하시나요?" |

**중고폰 매입 (`used_phone_tradein`)**

| 슬롯 | 타입 | 필수 | 옵션 | 질문 예시 |
|------|------|------|------|----------|
| `brand` | string | O | "삼성", "애플", "LG", "기타" | "어떤 브랜드 폰인가요?" |
| `model` | string | O | 자유입력 | "정확한 모델명 알려주세요 (예: 갤럭시 S24)" |
| `storage` | string | O | "64GB", "128GB", "256GB", "512GB+" | "저장 용량이 어떻게 되나요?" |
| `carrier_lock` | string | | "SKT", "KT", "LGU+", "자급제" | "통신사 잠금이 있나요?" |
| `condition` | string | O | "상", "중", "하" | "외관 상태는 어떤가요?" |
| `screen_condition` | string | O | "깨끗", "잔기스", "파손" | "액정 상태는요?" |
| `battery_health` | string | | "90%+", "80~89%", "80% 미만", "모름" | "배터리 성능은 어떤가요?" |
| `purchase_date` | string | | 자유입력 | "대략 언제 구매하셨나요?" |
| `accessories` | array | | "충전기", "박스", "이어폰", "없음" | "구성품은 뭐가 있나요?" |
| `region` | string | | 자유입력 | "어느 지역이세요? (방문/택배 안내)" |

#### 3.1.2.3 룰엔진 — 상품 매칭 (`rule-engine.js`)

AI가 아닌 코드가 가격/혜택/정책을 판단한다.

```javascript
// server/services/rule-engine.js

export const ruleEngine = {
  // 슬롯 기반 상품 매칭 (AI 개입 없음)
  matchProducts(intent, slots) {
    const plugin = pluginRegistry.plugins.get(intentToPlugin(intent));
    const allProducts = plugin.getData();

    // 필터링 (슬롯 값 기반)
    let candidates = allProducts;
    if (slots.carrier_pref && slots.carrier_pref !== "상관없음") {
      candidates = candidates.filter(p => p.carrier === slots.carrier_pref);
    }
    if (slots.speed_pref) {
      candidates = candidates.filter(p => p.speed === slots.speed_pref);
    }
    // ... 카테고리별 필터 로직

    // 정렬: 캐시백 높은 순 (사은품 중심 전략)
    candidates.sort((a, b) => (b.cashback || 0) - (a.cashback || 0));

    // 상위 2개 반환
    return candidates.slice(0, 2).map(p => ({
      ...p,
      // 가격 계산도 룰엔진 (AI가 계산하지 않음)
      calculatedPrice: calculateActualPrice(p),
      matchReason: generateMatchReason(p, slots), // 코드 기반 매칭 사유
    }));
  },

  // 에스컬레이션 판단 (룰 기반)
  shouldEscalate(session, analysis) {
    if (analysis.confidence_score < 0.5) return { escalate: true, reason: "의도 불명확" };
    if (analysis.detected_intent === "consultation_direct") return { escalate: true, reason: "즉시 상담 요청" };
    if (analysis.detected_intent === "mixed_intent") return { escalate: true, reason: "복합 상담 필요" };
    if (session.turn_count > 10) return { escalate: true, reason: "대화 장기화" };
    return { escalate: false };
  },
};
```

#### 3.1.2.4 표준 출력 포맷

매 메시지마다 백엔드가 프론트엔드에 반환하는 구조화된 응답.

```javascript
// POST /api/chat/message 응답
{
  // 고객에게 표시
  reply: "3~4인 가족이시면 500Mbps 이상을 추천드려요! 통신사 선호가 있으세요?",
  ui_elements: [
    { type: "actions", buttons: [
      { label: "KT", value: "KT" },
      { label: "SK", value: "SK" },
      { label: "LG", value: "LG" },
      { label: "상관없어요", value: "상관없음" },
    ]},
  ],
  lead_status: "browsing",
  session_id: "abc-123",

  // NLU 분석 메타 (프론트 디버그/분석 대시보드용)
  _nlu: {
    intent: "internet_tv",
    confidence: 0.92,
    filled_slots: { family_size: "3~4명", tv_needed: true },
    missing_slots: ["carrier_pref", "region"],
    action: "ask_question",
    turn_count: 3,
  },
}
```

#### 3.1.3 플러그인 시스템 (`plugin-registry.js`)

서비스 확장의 핵심. 플러그인을 추가하면 AI가 자동으로 해당 서비스의 도구를 사용할 수 있다.

```javascript
// server/services/plugin-registry.js

class PluginRegistry {
  constructor() {
    this.plugins = new Map();  // pluginId → plugin instance
  }

  // 플러그인 등록
  register(plugin) {
    this.validate(plugin);
    this.plugins.set(plugin.id, plugin);
    console.log(`Plugin registered: ${plugin.id} (${plugin.tools.length} tools)`);
  }

  // 모든 활성 플러그인에서 도구 수집 → Claude tools 배열로 반환
  getAllTools() {
    const tools = [];
    // 공통 도구 (항상 포함)
    tools.push(...COMMON_TOOLS);
    // 플러그인별 도구
    for (const plugin of this.plugins.values()) {
      for (const tool of plugin.tools) {
        tools.push({
          ...tool.definition,
          name: `${plugin.id}_${tool.definition.name}`, // 네임스페이스: telecom_search 등
        });
      }
    }
    return tools;
  }

  // 도구 실행 라우팅 — 네임스페이스로 플러그인 식별
  async executeTool(toolName, input, session) {
    // 공통 도구인지 확인
    if (COMMON_TOOL_NAMES.includes(toolName)) {
      return executeCommonTool(toolName, input, session);
    }
    // 플러그인 도구: "telecom_search" → plugin=telecom, tool=search
    const [pluginId, ...rest] = toolName.split('_');
    const localName = rest.join('_');
    const plugin = this.plugins.get(pluginId);
    if (!plugin) throw new Error(`Unknown plugin: ${pluginId}`);
    return plugin.execute(localName, input, session);
  }

  // 활성 플러그인 목록 (시스템 프롬프트용)
  getActivePlugins() {
    return Array.from(this.plugins.values()).map(p => ({
      id: p.id, name: p.name, description: p.description, categories: p.categories,
    }));
  }
}

export const pluginRegistry = new PluginRegistry();
```

#### 플러그인 인터페이스 (각 플러그인이 구현)

```javascript
// server/plugins/telecom/index.js (예시)
export default {
  id: "telecom",
  name: "인터넷+TV",
  description: "KT/SK/LG 인터넷, TV, 전화 결합 상품 추천 및 비교",
  categories: ["internet"],
  version: "1.0.0",

  // 이 플러그인이 제공하는 도구 목록
  tools: [
    {
      definition: { name: "search", description: "인터넷+TV 상품 검색", input_schema: { ... } },
      handler: async (input, session) => { /* 상품 검색 로직 */ },
    },
    {
      definition: { name: "compare", description: "상품 비교표 생성", input_schema: { ... } },
      handler: async (input, session) => { /* 비교 로직 */ },
    },
    {
      definition: { name: "detail", description: "상품 상세 조회", input_schema: { ... } },
      handler: async (input, session) => { /* 상세 조회 */ },
    },
    {
      definition: { name: "calculate", description: "할인/캐시백 계산", input_schema: { ... } },
      handler: async (input, session) => { /* 가격 계산 */ },
    },
  ],

  // 도구 실행 라우터
  async execute(toolName, input, session) {
    const tool = this.tools.find(t => t.definition.name === toolName);
    if (!tool) throw new Error(`Unknown tool: ${toolName}`);
    return tool.handler(input, session);
  },

  // 가이디드 설문 설정
  survey: {
    title: "인터넷+TV 맞춤 추천",
    questions: [ /* ... */ ],
  },
};
```

#### 공통 도구 vs 플러그인 도구

| 구분 | 도구명 | 설명 | 소속 |
|------|--------|------|------|
| **공통** | `collect_customer_info` | 이름/연락처/주소 수집 | 코어 (모든 서비스 공유) |
| **공통** | `create_lead` | CRM 리드 등록 | 코어 |
| **공통** | `show_application_form` | 인라인 폼 표시 | 코어 |
| **공통** | `check_store_info` | 매장 정보 + 지도 | 코어 |
| **공통** | `request_callback` | 상담사 콜백 요청 | 코어 |
| **공통** | `show_product_images` | 이미지 표시 | 코어 |
| **플러그인** | `telecom_search` | 인터넷+TV 상품 검색 | telecom |
| **플러그인** | `telecom_compare` | 인터넷+TV 비교표 | telecom |
| **플러그인** | `telecom_detail` | 인터넷+TV 상세 | telecom |
| **플러그인** | `telecom_calculate` | 인터넷+TV 가격 계산 | telecom |
| **플러그인** | `rental_search` | 가전렌탈 검색 | rental |
| **플러그인** | `rental_compare` | 가전렌탈 비교 | rental |
| **플러그인** | `usim_search` | 알뜰폰 검색 | usim |
| **플러그인** | `usedPhone_estimate` | 중고폰 시세 조회 | usedPhone |
| **(2차)** | `moving_quote` | 이사 견적 | moving |
| **(2차)** | `insurance_compare` | 보험 비교 | insurance |

**확장 시나리오**: 이사 서비스를 추가하려면?
1. `server/plugins/moving/` 디렉토리 생성
2. `manifest.json` + `tools.js` + `data.js` + `survey.js` 작성
3. 서버 재시작 → 자동 로드 → AI가 "이사 견적 알려줘"에 응답 가능
4. 프론트엔드 변경 없음 (카테고리 칩만 자동 추가)

도구 정의는 위 플러그인 시스템(3.1.3)에서 동적으로 수집. 정적 `CHAT_TOOLS` 배열은 사용하지 않는다.

#### 3.1.4 시스템 프롬프트 (NLU 전용 + 응답 생성 이원화)

프롬프트가 2개로 분리된다: **NLU 분석용** (analyze_message 도구 강제) + **응답 생성용** (자연어 + 리치 UI).

##### NLU 분석 프롬프트 (`NLU_SYSTEM_PROMPT`)

`processMessage()` Layer 1+2에서 사용. `tool_choice: { type: "tool", name: "analyze_message" }`로 호출하므로 반드시 구조화된 분석 결과만 반환.

```javascript
const NLU_SYSTEM_PROMPT = `당신은 리턴AI의 NLU(자연어 이해) 분석 엔진입니다.

## 역할
고객 메시지를 분석하여 의도(intent), 정보(slot), 다음 액션을 판별합니다.
반드시 analyze_message 도구를 호출하여 구조화된 결과를 반환하세요.

## 의도 분류 기준
- internet_tv: 인터넷, TV, 와이파이, Wi-Fi, 결합상품, 통신사 관련
- appliance_rental: 정수기, 공기청정기, 비데, 렌탈 관련
- usim: 알뜰폰, 유심, 요금제, 데이터 관련
- budget_phone: 알뜰요금제, 저렴한 요금 관련
- used_phone_tradein: 중고폰, 폰 판매, 매입, 보상판매 관련
- mixed_intent: 2개 이상 카테고리 동시 언급
- consultation_direct: "상담원", "전화", "사람과 이야기", 즉시 상담 요청
- unknown: 위 어디에도 해당하지 않음

## 슬롯 추출 규칙
- 이번 메시지에서 **새로 언급된 정보만** extracted_slots에 포함
- 이전 대화에서 이미 추출된 슬롯은 반복하지 않음
- 추론 가능한 슬롯도 추출 (예: "3인 가족" → family_size: "3~4명")
- 가격/캐시백 계산은 하지 않음 (룰엔진 담당)

## 다음 액션 판단
- missing_slots가 0개 → show_recommendation
- missing_slots가 1개 이상 → ask_question
- confidence_score < 0.5 또는 consultation_direct → escalate
- 대화 10턴 초과 시 → escalate

## 카테고리별 필수 슬롯
- internet_tv: family_size, tv_needed (최소 2개 충족 시 추천 가능)
- appliance_rental: product_type (최소 1개 충족 시 추천 가능)
- usim/budget_phone: data_usage (최소 1개 충족 시 추천 가능)
- used_phone_tradein: brand, model, condition (최소 3개 충족 시 추천 가능)
`;
```

##### 응답 생성 프롬프트 (`RESPONSE_SYSTEM_PROMPT`)

Layer 3 질문 생성, Layer 4 추천 문구 생성에 사용. 플러그인 동적 섹션 포함.

```javascript
function buildResponsePrompt(activePlugins) {
  const pluginDescriptions = activePlugins
    .map(p => `- ${p.name}: ${p.description}`)
    .join('\n');

  return `${RESPONSE_CORE_PROMPT}

## 현재 활성 서비스
${pluginDescriptions}
`;
}

const RESPONSE_CORE_PROMPT = `당신은 리턴AI — 생활 서비스 AI 플랫폼의 상담 어시스턴트입니다.

## 리턴AI 플랫폼
"AI에게 물어보면 생활의 모든 것을 해결"
광주/전라 8개 직영 매장 운영. 대표번호: 1600-XXXX

## 핵심 원칙 (매우 중요!)
1. 고객은 "사은품/캐시백 받으러 온 사람"이다 — 모든 추천에서 캐시백/할인을 최우선 강조
2. 질문을 최소화하고 바로 추천 2개를 던져라
3. 추천 시 반드시 상품번호(K227, S340, R001 등) 포함
4. 답변 마지막에 자연스럽게 상담 유도:
   "전문 상담사가 더 좋은 조건을 안내해드릴 수 있어요!"
5. 최종 목표는 TM 상담 연결 (리드 전환)

## 추천 형식 (필수)
상품 추천 시 아래 형식을 반드시 따르세요:

**추천 1: [상품명] (상품번호)**
- 월 요금: XX,XXX원 → 실납부 XX,XXX원
- 사은품/캐시백: XX만원
- 포함 혜택: [혜택 나열]

**추천 2: [상품명] (상품번호)**
- (동일 형식)

💡 전문 상담사가 추가 할인을 안내해드릴 수 있어요!

## 질문 생성 규칙
- 누락 슬롯 중 가장 중요한 1개만 질문
- 버튼/칩으로 선택지를 제공 (타이핑보다 터치 우선)
- 질문은 1문장, 친근한 대화체
- 같은 질문 재질문 금지

## 리드 전환 전략 (적극적)
- 추천 2개 제시 후 → "어떤 상품이 끌리세요? 상담사가 더 좋은 조건 안내 가능!"
- 고객이 상품 선택 → "좋은 선택이에요! 설치 지역만 알려주시면 최종 혜택 안내드릴게요."
- 가격/조건 질문 → 답변 후 "정확한 혜택은 상담사가 안내드려요. 연락처 남기실래요?"
- "가입할게" / "상담원" / "전화" → 즉시 연락처 수집 → 리드 등록

## 행동 규칙
1. 항상 한국어, 친근한 대화체 (존댓말)
2. 가격/캐시백 숫자는 룰엔진이 제공한 값 그대로 사용 (직접 계산 금지)
3. 경쟁사 비방 금지
4. 답변은 간결하게 (3~5문장 + 상품 카드)
5. collect_customer_info는 고객이 자발적으로 정보를 제공했을 때만 호출
6. create_lead는 고객이 가입/상담을 원할 때 호출 (연락처 필수)
`;
```

#### 3.1.5 가이디드 플로우 컨트롤러 (플러그인 기반)

설문 설정은 각 플러그인의 `survey.js`에서 정의. 가이디드 플로우 컨트롤러는 플러그인에서 설문을 동적 수집.

```javascript
// server/services/guided-flow.js

import { pluginRegistry } from './plugin-registry.js';

// 플러그인에서 설문 설정 동적 수집
export function getSurveyConfig(pluginId) {
  const plugin = pluginRegistry.plugins.get(pluginId);
  if (!plugin?.survey) return null;
  return plugin.survey;
}

// 전체 카테고리 칩 목록 (프론트엔드 CategoryChips용)
export function getCategoryChips() {
  return Array.from(pluginRegistry.plugins.values()).map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    hasSurvey: !!p.survey?.questions?.length,
  }));
  // 결과 예: [{ id: "telecom", name: "인터넷+TV", hasSurvey: true }, ...]
  // 2차에 moving 플러그인 추가 시 자동으로 칩에 포함
}

// 설문 결과 → AI 추천 프롬프트 생성
export function buildSurveyPrompt(pluginId, answers) {
  const plugin = pluginRegistry.plugins.get(pluginId);
  return `고객이 ${plugin.name} 설문을 완료했습니다.
답변: ${JSON.stringify(answers)}
${pluginId}_search 도구로 검색하고, 설문 결과에 가장 적합한 상품 2개를 추천해주세요.
반드시 사은품/캐시백을 강조하고, 답변 마지막에 상담 연결을 유도하세요.`;
}
```

**각 플러그인의 설문 정의 예시** (`plugins/telecom/survey.js`):

```javascript
export default {
  title: "인터넷+TV 맞춤 추천",
  questions: [
    { id: "family_size", label: "가족 수", options: ["1~2명", "3~4명", "5명 이상"] },
    { id: "usage", label: "주 용도", options: ["일반 (웹서핑/동영상)", "게임/재택근무", "사업장"] },
    { id: "tv", label: "TV 필요", options: ["필요", "불필요"] },
    { id: "carrier", label: "선호 통신사", options: ["KT", "SK", "LG", "상관없음"] },
  ],
};
// 다른 플러그인도 동일한 인터페이스로 survey.js 작성
```

### 3.2 새 API 엔드포인트 (`routes/chat.js`)

| 엔드포인트 | 메서드 | 인증 | 설명 |
|-----------|--------|------|------|
| `/api/chat/session` | POST | 없음 | 새 채팅 세션 생성, session_id 반환 |
| `/api/chat/session/:id` | GET | 없음 | 기존 세션 메시지 복원 |
| `/api/chat/message` | POST | 없음 | 자유 대화 메시지 전송 → AI 응답 |
| `/api/chat/survey` | GET | 없음 | 카테고리별 설문 항목 조회 |
| `/api/chat/guided` | POST | 없음 | 가이디드 플로우: 설문 제출 → AI 추천 2개 |
| `/api/chat/lead` | POST | 없음 | "바로상담" / "연락받기" CTA 처리 → 리드 등록 |
| `/api/chat/stream` | POST | 없음 | SSE 스트리밍 응답 (Phase 2) |

**`POST /api/chat/message` 응답 형식 (자유 대화):**

```json
{
  "reply": "KT 인터넷+TV 500Mbps 상품을 추천드립니다! ...",
  "ui_elements": [
    {
      "type": "product_card",
      "data": { "ticket": "K227", "name": "KT 인터넷+TV 500Mbps 3년", "actualPrice": 14700, "cashback": 370000, ... }
    }
  ],
  "lead_status": "interested",
  "session_id": "abc-123"
}
```

**`POST /api/chat/guided` 요청/응답 (가이디드 플로우):**

```json
// 요청
{
  "session_id": "abc-123",
  "category": "internet",
  "answers": {
    "family_size": "3~4명",
    "usage": "일반",
    "tv": "필요",
    "carrier": "상관없음"
  }
}

// 응답
{
  "reply": "고객님께 딱 맞는 상품 2개를 찾았어요!",
  "recommendations": [
    {
      "rank": 1,
      "ticket": "K227",
      "name": "KT 인터넷+TV 500Mbps 3년",
      "monthlyPrice": 33000,
      "actualPrice": 14700,
      "cashback": 370000,
      "match_reason": "3~4인 가족에 가성비 최고"
    },
    {
      "rank": 2,
      "ticket": "S340",
      "name": "SK 인터넷+TV+전화 1Gbps 3년",
      "monthlyPrice": 41000,
      "actualPrice": 23500,
      "cashback": 350000,
      "match_reason": "전화 포함, 속도 업그레이드"
    }
  ],
  "cta_message": "전문 상담사가 추가 할인을 안내해드릴 수 있어요!",
  "session_id": "abc-123"
}
```

**`POST /api/chat/lead` 요청 (CTA 처리):**

```json
// "바로상담" — 즉시 TM 연결
{
  "session_id": "abc-123",
  "type": "instant_call",
  "phone": "010-1234-5678",
  "selected_product": "K227"
}

// "연락받기" — 콜백 예약
{
  "session_id": "abc-123",
  "type": "callback",
  "name": "홍길동",
  "phone": "010-1234-5678",
  "preferred_time": "오후 2시~4시",
  "selected_product": "K227"
}
```

### 3.3 기존 `/api/ai` 유지

CRM 상담사용 AI (`/api/ai/recommend`, `/api/ai/script`)는 그대로 유지. 고객 채팅은 `/api/chat`으로 분리.

---

## 4. 프론트엔드 설계

### 4.1 UI 구조 — 채팅 + 가이디드 플로우 하이브리드

```
client/src/
├── pages/
│   ├── Chat.jsx                  # 메인 채팅 페이지 (전체화면)
│   ├── Home.jsx                  # 기존 → 채팅 진입 랜딩으로 변경
│   └── ...                       # 기존 페이지 유지 (상품 목록 등)
├── components/
│   ├── chat/
│   │   ├── ChatContainer.jsx     # 채팅 전체 레이아웃
│   │   ├── MessageList.jsx       # 메시지 목록 (스크롤)
│   │   ├── MessageBubble.jsx     # 개별 메시지 버블 (리치 요소 렌더링 허브)
│   │   ├── ChatInput.jsx         # 입력 영역 (텍스트 + 전송)
│   │   ├── CategoryChips.jsx     # 카테고리 선택 칩 (인터넷/렌탈/알뜰폰/중고폰)
│   │   ├── SurveyForm.jsx        # 인라인 설문 (라디오 버튼 그룹)
│   │   ├── ProductCard.jsx       # 인라인 상품 카드 (캐시백 강조)
│   │   ├── ProductCarousel.jsx   # [리치] 상품 캐러셀 (좌우 스와이프)
│   │   ├── CompareTable.jsx      # 인라인 비교표
│   │   ├── ImageModal.jsx        # [리치] 이미지 풀스크린 모달
│   │   ├── MapModal.jsx          # [리치] 매장 지도 모달
│   │   ├── InlineForm.jsx        # [리치] 범용 인라인 폼 (가입 신청 등)
│   │   ├── ActionButtons.jsx     # [리치] 컨텍스트 액션 버튼 그룹
│   │   ├── CTAButtons.jsx        # "바로상담" + "연락받기" 이중 CTA
│   │   ├── LeadForm.jsx          # 정보 수집 폼 (연락처/주소/시간)
│   │   ├── QuickActions.jsx      # 빠른 질문 버튼
│   │   └── TypingIndicator.jsx   # AI 응답 중 표시
│   └── ...
├── hooks/
│   ├── useChat.js                # 채팅 상태 관리 커스텀 훅
│   └── useModal.js               # 모달 상태 관리 훅
```

### 4.2 핵심 컴포넌트 설계

#### `Chat.jsx` — 메인 페이지

- 전체 화면 채팅 인터페이스 (모바일 퍼스트, max-width: 768px)
- 상단: 리턴AI 로고 + "AI 상담" 타이틀
- 중앙: 메시지 목록 (자동 스크롤)
- 하단: 입력 영역 고정

#### 화면 흐름 — 가이디드 플로우 (smartchoice-v2 패턴)

**Step 1: 진입 — 카테고리 선택**
```
┌──────────────────────────────────┐
│ AI: 안녕하세요! 리턴AI이에요  │
│ 어떤 상품이 궁금하세요?          │
│                                  │
│ ┌─ CategoryChips ─────────────┐  │
│ │ [인터넷+TV] [가전렌탈]       │  │
│ │ [알뜰폰]   [중고폰 매입]    │  │
│ └──────────────────────────────┘ │
│                                  │
│ 또는 자유롭게 질문해주세요!       │
│ "인터넷 요금 비교" "정수기 추천"  │
└──────────────────────────────────┘
```

**Step 2: 간단 설문 (2~4개 라디오)**
```
┌──────────────────────────────────┐
│ AI: 인터넷+TV 맞춤 추천해드릴게요│
│                                  │
│ ┌─ SurveyForm ────────────────┐  │
│ │ 가족 수:  (1~2) (3~4) (5+)  │  │
│ │ 주 용도:  (일반) (게임) (업무)│  │
│ │ TV:      (필요) (불필요)     │  │
│ │ 통신사:  (KT) (SK) (LG) (X) │  │
│ │                              │  │
│ │      [맞춤 추천 받기]         │  │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

**Step 3: 추천 2개 + CTA (핵심 전환 화면)**
```
┌──────────────────────────────────┐
│ AI: 고객님께 딱 맞는 상품이에요! │
│                                  │
│ ┌─ ProductCard (추천 1) ──────┐  │
│ │ K227 | KT 인터넷+TV 500Mbps │  │
│ │ 월 33,000 → 실납부 14,700원 │  │
│ │ ★ 사은품/캐시백 37만원 ★     │  │
│ │ Wi-Fi 공유기 무료, 셋톱박스  │  │
│ │        [이 상품 선택]         │  │
│ └──────────────────────────────┘ │
│                                  │
│ ┌─ ProductCard (추천 2) ──────┐  │
│ │ K310 | KT 인터넷+TV 1Gbps   │  │
│ │ 월 38,500 → 실납부 20,200원 │  │
│ │ ★ 사은품/캐시백 42만원 ★     │  │
│ │ Wi-Fi 6, UHD 채널 포함      │  │
│ │        [이 상품 선택]         │  │
│ └──────────────────────────────┘ │
│                                  │
│ [두 상품 비교하기]                │
│                                  │
│ 전문 상담사가 추가 할인 안내      │
│ 가능해요! 아래에서 선택해주세요   │
└──────────────────────────────────┘
```

**Step 4: CTA — "바로상담" / "연락받기"**
```
┌──────────────────────────────────┐
│ ┌─ CTAButtons ────────────────┐  │
│ │                              │  │
│ │  [바로상담 받기]              │  │
│ │  전화번호만 입력하면          │  │
│ │  상담사가 바로 연락드려요     │  │
│ │                              │  │
│ │  [연락 시간 예약]             │  │
│ │  원하는 시간에 연락드려요     │  │
│ │                              │  │
│ └──────────────────────────────┘ │
│                                  │
│ ┌─ LeadForm (바로상담 선택 시)─┐ │
│ │ 전화번호: [010-    -    ]    │ │
│ │ 선택상품: K227 (자동)        │ │
│ │        [상담 신청하기]        │ │
│ └──────────────────────────────┘ │
│                                  │
│ ┌─ LeadForm (연락받기 선택 시)─┐ │
│ │ 이름:     [         ]        │ │
│ │ 전화번호: [010-    -    ]    │ │
│ │ 희망시간: (오전) (오후) (저녁)│ │
│ │        [예약 신청하기]        │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

#### `ProductCard.jsx` — 사은품/캐시백 강조 (smartchoice-v2 핵심)

- 캐시백 금액을 가장 눈에 띄게 표시 (큰 폰트 + 강조색)
- 월요금 → 할인 → 실납부 순서로 가격 비교감 부여
- "이 상품 선택" 버튼 → 자동 메시지 또는 CTA 단계로 이동

#### `CompareTable.jsx` — 비교표 (2~3개 상품)

- 가격, 속도, 혜택, 캐시백 컬럼
- 모바일에서도 읽기 좋은 카드형 레이아웃 (가로 스크롤 아님)

#### `CTAButtons.jsx` — 이중 CTA (smartchoice-v2 검증 패턴)

- "바로상담": 전화번호만 입력 → 즉시 TM 연결 (최소 friction)
- "연락받기": 이름/연락처/시간 → 콜백 예약 (느긋한 고객용)
- 이 2가지 CTA가 smartchoice-v2에서 가장 높은 전환율을 보인 패턴

### 4.3 리치 UI 요소 (Rich Content Elements)

채팅 하나로 기존 웹사이트의 모든 기능을 대체하기 위한 리치 콘텐츠 컴포넌트.
대화 흐름 안에 자연스럽게 임베드되며, 페이지 이동 없이 모든 인터랙션을 처리한다.

#### 4.3.1 `ImageModal.jsx` — 이미지 풀스크린 모달

상품 이미지, 요금표, 프로모션 배너 등을 채팅 내에서 탭하면 풀스크린으로 표시.

```
채팅 내 썸네일 (탭)
    ↓
┌──────────────────────────────────┐
│ ╔══════════════════════════════╗ │
│ ║                              ║ │
│ ║      (풀스크린 이미지)        ║ │
│ ║    상품 이미지 / 요금표       ║ │
│ ║    핀치 투 줌 지원            ║ │
│ ║                              ║ │
│ ╚══════════════════════════════╝ │
│                                  │
│  [X 닫기]     < 1/3 >  [공유]   │
│                                  │
│  캡션: KT 인터넷+TV 500M 요금표  │
└──────────────────────────────────┘
```

- **트리거**: ProductCard 내 썸네일 탭, AI가 이미지를 포함한 응답 시
- **기능**: 풀스크린 오버레이, 핀치 투 줌(모바일), 좌우 스와이프(여러 장), 닫기(X 또는 배경 탭)
- **데이터**: `ui_elements` 내 `{ type: "image", src: "/images/K227.jpg", caption: "...", zoomable: true }`
- **구현**: `<dialog>` 엘리먼트 + CSS backdrop + touch-action: pinch-zoom

#### 4.3.2 `ProductCarousel.jsx` — 상품 캐러셀

상품이 3개 이상일 때 좌우 스와이프로 탐색. 카테고리 전체 상품 브라우징이나 "인터넷 전체 보여줘" 요청 시 사용.

```
┌──────────────────────────────────┐
│ AI: 인터넷 상품 전체를 보여드려요 │
│                                  │
│ ◀ ┌──────────┐ ┌──────────┐ ▶   │
│   │ K227     │ │ K310     │     │
│   │ 500Mbps  │ │ 1Gbps   │     │
│   │ 14,700원 │ │ 20,200원│     │
│   │ 캐시백   │ │ 캐시백   │     │
│   │ 37만원   │ │ 42만원   │     │
│   │ [선택]   │ │ [선택]   │     │
│   └──────────┘ └──────────┘     │
│         ● ○ ○ ○ (페이지 인디)   │
└──────────────────────────────────┘
```

- **트리거**: 카테고리 전체 상품 표시, "더 보여줘" 요청
- **기능**: 좌우 스와이프(터치), 화살표 버튼(데스크톱), 페이지 인디케이터
- **카드 단위**: ProductCard 재사용 (compact 모드)
- **구현**: CSS scroll-snap + IntersectionObserver (라이브러리 없이 네이티브)
- **반응형**: 모바일 1장씩, 태블릿 2장, 데스크톱 3장

#### 4.3.3 `InlineForm.jsx` — 범용 인라인 폼

가입 신청, 주소 입력, 추가 정보 수집 등을 대화 안에서 바로 처리. 페이지 이동 없음.

```
┌──────────────────────────────────┐
│ AI: 가입 정보를 입력해주세요!     │
│                                  │
│ ┌─ InlineForm ────────────────┐  │
│ │ 이름     [           ]      │  │
│ │ 연락처   [010-    -    ]    │  │
│ │ 설치주소 [           ] [검색]│  │
│ │ 희망일   [  날짜 선택  ]    │  │
│ │                              │  │
│ │ ☑ 개인정보 수집 동의         │  │
│ │                              │  │
│ │     [신청 완료하기]           │  │
│ └──────────────────────────────┘ │
│                                  │
│ * 입력하신 정보는 상담 목적으로  │
│   만 사용됩니다.                 │
└──────────────────────────────────┘
```

- **트리거**: create_lead 도구 호출 전 정보 수집, "가입할게" 발화 시
- **기능**: 폼 검증 (전화번호 형식, 필수 항목), 개인정보 동의 체크, 제출 시 메시지로 변환
- **LeadForm과 차이**: LeadForm은 "바로상담/연락받기" 특화, InlineForm은 범용 (가입 신청서 등 확장)
- **구현**: 제출 완료 시 폼이 읽기 전용 요약으로 전환 (재편집 방지)

#### 4.3.4 `MapModal.jsx` — 매장 지도 모달

"가까운 매장", "매장 위치" 요청 시 지도를 모달로 표시.

```
┌──────────────────────────────────┐
│ ╔══════════════════════════════╗ │
│ ║         (지도 영역)          ║ │
│ ║    📍봉이모바일 광주점        ║ │
│ ║    📍봉이모바일 전남점        ║ │
│ ║    📍봉이모바일 순천점        ║ │
│ ║                              ║ │
│ ╚══════════════════════════════╝ │
│                                  │
│  봉이모바일 광주점               │
│  광주 서구 상무대로 XXX          │
│  영업시간: 10:00~19:00           │
│  [전화걸기] [길찾기]             │
│                                  │
│  [X 닫기]                        │
└──────────────────────────────────┘
```

- **트리거**: check_store_info 도구 호출 결과, "매장 어디있어?" 질문
- **기능**: 지도 표시 + 매장 마커 + 매장 정보 카드 + 전화/길찾기 링크
- **지도 구현**: 카카오맵 API (광주/전라 지역 특화)
  - `<script>` 동적 로드, API 키는 환경변수
  - Fallback: 지도 API 로드 실패 시 정적 주소 목록 + 네이버 지도 링크
- **데이터**: `ui_elements` 내 `{ type: "map", stores: [{ name, address, lat, lng, phone, hours }] }`

#### 4.3.5 `ActionButtons.jsx` — 컨텍스트 액션 버튼

AI 응답에 따라 동적으로 표시되는 빠른 액션 버튼. 타이핑 대신 터치 한 번으로 다음 단계 진행.

```
┌──────────────────────────────────┐
│ AI: K227 상품이 마음에 드시나요?  │
│                                  │
│ ┌─ ActionButtons ──────────────┐ │
│ │ [이걸로 할게] [비교해줘]      │ │
│ │ [다른 상품 보기] [전화주세요] │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

- **트리거**: AI 응답에 `actions` 필드 포함 시 자동 표시
- **동작**: 버튼 클릭 → 해당 텍스트를 사용자 메시지로 자동 전송 → AI가 다음 응답
- **스타일**: 둥근 모서리 칩, 터치 영역 44px 이상 (접근성), 사용 후 비활성화(회색)
- **데이터**: `ui_elements` 내 `{ type: "actions", buttons: [{ label: "이걸로 할게", value: "K227 선택" }, ...] }`
- **상태**: 한 번 사용된 액션 그룹은 비활성화 (과거 메시지에서 다시 누를 수 없음)

### 4.4 리치 요소 렌더링 — `MessageBubble.jsx` 통합

`MessageBubble`이 모든 리치 요소의 렌더링 허브 역할을 한다. AI 응답의 `ui_elements` 배열을 순회하며 적절한 컴포넌트를 렌더링.

```javascript
// MessageBubble 내부 렌더링 로직
function renderUIElement(element, index) {
  switch (element.type) {
    case "product_card":
      return <ProductCard key={index} {...element.data} onSelect={handleSelect} />;
    case "product_carousel":
      return <ProductCarousel key={index} products={element.data} onSelect={handleSelect} />;
    case "compare_table":
      return <CompareTable key={index} products={element.data} />;
    case "image":
      return <ImageThumbnail key={index} {...element.data} onTap={() => openModal("image", element.data)} />;
    case "map":
      return <MapTrigger key={index} stores={element.data} onTap={() => openModal("map", element.data)} />;
    case "form":
      return <InlineForm key={index} fields={element.data.fields} onSubmit={handleFormSubmit} />;
    case "actions":
      return <ActionButtons key={index} buttons={element.data.buttons} onAction={handleAction} disabled={isPast} />;
    case "survey":
      return <SurveyForm key={index} config={element.data} onSubmit={handleSurveySubmit} />;
    case "cta":
      return <CTAButtons key={index} product={element.data.product} onSelect={handleCTA} />;
    default:
      return null;
  }
}
```

### 4.5 `ui_elements` 타입 정의 (전체 목록)

| type | 컴포넌트 | 설명 | 모달 여부 |
|------|----------|------|----------|
| `product_card` | ProductCard | 단일 상품 카드 (캐시백 강조) | 인라인 |
| `product_carousel` | ProductCarousel | 여러 상품 좌우 스와이프 | 인라인 |
| `compare_table` | CompareTable | 2~3개 상품 비교표 | 인라인 |
| `image` | ImageThumbnail → ImageModal | 썸네일 탭 → 풀스크린 | 모달 |
| `map` | MapTrigger → MapModal | "지도 보기" 탭 → 풀스크린 지도 | 모달 |
| `form` | InlineForm | 범용 입력 폼 | 인라인 |
| `actions` | ActionButtons | 빠른 액션 버튼 그룹 | 인라인 |
| `survey` | SurveyForm | 설문 라디오 그룹 | 인라인 |
| `cta` | CTAButtons + LeadForm | "바로상담"/"연락받기" | 인라인 |

#### `useChat.js` — 상태 관리 훅

```javascript
function useChat() {
  const [sessionId, setSessionId] = useState(() => localStorage.getItem('chat_session_id'));
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [leadStatus, setLeadStatus] = useState('browsing');
  const [guidedStep, setGuidedStep] = useState(null); // 가이디드 플로우 단계

  // 세션 초기화 or 복원
  useEffect(() => { ... }, []);

  // 자유 대화 메시지 전송
  async function sendMessage(content) { ... }

  // 가이디드 플로우: 설문 제출 → AI 추천
  async function submitSurvey(category, answers) { ... }

  // 액션 버튼 클릭 (상품 선택 등) → 자동 메시지 전송
  async function sendAction(action, data) {
    const msg = actionToMessage(action, data);
    return sendMessage(msg);
  }

  // 인라인 폼 제출 → 리드 등록
  async function submitLead(type, formData) { ... }

  return { messages, loading, leadStatus, guidedStep,
           sendMessage, submitSurvey, sendAction, submitLead };
}
```

#### `useModal.js` — 모달 상태 관리 훅

```javascript
function useModal() {
  const [modal, setModal] = useState(null); // { type: "image"|"map", data: ... }

  function openModal(type, data) { setModal({ type, data }); }
  function closeModal() { setModal(null); }

  return { modal, openModal, closeModal };
}
// Chat.jsx에서 useModal() → ImageModal, MapModal에 전달
```

### 4.6 라우팅 — 채팅 메인 + SEO 랜딩 구조

```javascript
// ── 메인 (고객이 실제로 사용하는 화면) ──
"/"     → Chat (전체화면 채팅 인터페이스)

// ── SEO 랜딩 (검색엔진/외부 링크용, 진입 시 채팅으로 유도) ──
"/products"            → SEO 랜딩 (카테고리 소개 + "AI 상담 시작" CTA → / 리다이렉트)
"/products/:category"  → SEO 랜딩 (상품 목록 + "맞춤 추천 받기" CTA → /?category=internet)
"/stores"              → SEO 랜딩 (매장 목록 + "가까운 매장 찾기" CTA → / 채팅)
"/apply"               → 리다이렉트 → / (가입은 채팅 InlineForm으로 대체)

// ── 백그라운드 (상담사/관리자 전용) ──
"/admin"               → CRM 어드민 (기존 그대로)
"/admin/login"         → 어드민 로그인 (기존 그대로)
```

**SEO 랜딩 페이지 동작 원칙:**
- 검색엔진 크롤러: 기존 콘텐츠 노출 (상품명, 가격, 매장 주소 등 구조화 데이터)
- 실제 고객 진입: 페이지 상단에 "AI 상담으로 더 빠르게!" 배너 → 클릭 시 채팅(`/`)으로 이동
- query parameter로 컨텍스트 전달: `/?category=internet&ticket=K227` → 채팅 시작 시 해당 상품 자동 추천
- 기존 페이지 코드는 최소 유지 (SEO 메타태그 + 핵심 콘텐츠만, 인터랙션 제거)

**기존 페이지 처리 방침:**

| 페이지 | AS-IS | TO-BE |
|--------|-------|-------|
| Home (`/`) | 카테고리 나열 | **채팅 전체화면** |
| AiChat (`/chat`) | 보조 채팅 | **삭제** (/ 로 통합) |
| Products | 상품 목록 | SEO 랜딩 (채팅 유도) |
| ProductDetail | 상품 상세 | SEO 랜딩 (채팅 유도) |
| Apply | 가입 폼 | **리다이렉트 → /** (InlineForm 대체) |
| Stores | 매장 목록 | SEO 랜딩 (채팅 유도) |
| Login/Signup/MyPage | 회원 기능 | 유지 (회원 기능은 별도) |
| `/admin/*` | CRM/CTI | **그대로 유지** (백그라운드) |

---

## 5. AI 파이프라인 설계

### 5.1 NLU 4레이어 파이프라인 (RAG 대체)

상품 데이터가 제한적(약 10개)이므로 벡터 DB 기반 RAG는 과도하다. **Claude Tool Use + 룰엔진** 이원화 구조로 처리:

```
고객 메시지
    ↓
┌─ Claude API 호출 #1: NLU 분석 ────────────────────────────┐
│  system: NLU_SYSTEM_PROMPT                                  │
│  tools: [analyze_message]                                   │
│  tool_choice: { type: "tool", name: "analyze_message" }     │
│                                                              │
│  → 구조화된 분석 결과 반환:                                  │
│    intent, confidence, extracted_slots, missing_slots, action│
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─ 룰엔진 (코드) ────────────────────────────────────────────┐
│  - 슬롯 충족 여부 판단                                       │
│  - 상품 매칭 (필터 + 캐시백 정렬)                            │
│  - 에스컬레이션 조건 판단                                     │
│  - 가격/할인 계산                                            │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─ Claude API 호출 #2: 응답 생성 ────────────────────────────┐
│  system: RESPONSE_SYSTEM_PROMPT                              │
│  - ask_question → 자연스러운 질문 1개 + 버튼 옵션            │
│  - show_recommendation → 상품 추천 문구 (룰엔진 결과 기반)   │
│  - escalate → 상담 연결 안내 문구                            │
└──────────────────────────────────────────────────────────────┘
```

- Claude는 NLU(의도/슬롯 분석)와 응답 생성만 담당
- 가격 계산, 상품 매칭, 에스컬레이션 판단은 룰엔진(코드)이 담당
- 상품 데이터가 늘어나면 (50개+) 룰엔진의 필터 로직 강화
- 향후 Supabase로 상품 DB 이전 시 룰엔진 내부만 변경, AI 인터페이스는 동일

### 5.2 대화 맥락 관리

- Claude messages 배열을 세션에 통째로 저장
- 슬롯 누적: 이전 턴에서 수집한 슬롯 + 이번 턴 추출 슬롯을 `session.slots`에 병합
- 대화가 길어지면 (20턴+) 오래된 메시지 요약 후 압축
- 수집된 슬롯은 NLU 분석 시 대화 이력에 포함되어 반복 질문 방지

### 5.3 응답 구조화

응답은 `processMessage()` (3.1.2)에서 결정된 action 타입에 따라 `ui_elements` 배열을 직접 구성. 별도 파싱 불필요:

```javascript
// action 타입에 따른 ui_elements 구성 (chat-engine.js 내부)
switch (action.type) {
  case "ask_question":
    // 룰엔진이 결정한 missing_slot의 옵션을 버튼으로 표시
    uiElements = [{ type: "actions", buttons: action.options }];
    break;
  case "show_recommendation":
    // 룰엔진이 매칭한 상품 2개를 카드로 표시
    uiElements = products.map(p => ({ type: "product_card", data: p }));
    uiElements.push({ type: "cta", data: { products } });
    break;
  case "escalate":
    // 상담사 연결 CTA 표시
    uiElements = [{ type: "cta", data: { escalation: true } }];
    break;
}
```

---

## 6. CRM 리드 연동

### 6.1 자동 리드 등록 흐름

```
채팅 대화 중 고객이 관심 표현
    ↓
AI가 자연스럽게 연락처 수집 (collect_customer_info)
    ↓
고객이 "가입할게" / "전화주세요" 발화
    ↓
AI가 create_lead 도구 호출
    ↓
create_lead 실행:
  1. bongi_applications 테이블에 INSERT (type: "ai_chat")
  2. bongi_customers 테이블에 INSERT or 기존 고객 매칭
  3. 대화 요약을 memo에 저장
  4. 상담사 자동 배정 (라운드로빈 or 최소 부하)
    ↓
세션의 lead_status → "lead_created"
    ↓
고객에게 "상담사 배정 완료! 곧 연락드리겠습니다" 안내
```

### 6.2 상담사 배정 로직

```javascript
async function assignAgent(leadData) {
  // 1. 활성 상담사 조회
  const { data: agents } = await supabase
    .from('bongi_agents')
    .select('*')
    .eq('is_active', true);

  // 2. 최소 부하 상담사 선택 (현재 진행중 상담 수 기준)
  // 3. bongi_consultations에 상담 생성
  // 4. 상담사에게 알림 (Phase 2: 실시간 알림)
}
```

### 6.3 대화 이력 연동

상담사가 CRM에서 고객을 열면 채팅 대화 이력을 볼 수 있도록:

```
bongi_chat_sessions.lead_id → bongi_customers.id (FK)
```

상담사가 고객의 AI 대화 내용을 확인하고, 맥락을 이어서 상담 가능.

---

## 7. DB 스키마 변경

### 7.1 신규 테이블

```sql
-- 채팅 세션
CREATE TABLE bongi_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  messages JSONB NOT NULL DEFAULT '[]',
  collected_info JSONB DEFAULT '{}',
  -- NLU 상태
  detected_intent TEXT,                -- 현재 의도 (internet_tv, appliance_rental 등)
  filled_slots JSONB DEFAULT '{}',     -- 누적된 슬롯 { family_size: "3~4명", tv_needed: true, ... }
  turn_count INTEGER DEFAULT 0,        -- 대화 턴 수
  -- 리드 상태
  lead_status TEXT DEFAULT 'browsing',  -- browsing, interested, info_collecting, lead_created
  lead_id UUID REFERENCES bongi_customers(id),
  channel TEXT DEFAULT 'web',           -- web, kakao, app
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_active_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_chat_sessions_lead ON bongi_chat_sessions(lead_id);
CREATE INDEX idx_chat_sessions_active ON bongi_chat_sessions(last_active_at);
```

### 7.2 기존 테이블 변경 없음

- `bongi_applications`: `channel` 컬럼에 `'ai_chat'` 값 추가 (enum이 아닌 text이므로 스키마 변경 불필요)
- `bongi_customers`, `bongi_consultations` 등: 변경 없음

---

## 8. 기존 자산 재사용 분석

### 8.1 그대로 재사용 — 백그라운드 (변경 없음)

| 파일 | 역할 | 비고 |
|------|------|------|
| `server/data/products.js` | 상품 데이터 | Tool 내부에서 직접 import |
| `server/data/stores.js` | 매장 데이터 | check_store_info + MapModal |
| `server/data/constants.js` | 공통 상수 | 가격, 등급 등 |
| `server/db/supabase.js` | DB 클라이언트 | |
| `server/middleware/*` | sanitize, errorHandler, rateLimit, auth | |
| `server/routes/crm.js` | CRM API | 상담사 백그라운드 |
| `server/routes/cti.js` | CTI API | 상담사 백그라운드 |
| `server/routes/products.js` | 상품 API | SEO 랜딩 + Tool 내부 |
| `server/routes/applications.js` | 신청 접수 | create_lead에서 로직 재사용 |
| `server/services/ai.js` | CRM용 AI | 업셀링/스크립트 (상담사용) |
| `server/services/incentive.js` | 인센티브 계산 | 상담사 백그라운드 |
| `server/cti/adapter.js` | CTI 어댑터 | 상담사 백그라운드 |
| `server/public/admin/*` | CRM 어드민 HTML | 상담사 백그라운드, 변경 없음 |

### 8.2 수정 필요

| 파일 | 변경 내용 |
|------|----------|
| `server/index.js` | `/api/chat` 라우트 추가 |
| `client/src/utils/api.js` | `api.chat.*` 메서드 추가 |
| `client/src/App.jsx` (라우터) | `/` → Chat, 기존 페이지 SEO 랜딩 전환 |
| `client/src/pages/Home.jsx` | **삭제 또는 Chat.jsx로 교체** (`/` = 채팅) |
| `client/src/pages/Products.jsx` | SEO 랜딩 전환: 콘텐츠 유지 + "AI 상담 시작" CTA 추가 |
| `client/src/pages/Stores.jsx` | SEO 랜딩 전환: 콘텐츠 유지 + "가까운 매장 찾기" CTA 추가 |
| `client/src/pages/Apply.jsx` | **리다이렉트 → `/`** (InlineForm으로 대체) |

### 8.3 신규 작성

| 파일 | 설명 |
|------|------|
| `server/services/chat-engine.js` | NLU 4레이어 채팅 엔진 (Claude Tool Use 오케스트레이터) |
| `server/services/rule-engine.js` | 룰엔진 (상품 매칭, 가격 계산, 에스컬레이션 판단) |
| `server/services/plugin-registry.js` | 플러그인 로더 + 레지스트리 |
| `server/services/chat-session.js` | 세션 관리 (슬롯 누적, 대화 상태) |
| `server/services/guided-flow.js` | 가이디드 플로우 (플러그인에서 설문 동적 수집) |
| `server/plugins/index.js` | 플러그인 자동 로드 |
| `server/plugins/telecom/*` | 인터넷+TV 플러그인 (manifest, tools, data, survey) |
| `server/plugins/rental/*` | 가전렌탈 플러그인 |
| `server/plugins/usim/*` | 알뜰폰 플러그인 |
| `server/plugins/usedPhone/*` | 중고폰 매입 플러그인 |
| `server/plugins/_template/*` | 신규 플러그인 템플릿 |
| `server/routes/chat.js` | 채팅 API 엔드포인트 |
| `client/src/pages/Chat.jsx` | 메인 채팅 페이지 |
| `client/src/components/chat/ChatContainer.jsx` | 채팅 전체 레이아웃 |
| `client/src/components/chat/MessageList.jsx` | 메시지 목록 |
| `client/src/components/chat/MessageBubble.jsx` | 개별 메시지 버블 (리치 요소 렌더링 허브) |
| `client/src/components/chat/ChatInput.jsx` | 입력 영역 |
| `client/src/components/chat/CategoryChips.jsx` | 카테고리 선택 칩 |
| `client/src/components/chat/SurveyForm.jsx` | 인라인 설문 |
| `client/src/components/chat/ProductCard.jsx` | 상품 카드 (캐시백 강조) |
| `client/src/components/chat/ProductCarousel.jsx` | 상품 캐러셀 (스와이프) |
| `client/src/components/chat/CompareTable.jsx` | 비교표 |
| `client/src/components/chat/ImageModal.jsx` | 이미지 풀스크린 모달 (핀치 줌) |
| `client/src/components/chat/MapModal.jsx` | 매장 지도 모달 (카카오맵) |
| `client/src/components/chat/InlineForm.jsx` | 범용 인라인 폼 (가입 신청 등) |
| `client/src/components/chat/ActionButtons.jsx` | 컨텍스트 액션 버튼 그룹 |
| `client/src/components/chat/CTAButtons.jsx` | "바로상담"/"연락받기" 이중 CTA |
| `client/src/components/chat/LeadForm.jsx` | 정보 수집 폼 |
| `client/src/components/chat/QuickActions.jsx` | 빠른 질문 버튼 |
| `client/src/components/chat/TypingIndicator.jsx` | AI 응답 중 표시 |
| `client/src/hooks/useChat.js` | 채팅 상태 관리 훅 |
| `client/src/hooks/useModal.js` | 모달 상태 관리 훅 |

### 8.4 삭제 대상

| 파일 | 이유 |
|------|------|
| `client/src/pages/AiChat.jsx` | Chat.jsx로 완전 대체 |
| `client/src/pages/Home.jsx` | `/` = Chat.jsx, Home 불필요 |
| `client/src/pages/ProductDetail.jsx` | 채팅 내 ProductCard로 대체 (SEO는 Products.jsx에서 처리) |

---

## 9. 구현 Phase 계획

### Phase A: NLU 엔진 + 플러그인 시스템 + 채팅 엔진 (백엔드)
1. `rule-engine.js` — 룰엔진: 상품 매칭(슬롯 기반 필터 + 캐시백 정렬), 가격 계산, 에스컬레이션 판단
2. `plugin-registry.js` — 플러그인 로더, 도구 수집, 실행 라우팅
3. `plugins/telecom/*` — 1차 플러그인: 인터넷+TV (manifest, tools, data, survey, **슬롯 정의**)
4. `plugins/rental/*`, `plugins/usim/*`, `plugins/usedPhone/*` — 1차 나머지 플러그인 (각 카테고리별 슬롯 포함)
5. `plugins/_template/*` — 신규 플러그인 템플릿
6. `chat-session.js` — 인메모리 세션 관리 (guided_flow 상태 + **슬롯 누적** 포함)
7. `guided-flow.js` — 플러그인에서 설문 동적 수집 + 추천 프롬프트 빌더
8. `chat-engine.js` — **NLU 4레이어 엔진**: analyze_message 도구 정의, processMessage() 핵심 루프 (NLU 분석 → 룰엔진 → 응답 생성), NLU/응답 프롬프트 이원화
9. `routes/chat.js` — 전체 API (session, message, survey, guided, lead)
10. `index.js` — 라우트 등록

### Phase B: 채팅 UI + 가이디드 플로우 + 리치 UI (프론트엔드)
1. `Chat.jsx` + `useChat.js` + `useModal.js` — 기본 대화 UI + 모달 상태
2. `CategoryChips.jsx` — 카테고리 선택 (진입점)
3. `SurveyForm.jsx` — 인라인 설문 (라디오 버튼)
4. `MessageBubble.jsx` — 리치 요소 렌더링 허브 (ui_elements 분기)
5. `ProductCard.jsx` — 추천 카드 (캐시백 강조, 이미지 썸네일)
6. `ProductCarousel.jsx` — 여러 상품 스와이프 (CSS scroll-snap)
7. `CompareTable.jsx` — 비교표
8. `ImageModal.jsx` — 이미지 풀스크린 (핀치 줌)
9. `MapModal.jsx` — 매장 지도 (카카오맵 API)
10. `InlineForm.jsx` — 범용 인라인 폼 (가입 신청)
11. `ActionButtons.jsx` — 컨텍스트 액션 버튼
12. `CTAButtons.jsx` + `LeadForm.jsx` — "바로상담"/"연락받기" CTA
13. `ChatInput.jsx` + `QuickActions.jsx`
14. 라우팅 변경 (`/` → Chat)

### Phase C: 리드 전환 + CRM 연동
1. `collect_customer_info`, `create_lead` 도구 구현
2. `/api/chat/lead` — 리드 등록 → bongi_applications + bongi_customers
3. 상담사 자동 배정 (라운드로빈)
4. CRM에서 채팅 이력 조회 (bongi_chat_sessions.lead_id)
5. 대화 요약 자동 저장 (상담사가 맥락 파악용)

### Phase D: ChatGPT급 UX
1. SSE 스트리밍 응답 (토큰 단위 실시간 표시)
2. Supabase 세션 영속화 + 대화 이력 관리
3. 대화 요약/압축 (20턴 이상)
4. 대화 이력 사이드바 (ChatGPT의 좌측 패널처럼)
5. 마크다운 렌더링 (표, 볼드, 리스트 등)

### Phase E: 멀티채널 + 서비스 확장
1. 채널 어댑터 시스템 (웹, 카카오톡, 앱 웹뷰)
2. 카카오 챗봇 연동 (카카오 i 오픈빌더)
3. 2차 플러그인: moving(이사), cleaning(청소), insurance(보험), card(카드)
4. 분석 대시보드 (전환율, 인기 서비스, 이탈 지점, 플러그인별 성과)
5. 3차 플러그인: finance, logistics, healthcare, energy

---

## 10. 보안 고려사항

| 항목 | 대책 |
|------|------|
| 프롬프트 인젝션 | 시스템 프롬프트에 역할 고정, 도구 호출 결과만 신뢰 |
| 개인정보 | 연락처/주소 수집 시 동의 확인 메시지 필수 |
| Rate Limit | `/api/chat/message`에 IP 기반 제한 (분당 20회) |
| XSS | 기존 sanitize 미들웨어 적용, 프론트에서 dangerouslySetInnerHTML 사용 금지 |
| 세션 탈취 | session_id는 UUID v4, 추측 불가 |
| 비용 제어 | Claude API 호출 시 max_tokens 제한, 세션당 최대 턴 수 제한 (50턴) |
| 도구 실행 안전 | create_lead는 phone 필수 검증, 중복 리드 방지 |

---

## 11. 기술 결정 요약

| 결정 | 이유 |
|------|------|
| **플러그인 아키텍처** | 서비스 확장의 핵심 — 도구만 추가하면 새 서비스 지원, 프론트 변경 최소 |
| 네임스페이스 도구명 (`telecom_search`) | 플러그인 간 도구 충돌 방지, 라우팅 자동화 |
| 동적 시스템 프롬프트 | 활성 플러그인 목록에 따라 AI 역할 자동 조정 |
| **NLU 4레이어 엔진** | 의도→슬롯→질문→액션 구조로 최소 질문+정확한 추천, AI/비즈니스 로직 분리로 가격 오류 방지 |
| **AI/룰엔진 이원화** | Claude는 NLU+응답 생성만, 가격/매칭/에스컬레이션은 코드가 담당 — 할루시네이션 방지, 정책 변경 시 코드만 수정 |
| **analyze_message 단일 도구** | tool_choice 강제로 구조화된 NLU 출력 보장, 자유 텍스트 응답 방지 |
| Claude Tool Use (벡터 RAG 아님) | 구조화된 데이터 → Tool Use가 정확하고 간단, 플러그인과 자연스럽게 통합 |
| 가이디드 + 자유 대화 하이브리드 | smartchoice-v2 설문→추천(검증됨) + 자유 대화(확장성) 병행 |
| "사은품 중심" 프롬프트 전략 | smartchoice-v2에서 검증 — 캐시백/사은품이 주요 의사결정 요인 |
| "바로상담"/"연락받기" 이중 CTA | smartchoice-v2 최고 전환율 패턴 — friction 최소화 |
| 즉시 추천 2개 (질문 최소화) | smartchoice-v2 교훈 — 질문이 많으면 이탈률 증가 |
| React + Vite (Streamlit 아님) | ChatGPT급 리치 UI, 모바일 최적화, 기존 코드 재사용 |
| 인메모리 + Supabase 세션 | 빠른 응답 + 영속화 양립 |
| SSE 스트리밍은 Phase D | MVP는 동기 응답으로 충분, 스트리밍은 ChatGPT급 UX 단계 |
| `/api/chat` 분리 (`/api/ai` 유지) | CRM용 AI와 고객 채팅은 프롬프트/컨텍스트가 다름 |
| 멀티채널은 Phase E | 웹 MVP 먼저, 채널 어댑터 패턴으로 카카오톡/앱 확장 |
| CSV → Supabase 리드 저장 | CRM 자동 연동, 상담사 배정 자동화 |

---

## 12. smartchoice-v2 → 리턴AI 전환 매핑

| smartchoice-v2 | 리턴AI | 변경 이유 |
|----------------|-----------|----------|
| Python + Streamlit | React + Vite + Express | 리치 UI, 모바일 최적화, 기존 코드베이스 활용 |
| Claude Haiku 4.5 | Claude Sonnet 4 (Tool Use) | Tool Use로 구조화된 상품 검색/비교, 더 정확한 추천 |
| 상품 JSON → system prompt | Tool Use → search_products | 상품 수 확장 시 토큰 절약, 동적 필터링 |
| 3사 인터넷/TV만 | 인터넷+TV + 가전렌탈 + 알뜰폰 + 중고폰 | 4개 카테고리 확장, 카테고리별 설문 분기 |
| 아정당 크롤링 데이터 | 리턴AI 자체 상품 DB (products.js → Supabase) | 자체 데이터, 가격/사은품 직접 관리 |
| 리드 CSV 저장 | Supabase bongi_applications + bongi_customers | CRM 자동 연동, 상담사 자동 배정 |
| 통신사 선택 칩 | 카테고리 선택 칩 (4종) | 상품 카테고리가 4개로 확장 |
| 설문 4개 라디오 | 카테고리별 2~4개 라디오 | 각 카테고리 특성에 맞는 설문 |
| 추천 2개 + 상품번호 | **동일 유지** | 검증된 패턴 — 바꿀 필요 없음 |
| "바로상담"/"연락받기" | **동일 유지** | 검증된 패턴 — 바꿀 필요 없음 |
| 단일 채널 (웹) | 웹 + 카카오톡 + 앱 (Phase E) | 세션 모델에 channel 필드로 대비 |
| 단일 서비스 | 플러그인 시스템 (무한 확장) | 도구 추가만으로 서비스 확장 |

---

## 13. 멀티채널 아키텍처 (Phase E)

```
┌──────────────────────────────────────────────────────────┐
│                   채널 어댑터 레이어                       │
│                                                           │
│  ┌──────────┐  ┌─────────────┐  ┌───────────────────┐   │
│  │ 웹 어댑터│  │ 카카오 어댑터 │  │ 앱 웹뷰 어댑터   │   │
│  │ (현재)   │  │ (오픈빌더)   │  │                   │   │
│  └────┬─────┘  └──────┬──────┘  └─────────┬─────────┘   │
│       └────────────────┴───────────────────┘              │
│                        │                                  │
│              통합 Chat API (동일 엔드포인트)               │
│              POST /api/chat/message                       │
│              { channel: "web"|"kakao"|"app", ... }        │
└──────────────────────────────────────────────────────────┘
```

- 모든 채널이 동일한 Chat Engine + Plugin 시스템 사용
- 채널별 차이: 리치 UI 렌더링 방식만 다름
  - 웹: React 컴포넌트 (ProductCard, ImageModal 등)
  - 카카오: 카카오 템플릿 메시지 (카드형, 리스트형)
  - 앱: 웹뷰 + 네이티브 브릿지
- 세션의 `channel` 필드로 채널 식별, 응답 포맷 자동 분기
