import { useState } from 'react';
import { supabase } from '../lib/supabase.js';

const PROVIDERS = [
  {
    id: 'kakao',
    label: '카카오로 시작하기',
    bg: '#FEE500',
    color: '#000000',
    logo: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 3C5.58 3 2 5.82 2 9.25C2 11.37 3.47 13.22 5.68 14.25L4.93 17.07C4.88 17.25 5.09 17.4 5.25 17.29L8.59 15.14C9.05 15.2 9.52 15.25 10 15.25C14.42 15.25 18 12.43 18 9.25C18 5.82 14.42 3 10 3Z" fill="#000000"/>
      </svg>
    ),
  },
  {
    id: 'naver',
    label: '네이버로 시작하기',
    bg: '#03C75A',
    color: '#FFFFFF',
    logo: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M13.36 10.53L6.4 3H3V17H6.64V9.47L13.6 17H17V3H13.36V10.53Z" fill="#FFFFFF"/>
      </svg>
    ),
  },
  {
    id: 'google',
    label: 'Google로 시작하기',
    bg: '#FFFFFF',
    color: '#333333',
    border: '1px solid #dadce0',
    logo: (
      <svg width="20" height="20" viewBox="0 0 20 20">
        <path d="M19.6 10.23c0-.68-.06-1.36-.17-2.02H10v3.83h5.4a4.61 4.61 0 01-2 3.03v2.5h3.24c1.9-1.74 2.96-4.31 2.96-7.34z" fill="#4285F4"/>
        <path d="M10 20c2.7 0 4.97-.9 6.62-2.42l-3.23-2.51c-.9.6-2.04.95-3.39.95-2.6 0-4.81-1.76-5.6-4.12H1.07v2.6A9.99 9.99 0 0010 20z" fill="#34A853"/>
        <path d="M4.4 11.9a5.98 5.98 0 010-3.8V5.5H1.07a9.99 9.99 0 000 9l3.33-2.6z" fill="#FBBC05"/>
        <path d="M10 3.98c1.47 0 2.79.5 3.82 1.5l2.87-2.87A9.96 9.96 0 0010 0 9.99 9.99 0 001.07 5.5L4.4 8.1C5.19 5.74 7.4 3.98 10 3.98z" fill="#EA4335"/>
      </svg>
    ),
  },
];

export default function SocialLoginButtons() {
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState('');

  const handleSocialLogin = async (provider) => {
    setLoading(provider);
    setError('');

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (oauthError) {
        throw new Error(oauthError.message);
      }
      // 리다이렉트 — 이후 AuthCallback에서 처리
    } catch (err) {
      setError(err.message);
      setLoading(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {error && (
        <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px 14px', borderRadius: 8, fontSize: 14 }}>
          {error}
        </div>
      )}

      {PROVIDERS.map(({ id, label, bg, color, border, logo }) => (
        <button
          key={id}
          type="button"
          disabled={loading !== null}
          onClick={() => handleSocialLogin(id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            width: '100%',
            height: 48,
            background: bg,
            color,
            border: border || 'none',
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 600,
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading && loading !== id ? 0.5 : 1,
            transition: 'opacity 0.2s',
          }}
        >
          {logo}
          {loading === id ? '연결 중...' : label}
        </button>
      ))}
    </div>
  );
}
