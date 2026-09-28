import fs from 'fs'; import dotenv from 'dotenv';
Object.assign(process.env, dotenv.parse(fs.readFileSync(process.argv[2] || '.env.dev')));
const { loadDataset, resetDatasetCache, buildPayoutPlan } = await import('../../server/services/rental-margin-engine.js');
const { supabase } = await import('../../server/db/supabase.js');
resetDatasetCache(); const ds = await loadDataset();
const s = await supabase.from('rental_engine_settings').select('policy').eq('id', 1).single();
const plan = buildPayoutPlan(ds, s.data.policy);
// 적용 뒤 다시 돌리면 변경할 게 거의 없어야 한다 (멱등)
console.log('재실행 변경', plan.changes.length, JSON.stringify(plan.stats));
const bad = ds.rows.filter((r) => r.guide_payout == null || r.max_payout < r.guide_payout || r.guide_payout % 10000);
console.log('규칙 위반(가이드 만원·MAX≥가이드)', bad.length);
const floorViol = ds.rows.filter((r) => { const b = Math.round(r.rebate / 1.1); return b - r.max_payout < 46000 - 1000; }).length;
console.log('MAX 인건비 하한 미달 조건', floorViol, '(카테고리 예외 포함)');
const w = (x) => Math.round(x).toLocaleString(); const x = plan.summary.now;
console.log('현재(적용 후) 가이드', w(x.guide), 'MAX', w(x.max), '1인 회사(배분 20% 기준 계산)', w(x.per_head.company));
for (const t of ['R006246', 'R006283', 'R008528', 'R007685']) { const r = ds.rows.find((y) => y.ticket === t); console.log(t, r.guide_payout, r.max_payout, r.payout_updated_by); }
const { count } = await supabase.from('rental_cat_offer_changes').select('id', { count: 'exact', head: true }).eq('run_id', process.argv[3]);
console.log('변경 로그', count);
process.exit(0);
