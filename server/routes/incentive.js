import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { authenticateJWT, optionalAuth } from '../middleware/auth.js';

const router = Router();

// 운영 환경에선 내부 에러 메시지 노출 안 함 (DB 스키마/쿼리 누출 방지)
const _isProd = process.env.NODE_ENV === 'production';
const sanitizeErr = (e) => _isProd ? '서버 오류 — 잠시 후 다시 시도하세요' : (e?.message || '서버 오류');

// notes HTML escape 누적 방지 — PATCH/POST 입력 시 디코드 (2026-05-18 버그 fix)
// UI는 표시 시 한 번 escape하므로 server는 raw text로 저장한다.
function normalizeNotes(s) {
  if (s == null) return null;
  let str = String(s);
  for (let i = 0; i < 5; i++) {
    const prev = str;
    str = str
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/gi, '/')
      .replace(/&#x60;/gi, '`')
      .replace(/&#x3D;/gi, '=')
      .replace(/&#x26;/gi, '&');
    if (str === prev) break;
  }
  return str;
}

// ─── 헬퍼: req.user → incentive_agents.id 매핑 ───
// 60초 in-memory LRU 캐시 (Supabase 매 round-trip 절감)
const _agentCache = new Map();
const AGENT_CACHE_TTL = 60_000;

async function getCurrentIncentiveAgent(userId) {
  if (!userId) return null;
  const cached = _agentCache.get(userId);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.data;

  const { data } = await supabase
    .from('incentive_agents')
    .select('*')
    .eq('user_id', userId)
    .single();
  // 비활성 상담사는 무효 처리 — admin이 active=false 설정 시 토큰 즉시 차단
  const result = (data && data.active) ? data : null;

  // LRU 크기 관리 (최대 500 사용자)
  if (_agentCache.size >= 500) {
    const oldest = _agentCache.keys().next().value;
    _agentCache.delete(oldest);
  }
  // 성공 결과만 60초 캐시 / null은 5초만 (일시 Supabase 지연 시 60초 락 방지)
  const ttl = result ? AGENT_CACHE_TTL : 5_000;
  _agentCache.set(userId, { data: result, expiresAt: now + ttl });
  return result;
}

// 상담사 정보 변경 시 캐시 무효화 (PATCH /agents 등에서 호출)
function invalidateAgentCache(userId) {
  if (userId) _agentCache.delete(userId);
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

// ─── Sales 변경 감사 로그 ───
async function logSaleHistory({ sale_id, action, before, after, user_id, user_name, user_role, reason }) {
  if (!supabase) return;
  try {
    let changed_fields = null;
    // 비교에서 제외할 키 — updated_at(자동), product/db_source/agent/dealer (join 객체, 실제 컬럼은 *_id로 추적)
    const SKIP_FIELDS = new Set(['updated_at', 'product', 'db_source', 'agent', 'dealer']);
    if (action === 'UPDATE' && before && after) {
      changed_fields = Object.keys(after).filter(k => !SKIP_FIELDS.has(k) && JSON.stringify(before[k]) !== JSON.stringify(after[k]));
      if (changed_fields.length === 0) return; // 실제 변경 없으면 skip
    }
    await supabase.from('incentive_sales_history').insert({
      sale_id, action,
      changed_by_user_id: user_id || null,
      changed_by_name: user_name || null,
      changed_by_role: user_role || null,
      before_data: before || null,
      after_data: after || null,
      changed_fields,
      reason: reason || null,
    });
  } catch (e) { console.warn('[sales history]', e.message); }
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
    const { data, error } = await q.order('id');
    if (error) throw error;
    res.json({ products: data, count: data.length });
  } catch (err) {
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요' });
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
    const allowed = ['rebate', 'payback', 'guide_payout', 'max_payout', 'name', 'active', 'speed', 'tv_tier',
                     'gift_amount', 'monthly_fee_min', 'monthly_fee_max', 'install_fee'];
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
    } catch(_e) {}
    res.json({ product: data });
  } catch (err) {
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요' });
  }
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
  } catch (err) {
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요' });
  }
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
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요' });
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
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요' });
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
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요' });
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
    // soft delete 제외 — deleted_at IS NULL만 반환
    let q = supabase.from('incentive_agents').select('*').eq('active', true).is('deleted_at', null);
    if (me.role === 'manager') q = q.eq('center', me.center);
    // contract는 전체 보임 (모든 센터의 계약 처리)
    const { data, error } = await q.order('hire_date');
    if (error) throw error;
    // 2026-06-04: auth.users.email 첨부 — getUserById N+1 (가장 안정)
    await Promise.all(data.filter(a => a.user_id).map(async (a) => {
      try {
        const { data: u } = await supabase.auth.admin.getUserById(a.user_id);
        a.email = u?.user?.email || null;
      } catch (e) { a.email = null; }
    }));
    res.json({ agents: data, count: data.length });
  } catch (err) {
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요' });
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
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요' });
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
      const msg = (createErr.message || '').toLowerCase();
      // 중복 패턴 — 새 SDK / 구 SDK 모두 커버
      if (msg.includes('already') || msg.includes('duplicate') ||
          msg.includes('exists') || msg.includes('registered') ||
          createErr.code === 'email_exists' || createErr.code === 'user_already_exists') {
        return res.status(409).json({ error: '이미 존재하는 이메일입니다' });
      }
      // 비밀번호 정책 위반
      if (msg.includes('password') && (msg.includes('weak') || msg.includes('short'))) {
        return res.status(400).json({ error: '비밀번호가 너무 약합니다 (8자 이상, 영문/숫자 포함 권장)' });
      }
      // 이메일 형식
      if (msg.includes('email') && (msg.includes('invalid') || msg.includes('format'))) {
        return res.status(400).json({ error: '이메일 형식이 올바르지 않습니다' });
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
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요' });
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

    const allowed = ['name', 'center', 'role', 'base_salary', 'active', 'hire_date', 'department_id', 'handle_categories'];
    const update = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    if (update.department_id === '' || update.department_id === 0) update.department_id = null;
    if (Array.isArray(update.handle_categories) && update.handle_categories.length === 0) update.handle_categories = null;

    // 2026-06-04: email → user_id 자동 매핑 (가입된 auth.users 이메일 입력 시)
    if (req.body.email !== undefined) {
      const email = (req.body.email || '').trim().toLowerCase();
      if (!email) {
        update.user_id = null;
      } else {
        // 단일 email lookup — auth.admin.listUsers의 filter 옵션 사용
        try {
          const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
          let found = (list?.users || []).find(u => (u.email || '').toLowerCase() === email);
          if (!found) {
            // RPC fallback (50/page 한계 우회)
            const { data: rpcRes } = await supabase.rpc('admin_get_user_id_by_email', { email_lookup: email });
            if (rpcRes && rpcRes.length) found = { id: rpcRes[0].id, email };
          }
          if (!found) return res.status(400).json({ error: `이메일 미가입: ${email} — 먼저 가입(신규 발급) 후 매핑하세요` });
          update.user_id = found.id;
        } catch (e) { return res.status(500).json({ error: 'auth.users 조회 실패: ' + (e.message || '') }); }
      }
    }

    const { data, error } = await supabase
      .from('incentive_agents')
      .update(update).eq('id', req.params.id).select().single();
    if (error) throw error;
    // 변경 즉시 반영 — 캐시 무효화
    if (data && data.user_id) invalidateAgentCache(data.user_id);
    res.json({ agent: data });
  } catch (err) {
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요' });
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
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요' });
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

    // ?trash=1 → 휴지통 (soft delete된 행만) / 기본 → 활성 (deleted_at IS NULL)
    const trash = req.query.trash === '1' || req.query.trash === 'true';
    let q = supabase
      .from('incentive_agents')
      .select('*');
    if (trash) {
      q = q.not('deleted_at', 'is', null);
    } else {
      q = q.is('deleted_at', null);
    }
    const { data, error } = await q.order('hire_date', { ascending: false });
    if (error) throw error;
    // 2026-06-04: auth.users.email 첨부 (incentive-agents.html에서 실제 사용하는 endpoint)
    await Promise.all(data.filter(a => a.user_id).map(async (a) => {
      try {
        const { data: u } = await supabase.auth.admin.getUserById(a.user_id);
        a.email = u?.user?.email || null;
      } catch (_e) { a.email = null; }
    }));
    res.json({ agents: data, count: data.length, trash });
  } catch (err) {
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요' });
  }
});

// ═══════════════════════════════════════════════════════════════
// 6.9. DELETE /api/incentive/agents/:id — soft delete / 영구 삭제 (admin)
//      ?permanent=1 시 영구 삭제 (auth.users도 함께 제거)
//      기본은 soft delete (deleted_at = now)
// ═══════════════════════════════════════════════════════════════
router.delete('/agents/:id', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isAdmin(me)) return res.status(403).json({ error: 'admin 전용' });

    const permanent = req.query.permanent === '1' || req.query.permanent === 'true';

    // 영구 삭제: incentive_agents row + auth.users 동시 제거
    if (permanent) {
      const { data: agent, error: selErr } = await supabase
        .from('incentive_agents')
        .select('user_id, name')
        .eq('id', req.params.id)
        .single();
      if (selErr || !agent) return res.status(404).json({ error: '상담사 없음' });

      const { error: delErr } = await supabase
        .from('incentive_agents')
        .delete()
        .eq('id', req.params.id);
      if (delErr) throw delErr;

      if (agent.user_id) {
        // auth.users는 best-effort — 실패해도 incentive_agents는 이미 삭제됨
        await supabase.auth.admin.deleteUser(agent.user_id).catch((e) => {
          console.warn('[incentive] auth.admin.deleteUser 실패:', e?.message);
        });
        invalidateAgentCache(agent.user_id);
      }
      return res.json({ ok: true, permanent: true, name: agent.name });
    }

    // soft delete: deleted_at + deleted_by_user_id + active=false
    const { reason } = req.body || {};
    const { data, error } = await supabase
      .from('incentive_agents')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by_user_id: req.user.id,
        active: false,
      })
      .eq('id', req.params.id)
      .select('id, name, user_id')
      .single();
    if (error) throw error;
    if (data && data.user_id) invalidateAgentCache(data.user_id);
    // reason은 현재 컬럼 없음 — 향후 audit 테이블 추가 시 활용. 일단 로그만 남김
    if (reason) console.log('[incentive] soft-delete agent', data?.id, 'reason:', reason);
    res.json({ ok: true, agent: data, soft: true });
  } catch (err) {
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요' });
  }
});

// ═══════════════════════════════════════════════════════════════
// 6.10. POST /api/incentive/agents/:id/restore — 휴지통에서 원복 (admin)
// ═══════════════════════════════════════════════════════════════
router.post('/agents/:id/restore', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isAdmin(me)) return res.status(403).json({ error: 'admin 전용' });

    const { data, error } = await supabase
      .from('incentive_agents')
      .update({
        deleted_at: null,
        deleted_by_user_id: null,
        active: true,
      })
      .eq('id', req.params.id)
      .select('id, name, user_id')
      .single();
    if (error) throw error;
    if (data && data.user_id) invalidateAgentCache(data.user_id);
    res.json({ ok: true, agent: data });
  } catch (err) {
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요' });
  }
});

// ═══════════════════════════════════════════════════════════════
// 정산 수정 요청 (agent → admin)
// ═══════════════════════════════════════════════════════════════
router.post('/corrections', authenticateJWT, async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(401).json({ error: 'unauthenticated' });
    const { period, reason } = req.body || {};
    if (!period || !reason) return res.status(400).json({ error: 'period, reason 필수' });
    const reasonTrim = String(reason).trim().slice(0, 1000);
    if (!reasonTrim) return res.status(400).json({ error: '사유 입력' });
    const { data, error } = await supabase.from('incentive_settlement_corrections')
      .insert({ agent_id: me.id, period, reason: reasonTrim, status: 'pending' })
      .select('*').single();
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: '해당 월 대기 중 요청이 있습니다' });
      throw error;
    }
    res.json({ correction: data });
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

router.get('/corrections', authenticateJWT, async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(401).json({ error: 'unauthenticated' });
    let q = supabase.from('incentive_settlement_corrections')
      .select('*, agent:incentive_agents!incentive_settlement_corrections_agent_id_fkey(id,name,role,center), resolver:incentive_agents!incentive_settlement_corrections_resolved_by_fkey(id,name,role)')
      .order('created_at', { ascending: false }).limit(parseInt(req.query.limit) || 100);
    if (me.role === 'agent') q = q.eq('agent_id', me.id);
    else if (me.role === 'manager') {
      const { data: members } = await supabase.from('incentive_agents').select('id').eq('center', me.center);
      q = q.in('agent_id', (members || []).map(m => m.id));
    }
    if (req.query.status) q = q.eq('status', req.query.status);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ corrections: data || [] });
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

router.post('/corrections/:id(\\d+)/resolve', authenticateJWT, async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me || me.role !== 'admin') return res.status(403).json({ error: 'admin 전용' });
    const note = String(req.body?.note || '').trim().slice(0, 1000);
    const { data, error } = await supabase.from('incentive_settlement_corrections')
      .update({ status: 'resolved', resolved_by: me.id, resolved_at: new Date().toISOString(), resolved_note: note, updated_at: new Date().toISOString() })
      .eq('id', req.params.id).select('*').single();
    if (error) throw error;
    res.json({ correction: data });
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

router.post('/corrections/:id(\\d+)/reject', authenticateJWT, async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me || me.role !== 'admin') return res.status(403).json({ error: 'admin 전용' });
    const note = String(req.body?.note || '').trim().slice(0, 1000);
    const { data, error } = await supabase.from('incentive_settlement_corrections')
      .update({ status: 'rejected', resolved_by: me.id, resolved_at: new Date().toISOString(), resolved_note: note, updated_at: new Date().toISOString() })
      .eq('id', req.params.id).select('*').single();
    if (error) throw error;
    res.json({ correction: data });
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

// (정산 라우트는 정식 GET /settlement (단건) + GET /manager/overview (전체) + POST /finalize 사용)

