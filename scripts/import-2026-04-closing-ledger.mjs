// 2026-04 마감원장 → incentive_customer_db dev import
// 워치·미성년·100세 제외 + 이름+생년월일 통합 + 1차/2차 분류 + phone 충돌 on_hold

import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';

const ENV = readFileSync('.env.staging', 'utf8').split('\n').reduce((m, l) => {
  const [k, v] = l.split('='); if (k && v) m[k.trim()] = v.trim(); return m;
}, {});
const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_KEY);

const FILE = '/Users/vinsenzo/Downloads/2026-04_마감원장.xlsx';
const DB_SOURCE_ID = 1; // 봉이모바일 DB
const DRY_RUN = process.argv.includes('--dry-run');

const isWatch = (d) => /^L/.test(String(d || ''));
const isInternetTV = (model, type) => {
  if (type === '유선') return true;
  const m = String(model || '').trim();
  return m === '인+TV' || m === '인터넷' || m === '유선' || m.startsWith('인');
};
const excelToDate = (s) => {
  if (typeof s !== 'number' || s < 1) return null;
  const d = new Date((s - 25569) * 86400 * 1000);
  return isNaN(d.getTime()) ? null : d;
};
const ageAt = (s, ref) => {
  const d = excelToDate(s); if (!d) return null;
  let a = ref.getFullYear() - d.getFullYear();
  if (ref.getMonth() < d.getMonth() || (ref.getMonth() === d.getMonth() && ref.getDate() < d.getDate())) a--;
  return a;
};
const dateISO = (d) => d ? d.toISOString().slice(0, 10) : null;
const parseActDate = (s) => {
  if (!s) return null;
  const m = String(s).match(/(\d{4})\.\s*(\d+)\.\s*(\d+)/);
  if (!m) return null;
  return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
};
const cleanPhone = (p) => String(p || '').replace(/[^0-9]/g, '');
const intOrNull = (v) => { const n = parseInt(v); return isNaN(n) ? null : n; };

const REF = new Date('2026-04-30');
const wb = XLSX.readFile(FILE);
const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });
console.log('📂 엑셀 row:', data.length);

// 1) 필터
const filtered = data.filter(r => {
  if (isWatch(r.단말)) return false;
  const a = ageAt(r.생년월일, REF);
  if (a === null || a < 19 || a >= 100) return false;
  const ph = cleanPhone(r.전화번호);
  if (!/^01[016789][0-9]{7,8}$/.test(ph)) return false;
  if (!String(r.고객명 || '').trim()) return false;
  if (!r.생년월일) return false;
  return true;
});
console.log('✅ 필터 후:', filtered.length);

// 2) 이름+생년월일 통합
const groups = new Map();
filtered.forEach(r => {
  const k = String(r.고객명).trim() + '|' + r.생년월일;
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(r);
});
console.log('👤 통합 후 customer:', groups.size);

// 3) customer 객체 빌드 + 카테고리 분류
const customers = [];
groups.forEach((rows, key) => {
  const hasInternet = rows.some(r => isInternetTV(r.단말, r.유형));
  let tier, category, basePriority;
  if (hasInternet) { tier = 2; category = '렌탈권유'; basePriority = 50; }
  else {
    const types = rows.map(r => r.유형);
    if (types.includes('이동')) { tier = 1; category = '이동'; basePriority = 100; }
    else if (types.includes('신규')) { tier = 1; category = '신규'; basePriority = 80; }
    else if (types.includes('기변')) { tier = 1; category = '기변'; basePriority = 30; }
    else { tier = 1; category = '기타'; basePriority = 10; }
  }
  // 가장 최근 row를 base로 (개통날짜 desc)
  const sorted = [...rows].sort((a, b) => {
    const da = parseActDate(a.개통날짜); const db = parseActDate(b.개통날짜);
    return (db || '').localeCompare(da || '');
  });
  const base = sorted[0];
  // 1차 분류는 휴대폰 row만 base로
  const mobileBase = sorted.find(r => !isInternetTV(r.단말, r.유형)) || base;
  const internetRow = sorted.find(r => isInternetTV(r.단말, r.유형));

  customers.push({
    key,
    tier, category, basePriority,
    rows,
    name: String(base.고객명).trim(),
    phone: cleanPhone(mobileBase.전화번호),
    birth_date: dateISO(excelToDate(base.생년월일)),
    age: ageAt(base.생년월일, REF),
    activation_date: parseActDate(mobileBase.개통날짜),
    subscription_type: mobileBase.유형,
    device_model: mobileBase.단말,
    device_color: mobileBase.색상,
    device_serial: mobileBase.일련번호 ? String(mobileBase.일련번호) : null,
    plan_name: mobileBase.요금제,
    addon_services: mobileBase.부가,
    payment_type: mobileBase['현/할'],
    subsidy_type: mobileBase['공/선'],
    retail_price: intOrNull(mobileBase.출고가),
    public_subsidy: intOrNull(mobileBase.공시지원금),
    extra_subsidy: intOrNull(mobileBase.추가지원금),
    cash_price: intOrNull(mobileBase.현금가),
    installment_principal: intOrNull(mobileBase.할부원금),
    carrier: mobileBase.통신사,
    store: base.매장,
    store_code: base.코드,
    dealer: base.판매처,
    agency_code: mobileBase.대리점,
    memo_etc: rows.map(r => r.기타).filter(Boolean).join(' | ') || null,
    memo_activation: rows.map(r => r['개통실 메모']).filter(Boolean).join(' | ') || null,
    has_internet: !!internetRow,
    internet_info: internetRow ? `${internetRow.단말} (${internetRow.개통날짜})` : null,
    source_data: rows,
    status: 'available',
    priority_score: basePriority,
  });
});

