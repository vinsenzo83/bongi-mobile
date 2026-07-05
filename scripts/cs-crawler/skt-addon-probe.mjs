// SKT 부가서비스 BFF API 탐지 — mobileplan-add 페이지 네트워크 캡처
import { launch, newPage } from './lib/browser.mjs';
const b = await launch();
const p = await newPage(b);
const apis = [];
p.on('response', async (r) => {
  const u = r.url();
  const rt = r.request().resourceType();
  if (rt === 'image' || rt === 'stylesheet' || rt === 'font' || rt === 'script') return;
  try {
    const ct = r.headers()['content-type'] || '';
    if (ct.includes('json')) {
      const body = await r.text();
      if (body.length > 300 && /prod|상품|서비스|Nm|fee|Amt|addv|adsv|sps/.test(body)) apis.push({ url: u, len: body.length, sample: body.slice(0, 220) });
    }
  } catch (e) {}
});
await p.goto('https://m.tworld.co.kr/product/mobileplan-add/list?filters=F01234', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
await p.waitForTimeout(8000);
console.error('캡처된 API:', apis.length);
apis.slice(0, 10).forEach(a => { console.error(`\n[${a.len}] ${a.url}`); console.error('  ' + a.sample); });
await b.close();
