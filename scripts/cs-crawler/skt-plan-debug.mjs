import { launch, newPage, gotoRetry } from './lib/browser.mjs';
const b = await launch();
const p = await newPage(b);
await gotoRetry(p, 'https://m.tworld.co.kr/product/renewal/mobileplan/list?view=all', { waitMs: 10000, retries: 3 });
await p.waitForTimeout(2000);
const n1 = await p.evaluate(() => document.querySelectorAll('li.comp-list').length);
const n2 = await p.evaluate(() => document.querySelectorAll('.comp-list').length);
console.error('li.comp-list=', n1, ' .comp-list=', n2);
// count cards with 선택약정
const cards = await p.evaluate(() => {
  const cl = s => (s||'').replace(/\s+/g,' ').trim();
  return [...document.querySelectorAll('li.comp-list')].map(li=>cl(li.innerText)).filter(t=>/선택약정 반영 시/.test(t));
});
console.error('cards with 선택약정:', cards.length);
cards.slice(0,3).forEach(c=>console.error(' -',c.slice(0,90)));
// tab elements: what tag are the tabs?
const tabsInfo = await p.evaluate(()=>{
  return ['베스트','라이트','전용','스마트기기','다이렉트'].map(lbl=>{
    const els=[...document.querySelectorAll('*')].filter(e=>(e.innerText||'').replace(/\s+/g,' ').trim()===lbl && e.children.length===0);
    return {lbl, tags: els.map(e=>e.tagName+'.'+(e.className||'')).slice(0,3)};
  });
});
console.error(JSON.stringify(tabsInfo,null,2));
await b.close();
