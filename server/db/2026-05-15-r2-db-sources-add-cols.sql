-- R2 동기화: 데브 incentive_db_sources에 라이브 컬럼 4개 추가 + 데이터 sync
-- 라이브에만 있었던 code/notes/updated_at/created_by_user_id 보강
-- 라이브 4 rows 데이터를 데브에도 동일 적용 (code/display_order/notes)

BEGIN;

ALTER TABLE incentive_db_sources
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid;

UPDATE incentive_db_sources SET code='bongi',   display_order=1, notes=NULL WHERE id=1;
UPDATE incentive_db_sources SET code='company', display_order=2, notes=NULL WHERE id=2;
UPDATE incentive_db_sources SET code='bong',    display_order=1, notes='1'  WHERE id=4;
UPDATE incentive_db_sources SET code='ilta',    display_order=2, notes=NULL WHERE id=5;

DO $$ BEGIN
  ALTER TABLE incentive_db_sources ADD CONSTRAINT incentive_db_sources_code_key UNIQUE (code);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMIT;
