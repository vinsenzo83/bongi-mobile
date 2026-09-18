# 렌탈 앱 연동 가이드 (봉이 앱·홈페이지 개발자용)

봉이 앱·홈페이지에 렌탈 상품을 노출하기 위한 규격이다. 상품 데이터는 CRM(`admin.prexymarket.com`)의 공개 API에서 받고,
**상품별 현금 혜택 금액은 앱에 표시하지 않는다.** 기준일 2026-09-18.

---

## 1. 무엇을 보여주고 무엇을 숨기나

상담 전화로 계약이 이뤄지는 구조라 앱은 **비교와 상담 신청**까지만 맡는다. 현금 지원금은 상담에서 안내한다.

| 구분 | 앱 노출 | 이유 |
|---|---|---|
| 월 렌탈료 · 할인 뒤 요금 | O | 렌탈사 공식 요금 |
| 제휴카드 적용 최저 월 요금 | O | 카드사 부담이라 우리 마진과 무관 |
| 최대 N개월 무료 | O | 혜택 크기를 금액 없이 전달 |
| 현금 지원금 금액(가이드) | **X** | 상담 통화에서만 안내 |
| MAX(최대 지급 가능액) | **X** | 상담사 전용, 사내에서도 비공개 |
| 리베이트·마진 | **X** | API 응답에 아예 없음 |

---

## 2. API

베이스 URL `https://admin.prexymarket.com` · 인증 없음 · IP당 분당 120회 · 서버 5분 캐시.

### GET `/api/rental-catalog/public/models`

| 파라미터 | 값 | 설명 |
|---|---|---|
| `category` | 카테고리 slug | 생략하면 전체 |
| `page` | 1~500 | 40개씩 |
| `linked` | `true` | 플랫폼 연동으로 지정한 상품만 |

```jsonc
GET /api/rental-catalog/public/models?category=water-purifier&page=1

{
  "models": [
    {
      "id": "1dd62112-4744-4085-9bd3-38fea6378e7a",
      "supplier": "코웨이",
      "brand": "코웨이",
      "name": "아이콘3.0",
      "model_code": "CP-7220N",
      "category": "water-purifier",
      "category_label": "정수기",
      "image_url": "https://…/product-images/rental/343.png",
      "monthly_fee_from": 13450,      // 첫 달 최저 월 요금
      "regular_fee": 26900,           // 할인 끝난 뒤 요금 (할인 없으면 null)
      "discount_months": 18,          // 할인 요금 적용 개월 (없으면 null)
      "card_monthly_fee_from": 0,     // 제휴카드 최대 할인 적용 시 (카드 없으면 null)
      "card_name": "코웨이 신한카드",
      "free_months_up_to": 13,        // 최대 N개월 무료
      "cash_benefit": true
    }
  ],
  "page": 1,
  "total": 322,
  "note": "금액(가이드·MAX·지원금)은 공개하지 않습니다. 혜택은 최대 N개월 무료로만 표기하세요."
}
```

요금·무료개월은 **일반 판매 조건**만으로 계산한다. 결합(멤버십)·선납·현장·임직원·일시불·타사보상 조건은 빠진다.
무료개월은 할인이 끝난 뒤 정상 요금 기준이다.

### GET `/api/rental-catalog/public/trust`

```jsonc
{ "show": false, "month": "2026-09", "paid_this_month": 0, "paid_total": 1,
  "avg_days_to_pay": null, "recent": [] }

// show:true 일 때
{ "show": true, "month": "2026-09", "paid_this_month": 42, "paid_total": 310,
  "avg_days_to_pay": 6,
  "recent": [ { "name": "김*수", "product": "아이콘3.0", "paid_date": "2026-09-15" } ] }
```

`show=false`면 영역 전체를 숨긴다(이번 달 지급 10건 미만). 이름은 서버에서 이미 마스킹된다. 금액·연락처는 응답에 없다.

### 카테고리 slug

`fridge` 냉장고·냉동고 · `water-purifier` 정수기 · `air-purifier` 공기청정기 · `bidet` 비데 · `softener` 연수기·샤워 ·
`dehumidifier` 제습기 · `humidifier` 가습기 · `aircon` 에어컨·냉난방기 · `fan` 선풍기·서큘레이터 · `kimchi-fridge` 김치냉장고 ·
`washer` 세탁기·건조기 · `clothes-care` 의류관리기 · `tv` TV·모니터 · `cleaner` 청소기 · `dishwasher` 식기세척기 ·
`food-waste` 음식물처리기 · `kitchen` 주방가전 · `furniture` 매트리스·침대·가구 · `massage` 안마의자·헬스케어 ·
`it` PC·IT·카메라 · `mobility` 전기자전거·스쿠터 · `business` 업소용·제빙기 · `facility` 보일러·환기·설비 ·
`pest` 해충방제·위생 · `pet` 반려동물

---

## 3. 화면 규칙

### 상품 카드 — 숫자는 두 개만

