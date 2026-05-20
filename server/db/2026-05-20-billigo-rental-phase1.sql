-- ════════════════════════════════════════════════════════════════
-- 빌리고 기반 가전렌탈 시스템 — Phase 1
-- 렌탈사 마스터 + import 이력 테이블 신설, rental_* 보강 컬럼, 카테고리 시드
-- PRD: docs/specs/billigo-rental-system.md  (§4.2 §4.3 §9 D2)
-- 적용 순서: 데브(sesgdqbmophgmombelmn) → 검증 → 라이브(dugaqvvnhsgenhmhuyju)
-- 롤백: 2026-05-20-billigo-rental-phase1-rollback.sql
-- ════════════════════════════════════════════════════════════════
BEGIN;

-- ━━━ 1. rental_companies — 렌탈사(판매 채널) 마스터 ━━━
CREATE TABLE IF NOT EXISTS rental_companies (
  id                  bigserial PRIMARY KEY,
  name                text NOT NULL UNIQUE,           -- 코웨이·청호·LG헬로·캐리어…
  category_group      text,                            -- 정수기메이커 | 가전렌탈사
  commission_method   text NOT NULL DEFAULT 'rate'
                      CHECK (commission_method IN ('direct','rate','flat','multiple','account')),
  commission_rate     numeric,                         -- 율 (0.13 등)
  commission_flat     integer,                         -- 정액 (건당 원)
  commission_multiple numeric,                         -- 배수 (월렌탈료 × N)
  rental_fee_basis    text DEFAULT 'total' CHECK (rental_fee_basis IN ('total','monthly')),
  has_dual_pricing    boolean DEFAULT false,           -- 일반/현장 이원화
  settle_basis        text DEFAULT '설치완료',          -- 설치완료 | DB접수 | 출금일
  notes               text,
  is_active           boolean DEFAULT true,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);
COMMENT ON TABLE rental_companies IS '빌리고 렌탈사(채널) 마스터 — 수수료 산정 방식 4종';

-- ━━━ 2. rental_import_batches — 월별 엑셀 import 이력 ━━━
CREATE TABLE IF NOT EXISTS rental_import_batches (
  id                  bigserial PRIMARY KEY,
  year_month          text NOT NULL,                   -- '2026-05'
  file_type           text NOT NULL CHECK (file_type IN ('정수기','가전')),
  source_filename     text,
  sheet_count         integer DEFAULT 0,
  row_count           integer DEFAULT 0,
  upsert_new          integer DEFAULT 0,
  upsert_updated      integer DEFAULT 0,
  marked_discontinued integer DEFAULT 0,
  status              text DEFAULT 'parsing'
                      CHECK (status IN ('parsing','preview','committing','committed','failed')),
  imported_by         uuid,
  imported_at         timestamptz DEFAULT now()
);
COMMENT ON TABLE rental_import_batches IS '빌리고 엑셀 월별 import 배치 이력 (추적·롤백)';

-- ━━━ 3. rental_products 보강 컬럼 ━━━
ALTER TABLE rental_products ADD COLUMN IF NOT EXISTS company_id      bigint REFERENCES rental_companies(id);
ALTER TABLE rental_products ADD COLUMN IF NOT EXISTS manufacturer    text;     -- 제조사 (루헨스·쿠쿠·삼성…)
ALTER TABLE rental_products ADD COLUMN IF NOT EXISTS model_key       text;     -- 정규화 모델코드 (다채널 매칭)
ALTER TABLE rental_products ADD COLUMN IF NOT EXISTS source_batch_id bigint REFERENCES rental_import_batches(id);
ALTER TABLE rental_products ADD COLUMN IF NOT EXISTS billigo_status  text;     -- 동일|신규|변경|단종

