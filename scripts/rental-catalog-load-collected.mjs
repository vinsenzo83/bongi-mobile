// 공식 사이트에서 수집한 제품 이미지·정보(product_info/<supplier>.jsonl) → 이미지 업로드(라이브 스토리지) + rental_cat_models.image_url/specs
//   node scripts/rental-catalog-load-collected.mjs --dir <product_info 폴더> --suppliers lg-subscribe,lg-hello --env .env.dev [--storage-env .env] [--commit]
//   · 이미지는 --storage-env(기본 .env = 라이브) 의 product-images 버킷 rental-catalog/<supplier>/ 에 올리고 그 공개 URL 을 쓴다 (데브·라이브가 같은 URL)
//   · image_url 은 비어 있을 때만 채운다. specs 는 사람이 고친 것(source='manual')은 건드리지 않고, 기존 값 위에 공식 수집 값을 덮는다
//   · --no-upload: 이미 올린 이미지(같은 경로)의 URL 만 쓴다 — 데브 적재로 올린 뒤 라이브 적재할 때
//   · 페이지 공통 소개문("…소개합니다", "…확인해보세요")은 상품 설명으로 쓰지 않는다
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const dir = arg('--dir'); const envFile = arg('--env'); const storageEnvFile = arg('--storage-env', '.env');
const suppliers = (arg('--suppliers') || '').split(',').filter(Boolean);
if (!dir || !envFile || !suppliers.length) { console.error('--dir --env --suppliers 필수'); process.exit(1); }
const mk = (f) => { const e = dotenv.parse(fs.readFileSync(f)); return { host: new URL(e.SUPABASE_URL).host.split('.')[0], url: e.SUPABASE_URL, sb: createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY || e.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } }) }; };
const db = mk(envFile); const st = mk(storageEnvFile);
const commit = process.argv.includes('--commit');
console.log(`DB ${db.host} · 이미지 저장소 ${st.host}${commit ? '' : ' (미리보기)'}`);
const BUCKET = 'product-images';
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };
const GENERIC = /소개합니다|확인해\s*보세요|다양한 혜택|추천 상품부터/;

async function retry(fn) { for (let k = 1; ; k++) { try { return await fn(); } catch (e) { if (k >= 3) throw e; await new Promise((r) => setTimeout(r, 1500 * k)); } } }
async function inParallel(list, fn, size = 8) {
  for (let i = 0; i < list.length; i += size) {
    await Promise.all(list.slice(i, i + size).map((x) => retry(() => fn(x))));
    if ((i / size) % 25 === 0) console.log(`  ${Math.min(i + size, list.length)}/${list.length}`);
  }
}

for (const sup of suppliers) {
  const file = path.join(dir, `${sup}.jsonl`);
  if (!fs.existsSync(file)) { console.log(sup, '파일 없음'); continue; }
  const rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    .filter((r) => r.model_id && r.match && r.match !== 'not_found');
  // 같은 모델이 여러 줄이면 마지막 것
  const byModel = new Map(rows.map((r) => [r.model_id, r]));
  const ids = [...byModel.keys()];
  const existing = new Map();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await db.sb.from('rental_cat_models').select('id, image_url, specs').in('id', ids.slice(i, i + 200)).throwOnError();
    for (const m of data) existing.set(m.id, m);
  }
  const plan = [];
  for (const [id, r] of byModel) {
    const ex = existing.get(id);
    if (!ex) continue;                                   // 이 DB 에 없는 모델
    if (ex.specs?.source === 'manual') continue;          // 사람이 고친 것
    const sp = { ...(r.specs || {}) };
    if (sp.description && GENERIC.test(sp.description)) delete sp.description;
    for (const k of Object.keys(sp)) if (sp[k] == null || sp[k] === '' || (Array.isArray(sp[k]) && !sp[k].length)) delete sp[k];
    if (sp.specifications) sp.specifications = Object.fromEntries(Object.entries(sp.specifications).filter(([, v]) => v != null && v !== ''));
    const specs = { ...(ex.specs || {}), ...sp, source: 'official-crawl-20260917', product_url: r.product_url || sp.product_url || ex.specs?.product_url };
    const imgPath = r.image_file ? path.join(path.dirname(dir), r.image_file) : null;
    plan.push({ id, specs, needImage: !ex.image_url && imgPath && fs.existsSync(imgPath), imgPath });
  }
  console.log(`${sup}: 수집 ${rows.length} · DB 일치 ${plan.length} · 새 이미지 ${plan.filter((p) => p.needImage).length}`);
  if (!commit) continue;

  await inParallel(plan.filter((p) => p.needImage), async (p) => {
    let ext = path.extname(p.imgPath).toLowerCase();
    // 버킷 용량 제한 — 1MB 넘는 원본은 긴 변 1200px JPEG 로 줄여 올린다 (macOS sips)
    if (fs.statSync(p.imgPath).size > 1024 * 1024) {
      fs.mkdirSync(path.join(os.tmpdir(), 'rc-small', sup), { recursive: true });
      const small = path.join(os.tmpdir(), 'rc-small', sup, `${path.basename(p.imgPath).replace(/\.[^.]+$/, '')}.jpg`);
      execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82', '-Z', '1200', p.imgPath, '--out', small], { stdio: 'ignore' });
      p.imgPath = small; ext = '.jpg';
    }
    const key = `rental-catalog/${sup}/${path.basename(p.imgPath).replace(/[^A-Za-z0-9._-]/g, '_')}`;
    if (!process.argv.includes('--no-upload')) await st.sb.storage.from(BUCKET).upload(key, fs.readFileSync(p.imgPath), { contentType: MIME[ext] || 'application/octet-stream', upsert: true, cacheControl: '31536000' }).then(({ error }) => { if (error) throw error; });
    p.image_url = st.sb.storage.from(BUCKET).getPublicUrl(key).data.publicUrl;
  });
  await inParallel(plan, async (p) => {
    const upd = { specs: p.specs, updated_at: new Date().toISOString() };
    if (p.image_url) upd.image_url = p.image_url;
    await db.sb.from('rental_cat_models').update(upd).eq('id', p.id).throwOnError();
  }, 20);
  console.log(`${sup}: 반영 ${plan.length} · 이미지 ${plan.filter((p) => p.image_url).length}`);
}
