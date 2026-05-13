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
      .eq('is_active', true)
      .single();
    if (error) throw error;
    res.json({ policy: data });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

// ─── 정책 변경 (admin 전용) ───
router.patch('/policy', authenticateJWT, async (req, res) => {
  try {
    const { id, ...fields } = req.body;
    if (!id) return res.status(400).json({ error: 'policy id 필수' });
    // 변경 이력 — 기존 값 가져오기
    const { data: oldPolicy } = await supabase.from('rental_policy').select('*').eq('id', id).single();
    const changedFields = {};
    for (const [k, v] of Object.entries(fields)) {
      if (oldPolicy && oldPolicy[k] != null && String(oldPolicy[k]) !== String(v)) {
        changedFields[k] = { old: oldPolicy[k], new: v };
      } else if (oldPolicy && oldPolicy[k] == null && v != null) {
        changedFields[k] = { old: null, new: v };
      }
    }
    const update = { ...fields, updated_at: new Date().toISOString() };
    delete update.id;
    delete update.created_at;
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
        change_reason: fields.change_reason || null,
      });
    }
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
      'payback', 'point_weight_adj', 'is_active', 'margin', 'tier_calculated',
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
      supabase.from('rental_policy').select('*').eq('is_active', true).single(),
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
      // 반값 + 타사보상 조합 등은 복합. 일단 기본 적용 + 라벨 표시.
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

    // 가중치 P
    // ─── 단순화 공식 (인터넷+TV와 동일) ───
    // P = 상품 point_weight 고정 (약정·케어·우수 보정 제거)
    const P = Number(product.point_weight) || 0;
    const weightCost = Math.round(P * (policy.weight_cost_per_p || 70000));

    // 페이백 = 옵션 DB의 값 (어드민에서 일괄 산출 또는 수동 입력)
    const payback = payback_override != null ? Number(payback_override) : (opt.payback || 0);
    const paybackSource = payback_override != null ? 'override' : 'admin';

    // margin = rebate × 0.9 − payback − P × weight_cost_per_p
    const margin = Math.round(rebate * 0.9 - payback - weightCost);
    const profitRate = rebate ? margin / rebate : 0;
    let tier = 'C';
    if (margin >= policy.tier_s_min_margin) tier = 'S';
    else if (margin >= policy.tier_a_min_margin) tier = 'A';
    else if (margin >= policy.tier_b_min_margin) tier = 'B';

    // 월별 납부 시뮬 (반값 기간 + 정상 기간)
    const halfMonths = (promo_type === 'half' && opt.half_fee && effectiveHalfPeriod) ? Math.min(effectiveHalfPeriod, opt.months) : 0;
    const normalMonths = opt.months - halfMonths;
    const halfTotal = halfMonths * (opt.half_fee || 0);
    const normalTotal = normalMonths * (opt.monthly_fee || 0);
    const totalPayment = halfTotal + normalTotal;
    const netCustomerBurden = totalPayment - payback;

    // 상담사 인센티브 (1건 · Grade별)
    const incentiveG1 = Math.round(P * policy.grade_g1_unit);
    const incentiveG2 = Math.round(P * policy.grade_g2_unit);
    const incentiveG3 = Math.round(P * policy.grade_g3_unit);

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
        weight_cost: weightCost,
        base_salary_share: 0,
        signup_bonus: 0,
        margin,
        profit_rate: Number(profitRate.toFixed(4)),
        tier,
        promo_type: promo_type || 'basic',
        bundle_apply: !!bundle_apply,
        payback_source: paybackSource,
        // 월별 납부 시뮬
        half_months: halfMonths,
        half_total: halfTotal,
        normal_months: normalMonths,
        normal_total: normalTotal,
        total_payment: totalPayment,
        net_customer_burden: netCustomerBurden,
        // 상담사 인센티브 시뮬
        incentive_g1: incentiveG1,
        incentive_g2: incentiveG2,
        incentive_g3: incentiveG3,
      },
      policy: {
        target_profit_rate: policy.target_profit_rate,
        grade_g1_unit: policy.grade_g1_unit,
        grade_g2_unit: policy.grade_g2_unit,
        grade_g3_unit: policy.grade_g3_unit,
      },
    });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

