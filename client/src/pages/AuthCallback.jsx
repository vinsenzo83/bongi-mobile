import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

const API = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          throw new Error(sessionError.message);
        }

        if (!session) {
          throw new Error('세션을 찾을 수 없습니다');
        }

        // 토큰 저장
        sessionStorage.setItem('access_token', session.access_token);

        // 서버에 프로필 확인/생성 요청
        const meta = session.user.user_metadata || {};
        const res = await fetch(`${API}/auth/social-profile`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            name: meta.full_name || meta.name || meta.preferred_username || '',
            avatar: meta.avatar_url || meta.picture || '',
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || '프로필 처리 실패');
        }

        navigate('/mypage', { replace: true });
      } catch (err) {
        setError(err.message);
      }
    };

    handleCallback();
  }, [navigate]);

  if (error) {
    return (
      <section className="section">
        <div className="container" style={{ maxWidth: 420, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>&#x26A0;&#xFE0F;</div>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>로그인 실패</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>{error}</p>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/login', { replace: true })}
          >
            로그인 페이지로 돌아가기
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 420, textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>&#x1F510;</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 16 }}>로그인 처리 중...</p>
      </div>
    </section>
  );
}
