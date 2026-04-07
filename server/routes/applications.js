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

  // 유입경로 한글 매핑
  const typeMap = { 'self': '셀프신청', 'call': '바로상담', 'ai_chat': '셀프신청', 'crm': 'CRM등록', 'used_phone': '중고폰' };
  const resolvedType = typeMap[type] || type || '셀프신청';

  const application = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    type: resolvedType,
    name: name || '',
    phone,
    productTicket: productTicket || null,
    message: message || '',
    channel: channel || '셀프신청',
    status: '신청완료',
    createdAt: new Date().toISOString(),
  };

  // 1. 로컬 배열에 저장
  localApplications.push(application);

  // 2. Supabase에도 저장 (연결된 경우)
  if (supabase) {
    try {
      // 전화번호로 회원 유형 자동 판별
      let userType = req.body.user_type || '비회원';
      const { data: profile } = await supabase.from('bongi_user_profiles').select('user_type').eq('phone', phone).maybeSingle();
      if (profile) userType = profile.user_type || userType;

      // 중고폰 매입 → bongi_used_phone_buyback에 저장 (신청현황 아님)
      if (resolvedType === '중고폰') {
        await supabase.from('bongi_used_phone_buyback').insert({
          customer_name: application.name,
          customer_phone: application.phone,
          model_name: req.body.model || req.body.product_name || '',
          storage: req.body.storage || '',
          self_grade: req.body.grade || '',
          estimated_price: req.body.estimated_price || 0,
          pickup_address: req.body.address || '',
          pickup_address_detail: req.body.address_detail || '',
          status: '접수완료',
        });
      } else {
        // 인터넷/렌탈 → bongi_applications에 저장
        await supabase.from('bongi_applications').insert({
          type: resolvedType,
          channel: application.channel,
          name: application.name,
          phone: application.phone,
          product_ticket: application.productTicket,
          product_name: req.body.product_name || null,
          gift_amount: req.body.gift_amount || null,
          form_data: application.message ? { message: application.message } : null,
          status: '신청완료',
          user_type: userType,
          sync_direction: '어드민→CRM',
        });
      }

      // 비회원이면 user_profiles에 자동 등록
      if (!profile) {
        await supabase.from('bongi_user_profiles').insert({
          display_name: application.name || '비회원',
          phone: application.phone,
          user_type: '비회원',
          channel: resolvedType,
          member_tier: 'normal',
        }).then(() => {}).catch(() => {});
      }
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