// ═══════════════════════════════════════════════════════════════
// 6.5 GET /api/incentive/dashboard/timeseries — 대시보드 차트 데이터
//   (지난 N개월 매출 추이, 상태 분포, 상품 TOP, 상담사 ROI, DB 출처 ROI)
// ═══════════════════════════════════════════════════════════════
router.get('/dashboard/timeseries', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(403).json({ error: 'incentive_agent 미등록' });
    const months = Math.min(parseInt(req.query.months) || 6, 12);
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
    const startStr = startDate.toISOString().slice(0,10);

    let q = supabase.from('incentive_sales')
      .select('id, agent_id, product_id, contract_date, status, payback_snapshot, rebate_snapshot, add_payback, db_source_id, product:incentive_products(name), db_source:incentive_db_sources(name,color), agent:incentive_agents(name,role,center)')
      .gte('contract_date', startStr).is('deleted_at', null);
    if (me.role === 'agent') q = q.eq('agent_id', me.id);
    else if (me.role === 'manager') {
      const { data: members } = await supabase.from('incentive_agents').select('id').eq('center', me.center).eq('active', true);
      const ids = (members || []).map(x => x.id);
      if (!ids.length) return res.json({ months, by_month: [], by_status: [], top_products: [], top_agents: [], by_source: [] });
      q = q.in('agent_id', ids);
    }
    q = q.limit(20000);
    const { data: sales, error } = await q;
    if (error) throw error;

    const byMonth = {}, byStatus = {}, byProduct = {}, byAgent = {}, bySource = {};
    for (const s of sales || []) {
      const ym = (s.contract_date || '').slice(0,7);
      const payback = (s.payback_snapshot || 0) + (s.add_payback || 0);
      const rebate = s.rebate_snapshot || 0;
      const total = payback + rebate;
      byMonth[ym] = byMonth[ym] || { month: ym, count: 0, payback: 0, rebate: 0, total: 0 };
      byMonth[ym].count++; byMonth[ym].payback += payback; byMonth[ym].rebate += rebate; byMonth[ym].total += total;
      const st = s.status || 'unknown';
      byStatus[st] = (byStatus[st] || 0) + 1;
      const pn = s.product?.name || '미상';
      byProduct[pn] = byProduct[pn] || { name: pn, count: 0, total: 0 };
      byProduct[pn].count++; byProduct[pn].total += total;
      const an = s.agent?.name || '-';
      byAgent[s.agent_id] = byAgent[s.agent_id] || { id: s.agent_id, name: an, role: s.agent?.role, center: s.agent?.center, count: 0, total: 0 };
      byAgent[s.agent_id].count++; byAgent[s.agent_id].total += total;
      const sn = s.db_source?.name || '미지정';
      bySource[sn] = bySource[sn] || { name: sn, color: s.db_source?.color || '#475569', count: 0, total: 0 };
      bySource[sn].count++; bySource[sn].total += total;
    }

    // 월 시퀀스 채움 (빈 월도 0)
    const fullMonths = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = d.toISOString().slice(0,7);
      fullMonths.push(byMonth[ym] || { month: ym, count: 0, payback: 0, rebate: 0, total: 0 });
    }

    // 🆕 상담사 ROI — V5 정식 RPC `incentive_calc_overview` (이번 달 진행 중 정산)
    // KST 기준 YYYY-MM 정확 계산 (toISOString UTC 변환 회피)
    const kst = new Date(Date.now() + 9 * 3600_000);
    const roiYm = `${kst.getUTCFullYear()}-${String(kst.getUTCMonth()+1).padStart(2,'0')}`;
    let topAgents = [];
    try {
      const center = me.role === 'manager' ? me.center : null;
      const { data: ovRows } = await supabase.rpc('incentive_calc_overview', { p_year_month: roiYm, p_center: center });
      const filtered = me.role === 'agent' ? (ovRows || []).filter(r => r.agent_id === me.id) : (ovRows || []);
      topAgents = filtered.map(r => ({
        id: r.agent_id,
        name: r.agent_name,
        role: r.agent_role,
        center: r.agent_center,
        count: r.total_count || 0,
        residual_margin: Number(r.total_residual_margin || 0),
        is_penalty: !!r.is_penalty,
        incentive: r.incentive || 0,
        bonus: r.bonus || 0,
        agent_total: r.agent_total || 0,  // 최종 상담사 지급액 (V5 정식)
      })).sort((a,b) => b.agent_total - a.agent_total).slice(0, 10);
    } catch (e) { console.warn('[top_agents RPC]', e.message); }

    res.json({
      months,
      total_sales: (sales || []).length,
      roi_period: roiYm,
      by_month: fullMonths,
      by_status: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
      top_products: Object.values(byProduct).sort((a,b) => b.count - a.count).slice(0, 10),
      top_agents: topAgents,
      by_source: Object.values(bySource).sort((a,b) => b.count - a.count),
    });
  } catch (e) {
    console.error('[dashboard/timeseries]', e);
    res.status(500).json({ error: sanitizeErr(e) });
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

    const { month, agent_id, phone } = req.query;

    let q = supabase
      .from('incentive_sales')
      .select('*, product:incentive_products(*), dealer:incentive_dealers!incentive_sales_dealer_id_fkey(id,name,url,active,carrier)')
      .is('deleted_at', null)
      .order('contract_date', { ascending: false });

    // ★ phone 지정 시: 고객 360 모드 — 전체 시간, agent 제한은 admin/manager만 해제
    if (phone) {
      // 010-1234-5678 / 01012345678 양식 모두 매칭 — 숫자만 추출 후 trailing 매칭
      const digits = String(phone).replace(/[^0-9]/g, '');
      if (digits.length < 4) return res.status(400).json({ error: 'phone 4자리 이상' });
      q = q.or(`customer_phone.ilike.%${digits}%,customer_phone.ilike.%${phone}%`);
      // agent는 본인 sales만 — admin/manager는 cross-agent 허용
      if (!isManagerOrAdmin(me)) q = q.eq('agent_id', me.id);
      const { data, error } = await q.limit(50);
      if (error) throw error;
      return res.json({ sales: data, count: data.length, phone });
    }

    // 기본 모드: month + agent
    const ym = month || new Date().toISOString().slice(0, 7);
    const [y, m] = ym.split('-');
    const monthStart = `${y}-${m}-01`;
    const monthEnd = new Date(parseInt(y), parseInt(m), 0).toISOString().slice(0, 10);

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
    q = q.eq('agent_id', targetAgentId).gte('contract_date', monthStart).lte('contract_date', monthEnd);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ sales: data, count: data.length, month: ym });
  } catch (err) {
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요' });
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
      installation_time,
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
      db_source_id,
    } = req.body || {};

    if (!product_id) return res.status(400).json({ error: 'product_id 필수' });
    if (add_payback < 0 || add_payback > 50000) {
      return res.status(400).json({ error: '추가 페이백은 0~50,000원' });
    }

    let targetAgentId = me.id;
    if (agent_id && isManagerOrAdmin(me) && agent_id !== me.id) {
      targetAgentId = agent_id;
    }

    // product price snapshot — 등록 시점의 단가를 박제 (이후 product 가격 변경되어도 영향 없음)
    const { data: prodSnap, error: prodSnapErr } = await supabase
      .from('incentive_products')
      .select('payback, rebate, guide_payout, max_payout')
      .eq('id', product_id)
      .single();
    if (prodSnapErr || !prodSnap) {
      return res.status(400).json({ error: '존재하지 않는 product_id' });
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
        installation_time: installation_time || null,
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
        db_source_id: db_source_id ? parseInt(db_source_id) : null,
        // ── product 단가 snapshot (등록 시점) ──
        payback_snapshot: prodSnap.payback,
        rebate_snapshot: prodSnap.rebate,
      })
      .select('*, product:incentive_products(*)')
      .single();
    if (error) throw error;
    // 변경 감사 로그
    logSaleHistory({ sale_id: data.id, action: 'INSERT', before: null, after: data, user_id: req.user.id, user_name: me.name, user_role: me.role });

    // 🆕 customer-db 자동 변환 — 동일 phone customer 있으면 converted 처리 (콜 모드 진입 여부 무관)
    let convertedCustomerIds = [];
    if (customer_phone) {
      try {
        const raw = String(customer_phone).trim();
        const num = raw.replace(/[^0-9]/g, '');
        const fmt = num.length === 11 ? `${num.slice(0,3)}-${num.slice(3,7)}-${num.slice(7)}` : raw;
        const { data: matched } = await supabase.from('incentive_customer_db')
          .select('id, db_source_id')
          .or(`phone.eq.${raw},phone.eq.${num},phone.eq.${fmt}`)
          .is('deleted_at', null)
          .neq('call_status', 'converted')
          .limit(5);
        if (matched && matched.length) {
          const ids = matched.map(c => c.id);
          convertedCustomerIds = ids;
          const nowIso = new Date().toISOString();
          await supabase.from('incentive_customer_db').update({
            call_status: 'converted',
            converted_sale_id: data.id,
            last_contacted_at: nowIso,
            updated_at: nowIso,
          }).in('id', ids);
          // sale.db_source_id 자동 보충 — sale에 출처 안 보냈는데 customer엔 출처 있으면 복사
          if (!data.db_source_id) {
            const customerSourceId = matched.find(c => c.db_source_id)?.db_source_id;
            if (customerSourceId) {
              await supabase.from('incentive_sales').update({ db_source_id: customerSourceId }).eq('id', data.id);
              data.db_source_id = customerSourceId;
            }
          }
          await supabase.from('incentive_customer_call_log').insert(
            ids.map(id => ({ customer_id: id, agent_id: targetAgentId, result:'converted', notes:`자동 변환 (sale ${data.id})` }))
          );
        }
      } catch (e) { console.warn('[customer-db auto-convert]', e); }
    }

    res.json({ sale: data, converted_customer_ids: convertedCustomerIds });
  } catch (err) {
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요' });
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

    const { status, cancellation_reason, notes, contract_notes, add_payback, customer_address, customer_address_detail, bank_account_holder, bank_name, bank_account_number, customer_name, customer_phone, customer_email, installation_date, installation_time, resident_id, gift_received, tv_count, additional_products, wifi_option, quote_summary, quote_full_html, activation_date, expected_updated_at, product_id, db_source_id, dealer_id,
      birth_date, combo_type, combo_members, billing_method, billing_phone, billing_carrier, payment_method, payment_extra, waiting_person, waiting_phone, waiting_relation, seller_phone, onestop_yn, current_carrier } = req.body || {};
    const { data: existing } = await supabase
      .from('incentive_sales')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (!existing) return res.status(404).json({ error: '영업 없음' });

    // Optimistic locking
    if (expected_updated_at && existing.updated_at !== expected_updated_at) {
      return res.status(409).json({
        error: '이미 다른 사용자가 수정했습니다. 새로고침 후 다시 시도하세요.',
        current_updated_at: existing.updated_at,
      });
    }

    // role별 권한:
    //  agent  → 본인 계약만 (existing.agent_id === me.id)
    //  manager → 본인 센터 상담사 계약만 (existing.agent의 center === me.center)
    //  admin·contract → 전체
    if (me.role === 'agent') {
      if (existing.agent_id !== me.id) return res.status(403).json({ error: '본인 계약만 수정 가능' });
    } else if (me.role === 'manager') {
      const { data: targetAgent } = await supabase.from('incentive_agents').select('center').eq('id', existing.agent_id).single();
      if (!targetAgent || targetAgent.center !== me.center) {
        return res.status(403).json({ error: '본인 센터 상담사 계약만 수정 가능' });
      }
    }
    // admin·contract는 통과

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
    if (customer_email !== undefined) update.customer_email = customer_email;
    if (installation_date !== undefined) update.installation_date = installation_date;
    if (installation_time !== undefined) update.installation_time = installation_time;
    if (resident_id !== undefined) update.resident_id = resident_id;
    if (gift_received !== undefined) update.gift_received = gift_received;
    if (tv_count !== undefined) update.tv_count = tv_count;
    if (additional_products !== undefined) update.additional_products = additional_products;
    if (wifi_option !== undefined) update.wifi_option = wifi_option;
    if (quote_summary !== undefined) update.quote_summary = quote_summary;
    if (quote_full_html !== undefined) update.quote_full_html = quote_full_html;
    if (db_source_id !== undefined) update.db_source_id = db_source_id ? parseInt(db_source_id) : null;
    if (dealer_id !== undefined) update.dealer_id = dealer_id ? parseInt(dealer_id) : null;
    // 🆕 11개 신규 필드 (계약 양식 확장)
    if (birth_date !== undefined) update.birth_date = birth_date || null;
    if (combo_type !== undefined) update.combo_type = combo_type;
    if (combo_members !== undefined) update.combo_members = combo_members;
    if (billing_method !== undefined) update.billing_method = billing_method;
    if (billing_phone !== undefined) update.billing_phone = billing_phone;
    if (billing_carrier !== undefined) update.billing_carrier = billing_carrier;
    if (payment_method !== undefined) update.payment_method = payment_method;
    if (payment_extra !== undefined) update.payment_extra = payment_extra;
    if (waiting_person !== undefined) update.waiting_person = waiting_person;
    if (waiting_phone !== undefined) update.waiting_phone = waiting_phone;
    if (waiting_relation !== undefined) update.waiting_relation = waiting_relation;
    if (seller_phone !== undefined) update.seller_phone = seller_phone;
    if (onestop_yn !== undefined) update.onestop_yn = onestop_yn;
    if (current_carrier !== undefined) update.current_carrier = current_carrier;

    // product 변경 — pending·in_progress 단계까지 허용 (completed·cancelled 차단)
    // 변경 시 snapshot 재계산 + 사유 필수 + contract_notes에 자동 timestamp 기록
    if (product_id !== undefined && product_id !== existing.product_id) {
      if (!['pending','in_progress'].includes(existing.status)) {
        return res.status(400).json({ error: '계약완료·취소된 영업은 상품 변경 불가 (정산·이력 보호)' });
      }
      // 변경 사유 필수 (요구사항 C — 감사·분쟁 대응)
      const reason = (req.body.product_change_reason || '').trim();
      if (!reason) {
        return res.status(400).json({ error: '상품 변경 사유 필수 (예: 고객 요구·시공 불가·재고 없음·기타)' });
      }
      // 새 상품 정보 조회 + 옛 상품 정보 (자동 메모 텍스트용)
      const [{ data: newProd, error: newProdErr }, { data: _oldProd }] = await Promise.all([
        supabase.from('incentive_products')
          .select('id, carrier, speed, tv_tier, payback, rebate, guide_payout, max_payout')
          .eq('id', product_id).single(),
        supabase.from('incentive_products')
          .select('carrier, speed, tv_tier').eq('id', existing.product_id).maybeSingle(),
      ]);
      if (newProdErr || !newProd) {
        return res.status(400).json({ error: '존재하지 않는 product_id' });
      }
      update.product_id = product_id;
      update.payback_snapshot = newProd.payback;
      update.rebate_snapshot = newProd.rebate;
      // contract_notes 자동 append 제거 — 변경 이력 카드(📜)에만 기록 (메모 깔끔하게 유지)
    }

    const { data, error } = await supabase
      .from('incentive_sales')
      .update(update)
      .eq('id', req.params.id)
      .select('*, product:incentive_products(*)')
      .single();
    if (error) throw error;
    // 변경 감사 로그 — 상품 변경 시 사유까지 reason 컬럼에 기록
    logSaleHistory({
      sale_id: data.id, action: 'UPDATE',
      before: existing, after: data,
      user_id: req.user.id, user_name: me.name, user_role: me.role,
      reason: req.body.product_change_reason || null,
    });

    // 🆕 sale 취소/실패 시 customer-db 자동 되돌림 — 콜 큐로 복귀
    if (status && status !== existing.status && (status === 'cancelled' || status === 'failed')) {
      try {
        const { data: linked } = await supabase.from('incentive_customer_db')
          .select('id, call_status').eq('converted_sale_id', data.id).is('deleted_at', null);
        if (linked?.length) {
          const ids = linked.map(c => c.id);
          await supabase.from('incentive_customer_db').update({
            call_status: 'callback', // 재컨택 필요 상태로 복귀
            converted_sale_id: null,
            updated_at: new Date().toISOString(),
          }).in('id', ids);
          await supabase.from('incentive_customer_call_log').insert(
            ids.map(id => ({ customer_id: id, agent_id: existing.agent_id, result:'callback', notes:`sale ${data.id} ${status} → 콜 큐 복귀` }))
          );
        }
      } catch (e) { console.warn('[customer-db sale-revert]', e); }
    }

    res.json({ sale: data });
  } catch (err) {
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요' });
  }
});

