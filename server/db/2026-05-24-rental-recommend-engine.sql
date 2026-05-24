-- ════════════════════════════════════════════════════════════════
-- 가전렌탈 다채널 추천 엔진 — DB Phase A
-- PRD: docs/specs/rental-channel-recommend-engine.md
-- 적용: 라이브(dugaqvvnhsgenhmhuyju) + 데브(sesgdqbmophgmombelmn)
-- ════════════════════════════════════════════════════════════════
BEGIN;

-- 1) rental_companies — 편의 점수 (운영자 설정, 0~1)
ALTER TABLE rental_companies
  ADD COLUMN IF NOT EXISTS convenience_score numeric DEFAULT 0.5
    CHECK (convenience_score >= 0 AND convenience_score <= 1);
COMMENT ON COLUMN rental_companies.convenience_score IS '다채널 추천 편의 가중치 (0~1, 운영자 설정 — 정책 안정성·재계약·반품 등)';

-- 초기 시드 (PRD §6.2) — 대기업 0.75~0.80, 중견 0.60~0.65, 그 외 default 0.5
UPDATE rental_companies SET convenience_score = 0.80 WHERE name = 'LG 헬로비젼' OR name = 'LG헬로비전';
UPDATE rental_companies SET convenience_score = 0.75 WHERE name IN ('KT가전구독', 'KT가전구독(회선X)', 'LG전자구독');
UPDATE rental_companies SET convenience_score = 0.65 WHERE name IN ('스마트렌탈', '스마트', '이니렌탈', '이니');
UPDATE rental_companies SET convenience_score = 0.60 WHERE name IN ('현대유버스', '현대유버스(가전)');
UPDATE rental_companies SET convenience_score = 0.55 WHERE name = '캐리어';

-- 2) rental_policy — 추천 프로파일별 가중치 (3 프로파일, 합 1.00)
ALTER TABLE rental_policy
  ADD COLUMN IF NOT EXISTS recommend_profiles jsonb
    DEFAULT '{
      "margin":   {"margin":0.50,"customer":0.35,"gift":0.00,"convenience":0.15},
      "customer": {"margin":0.20,"customer":0.60,"gift":0.05,"convenience":0.15},
      "gift":     {"margin":0.30,"customer":0.15,"gift":0.45,"convenience":0.10}
    }'::jsonb;
COMMENT ON COLUMN rental_policy.recommend_profiles IS '다채널 추천 프로파일별 가중치 — margin(봉이수익)/customer(월납최소)/gift(사은품최대). 각 프로파일 합 1.00';

-- 기존 활성 정책에도 default 강제 (NULL 잔존 시)
UPDATE rental_policy
SET recommend_profiles = '{
  "margin":   {"margin":0.50,"customer":0.35,"gift":0.00,"convenience":0.15},
  "customer": {"margin":0.20,"customer":0.60,"gift":0.05,"convenience":0.15},
  "gift":     {"margin":0.30,"customer":0.15,"gift":0.45,"convenience":0.10}
}'::jsonb
WHERE recommend_profiles IS NULL;

COMMIT;
