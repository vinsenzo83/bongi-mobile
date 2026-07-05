// SKT 파서 — 요금제(callplan)·결합(callplan prod_id)·FAQ(faq_Id). throttle 재시도 내장.
import { gotoRetry, mainText, newPage } from '../lib/browser.mjs';
import { clean, won, ott, ageTarget } from '../lib/util.mjs';

const CP = code => `https://www.tworld.co.kr/web/product/callplan/${code}`;

export const SKT = {
  carrier: 'SKT',

  async plans(browser) {
    const page = await newPage(browser);
    await gotoRetry(page, 'https://www.tworld.co.kr/web/product/plan/list', { waitMs: 3500 });
    // 더보기/페이지네이션 — 추천순 외 전체 (거미 finding: 1페이지만 보임)
    for (let i = 0; i < 5; i++) {
      try { const m = await page.$('a:has-text("더보기"), button:has-text("더보기"), .btn-more'); if (m) { await m.click(); await page.waitForTimeout(1200); } else break; } catch (e) { break; }
    }
    const codes = await page.evaluate(() => [...new Set([...document.querySelectorAll('a[href*="/callplan/NA"]')]
      .map(a => (a.getAttribute('href').match(/(NA\d+)/) || [])[1]).filter(Boolean))]);
    const out = [];
    for (const code of codes) {
      const r = await gotoRetry(page, CP(code), { waitMs: 3000, retries: 3 }); // throttle 대응
      if (!r.ok) { out.push({ carrier: 'SKT', plan_name: null, _note: 'throttle/크롤실패', source_url: CP(code) }); continue; }
      const d = await page.evaluate(() => ({ title: document.title, body: document.body.innerText.replace(/\s+/g, ' ').slice(0, 600) }));
      const name = d.title.split('<')[0].trim();
      const monthly = (d.body.match(/월\s*([\d,]{4,})\s*원/) || [])[1];
      const disc = (d.body.match(/선택약정[^]*?([\d,]{4,})\s*원/) || [])[1];
      out.push({
        carrier: 'SKT', plan_name: name,
        monthly_fee: monthly ? parseInt(monthly.replace(/,/g, ''), 10) : null,
        discount_fee: disc ? parseInt(disc.replace(/,/g, ''), 10) : null,
        network: '5G', data_amount: (d.body.match(/(무제한|[\d,]+\s*GB)/) || [])[1] || null,
        ott_benefits: ott(d.body), age_target: ageTarget(name + d.body),
        conditions: d.body.slice(0, 300), source_url: CP(code),
      });
    }
    await page.close();
    return out;
  },

  // 결합: prod_id 목록 받아 callplan 상세 (throttle 재시도)
  async bundles(browser, { prodIds = [] } = {}) {
    const page = await newPage(browser);
    const out = [];
    for (const [name, pid] of prodIds) {
      const url = `https://m.tworld.co.kr/product/callplan?prod_id=${pid}`;
      const r = await gotoRetry(page, url, { waitMs: 2800, retries: 3 });
      if (!r.ok) { out.push({ carrier: 'SKT', bundle_name: name, _note: 'throttle/크롤실패', source_url: url }); continue; }
      const body = await mainText(page, { after: ['ZEM'], before: [/top 이용약관|이용약관개인정보|국가고객만족도/], limit: 1100 });
      out.push({ carrier: 'SKT', bundle_name: name, discount_rule: body, source_url: url, _empty: body.length < 40 });
    }
    await page.close();
    return out;
  },

  // FAQ: 카테고리별 data-faq-id → faq/view
  async faqs(browser, { categories = ['?id=1300000&type=03', '?id=1900000&type=09', '?id=1200000&type=02'] } = {}) {
    const page = await newPage(browser);
    const ids = new Set();
    for (const cat of categories) {
      const r = await gotoRetry(page, 'https://m.tworld.co.kr/customer/faq/category' + cat, { waitMs: 2500 });
      if (!r.ok) continue;
      (await page.evaluate(() => [...document.querySelectorAll('button[data-faq-id],[data-faq-id]')].map(e => e.getAttribute('data-faq-id')).filter(Boolean))).forEach(i => ids.add(i));
    }
    const out = [];
    for (const fid of ids) {
      const url = `https://m.tworld.co.kr/customer/faq/view?faq_Id=${fid}`;
      const r = await gotoRetry(page, url, { waitMs: 1200, retries: 2 });
      if (!r.ok) continue;
      const data = await page.evaluate(() => {
        const c = s => (s || '').replace(/\s+/g, ' ').trim();
        const title = document.title.split('|')[0].trim();
        let t = c(document.body.innerText);
        const i = t.lastIndexOf('전체메뉴'); if (i >= 0) t = t.slice(i + 4);
        t = t.replace(/^[^[]*내용\s*(모바일|유선|공통)?\s*/, '').replace(/취소\s*$/, '').trim();
        const qm = t.match(/^(.*?[?？.])\s/);
        return { title, question: qm ? qm[1].trim() : t.slice(0, 60), answer: qm ? t.slice(qm[0].length).trim() : t };
      });
      if (data.answer.length > 30) out.push({ carrier: 'SKT', question: data.question, answer: data.answer.slice(0, 700), source_url: url });
    }
    await page.close();
    return out;
  },
};
