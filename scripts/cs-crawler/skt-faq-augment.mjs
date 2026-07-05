// SKT FAQ 확장 크롤러 — m.tworld.co.kr FAQ 카테고리 전수 탐색
// 기존 19개 → 40+ 목표
import { launch, newPage, gotoRetry } from './lib/browser.mjs';

const BASE = 'https://m.tworld.co.kr';

// 기존 FAQ ID 셋 (중복 방지)
const EXISTING_IDS = new Set([
  '1606010718','1606010420','1606010422','1606010376','1606010405',
  '1606010314','1606010963','1000011225','1606010736','1606010910',
  '1606010907','1606010368','1606010811','1606010727','1606010810',
  '1606010407','1606010404','1606010402','1606010944'
]);

// 카테고리 → topic_code 매핑
function topicCode(catName, catId) {
  const n = (catName || '').replace(/\s/g,'');
  if (/요금|납부|청구|미납|정지/.test(n)) return 'billing';
  if (/명의변경|양도/.test(n)) return 'namechange';
  if (/해지|철회|교환|반품/.test(n)) return 'cancel';
  if (/위약금/.test(n)) return 'penalty';
  if (/로밍/.test(n)) return 'roaming';
  if (/멤버십|포인트/.test(n)) return 'membership';
  if (/부가서비스/.test(n)) return 'addon';
  if (/데이터/.test(n)) return 'data';
  if (/유심|기기변경|USIM/.test(n)) return 'sim';
  if (/분실|일시정지/.test(n)) return 'lost';
  if (/가입|개통|번호이동/.test(n)) return 'signup';
  if (/결합|할인/.test(n)) return 'bundle';
  if (/인터넷|유선/.test(n)) return 'internet';
  if (/T멤버십|OK캐쉬백/.test(n)) return 'membership';
  if (/단말|휴대폰|기기/.test(n)) return 'device';
  if (/품질|통화|속도/.test(n)) return 'quality';
  if (/요금제/.test(n)) return 'plan';
  return 'general';
}

