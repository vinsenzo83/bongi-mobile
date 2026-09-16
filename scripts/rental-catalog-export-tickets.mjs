// 렌탈 조건 티켓 목록 엑셀 내보내기: node scripts/rental-catalog-export-tickets.mjs --env .env.dev --out <xlsx>
import fs from 'fs'; import dotenv from 'dotenv'; import xlsx from 'xlsx'; import { createClient } from '@supabase/supabase-js';
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const env = dotenv.parse(fs.readFileSync(arg('--env')));
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const TYPE = { normal: '일반', package: '패키지', bundle: '결합', trade_in: '타사보상', half: '반값', prepay: '선납', promo: '프로모션', special: '특가', field: '현장', staff: '임직원', purchase: '일시불' };
const CARE = { visit: '방문', self: '자가', delivery: '택배', none: '관리없음' };
const STATUS = { active: '판매중', paused: '일시중단', discontinued: '판매종료' };
const rows = [];
for (let from = 0; ; from += 1000) {
  const { data } = await sb.from('rental_cat_offers')
    .select('ticket_number, status, supplier:rental_cat_suppliers(name), model:rental_cat_models(model_code, product_name, brand, category_raw), variant_code, contract_months, obligation_months, ownership_months, care_type, care_label, cycle_months, offer_type, offer_tags, offer_label, display_fee, monthly_fee, price_phases, prepay_amount, rebate, guide_payout, max_payout, free_months, notes, source')
    .order('ticket_number').range(from, from + 999).throwOnError();
  rows.push(...data);
  if (data.length < 1000) break;
}
const out = rows.map((r) => ({
  티켓번호: r.ticket_number, 상태: STATUS[r.status] || r.status, 렌탈사: r.supplier?.name, 제품군: r.model?.category_raw,
  모델코드: r.model?.model_code, 상품명: r.model?.product_name, 세부코드: r.variant_code,
  약정: r.contract_months, 의무: r.obligation_months, 소유권: r.ownership_months,
  관리: CARE[r.care_type] || '', 관리원문: r.care_label, 방문주기: r.cycle_months,
  할인유형: TYPE[r.offer_type] || r.offer_type, 태그: (r.offer_tags || []).join(','), 프로모션원문: r.offer_label,
  표시월요금: r.display_fee, 기준월요금: r.monthly_fee,
  할인구간: (r.price_phases || []).map((p) => `${p.from}~${p.to}개월 ${p.fee}`).join(' / '),
  선납금: r.prepay_amount, 리베이트: r.rebate, 가이드: r.guide_payout, MAX: r.max_payout, 무료개월: r.free_months,
  비고: r.notes, 원본: `${r.source?.sheet} ${r.source?.row}행`,
}));
const wb = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(out), '조건별 티켓');
xlsx.writeFile(wb, arg('--out'));
console.log('rows', out.length);
process.exit(0);
