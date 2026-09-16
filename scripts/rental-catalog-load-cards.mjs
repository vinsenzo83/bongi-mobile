// 렌탈 제휴카드 적재 — 카드사 공식 페이지로 재확인한 JSON(또는 옛 백업)을 rental_cat_cards 에 upsert
//   node scripts/rental-catalog-load-cards.mjs --env .env.dev --file <card_discounts.json | rental_partner_cards.json> [--commit]
//   · (supplier_id, card_issuer, card_name) 기준 upsert. 파일에 없는 기존 카드는 지우지 않는다(비활성화는 관리자 화면에서)
//   · verify_status 가 not_found·url_dead 인 카드는 is_active=false 로 넣는다 — 상담원이 없어진 카드를 안내하지 않게
import fs from 'fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const envFile = arg('--env'); const file = arg('--file');
if (!envFile || !file) { console.error('--env <env> --file <json> 필수'); process.exit(1); }
const env = dotenv.parse(fs.readFileSync(envFile));
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
console.log('대상 DB:', new URL(env.SUPABASE_URL).host.split('.')[0]);

// 옛 시스템 브랜드명 → rental_cat_suppliers.id
const SUPPLIER = {
  'LG전자구독': 'lg-subscribe', 'LG전자': 'lg-subscribe', '코웨이': 'coway', '청호나이스': 'chungho', '청호': 'chungho', '쿠쿠': 'cuckoo',
  '교원웰스': 'wells', '웰스': 'wells', 'LG헬로비전': 'lg-hello', 'SK매직': 'skmagic', '현대큐밍': 'cuming', '큐밍': 'cuming',
  '삼성전자(BS ON)': 'bs', 'BS ON': 'bs', 'BS': 'bs', '현대유버스': 'ubus', '유버스': 'ubus', '루헨스': 'luhens',
  '세스코': 'cesco', 'KT가전구독': 'kt', '스마트렌탈': 'smart', '스마트': 'smart', '이니렌탈': 'ini', '렌타나': 'rentana', '캐리어': 'carrier', '렌플': 'renple',
};
const num = (v) => (v == null || v === '' ? null : Number(String(v).replace(/[^\d.-]/g, '')) || null);

const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
const list = Array.isArray(raw) ? raw : raw.cards || raw.rows || [];
const rows = []; const skipped = [];
for (const c of list) {
  const brand = c.supplier_name || c.brand || c.supplier;
  const supplier_id = SUPPLIER[String(brand || '').trim()];
  if (!supplier_id || !c.card_name) { skipped.push(`${brand} / ${c.card_name}`); continue; }
  const tiers = [1, 2, 3].map((n) => ({
    min_spend: num(c[`tier${n}_min`]), base: num(c[`tier${n}_base`]), promo: num(c[`tier${n}_promo`]),
    total: num(c[`tier${n}_total`]) ?? ((num(c[`tier${n}_base`]) || 0) + (num(c[`tier${n}_promo`]) || 0) || null),
  })).filter((t) => t.min_spend != null || t.total != null);
  const status = c.verify_status || 'unverified';
  rows.push({
    supplier_id, card_issuer: c.card_issuer || c.issuer || '', card_name: String(c.card_name).trim(),
    annual_fee: c.annual_fee == null ? null : String(c.annual_fee), tiers,
    max_discount: num(c.max_discount) ?? (Math.max(0, ...tiers.map((t) => t.total || 0)) || null),
    discount_months: num(c.discount_months), has_promo: !!c.has_promo || tiers.some((t) => t.promo),
    categories: Array.isArray(c.categories) ? c.categories : [], notes: [c.notes, c.change_note].filter(Boolean).join(' / ') || null,
    card_url: c.verified_url || c.card_url || null, verify_status: status, verified_at: c.verified_at || null,
    is_active: !['not_found', 'url_dead'].includes(status) && c.is_active !== false,
    display_rank: num(c.display_rank), updated_at: new Date().toISOString(),
  });
}
const bySup = rows.reduce((m, r) => ((m[r.supplier_id] = (m[r.supplier_id] || 0) + 1), m), {});
const byStatus = rows.reduce((m, r) => ((m[r.verify_status] = (m[r.verify_status] || 0) + 1), m), {});
console.log(`카드 ${rows.length} · 제외 ${skipped.length}`, bySup, byStatus);
if (skipped.length) console.log('제외:', skipped.join(', '));
if (!process.argv.includes('--commit')) process.exit(0);
await sb.from('rental_cat_cards').upsert(rows, { onConflict: 'supplier_id,card_issuer,card_name' }).throwOnError();
console.log('반영', rows.length);
