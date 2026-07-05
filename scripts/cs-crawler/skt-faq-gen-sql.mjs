// SKT FAQ JSON → 정정된 topic_code + SQL INSERT 생성
import { readFileSync } from 'fs';

const raw = JSON.parse(readFileSync(
  '/private/tmp/claude-501/-Users-vinsenzo/22c2de51-dc9a-44c2-bacf-7836be4787e0/scratchpad/skt-faq-results.json',
  'utf8'
));

// catName 기반 topic_code 재보정 (크롤러가 잘못 매핑한 것 수정)
function fixTopic(r) {
  const cat = (r.catName || '').replace(/\s/g,'');
  const q = (r.question || '');
  const a = (r.answer || '');
  const text = q + ' ' + a;

  // 실제 카테고리 명칭 기반 보정
  if (/T우주|구독/.test(cat)) return 'bundle';
  if (/다이렉트샵|D\.?shop|배송|교환|반품|구매/.test(cat)) return 'device';
  if (/T월드이용|T월드앱|T world앱|T월드모바일/.test(cat) || /T 월드 모바일|T world 모바일/.test(text)) return 'tworld_app';
  if (/통화품질/.test(cat)) return 'quality';
  if (/유심|이심|eSIM/.test(cat)) return 'sim';
  if (/고객감사패키지|재가입/.test(cat)) return 'rejoining';
  if (/T로밍|로밍/.test(cat)) return 'roaming';

  // 내용 기반 보정
  if (/유심|USIM|이심|eSIM/.test(q) && !/결제|요금|납부/.test(q)) return 'sim';
  if (/로밍|roaming|baro|OnePass|해외.*데이터|데이터.*해외/.test(q)) return 'roaming';
  if (/명의변경|양도|이전.*소유/.test(q)) return 'namechange';
  if (/해지|철회|위약금/.test(q)) return 'cancel';
  if (/멤버십|레인보우포인트|T day/.test(q)) return 'membership';
  if (/결합|가족할인|T끼리/.test(q)) return 'bundle';
  if (/요금|납부|청구|할부|결제/.test(q)) return 'billing';
  if (/가입|개통|번호이동/.test(q)) return 'signup';
  if (/분실|일시정지|도난/.test(q)) return 'lost';
  if (/데이터|LTE|5G|속도|커버리지/.test(q)) return 'data';
  if (/부가서비스/.test(q)) return 'addon';
  if (/인터넷|유선/.test(q)) return 'internet';

  // 원래 topic_code 유지 (billing/cancel/device/lost/membership/namechange/penalty/roaming/signup/sim → 유지)
  const keep = ['billing','cancel','device','lost','membership','namechange','penalty','roaming','signup','sim'];
  if (keep.includes(r.topic_code)) return r.topic_code;

  return r.topic_code || 'general';
}

const esc = s => (s || '').replace(/'/g, "''");

// 배치 크기
const CHUNK = 30;
const chunks = [];
let cur = [];

for (const r of raw) {
  const topic = fixTopic(r);
  cur.push({
    topic_code: topic,
    source_url: r.source_url,
    question: r.question.slice(0, 300),
    answer: r.answer.slice(0, 750),
  });
  if (cur.length >= CHUNK) { chunks.push(cur); cur = []; }
}
if (cur.length > 0) chunks.push(cur);

// SQL 출력
for (let i = 0; i < chunks.length; i++) {
  const ch = chunks[i];
  const rows = ch.map((r, ri) => {
    const nullCast = ri === 0 ? '::text' : '';
    return `(${[
      `'${esc(r.topic_code)}'${nullCast}`,
      `'SKT'${nullCast}`,
      `'${esc(r.question)}'${nullCast}`,
      `NULL${nullCast}`,  // question_variants
      `'${esc(r.answer)}'${nullCast}`,
      `NULL${nullCast}`,  // answer_detail
      `NULL${nullCast}`,  // guide_script
      `NULL${nullCast}`,  // policy
      `'${esc(r.source_url)}'${nullCast}`,
      `'needs_review'${nullCast}`,  // confidence
      `now()`,            // crawled_at
      `'info'${nullCast}`,// answer_type
      `true`,             // is_active
    ].join(', ')})`;
  }).join(',\n  ');

  const sql = `
-- chunk ${i+1}/${chunks.length} (${ch.length} rows)
INSERT INTO cs.faqs
  (topic_code, carrier, question, question_variants, answer, answer_detail, guide_script, policy, source_url, confidence, crawled_at, answer_type, is_active)
SELECT v.topic_code, v.carrier, v.question, v.question_variants::jsonb, v.answer, v.answer_detail, v.guide_script, v.policy::jsonb, v.source_url, v.confidence, v.crawled_at, v.answer_type, v.is_active
FROM (VALUES
  ${rows}
) v(topic_code, carrier, question, question_variants, answer, answer_detail, guide_script, policy, source_url, confidence, crawled_at, answer_type, is_active)
WHERE NOT EXISTS (
  SELECT 1 FROM cs.faqs f
  WHERE f.carrier = 'SKT'
    AND (f.source_url = v.source_url OR f.question = v.question)
);`;

  console.log(`\n--- CHUNK ${i+1} ---`);
  console.log(sql);
}

console.error(`\n총 ${raw.length}개, ${chunks.length} 청크`);
// 통계
const topicDist = {};
for (const r of raw) { const t = fixTopic(r); topicDist[t] = (topicDist[t]||0)+1; }
console.error('topic_code 분포:', JSON.stringify(topicDist, null, 2));
