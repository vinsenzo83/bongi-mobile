-- ROLLBACK for: 2026-05-18-rental-category-extra-fields.sql
-- 적용 일자: 2026-05-18
-- 주의: 데이터 복원 불가, Supabase PITR 사용
--       원본은 rental_categories.metadata JSONB의 'extra_fields' 키를 jsonb_set으로 추가/덮어씀.
--       원래 metadata가 어떤 상태였는지 모르므로 정확한 복원 불가.
--       아래 SQL은 'extra_fields' 키만 제거 (= 다른 metadata 키는 유지).
--       원본 metadata 전체 복원이 필요하면 PITR 사용.
-- 사용: psql $DATABASE_URL < this_file.sql

BEGIN;

-- 'extra_fields' 키만 제거 (다른 metadata 키 보존)
UPDATE rental_categories
  SET metadata = metadata - 'extra_fields'
  WHERE slug IN ('water-purifier', 'air-purifier', 'massage-chair', 'bidet', 'mattress')
    AND metadata ? 'extra_fields';

-- 만약 마이그레이션 이전 metadata가 NULL이었던 row가 있다면
-- 그 row는 현재 {} (빈 객체)일 수 있음. 다음으로 NULL 복원 가능:
-- UPDATE rental_categories SET metadata = NULL
--   WHERE slug IN ('water-purifier','air-purifier','massage-chair','bidet','mattress')
--     AND metadata = '{}'::jsonb;

COMMIT;
