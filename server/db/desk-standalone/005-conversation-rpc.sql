-- ============================================================
-- 봉이 상담 데스크 — 독립 스키마 (005 대화 RPC)
-- ============================================================
-- CRM 결합 버전(bongi-mobile 의 desk_*)을 단독으로 포팅한 것.
-- 바뀐 참조:
--   incentive_agents      → desk.agents
--   incentive_departments → desk.departments
--   rental_categories     → desk.topics (UNION 소멸 — 소스가 하나가 됐다)
--   incentive_customer_db → desk.contacts
--   CRM 직접 INSERT       → desk.outbound_queue 적재 (crm_note / crm_callback)
-- ============================================================
BEGIN;

-- ── 토픽 뷰 (소스가 하나라 단순해졌다) ──────────────────────
CREATE OR REPLACE VIEW desk.v_topics AS
  SELECT slug, name, icon, product_group, source, display_order
    FROM desk.topics WHERE active;
CREATE OR REPLACE VIEW desk.v_topics_all AS
  SELECT slug, name, icon, product_group, source, display_order, active
    FROM desk.topics;

-- 유령 대화 차단 (없는 토픽으로 대화가 만들어지면 어느 인박스에도 안 뜬다)
CREATE OR REPLACE FUNCTION desk.check_topic() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_col TEXT := TG_ARGV[0]; v_slug TEXT;
BEGIN
  v_slug := to_jsonb(NEW) ->> v_col;
  IF v_slug IS NULL THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM desk.topics WHERE slug = v_slug) THEN
    RAISE EXCEPTION '존재하지 않는 topic: %', v_slug;   -- 최후 방어선. 정상 경로는 RPC 가 미리 막는다
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_conv_topic ON desk.conversations;
CREATE TRIGGER tg_conv_topic BEFORE INSERT OR UPDATE OF topic_slug ON desk.conversations
  FOR EACH ROW EXECUTE FUNCTION desk.check_topic('topic_slug');
DROP TRIGGER IF EXISTS tg_ep_topic ON desk.entry_points;
CREATE TRIGGER tg_ep_topic BEFORE INSERT OR UPDATE OF default_topic ON desk.entry_points
  FOR EACH ROW EXECUTE FUNCTION desk.check_topic('default_topic');

-- ── 라우팅 · 순번 · 카운터 ──────────────────────────────────
CREATE OR REPLACE FUNCTION desk.route(p_intent TEXT, p_category TEXT)
RETURNS BIGINT LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    (SELECT r.department_id FROM desk.routing_rules r
      WHERE r.active
        AND (r.intent        IS NULL OR r.intent        = p_intent)
        AND (r.category_slug IS NULL OR r.category_slug = p_category)
      ORDER BY r.priority, r.id LIMIT 1),
    (SELECT d.id FROM desk.departments d WHERE d.is_fallback AND d.enabled LIMIT 1));  -- 최종 안전망
$$;

-- 대화별 순번. ★ SSE/폴링 커서는 id 가 아니라 이것을 쓴다.
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

CREATE OR REPLACE FUNCTION desk.touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS tg_conv_touch ON desk.conversations;
CREATE TRIGGER tg_conv_touch BEFORE UPDATE ON desk.conversations
  FOR EACH ROW EXECUTE FUNCTION desk.touch_updated_at();

-- ── 개입 안전장치 ───────────────────────────────────────────
-- 봇은 반드시 이 함수로만 말한다. 사람이 이어받았으면 조용히 버린다.
--   (개입 직전 생성 중이던 봇 응답이 뒤늦게 도착해 고객 화면에서 두 사람이 말하는 것을 막는다)
CREATE OR REPLACE FUNCTION desk.bot_say(
  p_conversation_id UUID, p_body TEXT, p_rich JSONB DEFAULT NULL, p_sources JSONB DEFAULT NULL)
RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE v_id BIGINT;
BEGIN
  INSERT INTO desk.messages (conversation_id, sender_type, body, rich, bot_sources)
  SELECT p_conversation_id, 'bot', p_body, p_rich, p_sources
   WHERE EXISTS (SELECT 1 FROM desk.conversations WHERE id = p_conversation_id AND status = 'bot')
  RETURNING id INTO v_id;
  RETURN v_id;   -- NULL = 개입으로 폐기됨 (에러 아님)
END $$;

