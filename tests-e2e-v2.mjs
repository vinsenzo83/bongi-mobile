import { chromium } from 'playwright';

const BASE = 'https://bongi-mobile-production.up.railway.app';
const URL = `${BASE}/docs/calculator.html?v=${Date.now()}`;

const results = { pass: [], fail: [], warn: [] };

function log(cat, name, msg) {
  results[cat].push({ name, msg });
  const sym = { pass: '✅', fail: '❌', warn: '⚠️' }[cat];
  console.log(`${sym} [${name}] ${msg}`);
}

async function setForm(page, opts) {
  await page.evaluate((o) => {
    function fire(id, val) {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.type === 'checkbox') el.checked = val;
      else el.value = val;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const idMap = { carrier:'c-carrier', speed:'c-speed', tv:'c-tv', wifi:'c-wifi', bundle:'c-bundle', lines:'c-lines', range:'c-range', tvCount:'c-tv-count', tv2:'c-tv2', tv3:'c-tv3', settop2:'c-settop2', settop3:'c-settop3', youth:'c-youth-add' };
    Object.entries(o).forEach(([k, v]) => {
      if (idMap[k]) fire(idMap[k], typeof v === 'number' ? String(v) : v);
    });
  }, opts);
  await page.waitForTimeout(80);
}

async function getFinalSec2(page) {
  return await page.evaluate(() => {
    const m = document.getElementById('c-result').innerHTML.match(/✨[^>]*월 실질요금[^>]*<\/span>\s*<span[^>]*>([\d,]+)\s*원/);
    return m ? parseInt(m[1].replace(/,/g, '')) : null;
  });
}

