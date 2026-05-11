// 봉이 콜 DB CRM — Phase 1 라우트
// PRD-customer-db.md 참조
import express from 'express';
import multer from 'multer';
import { authenticateJWT } from '../middleware/auth.js';
import { supabase } from '../db/supabase.js';
import { randomUUID } from 'crypto';
import { runRetentionJob, RETENTION_POLICY } from '../jobs/customer-db-retention.js';
import { runRedistributionJob, REDISTRIBUTION_POLICY } from '../jobs/customer-db-redistribution.js';
import { invalidateIpAllowlistCache } from '../middleware/ipAllowlist.js';

// 운영 환경에선 내부 에러 메시지 노출 안 함 (DB 스키마/쿼리 누출 방지)
const _isProd = process.env.NODE_ENV === 'production';
function sanitizeErr(e) {
  if (_isProd) return '서버 오류 — 잠시 후 다시 시도하세요';
  return e?.message || '서버 오류';
}

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB

// ─── 헬퍼: 현재 incentive_agent ───
const _agentCache = new Map();
async function getCurrentIncentiveAgent(userId) {
  if (!userId) return null;
  const c = _agentCache.get(userId);
  if (c && c.expiresAt > Date.now()) return c.data;
  const { data } = await supabase.from('incentive_agents').select('*').eq('user_id', userId).single();
  _agentCache.set(userId, { data, expiresAt: Date.now() + 60_000 });
  return data;
}
function isAdmin(a) { return a && a.role === 'admin'; }
function isManagerOrAdmin(a) { return a && (a.role === 'manager' || a.role === 'admin'); }

// ─── 접근 로그 (개인정보보호 audit) ───
async function logAccess({ user_id, customer_id, action, ip, ua, metadata }) {
  try {
    await supabase.from('incentive_customer_db_access_log').insert({
      customer_id: customer_id || null,
      accessed_by_user_id: user_id,
      action, ip, user_agent: ua, metadata: metadata || null,
    });
  } catch (e) { console.warn('[access_log]', e.message); }
}

