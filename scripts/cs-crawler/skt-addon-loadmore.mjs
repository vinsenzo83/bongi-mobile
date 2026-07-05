import { launch, newPage, gotoRetry } from './lib/browser.mjs';
const b=await launch(); const p=await newPage(b);
const xhrs=[];
p.on('response',async r=>{const u=r.url(); if(/mobileplan-add|advp|spps|adsv|prod.*list|list.*prod/i.test(u)&&!/\.(js|css|png|svg)/.test(u)){try{const t=await r.text();xhrs.push({u,len:t.length,s:t.slice(0,120)});}catch(e){}}});
await gotoRetry(p,'https://m.tworld.co.kr/product/mobileplan-add/list?filters=F01231',{waitMs:8000,retries:3});
await p.waitForTimeout(2000);
let last=20;
for(let i=0;i<15;i++){
  await p.evaluate(()=>{const as=document.querySelectorAll('a[href*="prod_id="]'); if(as.length)as[as.length-1].scrollIntoView({block:'end'});});
  await p.waitForTimeout(900);
  const n=await p.evaluate(()=>document.querySelectorAll('a[href*="prod_id="]').length);
  if(n>last)console.error('  grew to',n);
  last=n;
  if(n>=57)break;
}
console.error('최종 DOM count:',last);
console.error('관련 XHR:',xhrs.length);
xhrs.slice(0,6).forEach(x=>console.error(`  [${x.len}] ${x.u}\n    ${x.s}`));
await b.close();
