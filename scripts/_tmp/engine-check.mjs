import fs from 'fs'; import dotenv from 'dotenv';
const e = dotenv.parse(fs.readFileSync('.env.dev')); Object.assign(process.env, e);
const { loadDataset, simulate, ruleGuideMax } = await import('../../server/services/rental-margin-engine.js');
const ds = await loadDataset();
let diff = 0, n = 0; const ex = [];
for (const r of ds.rows) { if (r.guide_payout == null) continue; n++; const x = ruleGuideMax(r, { basis: 'supply', max_margin: 0.10, guide_margin: 0.33 }); if (x.guide !== r.guide_payout || x.max !== r.max_payout) { diff++; if (ex.length < 3) ex.push({ rebate: r.rebate, db: [r.guide_payout, r.max_payout], engine: [x.guide, x.max] }); } }
console.log('조건', ds.rows.length, '비교', n, '불일치', diff, JSON.stringify(ex));
const o = simulate(ds, { max_margin: 0.15, guide_margin: 0.33, rate_tiers: [{ min: 0, rate: 0.3 }], productivity: 50, discretion: 0.3 });
const w = (x) => Math.round(x).toLocaleString();
console.log('proposed 건당 회사', w(o.proposed.per_sale.company), '1인 월급', w(o.proposed.per_head.salary), '1인 회사', w(o.proposed.per_head.company), 'BE', JSON.stringify(o.proposed.break_even));
console.log('live 건당 회사', w(o.live.per_sale.company), 'BE', JSON.stringify(o.live.break_even));
console.log('competitor', JSON.stringify(o.competitor), 'matched', o.benchmarks.filter((b) => b.matched).length, o.benchmarks.filter((b) => !b.matched).map((b) => b.model_code));
process.exit(0);
