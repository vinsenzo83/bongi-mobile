-- R2 동기화: incentive_ip_whitelist 라이브 스키마를 데브·서버 코드와 일치시킴
-- 사고: 라이브 ip/expires_at/created_by_user_id 컬럼은 서버 코드(cidr/scope/notes/created_by) 호환 X
-- → 라이브에서 IP 화이트리스트 INSERT 시도 시 'Column cidr does not exist' 에러
-- 안전: 라이브 0 rows · 데브 0 rows (2026-05-15 확인)

BEGIN;

DROP INDEX IF EXISTS idx_iwl_active;  -- 옛 ip 기반 partial index

ALTER TABLE incentive_ip_whitelist
  DROP COLUMN IF EXISTS ip,
  DROP COLUMN IF EXISTS expires_at,
  DROP COLUMN IF EXISTS created_by_user_id,
  ADD COLUMN IF NOT EXISTS cidr text NOT NULL,
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'customer_db',
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS notes text,
  ALTER COLUMN active SET NOT NULL,
  ALTER COLUMN active SET DEFAULT true,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_iwl_active_cidr
  ON incentive_ip_whitelist(cidr) WHERE active = true;

COMMIT;
