import fs from 'fs';
const offers = JSON.parse(fs.readFileSync('/private/tmp/claude-501/-Users-vinsenzo/88fff588-4fb8-4c65-8825-95625f74aae7/scratchpad/sim_offers.json', 'utf8')).filter((o) => o.rebate > 0);
const man = (n) => `${Math.round(n / 10000).toLocaleString()}만`;
const V = 1500, heads = 30, BASE = 2300000, s = .3, r = .3;
console.log('월 1,500건 · 30명 · 재량 30% · 배분 30% · MAX마진 15%');
console.log('가이드마진 | 리베이트(공급가) | 고객 지급 | 상담사 인센 | 기본급 | 회사 기여 | 비율 | 건당 고객 가이드');
for (const g of [.33, .40, .45, .50]) {
  let b = 0, pay = 0, inc = 0, gd = 0;
  for (const o of offers) { const sp = o.rebate / 1.1; const M = Math.floor(sp * .85 / 1000) * 1000; const G = Math.min(M, Math.floor(sp * (1 - g) / 10000) * 10000); const p = G + (M - G) * s; b += sp; pay += p; inc += (M - p) * r; gd += G; }
  const n = offers.length, k = V / n; const comp = (b - pay - inc) * k - BASE * heads;
  console.log(`${g * 100}% | ${man(b * k)} | ${man(pay * k)} (${(pay / b * 100).toFixed(0)}%) | ${man(inc * k)} | ${man(BASE * heads)} | ${man(comp)} | ${(comp / (b * k) * 100).toFixed(1)}% | ${Math.round(gd / n).toLocaleString()}`);
}
