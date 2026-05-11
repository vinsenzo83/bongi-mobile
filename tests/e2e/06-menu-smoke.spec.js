import { test, expect } from '@playwright/test';
import { ACCOUNTS, loginAdminPortal, dismissBanner } from './_helpers.js';

/**
 * 19개 사이드바 메뉴 smoke test
 * 각 메뉴 클릭 → iframe 로드 → 핵심 요소 가시성 확인
 *
 * 2026-05-11 사건: incentive-permissions/agents/db-sources/products/rules 5개 화면이
 * 인증 헬퍼 누락으로 iframe 안에서 JSON parse 에러 → 빈 화면 → 운영 인지 못 함.
 * 이 smoke가 통합 후에 회귀로 잡았어야 함.
 */

const MENUS = [
  { key: 'dashboard',            label: '대시보드',         iframeSelector: 'iframe[src*="incentive-dashboard"]' },
  { key: 'contract',             label: '계약 처리',         iframeSelector: 'iframe[src*="incentive-contract"]' },
  { key: 'agents',               label: '상담사 관리',       iframeSelector: 'iframe[src*="incentive-agents"]' },
  { key: 'products',             label: '상품 관리',         iframeSelector: 'iframe[src*="incentive-products"]' },
  { key: 'rules',                label: '정책 관리',         iframeSelector: 'iframe[src*="incentive-rules"]' },
  { key: 'db-sources',           label: 'DB 출처',           iframeSelector: 'iframe[src*="incentive-db-sources"]' },
  { key: 'customer-db',          label: '콜 DB 관리',        iframeSelector: 'iframe[src*="incentive-customer-db"]' },
  { key: 'call-stats',           label: '콜 통계',           iframeSelector: 'iframe[src*="incentive-call-stats"]' },
  { key: 'settlements',          label: '월별 정산',         iframeSelector: 'iframe[src*="incentive-settlements"]' },
  { key: 'goals',                label: '월간 목표',         iframeSelector: 'iframe[src*="incentive-goals"]' },
  { key: 'agents-roi',           label: '상담사 ROI 비교',   iframeSelector: 'iframe[src*="incentive-agents-roi"]' },
  { key: 'call-list',            label: '내 콜 리스트',      iframeSelector: 'iframe[src*="incentive-call-list"]' },
  { key: 'distribution-requests', label: '분배 요청',         iframeSelector: 'iframe[src*="incentive-distribution-requests"]' },
  { key: 'tm-counselor',         label: 'TM 상담 v1',        iframeSelector: 'iframe[src*="tm-counselor"]' },
  { key: 'tm-counselor-v2',      label: 'TM 상담 v2',        iframeSelector: 'iframe[src*="tm-counselor"]' },
  { key: 'tm-data',              label: 'TM 데이터 관리',    iframeSelector: 'iframe[src*="calculator"]' },
  { key: 'guide',                label: '급여 안내',         iframeSelector: 'iframe[src*="incentive-guide"]' },
  { key: 'manual',               label: '사용 매뉴얼',       iframeSelector: 'iframe[src*="incentive-manual"]' },
  { key: 'permissions',          label: '권한 관리',         iframeSelector: 'iframe[src*="incentive-permissions"]' },
];

test.describe('19 메뉴 smoke', () => {
  test.beforeEach(async ({ page }) => {
    await loginAdminPortal(page, ACCOUNTS.admin);
    await dismissBanner(page);
  });

  for (const { key, label, iframeSelector } of MENUS) {
    test(`${key} — ${label}`, async ({ page }) => {
      const btn = page.locator(`.tab-btn[data-key="${key}"]`);
      await expect(btn, `사이드바에 ${key} 메뉴 노출`).toBeVisible({ timeout: 5_000 });
      await btn.click();

      // iframe 로드 (display:none 토글 패턴이므로 src 매칭 iframe이 display 있을 때까지)
      const iframe = page.locator(iframeSelector).first();
      await expect(iframe).toBeAttached({ timeout: 10_000 });

      // iframe 내부 body가 비어있지 않은지 (JSON parse 에러 시 빈 화면 회귀 방지)
      const frame = await iframe.contentFrame();
      expect(frame, `${key} iframe contentFrame 접근 가능`).not.toBeNull();
      const bodyText = await frame.locator('body').innerText({ timeout: 8_000 }).catch(() => '');
      expect(bodyText.length, `${key} body 비어있지 않음 (≥30자)`).toBeGreaterThan(30);

      // iframe 안에 alert/error overlay가 떠 있지 않은지 (console 에러 간접 검출)
      const errorEls = await frame.locator('.error-overlay, .crash-screen, [data-fatal-error]').count();
      expect(errorEls, `${key} 치명적 에러 오버레이 없음`).toBe(0);
    });
  }
});
