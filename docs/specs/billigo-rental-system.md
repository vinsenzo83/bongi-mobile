# 빌리고 기반 가전렌탈 시스템 재구축 — PRD

> 작성일 2026-05-20 · 작성 Claude (product-planning) · 상태 **초안 (검토 대기)**

---

## 0. 한 줄 요약

봉이는 **빌리고(렌탈 상품 중개 플랫폼)의 영업 파트너**다. 빌리고가 매월 발송하는 엑셀 2종(정수기·가전)을 상품·수수료 마스터로 받는다.

**기존 봉이 `rental_*` 구조 자체가 빌리고 정수기 엑셀을 가공해 만든 것**임이 확인되었다 (§4.0). 따라서 이 프로젝트는 *전면 재설계가 아니라*, ① 기존 `rental_*` 구조를 유지·보강하고 ② 빌리고 엑셀(3차→4차→…)을 정기적으로 import하는 **파이프라인**을 구축하고 ③ 가전 카테고리를 확장하는 것이다.

---

## 1. 배경 · 현황 데이터 (실측 2026-05-20)

### 1.1 빌리고는 누구인가
- 빌리고 = 수십 개 **렌탈사**(코웨이·청호·쿠쿠·LG구독·캐리어·KT가전구독·세스코·삼성 등)의 상품을 모아 영업 파트너에게 중개하는 플랫폼
- 봉이는 빌리고의 영업 파트너 → 빌리고 상품을 고객에게 렌탈 판매하고 **빌리고로부터 수수료**를 받음
- 빌리고 정책(상품·수수료·프로모션)이 **단일 진실 공급원(SSOT)**. 봉이는 자체 정책을 만들 수 없고 빌리고를 따라야 함

### 1.2 빌리고 엑셀 (매월 발송, 현재 3차)

⚠️ **파일명에 주의** — 파일 분류 축은 *제품군이 아니라 렌탈사 그룹*이다. 한 파일 안에 12종+ 제품군이 섞여 있다.

| 파일 | = 렌탈사 그룹 | 시트 | 규모 | 수수료 방식 |
|---|---|---|---|---|
| **빌리고_"정수기"** | 정수기 메이커 그룹 (코웨이·청호·쿠쿠·SK매직·웰스·루헨스·유버스·큐밍·LG구독) | 10개 (브랜드별) | 1,106 모델 / 8,335 옵션행 | 수수료 **금액 직접** ("총 수수료 v+") |
| **빌리고_가전** | 그 외 렌탈사 (캐리어·LG전자구독·KT가전구독·BS·이니렌탈·세스코…) | 24개 (1 수수료율표 + 23 렌탈사) | 미집계 (시트별 레이아웃 상이) | **수수료율(%)** — 총 렌탈료 × 율 |

**"정수기" 파일의 실제 제품군 분포** (시트 제품군 컬럼):
- 코웨이: 매트리스 826 · 프레임 328 · 정수기 315 · 청정기 206 · 비데 123 · 힐링케어 69 · 전기레인지·에어컨·연수기·제습기·홈메디·의류청정기
- 청호: 매트리스 1,235 · 얼음정수기 447 · 냉온정수기 445 · 공기청정기 257 · 비데 202 · 제빙기·제습기
- 쿠쿠: 침대세트·정수기·비데·공청기·매트리스·로봇청소기·음식물처리기·세탁기·냉장고·에어컨·안마의자 등 40여 종
- → **코웨이·청호는 매트리스가 정수기보다 많다.** 정수기 위주 사업 가정은 틀렸음.

### 1.3 봉이 현 DB 현황 (라이브 dugaqvvnhsgenhmhuyju)
| 테이블 | 건수 | 비고 |
|---|---|---|
| rental_categories | 7 | 정수기·공기청정기·비데·건조기·식기세척기·안마의자·세탁기 |
| rental_products | 107 | **정수기만** (9 브랜드) — 빌리고 정수기 엑셀의 ~10%만 |
| rental_product_options | 1,512 | 티켓 발급 1,501 |
| rental_sales | **2** | completed **0** — **실가동 전** |
| rental_brand_policies | 9 | |
| rental_policy | 1 (active) | V1 통일 마진공식 |

