/**
 * SKB 유선상품(인터넷·B tv) 공식 요금표 크롤러
 * target:
 *   인터넷 https://www.bworld.co.kr/product/internet/charge.do?menu_id=P02010000
 *   B tv   https://www.bworld.co.kr/product/btv/charge.do?menu_id=P03010000
 *
 * 전략:
 *  1) page.on('response') 로 JSON BFF 가로채기 (bworld API 공통 패턴)
 *  2) 실패 시 DOM fallback — 카드/테이블 텍스트 파싱
 */
import { launch, newPage, gotoRetry } from './lib/browser.mjs';

const INTERNET_URL = 'https://www.bworld.co.kr/product/internet/charge.do?menu_id=P02010000';
const TV_URL       = 'https://www.bworld.co.kr/product/btv/charge.do?menu_id=P03010000';

// ── 헬퍼: 원화 문자열 → 정수 ─────────────────────────────────────────────────
function parseFee(str) {
  if (!str) return null;
  const n = parseInt(String(str).replace(/[^0-9]/g, ''), 10);
  return isNaN(n) || n === 0 ? null : n;
}

// ── 헬퍼: JSON 응답에서 상품 목록 탐색 ───────────────────────────────────────
function extractFromJson(json, category) {
  const results = [];
  const text = JSON.stringify(json);

  // bworld 공통 응답 패턴: list / prodList / resultList 등
  const candidates = [];
  function walk(obj, depth = 0) {
    if (depth > 8 || !obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      // 상품 배열처럼 보이면 수집
      if (obj.length > 0 && obj.length < 50 && typeof obj[0] === 'object') candidates.push(obj);
      obj.forEach(v => walk(v, depth + 1));
    } else {
      Object.values(obj).forEach(v => walk(v, depth + 1));
    }
  }
  walk(json);

  for (const arr of candidates) {
    for (const item of arr) {
      // 상품명 필드 후보
      const name =
        item.prodNm || item.prod_nm || item.prodName || item.prod_name ||
        item.name || item.svcName || item.svcNm || item.title || '';
      // 요금 필드 후보
      const fee =
        item.monthlyFee || item.mnthFee || item.mnthCharge || item.monthly_fee ||
        item.stdFee || item.baseFee || item.fee || item.charge || item.price || '';
      // 속도 (인터넷)
      const speed =
        item.speed || item.netSpeed || item.downSpeed || item.bandwidth || '';
      // 채널 수 (tv)
      const channels =
        item.chCnt || item.channelCnt || item.channel_cnt || item.channels || '';

      if (name && fee) {
        results.push({
          name: String(name).trim(),
          monthly_fee: parseFee(fee),
          speed: speed ? String(speed).trim() : null,
          channels: channels ? String(channels).trim() : null,
          category,
        });
      }
    }
    if (results.length > 0) break; // 첫 번째 유효 배열 사용
  }
  return results;
}

