# 가전렌탈 옵션 컬럼 정책 (2026-06-03 확정)

**적용 대상**: `rental_product_options` 테이블 · 상품관리·티켓관리·TM 견적·계약 처리 UI

**원칙**: 정수기 그룹 / 가전 그룹 / 매트리스(정수기 그룹 하위)는 **수수료 구조와 영업 룰이 달라** 옵션 컬럼 의미와 사용 정책이 다르다. UI는 그룹별로 표시 컬럼을 분기한다.

---

## 1. 그룹 구분

| 그룹 | 카테고리 | commission_method | 채널 구조 |
|---|---|---|---|
| **정수기 그룹** | 정수기·공기청정기·비데·얼음정수기·냉온정수기·연수기 | `direct` (옵션 rebate 직접) | 1 모델 1 회사 (1:1) |
| **매트리스** (정수기 그룹 하위) | 매트리스 | `direct` | 1 모델 1 회사 (1:1) |
| **가전 그룹** | 에어컨·냉장고·TV·세탁기 | `rate` (수수료율 × 단가) | 1 모델 N 렌탈사 (1:N) |

---

## 2. 옵션 컬럼 사용 정책 (그룹별)

### 2.1 모든 그룹 공통 (필수)

| 컬럼 | 의미 |
|---|---|
| `months` | 약정 기간 (개월) |
| `care_service` | 케어 방식 (`방문`/`셀프`) |
| `monthly_fee` | 월납 (할인 적용 후) |
| `rebate` | 상담사 리베이트 |
| `payback` | 페이백 |
| `variant_code` / `variant_label` | 옵션 변별자 (사이즈·색상·관리등급 등) |
| `promo_type` | 프로모션 유형 (`반값할인`·`신규결합`·`타사보상` 등) |
| `commission_method` | `direct` (정수기·매트리스) / `rate` (가전) |
| `is_active` | 활성/비활성 |
| `ticket_number` / `ticket_active` | R번호 (trigger 자동) |
| `margin` / `tier_calculated` / `point_weight` | 인센티브 자동 계산 (RPC) |

### 2.2 정수기 그룹 전용 (필수·선택)

| 컬럼 | 사용 | 의미 |
|---|---|---|
| `inspection_cycle` | 필수 | 점검 주기 (2/4/6 개월) |
| `ownership_months` | 필수 | 소유권 이전 시기 (보통 약정 종료) |
| `normal_price` | 필수 | 정상 월납 (할인 전) |
| `monthly_diff` | 필수 | 정상가 − 월납 (= 할인액, 음수) |
| `half_fee` | 선택 | 반값 행사 월납 |
| `half_period` | 선택 | 반값 적용 개월 |
| `rebate_otherco` | 선택 | 타사보상 시 리베이트 |
| `rebate_half` | 선택 | 반값 행사 시 리베이트 |
| `bundle_rate` | 선택 | 결합 비율 (100 = 풀결합) |

### 2.3 매트리스 (정수기 그룹 하위, 일부 제외)

| 컬럼 | 사용 | 비고 |
|---|---|---|
| `inspection_cycle` | 🚫 N/A | 매트리스는 점검 없음 |
| `ownership_months` | 🚫 N/A | 약정 종료 = 소유 (default) |
| `normal_price` | 🚫 N/A | 월납이 정가 |
| `monthly_diff` | 🚫 N/A | 정가 비교 없음 |
| `half_fee` / `half_period` | 🚫 N/A | 반값 행사 없음 |
| `rebate_otherco` / `rebate_half` | 🚫 N/A | |
| `bundle_rate` | 🚫 N/A | |
| `variant_label` | ✅ 필수 | 사이즈 (싱글/슈퍼싱글/퀸/킹/라지킹) |
| `promo_type` | ✅ 필수 | 결합/타사보상 텍스트 |

**products.specifications JSONB**에 매트리스 전용 spec 저장:
- `sub_category`: 매트리스/모션베드/힐링베드
- `size`: S/SS/Q/K/LK
- `firmness`: 소프트/미디엄/하드 등
- `promotion`: 프로모션 메모

### 2.4 가전 그룹 전용 (신규 컬럼)

가전 그룹은 정수기와 영업 룰이 달라 **별도 컬럼**이 필요하다. `rental_product_options`에 신규 추가:

| 컬럼 | 의미 | 엑셀 원천 |
|---|---|---|
| `as_period_months` | A/S 보증 기간 (개월) | "A/S기간" |
| `signup_age_limit` | 가입 가능 연령 (만 N세 이상) | "가입가능연령" |
| `installation_fee` | 기본 설치비 (원) | "기본설치비" |
| `commission_rate` | 옵션별 수수료율 (%) | "수수료율(%)" |
| `commission_basis` | 수수료 기준 (`구독료`/`월렌탈료`/`총렌탈료`) | "수수료 기준" |
| `total_rental_fee` | 총렌탈료 (= months × monthly_fee) | "총렌탈료" 또는 자동 계산 |

가전 그룹에서 **사용 안 하는 정수기 컬럼**:

| 컬럼 | 사용 | 비고 |
|---|---|---|
| `inspection_cycle` | 🚫 | 가전 무점검 |
| `ownership_months` | 🟡 선택 | 제로렌탈 1M 이전만 |
| `monthly_diff` | 🚫 | 정상가 = 출고가 (월비교 무의미) |
| `half_fee` / `half_period` / `rebate_half` | 🚫 | 반값 행사 없음 |
| `rebate_otherco` | 🚫 | |
| `bundle_rate` | 🚫 | 가격에 이미 반영 |

`normal_price`는 **출고가(일시불)** 의미로 사용.

---

## 3. UI 옵션 표 컬럼 표시 정책

상품관리 · 티켓관리 · TM 견적 옵션 행에서 **그룹별로 컬럼 표시 분기**.

### 3.1 정수기 그룹 표시 컬럼

```
R번호 · 변별 · 약정 · 케어 · 점검M · 소유M · 정상가 · 월납 · 증감
       · 반값/M · 리베 · 타사보상 · 반값리베 · 결합% · 페이백 · P · 마진 · Tier
```

### 3.2 매트리스 표시 컬럼

```
R번호 · 변별(사이즈) · 약정 · 케어 · 월납 · 리베 · 프로모 · 페이백 · P · 마진 · Tier
```

(점검·소유·증감·반값·타사보상·결합% 컬럼 **숨김**)

### 3.3 가전 그룹 표시 컬럼

```
R번호 · 변별(코드/등급/관리주기) · 약정 · 케어
     · A/S기간 · 가입연령 · 설치비
     · 정상가(출고가) · 월렌탈료 · 총렌탈료
     · 리베 · 수수료율 · 수수료기준 · 페이백 · P · 마진 · Tier
```

(점검·소유·증감·반값·타사보상·결합% 컬럼 **숨김**, 신규 6컬럼 노출)

---

## 4. 클라이언트 코드 분기 지점

| 파일 | 변경 위치 |
|---|---|
| `docs/incentive-products.html` | 옵션 디테일 모달 렌더 (line ~1370~) — `product.category.product_group` 기준 분기 |
| `docs/incentive-tickets.html` | 가전 탭 옵션 chip 표시 — 그룹별 chip 다름 |
| `server/services/rental-register-parser.js` | 가전 그룹 엑셀 → 신규 6컬럼 매핑 추가 |

---

## 5. import·backfill 우선순위

| 단계 | 작업 | 영향 |
|---|---|---|
| 1 | 매트리스 옵션 `promo_type` backfill (엑셀 → DB) | UI 프로모 chip 노출 |
| 2 | 매트리스 products `product_url` forward-fill (24 → 86) | 이미지 fetch 가능 |
| 3 | 가전 그룹 옵션 신규 6컬럼 `ALTER` (라이브·데브) | 스키마 확장 |
| 4 | TV·에어컨 엑셀 → 신규 6컬럼 backfill | 데이터 정합 |
| 5 | 클라이언트 UI 그룹별 컬럼 표시 분기 | 사용자 직관 |

---

## 6. 검증 후 정책

- 신규 6컬럼 추가 후 파서 (`rental-register-parser.js`) 갱신 — 다음 import부터 자동 적재
- 매뉴얼 (`docs/incentive-manual.html`) products 섹션에 그룹별 컬럼 표 추가
- `MANUAL_SYNC_RULE.md` 준수: 컬럼 변경 시 매뉴얼 동시 갱신

---

## 관련 파일

- `/docs/specs/rental-register-form.md` — 엑셀 양식 정의
- `/docs/specs/NO_HARDCODE_RULE.md` — 정책값 하드코딩 금지
- `/docs/incentive-manual.html` — 상품 관리 섹션 (line ~714)
- `/server/services/rental-register-parser.js` — 파서 헤더 매핑
- `/server/routes/rental.js` — 옵션 endpoint
- 메모리: `project_bongi_rental_policy_unified.md`, `project_bongi_carrier_mapping.md`