> **핵심 시사점**: 봉이 가전렌탈은 아직 실 영업 0건. 기존 데이터 보존 부담이 거의 없어 구조 보강이 자유롭다. 단 봉이 `rental_*` 구조는 이미 빌리고 정수기 엑셀 가공본이므로 (§4.0) **전면 재설계가 아니라 import 파이프라인 구축**이 본질이다.

### 1.4 빌리고 수수료 체계 (가전 파일 `(2605)렌탈사별 수수료율` 시트)
빌리고는 렌탈사마다 수수료 산정 방식이 **4종**으로 다르다:

| 방식 | 예시 | 산식 |
|---|---|---|
| **율(rate)** | 스마트 13%, LG구독 8%, LG헬로 16%/8%, KT 18%, 캐리어 11%, BS 11% | 총(or 월) 렌탈료 × 율 |
| **정액(flat)** | KT R상품 15만, 캐리어 캐치 5천, 신차렌탈 40만+, 세라젬 50만, 통신 1.5만 | 건당 고정 |
| **배수(multiple)** | 세스코 6배, CCTV 5배, 바이온텍 6배 | 월 렌탈료 × 배수 |
| **구좌(account)** | 교원순수상조 14만, 보람개발 25만, 더리본 28만 | 구좌당 고정 |

- 일부 렌탈사는 **일반/현장 이원화** (LG헬로 16%/8%, KT 일반/R상품, BS 일반/플스·엑박)
- 정산 기준도 상이: 설치완료 / DB접수 / 출금일

---

## 2. 문제 정의

| # | 문제 | 영향 |
|---|---|---|
| P1 | 봉이 자체 `rental_*` 구조가 빌리고 엑셀 구조와 불일치 | 매월 엑셀을 그대로 반영 불가, 수작업 |
| P2 | 빌리고 수수료 체계(율/정액/배수/구좌) 미반영 — 봉이는 단일 마진공식 | 가전 상품 수수료 계산 불가 |
| P3 | 매월 엑셀 갱신 import 워크플로 부재 | 3차까지 수동, 4차·5차 누적 시 관리 불가 |
| P4 | 가전 카테고리(냉방기·냉장고·TV 등) 데이터 0건 | 가전 상품 판매 자체 불가 |
| P5 | 엑셀 "점검주기" 1컬럼에 방문/셀프 + 주기가 혼재 | 봉이 `care_service`+`inspection_cycle` 2컬럼 매핑 필요 |
| P6 | 시트별 컬럼 레이아웃이 천차만별 (정수기 브랜드별, 가전 LG구독 가로펼침 등) | 단일 파서 불가 — 시트별 파서 필요 |
| **P7** | **같은 제품(모델)이 여러 렌탈사 채널로 중개** — 26개+ 모델코드가 두 파일 중복 (예: 루헨스 `WHP-2000` = 루헨스 직접 + LG헬로 채널) | 채널마다 렌탈료·수수료가 다름. `rental_products` UNIQUE `(brand,model)` 로는 충돌. 견적 시 채널 비교 필요 |
| **P8** | **같은 (모델·약정·케어)에 변형 다수** — 청호 규정코드 12~15종, 쿠쿠 구분(일반/패키지/패키지10%) 등. 정수기 8,165옵션 중 5,887행이 키 충돌 | `rental_product_options` UNIQUE 에 `variant_code` 차원 필수. 누락 시 옵션 절반 손실 → 계산기 오작동 |

---

## 3. 목표 · KPI

| 목표 | KPI |
|---|---|
| 빌리고 엑셀 100% 시스템 반영 | 정수기 1,106모델 + 가전 전 렌탈사 등록 |
| 매월 import 자동화 | 엑셀 업로드 → 파싱 → 반영 10분 이내 |
| 상담사 전 상품 견적 | 빌리고 모든 렌탈사/품목 견적 가능 |
| 정확한 수수료 산정 | 4종 수수료 방식 모두 자동 계산, 오차 0 |
| 월별 이력 추적 | import 배치 이력 + 상품 단종/변경 추적 |
| **동일상품 다채널 비교** | 계산기 견적에서 같은 제품의 채널별 렌탈료·수수료 비교 표시, best 자동 가이드 |

