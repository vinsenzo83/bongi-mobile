// LG헬로비전 공식몰에서 색상 수집 — 상품상세 첫 HTML 의 색상 스와치를 읽는다 (JS 불필요).
//   <div class="color" name="colorBtn" data-color-code=".." data-color-name="블랙" data-sub-prdt-seq="16344">
//   · 우리 URL 에 subPrdtSeq 가 있으면 그 색으로 확정(단일)
//   · 없으면 그 상품의 색상 선택지 전체
//   · data-color-name="-" 는 '색상 구분 없음' 을 렌탈사가 명시한 것 → 색상 없음으로 확정
//   node scripts/_tmp/crawl-lghello-colors.mjs [--limit N]
import fs from 'fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const OUT = '/private/tmp/claude-501/-Users-vinsenzo/88fff588-4fb8-4c65-8825-95625f74aae7/scratchpad/lghello_colors.json';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
const limitIdx = process.argv.indexOf('--limit');
const LIMIT = limitIdx > 0 ? Number(process.argv[limitIdx + 1]) : Infinity;

const e = dotenv.parse(fs.readFileSync(process.env.DBENV || '.env.dev'));
const sb = createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY || e.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
const all = async (t, cols, f = (q) => q) => {
  let r = []; for (let i = 0; ; i += 1000) {
    const { data } = await f(sb.from(t).select(cols)).order('id').range(i, i + 999).throwOnError();
    r = r.concat(data); if (data.length < 1000) break;
  } return r;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const models = await all('rental_cat_models', 'id, supplier_id, model_code, product_name, specs, color_names');
const offers = await all('rental_cat_offers', 'model_id, color_name, status', (q) => q.eq('status', 'active'));
const selling = new Set(offers.map((o) => o.model_id));
const hasTicketColor = new Set(offers.filter((o) => o.color_name).map((o) => o.model_id));
const NOT_A_COLOR = /\d\s*bit|frc|hz|nit|색상수|dci|srgb|ntsc|%/i;
const specColor = (m) => {
  const raw = (m.specs?.specifications?.color || '').trim();
  return raw && !NOT_A_COLOR.test(raw) ? raw : '';
};

const target = models.filter((m) => selling.has(m.id) && !hasTicketColor.has(m.id) && !specColor(m)
  && /rental\.lghellovision\.net/.test(m.specs?.product_url || '')).slice(0, LIMIT);

console.log(`대상 ${target.length} 모델`);
const found = []; const noColor = []; const failed = [];
const SWATCH = /<div[^>]*class="[^"]*\bcolor\b[^"]*"[^>]*>/gi;
const attr = (tag, name) => (tag.match(new RegExp(`${name}="([^"]*)"`, 'i')) || [])[1];

for (let i = 0; i < target.length; i++) {
  const m = target[i];
  const url = m.specs.product_url;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(25000) });
    if (!r.ok) { failed.push({ id: m.id, url, why: `http ${r.status}` }); continue; }
    const html = await r.text();
    const tags = html.match(SWATCH) || [];
    const sw = tags.map((t) => ({ name: (attr(t, 'data-color-name') || '').trim(), sub: (attr(t, 'data-sub-prdt-seq') || '').trim() }))
      .filter((x) => x.name);
    if (!sw.length) { failed.push({ id: m.id, url, why: '색상 스와치 없음' }); continue; }
    if (sw.every((x) => x.name === '-')) { noColor.push({ id: m.id, url, why: '렌탈사가 색상 구분 없음으로 표기' }); continue; }
    const mine = (url.match(/subPrdtSeq=(\d+)/) || [])[1];
    const names = mine ? sw.filter((x) => x.sub === mine).map((x) => x.name)
      : [...new Set(sw.map((x) => x.name).filter((n) => n !== '-'))];
    if (!names.length) { failed.push({ id: m.id, url, why: `subPrdtSeq=${mine} 에 해당하는 스와치 없음` }); continue; }
    found.push({ id: m.id, model_code: m.model_code, product_name: m.product_name, url, colors: names,
      evidence: `data-color-name="${names[0]}"${mine ? ` data-sub-prdt-seq="${mine}"` : ''}` });
  } catch (err) { failed.push({ id: m.id, url, why: String(err.message || err).slice(0, 60) }); }
  if ((i + 1) % 20 === 0) process.stdout.write(`\r  ${i + 1}/${target.length} 확보 ${found.length}`);
  await sleep(600);
}
console.log(`\n확보 ${found.length} · 색상없음(공식표기) ${noColor.length} · 실패 ${failed.length}`);
const freq = {};
found.forEach((f) => f.colors.forEach((c) => { freq[c] = (freq[c] || 0) + 1; }));
console.log('색상 분포:', JSON.stringify(Object.fromEntries(Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 15))));
console.log('다색 상품:', found.filter((f) => f.colors.length > 1).length);
fs.writeFileSync(OUT, JSON.stringify({ found, noColor, failed }, null, 1));
console.log('저장:', OUT);
process.exit(0);