-- ━━━ 4. rental_product_options 보강 컬럼 ━━━
ALTER TABLE rental_product_options ADD COLUMN IF NOT EXISTS source_batch_id   bigint REFERENCES rental_import_batches(id);
ALTER TABLE rental_product_options ADD COLUMN IF NOT EXISTS commission_method text DEFAULT 'direct';  -- 수수료 산정 방식 박제
-- P8 — 옵션 변형 차원 (청호 규정코드·쿠쿠 구분·SK매직 세부유형). 행 누락 0 보장 키.
ALTER TABLE rental_product_options ADD COLUMN IF NOT EXISTS variant_code  text DEFAULT '';
ALTER TABLE rental_product_options ADD COLUMN IF NOT EXISTS variant_label text;
ALTER TABLE rental_product_options ADD COLUMN IF NOT EXISTS promo_type    text;  -- 빌리고 프로모션 텍스트 (옵션 단위)
UPDATE rental_product_options SET variant_code = '' WHERE variant_code IS NULL;
-- ⚠️ null-safe UNIQUE 인덱스(자연키)는 Phase 2 import commit 직전 생성:
--   CREATE UNIQUE INDEX uq_rental_option_natural ON rental_product_options
--     (product_id, months, COALESCE(care_service,''), COALESCE(inspection_cycle,-1),
--      COALESCE(ownership_months,-1), COALESCE(variant_code,''));
--   (기존 1,512행에 variant 차원이 없어 지금 만들면 충돌 가능 → 데이터 교체 후 생성)

-- ━━━ 5. 인덱스 + UNIQUE 키 변경 (P7 다채널) ━━━
-- rental_products UNIQUE: (brand,model) → (company_id,model) — 같은 제품 다채널 중개
ALTER TABLE rental_products DROP CONSTRAINT IF EXISTS rental_products_brand_model_key;
ALTER TABLE rental_products ADD  CONSTRAINT rental_products_company_model_key UNIQUE (company_id, model);
CREATE INDEX IF NOT EXISTS idx_rental_products_company  ON rental_products(company_id);
CREATE INDEX IF NOT EXISTS idx_rental_products_modelkey ON rental_products(manufacturer, model_key);

-- ━━━ 6. RLS — 기존 rental_categories 패턴 동일 (read_all + admin_write) ━━━
ALTER TABLE rental_companies      ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY rental_companies_read_all ON rental_companies
  FOR SELECT USING (true);
CREATE POLICY rental_companies_admin_write ON rental_companies
  FOR ALL USING (current_incentive_agent_role() = 'admin')
  WITH CHECK (current_incentive_agent_role() = 'admin');

CREATE POLICY rental_import_batches_read_all ON rental_import_batches
  FOR SELECT USING (true);
CREATE POLICY rental_import_batches_admin_write ON rental_import_batches
  FOR ALL USING (current_incentive_agent_role() = 'admin')
  WITH CHECK (current_incentive_agent_role() = 'admin');

-- ━━━ 7. 카테고리 시드 — 빌리고 전 품목 ~38종 ━━━
-- 기존 7종(water-purifier·air-purifier·massage-chair·washer·dryer·bidet·dishwasher)은 유지.
-- 신규 31종은 is_active=false (운영 초기 비활성, PRD §9 D2 — 점진 활성화).
INSERT INTO rental_categories (slug, name, sort_order, is_active) VALUES
  ('ice-purifier',     '얼음정수기',    11,  false),
  ('hotcold-purifier', '냉온정수기',    12,  false),
  ('mattress',         '매트리스',      80,  false),
  ('bed-frame',        '침대프레임',    90,  false),
  ('dehumidifier',     '제습기',        100, false),
  ('water-softener',   '연수기',        110, false),
  ('shower',           '샤워기',        120, false),
  ('induction',        '전기레인지',    130, false),
  ('oven',             '오븐',          140, false),
  ('coffee-machine',   '커피머신',      150, false),
  ('food-waste',       '음식물처리기',  160, false),
  ('plant-grower',     '식물재배기',    170, false),
  ('refrigerator',     '냉장고',        180, false),
  ('kimchi-fridge',    '김치냉장고',    190, false),
  ('aircon',           '에어컨',        200, false),
  ('tv',               'TV',            210, false),
  ('vacuum',           '청소기',        220, false),
  ('robot-vacuum',     '로봇청소기',    230, false),
  ('styler',           '의류관리기',    240, false),
  ('clothes-purifier', '의류청정기',    250, false),
  ('healing-care',     '힐링케어',      260, false),
  ('beauty-medical',   '미용/의료기기', 270, false),
  ('computer',         'PC·노트북',     280, false),
  ('monitor',          '모니터',        290, false),
  ('game-console',     '게임기',        300, false),
  ('projector',        '빔프로젝터',    310, false),
  ('speaker',          '스피커',        320, false),
  ('pet-care',         '펫용품',        330, false),
  ('pest-control',     '해충방제',      340, false),
  ('air-freshener',    '방향기',        350, false),
  ('hand-dryer',       '핸드드라이어',  360, false)
ON CONFLICT (slug) DO NOTHING;

COMMIT;
