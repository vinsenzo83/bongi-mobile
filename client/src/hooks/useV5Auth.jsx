// V5 인센티브 시스템 전용 인증 hook
// — 기존 vanilla HTML과 동일한 localStorage 기반 (refresh_token 30일 자동 갱신)
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

const TOKEN_KEY = 'incentive-auth-token-v1';
const REFRESH_KEY = 'incentive-refresh-token-v1';
const API = '/api/incentive';

const V5AuthContext = createContext(null);

export function V5AuthProvider({ children }) {
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);

  const getToken = useCallback(() => localStorage.getItem(TOKEN_KEY), []);
  const setToken = useCallback((t) => {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  }, []);

  const tryRefreshToken = useCallback(async () => {
    const rt = localStorage.getItem(REFRESH_KEY);
    if (!rt) return false;
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: rt }),
      });
      if (!res.ok) {
        localStorage.removeItem(REFRESH_KEY);
        return false;
      }
      const data = await res.json();
      setToken(data.access_token);
      if (data.refresh_token) localStorage.setItem(REFRESH_KEY, data.refresh_token);
      return true;
    } catch { return false; }
  }, [setToken]);

  const fetchAgent = useCallback(async () => {
    const tk = getToken();
    if (!tk) return null;
    let res = await fetch(`${API}/agents/me`, { headers: { Authorization: `Bearer ${tk}` } });
    if (res.status === 401) {
      if (await tryRefreshToken()) {
        const newTk = getToken();
        res = await fetch(`${API}/agents/me`, { headers: { Authorization: `Bearer ${newTk}` } });
      } else {
        setToken(null);
        return null;
      }
    }
    if (!res.ok) { setToken(null); return null; }
    return (await res.json()).agent;
  }, [getToken, setToken, tryRefreshToken]);

  const login = useCallback(async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '로그인 실패');
    setToken(data.access_token);
    if (data.refresh_token) localStorage.setItem(REFRESH_KEY, data.refresh_token);
    // 응답에 incentive_agent 포함되어 있으면 즉시 사용 (round-trip 절감)
    const a = data.incentive_agent || await fetchAgent();
    setAgent(a);
    return a;
  }, [fetchAgent, setToken]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    setAgent(null);
  }, []);

  // 초기 로드
  useEffect(() => {
    fetchAgent().then(a => { setAgent(a); setLoading(false); });
  }, [fetchAgent]);

  // API 호출 헬퍼
  const apiCall = useCallback(async (method, path, body) => {
    const tk = getToken();
    const opts = { method, headers: { Authorization: `Bearer ${tk}` } };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    let res = await fetch(`${API}${path}`, opts);
    if (res.status === 401 && await tryRefreshToken()) {
      opts.headers.Authorization = `Bearer ${getToken()}`;
      res = await fetch(`${API}${path}`, opts);
    }
    return res;
  }, [getToken, tryRefreshToken]);

  const value = useMemo(() => ({
    agent, loading, login, logout, getToken, fetchAgent, apiCall,
    isAdmin: agent?.role === 'admin',
    isManagerOrAdmin: agent?.role === 'admin' || agent?.role === 'manager',
    isContractAccess: ['admin', 'manager', 'contract'].includes(agent?.role),
  }), [agent, loading, login, logout, getToken, fetchAgent, apiCall]);

  return <V5AuthContext.Provider value={value}>{children}</V5AuthContext.Provider>;
}

export function useV5Auth() {
  const ctx = useContext(V5AuthContext);
  if (!ctx) throw new Error('useV5Auth must be inside V5AuthProvider');
  return ctx;
}
