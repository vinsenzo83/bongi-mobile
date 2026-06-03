# 봉이 storefront 설계 — AI 채팅 플랫폼 + 답변 카드(아정당 스타일) 확정

## 0. 결론 (최종 — 2026-06-03 갱신)

**봉이 차기 storefront = AI 채팅 플랫폼 + 답변 카드(아정당 스타일)**.

캡쳐(bongeestore.com / Allio 패턴)로 확인된 차기 storefront UX:
- **메인 UI**: 채팅 입력 + 카테고리 chip + 상담 history 사이드바 (GPT-like 좌측 nav)
- **답변 카드 렌더 패턴**: 아정당 (chip 직노출 + 듀얼 CTA) — 채팅 메시지 안에 product card 렌더
- **백엔드**: 셀프 가입과 상담사 연결 모두 rental_sales 1건으로 수렴 (95% 인프라 보유)
- **차별점**: rentre·아정당은 정적 카탈로그, 봉이는 **채팅형** — 이게 **유일한 경쟁 우위**

핵심 근거:
- AI 채팅 UI는 자연어 유입 funnel → products 435 + AI 5컬럼 + rental_policy V2를 RAG/tool use로 즉시 매칭 가능.
- 좌측 nav 카테고리(휴대폰·인터넷+TV·인터넷·TV·전화 결합·결합 할인 환산·가전 렌탈·이벤트·혜택)는 봉이 통신+가전 동시 운영 도메인과 1:1.
- 답변 메시지 안 product card = 아정당 chip 직노출 + 듀얼 CTA 패턴 그대로 reuse → `category_schema.extra_fields` 동적 폼 SQL 1줄로 즉시 대응.
- 듀얼 CTA(셀프 가입 + 전문상담원 연결) = rental_sales 자동 박제 + 콜DB round-robin TM 분배 인프라 100% 활용.
- **봉이 backend는 이미 95% 준비 완료** — 채팅 UI + AI 어시스턴트 어댑터만 추가하면 즉시 운영 가능.

> 참고: 아래 1~12장 = 정적 카탈로그 매핑 (rentre/아정당 분석 잔재) — 답변 카드 패턴 reuse 시 참고용. **13장 = 채팅 플랫폼 UX 설계가 최신 진실**.

---

# (참고) rentre.kr UI/UX 분석 → 봉이 storefront 매핑

## 1. 전체 페이지 구조
- **헤더**: 로고 / 카테고리 진입(정수기·공기청정기·에어컨·세탁건조기·비데 + 인터넷/TV) / Story / 검색
- **홈**: hero → 카테고리 아이콘 그리드 → BEST 추천 → 실시간 견적 활동(지역·상품) → 후기 → Story
- **리스트**: 브랜드 chip(10개) → 정렬(인기순) → 상품 카드 row → 더보기 페이지네이션(`?page=N`)
- **상세**: 이미지 캐러셀(1/N, 컬러별 6개) → 브랜드+모델명+태그 → 가격(할인율%/월가/X개월후가) → 브랜드 혜택(반값/타사보상) → 견적 CTA → 최근 견적 비교(7개) → 기본정보 표 → 스펙(사이즈·필터) → 주요 기능 chip → 부가 기능 icon
- **푸터**: 일반 + 하단 sticky 견적 CTA(추정)

## 2. 컴포넌트 분해 → 봉이 매핑

| 컴포넌트 | rentre 패턴 | 봉이 매핑 |
|---|---|---|
| 카테고리 아이콘 grid | 정수기/공기청정기/비데/안마의자 | `rental_categories` 메타 그대로 |
| 상품 카드 row | 배지·이미지·제목·할인율%·월가·X개월후·기능chip·평점(4.9 533)·주문수(3000+) | products + AI 5컬럼(기능chip) + 신규: 평점/주문수 |
| 가격 dual 표시 | "월 14,450원 / 12개월 후 28,900원" | rental_policy V2: payback·P 반영해 동적 계산 |
| 할인율 badge | "56%" | (정가-실가)/정가 = client 계산 |
| 컬러 selector | 6 colors, 각 별도 URL | category_schema `extra_fields.colors[]` 확장 |
| 약정/요금제 select | 3/5년, 카드, 요금제 | rental_quote_form 기존 패턴 재사용 |
| 브랜드 혜택 chip | "반값할인", "타사보상", "상품권증정", "12개월 후 가격인상" | 신규: promotion_tags 마스터 |
| 제휴카드 toggle | on/off 시 가격 변화 | partner_card 1·2·3 구간 + card_snapshot 보유 |
| 견적 CTA | "견적 받아보기 / 평균 7개 견적" | rental_sales insert 재사용 |
| 최근 견적 비교 | "신**님 인천 16,155원 6개월후32,310원" | 신규: rental_quotes 공개 view + 마스킹 |
| 기본정보/스펙 표 | 모델명·제조사·사이즈·필터 | category_schema extra_fields 확장 |
| 부가기능 icon | UV·IoT·고온수·에너지절약 | 신규: feature_icons 마스터 + 매핑 |
| BEST/NEW/HOT 배지 | 자동 로직 | 신규: sales_count·created_at 기반 룰 |

## 3. 보유 vs 신규

**이미 보유** (재사용):
- products 435 + AI auto-fill 5컬럼 (주요기능 chip 직결)
- category_schema 동적 폼 (스펙표·컬러 확장 1줄)
- partner_card 1·2·3 + brand alias + card_snapshot (제휴카드 toggle)
- rental_sales (견적받기 insert) · rental_policy V2 (가격 계산)
- BroadcastChannel 동기화

**신규 필요**:
- 평점/리뷰 시스템 (`rental_reviews`)
- 견적 비교 공개 view (`rental_quotes_public` + 마스킹 RLS)
- BEST/NEW/HOT 자동 배지 룰 (sales_count·created_at)
- promotion_tags 마스터 (반값/타사보상/상품권/가격인상)
- feature_icons 마스터 + 매핑 테이블
- 주문수 카운터 (`product_order_count` materialized view)
- 하단 sticky CTA 컴포넌트

## 4. 추천 디렉토리

