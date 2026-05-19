-- ROLLBACK for: 2026-05-18-product-history-trigger-gift-tier.sql
-- 적용 일자: 2026-05-18
-- 주의: 이 함수는 CREATE OR REPLACE — 이전 버전 복원은 별도 SQL 필요.
--       아래는 gift_amount + tier 추적이 빠진 이전 추정 버전으로 복원.
--       실제 이전 버전이 다르면 코드 저장소 git log에서 추출 필요.
--       그냥 DROP FUNCTION만 하면 incentive_products UPDATE 시 트리거 에러 발생 가능.
-- 사용: psql $DATABASE_URL < this_file.sql

BEGIN;

-- 이전 버전 (gift_amount, tier 추적 없음) 복원
CREATE OR REPLACE FUNCTION public.incentive_log_product_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF OLD.rebate IS DISTINCT FROM NEW.rebate THEN
    INSERT INTO incentive_product_history (product_id, field_name, old_value, new_value, snapshot_rebate, snapshot_payback, snapshot_point_weight, snapshot_margin, snapshot_tier, snapshot_active)
    VALUES (NEW.id, 'rebate', OLD.rebate::TEXT, NEW.rebate::TEXT, OLD.rebate, OLD.payback, OLD.point_weight, OLD.margin, OLD.tier, OLD.active);
  END IF;
  IF OLD.payback IS DISTINCT FROM NEW.payback THEN
    INSERT INTO incentive_product_history (product_id, field_name, old_value, new_value, snapshot_rebate, snapshot_payback, snapshot_point_weight, snapshot_margin, snapshot_tier, snapshot_active)
    VALUES (NEW.id, 'payback', OLD.payback::TEXT, NEW.payback::TEXT, OLD.rebate, OLD.payback, OLD.point_weight, OLD.margin, OLD.tier, OLD.active);
  END IF;
  IF OLD.point_weight IS DISTINCT FROM NEW.point_weight THEN
    INSERT INTO incentive_product_history (product_id, field_name, old_value, new_value, snapshot_rebate, snapshot_payback, snapshot_point_weight, snapshot_margin, snapshot_tier, snapshot_active)
    VALUES (NEW.id, 'point_weight', OLD.point_weight::TEXT, NEW.point_weight::TEXT, OLD.rebate, OLD.payback, OLD.point_weight, OLD.margin, OLD.tier, OLD.active);
  END IF;
  IF OLD.active IS DISTINCT FROM NEW.active THEN
    INSERT INTO incentive_product_history (product_id, field_name, old_value, new_value, snapshot_rebate, snapshot_payback, snapshot_point_weight, snapshot_margin, snapshot_tier, snapshot_active)
    VALUES (NEW.id, 'active', OLD.active::TEXT, NEW.active::TEXT, OLD.rebate, OLD.payback, OLD.point_weight, OLD.margin, OLD.tier, OLD.active);
  END IF;
  IF OLD.name IS DISTINCT FROM NEW.name THEN
    INSERT INTO incentive_product_history (product_id, field_name, old_value, new_value, snapshot_rebate, snapshot_payback, snapshot_point_weight, snapshot_margin, snapshot_tier, snapshot_active)
    VALUES (NEW.id, 'name', OLD.name, NEW.name, OLD.rebate, OLD.payback, OLD.point_weight, OLD.margin, OLD.tier, OLD.active);
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
