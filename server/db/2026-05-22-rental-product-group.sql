-- ════════════════════════════════════════════════════════════════
-- 빌리고 가전렌탈 — 상품관리 그룹 탭 (정수기 / 가전)
-- rental_categories 에 product_group 컬럼 추가 — 카테고리를 품목 성격으로 분류.
-- 어드민 상품관리 '정수기 그룹' / '가전 그룹' 탭이 이 컬럼으로 갈린다.
-- (company.category_group = 빌리고 파일 출처와 별개 — 카테고리 성격 기준)
-- 적용: 데브(sesgdqbmophgmombelmn) → 검증 → 라이브(dugaqvvnhsgenhmhuyju)
-- ════════════════════════════════════════════════════════════════
BEGIN;

ALTER TABLE rental_categories ADD COLUMN IF NOT EXISTS product_group text NOT NULL DEFAULT '가전';
COMMENT ON COLUMN rental_categories.product_group IS '상품관리 그룹 탭 — 정수기 | 가전 (품목 성격 분류)';

-- 정수기 계열 6종 → '정수기' 그룹, 나머지 전부는 default '가전'
UPDATE rental_categories SET product_group='정수기'
  WHERE slug IN ('water-purifier','ice-purifier','hotcold-purifier','water-softener','air-purifier','bidet');

COMMIT;
