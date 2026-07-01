# 봉이 여행 eSIM 사업 — 개발 기획서

> 작성 2026-07 · 신규사업(여행/글로벌 데이터) · 현지 eSIM 업체 구조와 동일 개발
> 관련 메모리: `project_bongi_travel_esim`, `project_bongi_cs_center`

---

## 1. 개요 · 목적

봉이가 **여행용 eSIM/유심을 재판매**하는 신규사업. 해외여행 고객에게 통신사 로밍의 대안(최대 70% 저렴)을 봉이 플랫폼 안에서 판매.

- **조달**: China Mobile International(**CMLink / CMI-DW**) 도매 → 마진 붙여 재판매 (국내 유심사 84%가 이 구조)
- **핵심 경쟁우위**: 기존 통신고객 + 로밍 상담 트래픽으로 **CAC ≈ 0 크로스셀** → 신규 유심사보다 순마진 우위
- **수익성**: 매출총이익률 50~60%, 손익분기 ~월 90건, 후불정산(현금흐름 유리)

---

## 2. 타겟 업체 리스트

### A. 벤치마크 경쟁사 (국내 B2C — 프론트/UX·상품 구성 참고)
| 업체 | URL | 특징 | 조달처 |
|---|---|---|---|
| **유심사** | usimsa.com | 800만 고객, API 공개(역설계 완료) | **CMI-DW 84%** + BC-AZ·WEBBING·TSIM |
| **도시락 eSIM** | dosirakesim.com | 대형, 와이파이+eSIM 병행 | 미확인(API 비공개) |
| **로밍도깨비** | rokebi.com | eSIM 스토어 앱 1위 | 미확인(SPA/앱) |
| 말톡 | maaltalk.com | 통화+데이터 | — |
| 트립닷컴 | trip.com | OTA 번들 | — |

### B. 글로벌 벤치마크 (상품 구조·UX)
| 업체 | 특징 |
|---|---|
| **Airalo** | 200개국, 글로벌 1위, 앱 중심 |
| **Holafly** | 무제한 특화, 프리미엄 |

### C. API 공급 업체 (B2B 도매 애그리게이터 — 계약 타겟) ⭐
eSIM 도매를 **API/화이트라벨**로 공급하는 업체. 봉이 백엔드가 이 중 1~2곳과 계약해 연동.

| 공급 업체 | 유형·특징 | API/진입조건 | 비고 |
|---|---|---|---|
| **CMLink (CMI)** ⭐ | China Mobile Int'l, 190개국·400플랜 | 화이트라벨+API, 후불정산 | **유심사 84% 주력** — 1차 타겟 |
| **eSIM Access** | RedteaGO 연합, 3억+ 유저, SM-DP+ GSMA 인증 | HTTP API | 대형 애그리게이터 |
| **eSIM Go** | 영국, 도매 API + MVNE 플랫폼 | 도매API·어필리에이트 | 실시간 subscriber 가시성 |
| **Maya Mobile** | 글로벌 B2B 커넥티비티 | 파트너 배포 모델 | 여행+리셀 |
| **eSIM Card** | 700+ 리셀러·200개국 | 셋업비0·최소주문0 | 저진입 |
| **LotusFlare eSIM Express** | 클라우드 네이티브 CSP 도매 | 멀티테넌트 애그리게이션 | 대규모 |
| **Gohub** | 화이트라벨 리셀러 | API/SDK 빠른 연동 | — |
| **Airhub** | 미국, B2B 화이트라벨 | 화이트라벨 API | — |
| **Telnyx** | eSIM-as-a-service(embed) | API, 최소주문0 | 개발친화 |
| **MobiMatter** | API 리셀러 | 최소충전 $250 | — |
| **MicroESIM** | 도매 유통 | 화이트라벨 | — |

> **소싱 전략**: 1차 = **CMLink(CMI)** 직접 계약(유심사와 동일 원가 확보). 2차(리스크 분산·인기국 가격경쟁) = **eSIM Access / eSIM Go / Maya** 멀티소싱. 어댑터(`services/cmlink.js`)를 **공급사 무관 인터페이스**로 설계해 교체·병행 가능하게 함.
> ※ 유심사 실측 공급사 코드: CMI-DW(주력)·BC-AZ·WEBBING(이스라엘)·TSIM-D/DW(중국계) — 인기 아시아국 멀티소싱 근거.

