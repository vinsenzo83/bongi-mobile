// cs-crawler 공통 브라우저 유틸 — 이번 세션 검증 거미가 학습한 함정 전부 반영
import { chromium } from 'playwright';

export const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export async function launch() {
  return chromium.launch({ headless: true });
}
export async function newPage(browser) {
  return browser.newPage({ userAgent: UA, viewport: { width: 1280, height: 900 } });
}

// throttle 대응: bodyLen 0(SKT 봇차단)면 재시도. 콘텐츠 확보까지 N회.
export async function gotoRetry(page, url, { waitMs = 3500, retries = 3, waitUntil = 'domcontentloaded', minLen = 50 } = {}) {
  for (let i = 0; i < retries; i++) {
    try {
      const resp = await page.goto(url, { waitUntil, timeout: 45000 });
      await page.waitForTimeout(waitMs + i * 1500); // 재시도마다 대기 증가
      const len = await page.evaluate(() => (document.body?.innerText || '').length);
      if (len >= minLen && (!resp || resp.status() < 400)) return { ok: true, status: resp?.status(), len };
    } catch (e) { /* 재시도 */ }
    await page.waitForTimeout(2000);
  }
  return { ok: false, status: null, len: 0 };
}

// LGU 결합/요금제 SPA 팝업 제거 — 안 하면 "오늘하루그만보기"만 추출됨
export async function removePopups(page) {
  await page.evaluate(() => {
    document.querySelectorAll('[class*=popup],[class*=layer],[class*=modal],[class*=dim],[class*=Popup],[class*=Layer],[class*=Modal]')
      .forEach(e => e.remove());
  });
}

// 메뉴/푸터 노이즈 컷 — afterMarkers 이후, beforeMarkers 이전만
export async function mainText(page, { after = [], before = [], limit = 1500, selector = null } = {}) {
  return page.evaluate(({ after, before, limit, selector }) => {
    const c = s => (s || '').replace(/\s+/g, ' ').trim();
    let t = c((selector && document.querySelector(selector)?.innerText) || document.body.innerText);
    for (const m of after) { const i = t.indexOf(m); if (i >= 0) { t = t.slice(i + m.length); break; } }
    for (const m of before) { const f = t.search(m); if (f > 0) { t = t.slice(0, f); break; } }
    return t.replace(/^[^가-힣A-Za-z0-9]*/, '').trim().slice(0, limit);
  }, { after, before, limit, selector });
}

// 한 페이지에서 셀렉터 기반 안전 추출
export async function $textAll(page, selector, attr = null) {
  return page.evaluate(({ selector, attr }) => {
    const c = s => (s || '').replace(/\s+/g, ' ').trim();
    return [...document.querySelectorAll(selector)].map(e => attr ? e.getAttribute(attr) : c(e.innerText)).filter(Boolean);
  }, { selector, attr });
}
