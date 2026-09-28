-- 렌탈 카탈로그 — 모델 색상 목록 (2026-09-28)
-- 색상은 요금·리베이트를 바꾸지 않는다(라이브 409개 색상 그룹 전수 검증: 요금·리베이트 차이 0건).
-- 출처가 셋이라 한 자리에 모은다:
--   1) offers.color_name        — 색상마다 티켓이 따로인 렌탈사(청호 zCode) · 이미 있음
--   2) specs.specifications.color — 제조사 공식몰 수집분(코웨이 등) · 이미 있음
--   3) color_names (이 마이그레이션) — 빌리고 엑셀 상품명·모델코드에 박힌 색상
-- 조회 우선순위는 서버 colorOptions() 가 2 → 3 순으로 본다(1은 조건이 이미 확정).

alter table rental_cat_models
  add column if not exists color_names  text[],
  add column if not exists color_source text;      -- 예: '상품명(빌리고 엑셀)' · 'LG헬로 공식몰'

comment on column rental_cat_models.color_names is '이 모델에서 고를 수 있는 색상. 요금과 무관한 옵션';
comment on column rental_cat_models.color_source is 'color_names 를 어디서 얻었는지 — 근거 없는 값 금지';

create index if not exists rental_cat_models_color_idx on rental_cat_models using gin (color_names);

-- 뷰 재생성 — 반드시 해야 한다.
-- `create view … select m.*` 는 생성 시점에 컬럼 목록이 고정된다(PostgreSQL 이 * 를 즉시 전개).
-- 컬럼을 추가하고 뷰를 그대로 두면 새 컬럼이 API 에 안 나온다 — 실제로 color_names 가 상담 화면에 안 보였다.
drop view if exists rental_cat_model_summary;
create view rental_cat_model_summary with (security_invoker = true) as
select m.*, s.name as supplier_name
from rental_cat_models m
join rental_cat_suppliers s on s.id = m.supplier_id;
grant all on rental_cat_model_summary to anon, authenticated, service_role;
