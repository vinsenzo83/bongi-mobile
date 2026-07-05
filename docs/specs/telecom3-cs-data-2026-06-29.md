# PRD: 봉이 서비스 내 무인 AI 고객센터 (통신3사 지식베이스, 크롤링 구축)

> 작성일: 2026-06-29 · 작성자: Claude (product-planning) · 상태: Draft
> slug: `telecom3-cs-data` · 도메인: **봉이 서비스 내 고객센터(고객 대면 셀프서비스 챗봇)**
> **아키텍처 방침: 봉이 서비스 안에 무인 고객센터를 구축. 통신3사 공식 홈페이지 전체 크롤링으로 별도 고객센터 DB를 만들고, 전화문의를 고객이 직접 채팅으로 — 상담사 개입 없이 — 완결.**

---

## 0. 핵심 방침 (이번 결정)
- **별도 DB로 구축** — 봉이 운영 테이블(`bongi_mobile_plans` 168건 등)과 **섞지 않는다.** 고객센터 전용 격리 스키마/프로젝트에 적재.
- **크롤링으로 데이터 셋업** — 통신3사 공식 홈페이지(SKT T world / KT / LG U+)를 **전체 크롤링**하여 요금제·결합상품 + 상담 전 영역을 수집·정규화·검수.
- **데이터 셋업은 별도 작업** — 크롤링·적재는 본 기획 확정 후 독립 파이프라인으로 실행(이 문서는 그 설계도).
- 기존 `bongi_mobile_plans`는 **참고용**(매핑 대상)일 뿐 신규 DB의 소스가 아님.
- **🎯 목표 수준 = "전화문의를 상담사 개입 없이 채팅에서 모두 해결"** — 단순 요금제 카탈로그가 아니라, **챗봇이 근거(RAG)로 정확히 답해 무인 완결**할 수준의 데이터. 따라서 ① 상담 전 영역(요금제·결합 + 개통·명변·번이·해지·위약금·할부·분실·유심·부가서비스·로밍·멤버십·소액결제…) 전수, ② 각 토픽 **정형 수치/정책 + FAQ Q&A + 응대 시나리오**, ③ **공식 출처 인용 + 환각 차단**이 필수.
- **🤖 무인(상담사 개입 없음)** — 실시간 상담사 연결을 전제하지 않는다. 챗봇이 자율 완결하고, 답할 수 없는 건 환각 대신 **비실시간 접수(티켓/콜백 요청)**로 흘린다. 자율 해결률을 데이터 정확도·커버리지로 끌어올리는 것이 본질.
- **🏠 봉이 서비스 내 고객센터 구축** — 외부 상담 도구가 아니라 **봉이 고객이 직접 쓰는 서비스 내 헬프센터/챗봇**을 만든다. ⚠️ 이는 기존 "CRM only·고객 대면 X"(`feedback_crm_only`)를 **이 기능에 한해 명시적으로 오버라이드**한다 — 고객 대면 채널이다.

---

## 1. 배경 (Background)

### 문제
콜센터 상담사가 고객 응대 중 통신3사 요금제·결합상품을 즉시 조회·비교·안내할 **공식 출처 기반의 신뢰 가능한 DB**가 없다. 기존 영업용 데이터는 운영 목적이라 출처·갱신 이력이 불명확하고, 고객센터 응대 기준으로 쓰기엔 커버리지·최신성이 보장되지 않는다.

### 왜 별도 DB인가
| 구분 | 운영 DB (`bongi_mobile_plans` 등) | 고객센터 DB (신규) |
|---|---|---|
| 목적 | 영업·견적·계약 | 상담 응대 안내(읽기) |
| 출처 | 내부 등록(수기) | **통신사 공식 홈페이지 크롤링** |
| 갱신 | 영업 정책 따라 | 공식 개편 추적(주기 크롤) |
| 정확성 책임 | 영업 마진 기준 | **공식 고지가 기준** |
| 결합상품 | 없음 | **전체 크롤링 수집** |
| 격리 | — | 운영과 분리(사고 전파 차단) |

