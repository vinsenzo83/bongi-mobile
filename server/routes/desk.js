// 봉이 상담 데스크 (CS Chat Desk) — 서버 API
// 설계서   : docs/specs/cs-chat-desk-2026-09-03.md
// 연동규격 : docs/specs/desk-app-integration-2026-09-04.md  ← 앱팀 계약서
// 마이그레이션: server/db/2026-09-03-desk-chat.sql
//
// ★ 범위 (2026-09-04 변경)
//   우리 제품은 "상담사가 쓰는 데스크" 다. 고객앱 화면과 AI 1차 응대는 앱팀이 만든다.
//   따라서 이 파일은 두 종류의 소비자만 상대한다.
//     ① 앱 서버 → 우리   : /api/desk/app/*  · /api/desk/topics   (x-desk-app-key)
//     ② 상담사 데스크    : 그 외 전부                            (JWT)
//   고객 위젯용 엔드포인트(desk_start·desk_customer_say·SSE)는 제거했다 — 아래 §미사용 참조.
//
// ★ desk 스키마는 PostgREST 노출 목록에 없다 (설계서 §4.1 1차 방어선).
//   supabase-js 의 .from() 으로 접근할 수 없고, public 스키마의 desk_* SECURITY DEFINER
//   래퍼 함수를 supabase.rpc() 로만 호출한다. 토픽·부서·라우팅·권한은 전부 RPC 결과를 쓴다.
import express from 'express';
import rateLimit from 'express-rate-limit';
import { createHash, timingSafeEqual } from 'crypto';
import { supabase } from '../db/supabase.js';
import { authenticateJWT } from '../middleware/auth.js';
import { requireMinRole } from '../middleware/rbac.js';

// ★ A. 운영에서 앱 연동 키가 없으면 /api/desk/app/* 만 닫는다 (fail-closed).
//   서버 전체를 죽이지 않는다 — 콜DB·계약처리·정산까지 같이 멈추는 손해가 더 크다.
//   상담사측 라우트는 JWT 인증이라 이 키와 무관하게 정상 동작한다.
const _appKeyMissingInProd = process.env.NODE_ENV === 'production' && !process.env.DESK_APP_KEY;
if (_appKeyMissingInProd) {
  console.error(
    '🚨 [desk] DESK_APP_KEY 미설정 — 앱 연동 API(/api/desk/app/*)를 503 으로 차단합니다. ' +
    '앱팀 연동이 필요하면 환경변수에 키를 설정하고 재배포하세요. (상담사 데스크는 정상 동작)'
  );
}

const router = express.Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY_LEN = 4000;      // 메시지 1건 최대 길이 (DoS·DB 부하 방지)
const MAX_IMPORT_MESSAGES = 500; // 1회 이관 최대 메시지 수

// ─── RPC 호출 공통 ───────────────────────────────────────────────
function rpcError(name, error) {
  const e = new Error(`[desk_${name}] ${error.message || 'RPC 실패'}`);
  switch (error.code) {
    case '22P02': e.status = 400; e.message = '요청 값의 형식이 올바르지 않습니다'; break;
    case '23514': e.status = 400; e.message = '허용되지 않은 값입니다'; break;
    case '23503': e.status = 400; e.message = '참조 대상을 찾을 수 없습니다'; break;
    case '23505': e.status = 409; e.message = '이미 존재하는 값입니다'; break;
    // 우리 함수·트리거가 의도적으로 올린 업무 규칙 위반 (RAISE EXCEPTION).
    // 예: desk.check_topic 의 '존재하지 않는 토픽: xxx' — 이관/발행으로 낡은 slug 가 들어올 때.
    // 서버 장애가 아니므로 500 이 아니라 400 으로 내리고, 원문 한국어 메시지를 그대로 전달한다.
    // (500 으로 두면 운영에서 메시지가 가려지고 Sentry 5xx 경보까지 울린다)
    case 'P0001': e.status = 400; e.message = error.message || '요청을 처리할 수 없습니다'; break;
    default: break;
  }
  return e;
}

