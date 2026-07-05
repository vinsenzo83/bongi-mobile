/**
 * SKB 유선상품 정밀 추출기
 * DOM 구조 확정:
 *   - 카드: .price_listbox
 *   - 상품명: 카드 내 첫 번째 제목 텍스트 (DIV.price_listbox 내 h2/h3/첫 강조텍스트)
 *   - 요금: .fare_price_num (첫 번째 = 단독 요금)
 */
import { launch, newPage, gotoRetry } from './lib/browser.mjs';

const INTERNET_URL = 'https://www.bworld.co.kr/product/internet/charge.do?menu_id=P02010000';
const TV_URL       = 'https://www.bworld.co.kr/product/btv/charge.do?menu_id=P03010000';

function parseFee(str) {
  if (!str) return null;
  const n = parseInt(String(str).replace(/[^0-9]/g, ''), 10);
  return isNaN(n) || n === 0 ? null : n;
}

// .price_listbox 카드에서 상품명 + 단독 요금 추출
async function extractCards(page, category) {
  return page.evaluate(({ category }) => {
    function clean(t) { return (t || '').replace(/\s+/g, ' ').trim(); }
    function toInt(s) {
      const n = parseInt((s||'').replace(/[^0-9]/g,''), 10);
      return isNaN(n)||n===0 ? null : n;
    }
    function speedPat(t) {
      const m = t.match(/([\d.]+)\s*(Gbps|Mbps)/i);
      if (!m) {
        // 기가 = 1Gbps 계열
        if (/기가/.test(t)) return '1Gbps';
        return null;
      }
      return `${m[1]}${m[2]}`;
    }
    function chanPat(t) {
      const m = t.match(/([\d,]+)\s*(ch|채널)/i);
      return m ? m[1].replace(/,/g,'') + 'ch' : null;
    }

    const results = [];
    const seen = new Set();

    document.querySelectorAll('.price_listbox').forEach(card => {
      const fullText = clean(card.innerText);

      // 상품명: 첫 번째 비어있지 않은 자식 텍스트 노드 (제목 div)
      // price_listbox 구조: [제목 div] [설명 p] [태그들] [price_listbox_right]
      // 제목은 price_listbox_right 이전에 오는 첫 번째 강한 텍스트
      let name = '';
      const children = card.childNodes;
      for (const child of children) {
        if (child.classList && child.classList.contains('price_listbox_right')) break;
        const t = clean(child.innerText || child.textContent || '');
        if (t.length > 2 && /[가-힣A-Za-z]/.test(t) && !seen.has('seen_' + t)) {
          // 설명문이 아닌 짧은 제목 (< 60자)
          if (t.length < 80) {
            name = t;
            break;
          }
        }
      }

      // 만약 name이 비어있으면 fullText 첫줄
      if (!name) {
        name = fullText.split(/[\n.！!]/)[0].trim().slice(0, 60);
      }

      // fare_price_num — 첫 번째 = 단독 요금
      const priceNodes = card.querySelectorAll('.fare_price_num');
      if (priceNodes.length === 0) return;

      const standaloneText = clean(priceNodes[0].innerText); // "~월44,000원"
      const monthly_fee = toInt(standaloneText);

      if (!name || !monthly_fee) return;

      const key = name + '|' + monthly_fee;
      if (seen.has(key)) return;
      seen.add(key);

      const speed = category === 'internet' ? (speedPat(fullText) || '1Gbps') : null;
      const channels = category === 'tv' ? chanPat(fullText) : null;

      // conditions: 약정 정보 추출
      let conditions = '부가세 포함';
      if (/1년\s*약정/.test(fullText)) conditions = '1년약정, 부가세 포함';
      else if (/3년\s*약정/.test(fullText)) conditions = '3년약정, 부가세 포함';
      else if (category === 'internet') conditions = '3년약정 기준, 부가세 포함';
      else conditions = '부가세 포함';

      results.push({
        name,
        monthly_fee,
        speed,
        channels,
        conditions,
        category,
        standalone_text: standaloneText, // 검증용
      });
    });

    return results;
  }, { category });
}

const browser = await launch();
const page = await newPage(browser);

// ── 인터넷 ────────────────────────────────────────────────────────────────────
console.error('=== 인터넷 추출 시작 ===');
await gotoRetry(page, INTERNET_URL, { waitMs: 6000, retries: 3, waitUntil: 'networkidle' });

// 더보기 버튼 클릭 (숨겨진 상품 확장)
const moreBtns = await page.$$('.btn-more, .more-btn, button:has-text("더보기"), a:has-text("더보기")');
console.error(`더보기 버튼: ${moreBtns.length}개`);
for (const btn of moreBtns) {
  await btn.click().catch(() => {});
  await page.waitForTimeout(1500);
}

let internetRows = await extractCards(page, 'internet');
console.error(`인터넷 카드: ${internetRows.length}개`);
internetRows.forEach(r => console.error(`  [${r.standalone_text}] ${r.name} → ${r.monthly_fee}원 (${r.speed})`));

// ── B tv ──────────────────────────────────────────────────────────────────────
console.error('\n=== B tv 추출 시작 ===');
await gotoRetry(page, TV_URL, { waitMs: 6000, retries: 3, waitUntil: 'networkidle' });

const tvMoreBtns = await page.$$('.btn-more, .more-btn, button:has-text("더보기"), a:has-text("더보기")');
console.error(`TV 더보기 버튼: ${tvMoreBtns.length}개`);
for (const btn of tvMoreBtns) {
  await btn.click().catch(() => {});
  await page.waitForTimeout(1500);
}

let tvRows = await extractCards(page, 'tv');
console.error(`B tv 카드: ${tvRows.length}개`);
tvRows.forEach(r => console.error(`  [${r.standalone_text}] ${r.name} → ${r.monthly_fee}원`));

await browser.close();

// stdout: JSON
const result = { internet: internetRows, tv: tvRows };
process.stdout.write(JSON.stringify(result, null, 2));
