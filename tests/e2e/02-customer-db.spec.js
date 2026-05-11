import { test, expect } from '@playwright/test';
import { ACCOUNTS, loginAdminPortal, clickMenu, dismissBanner } from './_helpers.js';

test.describe('콜 DB CRM', () => {
  test('admin — 콜 DB 관리 진입 + 100건 표시', async ({ page }) => {
    await loginAdminPortal(page, ACCOUNTS.admin);
    await dismissBanner(page);
    const frame = await clickMenu(page, 'customer-db');
    // KPI fetch 대기 — '-'가 아닌 숫자가 들어올 때까지
    await expect(frame.locator('#kpi-total')).not.toHaveText('-', { timeout: 15000 });
    await expect(frame.locator('#kpi-total')).toContainText(/[1-9]\d/);
  });

  test('agent — 본인 콜 큐 (50건)', async ({ page }) => {
    await loginAdminPortal(page, ACCOUNTS.agent1);
    const frame = await clickMenu(page, 'call-list');
    await expect(frame.locator('#kpi-total')).not.toHaveText('-', { timeout: 15000 });
    await expect(frame.locator('#kpi-total')).toContainText(/[4-9]\d/);
    await expect(frame.locator('#cust-tbody tr').first()).toBeVisible();
  });

  test('agent — 분배 요청 모달', async ({ page }) => {
    await loginAdminPortal(page, ACCOUNTS.agent1);
    const frame = await clickMenu(page, 'call-list');
    await frame.locator('button:has-text("콜 분배 요청")').first().click();
    await expect(frame.locator('#req-modal')).toBeVisible();
    await frame.locator('#req-count').fill('20');
    await frame.locator('#req-reason').fill('E2E 테스트');
    await frame.locator('button:has-text("📨 요청 제출")').click();
    // 응답 (대기 또는 중복)
    await page.waitForTimeout(1500);
  });

  test('manager — 분배 요청 list 노출', async ({ page }) => {
    await loginAdminPortal(page, ACCOUNTS.manager);
    const frame = await clickMenu(page, 'call-list');
    await frame.locator('#btn-my-requests').click();
    await expect(frame.locator('#req-list-modal')).toBeVisible({ timeout: 5000 });
  });
});
