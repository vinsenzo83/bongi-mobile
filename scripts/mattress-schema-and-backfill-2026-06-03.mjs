// 매트리스 전용 컬럼 schema + 누락 7모델/18옵션 INSERT + 기존 79모델 backfill
// 엑셀 컬럼 → DB 매핑:
//   색상/규격 → specifications.size
//   경도     → specifications.firmness
//   대분류   → specifications.sub_category (매트리스/모션베드/힐링베드)
//   프로모션 → specifications.promotion
//   상품군No → metadata.product_group_no
//   노출순위 → display_rank
//   시장성   → market_score (별점 수)
//   URL     → product_url
import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const EXCEL = '/tmp/매트리스_정규화_v2.xlsx';
const CATEGORY_ID = 10;
const COMPANY_ID = 1;

// 1) 매트리스 카테고리 extra_fields schema 정의
const SCHEMA = {
  extra_fields: [
    { key: 'sub_category', label: '소분류', type: 'select', options: ['매트리스', '모션베드', '힐링베드'] },
    { key: 'size',         label: '규격', type: 'select', options: ['S', 'SS', 'Q', 'K', 'LK', '기타'] },
    { key: 'firmness',     label: '경도', type: 'select', options: ['소프트', '미디엄', '하드', '미디엄소프트', '미디엄하드', '기타'] },
    { key: 'promotion',    label: '프로모션', type: 'text', placeholder: '결합5%/동시10%·타사보상' },
  ],
};

const starsToScore = (s) => s ? String(s).split('').filter(c => c === '★').length : null;

async function main() {
  // ────────────────────────────────────────────────────
  // A. 카테고리 schema 갱신
  // ────────────────────────────────────────────────────
  const { error: catErr } = await sb.from('rental_categories')
    .update({ metadata: SCHEMA })
    .eq('id', CATEGORY_ID);
  if (catErr) throw catErr;
  console.log('✅ A. 매트리스 카테고리 schema 갱신');

  // ────────────────────────────────────────────────────
  // B. 엑셀 파싱 → 모델·옵션 단위 매핑
  // ────────────────────────────────────────────────────
  const wb = XLSX.readFile(EXCEL);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['등록확정_상세'], { defval: null });
  console.log(`📥 엑셀 row=${rows.length}`);

  // 모델별 그룹화
  const byModel = new Map();
  for (const r of rows) {
    const model = (r['모델명'] || '').toString().trim();
    if (!model) continue;
    if (!byModel.has(model)) {
      byModel.set(model, {
        model,
        brand: r['브랜드'] || '코웨이',
        name: r['상품명'] || model,
        sub_category: r['대분류'] || '매트리스',
        size: r['색상/규격'] || null,
        firmness: r['경도'] || null,
        promotion: r['프로모션'] || null,
        product_url: r['URL'] || null,
        display_rank: Number(r['노출순위']) || null,
        market_score: starsToScore(r['시장성']),
        product_group_no: r['상품군No'] || null,
        options: [],
      });
    }
    byModel.get(model).options.push({
      months: Number(r['약정기간']) || 60,
      care_service: r['케어서비스'] || '서비스프리',
      monthly_fee: Number(r['월납부액']) || 0,
      rebate: Number(r['리베이트']) || 0,
      promo_type: r['프로모션'] || null,
    });
  }
  console.log(`📊 unique models=${byModel.size}`);

  // ────────────────────────────────────────────────────
  // C. 기존 DB 모델 list
  // ────────────────────────────────────────────────────
  const { data: existing, error: exErr } = await sb.from('rental_products')
    .select('id, model').eq('category_id', CATEGORY_ID);
  if (exErr) throw exErr;
  const dbModelMap = new Map(existing.map(p => [p.model, p.id]));
  console.log(`🗄️  DB existing models=${dbModelMap.size}`);

  // ────────────────────────────────────────────────────
  // D. 모든 모델 UPSERT (specifications 포함)
  // ────────────────────────────────────────────────────
  let inserted = 0, updated = 0, optInserted = 0;
  for (const [model, m] of byModel) {
    const productPayload = {
      category_id: CATEGORY_ID,
      company_id: COMPANY_ID,
      brand: m.brand,
      name: m.name,
      model: m.model,
      product_url: m.product_url,
      display_rank: m.display_rank,
      market_score: m.market_score,
      is_active: true,
      specifications: {
        sub_category: m.sub_category,
        size: m.size,
        firmness: m.firmness,
        promotion: m.promotion,
      },
      metadata: { product_group_no: m.product_group_no },
    };

    let productId = dbModelMap.get(model);
    if (productId) {
      // backfill — specifications + 누락 필드만 갱신 (인센티브값 보존)
      const { error } = await sb.from('rental_products')
        .update({
          specifications: productPayload.specifications,
          metadata: productPayload.metadata,
          product_url: productPayload.product_url,
          display_rank: productPayload.display_rank,
          market_score: productPayload.market_score,
        }).eq('id', productId);
      if (error) { console.error(`❌ update ${model}:`, error.message); continue; }
      updated++;
    } else {
      // 신규 모델 INSERT
      const { data, error } = await sb.from('rental_products')
        .insert(productPayload).select('id').single();
      if (error) { console.error(`❌ insert ${model}:`, error.message); continue; }
      productId = data.id;
      inserted++;

      // 옵션 INSERT — trigger로 ticket_number 자동
      const optPayload = m.options.map(o => ({
        product_id: productId,
        months: o.months,
        care_service: o.care_service,
        monthly_fee: o.monthly_fee,
        rebate: o.rebate,
        promo_type: o.promo_type,
        is_active: true,
      }));
      const { error: oErr } = await sb.from('rental_product_options').insert(optPayload);
      if (oErr) { console.error(`❌ options ${model}:`, oErr.message); continue; }
      optInserted += optPayload.length;
    }
  }

  console.log(`\n📦 신규 product=${inserted}, backfill product=${updated}`);
  console.log(`🎫 신규 옵션=${optInserted} (R번호 trigger 자동 발급)`);

  // ────────────────────────────────────────────────────
  // E. 최종 검증
  // ────────────────────────────────────────────────────
  const { data: final } = await sb.from('rental_products')
    .select('id, rental_product_options(id)')
    .eq('category_id', CATEGORY_ID);
  const totalProducts = final.length;
  const totalOptions = final.reduce((s, p) => s + p.rental_product_options.length, 0);
  console.log(`\n🏁 최종: 매트리스 ${totalProducts} 모델 / ${totalOptions} 옵션`);
}

main().catch(e => { console.error(e); process.exit(1); });
