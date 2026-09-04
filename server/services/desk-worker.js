// 봉이 상담 데스크 — 아웃바운드 큐 워커
// 설계서   : docs/specs/cs-chat-desk-2026-09-03.md
// 큐 스키마: desk.outbound_queue (2026-09-04-desk-social.sql + dev 확장분)
//
// desk.outbound_queue 를 폴링해 외부(현재는 인스타그램 DM)로 내보낸다.
// desk 스키마는 PostgREST 노출 목록에 없으므로 public.desk_outbound_* 래퍼 RPC 만 쓴다.
//
//   desk_outbound_claim(p_worker, p_kinds, p_limit) → 배치 집기 (FOR UPDATE SKIP LOCKED)
//   desk_outbound_mark(p_id, p_ok, p_provider_ref, p_error) → 결과 기록 + 지수백오프
//   desk_outbound_reap(p_stale_min) → 'sending' 에 갇힌 행 회수 (attempts 를 올린다)
//   desk_outbound_stats() → kind 별 상태 집계
//
// ★ 설계상 반드시 지키는 것 (바꾸기 전에 이유를 읽어라)
//   1. setInterval 이 아니라 setTimeout 체인이다. 배치 처리가 주기보다 길어지면
//      setInterval 은 실행을 겹쳐 같은 행을 두 번 보내려 든다(claim 이 막아주긴 하나
//      연결 수만 늘고 이득이 없다). 한 사이클이 끝난 뒤에 다음을 예약한다.
//   2. DESK_WORKER_ENABLED 킬 스위치. 기본은 꺼짐. 외부 API 를 때리는 루프에
//      스위치가 없으면 사고가 났을 때 "재배포" 말고는 멈출 방법이 없다.
//   3. claimed_by 에 인스턴스 식별자를 넣는다. 갇힌 행이 어느 인스턴스에서
//      죽었는지 봐야 원인을 찾는다.
//   4. 배치 안에서 동시 5건까지만. 외부 API 레이트리밋을 한꺼번에 때리지 않는다.
//   5. reap 은 같은 프로세스의 별도 타이머다. 크론 서비스를 따로 두지 않는다.
//
// ★★ 집는 kind 는 핸들러 레지스트리(HANDLERS)의 키가 전부다.
//   crm_note · crm_callback 은 CRM API 스펙이 아직 없어서 등록하지 않았다.
//   "스텁 핸들러를 만들어 실패시키기" 는 틀린 구현이다 — attempts 가 올라가
//   5회 만에 failed 로 죽고, 정작 스펙이 나왔을 때 내보낼 것이 남지 않는다.
//   등록하지 않으면 claim 자체가 그 행을 건드리지 않아 pending 으로 고스란히 쌓인다.
//   스펙이 나오면 HANDLERS 에 핸들러를 추가하기만 하면 그동안 쌓인 것이 순서대로 나간다.
import os from 'os';
import { createClient } from '@supabase/supabase-js';

// ★ 공유 클라이언트(db/supabase.js)를 쓰지 않고 워커 전용 클라이언트를 따로 만든다.
//   공유 클라이언트는 로그인 세션이 눌러붙을 수 있다(그 파일의 authClient() 주석 참조).
//   실제로 /api/auth/login 을 한 번 태우면 공유 클라이언트가 service_role 에서
//   "마지막에 로그인한 사람" 으로 강등되고, 그 순간부터 워커의 모든 RPC 가
//   permission denied 로 죽는다 (desk_outbound_* 는 service_role 에만 grant 되어 있다).
//   요청 처리와 무관하게 도는 백그라운드 루프가 요청 처리의 부작용에 끌려가면 안 된다.
//   ⚠ 이건 워커만 지킨 것이다 — routes/desk.js 등 공유 클라이언트를 쓰는 코드는
//     여전히 같은 사고에 노출돼 있다(원인은 routes/auth.js 의 로그인 호출).
const supabase = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  : null;

// ─── 설정 ────────────────────────────────────────────────────────
const POLL_MS = Number(process.env.DESK_WORKER_POLL_MS || 5000);   // 빈 배치 후 대기
const DRAIN_MS = 250;                                              // 배치가 꽉 찼을 때 곧바로 이어감
const BATCH = Number(process.env.DESK_WORKER_BATCH || 20);
const CONCURRENCY = 5;                                             // 배치 내 병렬도 (조건 4)
const REAP_MS = Number(process.env.DESK_WORKER_REAP_MS || 300_000); // 5분
const REAP_STALE_MIN = Number(process.env.DESK_WORKER_STALE_MIN || 10);
const OLDEST_WARN_MIN = 30;                                        // 이보다 오래 대기 중이면 경고
const HTTP_TIMEOUT_MS = 15_000;
const MAX_ERROR_LEN = 500;                                         // last_error 컬럼 오염 방지

