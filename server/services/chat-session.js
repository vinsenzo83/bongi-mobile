// 채팅 세션 관리 (메모리 + Supabase 영속화)
import { randomUUID } from 'crypto';
import { supabase } from '../db/supabase.js';

const sessions = new Map();

export function createSession() {
  const id = randomUUID();
  const session = {
    id,
    messages: [],
    collected_info: {},
    lead_id: null,
    created_at: new Date().toISOString(),
    last_active_at: new Date().toISOString(),
  };
  sessions.set(id, session);
  return session;
}

export function getSession(id) {
  return sessions.get(id) || null;
}

export async function saveSession(session) {
  session.last_active_at = new Date().toISOString();
  sessions.set(session.id, session);

  // Supabase 영속화 (연결된 경우)
  if (supabase) {
    try {
      await supabase.from('bongi_chat_sessions').upsert({
        id: session.id,
        messages: session.messages,
        collected_info: session.collected_info,
        lead_id: session.lead_id,
        last_active_at: session.last_active_at,
      });
    } catch (e) {
      console.warn('세션 저장 실패:', e.message);
    }
  }
}

export async function restoreSession(id) {
  // 메모리에 있으면 바로 반환
  if (sessions.has(id)) return sessions.get(id);

  // Supabase에서 복원
  if (supabase) {
    try {
      const { data } = await supabase
        .from('bongi_chat_sessions')
        .select('*')
        .eq('id', id)
        .single();
      if (data) {
        sessions.set(id, data);
        return data;
      }
    } catch (e) { /* not found */ }
  }

  return null;
}

// 30분 비활성 세션 메모리 정리 (5분마다 체크)
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, session] of sessions) {
    if (new Date(session.last_active_at).getTime() < cutoff) {
      sessions.delete(id);
    }
  }
}, 5 * 60 * 1000);
