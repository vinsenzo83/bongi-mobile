import { Router } from 'express';
import { createSession, restoreSession } from '../services/chat-session.js';
import { processMessage } from '../services/chat-engine.js';

const router = Router();

// 새 세션 생성
router.post('/session', (req, res) => {
  const session = createSession();
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

// 메시지 전송 → AI 응답
router.post('/message', async (req, res) => {
  const { session_id, message } = req.body;

  if (!session_id || !message) {
    return res.status(400).json({ error: 'session_id와 message는 필수입니다' });
  }

  try {
    const result = await processMessage(session_id, message);
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