// 조건 3 — 어느 인스턴스의 어느 프로세스가 집었는지
const WORKER_ID = `${process.env.RAILWAY_REPLICA_ID || os.hostname()}:${process.pid}`;

const META_API_VERSION = process.env.DESK_META_API_VERSION || 'v21.0';
const META_API_BASE = process.env.DESK_META_API_BASE || 'https://graph.instagram.com';
const META_SENDER_ID = process.env.DESK_META_SENDER_ID || 'me';

// ─── RPC 호출 ────────────────────────────────────────────────────
// routes/desk.js 의 rpc() 와 같은 패턴이지만 일부러 따로 둔다.
// 저쪽은 HTTP 상태코드로 번역해 사용자에게 내려보내는 것이 목적이고,
// 여기는 던져서 로그에 남기는 것이 전부다. 섞으면 워커 실패가 400 처럼 보인다.
async function rpc(name, params) {
  if (!supabase) throw new Error('Supabase 미연결');
  const { data, error } = await supabase.rpc(`desk_${name}`, params);
  if (error) throw new Error(`[desk_${name}] ${error.message || 'RPC 실패'}`);
  return data;
}

function short(msg) {
  const s = String(msg ?? '알 수 없는 오류');
  return s.length > MAX_ERROR_LEN ? s.slice(0, MAX_ERROR_LEN) : s;
}

// ─── 핸들러 ──────────────────────────────────────────────────────
// 계약: 성공하면 { ref } (provider 메시지 id) 를 돌려주고, 실패하면 throw 한다.
// throw 된 메시지는 그대로 last_error 에 적히고 백오프 후 재시도된다.

