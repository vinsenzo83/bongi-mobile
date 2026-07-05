import { launch, newPage, gotoRetry } from './lib/browser.mjs';
import { writeFileSync } from 'fs';
const SC='/private/tmp/claude-501/-Users-vinsenzo/22c2de51-dc9a-44c2-bacf-7836be4787e0/scratchpad/';
const b=await launch(); const p=await newPage(b);
const apis=[];
p.on('response',async r=>{
  const rt=r.request().resourceType();
  if(['image','stylesheet','font','media','script'].includes(rt))return;
  try{const body=await r.text(); if(body.length<300)return;
    const t=body.trimStart(); if(!(t.startsWith('{')||t.startsWith('[')))return;
    if(/prod|Prod|Nm|fee|Amt|Chrg|data|Data|GB|benf|benefit|ott|OTT|약정|미디어|넷플|우주/.test(body)) apis.push({url:r.url(),len:body.length,body});
  }catch(e){}
});
// 베스트 89(넷플릭스)
await gotoRetry(p,'https://m.tworld.co.kr/product/callplan?prod_id=NA00009793',{waitMs:6000,retries:3});
await p.waitForTimeout(3000);
// 아코디언/더보기 펼치기
for(let i=0;i<5;i++){await p.evaluate(()=>{document.querySelectorAll('.acco-tit,button[aria-expanded="false"],[class*=acco] button,[class*=more]').forEach(e=>{try{e.click()}catch(x){}})});await p.waitForTimeout(700);}
const full=await p.evaluate(()=>{
  const cl=s=>(s||'').replace(/\s+/g,' ').trim();
  let t=cl(document.querySelector('main,#contents-area,.container')?.innerText||document.body.innerText);
  return t.slice(0,3500);
});
writeFileSync(SC+'detail-best89.txt',full);
console.error('=== 베스트89 상세 본문 ===\n'+full.slice(0,2000));
console.error('\n=== BFF JSON 후보',apis.length,'===');
apis.sort((a,b)=>b.len-a.len).slice(0,6).forEach((a,i)=>{console.error(`[${a.len}] ${a.url}`); console.error('  '+a.body.slice(0,200)); writeFileSync(SC+`detail-api-${i}.json`,a.body);});
await b.close();
