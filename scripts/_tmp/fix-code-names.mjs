// 상품명이 모델코드 그대로인 모델 → 공식 수집 specs.name 으로 (사람이 고친 specs.source=manual 은 제외)
import fs from 'fs'; import dotenv from 'dotenv'; import { createClient } from '@supabase/supabase-js';
const envf = process.argv[2]; const commit = process.argv.includes('--commit');
const e = dotenv.parse(fs.readFileSync(envf)); const sb = createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY || e.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
let rows = []; for (let i = 0; ; i += 1000) { const { data } = await sb.from('rental_cat_models').select('id, supplier_id, product_name, model_code, specs').order('id').range(i, i + 999).throwOnError(); rows = rows.concat(data); if (data.length < 1000) break; }
const targets = rows.filter((m) => m.product_name && m.model_code && m.product_name.trim() === m.model_code.trim() && m.specs?.name && m.specs.source !== 'manual' && m.specs.name.trim() !== m.model_code.trim());
console.log(new URL(e.SUPABASE_URL).host.split('.')[0], '대상', targets.length, '남는 코드명', rows.filter((m) => m.product_name && m.model_code && m.product_name.trim() === m.model_code.trim()).length - targets.length);
console.log(JSON.stringify(targets.slice(0, 5).map((m) => [m.model_code, m.specs.name])));
if (commit) { for (const m of targets) await sb.from('rental_cat_models').update({ product_name: m.specs.name.trim().slice(0, 200), updated_at: new Date().toISOString() }).eq('id', m.id).throwOnError(); console.log('반영', targets.length); }
process.exit(0);
