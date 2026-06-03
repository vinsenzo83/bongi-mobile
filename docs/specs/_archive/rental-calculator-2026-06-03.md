# 봉이 렌탈 계산기 spec — 아정당 패턴 채택

> 작성일: 2026-06-03
> 범위: storefront 렌탈상품 채팅 + 계산기 듀얼 진입
> 전제: 기존 `flow-rental.html` 경로 A(AI 채팅) 보강 + 계산기 신규 entry
> 방향 결정: **렌트리 → 아정당** + **계산기 형태가 직관적**

---

## 0. 결론

**봉이 storefront 렌탈 진입은 듀얼 entry**:

1. **자유 채팅** (Allio AI) — "정수기 추천해줘" 자유 텍스트 → AI 어시스턴트가 ChatProductCard 렌더
2. **렌탈 계산기** (아정당 패턴) — chip step wizard로 정형 입력 → 실시간 결과 카드

두 entry는 동일 backend(rental_products·partner_cards·rental_policy V2)를 사용하고, 동일 CTA(셀프 가입 / 전문상담원 연결)로 수렴. 결국 `rental_sales` 1건 박제.

계산기는 **자유 채팅이 부담스러운 고객**과 **정확한 조건 비교가 필요한 고객**을 위한 직관적 path.

---

## 1. 듀얼 entry 비교

| 항목 | 자유 채팅 | 렌탈 계산기 |
|---|---|---|
| 입력 | 자유 텍스트 | chip 선택 wizard |
| 결과 | streaming text + ChatProductCard | 우 panel 실시간 카드 |
| 데이터 소스 | RAG over rental_products | 직접 SQL filter |
| AI 호출 | Claude API tool use | X (client 계산) |
| 직관성 | 자연어 친화 | 비교 친화 |
| 적합 고객 | 추천 의존·잘 모르는 사람 | 명확한 조건 비교 |
| 사이드바 entry | 홈 채팅·"가전렌탈 추천해줘" chip | "📺 가전 렌탈" 카테고리 클릭 |

---

## 2. 계산기 UI 구조 (3분할 — 휴대폰 요금 계산기 동일 패턴)

```
┌─────────────┬─────────────────────────────┬──────────────────┐
│ 좌 사이드바 │ 중앙 step wizard            │ 우 상세 panel    │
│ (240px)     │                              │ (320px)         │
├─────────────┼─────────────────────────────┼──────────────────┤
│ ... nav ... │  ⓘ 가전 렌탈 계산기        │ 매장 / 온라인   │
│             │                              │  toggle         │
│             │  [Step 1] 카테고리 선택     │                  │
│             │  ☐정수기 ☐공청 ☐비데        │ 📍 봉이 익산점  │
│             │  ☐매트리스 ☐에어컨 ☐TV     │   변경 ▼         │
│             │                              │                  │
│             │  [Step 2] 약정 기간         │ 선택 상품:       │
│             │  [84M][72M][60M][48M][36M]  │  코웨이 아이콘3  │
│             │  (products별 동적)          │  냉온정 정수기   │
│             │                              │                  │
│             │  [Step 3] 관리 방식         │ 약정: 60개월    │
│             │  [방문관리][셀프관리]       │ 관리: 셀프 4M   │
│             │                              │ 카드: KB 40만    │
│             │  [Step 4] 관리 주기         │                  │
│             │  [4개월][6개월][12개월]     │ ──── 가격 ────  │
│             │                              │ 정상가  35,900원 │
│             │  [Step 5] 제휴카드 (옵션)   │ 카드후  17,900원 │
│             │  ☐ KB·40만 (1구간 10,000)   │ ────────────────│
│             │  ☐ 삼성·30만 (1구간 8,500)  │ 예상 월요금     │
│             │  ☐ 카드 없음                 │  ✨ 17,900원~   │
│             │                              │                  │
│             │  [▶ 계산하기]               │ [매장 방문 신청] │
│             │                              │  또는            │
│             │                              │ [온라인 셀프 가입]│
└─────────────┴─────────────────────────────┴──────────────────┘
```

---

## 3. step별 spec

### 3-1. Step 1 — 카테고리 선택

