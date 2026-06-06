# 봉이 storefront — 데이터 구축

> 어드민에서 무엇을 입력하면 storefront에서 어떻게 보여지는가.
> **표 3개**로 끝.

---

## 1) 상품 데이터 (rental_products + options)

### 운영자가 어드민에서 입력하는 것

| 컬럼 | 예시 | 입력 방식 |
|---|---|---|
| 카테고리 | 정수기 | 6 chip 중 선택 |
| 브랜드 | 코웨이 | select |
| 모델명 | CHP-7220N | 직접 입력 |
| 제품명 | 아이콘3 냉온정 정수기 | 직접 입력 |
| 이미지 | (drag·drop) | Supabase Storage 자동 업로드 |
| 약정 기간 | 84·72·60개월 | chip 다중 선택 |
| 관리 방식 | 방문 / 셀프 | chip 다중 |
| 관리 주기 | 4M / 6M / 12M | chip 다중 |
| 정상 월 요금 | 35,900원 | 숫자 |
| 최대 혜택가 | 17,900원 | 숫자 |
| **AI 자동 채움 5컬럼** | description·feature_tags·specs·size·weight·care_cycle·spec_notes | 🤖 버튼 1클릭 |

### storefront에서 어떻게 보여지나

- 카테고리 step → 카테고리 chip
- 상품 step → 카드 (이미지·brand·name·tag chip·가격)
- 약정 step → 입력된 약정 chip만 동적 노출
- 관리 step → 입력된 관리 방식·주기만 chip 노출
- 결과 panel → 정상가·최대 혜택가 표시

---

## 2) 카드 데이터 (rental_partner_cards)

### 운영자가 어드민에서 입력하는 것

| 컬럼 | 예시 | 입력 |
|---|---|---|
| 카드사 | KB국민카드 | select |
| 카드명 | KB 청춘대로 카드 | 직접 입력 |
| 렌탈사 (alias) | 코웨이 / LG전자(LG전자구독) / 청호(청호나이스) / 웰스(교원웰스) / 삼성(BS ON 포함) | select — 별칭 자동 처리 |
| 적용 카테고리 | 정수기, 공청, 비데 | chip 다중 |
| **1구간** | 전월 40만 사용 → 월 10,000원 할인 | 2 입력 |
| **2구간** | 전월 70만 → 15,000원 | 2 입력 |
| **3구간** | 전월 100만 → 20,000원 | 2 입력 |
| 활성 | on / off | toggle |

### storefront에서 어떻게 보여지나

- 계산기 Step 5 카드 chip:
  `🎴 KB 청춘대로 (1구간 ₩10,000)`
- 클릭하면 우 panel 가격 즉시 재계산:
  - 정상가 35,900원 − 카드할인 10,000원 = **예상 17,900원**
- 신청 시 `card_snapshot` 박제 (그 시점 카드 정보 + 적용 구간 보존)

---

## 3) 신청 데이터 (rental_sales + 신규 컬럼)

### storefront에서 자동 박제되는 것

| 컬럼 | 셀프 신청 | 상담원 신청 |
|---|---|---|
| customer_name | 본인 입력 | 본인 입력 (간단 form) |
| birth_date | 본인 입력 | (상담원이 통화 후 입력) |
| gender | 본인 입력 | (통화 후) |
| phone | 본인 입력 | 본인 입력 |
| email | 본인 입력 | (통화 후) |
| customer_type | 개인/사업자/법인/외국인 chip | (통화 후) |
| **product_id** | 계산기 선택 상품 | 계산기 선택 상품 |
| **snapshot** | 약정·관리·가격 박제 | 좌동 |
| **card_snapshot** | 선택 카드·구간 박제 | 좌동 |
| **source** | `storefront_self` | `storefront_consult` |
| status | `auto_pending` | `consult_pending` |
| ticket_number | 자동 R번호 부여 | (상담 후 통화 박제 시) |

### 어드민 신청서 페이지에서 처리

| 화면 | 어드민이 하는 것 |
|---|---|
| 셀프 신청 list | 정보 확인 → ✅ 확정 / ❌ 취소 |
| 상담원 신청 list | 📞 전화 → 통화 → 정보 보완 → ✅ 확정 |

---

## 4) 상품별 프로모션·특이점 (rental_products 기존 컬럼 활용 — 신규 테이블 X)

**CRM에 이미 정형 컬럼이 모두 있다.** 신규 테이블 만들 필요 없음.

### 기존 컬럼 활용

