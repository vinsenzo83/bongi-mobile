-- ============================================================
-- 봉이 상담 데스크 (desk 스키마) — P1 뼈대
-- 설계서: docs/specs/cs-chat-desk-2026-09-03.md
-- 적용 순서: dev(sesgdqbmophgmombelmn) → 검증 → live(dugaqvvnhsgenhmhuyju)
-- 롤백: 2026-09-03-desk-chat-rollback.sql
--
-- ★ 보안 원칙 (설계서 §4.1)
--   - desk 스키마를 PostgREST 노출 목록에 추가하지 않는다 (1차 방어선)
--   - 그럼에도 전 테이블 RLS 활성 + anon/authenticated 권한 회수 (2차 방어선)
--   - 서버는 service key 로만 접근한다 (RLS 우회)
-- ============================================================
BEGIN;

CREATE SCHEMA IF NOT EXISTS desk;

-- ------------------------------------------------------------
-- 1) 큐 = 부서. 신규 테이블 없이 incentive_departments 확장
--    ⚠ incentive_departments.id = bigint (uuid 아님)
-- ------------------------------------------------------------
ALTER TABLE public.incentive_departments
  ADD COLUMN IF NOT EXISTS desk_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS desk_fallback BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS desk_sla_sec  INTEGER NOT NULL DEFAULT 180,
  ADD COLUMN IF NOT EXISTS desk_hours    JSONB,
  ADD COLUMN IF NOT EXISTS desk_offhours TEXT    NOT NULL DEFAULT 'ticket';

-- 폴백 부서는 전체에서 1개만 (미배정 토픽의 최종 수신처)
CREATE UNIQUE INDEX IF NOT EXISTS ux_dept_desk_fallback
  ON public.incentive_departments (desk_fallback) WHERE desk_fallback;

-- ------------------------------------------------------------
-- 2) 시스템 토픽 (렌탈 카테고리는 rental_categories 에서 자동 흡수)
--    ⚠ cs 는 토픽이 아니라 intent 다 — 여기 넣지 않는다
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS desk.topics (
  slug          TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  icon          TEXT,
  product_group TEXT NOT NULL,
  bot_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  bot_prompt    TEXT,
  bot_tools     JSONB   NOT NULL DEFAULT '[]'::jsonb,
  display_order INTEGER NOT NULL DEFAULT 0,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO desk.topics (slug, name, icon, product_group, display_order) VALUES
  ('mobile',      '휴대폰',     '📱', '통신', 10),
  ('internet_tv', '인터넷·TV',  '🌐', '통신', 20),
  ('usedphone',   '중고폰',     '🔄', '중고', 30)
ON CONFLICT (slug) DO NOTHING;

-- 위젯·인박스가 쓰는 단일 토픽 소스
CREATE OR REPLACE VIEW desk.v_topics AS
  SELECT slug, name, icon, product_group,
         'desk.topics'::text AS source, display_order
    FROM desk.topics
   WHERE active
  UNION ALL
  SELECT slug, name, COALESCE(icon, '📦'),
         CASE WHEN product_group = '여행/글로벌' THEN '여행/글로벌' ELSE '가전렌탈' END,
         'rental_categories'::text, sort_order
    FROM public.rental_categories
   WHERE is_active;

-- ------------------------------------------------------------
-- 3) 2축 라우팅 — intent(문의 성격) × category(상품)
--    NULL = 와일드카드, priority 오름차순 첫 매칭
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS desk.routing_rules (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  priority      INTEGER NOT NULL DEFAULT 100,
  intent        TEXT,
  category_slug TEXT,
  department_id BIGINT REFERENCES public.incentive_departments(id) ON DELETE SET NULL,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_routing_intent CHECK (intent IS NULL OR intent IN ('presale','cs','claim','etc'))
);
CREATE INDEX IF NOT EXISTS ix_routing_priority ON desk.routing_rules (priority) WHERE active;

-- 라우팅 함수: 항상 값을 반환한다 (폴백 행이 보장)
CREATE OR REPLACE FUNCTION desk.route(p_intent TEXT, p_category TEXT)
RETURNS BIGINT LANGUAGE sql STABLE AS $$
  SELECT r.department_id
    FROM desk.routing_rules r
   WHERE r.active
     AND (r.intent        IS NULL OR r.intent        = p_intent)
     AND (r.category_slug IS NULL OR r.category_slug = p_category)
   ORDER BY r.priority, r.id
   LIMIT 1;
