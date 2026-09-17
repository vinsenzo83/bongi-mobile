-- 가이드·MAX 일괄 규칙에 금액 하한 추가 (마진 설계 엔진 1.1.0 과 같은 식)
--   남길 몫(MAX)   = max(공급가 × MAX마진, MAX 금액 하한)            → MAX   = (공급가 − 남길 몫) 천원 버림
--   남길 몫(가이드) = max(공급가 × 가이드마진, 가이드 금액 하한, MAX 몫) → 가이드 = (공급가 − 남길 몫) 만원 버림, MAX 초과 불가
-- 인자가 늘어 기존 시그니처를 지우고 다시 만든다 (이름 인자 호출이 겹치지 않게)
drop function if exists rental_cat_apply_margin(numeric, text, text, boolean, boolean, text, numeric);

create or replace function rental_cat_apply_margin(
  p_margin numeric, p_basis text default 'supply', p_supplier text default null,
  p_only_unset boolean default false, p_dry_run boolean default true, p_user text default null,
  p_guide_margin numeric default null, p_max_floor int default 0, p_guide_floor int default 0)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_count int; v_sample jsonb; v_label text;
begin
  if p_margin < 0 or p_margin >= 1 then raise exception 'margin 은 0 이상 1 미만'; end if;
  if p_guide_margin is not null and (p_guide_margin < p_margin or p_guide_margin >= 1) then raise exception '가이드 마진은 MAX 마진 이상 1 미만'; end if;
  if coalesce(p_max_floor, 0) < 0 or coalesce(p_guide_floor, 0) < 0 then raise exception '금액 하한은 0 이상'; end if;
  create temp table _calc on commit drop as
    select o.id, o.ticket_number, o.guide_payout old_g, o.max_payout old_m, o.rebate, o.display_fee,
      case when p_basis = 'vat' then o.rebate::numeric else o.rebate / 1.1 end base
    from rental_cat_offers o
    where o.status <> 'discontinued' and o.rebate is not null and o.rebate > 0
      and (p_supplier is null or o.supplier_id = p_supplier)
      and (not p_only_unset or o.guide_payout is null);
  alter table _calc add column keep_m numeric, add column keep_g numeric, add column new_m int, add column new_g int;
  update _calc set keep_m = greatest(base * p_margin, coalesce(p_max_floor, 0)) where true;
  update _calc set keep_g = greatest(base * coalesce(p_guide_margin, p_margin), coalesce(p_guide_floor, 0), keep_m) where true;
  update _calc set new_m = greatest(0, floor((base - keep_m) / 1000) * 1000)::int where true;
  update _calc set new_g = greatest(0, least(new_m, floor((base - keep_g) / 10000) * 10000))::int where true;
  select count(*) into v_count from _calc;
  select coalesce(jsonb_agg(to_jsonb(s)), '[]') into v_sample from (select ticket_number, rebate, display_fee, old_g, old_m, new_g, new_m,
    case when display_fee > 0 then new_g / display_fee end free_months from _calc order by random() limit 12) s;
  v_label := coalesce(p_user, 'rule') || ' · 가이드 마진 ' || round(coalesce(p_guide_margin, p_margin) * 100, 2) || '%'
    || case when coalesce(p_guide_floor, 0) > 0 then '(최소 ' || p_guide_floor || '원)' else '' end
    || ' · MAX 마진 ' || round(p_margin * 100, 2) || '%'
    || case when coalesce(p_max_floor, 0) > 0 then '(최소 ' || p_max_floor || '원)' else '' end
    || ' (' || p_basis || ')';
  if not p_dry_run then
    update rental_cat_offers o set guide_payout = c.new_g, max_payout = c.new_m, rebate_changed = false,
      payout_updated_by = v_label, payout_updated_at = now(), updated_at = now()
      from _calc c where o.id = c.id;
    insert into rental_cat_offer_changes (offer_id, change_type, changed_by, before, after)
      select id, 'payout', v_label, jsonb_build_object('guide_payout', old_g, 'max_payout', old_m), jsonb_build_object('guide_payout', new_g, 'max_payout', new_m) from _calc;
  end if;
  return jsonb_build_object('matched', v_count, 'dry_run', p_dry_run, 'samples', v_sample);
end $$;
revoke all on function rental_cat_apply_margin from public, anon, authenticated;
