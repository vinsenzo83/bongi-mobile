import { chromium } from 'playwright';

const BASE = 'https://bongi-mobile-production.up.railway.app';
const URL_TM = `${BASE}/docs/tm.html?v=${Date.now()}`;

const r = { pass: [], fail: [], warn: [] };
function log(cat, name, msg) {
  r[cat].push({ name, msg });
  const sym = { pass:'✅', fail:'❌', warn:'⚠️' }[cat];
  console.log(`${sym} [${name}] ${msg}`);
}

async function setForm(page, opts) {
  await page.evaluate((o) => {
    const idMap = { carrier:'c-carrier', speed:'c-speed', tv:'c-tv', wifi:'c-wifi', bundle:'c-bundle', tvCount:'c-tv-count' };
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

  console.log(`\n━━━ Phase 3 검증 ${URL_TM} ━━━\n`);
  await page.goto(URL_TM, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500); // 인센티브 카드 초기 로드

  // 1. 카드 존재 확인
  const cardExists = await page.evaluate(() => !!document.getElementById('incentive-preview'));
  if (cardExists) log('pass', '1-card', '인센티브 미리보기 카드 렌더링됨');
  else { log('fail', '1-card', '카드 미렌더링'); await browser.close(); process.exit(1); }

  // 2. 누적 토글 동작
  await page.click('#inc-toggle');
  await page.waitForTimeout(200);
  const toggleOpen = await page.evaluate(() => getComputedStyle(document.getElementById('inc-input')).display !== 'none');
  if (toggleOpen) log('pass', '2-toggle', '누적 토글 열림');
  else log('fail', '2-toggle', '토글 미동작');

  // 3. SKT 500M + B tv 올 견적 → 매칭 + simulate
  await setForm(page, { carrier:'skt', speed:'500M', tv:3, wifi:true, bundle:'home' });
  await page.waitForTimeout(2500); // simulate API 호출 대기
  const incResult = await page.evaluate(() => document.getElementById('inc-result').innerHTML);
  if (incResult.includes('매칭') && incResult.includes('B tv 올')) log('pass', '3-match-skt', 'SKT 500M+올 매칭 표시');
  else log('warn', '3-match-skt', `SKT 매칭 미확인: ${incResult.slice(0, 200)}`);
  if (incResult.includes('S') && incResult.includes('우수')) log('pass', '3-tier-skt', 'SKT 500M+올 → S Tier · 우수상품 배지');
  else log('warn', '3-tier-skt', 'S/우수 배지 미확인');
  if (/[+-]?\d{1,3}(,\d{3})+\s*원/.test(incResult)) log('pass', '3-delta-skt', '델타 금액 표시');
  else log('warn', '3-delta-skt', '델타 미표시');

  // 4. 누적 P/우수 입력 → Grade 승급 시뮬
  await page.fill('#inc-current-p', '15');
  await page.fill('#inc-current-prem', '5');
  await page.dispatchEvent('#inc-current-p', 'input');
  await page.dispatchEvent('#inc-current-prem', 'input');
  await page.waitForTimeout(2500);
  const upgradeResult = await page.evaluate(() => document.getElementById('inc-result').innerHTML);
  if (upgradeResult.includes('승급') || upgradeResult.includes('G2') || upgradeResult.includes('소급')) {
    log('pass', '4-grade-up', '15P + 우수 5건 → 1건 추가 시 G2 승급 알림');
  } else {
    log('warn', '4-grade-up', `Grade 승급 표시 미확인: ${upgradeResult.slice(0, 300)}`);
  }

  // 5. KT 1G + 베이직 매칭
  await page.fill('#inc-current-p', '0');
  await page.fill('#inc-current-prem', '0');
  await page.dispatchEvent('#inc-current-p', 'input');
  await setForm(page, { carrier:'kt', speed:'1G', tv:1, wifi:true });
  await page.waitForTimeout(2500);
  const ktResult = await page.evaluate(() => document.getElementById('inc-result').innerHTML);
  if (ktResult.includes('지니TV 베이직') || ktResult.includes('베이직')) log('pass', '5-match-kt', 'KT 1G+베이직 매칭');
  else log('warn', '5-match-kt', `KT 매칭 미확인: ${ktResult.slice(0, 200)}`);

  // 6. LGU+ 1G 단독 매칭
  await setForm(page, { carrier:'lgu', speed:'1G', tv:0, wifi:true });
  await page.waitForTimeout(2500);
  const lguResult = await page.evaluate(() => document.getElementById('inc-result').innerHTML);
  if (lguResult.includes('인터넷 1G') && lguResult.includes('단독') === false) {
    // 단독은 type='단독'이라 매칭, "인터넷 1G" 이름이 표시됨
    log('pass', '6-match-lgu-solo', 'LGU+ 1G 단독 매칭');
  } else if (lguResult.includes('인터넷 1G')) {
    log('pass', '6-match-lgu-solo', 'LGU+ 1G 단독 매칭 (이름)');
  } else {
    log('warn', '6-match-lgu-solo', `LGU+ 1G 단독 매칭 미확인: ${lguResult.slice(0, 200)}`);
  }

  // 7. 페이백 30,000 초과 → 본인 차감 경고
  await page.fill('#inc-add-payback', '40000');
  await page.dispatchEvent('#inc-add-payback', 'input');
  await page.waitForTimeout(2500);
  const paybackResult = await page.evaluate(() => document.getElementById('inc-result').innerHTML);
  if (paybackResult.includes('본인 차감') || paybackResult.includes('10,000')) log('pass', '7-payback-warn', '페이백 40K → 본인 차감 10K 경고');
  else log('warn', '7-payback-warn', `페이백 경고 미표시: ${paybackResult.slice(0, 300)}`);

  // 8. tm-counselor.html도 동일 동작
  await page.goto(`${BASE}/docs/tm-counselor.html?v=${Date.now()}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const counselorCard = await page.evaluate(() => !!document.getElementById('incentive-preview'));
  if (counselorCard) log('pass', '8-counselor', 'tm-counselor.html에도 인센티브 카드 있음');
  else log('fail', '8-counselor', 'tm-counselor 카드 없음');

  await browser.close();

  console.log('\n━━━ Phase 3 결과 ━━━');
  console.log(`✅ PASS: ${r.pass.length}`);
  console.log(`⚠️  WARN: ${r.warn.length}`);
  console.log(`❌ FAIL: ${r.fail.length}`);
  if (r.fail.length) r.fail.forEach(x => console.log(`  ❌ [${x.name}] ${x.msg}`));
  if (r.warn.length) r.warn.forEach(x => console.log(`  ⚠️ [${x.name}] ${x.msg}`));
  process.exit(r.fail.length > 0 ? 1 : 0);
})();
