// SKT 부가서비스 전 카테고리 크롤 — 필터코드별 순회, prod_id 기준 dedup
import { launch, newPage, gotoRetry } from './lib/browser.mjs';
import { writeFileSync } from 'fs';
const SC = '/private/tmp/claude-501/-Users-vinsenzo/22c2de51-dc9a-44c2-bacf-7836be4787e0/scratchpad/';
const CODES = ['F01221','F01222','F01223','F01231','F01232','F01233','F01234','F01235','F01236','F01241','F01242','F01251','F01252','F01253'];

const b = await launch();
const p = await newPage(b);
const all = new Map(); // prod_id -> record
const catMeta = {};

for (const code of CODES) {
  const ok = await gotoRetry(p, `https://m.tworld.co.kr/product/mobileplan-add/list?filters=${code}`, { waitMs: 8000, retries: 3 });
  if (!ok.ok) { console.error(`[${code}] 로드실패`); continue; }
  await p.waitForTimeout(1800);
  // 카테고리명 + 총건수
  const meta = await p.evaluate(() => {
    const cl = s => (s || '').replace(/\s+/g, ' ').trim();
    const bodyHead = cl(document.body.innerText);
    const cat = (bodyHead.match(/본문시작\s*(.+?)\s*(추천순|총\s*\d)/) || [])[1] || null;
    const total = (bodyHead.match(/총\s*([\d,]+)\s*건/) || [])[1] || null;
    return { cat, total };
  });
  // 아이템 로드 (스크롤)
  for (let i = 0; i < 8; i++) { await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(700); }
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
  catMeta[code] = { cat: meta.cat, total: meta.total, got: items.length };
  for (const it of items) if (!all.has(it.pid)) all.set(it.pid, { ...it, code, cat: meta.cat });
  console.error(`[${code}] cat="${meta.cat}" total=${meta.total} got=${items.length} (누적 ${all.size})`);
}

const out = [...all.values()];
writeFileSync(SC + 'skt-addons-all.json', JSON.stringify(out, null, 2));
writeFileSync(SC + 'skt-addon-catmeta.json', JSON.stringify(catMeta, null, 2));
console.error(`\n총 고유 부가서비스 ${out.length}건`);
console.error('카테고리별:', JSON.stringify(catMeta, null, 1));
await b.close();
