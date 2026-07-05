// KT 파서 — 요금제(table.pduct-tbl-plan, 더보기 포함)·결합·FAQ(ServiceTipInfo)
import { gotoRetry, mainText, newPage } from '../lib/browser.mjs';
import { clean, won, ott, ageTarget } from '../lib/util.mjs';

const PD = code => `https://product.kt.com/wDic/productDetail.do?ItemCode=${code}`;

async function collectItemCodes(page, cateUrl) {
  await gotoRetry(page, cateUrl, { waitMs: 3000 });
  // 더보기 반복 클릭 (5G 초이스 등 숨은 상품 노출)
  for (let i = 0; i < 4; i++) {
    try { const m = await page.$('a:has-text("더보기"), button:has-text("더보기"), .btn_more'); if (m) { await m.click(); await page.waitForTimeout(1200); } else break; } catch (e) { break; }
  }
  return page.evaluate(() => [...new Set([...document.querySelectorAll('.btns a[href*="ItemCode"]')]
    .map(a => (a.getAttribute('href').match(/ItemCode=(\d+)/) || [])[1]).filter(Boolean))]);
}

export const KT = {
  carrier: 'KT',

  async plans(browser) {
    const page = await newPage(browser);
    const codes = await collectItemCodes(page, 'https://product.kt.com/wDic/index.do?CateCode=6002&FilterCode=81');
    const out = [];
    for (const code of codes) {
      const r = await gotoRetry(page, PD(code), { waitMs: 1800 });
      if (!r.ok) continue;
      const data = await page.evaluate(() => {
        const c = s => (s || '').replace(/\s+/g, ' ').trim();
        const group = c(document.querySelector('h1')?.innerText);
        const tb = document.querySelector('table.pduct-tbl-plan');
        const rows = tb ? [...tb.querySelectorAll('tbody tr')].map(tr => [...tr.querySelectorAll('th,td')].map(td => c(td.innerText))) : [];
        return { group, rows };
      });
      for (const cells of data.rows) {
        const name = cells[0];
        const fee = won(cells.find(c => /^[\d,]{4,}\s*원$/.test(c)) || cells[1] || '');
        if (!name || name.length > 30 || !fee) continue;
        const row = cells.join(' ');
        out.push({
          carrier: 'KT', plan_name: name, group_name: data.group, monthly_fee: fee, network: '5G',
          data_amount: cells[2] || null, call_amount: cells[4] || null, message: cells[5] || null,
          ott_benefits: ott(row), age_target: ageTarget(row),
          conditions: cells.join(' | ').slice(0, 400), source_url: PD(code),
        });
      }
    }
    await page.close();
    return out;
  },

  async bundles(browser) {
    const page = await newPage(browser);
    const codes = await collectItemCodes(page, 'https://product.kt.com/wDic/index.do?CateCode=6027');
    const out = [];
    for (const code of codes) {
      const r = await gotoRetry(page, PD(code), { waitMs: 1800 });
      if (!r.ok) continue;
      const name = clean(await page.evaluate(() => document.querySelector('h1')?.innerText));
      const body = await mainText(page, { after: ['전체메뉴'], before: [/회사소개|이용약관/], limit: 1000 });
      out.push({ carrier: 'KT', bundle_name: name, discount_rule: body, source_url: PD(code) });
    }
    await page.close();
    return out;
  },

  // FAQ: ServiceTipInfo idx 순회
  async faqs(browser, { idxFrom = 980, idxTo = 1045 } = {}) {
    const page = await newPage(browser);
    const out = [];
    for (let idx = idxFrom; idx <= idxTo; idx++) {
      const url = `https://help.kt.com/servicetip/ServiceTipInfo.do?idx=${idx}`;
      const r = await gotoRetry(page, url, { waitMs: 900, retries: 1 });
      if (!r.ok) continue;
      const title = (await page.title()).split('|')[0].trim();
      let body = await mainText(page, { after: ['전체메뉴'], before: [/HOME고객지원|간편한 셀프 해결|셀프 해결 가이드/], limit: 800 });
      if (!title || title.length < 4 || body.length < 60) continue;
      out.push({ carrier: 'KT', question: title, answer: body, source_url: url });
    }
    await page.close();
    return out;
  },
};