async function rpc(name, params) {
  if (!supabase) {
    const e = new Error('Supabase 미연결 — 상담 데스크를 사용할 수 없습니다');
    e.status = 503;
    throw e;
  }
  const { data, error } = await supabase.rpc(`desk_${name}`, params);
  if (error) throw rpcError(name, error);
  return data;
}

// 상담사측 거절 — 응답 형태 {error}
function rejected(res, data) {
  if (data && typeof data === 'object' && data.ok === false) {
    res.status(400).json({ error: data.reason || '요청을 처리할 수 없습니다' });
    return true;
  }
  return false;
}

// 앱측 거절 — 응답 형태 {ok:false, reason} (연동규격 §3.1 계약)
function appRejected(res, data) {
  if (data && typeof data === 'object' && data.ok === false) {
    res.status(400).json({ ok: false, reason: data.reason || '요청을 처리할 수 없습니다' });
    return true;
  }
  return false;
}

function conversationId(req) {
  const id = req.params.id || req.query.conversation_id;
  return UUID_RE.test(id || '') ? id : null;
}

function badId(res) {
  return res.status(400).json({ error: 'conversation_id 형식이 올바르지 않습니다' });
}

// ═══════════════════════════════════════════════════════════════
// 앱 서버 연동 (연동규격 §3) — 고객 단말이 아니라 앱 "서버" 가 중계한다
// ═══════════════════════════════════════════════════════════════

// 상수시간 비교. 길이 차이로 정보가 새지 않도록 양쪽을 해시한 뒤 비교한다.
function safeKeyEqual(a, b) {
  const ha = createHash('sha256').update(String(a)).digest();
  const hb = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(ha, hb);
}

let _appKeyWarned = false;
function requireAppKey(req, res, next) {
  const expected = process.env.DESK_APP_KEY;
  const provided = req.get('x-desk-app-key');

  // 키 미발급 상태
  //  · 운영          → 503 으로 닫는다 (무인증 개방 금지)
  //  · 개발·스테이징 → 통과시키되 반드시 흔적을 남긴다
  if (!expected) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(503).json({ ok: false, reason: '앱 연동 키가 설정되지 않았습니다' });
    }
    if (!_appKeyWarned) {
      console.warn('⚠ [desk/app] DESK_APP_KEY 미설정 — 앱 연동 API 가 무인증으로 열려 있습니다. 키 발급 후 반드시 설정하세요.');
      _appKeyWarned = true;
    }
    return next();
  }
  if (!provided || !safeKeyEqual(provided, expected)) {
    return res.status(401).json({ ok: false, reason: '앱 연동 키가 올바르지 않습니다' });
  }
  next();
}

// rate limit 은 IP 가 아니라 "키" 기준 (앱 서버 1대가 전 고객을 중계하므로 IP 는 항상 같다)
const appLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number.parseInt(process.env.DESK_APP_RATE_PER_MIN, 10) || 3000,
  // 앱키가 있으면 키 기준, 없으면(=상담사 JWT 경로) 토큰 기준으로 버킷을 나눈다.
  // req.ip 를 쓰지 않으므로 IPv6 서브넷 처리도 필요 없다.
  keyGenerator: (req) => {
    const appKey = req.get('x-desk-app-key');
    if (appKey) return `desk-app:${appKey.slice(0, 128)}`;
    const auth = req.get('authorization');
    if (auth) return `desk-jwt:${createHash('sha256').update(auth).digest('hex').slice(0, 32)}`;
    return 'desk-anon';
  },
  message: { ok: false, reason: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
});

const appGuard = [appLimiter, requireAppKey];

// ★ B. 토픽 목록은 앱 서버(앱키)와 상담사 데스크(JWT) 둘 다 쓴다.
//   앱키가 유효하거나 JWT 가 통과하면 허용, 둘 다 없으면 401.
function appKeyOrJWT(req, res, next) {
  const expected = process.env.DESK_APP_KEY;
  const provided = req.get('x-desk-app-key');
  if (expected && provided && safeKeyEqual(provided, expected)) return next();

  // 앱키가 없거나 틀렸으면 로그인 사용자로 취급해 본다
  const auth = req.get('authorization');
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return authenticateJWT(req, res, next);
  }
  // 키 미발급 + 로그인도 아님. 운영에서는 익명 통과를 허용하지 않는다
  //  (JWT 경로는 위에서 이미 처리되므로 데스크 UI 는 키 없이도 계속 쓸 수 있다)
  if (!expected && process.env.NODE_ENV !== 'production') {
    if (!_appKeyWarned) {
      console.warn('⚠ [desk/app] DESK_APP_KEY 미설정 — 앱 연동 API 가 무인증으로 열려 있습니다. 키 발급 후 반드시 설정하세요.');
      _appKeyWarned = true;
    }
    return next();
  }
  return res.status(401).json({ ok: false, reason: '인증이 필요합니다 (x-desk-app-key 또는 로그인)' });
}