$$;

-- ------------------------------------------------------------
-- 4) 대화 — AI 1차부터 사람 2차까지 하나의 레코드로 이어진다
--    ⚠ crm_customer_id = bigint (incentive_customer_db.id 가 bigint)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS desk.conversations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id   TEXT UNIQUE,                       -- 앱 AI 이관 멱등키
  -- 분류 (2축)
  intent        TEXT NOT NULL DEFAULT 'etc',
  topic_slug    TEXT NOT NULL,
  topic_source  TEXT NOT NULL DEFAULT 'desk.topics',
  intent_confidence NUMERIC(3,2),
  -- 상태 · 배정
  status        TEXT NOT NULL DEFAULT 'bot',       -- bot|waiting|assigned|snoozed|closed
  channel       TEXT NOT NULL DEFAULT 'app',       -- app|web|store_qr
  entry_url     TEXT,
  department_id BIGINT REFERENCES public.incentive_departments(id) ON DELETE SET NULL,
  assigned_agent_id UUID REFERENCES public.incentive_agents(id) ON DELETE SET NULL,
  assigned_at   TIMESTAMPTZ,
  -- 고객 식별 (N채널 → 1고객)
  visitor_key   TEXT NOT NULL,
  phone         TEXT,
  customer_name TEXT,
  auth_user_id  UUID,
  crm_customer_id BIGINT REFERENCES public.incentive_customer_db(id) ON DELETE SET NULL,
  crm_call_purpose TEXT,                           -- 기변|이동|렌탈권유|신규 (콜 목적 축, 병기)
  -- AI 핸드오프 패키지
  handoff_reason  TEXT,                            -- T1|T2|T3|T4
  handoff_at      TIMESTAMPTZ,
  bot_summary     TEXT,
  bot_collected   JSONB NOT NULL DEFAULT '{}'::jsonb,
  bot_unanswered  JSONB NOT NULL DEFAULT '[]'::jsonb,  -- ★ AI 가 못 푼 것 = 사람이 할 일
  -- 봇 비용 (상한 없는 LLM 루프 = 예산 사고)
  bot_tokens_in   INTEGER NOT NULL DEFAULT 0,
  bot_tokens_out  INTEGER NOT NULL DEFAULT 0,
  bot_cost_krw    NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- 지표
  first_response_at   TIMESTAMPTZ,
  last_message_at     TIMESTAMPTZ,
  unread_for_agent    INTEGER NOT NULL DEFAULT 0,
  unread_for_customer INTEGER NOT NULL DEFAULT 0,
  -- 종결
  outcome       TEXT,                              -- resolved_chat|booked_call|booked_visit|ticket|abandoned
  callback_at   TIMESTAMPTZ,                       -- booked_call: 고객이 고른 시각 (무단 발신 금지)
  satisfaction  SMALLINT,
  summary       TEXT,
  tags          TEXT[] NOT NULL DEFAULT '{}',
  closed_at     TIMESTAMPTZ,
  closed_by     UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_conv_intent  CHECK (intent IN ('presale','cs','claim','etc')),
  CONSTRAINT ck_conv_status  CHECK (status IN ('bot','waiting','assigned','snoozed','closed')),
  CONSTRAINT ck_conv_outcome CHECK (outcome IS NULL OR outcome IN
                     ('resolved_chat','booked_call','booked_visit','ticket','abandoned')),
  -- 무단 발신 금지: 콜 예약이면 고객이 고른 시각이 반드시 있어야 한다
  CONSTRAINT ck_conv_callback CHECK (outcome <> 'booked_call' OR callback_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS ix_conv_dept_status ON desk.conversations (department_id, status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS ix_conv_topic       ON desk.conversations (topic_slug, intent, status);
CREATE INDEX IF NOT EXISTS ix_conv_agent       ON desk.conversations (assigned_agent_id, status);
CREATE INDEX IF NOT EXISTS ix_conv_phone       ON desk.conversations (phone);
CREATE INDEX IF NOT EXISTS ix_conv_crm         ON desk.conversations (crm_customer_id);
CREATE INDEX IF NOT EXISTS ix_conv_visitor     ON desk.conversations (visitor_key);
-- 대기열 SLA 감시용
CREATE INDEX IF NOT EXISTS ix_conv_waiting     ON desk.conversations (created_at) WHERE status = 'waiting';

-- ------------------------------------------------------------
-- 5) 메시지 — AI 대화와 사람 대화가 같은 스레드에 쌓인다
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS desk.messages (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES desk.conversations(id) ON DELETE CASCADE,
  sender_type     TEXT NOT NULL,                   -- customer|bot|agent|system
  sender_agent_id UUID REFERENCES public.incentive_agents(id) ON DELETE SET NULL,
  body            TEXT,
  rich            JSONB,                           -- 상품카드·비교표·견적·콜예약 카드
  attachments     JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_private      BOOLEAN NOT NULL DEFAULT FALSE,  -- 내부 메모 (고객에게 안 보임)
  bot_sources     JSONB,                           -- 봇 답변 근거 (환각 사후 추적)
  read_by_customer_at TIMESTAMPTZ,
  read_by_agent_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_msg_sender CHECK (sender_type IN ('customer','bot','agent','system'))
);
-- SSE 커서(since)용 — (대화, id) 순회
CREATE INDEX IF NOT EXISTS ix_msg_conv_id ON desk.messages (conversation_id, id);

-- ------------------------------------------------------------
-- 6) 이벤트 (배정·이관·종료 감사 로그)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS desk.events (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES desk.conversations(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,                   -- created|queued|bot_handoff|assigned|transferred|snoozed|closed|reopened|imported
  actor_type      TEXT,                            -- agent|bot|system|customer
  actor_id        UUID,
  from_value      TEXT,
  to_value        TEXT,
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_events_conv ON desk.events (conversation_id, created_at);

-- ------------------------------------------------------------
-- 7) 상담사 근무 상태 (배정 대상 판정)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS desk.operator_presence (
  agent_id       UUID PRIMARY KEY REFERENCES public.incentive_agents(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'offline',  -- online|away|busy|offline
  active_count   INTEGER NOT NULL DEFAULT 0,
  max_concurrent INTEGER NOT NULL DEFAULT 4,
  last_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_presence_status CHECK (status IN ('online','away','busy','offline'))
);

-- ------------------------------------------------------------
-- 8) 상용구
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS desk.canned_replies (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  topic_slug  TEXT,                                -- NULL = 전 토픽 공용
  intent      TEXT,
  shortcut    TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  variables   JSONB NOT NULL DEFAULT '[]'::jsonb,
  usage_count INTEGER NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 9) updated_at 자동 갱신
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION desk.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS tg_conv_touch ON desk.conversations;
CREATE TRIGGER tg_conv_touch BEFORE UPDATE ON desk.conversations
  FOR EACH ROW EXECUTE FUNCTION desk.touch_updated_at();


-- ------------------------------------------------------------
-- 9b) ★ 사람의 중간 개입(barge-in) 안전장치 ★
--     상담사는 AI 응대 중인 대화에 아무 때나 끼어들 수 있다.
--     함정: 그 순간 봇이 이미 응답을 생성 중이면, 사람이 이어받은 뒤에
--           봇 답변이 뒤늦게 도착해 고객에게 두 사람이 말하는 것처럼 보인다.
--     해결: 봇은 반드시 이 함수로만 말한다. status='bot' 이 아니면 조용히 버린다.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION desk.bot_say(
  p_conversation_id UUID,
  p_body            TEXT,
  p_rich            JSONB DEFAULT NULL,
  p_sources         JSONB DEFAULT NULL
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE v_id BIGINT;
BEGIN
  INSERT INTO desk.messages (conversation_id, sender_type, body, rich, bot_sources)
  SELECT p_conversation_id, 'bot', p_body, p_rich, p_sources
   WHERE EXISTS (
     SELECT 1 FROM desk.conversations
      WHERE id = p_conversation_id AND status = 'bot'   -- 사람이 이어받았으면 조건 불성립
   )
  RETURNING id INTO v_id;
  RETURN v_id;   -- NULL = 개입으로 인해 폐기됨 (에러 아님)
END $$;

-- 개입: 대기 상태가 아니어도(=봇 응대 중이어도) 이어받는다.
-- 동시성: 이미 다른 상담사가 잡았으면 0행 반환 → "이미 배정됨" 처리
CREATE OR REPLACE FUNCTION desk.claim(
  p_conversation_id UUID,
  p_agent_id        UUID,
  p_barge_in        BOOLEAN DEFAULT FALSE
) RETURNS TABLE (id UUID, status TEXT) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  UPDATE desk.conversations c
     SET status = 'assigned',
         assigned_agent_id = p_agent_id,
         assigned_at = now(),
         handoff_reason = COALESCE(c.handoff_reason, CASE WHEN p_barge_in THEN 'BARGE_IN' END)
   WHERE c.id = p_conversation_id
     AND c.assigned_agent_id IS NULL
     AND c.status IN ('bot','waiting','snoozed')   -- 'bot' 포함 = 개입 허용
  RETURNING c.id, c.status;
END $$;

-- 되돌리기: 사람 → AI (단순 문의로 판명 시)
CREATE OR REPLACE FUNCTION desk.release_to_bot(p_conversation_id UUID, p_agent_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE v_n INT;
BEGIN
  UPDATE desk.conversations
     SET status = 'bot', assigned_agent_id = NULL, assigned_at = NULL
   WHERE id = p_conversation_id AND assigned_agent_id = p_agent_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n > 0;
END $$;

-- ------------------------------------------------------------
-- 10) 보안 — RLS 활성 + anon/authenticated 권한 회수
--     정책을 만들지 않으므로 service key 외에는 전부 차단된다
-- ------------------------------------------------------------
ALTER TABLE desk.topics             ENABLE ROW LEVEL SECURITY;
ALTER TABLE desk.routing_rules      ENABLE ROW LEVEL SECURITY;
ALTER TABLE desk.conversations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE desk.messages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE desk.events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE desk.operator_presence  ENABLE ROW LEVEL SECURITY;
ALTER TABLE desk.canned_replies     ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON SCHEMA desk FROM anon, authenticated;
REVOKE ALL ON ALL TABLES    IN SCHEMA desk FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA desk FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA desk FROM anon, authenticated;

-- ------------------------------------------------------------
-- 11) ★ 퍼널(진입점) 레지스트리 ★
--     "다양한 퍼널에서 들어온다" — 퍼널이 늘어나도 코드/배포 0.
--     퍼널이 이미 아는 것(상품·의도·유입경로)은 고객에게 다시 묻지 않는다.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS desk.entry_points (
  slug             TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  channel          TEXT NOT NULL,                    -- app|web|geo|blog|store_qr|ad|kakao
  default_intent   TEXT,                             -- 퍼널이 아는 의도
  default_topic    TEXT,                             -- 퍼널이 아는 상품
  lock_topic       BOOLEAN NOT NULL DEFAULT FALSE,   -- true = 토픽 선택 화면 건너뜀
  display          TEXT NOT NULL DEFAULT 'floating', -- floating|fullscreen|inline
  greeting         TEXT,
  quick_replies    JSONB NOT NULL DEFAULT '[]'::jsonb,
  bot_prompt_add   TEXT,
  theme            JSONB NOT NULL DEFAULT '{}'::jsonb,
  db_source_id     BIGINT REFERENCES public.incentive_db_sources(id) ON DELETE SET NULL,
  crm_call_purpose TEXT,
  crm_tags         TEXT[] NOT NULL DEFAULT '{}',
  department_id    BIGINT REFERENCES public.incentive_departments(id) ON DELETE SET NULL,
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_ep_intent  CHECK (default_intent IS NULL OR default_intent IN ('presale','cs','claim','etc')),
  CONSTRAINT ck_ep_display CHECK (display IN ('floating','fullscreen','inline'))
);

