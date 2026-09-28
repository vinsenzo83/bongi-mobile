// 수집한 색상 전부 반영 + 모델코드 전파
//   1) 크롤 결과 JSON(호스트별) → rental_cat_models.color_names / color_source
//   2) 전파: 같은 제품(모델코드 정규화 일치)을 파는 다른 렌탈사 행에 같은 색상 기록
//      · 표기만 다른 값(코타PCM화이트 / 코타화이트 / 화이트)은 가장 구체적인 값으로 통일
//      · 색상 계열이 실제로 갈리는 코드는 전파하지 않고 사람 확인 목록으로 뺀다
//   node scripts/_tmp/apply-colors-all.mjs dev            → 미리보기
//   node scripts/_tmp/apply-colors-all.mjs dev --apply
//   live 는 --apply 와 --i-know 둘 다 필요 (대표 승인 후)
import fs from 'fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const S = '/private/tmp/claude-501/-Users-vinsenzo/88fff588-4fb8-4c65-8825-95625f74aae7/scratchpad';
const target = process.argv[2];
const apply = process.argv.includes('--apply');
if (!['dev', 'live'].includes(target)) { console.error('사용법: <dev|live> [--apply]'); process.exit(1); }
if (target === 'live' && apply && !process.argv.includes('--i-know')) { console.error('라이브는 --i-know 필요 (대표 승인 확인)'); process.exit(1); }

const e = dotenv.parse(fs.readFileSync(target === 'live' ? '.env' : '.env.dev'));
const sb = createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY || e.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
const all = async (t, cols, f = (q) => q) => {
  let r = []; for (let i = 0; ; i += 1000) {
    const { data } = await f(sb.from(t).select(cols)).order('id').range(i, i + 999).throwOnError();
    r = r.concat(data); if (data.length < 1000) break;
  } return r;
};

// ─── 1. 크롤 결과 모으기 ───
const SOURCES = [
  ['lghello_colors.json', 'LG헬로비전 공식몰(색상 스와치)'],
  ['colors_samsung.json', '삼성전자 공식몰(goodsOptStr 색상)'],
  ['colors_coway.json', '코웨이 공식몰(specList 색상)'],
  ['colors_lge.json', 'LG전자 공식몰(JSON-LD 색상)'],
  ['colors_woosung.json', '그랜드우성 공식몰(상품정보고시 재질)'],
  ['colors_haier.json', '하이얼 공식몰(상품명 색상)'],
  ['colors_rentalnara.json', '렌탈나라(상품명 색상)'],
  ['colors_cuckoo.json', '쿠쿠 공식몰(상품고시 색상)'],
];
// alt 문장에서 뽑힌 조각·부위별 서술은 색상이 아니다
const BAD_VALUE = /[:：]|프레임|헤드\(|패널|놓인|있는|위에|아래|보이는|배경|사진|이미지/;
const crawled = new Map();   // model_id → { colors, source }
let files = 0;
for (const [f, src] of SOURCES) {
  let j; try { j = JSON.parse(fs.readFileSync(`${S}/${f}`, 'utf8')); } catch { continue; }
  files++;
  for (const r of j.found || []) {
    const cols = (r.colors || []).filter((c) => !BAD_VALUE.test(c) && String(c).trim().length <= 30);
    if (cols.length && !crawled.has(r.id)) crawled.set(r.id, { colors: cols, source: src });
  }
}
console.log(`크롤 결과 파일 ${files}개 · 색상 확보 모델 ${crawled.size}`);

// ─── 2. 현재 상태 ───
const models = await all('rental_cat_models', 'id, supplier_id, brand, model_code, product_name, specs, color_names, color_source');
const offers = await all('rental_cat_offers', 'model_id, color_name, status', (q) => q.eq('status', 'active'));
const selling = new Set(offers.map((o) => o.model_id));
const ticketColor = new Map(offers.filter((o) => o.color_name).map((o) => [o.model_id, o.color_name]));
const NOT_A_COLOR = /\d\s*bit|frc|hz|nit|색상수|dci|srgb|ntsc|%/i;
const specColors = (m) => {
  const raw = (m.specs?.specifications?.color || '').trim();
  if (!raw || NOT_A_COLOR.test(raw)) return [];
  return raw.split(/[,/·]/).map((s) => s.trim()).filter((s) => s && s.length <= 30);
};

const FAMILY = [['화이트', /화이트|white|아이보리|스노우/i], ['블랙', /블랙|black|차콜|미드나이트/i],
  ['실버', /실버|silver|스텐|스테인|이녹스|메탈|티타늄|크롬/i], ['그레이', /그레이|그레이지|gray|grey/i],
  ['베이지', /베이지|beige|크림|샴페인|샌드|오트밀|아몬드/i], ['브라운', /브라운|brown|토프/i],
  ['블루', /블루|navy|네이비|blue/i], ['그린', /그린|green|세이지|민트/i],
  ['핑크', /핑크|pink|로즈|코랄|피치/i], ['골드', /골드|gold/i], ['퍼플', /퍼플|라벤더|purple/i],
  ['레드', /레드|red/i], ['옐로우', /옐로우|yellow/i]];
const fam = (c) => (FAMILY.find(([, re]) => re.test(c)) || [null])[0];
const codeKey = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9가-힣]/g, '');

