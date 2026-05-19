-- ROLLBACK for: 2026-05-18-rental-policy-unify-phase-a.sql
-- 적용 일자: 2026-05-18
-- 주의: DROP COLUMN 복원은 데이터 손실 (PITR 필요)
--       Phase A에서 추가된 컬럼들 DROP. UPDATE로 채워진 값도 함께 손실.
--       grade_rates / grade_thresholds 등 JSONB 값이 손실되므로 PITR 권장.
-- 사용: psql $DATABASE_URL < this_file.sql

BEGIN;

ALTER TABLE rental_policy
  DROP COLUMN IF EXISTS effective_from,
  DROP COLUMN IF EXISTS active,
  DROP COLUMN IF EXISTS grade_rates,
  DROP COLUMN IF EXISTS grade_thresholds,
  DROP COLUMN IF EXISTS premium_margin_threshold,
  DROP COLUMN IF EXISTS payback_max,
  DROP COLUMN IF EXISTS payback_company_limit,
  DROP COLUMN IF EXISTS base_salary;

-- 주의: bonus_per_premium은 Phase A에서 UPDATE만 했으므로 별도 DROP 없음
--       (필요 시 원래 NULL 상태로 되돌리려면 별도 UPDATE 필요)

COMMIT;
