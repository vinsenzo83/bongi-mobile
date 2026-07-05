// SKT 요금제 최종 크롤+파싱 — 5개 탭 istabmove=Y&view=all 로 전량 로드
import { launch, newPage, gotoRetry } from './lib/browser.mjs';
import { writeFileSync } from 'fs';
const SC = '/private/tmp/claude-501/-Users-vinsenzo/22c2de51-dc9a-44c2-bacf-7836be4787e0/scratchpad/';

const TABS = [
  ['베스트', 'F02087'], ['라이트', 'F02088'], ['스마트기기', 'F02089'],
  ['전용', 'F02100'], ['다이렉트', 'F02101'],
];
const num = s => { const m = (s || '').match(/([\d,]{4,})\s*원/); return m ? parseInt(m[1].replace(/,/g, ''), 10) : null; };

function parse(text, tab) {
  const t = text.replace(/\s+/g, ' ').trim();
  // name: 첫 마커 이전. 괄호 안 GB/MB(예: 뉴 T끼리 맞춤형(100분+250MB))는 무시하려 마스킹
  const masked = t.replace(/\([^)]*\)/g, m => ' '.repeat(m.length));
  const m = masked.match(/선택약정 반영 시|무제한|\d[\d.]*\s*GB|\d[\d.]*\s*MB|월\s*\d/);
  let name = m ? t.slice(0, m.index).trim() : t.replace(/상세참조.*$/, '').trim();
  name = name.replace(/\s+/g, ' ').trim();
  // disc: 선택약정 반영 시 뒤 첫 원
  const dm = t.match(/선택약정 반영 시\s*월?\s*([\d,]{4,})\s*원/);
  const disc = dm ? parseInt(dm[1].replace(/,/g, ''), 10) : null;
  // base(공시 정상요금): 카드 내 최대 원 금액 (선택약정<정상 항상 성립)
  const allFees = [...t.matchAll(/([\d,]{4,})\s*원/g)].map(x => parseInt(x[1].replace(/,/g, ''), 10)).filter(n => n >= 5000 && n <= 200000);
  let base = allFees.length ? Math.max(...allFees) : null;
  // data
  const dataM = t.match(/무제한|[\d.]+\s*(?:GB|MB)(?:\s*\+\s*최대\s*[\d.]+\s*[KMG]?bps)?/);
  const data = dataM ? dataM[0].replace(/\s+/g, '') : null;
  // call
  const callM = t.match(/(집\/이동전화[^•]*?)(?:•|$)/);
  const call = callM ? callM[1].trim() : null;
  // message
  const msgM = t.match(/문자\s*[^•]*/);
  const message = msgM ? msgM[0].trim() : null;
  // network: 이름에 명시된 경우만 판정(왜곡 방지)
  let network = null;
  if (/LTE/i.test(name)) network = 'LTE';
  else if (/5G/i.test(name)) network = '5G';
  return { name, tab, monthly_fee: base, discount_fee: disc, data_amount: data, call_amount: call, message, network, raw: t };
}

const b = await launch();
const p = await newPage(b);
const all = new Map();
const rawDump = {};
for (const [tab, f] of TABS) {
  const url = `https://m.tworld.co.kr/product/renewal/mobileplan/list?filters=${f}&istabmove=Y&view=all`;
  const r = await gotoRetry(p, url, { waitMs: 9000, retries: 3 });
  if (!r.ok) { console.error(`[${tab}] 로드실패`); continue; }
  await p.waitForTimeout(2500);
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(1500);
  const cards = await p.evaluate(() => {
    const cl = s => (s || '').replace(/\s+/g, ' ').trim();
    return [...document.querySelectorAll('li.comp-list')].map(li => cl(li.innerText)).filter(t => t.length > 6);
  });
  rawDump[tab] = cards;
  let added = 0;
  for (const c of cards) {
    const rec = parse(c, tab);
    if (!rec.name || rec.name.length > 45) continue;
    if (!all.has(rec.name)) { all.set(rec.name, rec); added++; }
  }
  console.error(`[${tab}] 카드 ${cards.length} / 신규 ${added}`);
}
await b.close();

const out = [...all.values()];
writeFileSync(SC + 'skt-plans-parsed.json', JSON.stringify(out, null, 2));
writeFileSync(SC + 'skt-plans-rawdump.json', JSON.stringify(rawDump, null, 2));
console.error(`\n=== 총 고유 ${out.length}건 ===`);
out.forEach(r => console.error(`  ${r.tab} | ${r.name} | 월${r.monthly_fee} 약정${r.discount_fee} | ${r.data_amount} | ${r.call_amount || ''} | ${r.message || ''}`));
