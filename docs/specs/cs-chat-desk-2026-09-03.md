# 봉이 상담 데스크 (CS Chat Desk) — PRD

> 채널톡형 다중 상담사 채팅 + 문의유형별 기능 분리 + 기존 CRM 폐루프
> 작성 2026-09-03 · 상태 **기획(미구현)** · 승인 대기

---

## 0. 한 줄 정의

**앱에서 AI 가 1차 상담을 끝까지 시도하고, 못 푸는 지점에서만 사람이 2차로 이어받는다. 대화는 문의 성격 × 상품 카테고리 2축으로 담당 부서에 배정되고, 전화번호 기준으로 CRM 고객 원장에 그대로 쌓인다.**

> AI 가 응대 보조가 아니라 **1차 창구**다. 사람은 AI 가 도달할 수 없는 곳(개인 실시간값·협상·클레임·계약)에서만 등판한다.

---

## 1. 배경 · 현황 실측 데이터

> 2026-09-03 라이브(`dugaqvvnhsgenhmhuyju`)·데브(`sesgdqbmophgmombelmn`) 직접 쿼리

| 항목 | 실측값 | 진단 |
|---|---|---|
| `bongi_chat_sessions` | 290건 (마지막 **2026-04-23**) | AI 챗봇은 있으나 4개월째 유입 정지 = 사실상 방치 |
| `bongi_chat_messages` | 863건 (마지막 2026-04-20) | 〃 |
| `bongi_consultations` | **0건** | 상담 연결 경로가 코드에만 있고 실사용 0 |
| `cs.tickets` | **0건** | 비실시간 접수 테이블만 존재, 접수 UI 미구현 |
| `cs.faqs` / `cs.plans` | **308 / 262건** (라이브 이관 완료) | 무인 응대 지식베이스는 **이미 완비** |
| `incentive_customer_db` | **6,212건** (dev) | CRM 고객 원장 = 통합 기준점 |
| `incentive_agents` | 11(dev) / 14(라이브) | 실제 다중 상담사 존재 |
| `incentive_departments` | **2개** — 인터넷팀 · 가전팀 | 기능 분리 축이 이미 DB에 있음 |
| 역할 | `admin` / `manager` / `agent` / `contract` | `incentive_role_permissions.menus[]` 로 메뉴 단위 통제 |
| 채팅 ↔ CRM 연결 | **없음** | 채팅 리드가 고객 원장에 안 들어감 = 최대 페인포인트 |

### 현재 코드 자산 (재사용 가능)

| 자산 | 경로 | 상태 |
|---|---|---|
| AI 챗 엔진 (Claude Tool Use, 도구 19개) | `server/services/chat-engine.js` (791줄) | 동작 O · 모델 `claude-sonnet-4-20250514` (구버전, 교체 필요) |
| 도구 정의 (상품검색·견적·리드생성·콜백요청 등) | `server/services/chat-tools.js` (1,506줄) | 그대로 봇 1차 응대에 사용 |
| 세션 관리 | `server/services/chat-session.js` | **메모리 Map + Supabase** — 다중 인스턴스/재배포 시 유실 (재설계 대상) |
| SSE 스트리밍 API | `server/routes/chat.js` | 고객측 스트리밍 그대로 사용 |
| 고객 채팅 UI | `client/src/pages/Chat.jsx`, `hooks/useChat.js` | 위젯화 필요 |
| 통신3사 지식베이스 | `cs` 스키마 12테이블 | 봇 근거 인용 소스 |

### 핵심 결함 3가지

1. **상담사 개입 경로가 아예 없다** — 봇이 못 풀면 대화가 끝난다. `bongi_consultations` 0건이 그 증거.
2. **여러 사람이 동시에 못 쓴다** — 대화 소유자·배정·이관·잠금 개념이 DB에 없다.
3. **CRM과 끊겨 있다** — `bongi_chat_sessions.user_id` 하나뿐. 전화번호·고객원장·상담이력과 연결 0.

---

## 2. 목표 · 성공지표

### 목표
- **G1 · AI 1차 → 사람 2차** — 앱에서 AI 가 1차 상담을 끝까지 시도하고, 못 푸는 지점에서만 사람이 **같은 대화**를 이어받는다(§4.2). 상담사는 언제든 **중간 개입**할 수 있다(§4.2.8)
- **G2 · 2축 분리** — 문의 성격(intent) × 상품 카테고리 2축으로 담당 부서에 배정한다. **큐를 코드에 박지 않는다** — 큐=부서(고정 2~4), 토픽=카테고리(가변 40+), 매핑은 규칙표 1개(§3.2·§3.3)
- **G3 · CRM 폐루프** — 전화번호 기준 통합 → 상담이력 자동 기록 → **계약 건만** 예약 콜로 넘겨 기존 `리드 → TM 콜 → close` 파이프에 합류(§4.2.7·§10)

### KPI (Phase 3 종료 시점 측정)
> 정의는 §11.6 에 쿼리 수준으로 명시했다. 여기 값만 목표치다.

| 지표 | 현재 | 목표 |
|---|---|---|
| 첫 응답 시간(FRT) | 측정 불가(경로 없음) | 봇 **3초** / 사람 **3분** |
| CS 채팅종결률 (`intent='cs'`) | 미측정 | **80%** — 전화 안 걸고 끝난 비율 |
| 봇 자기완결률 (인계 없이 종료) | 미측정 | **60%** |
| 상담사 개입률 (`BARGE_IN`) | — | 낮을수록 좋다 (봇 품질 지표) |
| 대기 이탈 (무응답 종료) | 미측정 | **5% 이하** |
| 무단 발신 | — | **0건** (DB 제약으로 구조적 차단) |

> ⚠️ 초안의 "채팅→CRM 리드 전환 100%" 는 **폐기**한다. §4.2.7 종결 정책상 CS 문의는
> 채팅에서 끝나고 리드가 되지 않는다. 모든 대화를 리드로 만드는 것은 목표가 아니다.
> 대신 **상담이력은 100% 기록**된다(`incentive_customer_notes`).

---

## 3. 기능 분리 설계 — 기존 카테고리 체계 위에 (★ 핵심 ★)

### 3.1 실측한 봉이 카테고리 체계 (2층 구조)

| 층 | 테이블 | 실측값 | 역할 |
|---|---|---|---|
| 카테고리 마스터 | `rental_categories` | **40행** (활성 6 — 정수기·공기청정기·비데·매트리스·에어컨·TV) | slug·name·icon·ticket_prefix·extra_fields·product_group 보유. **INSERT 1줄로 전 페이지 자동 확장**이 이미 확립된 원칙 |
| 담당 매핑 | `incentive_departments.categories` (JSONB) | 인터넷팀 → `["internet_tv"]`<br>가전팀 → `["water-purifier","air-purifier","bidet","mattress","aircon","tv"]` | 부서 ↔ 카테고리 배열 = **이미 존재하는 라우팅 표** |

**혼동 주의 — 다른 축**: `incentive_customer_db.category` 는 상품 카테고리가 아니라 **콜 목적**이다 (실측 6,212건: 기변 4,072 · 이동 1,130 · 렌탈권유 910 · 신규 84 · null 16). 채팅 토픽과 매핑하지 말고 별도 필드로 병기한다.

**대기 중인 확장**: `rental_categories` 40행 중 34행이 `is_active=false` — 얼음정수기·제습기·연수기·로봇청소기·PC/노트북·펫용품·여행 eSIM(id 40) 등. 즉 **카테고리는 앞으로 계속 켜진다**는 전제로 설계해야 한다.

### 3.2 라우팅은 2축이다 — 문의 성격(intent) × 상품(category)

> 대표 지시 "cs · 상품문의 등으로" = **성격 축**. 카테고리 = **상품 축**. 둘은 직교한다.
> 1축으로 접으면 **"정수기 구매문의"와 "정수기 고장 AS"가 같은 토픽**이 되어 받을 팀을 구분할 수 없다.

**intent (문의 성격) — 고정 4종, 늘어나지 않는다**

| intent | 뜻 | 판별 신호 | 기본 담당 |
|---|---|---|---|
| `presale` | 상품문의 (구매 전) | 가격·비교·견적·가입 문의 | 해당 상품 **영업 부서** |
| `cs` | 고객센터 (개통 후) | 개통현황·배송·설치·청구·해지·AS | **고객지원팀** |
| `claim` | 불만·클레임 | 부정 감정어·"환불"·"소비자원"·반복 문의 | **manager 즉시 에스컬레이션** |
| `etc` | 미분류 | 봇 신뢰도 미달 | 폴백 부서 |

**라우팅 = 규칙표 1개** (하드코딩 아님, 관리자가 편집)

```sql
CREATE TABLE desk.routing_rules (
  id            SERIAL PRIMARY KEY,
  priority      INT NOT NULL DEFAULT 100,        -- 작을수록 우선
  intent        TEXT,                            -- NULL = 모든 성격
  category_slug TEXT,                            -- NULL = 모든 상품
  department_id BIGINT REFERENCES incentive_departments(id),   -- ⚠ bigint (uuid 아님)
  active        BOOLEAN DEFAULT TRUE
);
-- 매칭: priority 오름차순 첫 행
--   (intent IS NULL OR intent = :intent) AND (category_slug IS NULL OR category_slug = :category)
```

| priority | intent | category | → 부서 | 의미 |
|---|---|---|---|---|
| 10 | `claim` | NULL | 고객지원팀(매니저) | 클레임은 상품 불문 최우선 |
| 20 | `cs` | NULL | 고객지원팀 | 개통 후 문의는 전부 CS |
| 50 | `presale` | `internet_tv` | 인터넷팀 | |
| 50 | `presale` | `water-purifier` | 가전팀 | |
| 50 | `presale` | (렌탈 활성 6종) | 가전팀 | |
| 900 | NULL | NULL | **폴백 부서** | 어디에도 안 걸리면 |