// ═══════════════════════════════════════════════════════════════
// 9.5. DELETE /api/incentive/sales/:id — 영업 삭제 (manager/admin)
//      기본: soft delete (deleted_at = now, status='cancelled')
//      ?permanent=1 (admin only): 영구 삭제 (DB row 제거 — 복원 불가)
// ═══════════════════════════════════════════════════════════════
router.delete('/sales/:id', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(403).json({ error: 'incentive_agent 미등록' });

    const permanent = req.query.permanent === '1' || req.query.permanent === 'true';

    // 영구 삭제는 admin 전용
    if (permanent) {
      if (!isAdmin(me)) return res.status(403).json({ error: '영구 삭제는 admin 전용' });
      const { error: delErr } = await supabase
        .from('incentive_sales')
        .delete()
        .eq('id', req.params.id);
      if (delErr) throw delErr;
      return res.json({ ok: true, permanent: true });
    }

    // soft delete role별:
    //  agent → 본인 계약만 / manager → 본인 센터 / admin·contract → 전체
    const { data: existing } = await supabase.from('incentive_sales').select('agent_id').eq('id', req.params.id).single();
    if (!existing) return res.status(404).json({ error: '영업 없음' });
    if (me.role === 'agent') {
      if (existing.agent_id !== me.id) return res.status(403).json({ error: '본인 계약만 삭제 가능' });
    } else if (me.role === 'manager') {
      const { data: targetAgent } = await supabase.from('incentive_agents').select('center').eq('id', existing.agent_id).single();
      if (!targetAgent || targetAgent.center !== me.center) {
        return res.status(403).json({ error: '본인 센터 상담사 계약만 삭제 가능' });
      }
    }

    const { reason } = req.body || {};
    const { data, error } = await supabase
      .from('incentive_sales')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by_user_id: req.user.id,
        deleted_reason: reason || null,
        status: 'cancelled',
        contract_cancelled_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select('id, deleted_at, deleted_reason, status')
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: '영업 없음' });
    // 변경 감사 로그
    logSaleHistory({ sale_id: data.id, action: 'DELETE', before: null, after: data, user_id: req.user.id, user_name: me.name, user_role: me.role, reason: req.body?.reason });
    res.json({ ok: true, soft: true, sale: data });
  } catch (err) {
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요' });
  }
});

// ═══════════════════════════════════════════════════════════════
// 9.6. POST /api/incentive/sales/:id/restore — 휴지통에서 원복 (manager/admin)
//      가장 최근 status timestamp를 기준으로 status 복원
//      (모두 NULL이면 'pending'으로 복원)
// ═══════════════════════════════════════════════════════════════
router.post('/sales/:id/restore', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(403).json({ error: 'incentive_agent 미등록' });

    const { data: existing, error: selErr } = await supabase
      .from('incentive_sales')
      .select('id, agent_id, deleted_at, contract_pending_at, contract_in_progress_at, contract_completed_at, contract_cancelled_at')
      .eq('id', req.params.id)
      .single();
    if (selErr || !existing) return res.status(404).json({ error: '영업 없음' });
    if (!existing.deleted_at) return res.status(400).json({ error: '이미 활성 상태입니다' });

    // role별 원복 권한
    if (me.role === 'agent') {
      if (existing.agent_id !== me.id) return res.status(403).json({ error: '본인 계약만 원복 가능' });
    } else if (me.role === 'manager') {
      const { data: targetAgent } = await supabase.from('incentive_agents').select('center').eq('id', existing.agent_id).single();
      if (!targetAgent || targetAgent.center !== me.center) {
        return res.status(403).json({ error: '본인 센터 상담사 계약만 원복 가능' });
      }
    }

    // 가장 최근 timestamp의 status로 복원
    // 단, contract_cancelled_at은 삭제 시점에 자동 갱신되므로 제외 (실제 취소 vs 삭제 구분)
    const candidates = [
      { status: 'pending',     ts: existing.contract_pending_at },
      { status: 'in_progress', ts: existing.contract_in_progress_at },
      { status: 'completed',   ts: existing.contract_completed_at },
    ];
    let restoreStatus = 'pending';
    let latest = 0;
    candidates.forEach(({ status, ts }) => {
      if (!ts) return;
      const t = new Date(ts).getTime();
      if (!Number.isNaN(t) && t > latest) {
        latest = t;
        restoreStatus = status;
      }
    });

    const { data, error } = await supabase
      .from('incentive_sales')
      .update({
        deleted_at: null,
        deleted_by_user_id: null,
        deleted_reason: null,
        status: restoreStatus,
      })
      .eq('id', req.params.id)
      .select('id, status, deleted_at')
      .single();
    if (error) throw error;
    // 변경 감사 로그
    logSaleHistory({ sale_id: data.id, action: 'RESTORE', before: existing, after: data, user_id: req.user.id, user_name: me.name, user_role: me.role });
    res.json({ ok: true, sale: data, restored_status: restoreStatus });
  } catch (err) {
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요' });
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
    if (error) {
      console.error('[settlement RPC error]', error);
      throw error;
    }
    // RPC가 single composite을 array로 반환할 수 있음 — 정규화
    const settlement = Array.isArray(data) ? (data[0] || null) : data;

    // 🏢 manager 전용: V5.1 팀 오버라이드 계산
    let manager_override = null;
    const { data: targetAgent } = await supabase
      .from('incentive_agents').select('role').eq('id', targetAgentId).single();
    if (targetAgent && targetAgent.role === 'manager') {
      const { data: ovRows, error: ovErr } = await supabase.rpc('incentive_calc_manager_override', {
        p_agent_id: targetAgentId,
        p_year_month: ym,
      });
      if (!ovErr) {
        manager_override = Array.isArray(ovRows) ? (ovRows[0] || null) : ovRows;
        // settlement.agent_total에 override_final 더함
        if (settlement && manager_override) {
          settlement.manager_override_amount = manager_override.override_final || 0;
          settlement.agent_total = (settlement.agent_total || 0) + (manager_override.override_final || 0);
        }
      }
    }

    res.json({ settlement, manager_override, month: ym });
  } catch (err) {
    console.error('[incentive]', req.method, req.path, err.message || err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요', detail: err.message });
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
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요' });
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
      manager_override_rate, manager_obligation_count,
      manager_penalty_partial_min, manager_team_profit_rate_min,
      manager_v51_enabled,
      // 옵션 자동 계산용
      weight_cost_per_p, tier_s_min_margin, tier_a_min_margin, tier_b_min_margin, tier_to_p,
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
        manager_override_rate: manager_override_rate ?? 0.12,
        manager_obligation_count: manager_obligation_count ?? 20,
        manager_penalty_partial_min: manager_penalty_partial_min ?? 10,
        manager_team_profit_rate_min: manager_team_profit_rate_min ?? 0.20,
        manager_v51_enabled: manager_v51_enabled ?? true,
        // 옵션 자동 계산용 (생략 시 기본값)
        weight_cost_per_p: weight_cost_per_p ?? 70000,
        tier_s_min_margin: tier_s_min_margin ?? 250000,
        tier_a_min_margin: tier_a_min_margin ?? 180000,
        tier_b_min_margin: tier_b_min_margin ?? 120000,
        tier_to_p: tier_to_p ?? { S: 2.0, A: 1.5, B: 1.2, C: 1.0 },
        active: true, notes: normalizeNotes(notes),
      })
      .select()
      .single();
    if (error) throw error;
    res.json({ rules: data });
  } catch (err) {
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요' });
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
      'premium_margin_threshold', 'active', 'notes',
      'manager_override_rate', 'manager_obligation_count',
      'manager_penalty_partial_min', 'manager_team_profit_rate_min',
      'manager_v51_enabled',
      // 옵션 자동 계산용 (마진/Tier/P)
      'weight_cost_per_p', 'tier_s_min_margin', 'tier_a_min_margin', 'tier_b_min_margin', 'tier_to_p'];
    const update = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    // notes 누적 escape 디코드 (2026-05-18 fix)
    if (update.notes !== undefined) update.notes = normalizeNotes(update.notes);

    const { data, error } = await supabase
      .from('incentive_rules')
      .update(update)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    // trigger가 자동 INSERT 한 history row에 changed_by 채움 (최근 5초)
    try {
      await supabase
        .from('incentive_rules_history')
        .update({ changed_by_user_id: req.user.id, changed_by_name: me.name, change_reason: req.body.change_reason || null })
        .eq('rule_id', req.params.id)
        .is('changed_by_user_id', null)
        .gt('changed_at', new Date(Date.now() - 5000).toISOString());
    } catch(_e) {}
    res.json({ rules: data });
  } catch (err) {
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요' });
  }
});

// ═══════════════════════════════════════════════════════════════
// 11.455. GET /api/incentive/rules/history — 변경 audit 이력 (admin/manager)
// ═══════════════════════════════════════════════════════════════
router.get('/rules/history', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me || !['admin','manager'].includes(me.role)) return res.status(403).json({ error: 'admin/manager 전용' });
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const { data, error } = await supabase
      .from('incentive_rules_history')
      .select('*')
      .order('changed_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    res.json({ history: data || [] });
  } catch (err) {
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류' });
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
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요' });
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
    // agent: 본인 sale만 조회 가능 / contract·manager·admin: 기존 정책 유지
    if (!me) return res.status(403).json({ error: 'incentive_agent 미등록' });
    if (me.role !== 'agent' && !isContractAccess(me)) {
      return res.status(403).json({ error: 'contract/manager/admin 전용' });
    }

    const { month, status } = req.query;
    const trash = req.query.trash === '1' || req.query.trash === 'true';
    const ym = month || new Date().toISOString().slice(0, 7);
    const [y, m] = ym.split('-');
    const monthStart = `${y}-${m}-01`;
    const monthEnd = new Date(parseInt(y), parseInt(m), 0).toISOString().slice(0, 10);

    // gzip 적용 후 quote_full_html 포함해도 페이로드 작음 (~10KB 추가) — 모달 즉시 표시
    // 휴지통 모드일 때는 deleted_at/deleted_by_user_id/deleted_reason도 함께 반환
    const listCols = 'id,agent_id,product_id,customer_name,customer_phone,customer_email,customer_address,customer_address_detail,resident_id,birth_date,bank_account_holder,bank_name,bank_account_number,contract_date,installation_date,installation_time,activation_date,add_payback,gift_received,tv_count,additional_products,wifi_option,quote_summary,quote_full_html,monthly_fee,notes,contract_notes,status,cancellation_reason,company_payback_burden,agent_payback_deduct,contract_pending_at,contract_in_progress_at,contract_completed_at,contract_cancelled_at,created_at,updated_at,deleted_at,deleted_by_user_id,deleted_reason,payback_snapshot,rebate_snapshot,db_source_id,dealer_id,combo_type,combo_members,billing_method,billing_phone,billing_carrier,payment_method,payment_extra,waiting_person,waiting_phone,waiting_relation,seller_phone,onestop_yn,current_carrier';
    let q = supabase
      .from('incentive_sales')
      .select(`${listCols}, product:incentive_products(*), agent:incentive_agents!incentive_sales_agent_id_fkey(id,name,center,role), dealer:incentive_dealers!incentive_sales_dealer_id_fkey(id,name,url,active,carrier)`)
      .gte('contract_date', monthStart)
      .lte('contract_date', monthEnd);

    // 휴지통 토글 — 기본은 활성(deleted_at IS NULL), trash=1이면 삭제된 항목만
    if (trash) {
      q = q.not('deleted_at', 'is', null);
    } else {
      q = q.is('deleted_at', null);
    }

    if (status) q = q.eq('status', status);

    // agent: 본인 sale만 / manager: 본인 센터 상담사만
    if (me.role === 'agent') {
      q = q.eq('agent_id', me.id);
    } else if (me.role === 'manager') {
      // PostgREST는 join 컬럼 .eq()로 필터 안 됨 → agent_id IN (본인 센터 멤버) 패턴
      const { data: members } = await supabase.from('incentive_agents').select('id').eq('center', me.center).eq('active', true);
      q = q.in('agent_id', (members || []).map(x => x.id));
    }

    const orderField = trash ? 'deleted_at' : 'contract_date';
    const { data, error } = await q.order(orderField, { ascending: false });
    if (error) throw error;
    res.json({ contracts: data, count: data.length, month: ym, trash });
  } catch (err) {
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요' });
  }
});

// GET /api/incentive/sales/:id/quote — 모달 열 때 단건 견적서 HTML 조회
router.get('/sales/:id/quote', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(403).json({ error: 'incentive_agent 미등록' });
    if (me.role !== 'agent' && !isContractAccess(me)) {
      return res.status(403).json({ error: 'contract/manager/admin 전용' });
    }
    const { data, error } = await supabase
      .from('incentive_sales')
      .select('id, agent_id, quote_full_html, quote_summary')
      .eq('id', req.params.id)
      .single();
    if (error) return res.status(404).json({ error: '영업 없음' });
    // agent는 본인 sale만 조회 가능
    if (me.role === 'agent' && data.agent_id !== me.id) {
      return res.status(403).json({ error: '본인 sale만 조회 가능' });
    }
    res.json({ quote_full_html: data.quote_full_html || null, quote_summary: data.quote_summary || null });
  } catch (err) {
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요' });
  }
});

// ═══════════════════════════════════════════════════════════════
// 12. GET /api/incentive/manager/overview?month=YYYY-MM — 관리자 대시보드
// ═══════════════════════════════════════════════════════════════
router.get('/manager/overview', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(403).json({ error: 'incentive_agent 미등록' });
    // agent: 본인 row만 / contract·manager·admin: 기존 정책
    if (me.role !== 'agent' && !isContractAccess(me)) {
      return res.status(403).json({ error: 'contract/manager/admin 전용' });
    }

    const ym = req.query.month || new Date().toISOString().slice(0, 7);

    // 단일 RPC 호출 — 모든 활성 상담사 settlement을 DB 안에서 한 번에 계산
    // (이전: N개 RPC fan-out / 현재: 1 round-trip)
    const { data: rows, error: rpcErr } = await supabase.rpc('incentive_calc_overview', {
      p_year_month: ym,
      p_center: me.role === 'manager' ? me.center : null,
    });
    if (rpcErr) throw rpcErr;
    // agent role: 본인 row만 필터 (서버에서 강제 — 다른 상담사 데이터 차단)
    const filteredRows = me.role === 'agent'
      ? (rows || []).filter(r => r.agent_id === me.id)
      : (rows || []);
    // 잔존마진 단일 구조 — 가전렌탈·포인트제는 2026-08-24 폐지
    const settlements = filteredRows.map(r => {
      return {
        agent: {
          id: r.agent_id, name: r.agent_name, center: r.agent_center,
          role: r.agent_role, user_id: r.agent_user_id,
        },
        total_count: r.total_count,
        total_residual_margin: r.total_residual_margin,
        incentive_rate_applied: r.incentive_rate_applied,
        is_penalty: r.is_penalty,
        total_revenue: r.total_revenue, total_payback: r.total_payback,
        total_company_payback_burden: r.total_company_payback_burden,
        total_agent_payback_deduct: r.total_agent_payback_deduct,
        base_salary: r.base_salary, incentive: r.incentive, bonus: r.bonus,
        agent_total: r.agent_total, company_profit: r.company_profit,
        profit_rate: r.profit_rate, finalized_at: r.finalized_at,
      };
    });

    // 집계
    const totals = settlements.reduce((acc, s) => {
      acc.total_revenue += s.total_revenue || 0;
      acc.total_payback += s.total_payback || 0;
      acc.total_company_payback_burden += s.total_company_payback_burden || 0;
      acc.total_incentive += s.incentive || 0;
      acc.total_bonus += s.bonus || 0;
      acc.total_company_profit += s.company_profit || 0;
      acc.total_sales_count += s.total_count || 0;
      acc.penalty_count += s.is_penalty ? 1 : 0;
      return acc;
    }, {
      total_revenue: 0, total_payback: 0, total_company_payback_burden: 0,
      total_incentive: 0, total_bonus: 0,
      total_company_profit: 0, total_sales_count: 0,
      penalty_count: 0,
    });
    // 실제 상품 마진 = 매출(리베이트) − 지급 페이백 − 회사 부담 페이백 (인건비 차감 전)
    totals.total_product_margin = totals.total_revenue - totals.total_payback - totals.total_company_payback_burden;

    res.json({
      month: ym,
      agents_count: settlements.length,
      totals,
      settlements,
    });
  } catch (err) {
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요' });
  }
});

