// 상품명이 모델코드뿐인 모델을 "브랜드 + 품목(또는 제품정보명)"으로 채운다. 기본은 미리보기, --commit 이면 반영.
//   node scripts/rental-catalog-fix-names.mjs --env .env.dev [--commit]
import fs from 'fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { isCodeName, composeProductName, tidyName } from '../server/services/rental-import/core.js';

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const envFile = arg('--env');
if (!envFile) { console.error('--env 필수 (라이브 오적용 방지)'); process.exit(1); }
const env = dotenv.parse(fs.readFileSync(envFile));
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
console.log('대상 DB:', new URL(env.SUPABASE_URL).host.split('.')[0]);

const all = [];
for (let from = 0; ; from += 1000) {
  const { data } = await supabase.from('rental_cat_models').select('id, supplier_id, model_key, model_code, product_name, brand, category_raw, specs').order('id').range(from, from + 999).throwOnError();
  all.push(...data);
  if (data.length < 1000) break;
}
const fixes = all.filter((m) => isCodeName(m.product_name, m.model_code, m.model_key) || tidyName(m.product_name) !== m.product_name)
  .map((m) => ({ id: m.id, supplier_id: m.supplier_id, before: m.product_name, after: composeProductName({ ...m, spec_name: m.specs?.name }) }))
  .filter((f) => f.after && f.after !== f.before);
const bySup = fixes.reduce((a, f) => ((a[f.supplier_id] = (a[f.supplier_id] || 0) + 1), a), {});
console.log(`모델 ${all.length} · 이름 보정 ${fixes.length}`, bySup);
for (const f of [...fixes.filter((x) => !['lg-subscribe'].includes(x.supplier_id)).slice(0, 8), ...fixes.filter((x) => ['bs', 'ubus'].includes(x.supplier_id))]) console.log(' ', f.before, '→', f.after);
if (!process.argv.includes('--commit')) process.exit(0);
let done = 0;
for (const f of fixes) {
  await supabase.from('rental_cat_models').update({ product_name: f.after, updated_at: new Date().toISOString() }).eq('id', f.id).throwOnError();
  done++;
}
console.log('반영', done);
