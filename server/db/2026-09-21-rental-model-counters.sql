-- 렌탈 카탈로그 — 모델 요약 집계 상주화 (2026-09-21)
-- 문제: rental_cat_model_summary 가 조회 때마다 8,035 모델 × 55,910 조건을 전부 집계.
--       필터 없는 기본 목록(/agent/models, /models)은 8s statement_timeout 을 초과해 500.
-- 해결: 집계값을 rental_cat_models 에 컬럼으로 상주시키고, 조건 변경 시 statement 트리거로 동기화.
--       뷰의 출력 컬럼/의미는 그대로 유지(호출부 변경 없음).

-- 0. 기존 뷰 제거 (컬럼 구성이 바뀌어 create or replace 불가, 의존 객체 없음 확인함) ──
drop view if exists rental_cat_model_summary;

-- 1. 집계 컬럼 ─────────────────────────────────────────────
alter table rental_cat_models
  add column if not exists offer_count          int not null default 0,
  add column if not exists payout_set_count     int not null default 0,
  add column if not exists rebate_changed_count int not null default 0,
  add column if not exists min_display_fee      int,
  add column if not exists max_free_months      int;

-- 2. 동기화 함수 — 대상 모델만 재계산 (statement 단위 일괄) ──
create or replace function rental_cat_sync_model_counters(p_ids uuid[])
returns int language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if p_ids is null or array_length(p_ids, 1) is null then return 0; end if;
  with agg as (
    select x.id,
           count(o.id) filter (where o.status <> 'discontinued')                                    as offer_count,
           count(o.id) filter (where o.status <> 'discontinued' and o.guide_payout is not null)     as payout_set_count,
           count(o.id) filter (where o.rebate_changed)                                              as rebate_changed_count,
           min(o.display_fee) filter (where o.status = 'active')                                    as min_display_fee,
           max(o.free_months) filter (where o.status = 'active')                                    as max_free_months
    from (select distinct unnest(p_ids) as id) x
    left join rental_cat_offers o on o.model_id = x.id
    group by x.id)
  update rental_cat_models m
     set offer_count          = agg.offer_count,
         payout_set_count     = agg.payout_set_count,
         rebate_changed_count = agg.rebate_changed_count,
         min_display_fee      = agg.min_display_fee,
         max_free_months      = agg.max_free_months
    from agg
   where m.id = agg.id
     and (m.offer_count, m.payout_set_count, m.rebate_changed_count, m.min_display_fee, m.max_free_months)
         is distinct from
         (agg.offer_count::int, agg.payout_set_count::int, agg.rebate_changed_count::int, agg.min_display_fee, agg.max_free_months);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- 3. 트리거 (statement 단위 — 대량 적재/엔진 일괄 갱신에도 1회만) ──
create or replace function rental_cat_offers_counters_trg()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform rental_cat_sync_model_counters(array(select distinct model_id from new_rows where model_id is not null));
  elsif tg_op = 'DELETE' then
    perform rental_cat_sync_model_counters(array(select distinct model_id from old_rows where model_id is not null));
  else
    perform rental_cat_sync_model_counters(array(
      select distinct model_id from (select model_id from new_rows union all select model_id from old_rows) t
       where model_id is not null));
  end if;
  return null;
end $$;

drop trigger if exists rental_cat_offers_counters_ins on rental_cat_offers;
drop trigger if exists rental_cat_offers_counters_upd on rental_cat_offers;
drop trigger if exists rental_cat_offers_counters_del on rental_cat_offers;

create trigger rental_cat_offers_counters_ins after insert on rental_cat_offers
  referencing new table as new_rows for each statement execute function rental_cat_offers_counters_trg();
create trigger rental_cat_offers_counters_upd after update on rental_cat_offers
  referencing new table as new_rows old table as old_rows for each statement execute function rental_cat_offers_counters_trg();
create trigger rental_cat_offers_counters_del after delete on rental_cat_offers
  referencing old table as old_rows for each statement execute function rental_cat_offers_counters_trg();

-- 4. 백필 ───────────────────────────────────────────────────
select rental_cat_sync_model_counters(array(select id from rental_cat_models));

-- 5. 뷰 재정의 — 집계 대신 상주 컬럼 사용 (출력 스키마 동일) ──
--    m.* 에 이미 집계 컬럼이 포함되므로 별칭 중복을 피하려 명시적으로 제외하지 않고 그대로 노출한다.
create view rental_cat_model_summary with (security_invoker = true) as
select m.*, s.name as supplier_name
from rental_cat_models m
join rental_cat_suppliers s on s.id = m.supplier_id;

grant all on rental_cat_model_summary to anon, authenticated, service_role;

-- 6. 목록 정렬/필터 보조 인덱스 ──────────────────────────────
create index if not exists rental_cat_models_list_idx
  on rental_cat_models (status, payout_set_count desc, supplier_id, model_key)
  where offer_count > 0;
