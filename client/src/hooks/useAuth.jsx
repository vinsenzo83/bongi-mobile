import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);
const API = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 토큰 관리
  const getToken = useCallback(() => sessionStorage.getItem('access_token'), []);
  const setToken = useCallback((token) => {
    if (token) sessionStorage.setItem('access_token', token);
    else sessionStorage.removeItem('access_token');
  }, []);

  // FIX #1: 의존성 배열 수정 + 타임아웃 추가
  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    fetch(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setUser(data.user))
      .catch(() => { setToken(null); setUser(null); })
      .finally(() => { clearTimeout(timeout); setLoading(false); });
  }, [getToken, setToken]);

  // FIX #2: auth:expired 이벤트 구독 → 자동 로그아웃
  useEffect(() => {
    const handleExpired = () => {
      setToken(null);
      setUser(null);
    };
    window.addEventListener('auth:expired', handleExpired);
    return () => window.removeEventListener('auth:expired', handleExpired);
  }, [setToken]);

  // 로그인 — FIX #8: email trim + lowercase
  const login = async (email, password) => {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '로그인 실패');

    setToken(data.access_token);
    setUser(data.user);
    return data.user;
  };

  // 회원가입 — FIX #8: email trim + lowercase
  const signup = async ({ email, password, name, phone, role }) => {
    const res = await fetch(`${API}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password, name: name?.trim(), phone, role }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '회원가입 실패');

    if (data.session?.access_token) {
      setToken(data.session.access_token);
      setUser(data.user);
    }
    return data;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, getToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
