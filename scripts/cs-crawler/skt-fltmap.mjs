import { launch, newPage, gotoRetry } from './lib/browser.mjs';
import { writeFileSync } from 'fs';
const SC = '/private/tmp/claude-501/-Users-vinsenzo/22c2de51-dc9a-44c2-bacf-7836be4787e0/scratchpad/';
const TABS = { '베스트':'F02087','라이트':'F02088','스마트기기':'F02089','전용':'F02100','다이렉트':'F02101' };
const b = await launch();
const p = await newPage(b);
const all = [];
for (const [tab, f] of Object.entries(TABS)) {
  await gotoRetry(p, `https://m.tworld.co.kr/product/renewal/mobileplan/list?filters=${f}&istabmove=Y&view=all`, { waitMs: 8000, retries: 3 });
  await p.waitForTimeout(2500);
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(1200);
  const cards = await p.evaluate(() => [...document.querySelectorAll('[data-prodid]')].map(d => ({
    prodid: d.getAttribute('data-prodid'), flt: d.getAttribute('data-fltlist'),
    grp: d.getAttribute('data-prodgrpid'),
    name: (d.querySelector('.info-name')?.innerText || '').replace(/\s+/g,' ').trim()
  })).filter(x => x.name));
  cards.forEach(c => all.push({ ...c, tab }));
  console.error(`[${tab}] ${cards.length}`);
}
// dedup by name
const seen = new Set(); const uniq = [];
for (const c of all) { if (seen.has(c.name)) continue; seen.add(c.name); uniq.push(c); }
writeFileSync(SC + 'skt-fltmap.json', JSON.stringify(uniq, null, 2));

// 코드 빈도: 알려진 5G(다이렉트5G) vs LTE(다이렉트LTE, LTE Watch, 올인원, 무료음성)
const codeStat = {};
for (const c of uniq) {
  const is5G = /5G/.test(c.name);
  const isLTE = /LTE/.test(c.name);
  (c.flt || '').split(',').forEach(code => {
    if (!code) return;
    codeStat[code] = codeStat[code] || { total:0, has5Gname:0, hasLTEname:0 };
    codeStat[code].total++;
    if (is5G) codeStat[code].has5Gname++;
    if (isLTE) codeStat[code].hasLTEname++;
  });
}
console.error('\n=== 코드별 통계 (5G명/LTE명 포함수) ===');
Object.entries(codeStat).sort((a,b)=>b[1].total-a[1].total).forEach(([code,s])=>console.error(`  ${code}: total=${s.total} 5G명=${s.has5Gname} LTE명=${s.hasLTEname}`));
// 다이렉트5G 62 vs 다이렉트LTE 22 vs 올인원 94 의 flt 비교
['다이렉트5G 62','다이렉트LTE 22','LTE Watch(단독)','올인원 94','베스트 89(넷플릭스)','ZEM플랜 퍼펙트','Easy S'].forEach(nm=>{
  const c = uniq.find(x=>x.name===nm); console.error(`  ${nm}: flt=${c?.flt} grp=${c?.grp}`);
});
await b.close();