→ 목적·출처·갱신 주체가 다르므로 **물리적으로 분리**한다.

### 기존 자산(참고, 라이브 측정 2026-06-29)
- `bongi_mobile_plans` 168건(SKT 68/KT 50/LG U+ 50) — 구조 참고용. 신규 DB와 매핑은 가능하나 소스로 쓰지 않음.
- 결합상품: 운영 DB에도 **0건** → 크롤링이 유일 경로.

### carrier 표기 (정규화 기준)
| 표준(신규 DB) | SKT 원문 | KT 원문 | LG U+ 원문 |
|---|---|---|---|
| `SKT` / `KT` / `LGU` | SK텔레콤 | KT | LG U+ / LGU+ |
크롤링 raw는 사이트 표기 그대로 저장, `carrier` 정규화 컬럼 별도. client 매핑 skt/kt/lgu (`project_bongi_carrier_mapping`).

---

## 2. 목표 (Goals)

### KPI
| 지표 | 현재 | 목표 | 측정 |
|---|---|---|---|
| **무인 자율해결률** | 0% | **≥ 80%** (상담사 개입 0으로 종결) | 챗봇 단독 종결 / 전체 세션 |
| **실시간 상담사 개입** | 100% | **0건** (비실시간 접수만) | 실시간 핸드오프 카운트 |
| **상담 토픽 커버리지** | 없음 | 통신3사 상담 토픽 **전수** | 토픽 taxonomy vs 답변 보유 |
| 챗봇 답변 정확도 | — | **오답 0 / 근거 인용 100%** | 검수 샘플·오안내 신고 |
| 통신3사 요금제 커버리지 | 불명확 | 공식 페이지 **100% 수집** | 크롤 vs 공식 페이지 대조 |
| 결합상품 수집 | 0 | 3사 주요 결합 100% | 결합 테이블 row |
| 데이터 최신성 | 미관리 | 마지막 크롤 7일 이내 | `crawled_at` 모니터링 |
| 요금제 1건 조회 | 타사이트 검색 ~2분 | < 15초 | 조회 로그 |

### Non-goals
- 통신사 공식 **API 연동**(공개 API 부재 → 크롤링 채택).
- 고객 대면 노출(**CRM/고객센터 only**, `feedback_crm_only`).
- 알뜰폰(MVNO) 수집(통신3사 정식 한정).
- 자동 견적/계약 — 본 단계는 **수집 + 조회(읽기)** 전용.

---

## 3. 사용자 (Personas)
| Role | needs | 시나리오 |
|---|---|---|
| **고객(end-user)** ⭐ | 통화 없이 즉시 자가 해결 | 봉이 서비스 내 챗봇에 질문 → 무인 정확 답변 → 종결 |
| admin(운영) | 크롤 실행·검수·승인·미해결 모니터 | diff 검수 후 publish, 접수된 미해결 큐 관리 |
| manager(센터장) | 자율해결률·데이터 신선도 감독 | deflection·미해결 토픽 분석 → 데이터 보강 지시 |
| agent(상담사) | **예외 처리만**(실시간 개입 아님) | 비실시간 접수 티켓을 사후 처리/콜백 |

---

## 4. 사용자 시나리오
- **As an** agent, 통신사·연령·약정으로 요금제 필터 → 조건에 맞는 것만 추린다.
- **As an** agent, 3사 동급 요금제 비교 → "타사 대비 유리" 안내.
- **As an** agent, 결합(인터넷+모바일+TV) 할인 조회 → 결합 권유 멘트 정확 전달.
- **As an** admin, 주기 크롤 결과의 **변경분(diff)을 검수**하고 publish → 검증된 데이터만 상담사에 노출.
- **As a** manager, 7일 지난 크롤을 본다 → 재크롤 지시.

---

## 5. 기능 명세 (Functional Requirements)

### In-scope

