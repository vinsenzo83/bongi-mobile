import { launch, newPage, gotoRetry } from './lib/browser.mjs';
const b=await launch(); const p=await newPage(b);
let cap={};
p.on('response',async r=>{const u=r.url(); const m=u.match(/ledger\/([A-Z0-9]+)\/summaries/); if(!m)return; try{cap[m[1]]=JSON.parse(await r.text()).result;}catch(e){}});
// 라이트 59 base = NA00009785
for(const [nm,id] of [['라이트 59(base)','NA00009785']]){
  cap={};
  await gotoRetry(p,`https://m.tworld.co.kr/product/callplan?prod_id=${id}`,{waitMs:3500,retries:3});
  await p.waitForTimeout(1500);
  const s=cap[id]; if(!s){console.error(nm,'no BFF');continue;}
  console.error(`${nm} (${id}): prodNm=${s.prodNm} 공시=${s.basFeeInfo} 선택약정=${s.selAgrmtAplyMfixAmt} 데이터=${s.basOfrGbDataQtyCtt} 테더링=${s.shrDataQtyCtt}`);
}
await b.close();
