# V5 인센티브 — React 마이그레이션 TODO

> vanilla HTML(`docs/incentive-*.html`, `tm-counselor.html`, `calculator.html`) → React SPA (`/admin/v5/*`) 점진 이행 계획

마지막 갱신: 2026-05-05

---

## 1) 페이지별 마이그레이션 상태 (총 7개)

| # | 화면 | Route | 상태 | 비고 |
|---|---|---|---|---|
| 1 | 대시보드 | `/admin/v5/dashboard` | ✅ React 네이티브 | `Dashboard.jsx` — apiCall + KPI/표 |
| 2 | 계약 처리 | `/admin/v5/contracts` | ⚠️ 진행 중 (다른 에이전트) | 현재 `incentive-contract.html` iframe |
| 3 | 상품 관리 | `/admin/v5/products` | ⚠️ 진행 중 (다른 에이전트) | 현재 `incentive-products.html` iframe |
| 4 | 상담사 관리 | `/admin/v5/agents` | ⚠️ 진행 중 (다른 에이전트) | 현재 `incentive-agents.html` iframe |
| 5 | 정책 관리 | `/admin/v5/rules` | ⚠️ 진행 중 (다른 에이전트) | 현재 `incentive-rules.html` iframe |
| 6 | TM 견적·영업 | `/admin/v5/tm` | 🟡 thin wrapper | `TmCounselor.jsx` → `tm-counselor.html?embed=1` (170KB / ~3000라인) |
| 7 | 요금 계산기 / TM 데이터 | `/admin/v5/calc-data` | 🟡 thin wrapper | `CalcData.jsx` → `calculator.html?admin=1&embed=1` (196KB) — manager/admin role 가드 |

범례: ✅ 네이티브 | ⚠️ 작업 중 | 🟡 wrapper(임시) | 🔴 미착수

---

## 2) 현재 round 변경 사항 (이번 커밋)

- `client/src/pages/admin/v5/TmCounselor.jsx` 신규
- `client/src/pages/admin/v5/CalcData.jsx` 신규 (role 가드 포함)
- `client/src/App.jsx` — 두 라우트(`tm`, `calc-data`)를 thin wrapper로 교체
- 두 wrapper 공통 기능:
  - 풀 높이 iframe (`calc(100vh - 0px)`)
  - V5 인증 토큰 + agent 정보를 `postMessage('v5/auth-context')`로 iframe에 전달 (선택적, iframe이 listen 안 해도 무해)
  - iframe → 부모 메시지 리스너 (확장 포인트, 현재는 no-op)
  - URL에 `embed=1` 시그널 (vanilla 측이 header/login UI hide 용으로 활용 가능)

---

## 3) Phase 3 cleanup 체크리스트

### 3-1) vanilla HTML 정리

- [ ] **`docs/incentive-dashboard.html` 삭제** — Dashboard 네이티브 마이그레이션 완료, 1주 soak 후 제거
- [ ] **`docs/incentive-contract.html` 삭제** — Contract 네이티브 완료 + 1주 soak 후
- [ ] **`docs/incentive-products.html` 삭제** — Products 네이티브 완료 + 1주 soak 후
- [ ] **`docs/incentive-agents.html` 삭제** — Agents 네이티브 완료 + 1주 soak 후
- [ ] **`docs/incentive-rules.html` 삭제** — Rules 네이티브 완료 + 1주 soak 후
- [ ] **`docs/incentive-admin.html` 처리** — 두 가지 옵션 중 선택:
  - (A) iframe URL을 `/admin/v5/*` 로 업데이트 → 기존 lib에서 사용 중이라면 호환
  - (B) **완전 삭제** → V5AdminLayout이 이미 동일 역할 수행, 권장

### 3-2) iframe URL 업데이트 (옵션 A 시)

