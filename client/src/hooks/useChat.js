import { useState, useCallback, useRef, useEffect } from 'react';

const API = import.meta.env.VITE_API_BASE || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');

function getAuthHeaders() {
  const token = sessionStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function useChat() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const bottomRef = useRef(null);

  // 세션 목록을 API에서 로드 (Supabase 영속화)
  useEffect(() => {
    async function loadSessions() {
      try {
        const res = await fetch(`${API}/chat/sessions`, {
          headers: { ...getAuthHeaders() },
        });
        if (res.ok) {
          const data = await res.json();
          setSessions(data.sessions || []);
        } else {
          // API 실패 시 localStorage 폴백
          const saved = JSON.parse(localStorage.getItem('chat_sessions') || '[]');
          setSessions(saved);
        }
      } catch {
        const saved = JSON.parse(localStorage.getItem('chat_sessions') || '[]');
        setSessions(saved);
      } finally {
        setSessionsLoading(false);
      }
    }
    loadSessions();
  }, []);

  // 새 세션 시작
  const startNewSession = useCallback(async () => {
    try {
      const res = await fetch(`${API}/chat/session`, {
        method: 'POST',
        headers: { ...getAuthHeaders() },
      });
      const { session_id } = await res.json();
      setSessionId(session_id);
      setMessages([]);

      // 로컬 세션 목록에 추가 (서버에는 이미 저장됨)
      const newSession = { id: session_id, title: '새 대화', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      setSessions(prev => {
        const updated = [newSession, ...prev.filter(s => s.id !== session_id)].slice(0, 20);
        localStorage.setItem('chat_sessions', JSON.stringify(updated));
        return updated;
      });

      return session_id;
    } catch (e) {
      console.error('세션 생성 실패:', e);
      return null;
    }
  }, []);

  // 기존 세션 복원 (API에서 메시지 로드)
  const restoreSession = useCallback(async (id) => {
    try {
      const res = await fetch(`${API}/chat/sessions/${id}/messages`, {
        headers: { ...getAuthHeaders() },
      });
      if (!res.ok) {
        // 새 엔드포인트 실패 시 기존 엔드포인트로 폴백
        const fallback = await fetch(`${API}/chat/session/${id}`);
        if (!fallback.ok) return false;
        const data = await fallback.json();
        setSessionId(id);
        setMessages(data.messages || []);
        return true;
      }
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
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
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
    setSessions(prev => {
      const updated = prev.filter(s => s.id !== id);
      localStorage.setItem('chat_sessions', JSON.stringify(updated));
      return updated;
    });
    if (sessionId === id) {
      setSessionId(null);
      setMessages([]);
    }
  }, [sessionId]);

  return {
    messages,
    loading,
    sessionId,
    sessions,
    sessionsLoading,
    sendMessage,
    startNewSession,
    restoreSession,
    deleteSession,
    bottomRef,
  };
}
