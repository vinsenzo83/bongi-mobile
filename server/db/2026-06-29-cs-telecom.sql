-- ============================================================
-- 봉이 서비스 내 무인 AI 고객센터 — 통신3사 지식베이스 DB
-- slug: telecom3-cs-data · 2026-06-29
-- 방침: 운영 DB와 분리된 별도 스키마(cs). 크롤링 수집 → staging → 검수 → publish.
--       챗봇 RAG(cs.faqs)로 상담사 개입 없이 무인 완결.
--
-- 옵션 A(완전 격리, 별도 Supabase 프로젝트): 이 스크립트의 "cs." 를 "public." 으로 치환해
--   고객센터 전용 프로젝트에 적용.
-- 옵션 B(논리 분리, 운영 프로젝트 내 cs 스키마): 이 스크립트 그대로 적용.
-- ⚠️ 데브 먼저 → 검증 → 라이브. RLS는 1테이블씩 점검 후(feedback_rls_enable_caution).
-- ============================================================
BEGIN;

CREATE SCHEMA IF NOT EXISTS cs;
-- 의미검색을 쓸 경우에만:
-- CREATE EXTENSION IF NOT EXISTS vector;

-- ---------- 원본 크롤 (감사·재파싱용) ----------
CREATE TABLE IF NOT EXISTS cs.crawl_raw (
  id          bigserial PRIMARY KEY,
  batch_id    uuid NOT NULL,
  carrier     text NOT NULL,                 -- 'SKT' | 'KT' | 'LGU'
  source_url  text NOT NULL,
  kind        text NOT NULL,                 -- 'plan' | 'bundle' | 'faq'
  raw         jsonb,
  crawled_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cs_raw_batch ON cs.crawl_raw(batch_id);

-- ---------- 상담 토픽 분류 (taxonomy) ----------
CREATE TABLE IF NOT EXISTS cs.topics (
  id          bigserial PRIMARY KEY,
  code        text UNIQUE NOT NULL,          -- plan/bundle/mnp/cancel/penalty/esim/...
  name        text NOT NULL,
  parent_code text,
  sort        int DEFAULT 0
);

INSERT INTO cs.topics(code,name,sort) VALUES
  ('plan','요금제',10),('bundle','결합/할인',20),('signup','가입/개통',30),
  ('namechange','명의변경',40),('mnp','번호이동',50),('cancel','해지/일시정지',60),
  ('penalty','위약금(할인반환금·잔여할부)',70),('device','단말 할부/지원금',80),
  ('sim','유심/eSIM',90),('lost','분실/파손/보험',100),('vas','부가서비스',110),
  ('membership','멤버십/포인트',120),('roaming','로밍',130),('micropay','소액결제/콘텐츠',140),
  ('billing','청구/요금조회/미납',150),('auth','명의/본인인증',160),('quality','장애/품질',170)
ON CONFLICT (code) DO NOTHING;

-- ---------- 요금제 (발행본) ----------
CREATE TABLE IF NOT EXISTS cs.plans (
  id           bigserial PRIMARY KEY,
  carrier      text NOT NULL,                -- 'SKT'|'KT'|'LGU'
  plan_name    text NOT NULL,
  network      text,                         -- '5G'|'LTE'|'5G/LTE'
  monthly_fee  integer,
  data_amount  text,
  data_daily   text,
  call_amount  text,
  message      text,
  age_target   text DEFAULT '전체',          -- 전체/청년/시니어/키즈/복지
  commit_type  text,                         -- 공시지원/선택약정/무약정
  ott_benefits jsonb DEFAULT '[]'::jsonb,
  conditions   text,
  benefits     text,
  source_url   text,
  crawled_at   timestamptz,
  published_at timestamptz,
  is_active    boolean DEFAULT true,
  UNIQUE(carrier, plan_name)
);

-- ---------- 결합상품 (발행본) ----------
CREATE TABLE IF NOT EXISTS cs.bundles (
  id             bigserial PRIMARY KEY,
  carrier        text NOT NULL,
  bundle_name    text NOT NULL,
  bundle_type    text,                       -- 인터넷+모바일/인터넷+TV/트리플/가족결합
  components     jsonb DEFAULT '[]'::jsonb,
  discount_rule  text,
  discount_tiers jsonb DEFAULT '[]'::jsonb,  -- [{"lines":2,"amount":11000}]
  conditions     text,
  guide_script   text,
  source_url     text,
  crawled_at     timestamptz,
  published_at   timestamptz,
  is_active      boolean DEFAULT true,
  UNIQUE(carrier, bundle_name)
);

-- ---------- FAQ / 응대 지식 (챗봇 RAG 소스, 무인 완결의 핵심) ----------
CREATE TABLE IF NOT EXISTS cs.faqs (
  id                bigserial PRIMARY KEY,
  topic_code        text NOT NULL REFERENCES cs.topics(code),
  carrier           text,                    -- 'SKT'|'KT'|'LGU'|NULL(공통)
  question          text NOT NULL,
  question_variants jsonb DEFAULT '[]'::jsonb,
  answer            text NOT NULL,
  answer_detail     text,
  guide_script      text,
  policy            jsonb DEFAULT '{}'::jsonb,  -- 구조화 정책값(위약금 산식·로밍 요율 등)
  source_url        text NOT NULL,
  confidence        text DEFAULT 'verified',    -- verified|needs_review|stale
  -- embedding      vector(1536),               -- pgvector 사용 시 활성화
  crawled_at        timestamptz,
  last_verified     date,
  published_at      timestamptz,
  is_active         boolean DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_cs_faqs_topic ON cs.faqs(topic_code) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_cs_faqs_carrier ON cs.faqs(carrier) WHERE is_active;
-- CREATE INDEX IF NOT EXISTS idx_cs_faqs_emb ON cs.faqs USING ivfflat (embedding vector_cosine_ops);

-- ---------- staging (크롤 배치 적재, diff 검수 전) ----------
CREATE TABLE IF NOT EXISTS cs.plans_staging   (LIKE cs.plans   INCLUDING ALL, batch_id uuid);
CREATE TABLE IF NOT EXISTS cs.bundles_staging (LIKE cs.bundles INCLUDING ALL, batch_id uuid);
CREATE TABLE IF NOT EXISTS cs.faqs_staging    (LIKE cs.faqs    INCLUDING ALL, batch_id uuid);

-- ---------- 미해결 접수 (무인 운영 — 실시간 상담사 개입 없이 비실시간 처리) ----------
CREATE TABLE IF NOT EXISTS cs.tickets (
  id            bigserial PRIMARY KEY,
  session_id    text,
  question      text NOT NULL,
  topic_guess   text,
  carrier_guess text,
  confidence    numeric,                     -- 챗봇 매칭 신뢰도(임계값 미달로 접수)
  contact       text,                        -- 콜백 연락처(고객 선택 제공)
  status        text DEFAULT 'open',         -- open|resolved|added_to_kb
  resolved_note text,
  created_at    timestamptz DEFAULT now(),
  resolved_at   timestamptz
);
CREATE INDEX IF NOT EXISTS idx_cs_tickets_status ON cs.tickets(status);

COMMIT;

-- ============================================================
-- 롤백 (reversible)
-- ============================================================
-- BEGIN;
--   DROP TABLE IF EXISTS cs.tickets, cs.faqs_staging, cs.bundles_staging, cs.plans_staging,
--     cs.faqs, cs.bundles, cs.plans, cs.topics, cs.crawl_raw;
--   DROP SCHEMA IF EXISTS cs;   -- 비어 있을 때만
-- COMMIT;

-- ============================================================
-- RLS (배포 후 1테이블씩 점검하며 활성화 — 일괄 금지)
-- 공개 요금 정보 → 읽기는 인증 사용자 전체, 쓰기는 admin.
--   ALTER TABLE cs.faqs ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY cs_faqs_read ON cs.faqs FOR SELECT
--     USING ( (select auth.role()) = 'authenticated' );  -- initplan 최적화
-- ============================================================