→ "정수기 구매문의" = (presale, water-purifier) → 가전팀
→ "정수기 고장 AS" = (cs, water-purifier) → 고객지원팀 · **카테고리 정보는 보존**되어 360°패널·통계에 그대로 남는다

**확장 시 규칙 1줄**
```sql
INSERT INTO desk.routing_rules (priority, intent, category_slug, department_id)
VALUES (50, 'presale', 'dehumidifier', (SELECT id FROM incentive_departments WHERE name='가전팀'));
```
카테고리만 켜고 규칙을 안 넣어도 **priority 900 폴백**이 받아 유실되지 않는다.

---

### 3.3 설계 원칙 — 큐를 하드코딩하지 않는다

> ❌ "CS·휴대폰·인터넷·가전·중고폰·eSIM" 6개 큐를 코드에 박기 → 카테고리가 40개로 켜지면 붕괴
> ✅ **큐 = 부서**(고정, 2~4개) · **토픽 = 카테고리**(가변, 40+) · **매핑 = `departments.categories`**(이미 있음, 새 테이블 불필요)

```
고객이 고르는 것            내부 라우팅                    받는 사람
──────────────           ─────────────────           ──────────
토픽(topic)        →      departments.categories  →    큐( = 부서)
= 카테고리 slug            JSONB 배열 매칭                = 그 부서 상담사
```

이 구조의 이점:
- 카테고리가 40개여도 **상담사 인박스 탭은 부서 수(2~4개)** 로 유지 → 화면이 안 터진다
- 권한 판정이 기존 공식 그대로 (`admin/manager` unrestricted · 그 외 `department.categories ∪ handle_categories`) → **새 권한 로직 0**
- 카테고리 추가가 채팅까지 자동 파급

### 3.4 확장 시나리오 — 코드 변경 0, 배포 0

**새 렌탈 상품 "제습기" 개시**
```sql
UPDATE rental_categories SET is_active = true WHERE slug = 'dehumidifier';        -- ① 카테고리 활성
UPDATE incentive_departments                                                       -- ② 담당 부서 지정
   SET categories = categories || '["dehumidifier"]'::jsonb WHERE name = '가전팀';
```
→ 위젯 토픽 버튼 · 상담사 인박스 필터 · 배정 라우팅 · 권한 · 통계까지 **전부 자동 확장**.

**새 부서 "모바일팀" 신설**
```sql
INSERT INTO incentive_departments (name, categories, active)
VALUES ('모바일팀', '["mobile","usedphone"]'::jsonb, true);
```
→ 새 큐 자동 생성 + 인박스 탭 자동 추가.

**상담사 개별 겸업** — 기존 `incentive_agents.handle_categories` 그대로 사용 (부서 밖 카테고리 추가 담당).

### 3.5 토픽 정의 — 시스템 토픽 + 카테고리 자동 흡수

> ⚠️ **2축 도입 후 정정**: `cs` 는 **토픽이 아니라 intent** 다. 1축 초안에서 `cs` 를 토픽 목록에 넣었던 것은 오류 — 제거한다.
> "정수기 AS 문의" 는 topic=`water-purifier`, intent=`cs` 로 표현된다. **상품 정보를 잃지 않는 것이 2축의 목적**이다.

`rental_categories` 는 렌탈·가전 축이라 통신/중고 축이 없다. 이를 `desk.topics` 시스템 토픽으로 보완하고, **렌탈 카테고리는 UNION 으로 자동 흡수**한다.

| topic slug | 이름 | product_group | 출처 | presale 담당(현재) |
|---|---|---|---|---|
| `mobile` | 휴대폰(요금제·기기·번이) | 통신 | `desk.topics` | **미배정** → 폴백 |
| `internet_tv` | 인터넷·TV | 통신 | `desk.topics` | **인터넷팀** ✅ |
| `usedphone` | 중고폰 매입·판매 | 중고 | `desk.topics` | **미배정** → 폴백 |
| `travel-esim` | 여행 eSIM | 여행/글로벌 | `rental_categories` id=40 (비활성) | 활성화 시 자동 노출 |
| 정수기·공기청정기·비데<br>매트리스·에어컨·TV | (6종) | 가전렌탈 | `rental_categories.is_active` | **가전팀** ✅ |

→ 시스템 토픽 **3개**만 시드한다. 나머지는 전부 `rental_categories` 에서 자동으로 온다.

토픽 목록은 코드가 아니라 **쿼리**가 만든다:
```sql
CREATE OR REPLACE VIEW desk.v_topics AS
  SELECT slug, name, icon, product_group, 'desk.topics'::text AS source, display_order
    FROM desk.topics WHERE active
  UNION ALL
  SELECT slug, name, coalesce(icon,'📦'), '가전렌탈', 'rental_categories', sort_order
    FROM rental_categories WHERE is_active;
```

**담당 부서는 2축 규칙표가 정한다** (§3.2). 토픽 단독으로 부서를 정하지 않는다 — 같은 토픽이라도 intent 에 따라 갈리기 때문이다.
```sql
CREATE OR REPLACE FUNCTION desk.route(p_intent text, p_category text)
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT r.department_id FROM desk.routing_rules r
   WHERE r.active
     AND (r.intent IS NULL OR r.intent = p_intent)
     AND (r.category_slug IS NULL OR r.category_slug = p_category)
   ORDER BY r.priority
   LIMIT 1;
$$;
```

> 규칙에 안 걸려도 **priority 900 폴백 행**이 항상 매칭되므로 결과가 NULL 이 되지 않는다. 폴백 행의 `department_id` 는 `desk_fallback=true` 부서를 가리킨다.

### 3.6 위젯 UX — 40개를 다 보여주지 않는다

2단 선택. 1단 = **상품군(`product_group`)**, 2단 = 카테고리. `product_group` 이 이미 DB에 있으므로 그룹핑을 새로 만들지 않는다.

```
1단  [🎧 고객센터] [📱 휴대폰] [🌐 인터넷·TV] [🏠 가전렌탈] [🔄 중고폰] [✈️ 여행eSIM]
                                                    ↓ 가전렌탈 선택
2단  [💧정수기] [🌬공기청정기] [🚽비데] [🛏매트리스] [❄️에어컨] [📺TV]   ← 활성 카테고리만 동적
```
- 2단 후보가 1개면 2단 생략하고 바로 대화 시작
- 8개 초과면 "더보기" + 검색
- 고객이 아무것도 안 고르고 그냥 입력 → 봇이 첫 메시지로 토픽 분류(신뢰도 0.7↑), 미달 시 `cs` 폴백

### 3.7 ★ 퍼널(진입점) — 다양한 곳에서 들어온다 ★

> 대표 지시: "커스텀 활용도가 가장 높게. CRM 도 연결해야 하고 **다양한 퍼널에서 들어올 수 있다**."
> → 퍼널마다 코드를 만들면 퍼널이 늘 때마다 배포해야 한다. **퍼널도 DB 레지스트리로 뺀다.**

#### 3.7.1 핵심 원칙 — 퍼널이 이미 아는 것은 고객에게 다시 묻지 않는다

bongee.ai 중고폰 시세 페이지에서 들어온 고객에게 "무엇을 도와드릴까요?" 를 다시 묻는 것은 낭비다.
그 퍼널은 이미 **intent=presale · topic=usedphone** 을 알고 있다.

```
desk.entry_points.default_intent / default_topic / lock_topic=true
  → 토픽 선택 화면을 건너뛰고 바로 상담 시작
```

#### 3.7.2 퍼널 레지스트리 (`desk.entry_points`) — dev 시드 9종

| slug | 채널 | 사전 분류 | 표시 | CRM 콜목적 | 라우팅 결과 |
|---|---|---|---|---|---|
| `app-home` | app | — (고객이 선택) | fullscreen | — | 폴백 |
| `app-product` | app | presale · **상품 잠금** | fullscreen | 신규 | 상품에 따라 |
| `app-mypage` | app | **cs** | fullscreen | — | 고객지원팀 |
| `web-rental` | web | presale · 정수기 | floating | 렌탈권유 | **가전팀** |
| `bongee-usedphone` | web | presale · 중고폰 **잠금** | floating | 기변 | 폴백(모바일팀 미신설) |
| `geo-answer` | geo | presale | floating | 신규 | 상품에 따라 |
| `naver-blog` | blog | presale | floating | 신규 | 상품에 따라 |
| `store-qr` | store_qr | — | fullscreen | — | 폴백 |
| `ad-landing` | ad | presale · 인터넷 **잠금** | inline | 신규 | **인터넷팀** |

**퍼널별로 커스텀되는 것**

| 항목 | 컬럼 | 예 |
|---|---|---|
| 인사말 | `greeting` | bongee → "내 폰 시세 확인 도와드릴게요" |
| 첫 화면 버튼 | `quick_replies` | `["시세 알려주세요","매입 절차","소거증명"]` |
| 봇 지침 추가 | `bot_prompt_add` | 광고 랜딩 → "해당 캠페인 사은품을 먼저 안내" |
| 표시 형태 | `display` | 앱=fullscreen · 웹=floating · 랜딩=inline |
| 색·로고 | `theme` (jsonb) | 매장 QR → 매장명 표시 |
| 담당 부서 강제 | `department_id` | 특정 캠페인은 전담팀으로 |

#### 3.7.3 컨텍스트 전달 규격

```
/chat?e=<entry_slug>&ref=<bref>&utm_source=&utm_medium=&utm_campaign=&pid=<product_id>&store=<store_id>
```
→ `desk.conversations.entry_slug` + `entry_context` (jsonb) 에 원문 보존

**임베드는 1줄** — 퍼널 추가 시 페이지에 이것만 붙인다.
```html
<script src="https://admin.prexymarket.com/desk/widget.js" data-entry="geo-answer" async></script>
```
위젯 설정(인사말·버튼·표시형태·토픽)은 전부 서버에서 내려온다. **스니펫은 바뀌지 않는다.**

#### 3.7.4 CRM 연결 — 새 체계를 만들지 않는다

