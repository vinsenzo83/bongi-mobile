import { launch, newPage, gotoRetry } from './lib/browser.mjs';
const b=await launch(); const p=await newPage(b);
// 모바일 결합상품 리스트
for(const url of [
  'https://m.tworld.co.kr/product/combineProduct/list',
  'https://m.tworld.co.kr/product/combineProduct',
  'https://m.shop.tworld.co.kr/wire/product/combinedList'
]){
  const r=await gotoRetry(p,url,{waitMs:7000,retries:2});
  if(!r.ok){console.error(url,'FAIL');continue;}
  await p.waitForTimeout(2000);
  const names=await p.evaluate(()=>{
    const cl=s=>(s||'').replace(/\s+/g,' ').trim();
    const set=new Set();
    [...document.querySelectorAll('a,strong,h3,h4,.info-name,[class*=tit],[class*=name]')].forEach(e=>{const t=cl(e.innerText); if(t&&t.length<25&&/결합|가족|온가족|우리집|끼리|스마트홈|B tv|인터넷/.test(t)&&/결합|가족|끼리|우리집|플랜|스마트홈/.test(t))set.add(t);});
    return [...set];
  });
  console.error(`\n### ${url} (${r.status})`);
  names.slice(0,30).forEach(n=>console.error('  '+n));
}
await b.close();
