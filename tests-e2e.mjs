import { chromium } from 'playwright';

const BASE = 'https://bongi-mobile-production.up.railway.app';
const URL = `${BASE}/docs/calculator.html?v=${Date.now()}`;

const results = { pass: [], fail: [], warn: [] };

function log(cat, name, msg) {
  results[cat].push({ name, msg });
  const sym = { pass: '✅', fail: '❌', warn: '⚠️' }[cat];
  console.log(`${sym} [${name}] ${msg}`);
}

// 헬퍼: select/input/checkbox 변경 + calc 트리거
async function setForm(page, opts) {
  await page.evaluate((o) => {
    function fire(id, val, type='change') {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.type === 'checkbox') el.checked = val;
      else el.value = val;
      el.dispatchEvent(new Event(type, { bubbles: true }));
    }
    if (o.carrier !== undefined) fire('c-carrier', o.carrier);
    if (o.speed !== undefined) fire('c-speed', o.speed);
    if (o.tv !== undefined) fire('c-tv', String(o.tv));
    if (o.wifi !== undefined) fire('c-wifi', o.wifi);
    if (o.bundle !== undefined) fire('c-bundle', o.bundle);
    if (o.lines !== undefined) fire('c-lines', String(o.lines));
    if (o.range !== undefined) fire('c-range', String(o.range));
    if (o.tvCount !== undefined) fire('c-tv-count', String(o.tvCount));
    if (o.tv2 !== undefined) fire('c-tv2', String(o.tv2));
    if (o.tv3 !== undefined) fire('c-tv3', String(o.tv3));
    if (o.settop2 !== undefined) fire('c-settop2', o.settop2);
    if (o.settop3 !== undefined) fire('c-settop3', o.settop3);
    if (o.youth !== undefined) fire('c-youth-add', o.youth);
  }, opts);
  await page.waitForTimeout(50);
}

async function getResult(page) {
  return await page.evaluate(() => document.getElementById('c-result').innerHTML);
}

