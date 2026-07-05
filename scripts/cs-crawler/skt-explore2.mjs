import { launch, newPage, gotoRetry } from './lib/browser.mjs';
import { writeFileSync } from 'fs';
const SC = '/private/tmp/claude-501/-Users-vinsenzo/22c2de51-dc9a-44c2-bacf-7836be4787e0/scratchpad/';
const b = await launch();
const p = await newPage(b);

// === 1) 부가서비스 카테고리 필터 탐색 ===
await gotoRetry(p, 'https://m.tworld.co.kr/product/mobileplan-add/list?filters=F01234', { waitMs: 9000, retries: 3 });
await p.waitForTimeout(2000);
const addonCats = await p.evaluate(() => {
  const cl = s => (s || '').replace(/\s+/g, ' ').trim();
  // 카테고리 탭/버튼
  const btns = [...document.querySelectorAll('button, a')].map(e => ({ t: cl(e.innerText), cls: e.className, href: e.getAttribute('href') }))
    .filter(x => x.t && x.t.length < 12 && /통화|데이터|안심|보험|미디어|콘텐츠|구독|스마트|편의|메시지|생활|커머스/.test(x.t));
  return btns;
});
console.error('=== 부가서비스 카테고리 후보 ===');
addonCats.forEach(c => console.error(`  "${c.t}" cls=${(c.cls||'').slice(0,30)} href=${c.href}`));

// === 2) 요금제 카드 network 배지 탐색 (베스트 탭) ===
await gotoRetry(p, 'https://m.tworld.co.kr/product/renewal/mobileplan/list?view=all', { waitMs: 9000, retries: 3 });
await p.waitForTimeout(2000);
const liHtml = await p.evaluate(() => {
  const li = document.querySelector('li.comp-list');
  return li ? li.outerHTML.slice(0, 1500) : 'none';
});
writeFileSync(SC + 'skt-li-html.txt', liHtml);
console.error('\n=== 베스트 첫 카드 HTML 저장 (network 배지 확인용) ===');
console.error(liHtml.slice(0, 600));

await b.close();