ALTER TABLE desk.conversations
  ADD COLUMN IF NOT EXISTS entry_slug    TEXT REFERENCES desk.entry_points(slug) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS entry_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS db_source_id  BIGINT REFERENCES public.incentive_db_sources(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ix_conv_entry ON desk.conversations (entry_slug, created_at DESC);

ALTER TABLE desk.entry_points ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON desk.entry_points FROM anon, authenticated;

-- 채팅 유입용 CRM 소스 (기존 콜DB 소스 체계 재사용)
INSERT INTO public.incentive_db_sources (name, code, active, display_order)
SELECT '채팅 유입', 'CHAT', true, 90
WHERE NOT EXISTS (SELECT 1 FROM public.incentive_db_sources WHERE code='CHAT');
-- 퍼널 시드 9종은 별도 시드 스크립트 참조 (dev 적용완료)

-- ============================================================
-- 12) ★ 구조 결함 수정 (2026-09-04 적대적 점검에서 발견) ★
--     dev 에서 실제로 깨뜨려 확인한 8건. 10/10 재검증 통과.
-- ============================================================

-- S1 · SSE 메시지 영구 유실 (가장 위험)
--   IDENTITY 는 "채번 순서"이지 "커밋 순서"가 아니다.
--   동시 INSERT 에서 id=100 이 101 보다 늦게 커밋되면, since=101 로 읽은
--   클라이언트는 100 을 영원히 못 받는다. → 대화별 순번으로 교체.
ALTER TABLE desk.messages ADD COLUMN IF NOT EXISTS seq INTEGER;
CREATE OR REPLACE FUNCTION desk.assign_seq() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.seq IS NULL THEN
    PERFORM 1 FROM desk.conversations WHERE id = NEW.conversation_id FOR UPDATE;  -- 대화 단위 직렬화
    SELECT coalesce(max(seq),0)+1 INTO NEW.seq FROM desk.messages WHERE conversation_id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_msg_seq ON desk.messages;
