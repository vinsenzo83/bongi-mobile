import { useLocation, useNavigate } from 'react-router-dom';
import { theme } from '../../styles/admin-theme.js';

const MENU = [
  {
    section: '플랫폼 관리',
    icon: '🏢',
    items: [
      { path: '/admin', label: '홈', icon: '🏠', exact: true },
      { path: '/admin/products', label: '상품 관리', icon: '📦' },
      { path: '/admin/gifts', label: '사은품 관리', icon: '🎁' },
      { path: '/admin/settlements', label: '수수료 정산', icon: '💰' },
      { path: '/admin/reviews', label: '후기 관리', icon: '⭐' },
      { path: '/admin/members', label: '회원 관리', icon: '👥' },
      { path: '/admin/referrals', label: '친구초대', icon: '🤝' },
      { path: '/admin/cash', label: '리턴캐쉬', icon: '💳' },
    ],
  },
  {
    section: 'CRM',
    icon: '📋',
    items: [
      { path: '/admin/crm', label: '오늘 할 일', icon: '📝', exact: true },
      { path: '/admin/crm/customers', label: '고객 리스트', icon: '👤' },
      { path: '/admin/crm/contracts', label: '계약 관리', icon: '📄' },
      { path: '/admin/crm/kpi', label: 'KPI', icon: '📊' },
      { path: '/admin/crm/happycall', label: '해피콜', icon: '📞' },
      { path: '/admin/crm/tickets', label: '티켓', icon: '🎫' },
      { path: '/admin/crm/assignment', label: '배정', icon: '🔀' },
      { path: '/admin/crm/voc', label: 'VOC', icon: '📢' },
      { path: '/admin/crm/incentive', label: '인센티브', icon: '💎' },
    ],
  },
  {
    section: 'CTI',
    icon: '📞',
    items: [
      { path: '/admin/cti', label: '상담 콘솔', icon: '🎧', exact: true },
      { path: '/admin/cti/history', label: '통화 이력', icon: '📜' },
      { path: '/admin/cti/monitor', label: '상담원 현황', icon: '📡' },
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
      width: collapsed ? theme.sidebarCollapsed : theme.sidebarWidth,
    }}>
      {/* 로고 */}
      <div style={styles.logo} onClick={() => navigate('/admin')}>
        <span style={{ fontSize: 20 }}>🐟</span>
        {!collapsed && <span style={styles.logoText}>리턴AI 어드민</span>}
      </div>

      {/* 메뉴 */}
      <nav style={styles.nav}>
        {MENU.map(group => (
          <div key={group.section} style={styles.group}>
            {!collapsed && (
              <div style={styles.sectionLabel}>
                {group.icon} {group.section}
              </div>
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
                  <span style={{ fontSize: 15 }}>{item.icon}</span>
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
    borderRight: `1px solid ${theme.border}`,
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
    gap: 10,
    padding: '16px 16px',
    cursor: 'pointer',
    borderBottom: `1px solid ${theme.border}`,
    flexShrink: 0,
  },
  logoText: {
    fontSize: 15,
    fontWeight: 700,
    color: theme.textWhite,
    whiteSpace: 'nowrap',
  },
  nav: {
    flex: 1,
    overflow: 'auto',
    padding: '8px 0',
  },
  group: {
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 11,
    color: theme.textDim,
    fontWeight: 600,
    padding: '8px 16px 4px',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    padding: '9px 16px',
    background: 'transparent',
    border: 'none',
    color: theme.textMuted,
    fontSize: 13,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.1s',
    whiteSpace: 'nowrap',
  },
  menuActive: {
    background: theme.bgHover,
    color: theme.textWhite,
    borderRight: `3px solid ${theme.blue}`,
  },
  collapseBtn: {
    padding: '10px',
    background: 'transparent',
    border: 'none',
    borderTop: `1px solid ${theme.border}`,
    color: theme.textDim,
    cursor: 'pointer',
    fontSize: 12,
    flexShrink: 0,
  },
};
