# 봉이 storefront 개발 핸드오프 패키지

> 작성일: 2026-06-05
> 대상: 외부 개발자
> 범위: 봉이 가전 렌탈 고객용 storefront 4 화면 (계산기 + 어드민 3종)
> 백엔드: 95% 이미 구축됨 — UI만 신규

---

## 0. 한 줄 요약

> **봉이 가전 렌탈을 고객이 직접 비교·신청할 수 있는 4 화면 UI를 만들어야 합니다.**
> 백엔드 API·DB는 이미 라이브 운영 중. 데이터 435 product · 5,444 옵션 풀 적재 완료.

---

## 1. 작업 범위 — 4 화면만

| # | 화면 | 사용자 | 목적 |
|---|---|---|---|
| **1** | 가전 렌탈 계산기 (고객) | 고객 | chip 선택 → 가격 확인 → 셀프/상담원 신청 |
| **2** | 어드민 상품 정보 등록 | 운영자 | 새 가전 상품 등록·수정 + 엑셀 일괄 import |
| **3** | 어드민 카드 정보 등록 | 운영자 | 제휴카드 1·2·3 구간 등록 |
| **4** | 어드민 신청서 페이지 | 운영자 | 들어온 신청 처리 (셀프/상담원) |

❌ 이번 범위 아님: 회원·포인트·이벤트·CS·AI 어시스턴트 — 후속.

---

## 2. 첨부 파일

### 2-1. spec md
- `scope.md` — 범위 확정 (4 화면)
- `data.md` — 상품·카드·신청·프로모션 데이터 구축
- `storefront-plan.md` — UX 분석 (rentre·아정당 비교)

### 2-2. wireframe HTML (브라우저로 직접 열어 확인)
- `01-customer-calculator.html` — 정적 와이어프레임
- `02-admin-product-form.html` — 상품 등록 폼
- `03-admin-card-form.html` — 카드 등록 폼
- `04-admin-applications.html` — 신청서 list + 디테일 toast
- `storefront-rental-calculator.html` — **실제 API 호출하는 작동 prototype** (참고 구현)

### 2-3. API · DB 명세
- `api-endpoints.md` — server endpoint 일람
- `db-schema.md` — 사용할 DB table·컬럼

### 2-4. 환경
- `env-vars.md` — 필요 환경 변수 (값은 별도 전달)

---

## 3. 핵심 결정사항 (사용자 확정)

1. **렌트리 X · 아정당 ✅** — chip 직노출 + step wizard
2. **계산기가 메인 UI** — 고객용 진입은 계산기로 직진
3. **2가지 가입 경로만** — 셀프 신청 / 상담원 신청 (매장 방문 X)
4. **프로모션 데이터 정형** — rental_products 53 컬럼 + promo_tags_list 6 enum 활용 (신규 테이블 X)
5. **엑셀 import 활용** — 이미 동작 중 (`xlsx.full.min.js` 패턴)

---

## 4. 봉이가 이미 보유한 것 (재사용 95%)

| 영역 | 현황 |
|---|---|
| 상품 데이터 | rental_products 435건 + AI 자동 채움 8 컬럼 (description·feature_tags·specs·size·weight·care) |
| 카테고리 | rental_categories 6 활성 (정수기·공청·비데·매트리스·에어컨·TV) |
| 옵션 | rental_product_options 5,444건 (약정·관리·가격·리베이트·페이백·마진·AS·설치비) |
| 카드 | rental_partner_cards · brand·company alias · 1·2·3 구간 · card_snapshot 박제 |
| 정책 | rental_policy V2 (margin·payback·tier 자동 계산) |
| 신청 박제 | rental_sales (snapshot + card_snapshot + metadata) |
| 콜DB | incentive_customer_db (round-robin 분배 + retention + redistribution) |
| TM 상담 | tm-counselor v1 큐콜 · v2 수동 |
| 매장 | incentive_centers 8 직영 매장 |

→ **storefront UI만 신규 작업.** backend·DB·정책 모두 그대로 사용.

---

## 5. 작업 순서 (권장 P1~P5)

