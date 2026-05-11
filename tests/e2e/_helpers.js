import { expect } from '@playwright/test';

export const ACCOUNTS = {
  admin:   { email: 'admin1@bongi.test',   password: 'pass1234!', name: '관리자',   role: 'admin' },
  manager: { email: 'manager1@bongi.test', password: 'pass1234!', name: '박매니저', role: 'manager' },
  agent1:  { email: 'agent1@bongi.test',   password: 'pass1234!', name: '김상담',   role: 'agent' },
  agent2:  { email: 'agent2@bongi.test',   password: 'pass1234!', name: '최상담',   role: 'agent' },
};

/** 통합 어드민 로그인 */
export async function loginAdminPortal(page, account) {
  await page.goto('/docs/incentive-admin.html');
  await page.locator('#g-auth-email').fill(account.email);
  await page.locator('#g-auth-pass').fill(account.password);
  await page.locator('#g-auth-login-btn').click();
  await expect(page.locator('#g-user-name')).toContainText(account.name, { timeout: 10_000 });
}

/** 사이드바 메뉴 클릭 + iframe 진입 */
export async function clickMenu(page, key) {
  await page.locator(`.tab-btn[data-key="${key}"]`).click();
  // iframe 로드 대기
  await page.waitForTimeout(800);
  return page.frameLocator(`iframe[src*="${key}"], iframe[data-key="${key}"]`).first();
}

/** 빈 모달 닫기 (2FA banner 등) */
export async function dismissBanner(page) {
  const nudge = page.locator('#g-2fa-nudge button:has-text("나중에")');
  if (await nudge.isVisible({ timeout: 1000 }).catch(() => false)) await nudge.click();
}
