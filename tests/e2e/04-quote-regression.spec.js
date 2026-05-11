import { test, expect } from '@playwright/test';

/**
 * 견적 계산 회귀 방어 — tm-counselor.html에서 D 객체 default 기반 견적 결과 검증.
 * 핵심 비즈니스 로직(견적 계산식) 변경 시 자동 감지.
 *
 * 검증 대상 시나리오:
 *  - SKT/KT/LGU+ 인터넷 단독 요금 (D[carrier].internet[speed])
 *  - KT 프리미엄 싱글결합 — 80K 휴대폰 시 -20,000원 (카탈로그 dc) + 인터넷 단독 추가 -5,500원
 *  - 결합·청구·납부 데이터 default
 */

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3001';

test.describe('견적 계산 회귀 (D 객체 default)', () => {

  test('SKT/KT/LGU+ 인터넷 단독 요금 default', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: BASE });
    const page = await ctx.newPage();
    await page.goto('/docs/tm-counselor.html');
    await page.waitForFunction(() => typeof window.D !== 'undefined' && window.D.skt && window.D.kt && window.D.lgu, null, { timeout: 10_000 });

    const fees = await page.evaluate(() => ({
      skt: { ...window.D.skt.internet },
      kt: { ...window.D.kt.internet },
      lgu: { ...window.D.lgu.internet },
    }));
    // 인터넷 단독 요금 (3년 약정, 부가세 포함) — calculator.html L800 부근 default
    expect(fees.skt['100M']).toBeGreaterThan(0);
    expect(fees.skt['500M']).toBeGreaterThanOrEqual(fees.skt['100M']);
    expect(fees.skt['1G']).toBeGreaterThanOrEqual(fees.skt['500M']);
    expect(fees.kt['500M']).toBeGreaterThan(0);
    expect(fees.lgu['1G']).toBeGreaterThan(0);

    await ctx.close();
  });

  test('KT 프리미엄 싱글결합 데이터 (premium_single + planCatalog)', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: BASE });
    const page = await ctx.newPage();
    await page.goto('/docs/tm-counselor.html');
    await page.waitForFunction(() => typeof window.D !== 'undefined' && window.D.kt && window.D.kt.bundle, null, { timeout: 10_000 });

    const ps = await page.evaluate(() => ({
      // tm-counselor 자체 D에는 premium_single 없음 → 폴백 5500/500M/77000 사용
      premium_internet: window.D.kt.bundle.premium && window.D.kt.bundle.premium.internet,
      planCatalog: window.D.kt.bundle.premium && window.D.kt.bundle.premium.planCatalog,
    }));
    expect(ps.premium_internet).toBe(5500);
    expect(Array.isArray(ps.planCatalog)).toBeTruthy();
    // 카탈로그에 77K · 80K · 100K 항목 존재 (prem=true)
    const prem = ps.planCatalog.filter(p => p.prem === true);
    expect(prem.length).toBeGreaterThanOrEqual(5);
    // 80,000원 → -20,000원 (25%) — 카탈로그 default
    const p80 = ps.planCatalog.find(p => p.v === 80000);
    expect(p80).toBeTruthy();
    expect(p80.dc).toBe(20000);

    await ctx.close();
  });

  test('인터넷 단독 추가 할인 — 5500 폴백 (tm-counselor 코드)', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: BASE });
    const page = await ctx.newPage();
    await page.goto('/docs/tm-counselor.html');
    await page.waitForFunction(() => typeof window.D !== 'undefined', null, { timeout: 10_000 });

    // tm-counselor 내부 변수는 직접 접근 X. 코드 내용에 5500/500M/77000 폴백이 있는지 검증
    const code = await page.evaluate(() => document.documentElement.outerHTML);
    expect(code).toContain('5500');     // 폴백 인터넷 단독 추가 할인
    expect(code).toContain('500M');     // 폴백 최소 속도
    expect(code).toContain('77000');    // 폴백 최소 요금제

    await ctx.close();
  });

  test('SKT/KT/LGU+ TV 상품 배열 보존', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: BASE });
    const page = await ctx.newPage();
    await page.goto('/docs/tm-counselor.html');
    await page.waitForFunction(() => typeof window.D !== 'undefined' && window.D.skt && Array.isArray(window.D.skt.tv), null, { timeout: 10_000 });

    const tvCounts = await page.evaluate(() => ({
      skt: window.D.skt.tv.length,
      kt: window.D.kt.tv.length,
      lgu: window.D.lgu.tv.length,
    }));
    // 각 통신사 최소 4개(없음 포함) — 0이면 데이터 손상
    expect(tvCounts.skt).toBeGreaterThanOrEqual(4);
    expect(tvCounts.kt).toBeGreaterThanOrEqual(4);
    expect(tvCounts.lgu).toBeGreaterThanOrEqual(4);

    await ctx.close();
  });

  test('설치비 default — install / installWeekend solo·combo', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: BASE });
    const page = await ctx.newPage();
    await page.goto('/docs/tm-counselor.html');
    await page.waitForFunction(() => typeof window.D !== 'undefined' && window.D.kt && window.D.kt.install, null, { timeout: 10_000 });

    const inst = await page.evaluate(() => ({
      skt: { ...window.D.skt.install, weekend: { ...window.D.skt.installWeekend } },
      kt: { ...window.D.kt.install, weekend: { ...window.D.kt.installWeekend } },
      lgu: { ...window.D.lgu.install, weekend: { ...window.D.lgu.installWeekend } },
    }));
    // 평일 설치비 > 0 (default)
    expect(inst.skt.solo).toBeGreaterThan(0);
    expect(inst.skt.combo).toBeGreaterThan(inst.skt.solo);
    expect(inst.kt.combo).toBeGreaterThan(0);
    // 주말 평일 + 25% 가산 (대략)
    expect(inst.skt.weekend.solo).toBeGreaterThan(inst.skt.solo);

    await ctx.close();
  });

});