```
client/src/pages/storefront/
  ├─ index.html              홈
  ├─ category.html           리스트 (정수기/공기청정기/...)
  ├─ product.html            상세
  ├─ quote.html              견적받기 폼
  ├─ _components/
  │   ├─ product-card.js     카드 row
  │   ├─ price-dual.js       월가/X개월후 dual
  │   ├─ promo-chip.js       반값/타사보상 chip
  │   ├─ card-toggle.js      제휴카드 toggle
  │   ├─ feature-icons.js    부가기능 icon
  │   ├─ recent-quotes.js    견적 비교
  │   └─ sticky-cta.js       하단 sticky
  └─ _shared/storefront-api.js
docs/storefront/
  ├─ wireframe.md
  └─ component-spec.md
```

## 5. 차기 세션 priority

- **P1** (구현 차단 요소):
  1. 와이어프레임 5종 (홈·리스트·상세·견적·완료)
  2. promotion_tags + feature_icons 마스터 스키마
  3. product-card · price-dual 컴포넌트 + AI 5컬럼 연동
  4. rental_quotes_public view + 마스킹 RLS
- **P2** (핵심 UX):
  5. 제휴카드 toggle (card_snapshot 활용)
  6. BEST/NEW/HOT 자동 배지 룰
  7. 컬러 selector + category_schema 확장
  8. 하단 sticky CTA
- **P3** (after-MVP):
  9. 평점/리뷰 (rental_reviews + 모더레이션)
  10. Story(블로그) 섹션
  11. 실시간 견적 활동 ticker
  12. 브랜드별 LP

전제: docs/specs/admin-as-is 핸드오프 패키지 + rental_policy V2 + register_form 체제 위에서 storefront만 신규 모듈로 추가. 정책값 fetch + manual sync 룰 준수.

---

## 6. 견적 Funnel 정밀 분석 (캡쳐 기반)

> WebFetch는 SPA 렌더링으로 본문 추출 실패. 사용자 6장 캡쳐 + URL pattern으로 재구성.

### Funnel step list

| step | URL pattern | state mutation | 핵심 UI |
|---|---|---|---|
| 0 | `/product/{pid}` | - | 상세 페이지에서 "견적 받아보기" 클릭 |
| 1 | `/proposal/request/submit/common/{pid}` | - | 약정·관리 방식 선택 |
| 1→2 | `?prodTermUsid={termId}` | 약정/관리 조합 ID 추가 | 카드 선택 결과 query 적재 |
| 2-1 | `?prodTermUsid=...&hasRental={y/n}` | 타사보상 분기 | "사용중 렌탈 있나요?" |
| 2-2 | `&addCats=water,air,...` | cross-sell 카테고리 multi-select | "다른 제품도 함께?" |
| 3 | `&skip=afterLogin` | 로그인 wall | 5 social login + 쿠폰팩 hook |
| 4 | `/proposal/request/complete` | DB insert 완료 | "평균 N개 견적 도착" |

### Step1 — 약정/관리 추천 카드 2종

| 카드 | 기준 | 카드 안 표시 | 제휴카드 활성 |
|---|---|---|---|
| 월 요금 최저 | 가장 긴 약정+카드 max 할인 | 약정 5년 / 자가관리 / 월 14,450원 / 12개월 후 28,900원 | 보라색 강조 |
| 계약 최단 | 의무 사용 최단 | 약정 3년 / 방문관리 4개월 / 월 X원 / 6개월 후 Y원 | 회색(약정 짧으면 비활성) |
| 직접 선택 | 사용자 자유 조합 | 약정·관리·요금제 select 펼침 | 조합에 따라 동적 |

→ **동적 가격 계산 로직**: `약정 length ≥ 60개월 AND 카드 가입 가능 → 제휴카드 활성(보라색)`. 짧으면 회색 비활성. 봉이 도메인은 `partner_card` 1·2·3 구간 + `card_snapshot` 보유라 즉시 매핑 가능.

### Step2-1 — 타사보상 분기

질문: "사용중인 렌탈 제품 있나요?"
- "있어요" → 타사보상 혜택 적용 분기 (할인 추가)
- "없어요" → 일반 흐름
- "모르겠어요" → 일반 흐름 (상담사 확인)

→ 봉이: `rental_sales.has_other_rental` boolean + `other_rental_brand` text 컬럼 신규.

### Step2-2 — Cross-sell chip multi-select

질문: "다른 제품도 함께 렌탈하실래요?"
- "아니요" → step3 (로그인) 직행
- "네" → 카테고리 chip 6종 표시:

| rentre chip | 봉이 `rental_categories` slug 매핑 |
|---|---|
| 정수기 | water_purifier |
| 공기청정기 | air_purifier |
| 비데 | bidet |
| 전기레인지 | electric_range |
| 매트리스 | mattress |
| 기타 | _etc (free text) |

multi-select → query: `&addCats=water,air,bidet`. 봉이는 `rental_sales.cross_sell_categories text[]` 컬럼 신규.

### Step3 — 간편 로그인 wall

위치: **견적 받기 직전(submit 직전)** — 사용자가 funnel 다 채운 후 wall이 떠서 이탈 최소화.

쿠폰 hook: **"신규 회원 인터넷 가입 쿠폰팩 4종 증정"**
- 4종 추정: 인터넷 가입 할인 / 사은품 추가 / 상품권 / 통합 패키지
- 가입 promise 만으로 social login 전환율 ↑

Social login 순서: **카카오 → Apple → Email → Google → Naver** (KR 시장 카카오 1st 패턴)

비회원 진행: 미지원 추정 (회원 가입 강제 = lead 확보 우선)

### 봉이 도메인 적용 차이

| 항목 | rentre | 봉이 |
|---|---|---|
| 가입 wall 위치 | 고객 LP step3 | **CRM 어드민은 wall 없음** (상담사 운영). 고객 LP만 step3 wall 필요 |
| 쿠폰 hook | 인터넷 가입 쿠폰팩 4종 | 봉이는 인터넷+TV+휴대폰 결합 쿠폰 패키지 가능 |
| Social login | 5종 | 카카오 1순위 + Naver + 휴대폰 인증 (KR 통신 도메인) |
| Cross-sell | 6 카테고리 | 가전 카테고리 + **인터넷/TV/휴대폰** 추가 (통신 통합 cross-sell = 봉이 차별점) |
| 타사보상 분기 | rental 보유 여부 | 봉이는 + **통신사 변경 여부** (SK인터넷+TV 기변 불가 룰 분기) |

