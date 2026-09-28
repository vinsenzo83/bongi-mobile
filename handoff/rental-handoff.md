# 렌탈 시스템 인수인계 (핸드오프)

작성 2026-09-22 · 브랜치 `feat/rental-catalog` · 대상: 이 시스템을 이어받는 개발자

이 문서는 **"지금 어떤 상태이고, 무엇부터 해야 하며, 무엇을 조심해야 하는가"** 만 다룬다.

| 문서 | 내용 | 볼 때 |
|---|---|---|
| [rental-system.md](./rental-system.md) | 전체 구조·데이터 모델·API·엔진 수식 | 코드를 고치기 전 |
| [rental-app-integration.md](./rental-app-integration.md) | 앱(소비자)에 붙이는 공개 API 규격 | 앱 연동할 때 |
| **이 문서** | 현재 상태·미결 과제·운영 절차·함정 | **제일 먼저** |

문서의 모든 수치는 2026-09-22 라이브 DB에서 직접 조회한 값이다. 추정치는 없다.

---

## 1. 지금 상태 한 장

```
빌리고 월 엑셀(35+시트) ─ 적재 ─→ 모델 8,035 / 조건 55,910 (판매중 55,112)
                                        │
        ┌───────────────────────────────┼───────────────────────────────┐
        │                               │                               │
  AI 가이드·MAX 엔진              상담사 계산기(TM)                앱 공개 API
  주1회 월 06:00 자동             조건→지급액→접수→계약            금액 비노출
  가이드 미설정 70건만 남음        판매 1건(=QA 테스트분)           /public/models·/public/trust
```

| 항목 | 라이브 실측 | 비고 |
|---|---|---|
| 렌탈사 | 18 | |
| 모델 | 8,035 (이미지 없음 405, 그중 판매중 **202**) | 판매중=활성 조건 보유 |
| 조건(티켓) | 55,910 (활성 55,112, 일시불 1,677) | 티켓 `R`+6자리 |
| 가이드·MAX 적용 | 55,542 / 활성 중 미설정 **70** | 미설정 70건 = 리베이트 없는 건과 동일 |
| 색상 있는 조건 | 3,045 (모델 258개) | 청호·일부 공급사만 |
| 제휴카드 | 98행 (구간 없는 카드 2, 카드 미등록 렌탈사 2 = 렌타나·렌플) | |
| 프로모션 | 10 | |
| 경쟁사 벤치마크 | 16 (모요) | |
| 엔진 실행 기록 | 3회 | `rental_payout_runs` |
| 렌탈 판매 | 1건 | **QA 테스트 계약** — §5 참고 |

엔진 설정(`rental_engine_settings`, 라이브 현재값)
```
auto_apply = true, cycle = weekly_mon_06
policy = { rate_tiers:[{min:0, rate:0.3}]   // 렌탈 전용 배분율 30% (대표 결정: A안)
           min_band:0.05,                    // 가이드~MAX 최소 폭 5%
           min_guide_delta:10000,            // 이 값 미만 변화는 반영 안 함(가이드)
           min_max_delta:5000,               //  〃 (MAX)
           competitor_guide_ratio:0.9,       // 경쟁사 지원금 대비 가이드 목표 비율
           top_sales_share:0.1, productivity:50, current_rate:0.2, discretion:0.3 }
```

---

## 2. 🔴 지금 당장 해야 할 일 — 라이브 상품검색 장애

**증상**: 상담 화면 렌탈 탭에서 상품 검색이 "⚠ 서버 오류 — 잠시 후 다시 시도하세요". 카테고리를 고르면 정상, 필터 없는 전체 목록만 실패.

**원인**: `rental_cat_model_summary` 뷰가 조회할 때마다 모델 8,035 × 조건 55,910 을 전부 집계했다. 데이터가 늘며 PostgREST 의 `statement_timeout = 8s`(authenticator 역할)를 넘겨 `canceling statement due to statement timeout` → 500.

**수정 (코드 배포 불필요, DB 작업)**: `server/db/2026-09-21-rental-model-counters.sql`
1. 집계값을 `rental_cat_models` 컬럼으로 상주화 — `offer_count`, `payout_set_count`, `rebate_changed_count`, `min_display_fee`, `max_free_months`
2. `rental_cat_offers` 에 statement 트리거 3개(ins/upd/del) → `rental_cat_sync_model_counters(uuid[])` 가 **바뀐 모델만** 재계산 (대량 적재·엔진 일괄 갱신도 문 하나당 1회)
3. 뷰는 모델+공급사명 조인만 담당 — **출력 컬럼 동일하므로 서버 코드는 그대로**
4. 목록 정렬용 부분 인덱스 `rental_cat_models_list_idx`