// ─── 영업이익율 기준 전체 옵션 페이백 일괄 재산출 (admin) ───
router.post('/recalculate-paybacks', authenticateJWT, async (req, res) => {
  try {
    const { only_auto = true } = req.body;
    // 단순화 페이백 산출: payback = rebate × (0.9 - target_profit_rate) − P × weight_cost_per_p
    // (가입보너스·기본급분담 차감 제거 — 인터넷+TV 통일)
    const calcExpr = `GREATEST(0, LEAST(
      (SELECT payback_cap FROM rental_policy WHERE is_active = true),
      ROUND(ROUND(
        o.rebate * (0.9 - COALESCE((SELECT target_profit_rate FROM rental_policy WHERE is_active = true),10)/100.0)
        - p.point_weight * COALESCE((SELECT weight_cost_per_p FROM rental_policy WHERE is_active = true),70000)
      ) / 10000.0)::int * 10000))`;
    const sql = only_auto
      ? `UPDATE rental_product_options o SET payback = ${calcExpr} FROM rental_products p WHERE o.product_id = p.id AND o.payback IS NULL`
      : `UPDATE rental_product_options o SET payback = ${calcExpr} FROM rental_products p WHERE o.product_id = p.id`;
    const { error } = await supabase.rpc('exec_sql', { sql_text: sql });
    if (error) throw error;
    // 체인 — 마진/Tier/우수상품 자동 재산출
    const { data: recalc, error: recalcErr } = await supabase.rpc('rental_recalc_margins_and_premium');
    if (recalcErr) console.warn('[recalc-margins]', recalcErr.message);
    const { count } = await supabase.from('rental_product_options').select('*', { count: 'exact', head: true }).not('payback', 'is', null);
    res.json({
      ok: true,
      updated_target: only_auto ? 'NULL 페이백만' : '전체',
      count_with_payback: count,
      margin_tier_recalc: recalc || null,
    });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
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
    const [rentalRes, itRes, rentalPolicyRes] = await Promise.all([
      supabase.from('rental_sales')
        .select('id, point_weight_snapshot, product:rental_products(is_premium)')
        .eq('agent_id', agent.id).gte('contract_date', monthStart)
        .is('deleted_at', null).in('status', ['pending','in_progress','completed']),
      supabase.from('incentive_sales')
        .select('id, point_weight_snapshot, is_premium_snapshot')
        .eq('agent_id', agent.id).gte('contract_date', monthStart)
        .is('deleted_at', null).in('status', ['pending','in_progress','completed']),
      supabase.from('rental_policy')
        .select('grade_g2_p_threshold, grade_g2_premium_threshold, grade_g3_p_threshold, grade_g3_premium_threshold')
        .eq('is_active', true).single(),
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

    // Grade 자동 결정 (rental_policy 임계값 사용 — 가전렌탈 별도 정책)
    const rp = rentalPolicyRes.data || {};
    const g2P = Number(rp.grade_g2_p_threshold ?? 16);
    const g2Prem = Number(rp.grade_g2_premium_threshold ?? 5);
    const g3P = Number(rp.grade_g3_p_threshold ?? 31);
    const g3Prem = Number(rp.grade_g3_premium_threshold ?? 10);
    let grade = 'G1';
    if (totalP >= g3P && totalPrem >= g3Prem) grade = 'G3';
    else if (totalP >= g2P && totalPrem >= g2Prem) grade = 'G2';

    res.json({
      // 가전렌탈만
      p: Number(rentalP.toFixed(2)),
      premium_count: rentalPrem,
      sale_count: rentalSales.length,
      // 통합 (Grade 결정용)
      combined_p: Number(totalP.toFixed(2)),
      combined_premium: totalPrem,
      it_p: Number(itP.toFixed(2)),
      it_premium: itPrem,
      grade,
      grade_thresholds: { 2: { points: g2P, premium: g2Prem }, 3: { points: g3P, premium: g3Prem } },
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

    // 견적 재계산하여 snapshot 보장
    const [{ data: opt }, { data: policy }] = await Promise.all([
      supabase.from('rental_product_options').select('*, product:rental_products(*)').eq('id', option_id).single(),
      supabase.from('rental_policy').select('*').eq('is_active', true).single(),
    ]);
    if (!opt || !policy) return res.status(404).json({ error: '옵션/정책 없음' });
    const product = opt.product;
    const finalPayback = payback != null ? Number(payback) : (opt.payback || 0);
    // 단순화 (인터넷+TV와 동일): P = 상품 point_weight 고정
    const P = Number(product.point_weight) || 0;
    const weightCost = Math.round(P * (policy.weight_cost_per_p || 70000));
    const margin = Math.round(opt.rebate * 0.9 - finalPayback - weightCost);
    let tier = 'C';
    if (margin >= policy.tier_s_min_margin) tier = 'S';
    else if (margin >= policy.tier_a_min_margin) tier = 'A';
    else if (margin >= policy.tier_b_min_margin) tier = 'B';

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
      signup_bonus_snapshot: policy.signup_bonus_per_sale,
      margin_snapshot: margin,
      tier_snapshot: tier,
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

// ─── 영업 목록 (담당자 또는 admin) ───
router.get('/sales', authenticateJWT, async (req, res) => {
  try {
    const { status, agent_id, limit = 100 } = req.query;
    let q = supabase
      .from('rental_sales')
      .select('*, product:rental_products(brand, name, model, category_id), option:rental_product_options(months, care_service, rebate, payback)')
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
