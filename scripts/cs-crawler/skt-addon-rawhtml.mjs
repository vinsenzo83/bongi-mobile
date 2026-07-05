import { launch, newPage, gotoRetry } from './lib/browser.mjs';
const b=await launch(); const p=await newPage(b);
for(const code of ['F01231','F01233','F01221']){
  await gotoRetry(p,`https://m.tworld.co.kr/product/mobileplan-add/list?filters=${code}`,{waitMs:8000,retries:3});
  await p.waitForTimeout(2000);
  const html=await p.content();
  const pids=[...new Set([...html.matchAll(/prod_id=([A-Z0-9]+)/g)].map(m=>m[1]))];
  const domCount=await p.evaluate(()=>document.querySelectorAll('a[href*="prod_id="]').length);
  // embedded json state?
  const hasState=/__NEXT_DATA__|window\.__|sppsFoDtoList|prodList|advpList/.test(html);
  const total=await p.evaluate(()=>(document.body.innerText.match(/총\s*([\d,]+)\s*건/)||[])[1]);
  // 더보기 버튼 재확인 (숨김 포함)
  const moreBtns=await p.evaluate(()=>[...document.querySelectorAll('button,a')].filter(e=>/더보기|more/i.test(e.innerText||e.className)).map(e=>e.innerText.trim()||e.className).slice(0,5));
  console.error(`${code}: total=${total} DOM표시=${domCount} HTML내prod_id=${pids.length} state=${hasState} more=${JSON.stringify(moreBtns)}`);
}
await b.close();