기존 콜DB 소스 체계(`incentive_db_sources`, 실측 4종: 봉이모바일 DB 3,106 · 일타폰DB 3,098 · 회사특판 3)에
**`채팅 유입`(code=`CHAT`) 1종을 추가**하고, 퍼널은 그 아래 `crm_tags` 로 구분한다.

```
채팅 대화 → 전화번호 확보
  → incentive_customer_db 신규 INSERT 시
     db_source_id     = entry_point.db_source_id      (채팅 유입)
     category         = entry_point.crm_call_purpose  (기변|이동|렌탈권유|신규)
     tags            += entry_point.crm_tags          (bongee, usedphone, geo …)
     source_data      = entry_context                 (utm·bref 원문 보존)
```

→ 기존 콜DB 화면·통계·분배 로직이 **그대로 채팅 리드를 취급**한다. 어드민에 새 화면이 필요 없다.

#### 3.7.5 GEO 전환 폐루프 연결 (숙제였던 것)

GEO 답변 페이지는 유입 1,840건에 전환 0이었고, 원인은 `session_key`(bref)가 도메인 경계를 넘어 전달되지 않은 것이었다([[project_bong_geo_conversion_loop_0811]]).
채팅 위젯이 `ref=<bref>` 를 `entry_context` 에 실어 오면 **GEO 유입 → 채팅 → 리드 → 계약**이 하나의 키로 이어진다.

```sql
-- 퍼널별 전환 추적 (기존에 못 하던 것)
SELECT entry_slug,
       count(*) AS 대화,
       count(*) FILTER (WHERE outcome='resolved_chat') AS 채팅종결,
       count(*) FILTER (WHERE outcome='booked_call')   AS 콜예약,
       count(*) FILTER (WHERE crm_customer_id IS NOT NULL) AS CRM연결
  FROM desk.conversations GROUP BY 1;
```

---

### 3.7 분리의 4개 층

| 층 | 분리 방식 |
|---|---|
| **데이터** | `desk` 스키마 신설 — 운영 테이블과 물리 격리 (`cs` 스키마 선례 계승) |
| **인박스** | 상담사는 **자기 부서 담당 카테고리의 대화만** 조회. 필터 = 토픽 칩 |
| **권한** | 기존 공식 재사용 — `admin/manager` unrestricted · 그 외 `department.categories ∪ handle_categories` |
| **화면** | 어드민 메뉴 `desk` 1개 + 부서 탭 + 토픽 칩. `incentive_menus` + `incentive_role_permissions.menus[]` 등록 |

---

## 4. 아키텍처

```
[고객]                                       [상담사 데스크]
 웹 위젯 / 앱 웹뷰                            docs/desk.html (3-pane)
      │                                            │
      │ SSE  /api/desk/stream?since=..             │ SSE  /api/desk/stream (인박스)
      ▼                                            ▼
┌──────────────────────────────────────────────────────────┐
│  Express (Railway, 단일 인스턴스)                          │
│  server/routes/desk.js        — 대화·메시지·배정 API       │
│  server/services/desk-router.js — 큐 분류·배정 규칙         │
│  server/services/desk-bot.js  — 봇 1차 응대 (chat-engine 재사용)│
│  server/services/desk-crm.js  — 전화번호 통합 → CRM 동기화   │
└──────────────────────────────────────────────────────────┘
      │        service key 로만 DB 접근             ▲
      ▼        (anon 노출 표면 0)                   │ 동일 SSE 허브
┌──────────────────────────────────────────────────────────┐
│  Supabase PostgreSQL                                      │
│   desk 스키마 (신설, PostgREST 미노출)  ←→  incentive_* (CRM)│
│                                        ←→  cs 스키마         │
│   ⚠️ 노출 스키마는 public·graphql_public 만 (실측 확인)      │
└──────────────────────────────────────────────────────────┘
```

### 4.1 실시간 방식 결정 — **SSE 단일화** (2026-09-03 수정)

> ⚠️ 초안은 Supabase Realtime 이었다. **실측으로 설계 모순이 드러나 폐기**한다.

**실측 (라이브 anon key 직접 호출)**
```
anon → bongi_chat_messages : {"code":"42501","message":"permission denied"}          ✅ 막힘
anon → incentive_customer_db: []                                                      ✅ 막힘
anon → cs 스키마            : "Only the following schemas are exposed: public, ..."   ✅ 미노출
```

**모순의 정체**
1. `cs`·`desk` 스키마가 안전한 이유는 **PostgREST 노출 스키마에서 빠져 있기 때문**이다.
2. 그런데 Realtime 구독을 하려면 그 스키마를 **노출해야 한다** → 격리 원칙과 정면 충돌.
3. 더 결정적으로 **비로그인 방문자는 `auth.uid()` 가 없다**. `visitor_key` 는 JWT 클레임이 아니므로 "자기 대화만" 을 RLS 로 표현할 수 없다. `USING(true)` 로 열면 **anon key 를 가진 누구나 전 고객의 상담 내용을 구독**할 수 있고, 그 anon key 는 `client/src/lib/supabase.js` 에 하드코딩되어 사실상 공개값이다.

| 후보 | 판단 |
|---|---|
| socket.io / ws | ❌ Railway 재배포마다 연결 끊김 + 스티키세션 |
| Supabase Realtime | ❌ **스키마 노출 강제 + 비로그인 RLS 표현 불가** = 정보 유출 경로 |
| **SSE (Express)** | ✅ **채택** — 이미 `chat.js` 에 구현됨 · 서버가 service key 로 대신 읽으므로 **anon 노출 표면 0** · 새 인프라 0 · 스키마 계속 격리 |

**재배포 끊김은 SSE 로 해결된다** (Realtime 을 쓸 이유였던 유일한 근거)
```
GET /api/desk/stream?conversation_id=..&since=<last_message_id>
- 브라우저 EventSource 가 끊기면 자동 재연결
- 재연결 시 since 커서로 놓친 메시지 전량 수신 → 유실 0
- 서버는 메모리 Map 을 쓰지 않는다. DB(desk.messages) 가 단일 진실원
  → 재배포에 강한 쪽은 오히려 이쪽 (현행 chat-session.js 의 메모리 Map 함정 제거)
```

**규모 검증**: 동시 상담사 11~14명 + 동시 방문자 수십 명 = SSE 연결 100 미만. Express 단일 인스턴스가 충분히 감당한다. 채널톡 같은 만 단위 동접이 아니다.

**푸시(알림)**: 상담사가 데스크 탭을 닫아도 놓치지 않도록 신규 대기 대화는 브라우저 Notification + 텔레그램 임원방(3분 초과 시). SSE 연결과 무관.

### 4.2 ★ AI 1차 → 사람 2차 (본 시스템의 중심 흐름) ★

```
 ┌────────────── 1차: AI (기본값) ──────────────┐   ┌──── 2차: 사람 ────┐
 앱 진입 → 의도·카테고리 분류 → cs.faqs 근거 검색
        → ① info      근거 있음        → 즉답·종료 ─────── 사람 등판 없음
        → ② redirect  개인 실시간값     → 링크+대표번호 ─── 사람 등판 없음
        → ③ handoff   못 품 / 요청 / 구매의사 ──────────→ 핸드오프 패키지 생성
                                                          → 부서 대기열 → 상담사 인계
        → ④ offhours  영업시간 외       → cs.tickets 접수 + 콜백예약 → 익일 사람
```

#### 4.2.1 AI 가 사람에게 넘기는 4가지 트리거

| # | 트리거 | 판정 방법 | 넘김 전 AI 가 하는 일 |
|---|---|---|---|
| T1 | **근거 없음** | `cs.faqs` 의미검색 최고점 < 임계값 | 지어내지 않는다. "확인해서 답변드리겠습니다" 후 인계 |
| T2 | **고객이 사람 요청** | "상담사"·"사람"·"전화" 등 표현 | 즉시 인계 (설득 시도 금지) |
| T3 | **구매의사 감지** | 견적 확정·"가입할게요"·연락처 자진 제출 | **연락처·희망조건 수집 완료 후** 인계 (사람이 바로 클로징 가능하게) |
| T4 | **클레임** | 부정 감정어·환불·반복 문의 | 사과만 하고 **즉시** 매니저 인계. 협상·보상 언급 금지 |

> **금지**: AI 가 자기 판단으로 가격 협상·보상·계약 확정·개인정보 조회를 하지 않는다.
> **원칙**: 못 푸는 걸 붙잡고 늘어지는 것보다 빨리 넘기는 게 낫다. AI 완결률보다 **오답률 0** 이 우선.

#### 4.2.2 핸드오프 패키지 — 사람이 처음부터 다시 묻지 않게

인계 순간 AI 가 생성해 `desk.conversations` 에 적재. 상담사 화면 우측 360°패널 상단에 고정 노출.

```json
{
  "intent": "presale", "category": "water-purifier", "confidence": 0.91,
  "summary": "4인 가족 직수형 정수기, 월 3만원 이하 희망. 이번 주말 설치 원함.",
  "collected": { "가구원":"4인", "유형":"직수형", "예산":"월 3만원대", "설치희망":"토요일 오전" },
  "quoted":    [{ "product":"코웨이 아이콘", "monthly":29900, "gift":150000 }],
  "handoff_reason": "T3 구매의사",
  "bot_sources": ["cs.faqs#183", "rental_products#R0683"],
  "unanswered": ["기존 KT 인터넷과 결합 할인 가능 여부 — 확인 필요"],
  "crm_hint": "콜DB 기존 고객 · 2026-06 KT 인터넷 개통 이력 → 결합 제안 가능"
}
```

- `unanswered` 가 **가장 중요**하다 — AI 가 못 푼 것이 곧 사람이 할 일이다.
- `crm_hint` 는 전화번호 매칭으로 CRM 을 조회해 AI 가 미리 붙인다.

#### 4.2.3 인계 후에도 AI 는 남는다 (뒤에서 보조)

