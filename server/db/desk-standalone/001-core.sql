-- ============================================================
-- 봉이 상담 데스크 — 독립 스키마 (001 코어)
-- ============================================================
-- 전제 변경 (2026-09-04 대표 확정):
--   · CRM 은 다른 팀이 개발한다. 우리는 만들지 않는다.
--   · 고객앱 + AI 1차도 다른 팀이 만든다.
--   · 우리는 "사람이 개입하는 채팅" 을 단독으로 만들고 **연결만** 한다.
--
-- 그래서 이전 설계(bongi-mobile DB 안에 얹은 desk 스키마)와 결정적으로 다르다:
--   ❌ incentive_departments / incentive_agents / incentive_customer_db / rental_categories 참조
--   ✅ 전부 자체 보유. 외부와의 결합은 **전부 아웃바운드 큐를 통한 비동기**.
--
--   외부 시스템에 직접 INSERT 하거나 FK 를 거는 순간 독립이 깨진다.
--   저쪽이 죽어도 우리는 계속 상담을 받아야 한다.
-- ============================================================
BEGIN;

CREATE SCHEMA IF NOT EXISTS desk;

-- ── 조직 ────────────────────────────────────────────────────
-- 부서 = 큐. 인박스 탭은 이 수만큼만 생긴다(카테고리가 늘어도 화면은 고정).
CREATE TABLE desk.departments (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  categories    JSONB NOT NULL DEFAULT '[]'::jsonb,   -- 담당 토픽 slug 배열
  is_fallback   BOOLEAN NOT NULL DEFAULT FALSE,       -- 미배정 토픽 최종 수신처
  sla_sec       INTEGER NOT NULL DEFAULT 180,
  hours         JSONB,                                 -- {"mon":["09:00","18:00"],...}
  offhours      TEXT NOT NULL DEFAULT 'ticket',        -- ticket | bot_only
  enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- 폴백 부서는 전체에서 1개만
CREATE UNIQUE INDEX ux_dept_fallback ON desk.departments (is_fallback) WHERE is_fallback;

-- 상담사. 인증은 외부(어드민 JWT)를 신뢰하고 external_ref 로 잇는다.
CREATE TABLE desk.agents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_ref  TEXT UNIQUE,                          -- 어드민 계정 id (우리가 발급하지 않는다)
  email         TEXT,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'agent',        -- admin|manager|agent
  department_id BIGINT REFERENCES desk.departments(id) ON DELETE SET NULL,
  handle_categories JSONB NOT NULL DEFAULT '[]'::jsonb, -- 부서 밖 겸업
  max_concurrent INTEGER NOT NULL DEFAULT 4,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_agent_role CHECK (role IN ('admin','manager','agent'))
);
CREATE INDEX ix_agents_dept ON desk.agents (department_id) WHERE active;

CREATE TABLE desk.operator_presence (
  agent_id      UUID PRIMARY KEY REFERENCES desk.agents(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'offline',
  active_count  INTEGER NOT NULL DEFAULT 0,
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_presence CHECK (status IN ('online','away','busy','offline'))
);

-- ── 분류 ────────────────────────────────────────────────────
-- 토픽(상품 카테고리). 이제 rental_categories 를 참조하지 않고 자체 보유하되,
-- 외부 마스터가 있으면 source/external_ref 로 동기화한다(하드코딩 금지 원칙 유지).
CREATE TABLE desk.topics (
  slug          TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  icon          TEXT,
  product_group TEXT NOT NULL,
  source        TEXT NOT NULL DEFAULT 'desk',         -- desk | 외부 마스터명
  external_ref  TEXT,
  bot_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  bot_prompt    TEXT,
  bot_tools     JSONB NOT NULL DEFAULT '[]'::jsonb,
  display_order INTEGER NOT NULL DEFAULT 0,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2축 라우팅: 문의 성격(intent) × 상품(topic)
CREATE TABLE desk.routing_rules (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  priority      INTEGER NOT NULL DEFAULT 100,
  intent        TEXT,                                  -- NULL = 와일드카드
  category_slug TEXT,                                  -- NULL = 와일드카드
  department_id BIGINT REFERENCES desk.departments(id) ON DELETE SET NULL,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_rule_intent CHECK (intent IS NULL OR intent IN ('presale','cs','claim','etc'))
);
CREATE INDEX ix_rule_priority ON desk.routing_rules (priority) WHERE active;

-- ── 진입점(퍼널) ────────────────────────────────────────────
CREATE TABLE desk.entry_points (
  slug           TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  channel        TEXT NOT NULL,                        -- app|web|geo|blog|store_qr|ad|instagram|threads
  default_intent TEXT,
  default_topic  TEXT,
  lock_topic     BOOLEAN NOT NULL DEFAULT FALSE,
  display        TEXT NOT NULL DEFAULT 'floating',
  greeting       TEXT,
  quick_replies  JSONB NOT NULL DEFAULT '[]'::jsonb,
  bot_prompt_add TEXT,
  theme          JSONB NOT NULL DEFAULT '{}'::jsonb,
  department_id  BIGINT REFERENCES desk.departments(id) ON DELETE SET NULL,
  -- CRM 은 남의 시스템이다. 값만 들고 있다가 아웃바운드로 넘긴다(FK 없음).
  crm_source_ref TEXT,                                 -- 저쪽의 유입경로 코드
  crm_purpose    TEXT,                                 -- 기변|이동|렌탈권유|신규
  crm_tags       TEXT[] NOT NULL DEFAULT '{}',
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_ep_intent  CHECK (default_intent IS NULL OR default_intent IN ('presale','cs','claim','etc')),
  CONSTRAINT ck_ep_display CHECK (display IN ('floating','fullscreen','inline'))
);

-- ── 고객 (우리가 아는 만큼만. CRM 원장은 저쪽에 있다) ────────
CREATE TABLE desk.contacts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_norm    TEXT UNIQUE,                           -- 숫자만. 통합 키
  name          TEXT,
  auth_user_ref TEXT,                                  -- 앱 회원 id (외부)
  crm_ref       TEXT,                                  -- ★ CRM 고객 id (문자열, FK 없음)
  crm_synced_at TIMESTAMPTZ,
  social        JSONB NOT NULL DEFAULT '{}'::jsonb,    -- {"instagram":"IGSID","threads":"..."}
  tags          TEXT[] NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_contacts_crm ON desk.contacts (crm_ref);
CREATE INDEX ix_contacts_social ON desk.contacts USING gin (social);

COMMIT;