// GET /api/desk/topics?entry=<slug> — 문의유형 선택 화면용. 카테고리는 DB 에서 늘어난다
router.get('/topics', appLimiter, appKeyOrJWT, async (req, res, next) => {
  try {
    const data = await rpc('topics', { p_entry_slug: req.query.entry || null });
    res.json(data || { entry: null, topics: [] });
  } catch (e) { next(e); }
});

// POST /api/desk/app/import — 앱 AI 1차 상담 이력 이관 (external_id 멱등)
// handoff 가 있으면 대기열에 올라가고, 없으면 이력만 쌓인다 (규격 §3.1 규칙 6)
router.post('/app/import', appGuard, async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.external_id || !String(b.external_id).trim()) {
      return res.status(400).json({ ok: false, reason: 'external_id 는 필수입니다 (멱등키)' });
    }
    const messages = b.messages ?? [];
    if (!Array.isArray(messages)) {
      return res.status(400).json({ ok: false, reason: 'messages 는 배열이어야 합니다' });
    }
    if (messages.length > MAX_IMPORT_MESSAGES) {
      return res.status(400).json({
        ok: false, reason: `messages 는 1회 ${MAX_IMPORT_MESSAGES}건을 넘을 수 없습니다`,
      });
    }
    if (b.handoff != null && (typeof b.handoff !== 'object' || Array.isArray(b.handoff))) {
      return res.status(400).json({ ok: false, reason: 'handoff 는 객체여야 합니다' });
    }

    const data = await rpc('import', {
      p_external_id: String(b.external_id).trim(),
      p_messages: messages,
      p_entry_slug: b.entry_slug || 'app-home',
      p_intent: b.intent || null,
      p_topic: b.topic || null,
      p_phone: b.phone || null,
      p_name: b.name || null,
      p_auth_user_id: b.auth_user_id || null,
      p_handoff: b.handoff || {},
      p_context: b.context || {},
      p_visitor_key: b.visitor_key || null,
    });
    if (appRejected(res, data)) return;   // 토픽 미정·미존재 등 RPC 사유 그대로
    res.json(data);
  } catch (e) { next(e); }
});

// GET /api/desk/app/sync?external_id=&since_seq= — mode + 상담사 답변 증분
// 내부메모·봇 메시지는 RPC 가 걸러서 내려주지 않는다 (규격 §3.2)
router.get('/app/sync', appGuard, async (req, res, next) => {
  try {
    const externalId = req.query.external_id;
    if (!externalId || !String(externalId).trim()) {
      return res.status(400).json({ ok: false, reason: 'external_id 는 필수입니다' });
    }
    let since = Number.parseInt(req.query.since_seq, 10);
    if (!Number.isFinite(since) || since < 0) since = 0;

    const data = await rpc('app_sync', {
      p_external_id: String(externalId).trim(),
      p_since_seq: since,
    });

    // ⚠ desk_app_sync 는 순수 SELECT 라 대화가 없으면 행이 0개 = null 을 준다
    //   ({ok:false} 가 아니다). 여기서 404 로 옮긴다.
    if (!data) {
      return res.status(404).json({ ok: false, reason: '이관되지 않은 대화입니다' });
    }
    if (appRejected(res, data)) return;
    res.json(data);
  } catch (e) { next(e); }
});

