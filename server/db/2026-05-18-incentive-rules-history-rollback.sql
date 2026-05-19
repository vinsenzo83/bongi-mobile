-- ROLLBACK for: 2026-05-18-incentive-rules-history.sql
-- 적용 일자: 2026-05-18
-- 주의: DROP TABLE 시 audit log 행 전부 손실 (PITR 필요)
--       trigger 함수도 함께 DROP. incentive_rules UPDATE 시 더 이상 history 기록 안 됨.
-- 사용: psql $DATABASE_URL < this_file.sql

BEGIN;

DROP TRIGGER IF EXISTS incentive_rules_log_change ON incentive_rules;
DROP FUNCTION IF EXISTS public.incentive_log_rule_change();
DROP INDEX IF EXISTS idx_irh_rule_id_changed_at;
DROP TABLE IF EXISTS incentive_rules_history;

COMMIT;
