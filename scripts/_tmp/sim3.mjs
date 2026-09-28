import fs from 'fs';
const offers = JSON.parse(fs.readFileSync('/private/tmp/claude-501/-Users-vinsenzo/88fff588-4fb8-4c65-8825-95625f74aae7/scratchpad/sim_offers.json', 'utf8')).filter((o) => o.rebate > 0);
const won = (n) => Math.round(n).toLocaleString(); const man = (n) => `${(n / 10000).toFixed(0)}만`;
const BASE = 2300000, P = 50;
const avg = (m, g) => { let b = 0, mx = 0, gd = 0; for (const o of offers) { const s = o.rebate / 1.1; const M = Math.floor(s * (1 - m) / 1000) * 1000; b += s; mx += M; gd += Math.min(M, Math.floor(s * (1 - g) / 10000) * 10000); } const n = offers.length; return { b: b / n, max: mx / n, guide: gd / n }; };
const calc = (A, s, r) => { const pay = A.guide + (A.max - A.guide) * s, resid = A.max - pay; return { pay, coun: resid * r, comp: A.b - pay - resid * r }; };
console.log(`목표 1인 월 ${P}건 · 기본급 건당 ${won(BASE / P)}원 · 운영비 미포함\n`);
console.log('■ 규칙별 (1인 50건) — 재량 사용 0% / 30% / 100%(MAX까지)');
console.log('MAX마진 | 가이드마진 | 배분율 | 고객 가이드 | 고객 MAX | 상담사 월급 (0%/30%) | 1인당 회사 월 기여 (0%/30%/100%)');
const rows = [];
for (const m of [.10, .12, .15, .18, .20]) for (const g of [.30, .33, .35]) for (const r of [.20, .30]) {
  const A = avg(m, g); const x0 = calc(A, 0, r), x3 = calc(A, .3, r), x10 = calc(A, 1, r);
  const c = (x) => x.comp * P - BASE;
  rows.push({ m, g, r, A, sal0: BASE + x0.coun * P, sal3: BASE + x3.coun * P, c0: c(x0), c3: c(x3), c10: c(x10) });
  console.log(`${m * 100}% | ${g * 100}% | ${r * 100}% | ${won(A.guide)} | ${won(A.max)} | ${man(BASE + x0.coun * P)} / ${man(BASE + x3.coun * P)} | ${man(c(x0))} / ${man(c(x3))} / ${man(c(x10))}`);
}
fs.writeFileSync('/private/tmp/claude-501/-Users-vinsenzo/88fff588-4fb8-4c65-8825-95625f74aae7/scratchpad/sim3.json', JSON.stringify(rows));
// 추천 후보: MAX까지 다 써도 1인 기여 ≥ 0, 그중 고객 MAX 가장 큰 것
console.log('\n■ MAX까지 다 써도 기본급 회수(1인 기여 ≥ 0) 되는 최소 MAX마진');
for (const r of [.2, .3]) for (const g of [.33, .35]) { const ok = rows.filter((x) => x.r === r && x.g === g && x.c10 >= 0).sort((a, b) => a.m - b.m)[0]; console.log(`배분 ${r * 100}% · 가이드마진 ${g * 100}% → ${ok ? ok.m * 100 + '% (고객 MAX ' + won(ok.A.max) + ')' : '없음'}`); }
