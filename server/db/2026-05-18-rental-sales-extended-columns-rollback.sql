-- ROLLBACK for: 2026-05-18-rental-sales-extended-columns.sql
-- 적용 일자: 2026-05-18
-- 주의: DROP COLUMN 복원은 데이터 손실 (PITR 필요)
--       계약 상세 모달에서 입력된 고객 이메일·계좌·청구 정보 등이 영구 손실.
--       Supabase Point-In-Time Recovery 사용 권장.
-- 사용: psql $DATABASE_URL < this_file.sql

BEGIN;

ALTER TABLE rental_sales
  DROP COLUMN IF EXISTS customer_email,
  DROP COLUMN IF EXISTS activation_date,
  DROP COLUMN IF EXISTS bank_name,
  DROP COLUMN IF EXISTS bank_account_holder,
  DROP COLUMN IF EXISTS bank_account_number,
  DROP COLUMN IF EXISTS waiting_relation,
  DROP COLUMN IF EXISTS waiting_person,
  DROP COLUMN IF EXISTS waiting_phone,
  DROP COLUMN IF EXISTS seller_phone,
  DROP COLUMN IF EXISTS billing_method,
  DROP COLUMN IF EXISTS billing_phone,
  DROP COLUMN IF EXISTS billing_carrier;

COMMIT;
