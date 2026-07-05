import { readFileSync, writeFileSync } from 'fs';
const SC='/private/tmp/claude-501/-Users-vinsenzo/22c2de51-dc9a-44c2-bacf-7836be4787e0/scratchpad/';
const d=JSON.parse(readFileSync(SC+'skt-details.json','utf8'));
const OTTKW=['넷플릭스','유튜브 프리미엄','유튜브','티빙','웨이브','디즈니','왓챠'];
const dq=s=>{ // dollar-quote safe: strip any $$ 
  s=String(s==null?'':s).replace(/\$\$/g,'$ $');
  return '$$'+s+'$$';
};
const rows=[];
for(const [name,x] of Object.entries(d)){
  const media4=(x.media||[]).map(m=>m.slice(0,95)).slice(0,4);
  // detail jsonb (compact)
  const detail={
    data:x.data, voice:x.voice, msg:x.msg, fee:x.fee,
    subtitle:x.subtitle||null, media:media4,
    subscribe:(x.subscribe||'').slice(0,160)||null, age:(x.age||'').slice(0,160)||null, join:(x.join||'').slice(0,200)||null, notes:(x.notes||'').slice(0,120)||null
  };
  // benefits text
  const benefits=media4.join(' | ').slice(0,480)||null;
  // ott list: subtitle + media 중 OTT 언급
  const ottset=new Set();
  const scan=(x.subtitle||'')+' '+(x.media||[]).join(' ');
  OTTKW.forEach(k=>{ if(scan.includes(k)) ottset.add(k==='유튜브'&&scan.includes('유튜브 프리미엄')?'유튜브 프리미엄':k); });
  const ott=[...ottset];
  // commit_type
  const ct=(x.fee&&x.fee.agmt&&x.fee.list&&x.fee.agmt<x.fee.list)?'선택약정25%/공시지원금':'선택약정/공시';
  // conditions structured
  const parts=[];
  if(x.subtitle) parts.push('['+x.subtitle+']');
  if(x.data?.basic) parts.push('데이터 '+x.data.basic+(x.data.teth_gb?` (테더링/쉐어 ${x.data.teth_gb}GB)`:'')+(x.data.qos?` 소진후 ${x.data.qos}`:''));
  if(x.voice?.basic) parts.push('음성 '+x.voice.basic+(x.voice.video_add_min?`, 영상/부가통화 ${x.voice.video_add_min}분`:''));
  if(x.msg) parts.push('문자 '+x.msg);
  if(x.fee?.list) parts.push(`월정액 ${x.fee.list.toLocaleString()}원(선택약정 ${x.fee.agmt?x.fee.agmt.toLocaleString():'-'}원)`);
  if(x.age) parts.push('연령혜택: '+x.age.slice(0,150));
  if(x.subscribe) parts.push('구독: '+x.subscribe.slice(0,120));
  if(x.join) parts.push('가입조건: '+x.join.slice(0,180));
  const cond=parts.join(' / ').slice(0,1500);
  rows.push({name, detail:JSON.stringify(detail), benefits, ott:JSON.stringify(ott), ct, cond});
}
// chunk
const CHUNK=20; const chunks=[];
for(let i=0;i<rows.length;i+=CHUNK){
  const vals=rows.slice(i,i+CHUNK).map(r=>`(${dq(r.name)},${dq(r.detail)},${r.benefits?dq(r.benefits):'NULL'},${dq(r.ott)},${dq(r.ct)})`).join(',\n');
  chunks.push(`UPDATE cs.plans p SET detail=v.detail::jsonb, benefits=v.benefits, ott_benefits=v.ott::jsonb, commit_type=v.ct, crawled_at=now() FROM (VALUES\n${vals}\n) AS v(name,detail,benefits,ott,ct) WHERE p.carrier='SKT' AND p.plan_name=v.name;`);
}
chunks.forEach((c,i)=>writeFileSync(SC+`detail-upd-${i}.sql`,c));
console.error('요금제 상세:',rows.length,'| 청크:',chunks.length,'| 문자수:',chunks.map(c=>c.length).join(','));
