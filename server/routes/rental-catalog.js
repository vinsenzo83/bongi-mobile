/**
 * /api/rental-catalog — 렌탈 상품 카탈로그 v2
 *
 * 관리자(admin)
 *   POST  /import/preview            엑셀 업로드 → 시트 검증 + 지난 적재 대비 신규/변경/단종 미리보기
 *   POST  /import/:batchId/commit    미리보기 확정
 *   GET   /batches
 *   GET   /suppliers
 *   GET   /models                    검색·필터·페이지 (요약 뷰)
 *   GET   /models/:id                모델 + 전체 조건(리베이트 포함)
 *   PATCH /models/:id                카테고리·이름·이미지·상태·플랫폼 연동 표시
 *   PATCH /offers/:id                가이드·MAX·상태·노출·메모·적용기간
 *   POST  /offers/bulk-payout        필터된 조건에 가이드·MAX 일괄(고정액 또는 리베이트 기준식), dry_run 지원
 *   POST  /offers/apply-margin       마진율 규칙으로 가이드·MAX 일괄 (DB 함수, 전체·렌탈사별)
 *   GET   /margin/defaults · POST /margin/simulate · GET/POST /margin/scenarios · GET/POST/PATCH /margin/benchmarks   마진 설계 엔진
 *   GET   /stats                     상품관리 요약
 *   GET/POST/PATCH /promotions
 * 상담원(로그인 사용자)
 *   GET   /agent/models              검색 (리베이트 없음)
 *   GET   /agent/models/:id/offers   조건별 월요금·가격구간·가이드·MAX·N개월 (리베이트 없음)
 *   GET   /agent/tickets/:ticket     티켓번호(R000001)로 조건 조회
 *   GET   /agent/offers/:id/form     렌탈사 가입기준에 맞춘 계약정보 입력폼 명세
 */
import { Router } from 'express';
import multer from 'multer';
import { createHash, randomUUID } from 'crypto';
import { supabase } from '../db/supabase.js';
import { authenticateJWT } from '../middleware/auth.js';
import { parseRentalWorkbook } from '../services/rental-import/index.js';
import { previewImport, commitImport } from '../services/rental-import/commit.js';
import { buildApplicationForm } from '../services/rental-application.js';
import { CATEGORIES, CATEGORY_LABEL } from '../services/rental-import/core.js';
import { assist, assistantEnabled } from '../services/rental-assistant.js';
import { recommend } from '../services/rental-recommend.js';
import { simulate, optimize, loadDataset, resetDatasetCache, DEFAULTS as MARGIN_DEFAULTS, ENGINE_VERSION } from '../services/rental-margin-engine.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });
const _isProd = process.env.NODE_ENV === 'production';
const errMsg = (e) => (_isProd ? '서버 오류 — 잠시 후 다시 시도하세요' : e?.message || '서버 오류');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// :id 파라미터가 uuid 가 아니면 400 (DB 캐스팅 500 방지)
function badId(req, res) {
  if (UUID_RE.test(String(req.params.id || ''))) return false;
  res.status(400).json({ error: '잘못된 id' });
  return true;
}

// ─── 권한 ───
async function currentAgent(userId) {
  if (!userId) return null;
  const { data } = await supabase.from('incentive_agents').select('id, name, role, active').eq('user_id', userId).single();
  return data?.active ? data : null;
}
const requireAgent = async (req, res, next) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase 미연결' });
  req.agent = await currentAgent(req.user?.id);
  if (!req.agent) return res.status(403).json({ error: '상담사 권한 필요' });
  next();
};
const requireAdmin = (req, res, next) => (req.agent?.role === 'admin' ? next() : res.status(403).json({ error: 'admin 전용' }));
const admin = [authenticateJWT, requireAgent, requireAdmin];
const agent = [authenticateJWT, requireAgent];

// ─── import 미리보기 캐시 (확정 전까지 30분) ───
const previewCache = new Map();
const PREVIEW_TTL = 30 * 60 * 1000;
function putPreview(id, value) {
  for (const [k, v] of previewCache) if (v.expiresAt < Date.now()) previewCache.delete(k);
  previewCache.set(id, { ...value, expiresAt: Date.now() + PREVIEW_TTL });
}

