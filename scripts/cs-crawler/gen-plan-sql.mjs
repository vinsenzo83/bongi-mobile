import { readFileSync, writeFileSync } from 'fs';
const SC = '/private/tmp/claude-501/-Users-vinsenzo/22c2de51-dc9a-44c2-bacf-7836be4787e0/scratchpad/';
const d = JSON.parse(readFileSync(SC + 'skt-plans-parsed.json', 'utf8'));
const sq = s => s == null ? 'NULL' : "'" + String(s).replace(/'/g, "''") + "'";
const jb = a => (a && a.length ? "'" + JSON.stringify(a).replace(/'/g, "''") + "'" : "'[]'") + '::jsonb';
const TABURL = { '베스트':'F02087','라이트':'F02088','스마트기기':'F02089','전용':'F02100','다이렉트':'F02101' };
const url = t => `https://m.tworld.co.kr/product/renewal/mobileplan/list?filters=${TABURL[t]}&view=all`;
const OTT = ['넷플릭스','유튜브 프리미엄','티빙','웨이브','디즈니+','왓챠'];
const ott = (n,r)=>OTT.filter(k=>(n+' '+r).includes(k));
const age = n => /시니어|어르신|실버|손누리|소리누리|손사랑|소리사랑/.test(n)?'시니어':/청년/.test(n)?'청년':/ZEM|키즈|주니어|팅/.test(n)?'키즈':/복지|장애/.test(n)?'복지':/Easy|외국인|PPS/.test(n)?'외국인':'전체';

const COLS='carrier,plan_name,network,monthly_fee,discount_fee,data_amount,call_amount,message,age_target,ott_benefits,conditions,source_url';
function row(p){
  return `('SKT',${sq(p.name)},${sq(p.network)},${p.monthly_fee??'NULL'},${p.discount_fee??'NULL'},${sq(p.data_amount)},${sq(p.call_amount)},${sq(p.message)},${sq(age(p.name))},${jb(ott(p.name,p.raw))},${sq(p.raw.slice(0,400))},${sq(url(p.tab))})`;
}
// 매칭 3건 UPDATE
const MATCHED=['다이렉트5G 27','다이렉트5G 31','다이렉트5G 76(유튜브 프리미엄)'];
const updates=[];
for(const nm of MATCHED){const p=d.find(x=>x.name===nm);
  updates.push(`UPDATE cs.plans SET network=${sq(p.network)}, monthly_fee=${p.monthly_fee??'NULL'}, discount_fee=${p.discount_fee??'NULL'}, data_amount=${sq(p.data_amount)}, call_amount=${sq(p.call_amount)}, message=${sq(p.message)}, age_target=${sq(age(p.name))}, ott_benefits=${jb(ott(p.name,p.raw))}, conditions=${sq(p.raw.slice(0,400))}, source_url=${sq(url(p.tab))}, crawled_at=now(), is_active=true WHERE carrier='SKT' AND plan_name=${sq(nm)};`);
}
// INSERT 청크 (모든 130건, NOT EXISTS 가드로 매칭3건은 스킵됨)
const CHUNK=33; const chunks=[];
for(let i=0;i<d.length;i+=CHUNK){
  const rows=d.slice(i,i+CHUNK).map(row).join(',');
  chunks.push(`INSERT INTO cs.plans (${COLS},crawled_at,is_active) SELECT v.*, now(), true FROM (VALUES ${rows} ) AS v(${COLS})\nWHERE NOT EXISTS (SELECT 1 FROM cs.plans p WHERE p.carrier='SKT' AND p.plan_name=v.plan_name);`);
}
const nameList=d.map(x=>sq(x.name)).join(',');
const deact=`UPDATE cs.plans SET is_active=false WHERE carrier='SKT' AND is_active=true AND plan_name NOT IN (${nameList});`;

chunks.forEach((c,i)=>writeFileSync(SC+`plan-insert-${i}.sql`,c));
writeFileSync(SC+'plan-updates.sql',updates.join('\n'));
writeFileSync(SC+'plan-deact.sql',deact);
console.error('청크수:',chunks.length,'각 청크 문자수:',chunks.map(c=>c.length).join(','));
console.error('updates:',updates.length,'deact len:',deact.length);