**데브 검증 결과 (2026-09-21)**

| 검증 | 결과 |
|---|---|
| 옛 집계값 vs 새 컬럼 8,035행 1:1 대조 | 불일치 **0** |
| 목록 쿼리 | 1,335ms → **96ms** (shared buffer 79,164 → 7,849) |
| `/agent/models` 전체·카테고리·검색·5페이지 | 전부 200 (전체 0.25초) |
| 관리자 필터(payout/rebate_changed/linked/supplier) | 전부 200 |
| 트리거 동기화 (조건 단종→롤백) | 3→2→3 정상 |
| 3,000건 일괄 UPDATE 시 트리거 호출 | 1회, 총 1.2초 |
| 단위 24/24 · 렌탈 API E2E 81/81 · 공급사 접수폼 E2E 414/414 | 통과 |

**상태**: 데브 적용 완료, **라이브 미적용 — 대표 승인 대기**. 승인되면 위 SQL 을 라이브에서 1회 실행하면 끝이다(수 초, 데이터 값 변경 없음). 커밋 `2746c52`(로컬, 아직 push 안 함).

> 적용 후 확인: `GET /api/rental-catalog/agent/models?size=30&page=1` 이 200 이고 1초 이내인지.

---

## 3. 환경·접근

| | 라이브 | 데브 |
|---|---|---|
| Supabase 프로젝트 | `dugaqvvnhsgenhmhuyju` | `sesgdqbmophgmombelmn` |
| 환경변수 파일 | `.env` | `.env.dev` (git 미추적) |
| 배포 | `feat/rental-catalog` → `master` push → Railway 자동 | 로컬 서버 |

로컬 실행 (데브 DB)
```bash
set -a; . ./.env.dev; set +a; PORT=3099 NODE_ENV=development node server/index.js
```

QA 토큰 (데브 전용, 1시간 만료 · 라이브에서 실행하면 스크립트가 스스로 중단)
```bash
node scripts/_qa-rental-token.mjs <admin|agent|contract> <태그>
# → 스크래치패드에 qa_token_<태그> 파일로 저장된다
```

정적 문서(`docs/*.js`)는 Cloudflare 캐시 뒤에 있다. **JS 를 고치면 `docs/tm-counselor.html` 등에서 `?v=` 를 반드시 올린다** (현재 렌탈 스크립트 v26). 안 올리면 브라우저가 옛 파일을 계속 쓴다 — 실제로 색상 축이 안 보이던 사고가 이것 때문이었다.

---

## 4. 운영 루틴

### 4.1 월 엑셀 적재 (빌리고, 매월)
```bash
node scripts/rental-catalog-import.mjs <파일> --dry-run   # 미리보기(진단 출력)
node scripts/rental-catalog-import.mjs <파일>             # 확정 적재
```
- 어댑터: `server/services/rental-import/adapters/` — `water-a.js`(청호 등), `water-b.js`, `appliance-lg.js`, `appliance-etc.js`
- 조건 식별자 `condition_key` 가 같으면 **티켓번호가 유지된다.** 월이 바뀌어도 상담사가 쓰던 티켓이 살아 있어야 하므로 이 키를 함부로 바꾸지 말 것(변경 시 전량 티켓 재발번 = 사고).
- 적재 직후 엔진이 자동으로 한 번 돈다(`runIfAuto`).
- 청호 반값 개월은 엑셀에 없어서 공식몰 규칙표(`server/services/rental-import/data/chungho-half-rules.json`, 127건)로 채운다. 매월 적재해도 유지된다.

### 4.2 가이드·MAX 엔진
- 자동: 매주 월 06:00 KST + 엑셀 적재 직후. 수동: 상품관리 → 📐 마진 설계 → 🤖 AI 엔진 → 미리보기/적용.
- 실행 이력은 `rental_payout_runs`, 변경분은 `run_id` 로 묶여 **롤백 RPC** 가 있다.
- **사람이 손으로 고친 값은 건드리지 않는다** — `payout_updated_by` 가 `/엔진|engine|마진/` 에 걸리지 않으면 수동값으로 보고 보호한다.
- 같은 입력으로 다시 돌리면 변경 0건이어야 한다(멱등). 단위 테스트가 이것을 지킨다.

