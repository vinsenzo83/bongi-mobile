import { useLocation, useNavigate } from 'react-router-dom';
import { theme } from '../../styles/admin-theme.js';

// 와이어프레임 사이드바 정확 매핑
const MENU = [
  {
    section: '어드민',
    items: [
      { num: '01', path: '/admin', label: '대시보드', icon: '📊', exact: true },
      { num: '02', path: '/admin/members', label: '회원 관리', icon: '👥' },
    ],
  },
  {
    section: '상품 관리 (인터넷·TV)',
    items: [
      { num: '03', path: '/admin/products/skt', label: 'SKT 상품', icon: '📦' },
      { num: '04', path: '/admin/products/kt', label: 'KT 상품', icon: '📦' },
      { num: '05', path: '/admin/products/lgu', label: 'LG U+ 상품', icon: '📦' },
    ],
  },
  {
    section: '상품 관리 (기타)',
    items: [
      { num: '06', path: '/admin/rental', label: '렌탈 상품', icon: '🏠' },
      { num: '07', path: '/admin/used-phones', label: '중고폰 매입', icon: '📱' },
      { num: '08', path: '/admin/stores', label: '매장 · 시세 관리', icon: '📍' },
      { num: '09', path: '/admin/tickets', label: '티켓 관리', icon: '🎫' },
      { num: '10', path: '/admin/applications', label: '신청 현황', icon: '📋' },
      { num: '11', path: '/admin/buyback', label: '중고폰 매입 현황', icon: '📱' },
      { num: '13', path: '/admin/gifts', label: '사은품 관리', icon: '🎁' },
      { num: '14', path: '/admin/points', label: '포인트 관리', icon: '💰' },
      { num: '15', path: '/admin/reviews', label: '후기 관리', icon: '⭐' },
      { num: '16', path: '/admin/donjikimi', label: '돈지키미 관리', icon: '🔔' },
      { num: '17', path: '/admin/alerts', label: '알림 관리', icon: '🔔' },
      { num: '18', path: '/admin/statistics', label: '통계', icon: '📈' },
    ],
  },
  {
    section: 'AI 학습 데이터',
    items: [
      { num: '19', path: '/admin/ai/mobile-plans', label: '모바일 요금제', icon: '📱' },
      { num: '20', path: '/admin/ai/subsidy', label: '공시지원금', icon: '💲' },
      { num: '21', path: '/admin/ai/family-bundle', label: '가족결합', icon: '👨‍👩‍👧‍👦' },
      { num: '22', path: '/admin/ai/guides', label: '가이드', icon: '📖' },
    ],
  },
  {
    section: '시뮬레이터',
    items: [
      { num: '23', path: '/admin/simulator', label: '결합할인 시뮬레이터', icon: '🧮' },
    ],
  },
  {
    section: '크롤링',
    items: [
      { num: '24', path: '/admin/crawling', label: '크롤링 관리', icon: '🤖' },
    ],
  },
  {
    section: '개발 현황',
    items: [
      { num: '25', path: '/admin/checklist', label: '기능 체크리스트', icon: '✅' },
    ],
  },
];

export default function Sidebar({ collapsed, onToggle }) {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (item) => {
    if (item.exact) return location.pathname === item.path;
    return location.pathname === item.path || location.pathname.startsWith(item.path + '/');
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
            <div style={styles.logoText}>봉이모바일</div>
            <div style={styles.logoSub}>플랫폼 어드민</div>
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
                  {!collapsed && <span style={styles.menuNum}>{item.num}</span>}
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
    background: '#1e2433',
    height: '100vh',
    position: 'fixed',
    top: 0,
    left: 0,
    display: 'flex',
    flexDirection: 'column',
    transition: 'width 0.2s',
    zIndex: 100,
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '16px 14px',
    cursor: 'pointer',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    flexShrink: 0,
  },
  logoText: {
    fontSize: 11,
    fontWeight: 700,
    color: '#60a5fa',
    letterSpacing: 2,
  },
  logoSub: {
    fontSize: 13,
    fontWeight: 700,
    color: '#fff',
    marginTop: 2,
  },
  nav: {
    flex: 1,
    padding: '4px 0',
  },
  sectionLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.25)',
    fontWeight: 600,
    padding: '14px 16px 6px',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '8px 16px',
    background: 'transparent',
    border: 'none',
    borderLeft: '3px solid transparent',
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.12s',
    whiteSpace: 'nowrap',
    fontFamily: theme.sans,
  },
  menuActive: {
    background: 'rgba(96,165,250,0.12)',
    color: '#60a5fa',
    borderLeftColor: '#60a5fa',
    fontWeight: 600,
  },
  menuNum: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.2)',
    width: 18,
    flexShrink: 0,
    fontFamily: 'monospace',
  },
  collapseBtn: {
    padding: '8px',
    background: 'transparent',
    border: 'none',
    borderTop: '1px solid rgba(255,255,255,0.07)',
    color: 'rgba(255,255,255,0.3)',
    cursor: 'pointer',
    fontSize: 11,
    flexShrink: 0,
  },
};
