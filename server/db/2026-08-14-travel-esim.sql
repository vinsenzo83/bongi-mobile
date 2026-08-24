-- ═══════════════════════════════════════════════════════════════
-- 여행 eSIM — 멀티 공급사 · 프로파일 · 주문 · 발송 · 환불
-- 설계서: docs/specs/bongi-travel-esim-admin-2026-08.md
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- 1. 공급사
-- ─────────────────────────────────────────────
create table if not exists esim_suppliers (
  id                text primary key,              -- 'cmi' | 'a2z_xxx'
  name              text not null,
  kind              text not null default 'cmi',   -- cmi | a2z | other
  is_active         boolean not null default true,
  capabilities      jsonb not null default '{}'::jsonb,
  -- { needsCardPool, supportsEarlyEnd, supportsRefuel, supportsUsageQuery, webhooks:[] }
  -- 환불·취소 조건 (설계서 2.7 g)
  cancel_window_days      int,        -- CMI 365 / A2Z 180(확인 필요)
  cancelable_states       text[] default array['ORDERED'],
  recovery_rate           numeric(5,4) default 1.0,
  partial_refund          boolean default false,
  cancel_fee_krw          int default 0,
  settlement_lag_days     int default 0,
  terms_source            text,       -- contract | written | verbal | api
  terms_verified_at       timestamptz,
  -- 정산
  balance_krw             bigint default 0,
  balance_synced_at       timestamptz,
  prepay_amount_krw       bigint,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 2. 공급사 원본 패키지 (동기화)
-- ─────────────────────────────────────────────
create table if not exists esim_packages (
  id                uuid primary key default gen_random_uuid(),
  supplier_id       text not null references esim_suppliers(id),
  provider_pkg_id   text not null,                 -- CMI dataBundleId
  name_ko           text,
  name_en           text,
  description       text,
  status            smallint,                      -- 1 판매중 / 2 판매중지 / 3 폐기
  limit_type        smallint,                      -- 1 주기총량 / 2 1일단위
  activation_mode   smallint,                      -- 1 예약·최초통신 / 2 LU / 3 사용량초과
  period_type       smallint,                      -- 0 24h / 1 일 / 2 월 / 3 년
  period            int,
  high_speed_tier   text,                          -- 500MB / 1GB / 2GB / 3GB …
  card_pools        jsonb,
  price_usd         numeric(12,4),
  price_hkd         numeric(12,4),
  price_cny         numeric(12,4),
  original_price_usd numeric(12,4),
  refueling         jsonb,                         -- 추가충전(3통화 + isOrderingAllowed)
  coverage          text[],
  expire_at         timestamptz,
  last_modify_at    timestamptz,
  raw               jsonb,
  synced_at         timestamptz not null default now(),
  unique (supplier_id, provider_pkg_id)
);
create index if not exists idx_esim_packages_status on esim_packages(supplier_id, status);

-- ─────────────────────────────────────────────
-- 3. 진열 상품 (고객에게 보이는 목적지)
-- ─────────────────────────────────────────────
create table if not exists esim_display_products (
  id                uuid primary key default gen_random_uuid(),
  destination_ko    text not null,
  destination_en    text,
  slug              text unique,
  hero_image        text,
  description       text,
  coverage_note     text,                          -- "중국+홍콩+마카오 커버" 등
  routing_mode      text default 'auto',           -- auto | manual | manual_fallback | off
  routing_supplier  text references esim_suppliers(id),
  sort_order        int default 0,
  is_active         boolean not null default false,
  created_at        timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 4. SKU — 진열상품 × 고속량 × 일수
-- ─────────────────────────────────────────────
create table if not exists esim_sku (
  id                uuid primary key default gen_random_uuid(),
  display_product_id uuid not null references esim_display_products(id) on delete cascade,
  high_speed_tier   text not null,                 -- 500MB / 1GB / 2GB / 3GB
  days              int not null,
  retail_krw        int,                           -- 전 채널 동일가
  margin_rate       numeric(5,4),                  -- 산출 결과(참고)
  cmi_min_price_krw int,                           -- 지정 최저가(nullable · 미지정 시 검증 안 함)
  routing_mode      text,                          -- SKU 오버라이드 (null이면 상품→전역 상속)
  routing_supplier  text references esim_suppliers(id),
  is_active         boolean not null default false,
  note              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (display_product_id, high_speed_tier, days)
);

-- ─────────────────────────────────────────────
-- 4-2. 채널별 가격 (없으면 esim_sku.retail_krw 사용)
-- ─────────────────────────────────────────────
create table if not exists esim_sku_price (
  id                uuid primary key default gen_random_uuid(),
  sku_id            uuid not null references esim_sku(id) on delete cascade,
  channel           text not null,                 -- smartstore | app | store
  retail_krw        int not null,
  starts_at         timestamptz,                   -- 프로모션 기간
  ends_at           timestamptz,
  memo              text,
  updated_by        text,
  updated_at        timestamptz not null default now(),
  unique (sku_id, channel, starts_at)
);
create index if not exists idx_sku_price_lookup on esim_sku_price(sku_id, channel);

-- 가격 변경 이력
create table if not exists esim_price_history (
  id                bigserial primary key,
  sku_id            uuid not null,
  channel           text,
  before_krw        int,
  after_krw         int,
  reason            text,
  changed_by        text,
  changed_at        timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 5. SKU × 공급사 매핑 (라우팅 후보)
-- ─────────────────────────────────────────────
create table if not exists esim_sku_supply (
  id                uuid primary key default gen_random_uuid(),
  sku_id            uuid not null references esim_sku(id) on delete cascade,
  supplier_id       text not null references esim_suppliers(id),
  package_id        uuid not null references esim_packages(id),
  cost_krw          int not null,                  -- 공급단가 (환율·부대비 반영)
  effective_cost_krw int,                          -- 실질원가 = 공급단가 + 미회수위험 × 예상환불률
  equivalence       text not null default 'unknown', -- identical | equivalent | different | unknown
  equivalence_note  text,
  verified_by       text,
  verified_at       timestamptz,
  is_active         boolean not null default true,
  updated_at        timestamptz not null default now(),
  unique (sku_id, supplier_id)
);
create index if not exists idx_sku_supply_route on esim_sku_supply(sku_id, is_active, effective_cost_krw);

-- ─────────────────────────────────────────────
-- 6. eSIM 프로파일 (고객 · 단말 매핑)
-- ─────────────────────────────────────────────
create table if not exists esim_profiles (
  id                uuid primary key default gen_random_uuid(),
  supplier_id       text not null references esim_suppliers(id),
  customer_id       uuid,
  device_id         text,
  iccid             text not null unique,
  himsi             text,
  msisdn            text,
  eid               text,
  provider_profile_id text,
  status            text not null default 'ISSUED', -- ISSUED|INSTALLED|ACTIVE|DELETED|EXPIRED
  activation_code   text,
  smdp_address      text,
  install_count     int default 0,
  install_device    text,
  installed_at      timestamptz,
  profile_expired_at timestamptz,                   -- ★2년 (주문마다 리셋)
  last_package_ordered_at timestamptz,
  replacement_iccid text,
  real_rule         jsonb,                          -- 실명제 필요 여부
  card_status       smallint,                       -- 0 정상 / 1 정지 / 3 해지
  deleted_at        timestamptz,
  synced_at         timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists idx_esim_profiles_customer on esim_profiles(customer_id);
create index if not exists idx_esim_profiles_expiry on esim_profiles(profile_expired_at)
  where status in ('INSTALLED','ACTIVE');

-- ─────────────────────────────────────────────
-- 7. 주문 (패키지 단위)
-- ─────────────────────────────────────────────
create table if not exists esim_orders (
  id                uuid primary key default gen_random_uuid(),
  order_no          text not null unique,           -- thirdOrderId
  transaction_code  text not null unique,           -- ★멱등키
  provider_order_id text,
  subscription_key  text,

  channel           text not null default 'app',    -- smartstore | app | store
  channel_order_id  text,                           -- 스마트스토어 주문번호
  customer_id       uuid,
  buyer_name        text,
  buyer_phone       text,
  buyer_email       text,

  sku_id            uuid references esim_sku(id),
  profile_id        uuid references esim_profiles(id),
  supplier_id       text references esim_suppliers(id),
  routing_mode      text,
  routing_reason    text,                           -- 왜 이 공급사로 갔는지

  retail_krw        int not null,
  cost_krw          int,
  channel_fee_krw   int default 0,
  margin_krw        int,

  pg_tid            text,
  pg_method         text,                           -- naverpay | kakaopay | card | transfer …
  pg_status         text,

  status            text not null default 'PENDING',
  -- PENDING | ORDERED | ACTIVATED | COMPLETED | CANCELLED | EXPIRED_FORFEITED | FAILED
  install_stage     smallint,                       -- 3.2.17 notificationPointId

  ordered_at              timestamptz,              -- 공급사 주문 성공
  customer_use_deadline   timestamptz,              -- ★180일
  cancel_request_deadline timestamptz,              -- ★취소 접수 마감 (만료 −7일)
  activation_deadline     timestamptz,              -- 공급사 회수 마감
  activated_at            timestamptz,              -- 현지 활성화
  usage_expired_at        timestamptz,
  package_days      int,

  remain_flow_mb    numeric(12,2),
  remain_time       text,
  quota_synced_at   timestamptz,

  consent_at        timestamptz,                    -- 유효기간·환불 고지 동의
  extended_count    int default 0,
  extended_by       text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_esim_orders_status on esim_orders(status, created_at desc);
create index if not exists idx_esim_orders_deadline on esim_orders(customer_use_deadline)
  where status = 'ORDERED';
create index if not exists idx_esim_orders_channel on esim_orders(channel, created_at desc);

-- ─────────────────────────────────────────────
-- 8. 발송 (카카오 알림톡 · 이메일)
-- ─────────────────────────────────────────────
create table if not exists esim_deliveries (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references esim_orders(id) on delete cascade,
  kind              text not null,                  -- issued | expiry_d30 | expiry_d7 | expiry_d1 | resend | cancelled
  channel           text not null,                  -- alimtalk | lms | email
  template_code     text,
  to_addr           text not null,
  install_token     text,                           -- 설치 페이지 고유 토큰
  status            text not null default 'queued', -- queued | sent | failed | fallback
  provider_msg_id   text,
  error             text,
  sent_at           timestamptz,
  opened_at         timestamptz,                    -- 설치 페이지 열람
  created_at        timestamptz not null default now()
);
create index if not exists idx_esim_deliveries_order on esim_deliveries(order_id, created_at desc);
create unique index if not exists idx_esim_deliveries_token on esim_deliveries(install_token)
  where install_token is not null;

-- ─────────────────────────────────────────────
-- 9. 환불·취소
-- ─────────────────────────────────────────────
create table if not exists esim_refunds (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references esim_orders(id),
  requested_by      text not null,                  -- customer | admin | system
  reason_code       text,
  reason_text       text,
  fault             text,                           -- customer | us | supplier | device
  stage_at_request  text,                           -- before_order | pkg_ordered | pkg_activated
  recoverable       boolean,                        -- 미활성 & 마감 이내 판정
  provider_cancel_status text,
  provider_error    text,
  pg_cancel_status  text,
  refund_krw        int,
  loss_krw          int default 0,                  -- 회수 불가로 우리가 떠안은 금액
  status            text not null default 'pending',-- pending | processing | done | rejected
  requested_at      timestamptz not null default now(),
  processed_at      timestamptz,
  processed_by      text
);
create index if not exists idx_esim_refunds_status on esim_refunds(status, requested_at desc);

-- ─────────────────────────────────────────────
-- 10. 공급사 알림(웹훅) 로그
-- ─────────────────────────────────────────────
create table if not exists esim_webhook_logs (
  id                uuid primary key default gen_random_uuid(),
  supplier_id       text,
  kind              text not null,                  -- esim_status | activation | data_usage
  iccid             text,
  notification_point smallint,
  payload           jsonb not null,
  signature_ok      boolean,
  dedupe_key        text,                           -- iccid + point + timestamp
  processed         boolean not null default false,
  process_error     text,
  received_at       timestamptz not null default now()
);
create unique index if not exists idx_esim_webhook_dedupe on esim_webhook_logs(dedupe_key)
  where dedupe_key is not null;
create index if not exists idx_esim_webhook_unprocessed on esim_webhook_logs(processed, received_at)
  where processed = false;

-- ─────────────────────────────────────────────
-- 11. 공급사 API 감사로그
-- ─────────────────────────────────────────────
create table if not exists esim_api_logs (
  id                bigserial primary key,
  supplier_id       text,
  operation         text not null,
  order_id          uuid,
  request           jsonb,
  response          jsonb,
  http_status       int,
  result_code       text,
  ok                boolean,
  latency_ms        int,
  created_at        timestamptz not null default now()
);
create index if not exists idx_esim_api_logs_order on esim_api_logs(order_id, created_at desc);

-- ─────────────────────────────────────────────
-- 12. 정책 (하드코딩 금지)
-- ─────────────────────────────────────────────
create table if not exists esim_policies (
  key               text primary key,
  value             jsonb not null,
  description       text,
  updated_by        text,
  updated_at        timestamptz not null default now()
);

insert into esim_policies (key, value, description) values
  ('fx_rate',                '{"usd":1411.63,"auto":false}', 'USD/KRW 환율'),
  ('surcharge_rate',         '0.015',            '조달 부대비'),
  ('margin_rate_default',    '0.40',             '기본 마진율'),
  ('rounding',               '{"unit":100,"mode":"floor"}', '소매가 절삭'),
  ('commitment_mode',        '"option2"',        'CMI 계약 유형 — option1 | option2 | payg'),
  ('prepay_amount_usd',      '12800',            'Option 2 선납금'),
  ('tau_min',                '0.03',             '라우팅 갭 임계 최소'),
  ('tau_max',                '0.30',             '라우팅 갭 임계 최대 (option1 전용)'),
  ('target_attach_rate',     '0.042',            '목표 부착률 — 월 420건'),
  ('customer_use_days',      '180',              '고객 사용기한'),
  ('cancel_request_buffer_days', '7',            '취소 접수 마감 = 만료 −7일'),
  ('expiry_notice_days',     '[30,7,1]',         '만료 안내 발송 시점'),
  ('sku_supply_min_slack_days', '7',             'SKU 저장 시 요구 최소 여유'),
  ('routing_mode_default',   '"auto"',           '전역 라우팅 모드'),
  ('channel_fee_rate',       '{"app":0.025,"smartstore":0.056,"store":0.0}', '채널 수수료율'),
  ('min_margin_rate',        '{"app":0.30,"smartstore":0.25,"store":0.30}',  '채널별 최저 마진 하한')
on conflict (key) do nothing;

insert into esim_suppliers (id, name, kind, cancel_window_days, terms_source, capabilities) values
  ('cmi', 'CMI (China Mobile International)', 'cmi', 365, 'contract',
   '{"needsCardPool":true,"supportsEarlyEnd":true,"supportsRefuel":true,"supportsUsageQuery":true,"webhooks":["esim_status","activation","data_usage"]}'::jsonb)
on conflict (id) do nothing;
