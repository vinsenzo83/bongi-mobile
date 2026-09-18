-- 조건 색상 (상담 계산기에서 상품 → 색상까지 한 번에 고르기 위해)
--   청호는 상품코드(zCode)가 색상 SKU — 공식몰 상품 옵션(installOptionList.optionCode/optionValueList)에서 수집
--   그 밖의 렌탈사는 상품명 괄호 안 색상 표기를 옮겨 담는다
alter table rental_cat_offers add column if not exists color_name text;
comment on column rental_cat_offers.color_name is '색상 (렌탈사 상품코드=색상 SKU 인 경우. 청호는 공식몰 옵션에서 수집)';
create index if not exists rental_cat_offers_color_idx on rental_cat_offers (model_id, color_name) where color_name is not null;
