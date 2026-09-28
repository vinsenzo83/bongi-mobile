// 라이브 QA 렌탈 계약 1건: 스마트렌탈 R044251 개인 명의 → 서류 확인 → 계약처리 → 완료 → 사은품 원장 (대표 승인 2026-09-17)
//   node scripts/_tmp/live-contract.mjs
import fs from 'fs'; import dotenv from 'dotenv'; import { createClient } from '@supabase/supabase-js';
const BASE = 'https://admin.prexymarket.com'; const D = '/private/tmp/claude-501/-Users-vinsenzo/88fff588-4fb8-4c65-8825-95625f74aae7/scratchpad/live';
const T = { agent: fs.readFileSync(`${D}/qa_token_agent`, 'utf8').trim(), contract: fs.readFileSync(`${D}/qa_token_contract`, 'utf8').trim() };
const e = dotenv.parse(fs.readFileSync('.env')); const sb = createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY || e.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
const call = async (m, p, role, b) => { const r = await fetch(BASE + p, { method: m, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${T[role]}` }, body: b ? JSON.stringify(b) : undefined }); let j = null; try { j = await r.json(); } catch { /* 본문 없음 */ } return { s: r.status, j }; };
const out = (k, v) => console.log(k, typeof v === 'string' ? v : JSON.stringify(v));

const tk = await call('GET', '/api/rental-catalog/agent/tickets/R044251', 'agent');
out('티켓', { s: tk.s, product: tk.j?.model?.product_name, guide: tk.j?.offer?.guide_payout, max: tk.j?.offer?.max_payout, fee: tk.j?.offer?.display_fee, rebate_leak: /rebate/.test(JSON.stringify(tk.j)) });
const o = tk.j.offer;
const fr = await call('GET', `/api/rental-catalog/agent/offers/${o.id}/form`, 'agent');
out('폼 서류', fr.j.form.documents.map((d) => `${d.label}:${(d.holders || []).join('/')}`));
const miss = await call('POST', '/api/incentive/sales', 'agent', { sale_kind: 'rental', rental_offer_id: o.id, customer_name: 'QA렌탈테스트', customer_phone: '010-0000-4251', actual_payout: o.guide_payout, rental_application: {} });
out('필수누락', { s: miss.s, fields: (miss.j?.fields || []).length });

const pay = fr.j.form.sections.find((s) => s.id === 'payment').fields;
const app = { holder_type: '개인', customer_name: 'QA렌탈테스트', customer_phone: '010-0000-4251', birth_date: '1985-05-05', customer_address: 'QA 테스트 주소', customer_address_detail: 'QA',
  payment_method: pay.find((f) => f.key === 'payment_method').options[0], consent_privacy: true, consent_third_party: true, consent_credit: true };
const bd = pay.find((f) => f.key === 'billing_day'); if (bd) app.billing_day = bd.options[0];
const ok = await call('POST', '/api/incentive/sales', 'agent', { sale_kind: 'rental', rental_offer_id: o.id, customer_name: app.customer_name, customer_phone: app.customer_phone,
  customer_address: app.customer_address, customer_address_detail: 'QA', notes: 'QA 라이브 테스트 계약', actual_payout: o.guide_payout, rental_application: app });
const sale = ok.j?.sale || ok.j;
out('접수', { s: ok.s, id: sale?.id, ticket: sale?.rental_ticket_number, payback: sale?.payback_snapshot, status: sale?.status, rebate_leak: /rebate/.test(JSON.stringify(sale)), err: ok.j?.error });
if (!sale?.id) process.exit(1);
fs.writeFileSync(`${D}/sale_id`, sale.id);

const rf = await call('GET', `/api/incentive/sales/${sale.id}/rental-form`, 'contract');
out('체크리스트', { s: rf.s, items: (rf.j?.checklist || []).map((i) => `${i.group}:${i.label}${i.required ? '*' : ''}`) });
const P = (b) => call('PATCH', `/api/incentive/sales/${sale.id}`, 'contract', b);
out('완료 조기시도(400이어야)', (await P({ status: 'completed' })).s);
const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
const proc = {}; for (const i of rf.j.checklist) proc[i.key] = i.type === 'date' ? today : i.type === 'text' ? 'QA-LIVE-ORDER' : true;
out('체크 저장', (await P({ rental_process: proc })).s);
const done = await P({ status: 'completed' });
out('계약완료', { s: done.s, err: done.j?.error });
const { data: gift } = await sb.from('bongi_gifts').select('id, amount, ticket_no, product_name, name, auth_status').eq('source_sale_id', sale.id);
out('사은품 원장', gift);
const { data: row } = await sb.from('incentive_sales').select('status, rebate_snapshot, actual_payout').eq('id', sale.id).single();
out('DB 계약행', { status: row.status, rebate_snapshot_set: row.rebate_snapshot > 0, actual_payout: row.actual_payout });
const ls = await call('GET', '/api/incentive/contracts?month=' + today.slice(0, 7), 'contract');
out('계약처리 목록에 보임', !!(ls.j?.contracts || []).find((x) => x.id === sale.id));
