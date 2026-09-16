/**
 * rental-import/index.js — 빌리고 엑셀 파일 → 시트별 어댑터 실행 → 검증 리포트.
 *
 * parseRentalWorkbook(buffer, { file, month }) → {
 *   offers,                       // 표준 offer[] (conditionKey 부여)
 *   supplierRules,                // 가전 수수료율 시트 결과(있을 때)
 *   sheets: [{ sheet, adapter, dataRows, offers, skipped, missingRows, errors, duplicateKeys }],
 * }
 * 검증 원칙: 값이 있는 모든 행은 offer 의 source.row 이거나 skipped 에 사유가 있어야 한다.
 */
import xlsx from 'xlsx';
import { conditionKey, hasVal, sheetBase } from './core.js';
import adapters from './adapters/index.js';

export function detectFileKind(sheetNames) {
  const bases = sheetNames.map(sheetBase).join(',');
  return /렌탈사별 수수료율|LG구독냉장고|LG헬로|스마트/.test(bases) ? 'appliance' : 'water';
}

export function parseRentalWorkbook(input, { month = null, fileKind = null } = {}) {
  const wb = xlsx.read(input, { type: Buffer.isBuffer(input) ? 'buffer' : 'array' });
  const sheetsRows = {};
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    // 항상 A1 기준으로 읽는다 → rows[i] = 엑셀 i+1행, rows[r][0] = A열 (B1·B2 에서 시작하는 시트 행번호 밀림 방지)
    const ref = ws['!ref'] ? xlsx.utils.decode_range(ws['!ref']) : null;
    sheetsRows[name] = ref
      ? xlsx.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true, blankrows: true, range: { s: { r: 0, c: 0 }, e: ref.e } })
      : [];
  }
  const file = fileKind || detectFileKind(wb.SheetNames);

  // 1) 수수료율 시트 먼저 (가전 rate 기반 리베이트 계산에 필요)
  let supplierRules = null;
  const ruleAdapter = adapters.find((a) => a.kind === 'supplier-rules' && (!a.file || a.file === file));
  for (const name of wb.SheetNames) {
    if (ruleAdapter?.match(name)) supplierRules = ruleAdapter.parse(sheetsRows[name], { sheetName: name, month, file });
  }

  const offers = [];
  const sheets = [];
  for (const name of wb.SheetNames) {
    const rows = sheetsRows[name];
    const dataRowSet = new Set();
    rows.forEach((r, i) => { if (r && r.some(hasVal)) dataRowSet.add(i + 1); });
    const adapter = adapters.find((a) => a.kind !== 'supplier-rules' && (!a.file || a.file === file) && a.match(name));
    const report = { sheet: name, base: sheetBase(name), adapter: adapter?.id || null, dataRows: dataRowSet.size, offers: 0, skipped: 0, missingRows: [], errors: [], duplicateKeys: 0 };

    if (ruleAdapter?.match(name)) {
      report.adapter = ruleAdapter.id;
      report.rules = supplierRules?.rules?.length ?? 0;
      const covered = new Set([...(supplierRules?.rules || []).map((r) => r.row), ...(supplierRules?.skipped || []).map((x) => x.row)]);
      report.skipped = supplierRules?.skipped?.length ?? 0;
      report.missingRows = [...dataRowSet].filter((r) => !covered.has(r));
      sheets.push(report);
      continue;
    }
    if (!adapter) { report.missingRows = [...dataRowSet]; sheets.push(report); continue; }

    // 어댑터가 rows 를 변형(forwardFill)할 수 있으므로 복사본 전달
    const copy = rows.map((r) => (r ? r.slice() : r));
    const { offers: sheetOffers = [], skipped = [] } = adapter.parse(copy, { sheetName: name, month, supplierRules, file });
    const covered = new Set();
    const keys = new Map();
    for (const o of sheetOffers) {
      o.condition_key = conditionKey(o);
      covered.add(o.source?.row);
      if (o._errors) report.errors.push({ row: o.source?.row, errors: o._errors });
      keys.set(o.condition_key, (keys.get(o.condition_key) || 0) + 1);
    }
    for (const s of skipped) covered.add(s.row);
    report.offers = sheetOffers.length;
    report.skipped = skipped.length;
    report.skipReasons = skipped.reduce((m, s) => { m[s.reason] = (m[s.reason] || 0) + 1; return m; }, {});
    report.missingRows = [...dataRowSet].filter((r) => !covered.has(r));
    report.duplicateKeys = [...keys.values()].filter((n) => n > 1).length;
    report.duplicateSamples = [...keys.entries()].filter(([, n]) => n > 1).slice(0, 5).map(([k]) => k);
    offers.push(...sheetOffers);
    sheets.push(report);
  }
  return { file, offers, supplierRules, sheets };
}
