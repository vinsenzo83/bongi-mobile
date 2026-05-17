-- 정책 통일 Phase A: rental_policy → incentive_rules 동일 컬럼 구조
-- 적용 끝: dev sesgdq + live dugaqv, 2026-05-18 03:00
-- 데이터 보존 + 새 컬럼 마이그레이션. 옛 컬럼 DROP은 Phase B 끝에서.

ALTER TABLE rental_policy
  ADD COLUMN IF NOT EXISTS effective_from date,
  ADD COLUMN IF NOT EXISTS active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS grade_rates jsonb,
  ADD COLUMN IF NOT EXISTS grade_thresholds jsonb,
  ADD COLUMN IF NOT EXISTS premium_margin_threshold int,
  ADD COLUMN IF NOT EXISTS payback_max int,
  ADD COLUMN IF NOT EXISTS payback_company_limit int,
  ADD COLUMN IF NOT EXISTS base_salary int DEFAULT 2300000;

UPDATE rental_policy SET
  effective_from = COALESCE(effective_from, effective_at, created_at::date),
  active = COALESCE(active, is_active, true),
  grade_rates = COALESCE(grade_rates, jsonb_build_object(
    '1', grade_g1_unit, '2', grade_g2_unit, '3', grade_g3_unit
  )),
  grade_thresholds = COALESCE(grade_thresholds, jsonb_build_object(
    '2', jsonb_build_object('points', grade_g2_p_threshold, 'premium', grade_g2_premium_threshold),
    '3', jsonb_build_object('points', grade_g3_p_threshold, 'premium', grade_g3_premium_threshold)
  )),
  premium_margin_threshold = COALESCE(premium_margin_threshold, premium_min_margin, 130000),
  payback_max = COALESCE(payback_max, payback_cap),
  payback_company_limit = COALESCE(payback_company_limit, payback_company_max, 30000),
  bonus_per_premium = COALESCE(bonus_per_premium, 10000),
  base_salary = COALESCE(base_salary, 2300000);

-- Phase B 끝에서 실행 예정 DROP 목록:
-- ALTER TABLE rental_policy
--   DROP COLUMN effective_at, is_active,
--   DROP COLUMN grade_g1_unit, grade_g2_unit, grade_g3_unit,
--   DROP COLUMN grade_g2_p_threshold, grade_g2_premium_threshold,
--   DROP COLUMN grade_g3_p_threshold, grade_g3_premium_threshold,
--   DROP COLUMN premium_min_margin, payback_cap, payback_company_max,
--   DROP COLUMN target_profit_rate, weight_cost_per_p,
--   DROP COLUMN tier_s_min_margin, tier_a_min_margin, tier_b_min_margin;
