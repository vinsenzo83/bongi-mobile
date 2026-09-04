-- ============================================================
-- 봉이 상담 데스크 — 독립 스키마 (003 개인정보 보호)
-- ============================================================
-- ★ 단독 전환의 법적 귀결:
--   지금까지 개인정보는 CRM DB 안에 있어 그쪽 책임 경계였다.
--   단독이 되면 **우리가 개인정보 처리 주체**가 된다. 아래는 그에 따른 기술적 조치다.
--   (구체적 보유기간·동의문구·위탁계약은 법률 검토가 필요하다 — 코드로 대체할 수 없다)
--
-- 설계 원칙 4가지
--   1. 최소 수집   — 상담에 필요 없는 건 아예 안 받는다
--   2. 저장 차단   — 받으면 안 되는 건 DB 가 막는다 (애플리케이션 실수와 무관하게)
--   3. 접근 기록   — 누가 누구의 정보를 봤는지 남긴다
--   4. 자동 파기   — 보유기간이 지나면 사람 손 없이 익명화된다
-- ============================================================
BEGIN;

-- ── 1. 수집 동의 ────────────────────────────────────────────
ALTER TABLE desk.contacts
  ADD COLUMN IF NOT EXISTS consent_at       TIMESTAMPTZ,   -- 수집·이용 동의 시각
  ADD COLUMN IF NOT EXISTS consent_source   TEXT,          -- 어디서 받은 동의인지(퍼널·앱·구두)
  ADD COLUMN IF NOT EXISTS marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS dnt              BOOLEAN NOT NULL DEFAULT FALSE, -- 연락 거부
  ADD COLUMN IF NOT EXISTS retention_until  DATE,          -- 보유기간 만료일
  ADD COLUMN IF NOT EXISTS anonymized_at    TIMESTAMPTZ;   -- 파기(익명화) 완료 시각

