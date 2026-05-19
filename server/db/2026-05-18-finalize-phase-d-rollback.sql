-- ROLLBACK for: 2026-05-18-finalize-phase-d.sql
-- 적용 일자: 2026-05-18
-- 주의: DROP COLUMN 복원은 데이터 손실 (PITR 필요)
--       정산 데이터(rental_*, combined_*)가 이미 finalize된 행에 있으면 손실됨.
--       finalize RPC도 원복: 가전 합산 로직 제거된 이전 incentive_finalize_monthly_settlement 필요.
--       이전 함수 정의를 별도로 보관하지 않은 경우 DROP만 하고 코드 재배포 필요.
-- 사용: psql $DATABASE_URL < this_file.sql

BEGIN;

-- 1) Finalize RPC 제거 (이전 버전 복원은 별도 SQL 필요 — 코드 저장소에서 추출)
DROP FUNCTION IF EXISTS public.incentive_finalize_monthly_settlement(uuid, character, uuid);

-- 2) 가전 + 합산 컬럼 DROP
ALTER TABLE incentive_monthly_settlements
  DROP COLUMN IF EXISTS rental_count,
  DROP COLUMN IF EXISTS rental_points,
  DROP COLUMN IF EXISTS rental_premium_count,
  DROP COLUMN IF EXISTS rental_revenue,
  DROP COLUMN IF EXISTS rental_payback,
  DROP COLUMN IF EXISTS rental_company_payback_burden,
  DROP COLUMN IF EXISTS rental_agent_payback_deduct,
  DROP COLUMN IF EXISTS rental_incentive,
  DROP COLUMN IF EXISTS rental_bonus,
  DROP COLUMN IF EXISTS rental_company_profit,
  DROP COLUMN IF EXISTS combined_total_count,
  DROP COLUMN IF EXISTS combined_total_points,
  DROP COLUMN IF EXISTS combined_agent_total,
  DROP COLUMN IF EXISTS combined_company_profit;

COMMIT;
