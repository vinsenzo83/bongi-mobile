import { readFileSync, writeFileSync } from 'fs';
const SC='/private/tmp/claude-501/-Users-vinsenzo/22c2de51-dc9a-44c2-bacf-7836be4787e0/scratchpad/';
const d=JSON.parse(readFileSync(SC+'skt-addons-full.json','utf8'));
const sq=s=>s==null?'NULL':"'"+String(s).replace(/'/g,"''")+"'";
function parse(o){
  const t=o.text.replace(/\s+/g,' ').trim();
  const fm=t.match(/([\d,]+)\s*원/);
  const fee=fm?parseInt(fm[1].replace(/,/g,''),10):(/무료/.test(t.split('#')[0])?0:null);
  const name=(fm?t.slice(0,fm.index):t.split('#')[0]).trim();
  const tags=[...t.matchAll(/#([^\s#]+)/g)].map(m=>m[1]);
  const lastHash=t.lastIndexOf('#');
  let desc=lastHash>=0?t.slice(lastHash).replace(/^#[^\s#]+\s*/,'').trim():null;
  if(!desc||desc.length<3)desc=null; if(desc)desc=desc.slice(0,180);
  const ts=tags.join(',');
  let cat='etc';
  if(/데이터/.test(ts))cat='data';
  else if(/안심\/보험/.test(ts))cat='safe';
  else if(/콘텐츠이용/.test(ts))cat='content';
  else if(/인증\/결제/.test(ts))cat='payment';
  else if(/통화\/메시지/.test(ts))cat='call';
  else if(/혜택\/편의/.test(ts))cat='benefit';
  return {name,fee,cat,desc,pid:o.pid};
}
const seen=new Set(); const uniq=[];
for(const o of d){const r=parse(o); if(!r.name||r.name.length>45)continue; if(seen.has(r.name))continue; seen.add(r.name); uniq.push(r);}
writeFileSync(SC+'skt-vas-all-parsed.json',JSON.stringify(uniq,null,2));
const catc={}; uniq.forEach(x=>catc[x.cat]=(catc[x.cat]||0)+1);
console.error('파싱 고유:',uniq.length,'/ 원본',d.length,'| 카테고리:',JSON.stringify(catc));
console.error('fee null:',uniq.filter(x=>x.fee==null).length);

const COLS='carrier,category,name,fee_type,fee,description,source_url';
function row(p){
  const ft=p.fee==null?"NULL":(p.fee===0?"'free'":"'monthly'");
  const url=p.pid?`https://m.tworld.co.kr/product/callplan?prod_id=${p.pid}`:'https://m.tworld.co.kr/product/mobileplan-add/list';
  return `('SKT',${sq(p.cat)},${sq(p.name)},${ft},${p.fee==null?'NULL::int':p.fee},${sq(p.desc)},${sq(url)})`;
}
const CHUNK=60; const chunks=[];
for(let i=0;i<uniq.length;i+=CHUNK){
  const rows=uniq.slice(i,i+CHUNK).map(row).join(',');
  chunks.push(`INSERT INTO cs.vas_products (${COLS},crawled_at,is_active) SELECT v.carrier,v.category,v.name,v.fee_type,v.fee::int,v.description,v.source_url,now(),true FROM (VALUES ${rows}) AS v(${COLS}) WHERE NOT EXISTS (SELECT 1 FROM cs.vas_products p WHERE p.carrier='SKT' AND p.name=v.name);`);
}
chunks.forEach((c,i)=>writeFileSync(SC+`vasall-${i}.sql`,c));
console.error('청크:',chunks.length,'문자수:',chunks.map(c=>c.length).join(','));
