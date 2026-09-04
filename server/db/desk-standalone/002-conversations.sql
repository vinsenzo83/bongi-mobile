-- ============================================================
-- 봉이 상담 데스크 — 독립 스키마 (002 대화·메시지·아웃바운드)
-- ============================================================
BEGIN;

CREATE TABLE desk.conversations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id   TEXT UNIQUE,                          -- 앱 세션 id (이관 멱등키)
  contact_id    UUID REFERENCES desk.contacts(id) ON DELETE SET NULL,
  -- 2축 분류
  intent        TEXT NOT NULL DEFAULT 'etc',
  topic_slug    TEXT NOT NULL,
  intent_confidence NUMERIC(3,2),
  -- 상태·배정
  status        TEXT NOT NULL DEFAULT 'bot',          -- bot|waiting|assigned|snoozed|closed
  channel       TEXT NOT NULL DEFAULT 'app',
  entry_slug    TEXT REFERENCES desk.entry_points(slug) ON DELETE SET NULL,
  entry_context JSONB NOT NULL DEFAULT '{}'::jsonb,   -- utm·ref(bref)·product_id·store_id
  department_id BIGINT REFERENCES desk.departments(id) ON DELETE SET NULL,
  assigned_agent_id UUID REFERENCES desk.agents(id) ON DELETE SET NULL,
  assigned_at   TIMESTAMPTZ,
  -- 신원 (전화가 없을 수 있다 — 소셜 인입)
  visitor_key   TEXT NOT NULL,
  phone         TEXT,
  customer_name TEXT,
  social_platform TEXT,
  social_user_id  TEXT,
  social_handle   TEXT,
  last_customer_at TIMESTAMPTZ,                       -- Meta 메시지 창 계산 기준
  -- AI 핸드오프 패키지
  handoff_reason TEXT,                                -- T1|T2|T3|T4|BARGE_IN
  handoff_at     TIMESTAMPTZ,
  bot_summary    TEXT,
  bot_collected  JSONB NOT NULL DEFAULT '{}'::jsonb,
  bot_unanswered JSONB NOT NULL DEFAULT '[]'::jsonb,  -- ★ AI 가 못 푼 것 = 사람이 할 일
  bot_tokens_in  INTEGER NOT NULL DEFAULT 0,
  bot_tokens_out INTEGER NOT NULL DEFAULT 0,
  bot_cost_krw   NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- 지표
  first_response_at TIMESTAMPTZ,
  last_message_at   TIMESTAMPTZ,
  unread_for_agent    INTEGER NOT NULL DEFAULT 0,
  unread_for_customer INTEGER NOT NULL DEFAULT 0,
  -- 종결
  outcome       TEXT,            -- resolved_chat|booked_call|booked_visit|ticket|abandoned
  callback_at   TIMESTAMPTZ,
  satisfaction  SMALLINT,
  summary       TEXT,
  tags          TEXT[] NOT NULL DEFAULT '{}',
  closed_at     TIMESTAMPTZ,
  closed_by     UUID REFERENCES desk.agents(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_conv_intent  CHECK (intent IN ('presale','cs','claim','etc')),
  CONSTRAINT ck_conv_status  CHECK (status IN ('bot','waiting','assigned','snoozed','closed')),
  CONSTRAINT ck_conv_outcome CHECK (outcome IS NULL OR outcome IN
                ('resolved_chat','booked_call','booked_visit','ticket','abandoned')),
  -- 무단 발신 금지: 콜 예약이면 고객이 고른 시각이 반드시 있어야 한다
  CONSTRAINT ck_conv_callback CHECK (outcome <> 'booked_call' OR callback_at IS NOT NULL)
);
CREATE INDEX ix_conv_dept    ON desk.conversations (department_id, status, last_message_at DESC);
CREATE INDEX ix_conv_topic   ON desk.conversations (topic_slug, intent, status);
CREATE INDEX ix_conv_agent   ON desk.conversations (assigned_agent_id, status);
CREATE INDEX ix_conv_contact ON desk.conversations (contact_id);
CREATE INDEX ix_conv_phone   ON desk.conversations (phone);
CREATE INDEX ix_conv_visitor ON desk.conversations (visitor_key);
CREATE INDEX ix_conv_social  ON desk.conversations (social_platform, social_user_id);
CREATE INDEX ix_conv_entry   ON desk.conversations (entry_slug, created_at DESC);
CREATE INDEX ix_conv_waiting ON desk.conversations (created_at) WHERE status = 'waiting';

