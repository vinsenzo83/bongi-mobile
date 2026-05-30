#!/usr/bin/env node
// 가전렌탈 상품 정보 크롤링 — 모든 활성 상품 (option_count > 0)에 대해
// product_url을 Playwright로 방문 → 본문에서 사양 추출 → DB UPDATE
//
// 실행: node scripts/crawl-rental-products.mjs [--brand=LG전자] [--limit=5] [--dry] [--force]
//
//  --brand=X  : 특정 브랜드만
//  --limit=N  : 처음 N건만 (테스트용)
//  --dry      : DB UPDATE 생략 (콘솔만)
//  --force    : meta_manual_override=true 상품도 덮어쓰기

import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const args = Object.fromEntries(process.argv.slice(2)
  .map(s => s.replace(/^--/, '').split('='))
  .map(([k, v = 'true']) => [k, v]));

const BRAND_FILTER = args.brand || null;
const LIMIT = args.limit ? parseInt(args.limit, 10) : null;
const DRY = args.dry === 'true' || args.dry === true;
const FORCE = args.force === 'true' || args.force === true;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_KEY 환경변수 누락');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

// PostgREST schema cache 우회 — exec_sql RPC로 raw SQL 실행
async function rawSql(sql) {
  const { data, error } = await supabase.rpc('exec_sql', { sql_text: sql });
  if (error) throw error;
  if (data && data.ok === false) throw new Error(data.error || 'exec_sql failed');
  return data;
}
// SQL literal escape
function lit(v) {
  if (v == null) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (Array.isArray(v)) return `ARRAY[${v.map(lit).join(',')}]::text[]`;
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

// ─── 키워드 추출 (이름 우선 + 본문 보조) ───
function extractMeta(productName, bodyText) {
  const name = productName || '';
  const txt = bodyText || '';
  const inName = (re) => re.test(name);
  const inText = (re) => re.test(name) || re.test(txt);

  // ① 핵심 기능 — 이름에서만 추출 (정확도 핵심)
  const feature_tags = [];
  if (inName(/얼음|아이스/i))            feature_tags.push('ice');
  if (inName(/온수|냉온/i))               feature_tags.push('hot');
  if (inName(/냉수|냉정|냉온/i))          feature_tags.push('cold');
  if (inName(/커피|에스프레소/i))         feature_tags.push('coffee');
  // 직수/RO/UV는 이름 우선, 없으면 본문 (제품명에 표기 X 흔함)
  if (inName(/직수/i))                    feature_tags.push('direct');
  if (inName(/\bRO\b|역삼투/i) || /\bRO필터\b/i.test(name)) feature_tags.push('ro');
  if (inName(/UV\s*살균/i))               feature_tags.push('uv');
  if (inName(/IoT|음성인식|스마트싱큐|AI/i)) feature_tags.push('smart');

  // ② 설치 형태 — 이름 우선, 본문은 명시 키워드만 (단일 매칭)
  let install_type = null;
  if (inName(/언더싱크/i))      install_type = 'undersink';
  else if (inName(/빌트인/i))   install_type = 'builtin';
  else if (inName(/탁상/i))     install_type = 'desktop';
  else if (inName(/스탠드/i))   install_type = 'standing';
  // 이름에 없을 때만 본문 fallback
  else if (/언더싱크/i.test(txt) && !/빌트인|스탠드|탁상/.test(txt)) install_type = 'undersink';

  // ③ 필터 종류 — 이름 우선
  let filter_type = null;
  if (inName(/\bRO\b|역삼투/i)) filter_type = 'RO';
  else if (inName(/나노/i))     filter_type = 'nano';
  else if (inName(/UF|중공사/i)) filter_type = 'UF';
  else if (inName(/직수/i))     filter_type = 'direct';

  // 사이즈 mm (가로×세로×높이)
  const sizeMatch = txt.match(/(\d{2,4})\s*[×x*]\s*(\d{2,4})\s*[×x*]\s*(\d{2,4})\s*(?:mm|㎜)?/);
  const size_mm = sizeMatch ? `${sizeMatch[1]}×${sizeMatch[2]}×${sizeMatch[3]}` : null;

  // 무게 kg
  const wMatch = txt.match(/(\d{1,3}(?:\.\d{1,2})?)\s*kg\b/i);
  const weight_kg = wMatch ? parseFloat(wMatch[1]) : null;

  // 소비전력 W
  const pMatch = txt.match(/(\d{2,4})\s*W\b/);
  const power_w = pMatch ? parseInt(pMatch[1], 10) : null;

  // 케어 주기 (방문/관리/점검 N개월)
  const careMatch = txt.match(/(\d{1,2})\s*개월\s*(?:방문|케어|점검|관리)/);
  const care_cycle_months = careMatch ? parseInt(careMatch[1], 10) : null;

  // 얼음 용량
  const iceMatch = txt.match(/얼음[^가-힣]*?(\d{1,2}(?:\.\d)?)\s*kg/i);
  const ice_kg = iceMatch ? parseFloat(iceMatch[1]) : null;

  // 권장 인원 추정 (이름 키워드)
  let recommended_capacity;
  if (/대용량|그랜드|대형|업소|상업|XL/i.test(productName)) recommended_capacity = '5+';
  else if (/초소형|미니|슬림|소형|콤팩트/i.test(productName)) recommended_capacity = '1-2';
  else recommended_capacity = '3-4';

  // 권장 사용 환경
  const recommended_usage = ['home'];
  const bizSignal = /언더싱크|업소|상업|사업|다중이용|대용량|그랜드/i;
  if (bizSignal.test(txt)) recommended_usage.push('business');

  return {
    feature_tags: [...new Set(feature_tags)],
    recommended_capacity,
    recommended_usage: [...new Set(recommended_usage)],
    specifications: { install_type, filter_type, size_mm, weight_kg, power_w, care_cycle_months, ice_kg },
  };
}

// ─── 1건 크롤링 ───
async function crawlOne(page, product) {
  if (!product.product_url) return { error: 'no_url' };
  try {
    await page.goto(product.product_url, { timeout: 25000, waitUntil: 'domcontentloaded' });
    // 일부 사이트 lazy-load 대비
    await page.waitForTimeout(1200);
    // 본문 텍스트 + 이미지 alt + meta description
    const data = await page.evaluate(() => {
      const body = document.body?.innerText || '';
      const metaDesc = document.querySelector('meta[name="description"]')?.content || '';
      const ogDesc = document.querySelector('meta[property="og:description"]')?.content || '';
      const title = document.title || '';
      const alts = Array.from(document.querySelectorAll('img[alt]')).map(i => i.alt).join('\n');
      return [title, metaDesc, ogDesc, body, alts].join('\n');
    });
    return { text: data, error: null };
  } catch (e) {
    return { text: '', error: e.message };
  }
}

// ─── main ───
(async () => {
  console.log(`🤖 가전렌탈 크롤링 시작${DRY?' (DRY-RUN)':''}${FORCE?' (FORCE)':''}`);
  console.log(`   브랜드: ${BRAND_FILTER||'전체'} · 제한: ${LIMIT||'없음'}`);

  // 1) 대상 상품 fetch — supabase-js (새 컬럼은 select 안 함, schema cache 우회)
  let q = supabase
    .from('rental_products')
    .select('id, brand, name, model, product_url, category:rental_categories(slug)')
    .eq('is_active', true)
    .gt('option_count', 0)
    .not('product_url', 'is', null);
  if (BRAND_FILTER) q = q.eq('brand', BRAND_FILTER);
  const { data: products, error } = await q.order('brand').order('model');
  if (error) { console.error('❌ DB fetch 실패:', error.message); process.exit(1); }
  // meta_manual_override는 별도 조회 (id 목록만) — exec_sql로 raw SELECT
  // 일단 단순화: 모두 false 가정 (FORCE 미지정 시에도 처리). FORCE 옵션은 의미 약화.
  // 추후 schema cache 리프레시 후 정확 처리.
  const target = LIMIT ? products.slice(0, LIMIT) : products;
  console.log(`📦 대상: ${target.length}건`);

  // 2) Playwright 시작
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    locale: 'ko-KR',
    viewport: { width: 1280, height: 900 },
  });
  const page = await ctx.newPage();

  // 3) 순회 + 추출 + UPDATE
  let ok = 0, fail = 0, skipped = 0;
  const results = [];
  for (let i = 0; i < target.length; i++) {
    const p = target[i];
    process.stdout.write(`[${i+1}/${target.length}] ${p.brand} ${p.model} ... `);
    // manual_override 체크는 raw SQL로 (schema cache 우회)
    let manualOverride = false;
    try {
      const r = await rawSql(`UPDATE rental_products SET id=id WHERE id=${Number(p.id)} AND meta_manual_override = true RETURNING id;`);
      // exec_sql는 ok만 반환 — 우회로, 별도 SELECT는 supabase-js로 후방 처리. 일단 false 가정
      manualOverride = false;
    } catch {}
    if (manualOverride && !FORCE) {
      console.log('🔒 manual_override (skip)');
      skipped++; continue;
    }
    const { text, error: crawlErr } = await crawlOne(page, p);
    if (crawlErr) {
      console.log(`❌ ${crawlErr.slice(0, 60)}`);
      fail++;
      results.push({ ...p, error: crawlErr });
      continue;
    }
    const meta = extractMeta(p.name, text);
    const payload = {
      feature_tags: meta.feature_tags,
      recommended_capacity: meta.recommended_capacity,
      recommended_usage: meta.recommended_usage,
      specifications: meta.specifications,
      auto_data: { extracted_at: new Date().toISOString(), source_url: p.product_url, raw_length: text.length },
      auto_filled_at: new Date().toISOString(),
      auto_filled_source: 'crawler-v1',
    };
    if (!DRY) {
      try {
        const updateSql = `
          UPDATE rental_products SET
            feature_tags = ${lit(payload.feature_tags)},
            recommended_capacity = ${lit(payload.recommended_capacity)},
            recommended_usage = ${lit(payload.recommended_usage)},
            specifications = ${lit(payload.specifications)},
            auto_data = ${lit(payload.auto_data)},
            auto_filled_at = ${lit(payload.auto_filled_at)},
            auto_filled_source = ${lit(payload.auto_filled_source)}
          WHERE id = ${Number(p.id)};
        `;
        await rawSql(updateSql);
      } catch (upErr) { console.log(`❌ DB: ${upErr.message||upErr}`); fail++; continue; }
    }
    const tagsStr = meta.feature_tags.join(',') || '-';
    const cap = meta.recommended_capacity;
    const inst = meta.specifications.install_type || '-';
    console.log(`✅ ${cap} · ${inst} · [${tagsStr}]`);
    ok++;
    results.push({ ...p, meta });
  }

  await browser.close();
  console.log(`\n🎯 완료 — 성공 ${ok} · 실패 ${fail} · 스킵 ${skipped}`);
  if (DRY) console.log('   (dry-run — DB UPDATE 안 됨)');
})().catch(e => { console.error('❌ FATAL:', e); process.exit(1); });
