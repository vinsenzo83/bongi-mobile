// 모델코드 접미사 ↔ 색상 대응을 '이미 색상을 아는 모델'로부터 학습하고 정확도를 측정한다.
//   규칙을 지어내지 않는다. 학습 라벨은 공식 출처(공식몰 스펙 color, 청호 티켓 color_name)만 쓴다.
//   node scripts/_tmp/code-color-map.mjs [--json out.json]
import fs from 'fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const e = dotenv.parse(fs.readFileSync(process.env.DBENV || '.env.dev'));
const sb = createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY || e.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
const all = async (t, cols, f = (q) => q) => {
  let r = []; for (let i = 0; ; i += 1000) {
    const { data } = await f(sb.from(t).select(cols)).order('id').range(i, i + 999).throwOnError();
    r = r.concat(data); if (data.length < 1000) break;
  } return r;
};

const models = await all('rental_cat_models', 'id, supplier_id, brand, model_code, product_name, specs, color_names');
const offers = await all('rental_cat_offers', 'model_id, color_name, status', (q) => q.eq('status', 'active'));
const selling = new Set(offers.map((o) => o.model_id));
const ticketColor = new Map();
for (const o of offers) if (o.color_name) ticketColor.set(o.model_id, o.color_name);

const NOT_A_COLOR = /\d\s*bit|frc|hz|nit|색상수|dci|srgb|ntsc|%/i;
const specColors = (m) => {
  const raw = (m.specs?.specifications?.color || '').trim();
  if (!raw) return [];
  return raw.split(/[,/·]/).map((s) => s.trim()).filter((s) => s && s.length <= 30 && !NOT_A_COLOR.test(s));
};

// 색상을 '계열'로 정규화 — 접미사 한 글자는 계열(화이트/블랙/…)까지만 구분한다고 보는 게 타당하다
const FAMILY = [['화이트', /화이트|white|아이보리|스노우/i], ['블랙', /블랙|black|차콜|미드나이트/i],
  ['실버', /실버|silver|스텐|스테인|이녹스|메탈|티타늄/i], ['그레이', /그레이|그레이지|gray|grey/i],
  ['베이지', /베이지|beige|크림|샴페인|샌드|오트밀/i], ['브라운', /브라운|brown|토프/i],
  ['블루', /블루|navy|네이비|blue/i], ['그린', /그린|green|세이지|민트/i],
  ['핑크', /핑크|pink|로즈|코랄|피치/i], ['골드', /골드|gold/i], ['퍼플', /퍼플|라벤더|purple/i],
  ['레드', /레드|red/i], ['옐로우', /옐로우|yellow/i]];
const family = (c) => (FAMILY.find(([, re]) => re.test(c)) || [null])[0];

// 학습셋: 색상이 '하나'로 확정된 모델만 (여러 색이면 코드가 어느 색인지 모른다)
const train = [];
for (const m of models) {
  if (!m.model_code) continue;
  const t = ticketColor.get(m.id);
  const sc = specColors(m);
  const color = t || (sc.length === 1 ? sc[0] : null);
  if (!color) continue;
  const fam = family(color);
  if (!fam) continue;
  train.push({ ...m, color, fam });
}

const brandOf = (m) => (m.brand || m.supplier_id || '?').trim();
const suffixes = (code) => {
  const c = String(code).trim().toUpperCase();
  const out = [];
  for (const n of [1, 2, 3]) {
    const s = c.slice(-n);
    if (/^[A-Z0-9]+$/.test(s)) out.push({ n, s });
  }
  return out;
};

// (브랜드, 접미사길이, 접미사) → 색상계열 분포
const tab = new Map();
for (const m of train) {
  for (const { n, s } of suffixes(m.model_code)) {
    const k = `${brandOf(m)}|${n}|${s}`;
    const e2 = tab.get(k) || { brand: brandOf(m), n, s, counts: {}, total: 0, samples: [] };
    e2.counts[m.fam] = (e2.counts[m.fam] || 0) + 1; e2.total++;
    if (e2.samples.length < 3) e2.samples.push(`${m.model_code}=${m.color}`);
    tab.set(k, e2);
  }
}

