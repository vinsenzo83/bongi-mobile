-- 2026-05-25  고객관리 통합 view + 자동 sync trigger
-- 본질: N채널 lead → 전화번호 통합 → TM 콜 close → 마이페이지 즉시 반영
-- 참고: docs/specs/customer-mgmt.md PRD §5, §6, §9
--
-- 변경:
-- 1) 인덱스 4개 (phone 매칭 성능)
-- 2) vw_unified_customer view (incentive_customer_db 기준 14테이블 join)
-- 3) trg_sales_to_gift trigger 2개 (incentive_sales / rental_sales status='completed' → bongi_gifts auto-insert)

BEGIN;

-- ─── 1. 인덱스 (전화번호 master key 성능) ───────────────────────────
CREATE INDEX IF NOT EXISTS idx_incentive_sales_phone_status ON incentive_sales(customer_phone, status);
CREATE INDEX IF NOT EXISTS idx_rental_sales_phone_status ON rental_sales(customer_phone, status);
CREATE INDEX IF NOT EXISTS idx_bongi_user_profiles_phone ON bongi_user_profiles(phone);
CREATE INDEX IF NOT EXISTS idx_bongi_gifts_phone_status ON bongi_gifts(phone, status);
CREATE INDEX IF NOT EXISTS idx_bongi_apps_phone ON bongi_applications(phone);
CREATE INDEX IF NOT EXISTS idx_bongi_used_phone_customer ON bongi_used_phone_buyback(customer_phone);
CREATE INDEX IF NOT EXISTS idx_call_log_customer_id ON incentive_customer_call_log(customer_id);

-- ─── 2. 통합 view ────────────────────────────────────────────────
DROP VIEW IF EXISTS vw_unified_customer CASCADE;
CREATE VIEW vw_unified_customer AS
SELECT
  cdb.phone,                                                    -- master key
  cdb.id                                          AS calldb_id,
  cdb.name                                        AS calldb_name,
  cdb.age, cdb.gender, cdb.region, cdb.carrier,
  cdb.notes,
  cdb.call_status,
  cdb.priority_score,
  cdb.assigned_agent_id,
  cdb.assigned_at,
  cdb.imported_at,
  cdb.call_count                                  AS calldb_call_count,
  cdb.last_contacted_at,
  cdb.next_retry_at,
  cdb.callback_at,
  cdb.reject_reason,
  cdb.is_dnt,

  -- 회원 매칭 (bongi_user_profiles)
  bup.id                                          AS user_id,
  bup.display_name                                AS member_name,
  (bup.id IS NOT NULL)                            AS is_app_member,
  (bup.verified_at IS NOT NULL)                   AS pass_verified,
  bup.social_provider,
  bup.user_type                                   AS member_user_type,
  bup.channel                                     AS member_channel,
  bup.referral_code,
  bup.referred_by,
  bup.point_balance                               AS cash_balance,

  -- 통화 집계 (incentive_customer_call_log)
  (SELECT count(*) FROM incentive_customer_call_log cl
    WHERE cl.customer_id = cdb.id)                AS call_attempts,
  (SELECT max(called_at) FROM incentive_customer_call_log cl
    WHERE cl.customer_id = cdb.id)                AS last_call_at,

  -- 영업 집계 (4상품)
  (SELECT count(*) FROM incentive_sales s
    WHERE s.customer_phone = cdb.phone
      AND s.status = 'completed')                 AS it_sales_completed,
  (SELECT count(*) FROM incentive_sales s
    WHERE s.customer_phone = cdb.phone
      AND s.status IN ('pending','in_progress'))  AS it_sales_progress,
  (SELECT count(*) FROM rental_sales rs
    WHERE rs.customer_phone = cdb.phone
      AND rs.status = 'completed')                AS rental_sales_completed,
  (SELECT count(*) FROM rental_sales rs
    WHERE rs.customer_phone = cdb.phone
      AND rs.status IN ('pending','in_progress')) AS rental_sales_progress,
  (SELECT count(*) FROM bongi_used_phone_buyback bb
    WHERE bb.customer_phone = cdb.phone)          AS usedphone_count,
  (SELECT count(*) FROM bongi_applications ba
    WHERE ba.phone = cdb.phone)                   AS bongi_app_count,

  -- 금융 lifecycle (phone 직접)
  (SELECT count(*) FROM bongi_gifts g
    WHERE g.phone = cdb.phone
      AND g.status = '지급대기')                  AS gifts_pending,
  (SELECT coalesce(sum(amount), 0) FROM bongi_gifts g
    WHERE g.phone = cdb.phone)                    AS gifts_total_amount,
  (SELECT count(*) FROM bongi_gifts g
    WHERE g.phone = cdb.phone
      AND g.status = '지급완료')                  AS gifts_paid_count,

  -- 금융 lifecycle (user_id 매개)
  (SELECT count(*) FROM bongi_rewards r
    WHERE r.user_id = bup.id)                     AS rewards_count,
  (SELECT count(*) FROM bongi_user_alarms a
    WHERE a.user_id = bup.id)                     AS alarms_count,

  -- rotting (lead age 일 단위)
  EXTRACT(DAY FROM (NOW() - cdb.imported_at))::int AS lead_age_days
