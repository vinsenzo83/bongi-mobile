-- ============================================================
-- 봉이 상담 데스크 — 독립 스키마 (004 RPC 게이트웨이)
-- ============================================================
-- 왜 필요한가:
--   `desk` 스키마는 PostgREST 노출 목록에 넣지 않는다(1차 방어선).
--   별도 프로젝트가 되어도 anon key 는 여전히 공개값이므로 원칙은 그대로다.
--   따라서 supabase-js 는 `desk.*` 를 직접 못 부른다 → public 래퍼로만 접근한다.
--
-- ⚠ 이 파일에 래퍼가 없는 desk 함수는 서버에서 호출할 수 없다.
--    큐 함수 3개와 log_access 가 정확히 그 상태였다(desk-api 발견).
-- ============================================================
BEGIN;

-- ── 아웃바운드 워커 ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.desk_outbound_claim(
  p_worker TEXT, p_kinds TEXT[] DEFAULT NULL, p_limit INT DEFAULT 20)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
  SELECT desk.outbound_claim(p_worker, p_kinds, p_limit);
$$;

CREATE OR REPLACE FUNCTION public.desk_outbound_mark(
  p_id BIGINT, p_ok BOOLEAN, p_provider_ref TEXT DEFAULT NULL, p_error TEXT DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
  SELECT desk.outbound_mark(p_id, p_ok, p_provider_ref, p_error);
$$;

CREATE OR REPLACE FUNCTION public.desk_outbound_reap(p_stale_min INT DEFAULT 10)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
  SELECT desk.outbound_reap(p_stale_min);
$$;

-- 큐 상태 조회 (운영 모니터링 — 쌓이고 있는지, 죽고 있는지)
CREATE OR REPLACE FUNCTION public.desk_outbound_stats()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
  SELECT coalesce(jsonb_object_agg(kind, s), '{}'::jsonb) FROM (
    SELECT kind, jsonb_build_object(
      'pending', count(*) FILTER (WHERE status='pending'),
      'sending', count(*) FILTER (WHERE status='sending'),
      'sent',    count(*) FILTER (WHERE status='sent'),
      'failed',  count(*) FILTER (WHERE status='failed'),
      'expired', count(*) FILTER (WHERE status='expired'),
      'oldest_pending', min(created_at) FILTER (WHERE status='pending')) s
    FROM desk.outbound_queue GROUP BY kind) t;
$$;

-- ── 개인정보 접근 기록 ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.desk_log_access(
  p_agent_id UUID, p_action TEXT, p_conversation_id UUID DEFAULT NULL,
  p_contact_id UUID DEFAULT NULL, p_reason TEXT DEFAULT NULL,
  p_ip TEXT DEFAULT NULL, p_ua TEXT DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
BEGIN
  PERFORM desk.log_access(p_agent_id, p_action, p_conversation_id, p_contact_id, p_reason, p_ip, p_ua);
  RETURN jsonb_build_object('ok', true);
END $$;

-- ── 개인정보 파기 · 정보주체 권리 ───────────────────────────
CREATE OR REPLACE FUNCTION public.desk_anonymize_expired(p_dry_run BOOLEAN DEFAULT TRUE)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
  SELECT desk.anonymize_expired(p_dry_run);
$$;

CREATE OR REPLACE FUNCTION public.desk_subject_export(p_phone TEXT)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
  SELECT desk.subject_export(p_phone);
$$;

CREATE OR REPLACE FUNCTION public.desk_subject_erase(p_phone TEXT, p_reason TEXT DEFAULT '정보주체 삭제 요구')
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public','desk','pg_temp' AS $$
  SELECT desk.subject_erase(p_phone, p_reason);
$$;

-- ── 권한 회수: service_role 만 호출한다 ─────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid=p.pronamespace
            WHERE n.nspname='public' AND p.proname LIKE 'desk\_%'
  LOOP EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig); END LOOP;
END $$;

COMMIT;
