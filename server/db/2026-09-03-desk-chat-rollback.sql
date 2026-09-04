-- 롤백: 2026-09-03-desk-chat.sql
-- ⚠ desk 스키마 전체를 지운다 (대화 이력 포함). 운영 적용 후에는 백업 먼저.
BEGIN;
DROP SCHEMA IF EXISTS desk CASCADE;
DELETE FROM public.incentive_db_sources WHERE code='CHAT'
  AND NOT EXISTS (SELECT 1 FROM public.incentive_customer_db c WHERE c.db_source_id = incentive_db_sources.id);
DROP INDEX IF EXISTS public.ux_dept_desk_fallback;
ALTER TABLE public.incentive_departments
  DROP COLUMN IF EXISTS desk_enabled,
  DROP COLUMN IF EXISTS desk_fallback,
  DROP COLUMN IF EXISTS desk_sla_sec,
  DROP COLUMN IF EXISTS desk_hours,
  DROP COLUMN IF EXISTS desk_offhours;
-- 시드로 만든 부서는 자동 삭제하지 않는다 (운영 데이터일 수 있음)
-- 필요 시 수동: DELETE FROM incentive_departments WHERE name='고객지원팀' AND NOT EXISTS (SELECT 1 FROM incentive_agents WHERE department_id = incentive_departments.id);
COMMIT;
-- RPC 게이트웨이 제거 (2026-09-04-desk-rpc-gateway.sql 롤백)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid=p.pronamespace
            WHERE n.nspname='public' AND p.proname LIKE 'desk\_%'
  LOOP EXECUTE format('DROP FUNCTION IF EXISTS %s', r.sig); END LOOP;
END $$;
-- 소셜 채널 롤백 (2026-09-04-desk-social.sql)
DROP TABLE IF EXISTS desk.outbound_queue CASCADE;
ALTER TABLE desk.conversations
  DROP COLUMN IF EXISTS social_platform, DROP COLUMN IF EXISTS social_user_id,
  DROP COLUMN IF EXISTS social_handle,   DROP COLUMN IF EXISTS last_customer_at;
