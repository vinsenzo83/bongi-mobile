import { launch, newPage, gotoRetry } from './lib/browser.mjs';
const b=await launch(); const p=await newPage(b);
for(const [nm,pid] of [['올인원94','NA00002502'],['베스트89','NA00009793'],['ZEM퍼펙트','NA00007492'],['Easy S','NA00009875']]){
  await gotoRetry(p,`https://m.tworld.co.kr/product/callplan?prod_id=${pid}`,{waitMs:3000,retries:2});
  const html=await p.content();
  const hits=[];
  for(const re of [/"?(networkType|netType|svcType|network|prodNetwork|telecomNetwork|mbrNetwork)"?\s*[:=]\s*"?([A-Za-z0-9가-힣]{1,8})/gi, /(5G|LTE|WCDMA|3G)[^가-힣]{0,3}(요금제|망|서비스)/g]){
    let m; let c=0; while((m=re.exec(html))&&c<4){hits.push(m[0].slice(0,40));c++;}
  }
  console.error(nm, JSON.stringify([...new Set(hits)].slice(0,8)));
}
await b.close();
