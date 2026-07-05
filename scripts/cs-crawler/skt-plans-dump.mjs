import { launch, newPage, gotoRetry } from './lib/browser.mjs';
import { writeFileSync } from 'fs';
const SC = '/private/tmp/claude-501/-Users-vinsenzo/22c2de51-dc9a-44c2-bacf-7836be4787e0/scratchpad/';
const b = await launch();
const p = await newPage(b);
await gotoRetry(p, 'https://m.tworld.co.kr/product/renewal/mobileplan/list?view=all', { waitMs: 9000, retries: 3 });
await p.waitForTimeout(2000);

async function expand() {
  for (let i = 0; i < 5; i++) {
    await p.evaluate(() => document.querySelectorAll('.acco-tit, .acco-box > button, [class*=acco-tit], button[aria-expanded]').forEach(el => { try { if (el.getAttribute('aria-expanded') !== 'true') el.click(); } catch (e) {} }));
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await p.waitForTimeout(700);
  }
}
async function grab() {
  return p.evaluate(() => {
    const cl = s => (s || '').replace(/\s+/g, ' ').trim();
    return [...document.querySelectorAll('li.comp-list')].map(li => cl(li.innerText)).filter(t => t.length > 15);
  });
}

const dump = {};
await expand();
dump['베스트'] = await grab();
for (const tab of ['라이트', '스마트기기', '전용', '다이렉트']) {
  await p.evaluate((label) => { const btn = [...document.querySelectorAll('button.search-total-button')].find(e => (e.innerText || '').replace(/\s+/g, ' ').trim() === label); if (btn) btn.click(); }, tab);
  await p.waitForTimeout(4500);
  await expand();
  dump[tab] = await grab();
}
writeFileSync(SC + 'skt-plans-dump.json', JSON.stringify(dump, null, 2));
for (const [t, arr] of Object.entries(dump)) {
  console.error(`\n===== ${t}: ${arr.length}건 =====`);
  arr.slice(0, 12).forEach(x => console.error('  ·', x.slice(0, 115)));
}
await b.close();
