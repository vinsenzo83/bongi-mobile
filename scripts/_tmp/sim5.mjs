import fs from 'fs';
const S = '/private/tmp/claude-501/-Users-vinsenzo/88fff588-4fb8-4c65-8825-95625f74aae7/scratchpad';
const offers = JSON.parse(fs.readFileSync(`${S}/sim_offers.json`, 'utf8')).filter((o) => o.rebate > 0);
const cmp = JSON.parse(fs.readFileSync(`${S}/moyo_cmp.json`, 'utf8'));
const exact = cmp.filter((r) => r.same_fee);
const moyoPct = exact.reduce((a, r) => a + r.moyo_pct_of_rebate, 0) / exact.length;
const BASE = 2300000, P = 50, s = 0.3;
const avg = (m, g) => { let b = 0, mx = 0, gd = 0; for (const o of offers) { const sp = o.rebate / 1.1; const M = Math.floor(sp * (1 - m) / 1000) * 1000; b += sp; mx += M; gd += Math.min(M, Math.floor(sp * (1 - g) / 10000) * 10000); } const n = offers.length; return { b: b / n, max: mx / n, guide: gd / n }; };
const scen = [
  { key: 'current', name: '현재 규칙', m: .10, g: .33, r: .20 },
  { key: 'reco', name: '추천안', m: .15, g: .33, r: .30 },
  { key: 'moyo', name: `모요 평균 맞춤`, m: .15, g: +(1 - moyoPct / 100).toFixed(2), r: .30 },
].map((x) => { const A = avg(x.m, x.g); const pay = A.guide + (A.max - A.guide) * s; const resid = A.max - pay; const inc = resid * x.r; const perSale = A.b - pay - inc - BASE / P; return { ...x, rebate: A.b, guide: A.guide, max: A.max, pay, inc, salary: BASE + inc * P, perSale, perSaleBeforeBase: A.b - pay - inc }; });
const vols = [100, 300, 500, 700, 1000, 1500, 2000, 3000, 5000, 7000, 10000];
const out = { moyoPct: Math.round(moyoPct), exactCount: exact.length, scen, vols, cmp };
fs.writeFileSync(`${S}/sim5.json`, JSON.stringify(out));
for (const x of scen) console.log(x.name, `가이드마진 ${x.g * 100}%`, 'guide', Math.round(x.guide), 'max', Math.round(x.max), 'pay', Math.round(x.pay), 'salary', Math.round(x.salary), 'perSale', Math.round(x.perSale), '1만건', Math.round(x.perSale * 10000 / 1e4) + '만');
console.log('moyoPct', moyoPct);