---

## 4. 데이터 모델 (기존 `rental_*` 유지 + 보강)

### 4.0 ⭐ 검증 — 봉이 `rental_*` = 빌리고 정수기 엑셀 가공본

라이브 DB 컬럼과 빌리고 정수기 엑셀이 거의 1:1 매핑됨:

| 빌리고 정수기 엑셀 | 봉이 `rental_product_options` |
|---|---|
| 약정기간(의무) | `months` |
| 점검주기 | `care_service` + `inspection_cycle` ※P5 분해 |
| 소유권 | `ownership_months` |
| 렌탈료 / 약정할인가 | `monthly_fee` |
| 반값할인 적용기간 / 반값료 | `half_period` / `half_fee` |
| 총 수수료(v+) | `rebate` |
| 타사보상(vat) | `rebate_otherco` |
| 반값할인(vat) | `rebate_half` |

봉이가 그 위에 얹은 컬럼 = `point_weight`·`tier`·`tier_calculated`·`margin`·`net_profit`·`is_premium`·`ticket_number` → 전부 **봉이 인센티브 계산 영역** (빌리고와 무관, 유지).

→ **결론: 구조를 새로 만들 필요 없음. 기존 `rental_*` 를 그대로 쓰고, 빌리고 엑셀을 여기에 정기 import 한다.**

### 4.1 설계 원칙
- 기존 `rental_categories` / `rental_products` / `rental_product_options` / `rental_sales` / `rental_policy` **그대로 유지**
- 빌리고 엑셀 = 외부 SSOT → 매월 import 로 `rental_products` / `rental_product_options` 를 **UPSERT 갱신**
- import 시 봉이 인센티브 컬럼(`point_weight`·`tier`·`margin` 등)은 **건드리지 않음** (UPSERT 시 보존, 또는 정책 RPC가 재산출)
- 가전은 `rental_categories` 에 카테고리만 추가

### 4.2 신설 테이블 (2개만)

```
rental_companies            (렌탈사 마스터 — 주로 가전 수수료율용)
  id · name(코웨이·청호·캐리어·LG구독·KT가전구독…)
  commission_method(rate|flat|multiple|account)
  commission_rate · commission_flat · commission_multiple
  rental_fee_basis(total|monthly)        -- 율 적용 대상
  has_dual_pricing(bool)                 -- 일반/현장 이원화
  settle_basis(설치완료|DB접수|출금일)
  notes · is_active

rental_import_batches       (월별 import 이력 — 추적·롤백)
  id · year_month · file_type(정수기|가전)
  source_filename · sheet_count · row_count
  upsert_new · upsert_updated · marked_discontinued
  imported_by · imported_at · status(parsing|preview|committed|failed)
```

### 4.3 기존 테이블 보강 컬럼

`rental_products` / `rental_product_options` 에 빌리고 추적 + 다채널 식별 컬럼 추가:
```
rental_products:
  + company_id (FK → rental_companies)              -- 판매 채널(렌탈사)
  + manufacturer (text)                             -- 제조사 (루헨스·쿠쿠·삼성…)
  + model_key (text)                                -- 정규화 모델코드 (다채널 매칭 키)
  + source_batch_id (FK → rental_import_batches)    -- 어느 import 회차
  + billigo_status (동일|신규|변경|단종)            -- 전월대비

rental_product_options:
  + source_batch_id (FK → rental_import_batches)
  + commission_method (direct|rate|flat|multiple|account)  -- 수수료 산정 방식 박제
  + variant_code (text)         -- ★ 변형 식별자 (P8) — 청호 규정코드·쿠쿠 구분·SK매직 세부유형 등
  + variant_label (text)        -- 변형 표시명 (계산기 노출용, 예 "패키지10%" "타사보상 J규정")
```

> **UNIQUE 키 변경**:
> - `rental_products` : `(brand, model)` → **`(company_id, model)`** — 다채널(P7)
> - `rental_product_options` : `(product_id, months, care_service)` → **`(product_id, months, care_service, inspection_cycle, ownership_months, variant_code)`** — 변형 차원(P8)

