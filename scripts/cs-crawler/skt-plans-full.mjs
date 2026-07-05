// SKT 요금제 전체 — 탭 버튼(search-total-button) 순회, li.comp-list 카드 추출
import { launch, newPage, gotoRetry } from './lib/browser.mjs';
import { writeFileSync } from 'fs';
const SC = '/private/tmp/claude-501/-Users-vinsenzo/22c2de51-dc9a-44c2-bacf-7836be4787e0/scratchpad/';

const b = await launch();
const p = await newPage(b);
await gotoRetry(p, 'https://m.tworld.co.kr/product/renewal/mobileplan/list?view=all', { waitMs: 10000, retries: 3 });
await p.waitForTimeout(2500);

const TABS = ['베스트', '라이트', '전용', '스마트기기', '다이렉트'];
const all = new Map();

async function grab(tab) {
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(1200);
  const cards = await p.evaluate(() => {
    const cl = s => (s || '').replace(/\s+/g, ' ').trim();
    return [...document.querySelectorAll('li.comp-list')].map(li => cl(li.innerText)).filter(t => /선택약정 반영 시/.test(t) && t.length > 20);
  });
  let added = 0;
  for (const text of cards) {
    const name = text.split('선택약정 반영 시')[0].trim();
    if (name && !all.has(name)) { all.set(name, { name, text, tab }); added++; }
  }
  console.error(`[${tab}] cards=${cards.length} new=${added}`);
}

// 기본(베스트) 먼저
await grab('베스트');
for (const tab of TABS.slice(1)) {
  const before = await p.evaluate(() => [...document.querySelectorAll('li.comp-list')].map(l => l.innerText.slice(0, 20)).join('|'));
  const ok = await p.evaluate((label) => {
    const btn = [...document.querySelectorAll('button.search-total-button')].find(e => (e.innerText || '').replace(/\s+/g, ' ').trim() === label);
    if (btn) { btn.click(); return true; }
    return false;
  }, tab);
  if (!ok) { console.error(`[${tab}] 버튼 못찾음`); continue; }
  // 리스트가 바뀌거나 나타날 때까지 폴링 (최대 12s)
  for (let i = 0; i < 12; i++) {
    await p.waitForTimeout(1000);
    const now = await p.evaluate(() => [...document.querySelectorAll('li.comp-list')].map(l => l.innerText.slice(0, 20)).join('|'));
    if (now && now !== before) break;
  }
  await grab(tab);
}

const out = [...all.values()];
writeFileSync(SC + 'skt-plans-full.json', JSON.stringify(out, null, 2));
console.error(`\n=== 총 고유 요금제 ${out.length}건 ===`);
out.forEach(c => console.error('  ·', c.tab, '|', c.text.slice(0, 110)));
await b.close();
