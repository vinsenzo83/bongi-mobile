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
        marginLeft: collapsed ? theme.sidebarCollapsed : theme.sidebarWidth,
      }}>
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
  },
  main: {
    minHeight: '100vh',
    transition: 'margin-left 0.2s',
    display: 'flex',
    flexDirection: 'column',
  },
  content: {
    flex: 1,
    padding: 24,
    maxWidth: 1400,
  },
};
