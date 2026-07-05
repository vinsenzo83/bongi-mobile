// SKT 부가서비스 전량 — F01221(스마트폰 275)+F01222(일반폰)+F01223(태블릿) 점진 스크롤 로드
import { launch, newPage, gotoRetry } from './lib/browser.mjs';
import { writeFileSync } from 'fs';
const SC = '/private/tmp/claude-501/-Users-vinsenzo/22c2de51-dc9a-44c2-bacf-7836be4787e0/scratchpad/';

const b = await launch();
const p = await newPage(b);
const all = new Map();

async function loadAll(code) {
  const ok = await gotoRetry(p, `https://m.tworld.co.kr/product/mobileplan-add/list?filters=${code}`, { waitMs: 8000, retries: 3 });
  if (!ok.ok) { console.error(`[${code}] 로드실패`); return; }
  await p.waitForTimeout(2000);
  let stable = 0, prev = 0;
  for (let i = 0; i < 40 && stable < 3; i++) {
    try { const btn = await p.$('button:has-text("더보기"), a:has-text("더보기"), .btn-more, [class*=more]'); if (btn) await btn.click({ timeout: 1500 }).catch(() => {}); } catch (e) {}
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await p.waitForTimeout(1200);
    const n = await p.evaluate(() => document.querySelectorAll('a[href*="prod_id="]').length);
    if (n === prev) stable++; else stable = 0;
    prev = n;
  }
  const items = await p.evaluate(() => {
    const cl = s => (s || '').replace(/\s+/g, ' ').trim();
    const seen = new Set(); const out = [];
    for (const a of document.querySelectorAll('a[href*="prod_id="]')) {
      const href = a.getAttribute('href') || '';
      const pid = (href.match(/prod_id=([A-Z0-9]+)/) || [])[1];
      if (!pid || seen.has(pid)) continue;
      const txt = cl(a.innerText);
      if (!/원|무료/.test(txt) || txt.length < 6) continue;
      seen.add(pid); out.push({ pid, text: txt });
    }
    return out;
  });
  let added = 0;
  for (const it of items) if (!all.has(it.pid)) { all.set(it.pid, it); added++; }
  console.error(`[${code}] 로드 ${items.length} / 신규 ${added} (누적 ${all.size})`);
}

await loadAll('F01231'); // 데이터
await loadAll('F01233'); // 안심/보험
await loadAll('F01235'); // 콘텐츠이용
await loadAll('F01232'); // 혜택/편의
await loadAll('F01236'); // 인증/결제
await loadAll('F01222'); // 일반폰
await loadAll('F01223'); // 태블릿
await loadAll('F01221'); // 스마트폰 275 (마지막, 나머지 흡수)

const out = [...all.values()];
writeFileSync(SC + 'skt-addons-full.json', JSON.stringify(out, null, 2));
console.error(`\n총 고유 ${out.length}건`);
await b.close();