// ─── 분(분당)·시간당 Rate Limit (메모리 기반, IP+user) ───
const _rateBuckets = new Map();
function rateLimit({ perMinute = 60, perHour = 1000 } = {}) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.user?.id || 'anon'}`;
    const now = Date.now();
    let b = _rateBuckets.get(key);
    if (!b) { b = { minStart: now, minCount: 0, hourStart: now, hourCount: 0 }; _rateBuckets.set(key, b); }
    if (now - b.minStart > 60_000) { b.minStart = now; b.minCount = 0; }
    if (now - b.hourStart > 3600_000) { b.hourStart = now; b.hourCount = 0; }
    b.minCount++; b.hourCount++;
    if (b.minCount > perMinute) return res.status(429).json({ error: '분당 요청 한도 초과' });
    if (b.hourCount > perHour) return res.status(429).json({ error: '시간당 요청 한도 초과' });
    next();
  };
}

// 모든 라우트 인증 + Rate Limit 기본 적용
router.use(authenticateJWT);
router.use(rateLimit({ perMinute: 120, perHour: 2000 }));

// ═══════════════════════════════════════════════════════════════
// 1. POST /api/customer-db/import — 엑셀/CSV import (admin 전용)
// ═══════════════════════════════════════════════════════════════
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isAdmin(me)) return res.status(403).json({ error: 'admin 전용' });

    const { db_source_id, mode } = req.body;
    if (!db_source_id) return res.status(400).json({ error: 'db_source_id 필수' });
    if (!req.file) return res.status(400).json({ error: '파일 첨부 필수' });

    const importMode = mode === 'closing_ledger' ? 'closing_ledger' : 'simple';

    // CSV/엑셀 파싱 (xlsx 라이브러리 동적 import — 큰 의존성)
    let rows;
    try {
      const XLSX = (await import('xlsx')).default;
      const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws, { defval: null });
    } catch (e) {
      return res.status(400).json({ error: '엑셀 파일 파싱 실패' + (_isProd ? '' : ': ' + e.message) });
    }
    if (!rows.length) return res.status(400).json({ error: '데이터 행 없음' });

    // 마감원장 모드: 워치·미성년·100세 제외 + 이름+생년월일 통합 + 1차/2차 분류 + phone 충돌 on_hold
    if (importMode === 'closing_ledger') {
      const result = await importClosingLedger({ rows, db_source_id, me, userId: req.user.id, ip: req.ip, ua: req.get('user-agent') });
      return res.json(result);
    }

    // 헤더 매핑 (한글/영문)
    const FIELD_MAP = {
      '이름': 'name', 'name': 'name', '성명': 'name',
      '전화': 'phone', '전화번호': 'phone', 'phone': 'phone', '연락처': 'phone',
      '나이': 'age', 'age': 'age', '연령': 'age',
      '성별': 'gender', 'gender': 'gender',
      '지역': 'region', 'region': 'region', '주소': 'region', '거주지': 'region',
      '통신사': 'carrier', 'carrier': 'carrier',
      '메모': 'notes', 'notes': 'notes', '비고': 'notes',
      '동의': 'consent_status',
    };

    // batch 생성
    const batch_id = randomUUID();
    await supabase.from('incentive_customer_import_batch').insert({
      id: batch_id, db_source_id, imported_by_user_id: req.user.id,
      imported_by_name: me.name, total_count: rows.length, status: 'active',
    });

    // 정규화 + 검증
    const validRows = []; const errors = []; const seenPhones = new Set();
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const out = { db_source_id, imported_batch_id: batch_id, imported_by_user_id: req.user.id };
      for (const [k, v] of Object.entries(r)) {
        const norm = FIELD_MAP[(k || '').toString().trim()];
        if (norm) out[norm] = v;
      }
      // 검증
      if (!out.name || !String(out.name).trim()) { errors.push({ row: i + 2, reason: '이름 필수' }); continue; }
      if (!out.phone) { errors.push({ row: i + 2, reason: '전화번호 필수' }); continue; }
      out.phone = String(out.phone).replace(/[^0-9]/g, '');
      if (!/^01[016789][0-9]{7,8}$/.test(out.phone)) { errors.push({ row: i + 2, reason: '전화번호 형식 오류' }); continue; }
      if (seenPhones.has(out.phone)) { errors.push({ row: i + 2, reason: '중복(같은 파일)' }); continue; }
      seenPhones.add(out.phone);
      out.consent_status = out.consent_status === '동의' || out.consent_status === 'agreed' ? 'agreed'
                         : out.consent_status === '미동의' || out.consent_status === 'declined' ? 'declined'
                         : 'unknown';
      // 3년 보유 default
      const retentionDate = new Date(); retentionDate.setFullYear(retentionDate.getFullYear() + 3);
      out.data_retention_until = retentionDate.toISOString().slice(0, 10);
      // 정규화
      if (out.age != null) out.age = parseInt(out.age) || null;
      if (out.gender) out.gender = String(out.gender).trim().slice(0, 10);
      validRows.push(out);
    }

    if (!validRows.length) {
      await supabase.from('incentive_customer_import_batch').update({
        status: 'rolled_back', invalid_count: errors.length,
      }).eq('id', batch_id);
      return res.status(400).json({ error: '유효한 행 없음', errors: errors.slice(0, 20) });
    }

    // Bulk insert (1000개씩 chunk)
    let inserted = 0; let dupCount = 0;
    for (let i = 0; i < validRows.length; i += 1000) {
      const chunk = validRows.slice(i, i + 1000);
      const { data, error } = await supabase.from('incentive_customer_db').insert(chunk).select('id');
      if (error) {
        // 중복 (UNIQUE 위반)인 경우 row 단위로 재시도
        if (error.code === '23505') {
          for (const row of chunk) {
            const { error: e1 } = await supabase.from('incentive_customer_db').insert(row);
            if (e1 && e1.code === '23505') dupCount++;
            else if (!e1) inserted++;
          }
        } else throw error;
      } else inserted += data.length;
    }

    await supabase.from('incentive_customer_import_batch').update({
      valid_count: inserted, invalid_count: errors.length, duplicate_count: dupCount,
    }).eq('id', batch_id);

    logAccess({
      user_id: req.user.id, action: 'import', ip: req.ip, ua: req.get('user-agent'),
      metadata: { batch_id, db_source_id, total: rows.length, inserted, dups: dupCount, errors: errors.length },
    });

    res.json({
      batch_id, total: rows.length, inserted, duplicates: dupCount, invalid: errors.length,
      errors: errors.slice(0, 50),
    });
  } catch (e) {
    console.error('[customer-db import]', e);
    res.status(500).json({ error: sanitizeErr(e) || '서버 오류' });
  }
});

// ═══════════════════════════════════════════════════════════════
// 2. GET /api/customer-db/batches — 최근 batch list (admin)
// ═══════════════════════════════════════════════════════════════
router.get('/batches', async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isAdmin(me)) return res.status(403).json({ error: 'admin 전용' });
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    let q = supabase.from('incentive_customer_import_batch').select('*, db_source:incentive_db_sources(*)').order('imported_at', { ascending: false }).limit(limit);
    if (req.query.status) q = q.eq('status', req.query.status);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ batches: data });
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

// ═══════════════════════════════════════════════════════════════
// 3. POST /api/customer-db/batches/:id/rollback — 배치 롤백 (admin)
// ═══════════════════════════════════════════════════════════════
router.post('/batches/:id/rollback', async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isAdmin(me)) return res.status(403).json({ error: 'admin 전용' });
    const { mode = 'unconfirmed_only', reason } = req.body || {};
    const batchId = req.params.id;

    // soft delete
    let q = supabase.from('incentive_customer_db').update({
      deleted_at: new Date().toISOString(),
    }).eq('imported_batch_id', batchId).is('deleted_at', null);

    if (mode === 'unconfirmed_only') {
      q = q.in('call_status', ['pending', 'no_answer']);
    }
    const { data, error } = await q.select('id');
    if (error) throw error;

    await supabase.from('incentive_customer_import_batch').update({
      status: 'rolled_back', rolled_back_at: new Date().toISOString(),
      rolled_back_by_user_id: req.user.id, rolled_back_reason: reason || null,
      rollback_mode: mode,
    }).eq('id', batchId);

    logAccess({
      user_id: req.user.id, action: 'rollback', ip: req.ip, ua: req.get('user-agent'),
      metadata: { batch_id: batchId, mode, deleted_count: data.length, reason },
    });

    res.json({ ok: true, deleted: data.length, mode });
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

// ═══════════════════════════════════════════════════════════════
// 4. GET /api/customer-db — 페이징 + 검색 + 필터
// ═══════════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(401).json({ error: 'unauthenticated' });

    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;
    let q = supabase.from('incentive_customer_db').select(
      '*, db_source:incentive_db_sources(name, color), assigned_agent:incentive_agents!incentive_customer_db_assigned_agent_id_fkey(id, name, center)',
      { count: 'exact' }
    ).is('deleted_at', null);
    // archived 토글 — ?archived=true 면 archived만, 미지정이면 active만
    if (req.query.archived === 'true') q = q.eq('archived', true);
    else q = q.eq('archived', false);

    // 권한별 범위
    if (me.role === 'agent') {
      q = q.eq('assigned_agent_id', me.id);
      // 기본 콜 큐: 계약완료(converted)·DNT는 숨김 (status filter 명시 시에만 보임)
      if (!req.query.status) q = q.not('call_status', 'in', '(converted)').neq('is_dnt', true);
    }
    else if (me.role === 'manager') {
      // 본인 센터 상담사 list
      const { data: members } = await supabase.from('incentive_agents').select('id').eq('center', me.center).eq('active', true);
      const ids = (members || []).map(x => x.id);
      q = q.in('assigned_agent_id', ids);
    }
    // admin: 전체 (필터링 없음)

    // 필터
    if (req.query.status) q = q.eq('call_status', req.query.status);
    if (req.query.db_source_id) q = q.eq('db_source_id', req.query.db_source_id);
    if (req.query.batch_id) q = q.eq('imported_batch_id', req.query.batch_id);
    if (req.query.agent_id) q = q.eq('assigned_agent_id', req.query.agent_id);
    if (req.query.is_dnt === 'true') q = q.eq('is_dnt', true);
    else if (req.query.is_dnt === 'false') q = q.neq('is_dnt', true);
    if (req.query.q) {
      // 이름·전화 부분 매칭
      const term = req.query.q.replace(/[^0-9가-힣a-zA-Z]/g, '');
      q = q.or(`name.ilike.%${term}%,phone.ilike.%${term}%`);
    }

    // 정렬 — 우선순위 큐
    const sortBy = req.query.sort || 'priority';
    if (sortBy === 'priority') {
      // callback → 재시도 도래 → 우선순위 → 신규
      // (next_retry_at: no_answer 1시간 후·rejected 30일 후 자동 도래 시 큐 상단)
      q = q.order('callback_at', { ascending: true, nullsFirst: false })
           .order('next_retry_at', { ascending: true, nullsFirst: false })
           .order('priority_score', { ascending: false })
           .order('imported_at', { ascending: false });
    } else if (sortBy === 'recent') q = q.order('imported_at', { ascending: false });
    else q = q.order('id', { ascending: false });

    q = q.range(offset, offset + limit - 1);

    const { data, error, count } = await q;
    if (error) throw error;

    // access_log (list view)
    if (data?.length) {
      logAccess({
        user_id: req.user.id, action: 'list_view', ip: req.ip, ua: req.get('user-agent'),
        metadata: { count: data.length, filter: req.query },
      });
    }

    res.json({ customers: data, count, limit, offset });
  } catch (e) {
    console.error('[customer-db list]', e);
    res.status(500).json({ error: sanitizeErr(e) });
  }
});

// ═══════════════════════════════════════════════════════════════
// 5. GET /api/customer-db/:id — 단건 + 콜 이력
// ═══════════════════════════════════════════════════════════════
router.get('/:id(\\d+)', async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(401).json({ error: 'unauthenticated' });

    const { data: cust, error } = await supabase.from('incentive_customer_db')
      .select('*, db_source:incentive_db_sources(*)')
      .eq('id', req.params.id).single();
    if (error || !cust) return res.status(404).json({ error: '고객 없음' });

    // 권한 체크
    if (me.role === 'agent' && cust.assigned_agent_id !== me.id)
      return res.status(403).json({ error: '본인 분배 외 접근 불가' });
    if (me.role === 'manager') {
      const { data: target } = await supabase.from('incentive_agents').select('center').eq('id', cust.assigned_agent_id).single();
      if (target && target.center !== me.center)
        return res.status(403).json({ error: '센터 외 접근 불가' });
    }

    // 콜 이력
    const { data: logs } = await supabase.from('incentive_customer_call_log')
      .select('*, agent:incentive_agents(name)')
      .eq('customer_id', req.params.id).order('called_at', { ascending: false }).limit(20);

    logAccess({
      user_id: req.user.id, customer_id: req.params.id, action: 'view',
      ip: req.ip, ua: req.get('user-agent'),
    });

    res.json({ customer: cust, call_logs: logs || [] });
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

// ═══════════════════════════════════════════════════════════════
// 6. POST /api/customer-db/distribute — 자동 분배 (admin/manager)
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// 6-EQ. POST /api/customer-db/distribute/equal — 균등 분배 (1클릭)
// ═══════════════════════════════════════════════════════════════
router.post('/distribute/equal', async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isManagerOrAdmin(me)) return res.status(403).json({ error: 'manager/admin 전용' });

    const { center, max_per_agent = 0 } = req.body || {};
    const targetCenter = me.role === 'manager' ? me.center : (center || null);

    // 콜센터 active agent 자동 조회
    let aq = supabase.from('incentive_agents').select('id, name, center').eq('active', true).in('role', ['agent','manager']);
    if (targetCenter) aq = aq.eq('center', targetCenter);
    const { data: agents, error: ae } = await aq;
    if (ae) throw ae;
    if (!agents || !agents.length) return res.status(400).json({ error: '분배 대상 상담사 없음' });

    const agent_ids = agents.map(a => a.id);

    // 미배정 풀 가져오기 (priority_score DESC)
    const totalLimit = max_per_agent > 0 ? max_per_agent * agent_ids.length : 100000;
    let q = supabase.from('incentive_customer_db')
      .select('id, priority_score').is('deleted_at', null).is('assigned_agent_id', null).eq('archived', false);
    if (me.role === 'manager') q = q.eq('assigned_center', me.center);
    q = q.order('priority_score', { ascending: false, nullsFirst: false })
         .order('imported_at', { ascending: true })
         .limit(totalLimit);
    const { data: targets, error: e1 } = await q;
    if (e1) throw e1;
    if (!targets.length) return res.json({ ok: true, distributed: 0, message: '미배정 풀 비어있음' });

    // 라운드로빈
    const updates = targets.map((t, i) => ({
      id: t.id,
      assigned_agent_id: agent_ids[i % agent_ids.length],
      assigned_center: targetCenter,
      assigned_at: new Date().toISOString(),
      assigned_by_user_id: req.user.id,
    }));

    let total = 0;
    for (let i = 0; i < updates.length; i += 500) {
      const chunk = updates.slice(i, i + 500);
      const { error } = await supabase.from('incentive_customer_db').upsert(chunk);
      if (error) throw error;
      total += chunk.length;
    }

    logAccess({
      user_id: req.user.id, action: 'distribute_equal', ip: req.ip, ua: req.get('user-agent'),
      metadata: { center: targetCenter, agent_count: agent_ids.length, distributed: total, max_per_agent },
    });

    // 상담사별 분배 카운트
    const perAgent = {};
    updates.forEach(u => { perAgent[u.assigned_agent_id] = (perAgent[u.assigned_agent_id] || 0) + 1; });
    const breakdown = agents.map(a => ({ id: a.id, name: a.name, center: a.center, assigned: perAgent[a.id] || 0 }));

    res.json({ ok: true, distributed: total, agent_count: agent_ids.length, center: targetCenter, breakdown });
  } catch (e) {
    console.error('[distribute/equal]', e);
    res.status(500).json({ error: sanitizeErr(e) });
  }
});

// ═══════════════════════════════════════════════════════════════
// 6-EQ. POST /api/customer-db/distribute/equal — 균등 분배 (1클릭)
//   - 콜센터 active agent 자동 조회
//   - 미배정 풀 → quality_grade·priority_score 우선순위 → 라운드로빈
// ═══════════════════════════════════════════════════════════════
router.post('/distribute/equal', async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isManagerOrAdmin(me)) return res.status(403).json({ error: 'manager/admin 전용' });

    const { center, max_per_agent = 0, grades = ['S','A','B','R','C'] } = req.body || {};
    const targetCenter = me.role === 'manager' ? me.center : (center || null);

    let aq = supabase.from('incentive_agents').select('id, name, center').eq('active', true).in('role', ['agent','manager']);
    if (targetCenter) aq = aq.eq('center', targetCenter);
    const { data: agents, error: ae } = await aq;
    if (ae) throw ae;
    if (!agents || !agents.length) return res.status(400).json({ error: '분배 대상 상담사 없음' });

    const agent_ids = agents.map(a => a.id);
    const totalLimit = max_per_agent > 0 ? max_per_agent * agent_ids.length : 100000;

    let q = supabase.from('incentive_customer_db')
      .select('id, quality_grade, priority_score').is('deleted_at', null).is('assigned_agent_id', null).eq('archived', false)
      .in('quality_grade', grades);
    if (me.role === 'manager') q = q.eq('assigned_center', me.center);
    // priority_score DESC만으로 사용자 의도 순서: S(100)→A(80)→B(60)→R(50)→C(0)
    // quality_grade ASC는 알파벳 순(A→B→C→R→S)이 의도와 어긋나 제거
    q = q.order('priority_score', { ascending: false, nullsFirst: false })
         .order('imported_at', { ascending: true })
         .limit(totalLimit);
    const { data: targets, error: e1 } = await q;
    if (e1) throw e1;
    if (!targets.length) return res.json({ ok: true, distributed: 0, message: '미배정 풀 비어있음' });

    const updates = targets.map((t, i) => ({
      id: t.id,
      assigned_agent_id: agent_ids[i % agent_ids.length],
      assigned_center: targetCenter,
      assigned_at: new Date().toISOString(),
      assigned_by_user_id: req.user.id,
    }));

    let total = 0;
    for (let i = 0; i < updates.length; i += 500) {
      const chunk = updates.slice(i, i + 500);
      const { error } = await supabase.from('incentive_customer_db').upsert(chunk);
      if (error) throw error;
      total += chunk.length;
    }

    logAccess({
      user_id: req.user.id, action: 'distribute_equal', ip: req.ip, ua: req.get('user-agent'),
      metadata: { center: targetCenter, agent_count: agent_ids.length, distributed: total, grades },
    });

    const perAgent = {};
    updates.forEach(u => { perAgent[u.assigned_agent_id] = (perAgent[u.assigned_agent_id] || 0) + 1; });
    const breakdown = agents.map(a => ({ id: a.id, name: a.name, center: a.center, assigned: perAgent[a.id] || 0 }));

    res.json({ ok: true, distributed: total, agent_count: agent_ids.length, center: targetCenter, breakdown, grades });
  } catch (e) {
    console.error('[distribute/equal]', e);
    res.status(500).json({ error: sanitizeErr(e) });
  }
});

router.post('/distribute', async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isManagerOrAdmin(me)) return res.status(403).json({ error: 'manager/admin 전용' });

    const { batch_id, method = 'round_robin', agent_ids = [], max_per_agent = 0, grades = null } = req.body || {};
    if (!Array.isArray(agent_ids) || !agent_ids.length) return res.status(400).json({ error: 'agent_ids 필수' });

    // manager는 본인 센터 상담사만
    if (me.role === 'manager') {
      const { data: members } = await supabase.from('incentive_agents').select('id').eq('center', me.center).eq('active', true);
      const valid = new Set((members || []).map(x => x.id));
      if (agent_ids.some(id => !valid.has(id))) return res.status(403).json({ error: '센터 외 상담사 포함' });
    }

    const totalLimit = max_per_agent > 0 ? max_per_agent * agent_ids.length : 100000;
    let q = supabase.from('incentive_customer_db')
      .select('id').is('deleted_at', null).is('assigned_agent_id', null).eq('archived', false);
    if (batch_id) q = q.eq('imported_batch_id', batch_id);
    if (Array.isArray(grades) && grades.length) q = q.in('quality_grade', grades);
    if (me.role === 'manager') q = q.eq('assigned_center', me.center);

    q = q.order('priority_score', { ascending: false, nullsFirst: false }).order('imported_at', { ascending: true }).limit(totalLimit);
    const { data: targets, error: e1 } = await q;
    if (e1) throw e1;
    if (!targets.length) return res.json({ ok: true, distributed: 0, message: '분배할 customer 없음 (미배정 풀 비어있음)' });

    // 라운드 로빈 분배 (max_per_agent 적용)
    const updates = [];
    targets.forEach((t, i) => {
      updates.push({
        id: t.id,
        assigned_agent_id: agent_ids[i % agent_ids.length],
        assigned_at: new Date().toISOString(),
        assigned_by_user_id: req.user.id,
      });
    });

    // chunk update
    let total = 0;
    for (let i = 0; i < updates.length; i += 500) {
      const chunk = updates.slice(i, i + 500);
      // upsert로 일괄 업데이트
      const { error } = await supabase.from('incentive_customer_db').upsert(chunk);
      if (error) throw error;
      total += chunk.length;
    }

    logAccess({
      user_id: req.user.id, action: 'distribute', ip: req.ip, ua: req.get('user-agent'),
      metadata: { batch_id, method, agent_count: agent_ids.length, distributed: total },
    });

    res.json({ ok: true, distributed: total, method, agent_count: agent_ids.length });
  } catch (e) {
    console.error('[distribute]', e);
    res.status(500).json({ error: sanitizeErr(e) });
  }
});

// ═══════════════════════════════════════════════════════════════
// 7. POST /api/customer-db/:id/log — 콜 결과 기록
// ═══════════════════════════════════════════════════════════════
router.post('/:id(\\d+)/log', async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(401).json({ error: 'unauthenticated' });

    const { result, callback_at, dnt = false } = req.body || {};
    let { notes, reject_reason } = req.body || {};
    if (!result) return res.status(400).json({ error: 'result 필수' });
    const validResults = ['no_answer', 'rejected', 'callback', 'converted', 'wrong_number'];
    if (!validResults.includes(result)) return res.status(400).json({ error: '잘못된 result' });
    // 길이 제한 (DOS 방어)
    if (typeof notes === 'string') notes = notes.slice(0, 2000);
    if (typeof reject_reason === 'string') reject_reason = reject_reason.slice(0, 200);

    const { data: cust } = await supabase.from('incentive_customer_db')
      .select('id, assigned_agent_id, call_count').eq('id', req.params.id).single();
    if (!cust) return res.status(404).json({ error: '고객 없음' });
    // 본인 분배만
    if (me.role === 'agent' && cust.assigned_agent_id !== me.id)
      return res.status(403).json({ error: '본인 분배 외 기록 불가' });

    // 1) call_log 추가 (error 캐치 — sequence 충돌 등 silent fail 방지)
    const { error: logErr } = await supabase.from('incentive_customer_call_log').insert({
      customer_id: cust.id, agent_id: me.id, result,
      notes: notes || null, callback_at: callback_at || null, reject_reason: reject_reason || null,
    });
    if (logErr) {
      console.error('[customer log INSERT 실패]', logErr);
      throw logErr;
    }

    // 2) customer 상태 업데이트 (재컨택 룰 적용)
    const now = new Date();
    const update = {
      call_status: result, last_contacted_at: now.toISOString(),
      call_count: (cust.call_count || 0) + 1,
      updated_at: now.toISOString(),
    };
    if (result === 'no_answer') {
      // 1시간 후 재시도
      update.next_retry_at = new Date(now.getTime() + 3600_000).toISOString();
    } else if (result === 'callback') {
      update.callback_at = callback_at || null;
      update.next_retry_at = callback_at || null;
    } else if (result === 'rejected') {
      update.reject_reason = reject_reason || null;
      // 30일 후 재시도 (DNT가 아니면)
      if (!dnt) update.next_retry_at = new Date(now.getTime() + 30 * 86400_000).toISOString();
    } else if (result === 'wrong_number') {
      update.archived = true;
      update.archived_at = now.toISOString();
      update.archived_reason = 'wrong_number';
    }
    if (dnt) {
      update.is_dnt = true;
      update.call_status = 'dnt';
      update.next_retry_at = null;
    }
    // 5회 미컨택 → 자동 archived
    if (update.call_count >= 5 && ['no_answer', 'rejected'].includes(result)) {
      update.archived = true;
      update.archived_at = now.toISOString();
      update.archived_reason = 'max_attempts';
    }

    const { error } = await supabase.from('incentive_customer_db').update(update).eq('id', cust.id);
    if (error) throw error;

    res.json({ ok: true, customer_id: cust.id, new_status: update.call_status, archived: !!update.archived });
  } catch (e) {
    console.error('[customer log]', e);
    res.status(500).json({ error: sanitizeErr(e) });
  }
});

// ═══════════════════════════════════════════════════════════════
// 8. PATCH /api/customer-db/:id — 일반 업데이트 (assign 포함)
// ═══════════════════════════════════════════════════════════════
router.patch('/:id(\\d+)', async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(401).json({ error: 'unauthenticated' });

    // 권한 — 대상 customer 범위 검증
    const { data: target } = await supabase.from('incentive_customer_db')
      .select('id, assigned_agent_id, assigned_center').eq('id', req.params.id).is('deleted_at', null).single();
    if (!target) return res.status(404).json({ error: '고객 없음' });
    if (me.role === 'agent' && target.assigned_agent_id !== me.id)
      return res.status(403).json({ error: '본인 분배 customer만 수정 가능' });
    if (me.role === 'manager') {
      if (target.assigned_agent_id) {
        const { data: a } = await supabase.from('incentive_agents').select('center').eq('id', target.assigned_agent_id).single();
        if (a && a.center !== me.center) return res.status(403).json({ error: '센터 외 customer 수정 불가' });
      } else if (target.assigned_center && target.assigned_center !== me.center) {
        return res.status(403).json({ error: '센터 외 customer 수정 불가' });
      }
    }

    // 필드별 권한 — agent는 본인 콜 결과 관련 필드만
    const adminFields = new Set(['assigned_agent_id', 'priority_score', 'consent_status', 'archived', 'archived_reason', 'converted_sale_id', 'is_dnt']);
    const agentFields = new Set(['notes', 'callback_at', 'call_status']);
    const allowed = me.role === 'agent' ? agentFields : new Set([...agentFields, ...adminFields]);
    const update = { updated_at: new Date().toISOString() };
    for (const k of [...allowed]) if (k in (req.body || {})) update[k] = req.body[k];
    // 길이 제한 — DOS 방어 (notes/archived_reason 같은 텍스트 필드)
    if (typeof update.notes === 'string') update.notes = update.notes.slice(0, 2000);
    if (typeof update.archived_reason === 'string') update.archived_reason = update.archived_reason.slice(0, 200);

    if ('assigned_agent_id' in update) {
      if (!isManagerOrAdmin(me)) return res.status(403).json({ error: '재분배는 manager/admin' });
      update.assigned_at = new Date().toISOString();
      update.assigned_by_user_id = req.user.id;
    }

    const { data, error } = await supabase.from('incentive_customer_db').update(update).eq('id', req.params.id).select().single();
    if (error) throw error;

    logAccess({
      user_id: req.user.id, customer_id: req.params.id, action: 'update',
      ip: req.ip, ua: req.get('user-agent'), metadata: { fields: Object.keys(update) },
    });
    res.json({ customer: data });
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

// ═══════════════════════════════════════════════════════════════
// 9. GET /api/customer-db/stats/summary — 통계 요약
// ═══════════════════════════════════════════════════════════════
router.get('/stats/summary', async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(401).json({ error: 'unauthenticated' });

    let baseFilter = (q) => q.is('deleted_at', null);
    if (me.role === 'agent') baseFilter = (q) => q.is('deleted_at', null).eq('assigned_agent_id', me.id);
    else if (me.role === 'manager') {
      const { data: members } = await supabase.from('incentive_agents').select('id').eq('center', me.center).eq('active', true);
      const ids = (members || []).map(x => x.id);
      baseFilter = (q) => q.is('deleted_at', null).in('assigned_agent_id', ids);
    }

    // 상태별 카운트
    const statuses = ['pending', 'contacted', 'callback', 'rejected', 'converted', 'no_answer', 'wrong_number', 'dnt'];
    const result = {};
    for (const s of statuses) {
      const { count } = await baseFilter(supabase.from('incentive_customer_db').select('id', { count: 'exact', head: true }))
        .eq('call_status', s);
      result[s] = count || 0;
    }
    const { count: totalActive } = await baseFilter(supabase.from('incentive_customer_db').select('id', { count: 'exact', head: true }))
      .eq('archived', false);
    const { count: archived } = await baseFilter(supabase.from('incentive_customer_db').select('id', { count: 'exact', head: true }))
      .eq('archived', true);

    // 🆕 그룹별 실적 (head:true count — 1000 row 제한 무관)
    const CONTACT = ['contacted','callback','rejected','converted'];
    const groupPerf = async (col, value) => {
      const baseQ = () => baseFilter(supabase.from('incentive_customer_db').select('id', { count:'exact', head:true })).eq('archived', false).eq(col, value);
      const [t, c, v] = await Promise.all([
        baseQ(),
        baseQ().in('call_status', CONTACT),
        baseQ().eq('call_status', 'converted'),
      ]);
      const total = t.count || 0;
      const contacted = c.count || 0;
      const converted = v.count || 0;
      return {
        total,
        contacted,
        converted,
        contact_rate: total ? +(contacted / total * 100).toFixed(1) : 0,
        conversion_rate: total ? +(converted / total * 100).toFixed(1) : 0,
      };
    };

    const carriers = ['SK','KT','LG'];
    const grades = ['S','A','B','R','C'];
    const categories = ['이동','신규','기변','렌탈권유','기타'];
    const tiers = [1, 2];

    const [byCarrier, byGrade, byCategory, byTier] = await Promise.all([
      Promise.all(carriers.map(async c => [c, await groupPerf('carrier', c)])).then(arr => Object.fromEntries(arr)),
      Promise.all(grades.map(async g => [g, await groupPerf('quality_grade', g)])).then(arr => Object.fromEntries(arr)),
      Promise.all(categories.map(async c => [c, await groupPerf('category', c)])).then(arr => Object.fromEntries(arr)),
      Promise.all(tiers.map(async t => [t, await groupPerf('tier', t)])).then(arr => Object.fromEntries(arr)),
    ]);

    res.json({
      role: me.role,
      total_active: totalActive || 0,
      archived: archived || 0,
      by_status: result,
      by_carrier: byCarrier,
      by_grade: byGrade,
      by_category: byCategory,
      by_tier: byTier,
      contact_rate: result.contacted + result.callback + result.rejected + result.converted > 0
        ? ((result.contacted + result.callback + result.rejected + result.converted) / (totalActive || 1) * 100).toFixed(1) + '%'
        : '0%',
      conversion_rate: result.converted > 0
        ? (result.converted / (totalActive || 1) * 100).toFixed(1) + '%'
        : '0%',
    });
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

// ═══════════════════════════════════════════════════════════════
// 8-1. GET /stats/by-source — DB 출처별 컨버전 비교 (admin)
// ═══════════════════════════════════════════════════════════════
router.get('/stats/by-source', async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isAdmin(me)) return res.status(403).json({ error: 'admin 전용' });
    const { data: sources } = await supabase.from('incentive_db_sources').select('id, name, color').order('id');
    const out = [];
    for (const src of (sources || [])) {
      const base = () => supabase.from('incentive_customer_db').select('id', { count:'exact', head:true })
        .is('deleted_at', null).eq('db_source_id', src.id);
      const [{ count: total }, { count: converted }, { count: rejected }, { count: contacted }, { count: callback }] = await Promise.all([
        base(),
        base().eq('call_status', 'converted'),
        base().eq('call_status', 'rejected'),
        base().eq('call_status', 'contacted'),
        base().eq('call_status', 'callback'),
      ]);
      const t = total || 0;
      out.push({
        ...src,
        total: t,
        converted: converted || 0,
        rejected: rejected || 0,
        contact_count: (contacted||0) + (callback||0) + (rejected||0) + (converted||0),
        contact_rate: t > 0 ? +(((contacted||0) + (callback||0) + (rejected||0) + (converted||0)) / t * 100).toFixed(1) : 0,
        conversion_rate: t > 0 ? +((converted||0) / t * 100).toFixed(1) : 0,
      });
    }
    res.json({ sources: out });
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

// ═══════════════════════════════════════════════════════════════
// 8-2. GET /stats/aging — N일 이상 미연락 (방치된 콜)
// ═══════════════════════════════════════════════════════════════
router.get('/stats/aging', async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(401).json({ error: 'unauthenticated' });
    const days = Math.min(parseInt(req.query.days) || 7, 90);
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    let q = supabase.from('incentive_customer_db').select('id', { count:'exact', head:true })
      .is('deleted_at', null).eq('archived', false).eq('call_status', 'pending').lt('created_at', cutoff);
    if (me.role === 'agent') q = q.eq('assigned_agent_id', me.id);
    else if (me.role === 'manager') {
      const { data: members } = await supabase.from('incentive_agents').select('id').eq('center', me.center).eq('active', true);
      q = q.in('assigned_agent_id', (members || []).map(x => x.id));
    }
    const { count } = await q;
    res.json({ days, count: count || 0, cutoff });
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

// ═══════════════════════════════════════════════════════════════
// 8-3. GET /stats/daily — 일별 import + 처리 건수 (최근 N일, KST 기준)
// ═══════════════════════════════════════════════════════════════
router.get('/stats/daily', async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isAdmin(me)) return res.status(403).json({ error: 'admin 전용' });
    const days = Math.min(Math.max(1, parseInt(req.query.days) || 30), 90);
    // KST(+09:00) 기준 자정 — 한국 운영 시간 정렬용
    const KST_OFFSET_MS = 9 * 3600 * 1000;
    const kstNow = new Date(Date.now() + KST_OFFSET_MS);
    const kstMidnightToday = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate()));
    const startKstMidnight = new Date(kstMidnightToday.getTime() - (days - 1) * 86400000);
    // 실제 UTC start = KST 자정 - 9시간
    const startUtc = new Date(startKstMidnight.getTime() - KST_OFFSET_MS);

    const { data: imported } = await supabase.from('incentive_customer_db')
      .select('imported_at, call_status, last_contacted_at')
      .is('deleted_at', null).gte('imported_at', startUtc.toISOString());

    const toKstDate = (iso) => iso ? new Date(new Date(iso).getTime() + KST_OFFSET_MS).toISOString().slice(0, 10) : null;

    const buckets = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(startKstMidnight.getTime() + i * 86400000);
      const key = d.toISOString().slice(0, 10); // KST 기준 날짜
      buckets[key] = { date: key, imported: 0, called: 0, converted: 0 };
    }
    (imported || []).forEach(r => {
      const k = toKstDate(r.imported_at);
      if (k && buckets[k]) buckets[k].imported++;
      const lk = toKstDate(r.last_contacted_at);
      if (lk && buckets[lk]) buckets[lk].called++;
      if (r.call_status === 'converted' && lk && buckets[lk]) buckets[lk].converted++;
    });
    res.json({ days, buckets: Object.values(buckets), tz: 'Asia/Seoul' });
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

// ═══════════════════════════════════════════════════════════════
// 8-4. GET /export/csv — 콜 DB CSV 내보내기 (admin·manager)
// ═══════════════════════════════════════════════════════════════
router.get('/export/csv', async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me || (me.role !== 'admin' && me.role !== 'manager')) return res.status(403).json({ error: 'admin·manager 전용' });
    let q = supabase.from('incentive_customer_db')
      .select('id, name, phone, age, gender, region, carrier, call_status, call_count, callback_at, last_contacted_at, notes, imported_at, db_source:incentive_db_sources(name), assigned_agent:incentive_agents!incentive_customer_db_assigned_agent_id_fkey(name, center)')
      .is('deleted_at', null);
    if (req.query.archived === 'true') q = q.eq('archived', true);
    else q = q.eq('archived', false);
    if (req.query.status) q = q.eq('call_status', req.query.status);
    if (req.query.db_source_id) q = q.eq('db_source_id', req.query.db_source_id);
    if (me.role === 'manager') {
      const { data: members } = await supabase.from('incentive_agents').select('id').eq('center', me.center).eq('active', true);
      q = q.in('assigned_agent_id', (members || []).map(x => x.id));
    }
    q = q.order('imported_at', { ascending: false }).limit(10000);
    const { data, error } = await q;
    if (error) throw error;
    const headers = ['ID','이름','전화','나이','성별','지역','통신사','상태','콜횟수','콜백','마지막콜','메모','import일','출처','담당상담사','센터'];
    const rows = (data || []).map(r => [
      r.id, r.name||'', r.phone||'', r.age||'', r.gender||'', r.region||'', r.carrier||'', r.call_status||'',
      r.call_count||0, r.callback_at||'', r.last_contacted_at||'', (r.notes||'').replace(/"/g,'""').replace(/[\r\n]+/g,' '),
      r.imported_at?.slice(0,10)||'', r.db_source?.name||'', r.assigned_agent?.name||'', r.assigned_agent?.center||''
    ]);
    const csv = '﻿' + [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n');
    const fname = `customer_db_${new Date().toISOString().slice(0,10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    res.send(csv);
    logAccess({ user_id: req.user.id, action: 'export_csv', ip: req.ip, ua: req.get('user-agent'), metadata: { count: rows.length, filter: req.query } });
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

// ═══════════════════════════════════════════════════════════════
// 8-4-1. GET /stats/cross-tab — 상담사 × 출처 × 상태 pivot 데이터
// ═══════════════════════════════════════════════════════════════
router.get('/stats/cross-tab', async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me || (me.role !== 'admin' && me.role !== 'manager')) return res.status(403).json({ error: 'admin·manager 전용' });
    let q = supabase.from('incentive_customer_db').select(
      'assigned_agent_id, db_source_id, call_status, is_dnt, ' +
      'agent:incentive_agents!incentive_customer_db_assigned_agent_id_fkey(id, name, center, role), ' +
      'db_source:incentive_db_sources(id, name, color)'
    ).is('deleted_at', null).eq('archived', false);
    if (me.role === 'manager') {
      const { data: members } = await supabase.from('incentive_agents').select('id').eq('center', me.center).eq('active', true);
      q = q.in('assigned_agent_id', (members || []).map(x => x.id));
    }
    const { data, error } = await q.limit(50000);
    if (error) throw error;
    res.json({ rows: data || [] });
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

// ═══════════════════════════════════════════════════════════════
// 8-5. POST /recall — DB 회수 (admin·manager)
//   body: { agent_id, status_filter?, days_inactive?, reason } 또는 { customer_ids[], reason }
//   동작: assigned_agent_id·assigned_center 모두 NULL → 미배정 풀 복귀
// ═══════════════════════════════════════════════════════════════
router.post('/recall', async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me || (me.role !== 'admin' && me.role !== 'manager')) return res.status(403).json({ error: 'admin·manager 전용' });
    const { agent_id, customer_ids, status_filter, days_inactive, reason } = req.body || {};
    if (!reason || String(reason).trim().length < 3) return res.status(400).json({ error: '회수 사유 필수 (3자 이상)' });

    let q = supabase.from('incentive_customer_db').update({
      assigned_agent_id: null, assigned_center: null, center_assigned_at: null,
      updated_at: new Date().toISOString(),
    }).is('deleted_at', null).eq('archived', false).neq('call_status', 'converted'); // 전환된 건 회수 X

    if (Array.isArray(customer_ids) && customer_ids.length) {
      // 개별 회수
      if (customer_ids.length > 1000) return res.status(400).json({ error: '한 번에 최대 1000건' });
      q = q.in('id', customer_ids);
      // manager는 본인 센터 콜만
      if (me.role === 'manager') {
        const { data: members } = await supabase.from('incentive_agents').select('id').eq('center', me.center);
        q = q.in('assigned_agent_id', (members || []).map(x => x.id));
      }
    } else if (agent_id) {
      // 상담사 단위 회수
      if (me.role === 'manager') {
        const { data: target } = await supabase.from('incentive_agents').select('center').eq('id', agent_id).single();
        if (!target || target.center !== me.center) return res.status(403).json({ error: '본인 센터 상담사만' });
      }
      q = q.eq('assigned_agent_id', agent_id);
      if (status_filter) q = q.eq('call_status', status_filter);
      if (days_inactive > 0) {
        const cutoff = new Date(Date.now() - parseInt(days_inactive) * 86400000).toISOString();
        // 마지막 통화 N일 이전 또는 한 번도 통화 안 한 콜
        q = q.or(`last_contacted_at.lt.${cutoff},last_contacted_at.is.null`);
      }
    } else {
      return res.status(400).json({ error: 'agent_id 또는 customer_ids 필요' });
    }

    const { data, error } = await q.select('id');
    if (error) throw error;
    const recalled = (data || []).length;

    logAccess({
      user_id: req.user.id, action: 'recall', ip: req.ip, ua: req.get('user-agent'),
      metadata: {
        count: recalled, agent_id, status_filter, days_inactive,
        customer_ids: Array.isArray(customer_ids) ? customer_ids.slice(0, 1000) : null, // 감사 추적용 — 회수된 콜 ID 자체
        reason: String(reason).slice(0, 500),
      },
    });

    res.json({ recalled, message: `${recalled.toLocaleString()}건 풀로 복귀` });
  } catch (e) { console.error('[recall]', e); res.status(500).json({ error: sanitizeErr(e) }); }
});