router.post('/import/preview', ...admin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '엑셀 파일이 필요합니다' });
    const month = String(req.body.month || '').match(/^\d{4}-\d{2}$/) ? req.body.month : null;
    if (!month) return res.status(400).json({ error: 'month(YYYY-MM)가 필요합니다' });
    const fileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const parsed = parseRentalWorkbook(req.file.buffer, { month });
    const blocking = parsed.sheets.filter((s) => s.missingRows.length || s.errors.length);
    const fileKind = parsed.file;
    const { diff, summary } = await previewImport(supabase, { offers: parsed.offers, sheets: parsed.sheets, file: parsed.file });

    const batchId = randomUUID();
    const sheetReport = parsed.sheets.map(({ sheet, base, adapter, dataRows, offers, skipped, skipReasons, missingRows, errors, duplicateKeys }) =>
      ({ sheet, base, adapter, dataRows, offers, skipped, skipReasons, missing: missingRows.length, missingRows: missingRows.slice(0, 50), errors: errors.slice(0, 20), duplicateKeys }));
    await supabase.from('rental_cat_batches').insert({
      id: batchId, month, file_kind: fileKind, file_name: fileName,
      file_hash: createHash('sha256').update(req.file.buffer).digest('hex'),
      status: 'preview', sheet_report: sheetReport, diff_summary: summary, created_by: req.agent.name,
    }).throwOnError();
    putPreview(batchId, { parsed, fileKind, month, fileName });

    const sample = (list, n = 30) => list.slice(0, n);
    res.json({
      batch_id: batchId, month, file_kind: fileKind, file_name: fileName, summary,
      blocking: blocking.map((s) => s.sheet),
      sheets: sheetReport,
      samples: {
        new: sample(diff.new).map((o) => ({ supplier: o.supplier, model: o.model_code, key: o.condition_key, monthly_fee: o.monthly_fee, display_fee: o.display_fee, rebate: o.rebate })),
        changed: sample(diff.changed).map(({ prev, row, fields }) => ({ supplier: row.supplier, model: row.model_code, key: row.condition_key, fields, before: Object.fromEntries(fields.map((f) => [f, prev[f]])), after: Object.fromEntries(fields.map((f) => [f, row[f]])) })),
        removed: sample(diff.removed).map((p) => ({ key: p.condition_key, source: p.source })),
      },
    });
  } catch (e) {
    console.error('[rental-catalog] preview', e);
    res.status(500).json({ error: errMsg(e) });
  }
});

router.post('/import/:batchId/commit', ...admin, async (req, res) => {
  try {
    const cached = previewCache.get(req.params.batchId);
    if (!cached || cached.expiresAt < Date.now()) return res.status(410).json({ error: '미리보기가 만료됐습니다. 파일을 다시 올려주세요' });
    const blocking = cached.parsed.sheets.filter((s) => s.missingRows.length || s.errors.length);
    if (blocking.length) {
      return res.status(422).json({ error: '누락 행 또는 오류가 있는 시트가 있습니다', sheets: blocking.map((s) => s.sheet) });
    }
    // 확정 선점 — 동시에 두 번 눌러도 한 번만 반영
    const { data: claimed } = await supabase.from('rental_cat_batches').update({ status: 'committing' })
      .eq('id', req.params.batchId).eq('status', 'preview').select('*').throwOnError();
    if (!claimed?.length) return res.status(409).json({ error: '이미 반영 중이거나 반영된 파일입니다' });
    const batch = claimed[0];
    let summary;
    try {
      summary = await commitImport(supabase, {
        batch, offers: cached.parsed.offers, sheets: cached.parsed.sheets,
        supplierRules: cached.parsed.supplierRules, user: req.agent.name,
      });
    } catch (err) {
      await supabase.from('rental_cat_batches').update({ status: 'failed' }).eq('id', batch.id);
      throw err;
    }
    previewCache.delete(req.params.batchId);
    res.json({ ok: true, summary });
  } catch (e) {
    console.error('[rental-catalog] commit', e);
    res.status(500).json({ error: errMsg(e) });
  }
});

