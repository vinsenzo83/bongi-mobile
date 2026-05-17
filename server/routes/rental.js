// ═══════════════════════════════════════════════════════════════
// 가전렌탈 라우트 — 카테고리·상품·옵션·정책·영업
// ═══════════════════════════════════════════════════════════════
import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { authenticateJWT, optionalAuth } from '../middleware/auth.js';

const router = Router();
const _isProd = process.env.NODE_ENV === 'production';
const errMsg = (e) => _isProd ? '서버 오류 — 잠시 후 다시 시도하세요' : (e?.message || '서버 오류');

// ─── 카테고리 ───
router.get('/categories', optionalAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('rental_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    res.json({ categories: data || [] });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

// ─── 정책 (활성 1개) ───
router.get('/policy', optionalAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('rental_policy')
      .select('*')
      .eq('active', true)
      .single();
    if (error) throw error;
    res.json({ policy: data });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

// ─── 정책 변경 (admin 전용) — incentive_rules와 동일 컬럼 화이트리스트 ───
router.patch('/policy', authenticateJWT, async (req, res) => {
  try {
    const { id, change_reason, ...fields } = req.body;
    if (!id) return res.status(400).json({ error: 'policy id 필수' });

    // 화이트리스트 (incentive_rules 동일 + 가전 자동 계산용)
    const ALLOWED = [
      'version', 'effective_from', 'active', 'notes',
      'base_salary', 'bonus_per_premium',
      'payback_company_limit', 'payback_max',
      'grade_rates', 'grade_thresholds', 'premium_margin_threshold',
      'manager_v51_enabled', 'manager_override_rate', 'manager_obligation_count',
      'manager_penalty_partial_min', 'manager_team_profit_rate_min',
      // 가전 옵션 자동 계산용 (옵션 단위 마진/Tier 자동 분류)
      'weight_cost_per_p', 'tier_s_min_margin', 'tier_a_min_margin', 'tier_b_min_margin', 'tier_to_p',
    ];
    const update = {};
    for (const k of ALLOWED) {
      if (fields[k] !== undefined) update[k] = fields[k];
    }

    // 변경 이력 — 기존 값 가져오기
    const { data: oldPolicy } = await supabase.from('rental_policy').select('*').eq('id', id).single();
    const changedFields = {};
    for (const [k, v] of Object.entries(update)) {
      const ov = oldPolicy?.[k];
      if (ov != null && JSON.stringify(ov) !== JSON.stringify(v)) {
        changedFields[k] = { old: ov, new: v };
      } else if (ov == null && v != null) {
        changedFields[k] = { old: null, new: v };
      }
    }
    update.updated_at = new Date().toISOString();
    const { data, error } = await supabase
      .from('rental_policy')
      .update(update)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    if (Object.keys(changedFields).length > 0) {
      await supabase.from('rental_policy_history').insert({
        policy_id: id,
        changed_fields: changedFields,
        changed_by: req.user?.email || 'unknown',
        change_reason: change_reason || null,
      });
    }
    res.json({ policy: data });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

// ─── 새 버전 발행 (admin) — incentive_rules와 동일 패턴 ───
router.post('/policy', authenticateJWT, async (req, res) => {
  try {
    const { deactivate_others, change_reason, ...fields } = req.body;
    const ALLOWED = [
      'version', 'effective_from', 'notes',
      'base_salary', 'bonus_per_premium',
      'payback_company_limit', 'payback_max',
      'grade_rates', 'grade_thresholds', 'premium_margin_threshold',
      'manager_v51_enabled', 'manager_override_rate', 'manager_obligation_count',
      'manager_penalty_partial_min', 'manager_team_profit_rate_min',
    ];
    const insert = { active: true };
    for (const k of ALLOWED) {
      if (fields[k] !== undefined) insert[k] = fields[k];
    }
    if (!insert.version) return res.status(400).json({ error: 'version 필수' });

    if (deactivate_others) {
      await supabase.from('rental_policy').update({ active: false }).eq('active', true);
    }
    const { data, error } = await supabase.from('rental_policy').insert(insert).select().single();
    if (error) throw error;
    // 이력 기록
    await supabase.from('rental_policy_history').insert({
      policy_id: data.id,
      changed_fields: { __published__: { old: null, new: insert.version } },
      changed_by: req.user?.email || 'unknown',
      change_reason: change_reason || `새 버전 [${insert.version}] 발행`,
    });
    res.json({ policy: data });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

// ─── 정책 전체 list (admin) — 다중 버전 ───
router.get('/policy/all', authenticateJWT, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('rental_policy')
      .select('*')
      .order('effective_from', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ policies: data || [] });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

// ─── 정책 row 활성/비활성 토글 (admin) ───
router.patch('/policy/:id/active', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    if (active === true) {
      // 다른 active row 비활성화
      await supabase.from('rental_policy').update({ active: false }).neq('id', id);
    }
    const { data, error } = await supabase.from('rental_policy')
      .update({ active: !!active, updated_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (error) throw error;
    await supabase.from('rental_policy_history').insert({
      policy_id: id,
      changed_fields: { active: { old: !active, new: !!active } },
      changed_by: req.user?.email || 'unknown',
      change_reason: active ? '활성화' : '비활성화',
    });
    res.json({ policy: data });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

// ─── 정책 변경 이력 ───
router.get('/policy/history', authenticateJWT, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('rental_policy_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    res.json({ history: data || [] });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

// ─── 청호 규정코드 (전체 또는 product_group 필터) ───
router.get('/chungho-rules', optionalAuth, async (req, res) => {
  try {
    const { product_group, months } = req.query;
    let q = supabase.from('rental_chungho_rules').select('*').order('rule_type').order('mandatory_months').order('inspection_cycle');
    if (product_group) q = q.eq('product_group', product_group);
    if (months) q = q.eq('mandatory_months', Number(months));
    const { data, error } = await q;
    if (error) throw error;
    res.json({ rules: data || [] });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

// ─── 브랜드 정책 ───
router.get('/brand-policies', optionalAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('rental_brand_policies')
      .select('*')
      .order('brand', { ascending: true });
    if (error) throw error;
    res.json({ brand_policies: data || [] });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

// ─── 상품 목록 (카테고리·브랜드 필터) ───
// ─── 팀장 V5.1 오버라이드 계산 (가전렌탈) ───
router.get('/manager-override/:agentId/:yearMonth', authenticateJWT, async (req, res) => {
  try {
    const { agentId, yearMonth } = req.params;
    if (!/^\d{4}-\d{2}$/.test(yearMonth)) return res.status(400).json({ error: 'yearMonth must be YYYY-MM' });
    const { data, error } = await supabase.rpc('rental_calc_manager_override', { p_agent_id: agentId, p_year_month: yearMonth });
    if (error) throw error;
    const row = Array.isArray(data) ? (data[0] || null) : data;
    res.json({ override: row, year_month: yearMonth });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

// 본인 manager override (당월 자동)
router.get('/manager-override/me', authenticateJWT, async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'unauthorized' });
    const { data: agent } = await supabase.from('incentive_agents').select('id').eq('user_id', req.user.id).single();
    if (!agent) return res.json({ override: null, year_month: null });
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const { data, error } = await supabase.rpc('rental_calc_manager_override', { p_agent_id: agent.id, p_year_month: ym });
    if (error) throw error;
    const row = Array.isArray(data) ? (data[0] || null) : data;
    res.json({ override: row, year_month: ym });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

// ─── 추천용 상품 + 메타 (RPC로 schema cache 우회) ───
router.get('/products/for-recommend', optionalAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('rental_products_for_recommend');
    if (error) throw error;
    res.json({ products: data || [] });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

router.get('/products', optionalAuth, async (req, res) => {
  try {
    const { category, brand, active_only = '1' } = req.query;
    let q = supabase
      .from('rental_products')
      .select('*, category:rental_categories(slug, name)')
      .order('brand', { ascending: true })
      .order('model', { ascending: true });
    if (active_only === '1') q = q.eq('is_active', true);
    if (category) {
      const { data: cat } = await supabase.from('rental_categories').select('id').eq('slug', category).single();
      if (cat) q = q.eq('category_id', cat.id);
    }
    if (brand) q = q.eq('brand', brand);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ products: data || [] });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

// ─── 상품 + 옵션 함께 조회 (계산기에서 1회 호출용) ───
router.get('/products/:id/options', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const [{ data: product }, { data: options }] = await Promise.all([
      supabase.from('rental_products').select('*, category:rental_categories(slug, name)').eq('id', id).single(),
      supabase.from('rental_product_options').select('*').eq('product_id', id).eq('is_active', true).order('months').order('care_service'),
    ]);
    res.json({ product, options: options || [] });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

// ─── 상품 페이백 / 가중치 / Tier 편집 (admin) ───
router.patch('/products/:id', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = ['point_weight', 'is_premium', 'tier', 'is_active', 'promo_tag', 'evaluation_memo', 'market_score', 'display_rank', 'description', 'registration_status', 'product_url',
      // 추천 메타
      'recommended_capacity', 'recommended_usage', 'feature_tags', 'spec_notes',
      'specifications', 'meta_manual_override'];
    const update = {};
    for (const k of allowed) if (k in req.body) update[k] = req.body[k];
    update.updated_at = new Date().toISOString();
    const { data, error } = await supabase
      .from('rental_products')
      .update(update)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    res.json({ product: data });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

// ─── 옵션 편집 (admin) ───
router.patch('/options/:id', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = [
      'payback', 'point_weight', 'point_weight_adj', 'tier', 'is_active', 'margin', 'tier_calculated',
      'monthly_fee', 'monthly_diff', 'normal_price',
      'rebate', 'rebate_otherco', 'rebate_half',           // ★ 리베이트 3종
      'half_fee', 'half_period',                            // ★ 반값할인 렌탈료·기간
      'bundle_rate', 'inspection_cycle', 'ownership_months',
      'margin_manual_override',                             // ★ 수동 마진 보존 플래그
    ];
    const update = {};
    for (const k of allowed) if (k in req.body) update[k] = req.body[k];
    // margin이 명시적으로 전송되면 수동 override 자동 true (NULL이면 reset)
    if ('margin' in req.body) {
      update.margin_manual_override = req.body.margin !== null && req.body.margin !== '';
    }
    // 비고 — metadata.note
    if ('note' in req.body) {
      const { data: cur } = await supabase.from('rental_product_options').select('metadata').eq('id', id).single();
      update.metadata = { ...(cur?.metadata || {}), note: req.body.note };
    }
    // 옵션 is_active 변경 시 ticket_active도 자동 sync (영업 추적 정확성)
    if ('is_active' in req.body) {
      update.ticket_active = !!req.body.is_active;
    }
    update.updated_at = new Date().toISOString();
    const { data, error } = await supabase
      .from('rental_product_options')
      .update(update)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    res.json({ option: data });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

// ─── 견적 계산 (옵션 + 프로모션 + 페이백 + 정책 → 마진 산출) ───
router.post('/quote', optionalAuth, async (req, res) => {
  try {
    const { option_id, payback_override, promo_type, bundle_apply, half_period_override } = req.body;
    // promo_type: 'basic' (default) / 'half' (반값할인) / 'otherco' (타사보상)
    // bundle_apply: true/false — 통신 결합 시 bundle_rate 적용
    // half_period_override: 반값할인 적용 개월수 직접 지정 (옵션 기본값 무시)
    if (!option_id) return res.status(400).json({ error: 'option_id 필수' });

    const [{ data: opt }, { data: policy }] = await Promise.all([
      supabase.from('rental_product_options').select('*, product:rental_products(*)').eq('id', option_id).single(),
      supabase.from('rental_policy').select('*').eq('active', true).single(),
    ]);
    if (!opt || !policy) return res.status(404).json({ error: '옵션 또는 정책 없음' });

    const product = opt.product;

    // 리베이트 선택 (프로모션 적용)
    let rebateBase = opt.rebate || 0;
    let rebateSourceLabel = '기본';
    if (promo_type === 'half' && opt.rebate_half) {
      rebateBase = opt.rebate_half;
      rebateSourceLabel = `반값할인 (${opt.half_period || '?'}개월)`;
    } else if (promo_type === 'otherco' && opt.rebate_otherco) {
      rebateBase = opt.rebate_otherco;
      rebateSourceLabel = '타사보상';
    } else if (typeof promo_type === 'string' && promo_type.startsWith('custom:')) {
      // 모델별 promo_tags_list 조합 (예: "12M반값", "타사보상+패키지" 등)
      const tag = promo_type.slice(7);
      rebateSourceLabel = tag;
      if (tag.includes('반값') && opt.rebate_half) rebateBase = opt.rebate_half;
      else if (tag.includes('타사보상') && opt.rebate_otherco) rebateBase = opt.rebate_otherco;
    }
    // 결합 지급률 적용
    const bundleRate = bundle_apply ? (opt.bundle_rate || 100) : 100;
    const rebate = Math.round(rebateBase * bundleRate / 100);

    // 반값 적용 개월수 (사용자 override > 옵션 기본값)
    const effectiveHalfPeriod = (half_period_override != null && half_period_override > 0)
      ? Number(half_period_override)
      : (opt.half_period || 0);
    // 월 납부액 (반값 적용 시 half_fee)
    const effectiveMonthlyFee = promo_type === 'half' && opt.half_fee ? opt.half_fee : opt.monthly_fee;

    // 페이백 = 옵션 DB의 값 (운영자가 옵션마다 수동 입력)
    const payback = payback_override != null ? Number(payback_override) : (opt.payback || 0);
    const paybackSource = payback_override != null ? 'override' : 'admin';

    // P 자동 매핑 (정책의 tier_to_p JSONB): 임시 P=1.5 → 임시 Tier → P 매핑
    const wcUnit = policy.weight_cost_per_p || 70000;
    const sMin = policy.tier_s_min_margin || 130000;
    const aMin = policy.tier_a_min_margin || 120000;
    const bMin = policy.tier_b_min_margin || 100000;
    const premThr = policy.premium_margin_threshold || 130000;
    const tempMargin = Math.round((opt.rebate||0) * 0.9 - payback - 1.5 * wcUnit);
    let tempTier = 'C';
    if (tempMargin >= sMin) tempTier = 'S';
    else if (tempMargin >= aMin) tempTier = 'A';
    else if (tempMargin >= bMin) tempTier = 'B';
    const pMap = policy.tier_to_p || { S: 2.0, A: 1.5, B: 1.2, C: 1.0 };
    const P = Number(pMap[tempTier]) || 1.0;
    // 최종 margin 기반 Tier·우수 자동 분류
    const finalMargin = Math.round((opt.rebate||0) * 0.9 - payback - P * wcUnit);
    let finalTier = 'C';
    if (finalMargin >= sMin) finalTier = 'S';
    else if (finalMargin >= aMin) finalTier = 'A';
    else if (finalMargin >= bMin) finalTier = 'B';
    const isPremiumAuto = finalMargin >= premThr;

    // 페이백 회사/상담사 분담 (자동)
    const companyLimit = policy.payback_company_limit || 30000;
    const companyBurden = Math.min(payback, companyLimit);
    const agentDeduct = Math.max(0, payback - companyLimit);

    // 월별 납부 시뮬 (반값 기간 + 정상 기간)
    const halfMonths = (promo_type === 'half' && opt.half_fee && effectiveHalfPeriod) ? Math.min(effectiveHalfPeriod, opt.months) : 0;
    const normalMonths = opt.months - halfMonths;
    const halfTotal = halfMonths * (opt.half_fee || 0);
    const normalTotal = normalMonths * (opt.monthly_fee || 0);
    const totalPayment = halfTotal + normalTotal;
    const netCustomerBurden = totalPayment - payback;

    res.json({
      product, option: { ...opt, product: undefined },
      computed: {
        payback,
        point_weight: P,
        rebate,
        rebate_base: rebateBase,
        rebate_source: rebateSourceLabel,
        bundle_rate: bundleRate,
        rebate_after_tax: Math.round(rebate * 0.9),
        effective_monthly_fee: effectiveMonthlyFee,
        // 자동 분류 (옵션 단위, 정책 변경 즉시 반영)
        is_premium: isPremiumAuto,
        tier: finalTier,
        margin: finalMargin,
        is_premium_auto: isPremiumAuto,
        tier_auto: finalTier,
        margin_auto: finalMargin,
        option_margin: opt.margin ?? null,
        promo_type: promo_type || 'basic',
        bundle_apply: !!bundle_apply,
        payback_source: paybackSource,
        // 페이백 분담
        company_payback_burden: companyBurden,
        agent_payback_deduct: agentDeduct,
        // 월별 납부 시뮬
        half_months: halfMonths,
        half_total: halfTotal,
        normal_months: normalMonths,
        normal_total: normalTotal,
        total_payment: totalPayment,
        net_customer_burden: netCustomerBurden,
      },
      policy: {
        payback_company_limit: policy.payback_company_limit,
        payback_max: policy.payback_max,
        grade_rates: policy.grade_rates,
        grade_thresholds: policy.grade_thresholds,
        premium_margin_threshold: policy.premium_margin_threshold,
      },
    });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

// ─── 폐기됨 (Phase B): 페이백은 옵션마다 운영자가 수동 입력 ───
router.post('/recalculate-paybacks', authenticateJWT, async (req, res) => {
  res.status(410).json({ error: '폐기됨 — 페이백은 옵션마다 운영자가 수동 입력' });
});

// ─── 마진/Tier/우수상품만 일괄 재산출 (정책 임계값 변경 시) ───
router.post('/recalculate-margins', authenticateJWT, async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('rental_recalc_margins_and_premium');
    if (error) throw error;
    res.json({ ok: true, result: data });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

// ─── 본인 이번 달 가전렌탈 영업 합산 (누적 P · 우수 건수 자동) ───
router.get('/agents/me/monthly-stats', authenticateJWT, async (req, res) => {
  try {
    if (!req.user?.id) return res.json({ p: 0, premium_count: 0, sale_count: 0, grade: 'G1' });
    const { data: agent } = await supabase.from('incentive_agents').select('id').eq('user_id', req.user.id).single();
    if (!agent) return res.json({ p: 0, premium_count: 0, sale_count: 0, grade: 'G1' });
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;

    // 가전렌탈 + 인터넷+TV 동시 합산 (정책 공유 — 통합 Grade)
    const [rentalRes, itRes, rentalPolicyRes, itPolicyRes] = await Promise.all([
      supabase.from('rental_sales')
        .select('id, point_weight_snapshot, product:rental_products(is_premium)')
        .eq('agent_id', agent.id).gte('contract_date', monthStart)
        .is('deleted_at', null).in('status', ['pending','in_progress','completed']),
      supabase.from('incentive_sales')
        .select('id, point_weight_snapshot, is_premium_snapshot')
        .eq('agent_id', agent.id).gte('contract_date', monthStart)
        .is('deleted_at', null).in('status', ['pending','in_progress','completed']),
      supabase.from('rental_policy')
        .select('grade_thresholds, grade_rates, bonus_per_premium')
        .eq('active', true).single(),
      supabase.from('incentive_rules')
        .select('grade_thresholds, grade_rates, bonus_per_premium')
        .eq('active', true).order('effective_from', { ascending: false }).limit(1).single(),
    ]);

    const rentalSales = rentalRes.data || [];
    const itSales = itRes.data || [];

    let rentalP = 0, rentalPrem = 0;
    rentalSales.forEach(s => {
      rentalP += Number(s.point_weight_snapshot || 0);
      if (s.product?.is_premium) rentalPrem++;
    });
    let itP = 0, itPrem = 0;
    itSales.forEach(s => {
      itP += Number(s.point_weight_snapshot || 0);
      if (s.is_premium_snapshot) itPrem++;
    });

    const totalP = rentalP + itP;
    const totalPrem = rentalPrem + itPrem;

    // Grade 자동 결정 — incentive_rules 통일 구조 (grade_thresholds JSON)
    const gth = rentalPolicyRes.data?.grade_thresholds || {};
    const g2P = Number(gth?.G2?.points ?? 16);
    const g2Prem = Number(gth?.G2?.premium ?? 5);
    const g3P = Number(gth?.G3?.points ?? 31);
    const g3Prem = Number(gth?.G3?.premium ?? 10);
    let grade = 'G1';
    if (totalP >= g3P && totalPrem >= g3Prem) grade = 'G3';
    else if (totalP >= g2P && totalPrem >= g2Prem) grade = 'G2';

    // 양쪽 정책 단가 (Phase D 통합 인센티브 미리보기용)
    const rentalRates = rentalPolicyRes.data?.grade_rates || { 1: 15000, 2: 22000, 3: 30000 };
    const itRates = itPolicyRes.data?.grade_rates || { 1: 20000, 2: 30000, 3: 40000 };
    const _gKey = grade === 'G3' ? '3' : grade === 'G2' ? '2' : '1';
    const rentalUnit = Number(rentalRates[_gKey] ?? rentalRates[Number(_gKey)]) || 15000;
    const itUnit = Number(itRates[_gKey] ?? itRates[Number(_gKey)]) || 20000;
    const rentalBonusPer = Number(rentalPolicyRes.data?.bonus_per_premium) || 10000;
    const itBonusPer = Number(itPolicyRes.data?.bonus_per_premium) || 10000;
    const rentalIncentive = Math.round(rentalP * rentalUnit);
    const itIncentive = Math.round(itP * itUnit);
    const rentalBonus = rentalPrem * rentalBonusPer;
    const itBonus = itPrem * itBonusPer;

    res.json({
      // 가전렌탈만
      p: Number(rentalP.toFixed(2)),
      premium_count: rentalPrem,
      sale_count: rentalSales.length,
      rental_unit: rentalUnit,
      rental_incentive: rentalIncentive,
      rental_bonus: rentalBonus,
      // 인터넷+TV만
      it_p: Number(itP.toFixed(2)),
      it_premium: itPrem,
      it_unit: itUnit,
      it_incentive: itIncentive,
      it_bonus: itBonus,
      // 통합 (Grade 결정용 + 합산 표시)
      combined_p: Number(totalP.toFixed(2)),
      combined_premium: totalPrem,
      combined_incentive: rentalIncentive + itIncentive,
      combined_bonus: rentalBonus + itBonus,
      combined_total: rentalIncentive + itIncentive + rentalBonus + itBonus,
      grade,
      grade_thresholds: { 2: { points: g2P, premium: g2Prem }, 3: { points: g3P, premium: g3Prem } },
      rental_rates: rentalRates,
      it_rates: itRates,
      month_start: monthStart,
    });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

// ─── 영업 접수 (rental_sales INSERT) ───
router.post('/sales', authenticateJWT, async (req, res) => {
  try {
    const {
      product_id, option_id, payback,
      customer_id, customer_name, customer_phone, customer_address, resident_id,
      installation_date, db_source_id, dealer_id, notes,
      // 확장 필드
      customer_type, resident_id_back,
      business_name, business_no, representative_name, corporation_no,
      phone_secondary, phone_secondary_type,
      address_detail, happy_call_time, rental_company_note,
      tags, add_payback,
    } = req.body;
    if (!product_id || !option_id) return res.status(400).json({ error: 'product_id, option_id 필수' });

    // snapshot 박제 (마진/Tier 계산 제거 — 운영자 수동 입력 시대)
    const [{ data: opt }, { data: policy }] = await Promise.all([
      supabase.from('rental_product_options').select('*, product:rental_products(*)').eq('id', option_id).single(),
      supabase.from('rental_policy').select('*').eq('active', true).single(),
    ]);
    if (!opt || !policy) return res.status(404).json({ error: '옵션/정책 없음' });
    const product = opt.product;
    const P = Number(opt.point_weight ?? product.point_weight) || 0;  // 옵션 단위 P 우선 (NULL이면 product fallback)

    // 페이백 회사/상담사 분담 자동
    const companyLimit = policy.payback_company_limit || 30000;
    const finalPayback = payback != null ? Number(payback) : (opt.payback || 0);
    const companyBurden = Math.min(finalPayback, companyLimit);
    const agentDeduct = Math.max(0, finalPayback - companyLimit);

    const insert = {
      product_id, option_id,
      customer_id: customer_id || null,
      customer_name: customer_name || null,
      customer_phone: customer_phone || null,
      customer_address: customer_address || null,
      resident_id: resident_id || null,
      installation_date: installation_date || null,
      db_source_id: db_source_id || null,
      dealer_id: dealer_id || null,
      notes: notes || null,
      // 확장
      customer_type: customer_type || null,
      resident_id_back: resident_id_back || null,
      business_name: business_name || null,
      business_no: business_no || null,
      representative_name: representative_name || null,
      corporation_no: corporation_no || null,
      phone_secondary: phone_secondary || null,
      phone_secondary_type: phone_secondary_type || null,
      address_detail: address_detail || null,
      happy_call_time: happy_call_time || null,
      rental_company_note: rental_company_note || null,
      tags: Array.isArray(tags) && tags.length ? tags : null,
      add_payback: add_payback != null ? Number(add_payback) : 0,
      status: 'pending',
      contract_date: new Date().toISOString().slice(0,10),
      contract_pending_at: new Date().toISOString(),
      rebate_snapshot: opt.rebate,
      payback_snapshot: finalPayback,
      point_weight_snapshot: P,
      monthly_fee_snapshot: opt.monthly_fee,
      months_snapshot: opt.months,
      care_service_snapshot: opt.care_service,
      is_premium_snapshot: !!product.is_premium,
      company_payback_burden: companyBurden,
      agent_payback_deduct: agentDeduct,
    };
    // agent_id 매핑
    if (req.user?.id) {
      const { data: agent } = await supabase.from('incentive_agents').select('id').eq('user_id', req.user.id).single();
      if (agent) insert.agent_id = agent.id;
    }
    const { data, error } = await supabase.from('rental_sales').insert(insert).select().single();
    if (error) throw error;
    res.json({ sale: data });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

// ─── 영업 단건 PATCH (상세 모달 저장) ───
router.patch('/sales/:id', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'id 필수' });

    // 화이트리스트 (snapshot·agent_id·계산값·*_at 자동 컬럼은 제외)
    const ALLOWED = [
      'customer_name','customer_phone','customer_address','customer_email','resident_id',
      'installation_date','status','notes','contract_notes',
      'db_source_id','dealer_id','contract_date','activation_date','cancellation_reason',
      'customer_type','resident_id_back',
      'business_name','business_no','representative_name','corporation_no',
      'phone_secondary','phone_secondary_type','address_detail','happy_call_time',
      'rental_company_note','tags','add_payback','gift_received',
      'bank_name','bank_account_holder','bank_account_number',
      'waiting_relation','waiting_person','waiting_phone','seller_phone',
      'billing_method','billing_phone','billing_carrier',
    ];
    const patch = {};
    for (const k of ALLOWED) {
      if (req.body[k] !== undefined) patch[k] = req.body[k] === '' ? null : req.body[k];
    }
    if (patch.add_payback != null) patch.add_payback = Number(patch.add_payback) || 0;
    if (Array.isArray(patch.tags) && patch.tags.length === 0) patch.tags = null;

    // 상태 변경 시 *_at 타임스탬프 자동 기록
    if (patch.status) {
      const now = new Date().toISOString();
      const stampMap = {
        pending: 'contract_pending_at',
        in_progress: 'contract_in_progress_at',
        completed: 'contract_completed_at',
        cancelled: 'contract_cancelled_at',
      };
      const col = stampMap[patch.status];
      if (col) patch[col] = now;
    }
    patch.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('rental_sales').update(patch).eq('id', id)
      .select('*, product:rental_products(brand, name, model, category_id), option:rental_product_options(months, care_service, rebate, payback, ticket_number)')
      .single();
    if (error) throw error;
    res.json({ sale: data });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

// ─── 월간 정산 RPC (인터넷+TV와 동일 패턴, rental 도메인) ───
router.get('/settlement', authenticateJWT, async (req, res) => {
  try {
    const { agent_id, year_month } = req.query;
    if (!agent_id || !year_month) return res.status(400).json({ error: 'agent_id, year_month 필수' });
    const { data, error } = await supabase.rpc('rental_calc_monthly_settlement', {
      p_agent_id: agent_id,
      p_year_month: year_month,
    });
    if (error) throw error;
    res.json({ settlement: data });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

// ─── 영업 목록 (담당자 또는 admin) ───
router.get('/sales', authenticateJWT, async (req, res) => {
  try {
    const { status, agent_id, limit = 100 } = req.query;
    let q = supabase
      .from('rental_sales')
      .select('*, product:rental_products(*), option:rental_product_options(months, care_service, rebate, payback, monthly_fee, normal_price, ticket_number, ticket_active), agent:incentive_agents(id, name, center)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(Number(limit) || 100);
    if (status) q = q.eq('status', status);
    if (agent_id) q = q.eq('agent_id', agent_id);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ sales: data || [] });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

export default router;
