// 호스트별 공식 페이지에서 색상 수집 (조사조 A·C·E 가 확인한 경로를 그대로 구현)
//   node scripts/_tmp/crawl-colors.mjs <host> [--limit N]
//   host: rentalnara | woosung | lassele | haier
//
// 경로 근거(각 조사조가 표본으로 확인):
//   rentalnara  compare.php 의 JS 변수 gname / 상품명 끝 괄호 안 색상 (카테고리별 커버리지 0~90%)
//   woosung     그누보드 상품정보고시 스펙표 <strong>재질</strong> 다음 <span> (올스텐·칼라강판·스테인리스 …) 7/7
//   lassele     blockquote.hero 의 슬래시 구분 스펙 마지막 토큰(재질) — 냉장고류만 6/8
//   haier       가격 위 <p class="title"> 의 "라인명 - 색상 (용량)" 4/6
import fs from 'fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const HOST_KEY = process.argv[2];
const HOSTS = {
  rentalnara: { match: /xn--299ar6vqrd\.com/, out: 'rentalnara' },
  woosung: { match: /woosunginc\.co\.kr/, out: 'woosung' },
  lassele: { match: /lassele\.com/, out: 'lassele' },
  haier: { match: /haier\.co\.kr/, out: 'haier' },
  samsung: { match: /www\.samsung\.com/, out: 'samsung' },
  coway: { match: /www\.coway\.com/, out: 'coway' },
  lge: { match: /www\.lge\.co\.kr/, out: 'lge' },
  cuckoo: { match: /www\.cuckoo\.co\.kr/, out: 'cuckoo' },
};
if (!HOSTS[HOST_KEY]) { console.error('host: ' + Object.keys(HOSTS).join(' | ')); process.exit(1); }
const limIdx = process.argv.indexOf('--limit');
const LIMIT = limIdx > 0 ? Number(process.argv[limIdx + 1]) : Infinity;
const OUT = `/private/tmp/claude-501/-Users-vinsenzo/88fff588-4fb8-4c65-8825-95625f74aae7/scratchpad/colors_${HOSTS[HOST_KEY].out}.json`;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';

