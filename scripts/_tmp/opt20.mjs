import fs from 'fs'; import dotenv from 'dotenv';
Object.assign(process.env, dotenv.parse(fs.readFileSync('.env.dev')));
const { loadDataset, optimize } = await import('../../server/services/rental-margin-engine.js');
const ds = await loadDataset(); const w = (x) => Math.round(x).toLocaleString();
for (const c of [{ salary_min: 2939529 * 0.99 }, { salary_min: 2939529 * 0.97 }, { competitor_max_share: 0.75 }, { competitor_guide_share: 0.5 }]) {
  const o = optimize(ds, { productivity: 50, discretion: 0.3, rate_tiers: [{ min: 0, rate: 0.2 }], ...c });
  if (!o.ok) { console.log(JSON.stringify(c), 'infeasible'); continue; }
  const d = o.detail.proposed, cur = o.current;
  console.log(JSON.stringify(c), `MAX ${Math.round(o.best.max_margin * 100)}%·${w(o.best.max_floor)} 가이드 ${Math.round(o.best.guide_margin * 100)}%·${w(o.best.guide_floor)} | 가이드 ${w(d.per_sale.guide)}(${w(cur.per_sale.guide)}) MAX ${w(d.per_sale.max)}(${w(cur.per_sale.max)}) 월급 ${w(d.per_head.salary)}(${w(cur.per_head.salary)}) 1인회사 ${w(d.per_head.company)}(${w(cur.per_head.company)}) BE-MAX ${d.break_even.at_max}(${cur.break_even.at_max}) MAX승 ${o.best.competitor_max_win} 가이드↓${o.detail.competitor.guide_below}`);
}
process.exit(0);
