-- 2026-05-30  bongi_gifts.source_sale_id type fix (R9 데이터 무결성)
-- 본질: incentive_sales.id (uuid) vs bongi_gifts.source_sale_id (bigint) 충돌로
--       트리거가 silent fail. text로 통일 + 누락 백필.

BEGIN;

-- 1. source_sale_id → text (양쪽 sale id 호환)
ALTER TABLE bongi_gifts ALTER COLUMN source_sale_id TYPE text USING source_sale_id::text;

-- 2. unique index 재생성 (type 변경으로 손실됨)
DROP INDEX IF EXISTS uq_bongi_gifts_source_sale;
CREATE UNIQUE INDEX uq_bongi_gifts_source_sale ON bongi_gifts(source_sale_table, source_sale_id)
  WHERE source_sale_table IS NOT NULL AND source_sale_id IS NOT NULL;

-- 3. 트리거 함수 — NEW.id::text 명시 캐스팅
CREATE OR REPLACE FUNCTION trg_sales_to_gift_func() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_phone text; v_amount int; v_existing int;
BEGIN
  IF NEW.status <> 'completed' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' THEN RETURN NEW; END IF;
  v_phone := NEW.customer_phone;
  IF v_phone IS NULL OR v_phone = '' THEN RETURN NEW; END IF;
  v_amount := COALESCE(NEW.payback_snapshot, 0);
  SELECT count(*) INTO v_existing FROM bongi_gifts
    WHERE source_sale_table = TG_TABLE_NAME AND source_sale_id = NEW.id::text;
  IF v_existing > 0 THEN RETURN NEW; END IF;
  INSERT INTO bongi_gifts (phone, amount, status, source_sale_table, source_sale_id, created_at)
  VALUES (v_phone, v_amount,
    CASE WHEN EXISTS(SELECT 1 FROM bongi_user_profiles WHERE phone = v_phone) THEN '지급대기' ELSE '비회원대기' END,
    TG_TABLE_NAME, NEW.id::text, NOW());
  RETURN NEW;
END; $$;

-- 4. 데브 status constraint 통일 (한글 6종 — 라이브 기준)
-- 라이브엔 이미 있고 데브에선 영문이라 통일 필요
ALTER TABLE bongi_gifts DROP CONSTRAINT IF EXISTS bongi_gifts_status_check;
ALTER TABLE bongi_gifts ADD CONSTRAINT bongi_gifts_status_check
  CHECK (status = ANY (ARRAY['지급대기','지급완료','보류','비회원대기','실패','취소']));

-- 5. 누락 백필 — completed sales 중 gifts에 없는 것 모두 INSERT
INSERT INTO bongi_gifts (phone, amount, status, source_sale_table, source_sale_id, created_at)
SELECT s.customer_phone, COALESCE(s.payback_snapshot, 0),
  CASE WHEN EXISTS(SELECT 1 FROM bongi_user_profiles WHERE phone = s.customer_phone)
       THEN '지급대기' ELSE '비회원대기' END,
  'incentive_sales', s.id::text, COALESCE(s.contract_completed_at, s.updated_at, s.created_at)
FROM incentive_sales s
WHERE s.status='completed' AND s.customer_phone IS NOT NULL AND s.customer_phone <> ''
  AND NOT EXISTS(SELECT 1 FROM bongi_gifts g
    WHERE g.source_sale_table='incentive_sales' AND g.source_sale_id = s.id::text);

INSERT INTO bongi_gifts (phone, amount, status, source_sale_table, source_sale_id, created_at)
SELECT s.customer_phone, COALESCE(s.payback_snapshot, 0),
  CASE WHEN EXISTS(SELECT 1 FROM bongi_user_profiles WHERE phone = s.customer_phone)
       THEN '지급대기' ELSE '비회원대기' END,
  'rental_sales', s.id::text, COALESCE(s.contract_completed_at, s.updated_at, s.created_at)
FROM rental_sales s
WHERE s.status='completed' AND s.customer_phone IS NOT NULL AND s.customer_phone <> ''
  AND NOT EXISTS(SELECT 1 FROM bongi_gifts g
    WHERE g.source_sale_table='rental_sales' AND g.source_sale_id = s.id::text);

COMMIT;

-- ─── 검증 ────────────────────────────────────────────────
-- SELECT count(*) FROM bongi_gifts WHERE source_sale_table IS NOT NULL;
-- → 라이브 8건 / 데브 9건 (백필 후 모든 completed sales 매칭)

-- ─── 롤백 ────────────────────────────────────────────────
-- BEGIN;
-- ALTER TABLE bongi_gifts ALTER COLUMN source_sale_id TYPE bigint USING source_sale_id::bigint;
-- (백필된 uuid는 캐스팅 실패 — 먼저 DELETE 필요)
-- COMMIT;