- chip 6개 (활성 카테고리만 — 정수기·공청·비데·매트리스·에어컨·TV)
- 이미지 아이콘 + 카테고리명 + 보유 상품 수 (예: "정수기 111")
- 다중 선택 X (1개만)
- 클릭 → Step 2로 진행 + 우 panel "상품 선택" 모드 활성

### 3-2. Step 1.5 — 상품 선택 (Step 1 직후)

- 카테고리 내 product list (이미지 카드)
- BEST·NEW 배지 + 자연어 chip (오늘 AI auto-fill 활용)
- 필터: brand·가격대·기능
- 정렬: 인기순·가격순·최신순
- 클릭 → 선택 + 우 panel "선택 상품" 영역 반영

### 3-3. Step 2 — 약정 기간

- products별 `months_available` array 동적 chip
- 정수기 예: 84/72/60/48/36
- TV 예: 60/48/36
- 매트리스 예: 60/48 (모션베드 60·72)
- chip 클릭 → 우 panel 예상 가격 즉시 재계산

### 3-4. Step 3 — 관리 방식

- chip 2개 — 방문관리 / 셀프관리
- products `care_services` array 기반 가용성 표시 (없으면 disabled)
- 카테고리별 차이:
  - 정수기·비데: 방문 / 셀프 모두 가능
  - 매트리스: 셀프관리만 (탑퍼 교체)
  - TV·에어컨: 셀프관리 + 점검 12M

### 3-5. Step 4 — 관리 주기

- `care_cycle` 활용 (오늘 추가)
- 정수기: 4M / 6M / 12M
- 공청: 6M / 12M
- 매트리스: 12M
- TV·에어컨: AS 12M (read-only)

### 3-6. Step 5 — 제휴카드 선택 (옵션)

- `rental_partner_cards` 카테고리 매칭 + brand·company alias 적용
- chip: 카드명 + 전월실적 + 1·2·3 구간 (수동 선택 가능)
- 카드 미적용 chip ("카드 없음") 포함
- 클릭 → 우 panel 카드 후 가격 표시 + card_snapshot 박제 준비

### 3-7. 결과 panel (우측 — 실시간)

상단:
- 매장 방문 / 온라인 신청 toggle
- 매장 select: `incentive_centers` 8 매장 (봉이모바일 익산점 default · 변경 가능)

중앙 선택 요약:
- 선택 상품·약정·관리·카드 chip 한 줄씩

가격 표시:
- 정상가 (정상 월요금)
- 카드 후 (카드 적용 시)
- **예상 월요금** (큰 글씨 — 매장 vs 온라인 분기 가격)

CTA:
- **매장 방문 신청** (매장 방문 모드) → POST /api/storefront/store-visit-request → store_offline source rental_sales 가예약
- **온라인 셀프 가입** (온라인 모드) → /storefront/register/product-confirm step 진입 (기존 spec 12장 그대로)
- **전문상담원 연결** (모드 무관 상시 노출 secondary CTA) → consult-request form

---

## 4. 계산기 ↔ DB 매핑

| step | DB 조회 | client 계산 |
|---|---|---|
| Step 1 카테고리 | `rental_categories WHERE active=true` | - |
| Step 1.5 상품 | `rental_products WHERE category_id=?` + 정렬·필터 | - |
| Step 2 약정 | `rental_product_options.months_available distinct` | - |
| Step 3 관리방식 | `rental_products.care_services` | - |
| Step 4 관리주기 | `rental_products.care_cycle` | - |
| Step 5 카드 | `rental_partner_cards WHERE active=true AND ? = ANY(categories)` + brand·company alias filter | - |
| 우 panel 매장 | `incentive_centers` | - |
| 가격 계산 | `rental_policy V2` (P·tier·payback) | margin = rebate×0.9 − payback − P×weight |
| 카드 후 가격 | partner_card tier1/2/3 base·total | 월요금 − card_discount |

---

## 5. 계산기에서 채팅으로 escape hatch

계산기 중간에 "추가 추천 받기" 버튼 → 현재 선택 상태를 자유 채팅으로 전달:
```
사용자가 채팅창에 자동으로:
"정수기, 60개월 약정, 방문관리 4개월 주기로 비슷한 상품 더 추천해줘"
→ AI가 RAG로 유사 product 3~5개 제시
```

