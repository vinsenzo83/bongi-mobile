import { launch, newPage, gotoRetry } from './lib/browser.mjs';
const b=await launch(); const p=await newPage(b);
for(const code of ['F01221','F01222','F01223','F01231','F01232','F01233','F01234','F01235','F01236']){
  await gotoRetry(p,`https://m.tworld.co.kr/product/mobileplan-add/list?filters=${code}`,{waitMs:7000,retries:3});
  await p.waitForTimeout(1500);
  const info=await p.evaluate(()=>{
    const cl=s=>(s||'').replace(/\s+/g,' ').trim();
    const t=cl(document.body.innerText);
    const seg=t.match(/본문시작\s*(.{0,60})/);
    // 더보기 버튼 존재?
    const more=[...document.querySelectorAll('button,a')].some(e=>/더보기/.test(e.innerText));
    const total=(t.match(/총\s*([\d,]+)\s*건/)||[])[1];
    return {seg:seg?seg[1]:'',total,more};
  });
  console.error(`${code}: total=${info.total} 더보기=${info.more} | ${info.seg}`);
}
await b.close();
