import { launch, newPage, gotoRetry } from './lib/browser.mjs';
import { writeFileSync } from 'fs';
const SC='/private/tmp/claude-501/-Users-vinsenzo/22c2de51-dc9a-44c2-bacf-7836be4787e0/scratchpad/';
const b=await launch(); const p=await newPage(b);
await gotoRetry(p,'https://m.tworld.co.kr/product/mobileplan-add/list?filters=F01234',{waitMs:9000,retries:3});
await p.waitForTimeout(2500);
// 카테고리 필터 버튼 (data-device-filter-code)
const cats=await p.evaluate(()=>{
  const cl=s=>(s||'').replace(/\s+/g,' ').trim();
  return [...document.querySelectorAll('[data-device-filter-code],[data-filter-code],button.filter-btn,button.search-total-button')]
    .map(e=>({t:cl(e.innerText),code:e.getAttribute('data-device-filter-code')||e.getAttribute('data-filter-code')}))
    .filter(x=>x.t);
});
console.error('=== 부가서비스 카테고리 필터 ===');
[...new Map(cats.map(c=>[c.t+c.code,c])).values()].forEach(c=>console.error(`  "${c.t}" code=${c.code}`));
// 총건수 및 현재 필터
const total=await p.evaluate(()=>(document.body.innerText.match(/총\s*([\d,]+)\s*건/)||[])[1]);
console.error('현재 총:',total);
await b.close();
