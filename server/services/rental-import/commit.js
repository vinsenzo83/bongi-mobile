/**
 * rental-import/commit.js — 파싱된 offer[] 를 DB(rental_cat_*)와 비교·반영.
 *
 * 원칙
 *  - 가이드·MAX(guide_payout/max_payout)는 import 가 절대 쓰지 않는다.
 *  - 리베이트가 바뀐 조건은 rebate_changed=true → 상품관리에서 가이드 재검토 표시.
 *  - 이번 파일에서 "파싱된 시트"에 속했던 조건만 단종 판정한다(부분 업로드가 무관한 상품을 지우지 않게).
 *  - 반복행(#2 등)도 그대로 별도 조건으로 보존한다.
 */
import { createHash } from 'crypto';
import { sheetBase } from './core.js';

// 엑셀 렌탈사 표기 → 고정 id. 없는 이름은 해시 id 로 생성(첫 등장 시 보고됨)
const SUPPLIER_IDS = {
  '코웨이': 'coway', '쿠쿠': 'cuckoo', '청호': 'chungho', '청호나이스': 'chungho', 'SK매직': 'skmagic',
  '웰스': 'wells', '교원웰스': 'wells', '루헨스': 'luhens', '큐밍': 'cuming', '현대큐밍': 'cuming',
  '유버스': 'ubus', '현대유버스': 'ubus', 'LG구독': 'lg-subscribe', 'LG전자구독': 'lg-subscribe',
  'LG헬로': 'lg-hello', 'LG헬로비전': 'lg-hello', 'KT': 'kt', 'KT가전구독': 'kt', '스마트': 'smart',
  '렌타나': 'rentana', '캐리어': 'carrier', '세스코': 'cesco', 'BS': 'bs', '이니': 'ini', '이니렌탈': 'ini',
  '렌플': 'renple',
};
export function supplierId(name) {
  const n = String(name || '').replace(/\s/g, '');
  return SUPPLIER_IDS[n] || 'sup-' + createHash('sha1').update(n).digest('hex').slice(0, 8);
}

// 비교 대상 필드 (엑셀에서 오는 값만)
const DATA_FIELDS = [
  'variant_code', 'contract_months', 'obligation_months', 'ownership_months', 'care_type', 'care_label',
  'cycle_months', 'offer_type', 'offer_tags', 'offer_label', 'monthly_fee', 'price_phases', 'display_fee',
  'prepay_amount', 'total_fee', 'rebate', 'rebate_basis', 'rebate_rate', 'rebate_detail', 'notes', 'status',
];

export function displayFee(o) {
  const first = (o.price_phases || []).find((p) => p.from === 1);
  return first ? first.fee : o.monthly_fee;
}

// jsonb 는 키 순서를 보존하지 않는다 → 키 정렬 후 비교
const stable = (v) => (Array.isArray(v) ? v.map(stable)
  : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])])) : v ?? null);
const same = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));

/** 순수 함수: 기존 조건(Map key→row) 과 새 offer[] 비교 */
export function computeDiff(existingByKey, offers, parsedSheetBases) {
  const seen = new Set();
  const result = { new: [], changed: [], unchanged: [], removed: [], reappeared: [], rebateChanged: 0 };
  for (const o of offers) {
    const row = { ...o, display_fee: displayFee(o) };
    seen.add(o.condition_key);
    const prev = existingByKey.get(o.condition_key);
    if (!prev) { result.new.push(row); continue; }
    const fields = DATA_FIELDS.filter((f) => !same(prev[f], row[f]));
    if (prev.status === 'discontinued' && row.status !== 'discontinued') result.reappeared.push({ prev, row, fields });
    else if (fields.length) result.changed.push({ prev, row, fields });
    else result.unchanged.push({ prev, row });
    if (!same(prev.rebate, row.rebate)) result.rebateChanged++;
  }
  for (const [key, prev] of existingByKey) {
    if (seen.has(key) || prev.status === 'discontinued') continue;
    // 같은 시트명이 정수기·가전 파일에 모두 있을 수 있다(유버스) → 파일 종류까지 같아야 단종 대상
    if (parsedSheetBases.has(`${prev.source?.file_kind || ''}|${sheetBase(prev.source?.sheet || '')}`)) result.removed.push(prev);
  }
  return result;
}

export function summarize(diff) {
  return {
    new: diff.new.length, changed: diff.changed.length, unchanged: diff.unchanged.length,
    removed: diff.removed.length, reappeared: diff.reappeared.length, rebate_changed: diff.rebateChanged,
  };
}

async function selectAll(query, pageSize = 1000) {
  const out = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await query().range(from, from + pageSize - 1);
    if (error) throw error;
    out.push(...data);
    if (data.length < pageSize) break;
  }
  return out;
}

export async function loadExisting(supabase, supplierIds) {
  const rows = await selectAll(() => supabase.from('rental_cat_offers')
    .select(`id, model_id, condition_key, status, source, guide_payout, max_payout, ${DATA_FIELDS.join(', ')}`)
    .in('supplier_id', supplierIds).order('id'));
  return new Map(rows.map((r) => [r.condition_key, r]));
}

async function chunked(items, size, fn) {
  for (let i = 0; i < items.length; i += size) await fn(items.slice(i, i + size));
}

/** preview: DB 쓰기 없이 diff 요약 */
export async function previewImport(supabase, { offers, sheets, file }) {
  const supplierIds = [...new Set(offers.map((o) => supplierId(o.supplier)))];
  const existing = await loadExisting(supabase, supplierIds);
  const parsed = new Set(sheets.filter((s) => s.offers > 0).map((s) => `${file}|${s.base}`));
  const diff = computeDiff(existing, offers, parsed);
  return { diff, summary: summarize(diff), supplierIds };
}