### 신규 스키마 (funnel 적용)

```sql
ALTER TABLE rental_sales ADD COLUMN funnel_step int DEFAULT 0;
ALTER TABLE rental_sales ADD COLUMN has_other_rental boolean;
ALTER TABLE rental_sales ADD COLUMN other_rental_brand text;
ALTER TABLE rental_sales ADD COLUMN cross_sell_categories text[];
ALTER TABLE rental_sales ADD COLUMN funnel_completed_at timestamptz;
CREATE TABLE storefront_coupons (
  id, code, title, description, target_category, expires_at, ...
);
CREATE TABLE storefront_users (
  id, social_provider, social_uid, phone, coupon_pack_granted_at, ...
);
```

### Funnel을 P1~P3에 추가

- **P1**: step1 약정/관리 추천 카드 2종 + 직접 선택 + 동적 가격 계산
- **P1**: step3 로그인 wall + 5 social (카카오 1st) + 쿠폰팩 hook
- **P2**: step2-1 타사보상 분기 + step2-2 cross-sell chip multi-select
- **P2**: funnel state 보존 (URL query 또는 localStorage) — 새로고침 견적 진행 보존
- **P3**: 가입 후 쿠폰 자동 발급 cron + 쿠폰 사용/만료 추적

---

## 7. 경쟁사 비교: rentre vs 아정당 vs 봉이 매핑

### 7-1. 핵심 차이 매트릭스

| 축 | rentre.kr | 아정당(ajd.co.kr) | 봉이 (권장 = 하이브리드) |
|---|---|---|---|
| **약정·관리 선택 UX** | wizard 추천 카드 2종 (월 요금 최저 / 계약 최단) + 직접 선택 | chip 직노출 — 84/72/60/36개월 4개 동시 + 관리방법(방문/자가) chip + 관리주기 select("6M반값/4개월필터/12개월관리") | **양쪽 결합**: 추천 카드 2종 default + chip 직노출 펼침 옵션 |
| **메인 CTA** | "견적 받아보기" funnel (회원가입 wall 강제) | 우측 floating: 실시간 카톡상담·맞춤 상담·1833-3504 24h + 상담사 사진 | **하이브리드**: 데이터 풀 funnel + 카톡/전화 상담 CTA 동시 노출 |
| **가격 노출** | 월가 / X개월후 가격 / 할인율% / 예상혜택 sticky | 최대 혜택가 6,400원 vs 예상 월 렌탈료 34,400원 (절감액 강조) | 봉이: rental_policy V2로 두 노출 모두 동적 계산 가능 |
| **헤더 nav** | 5 카테고리 (가전 + 인터넷/TV) | 11 카테고리 portal (인터넷·가전·휴대폰·카드·이사·청소·부동산·인테리어·상조·매장·쇼핑적립) | 봉이 도메인과 가장 유사 — 인터넷/TV/휴대폰/가전렌탈 동시 운영 |
| **신뢰 표시** | 평점(4.9 533) + 주문수(3,000+) | 365일 24h 상담OK + 1833-3504 + 상담사 모델 + 항목별 점수(95.3~100점) | 봉이: 평점/리뷰 신규 + 콜DB·TM 기반 상담사 사진/대표번호 노출 |
| **데이터 풀** | 견적 funnel 5 step (회원 lead 강제) | 상담 의존 강 (전화/카톡으로 빠짐) | 봉이: products 435 + AI 5컬럼 → funnel 자동 풀 가능 |

### 7-2. 봉이 도메인 fit 분석

- **wizard 추천 로직(rentre)**: rental_policy V2 = `margin = rebate×0.9 − payback − P×70k` 공식으로 "월 요금 최저" / "계약 최단" 자동 계산 가능. P JSONB 매핑 활용.
- **chip 직노출(아정당)**: `category_schema.extra_fields` 동적 폼이 이미 SQL UPDATE 1줄로 chip 추가 지원. 추가 개발 X.
- **상담 CTA(아정당)**: 봉이는 콜DB·TM 상담사 v1/v2·360° 고객관리 보유. 카톡/전화 상담 연계 = 기존 인프라 그대로 활용.
- **결론**: rentre 견적 funnel(데이터 풀) + 아정당 상담 CTA(전환 보조) **하이브리드 = 봉이 LP 권장 모델**.

### 7-3. 봉이 LP 차별점 (양쪽 미보유)

| 차별점 | 근거 |
|---|---|
| 인터넷/TV/휴대폰 + 가전렌탈 **통합 cross-sell** | rentre는 가전만, 아정당은 portal이지만 cross-sell UX 약함. 봉이는 한 funnel에서 통신+가전 묶음 가능 |
| 통신사 변경 분기 (SK인터넷+TV 기변 불가 룰) | rentre/아정당 미지원. 봉이 룰북에 명시 |
| 사은품 vs 현금 메리트 즉시 노출 | rentre 혜택은 "요청자에게만 공개", 아정당은 상담 후. 봉이는 즉시지급 가능 |
| 매장 → 콜센터 → 어드민 통합 lead 흐름 | 양쪽 모두 어드민 풀 노출 안함 |

---

## 8. 아정당 상세 컴포넌트 분해 + 봉이 매핑 (최종 채택)

### 8-1. 아정당 캡쳐 8 추가 패턴

