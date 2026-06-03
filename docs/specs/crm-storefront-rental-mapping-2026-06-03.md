# 봉이 CRM ↔ storefront 양방향 매핑 spec (렌탈상품 한정)

> 작성일: 2026-06-03
> 범위: **렌탈상품만** (휴대폰·인터넷+TV는 별도 spec)
> 목적: 어드민 운영 흐름이 storefront 채팅에 어떻게 노출되는지, 고객 행동이 CRM 후처리에 어떻게 흘러가는지 단일 진실로 정의.

## 0. 핵심 원칙

1. **단일 데이터 소스**: 모든 운영 데이터는 CRM(어드민)에 입력 → storefront는 view·CTA만 제공.
2. **rental_sales 1건 수렴**: storefront "셀프 가입"·"상담사 연결"·매장 영업 모두 결국 `rental_sales` insert 1건.
3. **snapshot 박제 유지**: 견적 시점 가격·정책·제휴카드를 모두 박제 (오늘 card_snapshot 완료).
4. **양방향 실시간 sync**: 운영자가 어드민에서 가격/이미지 변경 → BroadcastChannel + Supabase Realtime으로 storefront 즉시 반영.

---

## 1. 어드민 메뉴 ↔ storefront 노출 매핑 표

| 카테고리 | 어드민 메뉴 | DB 테이블 | storefront 채팅 사용처 | 고객 노출 |
|---|---|---|---|---|
| 상품·정책 | 📦 상품 관리 | `rental_products`·`rental_product_options`·`rental_categories` | 검색·추천·카드 렌더 | 상품명·이미지·spec·약정 chip·관리방법 chip |
| 상품·정책 | ⚙️ 정책 관리 | `rental_policy`·`rental_policy_history` | 가격 계산 (P·tier·payback) | 예상 월 요금·최대 혜택가 |
| 상품·정책 | 🎴 제휴카드사 | `rental_partner_cards` (brand·company alias·1·2·3 구간) | 카드 추천·할인 후 가격 | 카드명·할인 후 월납·구간 chip |
| 상품·정책 | 🗂️ DB 출처 | `incentive_db_sources` | (storefront 비사용 — TM 내부용) | - |
| 영업관리 | 📋 계약 처리 | `rental_sales` (status·snapshot·card_snapshot) | 셀프 가입 완료 후 자동 박제 | 신청 완료 페이지·진행 status |
| 영업관리 | 👥 고객 관리 | `incentive_customers`·`incentive_customer_db` | 상담사 연결 시 고객 기본정보 가져오기 | (간접) |
| 영업관리 | 📞 콜 DB 관리 | `incentive_customer_db` (분배·재분배·retention) | "상담사 연결" CTA → 콜DB로 insert + round-robin TM 배정 | (간접 — 곧 콜 연결 안내) |
| 영업관리 | 📥 분배 요청 | `incentive_distribution_requests` | 상담사가 추가 콜 요청 (storefront 무관) | - |
| 영업관리 | 🎯 월간 목표·💰 월별 정산·📈 콜 통계 | `incentive_settlements`·`incentive_sales` | 내부 KPI (storefront 무관) | - |
| TM도구 | 📞 TM 상담 v1 (큐콜)·✏️ v2 (수동) | `incentive_customer_db` + 통화 메모 | storefront에서 "상담사 연결" 클릭 시 → 큐콜로 자동 진입 | (간접) |
| TM도구 | 🧮 TM 데이터 관리 | 콜DB import·정제 | 내부 (storefront 무관) | - |
| TM도구 | 🎫 티켓 관리 | `incentive_tickets` (R번호 발급) | 셀프 가입 시 자동 R번호 부여 | 신청 완료 페이지·R번호 표시 |
| 관리 | 👥 상담사 관리·🔐 권한 관리 | `incentive_agents`·`incentive_departments` | 콜DB 분배 대상 agent pool | (간접) |

---

## 2. 운영자 흐름 (어드민 — 운영자 시점)

### 2-1. 상품 등록·관리 운영자

**역할**: 상품 마스터 데이터 유지 + storefront 즉시 반영.

