import { Router } from 'express';
import { customers } from '../data/mock/store.js';
import { supabase } from '../db/supabase.js';

const router = Router();
const localApplications = [];

// 전화번호 형식 검증
function isValidPhone(phone) {
  return /^01[016789]-?\d{3,4}-?\d{4}$/.test(phone.replace(/\*/g, '0'));
}

// 신청 접수 → Mock + Supabase 양쪽 저장
router.post('/', async (req, res) => {
  const { type, name, phone, productTicket, message, channel } = req.body;

  // 입력 검증
  if (!phone) return res.status(400).json({ error: '연락처는 필수입니다' });
  if (!isValidPhone(phone)) return res.status(400).json({ error: '전화번호 형식이 올바르지 않습니다' });
  if (name && name.length > 50) return res.status(400).json({ error: '이름은 50자 이내로 입력해주세요' });
  if (message && message.length > 2000) return res.status(400).json({ error: '메시지는 2000자 이내로 입력해주세요' });

  const application = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    type: type || 'call',
    name: name || '',
    phone,
    productTicket: productTicket || null,
    message: message || '',
    channel: channel || 'web',
    status: 'new',
    createdAt: new Date().toISOString(),
  };

  // 1. 로컬 배열에 저장
  localApplications.push(application);

  // 2. Supabase에도 저장 (연결된 경우)
  if (supabase) {
    try {
      await supabase.from('bongi_applications').insert({
        type: application.type,
        channel: application.channel,
        name: application.name,
        phone: application.phone,
        product_ticket: application.productTicket,
        form_data: application.message ? { message: application.message } : null,
        status: 'new',
      });
    } catch (e) {
      console.warn('Supabase 신청 저장 실패:', e.message);
    }
  }

  // 3. Mock 고객 DB에도 추가 (어드민에서 보이도록)
  const sourceMap = { self: 'ticket_call', call: 'ticket_call', ai_chat: 'kakao_chat' };
  const exists = customers.find(c => c.phone === phone);
  if (!exists) {
    customers.unshift({
      name: name || '웹신청고객',
      source: sourceMap[type] || 'callback',
      phone,
      type: '자연유입',
      product: '인터넷/TV',
      agent: '미배정',
      status: '신규유입',
      time: '방금 (웹)',
    });
    console.log(`📥 웹 신청 → 고객 DB 추가: ${name || phone} (${type})`);
  }

  res.status(201).json(application);
});

// 신청 목록 조회
router.get('/', async (req, res) => {
  // Supabase 우선, 없으면 로컬
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('bongi_applications')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) return res.json(data);
    } catch (e) { /* fallback to local */ }
  }
  res.json(localApplications);
});

export default router;