### 4.3.1 ⭐ P8 — 옵션 변형 차원 (행 누락 0 보장)

빌리고 정수기 8,165 옵션행 중 5,887행이 `(모델·약정·케어)` 키로 충돌. 시트마다 **행을 가르는 추가 차원**이 다르다:

| 시트 | 변형 차원 | `variant_code` 추출 |
|---|---|---|
| 청호 | 규정코드 (모델당 12~15종) | `A0364`·`J0604`·`P0604`·`J0604(타사)` 원본 그대로 |
| 쿠쿠 / 쿠쿠타사보상 | 구분 | `일반`·`패키지`·`패키지10%` |
| SK매직 | 세부유형 + 소유권 | `방문할인`·`셀프할인+타사보상` 등 + 소유권 |
| 웰스 / 루헨스 | 렌탈료 할인단계 (식별자 없음) | 파서가 렌탈료 내림차순 순위 부여 → `v1`·`v2`·`v3` |
| 큐밍 | 관리형/셀프형 + 전사프로모션 | `관리형`·`셀프형` (+ 프로모) |
| 코웨이 | 거의 유일 (점검주기+반값적용기간) | 보통 `''` (빈값), 충돌 시 점검주기 원본 |
| 유버스 | 완전 유일 | `''` |

- `variant_code` 가 없는 행은 빈 문자열 `''` (NULL 아님 — UNIQUE 안정성). 한 행 = 한 옵션 = 한 `R` 티켓.
- 매월 import 는 위 6-튜플 자연키로 UPSERT → **누락·덮어쓰기 0**.
- 같은 제품이 여러 채널로 중개(P7) → 동일 제품 식별은 `(manufacturer, model_key)`.

### 4.4 엑셀 → 기존 컬럼 매핑

| 빌리고 엑셀 | 봉이 DB |
|---|---|
| 시트명 (브랜드/렌탈사) | `rental_products.brand` / `rental_companies.name` |
| 제품군/품목 | `rental_categories` (정수기·냉방기·냉장고·TV…) |
| 상품명 / 모델명 | `rental_products.name` / `model` |
| 의무(약정) | `rental_product_options.months` |
| 소유권 | `ownership_months` |
| 점검주기 (분해) | `care_service` + `inspection_cycle` ※P5 |
| 렌탈료 | `monthly_fee` |
| 총 수수료(v+) [정수기] | `rebate` (직접) |
| 총 렌탈료 × 수수료율 [가전] | `rebate` (계산값) — `commission_method='rate'` 박제 |
| 반값할인 적용기간 / 반값료 | `half_period` / `half_fee` |
| 타사보상 / 반값 수수료 | `rebate_otherco` / `rebate_half` |
| 규정코드·구분·세부유형 (변형) | `variant_code` / `variant_label` ※P8 |
| 프로모션 | `rental_products.promo_tag` |

### 4.5 P5 — "점검주기" 분해 규칙
```
방문 판정: "방문" "관리" "케어" "방문형" "N M(N개월점검주기)" / 청호 숫자(>0)
셀프 판정: "자가" "셀프" "필터발송" "택배" "서비스프리" "없음" / 청호 "0"
inspection_cycle: 텍스트에서 개월 숫자 추출 ("4개월"→4, "6M"→6, 미검출→null)
```

### 4.6 동일상품 다채널 식별 (P7)

같은 물리 제품이 여러 렌탈사 채널로 중개된다 (루헨스 `WHP-2000` = 루헨스 직접 + LG헬로). 채널마다 별도 `rental_products` row 로 저장하되, **동일 제품임을 식별**해 계산기에서 그룹핑한다.

**식별 키**: `(manufacturer, model_key)`
- `manufacturer` — 제조사. 시트의 "브랜드" 컬럼 또는 모델코드 prefix 로 판정 (`WHP`→루헨스, `CP-`→쿠쿠 …)
- `model_key` — 모델코드에서 채널·색상·옵션 suffix 제거한 정규화 코드
  - 예: `WHB-5300` `WHB-5300(자가)` `WHB-5300_60` → 모두 `WHB-5300`