0. **상담 토픽 지식베이스 (채팅 완결의 핵심)** ⭐
   - 통신3사 상담 전 영역을 **토픽 taxonomy**로 분류하고, 각 토픽에 **정형 데이터 + FAQ Q&A + 응대 시나리오 + 안내멘트**를 정확한 출처와 함께 보유.
   - 토픽 1차 분류(예): `요금제` `결합/할인` `가입/개통` `명의변경` `번호이동(MNP)` `해지/일시정지` `위약금(할인반환금·단말 잔여할부)` `단말 할부/지원금` `유심/eSIM` `분실/파손/보험` `부가서비스` `멤버십/포인트` `로밍` `소액결제/콘텐츠` `청구/요금조회/미납` `명의/본인인증` `장애/품질`.
   - 각 FAQ는 `question`(자연어 변형 포함) · `answer`(정확·간결) · `source_url` · `carrier`(공통/사별) · `confidence` · `last_verified`. 챗봇이 **이 답변을 인용**해 응답.
   - **정확도 게이트**: 근거 없는 답변 금지 → 매칭 신뢰도 미달 시 챗봇은 자유생성 대신 **비실시간 접수**("확인 후 안내드리겠습니다" + 티켓/콜백 생성). 실시간 상담사 연결 없음(환각 차단 + 무인 유지).
   - **무인 운영**: 미해결로 접수된 질문은 admin/manager가 모아 보고 → 누락 토픽을 데이터에 보강 → 다음엔 챗봇이 자율 해결(폐루프로 자율해결률 상승).

1. **크롤링 수집 파이프라인** (§7 상세)
   - 통신3사 공식 요금제·결합·고객지원(FAQ/이용안내) 페이지 **전체 순회 크롤링**.
   - raw HTML/JSON 저장 → 파서로 정규화 → staging 적재.
   - 주기 실행(주 1회 권장) + 수동 트리거.

2. **검수·발행(publish) 워크플로**
   - 크롤 결과는 **staging**에 먼저. admin이 **이전 발행본과 diff**(신규/변경/삭제 요금제) 검토 후 publish → live 테이블 반영.
   - 자동 무검수 반영 금지(오안내 방지).

3. **고객센터 조회·비교 UI** (`cs-telecom-lookup.html`, 신규 메뉴)
   - 필터: carrier, network(5G/LTE), age_target, 요금 슬라이더, OTT.
   - 3사 비교 모드(요금 구간 동급 나란히).
   - 결합 탭: 유형 선택 → 구성·할인·조건·**안내멘트 복사**.
   - 각 항목 출처 링크 + `crawled_at` 표시.

4. **신선도·출처 관리**
   - 모든 row `source_url`·`crawled_at`·`published_at`. 7일 경과 ⚠️ 뱃지.

### Out-of-scope (다음 phase)
- 결합 자동 계산기(조건 입력→견적).
- 운영 DB(`bongi_mobile_plans`)와의 양방향 동기화.
- 실시간 크롤(이벤트 기반).

---

## 6. 비기능 요구
- **격리**: 별도 스키마/프로젝트. 운영 RLS·로그인 흐름과 무관(사고 전파 차단). RLS는 1테이블씩 점검 후(`feedback_rls_enable_caution`).
- **크롤링 매너**: robots.txt 준수, rate-limit(요청 간 지연), User-Agent 명시, 공개 요금 정보만 수집(로그인 영역 X). 통신사 ToS 검토는 admin/법무.
- **견고성**: 통신사 페이지 구조 변경 대비 — 파서 실패 시 raw 보존 + 알림, 부분 실패가 전체를 막지 않음.
- **성능**: 조회 P95 < 300ms. 수백~수천 row, PostgREST max-rows 1000 cap 유의(`feedback_supabase_perf_patterns`).
- **캐시**: 발행 시 SW_VERSION↑ + `?v=20260629`(`feedback_dev_cache_busting`).

---

## 7. 데이터 수집 파이프라인 (크롤링) ⭐ 핵심

### 7.1 소스 (통신3사 공식)
| 통신사 | 요금제 | 결합상품 | 렌더링 | 비고 |
|---|---|---|---|---|
| SKT | T world (tworld.co.kr) 요금제 | 결합할인 안내 | SPA(JS) | 봇차단·동적 → 브라우저 자동화 필요 |
| KT | product.kt.com 요금제 | 결합상품 | SPA/일부 SSR | |
| LG U+ | uplus.co.kr 모바일 요금제 | 결합 | SPA(JS) | |

