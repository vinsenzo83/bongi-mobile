# 렌탈 시스템 개발 문서 (봉이 CRM)

렌탈 카탈로그·상담 계산기·접수/계약처리·가이드MAX 엔진·앱 공개 API 전체 구조. 2026-09-18 기준.
앱에 붙이는 규격만 필요하면 [rental-app-integration.md](./rental-app-integration.md) 를 본다.

---

## 0. 한 장 요약

```
빌리고 월 엑셀(35+시트)  →  어댑터 파싱  →  미리보기  →  확정 적재
                                                  │
                            rental_cat_models / rental_cat_offers (조건=티켓 R000000)
                                                  │
        ┌─────────────────────────┬───────────────┴───────────────┬────────────────────┐
        │                         │                               │                    │
  AI 가이드·MAX 엔진        상담사 계산기(TM)              관리자 상품관리        앱 공개 API
  (주1회 + 적재 직후)       조건선택→지급액→접수           가이드/카드/프로모션    금액 비노출
        │                         │
        └── guide_payout/max_payout ──→ incentive_sales(sale_kind='rental')
                                          │
                                   계약처리(체크리스트) → 완료 → bongi_gifts(사은품 원장)
                                          │
                                   정산: (MAX − 실지급액) × 렌탈 배분율
```

핵심 개념
- **조건(offer) = 판매 단위.** 같은 모델이라도 약정·관리방식·주기·할인유형이 다르면 다른 조건이고, 각각 티켓번호(`R` + 6자리)를 갖는다.
- **가이드 / MAX.** 가이드는 고객에게 주는 최소 지급액(공개 가능), MAX는 상담사가 재량으로 올릴 수 있는 상한(고객·공개채널 비공개).
- **잔존마진 = MAX − 실제 지급액.** 상담사 인센티브와 회사 이익이 여기서 갈린다.
- **리베이트는 관리자 전용.** 상담사 API 응답에 절대 넣지 않는다.

---

## 1. 데이터 모델

| 테이블 | 용도 | 핵심 컬럼 |
|---|---|---|
| `rental_cat_suppliers` | 렌탈사 18곳 | `id`(coway…), `name`, `file_kind`(water/appliance), `signup_policy`(가입기준 jsonb) |
| `rental_cat_models` | 상품(모델) | `model_key`, `model_code`, `product_name`, `brand`, `category`, `image_url`, `specs`(jsonb), `platform_linked` |
| `rental_cat_offers` | 조건 = 판매 단위 | 아래 상세 |
| `rental_cat_offer_changes` | 변경 이력 | `change_type`(payout…), `before`/`after`, `changed_by`, `run_id` |
| `rental_cat_batches` | 월 엑셀 적재 배치 | `month`, `file_kind`, `status`, 통계 |
| `rental_cat_cards` | 제휴카드 | `card_issuer`, `card_name`, `tiers`(전월실적 구간), `discount_months`, `categories` |
| `rental_cat_promotions` | 기간 프로모션 | `title`, `summary`, `period_from/to`, `stacking` |
| `rental_competitor_benchmarks` | 경쟁사 지원금 | `competitor`, `model_code`, `support_amount`, `observed_at`, `source_url` |
| `rental_margin_scenarios` | 마진 설계 저장본 | `params`, `summary`, `engine_version` |
| `rental_engine_settings` | 엔진 정책(1행) | `policy`(jsonb), `auto_apply`, `cycle` |
| `rental_payout_runs` | 엔진 실행 기록 | `trigger`, `stats`, `summary`, `changed`, `status` |
| `rental_cat_model_summary` (view) | 모델+집계 | `offer_count`, `min_display_fee`, `max_free_months` |

### rental_cat_offers 주요 컬럼