**채널별 차이 (실측 — WHA-200 공기청정기 36개월)**
| 채널 | 월 렌탈료 | 봉이 수수료 | |
|---|---|---|---|
| 루헨스 직접 (방문) | 25,900 | 220,000 | 수수료 ↑ |
| LG헬로 (일반 16%) | 23,900 | ~137,664 | 렌탈료 ↓ |

→ 같은 제품·약정이라도 채널 선택에 따라 봉이 수수료/고객 부담이 갈린다. **자동 단일화 불가** — 계산기에서 비교 노출 (§5.5).

### 4.7 best 채널 판정 (계산기 가이드용)

같은 `(manufacturer, model_key, months, care_service)` 조합 내 채널 비교:
```
Dominant  : 한 채널이 렌탈료 ≤ AND 수수료 ≥ → ⭐ best 자동 표시 (예: WHB-5300)
Trade-off : 렌탈료 ↓ vs 수수료 ↑ 상충 → 자동 판정 안 함, 상담사 선택 (예: WHA-200)
```
> best 는 **가이드 표시만**. 자동 비활성화하지 않는다 — 상담사가 고객 가격민감도 보고 최종 선택.

---

## 5. import 워크플로

```
① 빌리고가 매월 엑셀 2종 발송 (3차·4차…)
② 어드민 → 상품관리 > 빌리고 import 화면에서 엑셀 업로드
③ 시트별 파서가 정규화:
   - 시트 식별 → rental_companies(렌탈사) 매핑
   - 병합셀 forward-fill
   - 점검주기 분해 (P5)
   - manufacturer·model_key 추출 (P7 다채널 식별)
   - 가전: 렌탈사 수수료율 시트 참조해 rebate 계산
④ diff 미리보기: 신규 N · 변경 N · 단종 N (사용자 확인)
⑤ 확정 → rental_products/options UPSERT + rental_import_batches 기록
⑥ 기존 영업(rental_sales)은 snapshot 박제로 영향 없음
```

- **파서는 시트별 어댑터 패턴** (정수기 10종 + 가전 23종) — 공통 정규화 인터페이스
- 헤더 자동 탐지 실패 시트(KT·렌플·렌타나·위덱)는 전용 어댑터
- import는 **데브 먼저 → 검증 → 라이브** (마감원장 import 패턴 준용)

---

## 5.5 계산기 다채널 비교 견적 (TM 상담 v1)

상담사가 가전렌탈 견적 시, 선택한 제품이 여러 채널로 중개되면 **비교 카드**를 노출한다.

### 동작
```
상담사가 모델 선택 (예: 루헨스 공기청정기 WHA-200)
  → 시스템이 (manufacturer, model_key) 동일 + (months, care_service) 동일 row 조회
  → 채널이 2개 이상이면 비교 카드 표시
```

### UI (견적 결과 패널 내)
```
🔁 이 제품은 2개 채널에서 가능합니다 — 36개월·방문
┌──────────────────────────────────────────────┐
│ ⭐ 루헨스 직접   월 25,900원 · 수수료 220,000  [선택] │
│    LG헬로비전    월 23,900원 · 수수료 137,664  [선택] │
│                 ↳ 고객가 2,000원 저렴              │
└──────────────────────────────────────────────┘
```
- **Dominant** 채널 → `⭐` 표시 (렌탈료 ≤ & 수수료 ≥)
- **Trade-off** → 각 장점 라벨 ("고객가 저렴" / "수수료 높음"), ⭐ 없음
- 상담사가 `[선택]` → 해당 채널 옵션으로 견적 확정 → `rental_sales` 에 채널 박제

### 데이터
- 그룹핑 키: `(manufacturer, model_key, months, care_service)`
- best 판정: §4.7 규칙 (가이드용, 자동 비활성 X)
- 단일 채널 제품은 비교 카드 미표시 (기존 견적 흐름)

---

## 6. 봉이 인센티브 연계

빌리고 수수료 = **봉이의 매출 원천**. 봉이 인센티브 정책으로 상담사 보상 산정:

```
봉이 매출        = 빌리고 수수료 (rebate, 빌리고가 봉이에 지급)
봉이 마진        = 빌리고수수료 − 고객페이백 − 봉이운영비
상담사 인센티브  = f(포인트P, Grade 단가)   ← rental_policy 유지
```