FROM incentive_customer_db cdb
LEFT JOIN bongi_user_profiles bup ON bup.phone = cdb.phone;

COMMENT ON VIEW vw_unified_customer IS
  '고객관리 페이지 — 전화번호 master key로 통합한 360° view (PRD docs/specs/customer-mgmt.md)';

GRANT SELECT ON vw_unified_customer TO anon, authenticated;

-- ─── 3. 자동 sync trigger (계약 close → 마이페이지 즉시 반영) ────────
-- incentive_sales / rental_sales status='completed' 되면 bongi_gifts 자동 insert.
-- 본질: TM CRM 콜로 close → 고객 마이페이지에 즉시 현금페이백 표시.

CREATE OR REPLACE FUNCTION trg_sales_to_gift_func() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text;
  v_amount int;
  v_existing int;
BEGIN
  -- 신규 completed 전이만 처리
  IF NEW.status <> 'completed' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' THEN RETURN NEW; END IF;

  v_phone := NEW.customer_phone;
  IF v_phone IS NULL OR v_phone = '' THEN RETURN NEW; END IF;

  -- 페이백 금액 (table별 컬럼명 차이 흡수)
  IF TG_TABLE_NAME = 'incentive_sales' THEN
    v_amount := COALESCE(NEW.payback_snapshot, 0);
  ELSIF TG_TABLE_NAME = 'rental_sales' THEN
    v_amount := COALESCE(NEW.payback_snapshot, 0);
  ELSE
    v_amount := 0;
  END IF;

  -- 중복 방지 — 같은 sale_id로 이미 insert됐는지
  SELECT count(*) INTO v_existing FROM bongi_gifts
    WHERE source_sale_table = TG_TABLE_NAME AND source_sale_id = NEW.id;
  IF v_existing > 0 THEN RETURN NEW; END IF;

  -- 비회원 여부에 따라 status 분기
  INSERT INTO bongi_gifts (phone, amount, status, source_sale_table, source_sale_id, created_at)
  VALUES (
    v_phone,
    v_amount,
    CASE WHEN EXISTS(SELECT 1 FROM bongi_user_profiles WHERE phone = v_phone)
         THEN '지급대기' ELSE '비회원대기' END,
    TG_TABLE_NAME,
    NEW.id,
    NOW()
  );

  RETURN NEW;
END;
$$;

-- bongi_gifts 테이블에 source_sale_table·source_sale_id 컬럼 추가 (중복 방지 키)
ALTER TABLE bongi_gifts ADD COLUMN IF NOT EXISTS source_sale_table text;
ALTER TABLE bongi_gifts ADD COLUMN IF NOT EXISTS source_sale_id bigint;
CREATE UNIQUE INDEX IF NOT EXISTS uq_bongi_gifts_source_sale
  ON bongi_gifts(source_sale_table, source_sale_id)
  WHERE source_sale_table IS NOT NULL AND source_sale_id IS NOT NULL;

-- trigger 부착
DROP TRIGGER IF EXISTS trg_incentive_sales_to_gift ON incentive_sales;
CREATE TRIGGER trg_incentive_sales_to_gift
  AFTER INSERT OR UPDATE OF status ON incentive_sales
  FOR EACH ROW EXECUTE FUNCTION trg_sales_to_gift_func();

DROP TRIGGER IF EXISTS trg_rental_sales_to_gift ON rental_sales;
CREATE TRIGGER trg_rental_sales_to_gift
  AFTER INSERT OR UPDATE OF status ON rental_sales
  FOR EACH ROW EXECUTE FUNCTION trg_sales_to_gift_func();

COMMIT;

-- ─── 롤백 ────────────────────────────────────────────────────────
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_incentive_sales_to_gift ON incentive_sales;
-- DROP TRIGGER IF EXISTS trg_rental_sales_to_gift ON rental_sales;
-- DROP FUNCTION IF EXISTS trg_sales_to_gift_func();
-- DROP INDEX IF EXISTS uq_bongi_gifts_source_sale;
-- ALTER TABLE bongi_gifts DROP COLUMN IF EXISTS source_sale_table;
-- ALTER TABLE bongi_gifts DROP COLUMN IF EXISTS source_sale_id;
-- DROP VIEW IF EXISTS vw_unified_customer;
-- 인덱스는 유지 (성능)
-- COMMIT;