async function sendSocialMessage(item) {
  const token = process.env.DESK_META_TOKEN;

  // 자격증명이 없으면 "보낸 척" 하지 않는다. 실패로 기록하면 백오프로 밀릴 뿐
  // 큐에 그대로 남아, 토큰이 설정되는 순간 자동으로 나간다.
  // (attempts 는 올라간다 — 5회를 넘기면 failed 다. 토큰 없이 오래 굴리면 안 된다.)
  if (!token) throw new Error('Meta 자격증명 미설정');

  if (item.target !== 'instagram') {
    throw new Error(`지원하지 않는 소셜 채널: ${item.target || '(없음)'}`);
  }
  if (!item.recipient_id) throw new Error('수신자 ID 없음');
  if (!item.body) throw new Error('보낼 내용 없음');

  // 24시간 창을 넘긴 건에는 HUMAN_AGENT 태그가 필수다(없으면 Meta 가 거절한다).
  // 태그 판정은 DB(desk.messaging_window)가 이미 했고 여기서는 싣기만 한다.
  const payload = {
    recipient: { id: item.recipient_id },
    message: { text: item.body },
    ...(item.tag === 'human_agent'
      ? { messaging_type: 'MESSAGE_TAG', tag: 'HUMAN_AGENT' }
      : { messaging_type: 'RESPONSE' }),
  };

  const url = `${META_API_BASE}/${META_API_VERSION}/${META_SENDER_ID}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });

  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* 본문이 JSON 이 아닐 수 있다 */ }

  if (!res.ok) {
    const err = json?.error;
    throw new Error(`Meta ${res.status} ${err?.code ?? ''} ${err?.message || text.slice(0, 200)}`.trim());
  }
  return { ref: json?.message_id || json?.mid || null };
}

// ★ 여기에 등록된 kind 만 claim 한다 (파일 상단 설명 참조)
const HANDLERS = {
  social_message: sendSocialMessage,
};
const KINDS = Object.keys(HANDLERS);

// ─── 한 사이클 ───────────────────────────────────────────────────
async function processOne(item) {
  const handler = HANDLERS[item.kind];
  try {
    // KINDS 로 claim 했으므로 도달할 수 없지만, DB 쪽 p_kinds 가 무시되는
    // 상황(RPC 교체 등)에서 알 수 없는 kind 를 조용히 성공 처리하지 않도록 남긴다.
    if (!handler) throw new Error(`핸들러 없는 kind: ${item.kind}`);
    const out = await handler(item);
    await rpc('outbound_mark', {
      p_id: item.id, p_ok: true, p_provider_ref: out?.ref ?? null, p_error: null,
    });
    return true;
  } catch (e) {
    try {
      await rpc('outbound_mark', {
        p_id: item.id, p_ok: false, p_provider_ref: null, p_error: short(e.message),
      });
    } catch (markErr) {
      // mark 까지 실패하면 행은 'sending' 에 갇힌다 → reap 이 회수한다.
      console.error(`❌ [desk-worker] mark 실패 id=${item.id}: ${markErr.message}`);
    }
    return false;
  }
}

// 병렬도 제한 풀 — Promise.all(전체) 로 하면 배치 20건이 한 번에 나간다
async function runPool(items, limit) {
  let cursor = 0;
  let ok = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      if (await processOne(item)) ok++;
    }
  });
  await Promise.all(workers);
  return ok;
}

async function cycle() {
  const items = await rpc('outbound_claim', {
    p_worker: WORKER_ID,
    p_kinds: KINDS,
    p_limit: BATCH,
  });
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) return 0;   // 0건이면 로그를 남기지 않는다 (로그 오염 방지)

  const ok = await runPool(list, CONCURRENCY);
  console.log(`📤 [desk-worker] ${list.length}건 처리 (성공 ${ok} · 실패 ${list.length - ok})`);
  return list.length;
}

// ─── 회수 + 적체 감시 (별도 타이머) ──────────────────────────────
async function reapAndWatch() {
  try {
    const r = await rpc('outbound_reap', { p_stale_min: REAP_STALE_MIN });
    if (r?.reaped > 0) {
      console.warn(`♻️ [desk-worker] 갇힌 발신 ${r.reaped}건 회수 (failed 전환 ${r.moved_to_failed || 0}건)`);
    }
  } catch (e) {
    console.error(`❌ [desk-worker] reap 실패: ${e.message}`);
  }

  // 적체 감시는 reap 주기에 얹는다. 사이클(5초)마다 stats 를 조회하면
  // 아무 일도 없는 시간대에 하루 1.7만 회의 집계 쿼리가 나간다.
  try {
    const stats = await rpc('outbound_stats', {});
    for (const [kind, s] of Object.entries(stats || {})) {
      if (!s?.oldest_pending) continue;
      const min = (Date.now() - new Date(s.oldest_pending).getTime()) / 60000;
      if (min >= OLDEST_WARN_MIN) {
        console.warn(
          `⚠️ [desk-worker] ${kind} 적체 — 가장 오래된 대기 ${Math.round(min)}분 ` +
          `(pending ${s.pending}${KINDS.includes(kind) ? '' : ' · 미처리 kind — 스펙 대기 중'})`
        );
      }
    }
  } catch (e) {
    console.error(`❌ [desk-worker] stats 실패: ${e.message}`);
  }
}

// ─── 기동 / 정지 ─────────────────────────────────────────────────
let pollTimer = null;
let reapTimer = null;
let stopped = true;

function schedule(ms) {
  if (stopped) return;
  pollTimer = setTimeout(tick, ms);
  pollTimer.unref?.();   // 이 타이머 때문에 프로세스가 종료되지 못하는 일이 없게
}

async function tick() {
  if (stopped) return;
  let n = 0;
  try {
    n = await cycle();
  } catch (e) {
    console.error(`❌ [desk-worker] 사이클 실패: ${e.message}`);
  } finally {
    // 배치가 꽉 찼으면 아직 남았다는 뜻 — 5초를 기다리지 않고 이어서 비운다 (조건 1)
    schedule(n >= BATCH ? DRAIN_MS : POLL_MS);
  }
}

export function startDeskWorker() {
  // 조건 2 — 명시적으로 켜야만 돈다
  if (process.env.DESK_WORKER_ENABLED !== 'true') {
    console.log('⏸ [desk-worker] 비활성 (DESK_WORKER_ENABLED=true 로 켭니다)');
    return false;
  }
  if (!supabase) {
    console.error('❌ [desk-worker] Supabase 미연결 — 워커를 켜지 않습니다');
    return false;
  }
  if (!stopped) return true;

  stopped = false;
  console.log(
    `📤 [desk-worker] 기동 — worker=${WORKER_ID} · kinds=[${KINDS.join(',')}] · ` +
    `배치 ${BATCH}/병렬 ${CONCURRENCY} · 폴링 ${POLL_MS}ms · reap ${REAP_MS / 1000}s(stale ${REAP_STALE_MIN}m)` +
    (process.env.DESK_META_TOKEN ? '' : ' · ⚠ DESK_META_TOKEN 미설정 (전송은 실패 기록됩니다)')
  );

  schedule(0);
  reapTimer = setInterval(() => { reapAndWatch().catch(() => {}); }, REAP_MS);
  reapTimer.unref?.();
  reapAndWatch().catch(() => {});   // 기동 직후 1회 — 이전 인스턴스가 남긴 갇힌 행 회수
  return true;
}

export function stopDeskWorker() {
  stopped = true;
  if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
  if (reapTimer) { clearInterval(reapTimer); reapTimer = null; }
}

export const _deskWorkerInternals = { WORKER_ID, KINDS, cycle, reapAndWatch };
