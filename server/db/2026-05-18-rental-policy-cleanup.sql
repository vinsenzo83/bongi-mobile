-- 가전렌탈 정책 통일 (f2ccf3f commit 합의 완전 반영)
-- 합의 공식: margin = rebate × 0.9 − payback − P × weight_cost_per_p
--   · 가입보너스 없음 / 기본급분담 없음 / 약정·우수·케어 보정 P 시스템 폐지
-- 적용 끝: dev sesgdq + live dugaqv, 2026-05-18

-- 1. signup_bonus 제거 (모달·시뮬·정책 페이지에서 모두 제거됨)
ALTER TABLE rental_policy DROP COLUMN IF EXISTS signup_bonus_per_sale;
ALTER TABLE rental_sales  DROP COLUMN IF EXISTS signup_bonus_snapshot;

-- 2. 기본급분담 (1건당 base_salary/standard_sales) 제거 — 합의 공식에 미포함
ALTER TABLE rental_policy DROP COLUMN IF EXISTS base_salary;
ALTER TABLE rental_policy DROP COLUMN IF EXISTS base_salary_standard_sales;

-- 3. 약정·우수·케어 보정 P 제거 — 합의는 상품별 고정 point_weight 사용
ALTER TABLE rental_policy DROP COLUMN IF EXISTS weight_p_36m;
ALTER TABLE rental_policy DROP COLUMN IF EXISTS weight_p_60m;
ALTER TABLE rental_policy DROP COLUMN IF EXISTS weight_p_72m;
ALTER TABLE rental_policy DROP COLUMN IF EXISTS weight_p_84m;
ALTER TABLE rental_policy DROP COLUMN IF EXISTS premium_bonus_p;
ALTER TABLE rental_policy DROP COLUMN IF EXISTS care_visit_bonus_p;

-- 4. 사용 안 하는 리베이트 임계 컬럼 (코드 어디서도 참조 X)
ALTER TABLE rental_policy DROP COLUMN IF EXISTS premium_min_rebate;
ALTER TABLE rental_policy DROP COLUMN IF EXISTS tier_s_min_rebate;
ALTER TABLE rental_policy DROP COLUMN IF EXISTS tier_a_min_rebate;
ALTER TABLE rental_policy DROP COLUMN IF EXISTS tier_b_min_rebate;
