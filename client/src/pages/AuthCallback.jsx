import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

const API = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [needsInfo, setNeedsInfo] = useState(false);
  const [session, setSession] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { data: { session: s }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) throw new Error(sessionError.message);
        if (!s) throw new Error('세션을 찾을 수 없습니다');

        sessionStorage.setItem('access_token', s.access_token);
        setSession(s);

        const meta = s.user.user_metadata || {};
        const name = meta.full_name || meta.name || meta.preferred_username || '';
        const phone = meta.phone || '';

        if (name && phone) {
          await createProfile(s, name, phone);
          navigate('/mypage', { replace: true });
        } else {
          setForm({ name: name || '', phone: phone || '' });
          setNeedsInfo(true);
        }
      } catch (err) {
        setError(err.message);
      }
    };

    handleCallback();
  }, [navigate]);

  const createProfile = async (s, name, phone) => {
    const meta = s.user.user_metadata || {};
    const res = await fetch(`${API}/auth/social-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${s.access_token}`,
      },
      body: JSON.stringify({
        name,
        phone,
        avatar: meta.avatar_url || meta.picture || '',
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || '프로필 처리 실패');
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return setError('이름을 입력해주세요');
    if (!form.phone.trim()) return setError('전화번호를 입력해주세요');
    if (!/^01[016789]-?\d{3,4}-?\d{4}$/.test(form.phone.replace(/-/g, ''))) {
      return setError('올바른 전화번호를 입력해주세요');
    }

    try {
      setSubmitting(true);
      setError('');
      await createProfile(session, form.name.trim(), form.phone.trim());
      navigate('/mypage', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (error && !needsInfo) {
    return (
      <section className="section">
        <div className="container" style={{ maxWidth: 420, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>로그인 실패</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>{error}</p>
          <button className="btn btn-primary" onClick={() => navigate('/login', { replace: true })}>
            로그인 페이지로 돌아가기
          </button>
        </div>
      </section>
    );
  }

  if (needsInfo) {
    return (
      <section className="section">
        <div className="container" style={{ maxWidth: 420 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>👋</div>
            <h2 style={{ fontSize: 22, marginBottom: 4 }}>거의 다 됐어요!</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>서비스 이용을 위해 정보를 입력해주세요</p>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>이름 <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="홍길동"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>전화번호 <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="010-1234-5678"
                style={inputStyle}
              />
            </div>

            {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}

            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={submitting}
              style={{ width: '100%', height: 48 }}
            >
              {submitting ? '처리 중...' : '시작하기'}
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 420, textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>🔐</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 16 }}>로그인 처리 중...</p>
      </div>
    </section>
  );
}

const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' };
const inputStyle = { width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #444', background: '#2a2a2a', color: '#ececec', fontSize: 15, boxSizing: 'border-box' };
