-- ROLLBACK for: 2026-05-18-rental-calc-rpc.sql
-- 적용 일자: 2026-05-18
-- 주의: 이 함수는 신규 생성. DROP시 함수 정의 손실. 코드 재생성 필요.
--       단, 후속 마이그레이션(2026-05-18-rental-calc-rpc-v2.sql)도 같은 함수를 CREATE OR REPLACE.
--       v2 rollback과 함께 실행되어야 v1까지 완전 제거됨.
-- 사용: psql $DATABASE_URL < this_file.sql

BEGIN;

DROP FUNCTION IF EXISTS public.rental_calc_monthly_settlement(uuid, text);

COMMIT;
