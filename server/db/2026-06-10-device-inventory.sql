-- ═══════════════════════════════════════════════════════════════
-- 휴대폰 재고관리 시스템 — DB 마이그레이션 (2026-06-10)
-- ═══════════════════════════════════════════════════════════════
-- STEP 1: 모델 마스터 + 개별 단말(IMEI/일련번호) + 입출고/이동 로그
-- 텔킷 방식: 박스 바코드 스캔 → SKU 매핑 → 모델·색상·일련번호 자동 등록
-- 계약(incentive_sales) 연동은 STEP 4에서 추가 (지금은 독립 모듈)
-- ═══════════════════════════════════════════════════════════════

-- 1. 단말 모델 마스터 (SKU = 단말기+색상+용량 1행, 통신사 무관 = 하드웨어 정체성)
--    바코드 스캔 시 EAN-13(예: 8806095849478) 또는 모델코드(SM-S936NDBAKOC)로 lookup
--    통신사는 모델이 아니라 개별 단말(입고) 속성 (같은 하드웨어를 SK/KT/LG로 유통)
CREATE TABLE IF NOT EXISTS device_models (
  id            bigserial PRIMARY KEY,
  sku           text UNIQUE,                         -- EAN-13 박스 바코드 (스캔 lookup 키)
  model_code    text,                                -- 'SM-S936NDBAKOC' (제조사 모델코드)
  model_name    text NOT NULL,                       -- '갤럭시 S25+' (사람이 읽는 이름)
  manufacturer  text DEFAULT '삼성',                 -- 삼성 / 애플 / 기타
  color         text,                                -- '네이비'
  capacity      text,                                -- '256GB'
  release_price int,                                 -- 출고가(참고)
  image_url     text,
  is_active     boolean DEFAULT true,
  metadata      jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_device_models_sku ON device_models(sku);
CREATE INDEX IF NOT EXISTS idx_device_models_code ON device_models(model_code);
CREATE INDEX IF NOT EXISTS idx_device_models_name ON device_models(model_name);

-- 2. 개별 단말 재고 (단말 1대 = 1행)
--    중복키: (일련번호, 통신사) — 일련번호는 통신사 다르면 중복 가능 (도메인 규칙)
--    IMEI는 전역 유일하나 추가 스캔 부담 → 보조값으로만 (선택)
CREATE TABLE IF NOT EXISTS device_inventory (
  id              bigserial PRIMARY KEY,
  model_id        bigint NOT NULL REFERENCES device_models(id) ON DELETE RESTRICT,
  serial_number   text NOT NULL,                      -- 'SMS936AX0024511' (일련번호)
  carrier         text NOT NULL,                      -- 통신사 (입고 시 선택): SK/KT/LG/알뜰/자급제
  supply_source   text,                               -- 입고처 (공급처/매입처, 입고 시 선택)
  imei1           text,                               -- '350044470335229' (선택, 전역 유일)
  imei2           text,                               -- (선택)
  eid             text,                               -- (선택)
  store_id        int NOT NULL,                       -- 보유 매장 (server/data/stores.js 1~8)
  status          text NOT NULL DEFAULT 'in_stock'    -- 재고 상태
                    CHECK (status IN ('in_stock','reserved','sold','transferred','defective','returned')),
  manufacture_ym  text,                               -- 제조연월 '202412'
  cost_price      int,                                -- 매입가(선택)
  entry_method    text DEFAULT 'scan'                 -- 등록 방식
                    CHECK (entry_method IN ('scan','manual','bulk')),
  received_at     timestamptz DEFAULT now(),          -- 입고 일시
  received_by     uuid,                               -- 입고 처리자 (auth user_id)
  received_by_name text,
  sold_at         timestamptz,                        -- 판매 일시 (STEP 4)
  sold_by         uuid,
  sale_id         bigint,                             -- incentive_sales 연동 (STEP 4, FK 없이 느슨하게)
  customer_name   text,                               -- 판매 고객(선택)
  notes           text,
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
-- 일련번호+통신사 복합 유일 (통신사 다르면 같은 일련번호 허용)
CREATE UNIQUE INDEX IF NOT EXISTS uq_device_inventory_serial_carrier ON device_inventory(serial_number, carrier);
CREATE INDEX IF NOT EXISTS idx_device_inventory_model ON device_inventory(model_id);
CREATE INDEX IF NOT EXISTS idx_device_inventory_store ON device_inventory(store_id);
CREATE INDEX IF NOT EXISTS idx_device_inventory_status ON device_inventory(status);
CREATE INDEX IF NOT EXISTS idx_device_inventory_serial ON device_inventory(serial_number);
CREATE INDEX IF NOT EXISTS idx_device_inventory_carrier ON device_inventory(carrier);

-- 3. 입출고/이동/상태변경 로그 (감사 추적)
CREATE TABLE IF NOT EXISTS device_inventory_log (
  id            bigserial PRIMARY KEY,
  inventory_id  bigint REFERENCES device_inventory(id) ON DELETE SET NULL,
  action        text NOT NULL                         -- receive(입고)/transfer(이동)/sell(판매)/return(반품)/defect(불량)/adjust(수정)/delete(삭제)
                  CHECK (action IN ('receive','transfer','sell','return','defect','adjust','delete')),
  from_store_id int,
  to_store_id   int,
  from_status   text,
  to_status     text,
  actor_user_id uuid,
  actor_name    text,
  note          text,
  snapshot      jsonb,                                -- 변경 시점 단말 스냅샷
  created_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_device_inv_log_inventory ON device_inventory_log(inventory_id);
CREATE INDEX IF NOT EXISTS idx_device_inv_log_action ON device_inventory_log(action);
CREATE INDEX IF NOT EXISTS idx_device_inv_log_created ON device_inventory_log(created_at DESC);

-- updated_at 자동 갱신 트리거 (기존 함수 set_updated_at 재사용, 없으면 생성)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_device_models_updated ON device_models;
CREATE TRIGGER trg_device_models_updated BEFORE UPDATE ON device_models
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_device_inventory_updated ON device_inventory;
CREATE TRIGGER trg_device_inventory_updated BEFORE UPDATE ON device_inventory
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- 메뉴 등록 (incentive_menus SSOT)
-- ═══════════════════════════════════════════════════════════════
INSERT INTO incentive_menus (slug, label, icon, iframe_src, category, display_order, default_roles, active)
VALUES ('device-inventory', '📱 휴대폰 재고', '📱', '/docs/incentive-device-inventory.html', '상품·정책', 145, '["admin","manager"]'::jsonb, true)
ON CONFLICT (slug) DO UPDATE
  SET label = EXCLUDED.label, icon = EXCLUDED.icon, iframe_src = EXCLUDED.iframe_src,
      category = EXCLUDED.category, active = true;