```
┌──────────────────────────┐
│        [ image_url ]     │
│ 코웨이 아이콘3.0          │
│ 월 13,450원부터           │   ← monthly_fee_from
│ 18개월 후 26,900원        │   ← discount_months / regular_fee (작은 글씨)
│ [ 최대 13개월 무료 ]      │   ← free_months_up_to (배지)
└──────────────────────────┘
```

- `cash_benefit=false`면 "최대 N개월 무료" 줄을 아예 숨긴다.
- `regular_fee`가 `null`이면 둘째 줄을 숨긴다.
- 카드 할인가는 목록에 넣지 않는다. 숫자가 많아지면 지저분해진다.

### 상품 상세

- 카드 할인: `{card_name} 이용 시 월 {card_monthly_fee_from}원부터` + "전월실적 조건이 있습니다".
- CTA: **상담 받고 혜택 확정하기** → 상담 신청 폼. 약정·관리방식·설치일은 상담에서 정한다.
- 계약은 앱에서 만들지 않는다. 상담사가 CRM에서 접수·계약처리한다.

### 신뢰 영역 (목록 상단 한 줄)

- `이번 달 {paid_this_month}건 현금혜택 지급완료 · 평균 {avg_days_to_pay}일`
- 최근 지급 롤링: `{name} · {product} · {paid_date} 지급완료`

---

## 4. 금지 사항

- 상품별 현금 금액 표기 금지 — "지원금 30만원", "사은품 40만원" 모두 안 된다. 개월 수로만 표현한다.
- 가이드·MAX·리베이트 표기 금지.
- "타사보다 적으면 맞춰드립니다" 같은 보장 문구는 대표 확정 전까지 넣지 않는다.
- 응답에 없는 값을 앱에서 만들어내지 않는다(월 요금 × 개월로 혜택 금액을 역산하는 것도 금지).

---

## 5. bong2-back `rental_product` 매핑

| rental_product 컬럼 | 공개 API |
|---|---|
| name / brand / model_name / category | name / brand / model_code / category_label |
| monthly_fee | monthly_fee_from |
| original_monthly_fee | regular_fee |
| discounted_fee · card_name · card_discount_amount | card_monthly_fee_from · card_name · (monthly_fee_from − card_monthly_fee_from) |
| promotion_period | discount_months (예: "18개월") |
| gift_type | cash_benefit ? "현금지급" : null |
| gift_amount · benefit_amount | **채우지 않음** (금액 비노출) |
| image_url1 | image_url |
| status | API에 실리면 판매중 |

CRM 모델 `id`(uuid)를 `rental_product`에 함께 저장해 두면 다음 동기화에서 매칭이 쉽다.

---

## 6. 값이 바뀌는 주기

- 가이드·MAX는 CRM의 AI 엔진이 **매주 월요일 06:00(KST)** 와 **렌탈사 월 엑셀 반영 직후** 다시 계산한다. 그래서 `free_months_up_to`가 바뀔 수 있다.
- 가이드 변동이 1만원 미만이면 적용하지 않으므로 값이 자주 흔들리지는 않는다.
- 월 요금은 렌탈사 월 엑셀 반영 시점에 바뀐다.
- 앱 캐시는 1시간 이하를 권장한다.

---

## 7. 예시 코드

```js
const BASE = 'https://admin.prexymarket.com';

export async function fetchRentalModels(category, page = 1) {
  const url = `${BASE}/api/rental-catalog/public/models?page=${page}` +
    (category ? `&category=${encodeURIComponent(category)}` : '');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`rental models ${res.status}`);   // 429 = 분당 한도
  return res.json();
}

export function priceLines(m) {
  const lines = [`월 ${m.monthly_fee_from.toLocaleString()}원부터`];
  if (m.regular_fee) lines.push(`${m.discount_months}개월 후 ${m.regular_fee.toLocaleString()}원`);
  return lines;                       // 금액 혜택은 넣지 않는다
}

export function benefitBadge(m) {
  return m.cash_benefit && m.free_months_up_to > 0
    ? `최대 ${m.free_months_up_to}개월 무료` : null;
}
```

---

## 8. 붙이기 전 체크리스트

- [ ] 목록·상세·검색 결과 어디에도 원 단위 현금 금액이 없다
- [ ] `cash_benefit=false`, `regular_fee=null`, `card_monthly_fee_from=null`일 때 빈 줄이 남지 않는다
- [ ] 429(한도)·5xx일 때 이전 캐시를 보여준다
- [ ] `show=false`면 신뢰 영역이 통째로 사라진다
- [ ] 이미지가 없는 상품(일부 남아 있음)에서 레이아웃이 깨지지 않는다

---

## 9. CRM 쪽 구현 위치 (참고)

| 기능 | 파일 |
|---|---|
| 공개 API 두 개 | `server/routes/rental-catalog.js` (`/public/models`, `/public/trust`) |
| 가이드·MAX 엔진 | `server/services/rental-margin-engine.js`, `server/services/rental-payout-runner.js` |
| 자동 갱신 스케줄 | `server/index.js` (매주 월 06:00 KST cron) |
| 상담 계산기 | `docs/tm-rental.js` |

CRM 변경이 필요하면 렌탈 카탈로그 담당에게 요청한다.
