import { useState, useEffect } from 'react';
import DonJikimi from './DonJikimi.jsx';
import { useAuth } from '../../hooks/useAuth.jsx';
import { api } from '../../utils/api.js';

export default function Sidebar({ open, onClose, sessions, currentId, onNewChat, onSelectSession, onDeleteSession }) {
  const { user, logout } = useAuth();
  const [cashBalance, setCashBalance] = useState(0);

  useEffect(() => {
    api.cash.getBalance()
      .then(res => setCashBalance(res.balance || 0))
      .catch(() => setCashBalance(0));
  }, []);

  return (
    <>
      {/* 모바일 오버레이 */}
      {open && <div onClick={onClose} style={styles.overlay} />}

      <div style={{ ...styles.sidebar, ...(open ? styles.sidebarOpen : {}) }}>
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
          <DonJikimi />
          <a href="/mypage?tab=referral" style={{ ...styles.mypageBtn, background: 'linear-gradient(135deg, #1a3a5c, #2a4a6c)', border: '1px solid #3a6a9c', marginBottom: 8 }}>🎁 친구초대</a>
          <a href="/mypage" style={{ ...styles.mypageBtn, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>📋 마이페이지</span>
            <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: 13 }}>{cashBalance > 0 ? `${cashBalance.toLocaleString()}원` : ''}</span>
          </a>
          {user ? (
            <button onClick={() => { logout(); onClose(); }} style={{ ...styles.mypageBtn, marginTop: 8, background: 'transparent', border: '1px solid #555', color: '#aaa', cursor: 'pointer' }}>
              🔓 로그아웃 ({user.displayName || user.email?.split('@')[0]})
            </button>
          ) : (
            <a href="/login" style={{ ...styles.mypageBtn, marginTop: 8, background: 'linear-gradient(135deg, #2a6a2a, #3a8a3a)', border: '1px solid #4a9a4a' }}>
              🔐 로그인 / 회원가입
            </a>
          )}
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
    transition: 'left 0.25s ease-out',
    paddingTop: 'env(safe-area-inset-top)',
    paddingBottom: 'env(safe-area-inset-bottom)',
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
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
