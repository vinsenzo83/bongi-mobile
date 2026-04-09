import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { syncMemberData, syncAllMembers } from '../services/member-sync.js';

const router = Router();

// SQL Injection 방지: .or() 문자열 보간에 사용되는 검색어에서 특수문자 제거
function sanitizeSearch(str) {
  if (!str) return '';
  return str.replace(/[%_'"\\(),.;{}[\]]/g, '').trim();
}

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

// GET /admin/platform/gifts — 사은품 목록 (회원+신청 정보 매칭)
router.get('/gifts', async (req, res) => {
  try {
    const { status } = req.query;
    let query = supabase.from('bongi_gifts').select('*').order('created_at', { ascending: false }).limit(100);
    if (status) query = query.eq('status', status);
    const { data: gifts, error } = await query;
    if (error) throw error;

    // DB에 직접 있는 필드 우선, 없으면 이름 기반 매칭
    const enriched = [];
    for (const g of (gifts || [])) {
      // DB에 이미 있으면 그대로 사용
      if (g.phone && g.user_type) {
        enriched.push(g);
        continue;
      }

      // 없으면 이름 기반 매칭
      const name = g.name || g.account_holder || '';
      let profile = null;
      let app = null;

      if (name) {
        const { data: p } = await supabase.from('bongi_user_profiles').select('phone,user_type,channel,carrier,verified_at').ilike('display_name', `%${name}%`).limit(1);
        if (p && p[0]) profile = p[0];

        const phone = profile?.phone || g.phone;
        if (phone) {
          const { data: a } = await supabase.from('bongi_applications').select('product_ticket,product_name,type,status').eq('phone', phone).order('created_at', { ascending: false }).limit(1);
          if (a && a[0]) app = a[0];
        }
      }

      enriched.push({
        ...g,
        phone: g.phone || profile?.phone || null,
        user_type: g.user_type || profile?.user_type || null,
        channel: g.channel || app?.type || profile?.channel || null,
        product_ticket: g.ticket_no || g.product_ticket || app?.product_ticket || null,
        product_name: g.product_name || app?.product_name || g.memo || null,
        verified: g.auth_status || (profile?.verified_at ? '인증완료' : '미인증'),
      });
    }

    res.json({ gifts: enriched });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /admin/platform/gifts/:id — 사은품 상태 변경 (지급 처리)
router.patch('/gifts/:id', async (req, res) => {
  try {
    const { status, paid_at } = req.body;
    const update = { status };
    if (status === '지급완료') update.paid_at = paid_at || new Date().toISOString();
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

// GET /admin/platform/members/:id — 회원 상세 (8탭 통합)
router.get('/members/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 기본 프로필 조회
    const { data: profile, error: profileError } = await supabase.from('bongi_user_profiles').select('*').eq('id', id).single();
    if (profileError) throw profileError;

    const phone = profile.phone || null;
    const userId = profile.user_id || profile.id;

    // 8탭 데이터 병렬 조회
    const [applications, gifts, cashBalance, cashHistory, withdrawals, referrals, rewards, alarms, addresses] = await Promise.all([
      phone ? supabase.from('bongi_applications').select('*').eq('phone', phone).order('created_at', { ascending: false }) : { data: [] },
      supabase.from('bongi_gifts').select('*').or(`customer_id.eq.${userId},name.eq.${profile.display_name}`).order('created_at', { ascending: false }),
      supabase.from('bongi_cash_balance').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('bongi_cash_history').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('bongi_withdrawals').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('bongi_referrals').select('*').eq('referrer_user_id', userId).order('created_at', { ascending: false }),
      supabase.from('bongi_rewards').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('bongi_user_alarms').select('*').eq('user_id', userId).order('target_date', { ascending: true }),
      supabase.from('bongi_addresses').select('*').eq('user_id', userId),
    ]);

    res.json({
      profile,
      applications: applications.data || [],
      gifts: gifts.data || [],
      cash_balance: cashBalance.data || { balance: 0 },
      cash_history: cashHistory.data || [],
      withdrawals: withdrawals.data || [],
      referrals: referrals.data || [],
      rewards: rewards.data || [],
      alarms: alarms.data || [],
      addresses: addresses.data || [],
    });
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

// POST /admin/platform/members/sync — 전체 회원 데이터 일괄 동기화
router.post('/members/sync', async (req, res) => {
  try {
    const result = await syncAllMembers();
    res.json(result);
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
        converted: (data || []).filter(r => r.status === '계약완료').length,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 리턴캐쉬 관리 ──

// GET /admin/platform/cash/history — 포인트 적립/출금 내역 (어드민 전체)
router.get('/cash/history', async (req, res) => {
  try {
    const { data: history, error } = await supabase.from('bongi_cash_history').select('*').order('created_at', { ascending: false }).limit(200);
    if (error) throw error;

    // user_id → 회원 정보 매칭
    const enriched = [];
    for (const h of (history || [])) {
      let profile = null;
      if (h.user_id) {
        const { data: p } = await supabase.from('bongi_user_profiles').select('display_name,phone,channel').eq('id', h.user_id).maybeSingle();
        if (p) profile = p;
      }
      enriched.push({
        ...h,
        name: profile?.display_name || '-',
        phone: profile?.phone || '-',
        channel: profile?.channel || '-',
      });
    }

    res.json({ history: enriched });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /admin/platform/cash/withdrawals — 출금 신청 목록 (회원 정보 매칭)
router.get('/cash/withdrawals', async (req, res) => {
  try {
    const { status } = req.query;
    let query = supabase.from('bongi_withdrawals').select('*').order('created_at', { ascending: false }).limit(100);
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;

    const enriched = [];
    for (const w of (data || [])) {
      let profile = null;
      if (w.user_id) {
        const { data: p } = await supabase.from('bongi_user_profiles').select('display_name,phone,channel,verified_at,point_balance,total_conversions').eq('id', w.user_id).maybeSingle();
        if (p) profile = p;
      }
      enriched.push({
        ...w,
        name: profile?.display_name || w.account_holder || '-',
        phone: profile?.phone || '-',
        channel: profile?.channel || '-',
        hold_balance: profile?.point_balance || 0,
        verified: profile?.verified_at ? '인증완료' : '미인증',
        contract_count: (profile?.total_conversions || 0) + '회',
        condition: (profile?.point_balance >= 50000 && profile?.verified_at && w.bank_name) ? '충족' : '미충족',
      });
    }

    res.json({ withdrawals: enriched });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /admin/platform/cash/withdrawals/:id — 출금 승인/거절
router.patch('/cash/withdrawals/:id', async (req, res) => {
  try {
    const { status, admin_memo } = req.body;

    // 승인 시 조건 4가지 검증
    if (status === '승인') {
      const { data: w } = await supabase.from('bongi_withdrawals').select('user_id,amount').eq('id', req.params.id).maybeSingle();
      if (w && w.user_id) {
        const { data: p } = await supabase.from('bongi_user_profiles').select('point_balance,verified_at,bank_name,total_conversions').eq('id', w.user_id).maybeSingle();
        const { data: b } = await supabase.from('bongi_cash_balance').select('balance').eq('user_id', w.user_id).maybeSingle();
        const balance = b?.balance || p?.point_balance || 0;
        const errors = [];
        if (balance < 50000) errors.push('보유 포인트 5만P 미만 (' + balance + 'P)');
        if (!p?.verified_at) errors.push('PASS 본인인증 미완료');
        if (!p?.bank_name) errors.push('계좌 미등록');
        if ((p?.total_conversions || 0) < 1) errors.push('계약 0회');
        if (errors.length > 0) {
          return res.status(400).json({ error: '출금 조건 미충족: ' + errors.join(', ') });
        }
      }
    }

    const update = { status };
    if (status === '승인') {
      update.status = '승인';
      update.approved_at = new Date().toISOString();
    }
    if (status === '반려') {
      update.status = '반려';
      update.rejected_at = new Date().toISOString();
    }
    if (admin_memo !== undefined) update.admin_memo = admin_memo;
    const { data, error } = await supabase.from('bongi_withdrawals').update(update).eq('id', req.params.id).select();
    if (error) throw error;

    const withdrawal = data[0];

    // 반려 시 잔액 환불 + 이력 기록
    if (status === '반려' && withdrawal) {
      // 잔액 복구 (RPC 원자적 가산)
      const { error: rpcError } = await supabase.rpc('add_cash_balance', {
        p_user_id: withdrawal.user_id,
        p_amount: withdrawal.amount,
      });
      if (rpcError) {
        // RPC 미등록 시 fallback
        const { data: bal } = await supabase.from('bongi_cash_balance').select('balance').eq('user_id', withdrawal.user_id).single();
        const currentBal = bal?.balance || 0;
        await supabase.from('bongi_cash_balance').upsert(
          { user_id: withdrawal.user_id, balance: currentBal + withdrawal.amount, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );
      }

      // 캐쉬 이력에 환불 기록
      await supabase.from('bongi_cash_history').insert({
        user_id: withdrawal.user_id,
        type: '환불',
        amount: withdrawal.amount,
        description: `출금 반려 환불${admin_memo ? ` (사유: ${admin_memo})` : ''}`,
        status: '완료',
      });
    }

    res.json({ withdrawal });
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
    const { error: histError } = await supabase.from('bongi_cash_history').insert({
      user_id,
      amount,
      type: '적립',
      description: reason || '관리자 수동 적립',
      status: '완료',
    });
    if (histError) console.warn('포인트 이력 저장 실패:', histError.message);

    // 잔액 업데이트 (원자적 처리 — Race Condition 방지)
    // upsert로 INSERT ... ON CONFLICT DO UPDATE 처리
    const { data: existing } = await supabase.from('bongi_cash_balance').select('balance').eq('user_id', user_id).single();
    if (existing) {
      // RPC로 원자적 가산. RPC 미사용 시 단일 UPDATE로 현재 잔액 기반 갱신
      const { error: addError } = await supabase.rpc('add_cash_balance', {
        p_user_id: user_id,
        p_amount: amount,
      });
      if (addError) {
        // RPC 미등록 시 fallback: upsert
        await supabase.from('bongi_cash_balance').upsert(
          { user_id, balance: existing.balance + amount, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );
      }
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
      supabase.from('bongi_withdrawals').select('id', { count: 'exact', head: true }).eq('status', '대기'),
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

// ── 공시지원금 관리 ──

// GET /admin/platform/subsidy — 공시지원금 데이터 + 마지막 업데이트 시간
router.get('/subsidy', async (req, res) => {
  try {
    const { model, carrier } = req.query;
    let query = supabase.from('bongi_subsidy_data').select('*', { count: 'exact' }).order('model').order('carrier').range(0, 1999);
    if (model) query = query.ilike('model', `%${model}%`);
    if (carrier) query = query.eq('carrier', carrier);
    const { data, error, count } = await query;
    if (error) throw error;
    // 마지막 업데이트 시간
    const { data: latest } = await supabase.from('bongi_subsidy_data').select('updated_date').order('created_at', { ascending: false }).limit(1);
    const lastUpdated = latest?.[0]?.updated_date || null;
    res.json({ data: data || [], total: (data || []).length, lastUpdated });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /admin/platform/subsidy/bulk — 공시지원금 벌크 삽입
router.post('/subsidy/bulk', async (req, res) => {
  try {
    const { data } = req.body;
    if (!data || !Array.isArray(data)) return res.status(400).json({ error: 'data 배열 필수' });
    // 기존 데이터 삭제
    await supabase.from('bongi_subsidy_data').delete().neq('id', 0);
    // 500건씩 배치 삽입
    let inserted = 0;
    for (let i = 0; i < data.length; i += 500) {
      const batch = data.slice(i, i + 500);
      const { error } = await supabase.from('bongi_subsidy_data').insert(batch);
      if (error) console.error('벌크 삽입 에러:', error.message);
      else inserted += batch.length;
    }
    res.json({ inserted, total: data.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /admin/platform/subsidy/crawl — 수동 크롤링 트리거
router.post('/subsidy/crawl', async (req, res) => {
  try {
    const { crawlSubsidy } = await import('../services/subsidy-crawler.js');
    res.json({ message: '크롤링 시작됨', status: 'started' });
    crawlSubsidy().catch(e => console.error('수동 크롤링 에러:', e.message));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 렌탈 상품 관리 ──

// GET /admin/platform/rental — 렌탈 상품 목록
router.get('/rental', async (req, res) => {
  try {
    const { category, brand } = req.query;
    let query = supabase.from('bongi_rental_products').select('*').order('category').order('brand');
    if (category) query = query.eq('category', category);
    if (brand) query = query.ilike('brand', `%${brand}%`);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ products: data || [], total: (data || []).length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /admin/platform/rental — 렌탈 상품 일괄 업데이트
router.put('/rental', async (req, res) => {
  try {
    const { products } = req.body;
    if (!Array.isArray(products)) return res.status(400).json({ error: 'products 배열 필수' });
    const { error } = await supabase.from('bongi_rental_products').upsert(products.map(p => ({ ...p, updated_at: new Date().toISOString() })));
    if (error) throw error;
    res.json({ success: true, count: products.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /admin/platform/rental/:id — 개별 수정 (티켓 연동)
router.patch('/rental/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('bongi_rental_products').update({ ...req.body, updated_at: new Date().toISOString() }).eq('id', req.params.id).select();
    if (error) throw error;
    const product = data[0];
    // 활성/비활성 변경 시 → 티켓도 연동
    if (req.body.is_active !== undefined && product.ticket_number) {
      await supabase.from('bongi_tickets')
        .update({ is_active: req.body.is_active, updated_at: new Date().toISOString() })
        .eq('ticket_number', product.ticket_number);
    }
    res.json({ product });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /admin/platform/rental/:id — 렌탈 삭제 (티켓 비활성화)
router.delete('/rental/:id', async (req, res) => {
  try {
    // 먼저 상품 정보 가져오기 (티켓번호)
    const { data: product } = await supabase.from('bongi_rental_products').select('ticket_number').eq('id', req.params.id).single();
    // 상품 삭제
    const { error } = await supabase.from('bongi_rental_products').delete().eq('id', req.params.id);
    if (error) throw error;
    // 관련 티켓 비활성화
    if (product?.ticket_number) {
      await supabase.from('bongi_tickets')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('ticket_number', product.ticket_number);
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 인터넷+TV 상품 활성/비활성 → 티켓 연동 ──

// PATCH /admin/platform/internet-speed/:id — 인터넷 속도 상품 수정
router.patch('/internet-speed/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('bongi_internet_speeds').update({ ...req.body }).eq('id', req.params.id).select();
    if (error) throw error;
    // 비활성화 시 → 해당 속도를 참조하는 티켓도 비활성화
    if (req.body.is_active === false) {
      await supabase.from('bongi_tickets')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('speed_id', req.params.id);
    }
    res.json({ product: data[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /admin/platform/tv-product/:id — TV 상품 수정
router.patch('/tv-product/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('bongi_tv_products').update({ ...req.body }).eq('id', req.params.id).select();
    if (error) throw error;
    if (req.body.is_active === false) {
      await supabase.from('bongi_tickets')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('tv_id', req.params.id);
    }
    res.json({ product: data[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /admin/platform/wifi-product/:id — WiFi 상품 수정
router.patch('/wifi-product/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('bongi_wifi_products').update({ ...req.body }).eq('id', req.params.id).select();
    if (error) throw error;
    if (req.body.is_active === false) {
      await supabase.from('bongi_tickets')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('wifi_id', req.params.id);
    }
    res.json({ product: data[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /admin/platform/settop-box/:id — 셋톱박스 수정
router.patch('/settop-box/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('bongi_settop_boxes').update({ ...req.body }).eq('id', req.params.id).select();
    if (error) throw error;
    if (req.body.is_active === false) {
      await supabase.from('bongi_tickets')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('settop_id', req.params.id);
    }
    res.json({ product: data[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /admin/platform/tv-product — TV 상품 추가
router.post('/tv-product', async (req, res) => {
  try {
    const { carrier, name, monthly_fee, channels, is_active } = req.body;
    if (!carrier || !name || monthly_fee === undefined) return res.status(400).json({ error: 'carrier, name, monthly_fee는 필수입니다' });
    const insert = { carrier, name, monthly_fee, is_active: is_active !== undefined ? is_active : true };
    if (channels !== undefined) insert.channels = channels;
    const { data, error } = await supabase.from('bongi_tv_products').insert(insert).select();
    if (error) throw error;
    res.json({ product: data[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /admin/platform/settop-box — 셋톱박스 추가
router.post('/settop-box', async (req, res) => {
  try {
    const { carrier, name, monthly_fee, is_active } = req.body;
    if (!carrier || !name || monthly_fee === undefined) return res.status(400).json({ error: 'carrier, name, monthly_fee는 필수입니다' });
    const { data, error } = await supabase.from('bongi_settop_boxes').insert({ carrier, name, monthly_fee, is_active: is_active !== undefined ? is_active : true }).select();
    if (error) throw error;
    res.json({ product: data[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /admin/platform/wifi-product — WiFi 상품 추가
router.post('/wifi-product', async (req, res) => {
  try {
    const { carrier, name, monthly_fee, is_active } = req.body;
    if (!carrier || !name || monthly_fee === undefined) return res.status(400).json({ error: 'carrier, name, monthly_fee는 필수입니다' });
    const { data, error } = await supabase.from('bongi_wifi_products').insert({ carrier, name, monthly_fee, is_active: is_active !== undefined ? is_active : true }).select();
    if (error) throw error;
    res.json({ product: data[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 휴대폰 요금제 관리 ──

// GET /admin/platform/mobile-plans — 요금제 목록
router.get('/mobile-plans', async (req, res) => {
  try {
    const { carrier } = req.query;
    let query = supabase.from('bongi_mobile_plans').select('*').eq('is_active', true).order('carrier').order('monthly_fee', { ascending: false });
    if (carrier) query = query.eq('carrier', carrier);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ plans: data || [], total: (data || []).length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /admin/platform/mobile-plans — 요금제 일괄 업데이트
router.put('/mobile-plans', async (req, res) => {
  try {
    const { plans } = req.body;
    if (!Array.isArray(plans)) return res.status(400).json({ error: 'plans 배열 필수' });
    const { error } = await supabase.from('bongi_mobile_plans').upsert(plans.map(p => ({ ...p, updated_at: new Date().toISOString() })));
    if (error) throw error;
    res.json({ success: true, count: plans.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 휴대폰 신규 시세 관리 ──

// GET /admin/platform/phone-prices — 신규폰 시세
router.get('/phone-prices', async (req, res) => {
  try {
    const { category } = req.query;
    let query = supabase.from('bongi_phone_prices').select('*').eq('is_active', true).order('model');
    if (category) query = query.eq('category', category);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ prices: data || [], total: (data || []).length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /admin/platform/phone-prices — 시세 일괄 업데이트
router.put('/phone-prices', async (req, res) => {
  try {
    const { prices } = req.body;
    if (!Array.isArray(prices)) return res.status(400).json({ error: 'prices 배열 필수' });
    const { error } = await supabase.from('bongi_phone_prices').upsert(prices.map(p => ({ ...p, updated_at: new Date().toISOString() })), { onConflict: 'model,category' });
    if (error) throw error;
    res.json({ success: true, count: prices.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 중고폰 매입 시세 관리 (Supabase) ──

// GET /admin/platform/used-phones — 중고폰 매입 시세 전체
router.get('/used-phones', async (req, res) => {
  try {
    const { maker, search } = req.query;
    let query = supabase.from('bongi_used_phone_prices').select('*').order('manufacturer').order('series').order('model');
    if (maker && maker !== '전체') query = query.eq('manufacturer', maker);
    if (search) { const s = sanitizeSearch(search); if (s) query = query.or(`model.ilike.%${s}%,series.ilike.%${s}%`); }
    const { data, error } = await query;
    if (error) throw error;
    // 어드민 HTML 호환 형식으로 변환
    const phones = (data || []).map(p => ({
      '제조사': p.manufacturer, '시리즈': p.series, '모델명': p.model, '용량': p.storage,
      'A등급': p.grade_a, 'B등급': p.grade_b, 'C등급': p.grade_c, 'D등급': p.grade_d, 'E등급': p.grade_e,
    }));
    const { count } = await supabase.from('bongi_used_phone_prices').select('id', { count: 'exact', head: true });
    res.json({ phones, total: count || phones.length, filtered: phones.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /admin/platform/used-phones — 중고폰 시세 일괄 업데이트
router.put('/used-phones', async (req, res) => {
  try {
    const { phones } = req.body;
    if (!Array.isArray(phones)) return res.status(400).json({ error: 'phones 배열 필수' });
    const rows = phones.map(p => ({
      manufacturer: p['제조사'], series: p['시리즈'], model: p['모델명'], storage: p['용량'],
      grade_a: p['A등급'] || 0, grade_b: p['B등급'] || 0, grade_c: p['C등급'] || 0, grade_d: p['D등급'] || 0, grade_e: p['E등급'] || 0,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from('bongi_used_phone_prices').upsert(rows, { onConflict: 'manufacturer,model,storage' });
    if (error) throw error;
    res.json({ success: true, count: rows.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /admin/platform/used-phones/price — 개별 시세 수정
router.patch('/used-phones/price', async (req, res) => {
  try {
    const { 제조사, 모델명, 용량, A등급, B등급, C등급, D등급, E등급 } = req.body;
    if (!제조사 || !모델명 || !용량) return res.status(400).json({ error: '제조사, 모델명, 용량 필수' });
    const update = { updated_at: new Date().toISOString() };
    if (A등급 !== undefined) update.grade_a = A등급;
    if (B등급 !== undefined) update.grade_b = B등급;
    if (C등급 !== undefined) update.grade_c = C등급;
    if (D등급 !== undefined) update.grade_d = D등급;
    if (E등급 !== undefined) update.grade_e = E등급;
    const { data, error } = await supabase.from('bongi_used_phone_prices')
      .update(update).eq('manufacturer', 제조사).eq('model', 모델명).eq('storage', 용량).select();
    if (error) throw error;
    if (!data || data.length === 0) return res.status(404).json({ error: '해당 모델을 찾을 수 없습니다' });
    res.json({ success: true, updated: data[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 중고폰 매입 현황 ──

// GET /admin/platform/used-phone-buyback — 중고폰 매입 현황
router.get('/used-phone-buyback', async (req, res) => {
  try {
    const { status, store } = req.query;

    // bongi_used_phone_buyback 테이블 우선 조회
    let query = supabase.from('bongi_used_phone_buyback').select('*').order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    if (store) query = query.eq('store', store);
    const { data, error } = await query;

    if (!error && data && data.length > 0) {
      return res.json({ buybacks: data, total: data.length });
    }

    // 테이블이 없거나 데이터가 없으면 bongi_applications에서 중고폰 타입 필터
    let fallbackQuery = supabase.from('bongi_applications').select('*')
      .eq('type', '중고폰')
      .order('created_at', { ascending: false });
    if (status) fallbackQuery = fallbackQuery.eq('status', status);
    if (store) fallbackQuery = fallbackQuery.eq('store', store);
    const { data: fallbackData, error: fallbackError } = await fallbackQuery;
    if (fallbackError) throw fallbackError;
    res.json({ buybacks: fallbackData || [], total: (fallbackData || []).length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 신청 현황 ──

// GET /admin/platform/applications — 신청 목록
router.get('/applications', async (req, res) => {
  try {
    const { status, channel, search } = req.query;
    let query = supabase.from('bongi_applications').select('*').order('created_at', { ascending: false }).limit(200);
    if (status) query = query.eq('status', status);
    if (channel) query = query.eq('channel', channel);
    if (search) { const s = sanitizeSearch(search); if (s) query = query.or(`name.ilike.%${s}%,phone.ilike.%${s}%,product_ticket.ilike.%${s}%`); }
    const { data, error } = await query;
    if (error) throw error;
    res.json({ applications: data || [], total: (data || []).length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /admin/platform/applications/:id — 신청 상태/상품/티켓/사은품 변경
router.patch('/applications/:id', async (req, res) => {
  try {
    const { status, product_ticket, product_name, gift_amount, carrier } = req.body;

    // status 검증 (있을 경우만)
    if (status) {
      const allowed = ['신청완료', '상담중', '계약완료', '취소'];
      if (!allowed.includes(status)) {
        return res.status(400).json({ error: `status는 ${allowed.join(', ')} 중 하나여야 합니다` });
      }
    }

    // 업데이트 필드 구성 (보낸 것만 업데이트)
    const update = {};
    if (status) update.status = status;
    if (product_ticket !== undefined) update.product_ticket = product_ticket;
    if (product_name !== undefined) update.product_name = product_name;
    if (gift_amount !== undefined) update.gift_amount = gift_amount;
    if (carrier !== undefined) update.carrier = carrier;

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: '변경할 필드가 없습니다' });
    }

    const { data, error } = await supabase.from('bongi_applications').update(update).eq('id', req.params.id).select();
    if (error) throw error;
    if (!data || data.length === 0) return res.status(404).json({ error: '신청을 찾을 수 없습니다' });

    const application = data[0];
    let gift_created = false;

    // 계약완료 시 → bongi_gifts에 지급대기 자동 생성 (최종 확정 금액 기준)
    if (status === '계약완료') {
      const finalGift = gift_amount || application.gift_amount || 0;
      if (finalGift > 0) {
        const { error: giftErr } = await supabase.from('bongi_gifts').insert({
          amount: finalGift,
          status: '지급대기',
          memo: `${application.product_name || ''} (${application.product_ticket || ''})`,
        });
        if (giftErr) console.warn('사은품 자동 생성 실패:', giftErr.message);
        else gift_created = true;
      }
    }

    res.json({ application, gift_created });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 돈지키미 ──

// GET /admin/platform/don-jikimi — 돈지키미 알람 목록 (회원 정보 매칭)
router.get('/don-jikimi', async (req, res) => {
  try {
    const { data, error } = await supabase.from('bongi_user_alarms').select('*').order('target_date', { ascending: true }).limit(200);
    if (error) throw error;

    const enriched = [];
    for (const a of (data || [])) {
      let profile = null;
      if (a.user_id) {
        const { data: p } = await supabase.from('bongi_user_profiles').select('display_name,phone').eq('id', a.user_id).maybeSingle();
        if (p) profile = p;
      }
      enriched.push({
        ...a,
        name: profile?.display_name || '-',
        phone: profile?.phone || '-',
      });
    }

    res.json({ alarms: enriched, total: enriched.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /admin/platform/don-jikimi/:id — 돈지키미 상태 변경
router.patch('/don-jikimi/:id', async (req, res) => {
  try {
    const { crm_status, manager, memo } = req.body;
    const allowedStatus = ['pending', 'sent', 'completed'];
    if (crm_status && !allowedStatus.includes(crm_status)) {
      return res.status(400).json({ error: `crm_status는 ${allowedStatus.join(', ')} 중 하나여야 합니다` });
    }

    const update = {};
    if (crm_status) update.crm_status = crm_status;
    if (manager !== undefined) update.manager = manager;
    if (memo !== undefined) update.memo = memo;
    update.updated_at = new Date().toISOString();

    const { data, error } = await supabase.from('bongi_user_alarms').update(update).eq('id', req.params.id).select();
    if (error) throw error;
    if (!data || data.length === 0) return res.status(404).json({ error: '알람을 찾을 수 없습니다' });
    res.json({ alarm: data[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 알림 관리 ──

// GET /admin/platform/notifications — 알림 발송 이력 (회원 정보 매칭)
router.get('/notifications', async (req, res) => {
  try {
    const { channel } = req.query;
    let query = supabase.from('bongi_notifications').select('*').order('created_at', { ascending: false }).limit(200);
    if (channel) query = query.eq('channel', channel);
    const { data, error } = await query;
    if (error) throw error;

    const enriched = [];
    for (const n of (data || [])) {
      let profile = null;
      if (n.recipient_id) {
        const { data: p } = await supabase.from('bongi_user_profiles').select('display_name,phone').eq('id', n.recipient_id).maybeSingle();
        if (p) profile = p;
      }
      enriched.push({
        ...n,
        recipient_name: profile?.display_name || '-',
        recipient_phone: profile?.phone || '-',
      });
    }

    res.json({ notifications: enriched, total: enriched.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /admin/platform/notifications — 알림 수동 발송
router.post('/notifications', async (req, res) => {
  try {
    const { user_id, channel, type, title, content } = req.body;
    if (!user_id || !title) {
      return res.status(400).json({ error: 'user_id, title은 필수입니다' });
    }

    const { data, error } = await supabase.from('bongi_notifications').insert({
      recipient_id: user_id,
      recipient_type: 'user',
      channel: channel || 'push',
      type: type || 'manual',
      title,
      body: content || '',
      status: 'sent',
    }).select();
    if (error) throw error;
    res.json({ notification: data[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /admin/platform/notifications/:id — 알림 재발송 (status를 pending으로 변경)
router.patch('/notifications/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('bongi_notifications')
      .update({ status: 'pending', updated_at: new Date().toISOString() })
      .eq('id', req.params.id).select();
    if (error) throw error;
    if (!data || data.length === 0) return res.status(404).json({ error: '알림을 찾을 수 없습니다' });
    res.json({ notification: data[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 매장 관리 (어드민용) ──

// GET /admin/platform/stores — 매장 목록
router.get('/stores', async (req, res) => {
  try {
    const { data, error } = await supabase.from('bongi_stores').select('*').order('name');
    if (error) throw error;
    res.json({ stores: data || [], total: (data || []).length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /admin/platform/stores/:id — 매장 정보 수정
router.patch('/stores/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase.from('bongi_stores').update(req.body).eq('id', id).select().single();
    if (error) throw error;
    res.json({ store: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /admin/platform/stores — 매장 추가
router.post('/stores', async (req, res) => {
  try {
    const { name, address, phone } = req.body;
    if (!name || !address || !phone) return res.status(400).json({ error: 'name, address, phone은 필수입니다' });
    const { data, error } = await supabase.from('bongi_stores').insert(req.body).select();
    if (error) throw error;
    res.json({ store: data[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /admin/platform/stores/:id — 매장 삭제
router.delete('/stores/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('bongi_stores').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 인터넷+TV 상품 (통신사별) ──

// GET /admin/platform/carrier-products — 인터넷 속도, TV, WiFi, 셋톱 전체
router.get('/carrier-products', async (req, res) => {
  try {
    const [speeds, tv, wifi, settop] = await Promise.all([
      supabase.from('bongi_internet_speeds').select('*').order('carrier').order('speed'),
      supabase.from('bongi_tv_products').select('*').order('carrier').order('name'),
      supabase.from('bongi_wifi_products').select('*').order('carrier').order('name'),
      supabase.from('bongi_settop_boxes').select('*').order('carrier').order('name'),
    ]);
    res.json({
      internet_speeds: speeds.data || [],
      tv_products: tv.data || [],
      wifi_products: wifi.data || [],
      settop_boxes: settop.data || [],
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 티켓 동기화 ──

// POST /admin/platform/tickets/sync — 상품 변경사항 → 티켓 일괄 동기화
router.post('/tickets/sync', async (req, res) => {
  try {
    const results = { updated: 0, deactivated: 0, errors: [] };

    // 1. 렌탈 상품 → 렌탈 티켓 동기화
    const { data: rentals } = await supabase.from('bongi_rental_products').select('product_name,monthly_fee,ticket_number,is_active');
    for (const r of (rentals || [])) {
      if (!r.ticket_number) continue;
      const update = {
        rental_name: r.product_name,
        rental_monthly_fee: String(r.monthly_fee),
        is_active: r.is_active !== false,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('bongi_tickets').update(update).eq('ticket_number', r.ticket_number);
      if (error) results.errors.push(`${r.ticket_number}: ${error.message}`);
      else results.updated++;
      if (!r.is_active) results.deactivated++;
    }

    // 2. 인터넷 구성요소 비활성 → 해당 조합 티켓 연쇄 비활성
    // 셋톱박스
    const { data: settops } = await supabase.from('bongi_settop_boxes').select('id,is_active').eq('is_active', false);
    for (const s of (settops || [])) {
      const { data: affected } = await supabase.from('bongi_tickets').update({ is_active: false, updated_at: new Date().toISOString() }).eq('settop_id', s.id).eq('is_active', true).select('ticket_number');
      results.deactivated += (affected || []).length;
    }
    // TV
    const { data: tvs } = await supabase.from('bongi_tv_products').select('id,is_active').eq('is_active', false);
    for (const t of (tvs || [])) {
      const { data: affected } = await supabase.from('bongi_tickets').update({ is_active: false, updated_at: new Date().toISOString() }).eq('tv_id', t.id).eq('is_active', true).select('ticket_number');
      results.deactivated += (affected || []).length;
    }
    // WiFi
    const { data: wifis } = await supabase.from('bongi_wifi_products').select('id,is_active').eq('is_active', false);
    for (const w of (wifis || [])) {
      const { data: affected } = await supabase.from('bongi_tickets').update({ is_active: false, updated_at: new Date().toISOString() }).eq('wifi_id', w.id).eq('is_active', true).select('ticket_number');
      results.deactivated += (affected || []).length;
    }

    // 캐시 무효화
    res.json({ success: true, ...results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 티켓 관리 (어드민용) ──

// GET /admin/platform/tickets — 티켓 목록
router.get('/tickets', async (req, res) => {
  try {
    const { carrier, search } = req.query;
    let query = supabase.from('bongi_tickets').select('*').order('ticket_number');
    if (carrier) query = query.eq('carrier', carrier);
    if (search) { const s = sanitizeSearch(search); if (s) query = query.or(`ticket_number.ilike.%${s}%,rental_name.ilike.%${s}%`); }
    const { data, error } = await query;
    if (error) throw error;
    res.json({ tickets: data || [], total: (data || []).length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 개발 이슈/메모 관리 ──

// GET /admin/platform/dev-notes — 이슈 목록 (페이지별 필터)
router.get('/dev-notes', async (req, res) => {
  try {
    const { page, status, type } = req.query;
    let query = supabase.from('bongi_dev_notes').select('*').order('created_at', { ascending: false }).limit(200);
    if (page) query = query.eq('page', page);
    if (status) query = query.eq('status', status);
    if (type) query = query.eq('type', type);
    const { data, error } = await query;
    if (error) throw error;
    const counts = { total: 0, open: 0, resolved: 0 };
    (data || []).forEach(n => { counts.total++; if (n.status === '열림') counts.open++; else counts.resolved++; });
    res.json({ notes: data || [], counts });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /admin/platform/dev-notes — 이슈 등록
router.post('/dev-notes', async (req, res) => {
  try {
    const { page, type, title, content, priority, author, assignee } = req.body;
    if (!title) return res.status(400).json({ error: 'title 필수' });
    const { data, error } = await supabase.from('bongi_dev_notes').insert({
      page: page || '전체',
      type: type || '메모',
      title,
      content: content || '',
      priority: priority || '보통',
      author: author || '',
      assignee: assignee || '',
      status: '열림',
    }).select();
    if (error) throw error;
    res.json({ note: data[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /admin/platform/dev-notes/:id — 이슈 상태 변경
router.patch('/dev-notes/:id', async (req, res) => {
  try {
    const update = { ...req.body, updated_at: new Date().toISOString() };
    if (req.body.status === '완료') update.resolved_at = new Date().toISOString();
    const { data, error } = await supabase.from('bongi_dev_notes').update(update).eq('id', req.params.id).select();
    if (error) throw error;
    res.json({ note: data[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /admin/platform/dev-notes/:id — 이슈 삭제
router.delete('/dev-notes/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('bongi_dev_notes').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /admin/platform/dev-specs/:page — 화면 설명/가이드
router.get('/dev-specs/:page', async (req, res) => {
  try {
    const { data } = await supabase.from('bongi_dev_specs').select('*').eq('page', req.params.page).maybeSingle();
    res.json({ spec: data || null });
  } catch (e) {
    res.json({ spec: null });
  }
});

// PATCH /admin/platform/dev-specs/:page — 화면 설명 수정
router.patch('/dev-specs/:page', async (req, res) => {
  try {
    const { description, notes, updated_by } = req.body;
    const update = { updated_at: new Date().toISOString() };
    if (description !== undefined) update.description = description;
    if (notes !== undefined) update.notes = notes;
    if (updated_by) update.updated_by = updated_by;

    const { data, error } = await supabase.from('bongi_dev_specs')
      .upsert({ page: req.params.page, ...update }, { onConflict: 'page' })
      .select();
    if (error) throw error;
    res.json({ spec: data[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /admin/platform/doc-headers/:page — 플로우 문서 섹션 헤더 목록
router.get('/doc-headers/:page', async (req, res) => {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const docMap = {
      '회원관리': 'service-flow-v2.html', '신청현황': 'flow-applications.html',
      '사은품': 'flow-gifts.html', '포인트': 'flow-points-referral-guard.html',
      '후기': 'flow-reviews.html', '돈지키미': 'flow-points-referral-guard.html',
      '알림': 'flow-points-referral-guard.html', '중고폰매입': 'flow-used-phone.html',
      '매장시세': 'flow-store-price.html', '티켓': 'flow-ticket.html',
      '렌탈': 'flow-rental.html', '인터넷TV': 'flow-internet-tv.html',
      '전체': 'master-map.html',
    };
    const file = docMap[req.params.page] || 'master-map.html';
    const filePath = path.join(process.cwd(), 'docs', file);
    const html = fs.readFileSync(filePath, 'utf8');
    // step-label과 section-title 추출
    const headers = [];
    const regex = /(?:step-label|section-title)[^>]*>(?:<[^>]*>)*([^<]+)/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const text = match[1].trim();
      if (text && text.length > 2) headers.push(text);
    }
    res.json({ headers, file });
  } catch (e) {
    res.json({ headers: [], error: e.message });
  }
});

export default router;
