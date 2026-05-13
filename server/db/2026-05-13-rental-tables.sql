-- ═══════════════════════════════════════════════════════════════
-- 가전렌탈 시스템 — DB 마이그레이션 (2026-05-13)
-- ═══════════════════════════════════════════════════════════════
-- 인터넷+TV와 완전 분리된 별도 시스템
-- 정책 공유: Grade 단가·누적 P 합산은 incentive_* 테이블과 통합 정산
-- ═══════════════════════════════════════════════════════════════

-- 1. 가전렌탈 카테고리 마스터 (정수기·공기청정기·안마의자 등)
CREATE TABLE IF NOT EXISTS rental_categories (
  id           bigserial PRIMARY KEY,
  slug         text NOT NULL UNIQUE,                -- 'water-purifier', 'air-purifier'
  name         text NOT NULL,                       -- '정수기', '공기청정기'
  sort_order   int  DEFAULT 100,
  is_active    boolean DEFAULT true,
  metadata     jsonb DEFAULT '{}'::jsonb,           -- 카테고리별 동적 필드 스키마
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rental_categories_slug ON rental_categories(slug);

-- 2. 가전렌탈 상품 마스터 (모델 = 1행)
CREATE TABLE IF NOT EXISTS rental_products (
  id             bigserial PRIMARY KEY,
  category_id    bigint REFERENCES rental_categories(id) ON DELETE RESTRICT,
  brand          text NOT NULL,                     -- '코웨이', 'SK매직', 'LG전자'…
  name           text NOT NULL,                     -- '아이콘 정수기 2'
  model          text NOT NULL,                     -- 'CHP-7211N'
  product_url    text,
  point_weight   numeric(4,2) DEFAULT 1.50,         -- 가중치 P (모델 단위 기본값)
  is_premium     boolean DEFAULT false,             -- 우수상품 여부
  tier           text CHECK (tier IN ('S','A','B','C')) DEFAULT 'B',
  is_active      boolean DEFAULT true,
  market_score   int,                               -- 시장성 1~5
  display_rank   int,                               -- 노출순위
  promo_tag      text,                              -- 프로모션태그
  registration_status text,                         -- 등록상태
  evaluation_memo text,                             -- 평가메모
  metadata       jsonb DEFAULT '{}'::jsonb,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now(),
  UNIQUE (brand, model)
);
CREATE INDEX IF NOT EXISTS idx_rental_products_category ON rental_products(category_id);
CREATE INDEX IF NOT EXISTS idx_rental_products_brand_model ON rental_products(brand, model);

-- 3. 옵션별 단가 (약정 × 케어 조합)
CREATE TABLE IF NOT EXISTS rental_product_options (
  id                bigserial PRIMARY KEY,
  product_id        bigint NOT NULL REFERENCES rental_products(id) ON DELETE CASCADE,
  months            int NOT NULL CHECK (months > 0),         -- 36 / 60 / 72 / 84
  care_service      text NOT NULL CHECK (care_service IN ('방문','셀프')),
  inspection_cycle  int,                                     -- 점검주기 (개월)
  ownership_months  int,                                     -- 소유권이전 개월
  normal_price      int,                                     -- 정상가
  monthly_fee       int,                                     -- 월 납부액
  monthly_diff      int,                                     -- 월납 증감
  half_fee          int,                                     -- 반값할인 렌탈료
  half_period       int,                                     -- 반값할인 적용기간
  rebate            int NOT NULL DEFAULT 0,                  -- 기본 리베이트
  rebate_otherco    int,                                     -- 타사보상 리베이트
  rebate_half       int,                                     -- 반값 리베이트
  bundle_rate       int DEFAULT 100,                         -- 결합지급률 (%)
  payback           int DEFAULT 0,                           -- 어드민 입력 페이백
  point_weight_adj  numeric(4,2),                            -- 옵션별 P 보정 (없으면 product.point_weight 사용)
  margin            int,                                     -- 자동 계산 마진
  tier_calculated   text CHECK (tier_calculated IN ('S','A','B','C')),
  is_active         boolean DEFAULT true,
  metadata          jsonb DEFAULT '{}'::jsonb,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  UNIQUE (product_id, months, care_service)
);
CREATE INDEX IF NOT EXISTS idx_rental_options_product ON rental_product_options(product_id);

-- 4. 브랜드 정책 (결합조건·타사보상·반값할인·환수규정)
CREATE TABLE IF NOT EXISTS rental_brand_policies (
  id                   bigserial PRIMARY KEY,
  brand                text NOT NULL UNIQUE,        -- '코웨이', 'SK매직'…
  bundle_condition     text,                        -- '결합 5% / 동시구매 10%'
  otherco_comp         text,                        -- 타사보상 정책
  half_discount_policy text,                        -- 반값할인 정책
  refund_policy        text,                        -- 환수규정
  refund_resume        text,                        -- 환수재지급조건
  notes                text,                        -- 특이사항
  metadata             jsonb DEFAULT '{}'::jsonb,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

-- 5. 가전렌탈 정책 (어드민 변경 가능 · 단일 활성 행)
CREATE TABLE IF NOT EXISTS rental_policy (
  id                       bigserial PRIMARY KEY,
  is_active                boolean DEFAULT true,
  -- 영업이익율
  target_profit_rate       numeric(5,2) DEFAULT 10.00,    -- 10%
  -- 기본급 분담
  base_salary              int DEFAULT 2300000,           -- 230만원
  base_salary_standard_sales int DEFAULT 50,              -- 월 50건 표준
  -- 가중치 P (약정별)
  weight_p_36m             numeric(4,2) DEFAULT 1.20,
  weight_p_60m             numeric(4,2) DEFAULT 1.50,
  weight_p_72m             numeric(4,2) DEFAULT 1.80,
  weight_p_84m             numeric(4,2) DEFAULT 2.20,
  -- 보정 P
  premium_bonus_p          numeric(4,2) DEFAULT 0.30,
  care_visit_bonus_p       numeric(4,2) DEFAULT 0.10,
  -- Grade 단가 (가전렌탈 전용)
  grade_g1_unit            int DEFAULT 9000,
  grade_g2_unit            int DEFAULT 11000,
  grade_g3_unit            int DEFAULT 13000,
  -- 가입 보너스
  signup_bonus_per_sale    int DEFAULT 20000,
  -- 페이백 상한
  payback_cap              int DEFAULT 500000,
  -- 표준 가중치 비용 (V4 평가 기준)
  weight_cost_per_p        int DEFAULT 70000,
  -- Tier 임계값 (자동 분류)
  tier_s_min_margin        int DEFAULT 80000,
  tier_a_min_margin        int DEFAULT 50000,
  tier_b_min_margin        int DEFAULT 20000,
  changed_by               text,
  change_reason            text,
  created_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now()
);
-- 활성 정책은 1개만
CREATE UNIQUE INDEX IF NOT EXISTS uniq_rental_policy_active ON rental_policy(is_active) WHERE is_active = true;

-- 정책 변경 이력
CREATE TABLE IF NOT EXISTS rental_policy_history (
  id              bigserial PRIMARY KEY,
  policy_id       bigint REFERENCES rental_policy(id),
  changed_fields  jsonb,                            -- {field: {old: x, new: y}}
  changed_by      text,
  change_reason   text,
  created_at      timestamptz DEFAULT now()
);

-- 6. 가전렌탈 영업 (incentive_sales와 동일 패턴 · 별도 테이블)
CREATE TABLE IF NOT EXISTS rental_sales (
  id                  bigserial PRIMARY KEY,
  product_id          bigint NOT NULL REFERENCES rental_products(id) ON DELETE RESTRICT,
  option_id           bigint NOT NULL REFERENCES rental_product_options(id) ON DELETE RESTRICT,
  -- 고객 정보
  customer_id         bigint,                       -- 콜DB 연결
  customer_name       text,
  customer_phone      text,
  customer_address    text,
  resident_id         text,
  -- 영업자
  agent_id            bigint,                       -- 상담사
  db_source_id        bigint,                       -- DB 출처
  dealer_id           bigint,                       -- 대리점
  -- 상태
  status              text CHECK (status IN ('pending','in_progress','completed','cancelled')) DEFAULT 'pending',
  cancellation_reason text,
  -- 시각 이력
  contract_date       date,
  installation_date   date,
  contract_pending_at      timestamptz,
  contract_in_progress_at  timestamptz,
  contract_completed_at    timestamptz,
  contract_cancelled_at    timestamptz,
  -- snapshot (등록 시점 박제 — 정책 변경 영향 없음)
  rebate_snapshot         int,
  payback_snapshot        int,
  point_weight_snapshot   numeric(4,2),
  monthly_fee_snapshot    int,
  months_snapshot         int,
  care_service_snapshot   text,
  signup_bonus_snapshot   int,
  grade_at_snapshot       text,                     -- G1/G2/G3
  margin_snapshot         int,
  tier_snapshot           text,
  -- 메타
  gift_received           text,                     -- 실제 사은품
  add_payback             int DEFAULT 0,            -- 추가 페이백
  notes                   text,                     -- 상담사 메모
  contract_notes          text,                     -- 계약부서 메모
  metadata                jsonb DEFAULT '{}'::jsonb,
  -- soft delete
  deleted_at              timestamptz,
  deleted_by              text,
  deletion_reason         text,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rental_sales_product ON rental_sales(product_id);
CREATE INDEX IF NOT EXISTS idx_rental_sales_agent ON rental_sales(agent_id);
CREATE INDEX IF NOT EXISTS idx_rental_sales_status ON rental_sales(status);
CREATE INDEX IF NOT EXISTS idx_rental_sales_contract_date ON rental_sales(contract_date);
CREATE INDEX IF NOT EXISTS idx_rental_sales_customer ON rental_sales(customer_id);

-- 영업 변경 이력
CREATE TABLE IF NOT EXISTS rental_sales_history (
  id              bigserial PRIMARY KEY,
  sale_id         bigint REFERENCES rental_sales(id) ON DELETE CASCADE,
  changed_fields  jsonb,
  changed_by      text,
  change_reason   text,
  created_at      timestamptz DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
-- 초기 시드: 카테고리 (정수기) + 정책 기본값
-- ═══════════════════════════════════════════════════════════════

INSERT INTO rental_categories (slug, name, sort_order, metadata) VALUES
  ('water-purifier',  '정수기',       10,  '{"icon":"💧"}'),
  ('air-purifier',    '공기청정기',   20,  '{"icon":"🌬️"}'),
  ('massage-chair',   '안마의자',     30,  '{"icon":"💆"}'),
  ('washer',          '세탁기',       40,  '{"icon":"🫧"}'),
  ('dryer',           '건조기',       50,  '{"icon":"🌀"}'),
  ('bidet',           '비데',         60,  '{"icon":"🚽"}'),
  ('dishwasher',      '식기세척기',   70,  '{"icon":"🍽️"}')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO rental_policy (
  target_profit_rate, base_salary, base_salary_standard_sales,
  weight_p_36m, weight_p_60m, weight_p_72m, weight_p_84m,
  premium_bonus_p, care_visit_bonus_p,
  grade_g1_unit, grade_g2_unit, grade_g3_unit,
  signup_bonus_per_sale, payback_cap, weight_cost_per_p,
  tier_s_min_margin, tier_a_min_margin, tier_b_min_margin,
  changed_by, change_reason
)
SELECT 10.00, 2300000, 50,
       1.20, 1.50, 1.80, 2.20,
       0.30, 0.10,
       9000, 11000, 13000,
       20000, 500000, 70000,
       80000, 50000, 20000,
       'system', '초기 시드 (2026-05-13)'
WHERE NOT EXISTS (SELECT 1 FROM rental_policy WHERE is_active = true);

-- 브랜드 정책 시드 (엑셀 데이터 기준)
INSERT INTO rental_brand_policies (brand, bundle_condition, otherco_comp, half_discount_policy, refund_policy, refund_resume, notes) VALUES
  ('코웨이',     '결합 5% / 동시구매 10%', '약 10% 추가 (모델별 상이)', '약정기간별 적용 (3년→3개월 / 5년→6개월 / 6년→9개월 / 7년→12개월)', '1년 이내 반환 또는 5연체 시 수당 환수', '미납료 + 당월 렌탈료 납부 시 재지급', '반값할인+타사보상 중복 불가 / 반값or타사보상 + 동시구매or결합 중복 가능'),
  ('SK매직',    '기본수수료의 75% 지급', '반값할인과 중복 불가', '의무5년→1~6개월차 반값 / 의무6,7년→1~12개월차 반값 / 타사보상 시 +3개월 추가 반값', '1년 이내 반환 3연체 시 수당 환수', '미납금 완납 시 수수료 재지급', '-'),
  ('LG전자',    '신규결합/기존결합 별도 단가 (모델별 상이)', '모델별 할인금액 상이', '수수료 변동 없음', '정책 안내 별도', '-', '일부모델 4년 약정 시 월 렌탈료의 400% 지급'),
  ('청호나이스', '단가 별도 (S규정/P규정/재렌탈)', '별도 규정 (J→P규정 수수료 지급)', 'S규정/P규정별 상이', '1년 이내 반환 3연체 시 수당 환수', '-', 'S규정(신규/대부분), P규정(패키지), 재렌탈, 타사보상 4종 동시 운영'),
  ('교원웰스',  '수수료 폭이 커서 단품 유도 권장', '별도 단가', '프로모션 별도', '1년 이내 반환 3연체 시 수당 환수', '미납료 + 당월 렌탈료 납부 시 익월 또는 그 다음달 재지급', '-'),
  ('현대큐밍',  '수수료 50% 지급 (정수기끼리 결합 불가)', '불가', '-', '1년 이내 반환 3연체 시 수당 환수', '-', '신용불량자 전용 (선납 진행 필요)'),
  ('루헨스',    '정수기 100% / 공청기·비데 50%', '별도', '별도', '1년 이내 3연체 시 수당 100% 환수', '-', '타 프로모션(수수료 추가지급, 렌탈료 할인 등) 중복 가능'),
  ('쿠쿠',      '단가 별도', '단가 별도', '모델명에 6M반값/12M반값 표기', '1년 이내 반환 3연체 시 수당 환수', '미납료 + 당월 렌탈료 납부 시 재지급', '-'),
  ('유버스',    '일부 모델만 가능', '불가', '일부 모델 적용', '1년 이내 반환 3연체 시 수당 환수', '미납분 완납해도 재지급 불가', '-')
ON CONFLICT (brand) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- 검증
-- ═══════════════════════════════════════════════════════════════
-- SELECT slug, name FROM rental_categories ORDER BY sort_order;
-- SELECT * FROM rental_policy WHERE is_active = true;
-- SELECT brand FROM rental_brand_policies;