| 역할 | 동작 |
|---|---|
| 추천 답변 | 상담사 입력창 위에 AI 초안 1~2개 제시 → 상담사가 수정 후 전송 (**자동 전송 금지**) |
| 근거 조회 | 상담사가 `/찾기 위약금` 입력 시 `cs.faqs` 근거 카드 반환 |
| 실시간 요약 | 대화 길어지면 상단에 3줄 요약 갱신 |
| 종료 요약 | 종료 시 요약 생성 → `incentive_customer_notes` 자동 기록 |

→ 사람이 이어받은 뒤 AI 는 **고객에게 직접 말하지 않는다**. 오직 상담사에게만 보인다.

#### 4.2.4 사람이 없을 때 (등판 실패 경로)

```
대기 3분 초과            → 부서 전원 알림 + manager 에스컬레이션
대기 10분 초과 / 전원 오프라인 → AI 가 고객에게 사과 + cs.tickets 접수 + 콜백 시각 예약
영업시간 외              → 처음부터 ④ 경로 (AI 응대 + 티켓 접수 + 익일 콜백 안내)
```
**대화를 그냥 끊지 않는다.** 현행 시스템의 최대 결함(`bongi_consultations` 0건)이 정확히 이 지점이다.

#### 4.2.5 되돌림 (사람 → AI)

상담사가 종료하면 대화는 AI 모드로 복귀한다. 고객이 나중에 같은 창에 다시 말을 걸면 AI 가 1차로 받고, 직전 담당 상담사를 **우선 배정**한다(연속성).

#### 4.2.6 ★ 이력 이관 — 대화는 하나다, 갈아타지 않는다 ★

> 대표 지시: "AI 가 1차로 상담했던 이력을 이쪽에서 이관해서 채팅을 진행한다."
> → **새 대화를 만들지 않는다.** `conversation.id` 는 처음부터 끝까지 불변이고, `status` 만 `bot → waiting → assigned` 로 바뀐다.

**고객 입장**: 창이 안 바뀐다. 같은 채팅방에서 말하던 상대만 바뀐다.
```
봉이봇   조건에 맞는 상품 2개입니다 …
─────── 상담사 박○○ 님이 참여했습니다 ───────      ← 시스템 메시지 한 줄
박상담   안녕하세요, 앞의 내용 확인했습니다. 결합 할인까지 붙여서 …
```
"처음부터 다시 설명" 이 발생하면 이 설계는 실패한 것이다.

**상담사 입장**: 인계 즉시 3가지를 동시에 본다.

| 위치 | 내용 |
|---|---|
| 대화창 | **AI 대화 전문** (봇 말풍선 그대로, 시각·근거 링크 포함) |
| 우측 상단 고정 | **핸드오프 패키지** (§4.2.2) — 요약·수집정보·견적·**미해결 항목**·CRM 힌트 |
| 우측 하단 | 고객 360° (CRM 원장·과거 콜·계약 이력) |

**AI 가 앱에서 별도 엔진으로 도는 경우 (외부 이관)**

봉이폰 앱처럼 자체 백엔드를 가진 앱이 1차 AI 를 직접 돌린다면, 이관용 수신 엔드포인트로 전문을 넘긴다.

```
POST /api/desk/conversations/import
{
  "external_id": "app-sess-8831",          // 중복 이관 방지 (멱등키)
  "channel": "app",
  "auth_token" | "phone": "...",           // CRM 매칭용
  "intent": "presale", "category": "water-purifier",
  "messages": [                            // 시각 보존, sender_type='bot'|'customer'
    {"sender_type":"customer","body":"정수기 렌탈 알아보려고요","created_at":"...14:18"},
    {"sender_type":"bot","body":"...","bot_sources":["cs.faqs#183"],"created_at":"...14:18"}
  ],
  "handoff": { "summary":"...", "collected":{...}, "unanswered":[...], "reason":"T3" }
}
→ 201 { conversation_id, department_id, queue_position }
```
- **멱등**: 같은 `external_id` 재전송 시 새로 만들지 않고 기존 대화에 이어붙인다 (앱 재시도·네트워크 중복 대비)
- **시각 보존**: `created_at` 을 그대로 쓴다. 이관 시각으로 덮어쓰면 대화 순서가 뭉개진다
- **근거 보존**: `bot_sources` 를 함께 받아 상담사가 "봇이 무슨 근거로 그렇게 답했는지" 추적 가능 (환각 사후 검증)
- `handoff.summary` 가 비어 오면 서버가 전문으로부터 생성한다 (앱이 요약을 못 만들어도 인계는 성립)

**재이관(부서·상담사 변경)도 같은 스레드**
`transfer` 는 `department_id`/`assigned_agent_id` 만 바꾸고 `desk.events` 에 사유를 남긴다. 메시지는 이동하지 않는다. 받는 사람은 이전 상담사의 **내부 메모까지** 그대로 본다.

**종료 후 재방문**
같은 고객(전화번호/`auth_user_id`)이 다시 말을 걸면 새 대화가 열리되, 360° 패널에 **과거 대화 전체가 타임라인으로** 붙는다. 직전 담당 상담사를 우선 배정한다.

#### 4.2.8 ★ 사람의 중간 개입 (barge-in) — AI 응대 중에 끼어들기 ★

> 대표 질문: "AI 가 상담하고 있는데 사람이 중간에 이어받을 수 있나?"
> **가능하다. 그리고 이건 AI 가 넘겨주기를 기다리는 것과 다른, 별개의 경로다.**

| 경로 | 누가 시작 | 조건 |
|---|---|---|
| **핸드오프** (§4.2.1) | AI | T1~T4 트리거에 걸릴 때 |
| **중간 개입 (barge-in)** | **상담사** | **아무 때나.** 봇이 잘 하고 있어도 끼어들 수 있다 |

**상담사가 개입 시점을 알려면 봇 대화가 보여야 한다.** 그래서 인박스에는 `status='bot'` 대화도
"AI 응대중" 으로 실시간 표시되고, 상담사는 내용을 지켜보다 [지금 이어받기] 를 누른다.

**⚠ 실제 함정 — 뒤늦게 도착하는 봇 응답**
```
14:20:01  고객: "결합 할인 되나요?"
14:20:02  봇: (응답 생성 시작 — 2초 소요)
14:20:03  상담사: [지금 이어받기]  ← 개입
14:20:04  봇: 생성 완료 → 전송      ← ❌ 사람이 받았는데 봇이 또 말한다
```
고객 화면에 두 사람이 동시에 말하는 것처럼 보이고, 봇의 부정확한 답이 상담사 답변을 덮는다.

**해결 — 봇은 반드시 `desk.bot_say()` 로만 말한다** (DB 차원 차단, 애플리케이션 실수 무관)
```sql
INSERT INTO desk.messages (...)
SELECT ...
 WHERE EXISTS (SELECT 1 FROM desk.conversations
                WHERE id = p_conversation_id AND status = 'bot');
-- 사람이 이어받았으면 조건 불성립 → 조용히 폐기 (에러 아님, 반환값 NULL)
```

**배정 동시성** — `desk.claim()` 은 조건부 UPDATE 단일 쿼리다.
```sql
UPDATE desk.conversations SET status='assigned', assigned_agent_id=$agent
 WHERE id=$conv AND assigned_agent_id IS NULL
   AND status IN ('bot','waiting','snoozed')   -- ★ 'bot' 포함 = 개입 허용
RETURNING ...;
-- 0행 = 이미 다른 상담사가 잡음 → "이미 배정되었습니다"
```
개입으로 잡은 건 `handoff_reason='BARGE_IN'` 으로 기록되어, 나중에 **"봇이 못 해서 넘어온 것"과 "사람이 끼어든 것"을 통계에서 구분**할 수 있다. 개입률이 높으면 봇 품질이 나쁘다는 신호다.

**되돌리기** — `desk.release_to_bot()`. 단순 문의로 판명되면 다시 AI 에게 넘긴다. 상담사 1명이 동시 4건을 보는 구조라 이게 있어야 부담이 안 쌓인다.

**dev 실측 검증 (2026-09-03)**

| 검증 | 결과 |
|---|---|
| AI 응대중 봇 발화 | 저장됨 ✅ |
| **개입 후 뒤늦게 온 봇 응답** | **폐기됨 ✅** |
| 저장된 봇 메시지 수 | **1건** (중복 없음) ✅ |
| 다른 상담사 중복 claim | 0행 = 이미 배정 ✅ |
| 사람 → AI 되돌린 뒤 봇 발화 | 다시 저장됨 ✅ |

### 4.2.7 ★ 종결 정책 — 채팅으로 끝낼 것 vs 콜로 넘길 것 ★

> 대표 질문: "상담사한테 콜로 연결시킬 건지, 채팅으로 마무리할 건지?"
> **답: 둘 다다. 다만 기본값은 채팅 종결이고, 콜은 계약 단계에서만 — 그것도 고객이 시간을 고르는 예약 콜.**

#### 판단 근거

| 근거 | 내용 |
|---|---|
| **고객이 채팅을 고른 이유** | 전화를 피하려는 선택이다. 답할 수 있는 문의를 전화로 되돌리면 채널을 만든 의미가 없다 |
| **계약은 채팅으로 못 끝낸다** | `incentive_sales` 가 요구하는 값 = 주민번호·은행계좌·카드·주소·설치일정. 통신 개통은 **본인확인 의무**가 있다 |
| **개인정보 위험** | 그걸 채팅으로 받으면 주민번호·계좌가 `desk.messages` 에 평문으로 쌓인다. **받아선 안 된다** |
| **봉이 비즈니스 모델** | 원래 구조가 `리드 → TM 콜 → 계약 close` 다. 채팅은 **콜의 대체가 아니라 콜의 앞단** — 콜 전에 니즈·예산·조건이 확정돼 있으면 통화가 짧아지고 전환이 오른다 |
| **무단 콜 금지** | `incentive_customer_db.is_dnt` 가 이미 있다. 고객 동의 없는 발신은 이탈을 만든다 |

