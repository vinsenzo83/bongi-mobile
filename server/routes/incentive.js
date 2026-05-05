import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { authenticateJWT, optionalAuth } from '../middleware/auth.js';

const router = Router();

// ─── 헬퍼: req.user → incentive_agents.id 매핑 ───
async function getCurrentIncentiveAgent(userId) {
  if (!userId) return null;
  const { data } = await supabase
    .from('incentive_agents')
    .select('*')
    .eq('user_id', userId)
    .single();
  return data || null;
}

// ─── 헬퍼: role 권한 체크 ───
function isManagerOrAdmin(agent) {
  return agent && (agent.role === 'manager' || agent.role === 'admin');
}
function isAdmin(agent) {
  return agent && agent.role === 'admin';
}
// 계약 처리 권한: contract / manager / admin
function isContractAccess(agent) {
  return agent && (agent.role === 'contract' || agent.role === 'manager' || agent.role === 'admin');
}

// ═══════════════════════════════════════════════════════════════
// 1. GET /api/incentive/products — 상품 카탈로그 (모두 조회 가능)
// ═══════════════════════════════════════════════════════════════
router.get('/products', optionalAuth, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const { carrier, tier, premium_only } = req.query;
    let q = supabase.from('incentive_products').select('*').eq('active', true);
    if (carrier) q = q.eq('carrier', carrier);
    if (tier) q = q.eq('tier', tier);
    if (premium_only === 'true') q = q.eq('is_premium', true);
    const { data, error } = await q.order('id');
    if (error) throw error;
    res.json({ products: data, count: data.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 1.5. PATCH /api/incentive/products/:id — 상품 정보 수정 (admin)
// ═══════════════════════════════════════════════════════════════
router.patch('/products/:id', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isAdmin(me)) return res.status(403).json({ error: 'admin 전용' });
    const allowed = ['rebate', 'payback', 'point_weight', 'name', 'active', 'speed', 'tv_tier'];
    const update = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    if (!Object.keys(update).length) {
      return res.status(400).json({ error: '변경할 필드가 없습니다 (allowed: ' + allowed.join(', ') + ')' });
    }
    const { data, error } = await supabase
      .from('incentive_products')
      .update(update).eq('id', req.params.id).select().single();
    if (error) throw error;
    // 트리거가 자동으로 history INSERT — 그 row에 changed_by 정보 채움
    try {
      await supabase
        .from('incentive_product_history')
        .update({ changed_by_user_id: req.user.id, changed_by_name: me.name })
        .eq('product_id', req.params.id)
        .is('changed_by_user_id', null)
        .gt('changed_at', new Date(Date.now() - 5000).toISOString());
    } catch(e) {}
    res.json({ product: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/incentive/products/history — 전체 변경 이력 (admin/manager/contract)
router.get('/products/history', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isContractAccess(me)) return res.status(403).json({ error: 'manager/contract/admin 전용' });

    const { product_id, limit = 100 } = req.query;
    let q = supabase
      .from('incentive_product_history')
      .select('*, product:incentive_products(name, carrier, type)')
      .order('changed_at', { ascending: false })
      .limit(Math.min(parseInt(limit) || 100, 500));
    if (product_id) q = q.eq('product_id', product_id);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ history: data, count: data.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════
// 2. GET /api/incentive/rules — 활성 V5 규칙 조회
// ═══════════════════════════════════════════════════════════════
router.get('/rules', optionalAuth, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const { data, error } = await supabase
      .from('incentive_rules')
      .select('*')
      .eq('active', true)
      .order('effective_from', { ascending: false })
      .limit(1)
      .single();
    if (error) throw error;
    res.json({ rules: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 3. POST /api/incentive/simulate — 시뮬레이션 (인증 불필요)
//    body: { current_points, current_premium, add_product_id, add_qty, add_payback }
// ═══════════════════════════════════════════════════════════════
router.post('/simulate', optionalAuth, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const {
      current_points = 0,
      current_premium = 0,
      add_product_id,
      add_qty = 1,
      add_payback = 0,
    } = req.body || {};

    if (!add_product_id) {
      return res.status(400).json({ error: 'add_product_id 필수' });
    }
    if (add_payback < 0 || add_payback > 50000) {
      return res.status(400).json({ error: '추가 페이백은 0~50,000원' });
    }

    const { data, error } = await supabase.rpc('incentive_simulate_addition', {
      p_current_points: Number(current_points),
      p_current_premium: parseInt(current_premium) || 0,
      p_add_product_id: parseInt(add_product_id),
      p_add_qty: parseInt(add_qty) || 1,
      p_add_payback: parseInt(add_payback) || 0,
    });
    if (error) throw error;
    // RPC가 TABLE 반환이므로 배열에서 첫 번째 row 추출
    const result = Array.isArray(data) ? data[0] : data;
    res.json({ simulation: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 4. GET /api/incentive/agents/me — 내 incentive_agent 정보
// ═══════════════════════════════════════════════════════════════
router.get('/agents/me', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const agent = await getCurrentIncentiveAgent(req.user.id);
    if (!agent) {
      return res.status(404).json({ error: 'incentive_agent 미등록' });
    }
    res.json({ agent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 5. GET /api/incentive/agents — 상담사 목록 (manager/admin)
// ═══════════════════════════════════════════════════════════════
router.get('/agents', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isContractAccess(me)) {
      return res.status(403).json({ error: 'manager/contract/admin 권한 필요' });
    }
    let q = supabase.from('incentive_agents').select('*').eq('active', true);
    if (me.role === 'manager') q = q.eq('center', me.center);
    // contract는 전체 보임 (모든 센터의 계약 처리)
    const { data, error } = await q.order('hire_date');
    if (error) throw error;
    res.json({ agents: data, count: data.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 6. POST /api/incentive/agents — 상담사 등록 (admin)
// ═══════════════════════════════════════════════════════════════
router.post('/agents', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isAdmin(me)) return res.status(403).json({ error: 'admin 전용' });

    const { user_id, name, center, role = 'agent', hire_date, base_salary = 2300000 } = req.body || {};
    if (!name || !center) return res.status(400).json({ error: 'name, center 필수' });

    const { data, error } = await supabase
      .from('incentive_agents')
      .insert({ user_id, name, center, role, hire_date: hire_date || new Date().toISOString().slice(0, 10), base_salary, active: true })
      .select()
      .single();
    if (error) throw error;
    res.json({ agent: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 6.5. POST /api/incentive/admin/create-agent — 신규 상담사 (auth + agent 통합)
// ═══════════════════════════════════════════════════════════════
router.post('/admin/create-agent', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isAdmin(me)) return res.status(403).json({ error: 'admin 전용' });

    const { email, password, name, center, role = 'agent', base_salary = 2300000, hire_date } = req.body || {};
    if (!email || !password || !name || !center) {
      return res.status(400).json({ error: 'email, password, name, center 필수' });
    }
    if (password.length < 8) return res.status(400).json({ error: '비밀번호 8자 이상' });

    // 1. auth.users 생성
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { display_name: name, role },
    });
    if (createErr) {
      if (createErr.message && createErr.message.toLowerCase().includes('already')) {
        return res.status(409).json({ error: '이미 존재하는 이메일' });
      }
      throw createErr;
    }
    const userId = created.user.id;

    // 2. bongi_user_profiles
    await supabase.from('bongi_user_profiles').upsert(
      { id: userId, role: ['admin','manager','agent'].includes(role) ? role : 'agent', display_name: name },
      { onConflict: 'id' }
    );

    // 3. incentive_agents
    const { data: agent, error: agentErr } = await supabase
      .from('incentive_agents')
      .insert({
        user_id: userId, name, center, role,
        hire_date: hire_date || new Date().toISOString().slice(0, 10),
        base_salary, active: true,
      })
      .select()
      .single();
    if (agentErr) {
      // rollback: auth.users 삭제
      await supabase.auth.admin.deleteUser(userId).catch(() => {});
      throw agentErr;
    }

    res.json({ agent, email, password_set: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 6.6. PATCH /api/incentive/agents/:id — 상담사 정보 수정 (admin)
// ═══════════════════════════════════════════════════════════════
router.patch('/agents/:id', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isAdmin(me)) return res.status(403).json({ error: 'admin 전용' });

    const allowed = ['name', 'center', 'role', 'base_salary', 'active', 'hire_date'];
    const update = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });

    const { data, error } = await supabase
      .from('incentive_agents')
      .update(update).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ agent: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 6.7. POST /api/incentive/agents/:id/reset-password — 비밀번호 재설정 (admin)
// ═══════════════════════════════════════════════════════════════
router.post('/agents/:id/reset-password', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isAdmin(me)) return res.status(403).json({ error: 'admin 전용' });

    const { password } = req.body || {};
    if (!password || password.length < 8) return res.status(400).json({ error: '비밀번호 8자 이상' });

    const { data: agent } = await supabase
      .from('incentive_agents').select('user_id, name').eq('id', req.params.id).single();
    if (!agent || !agent.user_id) return res.status(404).json({ error: '상담사 또는 user_id 없음' });

    const { error } = await supabase.auth.admin.updateUserById(agent.user_id, { password });
    if (error) throw error;
    res.json({ ok: true, name: agent.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 6.8. GET /api/incentive/agents/all — 전체 상담사 (비활성 포함, admin)
// ═══════════════════════════════════════════════════════════════
router.get('/agents/all', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isAdmin(me)) return res.status(403).json({ error: 'admin 전용' });

    const { data, error } = await supabase
      .from('incentive_agents')
      .select('*')
      .order('hire_date', { ascending: false });
    if (error) throw error;
    res.json({ agents: data, count: data.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 7. GET /api/incentive/sales?month=YYYY-MM — 영업 조회
// ═══════════════════════════════════════════════════════════════
router.get('/sales', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(403).json({ error: 'incentive_agent 미등록' });

    const { month, agent_id } = req.query;
    const ym = month || new Date().toISOString().slice(0, 7);
    const [y, m] = ym.split('-');
    const monthStart = `${y}-${m}-01`;
    const monthEnd = new Date(parseInt(y), parseInt(m), 0).toISOString().slice(0, 10);

    let targetAgentId = me.id;
    if (agent_id && isManagerOrAdmin(me)) {
      // 매니저는 본인 센터, 어드민은 모두
      if (me.role === 'manager') {
        const { data: target } = await supabase
          .from('incentive_agents')
          .select('center')
          .eq('id', agent_id)
          .single();
        if (!target || target.center !== me.center) {
          return res.status(403).json({ error: '센터 외 상담사 조회 불가' });
        }
      }
      targetAgentId = agent_id;
    }

    const { data, error } = await supabase
      .from('incentive_sales')
      .select('*, product:incentive_products(*)')
      .eq('agent_id', targetAgentId)
      .gte('contract_date', monthStart)
      .lte('contract_date', monthEnd)
      .order('contract_date', { ascending: false });
    if (error) throw error;
    res.json({ sales: data, count: data.length, month: ym });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 8. POST /api/incentive/sales — 영업 추가
// ═══════════════════════════════════════════════════════════════
router.post('/sales', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(403).json({ error: 'incentive_agent 미등록' });

    const {
      product_id,
      customer_name,
      customer_phone,
      customer_address,
      customer_address_detail,
      bank_account_holder,
      bank_name,
      bank_account_number,
      contract_date,
      installation_date,
      activation_date,
      add_payback = 0,
      notes,
      agent_id, // manager/admin이 다른 상담사 대신 입력 가능
      tv_count,
      additional_products,
      wifi_option,
      quote_summary,
      quote_full_html,
      monthly_fee,
    } = req.body || {};

    if (!product_id) return res.status(400).json({ error: 'product_id 필수' });
    if (add_payback < 0 || add_payback > 50000) {
      return res.status(400).json({ error: '추가 페이백은 0~50,000원' });
    }

    let targetAgentId = me.id;
    if (agent_id && isManagerOrAdmin(me) && agent_id !== me.id) {
      targetAgentId = agent_id;
    }

    const { data, error } = await supabase
      .from('incentive_sales')
      .insert({
        agent_id: targetAgentId,
        product_id,
        customer_name,
        customer_phone,
        customer_address,
        customer_address_detail,
        bank_account_holder,
        bank_name,
        bank_account_number,
        contract_date: contract_date || new Date().toISOString().slice(0, 10),
        installation_date,
        activation_date: activation_date || null,
        add_payback,
        notes,
        status: 'pending', // TM 등록 → 계약부서 처리 대기
        tv_count: tv_count || 1,
        additional_products: additional_products || null,
        wifi_option: wifi_option || null,
        quote_summary: quote_summary || null,
        quote_full_html: quote_full_html || null,
        monthly_fee: monthly_fee || null,
      })
      .select('*, product:incentive_products(*)')
      .single();
    if (error) throw error;
    res.json({ sale: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 9. PATCH /api/incentive/sales/:id — 영업 취소/수정
// ═══════════════════════════════════════════════════════════════
router.patch('/sales/:id', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(403).json({ error: 'incentive_agent 미등록' });

    const { status, cancellation_reason, notes, contract_notes, add_payback, customer_address, customer_address_detail, bank_account_holder, bank_name, bank_account_number, customer_name, customer_phone, installation_date, installation_time, resident_id, gift_received, tv_count, additional_products, wifi_option, quote_summary, quote_full_html, activation_date } = req.body || {};
    const { data: existing } = await supabase
      .from('incentive_sales')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (!existing) return res.status(404).json({ error: '영업 없음' });

    // 본인 영업이거나 manager/admin만 수정 가능
    if (existing.agent_id !== me.id && !isManagerOrAdmin(me)) {
      return res.status(403).json({ error: '본인 영업만 수정 가능' });
    }

    const update = {};
    if (status !== undefined) {
      update.status = status;
      // status 변경 시 해당 timestamp 자동 기록
      if (status !== existing.status) {
        const now = new Date().toISOString();
        if (status === 'pending') update.contract_pending_at = now;
        else if (status === 'in_progress') update.contract_in_progress_at = now;
        else if (status === 'completed') update.contract_completed_at = now;
        else if (status === 'cancelled') update.contract_cancelled_at = now;
      }
    }
    if (activation_date !== undefined) update.activation_date = activation_date;
    if (cancellation_reason !== undefined) update.cancellation_reason = cancellation_reason;
    if (notes !== undefined) update.notes = notes;
    if (contract_notes !== undefined) update.contract_notes = contract_notes;
    if (add_payback !== undefined) update.add_payback = add_payback;
    if (customer_address !== undefined) update.customer_address = customer_address;
    if (customer_address_detail !== undefined) update.customer_address_detail = customer_address_detail;
    if (bank_account_holder !== undefined) update.bank_account_holder = bank_account_holder;
    if (bank_name !== undefined) update.bank_name = bank_name;
    if (bank_account_number !== undefined) update.bank_account_number = bank_account_number;
    if (customer_name !== undefined) update.customer_name = customer_name;
    if (customer_phone !== undefined) update.customer_phone = customer_phone;
    if (installation_date !== undefined) update.installation_date = installation_date;
    if (installation_time !== undefined) update.installation_time = installation_time;
    if (resident_id !== undefined) update.resident_id = resident_id;
    if (gift_received !== undefined) update.gift_received = gift_received;
    if (tv_count !== undefined) update.tv_count = tv_count;
    if (additional_products !== undefined) update.additional_products = additional_products;
    if (wifi_option !== undefined) update.wifi_option = wifi_option;
    if (quote_summary !== undefined) update.quote_summary = quote_summary;
    if (quote_full_html !== undefined) update.quote_full_html = quote_full_html;

    const { data, error } = await supabase
      .from('incentive_sales')
      .update(update)
      .eq('id', req.params.id)
      .select('*, product:incentive_products(*)')
      .single();
    if (error) throw error;
    res.json({ sale: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 10. GET /api/incentive/settlement?month=YYYY-MM — 월별 정산 (live)
// ═══════════════════════════════════════════════════════════════
router.get('/settlement', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(403).json({ error: 'incentive_agent 미등록' });

    const { month, agent_id } = req.query;
    const ym = month || new Date().toISOString().slice(0, 7);

    let targetAgentId = me.id;
    if (agent_id && isManagerOrAdmin(me)) {
      if (me.role === 'manager') {
        const { data: target } = await supabase
          .from('incentive_agents').select('center').eq('id', agent_id).single();
        if (!target || target.center !== me.center) {
          return res.status(403).json({ error: '센터 외 상담사 조회 불가' });
        }
      }
      targetAgentId = agent_id;
    }

    const { data, error } = await supabase.rpc('incentive_calc_monthly_settlement', {
      p_agent_id: targetAgentId,
      p_year_month: ym,
    });
    if (error) throw error;
    res.json({ settlement: data, month: ym });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 11. POST /api/incentive/finalize — 월말 정산 확정 (admin)
// ═══════════════════════════════════════════════════════════════
router.post('/finalize', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isAdmin(me)) return res.status(403).json({ error: 'admin 전용' });

    const { month, agent_id } = req.body || {};
    if (!month) return res.status(400).json({ error: 'month 필수 (YYYY-MM)' });

    if (agent_id) {
      const { data, error } = await supabase.rpc('incentive_finalize_monthly_settlement', {
        p_agent_id: agent_id,
        p_year_month: month,
        p_finalized_by: me.id,
      });
      if (error) throw error;
      return res.json({ settlement: data, month });
    }

    // 전체 활성 상담사 일괄 정산
    const { data: agents } = await supabase
      .from('incentive_agents').select('id').eq('active', true);
    const results = [];
    for (const a of agents || []) {
      const { data, error } = await supabase.rpc('incentive_finalize_monthly_settlement', {
        p_agent_id: a.id,
        p_year_month: month,
        p_finalized_by: me.id,
      });
      if (!error) results.push(data);
    }
    res.json({ count: results.length, settlements: results, month });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 11.4. POST /api/incentive/rules — 새 정책 발행 (admin)
// ═══════════════════════════════════════════════════════════════
router.post('/rules', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isAdmin(me)) return res.status(403).json({ error: 'admin 전용' });

    const {
      version, effective_from, base_salary, bonus_per_premium,
      payback_company_limit, payback_max,
      grade_rates, grade_thresholds, premium_margin_threshold,
      notes, deactivate_others,
    } = req.body || {};

    if (!version || !effective_from || !grade_rates || !grade_thresholds) {
      return res.status(400).json({ error: 'version, effective_from, grade_rates, grade_thresholds 필수' });
    }

    // 기존 active rules 비활성화 (deactivate_others=true 시)
    if (deactivate_others) {
      await supabase.from('incentive_rules').update({ active: false }).eq('active', true);
    }

    const { data, error } = await supabase
      .from('incentive_rules')
      .insert({
        version, effective_from,
        base_salary: base_salary || 2300000,
        bonus_per_premium: bonus_per_premium || 10000,
        payback_company_limit: payback_company_limit || 30000,
        payback_max: payback_max || 50000,
        grade_rates, grade_thresholds,
        premium_margin_threshold: premium_margin_threshold || 250000,
        active: true, notes,
      })
      .select()
      .single();
    if (error) throw error;
    res.json({ rules: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 11.45. PATCH /api/incentive/rules/:id — 기존 정책 수정 (admin)
// ═══════════════════════════════════════════════════════════════
router.patch('/rules/:id', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isAdmin(me)) return res.status(403).json({ error: 'admin 전용' });

    const allowed = ['version', 'effective_from', 'base_salary', 'bonus_per_premium',
      'payback_company_limit', 'payback_max', 'grade_rates', 'grade_thresholds',
      'premium_margin_threshold', 'active', 'notes'];
    const update = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });

    const { data, error } = await supabase
      .from('incentive_rules')
      .update(update)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ rules: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 11.46. GET /api/incentive/rules/all — 모든 정책 이력 (admin)
// ═══════════════════════════════════════════════════════════════
router.get('/rules/all', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isAdmin(me)) return res.status(403).json({ error: 'admin 전용' });

    const { data, error } = await supabase
      .from('incentive_rules')
      .select('*')
      .order('effective_from', { ascending: false });
    if (error) throw error;
    res.json({ rules: data, count: data.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 11.5. GET /api/incentive/contracts?month=&status= — 계약부서 전체 영업 조회
//       manager: 본인 센터 / admin: 전체
// ═══════════════════════════════════════════════════════════════
router.get('/contracts', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isContractAccess(me)) return res.status(403).json({ error: 'contract/manager/admin 전용' });

    const { month, status } = req.query;
    const ym = month || new Date().toISOString().slice(0, 7);
    const [y, m] = ym.split('-');
    const monthStart = `${y}-${m}-01`;
    const monthEnd = new Date(parseInt(y), parseInt(m), 0).toISOString().slice(0, 10);

    let q = supabase
      .from('incentive_sales')
      .select('*, product:incentive_products(*), agent:incentive_agents!incentive_sales_agent_id_fkey(id,name,center,role)')
      .gte('contract_date', monthStart)
      .lte('contract_date', monthEnd);

    if (status) q = q.eq('status', status);

    // manager: 본인 센터 상담사만
    if (me.role === 'manager') {
      const { data: centerAgents } = await supabase
        .from('incentive_agents')
        .select('id')
        .eq('center', me.center);
      const ids = (centerAgents || []).map(a => a.id);
      q = q.in('agent_id', ids);
    }

    const { data, error } = await q.order('contract_date', { ascending: false });
    if (error) throw error;
    res.json({ contracts: data, count: data.length, month: ym });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 12. GET /api/incentive/manager/overview?month=YYYY-MM — 관리자 대시보드
// ═══════════════════════════════════════════════════════════════
router.get('/manager/overview', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isContractAccess(me)) return res.status(403).json({ error: 'contract/manager/admin 전용' });

    const ym = req.query.month || new Date().toISOString().slice(0, 7);

    let agentsQ = supabase.from('incentive_agents').select('*').eq('active', true);
    if (me.role === 'manager') agentsQ = agentsQ.eq('center', me.center);
    const { data: agents } = await agentsQ;

    // 각 상담사의 정산 (live 계산)
    const settlements = [];
    for (const a of agents || []) {
      const { data, error } = await supabase.rpc('incentive_calc_monthly_settlement', {
        p_agent_id: a.id,
        p_year_month: ym,
      });
      if (!error) settlements.push({ agent: a, ...data });
    }

    // 집계
    const totals = settlements.reduce((acc, s) => {
      acc.total_revenue += s.total_revenue || 0;
      acc.total_payback += s.total_payback || 0;
      acc.total_incentive += s.incentive || 0;
      acc.total_bonus += s.bonus || 0;
      acc.total_company_profit += s.company_profit || 0;
      acc.total_sales_count += s.total_count || 0;
      acc.total_premium_count += s.premium_count || 0;
      acc.penalty_count += s.is_penalty ? 1 : 0;
      return acc;
    }, {
      total_revenue: 0, total_payback: 0, total_incentive: 0, total_bonus: 0,
      total_company_profit: 0, total_sales_count: 0, total_premium_count: 0,
      penalty_count: 0,
    });

    const grade_distribution = { 1: 0, 2: 0, 3: 0 };
    settlements.forEach(s => { grade_distribution[s.grade_applied || 1] += 1; });

    res.json({
      month: ym,
      agents_count: settlements.length,
      totals,
      grade_distribution,
      settlements,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
