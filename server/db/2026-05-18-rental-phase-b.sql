-- ═══════════════════════════════════════════════════════════════
-- 가전렌탈 Phase B — 박제 단순화 + 페이백 분담 자동 + 옛 컬럼 DROP
-- 2026-05-18
-- ═══════════════════════════════════════════════════════════════
-- 합의 공식 (f2ccf3f): margin = rebate × 0.9 − payback − P × 70,000
--   · 가입보너스 없음
--   · 기본급분담 없음
--   · margin/tier 박제 제거 → 운영자 수동 입력
--   · 페이백 회사/상담사 분담 자동 박제
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. rental_sales 박제 컬럼 정리 ───
ALTER TABLE rental_sales DROP COLUMN IF EXISTS margin_snapshot;
ALTER TABLE rental_sales DROP COLUMN IF EXISTS tier_snapshot;
ALTER TABLE rental_sales ADD COLUMN IF NOT EXISTS company_payback_burden int DEFAULT 0;
ALTER TABLE rental_sales ADD COLUMN IF NOT EXISTS agent_payback_deduct int DEFAULT 0;
ALTER TABLE rental_sales ADD COLUMN IF NOT EXISTS is_premium_snapshot boolean DEFAULT false;

COMMENT ON COLUMN rental_sales.company_payback_burden IS '회사 부담 페이백 (min(payback, payback_company_limit))';
COMMENT ON COLUMN rental_sales.agent_payback_deduct IS '상담사 차감 페이백 (max(0, payback - payback_company_limit))';
COMMENT ON COLUMN rental_sales.is_premium_snapshot IS '계약 시점 우수상품 여부 박제';

-- ─── 2. rental_policy 옛 컬럼 DROP (Phase A에서 새 컬럼으로 데이터 이전 완료) ───
ALTER TABLE rental_policy
  DROP COLUMN IF EXISTS effective_at,
  DROP COLUMN IF EXISTS is_active,
  DROP COLUMN IF EXISTS grade_g1_unit,
  DROP COLUMN IF EXISTS grade_g2_unit,
  DROP COLUMN IF EXISTS grade_g3_unit,
  DROP COLUMN IF EXISTS grade_g2_p_threshold,
  DROP COLUMN IF EXISTS grade_g2_premium_threshold,
  DROP COLUMN IF EXISTS grade_g3_p_threshold,
  DROP COLUMN IF EXISTS grade_g3_premium_threshold,
  DROP COLUMN IF EXISTS premium_min_margin,
  DROP COLUMN IF EXISTS payback_cap,
  DROP COLUMN IF EXISTS payback_company_max,
  DROP COLUMN IF EXISTS target_profit_rate,
  DROP COLUMN IF EXISTS weight_cost_per_p,
  DROP COLUMN IF EXISTS tier_s_min_margin,
  DROP COLUMN IF EXISTS tier_a_min_margin,
  DROP COLUMN IF EXISTS tier_b_min_margin;
