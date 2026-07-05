import { readFileSync, writeFileSync } from 'fs';
const SC='/private/tmp/claude-501/-Users-vinsenzo/22c2de51-dc9a-44c2-bacf-7836be4787e0/scratchpad/';
const d=JSON.parse(readFileSync(SC+'skt-addons-raw.json','utf8'));
const sq=s=>s==null?'NULL':"'"+String(s).replace(/'/g,"''")+"'";
function parse(o){
  const t=o.text.replace(/\s+/g,' ').trim();
  const fm=t.match(/([\d,]+)\s*원/);
  const fee=fm?parseInt(fm[1].replace(/,/g,''),10):(/무료/.test(t.split('#')[0])?0:null);
  const name=(fm?t.slice(0,fm.index):t.split('#')[0]).trim();
  const tags=[...t.matchAll(/#([^\s#]+)/g)].map(m=>m[1]);
  // description: 마지막 해시태그 이후
  const lastHash=t.lastIndexOf('#');
  let desc=t.slice(lastHash).replace(/^#[^\s#]+\s*/,'').trim();
  if(desc.length<3) desc=null;
  const tagset=tags.join(',');
  let cat='etc';
  if(/안심\/보험/.test(tagset))cat='safe';
  else if(/통화\/메시지/.test(tagset))cat='call';
  else if(/데이터/.test(tagset))cat='data';
  else if(/콘텐츠이용/.test(tagset))cat='content';
  return {name,fee,cat,desc,pid:o.pid,tags:tagset};
}
const parsed=d.map(parse).filter(x=>x.name&&x.name.length<40);
// dedup by name
const seen=new Set(); const uniq=[];
for(const p of parsed){ if(seen.has(p.name))continue; seen.add(p.name); uniq.push(p); }
writeFileSync(SC+'skt-vas-parsed.json',JSON.stringify(uniq,null,2));
console.error('파싱:',uniq.length,'/ 원본',d.length);
const catc={}; uniq.forEach(x=>catc[x.cat]=(catc[x.cat]||0)+1); console.error('카테고리:',JSON.stringify(catc));
console.error('fee null:',uniq.filter(x=>x.fee==null).map(x=>x.name).join(', ')||'없음');
uniq.slice(0,5).forEach(x=>console.error(`  ${x.name} | ${x.cat} | ${x.fee}원 | ${x.desc?.slice(0,40)}`));

// SQL 생성
const COLS='carrier,category,name,fee_type,fee,description,source_url';
function row(p){
  const ft=p.fee==null?"NULL":(p.fee===0?"'free'":"'monthly'");
  const url=p.pid?`https://m.tworld.co.kr/product/callplan?prod_id=${p.pid}`:'https://m.tworld.co.kr/product/mobileplan-add/list';
  return `('SKT',${sq(p.cat)},${sq(p.name)},${ft},${p.fee==null?'NULL':p.fee},${sq(p.desc)},${sq(url)})`;
}
const CHUNK=32; const chunks=[];
for(let i=0;i<uniq.length;i+=CHUNK){
  const rows=uniq.slice(i,i+CHUNK).map(row).join(',');
  chunks.push(`INSERT INTO cs.vas_products (${COLS},crawled_at,is_active) SELECT v.carrier,v.category,v.name,v.fee_type,v.fee::int,v.description,v.source_url, now(), true FROM (VALUES ${rows}) AS v(${COLS}) WHERE NOT EXISTS (SELECT 1 FROM cs.vas_products p WHERE p.carrier='SKT' AND p.name=v.name);`);
}
chunks.forEach((c,i)=>writeFileSync(SC+`vas-insert-${i}.sql`,c));
console.error('청크:',chunks.length,'문자수:',chunks.map(c=>c.length).join(','));