-- 메시지. ★ 커서는 id 가 아니라 대화별 seq 다.
--   IDENTITY 는 채번 순서이지 커밋 순서가 아니라, 동시 INSERT 시 낮은 id 가 늦게 커밋되면
--   since=높은id 로 읽은 클라이언트가 그 메시지를 영원히 못 받는다.
CREATE TABLE desk.messages (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES desk.conversations(id) ON DELETE CASCADE,
  seq             INTEGER NOT NULL,
  sender_type     TEXT NOT NULL,                      -- customer|bot|agent|system
  sender_agent_id UUID REFERENCES desk.agents(id) ON DELETE SET NULL,
  body            TEXT,
  rich            JSONB,
  attachments     JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_private      BOOLEAN NOT NULL DEFAULT FALSE,     -- 내부 메모 (고객에게 안 보임)
  bot_sources     JSONB,                              -- 봇 답변 근거 (환각 사후 추적)
  read_by_customer_at TIMESTAMPTZ,
  read_by_agent_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_msg_sender CHECK (sender_type IN ('customer','bot','agent','system'))
);
CREATE UNIQUE INDEX ux_msg_conv_seq ON desk.messages (conversation_id, seq);
CREATE INDEX ix_msg_conv ON desk.messages (conversation_id, seq);

CREATE TABLE desk.events (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES desk.conversations(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,
  actor_type      TEXT,
  actor_id        UUID,
  from_value      TEXT,
  to_value        TEXT,
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_events_conv ON desk.events (conversation_id, created_at);

CREATE TABLE desk.canned_replies (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  topic_slug  TEXT,
  intent      TEXT,
  shortcut    TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  variables   JSONB NOT NULL DEFAULT '[]'::jsonb,
  usage_count INTEGER NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT TRUE
);

-- ── ★ 아웃바운드 큐 — 외부 시스템과의 유일한 접점 ────────────
--   CRM 이든 Meta 든, 남의 시스템에 직접 쓰지 않는다. 여기 쌓고 워커가 보낸다.
--   저쪽이 죽어도 우리 상담은 계속된다. 재시도·추적이 한 곳에 모인다.
CREATE TABLE desk.outbound_queue (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind            TEXT NOT NULL,        -- social_message | crm_lead | crm_note | crm_callback
  conversation_id UUID REFERENCES desk.conversations(id) ON DELETE CASCADE,
  message_seq     INTEGER,              -- social_message 일 때
  target          TEXT,                 -- instagram|threads|crm
  recipient_id    TEXT,                 -- IGSID 또는 CRM 고객 ref
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  body            TEXT,
  tag             TEXT,                 -- human_agent (Meta 24h 초과 시)
  -- ★ 멱등키: 재시도가 CRM 상담이력을 중복 INSERT 하는 것을 막는다.
  --   social 은 (conversation_id, message_seq) 로 자연 멱등이지만
  --   crm_* 는 그런 키가 없어 무방비였다.
  dedupe_key      TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  attempts        INTEGER NOT NULL DEFAULT 0,
  -- ★ 백오프: 이게 없으면 영구 실패하는 행을 워커가 뜨거운 루프로 계속 집는다.
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- ★ 동시성: 워커 2개(또는 재배포 중 겹침)가 같은 행을 집지 않게 한다.
  claimed_at      TIMESTAMPTZ,
  claimed_by      TEXT,
  last_error      TEXT,
  provider_ref    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at         TIMESTAMPTZ,
  CONSTRAINT ck_ob_kind   CHECK (kind IN ('social_message','crm_lead','crm_note','crm_callback')),
  CONSTRAINT ck_ob_status CHECK (status IN ('pending','sending','sent','failed','expired'))
);
-- 같은 메시지를 두 번 보내지 않는다 (소셜)
CREATE UNIQUE INDEX ux_ob_social ON desk.outbound_queue (conversation_id, message_seq)
  WHERE kind = 'social_message';
-- 같은 통지를 두 번 보내지 않는다 (CRM 등)
CREATE UNIQUE INDEX ux_ob_dedupe ON desk.outbound_queue (kind, dedupe_key)
  WHERE dedupe_key IS NOT NULL;
-- 워커가 집을 대상: 시각이 된 것만
CREATE INDEX ix_ob_ready ON desk.outbound_queue (kind, next_attempt_at)
  WHERE status = 'pending';
CREATE INDEX ix_ob_stuck ON desk.outbound_queue (claimed_at) WHERE status = 'sending';

-- 워커가 안전하게 집어간다. 두 워커가 같은 행을 못 잡는다.
CREATE OR REPLACE FUNCTION desk.outbound_claim(
  p_worker TEXT, p_kinds TEXT[] DEFAULT NULL, p_limit INT DEFAULT 20)
RETURNS jsonb LANGUAGE sql AS $$
  WITH picked AS (
    SELECT id FROM desk.outbound_queue
     WHERE status = 'pending'
       AND next_attempt_at <= now()
       AND attempts < 5
       AND (p_kinds IS NULL OR kind = ANY(p_kinds))
     ORDER BY next_attempt_at
     LIMIT p_limit
     FOR UPDATE SKIP LOCKED          -- ★ 동시 워커 안전
  ), claimed AS (
    UPDATE desk.outbound_queue q
       SET status='sending', claimed_at=now(), claimed_by=p_worker
      FROM picked WHERE q.id = picked.id
    RETURNING q.*
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'kind',kind,'conversation_id',conversation_id,'target',target,
    'recipient_id',recipient_id,'body',body,'tag',tag,'payload',payload,'attempts',attempts)
    ORDER BY id), '[]'::jsonb) FROM claimed;
