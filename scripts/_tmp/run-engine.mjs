// 엔진 1회 실행 — node scripts/_tmp/run-engine.mjs <envfile> [--apply]
import fs from 'fs'; import dotenv from 'dotenv';
Object.assign(process.env, dotenv.parse(fs.readFileSync(process.argv[2])));
const { runPayoutEngine } = await import('../../server/services/rental-payout-runner.js');
const apply = process.argv.includes('--apply');
const out = await runPayoutEngine({ trigger: 'manual', user: '대표 승인 · 초기 적용', apply });
if (!out.ok) { console.log('실패', out.error); process.exit(1); }
const p = out.plan; const w = (x) => Math.round(x).toLocaleString();
console.log('run', out.run_id, 'applied', out.applied, 'planned', p.changes_count, JSON.stringify(p.stats));
for (const k of ['now', 'plan']) { const x = p.summary[k]; console.log(k, '가이드', w(x.guide), 'MAX', w(x.max), '인센', w(x.incentive), '회사', w(x.company), '월급', w(x.per_head.salary), '1인회사', w(x.per_head.company)); }
process.exit(0);
