-- ════════════════════════════════════════════════════════════════
-- rental_products_for_recommend() RPC — company 정보 추가
-- 가전 그룹은 같은 모델이 N개 렌탈사로 중개되므로, 추천/견적 카드에
-- 렌탈사를 표시해야 상담사가 어느 채널 계약인지 식별 가능.
-- 적용: 라이브(dugaqvvnhsgenhmhuyju) + 데브(sesgdqbmophgmombelmn) 동시
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.rental_products_for_recommend()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id, 'brand', p.brand, 'name', p.name, 'model', p.model, 'product_url', p.product_url,
    'category', jsonb_build_object('slug', c.slug, 'name', c.name, 'product_group', c.product_group),
    'company_id', p.company_id,
    'company', CASE WHEN co.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', co.id, 'name', co.name, 'category_group', co.category_group,
      'commission_method', co.commission_method, 'commission_rate', co.commission_rate
    ) END,
    'is_premium', p.is_premium, 'market_score', p.market_score, 'display_rank', p.display_rank,
    'monthly_fee_min', p.monthly_fee_min, 'monthly_fee_max', p.monthly_fee_max,
    'rebate_max', p.rebate_max, 'option_count', p.option_count,
    'months_available', p.months_available, 'care_services', p.care_services,
    'feature_tags', p.feature_tags, 'recommended_capacity', p.recommended_capacity,
    'recommended_usage', p.recommended_usage, 'specifications', p.specifications,
    'meta_manual_override', p.meta_manual_override, 'auto_filled_at', p.auto_filled_at
  )), '[]'::jsonb)
  FROM rental_products p
  LEFT JOIN rental_categories c ON c.id = p.category_id
  LEFT JOIN rental_companies co ON co.id = p.company_id
  WHERE p.is_active = true AND p.option_count > 0;
$function$;

GRANT EXECUTE ON FUNCTION public.rental_products_for_recommend() TO anon, authenticated, service_role;
