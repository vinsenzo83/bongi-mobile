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

  // SSE 스트리밍 파서
  const parseSSELines = useCallback((text) => {
    const events = [];
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          events.push(JSON.parse(line.slice(6)));
        } catch { /* 파싱 실패 무시 */ }
      }
    }
    return events;
  }, []);

  // 메시지 전송 (SSE 스트리밍)
  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || loading) return;

    let sid = sessionId;
    if (!sid) {
      sid = await startNewSession();
      if (!sid) return;
    }

    // 유저 메시지 추가
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    // 빈 AI 메시지 추가 (스트리밍으로 채워짐)
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true, ui_elements: [] }]);
    setLoading(true);

    try {
      const res = await fetch(`${API}/chat/message/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ session_id: sid, message: text }),
      });

      if (!res.ok) {
        // 스트리밍 실패 시 non-streaming fallback
        const fallbackRes = await fetch(`${API}/chat/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ session_id: sid, message: text }),
        });
        const data = await fallbackRes.json();
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: 'assistant',
            content: data.reply,
            ui_elements: data.ui_elements || [],
          };
          return updated;
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // 완전한 SSE 메시지만 처리 (더블 newline으로 구분)
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          const events = parseSSELines(part);
          for (const data of events) {
            if (data.type === 'text') {
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                updated[updated.length - 1] = {
                  ...last,
                  content: last.content + data.text,
                };
                return updated;
              });
            } else if (data.type === 'done') {
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                updated[updated.length - 1] = {
                  ...last,
                  streaming: false,
                  ui_elements: data.ui_elements || [],
                };
                return updated;
              });
            } else if (data.type === 'error') {
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: 'assistant',
                  content: data.message,
                  streaming: false,
                };
                return updated;
              });
            }
          }
        }
      }

      // 남은 버퍼 처리
      if (buffer.trim()) {
        const events = parseSSELines(buffer);
        for (const data of events) {
          if (data.type === 'done') {
            setMessages(prev => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              updated[updated.length - 1] = {
                ...last,
                streaming: false,
                ui_elements: data.ui_elements || [],
              };
              return updated;
            });
          }
        }
      }

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
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: '죄송합니다. 오류가 발생했어요. 다시 시도하거나 1600-XXXX로 전화주세요.',
          streaming: false,
        };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }, [sessionId, loading, messages.length, startNewSession, parseSSELines]);

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
