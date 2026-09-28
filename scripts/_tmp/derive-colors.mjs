// 상품명·모델코드에 박힌 색상 추출 — 조사용(읽기 전용). 라이브 DB 조회만 하고 쓰지 않는다.
//   node scripts/_tmp/derive-colors.mjs            → 추출 후보 분포 리포트
//   node scripts/_tmp/derive-colors.mjs --json out.json  → 모델별 결과 저장
import fs from 'fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const e = dotenv.parse(fs.readFileSync('.env'));
const sb = createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY || e.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

// 기본 색상어 — 이 단어가 들어간 '토큰 전체'를 색상명으로 본다 (코타화이트·펄화이트처럼 붙어 쓰는 경우가 많다)
const BASE = ['화이트', '블랙', '실버', '그레이지', '그레이', '베이지', '아이보리', '네이비', '블루', '그린', '레드', '핑크',
  '골드', '브라운', '크림', '샴페인', '스테인리스', '올스텐', '민트', '라벤더', '퍼플', '차콜', '티타늄', '로즈', '코랄',
  '세이지', '그라파이트', '미드나이트', '스노우', '메탈', '옐로우', '오렌지', '퍼플'];
// 색상 앞에 붙어 한 덩어리로 읽히는 수식어 (토큰이 분리돼 있을 때만 앞 토큰을 붙인다)
const MOD = ['퓨어', '코타', '새틴', '메탈', '스노우', '펄', '크림', '샴페인', '미드나이트', '딥', '라이트', '다크',
  '로즈', '세이지', '클라우드', '토프', '임페리얼', '가든', '페블', '샌드', '포슬린', '올', '모던', '내추럴', '소프트'];
// 색상어를 품고 있지만 색이 아닌 토큰 (토큰 단위로 차단 — 올레드=OLED 의 '레드' 같은 오탐)
const NOT_COLOR = /올레드|블랙홀|블루투스|블랙박스|블루레이|화이트닝|그린티|골드바|레드와인|실버라이닝|로즈마리|에버그린/;

const splitTokens = (s) => String(s || '').split(/[\s_\-/(),[\]|+·]+/).filter(Boolean);

function derive(name, code) {
  const out = [];
  for (const src of [name, code]) {
    const toks = splitTokens(src);
    toks.forEach((tok, i) => {
      if (NOT_COLOR.test(tok)) return;                      // 올레드OLED · 블랙홀프로 …
      const base = BASE.find((b) => tok.includes(b));
      if (!base) return;
      let val = tok.replace(/^[A-Za-z0-9.]+(?=[가-힣])/, '');  // slim블랙 · Ultra블랙 → 블랙
      // 토큰이 색상어 자체면 앞 수식어를 붙여 본다: "퓨어" + "화이트" → "퓨어 화이트"
      if (val === base && i > 0 && MOD.includes(toks[i - 1])) val = `${toks[i - 1]} ${tok}`;
      if (val && !out.includes(val)) out.push(val);
    });
  }
  return { colors: out };
}

const all = async (t, cols, f = (q) => q) => {
  let rows = [];
  for (let i = 0; ; i += 1000) {
    const { data } = await f(sb.from(t).select(cols)).order('id').range(i, i + 999).throwOnError();
    rows = rows.concat(data);
    if (data.length < 1000) break;
  }
  return rows;
};

const models = await all('rental_cat_models', 'id, supplier_id, model_code, product_name, specs');
const offers = await all('rental_cat_offers', 'model_id, color_name, status', (q) => q.eq('status', 'active'));
const selling = new Set(offers.map((o) => o.model_id));
const hasOfferColor = new Set(offers.filter((o) => o.color_name).map((o) => o.model_id));

const target = models.filter((m) => selling.has(m.id) && !hasOfferColor.has(m.id)
  && !(m.specs?.specifications?.color || '').trim());

const single = []; const multi = []; const none = [];
for (const m of target) {
  const { colors } = derive(m.product_name, m.model_code);
  const row = { id: m.id, supplier_id: m.supplier_id, product_name: m.product_name, model_code: m.model_code, colors };
  (colors.length === 1 ? single : colors.length > 1 ? multi : none).push(row);
}

const freq = {};
single.forEach((r) => { freq[r.colors[0]] = (freq[r.colors[0]] || 0) + 1; });
const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);

console.log(`대상(색상 없는 판매중 모델) ${target.length}`);
console.log(`  단일 색상 추출  ${single.length}`);
console.log(`  복수 토큰(사람 확인 필요) ${multi.length}`);
console.log(`  추출 실패 ${none.length}`);
console.log(`\n추출된 색상 ${sorted.length}종 — 상위 40`);
for (const [c, n] of sorted.slice(0, 40)) console.log(`  ${String(n).padStart(4)}  ${c}`);
console.log('\n1건뿐인 값(오탐 의심) 상위 30:');
for (const [c] of sorted.filter(([, n]) => n === 1).slice(0, 30)) {
  const ex = single.find((r) => r.colors[0] === c);
  console.log(`  ${c}  ← ${(ex.product_name || '').slice(0, 45)} | ${(ex.model_code || '').slice(0, 30)}`);
}
console.log('\n복수 토큰 예시 10:');
for (const r of multi.slice(0, 10)) console.log(`  ${JSON.stringify(r.colors)}  ← ${(r.product_name || '').slice(0, 50)} | ${(r.model_code || '').slice(0, 30)}`);

const outIdx = process.argv.indexOf('--json');
if (outIdx > 0 && process.argv[outIdx + 1]) {
  fs.writeFileSync(process.argv[outIdx + 1], JSON.stringify({ single, multi, none: none.length }, null, 1));
  console.log(`\n저장: ${process.argv[outIdx + 1]}`);
}
process.exit(0);