// ═══════════════════════════════════════════════════════════════
// 9-1. POST /api/customer-db/distribute-to-center — 센터별 일괄 배정 (admin)
//   body: { allocations: [{center, count}], batch_id (선택) }
// ═══════════════════════════════════════════════════════════════
router.post('/distribute-to-center', async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isAdmin(me)) return res.status(403).json({ error: 'admin 전용' });
    const { allocations = [], batch_id } = req.body || {};
    if (!Array.isArray(allocations) || !allocations.length) return res.status(400).json({ error: 'allocations 필수' });

    const results = [];
    for (const { center, count } of allocations) {
      if (!center || !count || count <= 0) continue;
      let q = supabase.from('incentive_customer_db')
        .select('id').is('deleted_at', null).is('assigned_agent_id', null).is('assigned_center', null).eq('archived', false);
      if (batch_id) q = q.eq('imported_batch_id', batch_id);
      q = q.order('priority_score', { ascending: false }).order('imported_at', { ascending: true }).limit(count);
      const { data, error } = await q;
      if (error) throw error;
      if (!data.length) { results.push({ center, count: 0 }); continue; }
      const updates = data.map(r => ({
        id: r.id,
        assigned_center: center,
        center_assigned_at: new Date().toISOString(),
      }));
      const { error: e2 } = await supabase.from('incentive_customer_db').upsert(updates);
      if (e2) throw e2;
      results.push({ center, count: data.length });
    }
    logAccess({
      user_id: req.user.id, action: 'distribute_to_center',
      ip: req.ip, ua: req.get('user-agent'),
      metadata: { allocations: results, batch_id },
    });
    res.json({ ok: true, results });
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

