// 호스트별로 '색상을 공개하는가'를 표본으로 확인 (읽기 전용 · 공식 페이지 조회만)
//   node scripts/_tmp/color-source-probe.mjs [호스트당표본수]
import fs from 'fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const N = Number(process.argv[2] || 4);
const e = dotenv.parse(fs.readFileSync('.env'));
const sb = createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY || e.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';

const all = async (t, cols, f = (q) => q) => {
  let rows = []; for (let i = 0; ; i += 1000) {
    const { data } = await f(sb.from(t).select(cols)).order('id').range(i, i + 999).throwOnError();
    rows = rows.concat(data); if (data.length < 1000) break;
  } return rows;
};
const models = await all('rental_cat_models', 'id, supplier_id, model_code, product_name, specs');
const offers = await all('rental_cat_offers', 'model_id, color_name, status', (q) => q.eq('status', 'active'));
const selling = new Set(offers.map((o) => o.model_id));
const withTicketColor = new Set(offers.filter((o) => o.color_name).map((o) => o.model_id));

const target = models.filter((m) => selling.has(m.id) && !withTicketColor.has(m.id)
  && !(m.specs?.specifications?.color || '').trim() && m.specs?.product_url);

const byHost = {};
for (const m of target) {
  let h; try { h = new URL(m.specs.product_url).host; } catch { continue; }
  (byHost[h] ||= []).push(m);
}

// 색상 표기 패턴 — '컬러 블랙' · '색상 : 화이트' · '색상 화이트' 처럼 값이 따라오는 경우만 인정
const COLOR_WORDS = '화이트|블랙|실버|그레이|베이지|아이보리|네이비|블루|그린|핑크|골드|브라운|크림|샴페인|스테인리스|민트|차콜|티타늄|로즈|세이지';
const LABELLED = new RegExp(`(색\\s?상|컬러|color)\\s*[:：]?\\s*((?:${COLOR_WORDS})[가-힣A-Za-z]{0,10})`, 'i');
const DISCLAIMER = /색상\s*(및|과)?\s*스펙|색상이?\s*다를|연출된\s*이미지/;

const text = (html) => {
  let t = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  t = t.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/gi, ' ');
  return t.replace(/\s+/g, ' ');
};

const hosts = Object.entries(byHost).sort((a, b) => b[1].length - a[1].length).slice(0, 12);
console.log(`색상 없는 판매중 모델 ${target.length} · 호스트 ${Object.keys(byHost).length}\n`);
for (const [host, list] of hosts) {
  const picks = list.slice(0, N);
  const res = [];
  for (const m of picks) {
    try {
      const r = await fetch(m.specs.product_url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(25000) });
      const body = text(await r.text());
      const hit = LABELLED.exec(body);
      res.push({ ok: r.status, color: hit ? hit[2] : null, disclaimerOnly: !hit && DISCLAIMER.test(body) });
    } catch (err) { res.push({ ok: 'ERR', err: String(err.message || err).slice(0, 40) }); }
  }
  const found = res.filter((x) => x.color);
  const verdict = found.length ? `✅ 공개 (${found.length}/${picks.length})` : res.every((x) => x.ok === 'ERR') ? '⚠ 접근 실패' : '❌ 색상 표기 없음';
  console.log(`${host}  대상 ${list.length}  → ${verdict}`);
  res.forEach((x, i) => console.log(`   [${x.ok}] ${x.color ? '색상=' + x.color : x.disclaimerOnly ? '(면책문구만)' : x.err ? x.err : '(없음)'}  ${picks[i].specs.product_url.slice(0, 80)}`));
}
process.exit(0);
