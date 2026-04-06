import { useLocation, useNavigate } from 'react-router-dom';
import { theme } from '../../styles/admin-theme.js';

const MENU = [
  {
    section: '어드민',
    items: [
      { path: '/admin', label: '대시보드', icon: '📊', exact: true },
      { path: '/admin/members', label: '회원 관리', icon: '👥' },
    ],
  },
  {
    section: '상품 관리 (인터넷·TV)',
    items: [
      { path: '/admin/products/skt', label: 'SKT 상품', icon: '📦' },
      { path: '/admin/products/kt', label: 'KT 상품', icon: '📦' },
      { path: '/admin/products/lgu', label: 'LG U+ 상품', icon: '📦' },
    ],
  },
  {
    section: '상품 관리 (기타)',
    items: [
      { path: '/admin/rental', label: '렌탈 상품', icon: '🏠' },
      { path: '/admin/used-phones', label: '중고폰 매입', icon: '📱' },
      { path: '/admin/stores', label: '매장 · 시세', icon: '📍' },
      { path: '/admin/tickets', label: '티켓 관리', icon: '🎫' },
      { path: '/admin/applications', label: '신청 현황', icon: '📋' },
      { path: '/admin/buyback', label: '중고폰 매입 현황', icon: '📱' },
      { path: '/admin/gifts', label: '사은품 관리', icon: '🎁' },
      { path: '/admin/points', label: '포인트 관리', icon: '💰' },
      { path: '/admin/reviews', label: '후기 관리', icon: '⭐' },
      { path: '/admin/donjikimi', label: '돈지키미 관리', icon: '🔔' },
      { path: '/admin/alerts', label: '알림 관리', icon: '🔔' },
      { path: '/admin/statistics', label: '통계', icon: '📈' },
    ],
  },
  {
    section: 'AI 학습 데이터',
    items: [
      { path: '/admin/ai/mobile-plans', label: '모바일 요금제', icon: '📱' },
      { path: '/admin/ai/subsidy', label: '공시지원금', icon: '💲' },
      { path: '/admin/ai/family-bundle', label: '가족결합', icon: '👨‍👩‍👧‍👦' },
      { path: '/admin/ai/guides', label: '가이드', icon: '📖' },
    ],
  },
  {
    section: '시뮬레이터',
    items: [
      { path: '/admin/simulator', label: '결합할인 시뮬레이터', icon: '🧮' },
    ],
  },
  {
    section: '크롤링',
    items: [
      { path: '/admin/crawling', label: '크롤링 관리', icon: '🤖' },
    ],
  },
  {
    section: '개발 현황',
    items: [
      { path: '/admin/checklist', label: '기능 체크리스트', icon: '✅' },
    ],
  },
];

export default function Sidebar({ collapsed, onToggle }) {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (item) => {
    if (item.exact) return location.pathname === item.path;
    return location.pathname.startsWith(item.path);
  };

  return (
    <div style={{
      ...styles.sidebar,
      width: collapsed ? 60 : theme.sidebarWidth,
    }}>
      {/* 로고 */}
      <div style={styles.logo} onClick={() => navigate('/admin')}>
        <span style={{ fontSize: 16 }}>🐟</span>
        {!collapsed && (
          <div>
            <span style={styles.logoText}>봉이모바일</span>
            <span style={styles.logoSub}> 어드민</span>
          </div>
        )}
      </div>

      {/* 메뉴 */}
      <nav style={styles.nav}>
        {MENU.map(group => (
          <div key={group.section}>
            {!collapsed && (
              <div style={styles.sectionLabel}>{group.section}</div>
            )}
            {group.items.map(item => {
              const active = isActive(item);
              return (
                <button
                  key={item.path}
                  style={{
                    ...styles.menuItem,
                    ...(active ? styles.menuActive : {}),
                  }}
                  onClick={() => navigate(item.path)}
                  title={collapsed ? item.label : ''}
                >
                  <span style={{ fontSize: 13 }}>{item.icon}</span>
                  {!collapsed && <span>{item.label}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* 접기 버튼 */}
      <button style={styles.collapseBtn} onClick={onToggle}>
        {collapsed ? '▶' : '◀'}
      </button>
    </div>
  );
}

const styles = {
  sidebar: {
    background: theme.bgSidebar,
    height: '100vh',
    position: 'fixed',
    top: 0,
    left: 0,
    display: 'flex',
    flexDirection: 'column',
    transition: 'width 0.2s',
    zIndex: 100,
    overflow: 'hidden',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '14px 14px',
    cursor: 'pointer',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    flexShrink: 0,
  },
  logoText: {
    fontSize: 13,
    fontWeight: 700,
    color: '#60a5fa',
  },
  logoSub: {
    fontSize: 12,
    fontWeight: 500,
    color: '#fff',
  },
  nav: {
    flex: 1,
    overflow: 'auto',
    padding: '4px 0',
  },
  sectionLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.25)',
    fontWeight: 600,
    padding: '12px 14px 4px',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '7px 14px',
    background: 'transparent',
    border: 'none',
    borderLeft: '2px solid transparent',
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.12s',
    whiteSpace: 'nowrap',
    fontFamily: theme.sans,
  },
  menuActive: {
    background: 'rgba(96,165,250,0.1)',
    color: '#60a5fa',
    borderLeftColor: '#60a5fa',
    fontWeight: 600,
  },
  collapseBtn: {
    padding: '8px',
    background: 'transparent',
    border: 'none',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    color: 'rgba(255,255,255,0.3)',
    cursor: 'pointer',
    fontSize: 11,
    flexShrink: 0,
  },
};