CREATE OR REPLACE FUNCTION desk.claim(
  p_conversation_id UUID, p_agent_id UUID, p_barge_in BOOLEAN DEFAULT FALSE)
RETURNS TABLE (out_id UUID, out_status TEXT) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  UPDATE desk.conversations c
     SET status='assigned', assigned_agent_id=p_agent_id, assigned_at=now(),
         handoff_reason = COALESCE(c.handoff_reason, CASE WHEN p_barge_in THEN 'BARGE_IN' END)
   WHERE c.id = p_conversation_id
     AND c.assigned_agent_id IS NULL
     AND c.status IN ('bot','waiting','snoozed')      -- 'bot' 포함 = 개입 허용
  RETURNING c.id, c.status;
END $$;

CREATE OR REPLACE FUNCTION desk.release_to_bot(p_conversation_id UUID, p_agent_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE v_n INT;
BEGIN
  UPDATE desk.conversations SET status='bot', assigned_agent_id=NULL, assigned_at=NULL
   WHERE id=p_conversation_id AND assigned_agent_id=p_agent_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; RETURN v_n > 0;
END $$;

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
    INSERT INTO desk.events (conversation_id,type,actor_type,actor_id,reason)
    VALUES (p_conversation_id,'reopened',CASE WHEN p_actor IS NULL THEN 'customer' ELSE 'agent' END,p_actor,'고객 재방문');
  END IF;
  RETURN v_n > 0;
END $$;

-- ── 권한 ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION desk.agent_scope(p_agent_id UUID)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'agent_id', a.id, 'name', a.name, 'role', a.role,
    'department_id', a.department_id,
    'department', (SELECT d.name FROM desk.departments d WHERE d.id = a.department_id),
    'unrestricted', a.role IN ('admin','manager'),
    -- unrestricted 에게 빈 배열을 주면 "전체를 볼 수 있는 사람에게만 필터가 0개" 라는 역전이 생긴다
    'categories', CASE WHEN a.role IN ('admin','manager')
      THEN coalesce((SELECT jsonb_agg(t.slug ORDER BY t.slug) FROM desk.v_topics t), '[]'::jsonb)
      ELSE coalesce((SELECT jsonb_agg(DISTINCT c) FROM (
             SELECT jsonb_array_elements_text(d.categories) c FROM desk.departments d WHERE d.id = a.department_id
             UNION
             SELECT jsonb_array_elements_text(coalesce(a.handle_categories,'[]'::jsonb))) x), '[]'::jsonb) END,
    'unassigned', a.role NOT IN ('admin','manager') AND a.department_id IS NULL
                  AND coalesce(a.handle_categories,'[]'::jsonb) = '[]'::jsonb)
  FROM desk.agents a WHERE a.id = p_agent_id AND a.active;
$$;

-- 읽기 권한: 담당 범위
CREATE OR REPLACE FUNCTION desk.can_access(p_agent_id UUID, p_conversation_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM desk.conversations c, (SELECT desk.agent_scope(p_agent_id) s) z
     WHERE c.id = p_conversation_id
       AND ( c.assigned_agent_id = p_agent_id           -- 내가 맡은 건 범위 불문
          OR (z.s->>'unrestricted')::boolean
          OR z.s->'categories' ? c.topic_slug
          OR c.department_id = (z.s->>'department_id')::bigint ));
$$;

-- 쓰기 권한: 남이 응대 중인 대화는 admin·manager 만 (설계서 §7)
CREATE OR REPLACE FUNCTION desk.can_act(p_agent_id UUID, p_conversation_id UUID)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN NOT desk.can_access(p_agent_id, p_conversation_id)
      THEN jsonb_build_object('ok', false, 'reason', '담당 범위가 아닌 대화입니다')
    WHEN EXISTS (
      SELECT 1 FROM desk.conversations c
       WHERE c.id = p_conversation_id
         AND c.assigned_agent_id IS NOT NULL
         AND c.assigned_agent_id <> p_agent_id
         AND NOT (desk.agent_scope(p_agent_id)->>'unrestricted')::boolean)
      THEN jsonb_build_object('ok', false, 'reason',
             (SELECT coalesce(a.name,'다른 상담사')||' 님이 응대 중입니다. 강제 개입은 관리자만 가능합니다'
                FROM desk.conversations c LEFT JOIN desk.agents a ON a.id=c.assigned_agent_id
               WHERE c.id = p_conversation_id))
    ELSE jsonb_build_object('ok', true) END;
$$;

COMMIT;
