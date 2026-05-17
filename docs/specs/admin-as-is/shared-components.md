# 공통 컴포넌트 · 패턴

> 모든 어드민 iframe 페이지가 공유하는 글로벌 헬퍼/규약. **신규 페이지 작성 시 반드시 따라야 함.**

## 1. 인증 (incentive-auth.js)

**파일**: `docs/_shared/incentive-auth.js`

### 토큰 저장 key (불변)
```js
const TOKEN_KEY = 'incentive-auth-token-v1';
const REFRESH_TOKEN_KEY = 'incentive-refresh-token-v1';
```

### 공개 API
```js
window.incentiveAuth = {
  login(email, password),
  logout(),
  getToken(),
  getUser(),
  authedFetch(url, opts),   // 자동으로 Bearer 토큰 + refresh 처리
  on(event, cb),             // 'login', 'logout', 'refresh'
};
```

### authedFetch 사용 패턴
```js
const res = await incentiveAuth.authedFetch('/api/incentive/agents');
if (!res.ok) { /* 401이면 자동 logout 처리됨 */ }
const data = await res.json();
```

⚠️ **직접 `fetch()` 호출 금지** — 토큰 누락·갱신 누락 발생.

## 2. 보안 (security.js)

**파일**: `docs/_security.js`

- DOMPurify 자동 로드
- 입력 sanitize (`window.sanitize(html)`)
- 민감정보 마스킹: `window.maskPhone('010-1234-5678')` → `010-****-5678`
- CSP 위반 모니터링

## 3. 시드 데이터 동기화 (calc-data-sync.js)

**파일**: `docs/_shared/_calc-data-sync.js`

- TM/calculator 페이지의 통신사·요금제·상품 마스터 동기화
- B 모드 (Broadcast Channel + 60초 polling)
- 페이지 간 실시간 동기화

## 4. iframe pool (incentive-admin.html)

부모(`incentive-admin.html`)가 iframe 1개를 풀에 보관 → 메뉴 클릭 시 `src` 교체.

### 메시지 통신
자식 iframe → 부모:
```js
window.parent.postMessage({ type: 'navigate', key: 'contract' }, '*');
```

이벤트 종류:
- `navigate` — 다른 메뉴로 이동
- `toast` — 부모 토스트 표시
- `dr-badge-update` — 분배요청 뱃지 카운트 갱신
- `logout` — 강제 로그아웃

## 5. 페이지 표준 골격

신규 페이지(`docs/incentive-*.html`)는 다음 골격 따라야 함:

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>봉이 — XXX</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css">
  <style>
    body { font-family: 'Pretendard Variable', sans-serif; background:#0f172a; color:#e2e8f0; }
    /* ... */
  </style>
  <script src="/docs/_security.js" defer></script>
  <script src="/docs/_shared/incentive-auth.js" defer></script>
</head>
<body>
  <!-- 콘텐츠 -->
  <script>
  document.addEventListener('DOMContentLoaded', async () => {
    if (!incentiveAuth.getToken()) {
      window.parent.postMessage({ type: 'logout' }, '*');
      return;
    }
    // 페이지 로직
  });
  </script>
</body>
</html>
```

## 6. 4곳 동기화 규칙 (listCols 함정)

신규 컬럼 추가 시 **반드시 4곳 모두** 동기화:

1. **HTML input** — `<input data-field="new_col">` 또는 `<input class="detail-input" data-field="new_col">`
2. **서버 destructure** — `const { ..., new_col, } = req.body || {};`
3. **서버 update** — `if (new_col !== undefined) update.new_col = new_col;`
4. **서버 listCols** — `const listCols = 'id,...,new_col,...'` (가장 자주 누락)

⚠️ `listCols`를 빼먹으면 GET 응답에 컬럼이 빠져 UI에 데이터 안 보임. 사용자가 "데이터 사라짐"으로 인지.

상세: `feedback_listcols_pitfall.md`

## 7. 환경 변수 (서버)

| 변수 | 용도 |
|---|---|
| `SUPABASE_URL` | `https://dugaqvvnhsgenhmhuyju.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버용 service_role (RLS 우회) |
| `SUPABASE_ANON_KEY` | 클라이언트용 (사용 안함, 서버 사용) |
| `NODE_ENV` | `production` / `staging` / `development` |
| `SENTRY_DSN` | 에러 추적 |

## 8. CSP (Content Security Policy)

라이브 CSP 예시 (응답 헤더):
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'
  https://cdn.jsdelivr.net https://cdnjs.cloudflare.com
  https://t1.daumcdn.net https://daumcdn.net https://kakao.com;
  ...
```

신규 외부 도메인 추가 시 server CSP 미들웨어 업데이트 필요.

## 9. 캐시 정책

- **Cloudflare 24h 캐시** (DYNAMIC 응답도 일부)
- **Service Worker**: `docs/_shared/sw.js` (sw 등록은 incentive-admin.html)
- 신규 배포 시 cache-buster:
  - `SW_VERSION` 증가 (`docs/_shared/sw.js`)
  - HTML `<link>` / `<script>` 에 `?v=YYYYMMDD`
  - iframe pool 캐시도 자동 무효화됨

## 10. 데브 ↔ 라이브 동기화 절차

1. 로컬 작업
2. 데브 push (`git push develop`)
3. 데브 검증 (Playwright + 수동)
4. 라이브 push (`git push master`)
5. 라이브 검증 (`bongi-deploy-verifier` agent)
6. 데브↔라이브 교차 검증

상세: `feedback_local_dev_live.md` (7단계 배포)

## 11. 신규 페이지 추가 체크리스트

- [ ] `docs/incentive-{slug}.html` 작성 (위 골격 준수)
- [ ] `docs/incentive-admin.html` 사이드바에 `<button class="tab-btn" data-key="{slug}" data-src="...">` 추가
- [ ] `incentive_role_permissions` 테이블 — admin role의 menus 배열에 slug 추가 (Supabase에서)
- [ ] 서버 API endpoint 추가 (필요시)
- [ ] **listCols 동기화** (4곳)
- [ ] Sentry alert 추가
- [ ] SW_VERSION 증가 + `?v=` 갱신
- [ ] 데브 → 라이브 검증
