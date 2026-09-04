-- ============================================================
-- 봉이 상담 데스크 — 독립 스키마 (007 상담사 액션 · CRM 통지)
-- ============================================================
-- ★ 이 파일의 핵심 변화: CRM 에 직접 INSERT 하지 않는다.
--   desk_close 가 상담이력·콜예약을 desk.outbound_queue 에 적재하고,
--   워커가 CRM API 로 보낸다. 저쪽이 죽어도 우리 상담은 계속된다.
-- ============================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.desk_claim(
  p_conversation_id UUID, p_agent_id UUID, p_barge_in BOOLEAN DEFAULT FALSE)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
DECLARE v_n INT; v_name TEXT;
BEGIN
  IF NOT desk.can_access(p_agent_id, p_conversation_id) THEN
    RETURN jsonb_build_object('ok',false,'reason','담당 범위가 아닌 대화입니다');
  END IF;
  SELECT count(*) INTO v_n FROM desk.claim(p_conversation_id, p_agent_id, p_barge_in);
  IF v_n = 0 THEN RETURN jsonb_build_object('ok',false,'reason','이미 다른 상담사가 받았습니다'); END IF;
  SELECT name INTO v_name FROM desk.agents WHERE id=p_agent_id;
  INSERT INTO desk.events (conversation_id,type,actor_type,actor_id,to_value,reason)
  VALUES (p_conversation_id, CASE WHEN p_barge_in THEN 'barge_in' ELSE 'assigned' END,'agent',p_agent_id,'assigned',v_name);
  INSERT INTO desk.messages (conversation_id, sender_type, body)
  VALUES (p_conversation_id,'system','상담사 '||coalesce(v_name,'')||' 님이 참여했습니다');
  RETURN jsonb_build_object('ok',true,'barge_in',p_barge_in);
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

