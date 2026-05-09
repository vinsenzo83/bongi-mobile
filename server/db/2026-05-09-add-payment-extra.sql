-- ═══════════════════════════════════════════════════════════════
-- 2026-05-09 — incentive_sales.payment_extra (jsonb) 추가
-- ───────────────────────────────────────────────────────────────
-- 납부방법(payment_method)에 따른 추가 정보 보관:
--   자동이체: { bank: { name, holder, account } }
--   카드이체: { card: { holder, company, number, expiry } }
--
-- ⚠️ 보안: 카드번호 전체·유효기간 평문 저장. 외부 노출 X (내부 어드민 전용).
-- ───────────────────────────────────────────────────────────────
-- 실행 위치:
--   1. Supabase Dashboard → SQL Editor (데브: sesgdqbmophgmombelmn)
--   2. 검증 후 라이브 (dugaqvvnhsgenhmhuyju)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE incentive_sales
  ADD COLUMN IF NOT EXISTS payment_extra jsonb DEFAULT NULL;

COMMENT ON COLUMN incentive_sales.payment_extra IS
  '납부방법별 추가 정보 (jsonb). 자동이체: {bank:{name,holder,account}} / 카드이체: {card:{holder,company,number,expiry}}';

-- 검증 쿼리
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'incentive_sales' AND column_name = 'payment_extra';
