import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { label: '홈', path: '/' },
  { label: '후기', path: '/reviews' },
  { label: '돈지키미', path: '/my/guard' },
  { label: '친구초대', path: '/my/referral' },
  { label: '포인트', path: '/my/points' },
];

const SIDEBAR_ITEMS = [
  { icon: '\u{1F3E0}', label: '홈', path: '/my' },
  { icon: '\u{1F464}', label: '내 정보', path: '/my/profile' },
  { icon: '\u{1F4CB}', label: '신청 내역', path: '/my/applications' },
  { icon: '\u{1F381}', label: '사은품 현황', path: '/my/gifts' },
  { icon: '\u{1F4B0}', label: '포인트 내역', path: '/my/points' },
  { icon: '\u{1F514}', label: '돈지키미', path: '/my/guard' },
  { icon: '\u{1F46B}', label: '친구초대', path: '/my/referral' },
  { icon: '\u2B50', label: '후기', path: '/my/reviews' },
  { icon: '\u{1F4F1}', label: '중고폰 매입', path: '/my/used-phone' },
  { icon: '\u2699\uFE0F', label: '알림 설정', path: '/my/alerts' },
  { icon: '\u2705', label: '본인인증', path: '/my/verification' },
  { icon: '\u{1F3E6}', label: '계좌 관리', path: '/my/account' },
  { icon: '\u{1F4CD}', label: '주소 관리', path: '/my/address' },
];

const styles = {
  wrapper: {
    minHeight: '100vh',
    background: '#f5f6fa',
    fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  gnb: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    height: 56,
    background: '#1a2744',
    color: '#fff',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  logo: {
    fontSize: 16,
    fontWeight: 800,
    color: '#fbbf24',
    textDecoration: 'none',
  },
  gnbMenu: {
    display: 'flex',
    gap: 24,
  },
  gnbItem: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    textDecoration: 'none',
    cursor: 'pointer',
  },
  gnbItemActive: {
    fontSize: 13,
    color: '#fff',
    fontWeight: 700,
    textDecoration: 'none',
    cursor: 'pointer',
  },
  userBtn: {
    fontSize: 12,
    padding: '6px 14px',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: 6,
    color: '#fff',
    background: 'transparent',
    cursor: 'pointer',
  },
  body: {
    display: 'flex',
    maxWidth: 1100,
    margin: '0 auto',
    padding: '24px 16px',
    gap: 24,
  },
  sidebar: {
    width: 200,
    flexShrink: 0,
  },
  sidebarTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: '#1a2744',
    marginBottom: 10,
    padding: '0 4px',
  },
  sidebarItem: {
    display: 'block',
    padding: '8px 10px',
    fontSize: 13,
    color: '#666',
    textDecoration: 'none',
    borderRadius: 6,
    marginBottom: 2,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  sidebarItemActive: {
    display: 'block',
    padding: '8px 10px',
    fontSize: 13,
    color: '#1a2744',
    fontWeight: 700,
    textDecoration: 'none',
    borderRadius: 6,
    marginBottom: 2,
    background: '#e8ecf4',
    cursor: 'pointer',
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
};

export default function MyPageLayout() {
  const location = useLocation();
  const pathname = location.pathname;

  const isActive = (path) => {
    if (path === '/my') return pathname === '/my' || pathname === '/my/';
    return pathname.startsWith(path);
  };

  return (
    <div style={styles.wrapper}>
      <nav style={styles.gnb}>
        <Link to="/" style={styles.logo}>
          <span role="img" aria-label="fish">{'\u{1F41F}'}</span> 봉이모바일
        </Link>
        <div style={styles.gnbMenu}>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              style={isActive(item.path) ? styles.gnbItemActive : styles.gnbItem}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <button style={styles.userBtn}>
          {'홍길동님 \u25BE'}
        </button>
      </nav>

      <div style={styles.body}>
        <aside style={styles.sidebar}>
          <div style={styles.sidebarTitle}>마이페이지</div>
          <div>
            {SIDEBAR_ITEMS.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                style={isActive(item.path) ? styles.sidebarItemActive : styles.sidebarItem}
              >
                <span role="img" aria-label={item.label}>{item.icon}</span>{' '}{item.label}
              </Link>
            ))}
          </div>
        </aside>

        <main style={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