```
condition_key    조건 식별자(unique). 월 엑셀이 바뀌어도 같은 조건이면 유지 → 티켓번호 보존
ticket_number    R000000 (시퀀스, 단종돼도 재사용 안 함)
contract_months / obligation_months / ownership_months
care_type        visit | self | delivery | none        cycle_months 방문·필터 주기
offer_type       normal|package|bundle|trade_in|half|prepay|promo|special|field|staff|purchase
offer_tags[]     집중모델, 약정없음, rule:·kt: 같은 내부 표시 포함(화면에서는 내부 표시 숨김)
monthly_fee      할인 끝난 뒤 정상 월 요금
price_phases     [{from,to,fee}] 반값·면제 구간
display_fee      1개월차 대표 요금 (화면 "월 렌탈료")
prepay_amount    선납금        total_fee  일시불 가격/총액
rebate…          관리자 전용 (rebate, rebate_basis, rebate_rate, rebate_detail, rebate_changed)
guide_payout     가이드 (만원 단위)    max_payout  MAX (천원 단위)
free_months      generated: floor(guide_payout / display_fee)
status           active | paused | discontinued        crm_enabled  상담 노출 여부
```

계약 쪽(`incentive_sales`)에 남는 렌탈 컬럼: `sale_kind='rental'`, `rental_offer_id`, `rental_supplier_id`,
`rental_ticket_number`, `rental_snapshot`(모델·조건 박제), `rental_application`(가입정보), `rental_process`(계약처리 체크),
`guide_payout_snapshot`, `max_payout_snapshot`, `actual_payout`, `rebate_snapshot`(관리자 전용).

---

## 2. 월 엑셀 적재 파이프라인

`server/services/rental-import/`

| 파일 | 역할 |
|---|---|
| `index.js` | 워크북 파싱 엔트리. 시트→어댑터 매칭, 병합셀 처리(`ctx.mergedValue`) |
| `core.js` | 공통 유틸 — `makeOffer`(검증·정규화), `conditionKey`, `halfPhases`, `categorize`, `composeProductName`, `applyRule`(리베이트 규칙) |
| `adapters/water-a.js` | 청호·코웨이·쿠쿠 정수기 |
| `adapters/water-b.js` | LG구독 정수기·SK매직·큐밍·유버스·루헨스 |
| `adapters/appliance-lg.js` | LG전자구독·LG헬로비전·KT |
| `adapters/appliance-etc.js` | BS·스마트·캐리어·세스코·렌타나·이니·렌플 |
| `commit.js` | 미리보기 diff → 확정 반영(가이드·MAX·관리자 값 보존) |

적재 규칙
- **가이드·MAX·관리자 메모는 엑셀이 덮지 않는다.** 리베이트가 바뀐 조건만 `rebate_changed=true`로 표시해 재검토를 유도한다.
- **행 커버리지 검증:** 시트의 값 있는 행이 조건으로 전부 변환됐는지 확인하고, 누락이 있으면 확정을 막는다.
- **조건키 보존:** 같은 조건이면 `condition_key`가 같아야 티켓번호가 유지된다. 규칙이 바뀌면 `scripts/rental-catalog-rekey.mjs`로 기존 티켓을 이어 붙인 뒤 적재한다.
- 확정 직후 가이드·MAX 엔진이 자동 실행된다(아래 4장).

실행: 상품관리 → 렌탈 → 엑셀 적재(미리보기 → 확정). 스크립트는 `scripts/rental-catalog-import.mjs`.

---

## 3. API

베이스 `/api/rental-catalog`. 권한은 `incentive_agents.role` 기준 — `agent`(상담사), `admin`. 계약처리는 `/api/incentive` 쪽.