| 컴포넌트 | 아정당 패턴 | 봉이 매핑 (인프라 기반) |
|---|---|---|
| 상단 promo banner | "신청하면 최대지원금 128만원" + X 닫기 | `rental_partner_cards` 최대 지원금 자동 hook + dismissible cookie |
| 약정 chip 동적 | SK매직 84/72/60/36, LG 72/60/48 | `rental_products.months_available[]` 자동 렌더 |
| 관리방법 chip | 방문/자가 | `category_schema.extra_fields.care_methods[]` |
| 관리주기 select | "6M반값_4개월필터발송 12개월관리", "12M반값_6개월관리" | `category_schema.extra_fields.care_cycles[]` (모델별) |
| 가격 dual 노출 | 최대 혜택가 6,400원 vs 예상 월 렌탈료 34,400원 (혹은 0원 vs 35,900원) | rental_policy V2: `margin = rebate×0.9 − payback − P×70k` + card_snapshot 최대 할인 |
| 중앙 tooltip | "숨어있는 나의 최대지원금, 바로 확인해 보세요" | partner_card 활성 시 동적 floating tooltip |
| 우측 floating panel | 비밀혜택 3초 안내 / 실시간 카톡상담 / 맞춤 상담 신청 / 1833-3504 24h / 상담사 사진 | 카카오톡 ch + 봉이 대표번호 + TM 상담사 표시 (TM 사진 미보유 → 일단 캐릭터) |
| 듀얼 CTA | 셀프 가입 + 전문상담원 연결 | **backend 단일** — 아래 9장 참조 |
| 항목별 점수 | 렌탈료·정수성능·위생·편의 80~104점, 종합 92.6 | 신규: `rental_product_scores` (after-MVP) |
| 신뢰 표시 | 365일 24h OK + 1833-3504 반복 노출 + 58만 고객 + 차액 120% 보장 | 봉이도 노출 가능 (콜DB 누적 + 가맹점 수) |

### 8-2. 헤더 nav 11 카테고리 → 봉이 매핑

| 아정당 | 봉이 (운영 중) | 봉이 (미운영 → 보류) |
|---|---|---|
| 인터넷 | ○ | |
| 가전렌탈 | ○ | |
| 휴대폰 | ○ | |
| 카드 | △ (제휴카드 보유) | |
| 이사 | | × |
| 청소 | | × |
| 부동산 | | × |
| 인테리어 | | × |
| 상조 | | × |
| 매장패키지 | ○ (8 매장) | |
| 쇼핑적립 | | × |

→ 봉이 LP nav 4~5개: **인터넷 · 가전렌탈 · 휴대폰 · 매장패키지 · (제휴카드)**.

---

## 9. CTA 듀얼 패턴 — backend 단일 (핵심)

> 사용자 결정: "셀프 가입과 상담사 연결하기는 동일하다"

### 9-1. 데이터 모델 단일 = rental_sales insert 1건

```
고객 LP                          backend                  후처리
─────────────────────────────────────────────────────────────────
"셀프 가입" ─────────────┐
  (카카오 로그인+         │
   form 입력+동의)        │
                         ├──> rental_sales insert ──> 자동 처리
                         │     (snapshot 박제·          (자동 견적·
                         │      card_snapshot)          알림·확인 SMS)
"전문상담원 연결" ──┐    │
  (이름+전번 1줄)   │    │
                   │    └──> rental_sales insert (lead 상태)
                   │              │
                   └──> incentive_customer_db
                          (콜DB 이관)
                          │
                          └──> round-robin TM 분배
                                 └──> TM 상담사 통화
                                       └──> rental_sales 업데이트
                                             (sales 확정)
```

### 9-2. UI 듀얼 / 데이터 단일 = 봉이 backend 95% 준비 완료

| 기능 | 인프라 보유 | 상태 |
|---|---|---|
| rental_sales 자동 박제 (snapshot) | ✓ | 기 구축 완료 |
| card_snapshot metadata 박제 | ✓ | 오늘 완료 |
| 콜DB 이관 (incentive_customer_db.insert) | ✓ | 기 구축 완료 |
| round-robin TM 분배 (incentive_customer_db_distribution) | ✓ | 기 구축 완료 |
| TM 상담 v1 큐콜 | ✓ | 기 구축 완료 |
| 콜DB CRM 360° 고객관리 | ✓ | 기 구축 완료 |
| **신규 필요** = 고객 LP UI (storefront/) | ✗ | **이게 유일한 신규 작업** |

### 9-3. 어댑터 사양

```js
// 셀프 가입 path
POST /api/storefront/self-enroll
  → rental_sales.insert({ source: 'storefront_self', snapshot, card_snapshot, status: 'auto_pending' })

// 상담사 연결 path
POST /api/storefront/consultant-request
  → incentive_customer_db.insert({ source: 'storefront_consult', phone, name, product_id, ...})
  → 자동으로 round-robin TM 분배 (기존 trigger)
  → TM 통화 후 → rental_sales.insert (수동)
```

---

## 10. 차기 세션 priority — 최종 (아정당 패턴)

봉이는 backend 95% 준비됨. 작업은 LP UI + 어댑터 5개로 압축.

- **P1 — 고객 LP UI (storefront/) 골격**
  1. 와이어프레임 5종 (홈·카테고리 리스트·상품 상세·셀프 가입 폼·상담 신청 폼)
  2. 헤더 nav 5개 (인터넷·가전렌탈·휴대폰·매장패키지·제휴카드)
  3. 상단 promo banner ("최대지원금 N원" + X 닫기 + cookie)
  4. 우측 floating panel (카톡 ch·1599-XXXX·맞춤 상담 신청·TM 안내)
  5. 카테고리 리스트: rentre 스타일 카드 (BEST/NEW 배지·할인율%·월가/X개월후·태그 chip·평점·주문수)

- **P2 — 상품 상세 (아정당 chip 직노출)**
  6. 약정 chip 동적 (`rental_products.months_available[]` 자동 렌더)
  7. 관리방법·관리주기 chip (`category_schema.extra_fields` 활용)
  8. 가격 dual 표시 (최대 혜택가 vs 예상 월 렌탈료) + 절감액 강조
  9. 중앙 tooltip ("숨어있는 최대지원금") — partner_card 활성 시
  10. 듀얼 CTA 버튼 ("셀프 가입" / "전문상담원 연결")

- **P3 — 셀프 가입 form + 어댑터**
  11. 카카오 social login (1st priority)
  12. 가입 form (이름·전번·주소·카드 동의) + 카카오 주소검색 embed
  13. POST /api/storefront/self-enroll → rental_sales 자동 박제
  14. 가입 완료 SMS + 자동 견적 발송

