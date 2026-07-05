import { launch, newPage, gotoRetry } from './lib/browser.mjs';
import { writeFileSync } from 'fs';
const SC = '/private/tmp/claude-501/-Users-vinsenzo/22c2de51-dc9a-44c2-bacf-7836be4787e0/scratchpad/';
const b = await launch();
const p = await newPage(b);
const r = await gotoRetry(p, 'https://m.tworld.co.kr/product/renewal/mobileplan/list?view=all', { waitMs: 10000, retries: 3 });
console.error('goto', JSON.stringify(r));
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await p.waitForTimeout(3000);
const info = await p.evaluate(() => {
  const cl = s => (s || '').replace(/\s+/g, ' ').trim();
  const anchors = [...document.querySelectorAll('a')];
  const hrefs = {};
  anchors.forEach(a => { const h = a.getAttribute('href') || ''; const key = h.split('?')[0].split('/').slice(0, 4).join('/'); hrefs[key] = (hrefs[key] || 0) + 1; });
  return {
    total: (document.body.innerText.match(/총\s*([\d,]+)\s*건/) || [])[1] || null,
    bodyLen: document.body.innerText.length,
    bodyHead: cl(document.body.innerText).slice(0, 500),
    hrefPatterns: hrefs,
    anchorSample: anchors.filter(a=>/원/.test(a.innerText)).slice(0,5).map(a=>({t:cl(a.innerText).slice(0,90),h:a.getAttribute('href')})),
  };
});
console.error(JSON.stringify(info, null, 2));
writeFileSync(SC + 'skt-plan-list-page.html', await p.content());
await b.close();
