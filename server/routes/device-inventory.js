// ═══════════════════════════════════════════════════════════════
// 휴대폰 재고관리 — 서버 라우트 (STEP 1: 모델 마스터 + 입고/스캔)
// mount: /api/devices  (incentive.js의 /api/incentive 와 충돌 회피)
// 텔킷 방식: 박스 바코드 스캔 → SKU 매핑 → 모델·일련번호·IMEI 자동 등록
// ═══════════════════════════════════════════════════════════════
import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { authenticateJWT } from '../middleware/auth.js';
import { stores } from '../data/stores.js';

const router = Router();
const _isProd = process.env.NODE_ENV === 'production';
const sanitizeErr = (e) => _isProd ? '서버 오류 — 잠시 후 다시 시도하세요' : (e?.message || '서버 오류');

// ─── 현재 incentive_agent 조회 (60초 캐시) ───
const _agentCache = new Map();
async function getAgent(userId) {
  if (!userId) return null;
  const c = _agentCache.get(userId);
  if (c && c.exp > Date.now()) return c.data;
  const { data } = await supabase.from('incentive_agents').select('*').eq('user_id', userId).single();
  const result = (data && data.active) ? data : null;
  if (_agentCache.size >= 500) _agentCache.delete(_agentCache.keys().next().value);
  _agentCache.set(userId, { data: result, exp: Date.now() + (result ? 60_000 : 5_000) });
  return result;
}

// ─── 바코드 분류 (텔킷 핵심) ───
// 스캐너는 키보드처럼 문자열을 입력 → 정규식으로 어떤 바코드인지 판별
function luhnValid(s) {
  if (!/^\d+$/.test(s)) return false;
  let sum = 0, alt = false;
  for (let i = s.length - 1; i >= 0; i--) {
    let n = +s[i];
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n; alt = !alt;
  }
  return sum % 10 === 0;
}
function classifyCode(raw) {
  const code = String(raw || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!code) return { type: 'unknown', value: code };
  // 제조사 모델코드 (SM-S936NDBAKOC)
  if (/^SM-[A-Z0-9]{3,}$/.test(code)) return { type: 'model_code', value: code };
  // EID (eSIM 식별자, 32자리 숫자)
  if (/^\d{32}$/.test(code)) return { type: 'eid', value: code };
  // IMEI (15자리 숫자, Luhn) — 재고엔 불필요하므로 무시 대상
  if (/^\d{15}$/.test(code)) return { type: 'imei', value: code, luhn: luhnValid(code) };
  // EAN/SKU 박스 바코드 (12~14자리 숫자)
  if (/^\d{12,14}$/.test(code)) return { type: 'sku', value: code };
  // 일련번호 — 위 패턴(SKU·IMEI·EID) 제외한 영숫자 (순수 숫자 일련번호도 허용)
  if (/^[A-Z0-9][A-Z0-9-]{2,}$/.test(code)) return { type: 'serial', value: code };
  return { type: 'unknown', value: code };
}

// 일련번호 = 정확히 7자리 숫자. 숫자만 추출 후 길이 검증 (자동 자르기 X — 7자리 아니면 거부)
function normalizeSerial(raw) {
  if (raw == null) return null;
  const d = String(raw).replace(/\D/g, '');
  return d || null;
}
const SERIAL_RE = /^\d{7}$/;

// ════════════════════ 매장 목록 ════════════════════
router.get('/stores', authenticateJWT, async (req, res) => {
  res.json({ stores: stores.map(s => ({ id: s.id, name: s.name })) });
});

// 입고처 자동완성 (기존 입력값 distinct)
router.get('/supply-sources', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.json({ sources: [] });
    const { data } = await supabase.from('device_inventory').select('supply_source').not('supply_source', 'is', null).limit(1000);
    const set = [...new Set((data || []).map(r => r.supply_source).filter(Boolean))].sort();
    res.json({ sources: set });
  } catch (e) { res.json({ sources: [] }); }
});

