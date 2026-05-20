-- ════════════════════════════════════════════════════════════════
-- 롤백 — 빌리고 가전렌탈 Phase 1
-- 2026-05-20-billigo-rental-phase1.sql 의 역연산
-- ⚠️ rental_products/options 에 company_id·source_batch_id 가 이미 채워졌다면
--    먼저 그 데이터를 백업/검토 후 실행할 것 (FK·컬럼 DROP은 데이터 손실)
-- ════════════════════════════════════════════════════════════════
BEGIN;

-- 7. 카테고리 시드 제거 (신규 31종만 — 기존 7종은 보존)
DELETE FROM rental_categories WHERE slug IN (
  'ice-purifier','hotcold-purifier','mattress','bed-frame','dehumidifier',
  'water-softener','shower','induction','oven','coffee-machine','food-waste',
  'plant-grower','refrigerator','kimchi-fridge','aircon','tv','vacuum',
  'robot-vacuum','styler','clothes-purifier','healing-care','beauty-medical',
  'computer','monitor','game-console','projector','speaker','pet-care',
  'pest-control','air-freshener','hand-dryer'
);

-- 6. RLS 정책 제거
DROP POLICY IF EXISTS rental_import_batches_admin_write ON rental_import_batches;
DROP POLICY IF EXISTS rental_import_batches_read_all    ON rental_import_batches;
DROP POLICY IF EXISTS rental_companies_admin_write      ON rental_companies;
DROP POLICY IF EXISTS rental_companies_read_all         ON rental_companies;

-- 5. 인덱스 + UNIQUE 복원
DROP INDEX IF EXISTS idx_rental_products_modelkey;
DROP INDEX IF EXISTS idx_rental_products_company;
ALTER TABLE rental_products DROP CONSTRAINT IF EXISTS rental_products_company_model_key;
-- (brand,model) UNIQUE 복원은 데이터 중복 여부 확인 후 수동:
-- ALTER TABLE rental_products ADD CONSTRAINT rental_products_brand_model_key UNIQUE (brand, model);

-- 4. rental_product_options 보강 컬럼 제거
DROP INDEX IF EXISTS uq_rental_option_natural;
ALTER TABLE rental_product_options DROP COLUMN IF EXISTS variant_label;
ALTER TABLE rental_product_options DROP COLUMN IF EXISTS variant_code;
ALTER TABLE rental_product_options DROP COLUMN IF EXISTS commission_method;
ALTER TABLE rental_product_options DROP COLUMN IF EXISTS source_batch_id;

-- 3. rental_products 보강 컬럼 제거
ALTER TABLE rental_products DROP COLUMN IF EXISTS billigo_status;
ALTER TABLE rental_products DROP COLUMN IF EXISTS source_batch_id;
ALTER TABLE rental_products DROP COLUMN IF EXISTS model_key;
ALTER TABLE rental_products DROP COLUMN IF EXISTS manufacturer;
ALTER TABLE rental_products DROP COLUMN IF EXISTS company_id;

-- 2 · 1. 신설 테이블 제거
DROP TABLE IF EXISTS rental_import_batches;
DROP TABLE IF EXISTS rental_companies;

COMMIT;