CREATE TRIGGER tg_msg_seq BEFORE INSERT ON desk.messages FOR EACH ROW EXECUTE FUNCTION desk.assign_seq();
CREATE UNIQUE INDEX IF NOT EXISTS ux_msg_conv_seq ON desk.messages (conversation_id, seq);
-- ⇒ SSE 커서는 id 가 아니라 seq 를 쓴다: GET /api/desk/stream?conversation_id=..&since_seq=N

-- S5 · last_message_at / unread 미갱신 (정렬 인덱스가 의존하는 컬럼인데 트리거가 없었다)
CREATE OR REPLACE FUNCTION desk.after_message() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE desk.conversations SET
    last_message_at = NEW.created_at,
    first_response_at = CASE WHEN first_response_at IS NULL AND NEW.sender_type IN ('bot','agent')
                             THEN NEW.created_at ELSE first_response_at END,
    unread_for_agent = CASE WHEN NEW.sender_type='customer' THEN unread_for_agent + 1 ELSE unread_for_agent END,
    unread_for_customer = CASE WHEN NEW.sender_type IN ('bot','agent') AND NOT NEW.is_private
                               THEN unread_for_customer + 1 ELSE unread_for_customer END
  WHERE id = NEW.conversation_id;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS tg_msg_after ON desk.messages;
