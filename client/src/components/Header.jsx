import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';

const navItems = [
  { path: '/', label: '홈' },
  { path: '/products/internet', label: '인터넷+TV' },
  { path: '/products/rental', label: '가전렌탈' },
  { path: '/products/usim', label: '알뜰폰' },
  { path: '/products/usedPhone', label: '중고폰 매입' },
  { path: '/stores', label: '매장 안내' },
];

export default function Header() {
  const { pathname } = useLocation();
  const { user } = useAuth();

  return (
    <header style={styles.header}>
      <div className="container" style={styles.inner}>
        <Link to="/" style={styles.logo}>
          <span style={styles.logoIcon}>🐟</span>
          <span style={styles.logoText}>봉이모바일</span>
        </Link>
        <nav style={styles.nav}>
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              style={{
                ...styles.navLink,
                ...(pathname === item.path || pathname.startsWith(item.path + '/') ? styles.navActive : {}),
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link to="/apply" className="btn btn-primary" style={{ fontSize: 14 }}>상담 신청</Link>
          {user ? (
            <Link to="/mypage" className="btn btn-outline" style={{ fontSize: 13 }}>{user.displayName || '마이페이지'}</Link>
          ) : (
            <Link to="/login" className="btn btn-outline" style={{ fontSize: 13 }}>로그인</Link>
          )}
        </div>
      </div>
    </header>
  );
}

const styles = {
  header: {
    background: '#fff',
    borderBottom: '1px solid var(--border)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  inner: {
    display: 'flex',
    alignItems: 'center',
    height: 64,
    gap: 32,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    textDecoration: 'none',
  },
  logoIcon: { fontSize: 24 },
  logoText: { fontSize: 18, fontWeight: 800, color: 'var(--text)' },
  nav: {
    display: 'flex',
    gap: 4,
    flex: 1,
  },
  navLink: {
    padding: '8px 14px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    transition: 'all 0.15s',
  },
  navActive: {
    color: 'var(--primary)',
    background: '#eff6ff',
    fontWeight: 600,
  },
};
