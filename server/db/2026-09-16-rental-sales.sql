-- ═══════════════════════════════════════════════════════════════
-- 렌탈 계약 — incentive_sales 에 sale_kind='rental' 로 저장
--   · 계산기에서 고른 조건(rental_cat_offers) 과 가이드·MAX·지급액을 스냅샷으로 박제
--   · 렌탈사마다 받는 가입정보가 달라 신청정보·계약진행은 jsonb 로 둔다
--     (필드 정의는 rental_cat_suppliers.signup_policy 에서 온다)
-- ═══════════════════════════════════════════════════════════════
alter table incentive_sales add column if not exists rental_offer_id      uuid references rental_cat_offers(id);
alter table incentive_sales add column if not exists rental_supplier_id   text references rental_cat_suppliers(id);
alter table incentive_sales add column if not exists rental_ticket_number text;
alter table incentive_sales add column if not exists rental_snapshot      jsonb;  -- 렌탈사·모델·조건·요금구간·가이드·MAX·무료개월 (계약 시점)
alter table incentive_sales add column if not exists rental_application   jsonb;  -- 가입정보: 명의구분·생년월일·납부·결제일·서류·타사보상·선납 …
alter table incentive_sales add column if not exists rental_process       jsonb;  -- 계약진행: 서류수령·본인인증·전자서명·해피콜·설치·렌탈사 주문번호 …
create index if not exists incentive_sales_rental_offer_idx on incentive_sales (rental_offer_id) where rental_offer_id is not null;

-- 라이브 제약 확장 — 렌탈은 product_id·usim_plan_id 대신 rental_offer_id 로 계약 대상을 가진다
alter table incentive_sales drop constraint if exists chk_sales_kind;
alter table incentive_sales add constraint chk_sales_kind check (sale_kind = any (array['internet','usim','rental']));
alter table incentive_sales drop constraint if exists chk_sales_target;
alter table incentive_sales add constraint chk_sales_target check (product_id is not null or usim_plan_id is not null or rental_offer_id is not null);

-- 같은 조건·같은 고객 연속 제출(더블클릭) 방지 — 서버가 60초 내 동일 건을 409 로 막고, 여기서 한 번 더 막는다
create unique index if not exists incentive_sales_rental_dedupe_idx
  on incentive_sales (rental_offer_id, customer_phone, contract_date)
  where sale_kind = 'rental' and deleted_at is null and status <> 'cancelled';

-- 사은품 원장 트리거 — 계약의 고객명·계좌·상품·티켓을 원장으로 넘긴다(지급 화면에서 계좌 확인 가능하게)
--   계약완료 = 계약부서가 설치/개통과 본인확인을 마친 건 → auth_status '인증완료'
create or replace function public.trg_sales_to_gift_func()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare v_phone text; v_amount int; v_existing int; v_product text; v_ticket text;
begin
  if new.status <> 'completed' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'completed' then return new; end if;
  v_phone := new.customer_phone;
  if v_phone is null or v_phone = '' then return new; end if;
  v_amount := coalesce(new.payback_snapshot, 0);
  select count(*) into v_existing from bongi_gifts
    where source_sale_table = tg_table_name and source_sale_id = new.id::text;
  if v_existing > 0 then return new; end if;
  if new.sale_kind = 'rental' then
    v_product := coalesce(new.rental_snapshot->'model'->>'product_name', new.rental_snapshot->'model'->>'model_code');
    v_ticket := new.rental_ticket_number;
  else
    select p.name, p.ticket_number into v_product, v_ticket from incentive_products p where p.id = new.product_id;
  end if;
  insert into bongi_gifts (phone, name, amount, status, auth_status, bank, account_number, account_holder, product_name, ticket_no, contract_date, source_sale_table, source_sale_id, created_at)
  values (v_phone, new.customer_name, v_amount,
    case when exists(select 1 from bongi_user_profiles where phone = v_phone) then '지급대기' else '비회원대기' end,
    '인증완료', new.bank_name, new.bank_account_number, new.bank_account_holder, v_product, v_ticket, new.contract_date::text,
    tg_table_name, new.id::text, now());
  return new;
end; $function$;
