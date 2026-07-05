import { UA } from './lib/browser.mjs';
const pid='NA00009793';
const base='https://www.tworld.co.kr/core-product/v1';
const h={'User-Agent':UA,'Accept':'application/json','Referer':`https://m.tworld.co.kr/product/callplan?prod_id=${pid}`};
for(const path of [`ledger/${pid}/summaries`,`ledger/${pid}/contents`,`benefits/${pid}/base`]){
  try{
    const r=await fetch(`${base}/${path}?_=${Date.now()}`,{headers:h});
    const t=await r.text();
    console.error(`${path}: status=${r.status} len=${t.length} ok=${t.slice(0,20).includes('code')}`);
  }catch(e){console.error(path,'ERR',e.message);}
}
