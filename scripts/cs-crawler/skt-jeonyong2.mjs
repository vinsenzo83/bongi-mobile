import { launch, newPage, gotoRetry } from './lib/browser.mjs';
import { writeFileSync } from 'fs';
const SC = '/private/tmp/claude-501/-Users-vinsenzo/22c2de51-dc9a-44c2-bacf-7836be4787e0/scratchpad/';
const b = await launch();
const p = await newPage(b);
await gotoRetry(p, 'https://m.tworld.co.kr/product/renewal/mobileplan/list?view=all', { waitMs: 9000, retries: 3 });
await p.waitForTimeout(2000);
await p.evaluate(() => { const btn=[...document.querySelectorAll('button.search-total-button')].find(e=>e.innerText.replace(/\s+/g,' ').trim()==='전용'); if(btn)btn.click(); });
await p.waitForTimeout(5000);
// category 카드 링크
const links = await p.evaluate(()=>[...document.querySelectorAll('a')].map(a=>({t:(a.innerText||'').replace(/\s+/g,' ').trim(), h:a.getAttribute('href')})).filter(x=>x.h&&/category|ctgCd|mobileplan/.test(x.h)));
console.error('전용 카테고리 링크:'); links.forEach(l=>console.error('  ',l.t.slice(0,50),'->',l.h));
// 그리고 개별 plan 카드 (선택약정 or 월 X원)
const cards = await p.evaluate(()=>{const cl=s=>(s||'').replace(/\s+/g,' ').trim(); return [...document.querySelectorAll('li.comp-list')].map(li=>cl(li.innerText)).filter(t=>t.length>8);});
console.error('\n전용 li.comp-list:', cards.length); cards.forEach(x=>console.error('  ·',x.slice(0,110)));
writeFileSync(SC+'skt-jeonyong-links.json', JSON.stringify(links,null,2));
await b.close();