#### 종결 3분기 (outcome)

| outcome | 언제 | 누가 끝내나 | 후속 |
|---|---|---|---|
| `resolved_chat` | **CS 문의 전부** — 개통현황·배송·설치·요금·해지방법·AS·단순 시세 | AI(info) 또는 상담사가 채팅에서 | 콜 없음. 만족도 1클릭만 |
| `booked_call` | **계약 의사 확정** — 가입·개통·결합·명의변경 | 채팅에서 견적·조건까지 좁힌 뒤 **고객이 콜 시간 선택** | `incentive_customer_call_log(callback_at)` + 담당 부서 배정 |
| `booked_visit` | 실물 확인·서류 필요·고객이 대면 선호 | 8개 직영매장 중 선택 | 매장 상담사가 close |

**기본값은 `resolved_chat`.** `booked_call` 로 넘어가려면 **트리거 T3(구매의사) + 고객의 명시적 동의**가 둘 다 있어야 한다.

#### 콜 전환 대화 규격 (상담사가 임의로 "전화드릴게요" 하지 않는다)

```
상담사: 조건 확인됐습니다. 개통은 본인확인·서류가 필요해서 통화로만 진행됩니다.
        편하신 시간 골라주시면 그때 전화드릴게요.
        [오늘 오후] [내일 오전] [내일 오후] [직접 지정] [지금 전화 가능]
고객: 내일 오전
→ callback_at 저장 · 담당 상담사 지정 · 앱 푸시로 리마인드
→ 채팅창에는 "내일 오전 10시 · 박상담 전화 예정" 카드가 남는다 (약속 가시화)
```

#### 채팅에서 절대 받지 않는 것 (하드 룰)

```
주민등록번호 · 은행 계좌번호 · 카드번호 · 비밀번호 · 신분증 사진
→ 입력 감지 시 즉시 마스킹 + 저장 차단 + "통화에서 확인드립니다" 안내
→ 이미 저장된 경우 desk.messages 에서 스크럽 (정규식 게이트, 렌더층에서도 이중 차단)
```

#### 이 정책의 KPI

| 지표 | 목표 | 뜻 |
|---|---|---|
| `resolved_chat` 비율 | **CS 문의의 80%** | 전화 안 걸고 끝난 비율 = 콜센터 부하 감소 |
| `booked_call` 예약 이행률 | 85% | 예약해놓고 안 받으면 채널 신뢰가 깨진다 |
| 콜 평균 통화시간 | 채팅 경유 건이 **비경유 대비 짧을 것** | 앞단에서 조건이 좁혀졌다는 증거 |
| 무단 발신 | **0건** | 예약 없는 발신은 규정 위반으로 본다 |

> 요약: **CS 는 채팅에서 끝낸다. 영업은 채팅에서 좁히고 콜에서 닫는다. 콜은 고객이 예약한다.**

### 4.3 진입점 — 앱 우선

| 채널 | 형태 | 비고 |
|---|---|---|
| **고객 앱 (1순위)** | 앱 내 웹뷰로 위젯 전체화면 | 로그인 상태 → `auth_user_id`·전화번호를 **처음부터 확보** = 봇이 연락처를 묻지 않아도 되고 CRM 매칭 즉시 성립 |
| 고객 웹 | 우하단 플로팅 위젯 | 비로그인 → `visitor_key` 로 시작, 봇이 연락처 수집 |
| 매장 QR | 전체화면 | 매장 컨텍스트 자동 부착 |

**앱 연동 방식 (권고)**: 네이티브 화면을 새로 만들지 않고 **웹뷰 1장**. 이유 — 봇 프롬프트·상품카드·토픽이 계속 바뀌는데 웹뷰면 앱 심사 없이 즉시 반영된다.
앱 → 웹뷰에 넘길 값: `auth_token`(로그인), `entry`(진입 화면 = intent·category 힌트), `device_id`.
앱이 해야 할 일: **푸시 수신** — 사람 답변이 도착했는데 앱이 꺼져 있으면 푸시로 알린다. (SSE 는 앱이 켜져 있을 때만)

> ✅ **확정 (2026-09-03 대표)**: **1차 사용자는 고객이다.** 대상 앱 = 고객용 앱, AI 1차 상담의 상대는 고객.
> 따라서 봉이폰 상담앱(`sjw.core.monkeysphone`, 상담사 태블릿앱)은 본 설계의 대상이 아니다 — 그쪽은 2차(사람) 도구이지 1차 창구가 아니다.
> 설계 귀결: ① 봇 말투·안전장치는 **일반 고객 기준**(전문용어 금지·근거 인용·환각 0) ② 앱 로그인 상태를 활용해 연락처를 묻지 않는다 ③ 응답 지연 체감이 곧 이탈이므로 첫 응답 3초 이내(스트리밍) 목표.

## 5. 데이터 모델 — `desk` 스키마 ✅ **dev 적용완료 (2026-09-03)**

> **권위본은 이 문서가 아니라 마이그레이션 파일이다.**
> `server/db/2026-09-03-desk-chat.sql` (313줄) · 롤백 `…-rollback.sql`
> dev(`sesgdqbmophgmombelmn`) 적용 및 기능 검증 완료. **live 미적용** (확인: anon 호출 시 `Invalid schema: desk`).

### 5.1 초안에서 실제로 틀렸던 것 (적용 전 실측으로 발견)

| 초안 | 실제 | 결과 |
|---|---|---|
| `department_id UUID` | `incentive_departments.id` = **bigint** | 그대로 썼으면 마이그레이션 전체가 깨졌다 |
| `crm_customer_id UUID` | `incentive_customer_db.id` = **bigint** | 〃 |
| `desk.queues` 신규 테이블 | 불필요 — `incentive_departments` 확장 | 테이블 1개 감소 |
| `desk.agent_queues` 신규 테이블 | 불필요 — `agents.handle_categories` 재사용 | 테이블 1개 감소 |
| `desk.v_topic_department` view | 폐기 — 2축이라 토픽만으로 부서를 못 정한다 | `desk.route(intent, category)` 함수로 대체 |

`incentive_agents.id` 만 uuid 로 초안과 일치했다.

### 5.2 최종 구성 — 신규 테이블 6 · view 1 · 함수 5

| 오브젝트 | 역할 |
|---|---|
| `desk.topics` | 시스템 토픽 3개(`mobile`·`internet_tv`·`usedphone`). 렌탈은 자동 흡수 |
| `desk.v_topics` | 토픽 단일 소스 = `desk.topics` ∪ `rental_categories WHERE is_active` |
| `desk.routing_rules` | **2축 라우팅** (priority, intent, category_slug, department_id) |
| `desk.conversations` | 대화 1건 = AI 1차부터 사람 2차, 종결까지. 핸드오프 패키지·봇 비용 포함 |
| `desk.messages` | 봇·고객·상담사·시스템 메시지 한 스레드. `is_private`(내부메모)·`bot_sources`(근거) |
| `desk.events` | 배정·이관·개입·종료 감사 로그 |
| `desk.operator_presence` | 근무상태·동시상담 상한 |
| `desk.canned_replies` | 상용구 |

| 함수 | 역할 |
|---|---|
| `desk.route(intent, category) → bigint` | 2축 라우팅. 폴백 행이 있어 **NULL 을 반환하지 않는다** |
| `desk.bot_say(conv, body, rich, sources) → bigint` | **봇은 이것으로만 말한다.** `status<>'bot'` 이면 폐기(§4.2.8) |
| `desk.claim(conv, agent, barge_in) → row` | 배정·개입. 조건부 UPDATE, 0행 = 이미 배정 |
| `desk.release_to_bot(conv, agent) → bool` | 사람 → AI 되돌리기 |
| `desk.touch_updated_at()` | `updated_at` 트리거 |

### 5.3 기존 테이블 변경 (최소)

```sql
ALTER TABLE incentive_departments
  ADD desk_enabled, desk_fallback, desk_sla_sec, desk_hours, desk_offhours;
CREATE UNIQUE INDEX ux_dept_desk_fallback
  ON incentive_departments (desk_fallback) WHERE desk_fallback;   -- 폴백 부서는 1개만
```
`incentive_customer_db` 는 **변경하지 않았다** — 채팅 이력은 `desk.conversations.crm_customer_id` FK 로 붙는다. 카운터 컬럼(`last_chat_at` 등)은 집계 쿼리로 대체 가능하므로 운영 테이블을 건드리지 않는 쪽을 택했다.

### 5.4 무결성 제약 (DB 가 정책을 강제한다)

| 제약 | 막는 것 |
|---|---|
| `ck_conv_callback` — `outcome='booked_call'` 이면 `callback_at` 필수 | **무단 발신** (§4.2.7) |
| `ck_conv_intent` / `ck_conv_status` / `ck_conv_outcome` | 오타 상태값 유입 |
| `ck_msg_sender` | 발신자 유형 오염 |
| `ux_dept_desk_fallback` | 폴백 부서 2개 이상 |
| `bot_say()` 의 `WHERE EXISTS(status='bot')` | **개입 후 봇 난입** (§4.2.8) |

### 5.5 보안 (§4.1 결정의 구현)

```sql
ALTER TABLE desk.* ENABLE ROW LEVEL SECURITY;   -- 정책 없음 = 전부 차단
REVOKE ALL ON SCHEMA desk FROM anon, authenticated;
REVOKE ALL ON ALL TABLES/SEQUENCES/FUNCTIONS IN SCHEMA desk FROM anon, authenticated;
```
- **1차 방어선**: `desk` 를 PostgREST 노출 스키마에 넣지 않는다
- **2차 방어선**: RLS 활성 + 권한 회수
- 서버만 service key 로 접근한다. 고객·상담사 모두 Express 를 경유한다

### 5.6 dev 시드 현황

