-- 2026-05-25  rental_products.image_url 추가
-- 상품 관리 UI에서 thumb·URL 직접 편집 가능하도록.

ALTER TABLE rental_products
  ADD COLUMN IF NOT EXISTS image_url text;

COMMENT ON COLUMN rental_products.image_url IS
  '상품 대표 이미지 URL (외부 호스팅·CDN). 모델 마스터 thumb·옵션 디테일 미리보기.';

-- 롤백:
-- ALTER TABLE rental_products DROP COLUMN IF EXISTS image_url;
