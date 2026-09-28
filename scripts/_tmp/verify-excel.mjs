// 엑셀 원본 ↔ 라이브 DB 전수 대조
import fs from 'fs'; import dotenv from 'dotenv'; import { createClient } from '@supabase/supabase-js';
import { parseRentalWorkbook } from '../../server/services/rental-import/index.js';
const D = '/private/tmp/claude-501/-Users-vinsenzo/88fff588-4fb8-4c65-8825-95625f74aae7/scratchpad/dump';
const e = dotenv.parse(fs.readFileSync(process.argv[2] || '.env')); const sb = createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY || e.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
const parsed = [];
for (const [file, kind] of [['app.xlsx', 'appliance']]) {
  const t0 = Date.now();
  const r = parseRentalWorkbook(fs.readFileSync(`${D}/${file}`), { month: '2026-09' });
  console.log(`${file} 시트 ${r.sheets.length} · 조건 ${r.offers.length} · ${Date.now() - t0}ms`);
  const bad = r.sheets.filter((s) => s.missingRows?.length || s.errors?.length);
  if (bad.length) console.log('  ⚠ 누락·오류 시트', JSON.stringify(bad.map((s) => [s.name, s.missingRows?.length || 0, s.errors?.length || 0])));
  parsed.push(...r.offers.map((o) => ({ ...o, _file: file })));
}
fs.writeFileSync('/private/tmp/claude-501/-Users-vinsenzo/88fff588-4fb8-4c65-8825-95625f74aae7/scratchpad/parsed_offers.json', JSON.stringify(parsed));
console.log('엑셀 조건 합계', parsed.length);
let db = []; for (let i = 0; ; i += 1000) { const { data } = await sb.from('rental_cat_offers').select('condition_key, ticket_number, supplier_id, status, crm_enabled, contract_months, care_type, cycle_months, offer_type, monthly_fee, display_fee, price_phases, prepay_amount, total_fee, rebate, notes').order('id').range(i, i + 999).throwOnError(); db = db.concat(data); if (data.length < 1000) break; }
console.log('DB 조건', db.length);
const byKey = new Map(db.map((o) => [o.condition_key, o]));
const miss = parsed.filter((p) => !byKey.has(p.condition_key));
const appKeys = new Set(parsed.map((p) => p.condition_key));
const extra = db.filter((o) => o.status !== 'discontinued' && !appKeys.has(o.condition_key));
console.log('엑셀엔 있는데 DB 없음', miss.length, '· DB 판매중인데 엑셀 없음', extra.length);
if (miss.length) console.log('  예', JSON.stringify(miss.slice(0, 3).map((p) => [p.supplier, p.source?.sheet, p.source?.row, p.model_code])));
if (extra.length) console.log('  예', JSON.stringify(extra.slice(0, 3).map((o) => [o.ticket_number, o.supplier_id, o.status])));
const fields = ['contract_months', 'care_type', 'cycle_months', 'offer_type', 'monthly_fee', 'display_fee', 'prepay_amount', 'total_fee', 'rebate'];
const diff = {}; const samples = {};
for (const p of parsed) {
  const o = byKey.get(p.condition_key); if (!o) continue;
  for (const f of fields) {
    // display_fee 는 적재 때 계산된다: 1회차 요금(할인구간) 또는 월 요금
    const a = f === 'display_fee' ? ((p.price_phases || []).find((x) => x.from === 1)?.fee ?? p.monthly_fee ?? null) : (p[f] ?? null);
    const b = o[f] ?? null;
    if (String(a) !== String(b)) { diff[f] = (diff[f] || 0) + 1; (samples[f] ||= []).push([o.ticket_number, o.supplier_id, a, b]); }
  }
  const norm = (ph) => JSON.stringify((ph || []).map((x) => [x.from, x.to, x.fee]).sort((x, y) => x[0] - y[0]));
  const pj = norm(p.price_phases), oj = norm(o.price_phases);
  if (pj !== oj) { diff.price_phases = (diff.price_phases || 0) + 1; (samples.price_phases ||= []).push([o.ticket_number, o.supplier_id, pj.slice(0, 60), oj.slice(0, 60)]); }
}
console.log('\n■ 값 불일치'); console.log(JSON.stringify(diff, null, 1));
for (const [f, s] of Object.entries(samples)) console.log(` ${f} 예:`, JSON.stringify(s.slice(0, 3)));
process.exit(0);