// 9-2. GET /api/customer-db/pool/centers — 센터별 미배정 풀 통계
router.get('/pool/centers', async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isManagerOrAdmin(me)) return res.status(403).json({ error: 'manager/admin 전용' });

    // 미배정 풀 (센터 배정도 X)
    const { count: pool } = await supabase.from('incentive_customer_db')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null).is('assigned_agent_id', null).is('assigned_center', null).eq('archived', false);

    // 센터별 (센터 배정 / 상담사 미배정)
    const { data: centers } = await supabase.from('incentive_agents')
      .select('center').eq('active', true);
    const uniqCenters = [...new Set((centers || []).map(c => c.center))];
    const perCenter = [];
    for (const c of uniqCenters) {
      const { count: pending } = await supabase.from('incentive_customer_db')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null).eq('assigned_center', c).is('assigned_agent_id', null).eq('archived', false);
      const { count: assigned } = await supabase.from('incentive_customer_db')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null).eq('assigned_center', c).not('assigned_agent_id', 'is', null).eq('archived', false);
      perCenter.push({ center: c, pending_assignment: pending || 0, assigned_to_agents: assigned || 0 });
    }
    res.json({ unassigned_pool: pool || 0, centers: perCenter });
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

// ═══════════════════════════════════════════════════════════════
// 10. POST /api/customer-db/auto-refill — 본인 큐 부족 시 자동 보충
// ═══════════════════════════════════════════════════════════════
router.post('/auto-refill', async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(401).json({ error: 'unauthenticated' });
    // 분배 요청 흐름으로 대체됨 — agent의 자기 분배는 매니저 승인 필요
    if (me.role === 'agent') return res.status(403).json({ error: '분배 요청을 통해 매니저 승인을 받으세요' });

    const threshold = parseInt(req.body?.threshold) || 30;
    const refillSize = parseInt(req.body?.refill_size) || 50;

    // 1) 본인 잔여 활성 콜 수 (pending/no_answer/callback)
    const { count: remaining } = await supabase.from('incentive_customer_db')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_agent_id', me.id)
      .in('call_status', ['pending', 'no_answer', 'callback'])
      .eq('archived', false).is('deleted_at', null);

    if ((remaining || 0) >= threshold) {
      return res.json({ ok: true, refilled: 0, current: remaining, message: '잔여 콜 충분' });
    }

    const dailyQuota = me.daily_quota || 200;
    const need = Math.min(refillSize, dailyQuota);

    // 풀 단계별 카운트 (진단용) — agent는 본인 센터에 한정
    const baseUnassigned = supabase.from('incentive_customer_db')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null).is('assigned_agent_id', null).eq('archived', false);
    const { count: centerPoolCount } = me.center
      ? await baseUnassigned.eq('assigned_center', me.center)
      : { count: 0 };
    const { count: globalPoolCount } = await supabase.from('incentive_customer_db')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null).is('assigned_agent_id', null).is('assigned_center', null).eq('archived', false);

    // 본인 센터 풀(매니저 미분배) 우선 → 그 다음 전사 미배정
    let pool = [];
    if (me.center) {
      const { data: cp } = await supabase.from('incentive_customer_db')
        .select('id').is('deleted_at', null).is('assigned_agent_id', null).eq('archived', false)
        .eq('assigned_center', me.center)
        .order('priority_score', { ascending: false })
        .order('imported_at', { ascending: true }).limit(need);
      pool = cp || [];
    }
    if (pool.length < need) {
      const { data: gp } = await supabase.from('incentive_customer_db')
        .select('id').is('deleted_at', null).is('assigned_agent_id', null).is('assigned_center', null).eq('archived', false)
        .order('priority_score', { ascending: false })
        .order('imported_at', { ascending: true }).limit(need - pool.length);
      pool = pool.concat(gp || []);
    }

    if (!pool.length) {
      return res.json({
        ok: true, refilled: 0, current: remaining,
        center_pool: centerPoolCount || 0,
        global_pool: globalPoolCount || 0,
        message: (centerPoolCount || 0) === 0 && (globalPoolCount || 0) === 0
          ? '풀 완전히 비었음 — admin에게 신규 import 요청'
          : (centerPoolCount || 0) === 0
            ? `본인 센터(${me.center}) 풀 비어있음 — admin에게 센터 분배 요청 (전사 미배정 ${globalPoolCount || 0}건)`
            : `manager가 아직 본인에게 분배 안 함 — 본인 센터 풀 ${centerPoolCount || 0}건 대기 중`,
      });
    }

    // 4) 본인에게 분배
    const updates = pool.map(p => ({
      id: p.id,
      assigned_agent_id: me.id,
      assigned_at: new Date().toISOString(),
      assigned_by_user_id: req.user.id,
    }));
    const { error: e2 } = await supabase.from('incentive_customer_db').upsert(updates);
    if (e2) throw e2;

    logAccess({
      user_id: req.user.id, action: 'auto_refill',
      ip: req.ip, ua: req.get('user-agent'),
      metadata: { refilled: pool.length, current_before: remaining },
    });

    res.json({ ok: true, refilled: pool.length, current: (remaining || 0) + pool.length });
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

