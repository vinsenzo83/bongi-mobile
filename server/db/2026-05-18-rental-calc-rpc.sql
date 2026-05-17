-- ═══════════════════════════════════════════════════════════════
-- 2026-05-18 가전렌탈 Phase C — rental_calc_monthly_settlement RPC 신규
-- ═══════════════════════════════════════════════════════════════
-- 인터넷+TV의 incentive_calc_monthly_settlement 패턴을 그대로 복사하되,
-- rental_sales 테이블 + rental_policy(bonus_per_premium) 기반으로 동작.
-- 반환은 JSONB (rental 도메인은 monthly_settlements 테이블 미사용).
--
-- 1) agent base_salary 조회 (없으면 2,300,000 기본)
-- 2) active rental_policy 조회 → bonus_per_premium (기본 10,000)
-- 3) status='completed' + contract_completed_at(KST) 기준 rental_sales 집계
--    - total_count / total_points / premium_count
--    - total_revenue (rebate_snapshot)
--    - total_payback / total_company_payback_burden / total_agent_payback_deduct
-- 4) incentive_calc_grade RPC 호출 (인터넷+TV와 공유 — 통합 Grade)
-- 5) incentive = total_points × applied_rate
--    bonus     = premium_count × bonus_per_premium
--    agent_total = base + incentive + bonus − agent_payback_deduct
--    company_profit = revenue × 0.9 − payback − company_burden − base − incentive − bonus
--    profit_rate = company_profit / revenue
-- 6) JSONB 반환 (source='rental' 키 포함)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION rental_calc_monthly_settlement(p_agent_id uuid, p_year_month text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_agg RECORD;
  v_grade RECORD;
  v_base_salary INTEGER;
  v_policy rental_policy;
  v_bonus_per INTEGER;
  v_incentive INTEGER;
  v_bonus_total INTEGER;
  v_agent_total INTEGER;
  v_company_profit INTEGER;
  v_profit_rate NUMERIC;
BEGIN
  SELECT base_salary INTO v_base_salary FROM incentive_agents WHERE id = p_agent_id;
  IF v_base_salary IS NULL THEN v_base_salary := 2300000; END IF;

  SELECT * INTO v_policy FROM rental_policy WHERE active = TRUE ORDER BY effective_from DESC NULLS LAST LIMIT 1;
  v_bonus_per := COALESCE(v_policy.bonus_per_premium, 10000);

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

  SELECT * INTO v_grade FROM incentive_calc_grade(v_agg.total_points, v_agg.premium_count);

  v_incentive := (v_agg.total_points * v_grade.applied_rate)::INTEGER;
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
    'grade_target', v_grade.grade_target,
    'grade_applied', v_grade.grade_applied,
    'is_penalty', v_grade.is_penalty,
    'applied_rate', v_grade.applied_rate,
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
