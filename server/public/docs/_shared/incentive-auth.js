// ═══ 공통 인증 모듈 — V5 인센티브 어드민 페이지 전용 ═══
// 모든 incentive-* 페이지에서 사용. <script src="/docs/_shared/incentive-auth.js"></script>로 로드.

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
  if (!res.ok) { clearToken(); return null; }
  return (await res.json()).agent;
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