// ═══════════════════════════════════════════════════════════════
// 11. GET /api/customer-db/pool/stats — 미배정 풀 통계 (admin)
// ═══════════════════════════════════════════════════════════════
router.get('/pool/stats', async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isManagerOrAdmin(me)) return res.status(403).json({ error: 'manager/admin 전용' });

    // 미배정 풀
    const { count: unassigned } = await supabase.from('incentive_customer_db')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null).is('assigned_agent_id', null).eq('archived', false);
    // 분배됨 / 활성
    const { count: assigned } = await supabase.from('incentive_customer_db')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null).not('assigned_agent_id', 'is', null).eq('archived', false);
    // archived
    const { count: archived } = await supabase.from('incentive_customer_db')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null).eq('archived', true);

    // 상담사별 진척 (상태별 카운트)
    const { data: agents } = await supabase.from('incentive_agents').select('id, name, role, center').eq('active', true);
    const perAgent = [];
    for (const a of (agents || [])) {
      if (a.role === 'admin' || a.role === 'contract') continue;
      const baseQ = () => supabase.from('incentive_customer_db')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_agent_id', a.id).is('deleted_at', null);
      const [
        { count: total },
        { count: pending }, { count: callback }, { count: no_answer },
        { count: rejected }, { count: converted }, { count: archived }
      ] = await Promise.all([
        baseQ(),
        baseQ().eq('call_status', 'pending').eq('archived', false),
        baseQ().eq('call_status', 'callback').eq('archived', false),
        baseQ().eq('call_status', 'no_answer').eq('archived', false),
        baseQ().eq('call_status', 'rejected').eq('archived', false),
        baseQ().eq('call_status', 'converted'),
        baseQ().eq('archived', true),
      ]);
      const remaining = (pending || 0) + (callback || 0) + (no_answer || 0);
      const total_attempts = (pending || 0) + (callback || 0) + (no_answer || 0) + (rejected || 0) + (converted || 0);
      const contact_rate = total_attempts > 0
        ? (((callback || 0) + (rejected || 0) + (converted || 0)) / total_attempts * 100).toFixed(1)
        : '0';
      const conversion_rate = total_attempts > 0
        ? ((converted || 0) / total_attempts * 100).toFixed(1)
        : '0';
      perAgent.push({
        id: a.id, name: a.name, role: a.role, center: a.center,
        total: total || 0, remaining,
        pending: pending || 0, callback: callback || 0, no_answer: no_answer || 0,
        rejected: rejected || 0, converted: converted || 0, archived: archived || 0,
        contact_rate, conversion_rate,
      });
    }

    res.json({
      unassigned_pool: unassigned || 0,
      assigned_active: assigned || 0,
      archived: archived || 0,
      per_agent: perAgent,
    });
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

// ═══════════════════════════════════════════════════════════════
// 12. POST /api/customer-db/jobs/retention — 수동 실행 (admin)
//     GET  /api/customer-db/jobs/policy    — 현재 정책 조회
// ═══════════════════════════════════════════════════════════════
router.post('/jobs/retention', async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me || me.role !== 'admin') return res.status(403).json({ error: 'admin 전용' });
    const result = await runRetentionJob();
    logAccess({ user_id: req.user.id, action: 'retention_run', ip: req.ip, ua: req.get('user-agent'), metadata: result });
    res.json(result);
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

router.get('/jobs/policy', (req, res) => res.json({ retention: RETENTION_POLICY, redistribution: REDISTRIBUTION_POLICY }));

router.get('/jobs/last-runs', async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me || me.role !== 'admin') return res.status(403).json({ error: 'admin 전용' });
    const fetchLast = async (action) => {
      const { data } = await supabase.from('incentive_customer_db_access_log')
        .select('created_at, metadata').eq('action', action)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      return data || null;
    };
    const [retention, redistribution] = await Promise.all([
      fetchLast('retention_run'), fetchLast('redistribution_run')
    ]);
    res.json({ retention, redistribution });
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

router.post('/jobs/redistribution', async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me || me.role !== 'admin') return res.status(403).json({ error: 'admin 전용' });
    const result = await runRedistributionJob();
    logAccess({ user_id: req.user.id, action: 'redistribution_run', ip: req.ip, ua: req.get('user-agent'), metadata: result });
    res.json(result);
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

// ═══════════════════════════════════════════════════════════════
// 14. 분배 요청 (agent → manager/admin 승인) — 5개 라우트
// ═══════════════════════════════════════════════════════════════

// POST /requests — agent 요청 생성
router.post('/requests', async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(401).json({ error: 'unauthenticated' });
    if (me.role !== 'agent' && me.role !== 'manager') return res.status(403).json({ error: '상담사·매니저만 요청 가능' });
    const requested_count = Math.min(parseInt(req.body?.requested_count) || 50, 500);
    const reason = (req.body?.reason || '').trim().slice(0, 500);
    if (requested_count < 1) return res.status(400).json({ error: '요청 수량은 1 이상' });
    const { data, error } = await supabase.from('incentive_customer_db_requests')
      .insert({ agent_id: me.id, center: me.center, requested_count, reason, status: 'pending' })
      .select('*').single();
    if (error) {
      // 중복 pending 요청
      if (error.code === '23505') return res.status(409).json({ error: '이미 대기 중인 요청이 있습니다 — 처리 후 다시 요청하세요' });
      throw error;
    }
    logAccess({ user_id: req.user.id, action: 'request_create', ip: req.ip, ua: req.get('user-agent'), metadata: { request_id: data.id, requested_count } });
    res.json({ request: data });
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

// GET /requests — role별 list
router.get('/requests', async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(401).json({ error: 'unauthenticated' });
    let q = supabase.from('incentive_customer_db_requests')
      .select('*, agent:incentive_agents!incentive_customer_db_requests_agent_id_fkey(id,name,role,center), decider:incentive_agents!incentive_customer_db_requests_decided_by_fkey(id,name,role)')
      .order('created_at', { ascending: false }).limit(parseInt(req.query.limit) || 100);
    if (me.role === 'agent') q = q.eq('agent_id', me.id);
    else if (me.role === 'manager') q = q.eq('center', me.center);
    // admin은 전체
    if (req.query.status) q = q.eq('status', req.query.status);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ requests: data || [] });
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

// POST /requests/:id/approve — manager/admin 승인 + 분배 (PostgreSQL function 트랜잭션)
router.post('/requests/:id(\\d+)/approve', async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isManagerOrAdmin(me)) return res.status(403).json({ error: 'manager/admin 전용' });

    const grantCount = Math.min(parseInt(req.body?.grant_count) || 9999, 500);
    const note = (req.body?.note || '').trim().slice(0, 500);

    // PostgreSQL function — SELECT FOR UPDATE + customer 분배 + request 갱신을 한 트랜잭션으로 원자 처리
    const { data, error } = await supabase.rpc('approve_distribution_request', {
      p_request_id: parseInt(req.params.id),
      p_grant_count: grantCount,
      p_approver_id: me.id,
      p_approver_role: me.role,
      p_note: note,
    });
    if (error) throw error;
    if (data?.error) {
      const code = /이미/.test(data.error) ? 409 : /센터/.test(data.error) ? 403 : /없음/.test(data.error) ? 404 : 400;
      return res.status(code).json({ error: data.error });
    }

    // 갱신된 request 다시 조회 (응답용)
    const { data: updated } = await supabase.from('incentive_customer_db_requests')
      .select('*').eq('id', req.params.id).single();

    logAccess({ user_id: req.user.id, action: 'request_approve', ip: req.ip, ua: req.get('user-agent'),
      metadata: { request_id: parseInt(req.params.id), distributed: data?.distributed || 0, target: data?.target || 0 } });
    res.json({ request: updated, distributed: data?.distributed || 0 });
  } catch (e) { console.error('[request approve]', e); res.status(500).json({ error: sanitizeErr(e) }); }
});

// POST /requests/:id/reject — manager/admin 거부
router.post('/requests/:id(\\d+)/reject', async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!isManagerOrAdmin(me)) return res.status(403).json({ error: 'manager/admin 전용' });
    const { data: rq } = await supabase.from('incentive_customer_db_requests')
      .select('*').eq('id', req.params.id).single();
    if (!rq) return res.status(404).json({ error: '요청 없음' });
    if (rq.status !== 'pending') return res.status(409).json({ error: `이미 ${rq.status} 처리됨` });
    if (me.role === 'manager' && rq.center !== me.center)
      return res.status(403).json({ error: '센터 외 요청 처리 불가' });
    const note = (req.body?.note || '').trim().slice(0, 500);
    const { data: updated, error } = await supabase.from('incentive_customer_db_requests')
      .update({ status: 'rejected', decided_by: me.id, decided_at: new Date().toISOString(), decided_note: note, updated_at: new Date().toISOString() })
      .eq('id', req.params.id).select('*').single();
    if (error) throw error;
    logAccess({ user_id: req.user.id, action: 'request_reject', ip: req.ip, ua: req.get('user-agent'), metadata: { request_id: rq.id, note } });
    res.json({ request: updated });
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