CREATE TRIGGER tg_msg_after AFTER INSERT ON desk.messages FOR EACH ROW EXECUTE FUNCTION desk.after_message();

-- S8 · PII 차단을 DB 로 (bot_say 와 같은 원칙 — 애플리케이션 실수와 무관하게)
--   ⚠ 한계: 주민번호·카드번호만. 계좌번호는 오탐 위험이 커서 애플리케이션에서 처리한다.
CREATE OR REPLACE FUNCTION desk.scrub_pii() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_orig TEXT := NEW.body;
BEGIN
  IF NEW.body IS NULL THEN RETURN NEW; END IF;
  NEW.body := regexp_replace(NEW.body, '\d{6}[-\s]?[1-4]\d{6}', '[주민번호 차단]', 'g');
  NEW.body := regexp_replace(NEW.body, '\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}', '[카드번호 차단]', 'g');
  IF NEW.body IS DISTINCT FROM v_orig THEN
    NEW.rich := coalesce(NEW.rich,'{}'::jsonb) || jsonb_build_object('pii_blocked', true);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_msg_pii ON desk.messages;
CREATE TRIGGER tg_msg_pii BEFORE INSERT OR UPDATE OF body ON desk.messages
  FOR EACH ROW EXECUTE FUNCTION desk.scrub_pii();