채팅 ↔ 계산기 양방향 — 한 쪽에서 시작해도 다른 쪽 진입 가능.

---

## 6. 어드민 보강 (계산기 도입 따른)

- **계산기 사용 통계 dashboard**: step별 dropoff·평균 step·완료율
- **카테고리별 인기 약정** stats (Step 2 선택 분포)
- **카드 선택 분포** stats (어떤 카드가 자주 선택되나)
- **매장 방문 신청 처리 큐** — 신규 메뉴 (store-visit-queue):
  - source=store_offline + status=pending인 rental_sales 처리 대기 list
  - 매장 영업담당자에게 SMS·푸시 자동
  - 도착·계약·이탈 status 트래킹

---

## 7. priority

| Phase | 작업 | 의존 |
|---|---|---|
| **C1** | 카테고리 chip + Step 1.5 상품 list 컴포넌트 | rental_products 조회 |
| **C2** | Step 2·3·4 chip wizard + 동적 조건 | products schema |
| **C3** | Step 5 카드 chip + 1·2·3 구간 수동 선택 | partner_cards alias |
| **C4** | 우 panel 실시간 가격 계산 (rental_policy V2 client 적용) | policy 룰 client port |
| **C5** | 매장 select + 매장 방문 / 온라인 toggle | incentive_centers |
| **C6** | "매장 방문 신청" backend (store_offline source insert) | rental_sales source |
| **C7** | "온라인 셀프 가입" 기존 form 연결 | storefront-plan 12장 |
| **C8** | "추천 더 받기" 채팅 escape hatch | chat input prefill |
| **C9** | 계산기 사용 통계 어드민 dashboard | tracking events |
| **C10** | 매장 방문 신청 처리 큐 어드민 | 신규 어드민 메뉴 |

---

## 8. 기존 `flow-rental.html` 보강 항목

기존 기획서(렌트리 참고 시점)에서 **삭제 또는 deprecated**:
- ❌ STEP 2 "렌트리 URL 자동 파싱" — 우리는 이미 435 product + AI 8컬럼 보유. 자동 파싱 불필요. 운영자가 어드민 상품관리에서 직접 입력 (오늘 AI 자동 채움 UI로 빠름).
- ❌ "렌트리 리뷰·평점·주문건수" — 봉이 자체 후기·이벤트로 대체
- ❌ "상품 1:1 매핑 (R001~R051 51개)" — 실제 라이브 R 5,444건 (옵션 단위). 1:1이 아니라 상품 1개 = 옵션 N개 = R번호 N개.

기존 기획서에서 **유지·확장**:
- ✅ STEP 0 경로 A(AI 채팅) · B(직접 전화) · C(휴대폰 크로스셀) — 그대로 유효
- ✅ STEP 4 데이터 파생 경로 (어드민 → DB → 카탈로그·상세·AI 채팅·CRM·티켓·페이백) — 그대로
- ✅ 상품 비활성 시 티켓 자동 비활성·삭제 불가 룰 — 그대로

기존에 **추가**:
- 🆕 경로 D — **계산기 직접 진입** (사이드바 가전 렌탈 클릭 → 계산기 step wizard)
- 🆕 매장 방문 신청 path (경로 A·D에서 발생 — store_offline source rental_sales)

---

## 9. 차기 세션 entry point

1. **시작**: 본 spec + `crm-storefront-rental-mapping-2026-06-03.md` + `admin-restructure-for-storefront-2026-06-03.md` 3종 통합 review
2. **즉시 작업**: C1 카테고리 chip + Step 1.5 상품 list (storefront UI 첫 PR)
3. **검증 시점**: C7 완료 시 정수기 1 카테고리 end-to-end 계산기 데모 가능 → 다른 5 카테고리 즉시 확장

---

## 10. 핵심 차별점 한 줄

> **봉이는 채팅으로 추천받고 싶은 고객 + 계산기로 비교하고 싶은 고객 둘 다 잡는다. 매장 영업까지 직결되어 8개 직영 매장 매출도 함께 키운다.**
