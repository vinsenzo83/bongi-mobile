-- 렌탈 마진 설계 엔진: 경쟁사 벤치마크 + 저장 시나리오 (2026-09-17)
-- 둘 다 관리자 서버(service role)만 쓴다. anon/authenticated 직접 접근 금지.

create table if not exists rental_competitor_benchmarks (
  id uuid primary key default gen_random_uuid(),
  competitor text not null,                 -- 모요 · 렌트리 · 아정당 …
  supplier_id text not null references rental_cat_suppliers(id),
  model_code text not null,
  product_name text,
  contract_months int not null check (contract_months > 0),
  care_type text not null check (care_type in ('visit','self','delivery','none')),
  monthly_fee int,                          -- 첫 달 표시 요금
  after_fee int,                            -- 반값 등 할인 후 요금
  half_months int,
  support_amount int not null check (support_amount >= 0),   -- 경쟁사 지원금(현금 사은품)
  observed_at date not null,
  source_url text not null,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (competitor, supplier_id, model_code, contract_months, care_type, observed_at)
);
alter table rental_competitor_benchmarks enable row level security;
revoke all on rental_competitor_benchmarks from anon, authenticated;

create table if not exists rental_margin_scenarios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  engine_version text not null,
  params jsonb not null,
  summary jsonb,                             -- 저장 시점 결과 요약 (건당·1인당·손익분기·경쟁사)
  memo text,
  created_by text,
  created_at timestamptz not null default now()
);
alter table rental_margin_scenarios enable row level security;
revoke all on rental_margin_scenarios from anon, authenticated;

-- 모요 렌탈 지원금 페이지 16개 상품 (https://www.moyoplan.com/rental/affiliate/moyo/products, 2026-09-17 수집, 상품별 기본 선택 조건)
insert into rental_competitor_benchmarks (competitor, supplier_id, model_code, product_name, contract_months, care_type, monthly_fee, after_fee, half_months, support_amount, observed_at, source_url) values
 ('모요','coway','CHPI-7410N','아이콘 스탠다드 냉온정 얼음정수기',84,'visit',24450,48900,18,446811,'2026-09-17','https://www.moyoplan.com/rental/affiliate/moyo/products/2491'),
 ('모요','coway','CHPI-7430N','아이콘 미니 냉온정 얼음정수기',84,'visit',21450,42900,18,436713,'2026-09-17','https://www.moyoplan.com/rental/affiliate/moyo/products/2487'),
 ('모요','cuckoo','CP-AMS100','인스퓨어 미니100 초소형 정수기',72,'visit',16450,32900,12,403814,'2026-09-17','https://www.moyoplan.com/rental/affiliate/moyo/products/2512'),
 ('모요','coway','CHPI-7420N','아이콘 맥스 냉온정 얼음정수기',84,'visit',25950,51900,18,325934,'2026-09-17','https://www.moyoplan.com/rental/affiliate/moyo/products/2475'),
 ('모요','coway','CHP-7220N','아이콘3 냉온정 정수기',84,'self',15950,null,null,276342,'2026-09-17','https://www.moyoplan.com/rental/affiliate/moyo/products/2459'),
 ('모요','coway','CHP-7212N','아이콘 프로 정수기',84,'self',16450,32900,12,276342,'2026-09-17','https://www.moyoplan.com/rental/affiliate/moyo/products/2451'),
 ('모요','cuckoo','CDW-BS1410BDGE','스팀샷 식기세척기',72,'visit',26900,null,null,268780,'2026-09-17','https://www.moyoplan.com/rental/affiliate/moyo/products/2557'),
 ('모요','cuckoo','AC-28AH10GNW','인스퓨어 헤리티지 공기청정기 28평형',72,'visit',25110,null,null,238420,'2026-09-17','https://www.moyoplan.com/rental/affiliate/moyo/products/2532'),
 ('모요','cuckoo','AC-30AH30FEDR','인스퓨어 헤리티지 공기청정기 30평형',72,'visit',24900,null,null,235824,'2026-09-17','https://www.moyoplan.com/rental/affiliate/moyo/products/2538'),
 ('모요','coway','P-350N','나노직수 정수기 미니',84,'self',15900,null,null,231930,'2026-09-17','https://www.moyoplan.com/rental/affiliate/moyo/products/2447'),
 ('모요','cuckoo','CP-TS100WS','인스퓨어 100도 끓는물 정수기',72,'visit',22900,null,null,187296,'2026-09-17','https://www.moyoplan.com/rental/affiliate/moyo/products/2506'),
 ('모요','cuckoo','CBT-QSB1041W','인스퓨어 트리플케어8 비데',60,'visit',10950,21900,9,179549,'2026-09-17','https://www.moyoplan.com/rental/affiliate/moyo/products/2520'),
 ('모요','cuckoo','CFD-D301DCNG','에코웨일 건조분쇄형 음식물처리기 2.6L',60,'visit',22900,null,null,167420,'2026-09-17','https://www.moyoplan.com/rental/affiliate/moyo/products/2553'),
 ('모요','cuckoo','CBT-QSF1041W','인스퓨어 트리플 자동 물 내림 비데',60,'visit',10450,20900,9,165881,'2026-09-17','https://www.moyoplan.com/rental/affiliate/moyo/products/2526'),
 ('모요','cuckoo','CFD-C151MODG','에코웨일 미생물 음식물처리기 12.5L',48,'visit',28900,null,null,163824,'2026-09-17','https://www.moyoplan.com/rental/affiliate/moyo/products/2550'),
 ('모요','cuckoo','DH-WF21561EB','인스퓨어 제습기 21L',60,'visit',10950,21900,6,118990,'2026-09-17','https://www.moyoplan.com/rental/affiliate/moyo/products/2544')
on conflict do nothing;
