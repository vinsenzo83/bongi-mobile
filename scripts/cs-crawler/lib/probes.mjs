// cs-crawler 감지 probe 정의 — 6영역 × 3사 매트릭스
// 각 probe.collect(browser) → { items:[{name,fee}], ok, note }
// MVP: 목록(list) 레벨만 수집해 fingerprint 비교. 상세수집(detail)은 이후 단계 TODO.
//
// 6영역: plans(요금제) · bundles(결합) · vas(부가) · wired(인터넷/TV) · faqs(FAQ) · links(고객센터)
// staging: 변경 시 적재할 cs.*_staging (없으면 로그만)
// freq: daily(요금제/결합) · weekly(부가/FAQ) — 기본 cron 은 daily 전체, --weekly 로 주1 포함
import { newPage, gotoRetry, removePopups } from './browser.mjs';
import { won, clean } from './util.mjs';
import { UA } from './browser.mjs';

// ── 공통 수집 헬퍼 ────────────────────────────────────────────────
// 카테고리 페이지에서 코드-앵커(상품코드 = 안정 키) + 이름 텍스트 목록 수집
async function anchorList(browser, url, sel, codeRe, { popup = false, more = false } = {}) {
  const page = await newPage(browser);
  try {
    const r = await gotoRetry(page, url, { waitMs: 4000, retries: 3 });
    if (!r.ok) return { items: [], ok: false, note: `로드 실패(status ${r.status})` };
    if (popup) await removePopups(page);
    if (more) { // 더보기 반복 클릭 (숨은 상품 노출)
      for (let i = 0; i < 4; i++) {
        try { const m = await page.$('a:has-text("더보기"), button:has-text("더보기"), .btn_more, .btn-more'); if (m) { await m.click(); await page.waitForTimeout(1000); } else break; } catch { break; }
      }
    }
    const items = await page.evaluate(({ sel, codeRe }) => {
      const c = s => (s || '').replace(/\s+/g, ' ').trim();
      const re = new RegExp(codeRe);
      const map = new Map();
      document.querySelectorAll(sel).forEach(a => {
        const raw = a.getAttribute('href') || '';
        const m = raw.match(re);
        if (!m) return;
        const code = m[1];
        const href = a.href || raw; // 절대 URL (상세수집 navigate 용)
        const txt = c(a.innerText) || c(a.getAttribute('title'));
        if (!map.has(code)) map.set(code, { name: txt || code, href });
      });
      return [...map.entries()].map(([code, v]) => ({ code, name: v.name, href: v.href }));
    }, { sel, codeRe: codeRe.source });
    // 이름 속 요금 추출
    return { items: items.map(x => ({ name: x.name || x.code, fee: won(x.name), code: x.code, href: x.href })), ok: true, note: '' };
  } catch (e) {
    return { items: [], ok: false, note: e.message };
  } finally { await page.close(); }
}