-- ── 2. 개인정보 열람 기록 ───────────────────────────────────
--   개인정보 안전성 확보조치 기준상 접속기록 보관 의무가 있다.
--   "누가 · 언제 · 누구의 정보를 · 왜" 를 남긴다. 마스킹 해제는 특히 중요하다.
CREATE TABLE desk.access_log (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  agent_id     UUID REFERENCES desk.agents(id) ON DELETE SET NULL,
  agent_name   TEXT,                                  -- 계정이 지워져도 기록은 남아야 한다
  action       TEXT NOT NULL,                         -- view_conversation | reveal_phone | export | search
  conversation_id UUID,
  contact_id   UUID,
  target_ref   TEXT,                                  -- 마스킹된 식별자
  reason       TEXT,
  ip           INET,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_access_agent   ON desk.access_log (agent_id, created_at DESC);
CREATE INDEX ix_access_contact ON desk.access_log (contact_id, created_at DESC);
CREATE INDEX ix_access_time    ON desk.access_log (created_at DESC);

CREATE OR REPLACE FUNCTION desk.log_access(
  p_agent_id UUID, p_action TEXT, p_conversation_id UUID DEFAULT NULL,
  p_contact_id UUID DEFAULT NULL, p_reason TEXT DEFAULT NULL,
  p_ip TEXT DEFAULT NULL, p_ua TEXT DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO desk.access_log (agent_id, agent_name, action, conversation_id, contact_id, reason, ip, user_agent)
  VALUES (p_agent_id, (SELECT name FROM desk.agents WHERE id = p_agent_id),
          p_action, p_conversation_id, p_contact_id, p_reason,
          CASE WHEN p_ip IS NULL THEN NULL ELSE p_ip::inet END, p_ua);
END $$;

-- ── 3. 저장 차단 (DB 가 막는다) ─────────────────────────────
--   주민등록번호는 법령 근거 없이 처리할 수 없다. 상담 채팅에는 그 근거가 없다.
--   ⚠ 한계: 계좌번호는 오탐 위험이 커서 여기서 막지 않는다 → 애플리케이션 + 상담사 교육
CREATE OR REPLACE FUNCTION desk.scrub_pii() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_orig TEXT := NEW.body; v_hits TEXT[] := '{}';
BEGIN
  IF NEW.body IS NULL THEN RETURN NEW; END IF;
  IF NEW.body ~ '\d{6}[-\s]?[1-4]\d{6}' THEN v_hits := v_hits || 'rrn'; END IF;
  IF NEW.body ~ '\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}' THEN v_hits := v_hits || 'card'; END IF;
  NEW.body := regexp_replace(NEW.body, '\d{6}[-\s]?[1-4]\d{6}', '[주민번호 차단]', 'g');
  NEW.body := regexp_replace(NEW.body, '\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}', '[카드번호 차단]', 'g');
  IF NEW.body IS DISTINCT FROM v_orig THEN
    NEW.rich := coalesce(NEW.rich,'{}'::jsonb)
                || jsonb_build_object('pii_blocked', true, 'pii_kinds', to_jsonb(v_hits));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_msg_pii ON desk.messages;
CREATE TRIGGER tg_msg_pii BEFORE INSERT OR UPDATE OF body ON desk.messages
  FOR EACH ROW EXECUTE FUNCTION desk.scrub_pii();

-- ── 4. 마스킹 ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION desk.mask_phone(p_phone TEXT, p_unmask BOOLEAN)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_phone IS NULL OR p_phone = '' THEN NULL
    WHEN p_unmask THEN p_phone
    ELSE (SELECT CASE WHEN length(d) >= 9 THEN left(d,3)||'-****-'||right(d,4) ELSE '****' END
            FROM (SELECT regexp_replace(p_phone,'[^0-9]','','g') d) x)
  END;
$$;

-- ── 5. 보유기간 · 자동 파기 ─────────────────────────────────
--   목적 달성 후 지체 없이 파기해야 한다. 사람이 기억하게 두면 안 된다.
CREATE TABLE desk.retention_policy (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  scope         TEXT UNIQUE NOT NULL,     -- conversation | contact | access_log
  keep_days     INTEGER NOT NULL,
  note          TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO desk.retention_policy (scope, keep_days, note) VALUES
  ('conversation', 730, '상담 이력 2년 후 익명화 — 실제 기간은 법률 검토 후 확정'),
  ('contact',      730, '연락처 2년'),
  ('access_log',   365, '접속기록 최소 1년 — 규모에 따라 2년 요구될 수 있음')
ON CONFLICT (scope) DO NOTHING;

-- 파기 = 삭제가 아니라 익명화. 통계는 남기고 신원만 지운다.
CREATE OR REPLACE FUNCTION desk.anonymize_expired(p_dry_run BOOLEAN DEFAULT TRUE)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_days INT; v_conv INT := 0; v_contact INT := 0; v_log INT := 0;
BEGIN
  SELECT keep_days INTO v_days FROM desk.retention_policy WHERE scope='conversation';
  IF p_dry_run THEN
    SELECT count(*) INTO v_conv FROM desk.conversations
     WHERE closed_at < now() - make_interval(days => v_days) AND phone IS NOT NULL;
  ELSE
    WITH x AS (
      UPDATE desk.conversations
         SET phone=NULL, customer_name='(파기됨)', social_handle=NULL, social_user_id=NULL,
             visitor_key='anon', entry_context='{}'::jsonb, bot_collected='{}'::jsonb
       WHERE closed_at < now() - make_interval(days => v_days) AND phone IS NOT NULL
       RETURNING 1)
    SELECT count(*) INTO v_conv FROM x;
    -- 메시지 본문도 지운다. seq·시각·발신자는 남겨 통계·감사 추적은 유지.
    UPDATE desk.messages m SET body='(파기됨)', rich=NULL, attachments='[]'::jsonb
      FROM desk.conversations c
     WHERE m.conversation_id=c.id AND c.customer_name='(파기됨)' AND m.body <> '(파기됨)';
  END IF;

  SELECT keep_days INTO v_days FROM desk.retention_policy WHERE scope='contact';
  IF p_dry_run THEN
    SELECT count(*) INTO v_contact FROM desk.contacts
     WHERE anonymized_at IS NULL AND updated_at < now() - make_interval(days => v_days);
  ELSE
    WITH x AS (
      UPDATE desk.contacts
         SET phone_norm=NULL, name='(파기됨)', social='{}'::jsonb, crm_ref=NULL,
             auth_user_ref=NULL, anonymized_at=now()
       WHERE anonymized_at IS NULL AND updated_at < now() - make_interval(days => v_days)
       RETURNING 1)
    SELECT count(*) INTO v_contact FROM x;
  END IF;

  SELECT keep_days INTO v_days FROM desk.retention_policy WHERE scope='access_log';
  IF p_dry_run THEN
    SELECT count(*) INTO v_log FROM desk.access_log WHERE created_at < now() - make_interval(days => v_days);
  ELSE
    WITH x AS (DELETE FROM desk.access_log WHERE created_at < now() - make_interval(days => v_days) RETURNING 1)
    SELECT count(*) INTO v_log FROM x;
  END IF;

  RETURN jsonb_build_object('dry_run', p_dry_run,
    'conversations', v_conv, 'contacts', v_contact, 'access_log', v_log);
END $$;

-- ── 6. 정보주체 권리 (열람·삭제 요구) ───────────────────────
--   개인정보보호법상 정보주체는 열람·정정·삭제·처리정지를 요구할 수 있다.
--   요구가 오면 사람이 DB 를 뒤지는 게 아니라 이 함수를 쓴다.
CREATE OR REPLACE FUNCTION desk.subject_export(p_phone TEXT)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  WITH n AS (SELECT regexp_replace(coalesce(p_phone,''),'[^0-9]','','g') d)
  SELECT jsonb_build_object(
    'contact', (SELECT to_jsonb(c) FROM desk.contacts c, n WHERE c.phone_norm = n.d),
    'conversations', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id',v.id,'started',v.created_at,'closed',v.closed_at,'topic',v.topic_slug,
        'outcome',v.outcome,'summary',v.summary,
        'messages',(SELECT jsonb_agg(jsonb_build_object('at',m.created_at,'sender',m.sender_type,'body',m.body) ORDER BY m.seq)
                      FROM desk.messages m WHERE m.conversation_id=v.id AND NOT m.is_private)))
      FROM desk.conversations v, n WHERE regexp_replace(coalesce(v.phone,''),'[^0-9]','','g') = n.d), '[]'::jsonb));