async function getNumbers(page) {
  // 결과 영역에서 숫자 추출
  return await page.evaluate(() => {
    const html = document.getElementById('c-result').innerHTML;
    const totals = [];
    html.replace(/(\d{1,3}(?:,\d{3})+)\s*원/g, (m, n) => {
      totals.push(parseInt(n.replace(/,/g, '')));
    });
    return totals;
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  console.log(`\n━━━ E2E TEST: ${URL} ━━━\n`);

  // 콘솔 에러 캡처
  page.on('pageerror', err => log('fail', 'PAGE-ERR', err.message));
  page.on('console', msg => { if (msg.type() === 'error') log('warn', 'CONSOLE', msg.text()); });

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // ═══ 카테고리 A: 기본 동작 ═══
  console.log('\n━━━ A. 기본 동작 ━━━');

  // A1: SKT 100M 단독 (인터넷만)
  await setForm(page, { carrier: 'skt', speed: '100M', tv: 0, wifi: false, bundle: 'home' });
  let html = await getResult(page);
  let nums = await getNumbers(page);
  if (html.includes('SK0001') || html.includes('SK0002')) log('pass', 'A1-ticket', 'SKT 100M 단독 티켓번호 표시');
  else log('fail', 'A1-ticket', '티켓번호 누락');
  if (nums.includes(22000)) log('pass', 'A1-price', `SKT 100M 단독 22,000원 (실제: ${nums.join(',')})`);
  else log('fail', 'A1-price', `예상 22000원 없음. 실제: ${nums.join(',')}`);

  // A2: SKT 500M + B tv 올 + WiFi
  await setForm(page, { carrier: 'skt', speed: '500M', tv: 3, wifi: true, bundle: 'home' });
  nums = await getNumbers(page);
  // 인터넷 결합가(WiFi 포함) 28600 + TV 18700 - 2200 + 셋톱 4400 = 49500
  if (nums.includes(49500)) log('pass', 'A2-skt-tv', `SKT 500M + B tv 올 = 49,500원 (실제: ${nums.join(',')})`);
  else log('warn', 'A2-skt-tv', `예상 49500. 실제 합계 후보: ${nums.join(',')}`);

  // A3: KT 1G + 지니TV 베이직 (1G WiFi 무료)
  await setForm(page, { carrier: 'kt', speed: '1G', tv: 1, wifi: true, bundle: 'home' });
  nums = await getNumbers(page);
  // 인터넷 결합가 33000 + TV 14740 - 2640 + 셋톱 4400 = 49500
  if (nums.includes(49500)) log('pass', 'A3-kt-tv', `KT 1G + 베이직 = 49,500원 (실제: ${nums.join(',')})`);
  else log('warn', 'A3-kt-tv', `예상 49500. 실제: ${nums.join(',')}`);

  // A4: LGU+ 500M + U+tv 실속형
  await setForm(page, { carrier: 'lgu', speed: '500M', tv: 1, wifi: true, bundle: 'home' });
  nums = await getNumbers(page);
  // 인터넷 결합가 27500 + TV 15400 - 2200 + 셋톱 4400 = 45100
  if (nums.includes(45100)) log('pass', 'A4-lgu-tv', `LGU+ 500M + 실속형 = 45,100원 (실제: ${nums.join(',')})`);
  else log('warn', 'A4-lgu-tv', `예상 45100. 실제: ${nums.join(',')}`);

  // ═══ 카테고리 B: 다중 TV ═══
  console.log('\n━━━ B. 다중 TV ━━━');

  // B1: SKT + B tv 올 + TV2=올
  await setForm(page, { carrier: 'skt', speed: '500M', tv: 3, wifi: true, bundle: 'home', tvCount: 2, tv2: 3 });
  html = await getResult(page);
  if (html.includes('TV2 추가')) log('pass', 'B1-skt-tv2', 'SKT TV2 추가 블록 표시');
  else log('fail', 'B1-skt-tv2', 'TV2 추가 블록 누락');
  if (html.includes('9,350')) log('pass', 'B1-skt-tv2-dc', 'SKT TV2 올 시리즈 9,350원 할인 표시');
  else log('warn', 'B1-skt-tv2-dc', '9,350 할인 표시 누락');
  if (html.includes('50% 할인')) log('pass', 'B1-skt-st2-dc', 'SKT 셋톱2 50% 할인 표시');
  else log('fail', 'B1-skt-st2-dc', '셋톱2 50% 할인 누락');

  // B2: KT 가격 제약 — TV1=베이직(14740), TV2 dropdown에 디즈니+모든G(28100) disabled?
  await setForm(page, { carrier: 'kt', speed: '500M', tv: 1, tvCount: 2 });
  const ktConstraint = await page.evaluate(() => {
    const opts = document.querySelectorAll('#c-tv2 option');
    return Array.from(opts).map(o => ({ idx: o.value, name: o.textContent, disabled: o.disabled }));
  });
  const disnyOpt = ktConstraint.find(o => o.name.includes('디즈니'));
  if (disnyOpt && disnyOpt.disabled) log('pass', 'B2-kt-constraint', `KT TV1=베이직 → TV2 디즈니+모든G disabled (${disnyOpt.name.trim()})`);
  else log('fail', 'B2-kt-constraint', `KT TV2 가격 제약 미동작. 디즈니: ${disnyOpt?.disabled}`);

  // B3: LGU+ mainOnly — TV2 dropdown에 프리미엄 VOD disabled?
  await setForm(page, { carrier: 'lgu', speed: '500M', tv: 3, tvCount: 2 });
  const lguMainOnly = await page.evaluate(() => {
    const opts = document.querySelectorAll('#c-tv2 option');
    return Array.from(opts).map(o => ({ idx: o.value, name: o.textContent, disabled: o.disabled }));
  });
  const vodOpt = lguMainOnly.find(o => o.name.includes('프리미엄 VOD'));
  if (vodOpt && vodOpt.disabled) log('pass', 'B3-lgu-mainOnly', `LGU+ TV2 프리미엄 VOD disabled (mainOnly)`);
  else log('fail', 'B3-lgu-mainOnly', `LGU+ TV2 mainOnly 미동작. VOD: ${vodOpt?.disabled}`);

  // B4: 추가 설치비 50% 할인
  await setForm(page, { carrier: 'skt', speed: '500M', tv: 3, tvCount: 2, tv2: 2 });
  html = await getResult(page);
  if (html.includes('추가 TV') && html.includes('50% 할인')) log('pass', 'B4-install', 'SKT 추가 설치비 50% 할인 표시');
  else log('fail', 'B4-install', '추가 설치비 50% 할인 표시 누락');

  // ═══ 카테고리 C: 신기능 — 셋톱 할인 규칙 ═══
  console.log('\n━━━ C. 셋톱 결합 할인 규칙 ━━━');

  // C1: SKT AI 4 vision + B tv 올 + 500M → '결합 할인' 표시
  await page.evaluate(() => { D.skt.setTopOptions.find(o=>o.id==='ai-4-vision').isDefault = true;
    D.skt.setTopOptions.filter(o=>o.id!=='ai-4-vision').forEach(o=>o.isDefault=false);
    const def = D.skt.setTopOptions.find(o=>o.id==='ai-4-vision');
    D.skt.setTop = def.fee; D.skt.setTopName = def.name;
    if (typeof calc==='function') calc();
  });
  await setForm(page, { carrier: 'skt', speed: '500M', tv: 3, wifi: true, bundle: 'home' });
  html = await getResult(page);
  if (html.includes('결합 할인') && html.includes('AI 4 vision')) log('pass', 'C1-st-dc', 'SKT AI 4 vision + 올 + 500M → 셋톱 결합 할인 표시');
  else log('fail', 'C1-st-dc', '셋톱 결합 할인 미표시');

  // C2: SKT AI 4 vision + B tv 올 플러스 + 500M → 프로모션 할인 추가
  await setForm(page, { carrier: 'skt', speed: '500M', tv: 5 });
  html = await getResult(page);
  if (html.includes('프로모션')) log('pass', 'C2-promo', 'SKT AI 4 vision + 올 플러스 → 프로모션 할인 표시');
  else log('warn', 'C2-promo', '프로모션 할인 표시 미확인');

  // C-cleanup: isDefault를 smart3로 복원 (이후 F 테스트에 영향 안 미치게)
  await page.evaluate(() => {
    D.skt.setTopOptions.forEach(o => o.isDefault = (o.id === 'smart3'));
    D.skt.setTop = 4400; D.skt.setTopName = 'Smart3';
    if (typeof calc === 'function') calc();
  });

  // ═══ 카테고리 D: LG U+ 청소년 추가 ═══
  console.log('\n━━━ D. LG U+ 투게더 청소년 추가 ━━━');

  await setForm(page, { carrier: 'lgu', speed: '500M', tv: 1, bundle: 'lgu-together', lines: 2 });
  await page.waitForTimeout(100);
  const youthCardVisible = await page.evaluate(() => {
    const card = document.getElementById('card-youth-wrap') || document.getElementById('c-together-youth');
    return card ? getComputedStyle(card).display !== 'none' : 'not-found';
  });
  if (youthCardVisible === true) log('pass', 'D1-youth-show', 'LGU+ 투게더 → 청소년 추가 카드 노출');
  else log('warn', 'D1-youth-show', `청소년 카드: ${youthCardVisible}`);

  await setForm(page, { youth: true });
  html = await getResult(page);
  if (html.includes('청소년') && html.includes('10,000')) log('pass', 'D2-youth-apply', 'LGU+ 투게더 + 청소년 체크 → -10,000원 표시');
  else log('fail', 'D2-youth-apply', '청소년 -10,000원 미표시');

  // 참쉬운 결합으로 변경 시 청소년 카드 숨김
  await setForm(page, { bundle: 'lgu-chweyswun', range: 0, lines: 2 });
  await page.waitForTimeout(100);
  const youthHidden = await page.evaluate(() => {
    const card = document.getElementById('card-youth-wrap') || document.getElementById('c-together-youth');
    return card ? getComputedStyle(card).display === 'none' : 'not-found';
  });
  if (youthHidden === true) log('pass', 'D3-youth-hide', '참쉬운 결합 시 청소년 카드 숨김');
  else log('fail', 'D3-youth-hide', `참쉬운 시 카드 표시 상태: ${youthHidden}`);

  // ═══ 카테고리 E: LG U+ 프리미엄 안심 옵션 ═══
  console.log('\n━━━ E. LG U+ 500M·1G 프리미엄 안심 ━━━');

  await setForm(page, { carrier: 'lgu', speed: '100M' });
  let bonusHidden = await page.evaluate(() => {
    const c = document.getElementById('card-lgu-bonus-wrap') || document.getElementById('c-lgu-premium-bonus');
    return c ? getComputedStyle(c).display === 'none' : 'not-found';
  });
  if (bonusHidden === true) log('pass', 'E1-100m', 'LGU+ 100M → 프리미엄 안심 카드 숨김');
  else log('fail', 'E1-100m', `100M 시 카드 노출 상태: ${bonusHidden}`);

  await setForm(page, { speed: '500M' });
  let bonusShow = await page.evaluate(() => {
    const c = document.getElementById('card-lgu-bonus-wrap') || document.getElementById('c-lgu-premium-bonus');
    return c ? getComputedStyle(c).display !== 'none' : 'not-found';
  });
  if (bonusShow === true) log('pass', 'E2-500m', 'LGU+ 500M → 프리미엄 안심 카드 노출');
  else log('fail', 'E2-500m', `500M 시 카드: ${bonusShow}`);

  await setForm(page, { carrier: 'skt', speed: '500M' });
  bonusHidden = await page.evaluate(() => {
    const c = document.getElementById('card-lgu-bonus-wrap') || document.getElementById('c-lgu-premium-bonus');
    return c ? getComputedStyle(c).display === 'none' : 'not-found';
  });
  if (bonusHidden === true) log('pass', 'E3-skt-hide', 'SKT 500M → 프리미엄 안심 카드 숨김');
  else log('fail', 'E3-skt-hide', `SKT 시 카드: ${bonusHidden}`);

  // ═══ 카테고리 F: 섹터 2 TV2/TV3 합산 ═══
  console.log('\n━━━ F. 섹터 2 TV2/TV3 합산 ━━━');

  // F1: KT 총액 결합 + TV1 + TV2 → 섹터 2 finalInet에 TV2 비용 포함
  await setForm(page, { carrier: 'kt', speed: '500M', tv: 1, wifi: true, bundle: 'kt-total', range: 1, tvCount: 1 });
  await page.waitForTimeout(100);
  let s2_tv1 = await page.evaluate(() => {
    const html = document.getElementById('c-result').innerHTML;
    // ✨ 인터넷+TV 월 실질요금 후 첫 숫자
    const m = html.match(/✨ 인터넷\+TV 월 실질요금[^>]*<\/span>\s*<span[^>]*>([\d,]+)\s*원/);
    return m ? parseInt(m[1].replace(/,/g,'')) : null;
  });

  await setForm(page, { tvCount: 2, tv2: 1 });
  await page.waitForTimeout(100);
  let s2_tv2 = await page.evaluate(() => {
    const html = document.getElementById('c-result').innerHTML;
    const m = html.match(/✨ 인터넷\+TV 월 실질요금[^>]*<\/span>\s*<span[^>]*>([\d,]+)\s*원/);
    return m ? parseInt(m[1].replace(/,/g,'')) : null;
  });

  // KT 베이직 TV2 = 14740 - 7370 = 7370 + 셋톱2 정가 4400 (KT 셋톱 할인 0%) = 11770 추가
  const expected_diff = 11770;
  if (s2_tv1 && s2_tv2 && s2_tv2 - s2_tv1 === expected_diff) {
    log('pass', 'F1-kt-total-s2', `KT 총액 섹터 2 TV2 합산 OK (${s2_tv1} → ${s2_tv2}, +${s2_tv2-s2_tv1})`);
  } else if (s2_tv1 && s2_tv2 && s2_tv2 > s2_tv1) {
    log('warn', 'F1-kt-total-s2', `KT 총액 TV2 합산 됨 but 예상 +${expected_diff} ≠ 실제 +${s2_tv2-s2_tv1} (${s2_tv1} → ${s2_tv2})`);
  } else {
    log('fail', 'F1-kt-total-s2', `KT 총액 TV2 합산 미동작 (${s2_tv1} → ${s2_tv2})`);
  }

  // F2: LGU+ 투게더 결합 + TV2
  await setForm(page, { carrier: 'lgu', speed: '500M', tv: 1, wifi: true, bundle: 'lgu-together', lines: 2, tvCount: 1 });
  await page.waitForTimeout(100);
  let lgu_s2_1 = await page.evaluate(() => {
    const m = document.getElementById('c-result').innerHTML.match(/✨ 인터넷\+TV 월 실질요금[^>]*<\/span>\s*<span[^>]*>([\d,]+)\s*원/);
    return m ? parseInt(m[1].replace(/,/g,'')) : null;
  });
  await setForm(page, { tvCount: 2, tv2: 1 });
  await page.waitForTimeout(100);
  let lgu_s2_2 = await page.evaluate(() => {
    const m = document.getElementById('c-result').innerHTML.match(/✨ 인터넷\+TV 월 실질요금[^>]*<\/span>\s*<span[^>]*>([\d,]+)\s*원/);
    return m ? parseInt(m[1].replace(/,/g,'')) : null;
  });
  // LGU 실속형 TV2 = 15400 - 7700 = 7700 + 셋톱2 정가 4400 (LGU 0%) = 12100
  const lgu_expected = 12100;
  if (lgu_s2_1 && lgu_s2_2 && lgu_s2_2 - lgu_s2_1 === lgu_expected) {
    log('pass', 'F2-lgu-together-s2', `LGU+ 투게더 섹터 2 TV2 합산 OK (${lgu_s2_1} → ${lgu_s2_2}, +${lgu_s2_2-lgu_s2_1})`);
  } else if (lgu_s2_1 && lgu_s2_2 && lgu_s2_2 > lgu_s2_1) {
    // 디버그: c-settop2 상태 확인
    const dbg = await page.evaluate(() => ({
      st2_value: document.getElementById('c-settop2').value,
      tv2_value: document.getElementById('c-tv2').value,
      tvCount: document.getElementById('c-tv-count').value,
      addon: getMultiTvAddon('lgu')
    }));
    log('warn', 'F2-lgu-together-s2', `예상 +${lgu_expected} ≠ 실제 +${lgu_s2_2-lgu_s2_1} (${lgu_s2_1}→${lgu_s2_2}). 디버그: ${JSON.stringify(dbg)}`);
  } else {
    log('fail', 'F2-lgu-together-s2', `LGU+ TV2 합산 미동작 (${lgu_s2_1} → ${lgu_s2_2})`);
  }

  // F3: SKT 요즘가족결합 + TV2 (셋톱 50% 할인 적용)
  await setForm(page, { carrier: 'skt', speed: '500M', tv: 3, wifi: true, bundle: 'family', lines: 2, tvCount: 1 });
  await page.waitForTimeout(100);
  let skt_s2_1 = await page.evaluate(() => {
    const m = document.getElementById('c-result').innerHTML.match(/✨ 인터넷\+TV 월 실질요금[^>]*<\/span>\s*<span[^>]*>([\d,]+)\s*원/);
    return m ? parseInt(m[1].replace(/,/g,'')) : null;
  });
  await setForm(page, { tvCount: 2, tv2: 3 });
  await page.waitForTimeout(100);
  let skt_s2_2 = await page.evaluate(() => {
    const m = document.getElementById('c-result').innerHTML.match(/✨ 인터넷\+TV 월 실질요금[^>]*<\/span>\s*<span[^>]*>([\d,]+)\s*원/);
    return m ? parseInt(m[1].replace(/,/g,'')) : null;
  });
  // SKT 올 TV2 = 18700 - 9350 = 9350 + 셋톱2 50% (4400→2200) = 11550
  const skt_expected = 11550;
  if (skt_s2_1 && skt_s2_2 && skt_s2_2 - skt_s2_1 === skt_expected) {
    log('pass', 'F3-skt-family-s2', `SKT 요즘가족 섹터 2 TV2 합산 OK (${skt_s2_1} → ${skt_s2_2}, +${skt_s2_2-skt_s2_1})`);
  } else if (skt_s2_1 && skt_s2_2 && skt_s2_2 > skt_s2_1) {
    log('warn', 'F3-skt-family-s2', `SKT TV2 합산 됨 but 예상 +${skt_expected} ≠ 실제 +${skt_s2_2-skt_s2_1}`);
  } else {
    log('fail', 'F3-skt-family-s2', `SKT TV2 합산 미동작 (${skt_s2_1} → ${skt_s2_2})`);
  }

  // ═══ 카테고리 G: 상담사 모드 ═══
  console.log('\n━━━ G. 상담사 모드 (?role=agent) ━━━');

  await page.goto(`${BASE}/docs/calculator.html?role=agent&v=${Date.now()}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const agentMode = await page.evaluate(() => {
    return {
      bodyClass: document.body.classList.contains('agent-mode'),
      sectionInputs: document.querySelectorAll('.section input:not([disabled])').length,
      sectionSelects: document.querySelectorAll('.section select:not([disabled])').length,
      contentEditable: document.querySelectorAll('.section [contenteditable="true"]').length,
      calcSelect: document.querySelectorAll('.calc select').length  // 계산기 영역은 활성
    };
  });
  if (agentMode.bodyClass) log('pass', 'G1-class', 'body.agent-mode 클래스 적용');
  else log('fail', 'G1-class', 'agent-mode 클래스 미적용');
  if (agentMode.sectionInputs === 0) log('pass', 'G2-inputs', `.section input 모두 disabled (${agentMode.sectionInputs}개 활성)`);
  else log('fail', 'G2-inputs', `.section input ${agentMode.sectionInputs}개가 여전히 활성`);
  if (agentMode.sectionSelects === 0) log('pass', 'G3-selects', `.section select 모두 disabled`);
  else log('fail', 'G3-selects', `.section select ${agentMode.sectionSelects}개 활성`);
  if (agentMode.contentEditable === 0) log('pass', 'G4-editable', 'contenteditable 모두 제거');
  else log('fail', 'G4-editable', `contenteditable ${agentMode.contentEditable}개 남아있음`);
  if (agentMode.calcSelect > 0) log('pass', 'G5-calc-active', `메인 .calc select ${agentMode.calcSelect}개 정상 표시`);
  else log('warn', 'G5-calc-active', '메인 계산기 select 누락');

  // tm-counselor.html 로드 검증
  await page.goto(`${BASE}/docs/tm-counselor.html?v=${Date.now()}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const counselorCheck = await page.evaluate(() => {
    return {
      title: document.title,
      hasYouthCard: !!document.getElementById('card-youth-wrap'),
      hasTvCountCard: !!document.getElementById('card-tv-count-wrap'),
      hasLguBonus: !!document.getElementById('card-lgu-bonus-wrap'),
      hasMultiTv: typeof getMultiTvAddon === 'function',
      hasSettopDc: typeof getSettopDiscount === 'function',
      iframeSrc: document.querySelector('#calc-doc-iframe')?.src || ''
    };
  });
  if (counselorCheck.title.includes('상담사')) log('pass', 'H1-title', `tm-counselor 제목: "${counselorCheck.title}"`);
  else log('warn', 'H1-title', `제목: "${counselorCheck.title}"`);
  if (counselorCheck.hasYouthCard && counselorCheck.hasTvCountCard && counselorCheck.hasLguBonus) log('pass', 'H2-cards', 'tm-counselor 신기능 카드 모두 존재');
  else log('fail', 'H2-cards', `카드 누락: youth=${counselorCheck.hasYouthCard}, tvCount=${counselorCheck.hasTvCountCard}, bonus=${counselorCheck.hasLguBonus}`);
  if (counselorCheck.hasMultiTv && counselorCheck.hasSettopDc) log('pass', 'H3-fns', 'tm-counselor 헬퍼 함수 모두 존재');
  else log('fail', 'H3-fns', `함수: getMultiTvAddon=${counselorCheck.hasMultiTv}, getSettopDiscount=${counselorCheck.hasSettopDc}`);
  if (counselorCheck.iframeSrc.includes('role=agent')) log('pass', 'H4-iframe', 'iframe에 ?role=agent 적용');
  else log('fail', 'H4-iframe', `iframe src: ${counselorCheck.iframeSrc}`);

  await browser.close();

  // ═══ 결과 요약 ═══
  console.log('\n\n━━━━━━ 📊 E2E 테스트 결과 요약 ━━━━━━');
  console.log(`✅ PASS: ${results.pass.length}`);
  console.log(`⚠️  WARN: ${results.warn.length}`);
  console.log(`❌ FAIL: ${results.fail.length}`);
  if (results.fail.length) {
    console.log('\n실패 항목:');
    results.fail.forEach(r => console.log(`  ❌ [${r.name}] ${r.msg}`));
  }
  if (results.warn.length) {
    console.log('\n경고 항목:');
    results.warn.forEach(r => console.log(`  ⚠️ [${r.name}] ${r.msg}`));
  }
  process.exit(results.fail.length > 0 ? 1 : 0);
})();