// ── PROBE 정의 ────────────────────────────────────────────────────
export const PROBES = [
  // ===== KT (product.kt.com 카테고리 — ItemCode 앵커가 안정 키) =====
  { carrier: 'KT', area: 'plans', freq: 'daily', staging: 'plans', enabled: true,
    collect: b => anchorList(b, 'https://product.kt.com/wDic/index.do?CateCode=6002&FilterCode=81',
      '.btns a[href*="ItemCode"]', /ItemCode=(\d+)/, { more: true }) },
  { carrier: 'KT', area: 'vas', freq: 'weekly', staging: null, enabled: true,
    collect: b => anchorList(b, 'https://product.kt.com/wDic/index.do?CateCode=6003',
      '.btns a[href*="ItemCode"]', /ItemCode=(\d+)/, { more: true }) },
  { carrier: 'KT', area: 'bundles', freq: 'daily', staging: 'bundles', enabled: true,
    collect: b => anchorList(b, 'https://product.kt.com/wDic/index.do?CateCode=6027',
      '.btns a[href*="ItemCode"]', /ItemCode=(\d+)/, { more: true }) },

  // ===== SKT =====
  // 요금제: renewal/mobileplan/list 5개 탭 카드(li.comp-list) — page.on 불필요, DOM 안정
  { carrier: 'SKT', area: 'plans', freq: 'daily', staging: 'plans', enabled: true,
    collect: sktPlans },
  // 결합: m.shop 유선 combinedList
  { carrier: 'SKT', area: 'bundles', freq: 'daily', staging: 'bundles', enabled: true,
    collect: b => sktList(b, 'https://m.shop.tworld.co.kr/wire/product/combinedList', 'combined') },
  // 부가: mobileplan-add BFF (page.on 가로채기)
  { carrier: 'SKT', area: 'vas', freq: 'weekly', staging: null, enabled: true,
    collect: sktVas },

  // ===== LG U+ =====
  // 요금제: plan-all SPA 앵커
  { carrier: 'LG U+', area: 'plans', freq: 'daily', staging: 'plans', enabled: true,
    collect: b => anchorList(b, 'https://www.lguplus.com/mobile/plan/mplan/plan-all',
      'a[href*="5g-unlimited/"], a[href*="5g-category/"], a[href*="/lte-all/"]', /\/([A-Za-z0-9]+)(?:\?|$)/, { popup: true }) },
  // 결합: combined-discount 앵커 (코드 안정 키)
  { carrier: 'LG U+', area: 'bundles', freq: 'daily', staging: 'bundles', enabled: true,
    collect: b => anchorList(b, 'https://www.lguplus.com/benefit-uplus/combined-discount',
      'a[href*="combined-discount/"]', /combined-discount\/([A-Za-z0-9]+)/, { popup: true }) },
  // 부가: spps-exhi BFF 직접 fetch (401 없이 열림 — 가장 견고)
  { carrier: 'LG U+', area: 'vas', freq: 'weekly', staging: null, enabled: true,
    collect: lguVas },

  // ===== 미구현(스텁) — 상세수집 연결 TODO. 기본 실행 제외(enabled:false) =====
  { carrier: 'KT',    area: 'faqs',  freq: 'weekly', staging: 'faqs', enabled: false, collect: stub('KT FAQ idx 순회 감지') },
  { carrier: 'SKT',   area: 'faqs',  freq: 'weekly', staging: 'faqs', enabled: false, collect: stub('SKT faq_Id 감지') },
  { carrier: 'LG U+', area: 'faqs',  freq: 'weekly', staging: 'faqs', enabled: false, collect: stub('LGU 아코디언 감지') },
  { carrier: 'SKT',   area: 'wired', freq: 'weekly', staging: null,   enabled: false, collect: stub('SKB bworld 인터넷/TV 감지') },
  { carrier: 'KT',    area: 'wired', freq: 'weekly', staging: null,   enabled: false, collect: stub('KT 인터넷/TV 감지') },
  { carrier: 'LG U+', area: 'wired', freq: 'weekly', staging: null,   enabled: false, collect: stub('LGU 인터넷/TV 감지') },
];

function stub(desc) {
  return async () => ({ items: [], ok: false, note: `미구현 스텁: ${desc} (상세수집 연결 TODO)` });
}

// ── SKT 요금제: 5개 탭 카드 수집 ──────────────────────────────────
const SKT_TABS = [['베스트','F02087'],['라이트','F02088'],['스마트기기','F02089'],['전용','F02100'],['다이렉트','F02101']];
async function sktPlans(browser) {
  const page = await newPage(browser);
  try {
    const all = new Map();
    let anyOk = false;
    for (const [, f] of SKT_TABS) {
      const r = await gotoRetry(page, `https://m.tworld.co.kr/product/renewal/mobileplan/list?filters=${f}&istabmove=Y&view=all`, { waitMs: 7000, retries: 2 });
      if (!r.ok) continue;
      anyOk = true;
      await page.waitForTimeout(1500);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);
      const cards = await page.evaluate(() => [...document.querySelectorAll('li.comp-list')].map(li => (li.innerText || '').replace(/\s+/g, ' ').trim()).filter(t => t.length > 6));
      for (const c of cards) {
        const masked = c.replace(/\([^)]*\)/g, m => ' '.repeat(m.length));
        const m = masked.match(/선택약정 반영 시|무제한|\d[\d.]*\s*GB|\d[\d.]*\s*MB|월\s*\d/);
        let name = (m ? c.slice(0, m.index) : c).replace(/\s+/g, ' ').trim();
        if (!name || name.length > 45) continue;
        const fees = [...c.matchAll(/([\d,]{4,})\s*원/g)].map(x => +x[1].replace(/,/g, '')).filter(n => n >= 5000 && n <= 200000);
        if (!all.has(name)) all.set(name, { name, fee: fees.length ? Math.max(...fees) : null });
      }
    }
    if (!anyOk) return { items: [], ok: false, note: 'SKT 전 탭 로드 실패(throttle)' };
    return { items: [...all.values()], ok: true, note: '' };
  } catch (e) { return { items: [], ok: false, note: e.message }; }
  finally { await page.close(); }
}