| 단계 | 화면 | 액션 | DB 결과 | storefront 효과 |
|---|---|---|---|---|
| 1 | products 상품관리 메인 | 카테고리 선택 (정수기·공청·비데·매트리스·에어컨·TV 6종 활성) | - | 카테고리 nav chip 자동 노출 |
| 2 | products 신규 상품 모달 | brand·model·name·image·specifications·8 AI 컬럼 입력 | `rental_products` insert | storefront 채팅 검색·추천 대상 |
| 3 | products 옵션 추가 | months_available·care_type·care_cycle·price 옵션 | `rental_product_options` insert | 약정 chip·관리방법 chip 동적 |
| 4 | products R번호 발급 | "발급" 버튼 클릭 | `incentive_tickets` insert + trigger sync | 셀프 가입 시 자동 부여 |
| 5 | products AI 자동 채움 | "AI 채움" 버튼 (8 컬럼 자동) | products update | ChatProductCard 자연어 chip 노출 |
| 6 | products 이미지 업로드 | drag·drop | Supabase Storage + image_url | 카드·상세 즉시 노출 |

### 2-2. 가격·정책 운영자

| 단계 | 화면 | 액션 | DB 결과 | storefront 효과 |
|---|---|---|---|---|
| 1 | rules 정책관리 | 활성 정책 row + V2 룰 편집 | `rental_policy` update + `rental_policy_history` audit | 예상 가격 즉시 재계산 |
| 2 | products 가격 산식 | weight_cost_per_p·payback 등 정책 적용 | trigger `rental_recalc_margins_and_premium` | 카드 렌더 시 동적 계산 |

### 2-3. 제휴카드 운영자

| 단계 | 화면 | 액션 | DB 결과 | storefront 효과 |
|---|---|---|---|---|
| 1 | partner-cards 카드 등록 | 카드명·brand·company_id·카테고리 array·tier1/2/3 구간·할인 metadata | `rental_partner_cards` insert | 채팅 답변 카드 안 카드 추천 chip |
| 2 | partner-cards 활성/비활성 | toggle | active update | 즉시 노출 on/off |

### 2-4. TM 상담사

| 단계 | 화면 | 액션 | DB 결과 | storefront 효과 |
|---|---|---|---|---|
| 1 | customer-db 콜DB 관리 | import·분배 (admin/manager) | distribution | TM 풀에 들어감 |
| 2 | tm-counselor 큐콜 (v1) | 콜 받기·통화 후 견적 입력 | rental_sales insert + customer_db status | storefront 진입 고객의 후속 처리 |
| 3 | contract 계약 처리 | status 변경·서류 첨부 | rental_sales status update | (필요 시) 고객에게 SMS·푸시 |
| 4 | tickets 티켓 관리 | R번호 trace | - | 신청 완료 페이지 R번호 일치 |

---

## 3. 고객 흐름 (storefront — 채팅 시점)

### 3-1. 진입 → 채팅

```
고객이 bongeestore.com 진입
  → 좌측 사이드바 카테고리 "가전 렌탈" 클릭
  → 메인: 카테고리 추천 chip + 채팅 입력
  → "정수기 추천해줘" 자유 입력 또는 prompt chip 클릭
  → AI 어시스턴트(Claude) tool use:
      - search_products(category='water-purifier', filters)
      - get_partner_cards(category='water-purifier')
      - calculate_quote(product_id, P, card_id)
  → answer: text + ChatProductCard 3~5개 렌더
```

### 3-2. ChatProductCard 안 인터랙션

- **약정 chip** (84·72·60·36개월) — products.months_available 기반 동적
- **관리방법 chip** (방문관리·셀프관리) — care_services
- **관리주기 select** — care_cycle (오늘 추가)
- **카드 추천 chip 1·2·3** — 사용자 선호·실적별
- **dual 가격**: 최대 혜택가 / 예상 월 렌탈료
- **듀얼 CTA**:
  - **셀프 가입** → 14-3 form flow (product-confirm → customer-info → POST /api/storefront/self-enroll → rental_sales)
  - **전문상담원 연결** → consult-request form → POST /api/storefront/consultant-request → incentive_customer_db insert + round-robin TM 분배

### 3-3. 셀프 가입 form 흐름

```
1) /storefront/register/product-confirm?productId=N (상품 확인)
2) modal "본인 / 대리인"
3) /storefront/register/customer-info?isMyself={0|1}
   - 가입자 유형 (개인·개인사업자·법인사업자·외국인)
   - 가입자명·생년월일·성별·carrier+연락처·이메일
   - 대리인 연락처 (옵션)
4) submit → rental_sales insert (status=auto_pending)
5) 완료 페이지 (R번호·예상 처리 시간·고객센터)
```

