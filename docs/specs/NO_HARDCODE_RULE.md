# 정책값 하드코딩 금지 — 모든 수치는 데이터 연동 필수

**원칙**: 봉이 어드민의 모든 정책값(단가·임계·기본급·우수 보너스·페이백 한도·Tier·P·매니저 V5.1 등)은 **하드코딩 금지**. DB(`incentive_rules`·`rental_policy`)에서 활성 정책을 fetch한 값으로 동적 표시·계산.

---

## 금지 대상 (변경 시 깨지는 코드)

| 항목 | 잘못된 예 | 올바른 예 |
|---|---|---|
| Grade 단가 | `'20,000원/P'` 텍스트 | `${fmt(rates['1'])}원/P` |
| Grade 임계 P | `if (p < 16)` | `if (p < (thrs['2']?.points \|\| 16))` |
| 우수 건수 임계 | `우수 5건` 텍스트 | `우수 ${thrs['2']?.premium}건` |
| 우수 보너스 | `+ 10000 × 건수` | `+ ${bonus_per_premium} × 건수` |
| 페이백 한도 | `30,000원 초과` | `${payback_company_limit}원 초과` |
| 기본급 | `2,300,000원` | `${base_salary}원` |
| Tier 임계 | `마진 ≥ 250,000` | `마진 ≥ tier_s_min_margin` |
| tier_to_p | `S=2.0, A=1.5` | `tier_to_p JSONB 읽기` |
| 매니저 오버라이드율 | `12%` | `${manager_override_rate * 100}%` |
| weight_cost_per_p | `P × 70,000` | `P × ${weight_cost_per_p}` |

---

## 올바른 패턴

### 1) 페이지 로드 시 활성 정책 fetch
```js
let _itPolicy = null;
let _rtPolicy = null;
async function loadPolicies() {
  const [pIt, pRt] = await Promise.all([
    fetch('/api/incentive/rules', { headers: { Authorization: 'Bearer ' + TK } }).then(r => r.json()),
    fetch('/api/rental/policy',   { headers: { Authorization: 'Bearer ' + TK } }).then(r => r.json()),
  ]);
  _itPolicy = pIt.rule || pIt.rules || pIt || {};
  _rtPolicy = pRt.policy || pRt.rules || pRt || {};
}
```

### 2) DOM 동적 갱신 — id 부여 + JS 채움
```html
<span id="g2-rate">30,000</span>  <!-- HTML 기본값은 정책 fetch 실패 fallback -->
```
```js
const rates = _itPolicy?.grade_rates || { '1':20000, '2':30000, '3':40000 };
document.getElementById('g2-rate').textContent = fmt(rates['2']);
```

### 3) 동적 계산식
```js
const thrs = _itPolicy?.grade_thresholds || { '2':{points:16,premium:5} };
const g2P = Number(thrs['2']?.points || 16);   // fallback OK
if (p < g2P) { /* G1 */ }
```

### 4) Fallback default
- 정책 fetch 실패 또는 컬럼 누락 시를 대비한 **하드코딩 default는 허용** (`|| 30000` 패턴)
- 단, **실제 표시되는 값은 항상 활성 정책 우선**
- HTML 안의 기본 텍스트(`<span id="...">30,000</span>`)는 fallback용

---

## 자동 체크리스트

코드 작성·리뷰 시:
- [ ] grep `'20,?000원'`, `'30,?000원'`, `'40,?000원'`, `'2,?300,?000'`, `'10,?000'` — 0건이거나 fallback default만
- [ ] grep `if .* < 16`, `if .* >= 31` 같은 임계 비교 — 모두 정책 변수 사용
- [ ] 새 페이지·기능 추가 시 정책 사용 부분은 항상 fetch + DOM 갱신
- [ ] 정책 변경 시 BroadcastChannel `'incentive-policy'` / `'rental-policy'` 송신 (다른 탭 즉시 갱신)
- [ ] HTML 기본값과 실제 fetch 값 다를 때 의도된 fallback인지 확인

---

## 영향 시점

- 운영자가 [정책 관리]에서 임계·단가·기본급 변경 시 **모든 페이지 즉시 반영**
- 새로고침 1회로 모든 수치 갱신 (BroadcastChannel 송신 시는 새로고침 불필요)
- 정책 변경 history audit log에 기록되어 시간순 추적 가능

---

## 적용 끝 페이지 (2026-05-18 기준)

- `docs/incentive-rules.html` — 시뮬레이터 활성정책 동기화 (master d85f8ad)
- `docs/incentive-guide.html` — 급여 안내 IT·가전 Grade·Tier·tier_to_p (master 7990622)
- `docs/incentive-settlements.html` — 월별 정산 progress·KPI 동적 (master 4d469b0)

## 적용 필요 (TODO)

- `docs/tm-counselor.html` — V5 미리보기·견적의 정책 의존 부분 (대부분 RPC 응답 기반이라 자동, 표시 텍스트만 확인)
- `docs/incentive-products.html` — 상품 관리 마진·Tier 안내 텍스트
- `docs/incentive-contract.html` — 계약 처리 모달 안내 텍스트

---

## 관련 룰
- `docs/specs/MANUAL_SYNC_RULE.md` — 코드 변경 시 매뉴얼 동기화 필수
- `~/.claude/projects/-Users-vinsenzo/memory/feedback_no_hardcode.md` — 메모리 룰

## 위반 시 결과
- 정책 변경 후 화면이 안 바뀜 → 운영자·상담사 혼선
- 매뉴얼·가이드와 실제 동작 불일치
- 정책 정정 commit이 코드 변경까지 강제 → 사고 위험