// ═══════════════════════════════════════════════════════════════
// calculator.html 변경 이력 (localStorage → DB 마이그레이션 Phase 1)
// 섹션 예: '1·인터넷', '2·TV', '4·결합', '5·설치비', '6·제휴카드', '8·사은품'
// ═══════════════════════════════════════════════════════════════

// POST /api/incentive/calc-history — 변경 이력 기록 (manager/admin)
router.post('/calc-history', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isManagerOrAdmin(me)) return res.status(403).json({ error: 'manager/admin 전용' });

    const { section, action, field, before_value, after_value, notes } = req.body || {};
    if (!section || !action) {
      return res.status(400).json({ error: 'section, action 필수' });
    }

    const { data, error } = await supabase
      .from('incentive_calculator_history')
      .insert({
        section,
        action,
        field: field || null,
        before_value: before_value != null ? String(before_value) : null,
        after_value: after_value != null ? String(after_value) : null,
        changed_by_user_id: req.user.id,
        changed_by_name: me.name,
        notes: notes || null,
      })
      .select()
      .single();
    if (error) throw error;
    res.json({ entry: data });
  } catch (err) {
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요' });
  }
});

// ═══════════════════════════════════════════════════════════════
// calculator.html 6종 overrides 통합 저장 (localStorage → DB Phase 2)
// section: 'tv' / 'bundle' / 'device' / 'install' / 'card' / 'gift' / 'gift-catalog-custom'
// ═══════════════════════════════════════════════════════════════
const CALC_OVERRIDE_SECTIONS = ['tv','bundle','device','install','card','gift','gift-catalog-custom','sales','import_rules','tvpolicy','lgubonus'];

// GET /api/incentive/calc-overrides — 모든 섹션 override 조회 (모든 logged-in user)
router.get('/calc-overrides', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const { data, error } = await supabase
      .from('incentive_calculator_overrides')
      .select('section, data, updated_at');
    if (error) throw error;
    const overrides = {};
    (data || []).forEach(r => { overrides[r.section] = r.data; });
    res.json({ overrides });
  } catch (err) {
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요' });
  }
});

// PUT /api/incentive/calc-overrides/:section — 특정 섹션 override 저장 (manager/admin)
router.put('/calc-overrides/:section', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isManagerOrAdmin(me)) return res.status(403).json({ error: 'manager/admin 전용' });

    const section = req.params.section;
    if (!CALC_OVERRIDE_SECTIONS.includes(section)) {
      return res.status(400).json({ error: 'invalid section' });
    }
    const { data: payload } = req.body || {};

    // 변경 전 데이터 — history 기록용
    const { data: before } = await supabase
      .from('incentive_calculator_overrides')
      .select('data').eq('section', section).maybeSingle();

    const { data, error } = await supabase
      .from('incentive_calculator_overrides')
      .upsert({
        section,
        data: payload || (Array.isArray(payload) ? [] : {}),
        updated_at: new Date().toISOString(),
        updated_by_user_id: req.user.id,
        updated_by_name: me.name,
      }, { onConflict: 'section' })
      .select()
      .single();
    if (error) throw error;

    // 변경 이력 기록 (실패해도 main 응답 막지 X)
    try {
      await supabase.from('incentive_calculator_history').insert({
        section,
        action: before?.data ? 'UPDATE' : 'INSERT',
        field: 'data',
        before_value: before?.data ? JSON.stringify(before.data) : null,
        after_value: JSON.stringify(data.data),
        changed_by_user_id: req.user.id,
        changed_by_name: me.name,
        changed_at: new Date().toISOString(),
      });
    } catch (e) { console.warn('[calc-history] insert fail', e.message); }

    res.json({ override: data });
  } catch (err) {
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요' });
  }
});

// GET /api/incentive/calc-history — 변경 이력 조회 (manager/contract/admin)
router.get('/calc-history', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isContractAccess(me)) return res.status(403).json({ error: 'manager/contract/admin 전용' });

    const { section, limit = 100 } = req.query;
    let q = supabase
      .from('incentive_calculator_history')
      .select('*')
      .order('changed_at', { ascending: false })
      .limit(Math.min(parseInt(limit) || 100, 500));
    if (section) q = q.eq('section', section);

    const { data, error } = await q;
    if (error) throw error;
    res.json({ history: data, count: data.length });
  } catch (err) {
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요' });
  }
});

// ═══════════════════════════════════════════════════════════════
// TM 상담 도구 (tm-counselor.html) — Phase 3
// 1) tm/scripts: 회사 공통 상담 스크립트 (singleton id=1, manager/admin 편집)
// 2) tm/memos:   개인 메모 (PK=user_id, 본인만)
// ═══════════════════════════════════════════════════════════════

// GET /api/incentive/tm/scripts — 모든 로그인 사용자 조회
router.get('/tm/scripts', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const { data, error } = await supabase
      .from('incentive_tm_scripts')
      .select('steps, updated_at, updated_by_name')
      .eq('id', 1)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    res.json({
      scripts: (data && data.steps) || [],
      updated_at: data?.updated_at || null,
      updated_by: data?.updated_by_name || null,
    });
  } catch (err) {
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요' });
  }
});

// PUT /api/incentive/tm/scripts — manager/admin 전용
router.put('/tm/scripts', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isManagerOrAdmin(me)) return res.status(403).json({ error: 'manager/admin 전용' });

    const { steps } = req.body || {};
    if (!Array.isArray(steps)) return res.status(400).json({ error: 'steps 배열 필수' });

    const { data, error } = await supabase
      .from('incentive_tm_scripts')
      .upsert({
        id: 1,
        steps,
        updated_at: new Date().toISOString(),
        updated_by_user_id: req.user.id,
        updated_by_name: me.name,
      }, { onConflict: 'id' })
      .select()
      .single();
    if (error) throw error;
    res.json({
      scripts: data.steps,
      updated_at: data.updated_at,
      updated_by: data.updated_by_name,
    });
  } catch (err) {
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요' });
  }
});

// GET /api/incentive/tm/memos — 본인 메모 조회
router.get('/tm/memos', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const { data, error } = await supabase
      .from('incentive_tm_memos')
      .select('memos, draft, updated_at')
      .eq('user_id', req.user.id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    res.json({
      memos: (data && data.memos) || [],
      draft: (data && data.draft) || '',
      updated_at: data?.updated_at || null,
    });
  } catch (err) {
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요' });
  }
});

// ═══════════════════════════════════════════════════════════════
// Role 권한 매트릭스 (incentive_role_permissions)
// ═══════════════════════════════════════════════════════════════

// GET /api/incentive/role-permissions — 모든 role 권한 매트릭스 (admin 전용)
router.get('/role-permissions', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isAdmin(me)) return res.status(403).json({ error: 'admin 전용' });
    const { data, error } = await supabase
      .from('incentive_role_permissions')
      .select('role, menus, updated_at, updated_by_user_id')
      .order('role');
    if (error) throw error;
    res.json({ permissions: data });
  } catch (err) {
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: err.message || '서버 오류 — 잠시 후 다시 시도하세요' });
  }
});

// GET /api/incentive/role-permissions/me — 내 role 메뉴 (모든 인증 사용자)
router.get('/role-permissions/me', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(401).json({ error: 'unauthenticated' });
    const { data, error } = await supabase
      .from('incentive_role_permissions')
      .select('menus')
      .eq('role', me.role)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    res.json({ role: me.role, menus: (data && data.menus) || [] });
  } catch (err) {
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: err.message || '서버 오류 — 잠시 후 다시 시도하세요' });
  }
});

// PUT /api/incentive/role-permissions/:role — role 권한 수정 (admin 전용)
router.put('/role-permissions/:role', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isAdmin(me)) return res.status(403).json({ error: 'admin 전용' });
    const role = req.params.role;
    if (!['agent', 'manager', 'admin', 'contract'].includes(role)) {
      return res.status(400).json({ error: '유효하지 않은 role' });
    }
    const { menus } = req.body || {};
    if (!Array.isArray(menus)) {
      return res.status(400).json({ error: 'menus 배열 필수' });
    }
    // admin role 락다운 방지: admin은 최소 'permissions','agents' 보장
    if (role === 'admin') {
      const required = ['permissions', 'agents'];
      for (const r of required) {
        if (!menus.includes(r)) {
          return res.status(400).json({
            error: `admin role은 '${r}' 메뉴를 제거할 수 없습니다 (자기 자신 lockout 방지)`,
          });
        }
      }
    }
    // 변경 전 menus 조회 (감사 로그용)
    const { data: prev } = await supabase
      .from('incentive_role_permissions')
      .select('menus').eq('role', role).single();
    const beforeMenus = (prev && prev.menus) || [];

    const { data, error } = await supabase
      .from('incentive_role_permissions')
      .upsert({
        role,
        menus,
        updated_at: new Date().toISOString(),
        updated_by_user_id: req.user.id,
      })
      .select()
      .single();
    if (error) throw error;

    // 변경 감사 로그
    try {
      const beforeSet = new Set(beforeMenus);
      const afterSet = new Set(menus);
      const added = menus.filter(x => !beforeSet.has(x));
      const removed = beforeMenus.filter(x => !afterSet.has(x));
      if (added.length || removed.length) {
        await supabase.from('incentive_role_permissions_history').insert({
          role,
          changed_by_user_id: req.user.id,
          changed_by_name: me.name,
          before_menus: beforeMenus,
          after_menus: menus,
          added: added.length ? added : null,
          removed: removed.length ? removed : null,
        });
      }
    } catch (e) { console.warn('[perm history]', e.message); }
    res.json({ permission: data });
  } catch (err) {
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: err.message || '서버 오류 — 잠시 후 다시 시도하세요' });
  }
});

// ═══════════════════════════════════════════════════════════════
// 14. DB 출처 (incentive_db_sources) — 콜센터 상담 DB 종류 관리
// ═══════════════════════════════════════════════════════════════

// GET /api/incentive/db-sources — 활성 목록 (인증된 모든 user)
router.get('/db-sources', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const { data, error } = await supabase
      .from('incentive_db_sources')
      .select('*')
      .eq('active', true)
      .order('display_order');
    if (error) throw error;
    res.json({ db_sources: data });
  } catch (e) {
    console.error('[incentive]', req.method, req.path, e);
    res.status(500).json({ error: sanitizeErr(e) });
  }
});

// GET /api/incentive/db-sources/all — 전체 (admin) 비활성 포함
router.get('/db-sources/all', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isAdmin(me)) return res.status(403).json({ error: 'admin 전용' });
    const { data, error } = await supabase
      .from('incentive_db_sources')
      .select('*')
      .order('display_order');
    if (error) throw error;
    res.json({ db_sources: data });
  } catch (e) {
    console.error('[incentive]', req.method, req.path, e);
    res.status(500).json({ error: sanitizeErr(e) });
  }
});

// POST /api/incentive/db-sources — 신규 등록 (admin)
router.post('/db-sources', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isAdmin(me)) return res.status(403).json({ error: 'admin 전용' });
    const { name, code, color, display_order, notes, active } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'name 필수' });
    const { data, error } = await supabase
      .from('incentive_db_sources')
      .insert({
        name: name.trim(),
        code: (code || '').trim() || null,
        color: color || '#3b82f6',
        display_order: parseInt(display_order) || 0,
        notes: notes || null,
        active: active !== false,
        created_by_user_id: req.user.id,
      })
      .select().single();
    if (error) throw error;
    res.json({ db_source: data });
  } catch (e) {
    console.error('[incentive]', req.method, req.path, e);
    res.status(500).json({ error: sanitizeErr(e) });
  }
});

// PATCH /api/incentive/db-sources/:id — 수정 (admin)
router.patch('/db-sources/:id', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isAdmin(me)) return res.status(403).json({ error: 'admin 전용' });
    const allowed = ['name', 'code', 'color', 'display_order', 'notes', 'active'];
    const update = { updated_at: new Date().toISOString() };
    for (const k of allowed) if (k in (req.body || {})) update[k] = req.body[k];
    if (update.display_order !== undefined) update.display_order = parseInt(update.display_order) || 0;
    if (update.name !== undefined && (!update.name || !String(update.name).trim())) {
      return res.status(400).json({ error: 'name 비어있을 수 없음' });
    }
    if (typeof update.name === 'string') update.name = update.name.trim();
    if (typeof update.code === 'string') update.code = update.code.trim() || null;
    const { data, error } = await supabase
      .from('incentive_db_sources')
      .update(update)
      .eq('id', req.params.id)
      .select().single();
    if (error) throw error;
    res.json({ db_source: data });
  } catch (e) {
    console.error('[incentive]', req.method, req.path, e);
    res.status(500).json({ error: sanitizeErr(e) });
  }
});

// DELETE /api/incentive/db-sources/:id — 비활성화 (admin) — soft (active=false)
router.delete('/db-sources/:id', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isAdmin(me)) return res.status(403).json({ error: 'admin 전용' });
    const { data, error } = await supabase
      .from('incentive_db_sources')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select().single();
    if (error) throw error;
    res.json({ db_source: data });
  } catch (e) {
    console.error('[incentive]', req.method, req.path, e);
    res.status(500).json({ error: sanitizeErr(e) });
  }
});

// PUT /api/incentive/tm/memos — 본인 메모/draft 저장
router.put('/tm/memos', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const { memos, draft } = req.body || {};
    if (memos !== undefined && !Array.isArray(memos)) {
      return res.status(400).json({ error: 'memos는 배열이어야 합니다' });
    }
    if (draft !== undefined && typeof draft !== 'string') {
      return res.status(400).json({ error: 'draft는 문자열이어야 합니다' });
    }

    const update = {
      user_id: req.user.id,
      updated_at: new Date().toISOString(),
    };
    if (memos !== undefined) update.memos = memos;
    if (draft !== undefined) update.draft = draft;

    const { data, error } = await supabase
      .from('incentive_tm_memos')
      .upsert(update, { onConflict: 'user_id' })
      .select()
      .single();
    if (error) throw error;
    res.json({
      memos: data.memos || [],
      draft: data.draft || '',
      updated_at: data.updated_at,
    });
  } catch (err) {
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요' });
  }
});

