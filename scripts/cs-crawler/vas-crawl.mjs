// SKT·LG U+ 부가서비스 공식 크롤 (안심·컬러링·케어)
import { launch, newPage, gotoRetry, removePopups, mainText } from './lib/browser.mjs';
import { won } from './lib/util.mjs';
import { writeFileSync } from 'fs';
const SC = '/private/tmp/claude-501/-Users-vinsenzo/22c2de51-dc9a-44c2-bacf-7836be4787e0/scratchpad/';

const b = await launch();
const p = await newPage(b);
const out = [];

// SKT: 알려진 컬러링/안심 NA 직접 크롤 (throttle 재시도)
const SKT = [['컬러링', 'NA00000282'], ['컬러링프라임', 'NA00008818'], ['T RING플러스', 'NA00002698'], ['마이스마트콜II', 'NA00005638']];
for (const [nm, na] of SKT) {
  const r = await gotoRetry(p, `https://m.tworld.co.kr/product/callplan?prod_id=${na}`, { waitMs: 2800, retries: 3 });
  if (!r.ok) { out.push({ carrier: 'SKT', name: nm, _note: 'throttle' }); console.error(`SKT ${nm}: throttle`); continue; }
  const body = await mainText(p, { after: ['ZEM'], before: [/top 이용약관|국가고객만족도/], limit: 400 });
  const fee = won(body) || 0;
  out.push({ carrier: 'SKT', name: nm, fee, body: body.slice(0, 200), url: `https://m.tworld.co.kr/product/callplan?prod_id=${na}` });
  console.error(`SKT ${nm}: ${fee || '무료'}`);
}

// LG U+: addon 카테고리에서 상품 수집 → 상세
for (const c of ['addon-safe', 'addon-call-msg', 'addon-phonecare']) {
  const r = await gotoRetry(p, `https://www.lguplus.com/mobile/plan/addon/${c}`, { waitMs: 4500 });
  await removePopups(p);
  const items = await p.evaluate(() => {
    const cl = s => (s || '').replace(/\s+/g, ' ').trim();
    return [...new Map([...document.querySelectorAll('a[href*="/addon/"]')]
      .map(a => [a.getAttribute('href'), cl(a.innerText)]).filter(x => x[1] && x[1].length > 2 && x[1].length < 30)).entries()]
      .map(([h, t]) => ({ h, t }));
  });
  for (const it of items.slice(0, 5)) {
    const u = it.h.startsWith('http') ? it.h : 'https://www.lguplus.com' + it.h;
    const rr = await gotoRetry(p, u, { waitMs: 3500 }); if (!rr.ok) continue;
    await removePopups(p);
    const body = await mainText(p, { limit: 300 });
    out.push({ carrier: 'LGU', name: it.t, fee: won(body) || 0, cat: c, body: body.slice(0, 150), url: u });
    console.error(`LGU ${it.t}: ${won(body) || '무료'}`);
  }
}

writeFileSync(SC + 'vas-skt-lgu.json', JSON.stringify(out, null, 2));
console.error('\n총 ' + out.length + '건');
await b.close();