- **P4 — 상담사 연결 + 콜DB ingest 어댑터**
  15. 상담 신청 form (이름+전번+희망시간 1줄)
  16. POST /api/storefront/consultant-request → incentive_customer_db.insert
  17. round-robin trigger 동작 확인 (기존 인프라 그대로)
  18. TM v2에서 storefront_consult source 필터 + 우선순위 큐

- **P5 — 회원 마이페이지·견적 비교 (옵션)**
  19. 카카오·Apple·네이버 social login 통합
  20. 견적 내역 조회·재신청
  21. 평점/리뷰·항목별 점수 (after-MVP)
  22. 통신+가전 통합 cross-sell (봉이 차별점 — 단계적 추가)
  23. rentre wizard 추천 카드 패턴 (옵션 B로 보관 — 데이터 풀 충분히 쌓인 후 도입 검토)

---

## 11. 추천 디렉토리 구조 (최종)

```
client/src/pages/storefront/
  ├─ index.html              홈 (hero·카테고리 grid·BEST)
  ├─ category.html           리스트 (정수기·공청·비데·휴대폰·인터넷)
  ├─ product.html            상세 (chip 직노출·dual price·듀얼 CTA)
  ├─ self-enroll.html        셀프 가입 폼
  ├─ consult-request.html    상담사 연결 폼
  ├─ mypage.html             회원 마이페이지 (P5)
  └─ _components/
      ├─ promo-banner.js     상단 promo banner (dismissible)
      ├─ product-card.js     리스트 카드 row
      ├─ chip-select.js      약정·관리방법·관리주기 chip
      ├─ price-dual.js       최대혜택가 vs 예상렌탈료
      ├─ floating-cs.js      우측 상담 panel
      ├─ dual-cta.js         셀프 가입 + 상담 연결
      ├─ promo-tooltip.js    중앙 최대지원금 tooltip
      └─ feature-icons.js    부가 기능 icon
  └─ _shared/
      ├─ storefront-api.js   self-enroll · consultant-request 어댑터
      └─ storefront-auth.js  카카오 social login
docs/storefront/
  ├─ wireframe.md
  ├─ component-spec.md
  └─ cta-flow.md             듀얼 CTA backend 단일 다이어그램
```

(이전 7-4 priority는 11번으로 대체됨 — 아정당 패턴 단일 채택 확정)

---

## 12. 아정당 신청 form flow (platform-form.ajd.co.kr) — 봉이 셀프 가입 핵심

> 캡쳐 9·10·11번 기반 — "전문상담원 연결" 또는 "셀프 가입" 클릭 후 진입

### 12-1. form step list

| step | URL pattern | UI | 핵심 데이터 |
|---|---|---|---|
| 1 | `/register/product-confirm` | 카테고리 아이콘 + 상품명 + 상세보기 toggle / 하단 예상요금 W 월 35,900원 + 다음 | product_id 확정 |
| 2 (modal) | (modal overlay) | "상담받는 분은 누구인가요?" — 직접 / 대신 (대리인) | isMyself flag |
| 3 | `/register/customer-info?isMyself=1` | 가입자 유형 chip 4종 + 가입자명 + 생년월일 + 성별 + carrier(SKT/KT/LGU) + 번호 + 대리인 연락처(옵션) + 이메일 + 다음 | rental_sales insert 핵심 |
| 4+ | (계약·결제·동의) | (캡쳐 미보유 — 추정) | 약정 동의·결제 정보 |

### 12-2. step3 form 필드 → 봉이 rental_sales 매핑

| form 필드 | rental_sales 컬럼 | 상태 |
|---|---|---|
| 가입자 유형 chip (개인/개인사업자/법인사업자/외국인) | **`customer_type`** | **신규 필요** |
| 가입자명 | `customer_name` | 보유 |
| 생년월일 (YYYY-MM-DD) | `birth_date` | 보유 |
| 성별 (남성/여성) | `gender` | 보유 |
| carrier select (SKT/KT/LGU) | `carrier` | 보유 (carrierMap 적용 SK/KT/LG) |
| 가입자 명의 연락처 | `phone` | 보유 |
| 대리인 연락처 (옵션) | **`agent_phone`** | **신규 필요** |
| 대리인 관계 (옵션) | **`agent_relation`** | **신규 필요** |
| 이메일 | `email` | 보유 |
| (오늘 추가) card_snapshot | `card_snapshot` jsonb | 오늘 완료 |

### 12-3. 마이그레이션 1건

```sql
ALTER TABLE rental_sales
  ADD COLUMN customer_type text CHECK (customer_type IN ('personal','sole_proprietor','corporate','foreigner')),
  ADD COLUMN agent_phone text,
  ADD COLUMN agent_relation text;
COMMENT ON COLUMN rental_sales.customer_type IS '가입자 유형 (개인/개인사업자/법인사업자/외국인)';
COMMENT ON COLUMN rental_sales.agent_phone IS '대리인(대신 상담받는 사람) 연락처';
COMMENT ON COLUMN rental_sales.agent_relation IS '가입자와 대리인 관계 (배우자/부모/자녀/지인 등)';
```

### 12-4. 셀프 가입 flow (form → rental_sales)

```
LP 상품 상세 "셀프 가입" 클릭
  → /storefront/register/product-confirm?productId=N (step1)
  → modal "직접 / 대리인" (step2)
  → /storefront/register/customer-info?isMyself={0|1} (step3)
  → form submit
    → POST /api/storefront/self-enroll
      → rental_sales.insert({
           source: 'storefront_self',
           customer_type, customer_name, birth_date, gender,
           carrier, phone, email,
           agent_phone, agent_relation,
           product_id, snapshot, card_snapshot,
           status: 'auto_pending'
         })
  → 완료 페이지 (예상 처리 시간·문자 안내·고객센터 번호)
```

### 12-5. priority 추가 — P2 보강

