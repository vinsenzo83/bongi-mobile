import { launch, newPage, gotoRetry } from './lib/browser.mjs';
const b = await launch();
const p = await newPage(b);
await gotoRetry(p, 'https://m.tworld.co.kr/product/renewal/mobileplan/list?view=all', { waitMs: 10000, retries: 3 });
await p.waitForTimeout(2500);
for (const tab of ['라이트','다이렉트','전용']) {
  const ok = await p.evaluate((label)=>{ const btn=[...document.querySelectorAll('button.search-total-button')].find(e=>(e.innerText||'').replace(/\s+/g,' ').trim()===label); if(btn){btn.click();return btn.outerHTML.slice(0,200);} return null;}, tab);
  await p.waitForTimeout(5000);
  const st = await p.evaluate(()=>{
    const cl=s=>(s||'').replace(/\s+/g,' ').trim();
    return { url: location.href, liComp: document.querySelectorAll('li.comp-list').length,
      head: cl(document.body.innerText).slice(0,350),
      classes: [...new Set([...document.querySelectorAll('ul li')].map(l=>l.className).filter(Boolean))].slice(0,15) };
  });
  console.error(`\n===== ${tab} (btn=${ok?'y':'n'}) =====`);
  console.error(JSON.stringify(st,null,2));
}
await b.close();
