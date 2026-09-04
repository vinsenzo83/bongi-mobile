-- ============================================================
-- 봉이 상담 데스크 — 독립 스키마 (006 public API)
-- ============================================================
-- desk 스키마는 PostgREST 미노출. 서버는 이 래퍼로만 접근한다.
-- ★ CRM 직접 INSERT 는 전부 아웃바운드 큐 적재로 바뀌었다.
-- ============================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.desk_mask_phone(p_phone TEXT, p_unmask BOOLEAN)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$ SELECT desk.mask_phone(p_phone, p_unmask); $$;

CREATE OR REPLACE FUNCTION public.desk_agent_scope(p_agent_id UUID)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
  SELECT desk.agent_scope(p_agent_id); $$;

CREATE OR REPLACE FUNCTION public.desk_topics(p_entry_slug TEXT DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
  SELECT jsonb_build_object(
    'entry', (SELECT to_jsonb(e) FROM desk.entry_points e WHERE e.slug = p_entry_slug AND e.active),
    'topics', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'slug',t.slug,'name',t.name,'icon',t.icon,'group',t.product_group,'source',t.source)
        ORDER BY t.product_group, t.display_order) FROM desk.v_topics t),'[]'::jsonb)); $$;

CREATE OR REPLACE FUNCTION public.desk_departments()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id',d.id,'name',d.name,'categories',d.categories,'fallback',d.is_fallback,'sla_sec',d.sla_sec,
      'online',(SELECT count(*) FROM desk.agents a JOIN desk.operator_presence p ON p.agent_id=a.id
                 WHERE a.department_id=d.id AND p.status='online'),
      'waiting',(SELECT count(*) FROM desk.conversations c WHERE c.department_id=d.id AND c.status='waiting'))
    ORDER BY d.display_order, d.name),'[]'::jsonb)
  FROM desk.departments d WHERE d.enabled; $$;

CREATE OR REPLACE FUNCTION public.desk_assignable_agents(p_agent_id UUID, p_department_id BIGINT DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
  WITH me AS (SELECT desk.agent_scope(p_agent_id) s)
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id',a.id,'name',a.name,'role',a.role,'department_id',a.department_id,'department',d.name,
      'presence',coalesce(pr.status,'offline'),'active_count',coalesce(pr.active_count,0),
      'max_concurrent',a.max_concurrent,'is_me',a.id=p_agent_id)
    ORDER BY (coalesce(pr.status,'offline')='online') DESC, a.name),'[]'::jsonb)
  FROM desk.agents a
  LEFT JOIN desk.departments d ON d.id=a.department_id
  LEFT JOIN desk.operator_presence pr ON pr.agent_id=a.id
  CROSS JOIN me
 WHERE a.active
   AND ( (me.s->>'unrestricted')::boolean
      OR a.department_id = (me.s->>'department_id')::bigint
      OR (p_department_id IS NOT NULL AND a.department_id = p_department_id) ); $$;

-- ── 인박스 · 상세 ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.desk_inbox(
  p_agent_id UUID, p_intent TEXT DEFAULT NULL, p_topic TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL, p_mine BOOLEAN DEFAULT FALSE, p_limit INT DEFAULT 50)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
  WITH scope AS (SELECT desk.agent_scope(p_agent_id) s)
  SELECT coalesce(jsonb_agg(x ORDER BY last_at DESC),'[]'::jsonb) FROM (
    SELECT jsonb_build_object(
      'id',c.id,'name',coalesce(c.customer_name,'(비회원)'),
      'phone', desk.mask_phone(c.phone,(SELECT (s->>'unrestricted')::boolean FROM scope)),
      'intent',c.intent,'topic',c.topic_slug,
      'topic_name',(SELECT name FROM desk.v_topics_all WHERE slug=c.topic_slug LIMIT 1),
      'topic_icon',(SELECT icon FROM desk.v_topics_all WHERE slug=c.topic_slug LIMIT 1),
      'department',(SELECT name FROM desk.departments WHERE id=c.department_id),
      'status',c.status,'unread',c.unread_for_agent,'entry',c.entry_slug,'channel',c.channel,
      'handoff_reason',c.handoff_reason,'assigned',c.assigned_agent_id,
      'mine', c.assigned_agent_id = p_agent_id,
      'last_at',coalesce(c.last_message_at,c.created_at),
      'last_body',(SELECT body FROM desk.messages WHERE conversation_id=c.id AND NOT is_private ORDER BY seq DESC LIMIT 1),
      'waiting_sec', CASE WHEN c.status='waiting'
                          THEN extract(epoch FROM now()-coalesce(c.handoff_at,c.created_at))::int END,
      'sla_breach', c.status='waiting' AND extract(epoch FROM now()-coalesce(c.handoff_at,c.created_at))
                    > coalesce((SELECT sla_sec FROM desk.departments WHERE id=c.department_id),180)
    ) x, coalesce(c.last_message_at,c.created_at) AS last_at
    FROM desk.conversations c, scope
    WHERE c.status <> 'closed'
      AND ( c.assigned_agent_id = p_agent_id
         OR (scope.s->>'unrestricted')::boolean
         OR scope.s->'categories' ? c.topic_slug
         OR c.department_id = (scope.s->>'department_id')::bigint )
      AND (p_intent IS NULL OR c.intent = p_intent)
      AND (p_topic  IS NULL OR c.topic_slug = p_topic)
      AND (p_status IS NULL OR c.status = p_status)
      AND (NOT p_mine OR c.assigned_agent_id = p_agent_id)
    ORDER BY coalesce(c.last_message_at,c.created_at) DESC LIMIT p_limit) t; $$;

