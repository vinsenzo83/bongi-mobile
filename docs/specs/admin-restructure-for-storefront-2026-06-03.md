# 봉이 어드민 재구성 기획서 — storefront 채팅 플랫폼 대응

> 작성일: 2026-06-03
> 범위: 어드민(CRM) — storefront(Allio) 도입에 따른 메뉴·화면·DB·시퀀스 구성
> 전제: 본 문서는 **렌탈상품 + storefront 회원·대화·이벤트** 범위. 휴대폰 별도.

---

## 0. 한눈에 보기

| 영역 | 현재 (어드민 23메뉴) | storefront 도입 후 추가/보강 |
|---|---|---|
| 영업관리 | 8 메뉴 (계약·고객·콜DB·분배·정산 등) | + storefront 회원·계약 출처 필터·매장 신청 처리 |
| 상품·정책 | 4 메뉴 (상품·정책·카드·DB출처) | + BEST/NEW 배지 룰·이미지 일괄 관리 |
| TM 도구 | 4 메뉴 | + **storefront 대화 history viewer** (TM이 채팅 맥락 보고 후속 상담) |
| 관리 | 6 메뉴 | + AI 운영 dashboard·시스템 프롬프트 관리 |
| **🆕 storefront 운영** | - | + 이벤트 캐러셀·회원·포인트·초대·CS 6 메뉴 |

총 23 → **34 메뉴** (신규 11 메뉴 추가). 카테고리 5 → 6 (storefront 운영 신설).

---

## 1. 신규/보강 메뉴 정의

### 1-1. 🆕 storefront 운영 카테고리 (신규 6 메뉴)

| slug | label | icon | 설명 | 핵심 DB |
|---|---|---|---|---|
| `storefront-conversations` | 상담 대화 보기 | 💬 | 고객 채팅 history 검색·view (TM 후속 상담 시 맥락 확인) | `bongi_conversations`·`bongi_messages` |
| `storefront-users` | storefront 회원 | 🪪 | 카카오·Apple·네이버 로그인 고객 마스터 + 마케팅 동의·전화 통합 | `storefront_users` |
| `storefront-events` | 이벤트 캐러셀 | 🎉 | 홈 banner 등록·기간·on/off·정렬 | `storefront_events` |
| `storefront-points` | 포인트·적립 운영 | 🪙 | 포인트 정책·적립 trigger·현금화 룰·내역 audit | `storefront_point_transactions` |
| `storefront-referrals` | 친구 초대 | 🤝 | 초대 코드·보상 트래킹·사기 방지 | `storefront_referrals` |
| `storefront-cs` | CS 인박스 | 📨 | 채팅 → "상담사 연결"이 콜DB 분배되기 전 1차 검수 + FAQ | `bongi_conversations`·tags |

### 1-2. 영업관리 보강 (3 항목)

- **계약 처리**(기존) — `source` 컬럼 추가 후 필터 chip:  
  - admin·storefront_self·storefront_consult·store_offline·tm_call
  - 자동 박제(셀프) vs TM 수동 박제 구분
- **고객 관리**(기존) — `storefront_users.id` 연결 표시 + 동일 phone 기준 통합 view
- **콜DB 관리**(기존) — source 필터에 `storefront_chat` 추가, source별 분배 우선순위 룰

### 1-3. 상품·정책 보강 (1 신규)

- **🆕 BEST/NEW 배지 룰** — products 화면 안 tab 또는 별도 메뉴:
  - BEST: 최근 30일 sales_count Top N (rank 룰 편집 UI)
  - NEW: created_at < 14일 자동
  - HOT: 30일 견적 요청수 Top
  - 운영자가 수동 override 가능 (`product_badges` 신규 미니 테이블)

### 1-4. TM 도구 보강 (1 신규)

- **🆕 storefront 대화 history viewer** — 메뉴 `tm-chat-context`:
  - TM이 콜 받기 전 고객의 채팅 history 조회
  - 최근 7일 대화·요약·견적 시도·관심 product
  - 채팅 → 콜DB → TM 큐콜 → 통화 → 계약 연결 추적

### 1-5. 관리 보강 (1 신규)