| 컬럼 | 타입 | 용도 | storefront 노출 |
|---|---|---|---|
| `promo_tags_list` | TEXT[] | tag 배열 (반값·타사보상·상품권 등) | 카드 chip · 상세 box |
| `promo_type_count` | int | 활성 프로모션 개수 | 카드에 "혜택 N종" 표시 |
| `promo_tag` | text | 단일 대표 promo (옛) | 호환용 (deprecated) |
| `otherco_supported` | bool | 타사 보상 가능 | 우 panel "타사 보상 가능" chip |
| `rebate_otherco_max` | int | 타사 보상 시 최대 환급 | "타사 보상 시 +N원" |
| `rebate_half_max` | int | 반값 시 최대 환급 | "반값 시 N원" |
| `rebate_max` | int | 기본 최대 환급 | 카드 표시 |
| `half_fee_min` | int | 반값 적용 시 최저 월 요금 | 카드 "반값 시 월 X원~" |
| `half_periods_available` | text | 반값 적용 기간 (예: "12,24") | "첫 N개월 반값" |
| `evaluation_memo` | text | 운영자 평가 메모 (비노출) | - |
| `is_premium` | bool | 프리미엄 상품 | "프리미엄" 배지 |

### 유형은 promo_tags_list 값으로 (정형화된 enum 6종)

| tag 값 | 예시 표시 | chip 색 |
|---|---|---|
| `반값할인` | 🔴 첫 12개월 반값 | 빨강 |
| `타사보상` | 🟣 타사 렌탈 보상 5만원 | 보라 |
| `상품권` | 🟡 신규 가입 5만원 상품권 | 노랑 |
| `cashback` | 🟢 12개월 후 10만원 환급 | 초록 |
| `가격인상` | ⚫ 13개월차부터 +5천원 | 회색 |
| `기타` | 🔵 자유 | 파랑 |

→ 신규 promotion 추가하려면: `promo_tags_list = ARRAY['반값할인','상품권']` + 관련 컬럼 (half_fee_min·rebate_half_max 등) 동시 update.

### 운영자 입력 (어드민 상품 등록 폼 + 엑셀 import)

**1) 어드민 폼**: 상품 등록 폼에 "프로모션 chip 다중 선택" + 관련 입력 (반값 시 half_fee_min 등).

**2) 엑셀 일괄 import** (이미 동작 중!) — `docs/incentive-products.html` `#rp-import-btn` "📤 빌리고 엑셀 import":

엑셀 열 = rental_products 컬럼 1:1 매핑. 예시 헤더:
```
brand | model | name | image_url | months_available | care_services |
monthly_fee_min | monthly_fee_max | rebate_max | rebate_otherco_max |
rebate_half_max | half_fee_min | half_periods_available |
otherco_supported | promo_tags_list | is_premium | ...
```

xlsx.full.min.js 로 parsing → UPSERT (model+brand 기준 중복 방지).

### storefront 노출

| 화면 | 노출 방식 |
|---|---|
| 상품 카드 (계산기 Step 2) | chip 1~2개 (가장 강조 promotion) |
| 상품 상세 (선택 시) | 프로모션 box — 각 promotion 카드 (제목·기간·조건) |
| 우 panel 가격 박스 | 활성 promotion 자동 반영 (반값일 경우 첫 N개월 가격·이후 가격 분리 표시) |

### 가격 계산에 자동 반영

- 첫 12개월: 기본 가격 × (1 − half_price_value)
- 13개월부터: 기본 가격 + price_increase_value
- 상품권·cashback은 별도 표시 (월 요금에는 미반영, "추가 혜택" box로)
- 타사 보상은 신청 form 단계에서 별도 인증

### 신청 시 박제 (rental_sales.snapshot)

```
snapshot: {
  product_id, brand, model, name,
  contract_months: 60,
  care_type, care_cycle,
  base_price: 35900,
  active_promotions: [
    { type: 'half_price', value: 50, duration_months: 12, title: '첫 12개월 반값' },
    { type: 'gift_card',  value: 50000, title: '5만원 상품권 증정' }
  ]
}
```

→ 신청 시점 프로모션 그대로 박제. 운영자가 나중에 프로모션 변경해도 이 신청건은 약속된 혜택 유지.

---

## 한 줄 요약

- **상품·카드·프로모션**: 어드민에서 1번 등록 → storefront 즉시 노출 (캐시 자동 invalidate)
- **신청**: 고객 계산기 → 셀프/상담원 2분기 → `rental_sales` 1건 박제 (snapshot + card_snapshot + active_promotions)
- **특이점 적재의 핵심**: 자유 텍스트 X · **promo_tags_list 6 enum + 기존 정형 컬럼** (rebate_half_max·half_fee_min·otherco_supported 등) 활용 — 신규 테이블 만들 필요 X
- **엑셀 import**: 이미 동작 중 (`📤 빌리고 엑셀 import`) — 한 번에 수십~수백 상품 등록 가능

> 더 복잡한 데이터(이벤트·포인트·회원·사기방지·dashboard)는 추후. 지금은 4개만.
