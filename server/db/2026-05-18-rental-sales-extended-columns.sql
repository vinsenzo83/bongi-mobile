-- 가전렌탈 계약 상세 모달 — 인터넷+TV와 동등 수준 정보 입력
-- 양쪽 supabase 적용 끝 (dev sesgdqbmophgmombelmn / live dugaqvvnhsgenhmhuyju, 2026-05-18)
ALTER TABLE rental_sales
  ADD COLUMN IF NOT EXISTS customer_email text,
  ADD COLUMN IF NOT EXISTS activation_date date,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_account_holder text,
  ADD COLUMN IF NOT EXISTS bank_account_number text,
  ADD COLUMN IF NOT EXISTS waiting_relation text,
  ADD COLUMN IF NOT EXISTS waiting_person text,
  ADD COLUMN IF NOT EXISTS waiting_phone text,
  ADD COLUMN IF NOT EXISTS seller_phone text,
  ADD COLUMN IF NOT EXISTS billing_method text,
  ADD COLUMN IF NOT EXISTS billing_phone text,
  ADD COLUMN IF NOT EXISTS billing_carrier text;
