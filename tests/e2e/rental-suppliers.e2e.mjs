// 렌탈사별 접수 → 계약처리 E2E — 데브 전용. 렌탈사마다 가입기준(명의·납부·서류·타사보상 등)이 달라 입력폼이 다르므로
// 렌탈사 × 조건유형(일반 + 타사보상/결합/선납 중 있는 것)마다: 폼 명세 → 필수 누락 400 → 폼대로 채워 접수 → 계약처리 체크리스트 → 완료 → 사은품 원장
//   node tests/e2e/rental-suppliers.e2e.mjs <base> <tokenDir>
import fs from 'fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const BASE = process.argv[2] || 'http://localhost:3099';
const TOK = process.argv[3];
const env = dotenv.parse(fs.readFileSync(new URL('../../.env.dev', import.meta.url)));
if (!/sesgdqbmophgmombelmn/.test(env.SUPABASE_URL)) { console.error('데브 DB 가 아님 — 중단'); process.exit(1); }
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
const T = Object.fromEntries(['agent', 'contract'].map((r) => [r, fs.readFileSync(`${TOK}/qa_token_${r}`, 'utf8').trim()]));
const QA_NAME = 'QA렌탈테스트';

let pass = 0; const fails = [];
const check = (name, ok, info = '') => { if (ok) pass++; else fails.push(`${name} ${info}`); if (!ok) console.log('❌', name, info); };
async function call(method, path, role, body) {
  const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${T[role]}` }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch { /* 본문 없음 */ }
  return { s: r.status, j };
}
const visible = (x, input) => {
  const c = x.show_if; if (!c) return true;
  if (c.truthy) return !!input[c.field];
  return (c.in || []).includes(input[c.field]);
};
let seq = Number(String(Date.now()).slice(-4));
const phone = () => `010-0000-${String(seq++ % 10000).padStart(4, '0')}`;

/** 폼 명세대로 유효한 값 채우기 (holder 지정 가능) */
function fillForm(form, holder) {
  const input = {};
  const future = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  for (let round = 0; round < 3; round++) {     // show_if 연쇄 때문에 몇 번 반복
    for (const s of form.sections) {
      if (!visible(s, input)) continue;
      for (const f of s.fields) {
        if (f.calc_only || input[f.key] !== undefined || !visible(f, input)) continue;
        const req = f.required || (f.required_if && visible({ show_if: f.required_if }, input));
        if (!req) continue;
        if (f.key === 'holder_type') input[f.key] = holder && f.options.includes(holder) ? holder : f.options.includes('개인') ? '개인' : f.options[0];
        else if (f.key === 'customer_name') input[f.key] = QA_NAME;
        else if (f.key === 'customer_phone') input[f.key] = phone();
        else if (f.key === 'birth_date') input[f.key] = '1985-05-05';
        else if (f.key === 'biz_number') input[f.key] = '123-45-67890';
        else if (f.type === 'select') input[f.key] = f.options[0];
        else if (f.type === 'checkbox') input[f.key] = true;
        else if (f.type === 'date') input[f.key] = future;
        else if (f.type === 'email') input[f.key] = 'qa@bongi.test';
        else input[f.key] = 'QA';
      }
    }
  }
  return input;
}

const created = [];
const report = [];
try {
  const { data: suppliers } = await sb.from('rental_cat_suppliers').select('id, name').order('id');
  const today = new Date().toISOString().slice(0, 10);
  for (const sup of suppliers) {
    // 판매중·CRM 노출·가이드 있는 조건 — 일반 1개 + 특수유형 있으면 각 1개
    const picks = [];
    for (const type of ['normal', 'trade_in', 'bundle', 'prepay']) {
      const { data } = await sb.from('rental_cat_offers').select('id, ticket_number, offer_type, guide_payout, max_payout, display_fee')
        .eq('supplier_id', sup.id).eq('status', 'active').eq('crm_enabled', true).eq('offer_type', type).not('guide_payout', 'is', null).gt('display_fee', 0)
        .or(`valid_to.is.null,valid_to.gte.${today}`).limit(1);
      if (data?.length) picks.push(data[0]);
    }
    if (!picks.length) { report.push({ supplier: sup.name, note: '판매중 조건 없음' }); continue; }

    for (const o of picks) {
      const tag = `${sup.name}/${o.offer_type}/${o.ticket_number}`;
      const fr = await call('GET', `/api/rental-catalog/agent/offers/${o.id}/form`, 'agent');
      check(`${tag} 폼 200`, fr.s === 200 && fr.j?.form?.sections?.length, `${fr.s}`);
      if (fr.s !== 200) continue;
      const form = fr.j.form;
      const holderField = form.sections[0].fields.find((f) => f.key === 'holder_type');
      const payField = form.sections.find((s) => s.id === 'payment')?.fields.find((f) => f.key === 'payment_method');
      const dayField = form.sections.find((s) => s.id === 'payment')?.fields.find((f) => f.key === 'billing_day');
      const row = {
        supplier: sup.name, type: o.offer_type, ticket: o.ticket_number,
        holders: holderField?.options.join('/'), pay: payField?.options.join('/'), billing_days: dayField?.options.join(',') || '-',
        sections: form.sections.map((s) => s.id).join(','), docs: form.documents.length, cards: (fr.j.cards || []).length, stale: form.notices.some((n) => n.kind === 'stale'),
      };
      if (o.offer_type === 'trade_in') check(`${tag} 타사보상 섹션`, form.sections.some((s) => s.id === 'trade_in'));
      if (o.offer_type === 'bundle') check(`${tag} 결합 섹션`, form.sections.some((s) => s.id === 'bundle'));
      if (o.offer_type === 'prepay') check(`${tag} 선납 섹션`, form.sections.some((s) => s.id === 'prepay'));

      // 필수 누락 → 400 + 누락 필드 목록
      const miss = await call('POST', '/api/incentive/sales', 'agent', { sale_kind: 'rental', rental_offer_id: o.id, customer_name: QA_NAME, customer_phone: phone(), actual_payout: o.guide_payout, rental_application: {} });
      if (miss.j?.sale?.id) created.push(miss.j.sale.id);
      check(`${tag} 필수누락 400`, miss.s === 400 && miss.j?.fields, `${miss.s} ${JSON.stringify(miss.j).slice(0, 120)}`);

      // 개인(없으면 첫 명의) + 사업자 명의가 있으면 사업자도 한 번
      const holders = [holderField.options.includes('개인') ? '개인' : holderField.options[0]];
      const biz = holderField.options.find((h) => /사업자/.test(h));
      if (biz && o.offer_type === 'normal') holders.push(biz);
      for (const h of holders) {
        const app = fillForm(form, h);
        const body = { sale_kind: 'rental', rental_offer_id: o.id, customer_name: app.customer_name, customer_phone: app.customer_phone,
          customer_address: app.customer_address || 'QA 주소', customer_address_detail: app.customer_address_detail || 'QA', notes: 'QA', actual_payout: o.guide_payout, rental_application: app };
        const ok = await call('POST', '/api/incentive/sales', 'agent', body);
        const sale = ok.j?.sale || ok.j;
        if (sale?.id) created.push(sale.id);
        check(`${tag} [${h}] 접수 성공`, (ok.s === 200 || ok.s === 201) && sale?.sale_kind === 'rental', `${ok.s} ${JSON.stringify(ok.j).slice(0, 200)}`);
        if (!sale?.id) continue;
        check(`${tag} [${h}] 티켓·지급액 스냅샷`, sale.rental_ticket_number === o.ticket_number && sale.payback_snapshot === o.guide_payout);

        // 계약처리
        const rf = await call('GET', `/api/incentive/sales/${sale.id}/rental-form`, 'contract');
        const cl = rf.j?.checklist || [];
        check(`${tag} [${h}] 계약처리 체크리스트`, rf.s === 200 && cl.length >= 7, `${rf.s} ${cl.length}`);
        if (h !== holders[0]) row.biz_docs = cl.filter((i) => i.group === '서류').map((i) => i.label).join('/');
        else row.docs_individual = cl.filter((i) => i.group === '서류').map((i) => i.label).join('/') || '-';
        const P = (b) => call('PATCH', `/api/incentive/sales/${sale.id}`, 'contract', b);
        const early = await P({ status: 'completed' });
        check(`${tag} [${h}] 미완료 완료차단`, early.s === 400, `${early.s}`);
        const proc = {};
        for (const i of cl) proc[i.key] = i.type === 'date' ? today : i.type === 'text' ? 'QA-ORDER' : true;
        const fill = await P({ rental_process: proc });
        check(`${tag} [${h}] 체크리스트 저장`, fill.s === 200, `${fill.s} ${JSON.stringify(fill.j).slice(0, 150)}`);
        const done = await P({ status: 'completed' });
        check(`${tag} [${h}] 계약완료`, done.s === 200, `${done.s} ${JSON.stringify(done.j).slice(0, 150)}`);
        const { data: gift } = await sb.from('bongi_gifts').select('amount, ticket_no').eq('source_sale_id', sale.id);
        check(`${tag} [${h}] 사은품 원장`, gift?.length === 1 && gift[0].amount === o.guide_payout && gift[0].ticket_no === o.ticket_number, JSON.stringify(gift));
      }
      report.push(row);
    }
  }
} catch (e) {
  fails.push('예외 ' + e.stack); console.error(e);
} finally {
  for (const id of created) {
    await sb.from('bongi_gifts').delete().eq('source_sale_id', id);
    await sb.from('incentive_sales_history').delete().eq('sale_id', id);
    await sb.from('incentive_sales').delete().eq('id', id).eq('customer_name', QA_NAME);
  }
  const { count } = await sb.from('incentive_sales').select('id', { count: 'exact', head: true }).in('id', created.length ? created : ['00000000-0000-0000-0000-000000000000']);
  console.table(report);
  console.log(`정리: QA 계약 ${created.length}건 삭제, 잔존 ${count}`);
  console.log(`\n결과: ${pass}/${pass + fails.length} 통과`);
  if (fails.length) { console.log('실패:\n - ' + fails.join('\n - ')); process.exitCode = 1; }
}
