import { theme } from '../../styles/admin-theme.js';

export default function Modal({ open, onClose, title, children, width = 480 }) {
  if (!open) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={{ ...styles.modal, maxWidth: width }} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <span style={styles.title}>{title}</span>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={styles.body}>{children}</div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: theme.bgCard,
    border: `1px solid ${theme.border}`,
    borderRadius: theme.radiusLg,
    width: '90%',
    maxHeight: '80vh',
    overflow: 'auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 20px',
    borderBottom: `1px solid ${theme.border}`,
  },
  title: {
    fontSize: 16,
    fontWeight: 600,
    color: theme.textWhite,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: theme.textMuted,
    fontSize: 18,
    cursor: 'pointer',
    padding: 4,
  },
  body: {
    padding: 20,
  },
};
