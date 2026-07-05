// LG U+ 파서 — 요금제(저가 포함 전수)·결합·FAQ
import { gotoRetry, removePopups, mainText, newPage } from '../lib/browser.mjs';
import { clean, won, network, ott, ageTarget, stripCarrierPrefix, detectSalesStatus } from '../lib/util.mjs';

const BASE = 'https://www.lguplus.com';

export const LGU = {
  carrier: 'LG U+',

  // 요금제 전수 (5g-unlimited + 5g-category, 저가 데이터플랜 포함)
  async plans(browser) {
    const page = await newPage(browser);
    await gotoRetry(page, `${BASE}/mobile/plan/mplan/plan-all`, { waitMs: 5000 });
    const items = await page.evaluate(() => {
      const c = s => (s || '').replace(/\s+/g, ' ').trim();
      return [...new Map([...document.querySelectorAll('a[href*="5g-unlimited/"], a[href*="5g-category/"], a[href*="/lte-all/"]')]
        .map(a => [a.getAttribute('href'), c(a.innerText)])).entries()]
        .map(([href, t]) => ({ href, t })).filter(x => x.t && x.t.length > 3);
    });
    const out = [];
    for (const it of items) {
      const url = it.href.startsWith('http') ? it.href : BASE + it.href;
      const r = await gotoRetry(page, url, { waitMs: 3500 });
      if (!r.ok) { out.push({ carrier: 'LG U+', plan_name: stripCarrierPrefix(it.t.split(' ')[0]), monthly_fee: null, _note: '상세 크롤 실패', source_url: url }); continue; }
      await removePopups(page);
      const body = await mainText(page, { limit: 800 });
      const name = stripCarrierPrefix(clean((await page.title()).split('<')[0]));
      const fee = won((body.match(/월정액\s*[\d,]{4,}\s*원|월\s*[\d,]{4,}\s*원/) || [])[0]) || won(it.t);
      const disc = won((body.match(/약정\s*할인\s*시\s*[\d,]{4,}\s*원/) || [])[0]);
      out.push({
        carrier: 'LG U+', plan_name: name, monthly_fee: fee, discount_fee: disc,
        network: network(it.t + body), data_amount: (it.t.match(/(무제한|[\d,]+\s*GB|[\d,]+\s*MB)/) || [])[1] || null,
        ott_benefits: ott(body), age_target: ageTarget(name + body),
        conditions: (it.t + ' | ' + body.slice(0, 150)).slice(0, 300), source_url: url,
      });
    }
    await page.close();
    return out;
  },

  // 결합 전수 (팝업 제거 필수)
  async bundles(browser) {
    const page = await newPage(browser);
    await gotoRetry(page, `${BASE}/benefit-uplus/combined-discount`, { waitMs: 4500 });
    await removePopups(page);
    const codes = await page.evaluate(() =>
      [...new Map([...document.querySelectorAll('a[href*="combined-discount/"]')]
        .map(a => { const m = a.getAttribute('href').match(/combined-discount\/([A-Za-z0-9]+)/); return m ? [m[1], (a.innerText || '').replace(/\s+/g, ' ').trim()] : null; })
        .filter(Boolean)).entries()].map(([code, t]) => ({ code, t })));
    const out = [];
    for (const { code, t } of codes) {
      const url = `${BASE}/benefit-uplus/combined-discount/${code}`;
      const r = await gotoRetry(page, url, { waitMs: 4500 });
      await removePopups(page);
      const body = await mainText(page, { after: ['결합 상품'], before: [/회사소개|이용약관|고객센터 :/], limit: 1200 });
      out.push({ carrier: 'LG U+', bundle_name: t || code, discount_rule: body, source_url: url, _empty: body.length < 40 });
    }
    await page.close();
    return out;
  },

  // FAQ (아코디언 클릭)
  async faqs(browser) {
    const page = await newPage(browser);
    await gotoRetry(page, `${BASE}/support/online/faq`, { waitMs: 4500 });
    const out = [];
    const heads = await page.$$('.c-accordion-header');
    for (const h of heads) {
      try {
        const q = clean(await h.textContent()).replace(/내용 펼치기|내용 접기/g, '');
        await h.click(); await page.waitForTimeout(700);
        const a = await h.evaluate(el => {
          const c = s => (s || '').replace(/\s+/g, ' ').trim();
          const item = el.closest('[class*="accordion-item"]') || el.parentElement;
          const full = c(item.textContent).replace(/내용 펼치기|내용 접기/g, '');
          const hq = c(el.textContent).replace(/내용 펼치기|내용 접기/g, '');
          return full.startsWith(hq) ? full.slice(hq.length).trim() : full.replace(hq, '').trim();
        });
        if (q && a.length > 25) out.push({ carrier: 'LG U+', question: q.replace(/^\[[^\]]+\]\s*/, ''), prefix: (q.match(/^\[([^\]]+)\]/) || [])[1] || '', answer: a.slice(0, 700), source_url: `${BASE}/support/online/faq` });
      } catch (e) { /* skip */ }
    }
    await page.close();
    return out;
  },
};