// 색상으로 인정하는 한국어 키워드 — 괄호·재질 필드에 색상 아닌 값이 섞여 오므로 반드시 통과시킨다
const COLOR_RE = /(화이트|블랙|실버|그레이지|그레이|베이지|아이보리|네이비|블루|그린|레드|핑크|골드|브라운|크림|샴페인|스테인|올스텐|올스테인리스|칼라강판|민트|라벤더|퍼플|차콜|티타늄|로즈|코랄|세이지|그라파이트|미드나이트|스노우|메탈|옐로우|오렌지)/;
const BLOCK = /올레드|블랙홀|블루투스|블랙박스|블루레이|화이트닝|그린티|[:：]|프레임|헤드\(|패널/;
const cleanColor = (s) => {
  const v = String(s || '').replace(/\s+/g, ' ').trim();
  if (!v || v.length > 30 || BLOCK.test(v) || !COLOR_RE.test(v)) return null;
  return v;
};

const e = dotenv.parse(fs.readFileSync(process.env.DBENV || '.env.dev'));
const sb = createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY || e.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
const all = async (t, cols, f = (q) => q) => {
  let r = []; for (let i = 0; ; i += 1000) {
    const { data } = await f(sb.from(t).select(cols)).order('id').range(i, i + 999).throwOnError();
    r = r.concat(data); if (data.length < 1000) break;
  } return r;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const strip = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

const getText = async (url) => {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error(`http ${r.status}`);
  return r.text();
};
const norm = (c) => String(c || '').trim().toUpperCase().replace(/[\s_()]/g, '');

// ─── 호스트별 추출기 (async 가능 — 2단계 API 를 타는 호스트가 있다) ───
const EXTRACT = {
  // 상품명 끝 괄호: "히트 음식물처리기 4L (그레이화이트)"
  rentalnara(html) {
    const cands = [];
    const g = html.match(/(?:var|let)\s+gname\s*=\s*['"]([^'"]+)['"]/);
    if (g) cands.push(g[1]);
    const t = html.match(/<title[^>]*>([^<]+)</i);
    if (t) cands.push(t[1]);
    for (const name of cands) {
      const m = [...String(name).matchAll(/[(（]([^)）]{1,25})[)）]/g)].map((x) => x[1]);
      for (const inner of m.reverse()) { const c = cleanColor(inner); if (c) return { colors: [c], evidence: `상품명 "${name.slice(0, 60)}"` }; }
    }
    return null;
  },
  // 상품정보고시 스펙표: <strong>재질</strong> … <span>올스텐</span>
  // 값이 서술형으로 온다("메탈,올스텐 (내부는 스텐이 기본)") → 쉼표로 나누고 괄호·등급표기를 떼어 색상만 남긴다
  woosung(html) {
    const m = html.match(/재질[\s\S]{0,300}?<span[^>]*>([\s\S]{1,120}?)<\/span>/i);
    if (!m) return null;
    const raw = strip(m[1]);
    const parts = raw.replace(/[(（][^)）]*[)）]/g, ' ').split(/[,/]/)
      .map((x) => x.replace(/\b\d{3,4}\b/g, '').replace(/내부\s*스텐|기본/g, '').trim())
      .map((x) => cleanColor(x)).filter(Boolean);
    const colors = [...new Set(parts)];
    return colors.length ? { colors, evidence: `재질 = ${raw.slice(0, 50)}` } : null;
  },
  // blockquote.hero: "… / 512L / 올스테인리스"
  lassele(html) {
    const b = html.match(/<blockquote[^>]*class="[^"]*hero[^"]*"[\s\S]{0,800}?<\/blockquote>/i);
    if (!b) return null;
    const line = strip(b[0]);
    const toks = line.split('/').map((x) => x.trim()).reverse();
    for (const t of toks) { const c = cleanColor(t); if (c) return { colors: [c], evidence: `스펙요약 "${line.slice(0, 70)}"` }; }
    return null;
  },
  // 삼성 2단계: 상세 HTML 의 GoodsOptionVO 에서 goodsId 추출 → incGoodsCompare 로 색상 문자열
  //   goodsOptStr 행: seq|grpNo|itemNo|itemNo|옵션그룹명|색상명|hex|useColor|mdlCode|goodsId…
  async samsung(html, m) {
    const gids = [...new Set([...html.matchAll(/goodsId=([A-Z0-9]{6,})/g)].map((x) => x[1]))].slice(0, 3);
    if (!gids.length) return null;
    const want = norm(m.model_code);
    for (const gid of gids) {
      let j;
      try { j = JSON.parse(await getText(`https://www.samsung.com/sec/cxhr/goods/incGoodsCompare?goodsId=${gid}`)); }
      catch { continue; }
      const str = j?.pfGoods?.goodsOptStr;
      if (!str) continue;
      const rows = String(str).split(/[\n\r]+/).map((r) => r.split('|')).filter((f) => f.length > 8);
      const colorRows = rows.filter((f) => /색\s?상/.test(f[4] || ''));
      if (!colorRows.length) continue;
      const mine = colorRows.find((f) => norm(f[8]) === want);
      if (mine && cleanColor(mine[5])) return { colors: [cleanColor(mine[5])], evidence: `goodsOptStr mdlCode=${mine[8]} 색상=${mine[5]}` };
      const opts = [...new Set(colorRows.map((f) => cleanColor(f[5])).filter(Boolean))];
      if (opts.length) return { colors: opts, evidence: `goodsOptStr 색상옵션 ${opts.join('/')} (모델코드 직접 일치 없음)` };
    }
    return null;
  },
  // 코웨이 내부 API: /core/fproduct/package/detail/{prdno} → specList 중 spcnm=="색상"
  async coway(html, m) {
    const prdno = (m.specs.product_url.match(/prdno=(\d+)/) || [])[1];
    if (!prdno) return null;
    let j;
    try { j = JSON.parse(await getText(`https://www.coway.com/core/fproduct/package/detail/${prdno}`)); } catch { return null; }
    const lp = j?.obj?.compProductList?.[0]?.lpList || [];
    const out = [];
    for (const p of lp) for (const sp of (p.specList || [])) {
      if (/색\s?상/.test(sp.spcnm || '')) { const c = cleanColor(sp.spcdesc); if (c && !out.includes(c)) out.push(c); }
    }
    return out.length ? { colors: out, evidence: `specList spcnm=색상 → ${out.join('/')} (prdno=${prdno})` } : null;
  },
  // LG전자몰: 최초 HTML(SSR)에 JSON-LD 가 이스케이프된 채 들어있다 → 백슬래시를 평탄화한 뒤 매칭
  //   {"@type":"PropertyValue","name":"색상","value":"스테인리스 실버"}
  lge(html) {
    const flat = html.replace(/\\+"/g, '"');
    const ms = [...flat.matchAll(/"name"\s*:\s*"((?:도어\s*)?색\s?상)"\s*,\s*"value"\s*:\s*"([^"]{1,40})"/g)];
    for (const x of ms) { const c = cleanColor(x[2]); if (c) return { colors: [c], evidence: `JSON-LD ${x[1]} = ${x[2]}` }; }
    return null;
  },
  // 쿠쿠: 상품고시 표 <th>색상</th><td>화이트</td> (JSON 아님) — 이걸 먼저 본다
  cuckoo(html) {
    const tr = html.match(/<th[^>]*>\s*색\s?상\s*<\/th>\s*<td[^>]*>([\s\S]{1,80}?)<\/td>/i);
    if (tr) { const c = cleanColor(strip(tr[1])); if (c) return { colors: [c], evidence: `상품고시 표 색상 = ${strip(tr[1])}` }; }
    const flat = html.replace(/\\+"/g, '"');
    const ms = [...flat.matchAll(/"(?:title|itemName|name)"\s*:\s*"색\s?상"\s*,\s*"(?:value|contents|desc|itemValue|content)"\s*:\s*"([^"]{1,40})"/g)];
    for (const x of ms) { const c = cleanColor(x[1]); if (c) return { colors: [c], evidence: `상품고시 색상 = ${x[1]}` }; }
    const alt2 = flat.match(/색\s?상[^가-힣A-Za-z0-9]{0,14}([A-Z]{4,10}|화이트[가-힣]{0,6}|블랙[가-힣]{0,6}|실버[가-힣]{0,6}|그레이[가-힣]{0,6}|베이지[가-힣]{0,6})/);
    if (alt2) { const c = cleanColor(alt2[1]); if (c) return { colors: [c], evidence: `색상 표기 = ${alt2[1]}` }; }
    // 몰(mall) 페이지는 색상이 이미지 alt 설명에만 있다: alt="노블 다크 그레이 색상의 쿠쿠 음식물처리기 …"
    const alts = [...html.matchAll(/alt="([^"]{0,120}?)"/g)].map((x) => x[1]).filter((x) => /색\s?상/.test(x));
    const out = [];
    for (const a of alts) {
      for (const mm of a.matchAll(/((?:[가-힣]{2,6}\s){0,2}[가-힣]{2,8})\s*색\s?상/g)) {
        const c = cleanColor(mm[1]);
        if (c && !out.includes(c)) out.push(c);
      }
      // "A와 B 색상" 형태
      for (const mm of a.matchAll(/([가-힣]{2,12}(?:\s[가-힣]{2,8})?)\s*와\s+([가-힣]{2,12}(?:\s[가-힣]{2,8})?)\s*색\s?상/g)) {
        for (const g of [mm[1], mm[2]]) { const c = cleanColor(g); if (c && !out.includes(c)) out.push(c); }
      }
    }
    // "그레이와 노블 화이트" 처럼 접속사가 섞인 값 제거 + 다른 값의 부분문자열 제거(긴 값 유지)
    const clean = out.filter((c) => !/[와과]\s/.test(c));
    const final = clean.filter((c) => !clean.some((o) => o !== c && o.includes(c)));
    if (final.length) return { colors: final, evidence: `이미지 alt "${alts[0].slice(0, 60)}"` };
    return null;
  },
  // 가격 위 <p class="title">: "아쿠아 2도어 콤비 - 메탈 (304L)"
  haier(html) {
    const ms = [...html.matchAll(/<p[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]{1,160}?)<\/p>/gi)].map((x) => strip(x[1]));
    for (const t of ms) {
      const dash = t.split(/\s[-–]\s/);
      const tail = dash.length > 1 ? dash[dash.length - 1] : t;
      const c = cleanColor(tail.replace(/[(（][^)）]*[)）]/g, ''));
      if (c) return { colors: [c], evidence: `title "${t.slice(0, 60)}"` };
    }
    return null;
  },
};