→ 정적 fetch로는 부족(대부분 JS 렌더). **헤드리스 브라우저/`claude-in-chrome` 자동화** 또는 내부 XHR/JSON endpoint 캡처 방식.

### 7.2 단계
```
[1 수집]  브라우저 자동화로 각 페이지 순회 → raw(HTML/JSON) 저장 (crawl_raw)
[2 파싱]  통신사별 파서 → 정규화 레코드 (요금제/결합)
[3 staging] cs_plans_staging / cs_bundles_staging 적재 (crawl_batch_id 태깅)
[4 diff]  직전 published 본과 비교 → 신규/변경/삭제 산출
[5 검수]  admin UI에서 diff 확인 → 승인
[6 publish] cs_plans / cs_bundles 갱신, published_at 스탬프
[7 알림]  파서 실패·구조변경·대량삭제 시 경고
```

### 7.3 도구 선택
- **수집**: `claude-in-chrome`(MCP 브라우저) 또는 별도 Node 크롤러(Playwright). SPA·봇차단 대응 위해 실제 브라우저 권장.
- **스케줄**: 주 1회 cron(`schedule`/pg_cron). 통신사 개편은 비상시 수동 트리거.
- **저장**: 별도 Supabase 프로젝트(권장) 또는 운영 프로젝트 내 `cs_` 스키마.

### 7.4 데이터 모델 (별도 스키마 `cs` 가정)
```sql
-- 원본 크롤 (감사/재파싱용)
CREATE TABLE cs.crawl_raw (
  id bigserial PRIMARY KEY,
  batch_id uuid NOT NULL,
  carrier text NOT NULL,           -- 'SKT'|'KT'|'LGU'
  source_url text NOT NULL,
  kind text NOT NULL,              -- 'plan'|'bundle'
  raw jsonb,                       -- 캡처한 JSON/추출 텍스트
  crawled_at timestamptz DEFAULT now()
);

-- 요금제 (정규화·발행본)
CREATE TABLE cs.plans (
  id bigserial PRIMARY KEY,
  carrier text NOT NULL,           -- 'SKT'|'KT'|'LGU'
  plan_name text NOT NULL,
  network text,                    -- '5G'|'LTE'|'5G/LTE'
  monthly_fee integer,             -- 원
  data_amount text,                -- '무제한'|'110GB' 등 원문 보존
  data_daily text,
  call_amount text,
  message text,
  age_target text DEFAULT '전체',  -- 전체/청년/시니어/키즈/복지
  commit_type text,                -- 공시지원/선택약정/무약정
  ott_benefits jsonb DEFAULT '[]'::jsonb,
  conditions text,                 -- 원문 보존
  benefits text,                   -- 원문 보존
  source_url text,
  crawled_at timestamptz,
  published_at timestamptz,
  is_active boolean DEFAULT true,
  UNIQUE(carrier, plan_name)
);

-- 결합상품
CREATE TABLE cs.bundles (
  id bigserial PRIMARY KEY,
  carrier text NOT NULL,
  bundle_name text NOT NULL,
  bundle_type text,                -- 인터넷+모바일/인터넷+TV/트리플/가족결합
  components jsonb DEFAULT '[]'::jsonb,
  discount_rule text,              -- 원문
  discount_tiers jsonb DEFAULT '[]'::jsonb, -- [{"lines":2,"amount":11000}]
  conditions text,
  guide_script text,               -- 상담사 안내멘트 템플릿
  source_url text,
  crawled_at timestamptz,
  published_at timestamptz,
  is_active boolean DEFAULT true,
  UNIQUE(carrier, bundle_name)
);

-- 상담 토픽 분류 (taxonomy)
CREATE TABLE cs.topics (
  id bigserial PRIMARY KEY,
  code text UNIQUE NOT NULL,        -- 'plan'|'bundle'|'mnp'|'cancel'|'penalty'|'esim'...
  name text NOT NULL,              -- '번호이동' 등
  parent_code text,                -- 계층(대분류/소분류)
  sort int DEFAULT 0
);

-- FAQ / 응대 지식 (챗봇 RAG 소스) — 채팅 완결의 핵심
CREATE TABLE cs.faqs (
  id bigserial PRIMARY KEY,
  topic_code text NOT NULL REFERENCES cs.topics(code),
  carrier text,                    -- 'SKT'|'KT'|'LGU'|NULL(공통)
  question text NOT NULL,          -- 대표 질문
  question_variants jsonb DEFAULT '[]'::jsonb, -- 자연어 변형(검색 recall↑)
  answer text NOT NULL,            -- 정확·간결한 표준 답변
  answer_detail text,              -- 상세/예외/절차
  guide_script text,               -- 상담사·챗봇 안내멘트
  policy jsonb DEFAULT '{}'::jsonb,-- 구조화 정책값(예: 위약금 산식·로밍 요율)
  source_url text NOT NULL,        -- 공식 출처(인용 필수)
  confidence text DEFAULT 'verified', -- verified|needs_review|stale
  embedding vector(1536),          -- pgvector 의미검색(선택)
  crawled_at timestamptz,
  last_verified date,
  published_at timestamptz,
  is_active boolean DEFAULT true
);
CREATE INDEX ON cs.faqs (topic_code) WHERE is_active;
-- CREATE INDEX ON cs.faqs USING ivfflat (embedding vector_cosine_ops); -- pgvector 활성 시

-- staging 테이블은 plans/bundles/faqs와 동일 스키마 + batch_id
```
- **별도 스키마/프로젝트** 선택은 admin 결정(아래 §10 옵션 A/B).
- raw 보존 → 파서 개선 시 재파싱 가능(재크롤 불필요).
- `UNIQUE(carrier, name)`로 중복 방지, diff 기준 키.
- **챗봇 RAG**: `cs.faqs`를 키워드(topic+carrier 필터) + 의미검색(`embedding`)으로 검색 → 상위 매칭의 `answer`+`source_url`을 LLM에 컨텍스트로 주입 → **인용 답변**. 매칭 신뢰도 임계값 미달이면 답변 생성 대신 에스컬레이션(환각 차단). 정형 수치(요금·위약금)는 `policy` jsonb에서 **계산**해 정확도 보장.

