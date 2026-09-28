import fs from 'fs'; import dotenv from 'dotenv'; import { createClient } from '@supabase/supabase-js';
const e = dotenv.parse(fs.readFileSync('.env')); const sb = createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY || e.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
const moyo = [
 ['coway','CHPI-7410N',84,'visit',446811,24450,48900,18],['coway','CHPI-7430N',84,'visit',436713,21450,42900,18],['cuckoo','CP-AMS100',72,'visit',403814,16450,32900,12],
 ['coway','CHPI-7420N',84,'visit',325934,25950,51900,18],['coway','CHP-7220N',84,'self',276342,15950,null,null],['coway','CHP-7212N',84,'self',276342,16450,32900,12],
 ['cuckoo','CDW-BS1410BDGE',72,'visit',268780,26900,null,null],['cuckoo','AC-28AH10GNW',72,'visit',238420,25110,null,null],['cuckoo','AC-30AH30FEDR',72,'visit',235824,24900,null,null],
 ['coway','P-350N',84,'self',231930,15900,null,null],['cuckoo','CP-TS100WS',72,'visit',187296,22900,null,null],['cuckoo','CBT-QSB1041W',60,'visit',179549,10950,21900,9],
 ['cuckoo','CFD-D301DCNG',60,'visit',167420,22900,null,null],['cuckoo','CBT-QSF1041W',60,'visit',165881,10450,20900,9],['cuckoo','CFD-C151MODG',48,'visit',163824,28900,null,null],['cuckoo','DH-WF21561EB',60,'visit',118990,10950,21900,6]];
const rows = [];
for (const [sup, code, months, care, support, fee, after, half] of moyo) {
  const base = code.replace(/[^A-Z0-9]/gi, '');
  const { data: models } = await sb.from('rental_cat_models').select('id, model_code, product_name').eq('supplier_id', sup).or(`model_code.ilike.%${code}%,model_key.ilike.%${base}%,product_name.ilike.%${code}%`);
  const ids = (models || []).map((m) => m.id);
  if (!ids.length) { rows.push({ code, months, moyo: support, note: '우리 카탈로그에 모델 없음' }); continue; }
  const { data: offers } = await sb.from('rental_cat_offers').select('ticket_number, contract_months, care_type, offer_type, offer_label, display_fee, monthly_fee, rebate, guide_payout, max_payout, price_phases, status').in('model_id', ids).eq('status', 'active').eq('contract_months', months);
  // 같은 약정·관리방식의 일반/반값 조건 중 리베이트 최대(=모요가 쓸 법한 최적 조건)
  const cand = (offers || []).filter((o) => o.care_type === care && !/trade_in|staff|field|purchase|prepay/.test(o.offer_type) && o.rebate);
  const pool = cand.length ? cand : (offers || []).filter((o) => o.rebate && !/trade_in|staff|field|purchase|prepay/.test(o.offer_type));
  if (!pool.length) { rows.push({ code, months, moyo: support, note: `같은 약정 판매중 조건 없음 (모델 ${ids.length})` }); continue; }
  // 모요와 같은 요금 구조(첫 달 요금·이후 요금)인 조건 우선, 없으면 리베이트 최대
  const same = pool.filter((o) => o.display_fee === fee && (after ? o.monthly_fee === after : true));
  const best = (same.length ? same : pool).sort((a, b) => b.rebate - a.rebate)[0]; const exact = same.length > 0;
  const sp = Math.round(best.rebate / 1.1);
  rows.push({ code, months, care, same_fee: exact, moyo: support, moyo_fee: `${fee}${after ? `→${after}(${half}개월)` : ''}`, ticket: best.ticket_number, our_type: best.offer_label || best.offer_type, our_fee: `${best.display_fee}${best.price_phases?.length ? `→${best.monthly_fee}` : ''}`, rebate_supply: sp, guide: best.guide_payout, max: best.max_payout, guide_vs_moyo: best.guide_payout - support, max_vs_moyo: best.max_payout - support, moyo_pct_of_rebate: Math.round(support / sp * 100) });
}
console.table(rows);
fs.writeFileSync('/private/tmp/claude-501/-Users-vinsenzo/88fff588-4fb8-4c65-8825-95625f74aae7/scratchpad/moyo_cmp.json', JSON.stringify(rows));
