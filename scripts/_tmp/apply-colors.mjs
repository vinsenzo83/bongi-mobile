// 조건별 색상 채우기 — 청호는 상품코드(zCode)=색상 SKU, 나머지는 상품명 괄호 색상
import fs from 'fs'; import dotenv from 'dotenv'; import { createClient } from '@supabase/supabase-js';
const G = '/private/tmp/claude-501/-Users-vinsenzo/88fff588-4fb8-4c65-8825-95625f74aae7/scratchpad/gaps';
const e = dotenv.parse(fs.readFileSync(process.argv[2])); const commit = process.argv.includes('--commit');
const sb = createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY || e.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
const colors = JSON.parse(fs.readFileSync(`${G}/chungho_colors.json`, 'utf8'));
let offers = []; for (let i = 0; ; i += 1000) { const { data } = await sb.from('rental_cat_offers').select('id, supplier_id, model_id, variant_code, color_name, ticket_number').eq('status', 'active').order('id').range(i, i + 999).throwOnError(); offers = offers.concat(data); if (data.length < 1000) break; }
const { data: models } = await sb.from('rental_cat_models').select('id, product_name').throwOnError();
const nameOf = new Map(models.map((m) => [m.id, m.product_name || '']));
const COLOR_RE = /[(\[]\s*([^)\]]*?(BLACK|WHITE|BLUE|PINK|GRAY|GREY|BEIGE|LAVENDER|PEACH|SILVER|GOLD|GREEN|IVORY|NAVY|실버|화이트|블랙|블루|핑크|그레이|베이지|라벤더|피치|아이보리|골드|그린|브라운|오크|네이비)[^)\]]*?)\s*[)\]]/i;
const upd = []; const stat = { chungho: 0, name: 0 };
for (const o of offers) {
  if (o.color_name) continue;
  let color = null;
  if (o.supplier_id === 'chungho') { const z = (o.variant_code || '').split('-')[0]; color = colors[z]?.color || null; if (color) stat.chungho++; }
  if (!color) { const m = COLOR_RE.exec(nameOf.get(o.model_id) || ''); if (m) { color = m[1].trim(); stat.name++; } }
  if (color) upd.push({ id: o.id, color_name: color.slice(0, 40) });
}
console.log(new URL(e.SUPABASE_URL).host.split('.')[0], '색상 채울 조건', upd.length, JSON.stringify(stat));
// 같은 모델에서 색상이 2개 이상인 경우 = 상담 화면 색상 선택 대상
const byModel = {};
for (const u of upd) { const o = offers.find((x) => x.id === u.id); (byModel[o.model_id] ||= new Set()).add(u.color_name); }
const multi = Object.values(byModel).filter((s) => s.size > 1).length;
console.log('색상 2개 이상인 모델', multi);
if (commit) { for (let i = 0; i < upd.length; i += 1) await sb.from('rental_cat_offers').update({ color_name: upd[i].color_name }).eq('id', upd[i].id).throwOnError(); console.log('반영', upd.length); }
process.exit(0);