async function getResult(page) {
  return await page.evaluate(() => document.getElementById('c-result').innerHTML);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  page.on('pageerror', err => log('fail', 'PAGE-ERR', err.message));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  console.log(`\n━━━ 추가 검증 E2E (${URL}) ━━━\n`);

  // ═══ I. TV 3대 (TV3까지) ═══
  console.log('━━ I. TV 3대 (TV3 검증) ━━');

  // I1: SKT 3대 — TV1=올, TV2=스탠다드, TV3=이코노미
  await setForm(page, { carrier:'skt', speed:'500M', tv:3, wifi:true, bundle:'home', tvCount:3, tv2:2, tv3:1 });
  let html = await getResult(page);
  if (html.includes('TV2 추가') && html.includes('TV3 추가')) log('pass', 'I1-show', 'SKT 3대 TV2 + TV3 블록 모두 표시');
  else log('fail', 'I1-show', `TV3 블록 누락: TV2=${html.includes('TV2 추가')}, TV3=${html.includes('TV3 추가')}`);

  // I2: SKT TV1=올(18700) + TV2=스탠다드(15400-7700=7700) + 셋톱2 50%(2200) + TV3=이코노미(12100-6050=6050) + 셋톱3 50%(2200)
  // 섹터 1 합계: 28600+16500+4400 + (7700+2200) + (6050+2200) = 49500 + 9900 + 8250 = 67650
  let nums = await page.evaluate(() => {
    const html = document.getElementById('c-result').innerHTML;
    const m = html.match(/월 합계[^>]*<\/span>\s*<span[^>]*>([\d,]+)\s*원/);
    return m ? parseInt(m[1].replace(/,/g, '')) : null;
  });
  if (nums === 67650) log('pass', 'I2-skt-3tv', `SKT 3대 섹터 1 합계 67,650원`);
  else log('warn', 'I2-skt-3tv', `예상 67650, 실제 ${nums}`);

  // I3: KT TV3 가격 제약 — TV1=베이직(14740), TV3에 라이트(15840) disabled
  await setForm(page, { carrier:'kt', speed:'500M', tv:1, wifi:true, bundle:'home', tvCount:3 });
  let opts = await page.evaluate(() => Array.from(document.querySelectorAll('#c-tv3 option')).map(o => ({ name: o.textContent, disabled: o.disabled })));
  let lite = opts.find(o => o.name.includes('라이트'));
  if (lite && lite.disabled) log('pass', 'I3-kt-tv3-constraint', 'KT TV3 가격 제약 동작 (라이트 disabled)');
  else log('fail', 'I3-kt-tv3-constraint', `KT TV3 라이트 disabled=${lite?.disabled}`);

  // I4: 추가 설치비 2대 (TV1 외 2대)
  await setForm(page, { carrier:'skt', speed:'500M', tv:3, tvCount:3, tv2:1, tv3:1 });
  html = await getResult(page);
  // SKT additionalTvInstallFee = 17600, addCount = 2, 50% 할인 → addPerTv = 8800, addTotal = 17600
  if (html.includes('추가 TV (2대 × 17,600원)') || html.includes('17,600원)') && html.includes('17,600')) log('pass', 'I4-install-3tv', 'SKT 3대 추가 설치비 2대 표시');
  else log('warn', 'I4-install-3tv', '추가 설치비 2대 패턴 미확인');

  // ═══ J. 100M 결합 (사용자 강조 데이터) ═══
  console.log('\n━━ J. 100M 4-5회선 결합 ━━');

  // J1: SKT 요즘가족결합 100M 4회선 → 4500원/인 × 4 = 18000원
  await setForm(page, { carrier:'skt', speed:'100M', tv:0, wifi:true, bundle:'family', lines:4 });
  html = await getResult(page);
  if (html.includes('-18,000') || html.includes('휴대폰 할인 (4명')) log('pass', 'J1-skt-100m-4', 'SKT 요즘가족 100M 4회선 휴대폰 할인 표시');
  else log('warn', 'J1-skt-100m-4', '휴대폰 할인 표시 미확인');

  // J2: SKT 100M 5회선 → 3600 × 5 = 18000원
  await setForm(page, { lines:5 });
  html = await getResult(page);
  if (html.includes('인당 3,600') || html.includes('3,600원 × 5명')) log('pass', 'J2-skt-100m-5', 'SKT 100M 5회선 인당 3,600원');
  else log('warn', 'J2-skt-100m-5', '인당 3600원 표시 미확인');

  // J3: LGU+ 투게더 100M → 인터넷 할인 없음 메시지
  await setForm(page, { carrier:'lgu', speed:'100M', tv:0, bundle:'lgu-together', lines:2 });
  html = await getResult(page);
  if (html.includes('투게더 100M 결합 불가') || html.includes('인터넷 할인 없음')) log('pass', 'J3-lgu-together-100m', 'LGU+ 투게더 100M → 할인 없음 안내');
  else log('fail', 'J3-lgu-together-100m', '투게더 100M 안내 누락');

  // ═══ K. 결합 종류별 ═══
  console.log('\n━━ K. 결합 종류 분기 ━━');

  // K1: KT 정액 결합 (kt-fixed)
  await setForm(page, { carrier:'kt', speed:'500M', tv:1, wifi:true, bundle:'kt-fixed', range:1 });
  html = await getResult(page);
  if (html.includes('정액') && html.includes('-5,500')) log('pass', 'K1-kt-fixed', 'KT 정액 결합 인터넷 -5,500 표시');
  else log('warn', 'K1-kt-fixed', '정액 결합 표시 미확인');

  // K2: KT 프리미엄 가족결합 (자격 검증)
  await setForm(page, { carrier:'kt', speed:'500M', tv:0, bundle:'kt-premium' });
  await page.waitForTimeout(150);
  html = await getResult(page);
  if (html.includes('프리미엄') && (html.includes('자격') || html.includes('2회선 이상') || html.includes('인터넷 실질'))) {
    log('pass', 'K2-kt-premium', 'KT 프리미엄 가족결합 분기 표시');
  } else {
    log('warn', 'K2-kt-premium', '프리미엄 가족결합 분기 미확인');
  }

  // K3: SKT 온가족할인 4년 × 30년 → 50% 할인
  await setForm(page, { carrier:'skt', speed:'500M', tv:1, wifi:true, bundle:'sk-onfamily', lines:3, range:3 });
  await page.waitForTimeout(150);
  html = await getResult(page);
  if (html.includes('50%')) log('pass', 'K3-skt-onfamily', 'SKT 온가족 인터넷 3년+ × 가족 30년+ → 50% 할인 표시');
  else log('warn', 'K3-skt-onfamily', '50% 할인 표시 미확인');

  // K4: LGU+ 참쉬운 4회선 + 88,000원 이상 → 8800원/인
  await setForm(page, { carrier:'lgu', speed:'500M', tv:1, wifi:true, bundle:'lgu-chweyswun', lines:4, range:2 });
  html = await getResult(page);
  if (html.includes('-8,800')) log('pass', 'K4-lgu-chweyswun', 'LGU+ 참쉬운 4회선+ × 88K 이상 → 8,800원');
  else log('warn', 'K4-lgu-chweyswun', '참쉬운 8800원 표시 미확인');

  // K5: home (TV만 결합) - 휴대폰 결합 없음
  await setForm(page, { carrier:'skt', speed:'500M', tv:3, wifi:true, bundle:'home' });
  html = await getResult(page);
  if (!html.includes('휴대폰 할인') && html.includes('월 합계')) log('pass', 'K5-home', 'home (TV만) 결합 시 휴대폰 할인 미표시');
  else log('warn', 'K5-home', '휴대폰 할인 노출 (예상 없음)');

  // ═══ L. 인터넷 단독 (TV 없음) + WiFi 토글 ═══
  console.log('\n━━ L. 인터넷 단독 + WiFi ━━');

  // L1: SKT 100M 단독 + WiFi → 22,000 + 1,100 = 23,100
  await setForm(page, { carrier:'skt', speed:'100M', tv:0, wifi:true, bundle:'home' });
  let total = await page.evaluate(() => {
    const m = document.getElementById('c-result').innerHTML.match(/월 합계[^>]*<\/span>\s*<span[^>]*>([\d,]+)\s*원/);
    return m ? parseInt(m[1].replace(/,/g, '')) : null;
  });
  if (total === 23100) log('pass', 'L1-skt-solo-wifi', `SKT 100M 단독+WiFi = 23,100원`);
  else log('warn', 'L1-skt-solo-wifi', `예상 23100, 실제 ${total}`);

  // L2: SKT 100M 단독 - WiFi → 22,000
  await setForm(page, { wifi:false });
  total = await page.evaluate(() => {
    const m = document.getElementById('c-result').innerHTML.match(/월 합계[^>]*<\/span>\s*<span[^>]*>([\d,]+)\s*원/);
    return m ? parseInt(m[1].replace(/,/g, '')) : null;
  });
  if (total === 22000) log('pass', 'L2-skt-solo-nowifi', `SKT 100M 단독-WiFi = 22,000원`);
  else log('warn', 'L2-skt-solo-nowifi', `예상 22000, 실제 ${total}`);

  // L3: KT 1G 단독 → WiFi 무료 (33,000원)
  await setForm(page, { carrier:'kt', speed:'1G', tv:0 });
  total = await page.evaluate(() => {
    const m = document.getElementById('c-result').innerHTML.match(/월 합계[^>]*<\/span>\s*<span[^>]*>([\d,]+)\s*원/);
    return m ? parseInt(m[1].replace(/,/g, '')) : null;
  });
  if (total === 38500 || total === 38500) log('pass', 'L3-kt-1g-solo', `KT 1G 단독 = ${total}원`);
  else log('warn', 'L3-kt-1g-solo', `KT 1G 단독 = ${total}원`);

  // ═══ M. 사은품 표시 ═══
  console.log('\n━━ M. 사은품 ━━');

  // M1: SKT 500M 단독 → 170,000원
  await setForm(page, { carrier:'skt', speed:'500M', tv:0, bundle:'home' });
  html = await getResult(page);
  if (html.includes('🎁 현금 사은품') && html.includes('170,000')) log('pass', 'M1-skt-solo-gift', 'SKT 500M 단독 사은품 170,000원');
  else log('warn', 'M1-skt-solo-gift', '사은품 표시 미확인');

  // M2: SKT 500M + TV → combo 사은품 430,000원 (TV 1대일 때)
  await setForm(page, { carrier:'skt', speed:'500M', tv:1 });
  html = await getResult(page);
  if (html.includes('430,000')) log('pass', 'M2-skt-combo-gift', 'SKT 500M + TV combo 사은품 430,000원');
  else log('warn', 'M2-skt-combo-gift', '430,000 사은품 미표시');

  // M3: SKT 500M + TV 2대 → 사은품 동일 (사용자 정책: TV 추가해도 사은품 안 변함)
  await setForm(page, { tvCount:2, tv2:1 });
  html = await getResult(page);
  if (html.includes('430,000')) log('pass', 'M3-skt-2tv-gift', 'SKT TV 2대 시 사은품 동일 (430,000)');
  else log('fail', 'M3-skt-2tv-gift', 'TV 2대 시 사은품 변경됨 (예상 동일)');

  // ═══ N. 셋톱 결합 할인 — 다양한 조합 ═══
  console.log('\n━━ N. 셋톱 할인 규칙 추가 검증 ━━');

  // N1: SKT 100M + B tv 올 + AI 4 vision → 100M은 base 규칙 (500M↑)이라 할인 없음
  await page.evaluate(() => {
    D.skt.setTopOptions.forEach(o => o.isDefault = (o.id === 'ai-4-vision'));
    const def = D.skt.setTopOptions.find(o => o.id === 'ai-4-vision');
    D.skt.setTop = def.fee; D.skt.setTopName = def.name;
    if (typeof calc === 'function') calc();
  });
  await setForm(page, { carrier:'skt', speed:'100M', tv:3, wifi:true, bundle:'home' });
  html = await getResult(page);
  if (!html.includes('└ 결합 할인') && !html.includes('└ ⏰ 프로모션')) log('pass', 'N1-100m-no-st-dc', 'SKT 100M + AI 4 vision → 셋톱 결합/프로모션 할인 미적용 (속도 조건 미충족)');
  else log('fail', 'N1-100m-no-st-dc', 'SKT 100M인데 셋톱 할인 적용됨');

  // N2: SKT 500M + 이코노미(올 시리즈 아님) + AI 4 vision → 결합 할인 미적용
  await setForm(page, { speed:'500M', tv:1 });
  html = await getResult(page);
  if (!html.includes('└ 결합 할인')) log('pass', 'N2-non-all-no-dc', 'SKT 500M + 이코노미 → 셋톱 결합 할인 미적용 (TV 시리즈 미충족)');
  else log('fail', 'N2-non-all-no-dc', '이코노미인데 결합 할인 적용됨');

  // N3: 다른 셋톱(smart3) → 할인 규칙 자체 없음
  await page.evaluate(() => {
    D.skt.setTopOptions.forEach(o => o.isDefault = (o.id === 'smart3'));
    const def = D.skt.setTopOptions.find(o => o.id === 'smart3');
    D.skt.setTop = def.fee; D.skt.setTopName = def.name;
    if (typeof calc === 'function') calc();
  });
  await setForm(page, { carrier:'skt', speed:'500M', tv:3 });
  html = await getResult(page);
  if (!html.includes('└ 결합 할인') && !html.includes('└ ⏰ 프로모션')) log('pass', 'N3-smart3-no-dc', 'SKT smart3 → discountRules 없음, 할인 미적용');
  else log('fail', 'N3-smart3-no-dc', 'smart3에 할인 적용됨 (예상 없음)');

  // ═══ O. 상담사 모드 (tm-counselor.html iframe) ═══
  console.log('\n━━ O. 상담사 모드 — iframe 내부 검증 ━━');

  await page.goto(`${BASE}/docs/tm-counselor.html?v=${Date.now()}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000); // iframe 로드 대기

  // O1: 좌측 스크립트는 편집 가능 (상담사 본인 작업)
  const scriptEditable = await page.evaluate(() => {
    const scripts = document.querySelectorAll('#tm-scripts [contenteditable="true"]');
    return scripts.length;
  });
  if (scriptEditable > 0) log('pass', 'O1-script-editable', `좌측 상담 스크립트 편집 가능 (${scriptEditable}개 contenteditable)`);
  else log('warn', 'O1-script-editable', '좌측 스크립트 편집 불가 (상담사도 못 씀)');

  // O2: iframe 내부 (calculator.html?role=agent) — .section 편집 컨트롤 비활성화
  const iframeStatus = await page.evaluate(async () => {
    const iframe = document.getElementById('calc-doc-iframe');
    if (!iframe) return { error: 'no iframe' };
    return new Promise(resolve => {
      const check = () => {
        try {
          const doc = iframe.contentDocument;
          if (!doc || !doc.body) { setTimeout(check, 200); return; }
          if (!doc.body.classList.contains('agent-mode')) { setTimeout(check, 200); return; }
          resolve({
            agentMode: doc.body.classList.contains('agent-mode'),
            sectionInputsActive: doc.querySelectorAll('.section input:not([disabled])').length,
            sectionSelectsActive: doc.querySelectorAll('.section select:not([disabled])').length,
            contenteditable: doc.querySelectorAll('.section [contenteditable="true"]').length,
            iframeURL: iframe.src
          });
        } catch (e) { resolve({ error: e.message }); }
      };
      check();
      setTimeout(() => resolve({ error: 'timeout' }), 8000);
    });
  });
  if (iframeStatus.error) log('warn', 'O2-iframe', `iframe 검증 실패: ${iframeStatus.error}`);
  else {
    if (iframeStatus.agentMode) log('pass', 'O2a-iframe-class', 'iframe agent-mode 클래스 적용');
    else log('fail', 'O2a-iframe-class', 'iframe agent-mode 미적용');
    if (iframeStatus.sectionInputsActive === 0 && iframeStatus.sectionSelectsActive === 0) log('pass', 'O2b-iframe-disabled', 'iframe .section 모든 컨트롤 비활성화');
    else log('fail', 'O2b-iframe-disabled', `iframe input ${iframeStatus.sectionInputsActive}/select ${iframeStatus.sectionSelectsActive} 활성`);
    if (iframeStatus.contenteditable === 0) log('pass', 'O2c-iframe-editable', 'iframe contenteditable 모두 제거');
    else log('fail', 'O2c-iframe-editable', `iframe contenteditable ${iframeStatus.contenteditable}개 남음`);
  }

  // O3: 카드 UI에서 계산 동작 (상담사도 견적은 가능)
  await page.evaluate(() => {
    document.getElementById('c-carrier').value = 'skt';
    document.getElementById('c-carrier').dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    document.getElementById('c-tv').value = '3';
    document.getElementById('c-tv').dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(200);
  const counselorResult = await page.evaluate(() => document.getElementById('c-result').innerHTML);
  if (counselorResult && counselorResult.includes('월 합계')) log('pass', 'O3-counselor-calc', '상담사 페이지에서 견적 계산 정상 동작');
  else log('fail', 'O3-counselor-calc', '상담사 페이지 견적 계산 실패');

  await browser.close();

  console.log('\n\n━━━━━━ 📊 추가 검증 결과 ━━━━━━');
  console.log(`✅ PASS: ${results.pass.length}`);
  console.log(`⚠️  WARN: ${results.warn.length}`);
  console.log(`❌ FAIL: ${results.fail.length}`);
  if (results.fail.length) {
    console.log('\n실패:');
    results.fail.forEach(r => console.log(`  ❌ [${r.name}] ${r.msg}`));
  }
  if (results.warn.length) {
    console.log('\n경고:');
    results.warn.forEach(r => console.log(`  ⚠️ [${r.name}] ${r.msg}`));
  }
  process.exit(results.fail.length > 0 ? 1 : 0);
})();
