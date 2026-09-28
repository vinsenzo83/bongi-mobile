import fs from 'fs';
const offers = JSON.parse(fs.readFileSync('/private/tmp/claude-501/-Users-vinsenzo/88fff588-4fb8-4c65-8825-95625f74aae7/scratchpad/sim_offers.json', 'utf8')).filter((o) => o.rebate > 0);
const won = (n) => Math.round(n).toLocaleString();
const BASE = 2300000;
// 건당 평균 (조건 5.5만 건 균등 가정)
const avg = (m, g) => { let b = 0, mx = 0, gd = 0; for (const o of offers) { const s = o.rebate / 1.1; const M = Math.floor(s * (1 - m) / 1000) * 1000; b += s; mx += M; gd += Math.min(M, Math.floor(s * (1 - g) / 10000) * 10000); } const n = offers.length; return { b: b / n, max: mx / n, guide: gd / n }; };
const A = avg(0.10, 0.33);
console.log(`건당 평균: 공급가 리베이트 ${won(A.b)} · 가이드 ${won(A.guide)} · MAX ${won(A.max)} · 재량구간 ${won(A.max - A.guide)}\n`);
// 배분율: 고정 20% vs 개인 월 설치 누진(G1~G5)
const tiered = (n) => (n >= 80 ? .40 : n >= 60 ? .35 : n >= 40 ? .30 : n >= 20 ? .25 : .20);
function run(V, P, s, rateFn) {
  const heads = Math.ceil(V / P); const per = V / heads; const r = rateFn(per);
  const pay = A.guide + (A.max - A.guide) * s; const resid = A.max - pay;
  const coun = resid * r * V; const comp = (A.b - pay) * V - coun - BASE * heads;
  return { heads, per, r, salary: BASE + resid * r * per, comp, perSale: comp / V, pct: comp / (A.b * V) * 100 };
}
for (const [label, fn] of [['고정 20%', () => .2], ['누진(월 20건↑25%·40↑30%·60↑35%·80↑40%)', tiered]]) {
  console.log(`■ 배분율 ${label}`);
  for (const P of [30, 50, 70]) for (const s of [0.3]) {
    console.log(` 1인 생산성 월 ${P}건 · 재량구간 ${s * 100}% 사용`);
    console.log('  월 설치 | 상담사 | 배분율 | 1인 월급 | 회사 기여(운영비 전) | 건당 회사 | 리베이트 대비');
    for (const V of [100, 300, 500, 700, 1000, 1500]) { const x = run(V, P, s, fn); console.log(`  ${V}건 | ${x.heads}명 | ${x.r * 100}% | ${won(x.salary)} | ${won(x.comp)} | ${won(x.perSale)} | ${x.pct.toFixed(1)}%`); }
  }
  console.log();
}
// 재량을 더 쓰면 판매가 얼마나 늘어야 회사가 손해 없나
console.log('■ 재량구간을 더 쓸 때 회사 기여가 같아지려면 필요한 판매 증가 (기본급 제외, 배분 20%)');
const per = (s, r) => { const pay = A.guide + (A.max - A.guide) * s; return A.b - pay - (A.max - pay) * r; };
for (const s of [.25, .5, 1]) console.log(`  가이드만 → ${s * 100}% 사용: 건당 회사 ${won(per(0, .2))} → ${won(per(s, .2))} · 판매 +${((per(0, .2) / per(s, .2) - 1) * 100).toFixed(0)}% 필요`);

console.log('\n■ 제안 비교 — MAX마진 20%·가이드마진 35% + 누진 배분율, 재량 30% 사용');
const B = avg(0.20, 0.35);
console.log(` 건당 평균: 가이드 ${won(B.guide)} (현재 ${won(A.guide)}) · MAX ${won(B.max)} (현재 ${won(A.max)}) · 재량구간 ${won(B.max - B.guide)}`);
for (const P of [30, 50, 70]) {
  console.log(` 1인 월 ${P}건`); console.log('  월 설치 | 상담사 | 배분율 | 1인 월급 | 회사 기여 | 리베이트 대비');
  for (const V of [100, 300, 500, 700, 1000, 1500]) {
    const heads = Math.ceil(V / P), per = V / heads, r = tiered(per), pay = B.guide + (B.max - B.guide) * .3, resid = B.max - pay;
    const comp = (B.b - pay) * V - resid * r * V - BASE * heads;
    console.log(`  ${V}건 | ${heads}명 | ${r * 100}% | ${won(BASE + resid * r * per)} | ${won(comp)} | ${(comp / (B.b * V) * 100).toFixed(1)}%`);
  }
}
