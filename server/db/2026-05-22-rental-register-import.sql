-- ════════════════════════════════════════════════════════════════
-- 봉이 표준 상품등록 양식 import — rental_import_batches.file_type 확장
-- 양식 정의서: docs/specs/rental-register-form.md
-- 빌리고 원본('정수기'·'가전') 외에 봉이 자체 표준폼('등록폼') 수용.
-- 적용: 데브(sesgdqbmophgmombelmn) → 검증 → 라이브(dugaqvvnhsgenhmhuyju)
-- ════════════════════════════════════════════════════════════════
BEGIN;

ALTER TABLE rental_import_batches DROP CONSTRAINT IF EXISTS rental_import_batches_file_type_check;
ALTER TABLE rental_import_batches ADD  CONSTRAINT rental_import_batches_file_type_check
  CHECK (file_type IN ('정수기', '가전', '등록폼'));

COMMIT;
