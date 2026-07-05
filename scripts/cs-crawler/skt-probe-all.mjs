// SKT BFF 탐지 v2 — content-type 무관, body가 JSON스러우면 캡처
import { launch, newPage } from './lib/browser.mjs';
import { writeFileSync } from 'fs';
const SC = '/private/tmp/claude-501/-Users-vinsenzo/22c2de51-dc9a-44c2-bacf-7836be4787e0/scratchpad/';

const b = await launch();

async function probe(label, url, waitMs = 12000) {
  const p = await newPage(b);
  const apis = [];
  p.on('response', async (r) => {
    const rt = r.request().resourceType();
    if (['image', 'stylesheet', 'font', 'media', 'script'].includes(rt)) return;
    try {
      const body = await r.text();
      if (body.length < 150) return;
      const t = body.trimStart();
      if (!(t.startsWith('{') || t.startsWith('['))) return;
      // 상품/요금 관련 키워드 필터
      if (!/prod|Prod|요금|서비스|Nm|Fee|fee|Amt|Chrg|plan|Plan|addv|adsv|GB|월정액|prcPlan|svc/.test(body)) return;
      apis.push({ url: r.url(), method: r.request().method(), len: body.length, body });
    } catch (e) {}
  });
  await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch((e) => console.error(label, 'goto', e.message));
  await p.waitForTimeout(waitMs);
  const txt = await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 400)).catch(() => '');
  console.error(`\n=== ${label} (${url}) ===`);
  console.error('PAGE TEXT:', txt);
  console.error(`JSON 후보 ${apis.length}건:`);
  apis.forEach(a => console.error(`  [${a.len}] ${a.method} ${a.url}`));
  writeFileSync(SC + `skt-probe-${label}.json`, JSON.stringify(apis.map(a => ({ url: a.url, method: a.method, len: a.len })), null, 2));
  apis.sort((x, y) => y.len - x.len).slice(0, 10).forEach((a, i) => writeFileSync(SC + `skt-${label}-body-${i}.json`, a.body));
  await p.close();
}

await probe('plans', 'https://m.tworld.co.kr/product/mobileplan/list', 12000);
await probe('addon', 'https://m.tworld.co.kr/product/mobileplan-add/list?filters=F01234', 12000);

await b.close();
console.error('\n완료');
