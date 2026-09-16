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

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });
const _isProd = process.env.NODE_ENV === 'production';
const errMsg = (e) => (_isProd ? '서버 오류 — 잠시 후 다시 시도하세요' : e?.message || '서버 오류');

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
    const { data: batch } = await supabase.from('rental_cat_batches').select('*').eq('id', req.params.batchId).single().throwOnError();
    if (batch.status !== 'preview') return res.status(409).json({ error: `이미 ${batch.status} 상태입니다` });
    const blocking = cached.parsed.sheets.filter((s) => s.missingRows.length || s.errors.length);
    if (blocking.length && !req.body?.force) {
      return res.status(422).json({ error: '누락 행 또는 오류가 있는 시트가 있습니다', sheets: blocking.map((s) => s.sheet) });
    }
    const summary = await commitImport(supabase, {
      batch, offers: cached.parsed.offers, sheets: cached.parsed.sheets,
      supplierRules: cached.parsed.supplierRules, user: req.agent.name,
    });
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
  query = query.gt('offer_count', 0).order('supplier_id').order('model_key').range((page - 1) * size, page * size - 1);
  const { data, count } = await query.throwOnError();
  return { models: data, total: count, page, size };
}

router.get('/models', ...admin, async (req, res) => {
  try { res.json(await searchModels(req.query)); } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

router.get('/models/:id', ...admin, async (req, res) => {
  try {
    const { data: model } = await supabase.from('rental_cat_model_summary').select('*').eq('id', req.params.id).single().throwOnError();
    const { data: offers } = await supabase.from('rental_cat_offers').select('*').eq('model_id', req.params.id)
      .order('offer_type').order('contract_months').order('care_type').order('cycle_months').throwOnError();
    res.json({ model, offers });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

router.patch('/models/:id', ...admin, async (req, res) => {
  try {
    const allowed = ['product_name', 'category', 'brand', 'image_url', 'specs', 'status', 'platform_linked'];
    const update = Object.fromEntries(allowed.filter((k) => req.body[k] !== undefined).map((k) => [k, req.body[k]]));
    if (!Object.keys(update).length) return res.status(400).json({ error: '변경할 필드가 없습니다' });
    update.updated_at = new Date().toISOString();
    const { data } = await supabase.from('rental_cat_models').update(update).eq('id', req.params.id).select().single().throwOnError();
    res.json({ model: data });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

// ─── 가이드·MAX ───
function validPayout(guide, max) {
  const g = guide == null ? null : Number(guide);
  const m = max == null ? null : Number(max);
  if ((g != null && (!Number.isInteger(g) || g < 0)) || (m != null && (!Number.isInteger(m) || m < 0))) return '가이드·MAX 는 0 이상의 원 단위 정수여야 합니다';
  if (g != null && m != null && m < g) return 'MAX 는 가이드보다 작을 수 없습니다';
  return null;
}

router.patch('/offers/:id', ...admin, async (req, res) => {
  try {
    const allowed = ['guide_payout', 'max_payout', 'status', 'crm_enabled', 'notes', 'valid_from', 'valid_to'];
    const update = Object.fromEntries(allowed.filter((k) => req.body[k] !== undefined).map((k) => [k, req.body[k]]));
    if (!Object.keys(update).length) return res.status(400).json({ error: '변경할 필드가 없습니다' });
    const { data: prev } = await supabase.from('rental_cat_offers').select('guide_payout, max_payout').eq('id', req.params.id).single().throwOnError();
    const guide = update.guide_payout !== undefined ? update.guide_payout : prev.guide_payout;
    const max = update.max_payout !== undefined ? update.max_payout : prev.max_payout;
    const bad = validPayout(guide, max);
    if (bad) return res.status(400).json({ error: bad });
    const now = new Date().toISOString();
    const payoutTouched = 'guide_payout' in update || 'max_payout' in update;
    if (payoutTouched) Object.assign(update, { payout_updated_by: req.agent.name, payout_updated_at: now, rebate_changed: false });
    update.updated_at = now;
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
 * rebate 모드: 값 = floor((rebate × rate − minus) / round_to) × round_to  (0 미만이면 0)
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
    const roundTo = Math.max(1, parseInt(set.round_to, 10) || 1000);
    const calc = (rebate, rate, minus) => (rebate == null ? null : Math.max(0, Math.floor((rebate * Number(rate || 0) - Number(minus || 0)) / roundTo) * roundTo));
    const planned = [];
    const skipped = [];
    for (const r of rows) {
      let guide; let max;
      if (set.mode === 'fixed') { guide = set.guide ?? r.guide_payout; max = set.max ?? r.max_payout; }
      else if (set.mode === 'rebate') { guide = calc(r.rebate, set.guide_rate, set.guide_minus); max = calc(r.rebate, set.max_rate, set.max_minus); }
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

// ─── 프로모션 ───
router.get('/promotions', ...agent, async (req, res) => {
  try {
    let q = supabase.from('rental_cat_promotions').select('*').order('period_from', { ascending: false });
    if (req.query.supplier) q = q.eq('supplier_id', req.query.supplier);
    if (req.query.active === 'true') {
      const today = new Date().toISOString().slice(0, 10);
      q = q.eq('is_active', true).or(`period_to.is.null,period_to.gte.${today}`).or(`period_from.is.null,period_from.lte.${today}`);
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
    const { data } = await supabase.from('rental_cat_promotions').insert(row).select().single().throwOnError();
    res.json({ promotion: data });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});
router.patch('/promotions/:id', ...admin, async (req, res) => {
  try {
    const row = Object.fromEntries(PROMO_FIELDS.filter((k) => req.body[k] !== undefined).map((k) => [k, req.body[k]]));
    row.updated_at = new Date().toISOString();
    const { data } = await supabase.from('rental_cat_promotions').update(row).eq('id', req.params.id).select().single().throwOnError();
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
      .select('id, supplier_id, supplier_name, model_key, model_code, product_name, brand, category, image_url, status').eq('id', offer.model_id).single().throwOnError();
    res.json({ offer, model, usable: offer.status === 'active' });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

/** 조건 + 모델 + 렌탈사(가입기준) → 계약정보 입력폼 명세 */
export async function loadOfferContext(offerId) {
  const { data: offer } = await supabase.from('rental_cat_offers').select(`${AGENT_OFFER_COLS}, source, rebate`).eq('id', offerId).maybeSingle().throwOnError();
  if (!offer) return null;
  const [{ data: model }, { data: supplier }] = await Promise.all([
    supabase.from('rental_cat_models').select('id, model_key, model_code, product_name, brand, category, category_raw, image_url').eq('id', offer.model_id).single().throwOnError(),
    supabase.from('rental_cat_suppliers').select('id, name, file_kind, signup_policy, signup_policy_as_of').eq('id', offer.supplier_id).single().throwOnError(),
  ]);
  return { offer, model, supplier, form: buildApplicationForm({ supplier, offer, model }) };
}

router.get('/agent/offers/:id/form', ...agent, async (req, res) => {
  try {
    const ctx = await loadOfferContext(req.params.id);
    if (!ctx) return res.status(404).json({ error: '조건 없음' });
    const { rebate, source, ...offer } = ctx.offer;
    res.json({ offer, model: ctx.model, supplier: { id: ctx.supplier.id, name: ctx.supplier.name }, form: ctx.form });
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
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase.from('rental_cat_offers').select(AGENT_OFFER_COLS)
      .eq('model_id', req.params.id).eq('status', 'active').eq('crm_enabled', true)
      .or(`valid_to.is.null,valid_to.gte.${today}`)
      .order('contract_months').order('care_type').order('cycle_months').throwOnError();
    res.json({ offers: data });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

export default router;
