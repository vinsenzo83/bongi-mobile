// 빌리고 "렌탈사 가입기준 및 정책" 엑셀 → rental_cat_suppliers.signup_policy
//   node scripts/rental-catalog-load-policies.mjs --env .env.dev --water <정수기 정책 xlsx> --appliance <가전 정책 xlsx>
// 같은 렌탈사가 정수기·가전 파일에 따로 있고 내용이 다를 수 있어 { water, appliance } 로 나눠 저장한다.
import fs from 'fs'; import dotenv from 'dotenv'; import { createClient } from '@supabase/supabase-js';
import { parseSupplierPolicyWorkbook } from '../server/services/rental-import/supplier-policy.js';

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const env = dotenv.parse(fs.readFileSync(arg('--env')));
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// 정책 시트 렌탈사명 → 카탈로그 렌탈사 id (상품이 없는 상조·CCTV 등은 제외)
const MAP = {
  water: { '코웨이': 'coway', 'SK매직': 'skmagic', '쿠쿠': 'cuckoo', '현대큐밍': 'cuming', 'LG전자구독': 'lg-subscribe', '청호나이스': 'chungho', '교원웰스': 'wells', '현대유버스': 'ubus', '루헨스': 'luhens' },
  appliance: { 'LG헬로비전': 'lg-hello', 'LG구독': 'lg-subscribe', '스마트': 'smart', 'BS': 'bs', '유버스': 'ubus', '캐리어': 'carrier', '이니렌탈': 'ini', 'KT렌탈': 'kt', '렌플': 'renple', '세스코': 'cesco', '렌타나': 'rentana' },
};

const merged = {};
for (const kind of ['water', 'appliance']) {
  const file = arg('--' + kind);
  if (!file) continue;
    const ym = file.match(/_(\d{2})(\d{2})\.xlsx$/);  // "…정책_2609.xlsx" → 2026-09 (시트명에 기준월이 없을 때 기본값)
  const { policies } = parseSupplierPolicyWorkbook(fs.readFileSync(file), { fileMonth: ym ? `20${ym[1]}-${ym[2]}` : null });
  for (const p of policies) {
    const id = MAP[kind][p.supplier];
    if (!id) { console.log(`- 카탈로그 상품 없음(건너뜀): ${kind} ${p.supplier}`); continue; }
    (merged[id] ||= {})[kind] = p;
  }
}
const { data: suppliers } = await sb.from('rental_cat_suppliers').select('id, file_kind').throwOnError();
for (const s of suppliers) {
  const pol = merged[s.id];
  if (!pol) { console.log(`! 정책 없음: ${s.id}`); continue; }
  const asOf = [pol.water?.as_of, pol.appliance?.as_of].filter(Boolean).sort()[0];
  await sb.from('rental_cat_suppliers').update({ signup_policy: pol, signup_policy_as_of: asOf, updated_at: new Date().toISOString() }).eq('id', s.id).throwOnError();
  console.log(`✓ ${s.id} ${Object.keys(pol).join('+')} 기준 ${asOf}`);
}
process.exit(0);