- **🆕 AI 운영 dashboard** — 메뉴 `ai-ops`:
  - tool use 호출 통계 (search_products·calculate_quote·create_sale 등)
  - 대화 길이·전환률·이탈 단계
  - 답변 토큰 비용·캐시 hit rate
  - system prompt 버전 관리 + A/B 배포

---

## 2. 사이드바 재구성

```
📊 대시보드 (1)

💼 영업관리 (8 → 8)
├─ 📋 계약 처리          [source 필터 chip 추가]
├─ 📞 콜 DB 관리         [source filter 추가]
├─ 👥 고객 관리         [storefront_users 통합 view]
├─ 📋 내 콜 리스트
├─ 📥 분배 요청
├─ 📈 콜 통계
├─ 💰 월별 정산
└─ 🎯 월간 목표

📦 상품·정책 (4 → 5)
├─ 📦 상품 관리
├─ 🏆 BEST/NEW 배지 룰  🆕
├─ 🎴 제휴카드사
├─ ⚙️ 정책 관리
└─ 🗂️ DB 출처

📞 TM 도구 (4 → 5)
├─ 📞 TM 상담 v1 (큐콜)
├─ ✏️ TM 상담 v2 (수동)
├─ 💬 채팅 맥락 보기     🆕
├─ 🧮 TM 데이터 관리
└─ 🎫 티켓 관리

🆕 storefront 운영 (6)
├─ 💬 상담 대화 보기      🆕
├─ 🪪 storefront 회원    🆕
├─ 🎉 이벤트 캐러셀      🆕
├─ 🪙 포인트·적립        🆕
├─ 🤝 친구 초대          🆕
└─ 📨 CS 인박스          🆕

👤 관리 (6 → 7)
├─ 👥 상담사 관리
├─ 👥 상담사 ROI 비교
├─ 🏢 부서별 통계
├─ 🔐 권한 관리
├─ 🤖 AI 운영 dashboard 🆕
├─ 📖 급여 안내
└─ 📚 사용 매뉴얼
```

---

## 3. 신규 메뉴별 화면 spec

### 3-1. 💬 상담 대화 보기 (`storefront-conversations`)

```
┌──────────────────────────────────────────────────────────┐
│ 🔍 [phone·session·user 검색] [기간 │ 카테고리 │ status] │
├──────────────────────────────────────────────────────────┤
│ 대화 list (좌)              │ 대화 detail (우)          │
│                              │                            │
│ 김** (010-12) · 정수기      │ 👤 user: 정수기 추천해줘  │
│ 2026-06-03 18:42 · 5턴      │ 🤖 assistant: ChatProduct │
│ 견적 1건 · 상담사 연결       │     Card x3 ...           │
│                              │ 👤 user: 코웨이로 갈래   │
│ 이** (010-9*) · 매트리스    │ 🤖 assistant: 견적 ...    │
│ 2026-06-03 17:11 · 12턴     │ [tool call: create_sale]  │
│ 견적 2건 · 셀프 가입 완료    │ ...                       │
└──────────────────────────────────────────────────────────┘
```

**컬럼**: id·user(or session)·last_message_at·total_turn·category·outcome(견적/계약/이탈)·source_link(rental_sales·customer_db join)

**액션**: 
- 행 클릭 → 대화 detail 모달
- 상담사가 콜 진입 시 link 따라 진입 가능
- "이 대화 콜DB로 보내기" 버튼 → incentive_customer_db insert

### 3-2. 🪪 storefront 회원 (`storefront-users`)

| 컬럼 | 설명 |
|---|---|
| id | UUID |
| provider | 카카오·Apple·구글·네이버·email |
| nickname·email·phone | 기본 정보 |
| marketing_opt_in | Y/N |
| 연결 sales 수 | (rental_sales JOIN phone) |
| 연결 conversation 수 | (bongi_conversations JOIN user_id) |
| 마지막 활동 | last_message_at·last_sale_at |
| 차단 | 사기 의심 차단 toggle (admin only) |

**액션**: 회원 detail → 견적 history·구매 history·포인트 잔액·초대 내역.

### 3-3. 🎉 이벤트 캐러셀 (`storefront-events`)

