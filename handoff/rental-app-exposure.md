# 렌탈 앱 노출 규격 (봉이 앱·홈페이지 개발자용)

2026-09-17 대표 결정: **모요처럼 깔끔하게, 금액은 숨긴다(아정당식)**. 상담 전환이 목적이라 앱에는 상품별 현금 금액을 내보내지 않는다.

## 데이터 원천 — CRM(bongi-mobile) 공개 API, 로그인 없음
| API | 용도 |
|---|---|
| `GET https://admin.prexymarket.com/api/rental-catalog/public/models?category=water-purifier&page=1` | 상품 카드 목록 (40개씩) · `linked=true` 면 플랫폼 연동 상품만 |
| `GET https://admin.prexymarket.com/api/rental-catalog/public/trust` | 신뢰 지표 (지급 현황) |

분당 IP당 120회 제한, 5분 캐시. 금액 필드(가이드·MAX·리베이트·지원금)는 API 자체에 없다.

### `/public/models` 응답 (모델 1개)
```json
{
  "id": "…", "supplier": "쿠쿠", "brand": "쿠쿠", "name": "쿠쿠 제로 100 슬림 얼음 정수기", "model_code": "CP-AHS101HEW",
  "category": "water-purifier", "category_label": "정수기", "image_url": "https://…",
  "monthly_fee_from": 36500,          // 판매중 조건 중 최저 월 렌탈료
  "card_monthly_fee_from": 21500,     // 제휴카드 최대 할인 적용 시 최저 월 요금 (카드 없으면 null)
  "card_name": "쿠쿠 신한카드",
  "free_months_up_to": 9,             // 최대 N개월 무료 (가이드 기준)
  "cash_benefit": true
}
```

## 화면 규칙
**상품 카드 (목록)** — 숫자는 2개만
- `월 {monthly_fee_from}원부터`
- `최대 {free_months_up_to}개월 무료` (cash_benefit=false 면 줄 자체를 숨김)
- 이미지 · 브랜드 · 상품명

**상품 상세**
- 카드 할인가: `{card_name} 이용 시 월 {card_monthly_fee_from}원부터` + "전월실적 조건 있음"
- CTA: `상담 받고 혜택 확정하기` → 상담 신청
- 약정·관리방식·반값 구간 등 조건은 상담 신청 폼 또는 CRM 견적서로 안내

**신뢰 지표 (목록 상단 한 줄)** — `show=true` 일 때만
- `이번 달 {paid_this_month}건 현금혜택 지급완료 · 평균 {avg_days_to_pay}일` (avg 가 null 이면 뒷부분 생략)
- 최근 지급 롤링: `{name} · {product} · {paid_date} 지급완료` (이름은 이미 마스킹됨)
- 이번 달 지급 10건 미만이면 `show=false` — 적은 숫자는 신뢰를 깎으니 영역 자체를 숨긴다

## 금지
- 원 단위 현금 금액("지원금 30만원", "사은품 40만원") 상품별 표기 금지 — 개월 수로만
- MAX·가이드 금액·리베이트 표기 금지
- "타사보다 적으면 맞춰드립니다" 같은 보장 문구는 대표 결정 전까지 넣지 않는다

## 값이 바뀌는 주기
가이드·MAX 는 AI 엔진이 **매주 월요일 06:00(KST)** 와 **빌리고 월 엑셀 반영 직후** 다시 계산한다.
작은 변동(가이드 1만원 미만)은 적용하지 않아 `free_months_up_to` 가 자주 흔들리지 않는다. 앱 캐시는 1시간 이하로 두면 충분하다.

## bong2-back `rental_product` 매핑 (연동 시)
| rental_product | 공개 API |
|---|---|
| name / brand / model_name / category | name / brand / model_code / category_label |
| monthly_fee | monthly_fee_from |
| discounted_fee · card_name · card_discount_amount | card_monthly_fee_from · card_name · (monthly_fee_from − card_monthly_fee_from) |
| gift_type | cash_benefit ? '현금지급' : null |
| gift_amount · benefit_amount | **채우지 않음** (금액 비노출) — 대신 `free_months_up_to` 를 '최대 N개월 무료' 문자열로 |
| image_url1 | image_url |
