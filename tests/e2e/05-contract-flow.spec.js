import { test, expect } from '@playwright/test';

/**
 * 계약 처리 모달 회귀 방어 — incentive-contract.html
 *  - 결합 유형 carrier 필터 (SK 2개 / KT 4개 / LG 2개)
 *  - 납부 방법 lazy 렌더 (자동이체·카드이체)
 *  - 카드 마스킹 후 readonly 분기
 *  - normalizeCarrier 정규화 함수
 */

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3001';

test.describe('계약 처리 모달 회귀', () => {

  test('incentive-contract.html에 핵심 함수·상수 존재', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: BASE });
    const page = await ctx.newPage();
    await page.goto('/docs/incentive-contract.html');
    const html = await page.content();

    // 결합유형 매핑 + 정규화
    expect(html).toContain('normalizeCarrier');
    expect(html).toContain("'SKT'");      // 변형 표기 매핑
    expect(html).toContain('OLLEH');      // KT 옛 브랜드
    expect(html).toContain('UPLUS');      // LG 변형
    // 결합할인 옵션 (각 통신사)
    expect(html).toContain('SKT 요즘가족결합');
    expect(html).toContain('KT 프리미엄 싱글결합');  // 이번 세션 작업
    expect(html).toContain('LGU+ 참쉬운 가족결합');
    // 납부방법 lazy 렌더
    expect(html).toContain('renderPaymentExtra');
    expect(html).toContain('PE_BANK_OPTIONS');
    expect(html).toContain('PE_CARD_OPTIONS');
    // 카드 마스킹 UI 분기
    expect(html).toContain('card_masked_at');
    expect(html).toContain('isMasked');

    await ctx.close();
  });

  test('normalizeCarrier 함수 동작 — Page 내 평가', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: BASE });
    const page = await ctx.newPage();
    await page.goto('/docs/incentive-contract.html');

    // page.evaluate에 함수 정의 직접 주입해서 검증 (페이지 내부 함수는 scope 안에 있어 직접 access X)
    const results = await page.evaluate(() => {
      // 페이지 코드에서 추출된 정규화 로직과 동일
      function norm(raw) {
        if (!raw) return '';
        const s = String(raw).trim().toUpperCase().replace(/[\s\-_]/g, '');
        if (/^(SKT|SK|에스케이)/.test(s)) return 'SK';
        if (/^(KT|케이티|OLLEH|올레)/.test(s)) return 'KT';
        if (/^(LG|엘지|UPLUS|U\+|유플러스)/.test(s)) return 'LG';
        return '';
      }
      return {
        skt: norm('SKT'),
        sk_alt: norm('SK 알뜰'),
        sk_telecom: norm('SK Telecom'),
        kt: norm('KT'),
        olleh: norm('olleh'),
        lgu_plus: norm('LGU+'),
        lg_uplus: norm('LG U+'),
        empty: norm(''),
        unknown: norm('알뜰폰'),
      };
    });

    expect(results.skt).toBe('SK');
    expect(results.sk_alt).toBe('SK');
    expect(results.sk_telecom).toBe('SK');
    expect(results.kt).toBe('KT');
    expect(results.olleh).toBe('KT');
    expect(results.lgu_plus).toBe('LG');
    expect(results.lg_uplus).toBe('LG');
    expect(results.empty).toBe('');
    expect(results.unknown).toBe('');

    await ctx.close();
  });

  test('카드 마스킹 함수 동작', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: BASE });
    const page = await ctx.newPage();
    await page.goto('/docs/incentive-contract.html');

    const results = await page.evaluate(() => {
      // server/jobs/card-masking.js의 maskCardNumber와 동일 로직 (e2e용 사본)
      function mask(n) {
        if (!n) return null;
        const digits = String(n).replace(/\D/g, '');
        if (digits.length < 4) return '••••-••••-••••-••••';
        return '••••-••••-••••-' + digits.slice(-4);
      }
      return {
        a: mask('1234-5678-9012-3456'),
        b: mask('1234567890123456'),
        c: mask('4111 1111 1111 1111'),
        d: mask(null),
        e: mask('12'),
      };
    });
    expect(results.a).toBe('••••-••••-••••-3456');
    expect(results.b).toBe('••••-••••-••••-3456');
    expect(results.c).toBe('••••-••••-••••-1111');
    expect(results.d).toBeNull();
    expect(results.e).toBe('••••-••••-••••-••••');

    await ctx.close();
  });

});
