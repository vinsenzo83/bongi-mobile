import { Router } from 'express';
import { cti } from '../cti/adapter.js';

const router = Router();

// 발신
router.post('/call', (req, res) => {
  const { agentId, phoneNumber } = req.body;
  if (!agentId || !phoneNumber) return res.status(400).json({ error: 'agentId, phoneNumber 필수' });
  const call = cti.makeCall(agentId, phoneNumber);
  res.json(call);
});

// 수신 응답
router.post('/answer/:callId', (req, res) => {
  try {
    const call = cti.answerCall(req.params.callId);
    res.json(call);
  } catch (e) { res.status(404).json({ error: e.message }); }
});

// 보류
router.post('/hold/:callId', (req, res) => {
  try {
    const call = cti.holdCall(req.params.callId);
    res.json(call);
  } catch (e) { res.status(404).json({ error: e.message }); }
});

// 보류 해제
router.post('/resume/:callId', (req, res) => {
  try {
    const call = cti.resumeCall(req.params.callId);
    res.json(call);
  } catch (e) { res.status(404).json({ error: e.message }); }
});

// 전환
router.post('/transfer/:callId', (req, res) => {
  const { targetNumber } = req.body;
  try {
    const call = cti.transferCall(req.params.callId, targetNumber);
    res.json(call);
  } catch (e) { res.status(404).json({ error: e.message }); }
});

// 종료
router.post('/hangup/:callId', (req, res) => {
  try {
    const call = cti.hangupCall(req.params.callId);
    res.json(call);
  } catch (e) { res.status(404).json({ error: e.message }); }
});

// 통화 상태 조회
router.get('/call/:callId', (req, res) => {
  const call = cti.getCall(req.params.callId);
  if (!call) return res.status(404).json({ error: '통화를 찾을 수 없습니다' });
  res.json(call);
});

// 상담사 상태 조회
router.get('/agent/:agentId', (req, res) => {
  res.json(cti.getAgentState(req.params.agentId));
});

// 수신 시뮬레이션 (테스트용)
router.post('/simulate-incoming', (req, res) => {
  const { agentId, phoneNumber, customerName } = req.body;
  const call = cti.simulateIncoming(agentId, phoneNumber, customerName || '알 수 없음');
  res.json(call);
});

// SSE: 통화 상태 실시간 스트림
router.get('/events/:callId', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const callId = req.params.callId;
  const interval = setInterval(() => {
    const call = cti.getCall(callId);
    if (!call) {
      res.write(`data: ${JSON.stringify({ error: 'not_found' })}\n\n`);
      clearInterval(interval);
      res.end();
      return;
    }
    res.write(`data: ${JSON.stringify(call)}\n\n`);
    if (call.status === 'ended' || call.status === 'transferred') {
      clearInterval(interval);
      setTimeout(() => res.end(), 500);
    }
  }, 1000);

  req.on('close', () => clearInterval(interval));
});

export default router;