const models = await all('rental_cat_models', 'id, supplier_id, model_code, product_name, specs, color_names');
const offers = await all('rental_cat_offers', 'model_id, color_name, status', (q) => q.eq('status', 'active'));
const selling = new Set(offers.map((o) => o.model_id));
const ticket = new Set(offers.filter((o) => o.color_name).map((o) => o.model_id));
const NOT_A_COLOR = /\d\s*bit|frc|hz|nit|색상수|dci|srgb|ntsc|%/i;
const hasSpec = (m) => { const r = (m.specs?.specifications?.color || '').trim(); return !!r && !NOT_A_COLOR.test(r); };

// --validate: 이미 색상을 아는 모델에 추출기를 돌려 값이 일치하는지 측정한다 (구조를 잘못 읽었는지 확인)
const VALIDATE = process.argv.includes('--validate');
const knownColor = (m) => {
  const t = [...offers].find(() => false);   // 자리표시 — 아래 map 사용
  return null;
};
const ticketColorMap = new Map(offers.filter((o) => o.color_name).map((o) => [o.model_id, o.color_name]));
const specOf = (m) => (m.specs?.specifications?.color || '').trim();
// --retry: 앞선 실행에서 fetch 가 깨진 건만 다시 시도한다 (일시 네트워크 오류 대응)
const RETRY = process.argv.includes('--retry');
let retryIds = null;
if (RETRY) {
  try { retryIds = new Set(JSON.parse(fs.readFileSync(OUT, 'utf8')).failed.map((f) => f.id)); }
  catch { console.error('이전 결과 파일이 없어 --retry 불가'); process.exit(1); }
  console.log(`재시도 대상 ${retryIds.size}`);
}
const target = VALIDATE
  ? models.filter((m) => selling.has(m.id) && HOSTS[HOST_KEY].match.test(m.specs?.product_url || '')
      && (ticketColorMap.has(m.id) || (specOf(m) && !NOT_A_COLOR.test(specOf(m))))).slice(0, LIMIT)
  : models.filter((m) => selling.has(m.id) && !ticket.has(m.id) && !hasSpec(m) && !(m.color_names || []).length
      && HOSTS[HOST_KEY].match.test(m.specs?.product_url || '')
      && (!retryIds || retryIds.has(m.id))).slice(0, LIMIT);

