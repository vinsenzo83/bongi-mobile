// SKT 요금제 최종 — view=all 로드 후 탭 버튼 순차 클릭(DOM 누적), 아코디언 펼침, 개별 카드 union 추출
import { launch, newPage, gotoRetry } from './lib/browser.mjs';
import { writeFileSync } from 'fs';
const SC = '/private/tmp/claude-501/-Users-vinsenzo/22c2de51-dc9a-44c2-bacf-7836be4787e0/scratchpad/';

const b = await launch();
const p = await newPage(b);
await gotoRetry(p, 'https://m.tworld.co.kr/product/renewal/mobileplan/list?view=all', { waitMs: 9000, retries: 3 });
await p.waitForTimeout(2000);

async function expand() {
  for (let i = 0; i < 5; i++) {
    await p.evaluate(() => {
      document.querySelectorAll('.acco-tit, .acco-box > button, .acco-box a[role=button], button.acco, [class*=acco-tit]').forEach(el => { try { el.click(); } catch (e) {} });
    });
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await p.waitForTimeout(800);
  }
}

await expand();
for (const tab of ['라이트', '스마트기기', '전용', '다이렉트']) {
  await p.evaluate((label) => {
    const btn = [...document.querySelectorAll('button.search-total-button')].find(e => (e.innerText || '').replace(/\s+/g, ' ').trim() === label);
    if (btn) btn.click();
  }, tab);
  await p.waitForTimeout(4500);
  await expand();
  const cnt = await p.evaluate(() => document.querySelectorAll('li.comp-list').length);
  console.error(`[${tab}] 누적 li.comp-list=${cnt}`);
}

const cards = await p.evaluate(() => {
  const cl = s => (s || '').replace(/\s+/g, ' ').trim();
  const seen = new Set(); const out = [];
  for (const li of document.querySelectorAll('li.comp-list')) {
    const t = cl(li.innerText);
    if (!/선택약정 반영 시/.test(t) || t.length < 20) continue;
    const after = t.split('선택약정 반영 시')[1] || '';
    if (/~/.test(after.slice(0, 30))) continue; // 범위(카테고리 요약) 제외
    const name = t.split('선택약정 반영 시')[0].trim();
    if (!name || name.length > 42 || seen.has(name)) continue;
    seen.add(name); out.push({ name, text: t });
  }
  return out;
});

writeFileSync(SC + 'skt-plans-final.json', JSON.stringify(cards, null, 2));
console.error(`\n=== 총 고유 개별 요금제 ${cards.length}건 ===`);
cards.forEach(c => console.error(`  ${c.text.slice(0, 125)}`));
await b.close();
