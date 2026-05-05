// V5 인센티브 어드민 — 통합 SPA Layout
// 좌측 사이드바 + 본문 라우터
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { V5AuthProvider, useV5Auth } from '../hooks/useV5Auth.jsx';

// V5 메뉴 정의 (role 기반 자동 hide)
const V5_MENU = [
  { path: '/admin/v5/tm',         icon: '📞', label: 'TM 견적·영업',  roles: ['agent','manager','admin'] },
  { path: '/admin/v5/dashboard',  icon: '📊', label: '대시보드',       roles: ['manager','contract','admin'] },
  { path: '/admin/v5/contracts',  icon: '📋', label: '계약 처리',      roles: ['manager','contract','admin'] },
  { path: '/admin/v5/agents',     icon: '👥', label: '상담사 관리',    roles: ['admin'] },
  { path: '/admin/v5/products',   icon: '📦', label: '상품 관리',      roles: ['admin'] },
  { path: '/admin/v5/calc-data',  icon: '🧮', label: 'TM 데이터',      roles: ['manager','admin'] },
  { path: '/admin/v5/rules',      icon: '⚙️', label: '정책 관리',      roles: ['admin'] },
];

function LoginBox() {
  const { login } = useV5Auth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try { await login(email, password); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <form onSubmit={submit} style={{ background: 'linear-gradient(135deg,#1e293b,#0f172a)', border: '1px solid #475569', borderRadius: 12, padding: 32, width: '100%', maxWidth: 380 }}>
        <h2 style={{ fontSize: 20, color: '#f8fafc', fontWeight: 800, marginBottom: 6 }}>🔐 V5 인센티브 어드민</h2>
        <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 20 }}>인증된 사용자만 접근 가능</p>
        <input type="email" placeholder="이메일" required autoComplete="username"
          value={email} onChange={e => setEmail(e.target.value)}
          style={inputStyle} />
        <input type="password" placeholder="비밀번호" required autoComplete="current-password"
          value={password} onChange={e => setPassword(e.target.value)}
          style={{ ...inputStyle, marginTop: 10 }} />
        {error && <div style={{ color: '#fca5a5', fontSize: 11, marginTop: 10 }}>⚠️ {error}</div>}
        <button type="submit" disabled={loading} style={btnStyle}>
          {loading ? '로그인 중...' : '로그인'}
        </button>
        <div style={{ fontSize: 10, color: '#64748b', marginTop: 14, lineHeight: 1.6 }}>
          테스트: <code style={{ background: '#0f172a', padding: '1px 5px', borderRadius: 3 }}>admin1@bongi.test</code> / <code>pass1234!</code>
        </div>
      </form>
    </div>
  );
}

const inputStyle = { width: '100%', padding: '10px 14px', background: '#0f172a', border: '1.5px solid #475569', color: '#f8fafc', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' };
const btnStyle = { width: '100%', marginTop: 16, padding: 12, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 800, fontSize: 14, cursor: 'pointer' };

function Layout() {
  const { agent, loading, logout } = useV5Auth();
  const navigate = useNavigate();

  if (loading) return <div style={{ padding: 40, color: '#94a3b8' }}>인증 확인 중...</div>;
  if (!agent) return <LoginBox />;

  const visibleMenu = V5_MENU.filter(m => m.roles.includes(agent.role));
  const handleLogout = () => { logout(); navigate('/admin/v5'); };
  const roleColor = agent.role === 'admin' ? '#dc2626' : agent.role === 'manager' ? '#3b82f6' : agent.role === 'contract' ? '#22c55e' : '#94a3b8';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: "'Pretendard Variable', sans-serif" }}>
      {/* 사이드바 */}
      <aside style={{ width: 230, background: '#1e293b', borderRight: '1px solid #334155', padding: '20px 14px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: '#f8fafc', marginBottom: 4 }}>V5 인센티브</div>
        <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 20 }}>봉이모바일 어드민</div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {visibleMenu.map(m => (
            <NavLink key={m.path} to={m.path} end={m.path.endsWith('/v5')}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 7,
                fontSize: 13, fontWeight: 700,
                color: isActive ? '#fff' : '#94a3b8',
                background: isActive ? 'rgba(59,130,246,0.18)' : 'transparent',
                borderLeft: isActive ? '3px solid #60a5fa' : '3px solid transparent',
                textDecoration: 'none',
              })}>
              <span style={{ fontSize: 16 }}>{m.icon}</span>
              <span>{m.label}</span>
            </NavLink>
          ))}
        </nav>
        <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid #334155' }}>
          <div style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 700 }}>👤 {agent.name}</div>
          <div style={{ fontSize: 9, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
            <span style={{ background: roleColor, color: '#fff', padding: '1px 6px', borderRadius: 3, fontWeight: 800 }}>{agent.role}</span>
            <span>{agent.center}</span>
          </div>
          <button onClick={handleLogout} style={{ marginTop: 10, width: '100%', padding: '6px 0', background: '#475569', color: '#fff', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>로그아웃</button>
        </div>
      </aside>

      {/* 본문 */}
      <main style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <Outlet />
      </main>
    </div>
  );
}

export default function V5AdminLayout() {
  return (
    <V5AuthProvider>
      <Layout />
    </V5AuthProvider>
  );
}
