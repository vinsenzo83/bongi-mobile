-- ROLLBACK for: 2026-05-18-rental-phase-b.sql
-- 적용 일자: 2026-05-18
-- 주의: DROP COLUMN 복원은 데이터 손실 (PITR 필요)
--       Phase B에서 DROP된 옛 rental_policy 컬럼들을 빈 구조로만 복원.
--       기존 정책 값(grade_g1_unit, premium_min_margin 등)은 데이터 손실.
--       Supabase Point-In-Time Recovery로 복원 필요.
-- 사용: psql $DATABASE_URL < this_file.sql

BEGIN;

-- ─── 1. rental_sales 박제 컬럼 reverse ───
-- Phase B에서 추가한 컬럼 DROP
ALTER TABLE rental_sales DROP COLUMN IF EXISTS company_payback_burden;
ALTER TABLE rental_sales DROP COLUMN IF EXISTS agent_payback_deduct;
ALTER TABLE rental_sales DROP COLUMN IF EXISTS is_premium_snapshot;

-- Phase B에서 DROP된 컬럼 복원 (데이터 NULL — PITR 필요)
ALTER TABLE rental_sales ADD COLUMN IF NOT EXISTS margin_snapshot int DEFAULT 0;
ALTER TABLE rental_sales ADD COLUMN IF NOT EXISTS tier_snapshot text;

-- ─── 2. rental_policy 옛 컬럼 복원 (구조만, 값 NULL) ───
ALTER TABLE rental_policy
  ADD COLUMN IF NOT EXISTS effective_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS grade_g1_unit int DEFAULT 15000,
  ADD COLUMN IF NOT EXISTS grade_g2_unit int DEFAULT 22000,
  ADD COLUMN IF NOT EXISTS grade_g3_unit int DEFAULT 30000,
  ADD COLUMN IF NOT EXISTS grade_g2_p_threshold numeric DEFAULT 16,
  ADD COLUMN IF NOT EXISTS grade_g2_premium_threshold int DEFAULT 5,
  ADD COLUMN IF NOT EXISTS grade_g3_p_threshold numeric DEFAULT 31,
  ADD COLUMN IF NOT EXISTS grade_g3_premium_threshold int DEFAULT 10,
  ADD COLUMN IF NOT EXISTS premium_min_margin int DEFAULT 130000,
  ADD COLUMN IF NOT EXISTS payback_cap int,
  ADD COLUMN IF NOT EXISTS payback_company_max int DEFAULT 30000,
  ADD COLUMN IF NOT EXISTS target_profit_rate numeric DEFAULT 0.1,
  ADD COLUMN IF NOT EXISTS weight_cost_per_p int DEFAULT 70000,
  ADD COLUMN IF NOT EXISTS tier_s_min_margin int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tier_a_min_margin int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tier_b_min_margin int DEFAULT 0;

COMMIT;