// 이미 아는 색상 (우선순위: 티켓 > 공식몰 스펙 > 크롤 > 기존 color_names)
const known = new Map();
for (const m of models) {
  if (!selling.has(m.id)) continue;
  const t = ticketColor.get(m.id);
  if (t) { known.set(m.id, { colors: [t], source: '조건(티켓) 색상' }); continue; }
  const sc = specColors(m);
  if (sc.length) { known.set(m.id, { colors: sc, source: '공식몰 스펙' }); continue; }
  const cr = crawled.get(m.id);
  if (cr) { known.set(m.id, cr); continue; }
  if ((m.color_names || []).length) { known.set(m.id, { colors: m.color_names, source: m.color_source || '기존값' }); }
}

// ─── 3. 전파: 모델코드가 같으면 같은 제품 ───
const byCode = new Map();
for (const m of models) {
  if (!selling.has(m.id) || !codeKey(m.model_code)) continue;
  const k = codeKey(m.model_code);
  (byCode.get(k) || byCode.set(k, []).get(k)).push(m);
}
const propagate = []; const conflict = [];
for (const [k, rows] of byCode) {
  const withColor = rows.filter((m) => known.has(m.id));
  const without = rows.filter((m) => !known.has(m.id));
  if (!withColor.length || !without.length) continue;
  const values = [...new Set(withColor.flatMap((m) => known.get(m.id).colors))];
  const fams = [...new Set(values.map(fam).filter(Boolean))];
  if (fams.length > 1) { conflict.push({ code: rows[0].model_code, values, rows: without.length }); continue; }
  // 표기 통일: 가장 구체적인(긴) 값
  const rep = values.slice().sort((a, b) => b.length - a.length)[0];
  const srcOf = withColor.find((m) => known.get(m.id).colors.includes(rep)) || withColor[0];
  for (const m of without) propagate.push({ id: m.id, colors: [rep], source: `모델코드 전파(${known.get(srcOf.id).source})`, code: rows[0].model_code });
}
console.log(`전파 대상 ${propagate.length} 모델 · 계열이 갈려 보류 ${conflict.length} 코드`);
fs.writeFileSync(`${S}/color_conflicts.json`, JSON.stringify(conflict, null, 1));

// ─── 4. 쓰기 ───
const writes = [];
for (const [id, v] of crawled) {
  const m = models.find((x) => x.id === id);
  if (!m || !selling.has(id)) continue;
  if (ticketColor.has(id) || specColors(m).length) continue;   // 더 신뢰도 높은 값 보호
  writes.push({ id, colors: v.colors, source: v.source });
}
for (const p of propagate) writes.push({ id: p.id, colors: p.colors, source: p.source });

const uniq = new Map();
for (const w of writes) if (!uniq.has(w.id)) uniq.set(w.id, w);
console.log(`기록 대상 ${uniq.size} 모델 (크롤 ${crawled.size} + 전파 ${propagate.length}, 중복·보호 제외)`);
if (!apply) { console.log('미리보기 — --apply 로 실제 기록'); process.exit(0); }

let n = 0;
for (const w of uniq.values()) {
  await sb.from('rental_cat_models').update({ color_names: w.colors, color_source: w.source, updated_at: new Date().toISOString() })
    .eq('id', w.id).throwOnError();
  if (++n % 200 === 0) process.stdout.write(`\r  ${n}/${uniq.size}`);
}
console.log(`\n${target} 기록 완료 ${n}`);
process.exit(0);