// POST /api/desk/app/say — 사람 응대 중 고객이 앱에서 말한 것을 데스크로 전달
// 종결된 대화면 자동 재개된다 (규격 §3.3)
router.post('/app/say', appGuard, async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.external_id || !String(b.external_id).trim()) {
      return res.status(400).json({ ok: false, reason: 'external_id 는 필수입니다' });
    }
    const body = typeof b.body === 'string' ? b.body.trim() : '';
    if (!body) return res.status(400).json({ ok: false, reason: 'body 는 필수입니다' });
    if (body.length > MAX_BODY_LEN) {
      return res.status(400).json({ ok: false, reason: `body 는 ${MAX_BODY_LEN}자를 넘을 수 없습니다` });
    }

    let at = null;
    if (b.at) {
      const d = new Date(b.at);
      if (Number.isNaN(d.getTime())) {
        return res.status(400).json({ ok: false, reason: 'at 형식이 올바르지 않습니다 (ISO8601)' });
      }
      at = d.toISOString();
    }

    const data = await rpc('app_customer_say', {
      p_external_id: String(b.external_id).trim(),
      p_body: body,
      p_at: at,
    });
    if (appRejected(res, data)) return;   // '이관되지 않은 대화입니다'
    res.json(data);
  } catch (e) { next(e); }
});

// 앱 연동 구간 전용 에러 응답 — 앱팀 계약이 {ok:false,reason} 이라 4xx 는 형태를 맞춘다.
// 5xx 는 전역 errorHandler 로 넘긴다 (Sentry·webhook 경보를 잃지 않기 위해).
router.use(['/app', '/topics'], (err, req, res, next) => {
  if (res.headersSent || !err.status || err.status >= 500) return next(err);
  res.status(err.status).json({ ok: false, reason: err.message });
});

// ═══════════════════════════════════════════════════════════════
// 상담사측 (JWT + requireMinRole('contract') + agent_id 필수)
// ═══════════════════════════════════════════════════════════════
// 단독 전환: 어드민 계정 id(external_ref) → desk.agents.id 로 바꾼다.
//   인증은 어드민 프로젝트가, 상담사 신원은 desk 가 관리한다.
//   60초 캐시 — 데스크는 폴링하므로(대화 2.5초·인박스 8초) 캐시가 없으면
//   상담사 14명 기준 초당 10회의 조회가 매 요청마다 나간다.
const _deskAgentCache = new Map(); // external_ref -> { id, at }
const DESK_AGENT_TTL = 60_000;

async function requireAgentId(req, res, next) {
  // ★ 로그인 신원(auth user id)으로 우리 상담사를 찾는다.
  //   CRM 테이블(bongi_user_profiles)을 거치지 않는다 — 저쪽 스키마가 바뀌면
  //   프로필 조회가 실패하고 전원이 조용히 customer 로 강등되기 때문이다.
  const ref = req.user?.id ? String(req.user.id) : null;
  if (!ref) {
    return res.status(401).json({ error: '로그인이 필요합니다' });
  }
  const hit = _deskAgentCache.get(ref);
  if (hit && Date.now() - hit.at < DESK_AGENT_TTL) {
    req.deskAgentId = hit.id;
    return next();
  }
  try {
    const data = await rpc('agent_by_ref', { p_external_ref: ref });
    if (!data?.ok) {
      return res.status(403).json({ error: data?.reason || '상담 데스크에 등록되지 않은 계정입니다' });
    }
    _deskAgentCache.set(ref, { id: data.agent_id, at: Date.now() });
    req.deskAgentId = data.agent_id;
    next();
  } catch (err) {
    next(err);
  }
}

const agentGuard = [authenticateJWT, requireMinRole('contract'), requireAgentId];