$$;

CREATE OR REPLACE FUNCTION desk.subject_erase(p_phone TEXT, p_reason TEXT DEFAULT '정보주체 삭제 요구')
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_n INT := 0; v_c INT := 0; v_d TEXT;
BEGIN
  v_d := regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
  IF length(v_d) < 9 THEN RETURN jsonb_build_object('ok',false,'reason','전화번호 형식이 올바르지 않습니다'); END IF;
  WITH x AS (
    UPDATE desk.conversations
       SET phone=NULL, customer_name='(삭제요구)', social_handle=NULL, social_user_id=NULL,
           visitor_key='erased', entry_context='{}'::jsonb, bot_collected='{}'::jsonb, summary=NULL
     WHERE regexp_replace(coalesce(phone,''),'[^0-9]','','g') = v_d RETURNING id)
  SELECT count(*) INTO v_n FROM x;
  UPDATE desk.messages m SET body='(삭제요구)', rich=NULL, attachments='[]'::jsonb
    FROM desk.conversations c WHERE m.conversation_id=c.id AND c.customer_name='(삭제요구)';
  WITH y AS (
    UPDATE desk.contacts SET phone_norm=NULL, name='(삭제요구)', social='{}'::jsonb,
           crm_ref=NULL, auth_user_ref=NULL, anonymized_at=now()
     WHERE phone_norm = v_d RETURNING 1)
  SELECT count(*) INTO v_c FROM y;
  INSERT INTO desk.access_log (action, target_ref, reason)
  VALUES ('subject_erase', left(v_d,3)||'****', p_reason);
  RETURN jsonb_build_object('ok',true,'conversations',v_n,'contacts',v_c);
END $$;

COMMIT;
