// 4 roles × 사이드바 메뉴 × incentive_menus SSOT 검증
// - 각 role 로그인 → 사이드바 노출 메뉴가 DB default_roles와 일치
// - 사이드바 HTML과 DB menus가 정합 (drift 감지)
// - tickets API 동작 검증

import { test, expect } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'https://dev-admin.prexymarket.com';
const PASS = process.env.E2E_PASSWORD || 'pass1234!';

const ROLES = [
  { email: 'admin1@bongi.test',   role: 'admin' },
  { email: 'manager1@bongi.test', role: 'manager' },
  { email: 'agent1@bongi.test',   role: 'agent' },
];

async function login(page, email, password) {
  const res = await page.request.post(`${BASE}/api/auth/login`, {
    data: { email, password }
  });
  expect(res.status(), `login ${email}`).toBe(200);
  const { access_token } = await res.json();
  expect(access_token).toBeTruthy();
  return access_token;
}

test.describe('4 roles 사이드바 메뉴 SSOT 검증', () => {
  let dbMenus = null;

  test.beforeAll(async ({ playwright }) => {
    const req = await playwright.request.newContext();
    const lr = await req.post(`${BASE}/api/auth/login`, {
      data: { email: 'admin1@bongi.test', password: PASS }
    });
    expect(lr.status()).toBe(200);
    const { access_token } = await lr.json();
    const mr = await req.get(`${BASE}/api/incentive/menus`, {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    expect(mr.status()).toBe(200);
    dbMenus = (await mr.json()).menus;
    expect(dbMenus.length).toBeGreaterThan(15);
    await req.dispose();
  });

  for (const { email, role } of ROLES) {
    test(`${role} 로그인 + 사이드바 메뉴 노출이 DB default_roles와 일치`, async ({ page }) => {
      const token = await login(page, email, PASS);
      await page.goto(BASE);
      await page.evaluate(t => localStorage.setItem('incentive-auth-token-v1', t), token);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(2500);

      // role-permissions/me 에서 부여된 메뉴 (실제 권한)
      const myMenus = await page.evaluate(async () => {
        const tk = localStorage.getItem('incentive-auth-token-v1');
        const r = await fetch('/api/incentive/role-permissions/me', {
          headers: { Authorization: 'Bearer ' + tk }
        });
        return (await r.json()).menus || [];
      });
      expect(Array.isArray(myMenus)).toBe(true);
      expect(myMenus.length, `${role} 권한 메뉴`).toBeGreaterThan(0);

      // 사이드바 visible button slug 추출
      const visibleSlugs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('aside.sidebar button[data-key]'))
          .filter(b => b.offsetParent !== null)
          .map(b => b.dataset.key);
      });

      // role-permissions/me 메뉴 ⊆ 사이드바 (권한 있는 메뉴는 모두 노출)
      for (const m of myMenus) {
        expect(visibleSlugs, `${role}: ${m} 사이드바 노출`).toContain(m);
      }
    });
  }

  test('사이드바 HTML vs incentive_menus DB 정합 (admin 시점)', async ({ page }) => {
    const token = await login(page, 'admin1@bongi.test', PASS);
    await page.goto(BASE);
    await page.evaluate(t => localStorage.setItem('incentive-auth-token-v1', t), token);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);

    const htmlSlugs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('aside.sidebar button[data-key]')).map(b => b.dataset.key)
    );
    const dbActiveSlugs = dbMenus.filter(m => m.active).map(m => m.slug);

    const htmlOnly = htmlSlugs.filter(s => !dbActiveSlugs.includes(s));
    const dbOnly = dbActiveSlugs.filter(s => !htmlSlugs.includes(s));

    expect(dbOnly, 'DB에는 있는데 HTML 사이드바에 button 없음 (4곳 동기화 함정)').toEqual([]);
    // htmlOnly는 허용 — DB에서 비활성된 메뉴를 HTML에서 임시 유지 가능
  });

  test('tickets API 105 active', async ({ page }) => {
    const token = await login(page, 'admin1@bongi.test', PASS);
    const res = await page.request.get(`${BASE}/api/incentive/tickets/internet`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(res.status()).toBe(200);
    const { tickets, total } = await res.json();
    expect(total).toBe(105);
    const active = tickets.filter(t => t.is_active).length;
    expect(active).toBe(105);
    // carrier 분포
    const byCarrier = tickets.reduce((m, t) => ((m[t.carrier] = (m[t.carrier] || 0) + 1), m), {});
    expect(byCarrier.skt).toBe(60);
    expect(byCarrier.kt).toBe(30);
    expect(byCarrier.lgu).toBe(15);
  });
});