CREATE OR REPLACE FUNCTION public.desk_conversation(p_conversation_id UUID, p_agent_id UUID)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
DECLARE r jsonb;
BEGIN
  IF NOT desk.can_access(p_agent_id, p_conversation_id) THEN
    RETURN jsonb_build_object('ok',false,'reason','담당 범위가 아닌 대화입니다');
  END IF;
  SELECT jsonb_build_object(
    'ok',true,'id',c.id,'intent',c.intent,'topic',c.topic_slug,
    'topic_name',(SELECT name FROM desk.v_topics_all WHERE slug=c.topic_slug LIMIT 1),
    'status',c.status,'entry',c.entry_slug,'entry_context',c.entry_context,'channel',c.channel,
    'department',(SELECT name FROM desk.departments WHERE id=c.department_id),
    'assigned_agent',(SELECT name FROM desk.agents WHERE id=c.assigned_agent_id),
    'customer', jsonb_build_object('name',c.customer_name,
      'phone', desk.mask_phone(c.phone,(desk.agent_scope(p_agent_id)->>'unrestricted')::boolean),
      'social_handle',c.social_handle,'social_platform',c.social_platform,
      'contact_id',c.contact_id,'tags',c.tags,
      -- crm_id 는 없어졌다. 저쪽 고객 id 는 crm.ref 로 옮겼다(우리가 발급하지 않는 값이므로).
      'crm_ref',(SELECT ct.crm_ref FROM desk.contacts ct WHERE ct.id=c.contact_id),
      -- 콜 목적은 CRM 값이 아니라 퍼널 설정(우리 것)이다. 계속 보여줄 수 있다.
      'call_purpose',(SELECT e.crm_purpose FROM desk.entry_points e WHERE e.slug=c.entry_slug)),
    -- ★ CRM 은 남의 시스템. 우리가 아는 건 참조값과 우리가 보낸 통지 상태뿐이다.
    'crm', (SELECT jsonb_build_object('ref',ct.crm_ref,'synced_at',ct.crm_synced_at,
              'dnt',ct.dnt,'consent_at',ct.consent_at)
              FROM desk.contacts ct WHERE ct.id = c.contact_id),
    'crm_outbound', (SELECT jsonb_agg(jsonb_build_object('kind',q.kind,'status',q.status,
                        'attempts',q.attempts,'at',q.created_at) ORDER BY q.id DESC)
                       FROM desk.outbound_queue q
                      WHERE q.conversation_id=c.id AND q.kind LIKE 'crm%'),
    'handoff', CASE WHEN c.handoff_reason IS NULL THEN NULL ELSE jsonb_build_object(
      'reason',c.handoff_reason,'confidence',c.intent_confidence,'summary',c.bot_summary,
      'collected',c.bot_collected,'unanswered',c.bot_unanswered,'at',c.handoff_at) END,
    'window', CASE WHEN c.social_platform IS NOT NULL
                   THEN desk.messaging_window(c.id) END,
    'history', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'kind','채팅','at',x.created_at,'text',coalesce(x.bot_summary,x.summary,'대화'))
        ORDER BY x.created_at DESC)
        FROM desk.conversations x WHERE x.contact_id = c.contact_id AND x.id <> c.id),'[]'::jsonb),
    'bot_cost', jsonb_build_object('tokens_in',c.bot_tokens_in,'tokens_out',c.bot_tokens_out,'krw',c.bot_cost_krw)
  ) INTO r FROM desk.conversations c WHERE c.id = p_conversation_id;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.desk_messages_since(
  p_conversation_id UUID, p_since_seq INT DEFAULT 0, p_include_private BOOLEAN DEFAULT FALSE)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'seq',m.seq,'sender',m.sender_type,'agent_id',m.sender_agent_id,
    'agent_name',(SELECT name FROM desk.agents WHERE id=m.sender_agent_id),
    'body',m.body,'rich',m.rich,'sources',m.bot_sources,'private',m.is_private,'at',m.created_at)
    ORDER BY m.seq),'[]'::jsonb)
  FROM desk.messages m
 WHERE m.conversation_id = p_conversation_id AND m.seq > p_since_seq
   AND (p_include_private OR NOT m.is_private); $$;

COMMIT;
