import { UA } from './lib/browser.mjs';
import { writeFileSync } from 'fs';
const SC='/private/tmp/claude-501/-Users-vinsenzo/22c2de51-dc9a-44c2-bacf-7836be4787e0/scratchpad/';
const H={'User-Agent':UA,'Accept':'application/json','Referer':'https://www.lguplus.com/support/online/faq'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// categories to crawl (telecom CS relevant)
const CATS=[
  {node:'NODE0000002623', cat:'유심(USIM) 업데이트·교체'},
  {node:'NODE0000000298', cat:'모바일'},
  {node:'NODE0000000326', cat:'인터넷/IPTV'},
  {node:'NODE0000001703', cat:'전화'},
  {node:'NODE0000000370', cat:'결합 할인'},
  {node:'NODE0000000319', cat:'해외로밍'},
];
const stripHtml=h=>(h||'').replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/&middot;/g,'·').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();

async function listPage(node,page){
  const url=`https://www.lguplus.com/uhdc/fo/cusp/onqa/v1/faq?_error=false&faqGubun=${node}&catg1=&catg2=&catg3=&catg4=&selectedCatg=&srchKeyword=&currentPage=${page}&pageSize=10`;
  const j=await (await fetch(url,{headers:H})).json();
  return j.lstErmsFaqDtlList||[];
}
async function detail(kbId){
  const j=await (await fetch(`https://www.lguplus.com/uhdc/fo/cusp/onqa/v1/faq-detl?kbId=${kbId}&logId=`,{headers:H})).json();
  return j;
}

const all=[]; const seenKb=new Set();
for(const {node,cat} of CATS){
  let page=1, prevFirst=null, got=0;
  while(page<=6){
    const list=await listPage(node,page);
    if(!list.length) break;
    if(list[0].kbId===prevFirst) break; // no more pages (same repeats)
    prevFirst=list[0].kbId;
    for(const it of list){
      if(seenKb.has(it.kbId)) continue; seenKb.add(it.kbId);
      all.push({cat, kbId:it.kbId, title:it.title, nodeName:it.nodeName, hitCount:+it.hitCount||0, pathNode:it.pathNode});
      got++;
    }
    if(list.length<10) break;
    page++; await sleep(150);
  }
  console.error(`${cat}: +${got}`);
}
console.error('총 list 수집:', all.length);

// fetch answers
for(const it of all){
  try{ const d=await detail(it.kbId); it.answer=stripHtml(d.contents); it.detailTitle=d.title; }
  catch(e){ it.answer=''; }
  await sleep(120);
}
const ok=all.filter(x=>x.answer&&x.answer.length>25);
console.error('답변 확보:', ok.length,'/',all.length);
writeFileSync(SC+'lgu-faq-raw.json', JSON.stringify(ok,null,2));
ok.slice(0,5).forEach(x=>console.error(`\n[${x.cat}] ${x.title}\n  ${x.answer.slice(0,120).replace(/\n/g,' ')}`));
