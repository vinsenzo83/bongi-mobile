-- 가이드·MAX 엔진 자동 갱신 — 실행 기록·설정·조건별 일괄 반영 (2026-09-17)

create table if not exists rental_engine_settings (
  id int primary key default 1 check (id = 1),
  policy jsonb not null default '{}'::jsonb,       -- buildPayoutPlan 입력 (생산성·재량·배분율·임계값 …)
  auto_apply boolean not null default true,
  cycle text not null default 'weekly_mon_06',     -- 매주 월 06:00 KST + 빌리고 엑셀 확정 직후
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table rental_engine_settings enable row level security;
revoke all on rental_engine_settings from anon, authenticated;
insert into rental_engine_settings (id, policy) values (1, '{"productivity":50,"discretion":0.3,"rate_tiers":[{"min":0,"rate":0.3}],"current_rate":0.2,"competitor_guide_ratio":0.9,"top_sales_share":0.1,"min_guide_delta":10000,"min_max_delta":5000,"min_band":0.05}'::jsonb)
on conflict (id) do nothing;

create table if not exists rental_payout_runs (
  id uuid primary key default gen_random_uuid(),
  engine_version text not null,
  trigger text not null check (trigger in ('manual','weekly','import','preview')),
  policy jsonb not null,
  signals jsonb,
  stats jsonb,
  summary jsonb,
  categories jsonb,
  changed int not null default 0,
  status text not null default 'planned' check (status in ('planned','applied','failed','rolled_back')),
  error text,
  created_by text,
  created_at timestamptz not null default now(),
  applied_at timestamptz
);
alter table rental_payout_runs enable row level security;
revoke all on rental_payout_runs from anon, authenticated;
create index if not exists rental_payout_runs_created_idx on rental_payout_runs (created_at desc);

alter table rental_cat_offer_changes add column if not exists run_id uuid;
create index if not exists rental_cat_offer_changes_run_idx on rental_cat_offer_changes (run_id) where run_id is not null;

-- 조건별 가이드·MAX 반영 (엔진이 계산한 값). 사람이 직접 고친 조건은 서버에서 이미 빼고 보낸다.
-- p_items: [{"id": uuid, "g": int, "m": int, "r": "사유"}]
create or replace function rental_cat_apply_payout_batch(p_items jsonb, p_label text, p_run_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  create temp table _items on commit drop as
    select (x->>'id')::uuid id, (x->>'g')::int g, (x->>'m')::int m, x->>'r' reason from jsonb_array_elements(p_items) x;
  if exists (select 1 from _items where g is null or m is null or g < 0 or m < g or g % 10000 <> 0) then
    raise exception '잘못된 값 (가이드 만원 단위·MAX ≥ 가이드)';
  end if;
  with prev as (
    select o.id, o.guide_payout old_g, o.max_payout old_m, i.g, i.m, i.reason
    from rental_cat_offers o join _items i on i.id = o.id
    where o.status <> 'discontinued' and (o.guide_payout is distinct from i.g or o.max_payout is distinct from i.m)
  ), upd as (
    update rental_cat_offers o set guide_payout = prev.g, max_payout = prev.m, rebate_changed = false,
      payout_updated_by = p_label, payout_updated_at = now(), updated_at = now()
    from prev where o.id = prev.id
    returning o.id
  ), log as (
    insert into rental_cat_offer_changes (offer_id, change_type, changed_by, before, after, run_id)
    select id, 'payout', p_label, jsonb_build_object('guide_payout', old_g, 'max_payout', old_m), jsonb_build_object('guide_payout', g, 'max_payout', m, 'reason', reason), p_run_id from prev
    returning 1
  )
  select count(*) into v_count from upd;
  return v_count;
end $$;
revoke all on function rental_cat_apply_payout_batch from public, anon, authenticated;

-- 실행 되돌리기: 그 실행이 바꾼 조건을 직전 값으로 (그 뒤에 사람이 다시 고친 조건은 건드리지 않음)
create or replace function rental_cat_rollback_payout_run(p_run_id uuid, p_user text)
returns int language plpgsql security definer set search_path = public as $$
declare v_count int; v_label text;
begin
  select 'rollback ' || coalesce(p_user, '') into v_label;
  with ch as (
    select c.offer_id, (c.before->>'guide_payout')::int g, (c.before->>'max_payout')::int m, c.changed_by
    from rental_cat_offer_changes c where c.run_id = p_run_id and c.change_type = 'payout'
  ), upd as (
    update rental_cat_offers o set guide_payout = ch.g, max_payout = ch.m, payout_updated_by = v_label || ' · 엔진 되돌림', payout_updated_at = now(), updated_at = now()
    from ch where o.id = ch.offer_id and o.payout_updated_by = ch.changed_by
    returning o.id
  )
  select count(*) into v_count from upd;
  update rental_payout_runs set status = 'rolled_back' where id = p_run_id;
  return v_count;
end $$;
revoke all on function rental_cat_rollback_payout_run from public, anon, authenticated;
