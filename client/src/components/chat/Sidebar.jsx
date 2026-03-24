import DonJikimi from './DonJikimi.jsx';

export default function Sidebar({ open, onClose, sessions, currentId, onNewChat, onSelectSession, onDeleteSession }) {
  return (
    <>
      {/* 모바일 오버레이 */}
      {open && <div onClick={onClose} style={styles.overlay} />}

      <div style={{ ...styles.sidebar, ...(open ? styles.sidebarOpen : {}) }}>
        {/* 돈지키미 — 사이드바 상단 고정 */}
        <DonJikimi />

        {/* 새 대화 버튼 */}
        <button onClick={() => { onNewChat(); onClose(); }} style={styles.newBtn}>
          + 새 대화
        </button>

        {/* 대화 목록 */}
        <div style={styles.list}>
          {sessions.length === 0 && (
            <div style={styles.empty}>대화 내역이 없습니다</div>
          )}
          {sessions.map(s => (
            <div
              key={s.id}
              onClick={() => { onSelectSession(s.id); onClose(); }}
              style={{ ...styles.item, ...(s.id === currentId ? styles.itemActive : {}) }}
            >
              <span style={styles.itemTitle}>{s.title}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteSession(s.id); }}
                style={styles.deleteBtn}
              >×</button>
            </div>
          ))}
        </div>

        {/* 하단 */}
        <div style={styles.footer}>
          <a href="/mypage" style={styles.mypageBtn}>📋 마이페이지</a>
          <div style={{ marginTop: 12 }}>
            <div style={styles.footerText}>🐟 리턴AI</div>
            <div style={styles.footerSub}>광주/전라 8개 직영 매장</div>
          </div>
        </div>
      </div>
    </>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 998,
  },
  sidebar: {
    width: 260,
    background: '#171717',
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid #333',
    position: 'fixed',
    left: -260,
    top: 0,
    bottom: 0,
    zIndex: 999,
    transition: 'left 0.2s',
  },
  sidebarOpen: { left: 0 },
  newBtn: {
    margin: '12px',
    padding: '10px',
    borderRadius: 8,
    border: '1px solid #444',
    background: 'transparent',
    color: '#ddd',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'left',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 8px',
  },
  empty: {
    padding: 20,
    textAlign: 'center',
    color: '#666',
    fontSize: 13,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    borderRadius: 8,
    cursor: 'pointer',
    marginBottom: 2,
    transition: 'background 0.1s',
  },
  itemActive: {
    background: '#2a2a2a',
  },
  itemTitle: {
    fontSize: 13,
    color: '#ccc',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    color: '#666',
    fontSize: 16,
    cursor: 'pointer',
    padding: '0 4px',
    flexShrink: 0,
  },
  footer: {
    padding: '16px',
    borderTop: '1px solid #333',
  },
  mypageBtn: {
    display: 'block',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #444',
    background: '#2a2a2a',
    color: '#ddd',
    fontSize: 13,
    fontWeight: 600,
    textDecoration: 'none',
    textAlign: 'center',
    cursor: 'pointer',
  },
  footerText: { fontSize: 13, fontWeight: 600, color: '#aaa' },
  footerSub: { fontSize: 11, color: '#666', marginTop: 2 },
};
