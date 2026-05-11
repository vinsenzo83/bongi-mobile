import { test, expect } from '@playwright/test';
import { ACCOUNTS, loginAdminPortal, clickMenu, dismissBanner } from './_helpers.js';

test.describe('V5 정산', () => {
  test('agent — 본인 정산 KPI 7개 카드', async ({ page }) => {
    await loginAdminPortal(page, ACCOUNTS.agent1);
    const frame = await clickMenu(page, 'settlements');
    await expect(frame.locator('#kpi-primary')).toBeVisible({ timeout: 8000 });
    await expect(frame.locator('#kpi-grade')).toBeVisible();
    await expect(frame.locator('#kpi-points')).toBeVisible();
  });

  test('agent — 회사이익 컬럼 숨김', async ({ page }) => {
    await loginAdminPortal(page, ACCOUNTS.agent1);
    const frame = await clickMenu(page, 'settlements');
    await page.waitForTimeout(2000);
    await expect(frame.locator('th.admin-only').first()).toBeHidden();
  });

  test('admin — 회사이익 컬럼 표시', async ({ page }) => {
    await loginAdminPortal(page, ACCOUNTS.admin);
    await dismissBanner(page);
    const frame = await clickMenu(page, 'settlements');
    await page.waitForTimeout(2000);
    await expect(frame.locator('th.admin-only').first()).toBeVisible();
  });

  test('manager — 팀 오버라이드 카드', async ({ page }) => {
    await loginAdminPortal(page, ACCOUNTS.manager);
    const frame = await clickMenu(page, 'settlements');
    await page.waitForTimeout(2500);
    await expect(frame.locator('#mgr-override-section')).toBeVisible({ timeout: 8000 });
  });

  test('admin — 견적 빠른 입력 페이지', async ({ page }) => {
    await loginAdminPortal(page, ACCOUNTS.admin);
    await dismissBanner(page);
    const frame = await clickMenu(page, 'sales-quick');
    await expect(frame.locator('#f-product')).toBeVisible({ timeout: 8000 });
    // 상품 옵션 fetch 대기 (placeholder + 30개)
    await expect.poll(
      async () => await frame.locator('#f-product option').count(),
      { timeout: 15000 }
    ).toBeGreaterThan(20);
  });
});