// ═══════════════════════════════════════════════════════════════
// 변경 감사 로그 조회 (manager/admin)
// ═══════════════════════════════════════════════════════════════

// GET /api/incentive/sales/:id/history — 특정 sale 변경 이력
router.get('/sales/:id/history', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(401).json({ error: 'unauthenticated' });
    // 권한 — 대상 sale의 agent와 매칭 검증
    const { data: sale } = await supabase.from('incentive_sales').select('agent_id').eq('id', req.params.id).single();
    if (!sale) return res.status(404).json({ error: 'sale not found' });
    if (me.role === 'agent') {
      if (sale.agent_id !== me.id) return res.status(403).json({ error: '본인 계약만 조회 가능' });
    } else if (me.role === 'manager') {
      const { data: targetAgent } = await supabase.from('incentive_agents').select('center').eq('id', sale.agent_id).single();
      if (!targetAgent || targetAgent.center !== me.center) return res.status(403).json({ error: '본인 센터 계약만 조회 가능' });
    }
    // admin·contract 통과
    const { data, error } = await supabase
      .from('incentive_sales_history')
      .select('*')
      .eq('sale_id', req.params.id)
      .order('changed_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    res.json({ history: data });
  } catch (e) {
    console.error('[incentive]', req.method, req.path, e);
    res.status(500).json({ error: sanitizeErr(e) });
  }
});

// GET /api/incentive/sales-history — 전체 sales 변경 이력 (admin/manager)
router.get('/sales-history', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isManagerOrAdmin(me)) return res.status(403).json({ error: 'manager/admin 전용' });
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const { data, error } = await supabase
      .from('incentive_sales_history')
      .select('*')
      .order('changed_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    res.json({ history: data });
  } catch (e) {
    console.error('[incentive]', req.method, req.path, e);
    res.status(500).json({ error: sanitizeErr(e) });
  }
});

// GET /api/incentive/manager-overrides?month=YYYY-MM — 모든 manager의 V5.1 오버라이드 (admin)
router.get('/manager-overrides', authenticateJWT, async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isAdmin(me)) return res.status(403).json({ error: 'admin 전용' });
    const ym = req.query.month || new Date().toISOString().slice(0, 7);
    const { data: managers } = await supabase
      .from('incentive_agents')
      .select('id, name, center, base_salary, user_id')
      .eq('role', 'manager').eq('active', true);
    const out = [];
    for (const m of (managers || [])) {
      const { data, error } = await supabase.rpc('incentive_calc_manager_override', {
        p_agent_id: m.id, p_year_month: ym,
      });
      if (error) continue;
      const ov = Array.isArray(data) ? (data[0] || null) : data;
      out.push({ agent: m, override: ov });
    }
    res.json({ month: ym, managers: out });
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

// ═══════════════════════════════════════════════════════════════
// V5.1 Manager 면제 관리
// ═══════════════════════════════════════════════════════════════

// GET /api/incentive/manager-exemptions?month=YYYY-MM — admin 조회
router.get('/manager-exemptions', authenticateJWT, async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isAdmin(me)) return res.status(403).json({ error: 'admin 전용' });
    let q = supabase.from('incentive_manager_exemptions').select('*');
    if (req.query.month) q = q.eq('year_month', req.query.month);
    if (req.query.agent_id) q = q.eq('agent_id', req.query.agent_id);
    const { data, error } = await q.order('granted_at', { ascending: false }).limit(200);
    if (error) throw error;
    res.json({ exemptions: data });
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

// POST /api/incentive/manager-exemptions — 면제 부여 (admin)
router.post('/manager-exemptions', authenticateJWT, async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isAdmin(me)) return res.status(403).json({ error: 'admin 전용' });
    const { agent_id, year_month, reason, notes } = req.body || {};
    if (!agent_id || !year_month || !reason) {
      return res.status(400).json({ error: 'agent_id, year_month, reason 필수' });
    }
    const { data, error } = await supabase.from('incentive_manager_exemptions').upsert({
      agent_id, year_month, reason, notes: notes || null,
      granted_by_user_id: req.user.id, granted_by_name: me.name,
      granted_at: new Date().toISOString(),
    }, { onConflict: 'agent_id,year_month' }).select().single();
    if (error) throw error;
    res.json({ exemption: data });
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

// DELETE /api/incentive/manager-exemptions/:id — 면제 해제 (admin)
router.delete('/manager-exemptions/:id', authenticateJWT, async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isAdmin(me)) return res.status(403).json({ error: 'admin 전용' });
    const { error } = await supabase.from('incentive_manager_exemptions').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

// GET /api/incentive/role-permissions/history — 권한 매트릭스 변경 이력 (admin)
router.get('/role-permissions/history', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isAdmin(me)) return res.status(403).json({ error: 'admin 전용' });
    const { data, error } = await supabase
      .from('incentive_role_permissions_history')
      .select('*')
      .order('changed_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    res.json({ history: data });
  } catch (e) {
    console.error('[incentive]', req.method, req.path, e);
    res.status(500).json({ error: sanitizeErr(e) });
  }
});

// ═══════════════════════════════════════════════════════════════
// 🎯 월간 목표 (incentive_monthly_goals)
// ═══════════════════════════════════════════════════════════════

// GET /goals?ym=2026-05[&agent_id=...]
router.get('/goals', authenticateJWT, async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(401).json({ error: 'unauthenticated' });
    const ym = req.query.ym || new Date().toISOString().slice(0, 7);
    let q = supabase.from('incentive_monthly_goals')
      .select('*, agent:incentive_agents!incentive_monthly_goals_agent_id_fkey(id, name, role, center)')
      .eq('ym', ym);
    if (me.role === 'agent') q = q.eq('agent_id', me.id);
    else if (me.role === 'manager') {
      const { data: members } = await supabase.from('incentive_agents').select('id').eq('center', me.center).eq('active', true);
      q = q.in('agent_id', (members || []).map(x => x.id));
    }
    if (req.query.agent_id) q = q.eq('agent_id', req.query.agent_id);
    const { data, error } = await q;
    if (error) throw error;

    const ymStart = ym + '-01';
    const next = new Date(ymStart); next.setMonth(next.getMonth() + 1);
    const ymEnd = next.toISOString().slice(0, 10);

    const goals = await Promise.all((data || []).map(async (g) => {
      const aid = g.agent_id;
      const [callsResp, salesResp, settleResp] = await Promise.all([
        // 콜 시도 = 통화 로그 카운트 (called_at 기준)
        supabase.from('incentive_customer_call_log').select('id', { count:'exact', head:true })
          .eq('agent_id', aid).gte('called_at', ymStart).lt('called_at', ymEnd),
        // 전환 = 계약 카운트 (contract_date 기준, 삭제 제외)
        supabase.from('incentive_sales').select('id', { count:'exact', head:true })
          .eq('agent_id', aid).gte('contract_date', ymStart).lt('contract_date', ymEnd).is('deleted_at', null),
        // 잔존마진 (V5 정산 RPC)
        supabase.rpc('incentive_calc_monthly_settlement', { p_agent_id: aid, p_year_month: ym }),
      ]);
      const callsActual = callsResp.count || 0;
      const convActual = salesResp.count || 0;
      const settle = Array.isArray(settleResp.data) ? settleResp.data[0] : settleResp.data;
      const points = Number(settle?.total_residual_margin || 0);
      return {
        ...g,
        actual: { calls: callsActual, conversions: convActual, points },
        progress: {
          calls: g.target_calls > 0 ? Math.round(callsActual / g.target_calls * 100) : 0,
          conversions: g.target_conversions > 0 ? Math.round(convActual / g.target_conversions * 100) : 0,
          points: g.target_points > 0 ? Math.round(points / g.target_points * 100) : 0,
        },
      };
    }));
    res.json({ ym, goals });
  } catch (e) { console.error('[goals list]', e); res.status(500).json({ error: e.message }); }
});

// POST /goals — upsert (manager·admin)
router.post('/goals', authenticateJWT, async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me || (me.role !== 'admin' && me.role !== 'manager')) return res.status(403).json({ error: 'admin·manager 전용' });
    const { agent_id, ym, target_calls = 0, target_conversions = 0, target_points = 0, notes } = req.body || {};
    if (!agent_id || !ym) return res.status(400).json({ error: 'agent_id, ym 필수' });
    if (!/^[0-9]{4}-[0-9]{2}$/.test(ym)) return res.status(400).json({ error: 'ym 형식 YYYY-MM' });
    if (me.role === 'manager') {
      const { data: target } = await supabase.from('incentive_agents').select('center').eq('id', agent_id).single();
      if (!target || target.center !== me.center) return res.status(403).json({ error: '본인 센터 상담사만' });
    }
    // 음수 입력 방지 (UI bypass 가능성)
    const tCalls = Math.max(0, parseInt(target_calls) || 0);
    const tConv = Math.max(0, parseInt(target_conversions) || 0);
    const tPoints = Math.max(0, parseFloat(target_points) || 0);
    const { data, error } = await supabase.from('incentive_monthly_goals').upsert({
      agent_id, ym,
      target_calls: tCalls,
      target_conversions: tConv,
      target_points: tPoints,
      notes: (notes || '').slice(0, 500),
      created_by: req.user.id, updated_at: new Date().toISOString(),
    }, { onConflict: 'agent_id,ym' }).select().single();
    if (error) throw error;
    res.json({ goal: data });
  } catch (e) { console.error('[goals upsert]', e); res.status(500).json({ error: e.message }); }
});

// DELETE /goals/:id
router.delete('/goals/:id(\\d+)', authenticateJWT, async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me || (me.role !== 'admin' && me.role !== 'manager')) return res.status(403).json({ error: 'admin·manager 전용' });
    // manager는 본인 센터 상담사 목표만 삭제
    if (me.role === 'manager') {
      const { data: goal } = await supabase.from('incentive_monthly_goals')
        .select('agent_id, agent:incentive_agents!incentive_monthly_goals_agent_id_fkey(center)')
        .eq('id', req.params.id).single();
      if (!goal) return res.status(404).json({ error: '목표 없음' });
      if (goal.agent?.center !== me.center) return res.status(403).json({ error: '본인 센터 상담사만' });
    }
    const { error } = await supabase.from('incentive_monthly_goals').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════
// 🏪 대리점 (incentive_dealers) — 통신사별 접수 대리점 + URL 관리
// ═══════════════════════════════════════════════════════════════

