-- ROLLBACK for: 2026-05-18-notes-escape-cleanup.sql
-- 적용 일자: 2026-05-18
-- 주의: 데이터 복원 불가, Supabase PITR 사용
--       원본 UPDATE는 replace() 누적 HTML escape (&amp;amp;... &lt; 등)를 정상 문자로 정리.
--       이를 역방향(<을 &lt;로)으로 되돌리면 의미 없는 데이터 손상이 됨.
--       원래 깨진 상태로 되돌릴 이유가 없으므로 자동 reverse SQL 제공 안 함.
--       마이그레이션 직전 시점 데이터가 필요하면 Supabase PITR(Point-In-Time Recovery)로
--       incentive_rules.notes, rental_policy.notes 컬럼을 복원해야 함.
-- 사용: psql $DATABASE_URL < this_file.sql  (실제로는 NO-OP)

BEGIN;

-- NO-OP: notes escape cleanup은 의도적으로 reverse 불가.
-- 복원 절차 (수동):
--   1) Supabase Dashboard → Database → Backups → Point-In-Time Recovery
--   2) 2026-05-18 이전 시점 선택
--   3) incentive_rules, rental_policy 두 테이블의 notes 컬럼 값 export
--   4) 현재 DB에 UPDATE로 덮어쓰기

SELECT 'NO-OP rollback: notes escape cleanup is non-reversible. Use Supabase PITR.' AS message;

COMMIT;