### C-1. API 공급 업체 연락처 (파트너십 문의)
공식 사이트 크롤로 확보(2026-07). 이메일 미노출 업체는 파트너 폼 URL.

| 업체 | 이메일 | 파트너 폼/URL |
|---|---|---|
| **CMLink (CMI)** ⭐ | `cs@cmlink.com` · `esim_hello@cmlinkesim.com` | cmlink.com/global/en/contact-us |
| **eSIM Access** | `team@esimaccess.com` | esimaccess.com · docs.esimaccess.com |
| **eSIM Card** | `sales@esimcard.com`(영업) · `support@esimcard.com` · `tickets@esimcard.com` | esimcard.com/partners |
| **Maya Mobile** | `support@maya.net` | maya.net |
| **eSIM Go** | (폼) | esimgo.com/contact |
| **Gohub** | (폼) | gohub.com |
| **MobiMatter** | (폼) | mobimatter.com/reseller-partner |
| **Airhub** | (폼) | airhubapp.com |
| **Telnyx** | (폼, sales) | telnyx.com/products/esim |

> 1차 컨택: **CMLink `cs@cmlink.com` + 파트너 폼**으로 도매(wholesale/reseller) 조건 문의. 병행 견적: eSIM Access `team@esimaccess.com`, eSIM Card `sales@esimcard.com`.
> ⚠️ 메일 발송·계약은 **사용자(사람) 확인 후 진행** — 봉이가 임의 발송하지 않음.

---

## 3. 조달 구조 (역설계로 확인)

```
CMLink (CMI-DW) — 전세계 로밍 도매(Softbank·KDDI·AT&T·T-Mobile…)
  └ 화이트라벨 + API + SIM Profile(eSIM) + 후불정산
       ↓ 도매 (usdPrice, 계약가)
봉이 백엔드 (어댑터로 CMI API 연동)
  └ 마진 부가(소매가 산정)
       ↓
봉이 프론트 (목적지→상품→결제→eSIM QR 발급)
```

**유심사 실측 단가(일본, CMI-DW)**: 무제한 3일 9,900 / 5일 16,100 / 7일 21,800원(일당 2,700~3,300). 정량 1일 1GB 2,000 / 2GB 2,600원. → 봉이는 동급 또는 크로스셀 편의로 차별화.

---

## 4. 봉이 현재 개발 구조 (재사용 자산)

| 레이어 | 패턴 | eSIM 재사용 |
|---|---|---|
| **서버** | Express `server/routes/{module}.js` (22개) | `routes/esim.js` 신규 |
| **외부연동** | 어댑터 `server/services/*` (cti.js = CTI 어댑터, Mock→env플래그 교체) | `services/cmlink.js` (CMI 도매 어댑터) |
| **DB** | Supabase `supabase.from('table')` | `esim_*` 테이블 + `rental_categories.travel-esim`(✅dev 신설완료) |
| **카테고리** | `rental_categories` 메타(extra_fields 동적폼)·SQL 1줄 확장 | product_group `여행/글로벌` 신설 완료 |
| **어드민** | `docs/*.html` 상품관리·티켓·정산 | 상품관리 재사용(ticket_prefix `E`) |
| **고객** | `client/src/pages` React | `pages/esim/` 신규 |
| **주문/정산** | 신청→계약→페이백/포인트 자동트리거 | eSIM 주문도 동일 흐름 편입 |

> 개발 방식: master-map 로드맵대로 **모듈식 2주 스프린트** + 외부 API는 **Mock+플래그**(CMI 계약 전 개발 가능).

---

## 5. eSIM 업체 아키텍처 (유심사 역설계 = 우리 표준)

유심사 API 구조 (`apps-usimsa-prod-webapi-01.azurewebsites.net/esim/v1`):
```
GET /products                     → 목적지 68개 (국가/지역)
GET /products/{id}/plans          → 공급사별 플랜 (supplier·carrier 포함)
GET /plans/{planId}/options       → 옵션 210개 (days·quota·price·usdPrice)
(주문/발급/QR은 결제 후 별도)
```
= **3단 드릴다운(목적지→플랜→옵션) + 주문 → eSIM 프로파일(QR) 발급**. 봉이도 이 구조를 동일하게 구현.

---

## 6. 봉이 백엔드 설계 (`server/routes/esim.js` + `services/cmlink.js`)

