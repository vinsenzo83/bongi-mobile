import { launch, newPage, gotoRetry } from './lib/browser.mjs';
const b = await launch();
for (const tab of ['베스트','라이트','전용','스마트기기','다이렉트']) {
  const p = await newPage(b);
  await gotoRetry(p, 'https://m.tworld.co.kr/product/renewal/mobileplan/list?view=all', { waitMs: 8000, retries: 3 });
  await p.waitForTimeout(1500);
  await p.evaluate((label)=>{ const btn=[...document.querySelectorAll('button.search-total-button')].find(e=>(e.innerText||'').replace(/\s+/g,' ').trim()===label); if(btn)btn.click();}, tab);
  await p.waitForTimeout(4000);
  console.error(tab, '->', await p.evaluate(()=>location.href));
  await p.close();
}
await b.close();