$$;

-- 결과 기록. 실패는 지수 백오프로 되돌린다(1분 → 2 → 4 → 8 → 16분).
CREATE OR REPLACE FUNCTION desk.outbound_mark(
  p_id BIGINT, p_ok BOOLEAN, p_provider_ref TEXT DEFAULT NULL, p_error TEXT DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r desk.outbound_queue;
BEGIN
  UPDATE desk.outbound_queue
     SET status = CASE WHEN p_ok THEN 'sent'
                       WHEN attempts + 1 >= 5 THEN 'failed'
                       ELSE 'pending' END,
         attempts = attempts + 1,
         next_attempt_at = CASE WHEN p_ok THEN next_attempt_at
                                ELSE now() + make_interval(mins => power(2, attempts)::int) END,
         provider_ref = coalesce(p_provider_ref, provider_ref),
         last_error = CASE WHEN p_ok THEN NULL ELSE p_error END,
         sent_at = CASE WHEN p_ok THEN now() ELSE sent_at END,
         claimed_at = NULL, claimed_by = NULL
   WHERE id = p_id RETURNING * INTO r;
  IF r.id IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','발신 항목을 찾을 수 없습니다'); END IF;
  RETURN jsonb_build_object('ok',true,'status',r.status,'attempts',r.attempts,
                            'next_attempt_at',r.next_attempt_at);
END $$;

-- 워커가 죽어 'sending' 에 갇힌 행을 되살린다 (워커와 같은 프로세스의 별도 타이머에서 호출)
--   ★ attempts 를 올리고 백오프를 걸어야 한다.
--     그냥 pending 으로 되돌리면 워커를 죽이는 행(독약 메시지)이
--     집힘 → 사망 → reap → 즉시 재집힘 을 무한 반복하고 attempts < 5 상한에 영원히 도달하지 못한다.
--     상한 없는 재시도 루프는 사고를 낸다.
CREATE OR REPLACE FUNCTION desk.outbound_reap(p_stale_min INT DEFAULT 10)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_reaped INT; v_failed INT;
BEGIN
  WITH x AS (
    UPDATE desk.outbound_queue
       SET status = CASE WHEN attempts + 1 >= 5 THEN 'failed' ELSE 'pending' END,
           attempts = attempts + 1,
           next_attempt_at = now() + make_interval(mins => power(2, attempts)::int),
           claimed_at = NULL, claimed_by = NULL,
           last_error = '워커 응답 없음 — 회수됨 (worker=' || coalesce(claimed_by,'?') || ')'
     WHERE status = 'sending'
       AND claimed_at < now() - make_interval(mins => p_stale_min)
    RETURNING status)
  SELECT count(*), count(*) FILTER (WHERE status = 'failed') INTO v_reaped, v_failed FROM x;
  RETURN jsonb_build_object('reaped', v_reaped, 'moved_to_failed', v_failed);
END $$;

COMMIT;
