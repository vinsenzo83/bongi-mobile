-- ════════════════════════════════════════════════════════════════
-- rental_recalc_margins_and_premium() 재작성 — 정책 통일 스키마 정합
-- 기존 RPC 가 옛 컬럼(is_active·tier_s_min_rebate·premium_min_rebate)을
-- 참조해 실행 불가였음. 현 rental_policy 스키마(active·tier_*_min_margin·
-- premium_margin_threshold·tier_to_p)로 재작성.
-- 공식: 어드민 가전렌탈 옵션 테이블의 검증된 2-step 자동계산과 동일.
--   1) 임시 P=1.5 → tempMargin = rebate×0.9 − payback − 1.5×wc
--   2) tempMargin → tempTier(margin 기준) → P = tier_to_p[tempTier]
--   3) finalMargin = rebate×0.9 − payback − round(P×wc) → tier_calculated
--   상품: 옵션 최종마진 최대값 기준 tier·is_premium·point_weight
-- 적용: 데브(sesgdqbmophgmombelmn) → 검증 → 라이브(dugaqvvnhsgenhmhuyju)
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.rental_recalc_margins_and_premium()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_policy rental_policy;
  v_wc numeric; v_smin int; v_amin int; v_bmin int; v_prem int;
  v_ttp jsonb;
  v_opts int := 0; v_prods int := 0; v_premium int := 0;
BEGIN
  SELECT * INTO v_policy FROM rental_policy WHERE active = true LIMIT 1;
  IF v_policy IS NULL THEN RETURN jsonb_build_object('error', 'no active policy'); END IF;
  v_wc   := COALESCE(v_policy.weight_cost_per_p, 70000);
  v_smin := COALESCE(v_policy.tier_s_min_margin, 200000);
  v_amin := COALESCE(v_policy.tier_a_min_margin, 150000);
  v_bmin := COALESCE(v_policy.tier_b_min_margin, 100000);
  v_prem := COALESCE(v_policy.premium_margin_threshold, 130000);
  v_ttp  := COALESCE(v_policy.tier_to_p, '{"S":2,"A":1.5,"B":1.2,"C":1}'::jsonb);

  -- ── 옵션: 2-step 자동 계산 (어드민 optRow 공식과 동일) ──
  WITH base AS (
    SELECT o.id, o.rebate, o.payback, o.margin_manual_override, o.margin AS cur_margin,
      ROUND(COALESCE(o.rebate,0) * 0.9 - COALESCE(o.payback,0) - 1.5 * v_wc) AS temp_margin
    FROM rental_product_options o WHERE o.is_active = true
  ),
  step3 AS (
    SELECT b.*,
      COALESCE((v_ttp ->> (CASE
        WHEN b.temp_margin >= v_smin THEN 'S' WHEN b.temp_margin >= v_amin THEN 'A'
        WHEN b.temp_margin >= v_bmin THEN 'B' ELSE 'C' END))::numeric, 1.0) AS p_auto
    FROM base b
  ),
  step4 AS (
    SELECT s.id, s.p_auto, s.margin_manual_override, s.cur_margin,
      ROUND(COALESCE(s.rebate,0) * 0.9 - COALESCE(s.payback,0) - ROUND(s.p_auto * v_wc)) AS final_margin
    FROM step3 s
  ),
  upd AS (
    UPDATE rental_product_options o SET
      point_weight = s4.p_auto,
      margin = CASE WHEN COALESCE(o.margin_manual_override, false) AND o.margin IS NOT NULL
                    THEN o.margin ELSE s4.final_margin END,
      tier_calculated = CASE
        WHEN s4.final_margin >= v_smin THEN 'S' WHEN s4.final_margin >= v_amin THEN 'A'
        WHEN s4.final_margin >= v_bmin THEN 'B' ELSE 'C' END,
      updated_at = now()
    FROM step4 s4 WHERE o.id = s4.id
    RETURNING o.id
  )
  SELECT COUNT(*) INTO v_opts FROM upd;

  -- ── 상품: 옵션 최종마진 최대값 기준 tier·is_premium·point_weight ──
  WITH pmax AS (
    SELECT product_id, MAX(margin) AS max_margin
    FROM rental_product_options WHERE is_active = true GROUP BY product_id
  ),
  updp AS (
    UPDATE rental_products rp SET
      tier = CASE
        WHEN COALESCE(pm.max_margin,0) >= v_smin THEN 'S' WHEN COALESCE(pm.max_margin,0) >= v_amin THEN 'A'
        WHEN COALESCE(pm.max_margin,0) >= v_bmin THEN 'B' ELSE 'C' END,
      is_premium = (COALESCE(pm.max_margin,0) >= v_prem),
      point_weight = COALESCE((v_ttp ->> (CASE
        WHEN COALESCE(pm.max_margin,0) >= v_smin THEN 'S' WHEN COALESCE(pm.max_margin,0) >= v_amin THEN 'A'
        WHEN COALESCE(pm.max_margin,0) >= v_bmin THEN 'B' ELSE 'C' END))::numeric, 1.0),
      updated_at = now()
    FROM pmax pm WHERE rp.id = pm.product_id
    RETURNING rp.id, rp.is_premium
  )
  SELECT COUNT(*), COUNT(*) FILTER (WHERE is_premium) INTO v_prods, v_premium FROM updp;

  RETURN jsonb_build_object('ok', true, 'tier_basis', 'margin', 'premium_basis', 'margin',
    'updated_options', v_opts, 'updated_products', v_prods, 'premium_products', v_premium);
END; $function$;

-- for-recommend RPC EXECUTE 권한 (등록폼 검증 중 누락 발견 — 같이 복구)
GRANT EXECUTE ON FUNCTION public.rental_products_for_recommend() TO anon, authenticated, service_role;