CREATE OR REPLACE FUNCTION public.desk_reply(
  p_conversation_id UUID, p_agent_id UUID, p_body TEXT,
  p_private BOOLEAN DEFAULT FALSE, p_rich JSONB DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
DECLARE v_seq INT; g jsonb;
BEGIN
  -- 내부 메모는 남의 대화에도 허용(감독·인수인계). 고객에게 나가는 답변만 소유권 검사.
  IF p_private THEN
    IF NOT desk.can_access(p_agent_id, p_conversation_id) THEN
      RETURN jsonb_build_object('ok',false,'reason','담당 범위가 아닌 대화입니다');
    END IF;
  ELSE
    g := desk.can_act(p_agent_id, p_conversation_id);
    IF NOT (g->>'ok')::boolean THEN RETURN g; END IF;
  END IF;
  INSERT INTO desk.messages (conversation_id, sender_type, sender_agent_id, body, is_private, rich)
  VALUES (p_conversation_id,'agent',p_agent_id,p_body,p_private,p_rich) RETURNING seq INTO v_seq;
  IF NOT p_private THEN UPDATE desk.conversations SET unread_for_agent=0 WHERE id=p_conversation_id; END IF;
  RETURN jsonb_build_object('ok',true,'seq',v_seq);
END $$;

CREATE OR REPLACE FUNCTION public.desk_transfer(
  p_conversation_id UUID, p_agent_id UUID, p_reason TEXT,
  p_to_department BIGINT DEFAULT NULL, p_to_agent UUID DEFAULT NULL, p_to_topic TEXT DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
DECLARE c desk.conversations; v_from TEXT; g jsonb;
BEGIN
  g := desk.can_act(p_agent_id, p_conversation_id);
  IF NOT (g->>'ok')::boolean THEN RETURN g; END IF;
  IF coalesce(btrim(p_reason),'') = '' THEN
    RETURN jsonb_build_object('ok',false,'reason','이관 사유는 필수입니다');
  END IF;
  -- ★ 트리거가 RAISE EXCEPTION 으로 터지기 전에 계약대로 거부한다.
  --   (정상적인 사용자 실수가 5xx 로 나가 Sentry 경보를 울리던 문제)
  IF p_to_topic IS NOT NULL AND NOT EXISTS (SELECT 1 FROM desk.topics WHERE slug = p_to_topic) THEN
    RETURN jsonb_build_object('ok',false,'reason','존재하지 않는 topic: '||p_to_topic);
  END IF;
  IF p_to_department IS NOT NULL AND NOT EXISTS (SELECT 1 FROM desk.departments WHERE id = p_to_department AND enabled) THEN
    RETURN jsonb_build_object('ok',false,'reason','존재하지 않거나 비활성 부서입니다');
  END IF;
  IF p_to_agent IS NOT NULL AND NOT EXISTS (SELECT 1 FROM desk.agents WHERE id = p_to_agent AND active) THEN
    RETURN jsonb_build_object('ok',false,'reason','존재하지 않거나 비활성 상담사입니다');
  END IF;

  SELECT * INTO c FROM desk.conversations WHERE id=p_conversation_id;
  v_from := coalesce((SELECT name FROM desk.departments WHERE id=c.department_id),'-');
  UPDATE desk.conversations SET
    topic_slug        = coalesce(p_to_topic, topic_slug),
    department_id     = coalesce(p_to_department,
                          CASE WHEN p_to_topic IS NOT NULL THEN desk.route(intent, p_to_topic) ELSE department_id END),
    assigned_agent_id = p_to_agent,
    assigned_at       = CASE WHEN p_to_agent IS NULL THEN NULL ELSE now() END,
    status            = CASE WHEN p_to_agent IS NULL THEN 'waiting' ELSE 'assigned' END
   WHERE id=p_conversation_id;
  INSERT INTO desk.events (conversation_id,type,actor_type,actor_id,from_value,to_value,reason)
  VALUES (p_conversation_id,'transferred','agent',p_agent_id,v_from,
    coalesce((SELECT name FROM desk.departments WHERE id=(SELECT department_id FROM desk.conversations WHERE id=p_conversation_id)),'-'),
    p_reason);
  INSERT INTO desk.messages (conversation_id,sender_type,body,is_private)
  VALUES (p_conversation_id,'agent','[이관] '||v_from||' → '||
    coalesce((SELECT name FROM desk.departments WHERE id=(SELECT department_id FROM desk.conversations WHERE id=p_conversation_id)),'-')
    ||' · 사유: '||p_reason, true);
  RETURN jsonb_build_object('ok',true,
    'department',(SELECT name FROM desk.departments WHERE id=(SELECT department_id FROM desk.conversations WHERE id=p_conversation_id)),
    'status',(SELECT status FROM desk.conversations WHERE id=p_conversation_id));
END $$;

CREATE OR REPLACE FUNCTION public.desk_snooze(
  p_conversation_id UUID, p_agent_id UUID, p_until TIMESTAMPTZ, p_reason TEXT DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
DECLARE g jsonb;
BEGIN
  g := desk.can_act(p_agent_id, p_conversation_id);
  IF NOT (g->>'ok')::boolean THEN RETURN g; END IF;
  IF p_until IS NULL OR p_until <= now() THEN
    RETURN jsonb_build_object('ok',false,'reason','보류 해제 시각은 현재보다 이후여야 합니다');
  END IF;
  UPDATE desk.conversations SET status='snoozed' WHERE id=p_conversation_id;
  INSERT INTO desk.events (conversation_id,type,actor_type,actor_id,to_value,reason)
  VALUES (p_conversation_id,'snoozed','agent',p_agent_id,p_until::text,p_reason);
  RETURN jsonb_build_object('ok',true,'until',p_until);
END $$;

-- ★★ 종결 — CRM 직접 INSERT 를 큐 적재로 바꾼 자리 ★★
CREATE OR REPLACE FUNCTION public.desk_close(
  p_conversation_id UUID, p_agent_id UUID, p_outcome TEXT,
  p_callback_at TIMESTAMPTZ DEFAULT NULL, p_summary TEXT DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
DECLARE c desk.conversations; v_name TEXT; ct desk.contacts; g jsonb; v_queued INT := 0;
BEGIN
  g := desk.can_act(p_agent_id, p_conversation_id);
  IF NOT (g->>'ok')::boolean THEN RETURN g; END IF;
  IF p_outcome = 'booked_call' AND p_callback_at IS NULL THEN
    RETURN jsonb_build_object('ok',false,'reason','콜 예약은 고객이 고른 시각이 필요합니다 (무단 발신 금지)');
  END IF;
  UPDATE desk.conversations SET status='closed', outcome=p_outcome, callback_at=p_callback_at,
         summary=coalesce(p_summary,bot_summary), closed_at=now(), closed_by=p_agent_id
   WHERE id=p_conversation_id RETURNING * INTO c;
  IF c.id IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','대화를 찾을 수 없습니다'); END IF;
  SELECT name INTO v_name FROM desk.agents WHERE id=p_agent_id;
  SELECT * INTO ct FROM desk.contacts WHERE id = c.contact_id;

  -- 상담이력 통지 (전 종결에 공통). dedupe_key 로 재시도 시 중복을 막는다.
  INSERT INTO desk.outbound_queue (kind, conversation_id, target, recipient_id, dedupe_key, payload)
  VALUES ('crm_note', c.id, 'crm', ct.crm_ref, 'note:'||c.id::text,
    jsonb_build_object('phone',ct.phone_norm,'crm_ref',ct.crm_ref,
      'agent',coalesce(v_name,'상담데스크'),'category','채팅',
      'content','[채팅/'||c.intent||'/'||c.topic_slug||'] '||coalesce(c.summary,c.bot_summary,'상담 완료'),
      'outcome',p_outcome,'closed_at',c.closed_at))
  ON CONFLICT DO NOTHING;
  v_queued := v_queued + 1;

  -- 콜 예약만 콜 통지를 만든다. resolved_chat 은 콜을 배정하지 않는다.
  IF p_outcome = 'booked_call' THEN
    INSERT INTO desk.outbound_queue (kind, conversation_id, target, recipient_id, dedupe_key, payload)
    VALUES ('crm_callback', c.id, 'crm', ct.crm_ref, 'callback:'||c.id::text,
      jsonb_build_object('phone',ct.phone_norm,'crm_ref',ct.crm_ref,
        'agent_ref',(SELECT external_ref FROM desk.agents WHERE id=p_agent_id),
        'callback_at',p_callback_at,'result','채팅→콜예약',
        'notes',coalesce(c.bot_summary,'')))
    ON CONFLICT DO NOTHING;
    v_queued := v_queued + 1;
  END IF;

  INSERT INTO desk.events (conversation_id,type,actor_type,actor_id,to_value)
  VALUES (p_conversation_id,'closed','agent',p_agent_id,p_outcome);
  -- ⚠ crm_noted(직접 기록 완료) 가 아니라 crm_queued(전송 예약) 다. 의미가 다르다.
  RETURN jsonb_build_object('ok',true,'outcome',p_outcome,
    'crm_queued', v_queued, 'crm_ref', ct.crm_ref);
END $$;

-- 권한 회수
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
            WHERE n.nspname='public' AND p.proname LIKE 'desk\_%'
  LOOP EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig); END LOOP;
END $$;

COMMIT;