- [ ] `incentive-admin.html` 안에서 사이드바 링크가 `incentive-*.html` 직접 가리키는지 검사
- [ ] 모든 외부 링크/이메일/북마크가 `/admin/v5/*` 로 redirect 되는지 확인
- [ ] (있다면) 다른 vanilla 페이지에서 `incentive-*.html` 로 `window.open()`/`<a href>` 하는 코드 검색 후 갱신

### 3-3) IframePage 컴포넌트 제거

- [ ] 모든 라우트가 네이티브로 교체된 후 `client/src/pages/admin/v5/IframePage.jsx` 삭제
- [ ] `App.jsx`에서 `V5IframePage` import 제거

---

## 4) 장기 — TM-counselor + Calculator 네이티브 React 변환 (1~2주 프로젝트)

> 이 두 페이지는 너무 크고 로직이 많아 lightweight wrapper로 일단 유지. 별도 sprint에서 다룬다.

### 4-1) `tm-counselor.html` (170KB / ~3000 lines)

**기능 분해:**
- 좌측 패널: 고객 입력 폼 (이름/연락처/주소 — Daum Postcode 위젯 의존)
- 중앙 패널: 요금 계산 엔진 (D 변수 시스템 — 통신사·요금제·기기·할인율 매트릭스)
- 우측 패널: 견적 출력 + 인센티브 미리보기
- 영업 스크립트 단계 진행 UI

**계획:**
- [ ] `services/tm-engine.js` — D 변수 계산 로직을 순수 JS 모듈로 분리 (테스트 가능하게)
- [ ] `pages/admin/v5/tm/CustomerForm.jsx` (Daum Postcode 통합)
- [ ] `pages/admin/v5/tm/QuoteEngine.jsx`
- [ ] `pages/admin/v5/tm/IncentivePreview.jsx`
- [ ] `pages/admin/v5/tm/ScriptStepper.jsx`
- [ ] e2e 테스트 — 견적 결과 동일성 검증 (vanilla vs React)

### 4-2) `calculator.html` (196KB)

**기능 분해:**
- 요금 계산 엔진 (tm-counselor와 일부 중복 — 가능하면 공유)
- 어드민 데이터 편집 (요금제/할인율/통신사 row CRUD)
- 데이터 import/export (xlsx)

**계획:**
- [ ] tm-engine과 공유 코어 정리
- [ ] `pages/admin/v5/calc/DataEditor.jsx` — 어드민 편집 모드
- [ ] Supabase API 연동 (현 vanilla는 일부 fetch 미완 — `project_calc_admin_panel.md` 참고: 1·2·3·5·6·8 완료, 4·7 미완)
- [ ] xlsx import/export 유지 (SheetJS)

---

## 5) 현재 한계 / 위험요소

- **TM-counselor 와 Calculator 는 여전히 vanilla**. iframe 안에서 동작하므로:
  - 부모 React 라우터 변경이 iframe 내부에 영향 X (의도된 동작)
  - 인증 토큰은 동일 origin localStorage로 자동 공유됨 (별도 postMessage 없이도 OK)
  - vanilla 측 layout이 자체 header/login을 띄우면 sidebar와 중복 — `?embed=1` 처리 필요 (현재 vanilla 측 미구현 — 후속 PR)
- **incentive-admin.html 의 사이드바**와 V5AdminLayout 사이드바가 일시적으로 공존 가능. 옵션 B(완전 삭제) 권장.
- **role 가드는 sidebar(hide) + URL 가드(CalcData) 2중**이지만, 백엔드 API는 별도로 권한 체크해야 함 (이미 있음 — `server/routes/incentive*` 참고).

---

## 6) 참조

- 라우트 정의: `client/src/App.jsx` (V5 영역)
- 인증 hook: `client/src/hooks/useV5Auth.jsx`
- Layout/sidebar: `client/src/layouts/V5AdminLayout.jsx`
- 네이티브 참고 구현: `client/src/pages/admin/v5/Dashboard.jsx`
- 임시 wrapper 베이스: `client/src/pages/admin/v5/IframePage.jsx`
