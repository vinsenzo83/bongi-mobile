import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { calculateIncentive, GRADE_INFO, ITEM_INFO } from '../services/incentive.js';

const router = Router();

// Supabase 미연결 시 가드
router.use((req, res, next) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase 미연결. .env에 SUPABASE_URL과 SUPABASE_ANON_KEY를 설정해주세요.' });
  next();
});

// ─── 고객 목록 (상태 필터, 검색) ───
router.get('/customers', async (req, res) => {
  const { status, search, db_type, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  let query = supabase.from('bongi_customers').select('*', { count: 'exact' });

  if (status) query = query.eq('status', status);
  if (db_type) query = query.eq('db_type', db_type);
  if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ data, total: count, page: Number(page), limit: Number(limit) });
});

// ─── 고객 상세 ───
router.get('/customers/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('bongi_customers').select('*').eq('id', req.params.id).single();
  if (error) return res.status(404).json({ error: '고객을 찾을 수 없습니다' });
  res.json(data);
});

// ─── 고객 상태 변경 ───
router.patch('/customers/:id', async (req, res) => {
  const { status, memo, assigned_agent_id } = req.body;
  const updates = { updated_at: new Date().toISOString() };
  if (status) updates.status = status;
  if (memo !== undefined) updates.memo = memo;

  const { data, error } = await supabase
    .from('bongi_customers').update(updates).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ─── 고객별 상담 기록 ───
router.get('/customers/:id/consultations', async (req, res) => {
  const { data, error } = await supabase
    .from('bongi_consultations').select('*, bongi_agents(name)')
    .eq('customer_id', req.params.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ─── 고객별 계약 ───
router.get('/customers/:id/contracts', async (req, res) => {
  const { data, error } = await supabase
    .from('bongi_contracts').select('*, bongi_agents(name)')
    .eq('customer_id', req.params.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ─── 상담 생성 ───
router.post('/consultations', async (req, res) => {
  const { customer_id, agent_id, type, product_ticket, notes, callback_at } = req.body;
  const { data, error } = await supabase
    .from('bongi_consultations')
    .insert({ customer_id, agent_id, type, product_ticket, notes, callback_at })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// ─── 상담 상태 업데이트 ───
router.patch('/consultations/:id', async (req, res) => {
  const { status, notes, ai_recommendation, script_suggestion } = req.body;
  const updates = {};
  if (status) {
    updates.status = status;
    if (status === 'in_progress') updates.started_at = new Date().toISOString();
    if (status === 'completed') updates.ended_at = new Date().toISOString();
  }
  if (notes !== undefined) updates.notes = notes;
  if (ai_recommendation) updates.ai_recommendation = ai_recommendation;
  if (script_suggestion) updates.script_suggestion = script_suggestion;

  const { data, error } = await supabase
    .from('bongi_consultations').update(updates).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ─── 계약 생성 ───
router.post('/contracts', async (req, res) => {
  const { data, error } = await supabase
    .from('bongi_contracts').insert(req.body).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// ─── 상담사 목록 ───
router.get('/agents', async (req, res) => {
  const { data, error } = await supabase
    .from('bongi_agents').select('*').eq('is_active', true).order('name');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ─── 상담사 실적 ───
router.get('/agents/:id/performance', async (req, res) => {
  const { year_month } = req.query;
  let query = supabase.from('bongi_agent_performance').select('*').eq('agent_id', req.params.id);
  if (year_month) query = query.eq('year_month', year_month);
  const { data, error } = await query.order('year_month', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ─── 대시보드 통계 ───
router.get('/dashboard/stats', async (req, res) => {
  const [customers, consultations, contracts, applications] = await Promise.all([
    supabase.from('bongi_customers').select('status', { count: 'exact' }),
    supabase.from('bongi_consultations').select('status', { count: 'exact' }),
    supabase.from('bongi_contracts').select('status', { count: 'exact' }),
    supabase.from('bongi_applications').select('status', { count: 'exact' }).eq('status', 'new'),
  ]);

  // 상태별 고객 수
  const statusCounts = {};
  customers.data?.forEach(c => { statusCounts[c.status] = (statusCounts[c.status] || 0) + 1; });

  res.json({
    totalCustomers: customers.count || 0,
    customersByStatus: statusCounts,
    totalConsultations: consultations.count || 0,
    totalContracts: contracts.count || 0,
    pendingApplications: applications.count || 0,
  });
});

// ─── 신청 접수 목록 (웹 폼) ───
router.get('/applications', async (req, res) => {
  const { status } = req.query;
  let query = supabase.from('bongi_applications').select('*');
  if (status) query = query.eq('status', status);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ─── 인센티브 시뮬레이션 ───
router.post('/incentive/calculate', (req, res) => {
  const { internetCount, rentalCount, usimCount, usedPhoneCount } = req.body;
  const result = calculateIncentive({ internetCount, rentalCount, usimCount, usedPhoneCount });
  res.json(result);
});

// ─── 등급/인센티브 정보 ───
router.get('/incentive/info', (req, res) => {
  res.json({ grades: GRADE_INFO, items: ITEM_INFO, baseSalary: 2200000 });
});

export default router;