console.log(`${HOST_KEY} 대상 ${target.length} 모델`);
const found = []; const none = []; const failed = [];
for (let i = 0; i < target.length; i++) {
  const m = target[i];
  const url = m.specs.product_url;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(25000) });
    if (!r.ok) { failed.push({ id: m.id, url, why: `http ${r.status}` }); continue; }
    const html = await r.text();
    const got = await EXTRACT[HOST_KEY](html, m);
    if (got) {
      const rec = { id: m.id, model_code: m.model_code, product_name: m.product_name, url, ...got };
      if (VALIDATE) {
        rec.known = ticketColorMap.get(m.id) || specOf(m);
        const fam = (x) => String(x).replace(/\s/g, '').toLowerCase();
        const k = fam(rec.known); const g = got.colors.map(fam);
        rec.match = g.some((c) => k.includes(c) || c.includes(k)) ? '일치'
          : g.some((c) => [...c].some((ch) => k.includes(ch))) ? '부분' : '불일치';
      }
      found.push(rec);
    } else none.push({ id: m.id, url, model_code: m.model_code, known: VALIDATE ? (ticketColorMap.get(m.id) || specOf(m)) : undefined });
  } catch (err) { failed.push({ id: m.id, url, why: String(err.message || err).slice(0, 60) }); }
  if ((i + 1) % 25 === 0) process.stdout.write(`\r  ${i + 1}/${target.length} 확보 ${found.length}`);
  await sleep(600);
}
console.log(`\n확보 ${found.length} · 색상표기 없음 ${none.length} · 실패 ${failed.length}`);
const freq = {}; found.forEach((f) => f.colors.forEach((c) => { freq[c] = (freq[c] || 0) + 1; }));
console.log('색상 분포:', JSON.stringify(Object.fromEntries(Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 15))));
if (VALIDATE) {
  const c = (v) => found.filter((f) => f.match === v).length;
  console.log(`검증: 일치 ${c('일치')} · 부분 ${c('부분')} · 불일치 ${c('불일치')} · 추출실패(이미 아는데 못 뽑음) ${none.length}`);
  found.filter((f) => f.match !== '일치').slice(0, 8).forEach((f) => console.log(`  [${f.match}] ${f.model_code} 우리값="${f.known}" 추출="${f.colors.join('/')}"  ${f.evidence.slice(0, 60)}`));
}
let merged = { host: HOST_KEY, found, none, failed };
if (RETRY) {
  const prev = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  const doneIds = new Set([...found, ...none].map((x) => x.id));
  merged = { host: HOST_KEY,
    found: [...prev.found, ...found],
    none: [...prev.none, ...none],
    failed: [...prev.failed.filter((f) => !doneIds.has(f.id)), ...failed] };
  console.log(`병합 후 — 확보 ${merged.found.length} · 없음 ${merged.none.length} · 실패 ${merged.failed.length}`);
}
fs.writeFileSync(OUT, JSON.stringify(merged, null, 1));
console.log('저장:', OUT);
process.exit(0);