| 항목 | 값 |
|---|---|
| 시스템 토픽 | 3 (`mobile`·`internet_tv`·`usedphone`) |
| `v_topics` 합계 | 3 + 활성 렌탈 6 = **9** |
| 부서 | 인터넷팀 · 가전팀 + **고객지원팀 신설**(폴백, dev 한정) |
| 라우팅 규칙 | **10건** — `departments.categories` 를 그대로 전개 |

---

## 6. 정보 구조 (IA)

### 6.1 상담사 데스크 — `docs/desk.html` (어드민 iframe 메뉴)

```
/desk
├── 좌 25%  부서(큐) & 대화 목록
│   ├── 부서 탭 [전체] [인터넷팀 5] [가전팀 0] [고객지원팀 3]    ← 부서 수만큼 (2~4개, 안 늘어남)
│   ├── 축1 칩  [상품문의] [고객센터] [클레임]                    ← intent (고정 4종)
│   ├── 축2 칩  [정수기][공기청정기][비데][매트리스][에어컨][TV]  ← 카테고리 (동적, 40+ 확장)
│   ├── 필터    [내 상담] [대기중] [AI 응대중] [보류] [종료]      ← AI 응대중도 보여야 개입할 수 있다
│   └── 대화카드 (고객명·전화·마지막메시지·경과시간·미읽음·SLA 경고)
├── 중 45%  대화창
│   ├── 헤더    고객명 · intent/카테고리/부서 배지
│   │            status='bot'  → [지금 이어받기] ★개입
│   │            status='assigned' → [AI 에 되돌리기][이관][보류]
│   ├── 타임라인 고객/봇/상담사 말풍선 + 시스템 이벤트 + 내부메모(노란색)
│   │            봇 말풍선엔 근거(bot_sources) 표시 — 환각 사후 추적
│   ├── AI 보조  추천 답변 1~2개 (클릭 시 입력창 삽입, ★자동 전송 안 함)
│   ├── 입력    [답장|내부메모] 탭 · 상용구(/) · 파일 · 상품카드 삽입
│   └── 종결바  [채팅 종결 resolved_chat] [콜 예약 booked_call] [매장 예약 booked_visit] [티켓 접수]
└── 우 30%  고객 360° 패널  ★CRM 연결
    ├── ★ AI 핸드오프 패키지 (최상단 고정) — 인계사유·요약·수집정보·견적
    │   └── ⚠ 미해결 항목(bot_unanswered) — AI 가 못 푼 것 = 사람이 할 일
    ├── 고객 요약 (전화·등급·태그·DNT 수신동의)
    ├── CRM 원장 링크 → incentive_customer_db 상세
    ├── 과거 상담이력 (콜 + 채팅 통합 타임라인)
    ├── 계약/신청 이력 (incentive_sales · bongi_applications)
    └── 액션 [CRM 원장 열기] [콜백 예약] [티켓 접수] [견적서 전송]
```

### 6.2 관리자 화면 — `/desk/admin`

| 탭 | 내용 |
|---|---|
| **퍼널** | `entry_points` CRUD — 인사말·퀵버튼·사전분류·표시형태·CRM 소스/콜목적/태그·부서 강제 |
| 토픽·부서 | 시스템 토픽 CRUD · **부서 ↔ 카테고리 매핑 편집**(`departments.categories`) · SLA · 영업시간 · 폴백 부서 지정 |
| 봇 설정 | 토픽별 봇 on/off · 봇 지침 · 허용 도구 |
| 상담사 배치 | 소속 부서 · 겸업 카테고리(`handle_categories`) · 동시상담 상한 · 근무상태 |
| 상용구 | 토픽별 상용구 CRUD |
| 통계 | 부서별·**토픽별** 인입/FRT/처리시간/봇완결률/리드전환 |

### 6.3 고객 위젯

| 진입점 | 형태 |
|---|---|
| **퍼널 레지스트리** | `desk.entry_points` 9종 시드 (§3.7) — 진입점마다 인사말·버튼·사전분류·표시형태·CRM 매핑이 다르다 |
| 임베드 | `<script src="…/desk/widget.js" data-entry="<slug>">` **1줄**. 설정은 서버에서 내려온다 |
| 표시 형태 | `fullscreen`(앱·매장QR) · `floating`(웹·GEO·블로그) · `inline`(광고 랜딩) |

### 6.4 URL · 메뉴 등록

| 항목 | 값 |
|---|---|
| 상담사 데스크 | `https://admin.prexymarket.com/docs/desk.html` |
| 관리자 | `https://admin.prexymarket.com/docs/desk-admin.html` |
| API | `/api/desk/*` |
| 메뉴 등록 | `incentive_menus` INSERT (`slug='desk'`, `category='상담'`) + `incentive_role_permissions.menus[]` 4역할 갱신 |

---

## 7. 권한 매트릭스 (4 roles)

| 기능 | admin | manager | agent | contract |
|---|:--:|:--:|:--:|:--:|
| 전 부서·전 토픽 대화 조회 | ✅ | ✅ 자기 부서 | ❌ 담당 카테고리만 | ❌ 담당 카테고리만 |
| 대화 배정받기 | ✅ | ✅ | ✅ 담당 카테고리 | ✅ 담당 카테고리 |
| 타인 대화 강제 이관 | ✅ | ✅ | ❌ | ❌ |
| 내부 메모 작성 | ✅ | ✅ | ✅ | ✅ |
| 고객 360° 패널 (CRM 조회) | ✅ | ✅ | ✅ 마스킹 | ✅ 마스킹 |
| 리드 생성 · 콜백 예약 | ✅ | ✅ | ✅ | ✅ |
| 토픽·부서 매핑 · 상담사 배치 | ✅ | ✅ | ❌ | ❌ |
| 상용구 관리 | ✅ | ✅ | ❌ | ❌ |
| 통계 (전 부서) | ✅ | ✅ 자기 부서 | ❌ 본인 | ❌ 본인 |
| 대화 삭제 | ✅ | ❌ | ❌ | ❌ |

- 전화번호 마스킹: `agent`/`contract` 는 `010-****-1234` (기존 `incentive_customer_db_access_log` 열람 로그 정책 계승)
- 담당 판정 = **기존 공식 그대로** (`GET /api/incentive/agents/me/categories`): `admin`/`manager` = unrestricted · 그 외 = `department.categories ∪ handle_categories`. **새 권한 로직을 만들지 않는다.**

---

## 8. API 명세 (`server/routes/desk.js`)

### 고객측 (인증 불필요, rate-limit 필수)
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/desk/topics` | 위젯 토픽 목록 (`desk.v_topics` — 상품군 2단, **동적**) |
| POST | `/api/desk/visitor` | visitor_key 발급 · 기존 대화 복원 |
| POST | `/api/desk/conversations` | 대화 시작 (topic_slug, entry_url) |
| POST | `/api/desk/conversations/:id/messages` | 고객 메시지 전송 |
| GET | `/api/desk/conversations/:id/stream` | SSE — 봇 스트리밍 |
| POST | `/api/desk/conversations/:id/handoff` | "상담사 연결" 요청 |
| POST | `/api/desk/conversations/import` | **외부 AI(앱) 1차 상담 이력 이관** · `external_id` 멱등 |
| POST | `/api/desk/conversations/:id/contact` | 연락처 제출 → CRM 리드 |

### 상담사측 (JWT + requireMinRole('contract'))
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/desk/inbox` | `?department=&topic=&status=&mine=` — 담당 카테고리 필터 **서버에서 강제** |
| GET | `/api/desk/conversations/:id` | 대화 + 메시지 + 고객 360° |
| POST | `/api/desk/conversations/:id/claim` | 배정받기 · **`?barge_in=true` 면 AI 응대중에도 이어받음** → `desk.claim()` |
| POST | `/api/desk/conversations/:id/release` | 사람 → AI 되돌리기 → `desk.release_to_bot()` |
| POST | `/api/desk/conversations/:id/transfer` | 이관 (to_topic \| to_department \| to_agent + reason) |
| POST | `/api/desk/conversations/:id/reply` | 상담사 답변 |
| POST | `/api/desk/conversations/:id/note` | 내부 메모 |
| POST | `/api/desk/conversations/:id/close` | 종료 (outcome + AI 요약 → CRM 기록) |
| POST | `/api/desk/conversations/:id/snooze` | 보류 (until) |
| PATCH | `/api/desk/presence` | 근무상태 변경 |
| GET | `/api/desk/canned` | 상용구 |

### 관리자측 (requireMinRole('manager'))
`GET/POST/PATCH /api/desk/topics` · `PATCH /api/incentive/departments/:id` (categories 편집, **기존 엔드포인트 재사용**) · `GET /api/desk/stats`

---

## 9. 배정 규칙

**진입 경로는 2개다.**

```
경로 A · AI 인계 (AI 가 시작)          경로 B · 중간 개입 (상담사가 시작)
status: bot → waiting                  status: bot → assigned  (대기 단계 없음)
T1~T4 트리거 (§4.2.1)                  상담사가 [지금 이어받기]
   ↓ 아래 배정 로직                     → desk.claim(conv, agent, barge_in=true)
                                        → handoff_reason='BARGE_IN' 기록
```

경로 B 는 대기열을 거치지 않으므로 SLA 계산에서 제외한다(사람이 자발적으로 당긴 것이므로).

```
[경로 A] 대기 등록(status=waiting)
   ↓
후보 = desk.operator_presence.status='online'
     ∩ 해당 토픽 담당(department.categories ∪ handle_categories)
     ∩ active_count < max_concurrent
   ↓
① 후보 있음 → 직전 담당자 우선(재문의 연속성) → 없으면 active_count 최소 → 라운드로빈
② 후보 없음 → 대기열 유지 + 상담사 전원에게 알림, SLA(3분) 초과 시 manager 에스컬레이션
③ 영업시간 외 → cs.tickets 접수 + 콜백 예약 안내 후 종료
```

