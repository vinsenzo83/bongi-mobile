import { useState, useCallback, useRef, useEffect } from 'react';

const API = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api';

export function useChat() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const bottomRef = useRef(null);

  // 세션 목록 localStorage에서 로드
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('chat_sessions') || '[]');
    setSessions(saved);
  }, []);

  // 새 세션 시작
  const startNewSession = useCallback(async () => {
    try {
      const res = await fetch(`${API}/chat/session`, { method: 'POST' });
      const { session_id } = await res.json();
      setSessionId(session_id);
      setMessages([]);

      // localStorage에 세션 추가
      const newSession = { id: session_id, title: '새 대화', createdAt: new Date().toISOString() };
      const updated = [newSession, ...sessions.filter(s => s.id !== session_id)].slice(0, 20);
      setSessions(updated);
      localStorage.setItem('chat_sessions', JSON.stringify(updated));

      return session_id;
    } catch (e) {
      console.error('세션 생성 실패:', e);
      return null;
    }
  }, [sessions]);

  // 기존 세션 복원
  const restoreSession = useCallback(async (id) => {
    try {
      const res = await fetch(`${API}/chat/session/${id}`);
      if (!res.ok) return false;
      const data = await res.json();
      setSessionId(id);
      setMessages(data.messages || []);
      return true;
    } catch {
      return false;
    }
  }, []);

  // 메시지 전송
  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || loading) return;

    let sid = sessionId;
    if (!sid) {
      sid = await startNewSession();
      if (!sid) return;
    }

    // 유저 메시지 추가
    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch(`${API}/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sid, message: text }),
      });
      const data = await res.json();

      const aiMsg = { role: 'assistant', content: data.reply, ui_elements: data.ui_elements || [] };
      setMessages(prev => [...prev, aiMsg]);

      // 세션 제목 업데이트 (첫 메시지로)
      if (messages.length === 0) {
        const title = text.length > 30 ? text.slice(0, 30) + '...' : text;
        setSessions(prev => {
          const updated = prev.map(s => s.id === sid ? { ...s, title } : s);
          localStorage.setItem('chat_sessions', JSON.stringify(updated));
          return updated;
        });
      }
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '죄송합니다. 오류가 발생했어요. 다시 시도하거나 1600-XXXX로 전화주세요.',
      }]);
    } finally {
      setLoading(false);
    }
  }, [sessionId, loading, messages.length, startNewSession]);

  // 세션 삭제
  const deleteSession = useCallback((id) => {
    const updated = sessions.filter(s => s.id !== id);
    setSessions(updated);
    localStorage.setItem('chat_sessions', JSON.stringify(updated));
    if (sessionId === id) {
      setSessionId(null);
      setMessages([]);
    }
  }, [sessions, sessionId]);

  return {
    messages,
    loading,
    sessionId,
    sessions,
    sendMessage,
    startNewSession,
    restoreSession,
    deleteSession,
    bottomRef,
  };
}
