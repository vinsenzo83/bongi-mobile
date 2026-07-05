// SKT DOM 구조 탐색 — 부가서비스 리스트 아이템 + 요금제 전체리스트 링크
import { launch, newPage, gotoRetry } from './lib/browser.mjs';
import { writeFileSync } from 'fs';
const SC = '/private/tmp/claude-501/-Users-vinsenzo/22c2de51-dc9a-44c2-bacf-7836be4787e0/scratchpad/';

const b = await launch();
const p = await newPage(b);

// --- 부가서비스: 아이템 구조 추출 ---
await gotoRetry(p, 'https://m.tworld.co.kr/product/mobileplan-add/list?filters=F01234', { waitMs: 9000, retries: 3 });
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await p.waitForTimeout(2500);
const addonInfo = await p.evaluate(() => {
  // 리스트 아이템 후보: 링크 안에 텍스트+가격 있는 카드
  const links = [...document.querySelectorAll('a')].filter(a => /원|무료/.test(a.innerText) && a.innerText.length > 8 && a.innerText.length < 400);
  return {
    total: (document.body.innerText.match(/총\s*([\d,]+)\s*건/) || [])[1],
    linkCount: links.length,
    sampleHrefs: links.slice(0, 5).map(a => a.getAttribute('href')),
    sampleTexts: links.slice(0, 6).map(a => a.innerText.replace(/\s+/g, ' ').trim()),
  };
});
console.error('ADDON:', JSON.stringify(addonInfo, null, 2));

// --- 요금제 전체 리스트 링크 찾기 ---
await gotoRetry(p, 'https://m.tworld.co.kr/product/mobileplan/list', { waitMs: 9000, retries: 3 });
await p.waitForTimeout(2000);
const planLinks = await p.evaluate(() => {
  return [...document.querySelectorAll('a')].map(a => ({ t: a.innerText.replace(/\s+/g, ' ').trim(), h: a.getAttribute('href') }))
    .filter(x => x.h && (/리스트|전체|요금제/.test(x.t) || /plan|prcplan|prod/i.test(x.h || '')));
});
console.error('\nPLAN LINKS:', JSON.stringify(planLinks.slice(0, 30), null, 2));

await b.close();