- **동시성**: 배정·개입 모두 `desk.claim()` 단일 함수를 쓴다. 내부는 조건부 `UPDATE … WHERE assigned_agent_id IS NULL … RETURNING` 한 문장이라 읽기-쓰기 틈이 없다(§11.7 R2). 0행이면 "이미 다른 상담사가 받았습니다".
- **되돌림**: `desk.release_to_bot()` — 단순 문의로 판명 시 다시 AI 로. 상태는 `bot` 으로 복귀.
- **자동배정 vs 수동**: 부서 설정으로 선택. 초기 기본 = **수동(pull)** — 상담사가 대기열에서 집는 방식이 소규모 팀에 안전.

---

## 10. CRM 연동 규칙 (★ 요구 핵심 ★)

```
채팅 인입
   ↓ 전화번호 확보 (봇이 수집 or 로그인)
① 정규화 (숫자만, 010 접두)
② incentive_customer_db 에서 phone 조회
   ├─ 있음 → crm_customer_id 연결 · chat_conversation_count++ · last_chat_at 갱신
   └─ 없음 → 신규 INSERT (db_source='chat', call_status='new',
              category=봇이 판정한 콜 목적(기변|이동|렌탈권유|신규), tags += topic_slug)
③ bongi_user_profiles / bongi_customers 도 phone 매칭 → auth_user_id 연결
   ↓
대화 종료 시
④ AI 요약 → incentive_customer_notes INSERT (category='채팅', author='봉이봇')
⑤ outcome='booked_call' → 담당 부서 상담사에게 예약 콜 배정 (기존 lead→close 흐름에 합류)
   outcome='resolved_chat' → 콜 배정하지 않는다. 상담이력만 남긴다
⑥ outcome='booked_call' → incentive_customer_call_log INSERT (callback_at, agent_id)
   · 무단 발신 금지 — callback_at 없는 콜 배정을 만들지 않는다 (is_dnt 도 확인)
```

- 기존 통합 로직 `server/services/member-sync.js` 재사용 (전화번호 기준 N채널→1고객)
- **채팅은 새 채널이 아니라 기존 lead→TM close 파이프의 새 입구**다. ([[project_bongi_unified_customer]])

---

## 11. 비기능 요구

| 항목 | 요구 |
|---|---|
| 실시간 지연 | 메시지 도착 1초 이내 (Supabase Realtime) |
| 세션 영속 | **메모리 Map 금지** — 재배포에도 대화 유지 (현행 chat-session.js 의 함정) |
| 개인정보 | 전화·주민번호·카드 마스킹 · 열람 로그(`incentive_customer_db_access_log`) 기록 |
| 스키마 노출 | `desk` 를 **PostgREST 노출 스키마에 추가하지 않는다** (실측상 이것이 1차 방어선) |
| RLS | 그럼에도 `desk` 전 테이블 RLS 활성 + `(select auth.uid())` 패턴 (2차 방어선 · [[feedback_rls_enable_caution]]) |
| 봇 비용 | 대화당 토큰·원가 기록(`desk.conversations.bot_cost_krw`) · **일 상한 초과 시 봇 자동 off → 사람 큐로**. 상한 없는 LLM 루프는 예산 사고를 낸다 ([[project_eduverse_budget_incident_0703]]) |
| 보관 | 대화 2년 보관 후 익명화 (`data_retention_until` 정책 준용) |
| 알림 | 신규 대기 대화 → 데스크 브라우저 알림 + 소리 · 미배정 3분 초과 → 텔레그램 임원방 |
| 첨부 | 이미지·PDF 10MB (Supabase Storage) — 개통 서류 접수용 |
| 모바일 | 상담사 데스크 반응형 (매장 상담사 태블릿 사용) |
| 봇 모델 | `claude-sonnet-4-20250514` → **최신 모델로 교체** (현행 구버전 고정) |

---

## 11.5 봇 안전 규격 (환각·개인정보)

> 1차 사용자가 고객이므로 **봇의 오답이 곧 사고**다. AI 완결률보다 **오답률 0** 이 우선한다(§4.2.1).

### 11.5.1 봇이 지켜야 할 4가지

| # | 규칙 | 구현 지점 |
|---|---|---|
| B1 | **근거 없으면 답하지 않는다** — `cs.faqs` 의미검색 점수 임계값 미달 시 T1 인계 | 검색 후 게이트 |
| B2 | **답변마다 근거를 기록한다** — `desk.messages.bot_sources` 에 FAQ id·상품 id | `desk.bot_say(…, p_sources)` |
| B3 | **정형 수치는 계산하지 않고 조회한다** — 요금·할인은 DB 값 그대로, 봇이 산수하지 않음 | 도구(tool) 반환값만 인용 |
| B4 | **금지 행위** — 가격 협상·보상 약속·계약 확정·개인 실시간값(위약금·미납) 단정 | 시스템 프롬프트 + 후처리 검사 |

`redirect` 유형(개인 실시간값)은 봇이 답하지 않고 `cs.carrier_links` 의 공식 조회링크 + 대표번호를 안내한다.

### 11.5.2 개인정보 차단 규격 (양방향)

**고객 → 우리**: 채팅에 남으면 안 되는 값은 저장 전에 차단한다(§4.2.7 하드 룰).