### 3-4. 상담사 연결 흐름

```
1) consult-request 간단 form (이름·전화·간단 메모)
2) submit → incentive_customer_db insert (source='storefront_chat', grade=R)
3) round-robin TM 분배 trigger
4) TM 상담 v1 큐콜에 자동 진입
5) 후속 통화 → rental_sales 박제
```

---

## 4. 양방향 데이터 흐름 다이어그램

```
                     ┌──────────────────────────────────┐
                     │  Supabase DB (single source)    │
                     │  rental_products·options         │
                     │  rental_partner_cards            │
                     │  rental_policy V2                │
                     │  rental_sales (snapshot)         │
                     │  incentive_customer_db           │
                     │  incentive_tickets (R번호)        │
                     └────┬───────────────┬────────────┘
                          │               │
              ┌───────────▼───┐   ┌───────▼───────────┐
              │  CRM 어드민   │   │  storefront 채팅  │
              │  (운영자)     │   │  (고객)          │
              │               │   │                   │
              │ - products    │   │ - 사이드바 nav   │
              │ - rules       │   │ - AI 채팅 입력   │
              │ - partner-cards│   │ - ChatProductCard │
              │ - contract    │   │ - 약정/관리 chip │
              │ - customer-db │   │ - 셀프 가입 form │
              │ - tm-counselor│   │ - 상담사 연결    │
              │ - tickets     │   │                   │
              │ - settlements │   │                   │
              └───────────────┘   └───────────────────┘
                     ▲                       │
                     │ TM 상담사가 storefront│
                     │ 진입 고객 후속 처리   │
                     └───────────────────────┘
```

---

## 5. 어드민 신규/보강 필요 항목

storefront 도입에 따라 어드민에 신규 추가 또는 보강 필요:

| 우선순위 | 어드민 신규/보강 | 이유 |
|---|---|---|
| P1 | **storefront 상담 history 뷰** (`bongi_conversations`·`bongi_messages` 검색) | TM이 storefront 채팅 맥락 확인 후 상담 |
| P1 | **콜DB import source 'storefront_chat' 필터** | 채팅 진입 고객 별도 트래킹 |
| P2 | **이벤트 캐러셀 관리** 메뉴 신규 (`storefront_events`) | 운영자가 이벤트 banner 등록·on/off |
| P2 | **상품 BEST/NEW 뱃지 룰** (sales_count 기반) | storefront 카드 배지 동적 |
| P3 | **storefront 회원 관리** (`storefront_users`) | 카카오·Apple·네이버 로그인 고객 |
| P3 | **친구 초대·포인트 관리** (`storefront_referrals`·`storefront_points`) | 적립·현금화 운영 |
| P4 | **AI 어시스턴트 운영 dashboard** (tool use 통계·conversation length·conversion rate) | 채팅 성과 측정 |
| P4 | **storefront 마이페이지 가시화** (운영자가 고객 가입 상태 view) | 고객 클레임 대응 |

---

## 6. DB 변경 종합

```sql
-- 6-1. rental_sales 컬럼 추가 (셀프 가입 form 대응)
ALTER TABLE rental_sales
  ADD COLUMN customer_type text CHECK (customer_type IN ('personal','sole_proprietor','corporate','foreigner')),
  ADD COLUMN agent_phone text,
  ADD COLUMN agent_relation text,
  ADD COLUMN source text DEFAULT 'admin' CHECK (source IN ('admin','storefront_self','storefront_consult','store_offline'));

-- 6-2. storefront 채팅 history
CREATE TABLE bongi_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES storefront_users(id) NULL,
  session_id text NOT NULL,
  title text,
  category text,
  started_at timestamptz DEFAULT now(),
  last_message_at timestamptz DEFAULT now()
);

CREATE TABLE bongi_messages (
  id bigserial PRIMARY KEY,
  conversation_id uuid REFERENCES bongi_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','tool')),
  content text,
  tool_calls jsonb,
  tool_results jsonb,
  created_at timestamptz DEFAULT now()
);

-- 6-3. storefront 회원
CREATE TABLE storefront_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('kakao','apple','google','naver','email')),
  provider_id text NOT NULL,
  email text,
  phone text,
  nickname text,
  marketing_opt_in boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(provider, provider_id)
);

-- 6-4. 이벤트 캐러셀
CREATE TABLE storefront_events (
  id bigserial PRIMARY KEY,
  title text NOT NULL,
  subtitle text,
  image_url text,
  cta_url text,
  start_at timestamptz,
  end_at timestamptz,
  display_order int DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 6-5. 친구 초대·포인트
CREATE TABLE storefront_referrals (
  id bigserial PRIMARY KEY,
  referrer_user_id uuid REFERENCES storefront_users(id),
  referred_user_id uuid REFERENCES storefront_users(id),
  reward_points int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE storefront_point_transactions (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES storefront_users(id),
  delta int NOT NULL,
  reason text,
  meta jsonb,
  created_at timestamptz DEFAULT now()
);
```

