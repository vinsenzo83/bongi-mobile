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

// ── SKT 요금제 상세: data-prodid → ledger BFF(summaries/contents) 파싱 (skt-detail-crawl 재사용) ──
const strip = h => (h || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();

function sktParse(item, cap) {
  const s = cap.sum || {};
  const media = [];
  (s.prodBenfAreaList || []).forEach(a => (a.prodBenfList || []).forEach(bf => {
    const nm = bf.prodBenfGrpNm || '', phr = strip(bf.prodBenfFrndExpsPhrs || bf.prodBenfExpsPhrs || bf.prodBenfNm || '');
    if (nm && phr) media.push(`${nm}: ${phr}`.slice(0, 120));
  }));
  let join = '', age = '', subscribe = '', notes = '';
  (cap.cont?.contentsList || []).forEach(c => {
    const t = c.titleNm || '', d = strip(c.ledItmDesc).slice(0, 400);
    if (/가입\s*조건/.test(t)) join = d; else if (/연령/.test(t)) age = d;
    else if (/구독/.test(t)) subscribe = d; else if (/유의/.test(t)) notes = d.slice(0, 200);
  });
  const data = s.basOfrGbDataQtyCtt || s.basOfrMbDataQtyCtt || null;
  const name = item.name || s.prodNm || '';
  const list = s.basFeeInfo ? +s.basFeeInfo : null, agmt = s.selAgrmtAplyMfixAmt ? +s.selAgrmtAplyMfixAmt : null;
  return {
    carrier: 'SKT', plan_name: name, monthly_fee: list, discount_fee: agmt,
    network: /LTE/i.test(name) ? 'LTE' : (/5G/i.test(name) ? '5G' : null),
    data_amount: data, call_amount: s.basOfrVcallTmsCtt || null, message: s.basOfrCharCntCtt || null,
    ott_benefits: ott(media.join(' ')), age_target: ageTarget(name + ' ' + age),
    conditions: [join, subscribe, notes].filter(Boolean).join(' | ').slice(0, 400) || null,
    source_url: `https://m.tworld.co.kr/product/callplan?prod_id=${item.prodid}`,
    detail: { prod_id: item.prodid, fee: { list, agmt }, data: { basic: data, teth: s.shrDataQtyCtt || null }, voice: s.basOfrVcallTmsCtt || null, msg: s.basOfrCharCntCtt || null, media, join, age, subscribe, notes },
  };
}

// SKT: 자체 페이지+response 리스너 관리(ledger 가로채기), prodid 순회
async function sktPlanDetailAll(browser, list) {
  const page = await newPage(browser);
  let cap = {};
  page.on('response', async r => {
    const u = r.url();
    if (!/core-product\/v1\/(ledger|benefits)/.test(u)) return;
    try { const j = JSON.parse(await r.text()); if (u.includes('/summaries')) cap.sum = j.result; else if (u.includes('/contents')) cap.cont = j.result; } catch {}
  });
  const rows = []; let failed = 0;
  try {
    for (const it of list) {
      if (!it.prodid) { failed++; continue; }
      cap = {};
      const r = await gotoRetry(page, `https://m.tworld.co.kr/product/callplan?prod_id=${it.prodid}`, { waitMs: 3500, retries: 3 });
      if (!r.ok) { failed++; continue; }
      await page.waitForTimeout(1500);
      if (!cap.sum) await page.waitForTimeout(1800);
      if (!cap.sum) { failed++; continue; }
      rows.push(sktParse(it, cap));
    }
  } finally { await page.close(); }
  return { rows, failed };
}

// SKT 결합: 목록에 코드 없음 → 목록레벨 강등
function sktBundleRowFrom(item) {
  return {
    carrier: 'SKT', bundle_name: item.name, discount_rule: null,
    source_url: 'https://m.shop.tworld.co.kr/wire/product/combinedList',
    components: [], discount_tiers: [],
    detail: { _note: 'SKT 결합 상세 크롤 TODO — 목록레벨 적재', list_name: item.name },
  };
}

// ── FAQ / 유선: 목록 collect 가 이미 상세를 실어옴 → 재크롤 없이 매핑 ──
function faqRow(item, carrier) {
  return {
    carrier, topic_code: item.topic_code || 'etc', question: item.name,
    answer: item.answer || '', source_url: item.source_url || null,
    detail: {}, // faqs_staging 엔 detail 컬럼 없음(무시)
  };
}
function wiredRow(item, carrier) {
  return {
    carrier, category: item.category || 'internet', name: item.name,
    monthly_fee: item.fee ?? null, speed: item.speed || null, channels: item.channels || null,
    conditions: null, source_url: item.source_url || null,
  };
}

// dispatch
const RICH = { // per-item 페이지 navigate (전용 page 재사용)
  'kt:plans': ktPlanRows, 'lgu:plans': lguPlanRows,
  'kt:bundles': ktBundleRow, 'lgu:bundles': lguBundleRow,
};
const RICH_ALL = { // 자체 page/loop 관리 (response 리스너 등)
  'skt:plans': sktPlanDetailAll,
};
const MAP = { // 목록 항목이 이미 상세 보유 → 직접 매핑(무크롤)
  'kt:faqs': faqRow, 'skt:faqs': faqRow, 'lgu:faqs': faqRow,
  'skt:wired': wiredRow,
};
const DEGRADE = { 'skt:bundles': sktBundleRowFrom };
const CODE = { 'KT': 'kt', 'SKT': 'skt', 'LG U+': 'lgu' };

// 메인: 변경된 probe 의 items → 상세 rows
export async function collectDetail(area, carrier, browser, items, { cap = DETAIL_CAP } = {}) {
  const key = `${CODE[carrier]}:${area}`;
  const list = (items || []).slice(0, cap);
  const overflow = (items || []).length - list.length;
  const tail = overflow > 0 ? ` · +${overflow} 초과생략` : '';

  // 1) 목록 항목이 이미 상세 보유(FAQ·유선) → 무크롤 매핑
  if (MAP[key]) {
    const rows = list.map(it => MAP[key](it, carrier));
    return { rows, ok: rows.length > 0, note: `상세 ${rows.length}행 매핑${tail}` };
  }
  // 2) 자체 page/loop 관리 상세수집(SKT ledger)
  if (RICH_ALL[key]) {
    const { rows, failed } = await RICH_ALL[key](browser, list);
    return { rows, ok: rows.length > 0, note: `상세 ${rows.length}행 수집 (항목 ${list.length}, 실패 ${failed})${tail}` };
  }
  // 3) per-item 페이지 navigate 상세수집(KT·LGU)
  const rich = RICH[key];
  const degrade = DEGRADE[key];
  if (!rich && !degrade) return { rows: [], ok: false, note: `상세수집 미지원(${key}) — delta 마커만` };
  const rows = [];
  if (degrade) {
    for (const it of list) rows.push(degrade(it));
    return { rows, ok: true, note: `목록레벨 ${rows.length}건 적재(상세 TODO)${tail}` };
  }
  const page = await newPage(browser);
  let failed = 0;
  try {
    for (const it of list) {
      try { const got = await rich(page, it); if (got && got.length) rows.push(...got); else failed++; }
      catch { failed++; }
    }
  } finally { await page.close(); }
  return { rows, ok: rows.length > 0, note: `상세 ${rows.length}행 수집 (항목 ${list.length}, 실패 ${failed})${tail}` };
}