### 공개 (인증 없음)
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/public/models` | 앱용 상품 목록 (금액 비노출) |
| GET | `/public/trust` | 지급 현황 지표 |

### 상담사
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/agent/categories` · `/agent/models` · `/agent/models/:id/offers` | 검색·조건 목록 (리베이트 없음) |
| GET | `/agent/tickets/:ticket` | 티켓번호로 조건+모델 |
| GET | `/agent/offers/:id/form` | 렌탈사 가입기준 기반 접수 폼 명세 + 제휴카드 |
| GET | `/agent/suppliers/:id/cards` · `/promotions` | 카드·프로모션 |
| POST | `/agent/recommend` | 내부 로직 자동 추천 (AI 호출 없음) |
| POST | `/agent/assist` | 상담 AI (Anthropic API 키 필요, 10분 30회 제한) |

### 관리자
| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/import/preview` · `/import/:batchId/commit` | 월 엑셀 |
| GET/PATCH | `/models`, `/models/:id`, `/offers/:id` | 상품·조건 수정 |
| POST | `/offers/bulk-payout`, `/offers/apply-margin` | 가이드·MAX 일괄 |
| GET | `/stats`, `/batches` | 요약·배치 |
| GET/POST/PATCH | `/cards`, `/promotions` | 카드·프로모션 관리 |
| GET/POST | `/margin/defaults`, `/margin/simulate`, `/margin/optimize`, `/margin/scenarios`, `/margin/benchmarks` | 마진 설계 |
| GET/PATCH/POST | `/margin/engine`, `/margin/engine/run`, `/margin/engine/runs/:id/rollback` | 엔진 설정·실행·되돌리기 |

### 계약 (`/api/incentive`)
| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/sales` (`sale_kind='rental'`) | 접수. 지급액은 가이드~MAX 범위 검증, 가입정보는 폼 명세로 검증 |
| GET | `/sales/:id/rental-form` | 계약처리 폼 + 체크리스트 |
| PATCH | `/sales/:id` | 지급액·`rental_process` 수정, `status='completed'` 처리 |

권한 규칙
- 상담사 응답에서 `rebate*`, `total_fee`는 제거한다(일시불 가격만 `lump_price`로 노출).
- MAX는 상담사에게만 보이고 고객 견적·앱·문자에는 넣지 않는다.
- 계약 완료 뒤에는 지급액을 바꿀 수 없다.

---

## 4. 가이드·MAX 엔진

`server/services/rental-margin-engine.js` (순수 계산) + `rental-payout-runner.js` (실행·기록). 버전 `ENGINE_VERSION`.

### 계산식
```
공급가 b      = rebate / 1.1            (basis='vat' 면 rebate 그대로)
MAX 남길 몫   = max(b × max_margin,   max_floor)
가이드 남길 몫 = max(b × guide_margin, guide_floor, MAX 남길 몫)
MAX   = floor((b − MAX 남길 몫)   / 1000)  × 1000
가이드 = floor((b − 가이드 남길 몫) / 10000) × 10000   (MAX 초과 불가)
```
DB 함수 `rental_cat_apply_margin(p_margin, p_basis, p_supplier, p_only_unset, p_dry_run, p_user, p_guide_margin, p_max_floor, p_guide_floor)` 이 같은 식을 쓴다(일괄 규칙 화면).

### 조건별 설계 `buildPayoutPlan()`
1. **카테고리별 최적 규칙 탐색** — 마진%와 최소 남김 금액 조합을 훑어 카테고리 건당 회사 몫 최대.
   제약 ① MAX 최소 남김 ≥ 1인 인건비 ÷ 생산성 ② 평균 가이드 ≥ 기준 규칙 값 ③ 건당 상담사 인센티브 ≥ 기준 규칙 값.
   기준 규칙(`baseline_rule`, 기본 MAX 10%·가이드 33%)을 **현재 리베이트로 재계산**해서 비교하므로, 입력이 같으면 몇 번 돌려도 결과가 같다(멱등).
2. **조건별 보정** — 인건비 하한을 지키는 범위에서
   - 경쟁사 동일 조건: MAX ≥ 경쟁사 지원금, 가이드 ≥ 경쟁사 × `competitor_guide_ratio`
   - 경쟁사 동일 모델(약정·관리 다름): 그 지원 비율을 이 조건 공급가에 적용
   - 집중·주력·판매 상위 모델: 카테고리 시장 지원 비율까지 가이드 상향
   - 보정 뒤에도 가이드~MAX 폭 ≥ 공급가 × `min_band`(기본 5%)