```
┌─ 이벤트 list ────────────────┐  ┌─ 미리보기 ───────────┐
│ ☑ iPhone 17 특가  active   │  │ [storefront 홈에서 │
│   2026-06-01 ~ 06-30  ▲▼   │  │  실제 보이는 모습] │
│ ☐ 정수기 신규 가입 쿠폰   │  │                    │
│ ☐ 매트리스 최대 30%       │  │                    │
└────────────────────────────────┘  └────────────────────┘
[+ 신규]
```

**필드**: title·subtitle·image_url·cta_url·start_at·end_at·display_order·active.

### 3-4. 🪙 포인트·적립 (`storefront-points`)

- 정책 정의: 회원가입 1000P·견적 신청 500P·계약 완료 5000P·친구 초대 3000P
- 현금화 룰: 50000P 이상 1P=1원 환급
- audit: 적립·차감 내역 + 누적 잔액 + 사기 의심 flag
- export: CSV

### 3-5. 🤝 친구 초대 (`storefront-referrals`)

- 초대 코드 list·사용 회원·결제 여부·보상 지급 status
- 사기 방지: 동일 IP·동일 device fingerprint·24h 다중 가입 차단

### 3-6. 📨 CS 인박스 (`storefront-cs`)

- 채팅에서 AI가 답 못 한 case·"상담사 연결" 직전 1차 검수
- 운영자가 답변 또는 콜DB 보내기 결정
- FAQ 마스터 관리

### 3-7. 🤖 AI 운영 dashboard (`ai-ops`)

- tool use 통계 chart
- conversion funnel (채팅 시작 → 카드 view → 셀프 가입 / 상담사 연결)
- 답변 토큰 비용 (월간 추이)
- cache hit rate
- system prompt version A/B
- error rate (tool 호출 실패·model timeout)

---

## 4. DB ERD (ASCII + 텍스트)

### 4-1. 핵심 ERD

```
┌──────────────────────┐         ┌──────────────────────┐
│  rental_categories   │◄────┐   │   incentive_centers  │
│  id·name·slug·...    │     │   │  (8 매장)            │
└──────────────────────┘     │   └──────────┬───────────┘
                              │              │
┌──────────────────────┐     │              │
│   rental_products    ├─────┤              │
│  id·brand·model·name │     │              │
│  + AI 8 컬럼         │     │              │
│  size·weight·care   │     │              │
└─────────┬────────────┘     │              │
          │                   │              │
          │ has_many          │              │
          ▼                   │              │
┌──────────────────────┐     │              │
│ rental_product_options│    │              │
│  + R번호 + months    │     │              │
└─────────┬────────────┘     │              │
          │                   │              │
          │ used in           │              │
          ▼                   │              │
┌──────────────────────┐     │              │
│    rental_sales      │     │              │
│  + snapshot          │◄────┼──────────────┘
│  + card_snapshot     │     │
│  + customer_type 🆕   │     │
│  + agent_phone 🆕     │     │
│  + source 🆕          │     │ join phone
│    (admin/storefront_│     │
│     self/storefront_ │     │
│     consult/store_   │     │
│     offline/tm_call) │     │
└─────────┬────────────┘     │
          │                   │
          │ source=storefront │
          ▼                   │
┌──────────────────────┐     │
│  storefront_users  🆕 │     │
│  id·provider·email   │     │
│  phone·nickname      │     │
└─────────┬────────────┘     │
          │                   │
          │ 대화 owner        │
          ▼                   │
┌──────────────────────┐     │
│ bongi_conversations🆕│     │
│  id·user_id·session  │     │
│  category·started_at │     │
└─────────┬────────────┘     │
          │                   │
          │ has_many          │
          ▼                   │
┌──────────────────────┐     │
│   bongi_messages  🆕  │     │
│  role·content·tool_  │     │
│  calls·tool_results  │     │
└──────────────────────┘     │
                              │
┌──────────────────────┐     │
│  storefront_events 🆕│     │
│  title·image·dates   │     │
└──────────────────────┘     │
                              │
┌──────────────────────┐     │
│ storefront_point_   🆕│     │
│  transactions       │     │
└──────────────────────┘     │
                              │
┌──────────────────────┐     │
│  storefront_       🆕 │     │
│  referrals          │     │
└──────────────────────┘     │
                              │
┌──────────────────────┐     │
│ incentive_customer_  │     │
│ db (콜DB)           │◄────┘
│ + source 컬럼에      │ 
│   'storefront_chat'  │ 
│   추가              │ 
└──────────────────────┘
```

