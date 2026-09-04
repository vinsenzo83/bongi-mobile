-- ============================================================
-- 소셜 채널 (인스타그램 DM / 쓰레드 답글)
-- ============================================================
-- 선행: 2026-09-03-desk-chat.sql → 2026-09-04-desk-rpc-gateway.sql
--
-- ★ 앱 연동과 결정적으로 다른 점: 방향이 반대다.
--     앱   = 앱이 우리에게 가져간다 (pull)  → desk_app_sync
--     소셜 = Meta 웹훅으로 들어오고, 우리가 Meta 로 보낸다 (push) → 발신 큐 필요
--
-- ⚠ 쓰레드 DM 은 제3자 API 가 없다(2026-09 확인). 쓰레드는 답글·멘션만 인입 가능.
--    구조는 열어두되 실제 연동은 인스타그램 DM 부터다.
--
-- ⚠ Meta 메시지 창 정책: 표준 24시간, human_agent 태그 시 7일.
--    이 판정을 사람이 외우게 하지 않고 DB 가 자동으로 한다.
-- ============================================================
BEGIN;

-- 1) 소셜 신원 (전화번호가 없다 → CRM 매칭이 끊기는 지점)
ALTER TABLE desk.conversations
  ADD COLUMN IF NOT EXISTS social_platform  TEXT,        -- instagram | threads
  ADD COLUMN IF NOT EXISTS social_user_id   TEXT,        -- Meta scoped user id (IGSID)
  ADD COLUMN IF NOT EXISTS social_handle    TEXT,        -- @username (변경될 수 있음, 표시용)
  ADD COLUMN IF NOT EXISTS last_customer_at TIMESTAMPTZ; -- 24h 창 계산 기준
CREATE INDEX IF NOT EXISTS ix_conv_social ON desk.conversations (social_platform, social_user_id);

CREATE OR REPLACE FUNCTION desk.touch_customer_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.sender_type = 'customer' THEN
    UPDATE desk.conversations SET last_customer_at = NEW.created_at WHERE id = NEW.conversation_id;
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS tg_msg_customer_at ON desk.messages;
CREATE TRIGGER tg_msg_customer_at AFTER INSERT ON desk.messages
  FOR EACH ROW EXECUTE FUNCTION desk.touch_customer_at();

-- 2) 발신 큐
CREATE TABLE IF NOT EXISTS desk.outbound_queue (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES desk.conversations(id) ON DELETE CASCADE,
  message_seq     INTEGER NOT NULL,
  platform        TEXT NOT NULL,
  recipient_id    TEXT NOT NULL,
  body            TEXT,
  tag             TEXT,                              -- human_agent
  status          TEXT NOT NULL DEFAULT 'pending',
  attempts        INTEGER NOT NULL DEFAULT 0,
  last_error      TEXT,
  provider_msg_id TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at         TIMESTAMPTZ,
  CONSTRAINT ck_ob_status CHECK (status IN ('pending','sent','failed','expired')),
  CONSTRAINT ux_ob_msg UNIQUE (conversation_id, message_seq)   -- 중복 발신 방지
);
CREATE INDEX IF NOT EXISTS ix_ob_pending ON desk.outbound_queue (created_at) WHERE status='pending';
ALTER TABLE desk.outbound_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON desk.outbound_queue FROM anon, authenticated;

-- 3) 메시지 창 판정
CREATE OR REPLACE FUNCTION desk.messaging_window(p_conversation_id UUID)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'last_customer_at', c.last_customer_at,
    'hours_since', round(extract(epoch FROM now()-c.last_customer_at)/3600.0, 1),
    'state', CASE
       WHEN c.last_customer_at IS NULL THEN 'unknown'
       WHEN now() - c.last_customer_at <= interval '24 hours' THEN 'standard'
       WHEN now() - c.last_customer_at <= interval '7 days'   THEN 'human_agent'
       ELSE 'expired' END,
    'tag', CASE WHEN c.last_customer_at IS NOT NULL
                 AND now() - c.last_customer_at >  interval '24 hours'
                 AND now() - c.last_customer_at <= interval '7 days'
                THEN 'human_agent' END)
  FROM desk.conversations c WHERE c.id = p_conversation_id;
$$;

-- 4) 상담사 답변 → 발신 큐 (창 상태를 보고 태그를 붙이거나 차단한다)
CREATE OR REPLACE FUNCTION desk.enqueue_outbound() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c desk.conversations; w jsonb;
BEGIN
  IF NEW.sender_type <> 'agent' OR NEW.is_private THEN RETURN NULL; END IF;   -- 내부메모는 안 나간다
  SELECT * INTO c FROM desk.conversations WHERE id = NEW.conversation_id;
  IF c.social_platform IS NULL OR c.social_user_id IS NULL THEN RETURN NULL; END IF;
  w := desk.messaging_window(NEW.conversation_id);
  INSERT INTO desk.outbound_queue (conversation_id, message_seq, platform, recipient_id, body, tag, status, last_error)
  VALUES (NEW.conversation_id, NEW.seq, c.social_platform, c.social_user_id, NEW.body, w->>'tag',
          CASE WHEN w->>'state' = 'expired' THEN 'expired' ELSE 'pending' END,
          CASE WHEN w->>'state' = 'expired'
               THEN '메시지 창 만료(7일 초과) — 고객이 먼저 말해야 발신 가능' END)
  ON CONFLICT (conversation_id, message_seq) DO NOTHING;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS tg_msg_outbound ON desk.messages;
CREATE TRIGGER tg_msg_outbound AFTER INSERT ON desk.messages
  FOR EACH ROW EXECUTE FUNCTION desk.enqueue_outbound();

-- 5) 미분류 토픽 — 소셜 DM 은 "무슨 상품인지" 를 모른 채 들어온다
INSERT INTO desk.topics (slug, name, icon, product_group, display_order, bot_enabled)
VALUES ('unclassified','미분류','❓','고객지원', 999, false) ON CONFLICT (slug) DO NOTHING;
INSERT INTO desk.routing_rules (priority, intent, category_slug, department_id, note)
SELECT 40, NULL, 'unclassified', id, '미분류(소셜 인입) — 상담사가 분류 후 이관'
  FROM public.incentive_departments WHERE desk_fallback
  AND NOT EXISTS (SELECT 1 FROM desk.routing_rules WHERE category_slug='unclassified');

-- 6) 소셜 진입점
INSERT INTO desk.entry_points (slug, name, channel, display, crm_tags, db_source_id)
SELECT * FROM (VALUES
 ('instagram-dm','인스타그램 DM','instagram','fullscreen',ARRAY['instagram','social']),
 ('threads-reply','쓰레드 답글·멘션','threads','fullscreen',ARRAY['threads','social'])
) AS v(slug,name,channel,display,crm_tags)
CROSS JOIN LATERAL (SELECT id FROM public.incentive_db_sources WHERE code='CHAT') s(db_source_id)
ON CONFLICT (slug) DO NOTHING;

COMMIT;