### ⭐ 6.1 렌탈 = 단일 통합 정책, 상품 차등은 포인트(P)로만

- **렌탈 전체를 하나의 인센티브 정책으로 운영** — 카테고리(정수기·매트리스·에어컨·TV…)별로 Grade·정책을 **나누지 않는다**. `rental_policy` 활성 1개.
- 상품 간 가치 차등은 **`point_weight`(P) 하나로만 조절** — 좋은/비싼 상품은 P 높게, 낮은 상품은 P 낮게.
- Grade(G1~G3) 계산은 **렌탈 전체 P 합산** 기준 (카테고리 무관). 기존 `rental_calc_monthly_settlement` 이 이미 그렇게 동작 → 변경 없음.
- 카테고리는 *상품 분류·노출용*일 뿐, 인센티브 산정에는 영향 없음.

### 6.2 기존 구조 유지

- ⭐ **인센티브 구조(`rental_policy`·V1 마진공식·P·Grade·정산 RPC)는 기존과 100% 동일** — 변경 없음
- 빌리고 수수료(`rebate`)가 기존 마진공식의 입력값으로 들어갈 뿐, 공식·정책·정산 로직은 그대로
- 영업 접수 시 `rebate`·`care_service`·`promo_tag` 등 **snapshot 박제** → 빌리고 엑셀 갱신에도 기존 영업 보존
- import 후 상품별 P 는 `rental_recalc_margins_and_premium` RPC 로 재산출 (마진 기반 Tier→P)

---

## 7. 범위

### In-scope
- `rental_companies` · `rental_import_batches` 2테이블 신설 + `rental_*` 보강 컬럼
- 시트별 엑셀 파서 (정수기 10 + 가전 23 어댑터)
- 어드민 import 화면 (업로드·diff·확정)
- 빌리고 수수료 4종 계산 엔진 (`rebate` 산정)
- 카테고리 마스터 ~30종 시드
- 계산기 동일상품 다채널 비교 카드 (§5.5)

### Out-of-scope (변경하지 않음)
- ⭐ **인센티브 구조** — `rental_policy`·P·Grade·마진공식·정산 RPC 전부 **기존 그대로**
- 빌리고 API 직접 연동 (현재는 엑셀 수동 수령)
- 상조/통신/신차 등 비-제품 렌탈사
- 고객 셀프 견적 (상담사 전용 유지)

---

## 8. 로드맵

| Phase | 내용 | 산출물 |
|---|---|---|
| **P1** | `rental_*` 보강 컬럼 + 2테이블 신설 + 카테고리 ~30종 시드 | SQL 마이그레이션 + 롤백 |
| **P2** | 정수기 파서 (10시트) + import 화면 | 파서·어드민 UI |
| **P3** | 가전 파서 (23시트) + 수수료율 4종 엔진 (`rebate` 산정) | 파서·계산엔진 |
| **P4** | 계산기 다채널 비교 카드 추가 (§5.5) | tm-counselor 갱신 |
| **P5** | 인센티브 — **변경 없음**. 기존 P/Grade 포인트제도 그대로, 회귀 검증만 | 정산 회귀 테스트 |
| **P6** | 5라운드 점검 + 라이브 배포 | 검증·배포 |

---

## 9. 결정 필요 사항 (사용자 확인)

| # | 분기점 | 권장안 |
|---|---|---|
| D1 | 기존 `rental_*` 처리 | **유지 + 보강** — 구조가 이미 빌리고 정수기 엑셀 가공본. 신설은 `rental_companies`·`rental_import_batches` 2개뿐 (§4.2) |
| D2 | 취급 제품군 범위 | **결정됨** — 빌리고 전 품목(~30 카테고리)을 처음부터 `rental_categories` 시드로 생성. 운영 노출은 `is_active` 토글. 추후 전 제품 확장 시 신규 카테고리 INSERT 불필요 |
| D3 | import 방식 | **어드민 수동 업로드** (빌리고 API 없음). 매월 엑셀 수령 → 화면 업로드 |
| D4 | plan_code(티켓) 체계 | **결정됨 — 봉이 자체 발번** (`R` prefix, 옵션 단위 시퀀스). 빌리고 접수코드(청호 A0364 등)는 `metadata` 에 참고용 보관만 |
| D5 | 첫 적용 환경 | **데브 먼저** → 검증 → 라이브 (마감원장 import 사고 패턴 회피) |

