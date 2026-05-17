# 봉이 TM CRM 어드민 — as-is 인벤토리

> **기준**: LIVE (`https://admin.prexymarket.com/`), 2026-05-17 추출.
> **목적**: 개발자가 라이브 코드를 즉시 reverse-engineer 해서 신규 기능을 작성할 수 있는 핸드오프 패키지.

## 1. 진입점 · 인증

| 항목 | 값 |
|---|---|
| Frame URL | `https://admin.prexymarket.com/` → `docs/incentive-admin.html` 서빙 |
| 인증 | Supabase Auth (JWT ES256), `/api/auth/login` |
| Token 저장 | `localStorage["incentive-auth-token-v1"]` |
| Refresh | `localStorage["incentive-refresh-token-v1"]` |
| Role 출처 | `incentive_role_permissions` 테이블 + `/api/incentive/role-permissions` |
| Frame 레이아웃 | 상단 56px + 좌 사이드바 200px (접으면 48px) + 우 iframe `#g-iframe` |
| 메뉴 클릭 흐름 | tab-btn → iframe pool에 `data-src` 임베드 (재사용) |

iframe pool 캐시 우회: SW_VERSION + `?v=N` + iframe pool 3중 (memory: `feedback_dev_cache_busting.md`)

## 2. 4 roles × 19 menus 권한 매트릭스 (라이브)

소스: `/api/incentive/role-permissions` 응답 (2026-05-17 측정)

| menu slug | 한글 라벨 | iframe src | admin | manager | agent | contract |
|---|---|---|---|---|---|---|
| `dashboard` | 📊 대시보드 | `/docs/incentive-dashboard.html` | ✓ | ✓ | ✓ | ✓ |
| `contract` | 📋 계약 처리 | `/docs/incentive-contract.html` | ✓ | ✓ | ✓ | ✓ |
| `agents` | 👥 상담사 관리 | `/docs/incentive-agents.html` | ✓ | ✓ | · | · |
| `products` | 📦 상품 관리 | `/docs/incentive-products.html` | ✓ | · | · | · |
| `rules` | ⚙️ 정책 관리 | `/docs/incentive-rules.html` | ✓ | · | · | · |
| `db-sources` | 🗂️ DB 출처 | `/docs/incentive-db-sources.html` | ✓ | · | · | · |
| `customer-db` | 📞 콜 DB 관리 | `/docs/incentive-customer-db.html` | ✓ | · | · | · |
| `call-list` | 📋 내 콜 리스트 | `/docs/incentive-call-list.html` | ✓ | ✓ | ✓ | · |
| `call-stats` | 📈 콜 통계 | `/docs/incentive-call-stats.html` | ✓ | ✓ | ✓ | · |
| `settlements` | 💰 월별 정산 | `/docs/incentive-settlements.html` | ✓ | ✓ | ✓ | · |
| `goals` | 🎯 월간 목표 | `/docs/incentive-goals.html` | ✓ | ✓ | ✓ | ✓ |
| `agents-roi` | 👥 상담사 ROI 비교 | `/docs/incentive-agents-roi.html` | ✓ | ✓ | · | · |
| `distribution-requests` | 📥 분배 요청 | `/docs/incentive-distribution-requests.html` | ✓ | ✓ | ✓ | ✓ |
| `tm-counselor` | 📞 TM 상담 v1 (큐콜) | `/docs/tm-counselor.html` | ✓ | ✓ | ✓ | ✓ |
| `tm-counselor-v2` | ✏️ TM 상담 v2 (수동) | `/docs/tm-counselor.html?mode=manual` | ✓ | ✓ | ✓ | ✓ |
| `tm-data` | 🧮 TM 데이터 관리 | `/docs/calculator.html?admin=1` | ✓ | ✓ | · | · |
| `guide` | 📖 급여 안내 | `/docs/incentive-guide.html` | ✓ | ✓ | ✓ | ✓ |
| `manual` | 📚 사용 매뉴얼 | `/docs/incentive-manual.html` | ✓ | ✓ | ✓ | ✓ |
| `permissions` | 🔐 권한 관리 | `/docs/incentive-permissions.html` | ✓ | · | · | · |
| **합계** | | | **19** | **14** | **11** | **8** |

> ⚠️ **데브 drift**: `agent`와 `contract`가 데브에서 2026-05-15에 줄어듦 (8 / 4 메뉴). 라이브 미반영. 상세는 `environments.md` 2장.

## 3. 도메인 용어집

| 용어 | 의미 |
|---|---|
| **TM** | 텔레마케팅. 광주센터 운영. CTI/녹음 없음 — 상담사가 직접 발신·수신 |
| **콜DB** | 영업 대상 전화번호+이력. import → 분배 → 상담 → 계약 흐름 |
| **DB 등급** | S/A/B/R/C 5종. R = 인+TV·인터넷 단말 정확매칭만 (다른 분류 X) |
| **분배** | 콜DB를 상담사에게 할당. hybrid 모드(직접 + 매칭) |
| **retention/redistribution** | 미접촉 콜 회수 후 재분배 |
| **결합** | 인터넷 + TV (또는 +모바일) 같은 통신사 묶음 |
| **carrier** | SK / KT / LG 3사. DB 컬럼은 대문자 `SK`/`KT`/`LG`, 클라이언트는 `skt`/`kt`/`lgu` (매핑 필수) |
| **인+TV 기변 불가 규칙** | 현재 인터넷 통신사와 같은 통신사 인+TV 기변 X (3사 공통) |
| **사은품 vs 현금** | 계약 시 선택. **둘 다 즉시 지급** |
| **제로렌탈** | 가전 렌탈. 1개월 후 소유권 이전 |
| **snapshot 박제** | 가격·정책 변경 시 기존 영업의 가격 보존 |
| **매장 상담사 ≠ 콜센터 상담사** | 8 매장 판매자(매장)와 광주센터 상담사(콜)는 별개 조직. 매장 매칭 분배 불가 |
| **티켓** | 인터넷+TV 결합 카탈로그. **운영 105개** (SK 60 + KT 30 + LG 15) 모두 `calculator.html` JS가 메모리에서 생성. DB(`bongi_tickets`)는 와이어프레임용 (정리 후 active 105개 일치). 추가로 렌탈 티켓 50개(R001~R051) |
| **공개 와이어프레임** | `/admin/index.html` — 인증 없이 노출된 디자인 prototype (운영 어드민과 별개) |

