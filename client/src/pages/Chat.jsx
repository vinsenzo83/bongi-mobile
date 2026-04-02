import { useState, useEffect } from 'react';
import { useChat } from '../hooks/useChat.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import Sidebar from '../components/chat/Sidebar.jsx';
import MessageList from '../components/chat/MessageList.jsx';
import InputArea from '../components/chat/InputArea.jsx';

export default function Chat() {
  const chat = useChat();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <div style={styles.container}>
      {/* 사이드바 */}
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        sessions={chat.sessions}
        currentId={chat.sessionId}
        onNewChat={chat.startNewSession}
        onSelectSession={chat.restoreSession}
        onDeleteSession={chat.deleteSession}
      />

      {/* 메인 영역 */}
      <div style={styles.main}>
        {/* 탑바 */}
        <div style={{
          ...styles.topbar,
          ...(isMobile ? styles.topbarMobile : {}),
        }}>
          <button onClick={() => setSidebarOpen(true)} style={styles.menuBtn}>☰</button>
          <span style={styles.title}>🐟 리턴AI</span>
          <button onClick={chat.startNewSession} style={styles.newBtn}>+</button>
        </div>

        {/* 메시지 영역 */}
        {chat.messages.length === 0 ? (
          <WelcomeScreen onChipClick={chat.sendMessage} isMobile={isMobile} />
        ) : (
          <MessageList messages={chat.messages} loading={chat.loading} onAction={chat.sendMessage} />
        )}

        {/* 입력창 */}
        <InputArea onSend={chat.sendMessage} loading={chat.loading} />
      </div>
    </div>
  );
}

function WelcomeScreen({ onChipClick, isMobile }) {
  const allChips = [
    // 인터넷+TV
    { label: '인터넷 사은품 얼마?', icon: '📡' },
    { label: '인터넷+TV 사은품 얼마?', icon: '📺' },
    // 렌탈
    { label: '냉장고 사은품 얼마?', icon: '🧊' },
    { label: '공기청정기 사은품 얼마?', icon: '🌬️' },
    { label: '정수기 사은품 얼마?', icon: '💧' },
    { label: 'TV 사은품 얼마?', icon: '📺' },
    { label: '비데 사은품 얼마?', icon: '🚿' },
    { label: '세탁건조기 사은품 얼마?', icon: '👕' },
    { label: '에어컨 사은품 얼마?', icon: '❄️' },
    { label: '식기세척기 사은품 얼마?', icon: '🍽️' },
    { label: '로봇청소기 사은품 얼마?', icon: '🤖' },
    { label: '안마의자 사은품 얼마?', icon: '💆' },
    // 휴대폰
    { label: '휴대폰 사은품 얼마?', icon: '📱' },
    { label: '중고폰 매입 사은품 얼마?', icon: '📦' },
    { label: '알뜰폰 사은품 얼마?', icon: '📱' },
    // 매장
    { label: '가까운 매장 어디야?', icon: '📍' },
  ];

  const pickRandom = () => [...allChips].sort(() => Math.random() - 0.5).slice(0, 6);
  const [chips, setChips] = useState(pickRandom);

  useEffect(() => {
    const timer = setInterval(() => setChips(pickRandom()), 8000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={styles.welcome}>
      <div style={styles.welcomeIcon}>🐟</div>
      <h1 style={{
        ...styles.welcomeTitle,
        ...(isMobile ? { fontSize: 22 } : {}),
      }}>리턴AI</h1>
      <p style={styles.welcomeSlogan}>돈 버는 소비의 시작, 리턴AI</p>
      <p style={{
        ...styles.welcomeSub,
        ...(isMobile ? { fontSize: 13 } : {}),
      }}>인터넷, 렌탈, 알뜰폰, 중고폰 매입까지<br/>무엇이든 물어보세요</p>
      <div style={{
        ...styles.chips,
        ...(isMobile ? { maxWidth: '100%', padding: '0 8px' } : {}),
      }}>
        {chips.map(c => (
          <button key={c.label} onClick={() => onChipClick(c.label)} style={{
            ...styles.chip,
            ...(isMobile ? { fontSize: 13, padding: '8px 12px' } : {}),
          }}>
            <span>{c.icon}</span> {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    height: '100dvh',
    background: '#212121',
    color: '#ececec',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    overflow: 'hidden',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    height: '100dvh',
  },
  topbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 16px',
    borderBottom: '1px solid #333',
    flexShrink: 0,
  },
  topbarMobile: {
    paddingTop: 'max(10px, env(safe-area-inset-top))',
  },
  menuBtn: {
    background: 'none',
    border: 'none',
    color: '#ececec',
    fontSize: 20,
    cursor: 'pointer',
    padding: '4px 8px',
  },
  title: {
    fontSize: 16,
    fontWeight: 600,
  },
  newBtn: {
    background: 'none',
    border: '1px solid #555',
    borderRadius: 8,
    color: '#ececec',
    fontSize: 18,
    cursor: 'pointer',
    padding: '2px 10px',
  },
  welcome: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    overflow: 'auto',
  },
  welcomeIcon: { fontSize: 48, marginBottom: 12 },
  welcomeTitle: { fontSize: 28, fontWeight: 700, marginBottom: 4, color: '#fff' },
  welcomeSlogan: { fontSize: 14, color: '#60a5fa', fontWeight: 500, marginBottom: 12 },
  welcomeSub: { fontSize: 15, color: '#888', textAlign: 'center', lineHeight: 1.6, marginBottom: 28 },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    maxWidth: 500,
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 16px',
    borderRadius: 20,
    border: '1px solid #444',
    background: '#2a2a2a',
    color: '#ddd',
    fontSize: 14,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
};
