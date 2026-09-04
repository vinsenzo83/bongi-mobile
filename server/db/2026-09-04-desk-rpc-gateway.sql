-- ============================================================
-- 상담 데스크 RPC 게이트웨이 (public 스키마)
-- ============================================================
-- 왜 필요한가:
--   desk 스키마는 PostgREST 노출 목록에 없다(1차 방어선). 그래서 supabase-js 의
--   .from()/.schema() 로는 접근할 수 없다. 서버는 public 의 SECURITY DEFINER 함수로만
--   desk 에 접근한다. EXECUTE 는 anon/authenticated 에서 회수 → service_role 만 호출 가능.
--
-- 선행: 2026-09-03-desk-chat.sql (desk 스키마 · 테이블 · 내부 함수)
-- 적용: dev 검증 완료 → live 는 대표 승인 후
-- ⚠ CREATE OR REPLACE 는 시그니처가 다르면 교체가 아니라 오버로드를 만든다.
--    함수 인자를 바꿀 때는 반드시 옛 시그니처를 DROP 하라. (p12 사고 사례)
-- ============================================================
BEGIN;

-- 옛 시그니처 정리 (발신자 검증이 없던 2-인자 버전)
DROP FUNCTION IF EXISTS public.desk_customer_say(uuid, text);

-- ── 공통 ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.desk_mask_phone(p_phone TEXT, p_unrestricted BOOLEAN)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_phone IS NULL OR p_phone = '' THEN NULL
    WHEN p_unrestricted THEN p_phone
    ELSE (SELECT CASE WHEN length(d) >= 9 THEN left(d,3)||'-****-'||right(d,4) ELSE '****' END
            FROM (SELECT regexp_replace(p_phone,'[^0-9]','','g') d) x)
  END;
$$;

CREATE OR REPLACE FUNCTION public.desk_agent_scope(p_agent_id UUID)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
  SELECT jsonb_build_object(
    'agent_id', a.id, 'name', a.name, 'role', a.role, 'department_id', a.department_id,
    'department', (SELECT d.name FROM public.incentive_departments d WHERE d.id = a.department_id),
    'unrestricted', a.role IN ('admin','manager'),
    -- ⚠ unrestricted 에게 categories 를 [] 로 주면 "전체를 볼 수 있는 사람에게만 필터가 0개"
    --    라는 역전이 생긴다. 소비자마다 분기를 기억하게 하지 말고 여기서 계약을 지킨다.
    'categories', CASE WHEN a.role IN ('admin','manager')
      THEN coalesce((SELECT jsonb_agg(t.slug ORDER BY t.slug) FROM desk.v_topics t), '[]'::jsonb)
      ELSE coalesce((SELECT jsonb_agg(DISTINCT c) FROM (
             SELECT jsonb_array_elements_text(d.categories) c
               FROM public.incentive_departments d WHERE d.id = a.department_id
             UNION
             SELECT jsonb_array_elements_text(coalesce(a.handle_categories,'[]'::jsonb))
           ) x), '[]'::jsonb) END,
    -- 부서 미배치라 인박스가 빌 상태인지 소비자가 구분할 수 있게
    'unassigned', a.role NOT IN ('admin','manager')
                  AND a.department_id IS NULL
                  AND coalesce(a.handle_categories,'[]'::jsonb) = '[]'::jsonb)
  FROM public.incentive_agents a WHERE a.id = p_agent_id;
$$;

CREATE OR REPLACE FUNCTION public.desk_can_access(p_agent_id UUID, p_conversation_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
  SELECT EXISTS (
    SELECT 1 FROM desk.conversations c, (SELECT public.desk_agent_scope(p_agent_id) s) z
     WHERE c.id = p_conversation_id
       AND ( c.assigned_agent_id = p_agent_id
          OR (z.s->>'unrestricted')::boolean
          OR z.s->'categories' ? c.topic_slug
          OR c.department_id = (z.s->>'department_id')::bigint )
  );
$$;

CREATE OR REPLACE FUNCTION public.desk_can_act(p_agent_id UUID, p_conversation_id UUID)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
  -- 읽기는 desk_can_access(담당범위), 쓰기는 여기.
  -- 설계서 §7 "타인 대화 강제 이관 = admin·manager 만" 을 강제한다.
  --   ① 미배정(누구의 것도 아님) ② 내 대화(자기 건 이관은 정상 업무) ③ admin·manager
  SELECT CASE
    WHEN NOT public.desk_can_access(p_agent_id, p_conversation_id)
      THEN jsonb_build_object('ok', false, 'reason', '담당 범위가 아닌 대화입니다')
    WHEN EXISTS (
      SELECT 1 FROM desk.conversations c
       WHERE c.id = p_conversation_id
         AND c.assigned_agent_id IS NOT NULL
         AND c.assigned_agent_id <> p_agent_id
         AND NOT (public.desk_agent_scope(p_agent_id)->>'unrestricted')::boolean)
      THEN jsonb_build_object('ok', false, 'reason',
             (SELECT coalesce(a.name,'다른 상담사')||' 님이 응대 중입니다. 강제 개입은 관리자만 가능합니다'
                FROM desk.conversations c LEFT JOIN public.incentive_agents a ON a.id=c.assigned_agent_id
               WHERE c.id = p_conversation_id))
    ELSE jsonb_build_object('ok', true)
  END;
$$;

-- 이관 대상 상담사·부서 (기존 /api/incentive/agents 는 manager 이상 게이트라 agent 가 403)
-- ★ 노출은 최소로: id·이름·역할·부서·근무상태. 이메일·급여·연락처는 나가지 않는다.
CREATE OR REPLACE FUNCTION public.desk_assignable_agents(
  p_agent_id UUID, p_department_id BIGINT DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
  WITH me AS (SELECT public.desk_agent_scope(p_agent_id) s)
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', a.id, 'name', a.name, 'role', a.role,
      'department_id', a.department_id, 'department', d.name,
      'presence', coalesce(pr.status,'offline'),
      'active_count', coalesce(pr.active_count,0),
      'max_concurrent', coalesce(pr.max_concurrent,4),
      'is_me', a.id = p_agent_id
    ) ORDER BY (coalesce(pr.status,'offline')='online') DESC, a.name), '[]'::jsonb)
  FROM public.incentive_agents a
  LEFT JOIN public.incentive_departments d ON d.id = a.department_id
  LEFT JOIN desk.operator_presence pr ON pr.agent_id = a.id
  CROSS JOIN me
 WHERE a.active AND a.deleted_at IS NULL
   AND ( (me.s->>'unrestricted')::boolean
      OR a.department_id = (me.s->>'department_id')::bigint
      OR (p_department_id IS NOT NULL AND a.department_id = p_department_id) );
