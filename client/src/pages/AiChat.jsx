import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api.js';

export default function AiChat() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '안녕하세요! 봉이모바일 AI 상담사입니다 🐟\n\n인터넷+TV, 가전렌탈, 알뜰폰, 중고폰 매입 등 궁금한 점을 편하게 물어보세요!\n\n예시:\n• "인터넷 요금 비교해줘"\n• "정수기 렌탈 얼마야?"\n• "알뜰폰 추천해줘"\n• "중고폰 팔고 싶어"' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      // API에는 system 메시지 제외하고 전송
      const chatHistory = newMessages.filter(m => m.role !== 'system');
      const reply = await api.ai.chat(chatHistory);
      setMessages([...newMessages, reply]);
    } catch (e) {
      setMessages([...newMessages, { role: 'assistant', content: '죄송합니다. 일시적인 오류가 발생했습니다. 1600-XXXX로 전화주시면 상담사가 도와드리겠습니다.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.container}>
      {/* 헤더 */}
      <div style={s.header}>
        <Link to="/" style={{ color: '#fff', textDecoration: 'none', fontSize: 13 }}>← 홈</Link>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>🐟 봉이모바일 AI 상담</div>
          <div style={{ fontSize: 11, opacity: 0.7 }}>무엇이든 물어보세요</div>
        </div>
        <div style={{ width: 40 }} />
      </div>

      {/* 메시지 영역 */}
      <div style={s.messages}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
            <div style={{
              ...s.bubble,
              background: msg.role === 'user' ? 'var(--primary)' : '#fff',
              color: msg.role === 'user' ? '#fff' : 'var(--text)',
              borderBottomRightRadius: msg.role === 'user' ? 4 : 16,
              borderBottomLeftRadius: msg.role === 'user' ? 16 : 4,
            }}>
              {msg.content.split('\n').map((line, j) => (
                <span key={j}>{line}<br /></span>
              ))}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
            <div style={{ ...s.bubble, background: '#fff', color: 'var(--text-secondary)' }}>
              <span style={{ animation: 'pulse 1s infinite' }}>생각하고 있어요...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 빠른 질문 */}
      {messages.length <= 1 && (
        <div style={s.quickActions}>
          {['인터넷 요금 비교해줘', '정수기 렌탈 추천', '알뜰폰 저렴한 거', '중고폰 매입 방법'].map(q => (
            <button key={q} onClick={() => { setInput(q); }}
              style={s.quickBtn}>{q}</button>
          ))}
        </div>
      )}

      {/* 입력 */}
      <div style={s.inputArea}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="메시지를 입력하세요..."
          style={s.input}
          disabled={loading}
        />
        <button onClick={send} disabled={loading || !input.trim()}
          style={{ ...s.sendBtn, opacity: loading || !input.trim() ? 0.5 : 1 }}>
          전송
        </button>
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}

const s = {
  container: { display: 'flex', flexDirection: 'column', height: '100vh', maxWidth: 600, margin: '0 auto', background: '#f1f5f9' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'linear-gradient(135deg, #1e3a5f, #2563eb)', color: '#fff' },
  messages: { flex: 1, overflow: 'auto', padding: '16px' },
  bubble: { maxWidth: '80%', padding: '10px 14px', borderRadius: 16, fontSize: 14, lineHeight: 1.7, boxShadow: '0 1px 2px rgba(0,0,0,0.06)', whiteSpace: 'pre-wrap' },
  quickActions: { display: 'flex', gap: 6, padding: '0 16px 8px', flexWrap: 'wrap' },
  quickBtn: { padding: '6px 12px', borderRadius: 20, border: '1px solid var(--border)', background: '#fff', fontSize: 13, cursor: 'pointer', color: 'var(--primary)', fontWeight: 500 },
  inputArea: { display: 'flex', gap: 8, padding: '12px 16px', background: '#fff', borderTop: '1px solid var(--border)' },
  input: { flex: 1, padding: '10px 14px', borderRadius: 24, border: '1px solid var(--border)', fontSize: 14 },
  sendBtn: { padding: '10px 18px', borderRadius: 24, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' },
};