// ── 인터넷 DOM 파싱 fallback ──────────────────────────────────────────────────
async function parseInternetDOM(page) {
  return page.evaluate(() => {
    const results = [];
    const seen = new Set();

    // bworld 인터넷 요금표: .charge-tbl, .prod-list, .list-type-wrap 등
    const selectors = [
      '.charge-tbl tbody tr',
      '.prod-list li',
      '.list-type-wrap li',
      '[class*=prod][class*=item]',
      '[class*=item][class*=prod]',
      'tbody tr',
      '.tbl-type01 tbody tr',
      '.tbl-wrap tbody tr',
    ];

    function clean(t) { return (t || '').replace(/\s+/g, ' ').trim(); }
    function toInt(s) {
      const n = parseInt((s||'').replace(/[^0-9]/g,''), 10);
      return isNaN(n)||n===0 ? null : n;
    }
    function speedPat(t) {
      const m = t.match(/([\d.]+)\s*(Gbps|Mbps|G|M)/i);
      if (!m) return null;
      const v = parseFloat(m[1]);
      const u = m[2].toLowerCase();
      if (u.startsWith('g')) return v >= 1 ? `${v}Gbps` : `${Math.round(v*1000)}Mbps`;
      return `${v}Mbps`;
    }

    for (const sel of selectors) {
      const rows = document.querySelectorAll(sel);
      rows.forEach(row => {
        const cells = row.querySelectorAll('td, th, .tit, .price, .name, .speed, [class*=tit], [class*=price], [class*=name], [class*=speed]');
        if (cells.length < 2) {
          // 단일 셀이지만 내부에 name+price 모두 있는 경우
          const t = clean(row.innerText);
          const feeM = t.match(/월\s*[\d,]+원|[\d,]{5,7}원/);
          const nameM = t.match(/[가-힣A-Za-z][가-힣A-Za-z0-9\s()（）]+/);
          const spd = speedPat(t);
          if (feeM && nameM) {
            const name = nameM[0].trim();
            const fee = toInt(feeM[0]);
            const key = name + fee;
            if (!seen.has(key)) { seen.add(key); results.push({ name, monthly_fee: fee, speed: spd, channels: null, category: 'internet' }); }
          }
          return;
        }
        const texts = [...cells].map(c => clean(c.innerText));
        // 이름 후보: 가장 길고 가-힣 포함
        const nameCand = texts.filter(t => /[가-힣]/.test(t) && t.length > 2).sort((a,b)=>b.length-a.length)[0];
        // 요금 후보: 숫자만 있는 컬럼
        const feeCand = texts.find(t => /^[\d,]+원?$/.test(t.replace(/\s/g,'')) && t.replace(/[^0-9]/g,'').length >= 4);
        const spd = texts.map(speedPat).find(Boolean);
        if (nameCand && feeCand) {
          const name = nameCand;
          const fee = toInt(feeCand);
          const key = name + fee;
          if (!seen.has(key)) { seen.add(key); results.push({ name, monthly_fee: fee, speed: spd, channels: null, category: 'internet' }); }
        }
      });
      if (results.length > 0) break;
    }
    return results;
  });
}

// ── B tv DOM 파싱 fallback ────────────────────────────────────────────────────
async function parseTvDOM(page) {
  return page.evaluate(() => {
    const results = [];
    const seen = new Set();
    const selectors = [
      '.charge-tbl tbody tr',
      '.prod-list li',
      '.list-type-wrap li',
      '[class*=prod][class*=item]',
      'tbody tr',
      '.tbl-type01 tbody tr',
    ];
    function clean(t) { return (t || '').replace(/\s+/g, ' ').trim(); }
    function toInt(s) {
      const n = parseInt((s||'').replace(/[^0-9]/g,''), 10);
      return isNaN(n)||n===0 ? null : n;
    }
    function chanPat(t) {
      const m = t.match(/([\d,]+)\s*ch|채널\s*([\d,]+)/i);
      return m ? (m[1]||m[2]).replace(/,/g,'') + 'ch' : null;
    }

    for (const sel of selectors) {
      const rows = document.querySelectorAll(sel);
      rows.forEach(row => {
        const cells = row.querySelectorAll('td, th, .tit, .price, .name, [class*=tit],[class*=price],[class*=name]');
        if (cells.length < 2) {
          const t = clean(row.innerText);
          const feeM = t.match(/[\d,]{5,7}원/);
          const nameM = t.match(/B tv[가-힣A-Za-z0-9\s()]*|[가-힣A-Za-z][가-힣A-Za-z0-9\s()]{3,}/);
          const ch = chanPat(t);
          if (feeM && nameM) {
            const name = nameM[0].trim();
            const fee = toInt(feeM[0]);
            const key = name+fee;
            if (!seen.has(key)) { seen.add(key); results.push({ name, monthly_fee: fee, speed: null, channels: ch, category: 'tv' }); }
          }
          return;
        }
        const texts = [...cells].map(c => clean(c.innerText));
        const nameCand = texts.filter(t => /[가-힣]/.test(t) && t.length > 2).sort((a,b)=>b.length-a.length)[0];
        const feeCand = texts.find(t => /^[\d,]+원?$/.test(t.replace(/\s/g,'')) && t.replace(/[^0-9]/g,'').length >= 4);
        const ch = texts.map(chanPat).find(Boolean);
        if (nameCand && feeCand) {
          const name = nameCand;
          const fee = toInt(feeCand);
          const key = name+fee;
          if (!seen.has(key)) { seen.add(key); results.push({ name, monthly_fee: fee, speed: null, channels: ch, category: 'tv' }); }
        }
      });
      if (results.length > 0) break;
    }
    return results;
  });
}

