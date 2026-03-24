import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      // 역할에 따라 리다이렉트
      if (['agent', 'manager', 'super', 'ops'].includes(user.role)) {
        navigate('/admin');
      } else {
        navigate('/mypage');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🐟</div>
          <h2 style={{ fontSize: 24, marginBottom: 4 }}>로그인</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>리턴AI 계정으로 로그인하세요</p>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px 14px', borderRadius: 8, fontSize: 14, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="card">
          <div style={{ marginBottom: 16 }}>
            <label>이메일</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="example@email.com" required />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label>비밀번호</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="8자 이상" required />
          </div>
          <button type="submit" disabled={loading} className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center', opacity: loading ? 0.6 : 1 }}>
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 14 }}>
          계정이 없으신가요? <Link to="/signup" style={{ fontWeight: 600 }}>회원가입</Link>
        </div>
      </div>
    </section>
  );
}
