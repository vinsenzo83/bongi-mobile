// ═══ 공통 인증 모듈 — V5 인센티브 어드민 페이지 전용 ═══
// 모든 incentive-* 페이지에서 사용. <script src="/docs/_shared/incentive-auth.js"></script>로 로드.
//
// ⚠️ IIFE로 감싸 const(TOKEN_KEY/API 등)가 글로벌로 누출되지 않도록 격리.
//   각 incentive-*.html이 inline에 동일 식별자로 const TOKEN_KEY/API 등을 정의하고 있고,
//   둘 다 클래식 스크립트라 같은 글로벌 lexical scope를 공유해 SyntaxError 발생했음
//   ('Identifier API has already been declared' → inline script 미실행 → 빈 화면 사고).
//   함수만 window.X로 명시 export하여 호환성 유지 (inline에서 `getToken()` 직접 호출 동작).
//   (2026-05-15 권한 페이지 사고 후속)

(function() {
'use strict';

const TOKEN_KEY = 'incentive-auth-token-v1';
const REFRESH_TOKEN_KEY = 'incentive-refresh-token-v1';
const API = '/api/incentive';

const getToken = () => localStorage.getItem(TOKEN_KEY);
const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
};

async function login(email, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({email, password})
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '로그인 실패');
  setToken(data.access_token);
  if (data.refresh_token) localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
  return data;
}

async function tryRefreshToken() {
  const rt = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!rt) return false;
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ refresh_token: rt })
    });
    if (!res.ok) {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      return false;
    }
    const data = await res.json();
    setToken(data.access_token);
    if (data.refresh_token) localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
    return true;
  } catch { return false; }
}

async function fetchAgent() {
  const tk = getToken(); if (!tk) return null;
  const res = await fetch(API + '/agents/me', { headers: { Authorization: 'Bearer ' + tk }});
  if (res.status === 401) {
    if (await tryRefreshToken()) return fetchAgent();
    clearToken(); return null;
  }
  // 500/503 등 일시 에러는 토큰 보존 (부모 세션 보호) — null 반환만
  if (!res.ok) return null;
  return (await res.json()).agent;
}

// 🚀 GET 캐싱 — 5분 (settlement/rules/contracts 등 자주 읽히는 데이터)
const _apiCache = new Map();
const _CACHE_TTL = 5 * 60 * 1000;
async function apiGetCached(path, ttl) {
  const key = path;
  const now = Date.now();
  const ttlMs = ttl != null ? ttl : _CACHE_TTL;
  const c = _apiCache.get(key);
  if (c && c.expiresAt > now) return c.data;
  const tk = getToken();
  const res = await fetch(API + path, { headers: { Authorization: 'Bearer ' + tk }});
  if (res.status === 401 && await tryRefreshToken()) {
    return apiGetCached(path, ttl);
  }
  if (!res.ok) return null;
  const data = await res.json();
  _apiCache.set(key, { data, expiresAt: now + ttlMs });
  return data;
}
function apiCacheInvalidate(prefix) {
  if (!prefix) { _apiCache.clear(); return; }
  for (const k of Array.from(_apiCache.keys())) if (k.startsWith(prefix)) _apiCache.delete(k);
}

// API 호출 헬퍼 — 401 시 자동 refresh + 재시도
async function apiCall(method, path, body) {
  const tk = getToken();
  const opts = { method, headers: { Authorization: 'Bearer ' + tk }};
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  let res = await fetch(API + path, opts);
  if (res.status === 401 && await tryRefreshToken()) {
    opts.headers.Authorization = 'Bearer ' + getToken();
    res = await fetch(API + path, opts);
  }
  return res;
}

// ═══ 글로벌 export ═══
// inline 페이지가 `getToken()`·`apiCall(...)` 등을 직접 호출하므로 window에 attach.
// (inline의 `function getToken()` 같은 재선언도 가능하지만 외부 정의가 fallback 역할.)
window.getToken = getToken;
window.setToken = setToken;
window.clearToken = clearToken;
window.login = login;
window.tryRefreshToken = tryRefreshToken;
window.fetchAgent = fetchAgent;
window.apiCall = apiCall;
window.apiGetCached = apiGetCached;
window.apiCacheInvalidate = apiCacheInvalidate;

})();
