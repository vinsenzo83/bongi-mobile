// 삼성 B2B 가격가이드 → device_model_catalog 적재
// 사용: node scripts/import-samsung-catalog.mjs        (기본: .env = 라이브)
//       SUPABASE_URL=.. SUPABASE_SERVICE_KEY=.. node scripts/import-samsung-catalog.mjs  (다른 환경)
import 'dotenv/config';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) { console.error('SUPABASE_URL/SERVICE_KEY 필요'); process.exit(1); }
const sb = createClient(url, key);

const rows = JSON.parse(fs.readFileSync('server/data/samsung-catalog.json', 'utf8'));
console.log(`적재 대상: ${rows.length}개 → ${url.slice(0,40)}...`);

let ok = 0, fail = 0;
for (let i = 0; i < rows.length; i += 200) {
  const batch = rows.slice(i, i + 200).map(r => ({
    code_key: r.code_key, product_name: r.product_name,
    color: r.color || null, capacity: r.capacity || null,
    supply_price: r.supply_price || null, sheet: r.sheet || null,
  }));
  const { error } = await sb.from('device_model_catalog').upsert(batch, { onConflict: 'code_key' });
  if (error) { console.error(`배치 ${i} 실패:`, error.message); fail += batch.length; }
  else { ok += batch.length; process.stdout.write(`  ${ok}/${rows.length}\r`); }
}
console.log(`\n완료: 성공 ${ok} / 실패 ${fail}`);
const { count } = await sb.from('device_model_catalog').select('*', { count: 'exact', head: true });
console.log(`DB 총 카탈로그: ${count}개`);