### 4.3 카드·프로모션
`scripts/rental-catalog-load-cards.mjs`, `...-load-promotions.mjs`. 전월실적 구간(`tiers`)이 비면 상담 화면에서 `max_discount` 로 단일 구간을 합성해 보여준다.

---

## 5. 미결 과제 (우선순위 순)

| # | 과제 | 실측 규모 | 막는 것 / 필요한 것 |
|---|---|---|---|
| 1 | **라이브 마이그레이션 적용** (§2) | 1회 실행 | 대표 승인 |
| 2 | 빌리고 문의 회신 대기 — 리베이트 없는 조건 | **70건** (LG헬로 68, 유버스 2) | 엑셀에 "정액수수료(최대)"로만 표기돼 금액 확정 불가 → 회신 전까지 가이드 산출 불가 |
| 3 | 청호 반값 개월 미확정 | **61건** | 공식몰 규칙표에 매칭 안 되는 건. 라벨에 `반값 N개월` 로만 표기 중 |
| 4 | 이미지 없는 판매중 모델 | **202건** | 캐리어 클라윈드·LG 업소용·장수돌침대·라셀르·씨넥스존·더함 G554Q·헨지디자인·다이슨 HD08 등 공식 이미지 미제공. 공식 출처만 쓸 것 |
| 5 | 상품설명(specs) 없음 | 179건 | 위와 같은 사유 다수 |
| 6 | 색상 — 남은 수집 | 판매중 7,831 중 **3,832(49%) 완료** · 미확보 3,999 | 2026-09-28 작업: 공식몰 스펙 노출 + 상품명 추출 1,456모델. 남은 경로는 LG헬로비전 437·LG전자몰 997 중 텍스트로 공개하는 건뿐이고, 렌탈나라·BS-on·삼성·쿠쿠·우성·라셀르·스마트·하이얼은 **상품 페이지에 색상을 글자로 적지 않는다**(표본 4개씩 확인) → 수집 불가 |
| 6-1 | 색상 복수 토큰 사람 확인 | **145건** | `["화이트","베이지"]`(삼성 무풍: 바디 화이트 + 패널 베이지)처럼 두 색이 한 상품에 쓰인 것. 자동 적용하지 않았다 — `node scripts/_tmp/derive-colors.mjs` 의 multi 목록 |
| 7 | 관리방식 없음(정수기·비데·청정기·연수기) | **12건** (유버스) | 유버스 회신 대기 |
| 8 | 월요금·일시불가 둘 다 없음 | 2건 (웰스) | 엑셀 원본 확인 필요 |
| 9 | 약정 없음(일시불 제외) | 4건 (큐밍) | 〃 |
| 10 | 카드 미등록 렌탈사 | 렌타나·렌플 | 카드사·구간 자료 필요. 구간 없는 카드 2건도 함께 |
| 11 | 정수기 엑셀 전수 검증 | — | `★ 26.09 (빌리고_정수기) 수수료 및 상품리스트_5차.xlsx` 원본이 로컬에 없다. 가전(app.xlsx 44,457건)은 검증 완료(불일치 0) |
| 12 | AI 상담 (라이브) | — | 라이브는 API 크레딧 필요. 세션 모드(`RENTAL_ASSIST_PROVIDER=session`)는 이 맥에서만 동작 |
| 13 | **라이브 QA 잔여 데이터 정리** | 렌탈 판매 1건 + 사은품 1건 | `QA렌탈테스트` 계약. 삭제는 대표 승인 후 |

---

## 6. 테스트

```bash
# 단위 (DB 불필요)
node --test tests/unit/*.mjs                       # 24개

# E2E — 데브 서버(3099) 를 먼저 띄우고, QA 토큰 3종(admin/agent/contract) 발급 후
node tests/e2e/rental-api.e2e.mjs http://localhost:3099 <토큰디렉터리>        # 81개
node tests/e2e/rental-suppliers.e2e.mjs http://localhost:3099 <토큰디렉터리>  # 414개
```
- 최근 실행(2026-09-21): **24/24 · 81/81 · 414/414 전부 통과.**
- E2E 는 QA 표시 데이터만 만들고 끝나면 그 행만 지운다. 데브 DB 전용이며, 스크립트가 데브가 아니면 스스로 중단한다.
- 공급사 스위트는 요청 수가 `apiLimiter`(분당 100회)를 넘기므로 429 를 만나면 `RateLimit-Reset` 만큼 기다렸다 재시도하도록 되어 있다(커밋 `4caaae8`). 서버 한도는 건드리지 않았다.