// GET /dealers?carrier=skt[&active_only=true]
router.get('/dealers', authenticateJWT, async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(401).json({ error: 'unauthenticated' });
    let q = supabase.from('incentive_dealers').select('*').order('carrier').order('display_order').order('name');
    if (req.query.carrier) q = q.eq('carrier', req.query.carrier);
    if (req.query.active_only === 'true') q = q.eq('active', true);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ dealers: data || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// URL scheme 화이트리스트 (javascript:·data:·file: 등 차단)
function _safeDealerUrl(u) {
  if (!u) return null;
  try {
    const p = new URL(String(u).trim());
    return ['http:', 'https:', 'mailto:'].includes(p.protocol) ? String(u).trim().slice(0, 500) : null;
  } catch { return null; }
}

// POST /dealers (admin)
router.post('/dealers', authenticateJWT, async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me || me.role !== 'admin') return res.status(403).json({ error: 'admin 전용' });
    const { carrier, name, url, notes, display_order } = req.body || {};
    if (!carrier || !name) return res.status(400).json({ error: 'carrier·name 필수' });
    if (!['skt', 'kt', 'lgu'].includes(carrier)) return res.status(400).json({ error: 'carrier는 skt/kt/lgu 중 하나' });
    if (url && !_safeDealerUrl(url)) return res.status(400).json({ error: 'URL은 http/https/mailto만 허용' });
    const { data, error } = await supabase.from('incentive_dealers').insert({
      carrier, name: String(name).trim().slice(0, 100),
      url: _safeDealerUrl(url),
      notes: notes ? String(notes).slice(0, 500) : null,
      display_order: parseInt(display_order) || 0,
      created_by: req.user.id,
    }).select().single();
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: '동일 통신사에 같은 이름의 대리점이 이미 있습니다' });
      throw error;
    }
    res.json({ dealer: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /dealers/:id (admin) — 활성 토글, 정보 수정
router.patch('/dealers/:id(\\d+)', authenticateJWT, async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me || me.role !== 'admin') return res.status(403).json({ error: 'admin 전용' });
    const update = { updated_at: new Date().toISOString() };
    const { name, url, active, notes, display_order } = req.body || {};
    if (name !== undefined) update.name = String(name).trim().slice(0, 100);
    if (url !== undefined) {
      if (url && !_safeDealerUrl(url)) return res.status(400).json({ error: 'URL은 http/https/mailto만 허용' });
      update.url = _safeDealerUrl(url);
    }
    if (active !== undefined) update.active = !!active;
    if (notes !== undefined) update.notes = notes ? String(notes).slice(0, 500) : null;
    if (display_order !== undefined) update.display_order = parseInt(display_order) || 0;
    const { data, error } = await supabase.from('incentive_dealers').update(update).eq('id', req.params.id).select().single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: '대리점 없음' });
    res.json({ dealer: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /dealers/:id (admin)
router.delete('/dealers/:id(\\d+)', authenticateJWT, async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me || me.role !== 'admin') return res.status(403).json({ error: 'admin 전용' });
    const { error } = await supabase.from('incentive_dealers').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════
// 사은품(상품권) 마스터 — 통신사별 종류 관리 (admin)
// 계약 처리 화면에서 carrier별 dropdown으로 표시
// ═══════════════════════════════════════════════════════════════
const ALLOWED_VOUCHER_CARRIERS = ['KT', 'SKT', 'LGU+', 'ALL'];
const ALLOWED_VOUCHER_TYPES = ['mobile', 'cash'];

router.get('/gift-vouchers', authenticateJWT, async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(401).json({ error: 'unauthenticated' });
    let q = supabase.from('incentive_gift_vouchers').select('*').order('carrier').order('display_order').order('name');
    if (req.query.carrier) q = q.in('carrier', [req.query.carrier, 'ALL']);
    if (req.query.active_only === 'true') q = q.eq('active', true);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ vouchers: data || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/gift-vouchers', authenticateJWT, async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me || me.role !== 'admin') return res.status(403).json({ error: 'admin 전용' });
    const { carrier, name, voucher_type = 'mobile', display_order, notes } = req.body || {};
    if (!carrier || !name) return res.status(400).json({ error: 'carrier·name 필수' });
    if (!ALLOWED_VOUCHER_CARRIERS.includes(carrier)) return res.status(400).json({ error: 'carrier는 KT/SKT/LGU+/ALL' });
    if (!ALLOWED_VOUCHER_TYPES.includes(voucher_type)) return res.status(400).json({ error: 'voucher_type은 mobile/cash' });
    const { data, error } = await supabase.from('incentive_gift_vouchers').insert({
      carrier,
      name: String(name).trim().slice(0, 100),
      voucher_type,
      display_order: parseInt(display_order) || 100,
      notes: notes ? String(notes).slice(0, 500) : null,
      active: true,
    }).select().single();
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: '동일 통신사에 같은 이름의 상품권이 이미 있습니다' });
      throw error;
    }
    res.json({ voucher: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/gift-vouchers/:id(\\d+)', authenticateJWT, async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me || me.role !== 'admin') return res.status(403).json({ error: 'admin 전용' });
    const update = { updated_at: new Date().toISOString() };
    const { name, voucher_type, active, notes, display_order } = req.body || {};
    if (name !== undefined) update.name = String(name).trim().slice(0, 100);
    if (voucher_type !== undefined) {
      if (!ALLOWED_VOUCHER_TYPES.includes(voucher_type)) return res.status(400).json({ error: 'voucher_type은 mobile/cash' });
      update.voucher_type = voucher_type;
    }
    if (active !== undefined) update.active = !!active;
    if (notes !== undefined) update.notes = notes ? String(notes).slice(0, 500) : null;
    if (display_order !== undefined) update.display_order = parseInt(display_order) || 100;
    const { data, error } = await supabase.from('incentive_gift_vouchers').update(update).eq('id', req.params.id).select().single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: '상품권 없음' });
    res.json({ voucher: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/gift-vouchers/:id(\\d+)', authenticateJWT, async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me || me.role !== 'admin') return res.status(403).json({ error: 'admin 전용' });
    const { error } = await supabase.from('incentive_gift_vouchers').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════
// 📋 메뉴 SSOT (incentive_menus) — 사이드바·권한·DEFAULTS 1곳 통합
// ════════════════════════════════════════════════════════════

// GET /api/incentive/menus — 활성 메뉴 list (모든 인증 사용자)
router.get('/menus', authenticateJWT, async (req, res) => {
  try {
    const { include_inactive } = req.query;
    let q = supabase.from('incentive_menus')
      .select('slug,label,icon,iframe_src,category,display_order,default_roles,active')
      .order('display_order', { ascending: true });
    if (include_inactive !== 'true' && include_inactive !== '1') q = q.eq('active', true);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ menus: data || [], total: (data || []).length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/incentive/menus/:slug — admin 수정
router.patch('/menus/:slug', authenticateJWT, async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me || me.role !== 'admin') return res.status(403).json({ error: 'admin 전용' });
    const { label, icon, iframe_src, category, display_order, default_roles, active } = req.body || {};
    const update = { updated_at: new Date().toISOString() };
    if (label !== undefined) update.label = String(label).slice(0, 100);
    if (icon !== undefined) update.icon = String(icon).slice(0, 10);
    if (iframe_src !== undefined) update.iframe_src = String(iframe_src).slice(0, 500);
    if (category !== undefined) update.category = String(category).slice(0, 50);
    if (display_order !== undefined) update.display_order = parseInt(display_order) || 100;
    if (Array.isArray(default_roles)) update.default_roles = default_roles;
    if (active !== undefined) update.active = !!active;
    const { data, error } = await supabase.from('incentive_menus')
      .update(update).eq('slug', req.params.slug).select().single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: '메뉴 없음' });
    res.json({ menu: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/incentive/menus — admin 신규 등록
router.post('/menus', authenticateJWT, async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me || me.role !== 'admin') return res.status(403).json({ error: 'admin 전용' });
    const { slug, label, icon, iframe_src, category, display_order, default_roles } = req.body || {};
    if (!slug || !label) return res.status(400).json({ error: 'slug, label 필수' });
    if (!/^[a-z][a-z0-9-]+$/.test(slug)) return res.status(400).json({ error: 'slug는 소문자/숫자/하이픈만' });
    const row = {
      slug, label,
      icon: icon || null,
      iframe_src: iframe_src || null,
      category: category || null,
      display_order: parseInt(display_order) || 100,
      default_roles: Array.isArray(default_roles) ? default_roles : [],
    };
    const { data, error } = await supabase.from('incentive_menus').insert(row).select().single();
    if (error) throw error;
    res.json({ ok: true, menu: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════
// 🏢 부서 관리 (incentive_departments) — 카테고리별 계약 처리
// ════════════════════════════════════════════════════════════
router.get('/departments', authenticateJWT, async (req, res) => {
  try {
    const { include_inactive } = req.query;
    let q = supabase.from('incentive_departments')
      .select('id,name,categories,description,active,display_order,manager_user_id')
      .order('display_order', { ascending: true });
    if (include_inactive !== 'true') q = q.eq('active', true);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ departments: data || [], total: (data || []).length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/departments', authenticateJWT, async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me || me.role !== 'admin') return res.status(403).json({ error: 'admin 전용' });
    const { name, categories, description, display_order } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name 필수' });
    const row = {
      name: String(name).slice(0, 50),
      categories: Array.isArray(categories) ? categories : [],
      description: description ? String(description).slice(0, 200) : null,
      display_order: parseInt(display_order) || 100,
    };
    const { data, error } = await supabase.from('incentive_departments').insert(row).select().single();
    if (error) throw error;
    res.json({ ok: true, department: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/departments/:id(\\d+)', authenticateJWT, async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me || me.role !== 'admin') return res.status(403).json({ error: 'admin 전용' });
    const { name, categories, description, active, display_order } = req.body || {};
    const update = { updated_at: new Date().toISOString() };
    if (name !== undefined) update.name = String(name).slice(0, 50);
    if (Array.isArray(categories)) update.categories = categories;
    if (description !== undefined) update.description = description ? String(description).slice(0, 200) : null;
    if (active !== undefined) update.active = !!active;
    if (display_order !== undefined) update.display_order = parseInt(display_order) || 100;
    const { data, error } = await supabase.from('incentive_departments').update(update).eq('id', req.params.id).select().single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: '부서 없음' });
    res.json({ department: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 본인 처리 가능 카테고리 (role + department + handle_categories 합산)
router.get('/agents/me/categories', authenticateJWT, async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(401).json({ error: 'unauthenticated' });
    // admin/manager는 모든 카테고리
    if (['admin', 'manager'].includes(me.role)) {
      return res.json({ categories: ['internet_tv','usim'], role: me.role, unrestricted: true });
    }
    // contract/agent는 본인 부서 + handle_categories 합산
    let deptCats = [];
    if (me.department_id) {
      const { data: dept } = await supabase.from('incentive_departments').select('categories').eq('id', me.department_id).single();
      deptCats = Array.isArray(dept?.categories) ? dept.categories : [];
    }
    const personal = Array.isArray(me.handle_categories) ? me.handle_categories : [];
    const all = [...new Set([...deptCats, ...personal])];
    res.json({ categories: all, role: me.role, department_id: me.department_id, unrestricted: false });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 부서별 계약 통계 (Phase C)
router.get('/departments/stats', authenticateJWT, async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me || !['admin','manager'].includes(me.role)) return res.status(403).json({ error: 'admin/manager 전용' });
    const { ym } = req.query;
    const month = ym || new Date().toISOString().slice(0, 7);
    const { data: depts } = await supabase.from('incentive_departments').select('id,name,categories');

    // 1) 직접 집계 — incentive_sales (이번 달 contract_date)
    const start = month + '-01';
    const end = month + '-31';
    const [salesRes, settleRes] = await Promise.all([
      supabase.from('incentive_sales')
        .select('id,monthly_fee,payback_snapshot,status,agent:incentive_agents(department_id)')
        .gte('contract_date', start).lte('contract_date', end)
        .is('deleted_at', null),
      supabase.from('incentive_monthly_settlements')
        .select('agent_id,total_count,incentive,bonus,company_profit,agent:incentive_agents(department_id)')
        .eq('year_month', month),
    ]);

    const byDept = {};
    const ensure = (did) => {
      if (!byDept[did]) byDept[did] = {
        internet_count: 0, total_count: 0,
        total_monthly_fee: 0, total_payback: 0,
        completed_count: 0, cancelled_count: 0,
        // settlements 기반 확장
        total_residual_margin: 0, incentive: 0, bonus: 0, company_profit: 0,
        // 호환 (legacy UI)
        count: 0, monthly_fee: 0, payback: 0,
      };
      return byDept[did];
    };
    (salesRes.data || []).forEach(s => {
      const b = ensure(s.agent?.department_id || 'unassigned');
      b.internet_count++; b.total_count++; b.count++;
      b.total_monthly_fee += s.monthly_fee || 0;
      b.monthly_fee += s.monthly_fee || 0;
      b.total_payback += s.payback_snapshot || 0;
      b.payback += s.payback_snapshot || 0;
      if (s.status === 'completed') b.completed_count++;
      if (s.status === 'cancelled') b.cancelled_count++;
    });
    // settlements 기반 (finalize된 경우만 — 부서별 합산)
    (settleRes.data || []).forEach(s => {
      const b = ensure(s.agent?.department_id || 'unassigned');
      b.total_residual_margin += Number(s.total_residual_margin || 0);
      b.incentive += (s.incentive || 0);
      b.bonus += (s.bonus || 0);
      b.company_profit += (s.company_profit || 0);

    });

    const result = (depts || []).map(d => ({ ...d, stats: byDept[d.id] || ensure(d.id) }));
    // 미배정 부서 (agent.department_id NULL)
    if (byDept['unassigned']) {
      result.push({ id: 'unassigned', name: '— 미배정', categories: [], stats: byDept['unassigned'] });
    }
    res.json({ month, departments: result });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════
// 🎫 티켓 관리 — 고객→상담사 핫라인 식별 코드
// ════════════════════════════════════════════════════════════
// 인터넷+TV 티켓 (incentive_internet_tickets — 105개)

// ─── 인터넷+TV 티켓 (incentive_internet_tickets — 105개) ───

// GET /api/incentive/tickets/internet — DB list
router.get('/tickets/internet', authenticateJWT, async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(403).json({ error: '권한 없음' });
    const { carrier, search, active_only } = req.query;
    let q = supabase.from('incentive_internet_tickets')
      .select('id,ticket_number,carrier,speed,tv_idx,tv_label,has_wifi,monthly_fee,gift_amount,is_active,snapshot_at,deactivated_at');
    if (carrier) q = q.eq('carrier', String(carrier).toLowerCase());
    if (active_only === 'true' || active_only === '1') q = q.eq('is_active', true);
    if (search) {
      const s = String(search).trim().slice(0, 50);
      q = q.or(`ticket_number.ilike.%${s}%,tv_label.ilike.%${s}%,speed.ilike.%${s}%`);
    }
    q = q.order('ticket_number', { ascending: true }).limit(500);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ tickets: data || [], total: (data || []).length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/incentive/tickets/internet/lookup?ticket=SK0015 — TM 상담사 빠른 조회
router.get('/tickets/internet/lookup', authenticateJWT, async (req, res) => {
  try {
    const { ticket } = req.query;
    if (!ticket) return res.status(400).json({ error: 'ticket 쿼리 필수' });
    const tn = String(ticket).trim().toUpperCase();
    if (!/^(SK|KT|LG)\d{4,}$/.test(tn)) return res.status(400).json({ error: 'SK0001/KT0001/LG0001 형식이어야 함' });

    const { data, error } = await supabase.from('incentive_internet_tickets')
      .select('id,ticket_number,carrier,speed,tv_idx,tv_label,has_wifi,monthly_fee,gift_amount,is_active')
      .eq('ticket_number', tn)
      .single();
    if (error || !data) return res.status(404).json({ error: '티켓 없음', ticket_number: tn });
    res.json({ ticket: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/incentive/tickets/internet/sync — calculator.html 시드 ↔ DB 양방향 sync
// 정책: 티켓 자체는 박제 X. 시드 변경 시 가격·사은품·tv_label 모두 update.
//        (영업·계약은 incentive_sales의 quote_summary HTML에 별도 박제됨)
// body: { tickets: [{ticket_number, carrier, speed, tv_idx, tv_label, has_wifi, monthly_fee, gift_amount}, ...] }
router.post('/tickets/internet/sync', authenticateJWT, async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me || !['admin', 'manager'].includes(me.role)) return res.status(403).json({ error: 'admin/manager 전용' });
    const incoming = Array.isArray(req.body?.tickets) ? req.body.tickets : null;
    if (!incoming) return res.status(400).json({ error: 'tickets 배열 필수' });

    // 기존 DB row 모두 fetch
    const { data: existing } = await supabase.from('incentive_internet_tickets')
      .select('id,ticket_number,carrier,speed,tv_idx,tv_label,has_wifi,monthly_fee,gift_amount,is_active');
    const existingMap = new Map((existing || []).map(t => [t.ticket_number, t]));
    const incomingSet = new Set(incoming.map(t => t.ticket_number));

    const newRows = [];
    const updates = [];   // [{id, patch}]
    let unchanged = 0;
    for (const t of incoming) {
      const ex = existingMap.get(t.ticket_number);
      if (!ex) {
        newRows.push({
          ticket_number: t.ticket_number,
          carrier: t.carrier,
          speed: t.speed,
          tv_idx: t.tv_idx | 0,
          tv_label: t.tv_label || null,
          has_wifi: !!t.has_wifi,
          monthly_fee: t.monthly_fee | 0,
          gift_amount: t.gift_amount | 0,
        });
      } else {
        const patch = {};
        if (ex.tv_label !== (t.tv_label || null)) patch.tv_label = t.tv_label || null;
        if (ex.monthly_fee !== (t.monthly_fee | 0)) patch.monthly_fee = t.monthly_fee | 0;
        if (ex.gift_amount !== (t.gift_amount | 0)) patch.gift_amount = t.gift_amount | 0;
        if (!ex.is_active) { patch.is_active = true; patch.deactivated_at = null; }
        if (Object.keys(patch).length > 0) {
          patch.updated_at = new Date().toISOString();
          updates.push({ id: ex.id, patch });
        } else {
          unchanged++;
        }
      }
    }

    // 시드에서 사라진 → 비활성
    const toDeactivate = Array.from(existingMap.values())
      .filter(ex => ex.is_active && !incomingSet.has(ex.ticket_number))
      .map(ex => ex.id);

    let inserted = 0, updated = 0, deactivated = 0;
    if (newRows.length > 0) {
      const { error } = await supabase.from('incentive_internet_tickets').insert(newRows);
      if (error) throw error;
      inserted = newRows.length;
    }
    // 변경 row UPDATE (개별 update — 컬럼별 patch가 다 다르므로)
    for (const u of updates) {
      const { error } = await supabase.from('incentive_internet_tickets')
        .update(u.patch).eq('id', u.id);
      if (error) throw error;
      updated++;
    }
    if (toDeactivate.length > 0) {
      const { error } = await supabase.from('incentive_internet_tickets')
        .update({ is_active: false, deactivated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .in('id', toDeactivate);
      if (error) throw error;
      deactivated = toDeactivate.length;
    }

    res.json({ ok: true, inserted, updated, unchanged, deactivated, total_incoming: incoming.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/incentive/tickets/internet/:id/deactivate
router.patch('/tickets/internet/:id(\\d+)/deactivate', authenticateJWT, async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me || !['admin', 'manager'].includes(me.role)) return res.status(403).json({ error: 'admin/manager 전용' });
    const { data, error } = await supabase.from('incentive_internet_tickets')
      .update({ is_active: false, deactivated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('id,ticket_number,is_active')
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: '티켓 없음' });
    res.json({ ok: true, ticket: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/incentive/tickets/internet/:id/activate
router.patch('/tickets/internet/:id(\\d+)/activate', authenticateJWT, async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me || !['admin', 'manager'].includes(me.role)) return res.status(403).json({ error: 'admin/manager 전용' });
    const { data, error } = await supabase.from('incentive_internet_tickets')
      .update({ is_active: true, deactivated_at: null, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('id,ticket_number,is_active')
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: '티켓 없음' });
    res.json({ ok: true, ticket: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════
// 👥 통합 고객관리 — vw_unified_customer 기반
// 본질: N채널 lead → 전화번호 통합 → TM 콜 close → 마이페이지 sync
// PRD: docs/specs/customer-mgmt.md
// ═══════════════════════════════════════════════════════════════

// GET /api/incentive/customers/unified
// 통합 리드 list (필터·검색·페이지네이션)
router.get('/customers/unified', authenticateJWT, async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(403).json({ error: '권한 없음' });
    // 🔒 contract는 콜DB 조회 불필요 (계약 처리 페이지에서 sales만 봄)
    if (me.role === 'contract') return res.status(403).json({ error: 'contract는 콜DB 조회 권한 없음 — 계약 처리 페이지 사용' });
    const { status, _channel, grade, search, agent_id, limit = 50, offset = 0 } = req.query;
    let q = supabase.from('vw_unified_customer').select('*', { count: 'exact' });
    if (status) q = q.eq('call_status', status);
    if (grade)  q = q.eq('priority_score', grade);
    if (agent_id) q = q.eq('assigned_agent_id', agent_id);
    if (search) {
      const s = String(search).trim();
      // 메모(calldb.notes)·태그 full-text 매칭 포함
      q = q.or(`calldb_name.ilike.%${s}%,phone.ilike.%${s}%,member_name.ilike.%${s}%,notes.ilike.%${s}%`);
    }
    // 권한 격리
    //  - admin: 전체
    //  - manager: 본인 센터 소속 agent의 분배 콜만
    //  - agent: 본인 분배만
    if (me.role === 'agent') {
      q = q.eq('assigned_agent_id', me.id);
    } else if (me.role === 'manager') {
      // 본인 센터 agent id list 추출 (admin은 모든 센터)
      const { data: centerAgents } = await supabase
        .from('incentive_agents').select('id')
        .eq('center', me.center).eq('active', true).is('deleted_at', null);
      const ids = (centerAgents || []).map(a => a.id);
      if (ids.length === 0) return res.json({ customers: [], total: 0 });
      q = q.in('assigned_agent_id', ids);
    }
    // 정렬: rotting 우선 + 신규 priority
    q = q.order('lead_age_days', { ascending: false })
         .order('imported_at', { ascending: false })
         .range(Number(offset), Number(offset) + Number(limit) - 1);
    const { data, error, count } = await q;
    if (error) throw error;
    res.json({ customers: data || [], total: count || 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/incentive/customers/:phone/360
// 단일 고객 전체 360° 데이터 (회원·인입 history·통화·4상품·금융·NBA)
router.get('/customers/:phone/360', authenticateJWT, async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(403).json({ error: '권한 없음' });
    const { phone } = req.params;
    if (!phone) return res.status(400).json({ error: 'phone 필수' });

    // 통합 view에서 기본 row
    const { data: customer, error: cErr } = await supabase
      .from('vw_unified_customer').select('*').eq('phone', phone).maybeSingle();
    if (cErr) throw cErr;

    // 권한 체크 (agent는 본인 분배만)
    if (me.role === 'agent' && customer?.assigned_agent_id !== me.id) {
      return res.status(403).json({ error: '본인 분배 고객만 조회 가능' });
    }

    // 병렬 fetch: 통화·인터넷영업·가전영업·중고폰·셀프신청·페이백·포인트·친구초대·알람·메모
    const [calls, itSales, usedPhones, applications, gifts, rewards, alarms, notes] = await Promise.all([
      supabase.from('incentive_customer_call_log')
        .select('*, agent:incentive_agents(name)')
        .eq('customer_id', customer?.calldb_id)
        .order('called_at', { ascending: false }),
      supabase.from('incentive_sales')
        .select('*, product:incentive_products(name, carrier, type), agent:incentive_agents(name)')
        .eq('customer_phone', phone).order('created_at', { ascending: false }),
      supabase.from('bongi_applications').select('*').eq('phone', phone),
      supabase.from('bongi_gifts').select('*').eq('phone', phone).order('created_at', { ascending: false }),
      customer?.user_id ? supabase.from('bongi_rewards').select('*').eq('user_id', customer.user_id) : { data: [] },
      customer?.user_id ? supabase.from('bongi_user_alarms').select('*').eq('user_id', customer.user_id) : { data: [] },
      customer?.calldb_id
        ? supabase.from('incentive_customer_notes').select('*').eq('customer_id', customer.calldb_id)
            .order('is_pinned', { ascending: false }).order('created_at', { ascending: false })
        : { data: [] },
    ]);

    // 인입 history (시간순 통합)
    const history = [];
    if (customer?.imported_at) history.push({ at: customer.imported_at, channel: 'calldb', icon: '📞', desc: `콜DB 분배 (등급 ${customer.priority_score || '-'} · ${customer.member_channel || '본사'})` });
    (applications.data || []).forEach(a => history.push({ at: a.created_at, channel: 'web', icon: '🌐', desc: `셀프신청 (${a.product_type || '신청'})` }));
    (usedPhones.data || []).forEach(u => history.push({ at: u.created_at, channel: 'usedphone', icon: '🔄', desc: `중고폰 매입 접수` }));
    history.sort((a, b) => new Date(b.at) - new Date(a.at));

    // NBA rule-based
    const nba = [];
    if (customer?.gifts_pending > 0) nba.push({ type:'gift', icon:'💰', msg:`현금페이백 ${customer.gifts_pending}건 미수령 — 고객에게 안내 권장` });
    if (customer?.it_sales_completed > 0)
      nba.push({ type:'cross-sell', icon:'🏠', msg:'인터넷 계약자 — 가전렌탈 cross-sell 기회' });
    if (customer?.lead_age_days > 14 && customer?.call_status !== 'completed' && customer?.call_status !== 'rejected')
      nba.push({ type:'rotting', icon:'⚠️', msg:`rotting ${customer.lead_age_days}일 — 마지막 시도 권유` });
    if (customer?.it_sales_completed > 0)
      nba.push({ type:'renew', icon:'🔄', msg:'재계약 권유 — 약정 만료 60일 전 자동 알람 등록 권장' });

    res.json({
      customer,
      history,
      calls: calls.data || [],
      it_sales: itSales.data || [],
      used_phones: usedPhones.data || [],
      applications: applications.data || [],
      gifts: gifts.data || [],
      rewards: rewards.data || [],
      alarms: alarms.data || [],
      notes: notes.data || [],
      nba,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/incentive/customers/:phone/call-attempt
// 통화 시도 기록 (incentive_customer_call_log insert + customer_db 갱신)
router.post('/customers/:phone/call-attempt', authenticateJWT, async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(403).json({ error: '권한 없음' });
    const { phone } = req.params;
    const { result, summary, next_call_at, reject_reason } = req.body || {};
    if (!result || !summary) return res.status(400).json({ error: 'result + summary 필수 (녹음 없음 — 텍스트가 유일 증거)' });

    // calldb row 찾기
    const { data: cdb } = await supabase.from('incentive_customer_db')
      .select('id, assigned_agent_id, call_count').eq('phone', phone).maybeSingle();
    if (!cdb) return res.status(404).json({ error: 'calldb 매칭 없음' });
    if (me.role === 'agent' && cdb.assigned_agent_id !== me.id) {
      return res.status(403).json({ error: '본인 분배만 콜 기록 가능' });
    }

    // call_log insert
    const { data: log, error: logErr } = await supabase.from('incentive_customer_call_log')
      .insert({
        customer_id: cdb.id,
        agent_id: me.id,
        called_at: new Date().toISOString(),
        result,
        notes: summary,
        callback_at: next_call_at || null,
        reject_reason: reject_reason || null,
      }).select().single();
    if (logErr) throw logErr;

    // customer_db 갱신 (call_count·last_contacted_at·callback_at·call_status)
    const statusMap = { success:'in_progress', reject:'rejected', absent:'pending', callback:'pending' };
    await supabase.from('incentive_customer_db').update({
      call_count: (cdb.call_count || 0) + 1,
      last_contacted_at: new Date().toISOString(),
      callback_at: next_call_at || null,
      reject_reason: reject_reason || null,
      call_status: statusMap[result] || 'pending',
    }).eq('id', cdb.id);

    res.json({ ok: true, log });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Phase 2 ─── 고급 검색 (notes·통화 요약 full-text) ───
// 이미 /customers/unified가 search param 받음 — 거기 search OR 절 확장
// (코드 위 unified handler 안에 메모 매칭 추가)

// GET /api/incentive/customers/export/csv
// PIPA 마스킹 CSV export (admin·manager만)
router.get('/customers/export/csv', authenticateJWT, async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(403).json({ error: '권한 없음' });
    if (!['admin', 'manager'].includes(me.role)) return res.status(403).json({ error: 'admin/manager만 export 가능' });
    const { status, grade, search } = req.query;
    let q = supabase.from('vw_unified_customer').select('*').limit(5000);
    if (status) q = q.eq('call_status', status);
    if (grade)  q = q.eq('priority_score', grade);
    if (search) q = q.or(`calldb_name.ilike.%${search}%,phone.ilike.%${search}%,member_name.ilike.%${search}%,notes.ilike.%${search}%`);
    const { data, error } = await q;
    if (error) throw error;
    // PIPA 마스킹
    const maskName = n => !n ? '' : (n.length <= 1 ? n : n.charAt(0) + '*'.repeat(Math.max(1, n.length-1)));
    const maskPhone = p => { if (!p) return ''; const s = String(p).replace(/-/g, ''); return s.length<7?p:s.slice(0,3)+'-****-'+s.slice(-4); };
    const maskRegion = r => !r ? '' : (r.split(' ').slice(0,2).join(' ') + ' ***');
    const headers = ['phone','name','age','gender','region','carrier','status','grade','channel_member','계약IT','계약가전','중고폰','페이백대기','페이백누적','콜시도','rotting_days','tags'];
    const rows = (data || []).map(c => [
      maskPhone(c.phone),
      maskName(c.member_name || c.calldb_name),
      c.age || '',
      c.gender || '',
      maskRegion(c.region),
      c.carrier || '',
      c.call_status || '',
      c.priority_score ?? '',
      c.is_app_member ? '회원' : '비회원',
      c.it_sales_completed || 0,
      c.usedphone_count || 0,
      c.gifts_pending || 0,
      c.gifts_total_amount || 0,
      c.call_attempts || 0,
      c.lead_age_days || 0,
      (c.tags || []).join(';'),
    ]);
    const csv = [
      '﻿' + headers.join(','),  // BOM (Excel 한글)
      ...rows.map(r => r.map(v => {
        const s = String(v ?? '');
        return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
      }).join(','))
    ].join('\n');
    // audit log (PIPA 의무)
    await supabase.from('incentive_customer_db_access_log').insert({
      user_id: me.id, action: 'export_csv',
      metadata: { count: rows.length, filters: { status, grade, search } },
    }).then(() => {}, () => {});
    const fname = `customers_${new Date().toISOString().slice(0,10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    res.send(csv);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/incentive/customers/bulk/reassign
// 다중 재분배 (admin·manager)
router.patch('/customers/bulk/reassign', authenticateJWT, async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(403).json({ error: '권한 없음' });
    if (!['admin', 'manager'].includes(me.role)) return res.status(403).json({ error: 'admin/manager만' });
    const { phones, new_agent_id, reason } = req.body || {};
    if (!Array.isArray(phones) || !phones.length) return res.status(400).json({ error: 'phones 필수' });
    if (!new_agent_id) return res.status(400).json({ error: 'new_agent_id 필수' });
    const { data, error } = await supabase.from('incentive_customer_db')
      .update({
        assigned_agent_id: new_agent_id,
        assigned_at: new Date().toISOString(),
        assigned_by_user_id: me.id,
      }).in('phone', phones).select('id, phone');
    if (error) throw error;
    await supabase.from('incentive_customer_db_access_log').insert({
      user_id: me.id, action: 'bulk_reassign',
      metadata: { count: (data||[]).length, new_agent_id, reason: reason || null, phones: phones.slice(0, 100) },
    }).then(() => {}, () => {});
    res.json({ ok: true, count: (data||[]).length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/incentive/customers/bulk/status
// 다중 status 변경 (admin·manager)
router.patch('/customers/bulk/status', authenticateJWT, async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(403).json({ error: '권한 없음' });
    if (!['admin', 'manager'].includes(me.role)) return res.status(403).json({ error: 'admin/manager만' });
    const { phones, status, reason } = req.body || {};
    const VALID = ['pending', 'in_progress', 'callback', 'no_answer', 'on_hold', 'wrong_number', 'converted', 'rejected', 'dormant'];
    if (!Array.isArray(phones) || !phones.length) return res.status(400).json({ error: 'phones 필수' });
    if (!VALID.includes(status)) return res.status(400).json({ error: 'status invalid' });
    const update = { call_status: status };
    if (status === 'rejected' || status === 'dormant') update.reject_reason = reason || null;
    const { data, error } = await supabase.from('incentive_customer_db')
      .update(update).in('phone', phones).select('id');
    if (error) throw error;
    await supabase.from('incentive_customer_db_access_log').insert({
      user_id: me.id, action: 'bulk_status',
      metadata: { count: (data||[]).length, status, reason: reason || null, phones: phones.slice(0, 100) },
    }).then(() => {}, () => {});
    res.json({ ok: true, count: (data||[]).length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/incentive/customers/:phone
// 기본 정보 편집 (name·age·gender·region·carrier·notes·tags·is_dnt)
router.patch('/customers/:phone', authenticateJWT, async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(403).json({ error: '권한 없음' });
    const { phone } = req.params;
    const allowed = ['name', 'age', 'gender', 'region', 'carrier', 'notes', 'tags', 'is_dnt', 'priority_score'];
    const update = {};
    for (const k of allowed) if (k in (req.body || {})) update[k] = req.body[k];
    if (Object.keys(update).length === 0) return res.status(400).json({ error: '변경 항목 없음' });
    // agent 권한 — 본인 분배 또는 admin/manager/contract
    const { data: cdb } = await supabase.from('incentive_customer_db')
      .select('id, assigned_agent_id').eq('phone', phone).maybeSingle();
    if (!cdb) return res.status(404).json({ error: '고객 없음' });
    if (me.role === 'agent' && cdb.assigned_agent_id !== me.id) {
      return res.status(403).json({ error: '본인 분배 고객만 편집 가능' });
    }
    const { data, error } = await supabase.from('incentive_customer_db')
      .update(update).eq('id', cdb.id).select().single();
    if (error) throw error;
    res.json({ customer: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/incentive/customers/:phone/reassign
// 다른 상담사에게 이관 (manager/admin)
router.patch('/customers/:phone/reassign', authenticateJWT, async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(403).json({ error: '권한 없음' });
    if (!['admin', 'manager'].includes(me.role)) return res.status(403).json({ error: 'admin/manager만 재분배 가능' });
    const { phone } = req.params;
    const { new_agent_id, reason } = req.body || {};
    if (!new_agent_id) return res.status(400).json({ error: 'new_agent_id 필수' });
    const { data, error } = await supabase.from('incentive_customer_db')
      .update({
        assigned_agent_id: new_agent_id,
        assigned_at: new Date().toISOString(),
        assigned_by_user_id: me.id,
      }).eq('phone', phone).select().single();
    if (error) throw error;
    // audit log
    await supabase.from('incentive_customer_db_access_log').insert({
      customer_id: data.id, user_id: me.id, action: 'reassign',
      metadata: { new_agent_id, reason: reason || null, prev_agent_id: data.assigned_agent_id },
    }).then(() => {}, () => {});
    res.json({ customer: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/incentive/customers/:phone/status
// 휴면(dormant) · 거절(rejected) 등 status 변경
router.patch('/customers/:phone/status', authenticateJWT, async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(403).json({ error: '권한 없음' });
    const { phone } = req.params;
    const { status, reason } = req.body || {};
    const VALID = ['pending', 'in_progress', 'callback', 'no_answer', 'on_hold', 'wrong_number', 'converted', 'rejected', 'dormant'];
    if (!VALID.includes(status)) return res.status(400).json({ error: 'status invalid' });
    const update = { call_status: status };
    if (status === 'rejected' || status === 'dormant') update.reject_reason = reason || null;
    const { data: cdb } = await supabase.from('incentive_customer_db')
      .select('id, assigned_agent_id').eq('phone', phone).maybeSingle();
    if (!cdb) return res.status(404).json({ error: '고객 없음' });
    if (me.role === 'agent' && cdb.assigned_agent_id !== me.id) {
      return res.status(403).json({ error: '본인 분배만 status 변경 가능' });
    }
    const { data, error } = await supabase.from('incentive_customer_db')
      .update(update).eq('id', cdb.id).select().single();
    if (error) throw error;
    res.json({ customer: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/incentive/customers/agents-for-reassign
// 재분배 모달용 active agent list (admin/manager만)
router.get('/customers/agents-for-reassign', authenticateJWT, async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(403).json({ error: '권한 없음' });
    if (!['admin', 'manager'].includes(me.role)) return res.status(403).json({ error: 'admin/manager만' });
    const { data, error } = await supabase.from('incentive_agents')
      .select('id, name, role, center, active').eq('active', true)
      .in('role', ['agent', 'manager']).order('center').order('name');
    if (error) throw error;
    res.json({ agents: data || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/incentive/customers/manual-register
// 수동 고객 등록 (incentive_customer_db insert · 중복 체크 · 본인 분배 옵션)
router.post('/customers/manual-register', authenticateJWT, async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(403).json({ error: '권한 없음' });
    const { name, phone, age, gender, region, carrier, notes, db_source_id, assign_to_me } = req.body || {};
    if (!name || !phone) return res.status(400).json({ error: '이름·전화 필수' });
    const phoneClean = String(phone).trim();
    if (!/^[0-9-]{8,15}$/.test(phoneClean)) return res.status(400).json({ error: '전화번호 형식 오류' });

    // 중복 체크
    const { data: existing } = await supabase.from('incentive_customer_db')
      .select('id, name, assigned_agent_id, call_status')
      .eq('phone', phoneClean).maybeSingle();
    if (existing) {
      return res.status(409).json({
        error: '이미 등록된 전화번호',
        existing: { id: existing.id, name: existing.name, assigned_agent_id: existing.assigned_agent_id, call_status: existing.call_status },
      });
    }

    const row = {
      name: String(name).trim(),
      phone: phoneClean,
      age: age != null ? Number(age) : null,
      gender: gender || null,
      region: region || null,
      carrier: carrier || null,
      notes: notes || null,
      db_source_id: db_source_id || null,
      imported_at: new Date().toISOString(),
      imported_by_user_id: me.id,
      assigned_agent_id: assign_to_me ? me.id : null,
      assigned_at: assign_to_me ? new Date().toISOString() : null,
      assigned_by_user_id: assign_to_me ? me.id : null,
      call_status: 'pending',
      consent_status: 'manual',
    };
    const { data, error } = await supabase.from('incentive_customer_db')
      .insert(row).select().single();
    if (error) throw error;
    res.json({ ok: true, customer: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/incentive/customers/db-sources
// 수동 등록용 DB 출처 list
router.get('/customers/db-sources', authenticateJWT, async (req, res) => {
  try {
    const { data, error } = await supabase.from('incentive_db_sources')
      .select('id, name, color').eq('active', true).order('name');
    if (error) throw error;
    res.json({ sources: data || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/incentive/customers/:phone/notes
// 메모 list (시간순 · pinned 우선)
router.get('/customers/:phone/notes', authenticateJWT, async (req, res) => {
  try {
    const { phone } = req.params;
    const { data: cdb } = await supabase.from('incentive_customer_db')
      .select('id').eq('phone', phone).maybeSingle();
    if (!cdb) return res.json({ notes: [] });
    const { data, error } = await supabase.from('incentive_customer_notes')
      .select('*').eq('customer_id', cdb.id)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ notes: data || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/incentive/customers/:phone/notes
// 메모 추가
router.post('/customers/:phone/notes', authenticateJWT, async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(403).json({ error: '권한 없음' });
    const { phone } = req.params;
    const { content, category, is_pinned } = req.body || {};
    if (!content || !content.trim()) return res.status(400).json({ error: 'content 필수' });
    const { data: cdb } = await supabase.from('incentive_customer_db')
      .select('id').eq('phone', phone).maybeSingle();
    if (!cdb) return res.status(404).json({ error: 'calldb 매칭 없음 — 콜DB import 후 시도' });
    const { data, error } = await supabase.from('incentive_customer_notes')
      .insert({
        customer_id: cdb.id,
        author_id: me.id,
        author_name: me.name || null,
        content: content.trim(),
        category: category || '일반',
        is_pinned: !!is_pinned,
      }).select().single();
    if (error) throw error;
    res.json({ note: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/incentive/customers/notes/:id
// 메모 삭제 (작성자 본인 또는 admin)
router.delete('/customers/notes/:id', authenticateJWT, async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(403).json({ error: '권한 없음' });
    const { id } = req.params;
    const { data: note } = await supabase.from('incentive_customer_notes')
      .select('author_id').eq('id', id).maybeSingle();
    if (!note) return res.status(404).json({ error: '메모 없음' });
    if (me.role !== 'admin' && note.author_id !== me.id) {
      return res.status(403).json({ error: '작성자 또는 admin만 삭제 가능' });
    }
    const { error } = await supabase.from('incentive_customer_notes').delete().eq('id', id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/incentive/customers/notes/:id/pin
// 메모 pinned 토글
router.patch('/customers/notes/:id/pin', authenticateJWT, async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(403).json({ error: '권한 없음' });
    const { id } = req.params;
    const { is_pinned } = req.body || {};
    const { data, error } = await supabase.from('incentive_customer_notes')
      .update({ is_pinned: !!is_pinned, updated_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (error) throw error;
    res.json({ note: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/incentive/customers/:phone/nba
// 단일 고객 NBA (Next Best Action) rule-based 추천
router.get('/customers/:phone/nba', authenticateJWT, async (req, res) => {
  try {
    const { phone } = req.params;
    const { data: c } = await supabase.from('vw_unified_customer').select('*').eq('phone', phone).maybeSingle();
    if (!c) return res.status(404).json({ error: '고객 없음' });
    const nba = [];
    if (c.gifts_pending > 0) nba.push({ type:'gift', priority:1, icon:'💰', msg:`현금페이백 ${c.gifts_pending}건 미수령`, action:'안내 콜' });
    if (c.it_sales_completed > 0)
      nba.push({ type:'cross-sell-usim', priority:2, icon:'📲', msg:'인터넷 계약자 — 유심 이동 권장 (같은 통신사만 결합 인정)', action:'cross-sell 콜' });
    if (c.lead_age_days > 14 && c.call_status !== 'completed' && c.call_status !== 'rejected')
      nba.push({ type:'rotting', priority:3, icon:'⚠️', msg:`rotting ${c.lead_age_days}일`, action:'마지막 시도' });
    if (c.it_sales_completed > 0)
      nba.push({ type:'renew', priority:4, icon:'🔄', msg:'약정 만료 60일 전 재계약 권유', action:'알람 등록' });
    res.json({ phone, nba });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════
// 유심 이동 (SIM-only 개통) — incentive_usim_plans
//   유심 개통 = 단말 없이 유심만 해당 통신사로 옮기는 신규개통(번호이동).
//   기기 판매가 없으므로 할부원금·공시지원금 개념이 없고,
//   견적에 잡히는 것은 「요금제 + 선택약정 25% + 페이백」 뿐이다.
// ═══════════════════════════════════════════════════════════════
router.get('/usim-plans', optionalAuth, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const { carrier, all } = req.query;
    let q = supabase.from('incentive_usim_plans').select('*');
    if (all !== 'true') q = q.eq('is_active', true);
    if (carrier) q = q.eq('carrier', carrier);
    const { data, error } = await q.order('carrier').order('sort_order');
    if (error) throw error;
    res.json({ plans: data, count: data.length });
  } catch (err) {
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요' });
  }
});

const USIM_FIELDS = ['carrier','plan_name','monthly_fee','select_discount','payback','data_amount',
  'network','activation_type','commission','contract_months','device_policy',
  'bundle_eligible','bundle_lines','bundle_fee_basis','is_special','sort_order','is_active','memo'];

router.post('/usim-plans', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isAdmin(me)) return res.status(403).json({ error: 'admin 전용' });
    const row = {};
    USIM_FIELDS.forEach(k => { if (req.body[k] !== undefined) row[k] = req.body[k]; });
    if (!row.carrier || !row.plan_name || row.monthly_fee == null) {
      return res.status(400).json({ error: 'carrier · plan_name · monthly_fee 는 필수입니다' });
    }
    // 유심 개통은 번호이동만 가능하다 — 신규가입은 존재하지 않는 상품이다
    if (row.activation_type && row.activation_type !== 'MNP') {
      return res.status(400).json({ error: '유심은 번호이동(MNP)만 가능합니다 — 신규가입 불가' });
    }
    row.activation_type = 'MNP';
    const { data, error } = await supabase.from('incentive_usim_plans').insert(row).select().single();
    if (error) throw error;
    res.json({ plan: data });
  } catch (err) {
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요' });
  }
});

router.patch('/usim-plans/:id', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isAdmin(me)) return res.status(403).json({ error: 'admin 전용' });
    const update = {};
    USIM_FIELDS.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    if (update.activation_type && update.activation_type !== 'MNP') {
      return res.status(400).json({ error: '유심은 번호이동(MNP)만 가능합니다 — 신규가입 불가' });
    }
    if (!Object.keys(update).length) {
      return res.status(400).json({ error: '변경할 필드가 없습니다 (allowed: ' + USIM_FIELDS.join(', ') + ')' });
    }
    const { data, error } = await supabase
      .from('incentive_usim_plans').update(update).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ plan: data });
  } catch (err) {
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요' });
  }
});

router.delete('/usim-plans/:id', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isAdmin(me)) return res.status(403).json({ error: 'admin 전용' });
    // 실삭제 대신 비활성 (과거 견적·계약 추적성 보존)
    const { data, error } = await supabase
      .from('incentive_usim_plans').update({ is_active: false }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ plan: data, note: '비활성 처리됨 (행은 보존)' });
  } catch (err) {
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요' });
  }
});

// ═══════════════════════════════════════════════════════════════
// 유심 수수료 행렬 — incentive_usim_commissions
//   (인터넷+TV 상품) × (유심 요금제 구간) → 리베이트
//   구분 3종: UIT결합유심 / 가족추가유심·유심단독MNP(결합) / 유심단독MNP(미결합)
//   amount = null 은 「정책표 미수령」이다. 0원과 다르다.
// ═══════════════════════════════════════════════════════════════
router.get('/usim-commissions', optionalAuth, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const { carrier, category } = req.query;
    let q = supabase.from('incentive_usim_commissions').select('*').eq('is_active', true);
    if (carrier) q = q.eq('carrier', carrier);
    if (category) q = q.eq('category', category);
    const { data, error } = await q.order('carrier').order('category').order('product_key', { nullsFirst: true }).order('fee_tier_min');
    if (error) throw error;
    res.json({ rows: data, count: data.length });
  } catch (err) {
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요' });
  }
});

// 행렬 일괄 저장 — 정책표를 통째로 갈아끼우는 용도
router.put('/usim-commissions', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isAdmin(me)) return res.status(403).json({ error: 'admin 전용' });
    const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
    if (!rows.length) return res.status(400).json({ error: 'rows 가 비었습니다' });
    const bad = rows.find(r => !r.id);
    if (bad) return res.status(400).json({ error: '각 행에 id 가 필요합니다' });
    let n = 0;
    for (const r of rows) {
      const patch = {};
      // amount 는 null 을 허용한다 (미입력 상태를 지울 수 있어야 함)
      if ('amount' in r) patch.amount = (r.amount === '' || r.amount == null) ? null : r.amount;
      ['maintain_months','settle_rule','notes','is_active'].forEach(k => { if (r[k] !== undefined) patch[k] = r[k]; });
      if (!Object.keys(patch).length) continue;
      const { error } = await supabase.from('incentive_usim_commissions').update(patch).eq('id', r.id);
      if (error) throw error;
      n++;
    }
    res.json({ updated: n });
  } catch (err) {
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요' });
  }
});

// 부가서비스 가감 (추가TV·OSS·IOT·WIFI 미신청 등)
router.get('/usim-addons', optionalAuth, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    let q = supabase.from('incentive_addon_commissions').select('*').eq('is_active', true);
    if (req.query.carrier) q = q.eq('carrier', req.query.carrier);
    const { data, error } = await q.order('carrier').order('addon');
    if (error) throw error;
    res.json({ rows: data, count: data.length });
  } catch (err) {
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요' });
  }
});

// ═══════════════════════════════════════════════════════════════
// 상품별 접수 채널 — incentive_product_channels
//   같은 유선 상품이라도 어느 주체로 접수하느냐로 리베이트·가이드·MAX 가 갈린다.
//   SK 는 SKT / SKB 두 갈래이고, 유심 수수료도 이 채널을 따라간다.
// ═══════════════════════════════════════════════════════════════
router.get('/product-channels', optionalAuth, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    let q = supabase.from('incentive_product_channels').select('*').eq('is_active', true);
    if (req.query.product_id) q = q.eq('product_id', req.query.product_id);
    if (req.query.channel) q = q.eq('channel', req.query.channel);
    const { data, error } = await q.order('product_id').order('channel');
    if (error) throw error;
    res.json({ channels: data, count: data.length });
  } catch (err) {
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요' });
  }
});

const CH_FIELDS = ['channel','label','rebate','guide_cash','guide_voucher','guide_payout',
                   'max_payout','install_fee','is_default','is_active','memo'];

router.patch('/product-channels/:id', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isAdmin(me)) return res.status(403).json({ error: 'admin 전용' });
    const update = {};
    CH_FIELDS.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    if (!Object.keys(update).length) return res.status(400).json({ error: '변경할 필드가 없습니다' });
    // 가이드 = 현금 + 상품권 이 깨지지 않게 서버에서도 확인한다
    if (update.guide_cash != null && update.guide_voucher != null) {
      update.guide_payout = Number(update.guide_cash) + Number(update.guide_voucher);
    }
    const { data, error } = await supabase
      .from('incentive_product_channels').update(update).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ channel: data });
  } catch (err) {
    console.error('[incentive]', req.method, req.path, err);
    res.status(500).json({ error: '서버 오류 — 잠시 후 다시 시도하세요' });
  }
});

export default router;