async function main() {
  const browser = await launch();
  const page = await newPage(browser);

  // ── 1. FAQ 메인에서 카테고리 목록 탐색 ──────────────────────────────────
  console.error('[step1] FAQ 메인 카테고리 탐색');
  const r0 = await gotoRetry(page, `${BASE}/customer/faq`, { waitMs: 4000, retries: 3 });
  console.error('  메인 status:', r0.ok, r0.len);

  const mainCats = await page.evaluate(() => {
    // 카테고리 링크 수집
    const links = [...document.querySelectorAll('a[href*="faq"]')]
      .map(a => ({ href: a.getAttribute('href'), text: (a.innerText||'').replace(/\s+/g,' ').trim() }))
      .filter(x => x.href && x.text.length > 1);
    // 카테고리 버튼/탭
    const btns = [...document.querySelectorAll('[class*="category"],[class*="tab"],[data-category-id]')]
      .map(b => ({ text: (b.innerText||'').replace(/\s+/g,' ').trim(), cid: b.getAttribute('data-category-id'), href: b.getAttribute('href') }))
      .filter(x => x.text.length > 1);
    return { links: links.slice(0,30), btns: btns.slice(0,30), bodySnippet: document.body.innerText.slice(0,800) };
  });
  console.error('  mainCats links:', JSON.stringify(mainCats.links.slice(0,10)));
  console.error('  mainCats btns:', JSON.stringify(mainCats.btns.slice(0,10)));

  // ── 2. 알려진 카테고리 ID 세트 + 동적 발견 ─────────────────────────────
  // tworld.co.kr FAQ 카테고리 id/type 패턴 (기존 crawler + 탐색)
  const knownCats = [
    // 기존에 이미 사용된 것들
    { qs: '?id=1300000&type=03', name: '요금' },
    { qs: '?id=1900000&type=09', name: '로밍' },
    { qs: '?id=1200000&type=02', name: '가입/해지' },
    // 추가 탐색 대상
    { qs: '?id=1100000&type=01', name: '단말/USIM' },
    { qs: '?id=1400000&type=04', name: '부가서비스' },
    { qs: '?id=1500000&type=05', name: '멤버십' },
    { qs: '?id=1600000&type=06', name: '결합/할인' },
    { qs: '?id=1700000&type=07', name: '데이터' },
    { qs: '?id=1800000&type=08', name: '명의변경' },
    { qs: '?id=2000000&type=10', name: '인터넷/유선' },
    { qs: '?id=2100000&type=11', name: '분실/정지' },
    { qs: '?id=2200000&type=12', name: '위약금' },
  ];

  // 링크에서 카테고리 id 추출
  for (const l of mainCats.links) {
    const m = (l.href || '').match(/[?&]id=(\d+).*type=(\d+)/);
    if (m) {
      const qs = `?id=${m[1]}&type=${m[2]}`;
      if (!knownCats.find(c => c.qs === qs)) {
        knownCats.push({ qs, name: l.text.slice(0,20) });
        console.error('  동적발견 카테고리:', qs, l.text);
      }
    }
  }

  // ── 3. 카테고리별 data-faq-id 수집 ────────────────────────────────────
  const faqMeta = new Map(); // faqId → { catName, topic_code }

  for (const cat of knownCats) {
    const url = `${BASE}/customer/faq/category${cat.qs}`;
    console.error(`\n[cat] ${cat.name} → ${url}`);
    const r = await gotoRetry(page, url, { waitMs: 3000, retries: 3 });
    if (!r.ok) { console.error('  SKIP (not ok)'); continue; }

    // 서브카테고리 링크도 탐색
    const subCatLinks = await page.evaluate(() => {
      return [...document.querySelectorAll('a[href*="faq/category"]')]
        .map(a => ({ href: a.getAttribute('href'), text: (a.innerText||'').replace(/\s+/g,' ').trim() }))
        .filter(x => x.href && x.text.length>1);
    });

    const ids = await page.evaluate(() =>
      [...document.querySelectorAll('button[data-faq-id],[data-faq-id]')]
        .map(e => e.getAttribute('data-faq-id')).filter(Boolean)
    );

    for (const id of ids) {
      if (!faqMeta.has(id)) faqMeta.set(id, { catName: cat.name, topic_code: topicCode(cat.name) });
    }
    console.error(`  IDs found: ${ids.length}, subCats: ${subCatLinks.length}`);
    console.error('  IDs:', ids.slice(0,8).join(','));

    // 서브카테고리도 크롤
    for (const sc of subCatLinks.slice(0, 8)) {
      const scUrl = sc.href.startsWith('http') ? sc.href : `${BASE}${sc.href}`;
      if (scUrl === url) continue;
      const sr = await gotoRetry(page, scUrl, { waitMs: 2500, retries: 2 });
      if (!sr.ok) continue;
      const sids = await page.evaluate(() =>
        [...document.querySelectorAll('button[data-faq-id],[data-faq-id]')]
          .map(e => e.getAttribute('data-faq-id')).filter(Boolean)
      );
      for (const id of sids) {
        if (!faqMeta.has(id)) faqMeta.set(id, { catName: sc.text || cat.name, topic_code: topicCode(sc.text || cat.name) });
      }
      if (sids.length) console.error(`  subCat [${sc.text}] IDs: ${sids.length} (${sids.slice(0,5).join(',')})`);
    }
  }

  console.error(`\n총 수집 FAQ ID: ${faqMeta.size} (기존 ${EXISTING_IDS.size}개 제외 예정)`);

  // ── 4. 각 FAQ 상세 크롤 ────────────────────────────────────────────────
  const results = [];
  let skipped = 0;

  for (const [fid, meta] of faqMeta) {
    if (EXISTING_IDS.has(fid)) { skipped++; continue; }
    const url = `${BASE}/customer/faq/view?faq_Id=${fid}`;
    const r = await gotoRetry(page, url, { waitMs: 1800, retries: 3 });
    if (!r.ok) { console.error(`  FAIL ${fid}`); continue; }

    const data = await page.evaluate(() => {
      const c = s => (s || '').replace(/\s+/g, ' ').trim();
      const title = document.title.split('|')[0].trim();
      let t = c(document.body.innerText);
      // 메뉴 노이즈 컷: 전체메뉴 이후
      const i = t.lastIndexOf('전체메뉴'); if (i >= 0) t = t.slice(i + 4);
      // 내용 태그 이후
      t = t.replace(/^[^[]*내용\s*(모바일|유선|공통)?\s*/, '').replace(/취소\s*$/, '').trim();
      // 푸터 노이즈 컷
      const footerCuts = ['이용약관', '개인정보처리방침', '고객센터', '사업자정보', 'Copyright'];
      for (const cut of footerCuts) {
        const fi = t.lastIndexOf(cut);
        if (fi > 200) { t = t.slice(0, fi).trim(); break; }
      }
      // Q 분리
      const qm = t.match(/^(.*?[?？.])\s+/);
      const question = qm ? qm[1].trim() : (title || t.slice(0, 80));
      const answer = qm ? t.slice(qm[0].length).trim() : t;
      return { title, question, answer };
    });

    if (data.answer.length < 20) { console.error(`  SHORT ${fid}: "${data.answer.slice(0,40)}"`); continue; }

    results.push({
      fid,
      topic_code: meta.topic_code,
      catName: meta.catName,
      question: data.question.slice(0, 300),
      answer: data.answer.slice(0, 750),
      source_url: url,
    });
    console.error(`  OK ${fid} [${meta.topic_code}] "${data.question.slice(0,50)}"`);
  }

  await browser.close();

  console.error(`\n크롤 완료: ${results.length}개 신규, ${skipped}개 기존 스킵`);
  // stdout으로 JSON 출력 (메인 프로세스가 읽음)
  process.stdout.write(JSON.stringify(results, null, 2));
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
