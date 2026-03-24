# AI 채팅 생활형 플랫폼 설계서 (최종)

> Claude AI 수준의 영리한 AI 채팅 + 아정당 = AI 채팅 생활형 플랫폼

---

## 1. 한 줄 정의

대화만으로 상품 추천 → 비교 → 가입 → 상담 연결을 해결하는 AI 플랫폼.
고객은 채팅 하나만 쓰면 된다. 나머지는 AI가 알아서 한다.

---

## 2. 아키텍처

```
┌─────────────────────────────────────┐
│     채팅 UI (전체화면, Claude 스타일) │
│  입력창 + 메시지 + 리치UI + 사이드바  │
└──────────────┬──────────────────────┘
               │ REST + SSE
┌──────────────▼──────────────────────┐
│         Express Backend (3001)       │
│                                      │
│  ┌────────────────────────────────┐  │
│  │  Chat Engine                    │  │
│  │  - Claude API (Tool Use)        │  │
│  │  - 세션 관리 (대화 이력)         │  │
│  │  - 도구 7개 (아래 참조)          │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────┐ │
│  │ 상품 DB  │ │ CRM/리드  │ │ CTI  │ │
│  │ (기존)   │ │ (기존)    │ │(기존)│ │
│  └──────────┘ └──────────┘ └──────┘ │
└──────────────────────────────────────┘
               │
┌──────────────▼──────────────────────┐
│         Supabase (PostgreSQL)        │
│  기존 12테이블 + chat_sessions 1개   │
└──────────────────────────────────────┘
```

---

## 3. 백엔드

### 3.1 Chat Engine (`server/services/chat-engine.js`)

```javascript
async function processMessage(sessionId, userMessage) {
  const session = getSession(sessionId);
  session.messages.push({ role: "user", content: userMessage });

  let response = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    system: SYSTEM_PROMPT,
    tools: TOOLS,
    messages: session.messages,
  });

  while (response.stop_reason === "tool_use") {
    const toolResults = await executeTools(response.content);
    session.messages.push({ role: "assistant", content: response.content });
    session.messages.push({ role: "user", content: toolResults });
    response = await claude.messages.create({
      model: "claude-sonnet-4-20250514",
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages: session.messages,
    });
  }

  session.messages.push({ role: "assistant", content: response.content });
  saveSession(session);
  return parseResponse(response);
}
```

### 3.2 도구 7개

| 도구 | 설명 | 데이터 소스 |
|------|------|------------|
| `search_products` | 카테고리/통신사/속도/가격으로 상품 검색 | data/products.js |
| `compare_products` | 2~3개 상품 비교표 | data/products.js |
| `calculate_price` | 할인/캐시백 포함 실제 가격 계산 | data/products.js + constants.js |
| `create_lead` | 상담 신청 (CRM 리드 등록) | Supabase bongi_applications |
| `request_callback` | 콜백 요청 (상담사 배정) | Supabase bongi_consultations |
| `check_store` | 가까운 매장 정보 | data/stores.js |
| `estimate_tradein` | 중고폰 매입 견적 | 모델/상태 기반 계산 |

### 3.3 시스템 프롬프트

```
당신은 리턴AI입니다. 생활 서비스 전문.

취급: 인터넷+TV, 가전렌탈, 알뜰폰, 중고폰 매입 / 8개 직영 매장 (광주/전라)

규칙:
1. 한국어, 친근한 대화체
2. 상품 정보는 반드시 도구로 조회 — 추측 금지
3. 추천은 2개까지, 상품번호 필수
4. 관심 보이면 자연스럽게 연락처 수집 → create_lead
5. "전화주세요" → request_callback
6. 모르면 "상담사 연결해드릴까요?"
7. 답변은 짧고 핵심만, 사은품/캐시백 최우선

금지: 가격 지어내기, 경쟁사 비방, 강제 정보 수집
```

### 3.4 API

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/api/chat/session` | POST | 새 세션 생성 |
| `/api/chat/session/:id` | GET | 세션 복원 |
| `/api/chat/message` | POST | 메시지 → AI 응답 |

---

## 4. 프론트엔드 (Claude AI 벤치마킹)

### 4.1 파일 구조

```
client/src/
├── pages/Chat.jsx              # 메인 (유일한 페이지)
├── components/chat/
│   ├── ChatLayout.jsx          # 사이드바 + 메인
│   ├── Sidebar.jsx             # 대화 이력
│   ├── MessageList.jsx         # 메시지 영역
│   ├── MessageBubble.jsx       # 메시지 (텍스트 + 리치UI)
│   ├── InputArea.jsx           # 입력창
│   ├── ProductCard.jsx         # 상품 카드
│   ├── CompareTable.jsx        # 비교표
│   ├── ImageModal.jsx          # 이미지 풀스크린
│   ├── MapModal.jsx            # 매장 지도
│   ├── InlineForm.jsx          # 인라인 폼
│   └── ActionButtons.jsx       # 액션 칩
└── hooks/useChat.js            # 채팅 상태
```

### 4.2 칩/버튼 = 자연어 메시지 (단일 스트림)

```javascript
function handleChipClick(label) {
  sendMessage(label); // "인터넷 추천해줘" → 일반 메시지와 동일
}
```

### 4.3 리치 UI 타입

| 타입 | 컴포넌트 | 설명 |
|------|----------|------|
| `product_card` | ProductCard | 상품 카드 |
| `compare_table` | CompareTable | 비교표 |
| `image` | ImageModal | 풀스크린 이미지 |
| `map` | MapModal | 매장 지도 |
| `form` | InlineForm | 가입/콜백 폼 |
| `actions` | ActionButtons | 빠른 액션 칩 |

---

## 5. DB (1개 추가)

```sql
CREATE TABLE bongi_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  messages JSONB DEFAULT '[]',
  collected_info JSONB DEFAULT '{}',
  lead_id UUID REFERENCES bongi_applications(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  last_active_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 6. 기존 재사용

| 구분 | 변경 |
|------|------|
| server/routes/crm,cti,mock,auth + middleware + services + data + admin + dashboard | 그대로 |
| client/src/App.jsx, utils/api.js | 수정 (chat 라우트/API 추가) |
| server/services/chat-*.js, routes/chat.js | 신규 (3개) |
| client/src/pages/Chat.jsx + components/chat/* + hooks/useChat.js | 신규 (13개) |
| Home.jsx, AiChat.jsx | 삭제 (Chat.jsx로 대체) |

---

## 7. 구현 단계

| Phase | 내용 |
|-------|------|
| **A** | 채팅 엔진 백엔드 (chat-engine + tools 7개 + API) |
| **B** | 채팅 UI 프론트 (ChatLayout + 리치 컴포넌트 + 스트리밍) |
| **C** | 리드/CRM 연동 (create_lead + callback + 세션 영속화) |
| **D** | 고도화 (사이드바 이력, 마크다운, 모달, 반응형, SEO) |

---

## 8. 확장

서비스 추가 = 도구 추가. 코드 구조 변경 없음.

```
현재:  search_products, compare_products, calculate_price, create_lead, ...
확장:  search_insurance, compare_moving, estimate_cleaning, ...
```
