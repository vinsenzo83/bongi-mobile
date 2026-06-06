# 봉이 알뜰폰 개발 핸드오프

> 2026-06-06 · 봉이 = MVNO 대리점 (자체 사업자 X) · KT엠모바일·미디어로그·SK텔링크 제휴

---

## 0. 핵심

> 봉이가 KT·SK·LG U+ 망별 **각 5개 베스트 SKU (총 15종)** 출시 →
> 고객 storefront에서 비교·가입 → MVNO 본사에 신청 전달 → 가입 1건당 수수료 수익.

---

## 1. 작업 범위 — 4 화면

| # | 화면 | wireframe |
|---|---|---|
| 1 | 고객 — 요금제 list (망 chip 필터 + 15 SKU) | `wf-customer-01-plan-list.html` |
| 2 | 고객 — *#06# EID 자가 분기 | `wf-customer-02-eid-check.html` |
| 3 | 고객 — 가입 신청 1 page | `wf-customer-03-signup-step.html` |
| 4 | 고객 — 가입 완료 (M-ticket) | `wf-customer-04-complete.html` |
| 5 | 어드민 — 요금제 list (15 SKU) | `wf-admin-01-plan-list.html` |
| 6 | 어드민 — 요금제 편집 | `wf-admin-02-plan-edit.html` |
| 7 | 어드민 — 신청서 처리 | `wf-admin-03-subscriptions.html` |
| 8 | 어드민 — 매장 유심 재고 | `wf-admin-04-store-stock.html` |
| 9 | 어드민 — KPI 대시보드 | `wf-admin-05-kpi.html` |

---

## 2. 문서 list

| 파일 | 설명 |
|---|---|
| `README.md` | 본 문서 |
| `product-list.md` | **15 SKU spec** (SK·KT·LG 각 5개) |
| `data.md` | DB 모델 (5 신규 테이블) |
| `db-schema.md` | ERD · 마이그레이션 SQL |
| `api-endpoints.md` | `/api/mvno/*` |
| `scope.md` | 4 화면 범위 |
| `env-vars.md` | 환경 변수 |
| `_archive/` | 옛 spec (시장 조사·경쟁사·모빙 분석) |

---

## 3. 환경

- 라이브: https://admin.prexymarket.com
- 데브: https://dev-admin.prexymarket.com
- Supabase: dugaqvvnhsgenhmhuyju (라이브) / sesgdqbmophgmombelmn (데브)
- GitHub: github.com/vinsenzo83/bongi-mobile
- Branch: master / develop sync

---

## 4. 기술 스택

- frontend: 동일 storefront — `client/src/pages/mvno/` 또는 정적 HTML
- 인증: localStorage `incentive-auth-token-v1` (admin) / Supabase auth (고객)
- 통신: `/api/mvno/*` 신규 endpoint
- DB: 동일 Supabase

---

## 5. 작업 순서

| Phase | 작업 | 예상 |
|---|---|---|
| P1 | DB 마이그레이션 (5 신규 테이블 + 15 SKU 시드) | 1d |
| P2 | 어드민 요금제 등록·편집 (#5·#6) | 3d |
| P3 | 어드민 신청서 처리 (#7) | 2d |
| P4 | 고객 요금제 list·EID 분기·가입 form·완료 (#1~#4) | 5d |
| P5 | 어드민 매장·KPI (#8·#9) | 2d |

**합계: 약 13일 · 1인 풀타임**

---

## 6. 봉이 보유 인프라 — 재사용

- 8 직영 매장 (`incentive_centers`) — 효도폰 매장 5분 개통
- 콜DB · TM 큐콜 — 상담원 가입 path
- 권한 · 정산 · 엑셀 import 기존 패턴
