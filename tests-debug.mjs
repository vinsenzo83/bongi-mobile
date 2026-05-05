import { chromium } from 'playwright';

const BASE = 'https://bongi-mobile-production.up.railway.app';
const URL = `${BASE}/docs/calculator.html?v=${Date.now()}`;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  async function setForm(opts) {
    await page.evaluate((o) => {
      function fire(id, val) {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.type === 'checkbox') el.checked = val;
        else el.value = val;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      Object.entries(o).forEach(([k, v]) => {
        const idMap = { carrier:'c-carrier', speed:'c-speed', tv:'c-tv', wifi:'c-wifi', bundle:'c-bundle', lines:'c-lines', range:'c-range', tvCount:'c-tv-count', tv2:'c-tv2', tv3:'c-tv3', settop2:'c-settop2', settop3:'c-settop3' };
        if (idMap[k]) fire(idMap[k], typeof v === 'number' ? String(v) : v);
      });
    }, opts);
    await page.waitForTimeout(100);
  }

  // F2: LGU+ 투게더 TV2 디버그
  console.log('\n━━ F2 디버그: LGU+ 투게더 TV2 ━━');
  await setForm({ carrier: 'lgu', speed: '500M', tv: 1, wifi: true, bundle: 'lgu-together', lines: 2, tvCount: 2, tv2: 1 });
  let dbg = await page.evaluate(() => {
    const st2 = document.getElementById('c-settop2');
    const tv2 = document.getElementById('c-tv2');
    const st2Opts = Array.from(st2.options).map(o => ({ value: o.value, text: o.textContent.slice(0, 50), selected: o.selected }));
    const m = getMultiTvAddon('lgu');
    return {
      tv2_value: tv2.value,
      tv2_options: Array.from(tv2.options).map(o => ({ value: o.value, text: o.textContent.slice(0, 50), disabled: o.disabled })).slice(0, 6),
      st2_value: st2.value,
      st2_options: st2Opts,
      st2_innerHTML_len: st2.innerHTML.length,
      multiAdd_totalAdd: m.totalAdd,
      multiAdd_html_preview: m.html.slice(0, 200),
      lgu_settopDiscountRate: D.lgu.additionalTvPolicy.settopDiscountRate,
      lgu_first_setTopOption: D.lgu.setTopOptions[0]
    };
  });
  console.log(JSON.stringify(dbg, null, 2));

  // F3: SKT 요즘가족 TV2 디버그
  console.log('\n━━ F3 디버그: SKT 요즘가족 TV2 ━━');
  await setForm({ carrier: 'skt', speed: '500M', tv: 3, wifi: true, bundle: 'family', lines: 2, tvCount: 2, tv2: 3 });
  dbg = await page.evaluate(() => {
    const st2 = document.getElementById('c-settop2');
    const tv2 = document.getElementById('c-tv2');
    const m = getMultiTvAddon('skt');
    return {
      tv2_value: tv2.value,
      st2_value: st2.value,
      st2_first_3: Array.from(st2.options).slice(0, 3).map(o => ({ value: o.value, text: o.textContent.slice(0, 50), selected: o.selected })),
      multiAdd_totalAdd: m.totalAdd,
      skt_settopDiscountRate: D.skt.additionalTvPolicy.settopDiscountRate,
      skt_first_setTopOption: D.skt.setTopOptions[0]
    };
  });
  console.log(JSON.stringify(dbg, null, 2));

  await browser.close();
})();
