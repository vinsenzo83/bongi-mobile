// JSONB-based INSERT SQL generator — more compact than VALUES
// Uses jsonb_array_elements so JSON string is the payload (no SQL quoting issues)
import { readFileSync } from 'fs';

const raw = JSON.parse(readFileSync(
  '/private/tmp/claude-501/-Users-vinsenzo/22c2de51-dc9a-44c2-bacf-7836be4787e0/scratchpad/skt-faq-results.json',
  'utf8'
));

const VALID = new Set(['auth','billing','bundle','cancel','device','lost','membership',
  'micropay','mnp','namechange','penalty','plan','quality','roaming','signup','sim','subsidy','vas']);

function topicOf(r) {
  const cat = (r.catName||'').replace(/\s/g,'');
  const q = r.question||'';
  if (/T 월드 모바일 웹.앱|회원 계정 T |T world 앱|T 월드 탈퇴|T 월드 로그아웃|위젯에 잔여|공동인증서|위젯에 리필/.test(q)) return 'auth';
  if (/유심|USIM|이심|eSIM/.test(q)) return 'sim';
  if (/로밍|baro|OnePass|해외.*데이터/.test(q)) return 'roaming';
  if (/명의변경|양도/.test(q)) return 'namechange';
  if (/위약금/.test(q)) return 'penalty';
  if (/멤버십|레인보우포인트|T day/.test(q)) return 'membership';
  if (/결합|가족할인|T끼리/.test(q)) return 'bundle';
  if (/휴대폰결제|소액결제|콘텐츠이용료|선결제/.test(q.replace(/\s/g,''))) return 'micropay';
  if (/번호이동/.test(q)) return 'mnp';
  if (/추가지원금|공통지원금|선택약정/.test(q)) return 'subsidy';
  if (/교환|반품|철회|불량/.test(q)) return 'cancel';
  if (/배송|바로도착|행복배송/.test(q)) return 'signup';
  if (/분실|도난/.test(q)) return 'lost';
  if (/부가서비스/.test(q)) return 'vas';
  if (/ZEM|누구|NUGU|자녀/.test(q)) return 'vas';
  if (/LTE|5G|속도|커버리지|장애|품질/.test(q)) return 'quality';
  if (/요금제/.test(q)) return 'plan';
  if (/재가입/.test(q)) return 'cancel';
  if (/T우주|구독/.test(cat)) return 'bundle';
  if (/T월드이용|T월드앱|T월드모바일/.test(cat)) return 'auth';
  if (/통화품질/.test(cat)) return 'quality';
  if (/유심|이심/.test(cat)) return 'sim';
  if (/고객감사패키지/.test(cat)) return 'cancel';
  if (/T로밍|로밍/.test(cat)) return 'roaming';
  if (/멤버십/.test(cat)) return 'membership';
  if (/명의변경/.test(cat)) return 'namechange';
  if (/요금/.test(cat)) return 'billing';
  if (/일시정지/.test(q)) return 'cancel';
  if (/가입|개통/.test(q)) return 'signup';
  if (/납부|청구|할부금|세금계산서|입금/.test(q)) return 'billing';
  if (/T world|T 월드/.test(q)) return 'auth';
  if (/데이터/.test(q)) return 'plan';
  if (/인터넷|유선/.test(q)) return 'bundle';
  if (VALID.has(r.topic_code)) return r.topic_code;
  return 'billing';
}

const start = parseInt(process.argv[2]||'0', 10);
const end   = parseInt(process.argv[3]||String(raw.length), 10);
const slice = raw.slice(start, end);

const jsonRows = slice.map(r => ({
  t: topicOf(r),
  q: r.question.slice(0, 280).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,''), // strip control chars
  a: r.answer.slice(0, 400).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,''),
  u: r.source_url,
}));

// JSON.stringify properly escapes all special chars including quotes
// Use $$ dollar-quoting so NO SQL-level quote escaping is needed
const jsonStr = JSON.stringify(jsonRows); // raw — no SQL escaping needed

const sql = `INSERT INTO cs.faqs(topic_code,carrier,question,answer,source_url,confidence,crawled_at,answer_type,is_active)
SELECT r->>'t','SKT',r->>'q',r->>'a',r->>'u','needs_review',now(),'info',true
FROM jsonb_array_elements($$${jsonStr}$$::jsonb) r
WHERE NOT EXISTS(SELECT 1 FROM cs.faqs f WHERE f.carrier='SKT' AND(f.source_url=r->>'u' OR f.question=r->>'q'))`;

process.stdout.write(sql);
