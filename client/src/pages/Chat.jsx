import { useState, useEffect } from 'react';
import { useChat } from '../hooks/useChat.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import Sidebar from '../components/chat/Sidebar.jsx';
import MessageList from '../components/chat/MessageList.jsx';
import InputArea from '../components/chat/InputArea.jsx';
import MyPageModal from '../components/chat/MyPageModal.jsx';
import ConsultSheet from '../components/chat/ConsultSheet.jsx';
import PhoneSelectCard from '../components/chat/PhoneSelectCard.jsx';
import UsedPhoneSelectCard from '../components/chat/UsedPhoneSelectCard.jsx';

// 휴대폰 관련 질문 감지 (모달로 전환)
function isPhoneQuery(msg) {
  // 중고폰/매입은 별도 모달
  if (msg.includes('중고폰') || msg.includes('매입') || msg.includes('보상') || msg.includes('팔고')) return false;

  // 특정 모델명이 포함되면 AI로 보냄 (이미 기종 특정됨)
  const models = ['갤럭시', '아이폰', 'S26', 'S25', '폴드', '플립', 'iPhone', 'Galaxy'];
  if (models.some(m => msg.includes(m))) return false;

  // 휴대폰 관련 키워드 → 모달 오픈
  const kw = [
    '휴대폰', '핸드폰', '스마트폰',
    '폰 시세', '폰 가격', '폰 사은품', '폰 얼마',
    '기기변경', '기변', '번호이동', '번이',
    '개통', '공시지원금', '공시',
  ];
  return kw.some(k => msg.includes(k));
}

function isUsedPhoneQuery(msg) {
  const kw = ['중고폰', '매입', '보상판매', '팔고 싶', '폰 팔', '중고 매입'];
  return kw.some(k => msg.includes(k));
}

export default function Chat() {
  const chat = useChat();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [myPageOpen, setMyPageOpen] = useState(false);
  const [myPageTab, setMyPageTab] = useState('home');
  const [consultSheet, setConsultSheet] = useState({ open: false, product: null, category: null });
  const [showPhoneSelect, setShowPhoneSelect] = useState(false);
  const [showUsedPhoneSelect, setShowUsedPhoneSelect] = useState(false);
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
        onOpenMyPage={(tab) => { setMyPageTab(tab); setMyPageOpen(true); }}
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
          <WelcomeScreen onChipClick={(msg) => {
            if (isUsedPhoneQuery(msg)) {
              setShowUsedPhoneSelect(true);
            } else if (isPhoneQuery(msg)) {
              setShowPhoneSelect(true);
            } else {
              chat.sendMessage(msg);
            }
          }} isMobile={isMobile} />
        ) : (
          <MessageList messages={chat.messages} loading={chat.loading} onAction={(msg) => {
            if (msg.startsWith('__consult__')) {
              try {
                const data = JSON.parse(msg.replace('__consult__', ''));
                setConsultSheet({ open: true, product: data.product, category: data.category });
              } catch { setConsultSheet({ open: true, product: {}, category: 'internet' }); }
            } else if (msg === '__open_phone_select__') {
              setShowPhoneSelect(true);
            } else if (msg === '__open_usedphone_select__') {
              setShowUsedPhoneSelect(true);
            } else {
              chat.sendMessage(msg);
            }
          }} />
        )}

        {/* 입력창 */}
        <InputArea onSend={(msg) => {
          if (isUsedPhoneQuery(msg)) {
            setShowUsedPhoneSelect(true);
          } else if (isPhoneQuery(msg)) {
            setShowPhoneSelect(true);
          } else {
            chat.sendMessage(msg);
          }
        }} loading={chat.loading} hasMessages={chat.messages.length > 0} />
      </div>

      {/* 휴대폰 기종 선택 */}
      {showPhoneSelect && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1500, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 420, marginBottom: 0, animation: 'slideUp 0.25s ease' }}>
            <div style={{ background: '#fff', borderRadius: '16px 16px 0 0', padding: '16px 16px 24px', maxHeight: '80vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#1a2744' }}>{'📱'} 휴대폰 시세 조회</span>
                <button onClick={() => setShowPhoneSelect(false)} style={{ background: 'none', border: 'none', fontSize: 20, color: '#999', cursor: 'pointer' }}>{'✕'}</button>
              </div>
              <PhoneSelectCard onComplete={(query) => { setShowPhoneSelect(false); chat.sendMessage(query); }} />
            </div>
          </div>
        </div>
      )}

      {/* 중고폰 매입 선택 */}
      {showUsedPhoneSelect && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1500, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 420, animation: 'slideUp 0.25s ease' }}>
            <div style={{ background: '#fff', borderRadius: '16px 16px 0 0', padding: '16px 16px 24px', maxHeight: '80vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#1a2744' }}>{'📦'} 중고폰 매입 시세</span>
                <button onClick={() => setShowUsedPhoneSelect(false)} style={{ background: 'none', border: 'none', fontSize: 20, color: '#999', cursor: 'pointer' }}>{'✕'}</button>
              </div>
              <UsedPhoneSelectCard onComplete={(query) => { setShowUsedPhoneSelect(false); chat.sendMessage(query); }} />
            </div>
          </div>
        </div>
      )}

      {/* 마이페이지 모달 */}
      <MyPageModal open={myPageOpen} onClose={() => setMyPageOpen(false)} initialTab={myPageTab} />

      {/* 가입상담 바텀시트 (바로상담/셀프가입 선택) */}
      <ConsultSheet
        open={consultSheet.open}
        onClose={() => setConsultSheet({ open: false, product: null, category: null })}
        product={consultSheet.product}
        category={consultSheet.category}
        onNavigate={(path) => window.location.href = path}
      />
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
      }}>인터넷, 렌탈, 휴대폰시세, 중고폰 매입까지<br/>무엇이든 물어보세요</p>
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