---

## 7. API 매핑 (server/routes/storefront.js 신규)

| endpoint | 메서드 | 설명 | tool/use case |
|---|---|---|---|
| `/api/storefront/chat` | POST | AI 채팅 (Claude API + tool use) | 메인 채팅 input |
| `/api/storefront/chat/stream` | POST (SSE) | 스트리밍 답변 | streaming answer |
| `/api/storefront/products/search` | GET | 채팅 답변용 product search | tool: search_products |
| `/api/storefront/partner-cards` | GET | 카드 추천 | tool: get_partner_cards |
| `/api/storefront/quote/calculate` | POST | 가격 계산 | tool: calculate_quote |
| `/api/storefront/self-enroll` | POST | 셀프 가입 → rental_sales | 셀프 form |
| `/api/storefront/consultant-request` | POST | 상담사 연결 → customer_db | 상담 form |
| `/api/storefront/events` | GET | 이벤트 캐러셀 | 홈 banner |
| `/api/storefront/conversations` | GET·POST | 대화 history | 사이드바 검색 |
| `/api/storefront/auth/{provider}` | POST | social login | 로그인 wall |
| `/api/storefront/me/points` | GET | 내 포인트 | 친구 초대 |

---

## 8. 작업 우선순위 통합 (storefront-plan-2026-06-03.md 14-6 + 본 spec 5장 통합)

| Phase | 작업 | 어드민 | storefront |
|---|---|---|---|
| **P1** | DB 마이그레이션 (rental_sales 3컬럼·bongi_conversations·storefront_users·storefront_events) | - | 신규 테이블 |
| **P2** | API endpoint 골격 (server/routes/storefront.js) | - | 11 endpoint |
| **P3** | storefront 좌 사이드바 + 메인 라우터 + 다크모드 | - | UI 골격 |
| **P4** | AI 채팅 UI + 답변 안 ChatProductCard (가전 렌탈 카테고리 한정) | - | 채팅 |
| **P5** | AI 어시스턴트 backend (Claude API + tool use 8종) | - | RAG |
| **P6** | 셀프 가입 form 3 step + 상담사 연결 form | - | form |
| **P7** | 어드민 storefront 상담 history 뷰 신규 | conversations·messages 검색·view | - |
| **P8** | 어드민 콜DB import source 'storefront_chat' 필터 추가 | customer-db page 필터 | - |
| **P9** | 어드민 이벤트 캐러셀 관리 메뉴 신규 | events page | - |
| **P10** | 어드민 BEST/NEW 배지 룰 + 어드민 toggle | products page 배지 설정 | 카드 배지 |
| **P11** | social login + 마이페이지 + 친구 초대 | storefront_users 관리 page | 로그인·my |
| **P12** | AI 어시스턴트 운영 dashboard | 신규 page | - |

---

## 9. 차기 세션 즉시 시작 시 entry point

1. **시작점**: `docs/specs/crm-storefront-rental-mapping-2026-06-03.md` (본 문서)
2. **참고**: `docs/specs/storefront-plan-2026-06-03.md` (UI 분석 + 13장 채팅 UX + 14장 Allio 디자인)
3. **첫 작업**: P1 DB 마이그레이션 → P2 API endpoint 골격 → P3 UI 골격
4. **검증 시점**: P5 끝나면 가전 렌탈 1 카테고리 end-to-end 데모 가능

---

## 10. 메모리 update 후보

- `feedback_crm_only.md` → "CRM 어드민 + storefront 채팅 양방향" 으로 확대
- 신규 `project_bongi_storefront_crm_sync.md` — 본 spec의 핵심 (양방향 매핑·API·DB)
- `project_bongi_unified_customer.md` — N채널에 storefront 채팅 추가 (현재: 매장·콜·웹·앱 → 매장·콜·웹·앱·채팅)