P2 (상품 상세 + 셀프 가입 form 통합):
  - **P2-1**: rental_sales 컬럼 추가 마이그레이션 (customer_type · agent_phone · agent_relation)
  - **P2-2**: 신청 form 페이지 3종 — storefront/register/product-confirm.html · (modal) · customer-info.html
  - **P2-3**: form → rental_sales POST 어댑터 + snapshot 박제 (오늘 card_snapshot 패턴 그대로 확장)
  - **P2-4**: 대리인 분기 (isMyself=0 시 대리인 필드 표시)
  - **P2-5**: carrier select carrierMap 적용 (skt→SK, kt→KT, lgu→LG)
  - **P2-6**: 완료 페이지 + SMS 안내

→ 기존 P3 (셀프 가입 form + 어댑터)는 P2와 통합되어 P3는 "상담사 연결 어댑터"로 단일화. P4는 social login·마이페이지로 이동.

---

## 13. 채팅 플랫폼 UX 설계 (2026-06-03 추가 — 최신 진실)

> 사용자 캡쳐(bongeestore.com / Allio 패턴) 기반. 1~12장의 정적 카탈로그 매핑은 답변 카드 reuse 시 참고용으로 보존하되, **storefront 메인 UX는 채팅 플랫폼**으로 확정.

### 13-1. 전체 레이아웃

```
┌───────────────────────────┬──────────────────────────────────────────────┐
│  좌측 사이드바 (LeftRail)  │  메인 영역 (ChatMain)                          │
│                           │                                              │
│  [봉이 로고]  지도·다크모드 │  ┌────── 이벤트 배너 (캐러셀) ──────┐         │
│                           │  │ iPhone 17 특가 + 카드할인 + 이미지 │         │
│  [ + 새로 시작 ]           │  └─────────────────────────────────┘          │
│                           │                                              │
│  [상담 내역 검색...]       │                                              │
│                           │       (중앙 정렬)                              │
│  카테고리                  │                                              │
│   홈                       │       "궁금한 조건을 편하게 물어보세요"        │
│   서비스 추천               │   ┌────────────────────────────────────┐    │
│   휴대폰                   │   │ [채팅 입력] [+카테고리 chip] [전송 →] │    │
│   인터넷+TV                │   └────────────────────────────────────┘    │
│   인터넷                   │                                              │
│   TV                       │   추천 prompt chip 5개                       │
│   전화 결합                 │   [인터넷+TV 신청 도와줘] [휴대폰 추천해줘]    │
│   결합 할인 환산            │   [중고폰 시세] [가전렌탈 추천] [이벤트]      │
│   가전 렌탈                 │                                              │
│   이벤트                    │   ── 대화 시작 후 ──                         │
│   혜택                     │   user 메시지 ↓                              │
│                           │   AI 답변 메시지 ↓                            │
│  최근 상담 내역              │     └── ChatProductCard ──┐                 │
│   "정수기 추천..."           │         (chip 직노출 +     │                 │
│   "iPhone 17 카드..."        │          듀얼 CTA)         │                 │
│                           │                                              │
│  [친구 초대하기]            │                                              │
│   포인트 적립 promo         │                                              │
│                           │                                              │
│  [로그인/회원가입]           │                                              │
└───────────────────────────┴──────────────────────────────────────────────┘
```

### 13-2. 컴포넌트 분해

**좌측 사이드바 (LeftRail)** — GPT-like 채팅 navigation

| 컴포넌트 | 역할 | 봉이 매핑 |
|---|---|---|
| `LogoHeader` | 로고 + 지도 toggle + 다크모드 toggle | 정적 |
| `NewChatButton` | "+ 새로 시작" — 신규 conversation 생성 | bongi_conversations.insert |
| `ConversationSearch` | 상담 history 검색 input | bongi_conversations.title ilike |
| `CategoryNav` | 11 카테고리 메뉴 (홈·서비스 추천·휴대폰·인터넷+TV·인터넷·TV·전화 결합·결합 할인 환산·가전 렌탈·이벤트·혜택) | rental_categories + 통신 카테고리 + 정적 ("홈"·"서비스 추천"·"이벤트"·"혜택") |
| `ConversationHistory` | 최근 상담 history list (대화 제목 + 클릭 시 conversation 복원) | bongi_conversations order by started_at desc |
| `InvitePromo` | 친구 초대 → 포인트 적립 | bongi_referrals (P5) |
| `UserPanel` | 로그인/회원가입 (비로그인) 또는 프로필 (로그인) | 카카오 social login |

**메인 영역 (ChatMain)**

| 컴포넌트 | 역할 | 봉이 매핑 |
|---|---|---|
| `EventBanner` | 상단 이벤트 캐러셀 (iPhone 17 특가 등) | storefront_events 테이블 (제목·이미지·CTA·기간) |
| `ChatInput` | 중앙 자유 텍스트 입력 + 전송 화살표 | textarea + Enter submit |
| `CategoryChipPicker` | 입력창 안 "+카테고리" → 카테고리 chip 선택 후 prompt에 prefix 부착 | CategoryNav와 공유 |
| `SuggestPromptChips` | 추천 5개 chip (인터넷+TV·휴대폰·중고폰·가전렌탈·이벤트) | 정적 + 시간대별 A/B (P5) |
| `StreamingAnswer` | AI 답변 메시지 (Claude API streaming) | Anthropic SDK + tool use |
| `ChatProductCard` | 답변 메시지 안에 렌더되는 product card — chip 직노출 + 듀얼 CTA + 가격 dual | 아정당 8장 패턴 그대로 reuse |
| `ChatActionBar` | 메시지 하단 (복사·재생성·신고) | 정적 |

### 13-3. ChatProductCard 패턴 (아정당 reuse)

```
┌────────────────────────────────────────────────────────┐
│ [상품 이미지]  SK매직 정수기 직수 슬림                    │
│                                                       │
│ [약정 chip] 84개월  72개월  60개월  36개월              │
│ [관리방법]  방문관리  자가관리                          │
│ [관리주기]  6M반값_4개월필터 12개월관리                  │
│                                                       │
│ 최대 혜택가  6,400원     예상 월 렌탈료  34,400원        │
│ (절감액 28,000원 강조)                                  │
│                                                       │
│ [ 셀프 가입 ]  [ 전문상담원 연결 ]                       │
└────────────────────────────────────────────────────────┘
```

