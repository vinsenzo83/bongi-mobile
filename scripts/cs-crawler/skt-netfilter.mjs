import { launch, newPage, gotoRetry } from './lib/browser.mjs';
import { writeFileSync } from 'fs';
const SC = '/private/tmp/claude-501/-Users-vinsenzo/22c2de51-dc9a-44c2-bacf-7836be4787e0/scratchpad/';
const b = await launch();
const p = await newPage(b);
await gotoRetry(p, 'https://m.tworld.co.kr/product/renewal/mobileplan/list?view=all', { waitMs: 9000, retries: 3 });
await p.waitForTimeout(2000);
// "조건 설정하고 내게 맞는 요금제 찾기 더보기" 클릭해 필터 패널 열기
for (const label of ['조건 설정', '더보기', '필터', '상세 조건']) {
  await p.evaluate((l) => { const btn = [...document.querySelectorAll('button,a,span')].find(e => (e.innerText||'').includes(l)); if (btn) btn.click(); }, label);
  await p.waitForTimeout(1200);
}
// 필터 패널 내 모든 항목 (label/checkbox + data 속성)
const items = await p.evaluate(() => {
  const cl = s => (s || '').replace(/\s+/g, ' ').trim();
  const out = [];
  document.querySelectorAll('[data-fltid],[data-flt],[data-filterid],label,li,button,span').forEach(e => {
    const t = cl(e.innerText);
    const attrs = {};
    for (const a of e.attributes || []) if (/flt|filter|network|net|band/i.test(a.name)) attrs[a.name] = a.value;
    if (t && (/^(5G|LTE|3G|4G)$/.test(t) || Object.keys(attrs).length)) out.push({ t: t.slice(0,25), attrs });
  });
  return out;
});
console.error('=== 필터 항목(통신망/속성) ===');
[...new Map(items.map(i=>[JSON.stringify(i),i])).values()].slice(0,40).forEach(i=>console.error('  '+JSON.stringify(i)));
// 통신망 텍스트 주변 HTML
const netHtml = await p.evaluate(() => {
  const el = [...document.querySelectorAll('*')].find(e => /통신망|네트워크|통신\s*방식/.test(e.textContent) && e.children.length < 15 && e.textContent.length < 200);
  return el ? el.outerHTML.slice(0, 800) : 'not found';
});
console.error('\n=== 통신망 영역 HTML ===\n' + netHtml);
writeFileSync(SC + 'skt-netfilter.txt', netHtml + '\n\n' + JSON.stringify(items,null,2));
await b.close();