### 6.1 어댑터 `services/cmlink.js` (cti.js 패턴 — Mock→플래그)
```js
// CMI/CMLink 도매 API 어댑터. env ESIM_PROVIDER=mock|cmlink 로 교체
export const cmlink = {
  listCountries(),                    // 목적지
  listPackages(countryCode),          // 상품(플랜)
  listOptions(packageId),             // 옵션(일수×데이터) + 도매가
  order(optionId, customer),          // 주문 → 프로파일/QR
  status(orderId),                    // 발급/사용 상태
};
```

### 6.2 라우트 `routes/esim.js` (REST, supabase 캐시)
```
GET  /api/esim/destinations              # 목적지(캐시)
GET  /api/esim/products/:destination      # 목적지별 상품
GET  /api/esim/plans/:planId/options      # 옵션(일수·데이터·소매가)
POST /api/esim/orders                      # 주문(결제 후) → CMI order → QR 저장
GET  /api/esim/orders/:id                  # 주문/발급 상태(QR·설치가이드)
```

### 6.3 가격 정책
- CMI 도매가(usdPrice) × 환율 + **마진율(정책 테이블, 하드코딩 금지)** = 소매가
- `feedback_no_hardcode` 준수 — 마진율·환율은 정책 fetch

---

## 7. 봉이 프론트 설계

### 7.1 고객 (`client/src/pages/esim/`) — 유심사류 플로우
```
목적지 선택(지도/검색) → 상품(일수·데이터·무제한/정량) → 요금 확인
  → 로그인/PASS → 결제 → eSIM QR + 설치가이드(iOS/Android) → 마이페이지(사용현황)
```
- 로밍 상담 챗봇(cs)에서 "로밍 vs eSIM 비교" 후 **딥링크로 상품 바로 연결**(크로스셀)

### 7.2 어드민 (`docs/` 상품관리 재사용)
- `rental_categories.travel-esim` extra_fields 동적폼(목적지·타입·데이터·일수·공급사)
- 상품 동기화(CMI API pull) · 마진율 설정 · 주문/발급 현황 · 티켓(E prefix)

---

## 8. DB 스키마 (신규)

```sql
-- 상품(목적지·플랜)
esim_products(id, destination, name, supplier, carrier, network, source, is_active, synced_at)
-- 옵션(일수×데이터)
esim_options(id, product_id, sim_type, data_type, days, quota, is_unlimited,
             wholesale_usd, fx_rate, margin_rate, retail_krw, package_id)
-- 주문·발급
esim_orders(id, customer_id, option_id, retail_krw, status, provider_order_id,
            qr_url, install_guide, ordered_at, activated_at)
```
+ `rental_categories.travel-esim`(✅ dev 신설) — 어드민 카테고리 노출·티켓 prefix.

---

## 9. 개발 로드맵 (모듈식 2주 스프린트)

| 주차 | 작업 |
|---|---|
| 1주 | `services/cmlink.js` Mock 어댑터 + `routes/esim.js` + DB 스키마 + 유심사 벤치 데이터 시드 |
| 2주 | 고객 프론트(목적지→상품→결제 Mock) + 어드민 상품관리 + cs 챗봇 크로스셀 딥링크 |
| (계약 후) | CMI/CMLink 실계약 → env 플래그로 어댑터 교체 → 실주문·QR발급·정산 연동 |

> 외부 API(CMI)는 계약 전까지 Mock으로 전 기능 개발 → 계약 후 플래그 교체(봉이 표준: Tredit·PASS와 동일).

---

## 10. 리스크 · 인간 필요 블로커

- **CMI/CMLink 파트너 계약**(도매가·최소물량·정산) — 인간 협상 필요
- 소매 가격경쟁(유심사·도시락·로밍도깨비) → **가격보다 "상담+판매 원스톱" 편의로 차별화**
- 결제·PG·전자상거래 고지(청약철회·환불) 법무 검토
- eSIM QR 발급 실패/재발급 CS 플로우

---

## 부록: 확보한 실측 데이터 (별도 조사)
- 유심사 API 68목적지·공급사(CMI-DW 84%)·일본 210옵션 단가 — `project_bongi_travel_esim` 메모리
- cs 무인 고객센터 로밍 상품(baro·제로프리미엄 등) — 크로스셀 연결점
