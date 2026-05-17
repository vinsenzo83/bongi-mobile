-- 인터넷+TV 정책 변경 audit log (가전 rental_policy_history 패턴 동일)
-- 양쪽 supabase 적용 끝 (sesgdq + dugaqv, 2026-05-18)

CREATE TABLE IF NOT EXISTS incentive_rules_history (
  id bigserial PRIMARY KEY,
  rule_id integer NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by_user_id uuid,
  changed_by_name text,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  change_reason text
);
CREATE INDEX IF NOT EXISTS idx_irh_rule_id_changed_at ON incentive_rules_history(rule_id, changed_at DESC);

-- 변경 필드 추적 함수 (가전 동일 + tier_to_p, tier_*_min_margin, weight_cost_per_p 포함)
CREATE OR REPLACE FUNCTION public.incentive_log_rule_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  fields text[] := ARRAY['version','effective_from','base_salary','bonus_per_premium',
    'payback_company_limit','payback_max','premium_margin_threshold','active','notes',
    'manager_override_rate','manager_obligation_count','manager_penalty_partial_min',
    'manager_team_profit_rate_min','manager_v51_enabled',
    'weight_cost_per_p','tier_s_min_margin','tier_a_min_margin','tier_b_min_margin'];
  jsonb_fields text[] := ARRAY['grade_rates','grade_thresholds','tier_to_p'];
  f text; ov text; nv text;
BEGIN
  FOREACH f IN ARRAY fields LOOP
    EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', f, f) INTO ov, nv USING OLD, NEW;
    IF ov IS DISTINCT FROM nv THEN
      INSERT INTO incentive_rules_history(rule_id, field_name, old_value, new_value)
      VALUES (NEW.id, f, ov, nv);
    END IF;
  END LOOP;
  FOREACH f IN ARRAY jsonb_fields LOOP
    EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', f, f) INTO ov, nv USING OLD, NEW;
    IF ov IS DISTINCT FROM nv THEN
      INSERT INTO incentive_rules_history(rule_id, field_name, old_value, new_value)
      VALUES (NEW.id, f, ov, nv);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS incentive_rules_log_change ON incentive_rules;
CREATE TRIGGER incentive_rules_log_change
  AFTER UPDATE ON incentive_rules
  FOR EACH ROW EXECUTE FUNCTION incentive_log_rule_change();