| Phase | 작업 | 산출물 | 예상 |
|---|---|---|---|
| **P1** | DB 마이그레이션 (rental_sales 3 컬럼) | customer_type·agent_phone·agent_relation 추가 | 0.5d |
| **P2** | 어드민 상품 등록 폼 (#2) | wireframe → React/Vue 컴포넌트 | 3d |
| **P3** | 어드민 카드 등록 폼 (#3) | 1·2·3 구간 + 미리보기 | 2d |
| **P4** | 고객 계산기 (#1) — 작동 prototype 참고 | step wizard 10단계 + 결과 panel | 5d |
| **P5** | 어드민 신청서 페이지 (#4) | list + 필터 + detail toast | 3d |

**합계: 약 14일** (1인 풀타임 기준)

---

## 6. 기술 스택

### 6-1. 권장
- Frontend: React (Vite) 또는 Vue 3 — 모노레포 `client/src/pages/storefront/`
- 또는 Vanilla JS HTML (현 admin·prototype 스타일 — 가장 빠름)
- Styling: Pretendard 폰트 + 다크/라이트 테마 (handoff 패키지 wireframe 색 그대로)
- 상태 관리: 단순 — useState/ref. 복잡 X (계산기 1 페이지)

### 6-2. 강제
- HTTP 통신: 기존 `/api/rental/*`·`/api/incentive/*` 그대로 사용
- 인증: localStorage `incentive-auth-token-v1` Bearer (어드민 페이지) / Supabase auth (고객 신규 가입)
- Service Worker: `/docs/sw.js` 패턴 따라 캐싱 (옵션)
- 카테고리 slug: water-purifier·air-purifier·bidet·mattress·aircon·tv (server는 slug 받음)
- carrierMap: DB SK/KT/LG ↔ client skt/kt/lgu

---

## 7. 주의 사항 (실수 방지)

1. **`/api/rental/products?category=` 는 한글 name 아닌 slug** (water-purifier 등)
2. **partner-cards `?category=` 는 한글 name** (정수기) — server 차이
3. **상품 등록 시 listCols 4곳 동기화** (HTML·destructure·update·listCols)
4. **이메일 매핑** — server에 `/agents` vs `/agents/all` 분리되어 있음 (실제 client `/agents/all` 사용)
5. **신청 시 snapshot 박제** — 가격·정책·카드를 그 시점 그대로 저장 (변경 후에도 고객 약속 보존)
6. **product brand alias** — 운영자가 등록 시 "코웨이" vs "코웨이모바일" 통일 강제
7. **이미지 업로드** — Supabase Storage bucket `product-images/{category-slug}/{product_id}.{ext}`

---

## 8. 환경 (라이브·데브)

- **라이브 어드민**: https://admin.prexymarket.com
- **데브 어드민**: https://dev-admin.prexymarket.com (Railway 자동 빌드 develop branch)
- **라이브 Supabase**: project `dugaqvvnhsgenhmhuyju`
- **데브 Supabase**: project `sesgdqbmophgmombelmn`
- **GitHub**: github.com/vinsenzo83/bongi-mobile
- **Branch**: master (라이브) · develop (데브) — 항상 양쪽 sync (cherry-pick)

---

## 9. 작업 완료 조건 (acceptance criteria)

- [ ] 4 화면 모두 라이브 backend 호출로 동작
- [ ] 셀프 신청 → `rental_sales` insert (source='storefront_self')
- [ ] 상담원 신청 → `incentive_customer_db` insert (source='storefront_chat')
- [ ] 어드민 상품 등록 → storefront 즉시 노출 (캐시 자동 무효화)
- [ ] 엑셀 일괄 import 동작 (현재 `incentive-products.html` 동작 그대로)
- [ ] 신청서 페이지 — 셀프·상담원 chip 필터 + status 변경 + 디테일 toast
- [ ] PC 1280px+ · 모바일 375px+ 반응형
- [ ] 다크/라이트 테마 (옵션)

---

## 10. 연락 / 의사결정

질문은 GitHub Issue 또는 직접 전달.
긴급 의사결정 ──> 본사 admin (`admin1@bongi.test` / `vinsenzo83@gmail.com`)
