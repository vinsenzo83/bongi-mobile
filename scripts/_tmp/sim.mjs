import fs from 'fs';
const offers = JSON.parse(fs.readFileSync('/private/tmp/claude-501/-Users-vinsenzo/88fff588-4fb8-4c65-8825-95625f74aae7/scratchpad/sim_offers.json', 'utf8')).filter((o) => o.rebate > 0);
const q = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor((s.length - 1) * p)]; };
const won = (n) => Math.round(n).toLocaleString();
const supply = offers.map((o) => o.rebate / 1.1);
console.log(`조건 ${offers.length}건 · 공급가 리베이트 P25 ${won(q(supply, .25))} / 중앙 ${won(q(supply, .5))} / P75 ${won(q(supply, .75))} / 평균 ${won(supply.reduce((a, b) => a + b, 0) / supply.length)}`);
console.log(`가이드 중앙 ${won(q(offers.map((o) => o.guide_payout), .5))} · MAX 중앙 ${won(q(offers.map((o) => o.max_payout), .5))}\n`);

// 규칙(마진) 적용: 조건마다 가이드·MAX 재계산
const rule = (o, m, g) => { const b = o.rebate / 1.1; const max = Math.floor(b * (1 - m) / 1000) * 1000; const guide = Math.min(max, Math.floor(b * (1 - g) / 10000) * 10000); return { b, max, guide }; };
// 한 건 평균: s = 가이드~MAX 구간에서 고객에게 얹어 준 비율(0=가이드만, 1=MAX)
function perSale(m, g, s, r) {
  let comp = 0, coun = 0, pay = 0;
  for (const o of offers) { const { b, max, guide } = rule(o, m, g); const p = guide + (max - guide) * s; const resid = max - p; coun += resid * r; comp += b - p - resid * r; pay += p; }
  const n = offers.length; return { comp: comp / n, coun: coun / n, pay: pay / n };
}
const BASE = 2300000;
function month(m, g, s, r, n) { const x = perSale(m, g, s, r); return { 상담사월급: BASE + x.coun * n, 회사기여: x.comp * n - BASE, 건당고객지급: x.pay, 건당상담사: x.coun, 건당회사: x.comp }; }

console.log('■ 1. 현재 규칙(MAX마진 10%·가이드마진 33%) — 건당 평균');
console.log('얹어준 비율 | 고객 지급 | 상담사(20%) | 상담사(40%) | 회사(20%) | 회사(40%)');
for (const s of [0, .25, .5, .75, 1]) { const a = perSale(.10, .33, s, .2), c = perSale(.10, .33, s, .4); console.log(`${String(s * 100).padStart(3)}% | ${won(a.pay)} | ${won(a.coun)} | ${won(c.coun)} | ${won(a.comp)} | ${won(c.comp)}`); }

console.log('\n■ 2. 상담사 1명 월간 (현재 규칙) — 회사기여 = 회사 몫 합계 − 기본급 (운영비 전)');
console.log('월 설치 | 얹은비율 | 배분율 | 상담사 월급 | 회사 기여');
for (const n of [20, 40, 60, 80]) for (const s of [0, .5]) for (const r of [.2, .3, .4]) { const x = month(.10, .33, s, r, n); console.log(`${n}건 | ${s * 100}% | ${r * 100}% | ${won(x.상담사월급)} | ${won(x.회사기여)}`); }

console.log('\n■ 3. 기본급 회수 손익분기 건수 (현재 규칙)');
for (const s of [0, .5, 1]) for (const r of [.2, .4]) { const x = perSale(.10, .33, s, r); console.log(`얹은 ${s * 100}% · 배분 ${r * 100}% → 건당 회사 ${won(x.comp)} → ${Math.ceil(BASE / x.comp)}건`); }

console.log('\n■ 4. 규칙 비교 — 월 40건·얹은비율 50% 기준');
console.log('MAX마진 | 가이드마진 | 배분율 | 건당 고객지급 | 상담사 월급 | 회사 기여');
for (const [m, g] of [[.10, .33], [.15, .33], [.10, .25], [.15, .30], [.20, .35]]) for (const r of [.2, .3, .4]) { const x = month(m, g, .5, r, 40); console.log(`${m * 100}% | ${g * 100}% | ${r * 100}% | ${won(x.건당고객지급)} | ${won(x.상담사월급)} | ${won(x.회사기여)}`); }
