import fs from 'fs'; import dotenv from 'dotenv';
Object.assign(process.env, dotenv.parse(fs.readFileSync(process.argv[2] || '.env.dev')));
const { loadDataset, optimize } = await import('../../server/services/rental-margin-engine.js');
const ds = await loadDataset();
const w = (x) => Math.round(x).toLocaleString();
for (const c of [{}, { rate_tiers: [{ min: 0, rate: 0.25 }] }, { competitor_max_share: 0.9 }]) {
  const t0 = Date.now();
  const o = optimize(ds, { productivity: 50, discretion: 0.3, rate_tiers: [{ min: 0, rate: 0.3 }], ...c });
  if (!o.ok) { console.log(JSON.stringify(c), o.errors); continue; }
  const d = o.detail;
  console.log(JSON.stringify(c), `${Date.now() - t0}ms`, JSON.stringify(o.constraints), JSON.stringify(o.searched));
  console.log(' best', JSON.stringify({ ...o.best, company_per_head: w(o.best.company_per_head), salary: w(o.best.salary), guide_avg: w(o.best.guide_avg), max_avg: w(o.best.max_avg) }));
  console.log(' 건당 회사', w(d.proposed.per_sale.company), '고객가이드', w(d.proposed.per_sale.guide), 'MAX', w(d.proposed.per_sale.max), '월급', w(d.proposed.per_head.salary), '1인 회사', w(d.proposed.per_head.company), 'BE', JSON.stringify(d.proposed.break_even), '경쟁', JSON.stringify(d.competitor));
  console.log(' live 1인 회사', w(d.live.per_head.company), '월급', w(d.live.per_head.salary), 'BE', JSON.stringify(d.live.break_even));
}
process.exit(0);