| 대상 | 탐지 | 처리 |
|---|---|---|
| 주민등록번호 | `\d{6}[-\s]?[1-4]\d{6}` | 저장 차단 · `[주민번호는 통화에서 확인드립니다]` 치환 |
| 카드번호 | `(\d{4}[-\s]?){3}\d{4}` (Luhn 검증 병행) | 〃 |
| 계좌번호 | `\d{2,6}-\d{2,6}-\d{2,8}` + 은행명 동시 출현 | 〃 |
| 신분증 이미지 | 첨부 MIME image/* + OCR 힌트 | 업로드 거부 |

- **입력 즉시 차단**이 원칙 — `desk.messages` 에 원문이 한 번도 들어가지 않아야 한다
- 이미 저장된 건에 대비해 **렌더층에서도 이중 마스킹** (DB 스크럽 + 화면 마스킹)
- 차단 시 봇/상담사가 **이유를 설명**한다. 조용히 지우면 고객이 다시 입력한다

**우리 → 고객**: 상담사 화면의 전화번호는 `agent`/`contract` 에게 `010-****-1234` 로 마스킹하고,
전체 열람 시 `incentive_customer_db_access_log` 에 기록한다(기존 정책 계승).

### 11.5.3 봇 비용 통제

| 항목 | 규격 |
|---|---|
| 기록 | 대화당 `bot_tokens_in`·`bot_tokens_out`·`bot_cost_krw` |
| 대화 상한 | 1대화 봇 턴 20회 초과 시 강제 인계 (무한 루프 차단) |
| 일 상한 | 초과 시 **봇 자동 off → 전량 사람 큐** + 텔레그램 경보 |
| 근거 | 상한 없는 LLM 루프는 예산 사고를 낸다 ([[project_eduverse_budget_incident_0703]]) |

---

## 11.6 통계 정의 (측정 가능한 형태로)

> "봇완결률" 같은 말은 정의가 없으면 각자 다르게 센다. 쿼리로 못 쓰면 지표가 아니다.

| 지표 | 정의 (쿼리 수준) | 목표 |
|---|---|---|
| **봇 자기완결률** | `outcome='resolved_chat' AND handoff_reason IS NULL` / 전체 종료 | CS 문의의 60% |
| **CS 채팅종결률** | `intent='cs' AND outcome='resolved_chat'` / `intent='cs'` 종료 | **80%** |
| **인계율** | `handoff_reason IN ('T1','T2','T3','T4')` / 전체 | — (T1 비율이 높으면 지식베이스 부족) |
| **개입률** | `handoff_reason='BARGE_IN'` / 전체 | **낮을수록 좋다** — 높으면 봇 품질 불신 신호 |
| **FRT (첫 응답)** | `first_response_at - created_at` (봇) / `assigned_at - handoff_at` (사람) | 봇 3초 · 사람 3분 |
| **대기 이탈** | `status='waiting'` 인 채 10분 초과 후 `outcome='abandoned'` | 5% 이하 |
| **콜 예약 이행률** | `booked_call` 중 `incentive_customer_call_log.result` 가 통화성공 | 85% |
| **무단 발신** | `callback_at IS NULL` 인 콜 로그 | **0건** (DB 제약으로 구조적 차단) |
| **채팅 경유 통화시간** | 채팅 경유 콜 vs 비경유 콜 평균 통화시간 | 경유가 더 짧을 것 |
| **봇 원가** | `SUM(bot_cost_krw)` / 대화 수 | 일 상한 대비 |

집계 단위: 부서 × 토픽 × intent × 일자. `desk.events` 가 원장이므로 사후 재계산이 가능하다.

---

## 11.7 테스트 계획

| 라운드 | 범위 | 방법 | 상태 |
|---|---|---|---|
| **R1 스키마 무결성** | 제약·FK·인덱스·함수 | dev SQL 시나리오 13종 | ✅ **완료 (2026-09-03)** — 라우팅 4·개입 5·제약 2·정리 1 |
| **R2 동시성** | 개입 경쟁·중복 배정·뒤늦은 봇 응답 | 동시 트랜잭션 2개로 `claim` 경합 | ⚠ 부분 — 순차 검증만 완료 |
| **R3 API 계약** | `/api/desk/*` 전 엔드포인트 · 권한 4역할 | supertest + 4역할 토큰 | 미착수 (P2) |
| **R4 SSE 유실 0** | 재배포 중 메시지 전송 → `since` 재연결 | 서버 강제 재시작 + 커서 재수신 | 미착수 (P2) |
| **R5 개인정보 차단** | 주민번호·계좌·카드 입력 시 저장 차단 | 정규식 케이스 20종 + 우회 시도 | 미착수 (P3) |
| **R6 봇 오답** | `cs.faqs` 근거 없는 질문 → 인계되는가 | 질문 세트 50종, 환각 0 확인 | 미착수 (P3) |
| **R7 4역할 E2E** | 로그인 → 인박스 → 개입 → 종결 → CRM 기록 | Playwright | 미착수 (P5) |
| **R8 스파이더 QC** | 🔴 0건까지 폐루프 | `/spiderweb-qc` | 배포 직전 |

**R2 보충 — 왜 논리적으로는 안전한가**

`desk.claim()` 은 단일 `UPDATE … WHERE assigned_agent_id IS NULL … RETURNING` 이다.
두 상담사가 같은 순간 누르면 PostgreSQL 기본 격리수준(READ COMMITTED)에서:

```
T1: UPDATE … WHERE assigned_agent_id IS NULL   → 행 잠금 획득, 갱신
T2: UPDATE … 같은 행                            → T1 커밋까지 대기(행 잠금)
T1: COMMIT
T2: 잠금 해제 후 WHERE 절 재평가 → assigned_agent_id 가 이미 NOT NULL → 0행
```
즉 **읽고-쓰기 사이의 틈이 없다.** 애플리케이션에서 `SELECT` 후 `UPDATE` 로 나눴다면 위험했겠지만,
한 문장이라 그 틈이 존재하지 않는다. `bot_say()` 의 `WHERE EXISTS` 도 같은 원리다.

> **다만 이건 근거이지 실측이 아니다.** 두 세션을 실제로 붙여 경합시키는 R2 는 P2(서버 API) 단계에서
> supertest 병렬 요청으로 반드시 확인한다. 순차 검증(T9 = 0행)만으로 "동시성 안전"이라고 말하지 않는다.

---

## 12. 로드맵

| Phase | 범위 | 산출물 | 기간 |
|---|---|---|---|
| **P1** 뼈대 ✅ **dev 적용완료 2026-09-03** | `desk` 스키마 6테이블 + view + route() + RLS · 시스템 토픽 3개 시드 · 라우팅 규칙 시드 · `departments` 컬럼 확장 · 부서 매핑 | 마이그레이션 SQL (dev→live) | 1일 |
| **P2** 상담사 데스크 | `docs/desk.html` 3-pane · 인박스/배정/답변/이관/종료 · Realtime | 데스크 UI + `/api/desk/*` | 4일 |
| **P3** 고객 위젯 | 플로팅 위젯 · 2단 토픽 선택(동적) · 봇 1차(chat-engine 재사용) · 핸드오프 | 위젯 컴포넌트 | 3일 |
| **P4** CRM 폐루프 | 전화번호 통합 · 리드 생성 · 상담이력 기록 · 360° 패널 | `desk-crm.js` | 2일 |
| **P5** 운영 | 관리자 화면 · 상용구 · 통계 · 알림 · 스파이더 검증 | 관리자 UI + QC | 3일 |

> 총 13일. **P1~P2 만으로도 "여러 상담사가 나눠 쓰는 채팅"은 동작**한다(봇 없이 사람만). 봇은 P3에서 얹는다.

---

## 13. 4 roles 시뮬레이션

**admin (대표)** — `/desk` 진입 → 전체 부서 탭 → 대기 5건·SLA 초과 1건 확인 → 초과 건을 인터넷팀 김상담사에게 강제 이관 → `/desk/admin` 통계에서 가전팀 봇완결률 32% 확인 → 가전 토픽 봇 지침 수정 → 신상품 '제습기' 개시에 맞춰 `rental_categories` 활성화 + 가전팀 `categories` 에 추가 → **배포 없이 위젯에 제습기 버튼 등장 확인**.

**manager (인터넷팀장)** — `/desk` → 인터넷팀 대화만 보임 → 팀원 3명 근무상태 확인(1명 offline) → 대기 2건을 온라인 팀원에 배정 → 통계는 인터넷팀만 조회 가능.

**agent ① 인계 받기 (경로 A)** — `/desk` → 담당 카테고리(internet_tv) 대기열 → [배정받기] → 우측 핸드오프 패키지에서 **미해결 항목 2건** 확인 → 360°에서 콜DB 6,212건 중 기존 고객임 확인, 과거 통화 3건 열람(전화 마스킹) → 상용구 `/인터넷견적` 삽입 → 고객이 가입 의사 표명 → 시간 슬롯 제시 → 고객이 "내일 오전" 선택 → 종료(`outcome='booked_call'`, `callback_at` 지정) → 요약이 `incentive_customer_notes` 에 자동 기록.

**agent ② 중간 개입 (경로 B)** — 인박스에서 **[AI 응대중]** 대화를 지켜보다 봇이 요금을 잘못 안내하는 것을 발견 → [지금 이어받기] → `handoff_reason='BARGE_IN'` 기록 → 생성 중이던 봇 응답은 **자동 폐기**(§4.2.8) → 정정 답변 전송 → 단순 문의로 판명되어 [AI 에 되돌리기] → `status='bot'` 복귀.

**agent ③ CS 채팅 종결** — `intent='cs'` 대화(개통 현황 문의) → 답변 후 [채팅 종결] (`outcome='resolved_chat'`) → **콜 배정하지 않는다**. 상담이력만 남는다.

**contract (계약처리)** — 소속 부서·겸업 카테고리 모두 없으면 인박스 빈 화면 + "담당 카테고리가 배정되지 않았습니다" 안내. 토픽·부서 설정 진입 시 403.

---

## 14. 미결정 — 대표 확인 필요

| # | 쟁점 | 선택지 | 권고 |
|---|---|---|---|
| 1 | **배정 방식** | 자동 라운드로빈 vs 수동 pull | 초기 **수동 pull** (팀 규모 11~14명) |
| 2 | **영업시간** | 부서별 다르게? 공통? | 공통 09~18시 시작, `departments.desk_hours` 로 부서별 override 가능하게 설계됨 |
| 3 | **기존 AI 챗(290건)** | 폐기 vs 위젯 전환 | 읽기전용 보존, 위젯은 `desk` 로 신규 |
| 4 | **카카오 상담톡 연동** | 포함 vs 제외 | **P5 이후 별건** (`channel` 컬럼으로 열어둠) |
| 5 | **카테고리 마스터 통합** | `rental_categories` 가 렌탈 축 전용이라 통신 토픽은 `desk.topics` 로 이원화 | 당장은 `v_topics` view 로 흡수(본안). 통합 리네이밍(`biz_categories`)은 렌탈 페이지 전수 영향이라 **별건** |
| 6 | **live 적용 시점** | 지금 vs P2 이후 | **P2 이후** — API 없이 스키마만 올리면 검증할 수단이 없다 |

### ✅ 해결된 것

| 쟁점 | 결론 | 근거 |
|---|---|---|
| ~~대상 앱 확정~~ | **고객용 앱 · 1차 사용자 = 고객** | 2026-09-03 대표 확정 |
| ~~부서 확장~~ | **필요할 때 만든다** — `INSERT` 1줄로 큐 자동 생성 | 2026-09-03 대표 지시. dev 에 고객지원팀 생성·검증 완료 |
| ~~채팅 종결 vs 콜 전환~~ | **CS 는 채팅 종결 · 계약만 예약 콜** | §4.2.7 |
| ~~AI 이력 이관 방식~~ | **같은 대화 유지** (`conversation.id` 불변) + 외부 앱용 `import` API | §4.2.6 |
| ~~중간 개입 가능 여부~~ | **가능** — `desk.claim(barge_in)` + `bot_say()` 난입 차단 | §4.2.8, dev 검증 완료 |
| ~~채널톡 구매 vs 자체개발~~ | **자체** — CRM 6,212건·`cs` 지식베이스 308건 결합이 SaaS 로는 불가 | — |

---

## 15. 배포 audit 체크리스트

- [ ] **확장성 회귀 테스트**: `rental_categories` 임의 1건 활성화 → 위젯·인박스·라우팅·권한에 배포 없이 반영되는지 확인 (이게 통과 못 하면 설계 실패)
- [ ] `desk` 스키마 **dev 먼저** → 검증 → live (execute_sql 아닌 마이그레이션 파일로)
- [ ] RLS 전 테이블 활성 + `(select auth.uid())` 패턴 ([[feedback_rls_enable_caution]])
- [ ] `desk` 스키마가 PostgREST 노출 목록에 **없는지** 확인 (anon curl 로 실측)
- [ ] SSE 재연결 `since` 커서 유실 0 검증 (재배포 중 메시지 전송 테스트)
- [ ] `incentive_menus` + `incentive_role_permissions` 4역할 갱신 (**메뉴 4곳 동기화**)
- [ ] listCols 4곳 동기화 (HTML·destructure·update·listCols)
- [ ] SW_VERSION 증가 + `?v=YYYYMMDD` cache-buster (Cloudflare 24h)
- [ ] 신규 endpoint Sentry alert 등록
- [ ] 전화번호 마스킹 · 열람 로그
- [ ] 롤백 SQL 동시 작성 (`-rollback.sql`)
- [ ] 봇 모델 최신화 · 봇 답변 `bot_sources` 근거 기록 (환각 추적)
- [ ] 배포 전 스파이더 QC (🔴 0건) → 대표 확인 → 배포 ([[feedback_bong_marketing_final_test_before_deploy]])

---

## 16. 산출물

| 파일 | 상태 |
|---|---|
| `docs/specs/cs-chat-desk-2026-09-03.md` | 본 문서 (PRD·기능명세·IA 통합) |
| `docs/wireframes/cs-chat-desk.html` | 인터랙티브 prototype 3화면 — 고객 앱 흐름 7스텝 · 상담사 데스크 · 2축 라우팅 |
| `server/db/2026-09-03-desk-chat.sql` | ✅ **dev 적용·검증 완료** · live 미적용 |
| `server/db/2026-09-03-desk-chat-rollback.sql` | 롤백 |

**다음 단계 (P2)**: `server/routes/desk.js` · `server/services/desk-router.js`(2축 라우팅+배정) · `desk-bot.js`(chat-engine 재사용) · `desk-crm.js`(전화번호 통합) · `docs/desk.html`(상담사 데스크)
