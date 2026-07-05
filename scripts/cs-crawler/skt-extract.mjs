// SKT 요금제 전체리스트 + 부가서비스 66건 DOM 추출 (SSR 공식값)
import { launch, newPage, gotoRetry } from './lib/browser.mjs';
import { writeFileSync } from 'fs';
const SC = '/private/tmp/claude-501/-Users-vinsenzo/22c2de51-dc9a-44c2-bacf-7836be4787e0/scratchpad/';

const b = await launch();
const p = await newPage(b);

async function loadAll(page, maxRounds = 30) {
  let prev = 0, stable = 0;
  for (let i = 0; i < maxRounds; i++) {
    // 더보기 버튼 클릭 시도
    try {
      const btn = await page.$('button:has-text("더보기"), a:has-text("더보기"), .btn-more, [class*=more]');
      if (btn) { await btn.click({ timeout: 2000 }).catch(() => {}); }
    } catch (e) {}
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1200);
    const n = await page.evaluate(() => document.querySelectorAll('a[href*="prod_id="]').length);
    if (n === prev) { stable++; if (stable >= 3) break; } else stable = 0;
    prev = n;
  }
}

// ========== 요금제 ==========
await gotoRetry(p, 'https://m.tworld.co.kr/product/renewal/mobileplan/list?view=all', { waitMs: 9000, retries: 3 });
await loadAll(p);
const plans = await p.evaluate(() => {
  const cl = s => (s || '').replace(/\s+/g, ' ').trim();
  const seen = new Set();
  const out = [];
  for (const a of document.querySelectorAll('a[href*="prod_id="]')) {
    const href = a.getAttribute('href') || '';
    const pid = (href.match(/prod_id=([A-Z0-9]+)/) || [])[1];
    if (!pid || seen.has(pid)) continue;
    const txt = cl(a.innerText);
    if (txt.length < 3) continue;
    seen.add(pid);
    out.push({ pid, text: txt, href });
  }
  return out;
});
console.error(`요금제 링크 ${plans.length}건`);
writeFileSync(SC + 'skt-plans-raw.json', JSON.stringify(plans, null, 2));
plans.slice(0, 8).forEach(x => console.error('  ·', x.pid, x.text.slice(0, 80)));

// ========== 부가서비스 ==========
await gotoRetry(p, 'https://m.tworld.co.kr/product/mobileplan-add/list?filters=F01234', { waitMs: 9000, retries: 3 });
await loadAll(p);
const addons = await p.evaluate(() => {
  const cl = s => (s || '').replace(/\s+/g, ' ').trim();
  const seen = new Set();
  const out = [];
  for (const a of document.querySelectorAll('a[href*="prod_id="]')) {
    const href = a.getAttribute('href') || '';
    const pid = (href.match(/prod_id=([A-Z0-9]+)/) || [])[1];
    if (!pid || seen.has(pid)) continue;
    const txt = cl(a.innerText);
    if (!/원|무료/.test(txt) || txt.length < 6) continue;
    seen.add(pid);
    out.push({ pid, text: txt, href });
  }
  return out;
});
console.error(`\n부가서비스 링크 ${addons.length}건`);
writeFileSync(SC + 'skt-addons-raw.json', JSON.stringify(addons, null, 2));
addons.slice(0, 10).forEach(x => console.error('  ·', x.pid, x.text.slice(0, 70)));

await b.close();
console.error('\n완료 → scratchpad');
