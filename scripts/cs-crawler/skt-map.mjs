import { launch, newPage, gotoRetry } from './lib/browser.mjs';
import { writeFileSync } from 'fs';
const SC = '/private/tmp/claude-501/-Users-vinsenzo/22c2de51-dc9a-44c2-bacf-7836be4787e0/scratchpad/';
const b = await launch();
const p = await newPage(b);

// === A) 요금제 필터 패널: 통신망(5G/LTE) 필터 코드 찾기 ===
await gotoRetry(p, 'https://m.tworld.co.kr/product/renewal/mobileplan/list?view=all', { waitMs: 9000, retries: 3 });
await p.waitForTimeout(2000);
// 필터 열기 시도
await p.evaluate(() => { const b = [...document.querySelectorAll('button,a')].find(e => /조건 설정|필터|더보기/.test(e.innerText)); if (b) b.click(); });
await p.waitForTimeout(1500);
const filters = await p.evaluate(() => {
  const cl = s => (s || '').replace(/\s+/g, ' ').trim();
  return [...document.querySelectorAll('[data-fltid],[data-filter],input[type=checkbox],label,button')]
    .map(e => ({ t: cl(e.innerText || e.value || e.getAttribute('aria-label')), fltid: e.getAttribute('data-fltid') || e.getAttribute('data-filter') || e.id }))
    .filter(x => x.t && /5G|LTE|3G|통신망|네트워크/.test(x.t) && x.t.length < 20);
});
console.error('=== 통신망 필터 후보 ===');
[...new Map(filters.map(f => [f.t + f.fltid, f])).values()].forEach(f => console.error(`  "${f.t}" id=${f.fltid}`));

// data-fltlist 전체 카드에서 network 유추: 각 카드 prodid+fltlist 덤프
const cards = await p.evaluate(() => [...document.querySelectorAll('[data-prodid]')].map(d => ({
  prodid: d.getAttribute('data-prodid'), flt: d.getAttribute('data-fltlist'),
  name: (d.querySelector('.info-name')?.innerText || '').trim()
})));
writeFileSync(SC + 'skt-card-flt.json', JSON.stringify(cards, null, 2));
console.error(`\n베스트 카드 data-fltlist 샘플:`);
cards.slice(0, 4).forEach(c => console.error(`  ${c.name} | flt=${c.flt}`));

// === B) 결합상품 공식 리스트 ===
await gotoRetry(p, 'https://m.shop.tworld.co.kr/wire/product/combinedList', { waitMs: 8000, retries: 3 });
await p.waitForTimeout(2500);
const bundleText = await p.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 1200));
console.error('\n=== SKT 결합 combinedList ===\n', bundleText);
const bundleLinks = await p.evaluate(() => [...document.querySelectorAll('a')].map(a => ({ t: (a.innerText||'').replace(/\s+/g,' ').trim(), h: a.getAttribute('href') })).filter(x => x.t && x.t.length > 2 && x.t.length < 30 && /결합|인터넷|가족|온가족|우리집|스마트/.test(x.t)));
writeFileSync(SC + 'skt-bundle-links.json', JSON.stringify(bundleLinks, null, 2));
console.error('결합 링크:', JSON.stringify(bundleLinks.slice(0, 15)));

await b.close();
