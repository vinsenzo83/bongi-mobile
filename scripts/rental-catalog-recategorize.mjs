// 카테고리 규칙(core.categorize)이 바뀌면 기존 모델에 다시 적용: node scripts/rental-catalog-recategorize.mjs --env .env.dev
import fs from 'fs'; import dotenv from 'dotenv'; import { createClient } from '@supabase/supabase-js';
import { categorize } from '../server/services/rental-import/core.js';
const i = process.argv.indexOf('--env');
const env = dotenv.parse(fs.readFileSync(process.argv[i + 1]));
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const models = [];
for (let from = 0; ; from += 1000) {
  const { data } = await sb.from('rental_cat_models').select('id, category, category_raw, product_name').order('id').range(from, from + 999).throwOnError();
  models.push(...data); if (data.length < 1000) break;
}
const groups = new Map();
for (const m of models) {
  const c = categorize(m.category_raw, m.product_name);
  if (c !== m.category) (groups.get(c) || groups.set(c, []).get(c)).push(m.id);
}
for (const [c, ids] of groups) for (let k = 0; k < ids.length; k += 300) await sb.from('rental_cat_models').update({ category: c }).in('id', ids.slice(k, k + 300)).throwOnError();
console.log('변경', [...groups].map(([c, ids]) => `${c}:${ids.length}`).join(' '));
process.exit(0);