---

## 7. 반드시 지킬 것 (사고가 났던 지점)

**보안·공개 범위**
- **MAX 는 상담사 전용.** 고객 견적·공개 API·앱 어디에도 노출 금지.
- **리베이트는 관리자 전용.** 상담사 응답에 `total_fee` 를 넣었다가 보안 E2E 가 잡아낸 적 있다 — 일시불은 `lump_price` 만 내보낸다.
- **공개 채널(앱·홈페이지)은 페이백 금액 표기 금지** → "최대 N개월 무료" 로만. 상담 통화·CRM 계산기는 금액 안내 가능.

**운영**
- 라이브 DB 변경·master 배포는 **대표의 명시적 승인 후에만.**
- `TRUNCATE`·`CASCADE` 금지. 데브 DB 쓰기는 QA 표시 데이터만.
- 주민번호·카드번호·계좌 원문은 수집·저장하지 않는다.
- 외부 수집 데이터는 공식 출처만. 값을 지어내지 않는다.
- `.env` 와 무관한 `package.json` 변경은 커밋하지 않는다.

**코드**
- 집계 컬럼(`offer_count` 등)을 직접 UPDATE 하지 말 것 — 트리거가 재계산하므로 덮어써도 되돌아간다.
- 금액 계산에서 **부동소수 오차 주의.** `1,100,000/1.1 = 999999.99…`, `1−0.33 = 0.6699…` 로 DB numeric 과 어긋난다. 엔진은 `r6()` 로 6자리 반올림해서 막는다.
- Supabase Storage 업로드는 MIME 을 헤더로 판별해서 올린다(`application/octet-stream`·`image/avif` 거부됨). 1MB 초과는 1200px JPEG 로 변환.
- 페이지 데이터를 1,000행 넘게 읽을 때 **페이지네이션을 빼먹지 말 것.** 한 번 빠뜨려서 누락 건수를 853 → 실제와 다르게 보고한 적이 있다.

---

## 8. 파일 지도

| 영역 | 경로 |
|---|---|
| API 라우트 | `server/routes/rental-catalog.js` (관리자/상담사/공개 분리, `agentOffer()` 가 노출 필드 통제) |
| 마진 엔진 | `server/services/rental-margin-engine.js` (v1.3.0), `server/services/rental-payout-runner.js` |
| 접수 폼 생성 | `server/services/rental-application.js` (렌탈사별 필수정보 — 개인/사업자 분기) |
| 엑셀 적재 | `server/services/rental-import/**`, `scripts/rental-catalog-import.mjs` |
| 상담 계산기 | `docs/tm-rental.js` (v26), `docs/tm-counselor.html` |
| 계약처리 | `docs/contract-rental.js` |
| 상품관리·마진설계 | `docs/products-rental.js`, `docs/products-rental-margin.js`, `docs/incentive-products.html` |
| 사은품 원장 | `docs/incentive-gifts.html` (트리거 `bongi_gifts`) |
| DB 마이그레이션 | `server/db/2026-09-1*-rental-*.sql`, `server/db/2026-09-21-rental-model-counters.sql` |
| 임시 점검 스크립트 | `scripts/_tmp/` — `gaps.mjs`(누락 현황), `verify-excel.mjs`(엑셀 대조), `engine-verify.mjs` 등. 커밋용 코드가 아니라 조사용이다 |

누락 현황을 다시 뽑고 싶으면: `node scripts/_tmp/gaps.mjs` (읽기 전용, 라이브 조회).

---

## 9. 대표 결정이 필요한 것

1. §2 라이브 마이그레이션 적용 — **현재 라이브 장애 상태**
2. §5-13 라이브 QA 테스트 계약/사은품 삭제
3. §5-12 AI 상담 라이브용 API 크레딧
4. 빌리고 문의 회신 (§5-2·3·7·8·9·10) — 영업 채널로 요청 필요
