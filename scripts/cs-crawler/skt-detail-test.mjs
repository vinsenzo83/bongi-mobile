import { launch, newPage, gotoRetry, mainText } from './lib/browser.mjs';
import { readFileSync } from 'fs';
const SC='/private/tmp/claude-501/-Users-vinsenzo/22c2de51-dc9a-44c2-bacf-7836be4787e0/scratchpad/';
const flt=JSON.parse(readFileSync(SC+'skt-fltmap.json','utf8'));
const pick=n=>flt.find(x=>x.name===n);
const b=await launch(); const p=await newPage(b);
for(const nm of ['올인원 94','베스트 89(넷플릭스)','ZEM플랜 퍼펙트','표준요금제','Easy S','함께쓰기','스마트폰 함께쓰기']){
  const c=pick(nm); if(!c){console.error(nm,'no prodid');continue;}
  await gotoRetry(p,`https://m.tworld.co.kr/product/callplan?prod_id=${c.prodid}`,{waitMs:3000,retries:3});
  const info=await p.evaluate(()=>{
    const cl=s=>(s||'').replace(/\s+/g,' ').trim();
    // 네트워크 배지/브레드크럼/타이틀
    const badge=[...document.querySelectorAll('*')].map(e=>cl(e.innerText)).filter(t=>/^(5G|LTE|3G|4G|5G\/LTE)$/.test(t))[0];
    const title=document.title;
    const meta=[...document.querySelectorAll('[class*=network],[class*=badge],[class*=tag],[class*=chip]')].map(e=>cl(e.innerText)).filter(Boolean).slice(0,5);
    const head=cl(document.body.innerText).slice(0,180);
    return {badge,title,meta,head};
  });
  console.error(`\n### ${nm} (${c.prodid})`);
  console.error('  badge=',info.badge,'| title=',info.title);
  console.error('  meta=',JSON.stringify(info.meta));
  console.error('  head=',info.head);
}
await b.close();
