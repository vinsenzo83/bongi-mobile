import { Router } from 'express';
import { supabase } from '../db/supabase.js';

const router = Router();

// ── 상품 관리 ──

// GET /admin/platform/products — 상품 목록
router.get('/products', async (req, res) => {
  try {
    const { data, error } = await supabase.from('bongi_products').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ products: data || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /admin/platform/products — 상품 등록
router.post('/products', async (req, res) => {
  try {
    const { data, error } = await supabase.from('bongi_products').insert(req.body).select();
    if (error) throw error;
    res.json({ product: data[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /admin/platform/products/:id — 상품 수정
router.patch('/products/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('bongi_products').update(req.body).eq('id', req.params.id).select();
    if (error) throw error;
    res.json({ product: data[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /admin/platform/products/:id — 상품 삭제
router.delete('/products/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('bongi_products').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 사은품 관리 ──

// GET /admin/platform/gifts — 사은품 목록
router.get('/gifts', async (req, res) => {
  try {
    const { status } = req.query;
    let query = supabase.from('bongi_gifts').select('*').order('created_at', { ascending: false }).limit(100);
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ gifts: data || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /admin/platform/gifts/:id — 사은품 상태 변경 (지급 처리)
router.patch('/gifts/:id', async (req, res) => {
  try {
    const { status, paid_at } = req.body;
    const update = { status };
    if (status === 'paid') update.paid_at = paid_at || new Date().toISOString();
    const { data, error } = await supabase.from('bongi_gifts').update(update).eq('id', req.params.id).select();
    if (error) throw error;
    res.json({ gift: data[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 수수료 정산 ──

// GET /admin/platform/settlements — 정산 목록
router.get('/settlements', async (req, res) => {
  try {
    // 상담사별 계약 건수 집계로 정산 데이터 생성
    const { data: agents, error } = await supabase.from('bongi_agents').select('*');
    if (error) throw error;

    const settlements = (agents || []).map(agent => ({
      agent_id: agent.id,
      agent_name: agent.name,
      role: agent.role || 'agent',
      total_contracts: 0,
      total_commission: 0,
      status: 'draft',
    }));

    res.json({ settlements });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 후기 관리 ──

// GET /admin/platform/reviews — 후기 목록
router.get('/reviews', async (req, res) => {
  try {
    const { status } = req.query;
    let query = supabase.from('bongi_reviews').select('*').order('created_at', { ascending: false }).limit(100);
    if (status === 'pending') query = query.eq('is_approved', false);
    if (status === 'approved') query = query.eq('is_approved', true);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ reviews: data || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /admin/platform/reviews/:id — 후기 승인/삭제
router.patch('/reviews/:id', async (req, res) => {
  try {
    const { is_approved } = req.body;
    const { data, error } = await supabase.from('bongi_reviews').update({ is_approved }).eq('id', req.params.id).select();
    if (error) throw error;
    res.json({ review: data[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /admin/platform/reviews/:id — 후기 삭제
router.delete('/reviews/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('bongi_reviews').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 회원 관리 ──

// GET /admin/platform/members — 회원 목록 (고객 + 상담원)
router.get('/members', async (req, res) => {
  try {
    const { role } = req.query;

    // 고객 (user_profiles)
    const { data: profiles } = await supabase.from('bongi_user_profiles').select('*').order('created_at', { ascending: false }).limit(200);

    // 상담원 (agents)
    const { data: agents } = await supabase.from('bongi_agents').select('*');

    const members = [
      ...(agents || []).map(a => ({ ...a, member_type: 'agent' })),
      ...(profiles || []).map(p => ({ ...p, member_type: 'customer' })),
    ];

    const filtered = role ? members.filter(m => m.role === role || m.member_type === role) : members;
    res.json({ members: filtered, total: filtered.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /admin/platform/members/:id/role — 역할 변경
router.patch('/members/:id/role', async (req, res) => {
  try {
    const { role, member_type } = req.body;
    const table = member_type === 'agent' ? 'bongi_agents' : 'bongi_user_profiles';
    const { data, error } = await supabase.from(table).update({ role }).eq('id', req.params.id).select();
    if (error) throw error;
    res.json({ member: data[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 친구초대 관리 ──

// GET /admin/platform/referrals — 전체 추천 현황
router.get('/referrals', async (req, res) => {
  try {
    const { data, error } = await supabase.from('bongi_referrals').select('*').order('created_at', { ascending: false }).limit(200);
    if (error) throw error;

    const { data: rewards } = await supabase.from('bongi_rewards').select('*').order('created_at', { ascending: false }).limit(200);

    res.json({
      referrals: data || [],
      rewards: rewards || [],
      stats: {
        total: (data || []).length,
        converted: (data || []).filter(r => r.status === 'converted').length,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 리턴캐쉬 관리 ──

// GET /admin/platform/cash/withdrawals — 출금 신청 목록
router.get('/cash/withdrawals', async (req, res) => {
  try {
    const { status } = req.query;
    let query = supabase.from('bongi_withdrawals').select('*').order('created_at', { ascending: false }).limit(100);
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ withdrawals: data || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /admin/platform/cash/withdrawals/:id — 출금 승인/거절
router.patch('/cash/withdrawals/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const update = { status };
    if (status === 'approved') update.approved_at = new Date().toISOString();
    const { data, error } = await supabase.from('bongi_withdrawals').update(update).eq('id', req.params.id).select();
    if (error) throw error;
    res.json({ withdrawal: data[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /admin/platform/cash/manual-credit — 수동 적립
router.post('/cash/manual-credit', async (req, res) => {
  try {
    const { user_id, amount, reason } = req.body;
    if (!user_id || !amount) return res.status(400).json({ error: 'user_id와 amount는 필수입니다' });

    // 캐쉬 이력 추가
    await supabase.from('bongi_cash_history').insert({
      user_id,
      amount,
      type: 'manual_credit',
      description: reason || '관리자 수동 적립',
    });

    // 잔액 업데이트
    const { data: balance } = await supabase.from('bongi_cash_balance').select('*').eq('user_id', user_id).single();
    if (balance) {
      await supabase.from('bongi_cash_balance').update({ balance: balance.balance + amount }).eq('user_id', user_id);
    } else {
      await supabase.from('bongi_cash_balance').insert({ user_id, balance: amount });
    }

    res.json({ success: true, amount });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 플랫폼 통계 ──

// GET /admin/platform/stats — 플랫폼 KPI 집계
router.get('/stats', async (req, res) => {
  try {
    const [profiles, reviews, referrals, withdrawals, applications] = await Promise.all([
      supabase.from('bongi_user_profiles').select('id', { count: 'exact', head: true }),
      supabase.from('bongi_reviews').select('id', { count: 'exact', head: true }),
      supabase.from('bongi_referrals').select('id', { count: 'exact', head: true }),
      supabase.from('bongi_withdrawals').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('bongi_applications').select('id', { count: 'exact', head: true }),
    ]);

    res.json({
      members: profiles.count || 0,
      reviews: reviews.count || 0,
      referrals: referrals.count || 0,
      pending_withdrawals: withdrawals.count || 0,
      applications: applications.count || 0,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
