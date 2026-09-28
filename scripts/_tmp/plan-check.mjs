import fs from 'fs'; import dotenv from 'dotenv';
Object.assign(process.env, dotenv.parse(fs.readFileSync(process.argv[2] || '.env.dev')));
const { loadDataset, buildPayoutPlan } = await import('../../server/services/rental-margin-engine.js');
const ds = await loadDataset(); const w = (x) => Math.round(x).toLocaleString();
const t0 = Date.now();
const o = buildPayoutPlan(ds, { productivity: 50, discretion: 0.3, rate_tiers: [{ min: 0, rate: 0.3 }], current_rate: 0.2 });
console.log(`${Date.now() - t0}ms`, JSON.stringify(o.signals), JSON.stringify(o.stats));
for (const k of ['now', 'plan']) { const x = o.summary[k]; console.log(k, '가이드', w(x.guide), 'MAX', w(x.max), '고객지급', w(x.customer_pay), '인센', w(x.incentive), '회사', w(x.company), '월급', w(x.per_head.salary), '1인회사', w(x.per_head.company), 'n', x.conditions); }
for (const c of o.categories) console.log(c.category.padEnd(15), String(c.conditions).padStart(5), c.rule ? `MAX ${Math.round(c.rule.max_margin*100)}%·${w(c.rule.max_floor)} 가이드 ${Math.round(c.rule.guide_margin*100)}%·${w(c.rule.guide_floor)} | 가이드 ${w(c.now?.guide)}→${w(c.rule.guide)} 회사 ${w(c.now?.company)}→${w(c.rule.company)}` : '', c.note || '');
console.log('changes sample', JSON.stringify(o.changes.filter((c) => c.reason.includes('경쟁사')).slice(0, 6)));
const fmDown = o.changes.filter((c) => c.free_months_old != null && c.free_months_new < c.free_months_old).length;
console.log('무료개월 감소', fmDown, '증가', o.changes.filter((c) => c.free_months_old != null && c.free_months_new > c.free_months_old).length);
process.exit(0);
