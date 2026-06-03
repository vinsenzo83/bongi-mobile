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

## 한 줄 요약

- **상품·카드**: 운영자가 어드민에서 1번 등록 → storefront 즉시 노출 (캐시 자동 invalidate)
- **신청**: 고객이 계산기에서 선택 → 셀프/상담원 2 분기 → `rental_sales` 1건 박제 → 어드민에서 처리

> 더 복잡한 데이터(이벤트·포인트·회원·사기방지·dashboard 등)는 추후. 지금은 이 3개만.
