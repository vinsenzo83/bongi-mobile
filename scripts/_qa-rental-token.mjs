// 데브 전용 QA 계정 생성/토큰 발급 (라이브 금지)
import fs from 'fs'; import dotenv from 'dotenv'; import { createClient } from '@supabase/supabase-js';
const env = dotenv.parse(fs.readFileSync('.env.dev'));
if (!env.SUPABASE_URL.includes('sesgdq')) { console.error('dev 아님'); process.exit(1); }
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
const email = `qa-rental-catalog${process.argv[3] ? '-' + process.argv[3] : ''}@bongi.test`; const password = 'Qa-' + Math.random().toString(36).slice(2) + 'X9!';
let { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 });
let user = list.users.find((u) => u.email === email);
if (user) await sb.auth.admin.updateUserById(user.id, { password });
else ({ data: { user } } = await sb.auth.admin.createUser({ email, password, email_confirm: true }));
const { data: ag } = await sb.from('incentive_agents').select('id').eq('user_id', user.id).maybeSingle();
if (!ag) await sb.from('incentive_agents').insert({ user_id: user.id, name: 'QA-렌탈카탈로그' + (process.argv[3] ? '-' + process.argv[3] : ''), center: 'QA', role: process.argv[2] || 'admin' }).throwOnError();
else await sb.from('incentive_agents').update({ role: process.argv[2] || 'admin', active: true }).eq('id', ag.id);
const anon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
const { data, error } = await anon.auth.signInWithPassword({ email, password });
if (error) { console.error(error.message); process.exit(1); }
fs.writeFileSync('/private/tmp/claude-501/-Users-vinsenzo/88fff588-4fb8-4c65-8825-95625f74aae7/scratchpad/qa_token' + (process.argv[3] ? '_' + process.argv[3] : ''), data.session.access_token);
console.log('ok', user.id);
process.exit(0);