-- S3 · 토픽 slug 중복 (UNION ALL 이라 위젯에 같은 토픽이 2번 노출됐다)
-- S4 · 카테고리를 끄면 진행 중 대화가 조회 불가 → 비활성 포함 view 추가
CREATE OR REPLACE VIEW desk.v_topics AS
  SELECT slug, name, icon, product_group, 'desk.topics'::text AS source, display_order
    FROM desk.topics t WHERE active
     AND NOT EXISTS (SELECT 1 FROM public.rental_categories r WHERE r.slug = t.slug)  -- rental 이 마스터
  UNION ALL
  SELECT slug, name, COALESCE(icon,'📦'),
         CASE WHEN product_group = '여행/글로벌' THEN '여행/글로벌' ELSE '가전렌탈' END,
         'rental_categories'::text, sort_order
    FROM public.rental_categories WHERE is_active;

CREATE OR REPLACE VIEW desk.v_topics_all AS   -- 표시·조회용 (비활성 포함)
  SELECT slug, name, icon, product_group, 'desk.topics'::text AS source, display_order, active
    FROM desk.topics t
   WHERE NOT EXISTS (SELECT 1 FROM public.rental_categories r WHERE r.slug = t.slug)
  UNION ALL
  SELECT slug, name, COALESCE(icon,'📦'),
         CASE WHEN product_group = '여행/글로벌' THEN '여행/글로벌' ELSE '가전렌탈' END,
         'rental_categories'::text, sort_order, is_active
    FROM public.rental_categories;

-- S2 · 유령 대화 (없는 토픽으로 대화가 만들어져 어느 인박스에도 안 뜸)
--   토픽 소스가 view 라 FK 를 걸 수 없다 → 트리거로 검증.
--   ⚠ plpgsql 은 CASE 양쪽 분기를 모두 해석하므로 NEW.<필드> 직접 참조 불가 → TG_ARGV + to_jsonb
CREATE OR REPLACE FUNCTION desk.check_topic() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_col TEXT := TG_ARGV[0]; v_slug TEXT;
BEGIN
  v_slug := to_jsonb(NEW) ->> v_col;
  IF v_slug IS NULL THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM desk.v_topics_all WHERE slug = v_slug) THEN
    RAISE EXCEPTION '존재하지 않는 토픽: %', v_slug;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_conv_topic ON desk.conversations;
CREATE TRIGGER tg_conv_topic BEFORE INSERT OR UPDATE OF topic_slug ON desk.conversations
  FOR EACH ROW EXECUTE FUNCTION desk.check_topic('topic_slug');
DROP TRIGGER IF EXISTS tg_ep_topic ON desk.entry_points;
CREATE TRIGGER tg_ep_topic BEFORE INSERT OR UPDATE OF default_topic ON desk.entry_points
  FOR EACH ROW EXECUTE FUNCTION desk.check_topic('default_topic');

-- S7 · 폴백 이원화 + 좀비 규칙
--   route() 가 규칙표의 department_id 만 보고 desk_fallback 플래그를 안 봤다.
--   부서 삭제 시 ON DELETE SET NULL 로 department_id=NULL 인 활성 규칙(좀비)이 생길 수 있다.
CREATE OR REPLACE FUNCTION desk.route(p_intent TEXT, p_category TEXT)
RETURNS BIGINT LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    (SELECT r.department_id FROM desk.routing_rules r
      WHERE r.active
        AND (r.intent        IS NULL OR r.intent        = p_intent)
        AND (r.category_slug IS NULL OR r.category_slug = p_category)
      ORDER BY r.priority, r.id LIMIT 1),
    (SELECT d.id FROM public.incentive_departments d
      WHERE d.desk_fallback AND d.active AND d.desk_enabled LIMIT 1)   -- 최종 안전망
  );
$$;

-- S6 · 종료 대화 재개 경로 부재 (고객 재방문 시 처리 미정의였다)
CREATE OR REPLACE FUNCTION desk.reopen(p_conversation_id UUID, p_actor UUID DEFAULT NULL)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE v_n INT;
BEGIN
  UPDATE desk.conversations
     SET status='bot', outcome=NULL, closed_at=NULL, closed_by=NULL,
         assigned_agent_id=NULL, assigned_at=NULL
   WHERE id=p_conversation_id AND status='closed';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n > 0 THEN
    INSERT INTO desk.events (conversation_id, type, actor_type, actor_id, reason)
    VALUES (p_conversation_id, 'reopened', CASE WHEN p_actor IS NULL THEN 'customer' ELSE 'agent' END, p_actor, '고객 재방문');
  END IF;
  RETURN v_n > 0;
END $$;

COMMIT;
