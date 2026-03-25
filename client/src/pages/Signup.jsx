import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import SocialLoginButtons from '../components/SocialLoginButtons.jsx';

export default function Signup() {
  const [form, setForm] = useState({ email: '', password: '', passwordConfirm: '', name: '', phone: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const u = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.passwordConfirm) {
      return setError('비밀번호가 일치하지 않습니다');
    }
    if (form.password.length < 8) {
      return setError('비밀번호는 8자 이상이어야 합니다');
    }

    setLoading(true);
    try {
      await signup({ email: form.email, password: form.password, name: form.name, phone: form.phone, role: 'customer' });
      navigate('/mypage');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 420, position: 'relative' }}>
        <button onClick={() => navigate('/')} style={{ position: 'fixed', top: 16, right: 16, background: '#333', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', padding: '4px 10px', borderRadius: '50%', zIndex: 1000, lineHeight: 1 }}>✕</button>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🐟</div>
          <h2 style={{ fontSize: 24, marginBottom: 4 }}>회원가입</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>리턴AI에 가입하고 혜택을 받으세요</p>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px 14px', borderRadius: 8, fontSize: 14, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div className="card" style={{ marginBottom: 16 }}>
          <SocialLoginButtons />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border-color, #e5e7eb)' }} />
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>또는 이메일로 가입</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border-color, #e5e7eb)' }} />
        </div>

        <form onSubmit={handleSubmit} className="card">
          <div style={{ marginBottom: 16 }}>
            <label>이름 *</label>
            <input value={form.name} onChange={e => u('name', e.target.value)} placeholder="홍길동" required />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label>이메일 *</label>
            <input type="email" value={form.email} onChange={e => u('email', e.target.value)} placeholder="example@email.com" required />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label>비밀번호 *</label>
            <input type="password" value={form.password} onChange={e => u('password', e.target.value)} placeholder="8자 이상" required />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label>비밀번호 확인 *</label>
            <input type="password" value={form.passwordConfirm} onChange={e => u('passwordConfirm', e.target.value)} placeholder="비밀번호 다시 입력" required />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label>전화번호</label>
            <input value={form.phone} onChange={e => u('phone', e.target.value)} placeholder="010-1234-5678" />
          </div>
          <button type="submit" disabled={loading} className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center', opacity: loading ? 0.6 : 1 }}>
            {loading ? '가입 중...' : '회원가입'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 14 }}>
          이미 계정이 있으신가요? <Link to="/login" style={{ fontWeight: 600 }}>로그인</Link>
        </div>
      </div>
    </section>
  );
}
