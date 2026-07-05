// LG U+ 부가서비스 BFF API 탐지 — addon 페이지 네트워크 요청 캡처
import { launch, newPage } from './lib/browser.mjs';
const b = await launch();
const p = await newPage(b);
const apis = [];
p.on('response', async (r) => {
  const u = r.url();
  if (/uhdc|prdv|addon|adsv|prod\/v1/.test(u) && r.request().resourceType() !== 'document') {
    try {
      const ct = r.headers()['content-type'] || '';
      if (ct.includes('json')) {
        const body = await r.text();
        if (body.length > 50 && /상품|prod|adsv|부가|서비스|nm/.test(body)) apis.push({ url: u, len: body.length, sample: body.slice(0, 300) });
      }
    } catch (e) {}
  }
});
await p.goto('https://www.lguplus.com/mobile/plan/addon/addon-safe', { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
await p.waitForTimeout(5000);
console.error('캡처된 API:', apis.length);
apis.slice(0, 10).forEach(a => { console.error(`\n[${a.len}] ${a.url}`); console.error('  ' + a.sample); });
await b.close();
