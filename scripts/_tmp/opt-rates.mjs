import fs from 'fs'; import dotenv from 'dotenv';
Object.assign(process.env, dotenv.parse(fs.readFileSync('.env.dev')));
const { loadDataset, optimize } = await import('../../server/services/rental-margin-engine.js');
const ds = await loadDataset(); const w = (x) => Math.round(x).toLocaleString();
for (const rate of [0.2, 0.25, 0.3, 0.35, 0.4]) {
  const o = optimize(ds, { productivity: 50, discretion: 0.3, rate_tiers: [{ min: 0, rate }] });
  if (!o.ok) { console.log(rate, 'infeasible'); continue; }
  const d = o.detail.proposed;
  console.log(`배분 ${rate * 100}% | MAX ${o.best.max_margin * 100}%·하한 ${w(o.best.max_floor)} | 가이드 ${o.best.guide_margin * 100}%·하한 ${w(o.best.guide_floor)} | 가이드 ${w(d.per_sale.guide)} MAX ${w(d.per_sale.max)} | 월급 ${w(d.per_head.salary)} | 1인 회사 ${w(d.per_head.company)} | BE MAX ${d.break_even.at_max} | 경쟁 MAX승 ${o.best.competitor_max_win} 가이드↓ ${o.detail.competitor.guide_below}`);
  if (rate === 0.2) console.log('지금:', '가이드', w(o.current.per_sale.guide), 'MAX', w(o.current.per_sale.max), '월급', w(o.current.per_head.salary), '1인 회사', w(o.current.per_head.company), 'BE MAX', o.current.break_even.at_max);
}
process.exit(0);