### D2 — 카테고리 마스터 (처음부터 전체 시드, 활성/비활성 운영)

빌리고 두 파일의 전 품목을 정규화한 ~30개 카테고리. **모두 미리 생성**하고 `rental_categories.is_active` 로 노출 제어:

| 그룹 | 카테고리 |
|---|---|
| 정수기 | 정수기 · 얼음정수기 · 냉온정수기 (직수·언더싱크·빌트인·POU 는 metadata 세분류) |
| 침구 | 매트리스 · 침대프레임 |
| 공기 | 공기청정기 · 제습기 |
| 생활위생 | 비데 · 연수기 · 샤워기 |
| 주방 | 전기레인지 · 오븐 · 식기세척기 · 커피머신 · 음식물처리기 · 식물재배기 |
| 대형가전 | 냉장고 · 김치냉장고 · 에어컨 · 세탁기 · 건조기 · TV |
| 생활가전 | 청소기 · 로봇청소기 · 의류관리기(스타일러) · 의류청정기 |
| 헬스 | 안마의자 · 힐링케어 · 미용/의료기기 |
| 디지털 | PC·노트북 · 모니터 · 게임기 · 빔프로젝터 · 스피커 |
| 기타 | 펫용품 · 해충방제 · 방향기 · 핸드드라이어 |

> 운영 초기엔 정수기·매트리스·공기청정기·비데 등 주력만 `is_active=true`, 나머지는 false 로 두고 점진 확장.

---

## 10. 4 roles 시뮬레이션

| Role | 시나리오 |
|---|---|
| **admin** | 상품관리 > 빌리고 import 진입 → 엑셀 2종 업로드 → diff 확인 → 확정. 수수료율·렌탈사 마스터 편집 |
| **manager** | 상품·수수료 조회 (읽기). 센터 상담사 가전렌탈 실적 모니터 |
| **agent** | TM 상담에서 빌리고 상품 견적 → 약정·케어 선택 → 수수료·페이백 자동 → 영업 접수 |
| **contract** | 가전렌탈 계약 처리 → 설치완료 → status 전환 → 정산 반영 |

---

## 11. 5라운드 점검 (구현 시)

- **R1 JS 무결성** — 파서 시트별 어댑터 SyntaxError·const 충돌
- **R2 데브↔라이브 동기화** — `rental_*` 스키마·시드 일치
- **R3 보안** — import 파일 업로드 검증, RLS, 엑셀 수식 인젝션 방어
- **R4 모니터링** — import 실패 alert, 롤백 SQL, 배치 이력
- **R5 4 roles E2E** — 업로드·견적·영업·정산 전 흐름

---

## 11.5 구현 후 갱신할 문서 (기능 완성 뒤)

> 사용자용 문서는 **기능 구현 완료 후** 갱신한다. 미구현 상태 선반영 금지.

| 문서 | 현행 상태 | 갱신 내용 |
|---|---|---|
| `docs/flow-rental.html` | **옛 구조** — 51개 상품·렌트리(rentre.kr) 연동·`R001~R051` 1:1 티켓 | 빌리고 다채널·옵션단위 흐름으로 **전면 개편** |
| `docs/incentive-manual.html` | 가전렌탈 섹션 없음/구버전 | "가전렌탈 (빌리고 기반)" — import·다채널 견적·정산 추가 |
| `docs/master-map.html` | IA | 빌리고 import 메뉴 추가 |
| `CLAUDE.md` | 도메인 룰 | 빌리고 SSOT·다채널·import 룰 추가 |
| `docs/specs/MANUAL_SYNC_RULE.md` 대상 | — | 위 갱신을 manual sync 룰에 따라 처리 |

---

## 12. 현행 가전렌탈 의존성 지도 (재구축 영향 범위)

### 12.1 ⭐ 빌리고 영역 vs 봉이 영역 경계 (가장 중요)