### 4-2. 신규 5 테이블 schema 요약

| 테이블 | 핵심 컬럼 | 관계 |
|---|---|---|
| `storefront_users` | id·provider·provider_id·email·phone·nickname·marketing_opt_in | 1:N → conversations·sales |
| `bongi_conversations` | id·user_id·session_id·category·title·started_at·last_message_at | N:1 → users · 1:N → messages |
| `bongi_messages` | id·conversation_id·role·content·tool_calls·tool_results·created_at | N:1 → conversation |
| `storefront_events` | id·title·subtitle·image_url·cta_url·start_at·end_at·display_order·active | - |
| `storefront_point_transactions` | id·user_id·delta·reason·meta·created_at | N:1 → user |
| `storefront_referrals` | id·referrer·referred·reward·created_at | N:N → users |

### 4-3. 기존 테이블 변경

```sql
-- rental_sales
ALTER TABLE rental_sales
  ADD COLUMN customer_type text CHECK (...),
  ADD COLUMN agent_phone text,
  ADD COLUMN agent_relation text,
  ADD COLUMN source text DEFAULT 'admin' CHECK (source IN
    ('admin','storefront_self','storefront_consult','store_offline','tm_call'));

-- incentive_customer_db.source 컬럼에 'storefront_chat' enum 추가
ALTER TABLE incentive_customer_db
  ALTER COLUMN source TYPE text,
  ADD CONSTRAINT customer_db_source_check
    CHECK (source IN ('manual','import','tm_inbound','storefront_chat','store_offline'));

-- product_badges (BEST/NEW 룰)
CREATE TABLE product_badges (
  product_id bigint REFERENCES rental_products(id),
  badge text CHECK (badge IN ('BEST','NEW','HOT')),
  override boolean DEFAULT false,
  starts_at timestamptz,
  ends_at timestamptz,
  PRIMARY KEY (product_id, badge)
);
```

---

## 5. 시퀀스 다이어그램 (ASCII)

### 5-1. 셀프 가입 flow

```
고객                storefront          API              DB                 어드민(CRM)
 │                    │                  │                │                    │
 │ 채팅 입력          │                  │                │                    │
 ├──"정수기 추천"────►│                  │                │                    │
 │                    │ POST /chat       │                │                    │
 │                    ├──────────────────►                │                    │
 │                    │                  │ search_products│                    │
 │                    │                  ├────────────────►                    │
 │                    │                  │◄───── 3 product│                    │
 │                    │                  │ get_partner_cards                   │
 │                    │                  ├────────────────►                    │
 │                    │                  │◄───── 2 card   │                    │
 │                    │                  │ calculate_quote│                    │
 │                    │                  ├────────────────►                    │
 │                    │ assistant + cards│                │                    │
 │                    │◄─────────────────┤                │                    │
 │ ChatProductCard    │                  │                │                    │
 │                    │                  │                │                    │
 │ "셀프 가입" click  │                  │                │                    │
 ├───────────────────►│                  │                │                    │
 │                    │ /register/...    │                │                    │
 │                    │ step1→modal→step3│                │                    │
 │ 정보 입력          │                  │                │                    │
 ├───────────────────►│                  │                │                    │
 │                    │ POST /self-enroll│                │                    │
 │                    ├──────────────────►                │                    │
 │                    │                  │ INSERT rental_sales                 │
 │                    │                  ├────────────────►                    │
 │                    │                  │   (source=storefront_self          │
 │                    │                  │    snapshot 박제 + card_snapshot   │
 │                    │                  │    status=auto_pending)             │
 │                    │                  │ INSERT ticket (R번호)                │
 │                    │                  ├────────────────►                    │
 │                    │ 신청 완료 페이지 │                │                    │
 │                    │◄─────────────────┤                │                    │
 │ R번호 안내         │                  │                │ 계약 처리 알림 ────►│
 │◄───────────────────┤                  │                │                    │
 │                    │                  │                │           운영자 view│
 │                    │                  │                │      "신규 셀프 가입"│
```

