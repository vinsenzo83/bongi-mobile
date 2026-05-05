// 테스트 상담사 3명 생성 (Supabase auth.users + bongi_user_profiles + incentive_agents)
// Usage: node scripts/create-test-incentive-agents.mjs

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const accounts = [
  { email: 'agent1@bongi.test',   password: 'pass1234!', name: '김상담', center: '광주센터', role: 'agent',   base_salary: 2300000 },
  { email: 'manager1@bongi.test', password: 'pass1234!', name: '박매니저', center: '광주센터', role: 'manager', base_salary: 3000000 },
  { email: 'admin1@bongi.test',   password: 'pass1234!', name: '빈센조',   center: '본사',     role: 'admin',   base_salary: 5000000 },
];

(async () => {
  for (const a of accounts) {
    console.log(`\n━━━ ${a.email} (${a.role}) ━━━`);

    // 1. auth.users
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: a.email,
      password: a.password,
      email_confirm: true,
      user_metadata: { display_name: a.name, role: a.role },
    });

    let userId;
    if (createErr) {
      // 이미 있으면 찾기
      const { data: list } = await supabase.auth.admin.listUsers();
      const existing = list?.users?.find(u => u.email === a.email);
      if (!existing) {
        console.error('❌ createUser 실패:', createErr.message);
        continue;
      }
      userId = existing.id;
      console.log(`ℹ️  이미 존재: ${userId}`);
    } else {
      userId = created.user.id;
      console.log(`✅ auth.users 생성: ${userId}`);
    }

    // 2. bongi_user_profiles
    const { error: profileErr } = await supabase
      .from('bongi_user_profiles')
      .upsert({ id: userId, role: a.role, display_name: a.name }, { onConflict: 'id' });
    if (profileErr) console.warn('⚠ bongi_user_profiles:', profileErr.message);
    else console.log('✅ bongi_user_profiles upsert');

    // 3. incentive_agents
    const { error: agentErr } = await supabase
      .from('incentive_agents')
      .upsert({
        user_id: userId,
        name: a.name,
        center: a.center,
        role: a.role,
        hire_date: '2026-01-01',
        base_salary: a.base_salary,
        active: true,
      }, { onConflict: 'user_id' });
    if (agentErr) console.warn('⚠ incentive_agents:', agentErr.message);
    else console.log('✅ incentive_agents upsert');
  }

  // 최종 확인
  const { data: agents } = await supabase
    .from('incentive_agents')
    .select('id, name, center, role, user_id')
    .order('hire_date');
  console.log('\n━━━ 최종 incentive_agents ━━━');
  console.table(agents);

  console.log('\n✅ 완료');
  console.log('\n로그인 정보:');
  accounts.forEach(a => console.log(`  ${a.role.padEnd(8)} ${a.email} / ${a.password}`));
})();