3. **적용 제외** — 사람이 직접 고친 조건(`payout_updated_by`가 엔진/규칙 표시가 아님), 변동이 임계값 미만(가이드 1만원·MAX 5천원)

### 실행
- **주기:** 매주 월요일 06:00 KST(`server/index.js` cron) + 월 엑셀 확정 직후 + 관리자 수동.
- **자동 적용**은 `rental_engine_settings.auto_apply`가 켜져 있을 때만.
- 실행마다 `rental_payout_runs` 1행, 조건 변경은 `rental_cat_offer_changes`에 `run_id`와 함께 남는다.
- **되돌리기:** `rental_cat_rollback_payout_run(run_id, user)` — 그 실행이 바꾼 조건만, 이후 사람이 손대지 않은 것만 직전 값으로.

### 정산 연결
```
상담사 월급 = 기본급 + Σ(렌탈 외 잔존마진) × 개인 배분율 + Σ(렌탈 잔존마진) × 렌탈 배분율
회사 몫(건당) = 공급가 리베이트 − 고객 지급액 − 상담사 인센티브
```
- 렌탈 배분율: `incentive_agents.rental_incentive_rate` → 없으면 `incentive_rules.rental_residual_rate`(현재 30) → 없으면 30.
- 함수: `incentive_calc_monthly_settlement(agent_id, 'YYYY-MM')`, 확정은 `incentive_finalize_monthly_settlement`.
- 설치완료(`status='completed'`, `contract_completed_at`) 건만 집계하고, 가이드·MAX는 계약 시점 스냅샷을 쓴다.

---

## 5. 상담 계산기 (TM)

`docs/tm-rental.js` (렌탈 탭) + `docs/tm-counselor.html`.

흐름: 검색/티켓 → 조건 선택(할인유형·약정·관리·세부 축) → 지급액 슬라이더(가이드~MAX) → 견적 → 접수 폼 → 계약 등록.

구현 주의점
- **조건 축이 같은 조건이 여럿**일 수 있다(선납금만 다른 경우 등). 티켓·표에서 고른 조건은 `forceOffer()`로 확정한다.
- **요금 표기:** `price_phases`가 있으면 구간별로, 일시불은 `lump_price`, 선납은 `prepay_amount`를 함께 보여준다.
- **무료개월** = `floor(지급액 / display_fee)`. 월 요금이 없는 조건(일시불)은 "현금 N원"으로 표기한다.
- **실질 월 부담** = (약정 총 렌탈료(반값·카드 할인 반영) − 지급액) ÷ 약정 개월.
- **제휴카드**는 계약정보가 아니라 계산기에서 고른다(카드 선택 시 납부수단 자동 '카드').
- 고객 견적 영역에 MAX를 넣지 않는다. 상담원 전용 박스에만 표시한다.
- **확정 견적서 복사**는 고객 1명에게 보내는 내용이라 지급액은 넣고 MAX는 넣지 않는다.
- 자동 추천(🎯)은 서버 내부 로직, AI(🤖)는 보조이며 실패 시 자동 추천으로 대체된다.

---

## 6. 접수 폼과 계약처리

`server/services/rental-application.js`

- `buildApplicationForm({supplier, offer, model, cards})` — 렌탈사 가입기준(`signup_policy`)에서 섹션을 만든다:
  계약자 / 사업자 / 외국인 / 설치 / 납부 / 타사보상 / 결합 / 선납 / 동의 / 메모.
  명의 종류, 납부수단, 결제일, 서류, 신용·프로세스 안내가 렌탈사마다 다르게 나온다.
