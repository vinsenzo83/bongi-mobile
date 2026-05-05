import { chromium } from 'playwright';

const BASE = 'https://bongi-mobile-production.up.railway.app';
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  page.on('console', m => console.log('[console.' + m.type() + ']', m.text()));

  await page.goto(`${BASE}/docs/tm.html?v=${Date.now()}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  await page.fill('#auth-email', 'agent1@bongi.test');
  await page.fill('#auth-pass', 'pass1234!');
  await page.click('#auth-login-btn');

  await page.waitForFunction(
    () => getComputedStyle(document.getElementById('auth-loggedin')).display !== 'none',
    { timeout: 8000 }
  );
  // 충분히 기다림
  await page.waitForTimeout(4000);

  const state = await page.evaluate(() => ({
    incMyState: typeof _incMyState !== 'undefined' ? _incMyState : 'undefined',
    pReadonly: document.getElementById('inc-current-p').readOnly,
    premReadonly: document.getElementById('inc-current-prem').readOnly,
    pVal: document.getElementById('inc-current-p').value,
    premVal: document.getElementById('inc-current-prem').value,
    btnDisabled: document.getElementById('inc-close-deal-btn').disabled,
    fnExists: {
      incApplyAuthState: typeof incApplyAuthState === 'function',
      incFetchMyState: typeof incFetchMyState === 'function',
      authGetToken: typeof authGetToken === 'function',
    }
  }));
  console.log('━━━ STATE ━━━');
  console.log(JSON.stringify(state, null, 2));

  // 강제로 incApplyAuthState 호출
  const after = await page.evaluate(() => {
    incApplyAuthState();
    return {
      pReadonly: document.getElementById('inc-current-p').readOnly,
      btnDisabled: document.getElementById('inc-close-deal-btn').disabled,
    };
  });
  console.log('\n━━━ 강제 호출 후 ━━━');
  console.log(JSON.stringify(after, null, 2));

  await browser.close();
})();
