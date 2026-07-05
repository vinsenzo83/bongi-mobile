// cs-crawler 상세수집 — 변경 감지(changed) 시 해당 통신사×영역의 상세를 재크롤해
// staging 전량(요금·조건·혜택·detail jsonb)으로 채운다. published 반영은 절대 안 함(cron+sink 가 승인게이트 유지).
//
// 재사용: sites/*.mjs 의 상세 추출 로직 + skt-detail-crawl 의 ledger 파서 패턴.
// 입력 items: probe.collect 가 준 목록 항목 [{name, fee, code, href?}]. href 있으면 상세 navigate.
// 출력 rows: staging 컬럼형 객체(마커·batch_id·crawled_at 은 sink 가 부착).
import { newPage, gotoRetry, mainText, removePopups } from './browser.mjs';
import { clean, won, ott, ageTarget, network, stripCarrierPrefix } from './util.mjs';

const DETAIL_CAP = 60; // 상세 크롤 상한(런타임 보호). 초과분은 note 로 알림.

// ── KT 요금제 상세: productDetail 요금표(table.pduct-tbl-plan) → 다중 플랜 행 ──
async function ktPlanRows(page, item) {
  const url = item.href || `https://product.kt.com/wDic/productDetail.do?ItemCode=${item.code}`;
  const r = await gotoRetry(page, url, { waitMs: 1800, retries: 2 });
  if (!r.ok) return [];
  const data = await page.evaluate(() => {
    const c = s => (s || '').replace(/\s+/g, ' ').trim();
    const group = c(document.querySelector('h1')?.innerText);
    const tb = document.querySelector('table.pduct-tbl-plan');
    const rows = tb ? [...tb.querySelectorAll('tbody tr')].map(tr => [...tr.querySelectorAll('th,td')].map(td => c(td.innerText))) : [];
    return { group, rows };
  });
  const out = [];
  for (const cells of data.rows) {
    const name = cells[0];
    const fee = won(cells.find(c => /^[\d,]{4,}\s*원$/.test(c)) || cells[1] || '');
    if (!name || name.length > 30 || !fee) continue;
    const row = cells.join(' ');
    out.push({
      carrier: 'KT', plan_name: name, group_name: data.group, monthly_fee: fee, network: '5G',
      data_amount: cells[2] || null, call_amount: cells[4] || null, message: cells[5] || null,
      ott_benefits: ott(row), age_target: ageTarget(row),
      conditions: cells.join(' | ').slice(0, 400), source_url: url,
      detail: { group: data.group, cells, item_code: item.code },
    });
  }
  return out;
}

// ── LGU 요금제 상세: 상세페이지 본문 → 단일 플랜 행 ──
async function lguPlanRows(page, item) {
  const url = item.href;
  const r = await gotoRetry(page, url, { waitMs: 3500, retries: 2 });
  if (!r.ok) return [];
  await removePopups(page);
  const body = await mainText(page, { limit: 900 });
  const name = stripCarrierPrefix(clean((await page.title()).split('<')[0])) || item.name;
  const fee = won((body.match(/월정액\s*[\d,]{4,}\s*원|월\s*[\d,]{4,}\s*원/) || [])[0]) || item.fee || null;
  const disc = won((body.match(/약정\s*할인\s*시\s*[\d,]{4,}\s*원/) || [])[0]);
  return [{
    carrier: 'LG U+', plan_name: name, monthly_fee: fee, discount_fee: disc,
    network: network(item.name + body),
    data_amount: (item.name.match(/(무제한|[\d,]+\s*GB|[\d,]+\s*MB)/) || [])[1] || null,
    ott_benefits: ott(body), age_target: ageTarget(name + body),
    conditions: body.slice(0, 400), source_url: url,
    detail: { body_excerpt: body.slice(0, 600), plan_code: item.code },
  }];
}

