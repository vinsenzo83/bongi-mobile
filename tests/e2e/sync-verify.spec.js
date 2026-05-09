import { test, expect } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3001';

test.describe('어드민 → 견적 동기화 (PR-2 hook 누락 복구 검증)', () => {

  test('Bundle: KT premium_single.internet_solo 변경 → tm-counselor D 갱신', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: BASE });

    // 탭 1: 견적 계산기 (소비자 측)
    const counselor = await ctx.newPage();
    counselor.on('console', m => console.log('[counselor]', m.text()));
    await counselor.goto('/docs/tm-counselor.html');
    await counselor.waitForFunction(() => typeof window.D !== 'undefined' && window.D.kt && window.D.kt.bundle, null, { timeout: 10_000 });

    const before = await counselor.evaluate(() => ({
      internet_solo: (window.D.kt.bundle.premium_single && window.D.kt.bundle.premium_single.internet_solo) ?? null,
      premium_internet: window.D.kt.bundle.premium && window.D.kt.bundle.premium.internet,
    }));
    console.log('[BEFORE]', before);
    expect(before.premium_internet).toBe(5500); // 디폴트 확인

    // 탭 2: 어드민 (calculator.html?admin=1) — LS 변경 트리거
    const admin = await ctx.newPage();
    await admin.goto('/docs/calculator.html?admin=1');
    // bootstrapCalculator 끝나길 대기
    await admin.waitForFunction(() => typeof window.D !== 'undefined' && window.D.kt && window.D.kt.bundle && window.D.kt.bundle.premium_single, null, { timeout: 10_000 });

    // 어드민에서 LS 직접 변경 (실제 input change와 동일 효과 — persistOverride는 결국 LS setItem)
    await admin.evaluate(() => {
      const KEY = 'bongi-bundle-overrides';
      const cur = JSON.parse(localStorage.getItem(KEY) || '{}');
      if (!cur.kt) cur.kt = {};
      if (!cur.kt.bundle) cur.kt.bundle = JSON.parse(JSON.stringify(window.D.kt.bundle));
      cur.kt.bundle.premium_single = { internet_solo: 7777, min_speed: '500M', min_plan: 77000, max_lines: 1, mobile_dc_label: '25% 할인' };
      localStorage.setItem(KEY, JSON.stringify(cur));
    });

    // storage event 전파 대기 (다른 탭에서 발생)
    await counselor.waitForTimeout(1500);

    const after = await counselor.evaluate(() => ({
      internet_solo: (window.D.kt.bundle.premium_single && window.D.kt.bundle.premium_single.internet_solo) ?? null,
      min_speed: (window.D.kt.bundle.premium_single && window.D.kt.bundle.premium_single.min_speed) ?? null,
    }));
    console.log('[AFTER]', after);

    expect(after.internet_solo, 'storage event → applyAllSeedToD_TM 호출되어야 함').toBe(7777);
    expect(after.min_speed).toBe('500M');

    await ctx.close();
  });

  test('Install: KT 평일 인터넷+TV 변경 → tm-counselor D.kt.install.combo 갱신', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: BASE });

    const counselor = await ctx.newPage();
    counselor.on('console', m => console.log('[counselor]', m.text()));
    await counselor.goto('/docs/tm-counselor.html');
    await counselor.waitForFunction(() => typeof window.D !== 'undefined' && window.D.kt && window.D.kt.install, null, { timeout: 10_000 });

    const before = await counselor.evaluate(() => ({
      install: { ...window.D.kt.install },
      installWeekend: { ...window.D.kt.installWeekend },
    }));
    console.log('[BEFORE]', before);
    expect(before.install.combo).toBe(56200); // KT 디폴트
    expect(before.installWeekend.combo).toBe(71250);

    const admin = await ctx.newPage();
    await admin.goto('/docs/calculator.html?admin=1');
    await admin.waitForFunction(() => typeof window.INSTALL_FEES !== 'undefined' && window.INSTALL_FEES.kt, null, { timeout: 10_000 });

    await admin.evaluate(() => {
      const KEY = 'bongi-install-fees';
      const cur = JSON.parse(localStorage.getItem(KEY) || 'null') || JSON.parse(JSON.stringify(window.INSTALL_FEES));
      cur.kt.weekday[2] = 60000;  // 인터넷+TV 평일
      cur.kt.weekend[2] = 78000;  // 인터넷+TV 주말
      cur.kt.weekday[0] = 40000;  // 인터넷 단독 평일
      cur.kt.weekend[0] = 50000;  // 인터넷 단독 주말
      localStorage.setItem(KEY, JSON.stringify(cur));
    });

    await counselor.waitForTimeout(1500);

    const after = await counselor.evaluate(() => ({
      install: { ...window.D.kt.install },
      installWeekend: { ...window.D.kt.installWeekend },
    }));
    console.log('[AFTER]', after);

    expect(after.install.solo, 'weekday[0] → install.solo').toBe(40000);
    expect(after.install.combo, 'weekday[2] → install.combo').toBe(60000);
    expect(after.installWeekend.solo, 'weekend[0] → installWeekend.solo').toBe(50000);
    expect(after.installWeekend.combo, 'weekend[2] → installWeekend.combo').toBe(78000);

    await ctx.close();
  });

  test('회귀: LS 미설정 시 디폴트 폴백 (5500, 56200)', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: BASE });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      try { localStorage.removeItem('bongi-bundle-overrides'); } catch(_) {}
      try { localStorage.removeItem('bongi-install-fees'); } catch(_) {}
    });
    await page.goto('/docs/tm-counselor.html');
    await page.waitForFunction(() => typeof window.D !== 'undefined' && window.D.kt && window.D.kt.bundle, null, { timeout: 10_000 });
    await page.waitForTimeout(500);

    const state = await page.evaluate(() => ({
      premium_internet: window.D.kt.bundle.premium && window.D.kt.bundle.premium.internet,
      premium_single: window.D.kt.bundle.premium_single ?? null, // tm-counselor의 D default에는 없음 → 폴백 사용
      install_combo: window.D.kt.install.combo,
      install_solo: window.D.kt.install.solo,
    }));
    console.log('[NO-OVERRIDE]', state);

    expect(state.premium_internet).toBe(5500);
    expect(state.install_combo).toBe(56200);  // KT 디폴트
    expect(state.install_solo).toBe(36000);

    await ctx.close();
  });
});
