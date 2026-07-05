import { launch, newPage, gotoRetry } from './lib/browser.mjs';
import { writeFileSync } from 'fs';
const SC = '/private/tmp/claude-501/-Users-vinsenzo/22c2de51-dc9a-44c2-bacf-7836be4787e0/scratchpad/';
const b = await launch();
const p = await newPage(b);
await gotoRetry(p, 'https://m.tworld.co.kr/product/renewal/mobileplan/list?view=all', { waitMs: 9000, retries: 3 });
await p.waitForTimeout(2000);
// 전용 탭 클릭
await p.evaluate(() => { const btn = [...document.querySelectorAll('button.search-total-button')].find(e => e.innerText.replace(/\s+/g, ' ').trim() === '전용'); if (btn) btn.click(); });
await p.waitForTimeout(4500);
// 카테고리 아코디언(연령특화/기본표준/복지/3G/외국인/선불) 모두 펼치기
for (let round = 0; round < 8; round++) {
  await p.evaluate(() => {
    document.querySelectorAll('button, .acco-tit, [class*=acco], [role=button]').forEach(el => {
      const t = (el.innerText || '').replace(/\s+/g, ' ').trim();
      if (/연령특화|기본|표준|복지|3G|외국인|선불|자세히|더보기|펼치기/.test(t) || el.getAttribute('aria-expanded') === 'false') { try { el.click(); } catch (e) {} }
    });
  });
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(1000);
}
const cards = await p.evaluate(() => {
  const cl = s => (s || '').replace(/\s+/g, ' ').trim();
  return [...document.querySelectorAll('li.comp-list')].map(li => cl(li.innerText)).filter(t => t.length > 8);
});
writeFileSync(SC + 'skt-jeonyong.json', JSON.stringify(cards, null, 2));
console.error(`전용 li.comp-list ${cards.length}건:`);
cards.forEach(x => console.error('  ·', x.slice(0, 120)));
await b.close();
