import { launch, newPage, gotoRetry } from './lib/browser.mjs';
import { writeFileSync } from 'fs';
const SC='/private/tmp/claude-501/-Users-vinsenzo/22c2de51-dc9a-44c2-bacf-7836be4787e0/scratchpad/';
const b=await launch(); const p=await newPage(b);
const apis=[];
p.on('response',async r=>{
  const rt=r.request().resourceType();
  if(['image','stylesheet','font','media','script'].includes(rt))return;
  try{const body=await r.text(); if(body.length<200)return;
    const t=body.trimStart(); if(!(t.startsWith('{')||t.startsWith('[')))return;
    if(/prod|Prod|advp|adsv|Nm|nm|서비스|부가|Amt|Chrg|fee/.test(body)) apis.push({url:r.url(),method:r.request().method(),len:body.length,body});
  }catch(e){}
});
await gotoRetry(p,'https://m.tworld.co.kr/product/mobileplan-add/list?filters=F01231',{waitMs:9000,retries:3});
await p.waitForTimeout(3000);
// 스크롤로 추가 로드 유도
for(let i=0;i<10;i++){await p.evaluate(()=>window.scrollBy(0,3000));await p.waitForTimeout(600);}
// 리스트 내부 컨테이너 스크롤 시도
await p.evaluate(()=>{document.querySelectorAll('[class*=list],[class*=scroll],[class*=cont]').forEach(e=>{e.scrollTop=e.scrollHeight;});});
await p.waitForTimeout(2000);
console.error('캡처 API', apis.length);
apis.sort((a,b)=>b.len-a.len).slice(0,8).forEach((a,i)=>{console.error(`[${a.len}] ${a.method} ${a.url}`); console.error('  '+a.body.slice(0,160)); writeFileSync(SC+`addon-api-${i}.json`,a.body);});
await b.close();
