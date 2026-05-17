-- Phase D: incentive_finalize_monthly_settlement 통합 (인터넷+TV + 가전)
-- 2026-05-18

-- 1) 가전 + 합산 컬럼 추가
ALTER TABLE incentive_monthly_settlements
  ADD COLUMN IF NOT EXISTS rental_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rental_points numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rental_premium_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rental_revenue int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rental_payback int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rental_company_payback_burden int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rental_agent_payback_deduct int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rental_incentive int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rental_bonus int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rental_company_profit int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS combined_total_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS combined_total_points numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS combined_agent_total int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS combined_company_profit int DEFAULT 0;

-- 2) Finalize RPC: 인터넷+TV (incentive_calc) + 가전 (rental_calc) 합산
CREATE OR REPLACE FUNCTION public.incentive_finalize_monthly_settlement(
  p_agent_id uuid,
  p_year_month character,
  p_finalized_by uuid
)
RETURNS incentive_monthly_settlements
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_calc incentive_monthly_settlements;
  v_rental jsonb;
  v_result incentive_monthly_settlements;
  v_rental_count int;
  v_rental_points numeric;
  v_rental_premium int;
  v_rental_revenue int;
  v_rental_payback int;
  v_rental_company_payback_burden int;
  v_rental_agent_payback_deduct int;
  v_rental_incentive int;
  v_rental_bonus int;
  v_rental_agent_total int;
  v_rental_company_profit int;
  v_combined_total_count int;
  v_combined_total_points numeric;
  v_combined_agent_total int;
  v_combined_company_profit int;
BEGIN
  -- 인터넷+TV 정산
  v_calc := incentive_calc_monthly_settlement(p_agent_id, p_year_month);
  v_calc.finalized_at := now();
  v_calc.finalized_by := p_finalized_by;

  -- 가전 정산 (jsonb)
  v_rental := rental_calc_monthly_settlement(p_agent_id, p_year_month::text);
  v_rental_count                    := COALESCE((v_rental->>'total_count')::int, 0);
  v_rental_points                   := COALESCE((v_rental->>'total_points')::numeric, 0);
  v_rental_premium                  := COALESCE((v_rental->>'premium_count')::int, 0);
  v_rental_revenue                  := COALESCE((v_rental->>'total_revenue')::int, 0);
  v_rental_payback                  := COALESCE((v_rental->>'total_payback')::int, 0);
  v_rental_company_payback_burden   := COALESCE((v_rental->>'total_company_payback_burden')::int, 0);
  v_rental_agent_payback_deduct     := COALESCE((v_rental->>'total_agent_payback_deduct')::int, 0);
  v_rental_incentive                := COALESCE((v_rental->>'incentive')::int, 0);
  v_rental_bonus                    := COALESCE((v_rental->>'bonus')::int, 0);
  v_rental_agent_total              := COALESCE((v_rental->>'agent_total')::int, 0);
  v_rental_company_profit           := COALESCE((v_rental->>'company_profit')::int, 0);

  -- 합산 (rental_agent_total 은 base_salary 중복 포함이므로 agent 합산은 incentive+bonus-payback 만 추가)
  v_combined_total_count   := v_calc.total_count + v_rental_count;
  v_combined_total_points  := v_calc.total_points + v_rental_points;
  v_combined_agent_total   := v_calc.agent_total + v_rental_incentive + v_rental_bonus - v_rental_agent_payback_deduct;
  v_combined_company_profit := v_calc.company_profit + v_rental_company_profit;

  INSERT INTO incentive_monthly_settlements (
    agent_id, year_month, total_count, total_points, premium_count,
    grade_target, grade_applied, is_penalty, applied_rate,
    total_revenue, total_payback, total_company_payback_burden, total_agent_payback_deduct,
    base_salary, incentive, bonus, agent_total,
    company_profit, profit_rate, finalized_at, finalized_by,
    rental_count, rental_points, rental_premium_count,
    rental_revenue, rental_payback, rental_company_payback_burden, rental_agent_payback_deduct,
    rental_incentive, rental_bonus, rental_company_profit,
    combined_total_count, combined_total_points, combined_agent_total, combined_company_profit
  ) VALUES (
    v_calc.agent_id, v_calc.year_month, v_calc.total_count, v_calc.total_points, v_calc.premium_count,
    v_calc.grade_target, v_calc.grade_applied, v_calc.is_penalty, v_calc.applied_rate,
    v_calc.total_revenue, v_calc.total_payback, v_calc.total_company_payback_burden, v_calc.total_agent_payback_deduct,
    v_calc.base_salary, v_calc.incentive, v_calc.bonus, v_calc.agent_total,
    v_calc.company_profit, v_calc.profit_rate, v_calc.finalized_at, v_calc.finalized_by,
    v_rental_count, v_rental_points, v_rental_premium,
    v_rental_revenue, v_rental_payback, v_rental_company_payback_burden, v_rental_agent_payback_deduct,
    v_rental_incentive, v_rental_bonus, v_rental_company_profit,
    v_combined_total_count, v_combined_total_points, v_combined_agent_total, v_combined_company_profit
  )
  ON CONFLICT (agent_id, year_month) DO UPDATE SET
    total_count = EXCLUDED.total_count,
    total_points = EXCLUDED.total_points,
    premium_count = EXCLUDED.premium_count,
    grade_target = EXCLUDED.grade_target,
    grade_applied = EXCLUDED.grade_applied,
    is_penalty = EXCLUDED.is_penalty,
    applied_rate = EXCLUDED.applied_rate,
    total_revenue = EXCLUDED.total_revenue,
    total_payback = EXCLUDED.total_payback,
    total_company_payback_burden = EXCLUDED.total_company_payback_burden,
    total_agent_payback_deduct = EXCLUDED.total_agent_payback_deduct,
    incentive = EXCLUDED.incentive,
    bonus = EXCLUDED.bonus,
    agent_total = EXCLUDED.agent_total,
    company_profit = EXCLUDED.company_profit,
    profit_rate = EXCLUDED.profit_rate,
    finalized_at = EXCLUDED.finalized_at,
    finalized_by = EXCLUDED.finalized_by,
    rental_count = EXCLUDED.rental_count,
    rental_points = EXCLUDED.rental_points,
    rental_premium_count = EXCLUDED.rental_premium_count,
    rental_revenue = EXCLUDED.rental_revenue,
    rental_payback = EXCLUDED.rental_payback,
    rental_company_payback_burden = EXCLUDED.rental_company_payback_burden,
    rental_agent_payback_deduct = EXCLUDED.rental_agent_payback_deduct,
    rental_incentive = EXCLUDED.rental_incentive,
    rental_bonus = EXCLUDED.rental_bonus,
    rental_company_profit = EXCLUDED.rental_company_profit,
    combined_total_count = EXCLUDED.combined_total_count,
    combined_total_points = EXCLUDED.combined_total_points,
    combined_agent_total = EXCLUDED.combined_agent_total,
    combined_company_profit = EXCLUDED.combined_company_profit,
    updated_at = now()
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$function$;
