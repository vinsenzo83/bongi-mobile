/**
 * SKB 페이지 구조 진단 — raw HTML + BFF JSON 캡처
 */
import { launch, newPage, gotoRetry } from './lib/browser.mjs';

const INTERNET_URL = 'https://www.bworld.co.kr/product/internet/charge.do?menu_id=P02010000';
const TV_URL       = 'https://www.bworld.co.kr/product/btv/charge.do?menu_id=P03010000';

const browser = await launch();
const page = await newPage(browser);

const bffCaptures = [];

page.on('response', async (resp) => {
  try {
    const url = resp.url();
    const ct = resp.headers()['content-type'] || '';
    if (!ct.includes('json') && !ct.includes('javascript')) return;
    const status = resp.status();
    if (status >= 400) return;
    // capture all ajax calls
    if (url.includes('bworld.co.kr') && !url.match(/\.(css|png|jpg|gif|woff|ico)/)) {
      const body = ct.includes('json') ? await resp.json().catch(() => null) : null;
      bffCaptures.push({ url: url.slice(0, 120), status, ct: ct.slice(0,30), bodyPreview: body ? JSON.stringify(body).slice(0,300) : null });
    }
  } catch (_) {}
});

// ── 인터넷 ────────────────────────────────────────────────────────────────────
console.error('=== 인터넷 URL ===');
await gotoRetry(page, INTERNET_URL, { waitMs: 7000, retries: 3, waitUntil: 'networkidle' });

const iHtml = await page.content();
const iText = await page.evaluate(() => (document.body?.innerText||'').replace(/\s+/g,' ').trim().slice(0,6000));
const iLen = iText.length;

console.error(`HTML len: ${iHtml.length}, text len: ${iLen}`);
console.error('TEXT:', iText.slice(0, 3000));
console.error('BFF captures so far:', JSON.stringify(bffCaptures.slice(0,10), null, 2));

// 추가: 가격 관련 노드 찾기
const priceNodes = await page.evaluate(() => {
  const items = [];
  document.querySelectorAll('*').forEach(el => {
    const t = (el.innerText||'').trim();
    if (/[\d,]{4,7}원|월\s*[\d,]+/.test(t) && t.length < 200 && el.children.length < 3) {
      items.push({ tag: el.tagName, cls: el.className.toString().slice(0,60), text: t.slice(0,120) });
    }
  });
  return items.slice(0,30);
});
console.error('가격 노드:', JSON.stringify(priceNodes, null, 2));

// ── B tv ──────────────────────────────────────────────────────────────────────
bffCaptures.length = 0;
console.error('\n=== B tv URL ===');
await gotoRetry(page, TV_URL, { waitMs: 7000, retries: 3, waitUntil: 'networkidle' });

const tText = await page.evaluate(() => (document.body?.innerText||'').replace(/\s+/g,' ').trim().slice(0,6000));
console.error(`TV text len: ${tText.length}`);
console.error('TV TEXT:', tText.slice(0, 3000));
console.error('TV BFF captures:', JSON.stringify(bffCaptures.slice(0,15), null, 2));

const tvPriceNodes = await page.evaluate(() => {
  const items = [];
  document.querySelectorAll('*').forEach(el => {
    const t = (el.innerText||'').trim();
    if (/[\d,]{4,7}원|월\s*[\d,]+/.test(t) && t.length < 200 && el.children.length < 3) {
      items.push({ tag: el.tagName, cls: el.className.toString().slice(0,60), text: t.slice(0,120) });
    }
  });
  return items.slice(0,30);
});
console.error('TV 가격 노드:', JSON.stringify(tvPriceNodes, null, 2));

await browser.close();
console.log('done');