// 담당 범위 판정 — 새 권한 로직을 만들지 않고 desk_agent_scope / desk_inbox 결과만 쓴다
// (설계서 §7: admin·manager = unrestricted · 그 외 = department.categories ∪ handle_categories)
async function loadInScopeConversation(agentId, id) {
  const conv = await rpc('conversation', { p_conversation_id: id, p_agent_id: agentId });

  // 없는 대화 = null. 담당 범위 밖 = {ok:false, reason} (RPC 안쪽 can_access 판정).
  // 이 둘을 구분하지 않으면 권한 거부가 404 로 나가 원인을 알 수 없게 된다.
  if (!conv) return { conv: null, allowed: false, denied: null };
  if (conv.ok === false) {
    return { conv: null, allowed: false, denied: conv.reason || '담당 범위가 아닌 대화입니다' };
  }
  if (!conv.id) return { conv: null, allowed: false, denied: null };

  const scope = await rpc('agent_scope', { p_agent_id: agentId });
  if (scope?.unrestricted) return { conv, allowed: true };

  const categories = Array.isArray(scope?.categories) ? scope.categories : [];
  if (categories.includes(conv.topic)) return { conv, allowed: true };
  if (conv.assigned_agent && scope?.name && conv.assigned_agent === scope.name) {
    return { conv, allowed: true };
  }

  // 부서 배정으로 보이는 건(desk_inbox 의 department_id 조건)까지 커버 — 판정은 DB 규칙 그대로
  const inbox = await rpc('inbox', {
    p_agent_id: agentId, p_intent: null, p_topic: null,
    p_status: null, p_mine: false, p_limit: 200,
  });
  const visible = Array.isArray(inbox) && inbox.some((c) => c.id === id);
  return { conv, allowed: visible };
}

function forbidden(res) {
  return res.status(403).json({ error: '담당 범위가 아닌 대화입니다' });
}

// GET /api/desk/agent/scope — 내 담당 부서·카테고리
router.get('/agent/scope', agentGuard, async (req, res, next) => {
  try {
    const data = await rpc('agent_scope', { p_agent_id: req.deskAgentId });
    if (!data) return res.status(404).json({ error: '상담사 정보를 찾을 수 없습니다' });
    res.json(data);
  } catch (e) { next(e); }
});

// GET /api/desk/departments — 큐(=부서) 목록. 온라인 인원·대기 건수 포함
router.get('/departments', agentGuard, async (req, res, next) => {
  try {
    const data = await rpc('departments', {});
    const list = data || [];
    res.json({ departments: list, total: list.length });
  } catch (e) { next(e); }
});

// GET /api/desk/agents?department_id= — 이관 대상 상담사 로스터
// 누구를 볼 수 있는지는 RPC 가 정한다 (unrestricted 전체 · 그 외 자기 부서 ∪ 지정 부서)
router.get('/agents', agentGuard, async (req, res, next) => {
  try {
    let departmentId = null;
    if (req.query.department_id != null && req.query.department_id !== '') {
      departmentId = Number.parseInt(req.query.department_id, 10);
      if (!Number.isFinite(departmentId)) {
        return res.status(400).json({ error: 'department_id 는 숫자여야 합니다' });
      }
    }
    const data = await rpc('assignable_agents', {
      p_agent_id: req.deskAgentId,
      p_department_id: departmentId,
    });
    const list = data || [];
    res.json({ agents: list, total: list.length });
  } catch (e) { next(e); }
});

// GET /api/desk/inbox?intent=&topic=&status=&mine= — 담당 카테고리 필터는 RPC 가 강제한다
router.get('/inbox', agentGuard, async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 200);
    const data = await rpc('inbox', {
      p_agent_id: req.deskAgentId,
      p_intent: req.query.intent || null,
      p_topic: req.query.topic || null,
      p_status: req.query.status || null,
      p_mine: req.query.mine === 'true' || req.query.mine === '1',
      p_limit: limit,
    });
    res.json({ conversations: data || [] });
  } catch (e) { next(e); }
});

// GET /api/desk/conversations/:id?since_seq= — 대화 + 핸드오프 패키지 + 고객 360°
// ★ 데스크 화면의 실시간 갱신은 이 엔드포인트 폴링으로 한다 (SSE 아님).
//   since_seq 를 주면 그 seq 초과분만 messages 로 내려온다 (내부메모 포함).
router.get('/conversations/:id', agentGuard, async (req, res, next) => {
  try {
    const id = conversationId(req);
    if (!id) return badId(res);

    const { conv, allowed, denied } = await loadInScopeConversation(req.deskAgentId, id);
    if (denied) return res.status(403).json({ error: denied });
    if (!conv) return res.status(404).json({ error: '대화를 찾을 수 없습니다' });
    if (!allowed) return forbidden(res);

    let since = Number.parseInt(req.query.since_seq, 10);
    if (!Number.isFinite(since) || since < 0) since = 0;

    // 상담사는 내부 메모(is_private)까지 본다
    const messages = await rpc('messages_since', {
      p_conversation_id: id, p_since_seq: since, p_include_private: true,
    });
    const list = messages || [];
    res.json({ ...conv, messages: list, last_seq: list.length ? list[list.length - 1].seq : since });
  } catch (e) { next(e); }
});

