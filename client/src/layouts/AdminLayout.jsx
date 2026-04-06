import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/admin/Sidebar.jsx';
import { theme } from '../styles/admin-theme.js';

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={styles.wrapper}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(prev => !prev)} />
      <div style={{
        ...styles.main,
        marginLeft: collapsed ? 60 : theme.sidebarWidth,
      }}>
        {/* 상단바 */}
        <div style={styles.topbar}>
          <div style={styles.topLeft}>
            <span style={styles.topTitle}>봉이모바일 어드민</span>
          </div>
          <div style={styles.topRight}>
            <span style={{ fontSize: 12, color: theme.textMuted }}>운영팀 관리자</span>
            <button style={styles.logoutBtn}>로그아웃</button>
          </div>
        </div>
        {/* 본문 */}
        <div style={styles.content}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    minHeight: '100vh',
    background: theme.bg,
    color: theme.text,
    fontFamily: theme.sans,
  },
  main: {
    minHeight: '100vh',
    transition: 'margin-left 0.2s',
    display: 'flex',
    flexDirection: 'column',
  },
  topbar: {
    background: '#fff',
    borderBottom: `1px solid ${theme.border}`,
    padding: '10px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'sticky',
    top: 0,
    zIndex: 50,
  },
  topLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  topTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: theme.navy,
  },
  topRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  logoutBtn: {
    padding: '4px 10px',
    border: `1px solid ${theme.borderDark}`,
    borderRadius: 6,
    background: '#fff',
    fontSize: 11,
    color: theme.textSecondary,
    cursor: 'pointer',
    fontFamily: theme.sans,
  },
  content: {
    flex: 1,
    padding: '20px 24px',
  },
};