// ═══════════════════════════════════════════════════════════════
// 15. 액세스 로그 + IP 화이트리스트 (admin)
// ═══════════════════════════════════════════════════════════════
router.get('/access-logs', async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me || me.role !== 'admin') return res.status(403).json({ error: 'admin 전용' });
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const action = req.query.action;
    const since = req.query.since ? new Date(req.query.since).toISOString() : new Date(Date.now() - 7*86400000).toISOString();
    let q = supabase.from('incentive_customer_db_access_log')
      .select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(limit);
    if (action) q = q.eq('action', action);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ logs: data || [], since, limit });
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

router.get('/ip-whitelist', async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me || me.role !== 'admin') return res.status(403).json({ error: 'admin 전용' });
    const { data } = await supabase.from('incentive_ip_whitelist').select('*').order('created_at', { ascending: false });
    res.json({ rules: data || [] });
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

router.post('/ip-whitelist', async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me || me.role !== 'admin') return res.status(403).json({ error: 'admin 전용' });
    const { cidr, label, scope = 'customer_db', notes } = req.body || {};
    if (!cidr) return res.status(400).json({ error: 'cidr 필수' });
    const { data, error } = await supabase.from('incentive_ip_whitelist')
      .insert({ cidr: String(cidr).trim(), label, scope, notes, created_by: me.id, active: true })
      .select('*').single();
    if (error) throw error;
    invalidateIpAllowlistCache();
    res.json({ rule: data });
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

router.patch('/ip-whitelist/:id(\\d+)', async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me || me.role !== 'admin') return res.status(403).json({ error: 'admin 전용' });
    const update = {};
    if ('active' in req.body) update.active = !!req.body.active;
    if ('label' in req.body) update.label = req.body.label;
    if ('notes' in req.body) update.notes = req.body.notes;
    const { data, error } = await supabase.from('incentive_ip_whitelist').update(update).eq('id', req.params.id).select('*').single();
    if (error) throw error;
    invalidateIpAllowlistCache();
    res.json({ rule: data });
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

router.delete('/ip-whitelist/:id(\\d+)', async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me || me.role !== 'admin') return res.status(403).json({ error: 'admin 전용' });
    await supabase.from('incentive_ip_whitelist').delete().eq('id', req.params.id);
    invalidateIpAllowlistCache();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