// ════════════════════ 모델 마스터 ════════════════════
// 목록 / 검색
router.get('/models', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const { q, active } = req.query;
    let query = supabase.from('device_models').select('*').order('updated_at', { ascending: false });
    if (active === 'true') query = query.eq('is_active', true);
    if (q) query = query.or(`model_name.ilike.%${q}%,model_code.ilike.%${q}%,sku.ilike.%${q}%`);
    const { data, error } = await query.limit(500);
    if (error) throw error;
    res.json({ models: data });
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

// SKU / 모델코드로 lookup (스캔 자동입력용)
router.get('/models/lookup', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const { sku, code } = req.query;
    if (!sku && !code) return res.status(400).json({ error: 'sku 또는 code 필요' });
    let query = supabase.from('device_models').select('*');
    query = sku ? query.eq('sku', String(sku).trim()) : query.eq('model_code', String(code).trim().toUpperCase());
    const { data, error } = await query.limit(1).maybeSingle();
    if (error) throw error;
    res.json({ model: data || null });
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

// 모델 등록/수정 (신규 SKU 첫 스캔 시 1회)
router.post('/models', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getAgent(req.user.id);
    if (!me) return res.status(403).json({ error: 'incentive_agent 미등록' });
    const { id, sku, model_code, model_name, manufacturer, color, capacity, release_price, image_url } = req.body || {};
    if (!model_name) return res.status(400).json({ error: 'model_name 필수' });
    const row = {
      sku: sku ? String(sku).trim() : null,
      model_code: model_code ? String(model_code).trim().toUpperCase() : null,
      model_name: String(model_name).trim(),
      manufacturer: manufacturer || '삼성',
      color: color || null,
      capacity: capacity || null,
      release_price: release_price ? parseInt(release_price) : null,
      image_url: image_url || null,
    };
    let data, error;
    if (id) {
      ({ data, error } = await supabase.from('device_models').update(row).eq('id', id).select().single());
    } else if (row.sku) {
      // SKU 기준 upsert (중복 스캔 안전)
      ({ data, error } = await supabase.from('device_models').upsert(row, { onConflict: 'sku' }).select().single());
    } else {
      ({ data, error } = await supabase.from('device_models').insert(row).select().single());
    }
    if (error) throw error;
    res.json({ model: data });
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

// ════════════════════ 스캔 분류 ════════════════════
// 스캔된 코드 1개 → 타입 판별 + (sku/code면) 모델 매칭 + (imei/serial이면) 기존 재고 중복 확인
router.post('/scan', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const cls = classifyCode((req.body || {}).code);
    const out = { ...cls };
    if (cls.type === 'sku' || cls.type === 'model_code') {
      const col = cls.type === 'sku' ? 'sku' : 'model_code';
      const { data } = await supabase.from('device_models').select('*').eq(col, cls.value).limit(1).maybeSingle();
      out.model = data || null;
    } else if (cls.type === 'serial') {
      // 일련번호는 통신사 다르면 중복 가능 → 여러 건일 수 있어 limit으로
      const { data } = await supabase.from('device_inventory')
        .select('id,status,carrier,store_id,model:device_models(model_name,color,capacity)')
        .eq('serial_number', cls.value).limit(5);
      out.existing = (data && data.length) ? data[0] : null;
      out.existingAll = data || [];
    }
    res.json(out);
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

// ════════════════════ 재고 입고 ════════════════════
async function logInventory(entry) {
  try { await supabase.from('device_inventory_log').insert(entry); } catch (_) {}
}

// 단건 입고 (스캔 또는 수기)
router.post('/inventory', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getAgent(req.user.id);
    if (!me) return res.status(403).json({ error: 'incentive_agent 미등록' });
    const b = req.body || {};
    let modelId = b.model_id;

    // 모델 미지정 + 모델 정보 동봉 시 자동 생성/매칭
    if (!modelId && b.model) {
      const m = b.model;
      if (!m.model_name) return res.status(400).json({ error: '모델 정보(model_name) 필요' });
      const mrow = {
        sku: m.sku ? String(m.sku).trim() : null,
        model_code: m.model_code ? String(m.model_code).trim().toUpperCase() : null,
        model_name: String(m.model_name).trim(),
        manufacturer: m.manufacturer || '삼성',
        color: m.color || null, capacity: m.capacity || null,
      };
      const { data: mdata, error: merr } = mrow.sku
        ? await supabase.from('device_models').upsert(mrow, { onConflict: 'sku' }).select().single()
        : await supabase.from('device_models').insert(mrow).select().single();
      if (merr) throw merr;
      modelId = mdata.id;
    }
    if (!modelId) return res.status(400).json({ error: 'model_id 필수' });

    const store_id = parseInt(b.store_id);
    if (!store_id || !stores.find(s => s.id === store_id)) return res.status(400).json({ error: '유효한 store_id 필요' });

    const serial = normalizeSerial(b.serial_number);
    if (!serial) return res.status(400).json({ error: '일련번호는 필수입니다' });
    if (!SERIAL_RE.test(serial)) return res.status(400).json({ error: `일련번호는 7자리 숫자여야 합니다 (입력: ${serial}, ${serial.length}자리)` });
    const carrier = b.carrier ? String(b.carrier).trim() : null;
    if (!carrier) return res.status(400).json({ error: '통신사를 선택하세요' });

    // 중복 확인 (일련번호+통신사 복합 — 통신사 다르면 같은 일련번호 허용)
    {
      const { data: dup } = await supabase.from('device_inventory')
        .select('id,serial_number,carrier,status').eq('serial_number', serial).eq('carrier', carrier).limit(1).maybeSingle();
      if (dup) return res.status(409).json({ error: `이미 등록된 단말입니다 (${carrier} ${serial})`, duplicate: dup });
    }

    const row = {
      model_id: modelId,
      serial_number: serial,
      carrier,
      supply_source: b.supply_source ? String(b.supply_source).trim() : null,
      imei1: b.imei1 ? String(b.imei1).trim() : null,
      imei2: b.imei2 ? String(b.imei2).trim() : null,
      eid: b.eid ? String(b.eid).trim() : null,
      store_id,
      status: 'in_stock',
      manufacture_ym: b.manufacture_ym || null,
      cost_price: b.cost_price ? parseInt(b.cost_price) : null,
      entry_method: ['scan', 'manual', 'bulk'].includes(b.entry_method) ? b.entry_method : 'manual',
      received_by: req.user.id,
      received_by_name: me.name || req.user.displayName || null,
      notes: b.notes || null,
    };
    const { data, error } = await supabase.from('device_inventory').insert(row).select('*, model:device_models(*)').single();
    if (error) throw error;
    logInventory({ inventory_id: data.id, action: 'receive', to_store_id: store_id, to_status: 'in_stock', actor_user_id: req.user.id, actor_name: row.received_by_name, snapshot: data });
    res.json({ unit: data });
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

// 벌크 입고 (여러 단말 한 번에)
router.post('/inventory/bulk', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const me = await getAgent(req.user.id);
    if (!me) return res.status(403).json({ error: 'incentive_agent 미등록' });
    const items = Array.isArray((req.body || {}).items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ error: 'items 배열 필요' });
    const results = { ok: [], failed: [] };
    for (const b of items) {
      try {
        const store_id = parseInt(b.store_id);
        const serial = normalizeSerial(b.serial_number);
        const carrier = b.carrier ? String(b.carrier).trim() : null;
        if (!b.model_id || !store_id || !serial || !carrier) { results.failed.push({ item: b, error: '필수값 누락(모델·매장·통신사·일련번호)' }); continue; }
        if (!SERIAL_RE.test(serial)) { results.failed.push({ item: b, error: '일련번호 7자리 아님' }); continue; }
        const { data: dup } = await supabase.from('device_inventory').select('id').eq('serial_number', serial).eq('carrier', carrier).limit(1).maybeSingle();
        if (dup) { results.failed.push({ item: b, error: '중복' }); continue; }
        const { data, error } = await supabase.from('device_inventory').insert({
          model_id: b.model_id, serial_number: serial, carrier, supply_source: b.supply_source || null,
          store_id, status: 'in_stock', manufacture_ym: b.manufacture_ym || null,
          entry_method: 'bulk', received_by: req.user.id, received_by_name: me.name || null,
        }).select('id,serial_number').single();
        if (error) { results.failed.push({ item: b, error: error.message }); continue; }
        logInventory({ inventory_id: data.id, action: 'receive', to_store_id: store_id, to_status: 'in_stock', actor_user_id: req.user.id, actor_name: me.name });
        results.ok.push(data);
      } catch (err) { results.failed.push({ item: b, error: err.message }); }
    }
    res.json(results);
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

// ════════════════════ 재고 목록 (입고 직후 확인용 기본 조회) ════════════════════
router.get('/inventory', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const { store_id, status, model_id, q, limit } = req.query;
    let query = supabase.from('device_inventory')
      .select('*, model:device_models(model_name,model_code,color,capacity,carrier)')
      .order('received_at', { ascending: false });
    if (store_id) query = query.eq('store_id', parseInt(store_id));
    if (status) query = query.eq('status', status);
    if (model_id) query = query.eq('model_id', parseInt(model_id));
    if (q) {
      const t = String(q).trim().toUpperCase();
      query = query.or(`serial_number.ilike.%${t}%,imei1.ilike.%${t}%,imei2.ilike.%${t}%`);
    }
    const { data, error } = await query.limit(Math.min(parseInt(limit) || 200, 1000));
    if (error) throw error;
    const storeMap = Object.fromEntries(stores.map(s => [s.id, s.name]));
    res.json({ units: data.map(u => ({ ...u, store_name: storeMap[u.store_id] || `매장${u.store_id}` })) });
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

// 간단 통계 (상태별 카운트)
router.get('/inventory/stats', authenticateJWT, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
    const { data, error } = await supabase.from('device_inventory').select('status, store_id');
    if (error) throw error;
    const byStatus = {}, byStore = {};
    for (const r of data) {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      byStore[r.store_id] = (byStore[r.store_id] || 0) + 1;
    }
    res.json({ total: data.length, byStatus, byStore });
  } catch (e) { res.status(500).json({ error: sanitizeErr(e) }); }
});

export default router;