$$;

CREATE OR REPLACE FUNCTION public.desk_departments()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', d.id, 'name', d.name, 'categories', d.categories,
      'fallback', d.desk_fallback, 'sla_sec', d.desk_sla_sec,
      'online', (SELECT count(*) FROM public.incentive_agents a
                   JOIN desk.operator_presence p ON p.agent_id=a.id
                  WHERE a.department_id=d.id AND p.status='online'),
      'waiting', (SELECT count(*) FROM desk.conversations c
                   WHERE c.department_id=d.id AND c.status='waiting')
    ) ORDER BY d.display_order, d.name), '[]'::jsonb)
  FROM public.incentive_departments d WHERE d.active AND d.desk_enabled;
$$;

CREATE OR REPLACE FUNCTION public.desk_topics(p_entry_slug TEXT DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
  SELECT jsonb_build_object(
    'entry', (SELECT to_jsonb(e) FROM desk.entry_points e WHERE e.slug = p_entry_slug AND e.active),
    'topics', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'slug',t.slug,'name',t.name,'icon',t.icon,'group',t.product_group,'source',t.source)
        ORDER BY t.product_group, t.display_order) FROM desk.v_topics t),'[]'::jsonb));
$$;

CREATE OR REPLACE FUNCTION public.desk_messages_since(
  p_conversation_id UUID, p_since_seq INT DEFAULT 0, p_include_private BOOLEAN DEFAULT FALSE)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'seq',m.seq,'sender',m.sender_type,'agent_id',m.sender_agent_id,'body',m.body,
    'rich',m.rich,'sources',m.bot_sources,'private',m.is_private,'at',m.created_at) ORDER BY m.seq),'[]'::jsonb)
  FROM desk.messages m
 WHERE m.conversation_id = p_conversation_id AND m.seq > p_since_seq
   AND (p_include_private OR NOT m.is_private);
$$;

-- ── 앱 연동 (다른 팀이 만드는 고객앱 ↔ 데스크) ──────────────
CREATE OR REPLACE FUNCTION public.desk_import(
  p_external_id TEXT, p_messages JSONB, p_entry_slug TEXT DEFAULT 'app-home',
  p_intent TEXT DEFAULT NULL, p_topic TEXT DEFAULT NULL, p_phone TEXT DEFAULT NULL,
  p_name TEXT DEFAULT NULL, p_auth_user_id UUID DEFAULT NULL,
  p_handoff JSONB DEFAULT '{}'::jsonb, p_context JSONB DEFAULT '{}'::jsonb,
  p_visitor_key TEXT DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
DECLARE e desk.entry_points; v_id UUID; v_intent TEXT; v_topic TEXT; v_dept BIGINT; v_crm BIGINT;
        m JSONB; v_added INT := 0; v_existing BOOLEAN := FALSE; v_reason TEXT;
BEGIN
  IF p_external_id IS NULL OR btrim(p_external_id) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'external_id 는 필수입니다 (멱등키)');
  END IF;
  SELECT id INTO v_id FROM desk.conversations WHERE external_id = p_external_id;
  v_existing := v_id IS NOT NULL;
  IF NOT v_existing THEN
    SELECT * INTO e FROM desk.entry_points WHERE slug = p_entry_slug AND active;
    v_intent := coalesce(p_intent, e.default_intent, 'etc');
    v_topic  := coalesce(p_topic,  e.default_topic);
    IF v_topic IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason',
        'topic 을 정할 수 없습니다. topic 을 보내거나 default_topic 이 있는 entry_slug 를 쓰세요');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM desk.v_topics_all WHERE slug = v_topic) THEN
      RETURN jsonb_build_object('ok', false, 'reason', '존재하지 않는 topic: ' || v_topic);
    END IF;
    v_dept := coalesce(e.department_id, desk.route(v_intent, v_topic));
    IF p_phone IS NOT NULL THEN
      SELECT id INTO v_crm FROM public.incentive_customer_db
       WHERE regexp_replace(phone,'[^0-9]','','g') = regexp_replace(p_phone,'[^0-9]','','g')
       ORDER BY created_at DESC LIMIT 1;
    END IF;
    INSERT INTO desk.conversations (external_id, intent, topic_slug, topic_source, status, channel,
      entry_slug, entry_context, department_id, visitor_key, phone, customer_name, auth_user_id,
      crm_customer_id, crm_call_purpose, db_source_id, tags)
    VALUES (p_external_id, v_intent, v_topic,
      (SELECT source FROM desk.v_topics_all WHERE slug = v_topic LIMIT 1),
      'bot', coalesce(e.channel,'app'), coalesce(e.slug,'app-home'), p_context, v_dept,
      coalesce(p_visitor_key, 'ext:'||p_external_id), p_phone, p_name, p_auth_user_id,
      v_crm, e.crm_call_purpose, e.db_source_id, coalesce(e.crm_tags,'{}'))
    RETURNING id INTO v_id;
    INSERT INTO desk.events (conversation_id,type,actor_type,to_value,reason)
    VALUES (v_id,'imported','system',v_intent||'/'||v_topic,'앱 AI 1차 이력 이관');
  END IF;
  FOR m IN SELECT * FROM jsonb_array_elements(coalesce(p_messages,'[]'::jsonb)) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM desk.messages
       WHERE conversation_id = v_id
         AND sender_type = coalesce(m->>'sender_type','customer')
         AND coalesce(body,'') = coalesce(m->>'body','')
         AND created_at = coalesce((m->>'created_at')::timestamptz, created_at)
    ) THEN
      INSERT INTO desk.messages (conversation_id, sender_type, body, rich, bot_sources, created_at)
      VALUES (v_id,
        CASE WHEN coalesce(m->>'sender_type','customer') IN ('customer','bot','agent','system')
             THEN m->>'sender_type' ELSE 'customer' END,
        m->>'body', m->'rich', m->'bot_sources',
        coalesce((m->>'created_at')::timestamptz, now()));
      v_added := v_added + 1;
    END IF;
  END LOOP;
  IF p_handoff ? 'reason' THEN
    PERFORM public.desk_handoff(v_id, p_handoff->>'reason',
      coalesce(p_handoff->>'summary',
        (SELECT string_agg(body, ' / ' ORDER BY seq) FROM (
           SELECT body, seq FROM desk.messages
            WHERE conversation_id=v_id AND sender_type='customer' AND body IS NOT NULL
            ORDER BY seq DESC LIMIT 3) x)),
      coalesce(p_handoff->'collected','{}'::jsonb),
      coalesce(p_handoff->'unanswered','[]'::jsonb),
      (p_handoff->>'confidence')::numeric);
    v_reason := p_handoff->>'reason';
  END IF;
  RETURN jsonb_build_object('ok', true, 'conversation_id', v_id, 'created', NOT v_existing,
    'messages_added', v_added, 'status', (SELECT status FROM desk.conversations WHERE id=v_id),
    'department', (SELECT d.name FROM public.incentive_departments d
                    JOIN desk.conversations c ON c.department_id=d.id WHERE c.id=v_id),
    'queue_position', (SELECT count(*) FROM desk.conversations x
                        WHERE x.status='waiting' AND x.department_id=
                          (SELECT department_id FROM desk.conversations WHERE id=v_id)
                          AND coalesce(x.handoff_at,x.created_at) <=
                          (SELECT coalesce(handoff_at,created_at) FROM desk.conversations WHERE id=v_id)),
    'crm_matched', (SELECT crm_customer_id IS NOT NULL FROM desk.conversations WHERE id=v_id),
    'handoff_reason', v_reason);