```
┌─ 빌리고 영역 (외부 SSOT, 엑셀로 수령) ──────────────┐
│  상품 · 렌탈료 · 수수료(빌리고→봉이 지급액) · 프로모션  │
└──────────────────────┬───────────────────────────────┘
                       │  commission_amount 이 봉이 매출
                       ▼
┌─ 봉이 영역 (자체 정책, rental_policy) ────────────────┐
│  빌리고 수수료를 입력값으로 →                          │
│  · 상담사 포인트 P · Grade(G1~G3) · 인센티브           │
│  · 마진 = 수수료×0.9 − 페이백 − P×70k                  │
│  · Tier(S/A/B/C) · 우수상품                            │
└───────────────────────────────────────────────────────┘
```
> **재구축 핵심**: 빌리고 엑셀이 바꾸는 것은 **상품·수수료**까지. 그 아래 P·Grade·인센티브는 **봉이 자체 정책으로 유지**. 빌리고 수수료가 봉이 마진공식의 `rebate` 입력값으로 들어간다.

### 12.2 연계 지도

| 연계 지점 | 호출 API / 채널 | 의존 테이블·RPC | 빌리고 재구축 영향 |
|---|---|---|---|
| **TM 상담 v1** `tm-counselor.html` | `GET /rental/categories·products·products/:id/options` `POST /rental/quote` | rental_products·options·policy | 🔴 견적 입력 = 빌리고 모델로 전환 |
| **상품 관리** `incentive-products.html` | `PATCH /rental/products·options` `POST /rental/recalculate-margins` | rental_products·options + `rental_recalc_margins_and_premium` RPC | 🔴 import가 PATCH 대체 |
| **월별 정산** `incentive-settlements.html` | `GET /rental/settlement` | `rental_calc_monthly_settlement` RPC | 🟠 수수료 입력값만 교체, Grade 로직 유지 |
| **대시보드** `incentive-dashboard.html` | BroadcastChannel `rental-policy` | monthly_settlements | 🟡 정책 전파 유지 |
| **티켓 관리** `incentive-tickets.html` | `GET /tickets/rental` `PATCH .../activate` | rental_product_options.ticket_number | 🟠 plan_code 체계 교체 (D4) |
| **정책 전파** | BroadcastChannel `rental-policy` | rental_policy + history | 🟡 봉이 영역 — 그대로 유지 |

### 12.3 Grade · Point(P) 흐름 (봉이 영역 — 유지 대상)

```
빌리고 수수료(commission) ─입력→ rental_quote 계산
  └ margin = 수수료×0.9 − payback − P×weight_cost_per_p(70k)
  └ Tier 분류 (rental_policy.tier_*_min_margin) → S/A/B/C
  └ tier_to_p 매핑 → 포인트 P
영업 접수 → rental_sales.point_weight_snapshot 박제
월말 → rental_calc_monthly_settlement RPC
  └ Σ point_weight_snapshot → Grade (rental_policy.grade_thresholds)
  └ Grade × grade_rates → 인센티브
  └ 가전 Grade 는 인터넷+TV 와 ★독립 (절대 통합 금지)
```

### 12.4 재구축 시 영향점 우선순위

| 우선 | 영향점 | 대응 |
|---|---|---|
| 🔴 P0 | TM 상담·상품관리가 `rental_products/options` 직접 의존 | `billigo_*` 로 교체 시 견적·상품 API 전면 재작성 |
| 🔴 P0 | `rental_sales` snapshot 박제 | 빌리고 plan → snapshot 컬럼 매핑 유지 (영업 보존) |
| 🔴 P0 | 가전 Grade ↔ IT Grade 독립 | `rental_calc_monthly_settlement` RPC 로직 보존 |
| 🟠 P1 | 마진공식 `rebate` 입력 = 빌리고 수수료 | `commission_amount` 를 `rebate` 자리에 연결 |
| 🟠 P1 | `rental_recalc_margins_and_premium` RPC | import 후 자동 호출 (Tier·P 재산출) |
| 🟡 P2 | BroadcastChannel·정책 버전 | 봉이 영역 — 변경 불필요, 유지 |
