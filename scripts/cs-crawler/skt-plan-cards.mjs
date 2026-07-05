import { launch, newPage, gotoRetry } from './lib/browser.mjs';
import { writeFileSync } from 'fs';
const SC = '/private/tmp/claude-501/-Users-vinsenzo/22c2de51-dc9a-44c2-bacf-7836be4787e0/scratchpad/';
const b = await launch();
const p = await newPage(b);
await gotoRetry(p, 'https://m.tworld.co.kr/product/renewal/mobileplan/list?view=all', { waitMs: 10000, retries: 3 });
await p.waitForTimeout(2000);

// 탭 목록 파악
const tabs = await p.evaluate(() => {
  const cl = s => (s || '').replace(/\s+/g, ' ').trim();
  return [...document.querySelectorAll('button, [role=tab], a')].map(e => cl(e.innerText)).filter(t => /^(베스트|라이트|전용|스마트기기|다이렉트)$/.test(t));
});
console.error('탭:', JSON.stringify(tabs));

// 카드 컨테이너 탐지: "선택약정 반영 시" 텍스트를 가진 최소 공통 조상
const cardInfo = await p.evaluate(() => {
  const cl = s => (s || '').replace(/\s+/g, ' ').trim();
  const anchors = [...document.querySelectorAll('*')].filter(e => {
    const t = e.innerText || '';
    return /선택약정 반영 시/.test(t) && e.querySelectorAll('*').length < 40 && cl(t).length < 400 && cl(t).length > 30;
  });
  // 가장 작은(리프에 가까운) 카드 후보 dedup by text
  const seen = new Set(); const cards = [];
  for (const e of anchors) {
    const t = cl(e.innerText);
    if (seen.has(t)) continue; seen.add(t);
    cards.push({ tag: e.tagName, cls: e.className, text: t });
  }
  return { count: cards.length, cards: cards.slice(0, 40) };
});
console.error('카드 후보:', cardInfo.count);
writeFileSync(SC + 'skt-plan-cards.json', JSON.stringify(cardInfo.cards, null, 2));
cardInfo.cards.slice(0, 5).forEach(c => console.error(`  [${c.tag}.${(c.cls||'').slice(0,20)}] ${c.text.slice(0,110)}`));
await b.close();
