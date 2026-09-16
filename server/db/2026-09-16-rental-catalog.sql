-- ═══════════════════════════════════════════════════════════════
-- 렌탈 상품 카탈로그 v2 — 빌리고 월별 엑셀 일괄 적재 + 조건별 가이드·MAX
--   · 옛 rental_* (08-24 라이브 삭제, 데브 잔존) 와 이름이 겹치지 않게 rental_cat_* 사용
--   · 조건(offer) 1행 = 렌탈사·모델·약정·의무·소유·관리·주기·할인유형 조합
--   · 월 렌탈료·리베이트는 엑셀 import 가 갱신, 가이드·MAX 는 사람이 정하고 import 가 절대 덮지 않는다
--   · 고객에게는 가이드를 금액이 아닌 "N개월 무료"(free_months)로만 노출
-- ═══════════════════════════════════════════════════════════════

-- 1. 렌탈사 ─────────────────────────────────────
create table if not exists rental_cat_suppliers (
  id                text primary key,               -- 'coway', 'cuckoo', 'lg-hello' …
  name              text not null unique,           -- 엑셀 표기 (코웨이, 쿠쿠 …)
  file_kind         text not null,                  -- water | appliance
  commission_rules  jsonb not null default '[]',    -- 가전 수수료율 규칙 [{subtype,basis,value,label}]
  signup_policy     jsonb,                          -- 가입기준(연령·신용·서류·결제일·신청필드)
  signup_policy_as_of text,                         -- '2026-09'
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- 2. import 배치 (파일 1개 = 배치 1개) ───────────
create table if not exists rental_cat_batches (
  id            uuid primary key default gen_random_uuid(),
  month         text not null,                      -- '2026-09'
  file_kind     text not null,                      -- water | appliance
  file_name     text not null,
  file_hash     text not null,
  status        text not null default 'preview',    -- preview | committed | discarded
  sheet_report  jsonb not null default '[]',        -- 시트별 data/offers/skipped/missing
  diff_summary  jsonb,                              -- {new, changed, removed, unchanged, rebate_changed}
  created_by    text,
  committed_by  text,
  committed_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists rental_cat_batches_month_idx on rental_cat_batches (month, file_kind);

-- 3. 모델(상품) ───────────────────────────────────
create table if not exists rental_cat_models (
  id                  uuid primary key default gen_random_uuid(),
  supplier_id         text not null references rental_cat_suppliers(id),
  model_key           text not null,                -- 정규화 모델코드
  model_code          text,
  product_name        text,
  brand               text,
  category            text,                         -- 정규화 카테고리 slug
  category_raw        text,
  image_url           text,
  specs               jsonb not null default '{}',
  status              text not null default 'active',  -- active | paused | discontinued
  -- 플랫폼 어드민 연동 (선택 상품만)
  platform_linked     boolean not null default false,
  platform_product_id text,
  platform_synced_at  timestamptz,
  first_batch_id      uuid references rental_cat_batches(id),
  last_batch_id       uuid references rental_cat_batches(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (supplier_id, model_key)
);
create index if not exists rental_cat_models_search_idx on rental_cat_models (category, brand);

-- 4. 조건(offer) ──────────────────────────────────
create table if not exists rental_cat_offers (
  id                uuid primary key default gen_random_uuid(),
  model_id          uuid not null references rental_cat_models(id) on delete cascade,
  supplier_id       text not null references rental_cat_suppliers(id),
  condition_key     text not null unique,
  variant_code      text,
  contract_months   int,
  obligation_months int,
  ownership_months  int,
  care_type         text,                           -- visit | self | delivery | none
  care_label        text,
  cycle_months      int,
  offer_type        text not null default 'normal', -- normal|package|bundle|trade_in|half|prepay|promo|special|field|staff|purchase
  offer_tags        text[] not null default '{}',
  offer_label       text,
  -- 가격 (엑셀)
  monthly_fee       int,                            -- 할인 종료 후 기준 월 렌탈료
  price_phases      jsonb not null default '[]',    -- [{from,to,fee}]
  display_fee       int,                            -- 고객 화면 대표 월요금(1개월차 요금)
  prepay_amount     int,
  total_fee         bigint,
  -- 리베이트 (엑셀, 관리자 전용)
  rebate            int,
  rebate_basis      text,                           -- amount | rate_total | flat | multiple_monthly
  rebate_rate       numeric(8,5),
  rebate_detail     jsonb,
  rebate_changed    boolean not null default false, -- 직전 배치 대비 리베이트 변동 → 가이드 재검토 표시
  -- 가이드·MAX (사람이 설정, import 불가침)
  guide_payout      int,
  max_payout        int,
  payout_updated_by text,
  payout_updated_at timestamptz,
  free_months       int generated always as (
                      case when guide_payout is not null and display_fee > 0
                           then guide_payout / display_fee end) stored,
  -- 운영
  status            text not null default 'active', -- active | paused | discontinued
  crm_enabled       boolean not null default true,
  valid_from        date,
  valid_to          date,
  notes             text,
  source            jsonb,                          -- {sheet,row,file,month}
  first_batch_id    uuid references rental_cat_batches(id),
  last_batch_id     uuid references rental_cat_batches(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint rental_cat_offers_payout_chk check (
    guide_payout is null or max_payout is null or max_payout >= guide_payout)
);
create index if not exists rental_cat_offers_model_idx on rental_cat_offers (model_id, status);
create index if not exists rental_cat_offers_supplier_idx on rental_cat_offers (supplier_id, offer_type);

-- 5. 조건 변경 이력 (월별 비교·되돌리기 근거) ────
create table if not exists rental_cat_offer_changes (
  id          bigserial primary key,
  offer_id    uuid references rental_cat_offers(id) on delete cascade,
  batch_id    uuid references rental_cat_batches(id),
  change_type text not null,                        -- new | changed | removed | reappeared | payout
  before      jsonb,
  after       jsonb,
  changed_by  text,
  created_at  timestamptz not null default now()
);
create index if not exists rental_cat_offer_changes_offer_idx on rental_cat_offer_changes (offer_id, created_at desc);

-- 6. 프로모션 (엑셀 셀 밖: 이미지·PDF 공지. 자주 바뀌므로 기간 필수) ─
create table if not exists rental_cat_promotions (
  id            uuid primary key default gen_random_uuid(),
  supplier_id   text not null references rental_cat_suppliers(id),
  title         text not null,
  summary       text,                               -- 상담원용 한줄 요약
  benefit       jsonb,                              -- 구조화 가능한 혜택(할인율·반값개월표 등)
  targets       jsonb,                              -- {categories:[], model_keys:[], customer:'신규렌탈'}
  stacking      jsonb,                              -- {동시구매:false, 선납:true, …}
  period_from   date,
  period_to     date,
  source        jsonb,                              -- {file, page|image}
  attachments   jsonb not null default '[]',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists rental_cat_promotions_period_idx on rental_cat_promotions (supplier_id, period_from, period_to);

-- 서버(service role)만 접근. anon/authenticated 정책 없음
alter table rental_cat_suppliers      enable row level security;
alter table rental_cat_batches        enable row level security;
alter table rental_cat_models         enable row level security;
alter table rental_cat_offers         enable row level security;
alter table rental_cat_offer_changes  enable row level security;
alter table rental_cat_promotions     enable row level security;

-- 7. 모델 목록용 요약 뷰 (상품관리·상담 검색) ─────
create or replace view rental_cat_model_summary with (security_invoker = true) as
select m.*,
       s.name                                                        as supplier_name,
       count(o.id) filter (where o.status <> 'discontinued')          as offer_count,
       count(o.id) filter (where o.status <> 'discontinued' and o.guide_payout is not null) as payout_set_count,
       count(o.id) filter (where o.rebate_changed)                    as rebate_changed_count,
       min(o.display_fee) filter (where o.status = 'active')          as min_display_fee,
       max(o.free_months) filter (where o.status = 'active')          as max_free_months
from rental_cat_models m
join rental_cat_suppliers s on s.id = m.supplier_id
left join rental_cat_offers o on o.model_id = m.id
group by m.id, s.name;

-- 8. 티켓번호 — 조건(offer)마다 1개, R + 6자리. 조건키가 같으면 월이 바뀌어도 유지, 단종돼도 재사용 안 함 ──
create sequence if not exists rental_cat_ticket_seq;
alter table rental_cat_offers add column if not exists ticket_number text unique not null
  default ('R' || lpad(nextval('rental_cat_ticket_seq')::text, 6, '0'));

-- 9. 가이드·MAX 일괄 규칙 (마진율) — 수만 건을 한 번에, 이력 포함
--    기준리베이트: basis='supply' → 리베이트/1.1 (VAT 미포함), 'vat' → 리베이트 그대로
--    MAX   = 기준 × (1 − p_margin)        천원 버림
--    가이드 = 기준 × (1 − p_guide_margin)  만원 버림 (p_guide_margin 없으면 MAX 를 만원 버림), MAX 를 넘지 않음
--    모요 역산(2026-09-16, 102조건): 지원금 ≈ 공급가 × 67% → 가이드 마진 33% 가 모요 수준
create or replace function rental_cat_apply_margin(
  p_margin numeric, p_basis text default 'supply', p_supplier text default null,
  p_only_unset boolean default false, p_dry_run boolean default true, p_user text default null,
  p_guide_margin numeric default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_count int; v_sample jsonb; v_label text;
begin
  if p_margin < 0 or p_margin >= 1 then raise exception 'margin 은 0 이상 1 미만'; end if;
  if p_guide_margin is not null and (p_guide_margin < p_margin or p_guide_margin >= 1) then raise exception '가이드 마진은 MAX 마진 이상 1 미만'; end if;
  create temp table _calc on commit drop as
    select o.id, o.ticket_number, o.guide_payout old_g, o.max_payout old_m, o.rebate, o.display_fee,
      case when p_basis = 'vat' then o.rebate::numeric else o.rebate / 1.1 end base
    from rental_cat_offers o
    where o.status <> 'discontinued' and o.rebate is not null and o.rebate > 0
      and (p_supplier is null or o.supplier_id = p_supplier)
      and (not p_only_unset or o.guide_payout is null);
  alter table _calc add column new_m int, add column new_g int;
  update _calc set new_m = (floor(base * (1 - p_margin) / 1000) * 1000)::int where true;
  update _calc set new_g = least(new_m, (floor(base * (1 - coalesce(p_guide_margin, p_margin)) / 10000) * 10000)::int) where true;
  update _calc set new_g = (floor(new_g / 10000.0) * 10000)::int where true;
  select count(*) into v_count from _calc;
  select coalesce(jsonb_agg(to_jsonb(s)), '[]') into v_sample from (select ticket_number, rebate, display_fee, old_g, old_m, new_g, new_m,
    case when display_fee > 0 then new_g / display_fee end free_months from _calc order by random() limit 12) s;
  v_label := coalesce(p_user, 'rule') || ' · 가이드 마진 ' || round(coalesce(p_guide_margin, p_margin) * 100, 2) || '% · MAX 마진 ' || round(p_margin * 100, 2) || '% (' || p_basis || ')';
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

-- 10. 상품관리 요약
create or replace function rental_cat_stats() returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'models', (select count(*) from rental_cat_models),
    'offers', count(*) filter (where status <> 'discontinued'),
    'active', count(*) filter (where status = 'active'),
    'payout_set', count(*) filter (where status <> 'discontinued' and guide_payout is not null),
    'payout_unset', count(*) filter (where status <> 'discontinued' and guide_payout is null),
    'rebate_changed', count(*) filter (where rebate_changed),
    'discontinued', count(*) filter (where status = 'discontinued'),
    'linked_models', (select count(*) from rental_cat_models where platform_linked))
  from rental_cat_offers;
$$;
revoke all on function rental_cat_stats from public, anon, authenticated;

-- 11. 관리자 상태 고정 · 엑셀 원본 상태 분리 · 관리자 메모 (월 import 가 사람 결정을 덮지 않게)
alter table rental_cat_offers add column if not exists source_status text;          -- 엑셀 원본 판매상태
alter table rental_cat_offers add column if not exists status_locked boolean not null default false;  -- true 면 import 가 status 를 바꾸지 않음
alter table rental_cat_offers add column if not exists admin_notes text;            -- 관리자 메모 (notes 는 엑셀 비고)
update rental_cat_offers set source_status = status where source_status is null;
alter table rental_cat_offers drop constraint if exists rental_cat_offers_status_chk;
alter table rental_cat_offers add constraint rental_cat_offers_status_chk check (status in ('active','paused','discontinued'));