END $$;

CREATE OR REPLACE FUNCTION public.desk_app_sync(p_external_id TEXT, p_since_seq INT DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
DECLARE r jsonb;
BEGIN
  SELECT jsonb_build_object(
    'ok', true, 'conversation_id', c.id, 'status', c.status,
    'mode', CASE c.status WHEN 'bot' THEN 'ai' WHEN 'waiting' THEN 'queued'
                          WHEN 'assigned' THEN 'agent' WHEN 'snoozed' THEN 'queued'
                          ELSE 'closed' END,
    'agent_name', (SELECT name FROM public.incentive_agents WHERE id = c.assigned_agent_id),
    'queue_position', CASE WHEN c.status='waiting' THEN
        (SELECT count(*) FROM desk.conversations x WHERE x.status='waiting'
          AND x.department_id=c.department_id
          AND coalesce(x.handoff_at,x.created_at) <= coalesce(c.handoff_at,c.created_at)) END,
    'outcome', c.outcome, 'callback_at', c.callback_at,
    'last_seq', coalesce((SELECT max(seq) FROM desk.messages
                           WHERE conversation_id=c.id AND NOT is_private), 0),
    'messages', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'seq',m.seq,'sender',m.sender_type,
        'agent_name',(SELECT name FROM public.incentive_agents WHERE id=m.sender_agent_id),
        'body',m.body,'rich',m.rich,'at',m.created_at) ORDER BY m.seq)
      FROM desk.messages m
     WHERE m.conversation_id=c.id AND m.seq > p_since_seq
       AND NOT m.is_private AND m.sender_type IN ('agent','system')), '[]'::jsonb))
  INTO r FROM desk.conversations c WHERE c.external_id = p_external_id;
  -- ⚠ 순수 SQL 이면 행이 0개일 때 함수가 NULL 을 반환한다. 계약({ok,reason})을 지킨다.
  IF r IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', '이관되지 않은 대화입니다');
  END IF;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.desk_app_customer_say(
  p_external_id TEXT, p_body TEXT, p_at TIMESTAMPTZ DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
DECLARE v UUID; v_seq INT; v_pii BOOLEAN;
BEGIN
  SELECT id INTO v FROM desk.conversations WHERE external_id = p_external_id;
  IF v IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','이관되지 않은 대화입니다'); END IF;
  PERFORM desk.reopen(v);
  INSERT INTO desk.messages (conversation_id, sender_type, body, created_at)
  VALUES (v,'customer',p_body, coalesce(p_at, now())) RETURNING seq INTO v_seq;
  SELECT (rich->>'pii_blocked')::boolean INTO v_pii FROM desk.messages WHERE conversation_id=v AND seq=v_seq;
  RETURN jsonb_build_object('ok',true,'seq',v_seq,'pii_blocked',coalesce(v_pii,false),
    'mode',(SELECT CASE status WHEN 'assigned' THEN 'agent' WHEN 'bot' THEN 'ai' ELSE 'queued' END
              FROM desk.conversations WHERE id=v));
END $$;

-- ── 봇·고객 (우리 위젯을 만들지 않으므로 앱 경로 보조용) ──────
CREATE OR REPLACE FUNCTION public.desk_bot_say(
  p_conversation_id UUID, p_body TEXT, p_rich JSONB DEFAULT NULL, p_sources JSONB DEFAULT NULL,
  p_tokens_in INT DEFAULT 0, p_tokens_out INT DEFAULT 0, p_cost NUMERIC DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
DECLARE v_id BIGINT;
BEGIN
  v_id := desk.bot_say(p_conversation_id, p_body, p_rich, p_sources);
  IF v_id IS NOT NULL THEN
    UPDATE desk.conversations SET bot_tokens_in = bot_tokens_in + p_tokens_in,
      bot_tokens_out = bot_tokens_out + p_tokens_out, bot_cost_krw = bot_cost_krw + p_cost
     WHERE id = p_conversation_id;
  END IF;
  RETURN jsonb_build_object('saved', v_id IS NOT NULL, 'message_id', v_id);
END $$;

CREATE OR REPLACE FUNCTION public.desk_customer_say(
  p_conversation_id UUID, p_body TEXT, p_visitor_key TEXT DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
DECLARE v_seq INT; v_pii BOOLEAN; v_owner TEXT;
BEGIN
  SELECT visitor_key INTO v_owner FROM desk.conversations WHERE id = p_conversation_id;
  IF v_owner IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','대화를 찾을 수 없습니다'); END IF;
  IF p_visitor_key IS NULL OR p_visitor_key <> v_owner THEN
    RETURN jsonb_build_object('ok',false,'reason','이 대화의 소유자가 아닙니다');
  END IF;
  INSERT INTO desk.messages (conversation_id, sender_type, body)
  VALUES (p_conversation_id, 'customer', p_body) RETURNING seq INTO v_seq;
  SELECT (rich->>'pii_blocked')::boolean INTO v_pii FROM desk.messages
   WHERE conversation_id = p_conversation_id AND seq = v_seq;
  PERFORM desk.reopen(p_conversation_id);
  RETURN jsonb_build_object('ok',true,'seq',v_seq,'pii_blocked',coalesce(v_pii,false));
END $$;

CREATE OR REPLACE FUNCTION public.desk_start(
  p_entry_slug TEXT, p_visitor_key TEXT, p_intent TEXT DEFAULT NULL, p_topic TEXT DEFAULT NULL,
  p_auth_user_id UUID DEFAULT NULL, p_phone TEXT DEFAULT NULL, p_name TEXT DEFAULT NULL,
  p_context JSONB DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
DECLARE e desk.entry_points; v_intent TEXT; v_topic TEXT; v_dept BIGINT; v_id UUID; v_crm BIGINT;
BEGIN
  SELECT * INTO e FROM desk.entry_points WHERE slug = p_entry_slug AND active;
  v_intent := coalesce(p_intent, e.default_intent, 'etc');
  v_topic  := coalesce(p_topic,  e.default_topic);
  IF v_topic IS NULL THEN RETURN jsonb_build_object('need_topic', true, 'entry', to_jsonb(e)); END IF;
  v_dept := coalesce(e.department_id, desk.route(v_intent, v_topic));
  IF p_phone IS NOT NULL THEN
    SELECT id INTO v_crm FROM public.incentive_customer_db
     WHERE regexp_replace(phone,'[^0-9]','','g') = regexp_replace(p_phone,'[^0-9]','','g')
     ORDER BY created_at DESC LIMIT 1;
  END IF;
  INSERT INTO desk.conversations (intent, topic_slug, topic_source, status, channel, entry_slug,
    entry_context, department_id, visitor_key, phone, customer_name, auth_user_id,
    crm_customer_id, crm_call_purpose, db_source_id, tags)
  VALUES (v_intent, v_topic, (SELECT source FROM desk.v_topics_all WHERE slug = v_topic LIMIT 1),
    'bot', coalesce(e.channel,'web'), e.slug, p_context, v_dept, p_visitor_key, p_phone, p_name,
    p_auth_user_id, v_crm, e.crm_call_purpose, e.db_source_id, coalesce(e.crm_tags,'{}'))
  RETURNING id INTO v_id;
  INSERT INTO desk.events (conversation_id, type, actor_type, to_value, reason)
  VALUES (v_id, 'created', 'customer', v_intent||'/'||v_topic, p_entry_slug);
  IF e.greeting IS NOT NULL THEN PERFORM desk.bot_say(v_id, e.greeting); END IF;
  RETURN jsonb_build_object('conversation_id', v_id, 'intent', v_intent, 'topic', v_topic,
    'department_id', v_dept, 'crm_matched', v_crm IS NOT NULL,
    'greeting', e.greeting, 'quick_replies', coalesce(e.quick_replies,'[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.desk_handoff(
  p_conversation_id UUID, p_reason TEXT, p_summary TEXT DEFAULT NULL,
  p_collected JSONB DEFAULT '{}'::jsonb, p_unanswered JSONB DEFAULT '[]'::jsonb,
  p_confidence NUMERIC DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
DECLARE v_n INT;
BEGIN
  UPDATE desk.conversations
     SET status='waiting', handoff_reason=p_reason, handoff_at=now(),
         bot_summary=p_summary, bot_collected=p_collected, bot_unanswered=p_unanswered,
         intent_confidence=coalesce(p_confidence, intent_confidence)
   WHERE id=p_conversation_id AND status='bot';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n > 0 THEN
    INSERT INTO desk.events (conversation_id,type,actor_type,to_value,reason)
    VALUES (p_conversation_id,'bot_handoff','bot','waiting',p_reason);
    INSERT INTO desk.messages (conversation_id, sender_type, body)
    VALUES (p_conversation_id, 'system', '상담사에게 연결 중입니다');
  END IF;
  RETURN jsonb_build_object('handed_off', v_n > 0);
END $$;

-- ── 상담사측 (담당범위 검사를 RPC 안에서 한다 — 라우트 우회 방지) ──
CREATE OR REPLACE FUNCTION public.desk_inbox(
  p_agent_id UUID, p_intent TEXT DEFAULT NULL, p_topic TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL, p_mine BOOLEAN DEFAULT FALSE, p_limit INT DEFAULT 50)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
  WITH scope AS (SELECT public.desk_agent_scope(p_agent_id) s)
  SELECT coalesce(jsonb_agg(x ORDER BY last_at DESC),'[]'::jsonb) FROM (
    SELECT jsonb_build_object(
      'id',c.id,'name',coalesce(c.customer_name,'(비회원)'),
      'phone', public.desk_mask_phone(c.phone, (SELECT (s->>'unrestricted')::boolean FROM scope)),
      'intent',c.intent,'topic',c.topic_slug,
      'topic_name',(SELECT name FROM desk.v_topics_all WHERE slug=c.topic_slug LIMIT 1),
      'topic_icon',(SELECT icon FROM desk.v_topics_all WHERE slug=c.topic_slug LIMIT 1),
      'department',(SELECT name FROM public.incentive_departments WHERE id=c.department_id),
      'status',c.status,'unread',c.unread_for_agent,'entry',c.entry_slug,
      'handoff_reason',c.handoff_reason,'assigned',c.assigned_agent_id,
      'mine', c.assigned_agent_id = p_agent_id,
      'last_at',coalesce(c.last_message_at,c.created_at),
      'last_body',(SELECT body FROM desk.messages WHERE conversation_id=c.id AND NOT is_private ORDER BY seq DESC LIMIT 1),
      'waiting_sec', CASE WHEN c.status='waiting'
                          THEN extract(epoch FROM now()-coalesce(c.handoff_at,c.created_at))::int END,
      'sla_breach', c.status='waiting' AND extract(epoch FROM now()-coalesce(c.handoff_at,c.created_at))
                    > coalesce((SELECT desk_sla_sec FROM public.incentive_departments WHERE id=c.department_id),180)
    ) x, coalesce(c.last_message_at,c.created_at) AS last_at
    FROM desk.conversations c, scope
    WHERE c.status <> 'closed'
      AND ( c.assigned_agent_id = p_agent_id            -- 내가 맡은 건 범위 불문 항상 보인다
         OR (scope.s->>'unrestricted')::boolean
         OR scope.s->'categories' ? c.topic_slug
         OR c.department_id = (scope.s->>'department_id')::bigint )
      AND (p_intent IS NULL OR c.intent = p_intent)
      AND (p_topic  IS NULL OR c.topic_slug = p_topic)
      AND (p_status IS NULL OR c.status = p_status)
      AND (NOT p_mine OR c.assigned_agent_id = p_agent_id)
    ORDER BY coalesce(c.last_message_at,c.created_at) DESC LIMIT p_limit
  ) t;
$$;

CREATE OR REPLACE FUNCTION public.desk_conversation(p_conversation_id UUID, p_agent_id UUID)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.desk_can_access(p_agent_id, p_conversation_id) THEN
    RETURN jsonb_build_object('ok',false,'reason','담당 범위가 아닌 대화입니다');
  END IF;
  SELECT jsonb_build_object(
    'ok',true,'id',c.id,'intent',c.intent,'topic',c.topic_slug,
    'topic_name',(SELECT name FROM desk.v_topics_all WHERE slug=c.topic_slug LIMIT 1),
    'status',c.status,'entry',c.entry_slug,'entry_context',c.entry_context,
    'department',(SELECT name FROM public.incentive_departments WHERE id=c.department_id),
    'assigned_agent',(SELECT name FROM public.incentive_agents WHERE id=c.assigned_agent_id),
    'customer', jsonb_build_object('name',c.customer_name,
      'phone', public.desk_mask_phone(c.phone,(public.desk_agent_scope(p_agent_id)->>'unrestricted')::boolean),
      'crm_id',c.crm_customer_id,'crm_matched',c.crm_customer_id IS NOT NULL,
      'call_purpose',c.crm_call_purpose,'tags',c.tags),
    'handoff', CASE WHEN c.handoff_reason IS NULL THEN NULL ELSE jsonb_build_object(
      'reason',c.handoff_reason,'confidence',c.intent_confidence,'summary',c.bot_summary,
      'collected',c.bot_collected,'unanswered',c.bot_unanswered,'at',c.handoff_at) END,
    'crm',(SELECT jsonb_build_object('grade',d.quality_grade,'dnt',d.is_dnt,'call_status',d.call_status,
             'category',d.category,'last_contacted',d.last_contacted_at)
             FROM public.incentive_customer_db d WHERE d.id=c.crm_customer_id),
    'history', coalesce((SELECT jsonb_agg(h ORDER BY h->>'at' DESC) FROM (
        SELECT jsonb_build_object('kind','채팅','at',x.created_at,'text',coalesce(x.bot_summary,x.summary,'대화')) h
          FROM desk.conversations x WHERE x.crm_customer_id=c.crm_customer_id AND x.id<>c.id
        UNION ALL
        SELECT jsonb_build_object('kind','콜','at',l.called_at,'text',coalesce(l.result,'')||' '||coalesce(l.notes,''))
          FROM public.incentive_customer_call_log l WHERE l.customer_id=c.crm_customer_id) hh),'[]'::jsonb),
    'bot_cost', jsonb_build_object('tokens_in',c.bot_tokens_in,'tokens_out',c.bot_tokens_out,'krw',c.bot_cost_krw)
  ) INTO r FROM desk.conversations c WHERE c.id=p_conversation_id;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.desk_claim(
  p_conversation_id UUID, p_agent_id UUID, p_barge_in BOOLEAN DEFAULT FALSE)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
DECLARE v_n INT; v_name TEXT;
BEGIN
  IF NOT public.desk_can_access(p_agent_id, p_conversation_id) THEN
    RETURN jsonb_build_object('ok',false,'reason','담당 범위가 아닌 대화입니다');
  END IF;
  SELECT count(*) INTO v_n FROM desk.claim(p_conversation_id, p_agent_id, p_barge_in);
  IF v_n = 0 THEN RETURN jsonb_build_object('ok',false,'reason','이미 다른 상담사가 받았습니다'); END IF;
  SELECT name INTO v_name FROM public.incentive_agents WHERE id=p_agent_id;
  INSERT INTO desk.events (conversation_id,type,actor_type,actor_id,to_value,reason)
  VALUES (p_conversation_id, CASE WHEN p_barge_in THEN 'barge_in' ELSE 'assigned' END,'agent',p_agent_id,'assigned',v_name);
  INSERT INTO desk.messages (conversation_id, sender_type, body)
  VALUES (p_conversation_id,'system','상담사 '||coalesce(v_name,'')||' 님이 참여했습니다');
  RETURN jsonb_build_object('ok',true,'barge_in',p_barge_in);
END $$;

CREATE OR REPLACE FUNCTION public.desk_reply(
  p_conversation_id UUID, p_agent_id UUID, p_body TEXT,
  p_private BOOLEAN DEFAULT FALSE, p_rich JSONB DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
DECLARE v_seq INT; g jsonb;
BEGIN
  -- 내부 메모는 남의 대화에도 허용(감독·인수인계, 고객에게 안 보임).
  -- 고객에게 나가는 답변만 소유권을 검사한다.
  IF p_private THEN
    IF NOT public.desk_can_access(p_agent_id, p_conversation_id) THEN
      RETURN jsonb_build_object('ok',false,'reason','담당 범위가 아닌 대화입니다');
    END IF;
  ELSE
    g := public.desk_can_act(p_agent_id, p_conversation_id);
    IF NOT (g->>'ok')::boolean THEN RETURN g; END IF;
  END IF;
  INSERT INTO desk.messages (conversation_id, sender_type, sender_agent_id, body, is_private, rich)
  VALUES (p_conversation_id,'agent',p_agent_id,p_body,p_private,p_rich) RETURNING seq INTO v_seq;
  IF NOT p_private THEN UPDATE desk.conversations SET unread_for_agent=0 WHERE id=p_conversation_id; END IF;
  RETURN jsonb_build_object('ok',true,'seq',v_seq);
END $$;

CREATE OR REPLACE FUNCTION public.desk_release(p_conversation_id UUID, p_agent_id UUID)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
DECLARE v_ok BOOLEAN;
BEGIN
  v_ok := desk.release_to_bot(p_conversation_id, p_agent_id);
  IF v_ok THEN
    INSERT INTO desk.events (conversation_id,type,actor_type,actor_id,to_value)
    VALUES (p_conversation_id,'released','agent',p_agent_id,'bot');
    INSERT INTO desk.messages (conversation_id,sender_type,body)
    VALUES (p_conversation_id,'system','AI 상담원이 이어서 도와드립니다');
  END IF;
  RETURN jsonb_build_object('ok',v_ok);
END $$;

CREATE OR REPLACE FUNCTION public.desk_close(
  p_conversation_id UUID, p_agent_id UUID, p_outcome TEXT,
  p_callback_at TIMESTAMPTZ DEFAULT NULL, p_summary TEXT DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
DECLARE c desk.conversations; v_name TEXT; g jsonb;
BEGIN
  g := public.desk_can_act(p_agent_id, p_conversation_id);
  IF NOT (g->>'ok')::boolean THEN RETURN g; END IF;
  IF p_outcome = 'booked_call' AND p_callback_at IS NULL THEN
    RETURN jsonb_build_object('ok',false,'reason','콜 예약은 고객이 고른 시각이 필요합니다 (무단 발신 금지)');
  END IF;
  UPDATE desk.conversations SET status='closed', outcome=p_outcome, callback_at=p_callback_at,
         summary=coalesce(p_summary,bot_summary), closed_at=now(), closed_by=p_agent_id
   WHERE id=p_conversation_id RETURNING * INTO c;
  IF c.id IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','대화를 찾을 수 없습니다'); END IF;
  SELECT name INTO v_name FROM public.incentive_agents WHERE id=p_agent_id;
  IF c.crm_customer_id IS NOT NULL THEN
    INSERT INTO public.incentive_customer_notes (customer_id, author_id, author_name, content, category)
    VALUES (c.crm_customer_id, p_agent_id, coalesce(v_name,'상담데스크'),
      '[채팅/'||c.intent||'/'||c.topic_slug||'] '||coalesce(c.summary,c.bot_summary,'상담 완료')
      ||CASE WHEN p_outcome='booked_call' THEN E'\n→ 콜 예약: '||p_callback_at::text ELSE '' END, '채팅');
    IF p_outcome = 'booked_call' THEN
      INSERT INTO public.incentive_customer_call_log (customer_id, agent_id, result, notes, callback_at)
      VALUES (c.crm_customer_id, p_agent_id, '채팅→콜예약', coalesce(c.bot_summary,''), p_callback_at);
    END IF;
  END IF;
  INSERT INTO desk.events (conversation_id,type,actor_type,actor_id,to_value)
  VALUES (p_conversation_id,'closed','agent',p_agent_id,p_outcome);
  RETURN jsonb_build_object('ok',true,'outcome',p_outcome,'crm_noted',c.crm_customer_id IS NOT NULL);
END $$;

CREATE OR REPLACE FUNCTION public.desk_transfer(
  p_conversation_id UUID, p_agent_id UUID, p_reason TEXT,
  p_to_department BIGINT DEFAULT NULL, p_to_agent UUID DEFAULT NULL, p_to_topic TEXT DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
DECLARE c desk.conversations; v_from TEXT; g jsonb;
BEGIN
  g := public.desk_can_act(p_agent_id, p_conversation_id);
  IF NOT (g->>'ok')::boolean THEN RETURN g; END IF;
  IF coalesce(btrim(p_reason),'') = '' THEN
    RETURN jsonb_build_object('ok',false,'reason','이관 사유는 필수입니다');
  END IF;
  SELECT * INTO c FROM desk.conversations WHERE id=p_conversation_id;
  v_from := coalesce((SELECT name FROM public.incentive_departments WHERE id=c.department_id),'-');
  UPDATE desk.conversations SET
    topic_slug     = coalesce(p_to_topic, topic_slug),
    department_id  = coalesce(p_to_department,
                       CASE WHEN p_to_topic IS NOT NULL THEN desk.route(intent, p_to_topic) ELSE department_id END),
    assigned_agent_id = p_to_agent,
    assigned_at    = CASE WHEN p_to_agent IS NULL THEN NULL ELSE now() END,
    status         = CASE WHEN p_to_agent IS NULL THEN 'waiting' ELSE 'assigned' END
   WHERE id=p_conversation_id;
  INSERT INTO desk.events (conversation_id,type,actor_type,actor_id,from_value,to_value,reason)
  VALUES (p_conversation_id,'transferred','agent',p_agent_id,v_from,
    coalesce((SELECT name FROM public.incentive_departments WHERE id=(SELECT department_id FROM desk.conversations WHERE id=p_conversation_id)),'-'),
    p_reason);
  INSERT INTO desk.messages (conversation_id,sender_type,body,is_private)
  VALUES (p_conversation_id,'agent','[이관] '||v_from||' → '||
    coalesce((SELECT name FROM public.incentive_departments WHERE id=(SELECT department_id FROM desk.conversations WHERE id=p_conversation_id)),'-')
    ||' · 사유: '||p_reason, true);
  RETURN jsonb_build_object('ok',true,
    'department',(SELECT name FROM public.incentive_departments WHERE id=(SELECT department_id FROM desk.conversations WHERE id=p_conversation_id)),
    'status',(SELECT status FROM desk.conversations WHERE id=p_conversation_id));
END $$;

CREATE OR REPLACE FUNCTION public.desk_snooze(
  p_conversation_id UUID, p_agent_id UUID, p_until TIMESTAMPTZ, p_reason TEXT DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
DECLARE g jsonb;
BEGIN
  g := public.desk_can_act(p_agent_id, p_conversation_id);
  IF NOT (g->>'ok')::boolean THEN RETURN g; END IF;
  IF p_until IS NULL OR p_until <= now() THEN
    RETURN jsonb_build_object('ok',false,'reason','보류 해제 시각은 현재보다 이후여야 합니다');
  END IF;
  UPDATE desk.conversations SET status='snoozed' WHERE id=p_conversation_id;
  INSERT INTO desk.events (conversation_id,type,actor_type,actor_id,to_value,reason)
  VALUES (p_conversation_id,'snoozed','agent',p_agent_id,p_until::text,p_reason);
  RETURN jsonb_build_object('ok',true,'until',p_until);
END $$;

-- ── 권한 회수: service_role 만 호출한다 ──────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid=p.pronamespace
            WHERE n.nspname='public' AND p.proname LIKE 'desk\_%'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END $$;


-- ── 소셜 채널 (2026-09-04-desk-social.sql 선행 필요) ─────────
CREATE OR REPLACE FUNCTION public.desk_social_inbound(
  p_platform TEXT, p_social_user_id TEXT, p_body TEXT,
  p_handle TEXT DEFAULT NULL, p_at TIMESTAMPTZ DEFAULT NULL,
  p_provider_msg_id TEXT DEFAULT NULL, p_entry_slug TEXT DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
DECLARE e desk.entry_points; v UUID; v_seq INT; v_new BOOLEAN := FALSE; v_ext TEXT; v_topic TEXT;
BEGIN
  IF p_platform NOT IN ('instagram','threads') THEN
    RETURN jsonb_build_object('ok',false,'reason','지원하지 않는 플랫폼: '||coalesce(p_platform,'null'));
  END IF;
  IF coalesce(btrim(p_social_user_id),'') = '' THEN
    RETURN jsonb_build_object('ok',false,'reason','social_user_id 는 필수입니다');
  END IF;
  v_ext := p_platform||':'||p_social_user_id;
  SELECT id INTO v FROM desk.conversations
   WHERE social_platform=p_platform AND social_user_id=p_social_user_id
   ORDER BY created_at DESC LIMIT 1;
  IF v IS NULL THEN
    SELECT * INTO e FROM desk.entry_points
     WHERE slug = coalesce(p_entry_slug, CASE p_platform WHEN 'instagram' THEN 'instagram-dm'
                                                        ELSE 'threads-reply' END) AND active;
    v_topic := coalesce(e.default_topic, 'unclassified');
    INSERT INTO desk.conversations (external_id, intent, topic_slug, topic_source, status, channel,
      entry_slug, department_id, visitor_key, customer_name,
      social_platform, social_user_id, social_handle, db_source_id, crm_call_purpose, tags)
    VALUES (v_ext, coalesce(e.default_intent,'etc'), v_topic, 'desk.topics', 'waiting', p_platform,
      e.slug, desk.route(coalesce(e.default_intent,'etc'), v_topic), v_ext,
      coalesce(p_handle,'@'||p_social_user_id),
      p_platform, p_social_user_id, p_handle, e.db_source_id, e.crm_call_purpose, coalesce(e.crm_tags,'{}'))
    RETURNING id INTO v;
    v_new := TRUE;
    INSERT INTO desk.events (conversation_id,type,actor_type,to_value,reason)
    VALUES (v,'created','customer',p_platform,'소셜 인입');
  ELSE
    PERFORM desk.reopen(v);
    IF p_handle IS NOT NULL THEN UPDATE desk.conversations SET social_handle=p_handle WHERE id=v; END IF;
  END IF;
  INSERT INTO desk.messages (conversation_id, sender_type, body, rich, created_at)
  VALUES (v,'customer',p_body,
          CASE WHEN p_provider_msg_id IS NOT NULL THEN jsonb_build_object('provider_msg_id',p_provider_msg_id) END,
          coalesce(p_at, now()))
  RETURNING seq INTO v_seq;
  RETURN jsonb_build_object('ok',true,'conversation_id',v,'created',v_new,'seq',v_seq,
    'status',(SELECT status FROM desk.conversations WHERE id=v),
    'topic',(SELECT topic_slug FROM desk.conversations WHERE id=v),
    'department',(SELECT d.name FROM public.incentive_departments d
                   JOIN desk.conversations c ON c.department_id=d.id WHERE c.id=v),
    'crm_matched',(SELECT crm_customer_id IS NOT NULL FROM desk.conversations WHERE id=v),
    'window', desk.messaging_window(v));
END $$;

CREATE OR REPLACE FUNCTION public.desk_outbound_pending(p_limit INT DEFAULT 20)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,'conversation_id',q.conversation_id,'platform',q.platform,
    'recipient_id',q.recipient_id,'body',q.body,'tag',q.tag,'attempts',q.attempts)
    ORDER BY q.created_at), '[]'::jsonb)
  FROM desk.outbound_queue q WHERE q.status='pending' AND q.attempts < 5 LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION public.desk_outbound_mark(
  p_id BIGINT, p_ok BOOLEAN, p_provider_msg_id TEXT DEFAULT NULL, p_error TEXT DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
DECLARE v_att INT;
BEGIN
  UPDATE desk.outbound_queue
     SET status = CASE WHEN p_ok THEN 'sent' WHEN attempts + 1 >= 5 THEN 'failed' ELSE 'pending' END,
         attempts = attempts + 1,
         provider_msg_id = coalesce(p_provider_msg_id, provider_msg_id),
         last_error = CASE WHEN p_ok THEN NULL ELSE p_error END,
         sent_at = CASE WHEN p_ok THEN now() ELSE sent_at END
   WHERE id = p_id RETURNING attempts INTO v_att;
  IF v_att IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','발신 항목을 찾을 수 없습니다'); END IF;
  RETURN jsonb_build_object('ok',true,'attempts',v_att,
    'status',(SELECT status FROM desk.outbound_queue WHERE id=p_id));
END $$;

CREATE OR REPLACE FUNCTION public.desk_window(p_conversation_id UUID)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
  SELECT desk.messaging_window(p_conversation_id);
$$;

-- ── 드리프트 검사 ─────────────────────────────────────────────
--  이 파일과 DB 가 어긋나면 배포 시 고친 것이 되돌아간다(실제로 3번 발생).
--  적용 직후 함수 개수와 권한을 확인한다.
DO $$
DECLARE v_expected TEXT[] := ARRAY[
    'desk_agent_scope',
    'desk_app_customer_say',
    'desk_app_sync',
    'desk_assignable_agents',
    'desk_bot_say',
    'desk_can_access',
    'desk_can_act',
    'desk_claim',
    'desk_close',
    'desk_conversation',
    'desk_customer_say',
    'desk_departments',
    'desk_handoff',
    'desk_import',
    'desk_inbox',
    'desk_mask_phone',
    'desk_messages_since',
    'desk_outbound_mark',
    'desk_outbound_pending',
    'desk_release',
    'desk_reply',
    'desk_snooze',
    'desk_social_inbound',
    'desk_start',
    'desk_topics',
    'desk_transfer',
    'desk_window'];
  v_actual TEXT[]; v_missing TEXT[]; v_extra TEXT[]; v_exposed INT;
BEGIN
  SELECT array_agg(DISTINCT p.proname ORDER BY p.proname) INTO v_actual
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname LIKE 'desk\_%';
  SELECT array_agg(x) INTO v_missing FROM unnest(v_expected) x WHERE x <> ALL(coalesce(v_actual,'{}'));
  SELECT array_agg(x) INTO v_extra   FROM unnest(coalesce(v_actual,'{}')) x WHERE x <> ALL(v_expected);
  SELECT count(*) INTO v_exposed FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname LIKE 'desk\_%'
     AND (has_function_privilege('anon', p.oid, 'EXECUTE')
       OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  IF v_missing IS NOT NULL THEN RAISE EXCEPTION '이 파일이 정의해야 할 함수가 없다: %', v_missing; END IF;
  IF v_exposed  > 0        THEN RAISE EXCEPTION '권한 회수 누락: %개 노출됨', v_exposed; END IF;
  IF v_extra IS NOT NULL THEN
    RAISE WARNING 'DB 에만 있고 파일에 없는 함수(드리프트): %', v_extra;   -- 배포는 막지 않되 반드시 보이게
  END IF;
  RAISE NOTICE 'desk_* 함수 %개 · 노출 0 · 드리프트 %',
    coalesce(array_length(v_actual,1),0), coalesce(array_to_string(v_extra,','),'없음');
END $$;

COMMIT;