→ 클릭 시 12장 form flow로 진입 (storefront/register/product-confirm + customer-info). **데이터 모델 단일 = rental_sales insert 1건**은 9장 그대로.

### 13-4. AI 어시스턴트 system prompt 설계

**스택**: Claude API (Sonnet 4.7 권장) + tool use + 프롬프트 캐싱 (rental_products 카탈로그 캐시 → 5분당 1회 refresh)

**System prompt 골격**:
```
당신은 봉이모바일 storefront AI 상담사입니다.
- 사용자가 통신(인터넷·TV·휴대폰·결합)·가전렌탈·매장패키지에 대해 자연어로 질문하면
- 적절한 상품을 검색해 ChatProductCard JSON으로 응답하세요.
- 봉이 룰북: SK 인터넷+TV 기변 불가, 사은품 vs 현금 메리트 즉시지급,
  렌탈 정책 V2(margin = rebate×0.9 − payback − P×70k).
- 절대 가격을 임의 계산하지 말고 calculate_quote tool 사용.
- 한국어 존댓말, 친근한 말투, 2~3문장 이내로 요약 후 카드 렌더.
```

**Tool use 정의** (Claude API tools):

| tool 이름 | 역할 | 백엔드 |
|---|---|---|
| `search_products` | 카테고리·키워드·약정 조건으로 rental_products 검색 | Supabase RPC + AI 5컬럼 |
| `get_partner_cards` | 활성 제휴카드 + 최대 지원금 조회 | rental_partner_cards |
| `calculate_quote` | rental_policy V2 공식으로 월 렌탈료·최대 혜택가·절감액 계산 | rental_policy_v2 RPC |
| `search_telco_plans` | 인터넷+TV·휴대폰 요금제 검색 | incentive_products (carrier 매핑) |
| `check_carrier_lock` | SK인터넷+TV 기변 불가 등 룰북 체크 | 룰 함수 |
| `create_sale` | 셀프 가입 → rental_sales insert | 9장 self-enroll 어댑터 |
| `request_consultant` | 상담사 연결 → incentive_customer_db insert | 9장 consultant-request 어댑터 |
| `get_event_banners` | 활성 이벤트 배너 | storefront_events |

**RAG 데이터 소스**:
- rental_products (435개) — 상품 카탈로그
- rental_partner_cards — 제휴카드·최대 지원금
- rental_categories.metadata.extra_fields — chip·관리방법·관리주기 schema
- incentive_products — 통신 요금제
- 룰북 docs (SK 기변 불가·정책 V2·사은품 룰)

### 13-5. 상담 history 저장 — 신규 테이블 2개

```sql
CREATE TABLE bongi_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES storefront_users(id),
  guest_session_id text,  -- 비로그인 게스트 (localStorage)
  title text,             -- 첫 user 메시지 요약 (Claude로 자동 생성)
  started_at timestamptz DEFAULT now(),
  last_message_at timestamptz DEFAULT now(),
  message_count int DEFAULT 0,
  resulted_in_sale_id bigint REFERENCES rental_sales(id),  -- 카드 클릭으로 가입 시 연결
  resulted_in_lead_id bigint REFERENCES incentive_customer_db(id) -- 상담사 연결 시
);
CREATE INDEX idx_bongi_conv_user ON bongi_conversations(user_id, started_at DESC);
CREATE INDEX idx_bongi_conv_guest ON bongi_conversations(guest_session_id, started_at DESC);

CREATE TABLE bongi_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES bongi_conversations(id) ON DELETE CASCADE,
  role text CHECK (role IN ('user','assistant','tool')),
  content text,                -- user 입력 또는 assistant 답변 text
  tool_calls jsonb,            -- assistant 가 호출한 tool + 결과
  product_card jsonb,          -- 답변 안 ChatProductCard payload (chip·가격·CTA)
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_bongi_msg_conv ON bongi_messages(conversation_id, created_at);
```

→ 비로그인 게스트도 localStorage `guest_session_id`로 history 보존. 로그인 시 conversation `user_id` 연결 (merge).

### 13-6. priority 재구성 (채팅 플랫폼 중심)

> 기존 P1~P5 (정적 카탈로그)는 11~12장의 form flow reuse용으로 보존. 신규 priority는 채팅 UX 중심.

- **P1 — 채팅 UI 골격** (구현 차단 요소)
  1. 와이어프레임 (사이드바 + 메인 입력 + 이벤트 배너 + 추천 chip 5개)
  2. `LeftRail` 컴포넌트 (LogoHeader·NewChatButton·ConversationSearch·CategoryNav·ConversationHistory·UserPanel)
  3. `ChatMain` 컴포넌트 (EventBanner·ChatInput·CategoryChipPicker·SuggestPromptChips)
  4. 다크모드·반응형 (모바일 사이드바 drawer)

- **P2 — AI 어시스턴트 backend**
  5. Claude API 통합 (Sonnet 4.7 + streaming + 프롬프트 캐싱 5분)
  6. tool use 8개 구현 (search_products·get_partner_cards·calculate_quote·search_telco_plans·check_carrier_lock·create_sale·request_consultant·get_event_banners)
  7. RAG 컨텍스트 어셈블 (rental_products·partner_cards·categories·룰북)
  8. system prompt + 봉이 룰북 인젝션 + 한국어 톤 조정
  9. POST /api/storefront/chat (SSE streaming) 어댑터

- **P3 — 답변 안 ChatProductCard**
  10. ChatProductCard 컴포넌트 (아정당 chip 직노출 + 가격 dual + 듀얼 CTA reuse)
  11. 약정·관리방법·관리주기 chip 동적 렌더 (`category_schema.extra_fields` 활용)
  12. 가격 dual 표시 (rental_policy V2 + 절감액 강조)
  13. 듀얼 CTA → 12장 form flow 진입 (셀프 가입 prefill: product_id·snapshot·card_snapshot)

