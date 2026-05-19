-- ROLLBACK for: 2026-05-18-rental-policy-cleanup.sql
-- 적용 일자: 2026-05-18
-- 주의: DROP COLUMN 복원은 데이터 손실 (PITR 필요)
--       이 스크립트는 컬럼 구조만 복원. 컬럼 데이터는 NULL/DEFAULT.
--       이전 값 복원은 Supabase Point-In-Time Recovery 사용.
-- 사용: psql $DATABASE_URL < this_file.sql

BEGIN;

-- 1. signup_bonus 복원
ALTER TABLE rental_policy ADD COLUMN IF NOT EXISTS signup_bonus_per_sale int DEFAULT 0;
ALTER TABLE rental_sales  ADD COLUMN IF NOT EXISTS signup_bonus_snapshot int DEFAULT 0;

-- 2. 기본급분담 복원
ALTER TABLE rental_policy ADD COLUMN IF NOT EXISTS base_salary int DEFAULT 2300000;
ALTER TABLE rental_policy ADD COLUMN IF NOT EXISTS base_salary_standard_sales int DEFAULT 0;

-- 3. 약정·우수·케어 보정 P 복원
ALTER TABLE rental_policy ADD COLUMN IF NOT EXISTS weight_p_36m numeric DEFAULT 1;
ALTER TABLE rental_policy ADD COLUMN IF NOT EXISTS weight_p_60m numeric DEFAULT 1;
ALTER TABLE rental_policy ADD COLUMN IF NOT EXISTS weight_p_72m numeric DEFAULT 1;
ALTER TABLE rental_policy ADD COLUMN IF NOT EXISTS weight_p_84m numeric DEFAULT 1;
ALTER TABLE rental_policy ADD COLUMN IF NOT EXISTS premium_bonus_p numeric DEFAULT 0;
ALTER TABLE rental_policy ADD COLUMN IF NOT EXISTS care_visit_bonus_p numeric DEFAULT 0;

-- 4. 리베이트 임계 컬럼 복원
ALTER TABLE rental_policy ADD COLUMN IF NOT EXISTS premium_min_rebate int DEFAULT 0;
ALTER TABLE rental_policy ADD COLUMN IF NOT EXISTS tier_s_min_rebate int DEFAULT 0;
ALTER TABLE rental_policy ADD COLUMN IF NOT EXISTS tier_a_min_rebate int DEFAULT 0;
ALTER TABLE rental_policy ADD COLUMN IF NOT EXISTS tier_b_min_rebate int DEFAULT 0;

COMMIT;
