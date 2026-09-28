import fs from 'fs'; import dotenv from 'dotenv'; import { createClient } from '@supabase/supabase-js';
const e = dotenv.parse(fs.readFileSync(process.argv[2] || '.env')); const sb = createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY || e.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
let rows = []; for (let i = 0; ; i += 1000) { const { data } = await sb.from('rental_cat_models').select('id, supplier_id, image_url, status').order('id').range(i, i + 999).throwOnError(); rows = rows.concat(data); if (data.length < 1000) break; }
const withImg = rows.filter((r) => r.image_url);
const host = (u) => { try { return new URL(u).host; } catch { return '잘못된 주소'; } };
const g = withImg.reduce((a, r) => { const h = host(r.image_url); a[h] = (a[h] || 0) + 1; return a; }, {});
console.log(new URL(e.SUPABASE_URL).host.split('.')[0], '모델', rows.length, '이미지 있음', withImg.length);
console.log('주소별', JSON.stringify(g, null, 1));
const paths = withImg.filter((r) => r.image_url.includes('/product-images/')).map((r) => r.image_url.split('/product-images/')[1]);
const folder = paths.reduce((a, p) => { const k = p.split('/').slice(0, 2).join('/'); a[k] = (a[k] || 0) + 1; return a; }, {});
console.log('버킷 폴더별', JSON.stringify(folder, null, 1));
// 실제로 열리는지 표본 확인
const sample = withImg.filter((_, i) => i % Math.ceil(withImg.length / 12) === 0).slice(0, 12);
for (const s of sample) { const r = await fetch(s.image_url, { method: 'HEAD' }).catch(() => null); console.log(r?.status || 'fail', (r?.headers.get('content-length') || '?') + 'B', s.supplier_id, s.image_url.slice(0, 95)); }
process.exit(0);
