// ═══════════════════════════════════════════════════════════════
// 가전렌탈 라우트 — 카테고리·상품·옵션·정책·영업·빌리고 import
// ═══════════════════════════════════════════════════════════════
import { Router } from 'express';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import multer from 'multer';
import { supabase } from '../db/supabase.js';
import { authenticateJWT, optionalAuth } from '../middleware/auth.js';
import { parseBilligoRentalExcel } from '../services/billigo-rental-parser.js';
import { parseBilligoGajeonExcel } from '../services/billigo-gajeon-parser.js';

const router = Router();
const _isProd = process.env.NODE_ENV === 'production';
const errMsg = (e) => _isProd ? '서버 오류 — 잠시 후 다시 시도하세요' : (e?.message || '서버 오류');

// 빌리고 엑셀 업로드 — 메모리 저장 (xlsx 8천행은 메모리로 충분), .xlsx 한정 30MB
const billigoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /\.xlsx$/i.test(file.originalname || '');
    cb(ok ? null : new Error('xlsx 파일만 업로드 가능'), ok);
  },
});

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

// ─── 카테고리 ───
// ?include_inactive=1 — 어드민 상품관리용 (비활성 카테고리도 포함). 기본은 활성만.
// 각 카테고리에 product_count 포함 — 어드민 필터가 데이터 있는 카테고리만 노출하도록.
router.get('/categories', optionalAuth, async (req, res) => {
  try {
    let q = supabase
      .from('rental_categories')
      .select('*, rental_products(count)')
      .order('sort_order', { ascending: true });
    if (req.query.include_inactive !== '1') q = q.eq('is_active', true);
    const { data, error } = await q;
    if (error) throw error;
    const categories = (data || []).map(c => {
      const product_count = c.rental_products?.[0]?.count || 0;
      delete c.rental_products;
      return { ...c, product_count };
    });
    res.json({ categories });
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
    // notes 누적 escape 디코드 (2026-05-18 fix)
    if (update.notes !== undefined) update.notes = normalizeNotes(update.notes);

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
    // notes 누적 escape 디코드 (2026-05-18 fix)
    if (insert.notes !== undefined) insert.notes = normalizeNotes(insert.notes);
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
    let categoryId = null;
    if (category) {
      const { data: cat } = await supabase.from('rental_categories').select('id').eq('slug', category).single();
      if (!cat) return res.json({ products: [] });
      categoryId = cat.id;
    }
    // PostgREST max-rows(1000) 서버 cap 회피 — 1000행씩 페이지 누적 (가전 에어컨 1.7천·냉장고 1.3천)
    const PAGE = 1000;
    const products = [];
    for (let from = 0; ; from += PAGE) {
      let q = supabase
        .from('rental_products')
        .select('*, category:rental_categories(slug, name, metadata)')
        .order('brand', { ascending: true })
        .order('model', { ascending: true })
        .range(from, from + PAGE - 1);
      if (active_only === '1') q = q.eq('is_active', true);
      if (categoryId != null) q = q.eq('category_id', categoryId);
      if (brand) q = q.eq('brand', brand);
      const { data, error } = await q;
      if (error) throw error;
      products.push(...(data || []));
      if (!data || data.length < PAGE) break;
    }
    res.json({ products });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

// ─── 상품 + 옵션 함께 조회 (계산기에서 1회 호출용) ───
router.get('/products/:id/options', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const [{ data: product }, { data: options }] = await Promise.all([
      supabase.from('rental_products').select('*, category:rental_categories(slug, name, metadata)').eq('id', id).single(),
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
    // 우수 = S Tier만 (단순화 — premium_margin_threshold 무관)
    const isPremiumAuto = (finalTier === 'S');
    product.is_premium = isPremiumAuto;
    product.tier = finalTier;

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
      rental_bonus_per: rentalBonusPer,
      rental_incentive: rentalIncentive,
      rental_bonus: rentalBonus,
      // 인터넷+TV만
      it_p: Number(itP.toFixed(2)),
      it_premium: itPrem,
      it_unit: itUnit,
      it_bonus_per: itBonusPer,
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
    const { status, agent_id, limit = 500, deleted } = req.query;
    let q = supabase
      .from('rental_sales')
      .select('*, product:rental_products(*), option:rental_product_options(months, care_service, rebate, payback, monthly_fee, normal_price, ticket_number, ticket_active), agent:incentive_agents(id, name, center)')
      .order('created_at', { ascending: false })
      .limit(Number(limit) || 500);
    if (deleted === '1' || deleted === 'true') {
      q = q.not('deleted_at', 'is', null);
    } else {
      q = q.is('deleted_at', null);
    }
    if (status) q = q.eq('status', status);
    if (agent_id) q = q.eq('agent_id', agent_id);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ sales: data || [] });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

// ═══════════════════════════════════════════════════════════════
// 빌리고 엑셀 import (admin 전용) — PRD §5 워크플로
//   POST /api/rental/import/preview  : 업로드·파싱·diff·batch 생성
//   POST /api/rental/import/commit   : 캐시된 파싱결과를 DB 에 UPSERT 반영
//
// Phase 2 = 정수기 파일만 (file_type='정수기' 고정).
//
// ⚠️ 봉이 인센티브 컬럼(point_weight·point_weight_adj·tier·tier_calculated·
//    margin·net_profit·is_premium·ticket_number·ticket_active)은 import 가
//    절대 덮어쓰지 않는다 — UPSERT 시 빌리고 필드만 골라 갱신한다.
// ═══════════════════════════════════════════════════════════════

// ─── 파싱결과 메모리 캐시 (preview→commit 재사용, TTL 15분) ───
const _importCache = new Map();   // batch_id → { parsed, year_month, filename, createdAt }
const IMPORT_CACHE_TTL = 15 * 60 * 1000;

function _pruneImportCache() {
  const now = Date.now();
  for (const [k, v] of _importCache.entries()) {
    if (now - v.createdAt > IMPORT_CACHE_TTL) _importCache.delete(k);
  }
}

// 봉이 정수기계열 카테고리 — 기존 DB diff/단종 마킹 대상 범위 한정
const PURIFIER_CATEGORY_SLUGS = ['water-purifier', 'ice-purifier', 'hotcold-purifier'];

// 옵션 자연키 정규화 헬퍼 — 파서 naturalKey(withVariant=true) 와 동일 규칙으로
// 기존 DB 행의 키를 만든다 (company_name 대신 product_id 기준).
function optionDbKey(productId, o) {
  const care = o.care_service ?? '';
  const insp = o.inspection_cycle == null ? -1 : o.inspection_cycle;
  const own = o.ownership_months == null ? -1 : o.ownership_months;
  const variant = o.variant_code ?? '';
  return [productId, o.months, care, insp, own, variant].join('|');
}

// ⚠️ 정수 컬럼 강제 변환 — 파서 toNum() 은 소수점 2자리(Math.round(v*100)/100)를
//   반환하므로, monthly_fee·half_fee·inspection_cycle·ownership_months·half_period·
//   months 같은 integer 컬럼에 소수가 들어가면 postgres 가
//   "invalid input syntax for type integer" 로 INSERT 청크 전체를 거부한다.
//   → 정수 컬럼은 반드시 반올림 정수로 강제한다. null/NaN 은 null 유지.
function toInt(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

// admin 가드 — rental import 는 admin 전용
// incentive role 은 JWT 가 아니라 incentive_agents 테이블에 있다 (rental.js 기존 패턴)
async function requireAdmin(req, res) {
  if (!req.user?.id) {
    res.status(401).json({ error: 'unauthorized' });
    return false;
  }
  const { data: agent } = await supabase
    .from('incentive_agents').select('role').eq('user_id', req.user.id).single();
  if (!agent || agent.role !== 'admin') {
    res.status(403).json({ error: 'admin 전용' });
    return false;
  }
  return true;
}

// Supabase chunk UPSERT — 8천행 규모는 200건씩 끊어 실행.
// 청크별 try/catch 로 어느 청크·행에서 실패했는지 에러 메시지에 박제한다.
async function chunkedUpsert(table, rows, options) {
  const SIZE = options?.chunkSize || 200;
  const out = [];
  for (let i = 0; i < rows.length; i += SIZE) {
    const slice = rows.slice(i, i + SIZE);
    const chunkNo = Math.floor(i / SIZE) + 1;
    try {
      const { data, error } = await supabase
        .from(table)
        .upsert(slice, options)
        .select(options?.selectCols || '*');
      if (error) throw error;
      if (data) out.push(...data);
    } catch (e) {
      const msg = e?.message || String(e);
      throw new Error(
        `[chunkedUpsert ${table}] chunk#${chunkNo} (rows ${i}~${i + slice.length - 1}) 실패: ${msg}`,
      );
    }
  }
  return out;
}

// ─── POST /api/rental/import/preview ───
router.post('/import/preview', authenticateJWT, billigoUpload.single('file'), async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  let tmpPath = null;
  try {
    if (!req.file) return res.status(400).json({ error: '파일 첨부 필수 (.xlsx)' });
    const yearMonth = String(req.body.year_month || '').trim();
    if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
      return res.status(400).json({ error: 'year_month 형식 오류 (예: 2026-05)' });
    }
    const fileType = req.body.file_type === '가전' ? '가전' : '정수기';

    // 임시 파일 저장 후 파서 호출 (파서는 경로/Buffer 모두 지원하나 경로 우선)
    tmpPath = path.join(os.tmpdir(), `billigo-${randomUUID()}.xlsx`);
    fs.writeFileSync(tmpPath, req.file.buffer);

    let parsed;
    try {
      parsed = fileType === '가전'
        ? parseBilligoGajeonExcel(tmpPath)
        : parseBilligoRentalExcel(tmpPath);
    } catch (e) {
      return res.status(400).json({ error: '엑셀 파싱 실패' + (_isProd ? '' : ': ' + (e?.message || '')) });
    }

    const { companies, products, options, keyCollisions, warnings } = parsed;
    const sheetNames = parsed.bySheet ? Object.keys(parsed.bySheet) : [];

    // ── 기존 DB 정수기계열 상품·옵션 로드 (company 매칭용) ──
    // 1) rental_companies — name → id
    const { data: dbCompanies, error: cErr } = await supabase
      .from('rental_companies')
      .select('id, name');
    if (cErr) throw cErr;
    const companyIdByName = new Map((dbCompanies || []).map((c) => [c.name, c.id]));

    // 2) 정수기계열 카테고리 id 집합
    const { data: catRows, error: catErr } = await supabase
      .from('rental_categories')
      .select('id, slug')
      .in('slug', PURIFIER_CATEGORY_SLUGS);
    if (catErr) throw catErr;
    const purifierCatIds = new Set((catRows || []).map((c) => c.id));

    // 3) 기존 정수기계열 상품 — company_id + model 매칭키
    //    company_id 가 있으면 company 매칭, 없으면 category 로 범위 한정.
    const { data: dbProducts, error: pErr } = await supabase
      .from('rental_products')
      .select('id, company_id, model, name, manufacturer, model_key, category_id, billigo_status, brand');
    if (pErr) throw pErr;
    // 정수기계열만 — company 가 정수기메이커 그룹이거나 category 가 정수기계열
    const purifierCompanyIds = new Set(
      (dbCompanies || [])
        .filter((c) => companies.some((pc) => pc.name === c.name))
        .map((c) => c.id),
    );
    const existingProducts = (dbProducts || []).filter(
      (p) => (p.company_id && purifierCompanyIds.has(p.company_id))
          || (p.category_id && purifierCatIds.has(p.category_id)),
    );
    const productByKey = new Map();   // `${company_id}|${model}` → product row
    for (const p of existingProducts) {
      if (p.company_id) productByKey.set(`${p.company_id}|${p.model}`, p);
    }

    // 4) 기존 옵션 (위 정수기계열 상품의 옵션) — 자연키 매칭용
    const existingProductIds = existingProducts.map((p) => p.id);
    let dbOptions = [];
    if (existingProductIds.length) {
      for (let i = 0; i < existingProductIds.length; i += 200) {
        const slice = existingProductIds.slice(i, i + 200);
        const { data, error } = await supabase
          .from('rental_product_options')
          .select('id, product_id, months, care_service, inspection_cycle, ownership_months, variant_code')
          .in('product_id', slice);
        if (error) throw error;
        if (data) dbOptions.push(...data);
      }
    }
    const optionKeySet = new Set(dbOptions.map((o) => optionDbKey(o.product_id, o)));

    // ── diff 계산 ──
    // 상품: 파서 product 의 company 를 DB company_id 로 환산 후 (company_id|model) 매칭
    let productsNew = 0, productsUpdated = 0;
    const parsedProductKeys = new Set();
    for (const p of products) {
      const cid = companyIdByName.get(p.company_name);
      if (cid != null) {
        const key = `${cid}|${p.model}`;
        parsedProductKeys.add(key);
        if (productByKey.has(key)) productsUpdated++;
        else productsNew++;
      } else {
        // company 가 아직 DB 에 없으면 전부 신규
        productsNew++;
      }
    }
    // 단종: 기존 정수기 상품 중 이번 파싱에 없는 것
    let productsDiscontinued = 0;
    for (const p of existingProducts) {
      if (p.company_id) {
        const key = `${p.company_id}|${p.model}`;
        if (!parsedProductKeys.has(key)) productsDiscontinued++;
      }
    }

    // 옵션: 자연키 매칭. product_id 를 모르는 신규 상품 옵션은 모두 신규.
    let optionsNew = 0, optionsUpdated = 0;
    for (const o of options) {
      const cid = companyIdByName.get(o.company_name);
      const prod = cid != null ? productByKey.get(`${cid}|${o.model}`) : null;
      if (!prod) { optionsNew++; continue; }
      const key = optionDbKey(prod.id, o);
      if (optionKeySet.has(key)) optionsUpdated++;
      else optionsNew++;
    }

    // ── rental_import_batches INSERT (status='preview') ──
    const batchInsert = {
      year_month: yearMonth,
      file_type: fileType,
      source_filename: req.file.originalname || 'billigo.xlsx',
      sheet_count: sheetNames.length,
      row_count: options.length,
      upsert_new: 0,
      upsert_updated: 0,
      marked_discontinued: 0,
      status: 'preview',
      imported_by: req.user?.id || null,   // uuid 컬럼 — auth user id
      imported_at: new Date().toISOString(),
    };
    const { data: batch, error: bErr } = await supabase
      .from('rental_import_batches')
      .insert(batchInsert)
      .select()
      .single();
    if (bErr) throw bErr;

    // ── 파싱결과 메모리 캐시 (commit 때 재사용) ──
    _pruneImportCache();
    _importCache.set(batch.id, {
      parsed,
      year_month: yearMonth,
      file_type: fileType,
      filename: batchInsert.source_filename,
      createdAt: Date.now(),
    });

    res.json({
      batch_id: batch.id,
      summary: {
        companies: companies.length,
        products_new: productsNew,
        products_updated: productsUpdated,
        products_discontinued: productsDiscontinued,
        options_total: options.length,
        options_new: optionsNew,
        options_updated: optionsUpdated,
      },
      sample: options.slice(0, 20),
      warnings: warnings || null,
      key_collisions: keyCollisions ?? 0,
    });
  } catch (e) {
    res.status(500).json({ error: errMsg(e) });
  } finally {
    if (tmpPath) { try { fs.unlinkSync(tmpPath); } catch { /* noop */ } }
  }
});

// ─── 실제 UPSERT 로직 — commit 응답 후 백그라운드에서 실행 ───
// Cloudflare 100초(524) 회피: HTTP 응답은 즉시 반환하고, 8천행 UPSERT 는
// 여기서 await 없이 돌린다. 진행도는 rental_import_batches 컬럼으로 폴링.
async function runImportCommit(batch_id, parsed) {
  const { companies, products, options } = parsed;

  // ─── 1. rental_companies UPSERT (name 기준) ───
  // 기존 행은 그대로 두고, 없는 회사만 INSERT (commission 설정은 별도 화면에서 편집).
  const { data: dbCompanies0, error: c0Err } = await supabase
    .from('rental_companies')
    .select('id, name');
  if (c0Err) throw c0Err;
  const companyIdByName = new Map((dbCompanies0 || []).map((c) => [c.name, c.id]));
  const newCompanies = companies
    .filter((c) => !companyIdByName.has(c.name))
    .map((c) => ({
      name: c.name,
      category_group: c.category_group || '정수기메이커',
      is_active: true,
    }));
  if (newCompanies.length) {
    const inserted = await chunkedUpsert('rental_companies', newCompanies, {
      onConflict: 'name',
      ignoreDuplicates: false,
      selectCols: 'id, name',
    });
    for (const c of inserted) companyIdByName.set(c.name, c.id);
  }

  // ─── 카테고리 slug → id 매핑 ───
  const { data: allCats, error: catErr } = await supabase
    .from('rental_categories')
    .select('id, slug');
  if (catErr) throw catErr;
  const catIdBySlug = new Map((allCats || []).map((c) => [c.slug, c.id]));

  // ─── 2. rental_products UPSERT — 매칭키 (company_id, model) ───
  const { data: dbProducts, error: pErr } = await supabase
    .from('rental_products')
    .select('id, company_id, model, category_id, billigo_status');
  if (pErr) throw pErr;
  const productRowByKey = new Map();   // `${company_id}|${model}` → row
  for (const p of dbProducts || []) {
    if (p.company_id != null) productRowByKey.set(`${p.company_id}|${p.model}`, p);
  }

  let prodNew = 0, prodUpdated = 0;
  // 신규/기존 구분 없이 한 배열에 모아 chunkedUpsert 1회 처리.
  // ⚠️ upsert 행에는 빌리고 필드만 담는다 — 봉이 인센티브 컬럼
  //    (point_weight·tier·margin·net_profit·is_premium·ticket_number·ticket_active)은
  //    행 객체에 포함하지 않으므로 upsert 가 해당 컬럼은 SET 하지 않아 기존값 보존.
  //
  // ★ (company_id, model) DEDUP 필수 — 파서가 쿠쿠 침대세트류(CP-AJS801SW 등 6개)를
  //    같은 (company, model) 로 2번 만든다. 중복 행 2건이 같은 upsert 청크에 들어가면
  //    postgres 가 "ON CONFLICT DO UPDATE command cannot affect row a second time" 로
  //    청크 전체를 거부한다 → upsert 전에 반드시 키 단위로 dedup (뒤 행 우선).
  const productRowMap = new Map();   // `${cid}|${model}` → upsert row (last-wins)
  for (const p of products) {
    const cid = companyIdByName.get(p.company_name);
    if (cid == null) continue;   // company 매핑 실패분은 skip (warnings 로 노출됨)
    const key = `${cid}|${p.model}`;
    const categoryId = p.category_slug ? (catIdBySlug.get(p.category_slug) ?? null) : null;
    const existing = productRowByKey.get(key);
    productRowMap.set(key, {
      company_id: cid,
      model: p.model,
      name: p.name,
      brand: p.company_name,
      manufacturer: p.manufacturer ?? null,
      model_key: p.model_key ?? null,
      category_id: categoryId,
      source_batch_id: batch_id,
      billigo_status: existing
        ? (existing.billigo_status === '신규' ? '신규' : '변경')
        : '신규',
      is_active: true,
      updated_at: new Date().toISOString(),
    });
  }
  // dedup 후 카운트 (키 단위 = 실제 상품 수)
  for (const key of productRowMap.keys()) {
    if (productRowByKey.has(key)) prodUpdated++; else prodNew++;
  }
  const productRows = [...productRowMap.values()];

  // 전체 상품 UPSERT (chunk) — onConflict (company_id, model)
  const upsertedProducts = productRows.length
    ? await chunkedUpsert('rental_products', productRows, {
        onConflict: 'company_id,model',
        ignoreDuplicates: false,
        selectCols: 'id, company_id, model',
      })
    : [];
  for (const p of upsertedProducts) {
    productRowByKey.set(`${p.company_id}|${p.model}`, p);
  }
  // 진행도 1단계 — 상품 반영 완료
  await supabase.from('rental_import_batches')
    .update({ upsert_new: prodNew, upsert_updated: prodUpdated })
    .eq('id', batch_id);

  // ─── 3. rental_product_options UPSERT — 7튜플 자연키 ───
  // 매칭키: (product_id, months, care_service, inspection_cycle, ownership_months, variant_code)
  // product_id 는 위 productRowByKey 로 환산.
  const allProductIds = new Set();
  for (const p of productRowByKey.values()) allProductIds.add(p.id);

  // 이번 import 상품들의 기존 옵션 로드
  const productIdList = [...allProductIds];
  const dbOptions = [];
  for (let i = 0; i < productIdList.length; i += 200) {
    const slice = productIdList.slice(i, i + 200);
    const { data, error } = await supabase
      .from('rental_product_options')
      .select('id, product_id, months, care_service, inspection_cycle, ownership_months, variant_code, is_active')
      .in('product_id', slice);
    if (error) throw error;
    if (data) dbOptions.push(...data);
  }
  const optionRowByKey = new Map();   // optionDbKey → row
  for (const o of dbOptions) optionRowByKey.set(optionDbKey(o.product_id, o), o);

  let optNew = 0, optUpdated = 0;
  let optionInserts = [];
  let optionUpdates = [];
  const touchedOptionKeys = new Set();
  for (const o of options) {
    const cid = companyIdByName.get(o.company_name);
    if (cid == null) continue;
    const prod = productRowByKey.get(`${cid}|${o.model}`);
    if (!prod) continue;   // 상품 매핑 실패분 skip
    const variant = o.variant_code ?? '';
    const key = optionDbKey(prod.id, { ...o, variant_code: variant });
    touchedOptionKeys.add(key);
    const existing = optionRowByKey.get(key);
    // 빌리고 필드 — 봉이 인센티브 컬럼(point_weight·tier·margin 등)은 제외.
    // ⚠️ monthly_fee·half_fee 는 integer 컬럼 → toInt() 로 강제 (소수 INSERT 거부 방지).
    //    rebate 3종은 numeric 컬럼이라 소수 허용 → 변환 안 함.
    const billigoFields = {
      monthly_fee: toInt(o.monthly_fee),
      rebate: o.rebate ?? null,
      rebate_otherco: o.rebate_otherco ?? null,
      rebate_half: o.rebate_half ?? null,
      half_fee: toInt(o.half_fee),
      half_period: toInt(o.half_period),
      variant_label: o.variant_label ?? '',
      promo_type: o.promo_type ?? null,
      commission_method: o.commission_method || 'direct',
      source_batch_id: batch_id,
    };
    if (existing) {
      optionUpdates.push({ id: existing.id, ...billigoFields, is_active: true, updated_at: new Date().toISOString() });
    } else {
      optionInserts.push({
        product_id: prod.id,
        // ⚠️ months 는 integer NOT NULL, inspection_cycle·ownership_months 는 integer
        months: toInt(o.months),
        care_service: o.care_service ?? null,
        inspection_cycle: toInt(o.inspection_cycle),
        ownership_months: toInt(o.ownership_months),
        variant_code: variant,
        ...billigoFields,
        is_active: true,
      });
    }
  }

  // 신규 옵션 INSERT — 7튜플 UNIQUE 인덱스가 없어 plain insert.
  // 청크 200건, 청크별 try/catch 로 실패 위치를 에러 메시지에 박제.
  // 첫 적재라 보통 전부 신규 (기존 빌리고 옵션 0건).
  if (optionInserts.length) {
    const OPT_CHUNK = 200;
    for (let i = 0; i < optionInserts.length; i += OPT_CHUNK) {
      const slice = optionInserts.slice(i, i + OPT_CHUNK);
      const chunkNo = Math.floor(i / OPT_CHUNK) + 1;
      try {
        const { error } = await supabase.from('rental_product_options').insert(slice);
        if (error) throw error;
      } catch (e) {
        const msg = e?.message || String(e);
        // 청크 내 어느 행이 문제인지 — 첫 행 키를 함께 남긴다
        const first = slice[0] || {};
        throw new Error(
          `[options INSERT] chunk#${chunkNo} (rows ${i}~${i + slice.length - 1}, `
          + `첫행 product_id=${first.product_id} months=${first.months}) 실패: ${msg}`,
        );
      }
      optNew += slice.length;
    }
  }
  optionInserts = null;   // 메모리 해제 — 8천행 배열 참조 끊기

  // 기존 옵션 UPDATE — 빌리고 필드만 (봉이 컬럼 보존, 개별 update).
  // 매칭 0건이면 이 루프는 돌지 않음 (첫 적재 = 전부 INSERT).
  for (const u of optionUpdates) {
    const { id, ...fields } = u;
    try {
      const { error } = await supabase.from('rental_product_options').update(fields).eq('id', id);
      if (error) throw error;
    } catch (e) {
      throw new Error(`[options UPDATE] id=${id} 실패: ${e?.message || String(e)}`);
    }
    optUpdated++;
  }
  optionUpdates = null;   // 메모리 해제

  // 진행도 2단계 — 옵션 반영 완료
  await supabase.from('rental_import_batches')
    .update({ upsert_new: prodNew + optNew, upsert_updated: prodUpdated + optUpdated })
    .eq('id', batch_id);

  // ─── 4. 이번 batch 에 없는 기존 정수기 옵션/상품 → 단종 마킹 ───
  // 옵션: 이번 import 상품들의 기존 옵션 중 touchedOptionKeys 에 없는 것
  let discontinuedOptions = 0;
  const discOptionIds = [];
  for (const o of dbOptions) {
    const key = optionDbKey(o.product_id, o);
    if (!touchedOptionKeys.has(key)) discOptionIds.push(o.id);
  }
  for (let i = 0; i < discOptionIds.length; i += 200) {
    const slice = discOptionIds.slice(i, i + 200);
    const { error } = await supabase
      .from('rental_product_options')
      .update({ billigo_status: '단종', is_active: false, updated_at: new Date().toISOString() })
      .in('id', slice);
    if (error) throw new Error(`[options 단종마킹] rows ${i}~ 실패: ${error.message}`);
    discontinuedOptions += slice.length;
  }

  // 상품: 정수기메이커 회사 소속 상품 중 이번 import 에 없는 것
  const importedProductKeys = new Set();
  for (const o of options) {
    const cid = companyIdByName.get(o.company_name);
    if (cid != null) importedProductKeys.add(`${cid}|${o.model}`);
  }
  for (const p of products) {
    const cid = companyIdByName.get(p.company_name);
    if (cid != null) importedProductKeys.add(`${cid}|${p.model}`);
  }
  const billigoCompanyIds = new Set(
    companies.map((c) => companyIdByName.get(c.name)).filter((x) => x != null),
  );
  let discontinuedProducts = 0;
  const discProductIds = [];
  for (const p of dbProducts || []) {
    if (p.company_id == null || !billigoCompanyIds.has(p.company_id)) continue;
    const key = `${p.company_id}|${p.model}`;
    if (!importedProductKeys.has(key) && p.billigo_status !== '단종') {
      discProductIds.push(p.id);
    }
  }
  for (let i = 0; i < discProductIds.length; i += 200) {
    const slice = discProductIds.slice(i, i + 200);
    const { error } = await supabase
      .from('rental_products')
      .update({ billigo_status: '단종', is_active: false, updated_at: new Date().toISOString() })
      .in('id', slice);
    if (error) throw new Error(`[products 단종마킹] rows ${i}~ 실패: ${error.message}`);
    discontinuedProducts += slice.length;
  }
  // 단종 상품의 옵션도 함께 단종 마킹 (rental_sales 참조분도 삭제 X — 마킹만)
  for (let i = 0; i < discProductIds.length; i += 200) {
    const slice = discProductIds.slice(i, i + 200);
    const { error } = await supabase
      .from('rental_product_options')
      .update({ billigo_status: '단종', is_active: false, updated_at: new Date().toISOString() })
      .in('product_id', slice);
    if (error) throw error;
  }

  // ─── 5. rental_import_batches status='committed' ───
  const { error: bUpdErr } = await supabase
    .from('rental_import_batches')
    .update({
      status: 'committed',
      upsert_new: prodNew + optNew,
      upsert_updated: prodUpdated + optUpdated,
      marked_discontinued: discontinuedProducts + discontinuedOptions,
    })
    .eq('id', batch_id);
  if (bUpdErr) throw bUpdErr;

  return {
    prodNew, prodUpdated, optNew, optUpdated,
    discontinuedProducts, discontinuedOptions,
  };
}

// ─── POST /api/rental/import/commit — 즉시 응답 + 백그라운드 UPSERT ───
router.post('/import/commit', authenticateJWT, async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  const { batch_id } = req.body || {};
  if (!batch_id) return res.status(400).json({ error: 'batch_id 필수' });

  _pruneImportCache();
  const cached = _importCache.get(batch_id);
  if (!cached) {
    return res.status(410).json({ error: '파싱 캐시 만료 — 엑셀을 다시 업로드(preview)하세요' });
  }

  // batch status='committing' 전환 (폴링 시작점) + 이전 실패 에러 클리어
  try {
    const { error: stErr } = await supabase
      .from('rental_import_batches')
      .update({ status: 'committing', error_message: null })
      .eq('id', batch_id);
    if (stErr) throw stErr;
  } catch (e) {
    return res.status(500).json({ error: errMsg(e) });
  }

  // ★ 즉시 응답 — Cloudflare 100초 제한 회피.
  //    실제 UPSERT 는 아래 백그라운드에서 await 없이 진행된다.
  res.json({ ok: true, batch_id, async: true });

  // ─── 백그라운드 실행 (응답 후) ───
  const { parsed } = cached;
  runImportCommit(batch_id, parsed)
    .then(() => {
      _importCache.delete(batch_id);   // 성공 시 캐시 해제 (메모리 회수)
    })
    .catch(async (e) => {
      // 실패 원인 가시화 — 메시지+스택을 batch.error_message 에 박제.
      const msg = e?.message || String(e);
      const stack = e?.stack ? String(e.stack) : '';
      const full = (stack || msg).slice(0, 4000);   // 컬럼 폭주 방지 4KB cap
      console.error(`[rental import commit] batch=${batch_id} 실패:`, msg);
      if (stack) console.error(stack);
      try {
        await supabase.from('rental_import_batches')
          .update({ status: 'failed', error_message: full })
          .eq('id', batch_id);
      } catch (e2) {
        console.error(`[rental import commit] batch=${batch_id} status 기록 실패:`, e2?.message || e2);
      }
      // 캐시는 유지 — 재시도(commit) 가능하도록
    });
});

export default router;