- **P4 — 상담 history 저장 + 카카오 로그인**
  14. bongi_conversations·bongi_messages 마이그레이션
  15. 게스트 session_id (localStorage) + 로그인 시 merge
  16. ConversationHistory 사이드바 (검색·클릭으로 복원)
  17. 카카오 social login (1st) + Apple/Naver (P5)
  18. conversation 제목 자동 생성 (첫 user 메시지 → Claude로 5단어 요약)

- **P5 — 이벤트 배너·친구 초대·포인트**
  19. EventBanner 캐러셀 + storefront_events 어드민 CRUD
  20. InvitePromo (친구 초대 link + 포인트 적립)
  21. bongi_referrals + bongi_points 테이블
  22. 추천 prompt chip A/B 테스트 (시간대·카테고리별)
  23. 통신+가전 통합 cross-sell (봉이 차별점) — 채팅 한 대화 안에서 multi-카테고리 견적

### 13-7. DB 변경 종합 (12장 + 13장 통합)

기존 12장 (rental_sales 마이그레이션):
```sql
ALTER TABLE rental_sales
  ADD COLUMN customer_type text CHECK (customer_type IN ('personal','sole_proprietor','corporate','foreigner')),
  ADD COLUMN agent_phone text,
  ADD COLUMN agent_relation text;
```

신규 13장 (채팅 플랫폼):
```sql
-- 상담 history
CREATE TABLE bongi_conversations ( /* 13-5 참조 */ );
CREATE TABLE bongi_messages ( /* 13-5 참조 */ );

-- 이벤트 배너
CREATE TABLE storefront_events (
  id bigserial PRIMARY KEY,
  title text, subtitle text, image_url text,
  cta_text text, cta_url text,
  starts_at timestamptz, ends_at timestamptz,
  sort_order int, is_active boolean DEFAULT true
);

-- 게스트 → 회원 merge용
CREATE TABLE storefront_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  social_provider text, social_uid text,
  phone text, name text, email text,
  coupon_pack_granted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 친구 초대 (P5)
CREATE TABLE bongi_referrals (
  id bigserial PRIMARY KEY,
  referrer_user_id uuid REFERENCES storefront_users(id),
  invited_phone text, invited_user_id uuid,
  rewarded_at timestamptz, points int
);
```

### 13-8. 추천 디렉토리 (채팅 플랫폼)

```
client/src/pages/storefront/
  ├─ chat.html                     메인 채팅 페이지 (사이드바 + ChatMain)
  ├─ register/
  │   ├─ product-confirm.html      셀프 가입 step1 (12장 reuse)
  │   └─ customer-info.html        셀프 가입 step3 (12장 reuse)
  ├─ consult-request.html          상담사 연결 form
  ├─ mypage.html                   회원 마이페이지 (P5)
  └─ _components/
      ├─ left-rail.js              LeftRail 통합 (로고·New·검색·Nav·History·Invite·User)
      ├─ category-nav.js           카테고리 메뉴
      ├─ conversation-history.js   상담 history list
      ├─ event-banner.js           상단 캐러셀
      ├─ chat-input.js             입력창 + CategoryChipPicker + 전송
      ├─ suggest-prompt-chips.js   추천 5개 chip
      ├─ streaming-answer.js       SSE streaming AI 답변
      ├─ chat-product-card.js      답변 안 product card (chip + dual price + 듀얼 CTA)
      ├─ chat-action-bar.js        메시지 하단 (복사·재생성)
      └─ user-panel.js             로그인/프로필
  └─ _shared/
      ├─ storefront-chat-api.js    POST /api/storefront/chat (SSE)
      ├─ storefront-api.js         self-enroll · consultant-request (9장 reuse)
      ├─ storefront-auth.js        카카오 social login
      └─ guest-session.js          게스트 localStorage + merge
server/api/storefront/
  ├─ chat.js                       Claude API + tool use orchestrator
  ├─ tools/
  │   ├─ search-products.js
  │   ├─ get-partner-cards.js
  │   ├─ calculate-quote.js
  │   ├─ search-telco-plans.js
  │   ├─ check-carrier-lock.js
  │   ├─ create-sale.js
  │   ├─ request-consultant.js
  │   └─ get-event-banners.js
  └─ rag-context.js                카탈로그 어셈블 + 프롬프트 캐싱
docs/storefront/
  ├─ chat-ux.md                    채팅 플랫폼 UX spec
  ├─ ai-system-prompt.md           system prompt + 룰북 인젝션
  ├─ tool-use-spec.md              8 tool 정의 + 결과 스키마
  └─ wireframe-chat.md             와이어프레임
```

### 13-9. 메모리 hint (차기 세션)

- `feedback_crm_only.md` 룰("개발 범위는 CRM 어드민만, client/src 제외")은 **storefront까지 확대 필요**.
  - 갱신 후보 문구: "개발 범위는 CRM 어드민 + storefront (채팅 플랫폼). 제외: 고객 채팅 외 client/src 레거시"
  - `project_bongi_unified_customer.md` 의 양방향 연동 정의에 storefront 채팅도 N채널의 하나로 추가.
- 신규 메모리 후보:
  - `project_bongi_storefront_chat.md` — 채팅 플랫폼 spec·tool 8종·conversation 스키마·system prompt 골격
  - `project_bongi_chat_product_card.md` — ChatProductCard 패턴 (chip 직노출 + 듀얼 CTA + rental_policy V2 dual price)

### 13-10. 9장 backend 단일성 유지

> 13장 채팅 UI 추가에도 9장 결론 그대로:
> **"셀프 가입 = 상담사 연결 = rental_sales insert 1건"**

- ChatProductCard "셀프 가입" 클릭 → 12장 form flow (product-confirm → customer-info) → POST /api/storefront/self-enroll → rental_sales insert
- ChatProductCard "전문상담원 연결" 클릭 → consult-request form → POST /api/storefront/consultant-request → incentive_customer_db insert → round-robin TM 분배
- AI 어시스턴트가 tool use로 `create_sale` 직접 호출 가능 (사용자 모든 정보 채팅 안에서 수집 시) — but 기본은 form flow 안전 우선.

→ 봉이 backend 95% 준비 완료 결론은 채팅 플랫폼 전환 후에도 동일. 신규 작업 = 채팅 UI + Claude API 어댑터 + bongi_conversations 2테이블.