// POST /requests/:id/cancel — agent 본인 요청 취소
router.post('/requests/:id(\\d+)/cancel', async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(401).json({ error: 'unauthenticated' });
    const { data: rq } = await supabase.from('incentive_customer_db_requests')
      .select('*').eq('id', req.params.id).single();
    if (!rq) return res.status(404).json({ error: '요청 없음' });
    if (rq.agent_id !== me.id && !isManagerOrAdmin(me))
      return res.status(403).json({ error: '본인 요청만 취소 가능' });
    // manager는 본인 센터 요청만 취소 가능
    if (me.role === 'manager' && rq.center !== me.center)
      return res.status(403).json({ error: '센터 외 요청 취소 불가' });
    if (rq.status !== 'pending') return res.status(409).json({ error: `이미 ${rq.status} 처리됨` });
    const { data: updated, error } = await supabase.from('incentive_customer_db_requests')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', req.params.id).select('*').single();
    if (error) throw error;
    res.json({ request: updated });
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

// ═══════════════════════════════════════════════════════════════
// 13. GET /api/customer-db/stats/timeseries — 시간대별 응답률 (시·요일·일자)
// ═══════════════════════════════════════════════════════════════
router.get('/stats/timeseries', async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(401).json({ error: 'unauthenticated' });
    const days = Math.min(Math.max(1, parseInt(req.query.days) || 30), 90);
    const since = new Date(Date.now() - days * 86400000).toISOString();

    // manager 멤버 미리 로드
    let managerMemberIds = [];
    if (me.role === 'manager') {
      const { data: members } = await supabase.from('incentive_agents').select('id').eq('center', me.center).eq('active', true);
      managerMemberIds = (members || []).map(x => x.id);
      if (!managerMemberIds.length) return res.json({ days, total_calls: 0, by_hour: [], by_dow: [], by_day: [], by_agent: [] });
    }
    // chunk fetch (10000건씩, 최대 20만) — limit 5만 초과 데이터에서도 정확
    const buildBaseQuery = () => {
      let q = supabase.from('incentive_customer_call_log')
        .select('called_at, result, agent_id, agent:incentive_agents(name, center)')
        .gte('called_at', since).order('called_at', { ascending: false });
      if (me.role === 'agent') q = q.eq('agent_id', me.id);
      else if (me.role === 'manager') q = q.in('agent_id', managerMemberIds);
      return q;
    };
    const CHUNK = 10000;
    const HARD_CAP = 200000;
    const logs = [];
    for (let off = 0; off < HARD_CAP; off += CHUNK) {
      const { data, error } = await buildBaseQuery().range(off, off + CHUNK - 1);
      if (error) throw error;
      if (!data?.length) break;
      logs.push(...data);
      if (data.length < CHUNK) break;
    }

    const byHour = {};   // 0~23 시
    const byDow = {};    // 0~6 (일~토)
    const byDay = {};    // YYYY-MM-DD
    const byAgent = {};  // agent_id → { name, center, total, contact, convert }
    const CONTACTED = new Set(['callback','rejected','converted']);

    // KST(+9h) 기준 시·요일·일자 — 서버 환경 타임존 무관
    const kstParts = (iso) => {
      const t = new Date(new Date(iso).getTime() + 9 * 3600_000);
      return { h: t.getUTCHours(), w: t.getUTCDay(), ds: t.toISOString().slice(0,10) };
    };
    for (const l of logs || []) {
      const { h, w, ds } = kstParts(l.called_at);
      byHour[h] = byHour[h] || { total:0, contact:0, convert:0 };
      byDow[w]  = byDow[w]  || { total:0, contact:0, convert:0 };
      byDay[ds] = byDay[ds] || { total:0, contact:0, convert:0 };
      const isContact = CONTACTED.has(l.result);
      const isConvert = l.result === 'converted';
      [byHour[h], byDow[w], byDay[ds]].forEach(b => {
        b.total++; if (isContact) b.contact++; if (isConvert) b.convert++;
      });
      const aid = l.agent_id || 'unknown';
      byAgent[aid] = byAgent[aid] || { name: l.agent?.name || '-', center: l.agent?.center || '-', total:0, contact:0, convert:0 };
      byAgent[aid].total++; if (isContact) byAgent[aid].contact++; if (isConvert) byAgent[aid].convert++;
    }

    const fmt = (b) => ({ ...b, contact_rate: b.total ? +(b.contact/b.total*100).toFixed(1) : 0, conversion_rate: b.total ? +(b.convert/b.total*100).toFixed(1) : 0 });
    const hours = Array.from({length:24}, (_,i) => ({ hour:i, ...fmt(byHour[i] || {total:0,contact:0,convert:0}) }));
    const dows = ['일','월','화','수','목','금','토'].map((label,i) => ({ dow:i, label, ...fmt(byDow[i] || {total:0,contact:0,convert:0}) }));
    const daily = Object.entries(byDay).sort((a,b)=>a[0]<b[0]?-1:1).map(([date,b]) => ({ date, ...fmt(b) }));
    const agents = Object.entries(byAgent).map(([id,b]) => ({ id, ...b, ...fmt(b) }))
      .sort((a,b) => b.convert - a.convert || b.contact - a.contact);

    res.json({ days, total_calls: (logs||[]).length, by_hour: hours, by_dow: dows, by_day: daily, by_agent: agents });
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

// ═══════════════════════════════════════════════════════════════
// 마감원장(closing_ledger) import 헬퍼
// ═══════════════════════════════════════════════════════════════
// 마감원장 import 룰 기본값 — DB(incentive_calculator_overrides.section='import_rules') 없을 때 폴백
const DEFAULT_IMPORT_RULES = {
  watch_prefix: 'L',
  age_min: 19,
  age_max: 100,
  phone_regex: '^01[016789][0-9]{7,8}$',
  // 인터넷·TV 회선 판정 — 단말이 '인+TV' 또는 '인터넷' 정확히 일치할 때만
  internet_types: [],
  internet_models: ['인+TV', '인터넷'],
  internet_model_prefix: '',
  // S/A/B/C = 인터넷 X (1순위 영업: 인터넷·TV 권유)
  // R       = 인터넷 O (2순위 영업: 렌탈 가전 권유)
  grades: {
    S: { tier: 1, category: '이동' },
    A: { tier: 1, category: '신규' },
    B: { tier: 1, category: '기변' },
    R: { tier: 2 },
    default: 'C',
  },
  // S(100)→A(80)→B(60)→R(50)→C(0) 순으로 분배 — 인터넷·TV 1순위, 렌탈 2순위 보장
  base_priority: { '이동': 100, '신규': 80, '기변': 60, '렌탈권유': 50, '기타': 0 },
  age_bonus: [
    { min: 0,  max: 29, bonus: 20 },
    { min: 30, max: 39, bonus: 25 },
    { min: 40, max: 49, bonus: 25 },
    { min: 50, max: 59, bonus: 15 },
    { min: 60, max: 69, bonus: 0 },
    { min: 70, max: 999, bonus: -30 },
  ],
};

async function importClosingLedger({ rows, db_source_id, me, userId, ip, ua }) {
  // 동적 룰 로드 — DB에서 import_rules 가져오기. 없으면 default
  const { data: rulesRow } = await supabase.from('incentive_calculator_overrides')
    .select('data').eq('section', 'import_rules').maybeSingle();
  const R = { ...DEFAULT_IMPORT_RULES, ...(rulesRow?.data || {}) };

  const watchRegex = new RegExp('^' + (R.watch_prefix || 'L'));
  const isWatch = (d) => watchRegex.test(String(d || ''));
  // 인터넷·TV row 판단 — 단말 정확 매칭만 ('인+TV' 또는 '인터넷')
  const isInternetTV = (row) => {
    if (!row || typeof row !== 'object') return false;
    const model = String(row['단말'] || '').trim();
    const type = row['유형'];
    if ((R.internet_types || []).includes(type)) return true;
    if ((R.internet_models || []).includes(model)) return true;
    if (R.internet_model_prefix && model.startsWith(R.internet_model_prefix)) return true;
    return false;
  };
  const phoneRegex = new RegExp(R.phone_regex || '^01[016789][0-9]{7,8}$');
  const excelToDate = (s) => {
    if (typeof s !== 'number' || s < 1) return null;
    const d = new Date((s - 25569) * 86400 * 1000);
    return isNaN(d.getTime()) ? null : d;
  };
  const ageAt = (s, ref) => {
    const d = excelToDate(s); if (!d) return null;
    let a = ref.getFullYear() - d.getFullYear();
    if (ref.getMonth() < d.getMonth() || (ref.getMonth() === d.getMonth() && ref.getDate() < d.getDate())) a--;
    return a;
  };
  const dateISO = (d) => d ? d.toISOString().slice(0, 10) : null;
  const parseActDate = (s) => {
    if (!s) return null;
    const m = String(s).match(/(\d{4})\.\s*(\d+)\.\s*(\d+)/);
    if (!m) return null;
    return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
  };
  const cleanPhone = (p) => String(p || '').replace(/[^0-9]/g, '');
  const intOrNull = (v) => { const n = parseInt(v); return isNaN(n) ? null : n; };
  const REF = new Date();

  // 필터 사유 카운트 (UI에 표시용)
  const filterStats = { watch: 0, age: 0, phone: 0, name: 0, birth: 0 };
  const filtered = rows.filter(r => {
    if (isWatch(r.단말)) { filterStats.watch++; return false; }
    const a = ageAt(r.생년월일, REF);
    if (a === null || a < R.age_min || a >= R.age_max) { filterStats.age++; return false; }
    const ph = cleanPhone(r.전화번호);
    if (!phoneRegex.test(ph)) { filterStats.phone++; return false; }
    if (!String(r.고객명 || '').trim()) { filterStats.name++; return false; }
    if (!r.생년월일) { filterStats.birth++; return false; }
    return true;
  });

  // 통합
  const groups = new Map();
  filtered.forEach(r => {
    const k = String(r.고객명).trim() + '|' + r.생년월일;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  });

  // ═══ 분류 룰 ═══════════════════════════════════════════════
  // 1) tier 결정 — 그룹 안에 인터넷·TV row가 있으면 tier=2, 없으면 tier=1
  //    (인터넷·TV row 판단: isInternetTV — type='유선' or model='인+TV'/'인터넷'/'유선'/'인*')
  //    ※ '유심'은 휴대폰 회선만 변경(USIM 발급)이므로 인터넷·TV 아님 → tier=1
  // 2) category 결정
  //    tier=2 → '렌탈권유' (priority 50)
  //    tier=1:
  //      - '이동' 우선 (priority 100, 통신사 이동 = 결합 깨기 좋음)
  //      - '신규' (priority 80, 신규 가입자 = 인터넷도 신규 자유)
  //      - '기변' (priority 60, 기존 결합 가능성 높음 — R 50보다 우선)
  //      - 그 외 → '기타' (priority 10)
  // 3) 한 사람의 여러 회선 → 우선순위 높은 유형 1개로 통합
  // ═════════════════════════════════════════════════════════════
  // 등급 + 나이 가중치 헬퍼 (settings 기반 동적)
  const calcGrade = (t, c) => {
    const g = R.grades || {};
    for (const [grade, rule] of Object.entries(g)) {
      if (grade === 'default') continue;
      if (typeof rule !== 'object') continue;
      if (rule.tier != null && rule.tier !== t) continue;
      if (rule.category != null && rule.category !== c) continue;
      // grade 키 형식: 'S'·'A_tier1_new'·'A_tier2'·'B' — 첫 글자만 추출
      return grade.charAt(0);
    }
    return typeof g.default === 'string' ? g.default : 'C';
  };
  const calcAgeBonus = (a) => {
    if (a == null) return 0;
    const bands = R.age_bonus || [];
    for (const b of bands) {
      if (a >= (b.min ?? 0) && a <= (b.max ?? 999)) return b.bonus ?? 0;
    }
    return 0;
  };
  const basePri = (cat) => (R.base_priority || {})[cat] ?? 10;

  const customers = [];
  groups.forEach((gRows, key) => {
    const hasInternet = gRows.some(r => isInternetTV(r));
    let tier, category, basePriority;
    if (hasInternet) { tier = 2; category = '렌탈권유'; basePriority = basePri('렌탈권유'); }
    else {
      const types = gRows.map(r => r.유형);
      if (types.includes('이동')) { tier = 1; category = '이동'; basePriority = basePri('이동'); }
      else if (types.includes('신규')) { tier = 1; category = '신규'; basePriority = basePri('신규'); }
      else if (types.includes('기변')) { tier = 1; category = '기변'; basePriority = basePri('기변'); }
      else { tier = 1; category = '기타'; basePriority = basePri('기타'); }
    }
    const sorted = [...gRows].sort((a, b) => {
      const da = parseActDate(a.개통날짜); const db = parseActDate(b.개통날짜);
      return (db || '').localeCompare(da || '');
    });
    const base = sorted[0];
    const mobileBase = sorted.find(r => !isInternetTV(r)) || base;
    const internetRow = sorted.find(r => isInternetTV(r));
    customers.push({
      key, tier, category, basePriority, gRows,
      name: String(base.고객명).trim(),
      phone: cleanPhone(mobileBase.전화번호),
      birth_date: dateISO(excelToDate(base.생년월일)),
      age: ageAt(base.생년월일, REF),
      activation_date: parseActDate(mobileBase.개통날짜),
      subscription_type: mobileBase.유형,
      device_model: mobileBase.단말, device_color: mobileBase.색상,
      device_serial: mobileBase.일련번호 ? String(mobileBase.일련번호) : null,
      plan_name: mobileBase.요금제, addon_services: mobileBase.부가,
      payment_type: mobileBase['현/할'], subsidy_type: mobileBase['공/선'],
      retail_price: intOrNull(mobileBase.출고가),
      public_subsidy: intOrNull(mobileBase.공시지원금),
      extra_subsidy: intOrNull(mobileBase.추가지원금),
      cash_price: intOrNull(mobileBase.현금가),
      installment_principal: intOrNull(mobileBase.할부원금),
      carrier: mobileBase.통신사,
      store: base.매장, store_code: base.코드, dealer: base.판매처, agency_code: mobileBase.대리점,
      memo_etc: gRows.map(r => r.기타).filter(Boolean).join(' | ') || null,
      memo_activation: gRows.map(r => r['개통실 메모']).filter(Boolean).join(' | ') || null,
      internet_info: internetRow ? `${internetRow.단말} (${internetRow.개통날짜})` : null,
      source_data: gRows,
      status: 'available',
      quality_grade: calcGrade(tier, category),
      priority_score: basePriority + calcAgeBonus(ageAt(base.생년월일, REF)),
    });
  });

  // phone 충돌 → 우선순위 1건 active, 나머지 on_hold
  const phoneMap = new Map();
  customers.forEach(c => {
    if (!phoneMap.has(c.phone)) phoneMap.set(c.phone, []);
    phoneMap.get(c.phone).push(c);
  });
  let onHold = 0;
  phoneMap.forEach((custs) => {
    if (custs.length > 1) {
      custs.sort((a, b) => b.priority_score - a.priority_score);
      custs.slice(1).forEach(c => {
        c.status = 'on_hold';
        c.on_hold_reason = `phone 충돌 — ${custs[0].name}(${custs[0].category})에 우선 배정`;
        onHold++;
      });
    }
  });

  // batch + insert
  const batchId = randomUUID();
  await supabase.from('incentive_customer_import_batch').insert({
    id: batchId, db_source_id, imported_by_user_id: userId,
    imported_by_name: me.name, total_count: customers.length, status: 'active',
  });

  const retentionDate = new Date(); retentionDate.setFullYear(retentionDate.getFullYear() + 3);
  const retentionISO = retentionDate.toISOString().slice(0, 10);

  const insertRows = customers.map(c => ({
    imported_batch_id: batchId, db_source_id, imported_by_user_id: userId,
    name: c.name, phone: c.phone, age: c.age,
    birth_date: c.birth_date, activation_date: c.activation_date,
    subscription_type: c.subscription_type, device_model: c.device_model, device_color: c.device_color,
    device_serial: c.device_serial, plan_name: c.plan_name, addon_services: c.addon_services,
    payment_type: c.payment_type, subsidy_type: c.subsidy_type,
    retail_price: c.retail_price, public_subsidy: c.public_subsidy, extra_subsidy: c.extra_subsidy,
    cash_price: c.cash_price, installment_principal: c.installment_principal,
    carrier: c.carrier, store: c.store, store_code: c.store_code, dealer: c.dealer, agency_code: c.agency_code,
    memo_etc: c.memo_etc, memo_activation: c.memo_activation,
    // notes는 상담사 콜 메모 전용 — import 시 자동 박지 않음
    notes: null,
    tier: c.tier, category: c.category, quality_grade: c.quality_grade, priority_score: c.priority_score,
    on_hold_reason: c.on_hold_reason || null,
    call_status: c.status === 'on_hold' ? 'on_hold' : 'pending',
    call_count: 0, consent_status: 'unknown', data_retention_until: retentionISO,
    source_data: c.source_data, archived: false,
  }));

  // 1) cross-source phone 중복 사전 검사 — 출처 다른데 같은 phone이면 dup으로 처리
  //    (UNIQUE(db_source_id, phone)는 같은 출처 안에서만 작동 → 출처 넘는 중복 못 잡음)
  const phoneList = insertRows.map(r => r.phone);
  const existingPhonesSet = new Set();
  // 1000개씩 청크로 IN 조회 (PG 인자 제한 대응)
  for (let i = 0; i < phoneList.length; i += 1000) {
    const slice = phoneList.slice(i, i + 1000);
    const { data: existing } = await supabase.from('incentive_customer_db')
      .select('phone').in('phone', slice).is('deleted_at', null);
    (existing || []).forEach(r => existingPhonesSet.add(r.phone));
  }
  // 신규 row만 분리, 기존 phone은 dup 카운트
  const newRows = insertRows.filter(r => !existingPhonesSet.has(r.phone));
  const crossSourceDups = insertRows.length - newRows.length;

  // 2) UPSERT chunk 200 — Railway timeout 안전 + 매 chunk 후 batch 통계 즉시 update
  let inserted = 0, dups = crossSourceDups, failed = 0;
  const CHUNK = 200;
  for (let i = 0; i < newRows.length; i += CHUNK) {
    const chunk = newRows.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from('incentive_customer_db')
      .upsert(chunk, { onConflict: 'db_source_id,phone', ignoreDuplicates: true })
      .select('id');
    if (error) {
      console.error('[import upsert chunk fail]', error.code, error.message);
      for (const row of chunk) {
        const { error: e1 } = await supabase.from('incentive_customer_db').insert(row);
        if (e1 && e1.code === '23505') dups++;
        else if (!e1) inserted++;
        else failed++;
      }
    } else {
      inserted += (data || []).length;
      dups += chunk.length - (data || []).length;
    }
    // 매 chunk 즉시 batch 통계 update — timeout 끊겨도 부분 통계 보존
    await supabase.from('incentive_customer_import_batch').update({
      valid_count: inserted, invalid_count: failed, duplicate_count: dups,
    }).eq('id', batchId);
  }

  logAccess({
    user_id: userId, action: 'import_closing_ledger', ip, ua,
    metadata: { batch_id: batchId, db_source_id, total: rows.length, customers: customers.length, inserted, dups, on_hold: onHold, failed },
  });

  return {
    batch_id: batchId, mode: 'closing_ledger',
    excel_rows: rows.length, filtered: filtered.length, customers: customers.length,
    inserted, duplicates: dups, on_hold: onHold, failed,
    tier_dist: {
      1: customers.filter(c => c.tier === 1).length,
      2: customers.filter(c => c.tier === 2).length,
    },
    category_dist: customers.reduce((m, c) => { m[c.category] = (m[c.category] || 0) + 1; return m; }, {}),
    grade_dist: customers.reduce((m, c) => { m[c.quality_grade] = (m[c.quality_grade] || 0) + 1; return m; }, {}),
    filter_stats: filterStats,
    rules_applied: R,
  };
}

// ═══════════════════════════════════════════════════════════════
// 큐콜 v2 — 모드별 다음 콜 / 해피콜 / 인터넷 청취
// ═══════════════════════════════════════════════════════════════

const QUEUE_MODES = ['happycall', 'upsell_tier1', 'upsell_tier2', 'callback', 'cs', 'pending'];

function buildQueueQuery(mode, me) {
  let q = supabase.from('incentive_customer_db').select(
    '*, db_source:incentive_db_sources(name, color), assigned_agent:incentive_agents!incentive_customer_db_assigned_agent_id_fkey(id, name, center)'
  )
    .is('deleted_at', null).eq('archived', false)
    .or('is_dnt.is.null,is_dnt.eq.false')
    .not('call_status', 'in', '("on_hold","converted","dnt")');

  // 권한 필터
  if (me.role === 'agent') q = q.eq('assigned_agent_id', me.id);
  // manager는 라우트에서 in() 필터 추가

  // 모드별 필터
  const today = new Date();
  const day7 = new Date(today.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const day14 = new Date(today.getTime() - 14 * 86400000).toISOString().slice(0, 10);
  const day30 = new Date(today.getTime() - 30 * 86400000).toISOString();
  const nowISO = today.toISOString();

  switch (mode) {
    case 'happycall':
      q = q.eq('tier', 1).is('last_happycall_at', null).lte('activation_date', day7).gte('activation_date', day14);
      break;
    case 'upsell_tier1':
      q = q.eq('tier', 1).or(`latest_satisfaction_avg.gte.4,last_happycall_at.lt.${day30}`);
      break;
    case 'upsell_tier2':
      q = q.eq('tier', 2).gte('latest_satisfaction_avg', 4);
      break;
    case 'callback':
      q = q.lte('callback_at', nowISO).not('callback_at', 'is', null);
      break;
    case 'cs':
      q = q.eq('cs_escalated', true);
      break;
    case 'pending':
    default:
      q = q.eq('call_status', 'pending');
  }
  return q;
}

// 1) 큐 카운트 (모드별 카드용)
router.get('/queue/stats', async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(401).json({ error: 'unauthenticated' });

    let memberIds = null;
    if (me.role === 'manager') {
      const { data: ms } = await supabase.from('incentive_agents').select('id').eq('center', me.center);
      memberIds = (ms || []).map(m => m.id);
    }

    const counts = {};
    for (const mode of QUEUE_MODES) {
      let q = buildQueueQuery(mode, me);
      if (me.role === 'manager') q = q.in('assigned_agent_id', memberIds.length ? memberIds : ['00000000-0000-0000-0000-000000000000']);
      const { count } = await q.select('id', { count: 'exact', head: true });
      counts[mode] = count || 0;
    }
    res.json({ counts });
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

// 2) 다음 콜 가져오기 (atomic claim)
router.get('/queue/next', async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(401).json({ error: 'unauthenticated' });

    const mode = String(req.query.mode || 'pending');
    if (!QUEUE_MODES.includes(mode)) return res.status(400).json({ error: 'invalid mode' });

    let q = buildQueueQuery(mode, me);
    if (me.role === 'manager') {
      const { data: ms } = await supabase.from('incentive_agents').select('id').eq('center', me.center);
      const ids = (ms || []).map(m => m.id);
      q = q.in('assigned_agent_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
    }
    // 정렬: priority_score DESC, callback 우선시 callback_at ASC, 그 외 activation_date ASC
    if (mode === 'callback') q = q.order('callback_at', { ascending: true });
    else q = q.order('priority_score', { ascending: false, nullsFirst: false }).order('activation_date', { ascending: true, nullsFirst: false });
    q = q.limit(1);

    const { data, error } = await q;
    if (error) throw error;
    if (!data?.length) return res.json({ customer: null, mode });

    const cust = data[0];

    // 휴대폰 통신사와 무관하게, 청취된 인터넷 통신사 기반 권유 옵션 산출
    let recommendedCarriers = ['SK', 'KT', 'LG'];
    if (cust.current_internet_status === 'subscribed' && cust.current_internet_carrier) {
      recommendedCarriers = recommendedCarriers.filter(c => c !== cust.current_internet_carrier);
    }
    const needInternetListening = !cust.current_internet_status || cust.current_internet_status === 'unknown';

    res.json({
      customer: cust,
      mode,
      recommended_internet_carriers: recommendedCarriers,
      need_internet_listening: needInternetListening,
    });
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

// 3) 인터넷 청취 결과 저장
router.patch('/:id(\\d+)/internet-listening', async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(401).json({ error: 'unauthenticated' });

    const { status, carrier, signup_year } = req.body || {};
    if (!['subscribed', 'none', 'unknown'].includes(status)) {
      return res.status(400).json({ error: 'invalid status' });
    }
    if (status === 'subscribed' && !['SK', 'KT', 'LG'].includes(carrier)) {
      return res.status(400).json({ error: 'subscribed면 carrier 필수' });
    }

    const { data: target } = await supabase.from('incentive_customer_db')
      .select('id, assigned_agent_id').eq('id', req.params.id).is('deleted_at', null).single();
    if (!target) return res.status(404).json({ error: 'not found' });
    if (me.role === 'agent' && target.assigned_agent_id !== me.id) return res.status(403).json({ error: 'forbidden' });

    const update = {
      current_internet_status: status,
      current_internet_carrier: status === 'subscribed' ? carrier : null,
      current_internet_signup_year: status === 'subscribed' && signup_year ? parseInt(signup_year) : null,
      current_internet_listened_at: new Date().toISOString(),
      current_internet_listened_by_agent_id: me.id,
    };
    const { error } = await supabase.from('incentive_customer_db').update(update).eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true, ...update });
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

// 4) 해피콜 만족도 응답 저장 + customer_db derived 갱신 + 자동 라우팅
router.post('/:id(\\d+)/happycall-survey', async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(401).json({ error: 'unauthenticated' });

    const customerId = parseInt(req.params.id);
    const {
      call_log_id,
      device_satisfaction, plan_satisfaction, signal_quality, store_satisfaction,
      nps_score, free_comment, upsell_interest, next_action, cs_escalation_reason,
    } = req.body || {};

    const clamp15 = v => v == null ? null : Math.max(1, Math.min(5, parseInt(v)));
    const clampNps = v => v == null ? null : Math.max(0, Math.min(10, parseInt(v)));
    const validActions = ['callback','proposal','no_interest','converted','cs_escalation','completed'];

    const survey = {
      customer_id: customerId,
      call_log_id: call_log_id || null,
      surveyed_by_agent_id: me.id,
      device_satisfaction: clamp15(device_satisfaction),
      plan_satisfaction: clamp15(plan_satisfaction),
      signal_quality: clamp15(signal_quality),
      store_satisfaction: clamp15(store_satisfaction),
      nps_score: clampNps(nps_score),
      free_comment: free_comment || null,
      upsell_interest: upsell_interest || {},
      next_action: validActions.includes(next_action) ? next_action : null,
      cs_escalation_reason: cs_escalation_reason || null,
    };

    const { data: ins, error } = await supabase
      .from('incentive_customer_happycall_survey').insert(survey).select('*').single();
    if (error) throw error;

    // derived 필드 갱신
    const scores = [survey.device_satisfaction, survey.plan_satisfaction, survey.signal_quality, survey.store_satisfaction].filter(v => v != null);
    const avg = scores.length ? scores.reduce((a,b)=>a+b,0) / scores.length : null;
    const isCs = next_action === 'cs_escalation' || (avg != null && avg <= 2.5);

    const update = {
      latest_satisfaction_avg: avg,
      latest_nps: survey.nps_score,
      last_happycall_at: new Date().toISOString(),
      upsell_interest_summary: survey.upsell_interest,
      cs_escalated: isCs ? true : undefined,
    };
    if (next_action === 'converted') update.call_status = 'converted';

    Object.keys(update).forEach(k => update[k] === undefined && delete update[k]);
    await supabase.from('incentive_customer_db').update(update).eq('id', customerId);

    logAccess({
      user_id: req.user.id, action: 'happycall_survey', ip: req.ip, ua: req.get('user-agent'),
      metadata: { customer_id: customerId, avg, nps: survey.nps_score, next_action },
    });

    res.json({ survey: ins, derived: update });
  } catch (e) { console.error('[happycall-survey]', e); res.status(500).json({ error: sanitizeErr(e) }); }
});

// 5-1) 해피콜·업셀링 대시보드 stats
router.get('/queue/dashboard', async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(401).json({ error: 'unauthenticated' });

    let memberIds = null;
    if (me.role === 'manager') {
      const { data: ms } = await supabase.from('incentive_agents').select('id').eq('center', me.center);
      memberIds = (ms || []).map(m => m.id);
    }
    const filterAgent = (q) => {
      if (me.role === 'agent') return q.eq('assigned_agent_id', me.id);
      if (me.role === 'manager') return q.in('assigned_agent_id', memberIds.length ? memberIds : ['00000000-0000-0000-0000-000000000000']);
      return q;
    };

    // tier·category 분포
    let q1 = filterAgent(supabase.from('incentive_customer_db').select('tier, category, store, call_status, latest_satisfaction_avg, latest_nps, last_happycall_at, cs_escalated, current_internet_status, current_internet_carrier').is('deleted_at', null).eq('archived', false));
    const { data: rows = [] } = await q1.limit(20000);

    const byTier = {1:0, 2:0, null:0};
    const byCategory = {};
    const byStore = {};
    let happycallDone = 0, satSum = 0, satN = 0, npsSum = 0, npsN = 0, csCount = 0, internetListened = 0;
    const carrierDist = { SK:0, KT:0, LG:0, none:0, unknown:0 };
    rows.forEach(r => {
      byTier[r.tier ?? 'null'] = (byTier[r.tier ?? 'null'] || 0) + 1;
      byCategory[r.category || '미분류'] = (byCategory[r.category || '미분류'] || 0) + 1;
      byStore[r.store || '미상'] = (byStore[r.store || '미상'] || 0) + 1;
      if (r.last_happycall_at) happycallDone++;
      if (r.latest_satisfaction_avg != null) { satSum += +r.latest_satisfaction_avg; satN++; }
      if (r.latest_nps != null) { npsSum += +r.latest_nps; npsN++; }
      if (r.cs_escalated) csCount++;
      if (r.current_internet_status) {
        internetListened++;
        if (r.current_internet_status === 'subscribed' && r.current_internet_carrier) {
          carrierDist[r.current_internet_carrier] = (carrierDist[r.current_internet_carrier] || 0) + 1;
        } else if (r.current_internet_status === 'none') carrierDist.none++;
        else carrierDist.unknown++;
      }
    });

    // 24h 응답 + 다음액션 분포
    const since24 = new Date(Date.now() - 86400000).toISOString();
    let q2 = supabase.from('incentive_customer_happycall_survey').select('next_action, surveyed_at, surveyed_by_agent_id').gte('surveyed_at', since24);
    if (me.role === 'agent') q2 = q2.eq('surveyed_by_agent_id', me.id);
    if (me.role === 'manager' && memberIds) q2 = q2.in('surveyed_by_agent_id', memberIds.length ? memberIds : ['00000000-0000-0000-0000-000000000000']);
    const { data: surveys24 = [] } = await q2;
    const nextActionDist = {};
    surveys24.forEach(s => { if (s.next_action) nextActionDist[s.next_action] = (nextActionDist[s.next_action] || 0) + 1; });

    // 업셀링 전환율 (전환 / 응답)
    let convertedCount = 0;
    let q3 = supabase.from('incentive_customer_happycall_survey').select('next_action');
    if (me.role === 'agent') q3 = q3.eq('surveyed_by_agent_id', me.id);
    if (me.role === 'manager' && memberIds) q3 = q3.in('surveyed_by_agent_id', memberIds.length ? memberIds : ['00000000-0000-0000-0000-000000000000']);
    const { data: allSurveys = [] } = await q3.limit(50000);
    convertedCount = allSurveys.filter(s => s.next_action === 'converted').length;
    const totalSurveys = allSurveys.length;

    res.json({
      tier_dist: byTier,
      category_dist: byCategory,
      store_dist: byStore,
      total: rows.length,
      happycall: {
        done: happycallDone,
        rate: rows.length ? +(happycallDone / rows.length * 100).toFixed(1) : 0,
        avg_satisfaction: satN ? +(satSum / satN).toFixed(2) : null,
        avg_nps: npsN ? +(npsSum / npsN).toFixed(1) : null,
        cs_escalated: csCount,
        last_24h_responses: surveys24.length,
        next_action_dist_24h: nextActionDist,
        total_surveys: totalSurveys,
        upsell_conversion_rate: totalSurveys ? +(convertedCount / totalSurveys * 100).toFixed(1) : 0,
        upsell_converted: convertedCount,
      },
      internet: {
        listened: internetListened,
        listened_rate: rows.length ? +(internetListened / rows.length * 100).toFixed(1) : 0,
        carrier_dist: carrierDist,
      },
    });
  } catch (e) { console.error('[queue/dashboard]', e); res.status(500).json({ error: sanitizeErr(e) }); }
});

// 5) 해피콜 응답 이력 조회
router.get('/:id(\\d+)/happycall-history', async (req, res) => {
  try {
    const me = await getCurrentIncentiveAgent(req.user.id);
    if (!me) return res.status(401).json({ error: 'unauthenticated' });

    const { data, error } = await supabase
      .from('incentive_customer_happycall_survey')
      .select('*, agent:incentive_agents!incentive_customer_happycall_survey_surveyed_by_agent_id_fkey(id, name)')
      .eq('customer_id', req.params.id)
      .order('surveyed_at', { ascending: false }).limit(20);
    if (error) throw error;
    res.json({ surveys: data || [] });
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

export default router;