---

## 8. API 설계 (별도 라우터 `server/routes/cs-telecom.js` 권장)
| Method | Path | Role | 설명 |
|---|---|---|---|
| GET | `/api/cs/plans` | all | 필터 조회 |
| GET | `/api/cs/plans/compare` | all | 3사 비교 |
| GET | `/api/cs/bundles` | all | 결합 조회 |
| POST | `/api/cs/crawl` | admin | 크롤 트리거(배치 시작) |
| GET | `/api/cs/crawl/:batch/diff` | admin | staging vs published diff |
| POST | `/api/cs/crawl/:batch/publish` | admin | 검수 후 발행 |

listCols 동기화 4곳(`feedback_listcols_pitfall`) — plans/bundles 각각.

---

## 9. UI 흐름
참고: `docs/wireframes/cs-telecom-lookup.html`
- 탭: [요금제] [3사 비교] [결합] · 좌측 필터 + 우측 결과 + 안내멘트 복사
- admin 전용: [크롤 관리] 탭 — 배치 실행·diff 검수·publish

### 메뉴 4곳 동기화(`feedback_menu_4places_sync`)
admin.html MENUS / permissions.html MENUS+DEFAULTS / 권한 DB / iframe HTML.

---

## 10. 의존성·위험
- **챗봇 오안내/환각(채팅 완결의 최대 리스크)**: 잘못된 답변이 그대로 고객에 전달되면 분쟁. 완화: ① 답변은 `cs.faqs` 근거 **인용만**(자유생성 금지), ② 신뢰도 임계값 미달 시 에스컬레이션, ③ 정형 수치는 `policy` 계산값 사용, ④ 위약금·할부 등 **금전/계약 영향 토픽은 "최종 확정은 통신사 확인" 고지** 강제, ⑤ 검수 후 publish.
- **크롤링 안정성**: 통신3사 SPA·봇차단·구조 변경 → 파서 깨짐. 완화: raw 보존+재파싱, 파서 실패 알림, 부분 성공 허용.
- **법적/ToS**: 공개 요금 정보 수집이나 통신사 ToS·저작권 검토 필요(admin/법무). robots.txt·rate-limit 준수.
- **데이터 정확성**: 크롤 오류가 그대로 안내되면 오안내 → **검수 후 publish** 게이트 필수.
- **별도 DB 운영비**: 별도 프로젝트 시 인프라 추가. 스키마 분리(옵션 B)면 비용 0.