// 신뢰 규칙: 표본 4개 이상 + 한 계열이 90% 이상
const rules = [];
for (const v of tab.values()) {
  const [top, cnt] = Object.entries(v.counts).sort((a, b) => b[1] - a[1])[0];
  const purity = cnt / v.total;
  if (v.total >= 4 && purity >= 0.9) rules.push({ ...v, fam: top, purity: +purity.toFixed(3) });
}
// 긴 접미사 우선 (더 구체적인 규칙이 이긴다)
rules.sort((a, b) => b.n - a.n || b.total - a.total);

// 홀드아웃 정확도: 학습셋을 5등분해 4/5로 규칙 만들고 1/5 로 맞춰본다
function buildRules(rows) {
  const t = new Map();
  for (const m of rows) for (const { n, s } of suffixes(m.model_code)) {
    const k = `${brandOf(m)}|${n}|${s}`;
    const x = t.get(k) || { brand: brandOf(m), n, s, counts: {}, total: 0 };
    x.counts[m.fam] = (x.counts[m.fam] || 0) + 1; x.total++; t.set(k, x);
  }
  const r = [];
  for (const v of t.values()) {
    const [top, cnt] = Object.entries(v.counts).sort((a, b) => b[1] - a[1])[0];
    if (v.total >= 4 && cnt / v.total >= 0.9) r.push({ ...v, fam: top });
  }
  r.sort((a, b) => b.n - a.n || b.total - a.total);
  return r;
}
const predict = (rs, m) => {
  for (const r of rs) {
    if (r.brand !== brandOf(m)) continue;
    if (String(m.model_code).trim().toUpperCase().slice(-r.n) === r.s) return r.fam;
  }
  return null;
};
let hit = 0; let miss = 0; let none = 0;
for (let k = 0; k < 5; k++) {
  const test = train.filter((_, i) => i % 5 === k);
  const fit = train.filter((_, i) => i % 5 !== k);
  const rs = buildRules(fit);
  for (const m of test) {
    const p = predict(rs, m);
    if (!p) none++; else if (p === m.fam) hit++; else miss++;
  }
}
console.log(`학습셋(색상 확정 모델) ${train.length}`);
console.log(`신뢰 규칙(표본 4+ · 순도 90%+) ${rules.length}개`);
console.log(`\n홀드아웃 5겹 검증: 맞음 ${hit} · 틀림 ${miss} · 규칙없음 ${none}`
  + `  → 예측한 것 중 정확도 ${hit + miss ? (100 * hit / (hit + miss)).toFixed(1) : '-'}% · 예측 가능 비율 ${(100 * (hit + miss) / train.length).toFixed(1)}%`);

// 색상 없는 판매중 모델에 적용하면 몇 건이 채워지나
const unknown = models.filter((m) => selling.has(m.id) && m.model_code
  && !ticketColor.has(m.id) && specColors(m).length === 0 && !(m.color_names || []).length);
let fill = 0; const byBrand = {}; const ex = [];
for (const m of unknown) {
  const p = predict(rules, m);
  if (!p) continue;
  fill++; byBrand[brandOf(m)] = (byBrand[brandOf(m)] || 0) + 1;
  if (ex.length < 12) ex.push(`${brandOf(m)} ${m.model_code} → ${p}  (${(m.product_name || '').slice(0, 34)})`);
}
console.log(`\n색상 없는 판매중 모델 ${unknown.length} 중 규칙으로 예측 가능 ${fill}`);
console.log('브랜드별:', JSON.stringify(Object.fromEntries(Object.entries(byBrand).sort((a, b) => b[1] - a[1]).slice(0, 12))));
ex.forEach((x) => console.log('  ·', x));

console.log('\n상위 규칙 20:');
rules.slice(0, 20).forEach((r) => console.log(`  ${r.brand} …${r.s} (${r.n}자) → ${r.fam}  표본 ${r.total} 순도 ${r.purity}  예: ${r.samples.join(' / ')}`));

const oi = process.argv.indexOf('--json');
if (oi > 0 && process.argv[oi + 1]) {
  fs.writeFileSync(process.argv[oi + 1], JSON.stringify({ rules, holdout: { hit, miss, none } }, null, 1));
  console.log('\n저장:', process.argv[oi + 1]);
}
process.exit(0);
