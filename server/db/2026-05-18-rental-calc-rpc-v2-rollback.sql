-- ROLLBACK for: 2026-05-18-rental-calc-rpc-v2.sql
-- 적용 일자: 2026-05-18
-- 주의: v2는 v1을 CREATE OR REPLACE로 덮어쓴 것. 진정한 rollback은 v1을 다시 REPLACE.
--       아래는 v1 (이전 버전, incentive_calc_grade 기반) 복원 SQL.
--       완전 제거를 원하면 rental-calc-rpc-rollback.sql 도 실행.
-- 사용: psql $DATABASE_URL < this_file.sql

BEGIN;

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

COMMIT;
