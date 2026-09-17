// 상담 AI 도구를 CLI 로 호출 (API 크레딧 없이 세션 모델이 AI 역할로 테스트) — 데브 DB 전용
//   node scripts/rental-assist-harness.mjs <tool> '<json input>'
import fs from 'fs';
import dotenv from 'dotenv';
const env = dotenv.parse(fs.readFileSync(new URL('../.env.dev', import.meta.url)));
for (const [k, v] of Object.entries(env)) process.env[k] = v;
if (!/sesgdqbmophgmombelmn/.test(process.env.SUPABASE_URL)) { console.error('dev only'); process.exit(1); }
const svc = await import('../server/services/rental-assistant.js');
const [tool, json] = process.argv.slice(2);
if (tool === 'prompt') { console.log(svc.SYSTEM); console.log(JSON.stringify(svc.TOOLS.map((t) => ({ name: t.name, description: t.description, input: t.input_schema.properties })), null, 1)); process.exit(0); }
const input = JSON.parse(json || '{}');
const t0 = Date.now();
const out = tool === 'submit_recommendations' ? await svc.verifyRecommendations(input) : await svc.runTool(tool, input);
console.log(JSON.stringify(out, null, 1));
console.error(`(${Date.now() - t0}ms)`);
process.exit(0);