// POST /api/desk/conversations/:id/claim — 배정받기 · {barge_in:true} 면 AI 응대중 개입
router.post('/conversations/:id/claim', agentGuard, async (req, res, next) => {
  try {
    const id = conversationId(req);
    if (!id) return badId(res);

    const { conv, allowed, denied } = await loadInScopeConversation(req.deskAgentId, id);
    if (denied) return res.status(403).json({ error: denied });
    if (!conv) return res.status(404).json({ error: '대화를 찾을 수 없습니다' });
    if (!allowed) return forbidden(res);

    const bargeIn = req.body?.barge_in === true || req.body?.barge_in === 'true'
      || req.query.barge_in === 'true';
    const data = await rpc('claim', {
      p_conversation_id: id, p_agent_id: req.deskAgentId, p_barge_in: bargeIn,
    });
    if (rejected(res, data)) return;   // 0행 = 이미 다른 상담사가 받음
    res.json(data);
  } catch (e) { next(e); }
});

// POST /api/desk/conversations/:id/release — 사람 → AI 되돌리기
router.post('/conversations/:id/release', agentGuard, async (req, res, next) => {
  try {
    const id = conversationId(req);
    if (!id) return badId(res);

    const data = await rpc('release', { p_conversation_id: id, p_agent_id: req.deskAgentId });
    if (!data?.ok) {
      return res.status(400).json({ error: '내가 배정받은 대화만 AI 에 되돌릴 수 있습니다' });
    }
    res.json(data);
  } catch (e) { next(e); }
});

// POST /api/desk/conversations/:id/reply — 상담사 답변 · {private:true} 면 내부 메모
router.post('/conversations/:id/reply', agentGuard, async (req, res, next) => {
  try {
    const id = conversationId(req);
    if (!id) return badId(res);

    const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
    if (!body) return res.status(400).json({ error: '답변 내용은 필수입니다' });
    if (body.length > MAX_BODY_LEN) {
      return res.status(400).json({ error: `답변은 ${MAX_BODY_LEN}자를 넘을 수 없습니다` });
    }

    const { conv, allowed, denied } = await loadInScopeConversation(req.deskAgentId, id);
    if (denied) return res.status(403).json({ error: denied });
    if (!conv) return res.status(404).json({ error: '대화를 찾을 수 없습니다' });
    if (!allowed) return forbidden(res);

    const data = await rpc('reply', {
      p_conversation_id: id,
      p_agent_id: req.deskAgentId,
      p_body: body,
      p_private: req.body?.private === true || req.body?.private === 'true',
      p_rich: req.body?.rich ?? null,
    });
    res.status(201).json(data);
  } catch (e) { next(e); }
});

// POST /api/desk/conversations/:id/close — 종결
// outcome='booked_call' 인데 callback_at 이 없으면 RPC 가 거절한다 (무단 발신 금지 §4.2.7)
router.post('/conversations/:id/close', agentGuard, async (req, res, next) => {
  try {
    const id = conversationId(req);
    if (!id) return badId(res);

    const outcome = req.body?.outcome;
    if (!outcome) return res.status(400).json({ error: 'outcome(종결 유형)은 필수입니다' });

    let callbackAt = null;
    if (req.body?.callback_at) {
      const d = new Date(req.body.callback_at);
      if (Number.isNaN(d.getTime())) {
        return res.status(400).json({ error: 'callback_at 형식이 올바르지 않습니다' });
      }
      callbackAt = d.toISOString();
    }

    const { conv, allowed, denied } = await loadInScopeConversation(req.deskAgentId, id);
    if (denied) return res.status(403).json({ error: denied });
    if (!conv) return res.status(404).json({ error: '대화를 찾을 수 없습니다' });
    if (!allowed) return forbidden(res);

    const data = await rpc('close', {
      p_conversation_id: id,
      p_agent_id: req.deskAgentId,
      p_outcome: String(outcome),
      p_callback_at: callbackAt,
      p_summary: req.body?.summary || null,
    });
    if (rejected(res, data)) return;
    res.json(data);
  } catch (e) { next(e); }
});

