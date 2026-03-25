import { Router } from 'express';
import { createSession, restoreSession, listSessions, getSessionMessages } from '../services/chat-session.js';
import { processMessage, processMessageStream } from '../services/chat-engine.js';

const router = Router();

// 새 세션 생성
router.post('/session', (req, res) => {
  const userId = req.user?.id || null;
  const session = createSession(userId);
  res.status(201).json({ session_id: session.id });
});

// 세션 복원 (재방문)
router.get('/session/:id', async (req, res) => {
  const session = await restoreSession(req.params.id);
  if (!session) return res.status(404).json({ error: '세션을 찾을 수 없습니다' });

  // assistant 메시지만 텍스트로 변환해서 반환
  const messages = session.messages
    .filter(m => typeof m.content === 'string' || (Array.isArray(m.content) && m.content.some(b => b.type === 'text')))
    .map(m => ({
      role: m.role,
      content: typeof m.content === 'string'
        ? m.content
        : m.content.filter(b => b.type === 'text').map(b => b.text).join('\n'),
    }))
    .filter(m => m.content && m.role !== 'user' || m.role === 'user');

  res.json({ session_id: session.id, messages });
});

// 세션 목록 조회 (사이드바용)
router.get('/sessions', async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const sessions = await listSessions(userId, limit);
    res.json({ sessions });
  } catch (e) {
    console.error('세션 목록 조회 에러:', e.message);
    res.status(500).json({ error: '세션 목록을 불러올 수 없습니다' });
  }
});

// 세션 메시지 조회 (대화 이력 복원용)
router.get('/sessions/:id/messages', async (req, res) => {
  try {
    const messages = await getSessionMessages(req.params.id);
    res.json({ messages });
  } catch (e) {
    console.error('메시지 조회 에러:', e.message);
    res.status(500).json({ error: '메시지를 불러올 수 없습니다' });
  }
});

// 메시지 전송 → AI 응답 (SSE 스트리밍)
router.post('/message/stream', async (req, res) => {
  const { session_id, message } = req.body;

  if (!session_id || !message) {
    return res.status(400).json({ error: 'session_id와 message는 필수입니다' });
  }

  // SSE 헤더 설정
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // 클라이언트 연결 끊김 감지
  let clientDisconnected = false;
  req.on('close', () => {
    clientDisconnected = true;
  });

  const sendSSE = (data) => {
    if (clientDisconnected) return;
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const context = { userId: req.user?.id || null };
    const result = await processMessageStream(session_id, message, context, (chunk) => {
      sendSSE(chunk);
    });

    // 완료 이벤트 (UI 요소 포함)
    sendSSE({ type: 'done', ui_elements: result.ui_elements || [] });
  } catch (e) {
    console.error('스트리밍 채팅 에러:', e.message);
    sendSSE({
      type: 'error',
      message: '죄송합니다. 일시적인 오류가 발생했어요. 다시 시도해주시거나 1600-XXXX로 전화주세요.',
    });
  } finally {
    res.end();
  }
});

// 메시지 전송 → AI 응답 (non-streaming fallback)
router.post('/message', async (req, res) => {
  const { session_id, message } = req.body;

  if (!session_id || !message) {
    return res.status(400).json({ error: 'session_id와 message는 필수입니다' });
  }

  try {
    const context = { userId: req.user?.id || null };
    const result = await processMessage(session_id, message, context);
    res.json(result);
  } catch (e) {
    console.error('채팅 에러:', e.message);
    res.status(500).json({
      reply: '죄송합니다. 일시적인 오류가 발생했어요. 다시 시도해주시거나 1600-XXXX로 전화주세요.',
      ui_elements: [],
      error: e.message,
    });
  }
});

export default router;
