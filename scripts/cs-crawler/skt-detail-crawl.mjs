// SKT 요금제 상세 크롤 — 각 prodid 상세페이지 로드, core-product BFF(summaries/contents) 가로채 파싱
import { launch, newPage, gotoRetry } from './lib/browser.mjs';
import { readFileSync, writeFileSync, existsSync } from 'fs';
const SC = '/private/tmp/claude-501/-Users-vinsenzo/22c2de51-dc9a-44c2-bacf-7836be4787e0/scratchpad/';
const fmap = JSON.parse(readFileSync(SC + 'skt-fltmap.json', 'utf8'));
const OUT = SC + 'skt-details.json';
const done = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};

const strip = h => (h || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();

const b = await launch();
const p = await newPage(b);
let captured = {};
p.on('response', async (r) => {
  const u = r.url();
  if (!/core-product\/v1\/(ledger|benefits)/.test(u)) return;
  try {
    const j = JSON.parse(await r.text());
    if (u.includes('/summaries')) captured.summaries = j.result;
    else if (u.includes('/contents')) captured.contents = j.result;
    else if (u.includes('/benefits/') && u.includes('/base')) captured.base = j.result;
  } catch (e) {}
});

function parse(pid, name) {
  const s = captured.summaries || {};
  const media = [];
  (s.prodBenfAreaList || []).forEach(area => {
    (area.prodBenfList || []).forEach(bf => {
      const nm = bf.prodBenfGrpNm || '', phr = strip(bf.prodBenfFrndExpsPhrs || bf.prodBenfExpsPhrs || bf.prodBenfNm || '');
      if (nm && phr) media.push(`${nm}: ${phr}`.slice(0, 120));
    });
  });
  // contents: 가입조건 / 연령 / 구독 / 유의
  let join = '', age = '', subscribe = '', notes = '';
  (captured.contents?.contentsList || []).forEach(c => {
    const t = c.titleNm || '', d = strip(c.ledItmDesc).slice(0, 400);
    if (/가입\s*조건/.test(t)) join = d;
    else if (/연령/.test(t)) age = d;
    else if (/구독/.test(t)) subscribe = d;
    else if (/유의/.test(t)) notes = d.slice(0, 200);
  });
  return {
    data: { basic: s.basOfrGbDataQtyCtt || s.basOfrMbDataQtyCtt || null, qos: s.qosDataQtyCtt || null, teth_gb: s.shrDataQtyCtt || null },
    voice: { basic: s.basOfrVcallTmsCtt || null, video_add_min: s.addTcCtt || null },
    msg: s.basOfrCharCntCtt || null,
    fee: { list: s.basFeeInfo ? +s.basFeeInfo : null, agmt: s.selAgrmtAplyMfixAmt ? +s.selAgrmtAplyMfixAmt : null },
    subtitle: s.subTitNm || null,
    media, subscribe, age, join, notes,
  };
}

const targets = fmap.filter(x => x.prodid && !done[x.name]);
console.error(`대상 ${targets.length} / 전체 ${fmap.length} (완료 ${Object.keys(done).length})`);
let i = 0;
for (const t of targets) {
  captured = {};
  const r = await gotoRetry(p, `https://m.tworld.co.kr/product/callplan?prod_id=${t.prodid}`, { waitMs: 3500, retries: 3 });
  if (!r.ok) { console.error(`  ✗ ${t.name} throttle`); continue; }
  await p.waitForTimeout(1500);
  if (!captured.summaries) { await p.waitForTimeout(2000); }
  if (!captured.summaries) { console.error(`  ✗ ${t.name} no-bff`); continue; }
  done[t.name] = { prodid: t.prodid, ...parse(t.prodid, t.name) };
  i++;
  if (i % 10 === 0) { writeFileSync(OUT, JSON.stringify(done, null, 2)); console.error(`  ... ${i}/${targets.length} 저장`); }
}
writeFileSync(OUT, JSON.stringify(done, null, 2));
console.error(`\n완료 ${Object.keys(done).length}건 → ${OUT}`);
await b.close();