### 별도 DB 선택지 (admin 결정 필요)
| 옵션 | 내용 | 장점 | 단점 |
|---|---|---|---|
| **A. 별도 Supabase 프로젝트** | 고객센터 전용 새 프로젝트 | 완전 격리, 독립 백업/권한 | 인프라·비용·연결 추가 |
| **B. 운영 프로젝트 내 `cs` 스키마** | 같은 DB, 스키마만 분리 | 비용 0, 기존 인증 재사용 | 물리 격리는 아님 |
→ "별도 DB" 의도가 **완전 격리(A)**인지 **논리 분리(B)**인지 확정 후 §7 적용.

---

## 11. 롤아웃 plan
1. **P1 설계 확정** — 별도 DB 옵션 A/B, 크롤 도구(claude-in-chrome vs Playwright), 스키마 fix.
2. **P2 크롤러 PoC** — 통신사 1곳(예: KT) 요금제 크롤→파싱→staging 검증.
3. **P3 3사 확장** — SKT·LGU+ 파서 + 결합상품.
4. **P4 검수·발행 UI** — diff·publish 워크플로.
5. **P5 조회 UI + 메뉴 4곳 + listCols 4곳.**
6. **P6 스케줄·모니터링** — 주1 cron, 신선도 알림, 7단계 배포(`feedback_local_dev_live`).

---

## 12. 성공 지표
- 3사 공식 페이지 대비 커버리지 ≥ 95%, 크롤 신선도 7일 이내, 오안내 0/월.
- 롤백: 크롤 오류 대량 발행 시 직전 published_at 본으로 복구(발행본 버전 보존).

---

## 13. 체크리스트
- [ ] **별도 DB 옵션 A/B 확정** (완전 격리 vs `cs` 스키마)
- [ ] **크롤 도구 확정** (claude-in-chrome / Playwright)
- [ ] **robots.txt·rate-limit·ToS** 검토
- [ ] **검수→publish 게이트** (무검수 반영 금지)
- [ ] **raw 보존** 재파싱 가능 구조
- [ ] **listCols 4곳** (plans·bundles)
- [ ] **carrier 정규화** (SKT/KT/LGU, raw 원문 별도 보존)
- [ ] **메뉴 4곳 동기화**
- [ ] **RLS** 신규 테이블 1개씩 점검 후
- [ ] **빈 값 PATCH 함정** `val!==''`
- [ ] **SW_VERSION↑ + ?v=20260629**
- [ ] **롤백**(발행본 버전 보존)
- [ ] **NO_HARDCODE** 요금·할인 DB fetch
- [ ] **MANUAL_SYNC** 상담사 매뉴얼
- [ ] **CLAUDE.md** 고객센터 DB 도메인 룰

---

## 부록: 4 roles 시뮬레이션
| Role | 메뉴 | endpoint | 권한 | 거부 |
|---|---|---|---|---|
| agent | 통신요금 조회 | GET plans/bundles/compare | 읽기 | crawl/publish 거부 |
| manager | 조회 + 신선도 | GET + crawled_at | 읽기 | crawl 위임 |
| admin | 조회 + 크롤관리 | GET/POST crawl/publish | 전체 | — |
| contract | 조회 | GET plans | 읽기 | 결합관리 거부 |
