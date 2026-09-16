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
