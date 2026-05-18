-- ═══════════════════════════════════════════════════════════════
-- 2026-05-18 가전 정책 기반 Grade 계산 — rental_calc_monthly_settlement v2
-- ═══════════════════════════════════════════════════════════════
-- 버그 fix: 이전 버전은 incentive_calc_grade(IT 정책) 호출 → 가전 단가가 IT 단가로 잘못 반환
-- v2: rental_policy.grade_rates / grade_thresholds 사용 (가전 정책 기준)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION rental_calc_monthly_settlement(p_agent_id uuid, p_year_month text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_agg RECORD;
  v_base_salary INTEGER;
  v_policy rental_policy;
  v_bonus_per INTEGER;
  v_incentive INTEGER;
  v_bonus_total INTEGER;
  v_agent_total INTEGER;
  v_company_profit INTEGER;
  v_profit_rate NUMERIC;
  v_thrs jsonb;
  v_rates jsonb;
  v_g2_p NUMERIC;
  v_g2_prem INTEGER;
  v_g3_p NUMERIC;
  v_g3_prem INTEGER;
  v_grade_target INTEGER := 1;
  v_grade_applied INTEGER := 1;
  v_is_penalty BOOLEAN := false;
  v_applied_rate INTEGER := 0;
BEGIN
  SELECT base_salary INTO v_base_salary FROM incentive_agents WHERE id = p_agent_id;
  IF v_base_salary IS NULL THEN v_base_salary := 2300000; END IF;

  SELECT * INTO v_policy FROM rental_policy WHERE active = TRUE ORDER BY effective_from DESC NULLS LAST LIMIT 1;
  v_bonus_per := COALESCE(v_policy.bonus_per_premium, 10000);
  v_thrs := COALESCE(v_policy.grade_thresholds, '{"2":{"points":16,"premium":5},"3":{"points":31,"premium":10}}'::jsonb);
  v_rates := COALESCE(v_policy.grade_rates, '{"1":15000,"2":22000,"3":30000}'::jsonb);
  v_g2_p := COALESCE((v_thrs->'2'->>'points')::numeric, 16);
  v_g2_prem := COALESCE((v_thrs->'2'->>'premium')::integer, 5);
  v_g3_p := COALESCE((v_thrs->'3'->>'points')::numeric, 31);
  v_g3_prem := COALESCE((v_thrs->'3'->>'premium')::integer, 10);

  SELECT
    COUNT(*)::INTEGER AS total_count,
    COALESCE(SUM(s.point_weight_snapshot), 0)::NUMERIC AS total_points,
    COALESCE(SUM(CASE WHEN s.is_premium_snapshot THEN 1 ELSE 0 END), 0)::INTEGER AS premium_count,
    COALESCE(SUM(s.rebate_snapshot), 0)::INTEGER AS total_revenue,
    COALESCE(SUM(s.payback_snapshot), 0)::INTEGER AS total_payback,
    COALESCE(SUM(s.company_payback_burden), 0)::INTEGER AS total_company_payback_burden,
    COALESCE(SUM(s.agent_payback_deduct), 0)::INTEGER AS total_agent_payback_deduct
  INTO v_agg
  FROM rental_sales s
  WHERE s.agent_id = p_agent_id
    AND s.status = 'completed'
    AND s.contract_completed_at IS NOT NULL
    AND to_char(s.contract_completed_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM') = p_year_month
    AND s.deleted_at IS NULL;

  -- 🎯 가전 정책 기반 Grade 계산 (incentive_calc_grade 호출 X)
  IF v_agg.total_points >= v_g3_p THEN v_grade_target := 3;
  ELSIF v_agg.total_points >= v_g2_p THEN v_grade_target := 2;
  ELSE v_grade_target := 1;
  END IF;
  v_grade_applied := v_grade_target;
  v_is_penalty := false;
  IF v_grade_target = 3 AND v_agg.premium_count < v_g3_prem THEN
    v_grade_applied := 2; v_is_penalty := true;
  END IF;
  IF v_grade_target = 2 AND v_agg.premium_count < v_g2_prem THEN
    v_grade_applied := 1; v_is_penalty := true;
  END IF;
  v_applied_rate := COALESCE((v_rates->>(v_grade_applied::text))::integer, 0);

  v_incentive := (v_agg.total_points * v_applied_rate)::INTEGER;
  v_bonus_total := v_agg.premium_count * v_bonus_per;
  v_agent_total := v_base_salary + v_incentive + v_bonus_total - v_agg.total_agent_payback_deduct;
  v_company_profit := (v_agg.total_revenue * 0.9)::INTEGER
    - v_agg.total_payback
    - v_agg.total_company_payback_burden
    - v_base_salary - v_incentive - v_bonus_total;
  v_profit_rate := CASE WHEN v_agg.total_revenue > 0 THEN v_company_profit::NUMERIC / v_agg.total_revenue ELSE 0 END;

  RETURN jsonb_build_object(
    'agent_id', p_agent_id,
    'year_month', p_year_month,
    'source', 'rental',
    'total_count', v_agg.total_count,
    'total_points', v_agg.total_points,
    'premium_count', v_agg.premium_count,
    'grade_target', v_grade_target,
    'grade_applied', v_grade_applied,
    'is_penalty', v_is_penalty,
    'applied_rate', v_applied_rate,
    'total_revenue', v_agg.total_revenue,
    'total_payback', v_agg.total_payback,
    'total_company_payback_burden', v_agg.total_company_payback_burden,
    'total_agent_payback_deduct', v_agg.total_agent_payback_deduct,
    'base_salary', v_base_salary,
    'incentive', v_incentive,
    'bonus', v_bonus_total,
    'agent_total', v_agent_total,
    'company_profit', v_company_profit,
    'profit_rate', v_profit_rate
  );
END;
$$;