상세: 메모리의 `project_bongi_*` 시리즈 참조.

## 4. 핵심 글로벌 헬퍼 (모든 iframe 공유)

| 파일 | 역할 |
|---|---|
| `docs/_shared/incentive-auth.js` | `TOKEN_KEY = 'incentive-auth-token-v1'`, login/logout/refresh, `getToken()` |
| `docs/_security.js` | CSP·DOMPurify·sanitize·민감정보 마스킹 |
| `docs/_calc-data-sync.js` | 시드 데이터 sync (B 모드 + 60s polling + BroadcastChannel) |

## 5. 패키지 구조

```
docs/specs/admin-as-is/
├── index.md                  ← 이 파일 (전체 IA + 매트릭스 + 용어집)
├── environments.md           ← 라이브·데브·로컬 drift 분석
├── data-model.md             ← DB 테이블 + 컬럼 + 인덱스
├── api-catalog.md            ← 전체 endpoint + 요청/응답 + 권한
├── shared-components.md      ← 인증/캐시/CSP/listCols 공통 패턴
├── known-pitfalls.md         ← memory 함정 정리 (listCols/RLS/인라인 const 등)
├── menu-{slug}.md × 19       ← 메뉴별 1-pager (개발 spec + 스크린샷)
└── screens/
    ├── 00-main.png
    ├── 01-dashboard.png
    ├── ... (19개 라이브 캡쳐)
    └── _manifest.json
```

## 6. 메뉴별 spec 작성 진행 상황 (완료)

| # | menu | spec | screen | HTML lines | endpoints |
|---|---|---|---|---|---|
| 1 | [dashboard](menu-dashboard.md) | ✓ | ✓ | 1,653 | 5 |
| 2 | [contract](menu-contract.md) | ✓ | ✓ | 2,645 | 2 |
| 3 | [agents](menu-agents.md) | ✓ | ✓ | 712 | 2 |
| 4 | [products](menu-products.md) | ✓ | ✓ | 1,345 | 4 |
| 5 | [rules](menu-rules.md) | ✓ | ✓ | 1,927 | 4 |
| 6 | [db-sources](menu-db-sources.md) | ✓ | ✓ | 452 | 0 |
| 7 | [customer-db](menu-customer-db.md) | ✓ | ✓ | 2,080 | 1 |
| 8 | [call-list](menu-call-list.md) | ✓ | ✓ | 735 | 1 |
| 9 | [call-stats](menu-call-stats.md) | ✓ | ✓ | 353 | 0 |
| 10 | [settlements](menu-settlements.md) | ✓ | ✓ | 509 | 0 |
| 11 | [goals](menu-goals.md) | ✓ | ✓ | 279 | 0 |
| 12 | [agents-roi](menu-agents-roi.md) | ✓ | ✓ | 260 | 0 |
| 13 | [distribution-requests](menu-distribution-requests.md) | ✓ | ✓ | 372 | 0 |
| 14 | [tm-counselor](menu-tm-counselor.md) | ✓ | ✓ | 6,254 | 8 |
| 15 | [tm-counselor-v2](menu-tm-counselor-v2.md) | ✓ | ✓ | (공유) | 8 |
| 16 | [tm-data](menu-tm-data.md) | ✓ | ✓ | 4,138 | 2 |
| 17 | [guide](menu-guide.md) | ✓ | ✓ | 465 | 0 |
| 18 | [manual](menu-manual.md) | ✓ | ✓ | 927 | 1 |
| 19 | [permissions](menu-permissions.md) | ✓ | ✓ | 495 | 0 |

> 자동 분석 결과 — 메뉴마다 1-pager 작성됨 (목적·권한·스크린샷·HTML·API endpoint·DB 테이블·function·함정·체크리스트).
> **endpoints=0**으로 잡힌 메뉴는 정적이거나, `incentiveAuth.authedFetch` 형태로 호출 (정규식 미매칭) — 직접 검증 필요.

## 7. 자매 문서

| 파일 | 내용 |
|---|---|
| [environments.md](environments.md) | LIVE·DEV·LOCAL 비교, drift 명시 |
| [data-model.md](data-model.md) | 27개 incentive_* 테이블 + 컬럼 + RLS |
| [api-catalog.md](api-catalog.md) | 296 routes (인증/위계/curl 예시) |
| [shared-components.md](shared-components.md) | 인증·캐시·iframe pool·페이지 골격·4곳 동기화 |
| [known-pitfalls.md](known-pitfalls.md) | 16개 함정 + 사고 이력 + 회피 패턴 |
