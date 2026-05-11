// dev → live 4월 마감원장 customer 동기화
// dev (sesgdqbmophgmombelmn) → live (dugaqvvnhsgenhmhuyju)

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

const env = (file) => readFileSync(file, 'utf8').split('\n').reduce((m, l) => {
  const eq = l.indexOf('='); if (eq < 0) return m;
  const k = l.slice(0, eq).trim(); const v = l.slice(eq + 1).trim();
  if (k && v) m[k] = v; return m;
}, {});
const dev = env('.env.staging');
const live = env('.env');
const devClient = createClient(dev.SUPABASE_URL, dev.SUPABASE_SERVICE_KEY);
const liveClient = createClient(live.SUPABASE_URL, live.SUPABASE_SERVICE_KEY);

const DEV_BATCH = '93beeb36-1358-414c-ba6f-4e36654b7330';

// 1. dev batch 정보 가져오기
console.log('1) dev batch 조회...');
const { data: batch } = await devClient.from('incentive_customer_import_batch')
  .select('*').eq('id', DEV_BATCH).single();
if (!batch) { console.error('❌ dev batch 없음'); process.exit(1); }
console.log('   batch:', batch.imported_by_name, batch.total_count, '건');

// 2. dev customer 모두 가져오기 (pagination)
console.log('\n2) dev customer pagination fetch...');
const all = [];
const PAGE = 1000;
for (let off = 0; off < 5000; off += PAGE) {
  const { data, error } = await devClient.from('incentive_customer_db')
    .select('*').eq('imported_batch_id', DEV_BATCH)
    .range(off, off + PAGE - 1).order('id');
  if (error) { console.error(error); process.exit(1); }
  if (!data.length) break;
  all.push(...data);
  console.log('   ', all.length, '...');
  if (data.length < PAGE) break;
}
console.log('   총', all.length, '명');

// 3. live db_source 확인 (id=1 봉이모바일DB)
const { data: src } = await liveClient.from('incentive_db_sources').select('id, name').eq('id', 1).maybeSingle();
console.log('\n3) live db_source:', src?.name || '없음');
if (!src) {
  await liveClient.from('incentive_db_sources').insert({ id: 1, name: '봉이모바일 DB', color: '#3b82f6' });
  console.log('   db_source id=1 생성');
}

// 4. live admin agent 찾기
const { data: admins } = await liveClient.from('incentive_agents').select('id, name').eq('role', 'admin').limit(1);
const adminId = admins?.[0]?.id;
const adminName = admins?.[0]?.name || 'system';
console.log('   admin:', adminName);

// 5. live batch 생성 (새 UUID)
const newBatchId = randomUUID();
const { error: bErr } = await liveClient.from('incentive_customer_import_batch').insert({
  id: newBatchId, db_source_id: 1, imported_by_user_id: adminId,
  imported_by_name: adminName, total_count: all.length,
  status: 'active',
});
if (bErr) { console.error('❌ batch insert:', bErr); process.exit(1); }
console.log('\n4) live batch:', newBatchId);

// 6. customer 변환 + insert (chunk)
console.log('\n5) live insert (chunk 500)...');
let inserted = 0, dups = 0, failed = 0;
for (let i = 0; i < all.length; i += 500) {
  const chunk = all.slice(i, i + 500).map(c => {
    const out = { ...c };
    delete out.id; // sequence 사용
    out.imported_batch_id = newBatchId;
    out.db_source_id = 1;
    out.imported_by_user_id = adminId;
    // assigned_agent_id가 dev 전용이라 null로 (live 상담사 ID 모름)
    out.assigned_agent_id = null;
    out.assigned_at = null;
    out.assigned_by_user_id = null;
    out.assigned_center = null;
    out.center_assigned_at = null;
    return out;
  });
  const { data, error } = await liveClient.from('incentive_customer_db').insert(chunk).select('id');
  if (error) {
    if (error.code === '23505') {
      // phone unique 충돌 row 단위 재시도
      for (const row of chunk) {
        const { error: e1 } = await liveClient.from('incentive_customer_db').insert(row);
        if (e1?.code === '23505') dups++;
        else if (e1) { failed++; console.warn('  실패:', row.name, e1.message); }
        else inserted++;
      }
    } else { console.error('chunk error:', error.message); failed += chunk.length; }
  } else inserted += data.length;
  console.log('  ', inserted, '/', all.length);
}

await liveClient.from('incentive_customer_import_batch').update({
  valid_count: inserted, invalid_count: failed, duplicate_count: dups,
}).eq('id', newBatchId);

console.log('\n✅ 완료');
console.log('  inserted:', inserted, '· dup:', dups, '· failed:', failed);
console.log('  live batch_id:', newBatchId);