router.get('/batches', ...admin, async (req, res) => {
  try {
    const { data } = await supabase.from('rental_cat_batches')
      .select('id, month, file_kind, file_name, status, diff_summary, created_by, committed_by, committed_at, created_at')
      .order('created_at', { ascending: false }).limit(50).throwOnError();
    res.json({ batches: data });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

router.get('/suppliers', ...agent, async (req, res) => {
  try {
    const cols = req.agent.role === 'admin' ? '*' : 'id, name, file_kind, signup_policy, signup_policy_as_of, is_active';
    const { data } = await supabase.from('rental_cat_suppliers').select(cols).order('name').throwOnError();
    res.json({ suppliers: data });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

// ─── 모델 검색 (관리자·상담원 공용 쿼리) ───
async function searchModels(q) {
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const size = Math.min(200, Math.max(1, parseInt(q.size, 10) || 50));
  let query = supabase.from('rental_cat_model_summary').select('*', { count: 'exact' });
  if (q.q) {
    const term = String(q.q).replace(/[%,()]/g, ' ').trim();
    query = query.or(`model_key.ilike.%${term}%,model_code.ilike.%${term}%,product_name.ilike.%${term}%,brand.ilike.%${term}%`);
  }
  if (q.supplier) query = query.eq('supplier_id', q.supplier);
  if (q.category) query = query.eq('category', q.category);
  if (q.status) query = query.eq('status', q.status);
  if (q.linked === 'true') query = query.eq('platform_linked', true);
  if (q.payout === 'unset') query = query.lt('payout_set_count', 1);
  if (q.rebate_changed === 'true') query = query.gt('rebate_changed_count', 0);
  query = query.gt('offer_count', 0).order('payout_set_count', { ascending: false }).order('supplier_id').order('model_key').range((page - 1) * size, page * size - 1);
  const { data, count, error } = await query;
  if (error && /range/i.test(error.message || '') ) return { models: [], total: null, page, size };   // 범위 밖 페이지
  if (error) throw error;
  return { models: data, total: count, page, size };
}

router.get('/models', ...admin, async (req, res) => {
  try { res.json(await searchModels(req.query)); } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

router.get('/models/:id', ...admin, async (req, res) => {
  try {
    if (badId(req, res)) return;
    const { data: model } = await supabase.from('rental_cat_model_summary').select('*').eq('id', req.params.id).maybeSingle().throwOnError();
    if (!model) return res.status(404).json({ error: '모델 없음' });
    const { data: offers } = await supabase.from('rental_cat_offers').select('*').eq('model_id', req.params.id)
      .order('offer_type').order('contract_months').order('care_type').order('cycle_months').throwOnError();
    res.json({ model, offers });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

router.patch('/models/:id', ...admin, async (req, res) => {
  try {
    if (badId(req, res)) return;
    const allowed = ['product_name', 'category', 'brand', 'image_url', 'specs', 'status', 'platform_linked'];
    const update = Object.fromEntries(allowed.filter((k) => req.body[k] !== undefined).map((k) => [k, req.body[k]]));
    if (!Object.keys(update).length) return res.status(400).json({ error: '변경할 필드가 없습니다' });
    update.updated_at = new Date().toISOString();
    const { data } = await supabase.from('rental_cat_models').update(update).eq('id', req.params.id).select().single().throwOnError();
    res.json({ model: data });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

// ─── 가이드·MAX ───
const GUIDE_UNIT = 10000;  // 가이드는 만원 단위 (대표 지시 2026-09-16)
function validPayout(guide, max) {
  const num = (v) => (v == null ? null : (typeof v === 'number' || (typeof v === 'string' && /^\d+$/.test(v))) ? Number(v) : NaN);
  const g = num(guide);
  const m = num(max);
  if ((g != null && (!Number.isInteger(g) || g < 0)) || (m != null && (!Number.isInteger(m) || m < 0))) return '가이드·MAX 는 0 이상의 원 단위 정수여야 합니다';
  if (g != null && g % GUIDE_UNIT !== 0) return `가이드는 ${GUIDE_UNIT.toLocaleString()}원 단위여야 합니다`;
  if (g != null && m != null && m < g) return 'MAX 는 가이드보다 작을 수 없습니다';
  return null;
}

router.patch('/offers/:id', ...admin, async (req, res) => {
  try {
    if (badId(req, res)) return;
    const allowed = ['guide_payout', 'max_payout', 'status', 'status_locked', 'crm_enabled', 'admin_notes', 'valid_from', 'valid_to'];
    const update = Object.fromEntries(allowed.filter((k) => req.body[k] !== undefined).map((k) => [k, req.body[k]]));
    if (!Object.keys(update).length) return res.status(400).json({ error: '변경할 필드가 없습니다' });
    if (update.status !== undefined) {
      if (!['active', 'paused', 'discontinued'].includes(update.status)) return res.status(400).json({ error: "status 는 active·paused·discontinued" });
      if (update.status_locked === undefined) update.status_locked = true;   // 사람이 정한 상태는 월 import 가 덮지 않는다
    }
    if (update.status_locked !== undefined && typeof update.status_locked !== 'boolean') return res.status(400).json({ error: 'status_locked 는 true/false' });
    if (update.crm_enabled !== undefined && typeof update.crm_enabled !== 'boolean') return res.status(400).json({ error: 'crm_enabled 는 true/false' });
    for (const k of ['valid_from', 'valid_to']) if (update[k] != null && !DATE_RE.test(String(update[k]))) return res.status(400).json({ error: `${k} 는 YYYY-MM-DD` });
    if (update.admin_notes != null && String(update.admin_notes).length > 1000) return res.status(400).json({ error: '메모는 1000자 이내' });
    const { data: prev } = await supabase.from('rental_cat_offers').select('guide_payout, max_payout').eq('id', req.params.id).maybeSingle().throwOnError();
    if (!prev) return res.status(404).json({ error: '조건 없음' });
    const guide = update.guide_payout !== undefined ? update.guide_payout : prev.guide_payout;
    const max = update.max_payout !== undefined ? update.max_payout : prev.max_payout;
    const bad = validPayout(guide, max);
    if (bad) return res.status(400).json({ error: bad });
    const now = new Date().toISOString();
    const payoutTouched = 'guide_payout' in update || 'max_payout' in update;
    if (payoutTouched) Object.assign(update, { payout_updated_by: req.agent.name, payout_updated_at: now, rebate_changed: false });
    update.updated_at = now;
    if (payoutTouched) {
      update.guide_payout = guide == null ? null : Number(guide);
      update.max_payout = max == null ? null : Number(max);
    }
    const { data } = await supabase.from('rental_cat_offers').update(update).eq('id', req.params.id).select().single().throwOnError();
    if (payoutTouched) {
      await supabase.from('rental_cat_offer_changes').insert({
        offer_id: req.params.id, change_type: 'payout', changed_by: req.agent.name,
        before: { guide_payout: prev.guide_payout, max_payout: prev.max_payout },
        after: { guide_payout: data.guide_payout, max_payout: data.max_payout },
      }).throwOnError();
    }
    res.json({ offer: data });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

/**
 * body: { filter: { ids?, model_id?, supplier_id?, offer_type?, only_unset? },
 *         set: { mode:'fixed', guide, max } | { mode:'rebate', guide_rate, guide_minus, max_rate, max_minus, round_to },
 *         dry_run }
 * rebate 모드: 값 = floor((rebate × rate − minus) / round_to) × round_to  (0 미만이면 0, round_to 기본 1만원)
 * 가이드는 항상 1만원 단위로 버림
 */
router.post('/offers/bulk-payout', ...admin, async (req, res) => {
  try {
    const { filter = {}, set = {}, dry_run = true } = req.body || {};
    if (!filter.ids?.length && !filter.model_id && !filter.supplier_id) return res.status(400).json({ error: '대상 필터(ids/model_id/supplier_id) 중 하나는 필요합니다' });
    let q = supabase.from('rental_cat_offers').select('id, rebate, guide_payout, max_payout, display_fee').neq('status', 'discontinued');
    if (filter.ids?.length) q = q.in('id', filter.ids);
    if (filter.model_id) q = q.eq('model_id', filter.model_id);
    if (filter.supplier_id) q = q.eq('supplier_id', filter.supplier_id);
    if (filter.offer_type) q = q.eq('offer_type', filter.offer_type);
    if (filter.only_unset) q = q.is('guide_payout', null);
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const { data } = await q.order('id').range(from, from + 999).throwOnError();
      rows.push(...data);
      if (data.length < 1000) break;
    }
    const roundTo = Math.max(1, parseInt(set.round_to, 10) || GUIDE_UNIT);
    const calc = (rebate, rate, minus) => (rebate == null ? null : Math.max(0, Math.floor((rebate * Number(rate || 0) - Number(minus || 0)) / roundTo) * roundTo));
    const planned = [];
    const skipped = [];
    for (const r of rows) {
      let guide; let max;
      if (set.mode === 'fixed') { guide = set.guide ?? r.guide_payout; max = set.max ?? r.max_payout; }
      else if (set.mode === 'rebate') {
        guide = calc(r.rebate, set.guide_rate, set.guide_minus);
        if (guide != null) guide = Math.floor(guide / GUIDE_UNIT) * GUIDE_UNIT;   // 반올림 단위와 무관하게 가이드는 만원 단위
        max = calc(r.rebate, set.max_rate, set.max_minus);
      }
      else return res.status(400).json({ error: "set.mode 는 'fixed' 또는 'rebate'" });
      const bad = validPayout(guide, max);
      if (bad || (set.mode === 'rebate' && r.rebate == null)) { skipped.push({ id: r.id, reason: bad || '리베이트 없음' }); continue; }
      planned.push({ id: r.id, before: { guide_payout: r.guide_payout, max_payout: r.max_payout }, guide_payout: guide, max_payout: max, free_months: guide != null && r.display_fee ? Math.floor(guide / r.display_fee) : null });
    }
    if (dry_run) return res.json({ dry_run: true, matched: rows.length, will_update: planned.length, skipped: skipped.length, samples: planned.slice(0, 20), skipped_samples: skipped.slice(0, 20) });

    const now = new Date().toISOString();
    for (const p of planned) {
      await supabase.from('rental_cat_offers').update({
        guide_payout: p.guide_payout, max_payout: p.max_payout, payout_updated_by: req.agent.name, payout_updated_at: now, rebate_changed: false, updated_at: now,
      }).eq('id', p.id).throwOnError();
    }
    for (let i = 0; i < planned.length; i += 1000) {
      await supabase.from('rental_cat_offer_changes').insert(planned.slice(i, i + 1000).map((p) => ({
        offer_id: p.id, change_type: 'payout', changed_by: req.agent.name, before: p.before, after: { guide_payout: p.guide_payout, max_payout: p.max_payout },
      }))).throwOnError();
    }
    res.json({ dry_run: false, updated: planned.length, skipped: skipped.length });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

// 마진율 규칙으로 가이드·MAX 일괄 (DB 함수 — 수만 건 한 번에, 이력 포함)
router.post('/offers/apply-margin', ...admin, async (req, res) => {
  try {
    if (req.body?.margin_pct == null || req.body.margin_pct === '') return res.status(400).json({ error: 'MAX 마진(margin_pct)을 입력하세요' });
    const margin = Number(req.body.margin_pct) / 100;                  // MAX 마진
    if (!(margin >= 0 && margin < 1)) return res.status(400).json({ error: '마진율은 0~99%' });
    const guideMargin = req.body?.guide_margin_pct == null || req.body.guide_margin_pct === '' ? null : Number(req.body.guide_margin_pct) / 100;
    if (guideMargin != null && !(guideMargin >= margin && guideMargin < 1)) return res.status(400).json({ error: '가이드 마진은 MAX 마진 이상이어야 합니다' });
    const basis = req.body?.basis === 'vat' ? 'vat' : 'supply';
    const floor = (v) => (v == null || v === '' ? 0 : Number(v));
    const maxFloor = floor(req.body?.max_floor), guideFloor = floor(req.body?.guide_floor);
    if (![maxFloor, guideFloor].every((v) => Number.isInteger(v) && v >= 0 && v <= 5000000)) return res.status(400).json({ error: '금액 하한은 0 이상 정수(원)' });
    const { data } = await supabase.rpc('rental_cat_apply_margin', {
      p_margin: margin, p_basis: basis, p_supplier: req.body?.supplier_id || null,
      p_only_unset: !!req.body?.only_unset, p_dry_run: req.body?.dry_run !== false, p_user: req.agent.name, p_guide_margin: guideMargin, p_max_floor: maxFloor, p_guide_floor: guideFloor,
    }).throwOnError();
    _catCacheReset(); resetDatasetCache();
    res.json(data);
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

router.get('/stats', ...admin, async (req, res) => {
  try {
    const { data } = await supabase.rpc('rental_cat_stats').throwOnError();
    res.json(data);
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

// ─── 프로모션 ───
router.get('/promotions', ...agent, async (req, res) => {
  try {
    let q = supabase.from('rental_cat_promotions').select('*').order('period_from', { ascending: false });
    if (req.query.supplier) q = q.eq('supplier_id', req.query.supplier);
    if (req.query.active === 'true') {
      const today = new Date().toISOString().slice(0, 10);
      q = q.eq('is_active', true).or(`and(or(period_to.is.null,period_to.gte.${today}),or(period_from.is.null,period_from.lte.${today}))`);
    }
    const { data } = await q.throwOnError();
    res.json({ promotions: data });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

const PROMO_FIELDS = ['supplier_id', 'title', 'summary', 'benefit', 'targets', 'stacking', 'period_from', 'period_to', 'source', 'attachments', 'is_active'];
router.post('/promotions', ...admin, async (req, res) => {
  try {
    const row = Object.fromEntries(PROMO_FIELDS.filter((k) => req.body[k] !== undefined).map((k) => [k, req.body[k]]));
    if (!row.supplier_id || !row.title) return res.status(400).json({ error: 'supplier_id, title 필수' });
    if (!DATE_RE.test(String(row.period_from || '')) || !DATE_RE.test(String(row.period_to || '')) || row.period_from > row.period_to) {
      return res.status(400).json({ error: '프로모션 기간(period_from ≤ period_to, YYYY-MM-DD) 필수' });
    }
    const { data } = await supabase.from('rental_cat_promotions').insert(row).select().single().throwOnError();
    res.json({ promotion: data });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});
router.patch('/promotions/:id', ...admin, async (req, res) => {
  try {
    if (badId(req, res)) return;
    const row = Object.fromEntries(PROMO_FIELDS.filter((k) => req.body[k] !== undefined).map((k) => [k, req.body[k]]));
    row.updated_at = new Date().toISOString();
    const { data } = await supabase.from('rental_cat_promotions').update(row).eq('id', req.params.id).select().maybeSingle().throwOnError();
    if (!data) return res.status(404).json({ error: '프로모션 없음' });
    res.json({ promotion: data });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

// ─── 상담원용 (리베이트 제외) ───
const AGENT_OFFER_COLS = 'id, ticket_number, model_id, supplier_id, variant_code, contract_months, obligation_months, ownership_months, care_type, care_label, cycle_months, offer_type, offer_tags, offer_label, monthly_fee, price_phases, display_fee, prepay_amount, guide_payout, max_payout, free_months, status, notes, valid_from, valid_to';

// 티켓번호로 조건 바로 찾기 (고객이 불러주는 번호)
router.get('/agent/tickets/:ticket', ...agent, async (req, res) => {
  try {
    const ticket = String(req.params.ticket || '').trim().toUpperCase();
    if (!/^R\d{6}$/.test(ticket)) return res.status(400).json({ error: '티켓번호 형식은 R000001 입니다' });
    const { data: offer } = await supabase.from('rental_cat_offers').select(AGENT_OFFER_COLS).eq('ticket_number', ticket).maybeSingle().throwOnError();
    if (!offer) return res.status(404).json({ error: '티켓 없음', ticket_number: ticket });
    const { data: model } = await supabase.from('rental_cat_model_summary')
      .select('*').eq('id', offer.model_id).single().throwOnError();
    delete model.rebate_changed_count;
    res.json({ offer, model, usable: offer.status === 'active' });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

/** 조건 + 모델 + 렌탈사(가입기준) → 계약정보 입력폼 명세 */
export async function loadOfferContext(offerId) {
  if (!UUID_RE.test(String(offerId || ''))) return null;
  const { data: offer } = await supabase.from('rental_cat_offers').select(`${AGENT_OFFER_COLS}, source, rebate, crm_enabled`).eq('id', offerId).maybeSingle().throwOnError();
  if (!offer) return null;
  const [{ data: model }, { data: supplier }] = await Promise.all([
    supabase.from('rental_cat_models').select('id, model_key, model_code, product_name, brand, category, category_raw, image_url, status').eq('id', offer.model_id).single().throwOnError(),
    supabase.from('rental_cat_suppliers').select('id, name, file_kind, signup_policy, signup_policy_as_of').eq('id', offer.supplier_id).single().throwOnError(),
  ]);
  const cards = cardsFor(await activeCards(offer.supplier_id), model);
  return { offer, model, supplier, cards, form: buildApplicationForm({ supplier, offer, model, cards }) };
}

// ─── 제휴카드 ───
const CARD_COLS = 'id, supplier_id, card_issuer, card_name, annual_fee, tiers, max_discount, discount_months, has_promo, categories, notes, card_url, verify_status, verified_at, is_active, display_rank';
// 카드 대상 품목 원문(정수기·비데·공기청정기·매트리스·에어컨·TV) ↔ 모델 카테고리
const CARD_CATEGORY = { 'water-purifier': '정수기', bidet: '비데', 'air-purifier': '공기청정기', furniture: '매트리스', aircon: '에어컨', tv: 'TV' };
async function activeCards(supplierId) {
  const { data } = await supabase.from('rental_cat_cards').select(CARD_COLS).eq('supplier_id', supplierId).eq('is_active', true)
    .order('display_rank', { ascending: true, nullsFirst: false }).order('max_discount', { ascending: false }).throwOnError();
  return data || [];
}
// 대상 품목이 적힌 카드는 그 품목 모델에만 — 품목 표기가 없거나 카드 품목표에 없는 카테고리면 렌탈사 전체 카드로 본다
function cardsFor(cards, model) {
  const label = CARD_CATEGORY[model?.category];
  return cards.filter((c) => !c.categories?.length || !label || c.categories.includes(label));
}
router.get('/agent/suppliers/:id/cards', ...agent, async (req, res) => {
  try {
    const cards = await activeCards(String(req.params.id));
    res.json({ cards });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});
router.get('/cards', ...admin, async (req, res) => {
  try {
    let q = supabase.from('rental_cat_cards').select(CARD_COLS).order('supplier_id').order('max_discount', { ascending: false });
    if (req.query.supplier) q = q.eq('supplier_id', req.query.supplier);
    const { data } = await q.throwOnError();
    res.json({ cards: data });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});
router.patch('/cards/:id', ...admin, async (req, res) => {
  try {
    if (badId(req, res)) return;
    const allowed = ['is_active', 'notes', 'display_rank', 'discount_months', 'annual_fee', 'card_url'];
    const row = Object.fromEntries(allowed.filter((k) => req.body[k] !== undefined).map((k) => [k, req.body[k]]));
    if (row.is_active !== undefined && typeof row.is_active !== 'boolean') return res.status(400).json({ error: 'is_active 는 true/false' });
    if (!Object.keys(row).length) return res.status(400).json({ error: '바꿀 항목이 없습니다' });
    row.updated_at = new Date().toISOString();
    const { data } = await supabase.from('rental_cat_cards').update(row).eq('id', req.params.id).select(CARD_COLS).maybeSingle().throwOnError();
    if (!data) return res.status(404).json({ error: '카드 없음' });
    res.json({ card: data });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

router.get('/agent/offers/:id/form', ...agent, async (req, res) => {
  try {
    if (badId(req, res)) return;
    const ctx = await loadOfferContext(req.params.id);
    if (!ctx) return res.status(404).json({ error: '조건 없음' });
    const { rebate, source, ...offer } = ctx.offer;
    res.json({ offer, model: ctx.model, supplier: { id: ctx.supplier.id, name: ctx.supplier.name }, form: ctx.form, cards: ctx.cards });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

// ─── 렌탈 상담 AI (상담원 보조) — DB 조회 도구로만 답한다 ───
const assistHits = new Map();   // 상담원별 10분 30회
// 자동 추천 (AI 없음 · 기본) — 칩/한 줄 입력 → 많이 팔리는·많이 남는 조건 + 카드·페이백 반영 실질 월
router.post('/agent/recommend', ...agent, async (req, res) => {
  try {
    const b = req.body || {};
    const pick = (v, re) => (typeof v === 'string' && re.test(v) ? v : undefined);
    const out = await recommend({
      text: typeof b.text === 'string' ? b.text.slice(0, 300) : '',
      category: pick(b.category, /^[a-z-]{2,30}$/),
      budget: Number.isInteger(b.budget) && b.budget > 0 && b.budget < 10_000_000 ? b.budget : undefined,
      care_type: pick(b.care_type, /^(visit|self|delivery|none)$/),
      contract_months: Number.isInteger(b.contract_months) && b.contract_months > 0 && b.contract_months <= 120 ? b.contract_months : undefined,
      current_brand: pick(b.current_brand, /^[a-z-]{2,20}$/),
      card_issuer: pick(b.card_issuer, /^[가-힣A-Z]{1,6}$/),
      keywords: Array.isArray(b.keywords) ? b.keywords.filter((k) => typeof k === 'string' && k.length <= 10).slice(0, 4) : [],
    });
    res.json(out);
  } catch (e) { console.error('[rental-recommend]', e?.message); res.status(500).json({ error: errMsg(e) }); }
});

router.post('/agent/assist', ...agent, async (req, res) => {
  try {
    if (!assistantEnabled()) return res.status(503).json({ error: '상담 AI 비활성화(API 키 없음)' });
    const now = Date.now();
    const hits = (assistHits.get(req.agent.id) || []).filter((t) => t > now - 10 * 60 * 1000);
    if (hits.length >= 30) return res.status(429).json({ error: '잠시 후 다시 물어봐 주세요 (10분 30회)' });
    hits.push(now); assistHits.set(req.agent.id, hits);
    const messages = Array.isArray(req.body?.messages) ? req.body.messages.filter((m) => m && typeof m.content === 'string' && m.content.trim()) : [];
    if (!messages.length || messages[messages.length - 1].role !== 'user') return res.status(400).json({ error: '질문이 없습니다' });
    const ctx = req.body?.context || {};
    const context = {
      model_id: UUID_RE.test(String(ctx.model_id || '')) ? ctx.model_id : undefined,
      ticket: /^R\d{6}$/.test(String(ctx.ticket || '')) ? ctx.ticket : undefined,
    };
    const out = await assist({ messages, context, agentName: req.agent.name });
    res.json(out);
  } catch (e) {
    console.error('[rental-assist]', e?.status || '', e?.message);
    if (/credit balance is too low/i.test(e?.message || '')) return res.status(503).json({ error: '상담 AI 사용 한도(API 크레딧) 부족 — 관리자에게 알려주세요' });
    if (e?.status === 429 || e?.status === 529) return res.status(503).json({ error: '상담 AI 요청이 몰렸습니다 — 잠시 후 다시 시도' });
    res.status(e?.status === 503 ? 503 : 500).json({ error: e?.status === 503 ? e.message : errMsg(e) });
  }
});

// 카테고리별 판매중 모델 수 (5분 캐시)
let _catCache = null;
function _catCacheReset() { _catCache = null; }
router.get('/agent/categories', ...agent, async (req, res) => {
  try {
    if (!_catCache || _catCache.at < Date.now() - 5 * 60 * 1000) {
      const counts = {};
      for (let from = 0; ; from += 1000) {
        const { data } = await supabase.from('rental_cat_model_summary').select('category, supplier_id')
          .eq('status', 'active').gt('offer_count', 0).order('id').range(from, from + 999).throwOnError();
        for (const m of data) counts[m.category || 'etc'] = (counts[m.category || 'etc'] || 0) + 1;
        if (data.length < 1000) break;
      }
      const order = [...new Set([...CATEGORIES.map(([slug]) => slug), 'etc'])];
      _catCache = { at: Date.now(), list: order.filter((c) => counts[c]).map((c) => ({ slug: c, label: CATEGORY_LABEL[c], count: counts[c] })) };
    }
    res.json({ categories: _catCache.list });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

router.get('/agent/models', ...agent, async (req, res) => {
  try {
    const out = await searchModels({ ...req.query, status: 'active' });
    out.models = out.models.map(({ rebate_changed_count, ...m }) => m);
    res.json(out);
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

router.get('/agent/models/:id/offers', ...agent, async (req, res) => {
  try {
    if (badId(req, res)) return;
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase.from('rental_cat_offers').select(AGENT_OFFER_COLS)
      .eq('model_id', req.params.id).eq('status', 'active').eq('crm_enabled', true)
      .or(`valid_to.is.null,valid_to.gte.${today}`)
      .order('contract_months').order('care_type').order('cycle_months').throwOnError();
    res.json({ offers: data });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

// ─── 마진 설계 엔진 (관리자 전용 — 리베이트 기반) ───
router.get('/margin/defaults', ...admin, async (req, res) => {
  try {
    const { data: rule } = await supabase.from('incentive_rules').select('version, base_salary, residual_rates').eq('active', true).maybeSingle();
    const { data: last } = await supabase.from('rental_cat_offers').select('payout_updated_by').not('payout_updated_by', 'is', null).order('payout_updated_at', { ascending: false }).limit(1);
    res.json({ engine_version: ENGINE_VERSION, defaults: { ...MARGIN_DEFAULTS, base_salary: rule?.base_salary ?? MARGIN_DEFAULTS.base_salary },
      settlement_rule: rule ? { version: rule.version, residual_rates: rule.residual_rates } : null, live_rule_label: last?.[0]?.payout_updated_by || null });
  } catch (e) { console.error('[margin/defaults]', e.message); res.status(500).json({ error: errMsg(e) }); }
});

router.post('/margin/simulate', ...admin, async (req, res) => {
  try {
    const body = req.body || {};
    if (body.refresh) resetDatasetCache();
    const ds = await loadDataset();
    const filter = {};
    if (body.supplier_id) filter.supplier_id = String(body.supplier_id);
    if (body.category) filter.category = String(body.category);
    const out = simulate(ds, { ...body, filter });
    if (!out.ok) return res.status(400).json({ error: out.errors.join(' · '), errors: out.errors });
    res.json({ ...out, loaded_at: ds.loaded_at });
  } catch (e) { console.error('[margin/simulate]', e.message); res.status(500).json({ error: errMsg(e) }); }
});

// 제약 최적화 — 탐색에 수 초 걸린다. 관리자만, 동시에 한 번씩
let optimizing = false;
router.post('/margin/optimize', ...admin, async (req, res) => {
  if (optimizing) return res.status(429).json({ error: '다른 최적화가 진행 중입니다 — 잠시 후 다시 시도하세요' });
  optimizing = true;
  try {
    const body = req.body || {};
    const ds = await loadDataset();
    const filter = {};
    if (body.supplier_id) filter.supplier_id = String(body.supplier_id);
    if (body.category) filter.category = String(body.category);
    const out = optimize(ds, { ...body, filter });
    if (!out.ok) return res.status(422).json({ error: out.errors.join(' · '), constraints: out.constraints });
    res.json({ ...out, loaded_at: ds.loaded_at });
  } catch (e) { console.error('[margin/optimize]', e.message); res.status(500).json({ error: errMsg(e) }); }
  finally { optimizing = false; }
});

router.get('/margin/scenarios', ...admin, async (req, res) => {
  try {
    const { data } = await supabase.from('rental_margin_scenarios').select('*').order('created_at', { ascending: false }).limit(50).throwOnError();
    res.json({ scenarios: data });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});
router.post('/margin/scenarios', ...admin, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim().slice(0, 80);
    if (!name) return res.status(400).json({ error: '시나리오 이름을 입력하세요' });
    const ds = await loadDataset();
    const out = simulate(ds, req.body?.params || {});
    if (!out.ok) return res.status(400).json({ error: out.errors.join(' · ') });
    const pick = (sc) => sc && { per_sale: sc.per_sale, per_head: sc.per_head, break_even: sc.break_even };
    const summary = { proposed: pick(out.proposed), live: pick(out.live), competitor: out.competitor, dataset: out.dataset };
    const { data } = await supabase.from('rental_margin_scenarios').insert({ name, engine_version: out.engine_version, params: out.params, summary, memo: String(req.body?.memo || '').slice(0, 500) || null, created_by: req.agent.name }).select().single().throwOnError();
    res.json({ scenario: data });
  } catch (e) { console.error('[margin/scenarios]', e.message); res.status(500).json({ error: errMsg(e) }); }
});

const CARE_TYPES = ['visit', 'self', 'delivery', 'none'];
router.get('/margin/benchmarks', ...admin, async (req, res) => {
  try {
    const { data } = await supabase.from('rental_competitor_benchmarks').select('*').order('observed_at', { ascending: false }).order('support_amount', { ascending: false }).limit(500).throwOnError();
    res.json({ benchmarks: data });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});
router.post('/margin/benchmarks', ...admin, async (req, res) => {
  try {
    const b = req.body || {};
    const int = (v) => (v === '' || v == null ? null : Number(v));
    const row = { competitor: String(b.competitor || '').trim(), supplier_id: String(b.supplier_id || ''), model_code: String(b.model_code || '').trim().toUpperCase(), product_name: b.product_name || null,
      contract_months: int(b.contract_months), care_type: b.care_type, monthly_fee: int(b.monthly_fee), after_fee: int(b.after_fee), half_months: int(b.half_months),
      support_amount: int(b.support_amount), observed_at: b.observed_at, source_url: String(b.source_url || '').trim(), notes: b.notes || null };
    const bad = [];
    if (!row.competitor) bad.push('경쟁사'); if (!row.supplier_id) bad.push('렌탈사'); if (!row.model_code) bad.push('모델코드');
    if (!Number.isInteger(row.contract_months) || row.contract_months <= 0) bad.push('약정 개월');
    if (!CARE_TYPES.includes(row.care_type)) bad.push('관리방식');
    if (!Number.isInteger(row.support_amount) || row.support_amount < 0) bad.push('지원금');
    if (!DATE_RE.test(String(row.observed_at || ''))) bad.push('확인일');
    if (!/^https?:\/\//.test(row.source_url)) bad.push('출처 URL');
    for (const k of ['monthly_fee', 'after_fee', 'half_months']) if (row[k] != null && !(Number.isInteger(row[k]) && row[k] >= 0)) bad.push(k);
    if (bad.length) return res.status(400).json({ error: `입력 확인: ${bad.join(', ')}` });
    const { data, error } = await supabase.from('rental_competitor_benchmarks').insert(row).select().single();
    if (error) return res.status(error.code === '23505' ? 409 : 400).json({ error: error.code === '23505' ? '같은 날짜에 같은 조건이 이미 있습니다' : error.message });
    resetDatasetCache();
    res.json({ benchmark: data });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});
router.patch('/margin/benchmarks/:id', ...admin, async (req, res) => {
  try {
    if (badId(req, res)) return;
    if (typeof req.body?.is_active !== 'boolean') return res.status(400).json({ error: 'is_active(true/false)만 바꿀 수 있습니다' });
    const { data } = await supabase.from('rental_competitor_benchmarks').update({ is_active: req.body.is_active }).eq('id', req.params.id).select().maybeSingle().throwOnError();
    if (!data) return res.status(404).json({ error: '없음' });
    resetDatasetCache();
    res.json({ benchmark: data });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

export default router;
