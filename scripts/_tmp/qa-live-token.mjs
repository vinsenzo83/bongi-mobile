// 라이브 QA 계정(상담사·계약처리만, admin 금지) — 대표 승인 2026-09-17. 테스트 뒤 --off 로 비활성화
import fs from 'fs'; import dotenv from 'dotenv'; import { createClient } from '@supabase/supabase-js';
const env = dotenv.parse(fs.readFileSync('.env'));
if (!env.SUPABASE_URL.includes('dugaqvvnhsgenhmhuyju')) { console.error('live 아님'); process.exit(1); }
const role = process.argv[2]; if (!['agent', 'contract'].includes(role)) { console.error('role 은 agent|contract 만'); process.exit(1); }
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
const email = `qa-rental-live-${role}@bongi.test`;
const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 });
let user = list.users.find((u) => u.email === email);
if (process.argv.includes('--off')) {
  if (user) { await sb.auth.admin.updateUserById(user.id, { ban_duration: '876000h' }); await sb.from('incentive_agents').update({ active: false }).eq('user_id', user.id); }
  console.log('off', email); process.exit(0);
}
const password = 'Qa-' + Math.random().toString(36).slice(2) + 'X9!';
if (user) await sb.auth.admin.updateUserById(user.id, { password, ban_duration: 'none' });
else ({ data: { user } } = await sb.auth.admin.createUser({ email, password, email_confirm: true }));
const { data: ag } = await sb.from('incentive_agents').select('id').eq('user_id', user.id).maybeSingle();
if (!ag) await sb.from('incentive_agents').insert({ user_id: user.id, name: `QA-렌탈라이브-${role}`, center: 'QA', role }).throwOnError();
else await sb.from('incentive_agents').update({ role, active: true }).eq('id', ag.id);
const anon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data, error } = await anon.auth.signInWithPassword({ email, password });
if (error) { console.error(error.message); process.exit(1); }
fs.mkdirSync('/private/tmp/claude-501/-Users-vinsenzo/88fff588-4fb8-4c65-8825-95625f74aae7/scratchpad/live', { recursive: true });
fs.writeFileSync(`/private/tmp/claude-501/-Users-vinsenzo/88fff588-4fb8-4c65-8825-95625f74aae7/scratchpad/live/qa_token_${role}`, data.session.access_token);
console.log('ok', role, user.id); process.exit(0);