// POST /api/desk/conversations/:id/transfer — 이관 (부서·상담사·토픽)
// 사유 필수. 메시지는 이동하지 않고 배정만 바뀐다 (설계서 §4.2.6)
router.post('/conversations/:id/transfer', agentGuard, async (req, res, next) => {
  try {
    const id = conversationId(req);
    if (!id) return badId(res);

    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (!reason) return res.status(400).json({ error: '이관 사유는 필수입니다' });
    if (reason.length > MAX_BODY_LEN) {
      return res.status(400).json({ error: `이관 사유는 ${MAX_BODY_LEN}자를 넘을 수 없습니다` });
    }

    let toDepartment = null;
    if (req.body?.to_department != null && req.body.to_department !== '') {
      toDepartment = Number.parseInt(req.body.to_department, 10);
      if (!Number.isFinite(toDepartment)) {
        return res.status(400).json({ error: 'to_department 는 부서 id(숫자)여야 합니다' });
      }
    }
    const toAgent = req.body?.to_agent || null;
    if (toAgent && !UUID_RE.test(toAgent)) {
      return res.status(400).json({ error: 'to_agent 형식이 올바르지 않습니다' });
    }

    const { conv, allowed, denied } = await loadInScopeConversation(req.deskAgentId, id);
    if (denied) return res.status(403).json({ error: denied });
    if (!conv) return res.status(404).json({ error: '대화를 찾을 수 없습니다' });
    if (!allowed) return forbidden(res);

    const data = await rpc('transfer', {
      p_conversation_id: id,
      p_agent_id: req.deskAgentId,
      p_reason: reason,
      p_to_department: toDepartment,
      p_to_agent: toAgent,
      p_to_topic: req.body?.to_topic || null,
    });
    if (rejected(res, data)) return;
    res.json(data);
  } catch (e) { next(e); }
});

// POST /api/desk/conversations/:id/snooze — 보류. until 은 반드시 미래여야 한다
router.post('/conversations/:id/snooze', agentGuard, async (req, res, next) => {
  try {
    const id = conversationId(req);
    if (!id) return badId(res);

    if (!req.body?.until) return res.status(400).json({ error: 'until(보류 해제 시각)은 필수입니다' });
    const until = new Date(req.body.until);
    if (Number.isNaN(until.getTime())) {
      return res.status(400).json({ error: 'until 형식이 올바르지 않습니다 (ISO8601)' });
    }

    const { conv, allowed, denied } = await loadInScopeConversation(req.deskAgentId, id);
    if (denied) return res.status(403).json({ error: denied });
    if (!conv) return res.status(404).json({ error: '대화를 찾을 수 없습니다' });
    if (!allowed) return forbidden(res);

    const data = await rpc('snooze', {
      p_conversation_id: id,
      p_agent_id: req.deskAgentId,
      p_until: until.toISOString(),
      p_reason: req.body?.reason || null,
    });
    if (rejected(res, data)) return;   // 과거 시각이면 RPC 가 거절한다
    res.json(data);
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────
// § 미사용 (2026-09-04 범위 변경으로 제거)
//   · POST /api/desk/conversations            (desk_start)
//   · POST /api/desk/conversations/:id/messages (desk_customer_say)
//   · GET  /api/desk/stream, /conversations/:id/stream  (SSE)
//   고객 위젯을 우리가 만들지 않기로 하면서 소비자가 사라졌다.
//   고객 발화는 앱 서버가 /api/desk/app/say 로 중계하고,
//   데스크 화면 갱신은 GET /api/desk/conversations/:id?since_seq= 폴링으로 한다.
//   RPC(desk_start·desk_customer_say)는 DB 에 그대로 남아 있으므로 필요하면 되살릴 수 있다.
//   ⚠ 되살릴 때: desk_customer_say 는 2026-09-04 부터 3인자(p_visitor_key)다.
//      발신자 대조용이므로 반드시 visitor_key 를 넘겨야 한다.
// ─────────────────────────────────────────────────────────────────

export default router;
