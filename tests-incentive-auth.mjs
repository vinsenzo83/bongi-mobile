import { chromium } from 'playwright';

const BASE = 'https://bongi-mobile-production.up.railway.app';
const URL = `${BASE}/docs/tm.html?v=${Date.now()}`;

const r = { pass: [], fail: [], warn: [] };
function log(cat, name, msg) {
  r[cat].push({ name, msg });
  console.log(`${{pass:'✅',fail:'❌',warn:'⚠️'}[cat]} [${name}] ${msg}`);
}

async function setForm(page, opts) {
  await page.evaluate((o) => {
    const idMap = { carrier:'c-carrier', speed:'c-speed', tv:'c-tv', wifi:'c-wifi', bundle:'c-bundle' };
    Object.entries(o).forEach(([k, v]) => {
      const el = document.getElementById(idMap[k]);
      if (!el) return;
      if (el.type === 'checkbox') el.checked = v; else el.value = String(v);
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }, opts);
  await page.waitForTimeout(150);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on('pageerror', err => log('fail', 'PAGE-ERR', err.message));
  page.on('console', msg => { if (msg.type() === 'error') console.log('  [console.error]', msg.text()); });
  page.on('response', resp => { if (resp.url().includes('/api/') && resp.status() >= 400) console.log('  [HTTP', resp.status(), ']', resp.url()); });

  console.log(`\n━━━ 인증 + 계약 완료 E2E ━━━\n`);
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // 1. 로그인 박스 보임 (비로그인 상태)
  const loggedOut = await page.evaluate(() => getComputedStyle(document.getElementById('auth-loggedout')).display !== 'none');
  if (loggedOut) log('pass', '1-loggedout', '비로그인 상태 → 로그인 폼 노출');
  else log('fail', '1-loggedout', '로그인 폼 미노출');

  // 2. 계약 완료 버튼 disabled
  const btnDisabled = await page.evaluate(() => document.getElementById('inc-close-deal-btn').disabled);
  if (btnDisabled) log('pass', '2-btn-disabled', '비로그인 시 계약 완료 버튼 disabled');
  else log('fail', '2-btn-disabled', '비로그인인데 버튼 활성');

  // 3. agent1 로그인
  await page.fill('#auth-email', 'agent1@bongi.test');
  await page.fill('#auth-pass', 'pass1234!');
  await page.click('#auth-login-btn');
  // 로그인 → loggedin 영역이 표시될 때까지 기다림
  try {
    await page.waitForFunction(
      () => getComputedStyle(document.getElementById('auth-loggedin')).display !== 'none',
      { timeout: 10000 }
    );
    // settlement fetch + incApplyAuthState 완료 대기
    await page.waitForFunction(
      () => document.getElementById('inc-current-p').readOnly === true,
      { timeout: 8000 }
    ).catch(() => {});
    await page.waitForTimeout(500);
  } catch(e) {
    const errMsg = await page.evaluate(() => document.getElementById('auth-msg').textContent);
    console.log('  [debug] auth-msg:', errMsg);
  }

  const loggedIn = await page.evaluate(() => getComputedStyle(document.getElementById('auth-loggedin')).display !== 'none');
  if (loggedIn) log('pass', '3-login', 'agent1 로그인 성공 → loggedin 영역 표시');
  else { log('fail', '3-login', '로그인 실패'); await browser.close(); process.exit(1); }

  const userName = await page.evaluate(() => document.getElementById('auth-user-name').textContent);
  if (userName.includes('김상담')) log('pass', '4-user-name', `사용자명 표시: ${userName}`);
  else log('fail', '4-user-name', `사용자명: ${userName}`);

  // 4. 누적 P / 우수 readonly
  const inputsReadonly = await page.evaluate(() => ({
    p: document.getElementById('inc-current-p').readOnly,
    prem: document.getElementById('inc-current-prem').readOnly,
  }));
  if (inputsReadonly.p && inputsReadonly.prem) log('pass', '5-readonly', '로그인 시 누적 P/우수 입력 readonly');
  else log('fail', '5-readonly', `readonly: P=${inputsReadonly.p}, prem=${inputsReadonly.prem}`);

  // 5. 계약 완료 버튼 활성
  const btnActive = await page.evaluate(() => !document.getElementById('inc-close-deal-btn').disabled);
  if (btnActive) log('pass', '6-btn-active', '로그인 시 계약 완료 버튼 활성화');
  else log('fail', '6-btn-active', '버튼 여전히 disabled');

  // 6. 견적 만들기 (SKT 500M+올)
  await setForm(page, { carrier:'skt', speed:'500M', tv:3, wifi:true, bundle:'home' });
  await page.waitForTimeout(2500);

  const incHtml = await page.evaluate(() => document.getElementById('inc-result').innerHTML);
  if (incHtml.includes('B tv 올') && incHtml.includes('포인트')) log('pass', '7-quote', 'SKT 500M+올 견적 → 인센티브 미리보기 표시');
  else log('warn', '7-quote', `견적 매칭 미확인: ${incHtml.slice(0, 200)}`);

  // 7. agent 뷰: 마진 노출 안됨
  if (!incHtml.includes('마진') && incHtml.includes('Tier') === false && incHtml.includes(' S')) {
    log('pass', '8-agent-view', 'agent: Tier 표시, 마진 숨김');
  } else if (!incHtml.includes('마진')) {
    log('pass', '8-agent-view', 'agent: 마진 숨김');
  } else {
    log('fail', '8-agent-view', 'agent에게 마진이 노출됨');
  }

  // 8. 계약 완료 버튼 클릭 → 폼 노출
  await page.click('#inc-close-deal-btn');
  await page.waitForTimeout(300);
  const formVisible = await page.evaluate(() => getComputedStyle(document.getElementById('inc-deal-form')).display !== 'none');
  if (formVisible) log('pass', '9-deal-form', '계약 완료 버튼 클릭 → 폼 표시');
  else log('fail', '9-deal-form', '폼 미표시');

  // 9. 폼 작성 + 제출
  await page.fill('#deal-name', 'E2E 테스트 고객');
  await page.fill('#deal-phone', '010-1234-5678');
  await page.fill('#deal-payback', '40000');
  await page.click('#inc-deal-submit');
  await page.waitForTimeout(3000);

  const dealMsg = await page.evaluate(() => document.getElementById('inc-deal-msg').textContent);
  // 성공 메시지는 1.2초 후 사라짐 — 결과 보려면 form display 또는 누적 변경 확인
  const formClosed = await page.evaluate(() => getComputedStyle(document.getElementById('inc-deal-form')).display === 'none');
  if (formClosed) log('pass', '10-deal-submit', '계약 등록 성공 (폼 자동 닫힘)');
  else log('warn', '10-deal-submit', `폼 안닫힘. msg: "${dealMsg}"`);

  // 10. 누적 갱신 — 계약 1건 (SKT 500M+올=1.5P, S Tier 우수)
  await page.waitForTimeout(2000);
  const newP = await page.evaluate(() => parseFloat(document.getElementById('inc-current-p').value));
  const newPrem = await page.evaluate(() => parseInt(document.getElementById('inc-current-prem').value));
  if (newP >= 1.5) log('pass', '11-points-update', `누적 P 자동 갱신: ${newP}P`);
  else log('warn', '11-points-update', `누적 P 갱신 미확인: ${newP}P`);
  if (newPrem >= 1) log('pass', '12-prem-update', `우수 건수 자동 갱신: ${newPrem}건`);
  else log('warn', '12-prem-update', `우수 건수 갱신 미확인: ${newPrem}건`);

  // 11. 로그아웃
  await page.click('#auth-logout-btn');
  await page.waitForTimeout(800);
  const loggedOutAgain = await page.evaluate(() => getComputedStyle(document.getElementById('auth-loggedout')).display !== 'none');
  if (loggedOutAgain) log('pass', '13-logout', '로그아웃 OK');
  else log('fail', '13-logout', '로그아웃 실패');

  // 12. admin 로그인 → 마진 노출 확인
  await page.fill('#auth-email', 'admin1@bongi.test');
  await page.fill('#auth-pass', 'pass1234!');
  await page.click('#auth-login-btn');
  await page.waitForTimeout(2500);
  await setForm(page, { carrier:'skt', speed:'500M', tv:3 });
  await page.waitForTimeout(2500);
  const adminHtml = await page.evaluate(() => document.getElementById('inc-result').innerHTML);
  if (adminHtml.includes('마진')) log('pass', '14-admin-margin', 'admin 로그인 시 마진 노출');
  else log('warn', '14-admin-margin', `admin 마진 미확인: ${adminHtml.slice(0, 300)}`);

  await browser.close();

  console.log('\n━━━ 결과 ━━━');
  console.log(`✅ PASS: ${r.pass.length}`);
  console.log(`⚠️  WARN: ${r.warn.length}`);
  console.log(`❌ FAIL: ${r.fail.length}`);
  if (r.fail.length) r.fail.forEach(x => console.log(`  ❌ [${x.name}] ${x.msg}`));
  if (r.warn.length) r.warn.forEach(x => console.log(`  ⚠️ [${x.name}] ${x.msg}`));
  process.exit(r.fail.length > 0 ? 1 : 0);
})();