// ── SKT 일반 목록 페이지(결합 등) 텍스트 목록 ─────────────────────
async function sktList(browser, url, kind) {
  const page = await newPage(browser);
  try {
    const r = await gotoRetry(page, url, { waitMs: 6000, retries: 3 });
    if (!r.ok) return { items: [], ok: false, note: `로드 실패(status ${r.status})` };
    await page.waitForTimeout(1500);
    const items = await page.evaluate(() => {
      const c = s => (s || '').replace(/\s+/g, ' ').trim();
      const set = new Map();
      // 결합상품 카드/링크 후보
      document.querySelectorAll('a[href*="combined"], li[class*="list"] a, .prod-item, [class*="card"] a').forEach(a => {
        const t = c(a.innerText);
        if (t && t.length >= 3 && t.length <= 40 && /[가-힣]/.test(t)) set.set(t, t);
      });
      return [...set.keys()];
    });
    return { items: items.map(name => ({ name, fee: won(name) })), ok: true, note: items.length ? '' : '목록 0건' };
  } catch (e) { return { items: [], ok: false, note: e.message }; }
  finally { await page.close(); }
}

// ── SKT 부가서비스: mobileplan-add BFF 가로채기 ───────────────────
async function sktVas(browser) {
  const page = await newPage(browser);
  const captured = [];
  page.on('response', async r => {
    const rt = r.request().resourceType();
    if (['image', 'stylesheet', 'font', 'media', 'script'].includes(rt)) return;
    try { const b = await r.text(); const t = b.trimStart();
      if (b.length > 200 && (t[0] === '{' || t[0] === '[') && /advp|Advp|prodNm|prod_nm|Amt|Chrg/.test(b)) captured.push(b);
    } catch {}
  });
  try {
    // 대표 카테고리 F01231 (안심/보안 등) — 전체 부가 감지는 다중 필터 순회 TODO
    const r = await gotoRetry(page, 'https://m.tworld.co.kr/product/mobileplan-add/list?filters=F01231', { waitMs: 8000, retries: 3 });
    if (!r.ok) return { items: [], ok: false, note: 'BFF 페이지 로드 실패' };
    await page.waitForTimeout(2500);
    for (let i = 0; i < 5; i++) { await page.evaluate(() => window.scrollBy(0, 3000)); await page.waitForTimeout(500); }
    // DOM 카드에서 이름 추출 (BFF 스키마 다양 → DOM 이름이 안정적)
    const items = await page.evaluate(() => {
      const c = s => (s || '').replace(/\s+/g, ' ').trim();
      const set = new Map();
      document.querySelectorAll('li.comp-list, [class*="prod"], [class*="item"]').forEach(li => {
        const t = c(li.innerText);
        const nm = t.split(/월\s*\d|무료|[\d,]{3,}\s*원/)[0].trim();
        if (nm && nm.length >= 3 && nm.length <= 40 && /[가-힣A-Za-z]/.test(nm)) set.set(nm, { name: nm, fee: (t.match(/([\d,]{3,})\s*원/) || [])[1] ? +RegExp.$1.replace(/,/g, '') : null });
      });
      return [...set.values()];
    });
    return { items, ok: true, note: `BFF캡처 ${captured.length}건 / DOM ${items.length}건` };
  } catch (e) { return { items: [], ok: false, note: e.message }; }
  finally { await page.close(); }
}

// ── LG U+ 부가서비스: spps-exhi BFF 직접 fetch ────────────────────
async function lguVas() {
  try {
    const ac = new AbortController(); const to = setTimeout(() => ac.abort(), 15000);
    const r = await fetch('https://www.lguplus.com/uhdc/fo/prdv/mblspps/v1/spps-exhi-fo-list?pcMblCd=P',
      { headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Referer': 'https://www.lguplus.com/mobile/plan/addon/addon-all' }, signal: ac.signal });
    clearTimeout(to);
    if (!r.ok) return { items: [], ok: false, note: `BFF status ${r.status}` };
    const j = await r.json();
    const list = j.sppsFoDtoList || [];
    const items = list.map(x => ({ name: clean(x.urcAdvpNm), fee: won(x.advpTadvChrgCntn), code: x.urcAdvpCd }))
      .filter(x => x.name);
    return { items, ok: true, note: '' };
  } catch (e) { return { items: [], ok: false, note: e.message }; }
}