// ── 전체 텍스트 덤프 (마지막 수단) ──────────────────────────────────────────
async function dumpText(page, limit = 4000) {
  return page.evaluate((limit) => {
    return (document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, limit);
  }, limit);
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
const browser = await launch();
const page = await newPage(browser);

const captured = { internet: [], tv: [] };

// JSON BFF 가로채기
page.on('response', async (resp) => {
  try {
    const url = resp.url();
    const ct = resp.headers()['content-type'] || '';
    if (!ct.includes('json')) return;
    if (!/product|charge|internet|btv|fee|price|plan/i.test(url)) return;
    const body = await resp.json().catch(() => null);
    if (!body) return;
    const cat = /btv|tv/i.test(url) ? 'tv' : 'internet';
    const rows = extractFromJson(body, cat);
    if (rows.length > 0) {
      console.error(`[BFF] ${cat} ${url.slice(0,80)} → ${rows.length}개`);
      captured[cat].push(...rows);
    }
  } catch (_) {}
});

// ── 인터넷 ────────────────────────────────────────────────────────────────────
console.error('\n=== 인터넷 크롤 시작 ===');
const iRes = await gotoRetry(page, INTERNET_URL, { waitMs: 5000, retries: 4 });
console.error('goto result:', JSON.stringify(iRes));

// 추가 대기 (탭 클릭 렌더링)
await page.waitForTimeout(2000);

// 탭이 있으면 전부 클릭해 콘텐츠 확보
const iTabs = await page.$$('[class*=tab] a, [class*=tab] button, ul.tab li, .tab-list li').catch(() => []);
console.error(`인터넷 탭 ${iTabs.length}개 발견`);
for (const tab of iTabs) {
  await tab.click().catch(() => {});
  await page.waitForTimeout(1500);
}

let internetRows = captured.internet;
if (internetRows.length === 0) {
  console.error('[fallback] DOM 파싱 시도...');
  internetRows = await parseInternetDOM(page);
  console.error(`DOM fallback → ${internetRows.length}개`);
}

// 여전히 0이면 전문 텍스트 덤프
if (internetRows.length === 0) {
  const txt = await dumpText(page, 5000);
  console.error('[텍스트 덤프]\n', txt);
}

// ── B tv ──────────────────────────────────────────────────────────────────────
console.error('\n=== B tv 크롤 시작 ===');
const tRes = await gotoRetry(page, TV_URL, { waitMs: 5000, retries: 4 });
console.error('goto result:', JSON.stringify(tRes));

await page.waitForTimeout(2000);

const tTabs = await page.$$('[class*=tab] a, [class*=tab] button, ul.tab li, .tab-list li').catch(() => []);
console.error(`TV 탭 ${tTabs.length}개 발견`);
for (const tab of tTabs) {
  await tab.click().catch(() => {});
  await page.waitForTimeout(1500);
}

let tvRows = captured.tv;
if (tvRows.length === 0) {
  console.error('[fallback] TV DOM 파싱 시도...');
  tvRows = await parseTvDOM(page);
  console.error(`DOM fallback → ${tvRows.length}개`);
}

if (tvRows.length === 0) {
  const txt = await dumpText(page, 5000);
  console.error('[TV 텍스트 덤프]\n', txt);
}

await browser.close();

// ── 최종 결과 출력 ────────────────────────────────────────────────────────────
const result = {
  internet: internetRows,
  tv: tvRows,
  internetUrl: INTERNET_URL,
  tvUrl: TV_URL,
};
process.stdout.write(JSON.stringify(result, null, 2));
