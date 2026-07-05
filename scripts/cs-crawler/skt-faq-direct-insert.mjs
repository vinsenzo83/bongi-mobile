// Direct Supabase insert — uses anon key + dev project URL (no local .env, no LIVE risk)
// cs.faqs table has RLS disabled → anon key can insert
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://sesgdqbmophgmombelmn.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlc2dkcWJtb3BoZ21vbWJlbG1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzc5ODAsImV4cCI6MjA5MzY1Mzk4MH0.k75sBCMrw9OozakxVlwfYUhsb5aG4eatDLTk8PeWk1U';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

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

// 기존 소스 URL 셋 조회 (중복 방지)
const { data: existing } = await supabase.schema('cs').from('faqs')
  .select('source_url,question').eq('carrier','SKT');
const existingUrls = new Set((existing||[]).map(r => r.source_url));
const existingQs   = new Set((existing||[]).map(r => r.question));

console.error(`기존 FAQ: ${existingUrls.size}개`);

let inserted = 0, skipped = 0, errored = 0;
const BATCH = 20;

for (let i = 0; i < raw.length; i += BATCH) {
  const slice = raw.slice(i, i + BATCH);
  const rows = slice
    .filter(r => !existingUrls.has(r.source_url) && !existingQs.has(r.question))
    .map(r => ({
      topic_code: topicOf(r),
      carrier: 'SKT',
      question: r.question.slice(0, 300),
      answer: r.answer.slice(0, 750),
      source_url: r.source_url,
      confidence: 'needs_review',
      crawled_at: new Date().toISOString(),
      answer_type: 'info',
      is_active: true,
    }));

  if (rows.length === 0) { skipped += slice.length; continue; }

  const { data, error } = await supabase.schema('cs').from('faqs').insert(rows).select('id');
  if (error) {
    console.error(`  ERROR batch ${i}-${i+BATCH}: ${error.message}`);
    errored += rows.length;
  } else {
    inserted += (data||[]).length;
    console.error(`  OK batch ${i}-${i+BATCH}: inserted ${(data||[]).length}`);
  }
  skipped += slice.length - rows.length;
}

console.log(`완료: inserted=${inserted}, skipped=${skipped}, errored=${errored}`);
const { data: total } = await supabase.schema('cs').from('faqs').select('id',{count:'exact',head:true}).eq('carrier','SKT');
console.log(`SKT 전체 count (supabase query): ${total}`);
