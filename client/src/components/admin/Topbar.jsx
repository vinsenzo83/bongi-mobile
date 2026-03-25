import { useNavigate } from 'react-router-dom';
import { theme } from '../../styles/admin-theme.js';

export default function Topbar({ title, actions }) {
  const navigate = useNavigate();

  return (
    <div style={styles.topbar}>
      <div style={styles.left}>
        <h1 style={styles.title}>{title}</h1>
      </div>
      <div style={styles.right}>
        {actions}
        <button style={styles.homeBtn} onClick={() => navigate('/')} title="고객 사이트">
          🌐
        </button>
      </div>
    </div>
  );
}

const styles = {
  topbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: theme.topbarHeight,
    padding: '0 24px',
    background: theme.bgTopbar,
    borderBottom: `1px solid ${theme.border}`,
    flexShrink: 0,
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 600,
    color: theme.textWhite,
    margin: 0,
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  homeBtn: {
    background: 'transparent',
    border: `1px solid ${theme.border}`,
    borderRadius: theme.radius,
    padding: '6px 10px',
    fontSize: 16,
    cursor: 'pointer',
  },
};
