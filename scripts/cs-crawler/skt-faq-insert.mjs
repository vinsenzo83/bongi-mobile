// SKT FAQ INSERT — JSON → Supabase (단일 INSERT SELECT VALUES 청크)
// 이 파일은 stdout으로 청크별 JSON array를 출력한다 (각 청크 = one execute_sql call)
import { readFileSync } from 'fs';

const raw = JSON.parse(readFileSync(
  '/private/tmp/claude-501/-Users-vinsenzo/22c2de51-dc9a-44c2-bacf-7836be4787e0/scratchpad/skt-faq-results.json',
  'utf8'
));

function fixTopic(r) {
  const cat = (r.catName || '').replace(/\s/g,'');
  const q = (r.question || '');
  const a = (r.answer || '');
  const text = q + ' ' + a;

  if (/T우주|구독/.test(cat)) return 'bundle';
  if (/다이렉트샵|배송|교환|반품|구매/.test(cat)) return 'device';
  if (/T월드이용|T월드앱|T월드모바일|T월드 앱/.test(cat.replace(/\s/g,'')) ||
      /T world 모바일|T 월드 모바일 웹\/앱/.test(text)) return 'tworld_app';
  if (/통화품질/.test(cat)) return 'quality';
  if (/유심|이심|eSIM/.test(cat)) return 'sim';
  if (/고객감사패키지|재가입/.test(cat)) return 'rejoining';
  if (/T로밍|로밍/.test(cat)) return 'roaming';

  if (/유심|USIM|이심|eSIM/.test(q) && !/결제|요금|납부/.test(q)) return 'sim';
  if (/로밍|baro|OnePass|해외.*데이터|데이터.*해외|해외.*요금/.test(q)) return 'roaming';
  if (/명의변경|양도/.test(q)) return 'namechange';
  if (/해지|철회|위약금/.test(q)) return 'cancel';
  if (/멤버십|레인보우포인트|T day/.test(q)) return 'membership';
  if (/결합|가족할인|T끼리/.test(q)) return 'bundle';
  if (/할부금|요금.*납부|납부.*요금|청구|선결제|입금|세금계산서/.test(q)) return 'billing';
  if (/가입|개통|번호이동/.test(q)) return 'signup';
  if (/분실|일시정지|도난/.test(q)) return 'lost';
  if (/데이터|LTE|5G|속도|커버리지/.test(q)) return 'data';
  if (/부가서비스/.test(q)) return 'addon';
  if (/인터넷|유선/.test(q)) return 'internet';

  const keep = ['billing','cancel','device','lost','membership','namechange','penalty','roaming','signup','sim'];
  if (keep.includes(r.topic_code)) return r.topic_code;
  return r.topic_code || 'general';
}

const esc = s => (s || '').replace(/'/g, "''").slice(0, 750);

const CHUNK = 20;
const chunks = [];
let cur = [];
for (const r of raw) {
  cur.push({ ...r, _topic: fixTopic(r) });
  if (cur.length >= CHUNK) { chunks.push(cur); cur = []; }
}
if (cur.length) chunks.push(cur);

// 각 청크를 JSON으로 stdout 출력 (인덱스별)
const chunkIdx = parseInt(process.argv[2] || '0', 10);
if (chunkIdx < 0 || chunkIdx >= chunks.length) {
  console.log(JSON.stringify({ total_chunks: chunks.length, total_rows: raw.length }));
  process.exit(0);
}

const ch = chunks[chunkIdx];
const rows = ch.map((r, ri) => {
  const cast = ri === 0 ? '::text' : '';
  const topic = r._topic;
  const question = esc(r.question);
  const answer = esc(r.answer);
  const url = esc(r.source_url);
  return `('${topic}'${cast},'SKT'${cast},'${question}'${cast},NULL${cast},'${answer}'${cast},NULL${cast},NULL${cast},NULL${cast},'${url}'${cast},'needs_review'${cast},now(),'info'${cast},true)`;
}).join(',\n  ');

const sql = `INSERT INTO cs.faqs
  (topic_code,carrier,question,question_variants,answer,answer_detail,guide_script,policy,source_url,confidence,crawled_at,answer_type,is_active)
SELECT v.topic_code,v.carrier,v.question,v.question_variants::jsonb,v.answer,v.answer_detail,v.guide_script,v.policy::jsonb,v.source_url,v.confidence,v.crawled_at,v.answer_type,v.is_active
FROM (VALUES
  ${rows}
) v(topic_code,carrier,question,question_variants,answer,answer_detail,guide_script,policy,source_url,confidence,crawled_at,answer_type,is_active)
WHERE NOT EXISTS (
  SELECT 1 FROM cs.faqs f
  WHERE f.carrier='SKT' AND (f.source_url=v.source_url OR f.question=v.question)
)`;

console.log(sql);
