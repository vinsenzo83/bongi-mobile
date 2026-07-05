import { launch, newPage, gotoRetry } from './lib/browser.mjs';
import { readFileSync } from 'fs';
const SC='/private/tmp/claude-501/-Users-vinsenzo/22c2de51-dc9a-44c2-bacf-7836be4787e0/scratchpad/';
const fmap=JSON.parse(readFileSync(SC+'skt-fltmap.json','utf8'));
const pid=n=>{const f=fmap.find(x=>x.name===n||x.name.startsWith(n));return f&&f.prodid;};
const b=await launch(); const p=await newPage(b);
let cap={};
p.on('response',async r=>{const u=r.url(); if(!/core-product\/v1\/ledger\/.*\/summaries/.test(u))return; try{cap[u.match(/ledger\/([A-Z0-9]+)/)[1]]=JSON.parse(await r.text()).result;}catch(e){}});
for(const nm of ['라이트 59','다이렉트5G 55','5G 시니어 B형']){
  const id=pid(nm); if(!id){console.error(nm,'no pid');continue;}
  cap={};
  await gotoRetry(p,`https://m.tworld.co.kr/product/callplan?prod_id=${id}`,{waitMs:3500,retries:3});
  await p.waitForTimeout(1500);
  const s=cap[id];
  if(!s){console.error(nm,'(',id,') no BFF');continue;}
  console.error(`${nm} (${id}): 공시=${s.basFeeInfo} 선택약정=${s.selAgrmtAplyMfixAmt} 데이터=${s.basOfrGbDataQtyCtt} 음성=${s.basOfrVcallTmsCtt} 문자=${s.basOfrCharCntCtt} 테더링=${s.shrDataQtyCtt}`);
}
await b.close();
