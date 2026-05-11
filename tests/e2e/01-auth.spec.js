import { test, expect } from '@playwright/test';
import { ACCOUNTS, loginAdminPortal, dismissBanner } from './_helpers.js';

test.describe('인증 흐름', () => {
  test('admin 로그인 + role badge', async ({ page }) => {
    await loginAdminPortal(page, ACCOUNTS.admin);
    await dismissBanner(page);
    await expect(page.locator('#g-role-badge')).toHaveText(/ADMIN/i);
    await expect(page.locator('#g-user-center')).toContainText('본사');
  });

  test('manager 로그인 + 광주센터', async ({ page }) => {
    await loginAdminPortal(page, ACCOUNTS.manager);
    await expect(page.locator('#g-role-badge')).toHaveText(/MANAGER/i);
    await expect(page.locator('#g-user-center')).toContainText('광주센터');
  });

  test('agent 로그인 + 콜 리스트 메뉴 표시', async ({ page }) => {
    await loginAdminPortal(page, ACCOUNTS.agent1);
    await expect(page.locator('.tab-btn[data-key="call-list"]')).toBeVisible();
    await expect(page.locator('.tab-btn[data-key="settlements"]')).toBeVisible();
  });

  test('잘못된 비밀번호 → 에러', async ({ page }) => {
    await page.goto('/docs/incentive-admin.html');
    await page.locator('#g-auth-email').fill(ACCOUNTS.admin.email);
    await page.locator('#g-auth-pass').fill('wrong-password');
    await page.locator('#g-auth-login-btn').click();
    await expect(page.locator('#g-auth-msg')).toContainText(/올바르지 않|실패/);
  });

  test('agent → admin 전용 메뉴 숨김', async ({ page }) => {
    await loginAdminPortal(page, ACCOUNTS.agent1);
    await expect(page.locator('.tab-btn[data-key="permissions"]')).toBeHidden();
    await expect(page.locator('.tab-btn[data-key="agents"]')).toBeHidden();
  });
});