// 4) phone 충돌 → 우선순위 1건 active, 나머지 on_hold
const phoneMap = new Map();
customers.forEach(c => {
  if (!phoneMap.has(c.phone)) phoneMap.set(c.phone, []);
  phoneMap.get(c.phone).push(c);
});
let onHold = 0;
phoneMap.forEach((custs) => {
  if (custs.length > 1) {
    custs.sort((a, b) => b.priority_score - a.priority_score);
    custs.slice(1).forEach(c => {
      c.status = 'on_hold';
      c.on_hold_reason = `phone 충돌 — ${custs[0].name}(${custs[0].category})에 우선 배정`;
      onHold++;
    });
  }
});
console.log('⚠️ on_hold:', onHold);

// 5) 통계
const active = customers.filter(c => c.status === 'available');
const t1 = active.filter(c => c.tier === 1);
const t2 = active.filter(c => c.tier === 2);
console.log('\n═══ 최종 분류 ═══');
console.log('TOTAL active:', active.length);
console.log('1차 인터넷·TV 권유:', t1.length, '(이동', t1.filter(c=>c.category==='이동').length, '· 신규', t1.filter(c=>c.category==='신규').length, '· 기변', t1.filter(c=>c.category==='기변').length, ')');
console.log('2차 렌탈 권유:', t2.length);
console.log('on_hold:', onHold);

if (DRY_RUN) {
  console.log('\n🔍 DRY RUN — DB 미반영. 첫 3개 active customer 미리보기:');
  active.slice(0, 3).forEach(c => {
    console.log('\n--', c.name, '(만'+c.age+'세, '+c.category+')', '--');
    Object.entries(c).filter(([k]) => !['source_data','rows','key','status','basePriority'].includes(k)).forEach(([k,v]) => {
      console.log('  ', k, '=', JSON.stringify(v).slice(0, 100));
    });
  });
  process.exit(0);
}

// 6) batch 생성 + bulk insert
const batchId = randomUUID();
const me = await supabase.from('incentive_agents').select('id, name').eq('role', 'admin').limit(1).single();
const adminId = me.data?.id;
const adminName = me.data?.name || 'system';

const { error: bErr } = await supabase.from('incentive_customer_import_batch').insert({
  id: batchId, db_source_id: DB_SOURCE_ID, imported_by_user_id: adminId,
  imported_by_name: adminName, total_count: customers.length, status: 'active',
});
if (bErr) { console.error('❌ batch insert 실패:', bErr); process.exit(1); }
console.log('\n📦 batch_id:', batchId);

const retentionDate = new Date(); retentionDate.setFullYear(retentionDate.getFullYear() + 3);
const retentionISO = retentionDate.toISOString().slice(0, 10);

const insertRows = customers.map(c => ({
  imported_batch_id: batchId,
  db_source_id: DB_SOURCE_ID,
  imported_by_user_id: adminId,
  name: c.name, phone: c.phone, age: c.age,
  birth_date: c.birth_date,
  activation_date: c.activation_date,
  subscription_type: c.subscription_type,
  device_model: c.device_model,
  device_color: c.device_color,
  device_serial: c.device_serial,
  plan_name: c.plan_name,
  addon_services: c.addon_services,
  payment_type: c.payment_type,
  subsidy_type: c.subsidy_type,
  retail_price: c.retail_price,
  public_subsidy: c.public_subsidy,
  extra_subsidy: c.extra_subsidy,
  cash_price: c.cash_price,
  installment_principal: c.installment_principal,
  carrier: c.carrier,
  store: c.store,
  store_code: c.store_code,
  dealer: c.dealer,
  agency_code: c.agency_code,
  memo_etc: c.memo_etc,
  memo_activation: c.memo_activation,
  notes: c.internet_info ? `[기존 인터넷/TV] ${c.internet_info}` : null,
  tier: c.tier,
  category: c.category,
  priority_score: c.priority_score,
  on_hold_reason: c.on_hold_reason || null,
  call_status: c.status === 'on_hold' ? 'on_hold' : 'pending',
  call_count: 0,
  consent_status: 'unknown',
  data_retention_until: retentionISO,
  source_data: c.source_data,
  archived: false,
}));

let inserted = 0, dups = 0, failed = 0;
for (let i = 0; i < insertRows.length; i += 500) {
  const chunk = insertRows.slice(i, i + 500);
  const { data: ins, error } = await supabase.from('incentive_customer_db').insert(chunk).select('id');
  if (error) {
    if (error.code === '23505') {
      // row 단위 재시도
      for (const row of chunk) {
        const { error: e1 } = await supabase.from('incentive_customer_db').insert(row);
        if (e1?.code === '23505') dups++;
        else if (e1) { failed++; console.error('  row 실패:', row.name, e1.message); }
        else inserted++;
      }
    } else {
      console.error('chunk error:', error);
      failed += chunk.length;
    }
  } else inserted += ins.length;
  console.log('  ', inserted, '/', insertRows.length, '...');
}

await supabase.from('incentive_customer_import_batch').update({
  valid_count: inserted, invalid_count: failed, duplicate_count: dups,
}).eq('id', batchId);

console.log('\n✅ 완료');
console.log('  inserted:', inserted, '· dup:', dups, '· failed:', failed);
console.log('  batch_id:', batchId);
