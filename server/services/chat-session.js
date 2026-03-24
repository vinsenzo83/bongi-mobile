// 채팅 세션 관리 (메모리 캐시 + Supabase 영속화)
import { randomUUID } from 'crypto';
import { supabase } from '../db/supabase.js';

const sessions = new Map();

export function createSession(userId = null) {
  const id = randomUUID();
  const session = {
    id,
    messages: [],
    collected_info: {},
    lead_id: null,
    user_id: userId,
    created_at: new Date().toISOString(),
    last_active_at: new Date().toISOString(),
  };
  sessions.set(id, session);

  // Supabase에 세션 레코드 생성 (비동기, 논블로킹)
  if (supabase) {
    supabase.from('bongi_chat_sessions').insert({
      id,
      user_id: userId,
      title: '새 대화',
    }).then(({ error }) => {
      if (error) console.warn('세션 생성 DB 저장 실패:', error.message);
    });
  }

  return session;
}

export function getSession(id) {
  return sessions.get(id) || null;
}

export async function saveSession(session) {
  const now = new Date().toISOString();
  const updated = {
    ...session,
    last_active_at: now,
  };
  sessions.set(updated.id, updated);

  // Supabase 세션 updated_at 갱신
  if (supabase) {
    try {
      await supabase.from('bongi_chat_sessions').update({
        updated_at: now,
      }).eq('id', updated.id);
    } catch (e) {
      console.warn('세션 저장 실패:', e.message);
    }
  }

  return updated;
}

// 텍스트 메시지를 bongi_chat_messages에 저장
export async function persistMessage(sessionId, role, content) {
  if (!supabase) return;
  if (!content || typeof content !== 'string') return;

  try {
    await supabase.from('bongi_chat_messages').insert({
      session_id: sessionId,
      role,
      content,
    });
  } catch (e) {
    console.warn('메시지 저장 실패:', e.message);
  }
}

// 세션 제목 업데이트
export async function updateSessionTitle(sessionId, title) {
  if (!supabase) return;

  try {
    await supabase.from('bongi_chat_sessions').update({
      title: title.length > 50 ? title.slice(0, 50) + '...' : title,
      updated_at: new Date().toISOString(),
    }).eq('id', sessionId);
  } catch (e) {
    console.warn('세션 제목 업데이트 실패:', e.message);
  }
}

export async function restoreSession(id) {
  // 메모리에 있으면 바로 반환
  if (sessions.has(id)) return sessions.get(id);

  // Supabase에서 세션 + 메시지 복원
  if (supabase) {
    try {
      const { data: sessionData } = await supabase
        .from('bongi_chat_sessions')
        .select('*')
        .eq('id', id)
        .single();

      if (!sessionData) return null;

      const { data: msgData } = await supabase
        .from('bongi_chat_messages')
        .select('role, content, created_at')
        .eq('session_id', id)
        .order('created_at', { ascending: true });

      const session = {
        id: sessionData.id,
        messages: (msgData || []).map(m => ({ role: m.role, content: m.content })),
        collected_info: {},
        lead_id: null,
        user_id: sessionData.user_id,
        created_at: sessionData.created_at,
        last_active_at: sessionData.updated_at,
      };

      sessions.set(id, session);
      return session;
    } catch (e) {
      console.warn('세션 복원 실패:', e.message);
    }
  }

  return null;
}

// 세션 목록 조회 (최신순)
export async function listSessions(userId = null, limit = 20) {
  if (!supabase) return [];

  try {
    let query = supabase
      .from('bongi_chat_sessions')
      .select('id, title, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.warn('세션 목록 조회 실패:', e.message);
    return [];
  }
}

// 세션 메시지 조회
export async function getSessionMessages(sessionId) {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('bongi_chat_messages')
      .select('role, content, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (e) {
    console.warn('메시지 조회 실패:', e.message);
    return [];
  }
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