### 5-2. 상담사 연결 → TM 큐콜 flow

```
고객           storefront    API           DB(콜DB)        TM 상담사
 │              │             │              │                │
 │ "상담사 연결" │             │              │                │
 ├─────────────►│             │              │                │
 │              │ 간단 form    │              │                │
 │              │ name·phone·메모│             │                │
 │ 입력 + submit│             │              │                │
 ├─────────────►│             │              │                │
 │              │ POST         │              │                │
 │              │ /consultant-request          │                │
 │              ├─────────────►│              │                │
 │              │              │ INSERT       │                │
 │              │              │ customer_db  │                │
 │              │              │ (source=     │                │
 │              │              │  storefront_ │                │
 │              │              │  chat        │                │
 │              │              │  grade=R)    │                │
 │              │              ├──────────────►                │
 │              │              │ round-robin │                │
 │              │              │ 분배 trigger │                │
 │              │              │              │ assign to agent│
 │              │              │              ├───────────────►│
 │              │ "곧 연락 드림"│             │                │
 │              │◄─────────────┤              │                │
 │◄─────────────┤              │              │                │
 │                                                              │
 │                            TM 큐콜에서 ──── pickup           │
 │                            대화 history viewer 진입 ─────────│
 │                            대화 맥락 확인 후 통화            │
 │ 전화 수신                                                    │
 │◄─────────────────────────────────────────────────────────────│
 │ 통화 후 계약                                                 │
 │                            INSERT rental_sales              │
 │                            (source=tm_call) ─────────────────│
```

### 5-3. 어드민 상품 등록 → storefront 즉시 반영

```
운영자          어드민 상품관리       DB                 storefront(고객)
 │                  │                  │                    │
 │ 신규 상품 입력   │                  │                    │
 ├─────────────────►│                  │                    │
 │ AI 자동 채움 click                  │                    │
 │                  │ POST /products/AI │                    │
 │                  │ (8 컬럼 자동)    │                    │
 │                  ├──────────────────►                    │
 │                  │ INSERT rental_products                 │
 │                  │ INSERT options    │                    │
 │ 이미지 업로드    │                  │                    │
 ├─────────────────►│                  │                    │
 │                  │ Storage upload    │                    │
 │                  ├──────────────────►                    │
 │ R번호 발급 click │                  │                    │
 ├─────────────────►│                  │                    │
 │                  │ INSERT ticket trigger sync             │
 │                  │ option_count·집계 update               │
 │                  │                  │                    │
 │                  │                  │ BroadcastChannel    │
 │                  │                  │ + Realtime          │
 │                  │                  ├───────────────────►│
 │                  │                  │                    │ 캐시 invalidate
 │                  │                  │                    │ search 결과 재계산
 │                                                          │
 │                                                          │ 고객이 채팅 시
 │                                                          │ 즉시 신규 product 추천 대상
```

### 5-4. AI 어시스턴트 tool use loop

```
고객              storefront chat        API               Claude API           DB tools
 │                  │                     │                    │                    │
 │ 자유 입력        │                     │                    │                    │
 ├─────────────────►│                     │                    │                    │
 │                  │ POST /chat/stream   │                    │                    │
 │                  ├────────────────────►│                    │                    │
 │                  │                     │ messages.create    │                    │
 │                  │                     │  + system prompt   │                    │
 │                  │                     │  + tool defs (8종) │                    │
 │                  │                     │  + cache_control   │                    │
 │                  │                     ├───────────────────►│                    │
 │                  │                     │                    │ stop=tool_use     │
 │                  │                     │◄───────────────────┤                    │
 │                  │                     │ tool: search_products(category=...)     │
 │                  │                     ├──────────────────────────────────────────►
 │                  │                     │◄────── product[]                        │
 │                  │                     │ tool: get_partner_cards                  │
 │                  │                     ├──────────────────────────────────────────►
 │                  │                     │◄────── card[]                           │
 │                  │                     │ tool: calculate_quote                    │
 │                  │                     ├──────────────────────────────────────────►
 │                  │                     │◄────── quote{}                          │
 │                  │                     │ continue messages.create                 │
 │                  │                     │  with tool_results                       │
 │                  │                     ├───────────────────►│                    │
 │                  │ SSE streaming text  │ stop=end_turn      │                    │
 │                  │◄────────────────────┤◄───────────────────┤                    │
 │ 답변 + ChatProductCard 3개                                  │                    │
 │◄─────────────────┤                                          │                    │
 │                  │ INSERT messages (user·assistant·tool)    │                    │
 │                  ├──────────────────────────────────────────►                    │
```

