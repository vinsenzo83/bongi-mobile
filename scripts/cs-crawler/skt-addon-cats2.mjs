import { launch, newPage, gotoRetry } from './lib/browser.mjs';
import { writeFileSync } from 'fs';
const SC='/private/tmp/claude-501/-Users-vinsenzo/22c2de51-dc9a-44c2-bacf-7836be4787e0/scratchpad/';
const b=await launch(); const p=await newPage(b);
await gotoRetry(p,'https://m.tworld.co.kr/product/mobileplan-add/list?filters=F01234',{waitMs:9000,retries:3});
await p.waitForTimeout(2000);
// 카테고리 선택 UI 열기
for(const l of ['카테고리','통화/메시지','전체','필터','분류']){
  await p.evaluate((x)=>{const e=[...document.querySelectorAll('button,a,span,div')].find(el=>(el.innerText||'').replace(/\s+/g,' ').trim()===x);if(e)e.click();},l);
  await p.waitForTimeout(1000);
}
// 모든 filter-code 속성 + 텍스트
const opts=await p.evaluate(()=>{
  const cl=s=>(s||'').replace(/\s+/g,' ').trim();
  const out=[];
  document.querySelectorAll('*').forEach(e=>{
    for(const a of e.attributes||[]){
      if(/filter-code|fltid|filter-id|data-code/i.test(a.name) && /^F\d/.test(a.value)){
        out.push({t:cl(e.innerText).slice(0,20),attr:a.name,code:a.value});
      }
    }
  });
  return out;
});
console.error('=== filter-code 속성 전량 ===');
[...new Map(opts.map(o=>[o.code+o.t,o])).values()].forEach(o=>console.error(`  "${o.t}" ${o.attr}=${o.code}`));
// 링크 기반 카테고리
const links=await p.evaluate(()=>[...document.querySelectorAll('a[href*="mobileplan-add"]')].map(a=>({t:(a.innerText||'').replace(/\s+/g,' ').trim(),h:a.getAttribute('href')})));
console.error('\n=== mobileplan-add 링크 ===');
[...new Map(links.map(l=>[l.h,l])).values()].slice(0,20).forEach(l=>console.error(`  "${l.t}" ${l.h}`));
await b.close();