/** commit: 렌탈사·모델·조건 upsert + 이력 + 배치 상태 */
export async function commitImport(supabase, { batch, offers, sheets, user, supplierRules = null }) {
  const { diff, summary, supplierIds } = await previewImport(supabase, { offers, sheets, file: batch.file_kind });
  const now = new Date().toISOString();

  // 1) 렌탈사
  const names = new Map();
  for (const o of offers) names.set(supplierId(o.supplier), o.supplier);
  await supabase.from('rental_cat_suppliers').upsert(
    [...names].map(([id, name]) => ({ id, name, file_kind: batch.file_kind, updated_at: now })),
    { onConflict: 'id', ignoreDuplicates: false },
  ).throwOnError();
  if (supplierRules?.rules?.length) {
    for (const id of supplierIds) {
      const rules = supplierRules.rules.filter((r) => supplierId(r.supplier) === id);
      if (rules.length) await supabase.from('rental_cat_suppliers').update({ commission_rules: rules }).eq('id', id).throwOnError();
    }
  }

  // 2) 모델 upsert → id 맵
  const models = new Map();
  for (const o of offers) {
    const sid = supplierId(o.supplier);
    const key = o.model_key || o.product_name;
    const k = `${sid}|${key}`;
    if (!models.has(k)) models.set(k, {
      supplier_id: sid, model_key: key, model_code: o.model_code, product_name: o.product_name,
      brand: o.brand, category_raw: o.category_raw, last_batch_id: batch.id, updated_at: now,
    });
  }
  const modelIds = new Map();
  await chunked([...models.values()], 500, async (chunk) => {
    const { data } = await supabase.from('rental_cat_models')
      .upsert(chunk, { onConflict: 'supplier_id,model_key' }).select('id, supplier_id, model_key').throwOnError();
    for (const m of data) modelIds.set(`${m.supplier_id}|${m.model_key}`, m.id);
  });
  // 신규 모델에만 first_batch_id
  await supabase.from('rental_cat_models').update({ first_batch_id: batch.id }).is('first_batch_id', null).eq('last_batch_id', batch.id).throwOnError();

  // 3) 조건 upsert (가이드·MAX 컬럼은 payload 에 넣지 않는다)
  const toRow = (o, prev) => {
    const sid = supplierId(o.supplier);
    const row = {
      model_id: modelIds.get(`${sid}|${o.model_key || o.product_name}`), supplier_id: sid,
      condition_key: o.condition_key, source: { ...o.source, month: batch.month, file: batch.file_name, file_kind: batch.file_kind },
      last_batch_id: batch.id, updated_at: now,
      rebate_changed: prev ? !same(prev.rebate, o.rebate) : false,
    };
    for (const f of DATA_FIELDS) row[f] = o[f] ?? null;
    row.display_fee = displayFee(o);
    row.offer_tags = o.offer_tags || [];
    row.price_phases = o.price_phases || [];
    return row;
  };
  const writes = [
    ...diff.new.map((o) => toRow(o, null)),
    ...diff.changed.map(({ prev, row }) => toRow(row, prev)),
    ...diff.reappeared.map(({ prev, row }) => toRow(row, prev)),
    ...diff.unchanged.map(({ prev, row }) => ({ ...toRow(row, prev), rebate_changed: false })),
  ];
  await chunked(writes, 500, (chunk) => supabase.from('rental_cat_offers').upsert(chunk, { onConflict: 'condition_key' }).throwOnError());

  // 신규 조건에만 first_batch_id (upsert payload 키를 행마다 똑같이 유지 — 섞이면 기존 값이 null 로 덮인다)
  await supabase.from('rental_cat_offers').update({ first_batch_id: batch.id }).is('first_batch_id', null).eq('last_batch_id', batch.id).throwOnError();

  // 4) 단종
  await chunked(diff.removed.map((r) => r.id), 500, (ids) => supabase.from('rental_cat_offers')
    .update({ status: 'discontinued', updated_at: now, last_batch_id: batch.id }).in('id', ids).throwOnError());

  // 5) 이력 (unchanged 제외)
  const idByKey = new Map();
  const touched = await selectAll(() => supabase.from('rental_cat_offers').select('id, condition_key').eq('last_batch_id', batch.id).order('id'));
  for (const r of touched) idByKey.set(r.condition_key, r.id);
  const pick = (o, fields) => Object.fromEntries(fields.map((f) => [f, o[f] ?? null]));
  const changes = [
    ...diff.new.map((o) => ({ offer_id: idByKey.get(o.condition_key), change_type: 'new', after: pick(o, ['monthly_fee', 'price_phases', 'rebate']) })),
    ...diff.changed.map(({ prev, row, fields }) => ({ offer_id: prev.id, change_type: 'changed', before: pick(prev, fields), after: pick(row, fields) })),
    ...diff.reappeared.map(({ prev, row, fields }) => ({ offer_id: prev.id, change_type: 'reappeared', before: pick(prev, fields), after: pick(row, fields) })),
    ...diff.removed.map((prev) => ({ offer_id: prev.id, change_type: 'removed', before: { status: prev.status } })),
  ].map((c) => ({ ...c, batch_id: batch.id, changed_by: user || null }));
  await chunked(changes, 1000, (chunk) => supabase.from('rental_cat_offer_changes').insert(chunk).throwOnError());

  // 6) 배치 확정
  await supabase.from('rental_cat_batches').update({
    status: 'committed', diff_summary: summary, committed_by: user || null, committed_at: now,
  }).eq('id', batch.id).throwOnError();

  return summary;
}
