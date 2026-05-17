-- 상품 변경 이력 트리거 확장: gift_amount, tier 추가 추적
-- 적용 끝: 양쪽 supabase (sesgdq + dugaqv), 2026-05-18

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
  IF OLD.gift_amount IS DISTINCT FROM NEW.gift_amount THEN
    INSERT INTO incentive_product_history (product_id, field_name, old_value, new_value, snapshot_rebate, snapshot_payback, snapshot_point_weight, snapshot_margin, snapshot_tier, snapshot_active)
    VALUES (NEW.id, 'gift_amount', OLD.gift_amount::TEXT, NEW.gift_amount::TEXT, OLD.rebate, OLD.payback, OLD.point_weight, OLD.margin, OLD.tier, OLD.active);
  END IF;
  IF OLD.point_weight IS DISTINCT FROM NEW.point_weight THEN
    INSERT INTO incentive_product_history (product_id, field_name, old_value, new_value, snapshot_rebate, snapshot_payback, snapshot_point_weight, snapshot_margin, snapshot_tier, snapshot_active)
    VALUES (NEW.id, 'point_weight', OLD.point_weight::TEXT, NEW.point_weight::TEXT, OLD.rebate, OLD.payback, OLD.point_weight, OLD.margin, OLD.tier, OLD.active);
  END IF;
  IF OLD.tier IS DISTINCT FROM NEW.tier THEN
    INSERT INTO incentive_product_history (product_id, field_name, old_value, new_value, snapshot_rebate, snapshot_payback, snapshot_point_weight, snapshot_margin, snapshot_tier, snapshot_active)
    VALUES (NEW.id, 'tier', OLD.tier, NEW.tier, OLD.rebate, OLD.payback, OLD.point_weight, OLD.margin, OLD.tier, OLD.active);
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
