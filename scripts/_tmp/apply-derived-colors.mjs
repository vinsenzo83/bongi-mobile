// 추출한 색상(상품명·모델코드 기반)을 rental_cat_models.color_names 에 반영
//   node scripts/_tmp/apply-derived-colors.mjs <colors.json> dev        → 미리보기
//   node scripts/_tmp/apply-derived-colors.mjs <colors.json> dev --apply
//   live 는 --apply 와 함께 --i-know 를 줘야 한다 (대표 승인 후에만)
import fs from 'fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const [file, target] = process.argv.slice(2);
const apply = process.argv.includes('--apply');
if (!file || !['dev', 'live'].includes(target)) { console.error('사용법: <colors.json> <dev|live> [--apply]'); process.exit(1); }
if (target === 'live' && apply && !process.argv.includes('--i-know')) { console.error('라이브 반영은 --i-know 필요 (대표 승인 확인)'); process.exit(1); }

const e = dotenv.parse(fs.readFileSync(target === 'live' ? '.env' : '.env.dev'));
const sb = createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY || e.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
const { single } = JSON.parse(fs.readFileSync(file, 'utf8'));
const SOURCE = '상품명(빌리고 엑셀)';

// 이미 색상이 있는 모델은 건드리지 않는다 (공식몰 수집분·수동 입력 보호)
let already = 0; let wrote = 0; const CH = 200;
for (let i = 0; i < single.length; i += CH) {
  const chunk = single.slice(i, i + CH);
  const { data: cur } = await sb.from('rental_cat_models').select('id, color_names, specs')
    .in('id', chunk.map((r) => r.id)).throwOnError();
  const curMap = new Map(cur.map((m) => [m.id, m]));
  const todo = chunk.filter((r) => {
    const m = curMap.get(r.id);
    if (!m) return false;
    if ((m.color_names || []).length) { already++; return false; }
    if ((m.specs?.specifications?.color || '').trim()) { already++; return false; }
    return true;
  });
  if (!todo.length) continue;
  if (!apply) { wrote += todo.length; continue; }
  for (const r of todo) {
    await sb.from('rental_cat_models').update({ color_names: r.colors, color_source: SOURCE, updated_at: new Date().toISOString() })
      .eq('id', r.id).throwOnError();
    wrote++;
  }
  process.stdout.write(`\r  ${wrote}/${single.length}`);
}
console.log(`\n${target} ${apply ? '반영' : '미리보기'} — 대상 ${single.length} · ${apply ? '기록' : '기록 예정'} ${wrote} · 건너뜀(이미 색상 있음) ${already}`);
process.exit(0);