---

## 6. 권한 매트릭스 (신규 메뉴 + 4 roles)

| 메뉴 | admin | manager | agent | contract |
|---|:---:|:---:|:---:|:---:|
| 💬 상담 대화 보기 | RW | R | R(본인 분배 건만) | - |
| 🪪 storefront 회원 | RW | R | - | - |
| 🎉 이벤트 캐러셀 | RW | RW | - | - |
| 🪙 포인트·적립 | RW | R | - | - |
| 🤝 친구 초대 | RW | R | - | - |
| 📨 CS 인박스 | RW | RW | RW(본인 분배) | - |
| 🏆 BEST/NEW 배지 룰 | RW | RW | - | - |
| 💬 채팅 맥락 보기 | RW | RW | R(본인 분배) | R(본인 분배) |
| 🤖 AI 운영 dashboard | RW | R | - | - |

표기: RW=읽기·쓰기 / R=읽기만 / -=접근 불가

`incentive_menus` + `incentive_role_permissions` 테이블에 신규 row insert 필요.

---

## 7. 작업 우선순위 (어드민 측 한정)

| Phase | 작업 | 의존 |
|---|---|---|
| **A1** | DB 마이그레이션 (rental_sales 4컬럼·5 신규 테이블·product_badges·source enum 확장) | - |
| **A2** | incentive_menus·incentive_role_permissions에 신규 11 메뉴 insert | A1 |
| **A3** | 사이드바 그룹 재정렬 (storefront 운영 카테고리 추가) | A2 |
| **A4** | 영업관리 기존 메뉴 보강 (계약 처리 source 필터 chip·고객 관리 통합 view·콜DB source 필터) | A1 |
| **A5** | 🆕 상담 대화 보기 페이지 (`storefront-conversations`) | A1 |
| **A6** | 🆕 storefront 회원 페이지 | A1 |
| **A7** | 🆕 이벤트 캐러셀 페이지 | A1 |
| **A8** | 🆕 BEST/NEW 배지 룰 페이지 | A1 |
| **A9** | 🆕 채팅 맥락 보기 (TM 진입 시 link) | A5 |
| **A10** | 🆕 포인트·적립·친구 초대 페이지 | A1 |
| **A11** | 🆕 CS 인박스 | A5 |
| **A12** | 🆕 AI 운영 dashboard | tool use 데이터 누적 후 |

storefront 측 작업은 별도 storefront-plan-2026-06-03.md 14-6 참고.

---

## 8. 모니터링·운영 정책

- **신규 회원**: 카카오 등 social login 가입 시 admin 알림 (slack/email)
- **사기 의심**: 동일 device·IP 24h 다회 가입 → admin alert + 차단 옵션
- **AI 답변 실패**: tool 호출 fail 시 자동 CS 인박스로 ticket 생성
- **이벤트 만료**: end_at 도래 시 자동 active=false + dashboard 알림
- **포인트 환급**: 50000P 이상 시 운영자 승인 단계 (audit 강화)

---

## 9. 메모리 update 후보 (차기 세션)

- `feedback_crm_only.md` → "CRM 어드민 + storefront 채팅 양방향 (단방향 X)"
- 신규 `project_bongi_admin_restructure.md` — 본 spec 핵심 (11 신규 메뉴·5 신규 테이블·권한 매트릭스)
- 신규 `project_bongi_chat_history_viewer.md` — TM 채팅 맥락 viewer
- `project_bongi_unified_customer.md` — storefront 회원·채팅을 N채널의 핵심 entry로 격상

---

## 10. 차기 세션 entry point

본 spec → DB 마이그레이션 (A1) → 메뉴 insert (A2) → 사이드바 재정렬 (A3) → 신규 5 페이지 (A5~A8·A10) 순.

storefront-plan은 별도 사이클 (frontend repo client/src/pages/storefront/).