// ── KT 결합 상세 ──
async function ktBundleRow(page, item) {
  const url = item.href || `https://product.kt.com/wDic/productDetail.do?ItemCode=${item.code}`;
  const r = await gotoRetry(page, url, { waitMs: 1800, retries: 2 });
  if (!r.ok) return [];
  const name = clean(await page.evaluate(() => document.querySelector('h1')?.innerText)) || item.name;
  const body = await mainText(page, { after: ['전체메뉴'], before: [/회사소개|이용약관/], limit: 1200 });
  return [{
    carrier: 'KT', bundle_name: name, discount_rule: body, source_url: url,
    conditions: body.slice(0, 400),
    components: [], discount_tiers: [],
    detail: { body_excerpt: body.slice(0, 800), item_code: item.code },
  }];
}

// ── LGU 결합 상세 ──
async function lguBundleRow(page, item) {
  const url = item.href || `https://www.lguplus.com/benefit-uplus/combined-discount/${item.code}`;
  const r = await gotoRetry(page, url, { waitMs: 4000, retries: 2 });
  if (!r.ok) return [];
  await removePopups(page);
  const body = await mainText(page, { after: ['결합 상품'], before: [/회사소개|이용약관|고객센터 :/], limit: 1200 });
  return [{
    carrier: 'LG U+', bundle_name: item.name || item.code, discount_rule: body, source_url: url,
    conditions: body.slice(0, 400), components: [], discount_tiers: [],
    detail: { body_excerpt: body.slice(0, 800), bundle_code: item.code },
  }];
}

// ── SKT: 목록 카드에 href/prod_id 없음 → 목록 레벨 행으로 우아하게 강등(상세는 prod_id 매핑 TODO) ──
function sktPlanRowFrom(item) {
  return {
    carrier: 'SKT', plan_name: item.name, monthly_fee: item.fee ?? null, network: null,
    conditions: null, source_url: 'https://m.tworld.co.kr/product/renewal/mobileplan/list',
    detail: { _note: 'SKT 상세는 prod_id 매핑 필요(ledger BFF) — 목록레벨 적재', list_name: item.name },
  };
}
function sktBundleRowFrom(item) {
  return {
    carrier: 'SKT', bundle_name: item.name, discount_rule: null,
    source_url: 'https://m.shop.tworld.co.kr/wire/product/combinedList',
    components: [], discount_tiers: [],
    detail: { _note: 'SKT 결합 상세 크롤 TODO — 목록레벨 적재', list_name: item.name },
  };
}

// dispatch: `${carrierCode}:${area}` → per-item 상세 함수 (href 필요) / degrade 함수
const RICH = {
  'kt:plans': ktPlanRows, 'lgu:plans': lguPlanRows,
  'kt:bundles': ktBundleRow, 'lgu:bundles': lguBundleRow,
};
const DEGRADE = {
  'skt:plans': sktPlanRowFrom, 'skt:bundles': sktBundleRowFrom,
};
const CODE = { 'KT': 'kt', 'SKT': 'skt', 'LG U+': 'lgu' };

// 메인: 변경된 probe 의 items → 상세 rows
export async function collectDetail(area, carrier, browser, items, { cap = DETAIL_CAP } = {}) {
  const key = `${CODE[carrier]}:${area}`;
  const rich = RICH[key];
  const degrade = DEGRADE[key];
  if (!rich && !degrade) return { rows: [], ok: false, note: `상세수집 미지원(${key}) — delta 마커만` };

  const list = (items || []).slice(0, cap);
  const overflow = (items || []).length - list.length;
  const rows = [];

  if (degrade) {
    for (const it of list) rows.push(degrade(it));
    return { rows, ok: true, note: `목록레벨 ${rows.length}건 적재(상세 TODO)${overflow > 0 ? ` · +${overflow} 초과생략` : ''}` };
  }

  // rich: 항목별 상세 navigate (전용 페이지 1개 재사용)
  const page = await newPage(browser);
  let failed = 0;
  try {
    for (const it of list) {
      try {
        const got = await rich(page, it);
        if (got && got.length) rows.push(...got); else failed++;
      } catch { failed++; }
    }
  } finally { await page.close(); }
  return {
    rows, ok: rows.length > 0,
    note: `상세 ${rows.length}행 수집 (항목 ${list.length}, 실패 ${failed})${overflow > 0 ? ` · +${overflow} 초과생략` : ''}`,
  };
}