- `validateApplication(form, input)` — 화면에 보이는 필드만 검증(필수·선택지·패턴·전화·이메일·나이 제한).
- `buildProcessChecklist(form, application)` — 계약처리 체크리스트. 명의별 서류 + 본인인증·전자서명·주문번호·해피콜·설치일·설치완료.
  **사업자 전용 서류(사업자등록증·인감·법인)는 원문이 "공통"이어도 개인·외국인에게 요구하지 않는다.**
- 완료 조건: 필수 체크가 모두 찬 뒤에만 `status='completed'`. 완료 시 사은품 원장(`bongi_gifts`)이 생성된다.

---

## 7. 화면

| 화면 | 파일 | 대상 |
|---|---|---|
| TM 상담 렌탈 탭 | `docs/tm-counselor.html`, `docs/tm-rental.js` | 상담사 |
| 상품관리 › 렌탈 | `docs/incentive-products.html`, `docs/products-rental.js` | 관리자 |
| 상품관리 › 렌탈 › 마진 설계 | `docs/products-rental-margin.js` | 관리자 |
| 계약처리 렌탈 상세 | `docs/contract-rental.js` | 계약부서 |
| 사은품 지급 | `docs/incentive-gifts.html` | 관리자 |

정적 파일은 Cloudflare 뒤에 있어 **JS를 고치면 `?v=` 쿼리를 올려야** 반영된다(`tm-rental.js?v=24` 식).

---

## 8. 테스트

```bash
# 로컬 데브 서버 (데브 DB)
set -a; . ./.env.dev; set +a; PORT=3099 NODE_ENV=development node server/index.js

# QA 토큰 (데브 전용, 1시간 유효)
node scripts/_qa-rental-token.mjs agent agent      # admin | agent | contract

node --test tests/unit/rental-margin-engine.test.mjs tests/unit/rental-import-diff.test.mjs
node tests/e2e/rental-api.e2e.mjs http://localhost:3099 <토큰폴더>        # 권한·계약·엔진·공개API 81
node tests/e2e/rental-suppliers.e2e.mjs http://localhost:3099 <토큰폴더>  # 렌탈사 18곳 접수→계약처리 414
```
E2E는 데브 DB에만 쓰고, QA 표시 데이터(`QA렌탈테스트`)만 만들었다가 끝나면 지운다.

---

## 9. 운영 규칙

- **배포:** 로컬 → 데브 확인 → 대표 승인 → `master` 푸시(Railway 자동 배포).
- **DB 변경:** `server/db/YYYY-MM-DD-*.sql` 로 남기고 데브 먼저, 라이브는 승인 후. `TRUNCATE`/`CASCADE` 금지.
- **공개 채널(앱·홈페이지)에는 지급액 금액을 쓰지 않는다.** 개월 수로만. 상담 통화·CRM 계산기는 금액 안내 가능, MAX는 어디서도 고객에게 말하지 않는다.
- **개인정보:** 주민번호·카드번호·계좌 원문은 받지 않는다. 카드 정보는 계약 완료 7일 뒤 자동 마스킹(cron).
- **수집 데이터는 공식 출처만.** 상품 이미지·사양은 제조사/렌탈사 공식 페이지 또는 빌리고에서만 가져오고, 매칭 근거를 `notes`에 남긴다.

---

## 10. 현재 상태와 남은 일 (2026-09-18)

- 라이브 조건 55,112(판매중) / 모델 8,035. 엔진이 54,324 조건을 재계산해 적용.
- 이미지 없는 상품 635개(수집 진행 중), 상품명이 코드뿐인 상품 25개.
- 확인 필요: 청호 반값 개월 231건, 가이드·MAX 미설정 70건, 렌타나·렌플 제휴카드 없음.
- 상담 AI는 Anthropic API 크레딧이 있어야 동작(없으면 내부 추천으로 대체).
- 앱 화면은 미구현. [rental-app-integration.md](./rental-app-integration.md) 규격대로 bong2에서 붙이면 된다.
