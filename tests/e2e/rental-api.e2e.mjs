// 렌탈 기능 API E2E — 데브 전용 (로컬 서버 + 데브 DB). QA 표시 데이터만 만들고 끝나면 그 행만 지운다.
//   node tests/e2e/rental-api.e2e.mjs <base> <tokenDir>
import fs from 'fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const BASE = process.argv[2] || 'http://localhost:3099';
const TOK = process.argv[3];
const env = dotenv.parse(fs.readFileSync(new URL('../../.env.dev', import.meta.url)));
if (!/sesgdqbmophgmombelmn/.test(env.SUPABASE_URL)) { console.error('데브 DB 가 아님 — 중단'); process.exit(1); }
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
const tok = (r) => fs.readFileSync(`${TOK}/qa_token_${r}`, 'utf8').trim();
const T = { admin: tok('admin'), agent: tok('agent'), contract: tok('contract') };

let pass = 0; const fails = [];
const check = (name, ok, info = '') => { if (ok) pass++; else fails.push(`${name} ${info}`); console.log(ok ? '✅' : '❌', name, ok ? '' : info); };
async function call(method, path, role, body) {
  const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(role ? { Authorization: `Bearer ${T[role]}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch { /* 본문 없음 */ }
  return { s: r.status, j };
}
const hasKey = (o, re) => { if (!o || typeof o !== 'object') return false; return Object.entries(o).some(([k, v]) => re.test(k) || hasKey(v, re)); };

const created = [];
try {
  // ── 1. 인증·권한 경계
  check('무토큰 상담원 모델목록 401', (await call('GET', '/api/rental-catalog/agent/models', null)).s === 401);
  check('무토큰 관리자 모델목록 401', (await call('GET', '/api/rental-catalog/models', null)).s === 401);
  check('상담원 관리자 모델목록 403', (await call('GET', '/api/rental-catalog/models', 'agent')).s === 403);
  check('상담원 엑셀적재 403', (await call('POST', '/api/rental-catalog/offers/apply-margin', 'agent', { margin_pct: 10 })).s === 403);
  check('무토큰 플랫폼어드민 401', (await call('GET', '/api/admin/platform/gifts', null)).s === 401);

  // ── 2. 상담원 조회에 리베이트 없음 / 관리자에는 있음
  const cats = await call('GET', '/api/rental-catalog/agent/categories', 'agent');
  check('카테고리 200', cats.s === 200 && Array.isArray(cats.j?.categories || cats.j), JSON.stringify(cats.j).slice(0, 120));
  const tk = await call('GET', '/api/rental-catalog/agent/tickets/R006159', 'agent');
  check('티켓 조회 200', tk.s === 200 && tk.j?.offer?.ticket_number === 'R006159');
  check('티켓 응답 리베이트 없음', tk.s === 200 && !hasKey(tk.j, /rebate|total_fee|commission/i));
  const offer = tk.j.offer;
  check('가이드 만원단위·MAX≥가이드', offer.guide_payout % 10000 === 0 && offer.max_payout >= offer.guide_payout);
  check('무료개월=floor(가이드/표시요금)', offer.free_months === Math.floor(offer.guide_payout / offer.display_fee), `${offer.free_months}`);
  const mo = await call('GET', `/api/rental-catalog/agent/models/${offer.model_id}/offers`, 'agent');
  check('모델 조건목록 리베이트 없음', mo.s === 200 && !hasKey(mo.j, /rebate|total_fee/i));
  const am = await call('GET', `/api/rental-catalog/models/${offer.model_id}`, 'admin');
  check('관리자 모델상세 리베이트 있음', am.s === 200 && hasKey(am.j, /^rebate$/));
  check('없는 티켓 404', (await call('GET', '/api/rental-catalog/agent/tickets/R999999', 'agent')).s === 404);
  const pg = await call('GET', '/api/rental-catalog/agent/models?page=99999', 'agent');
  check('범위밖 페이지 빈목록', pg.s === 200 && (pg.j.models || []).length === 0, `${pg.s}`);

  // ── 2-1. 자동 추천(내부 로직, AI 없음)
  check('무토큰 자동추천 401', (await call('POST', '/api/rental-catalog/agent/recommend', null, { text: '정수기' })).s === 401);
  const rc = await call('POST', '/api/rental-catalog/agent/recommend', 'agent', { text: '얼음 정수기 4만원 이하 방문관리 신한카드', category: 'water-purifier' });
  check('자동추천 200·추천 1~3개', rc.s === 200 && rc.j?.recommendations?.length >= 1 && rc.j.recommendations.length <= 3, JSON.stringify(rc.j).slice(0, 160));
  check('자동추천 리베이트 없음', rc.s === 200 && !hasKey(rc.j, /^rebate$|total_fee|commission/i));
  check('자동추천 예산 준수(할인 뒤 요금 ≤ 4만)', rc.s === 200 && rc.j.recommendations.every((x) => Math.max(x.condition.display_fee, x.condition.monthly_fee_after) <= 40000));
  check('자동추천 실질 월 부담 계산', rc.s === 200 && rc.j.recommendations.every((x) => Number.isFinite(x.condition.effective_monthly_after_guide)));
  const rt = await call('POST', '/api/rental-catalog/agent/recommend', 'agent', { text: '코웨이 쓰는데 바꾸고 싶음 냉온 정수기' });
  check('타사보상 추천에 지금 쓰는 브랜드 제외', rt.s === 200 && rt.j.recommendations.length > 0 && rt.j.recommendations.every((x) => x.supplier_id !== 'coway'));

  // ── 2-2. 마진 설계 엔진 (관리자 전용)
  check('무토큰 마진계산 401', (await call('POST', '/api/rental-catalog/margin/simulate', null, {})).s === 401);
  check('상담원 마진계산 403', (await call('POST', '/api/rental-catalog/margin/simulate', 'agent', {})).s === 403);
  const md = await call('GET', '/api/rental-catalog/margin/defaults', 'admin');
  check('마진 기본값 200·엔진버전', md.s === 200 && /^\d+\.\d+\.\d+$/.test(md.j?.engine_version || ''), JSON.stringify(md.j).slice(0, 120));
  const ms = await call('POST', '/api/rental-catalog/margin/simulate', 'admin', { max_margin: 0.15, guide_margin: 0.33, productivity: 50, discretion: 0.3, rate_tiers: [{ min: 0, rate: 0.3 }] });
  check('마진계산 200·설계안/지금/판매량', ms.s === 200 && ms.j?.proposed?.volumes?.length > 0 && ms.j?.live?.per_sale && ms.j.dataset.conditions > 1000, `${ms.s} ${JSON.stringify(ms.j).slice(0, 120)}`);
  check('마진계산 회사몫 = 리베이트 − 고객지급 − 인센티브', ms.s === 200 && Math.abs(ms.j.proposed.per_sale.company - (ms.j.proposed.per_sale.rebate - ms.j.proposed.per_sale.customer_pay - ms.j.proposed.per_sale.counselor_incentive)) < 1);
  check('마진계산 경쟁사 비교 매칭', ms.s === 200 && ms.j.benchmarks.filter((b) => b.matched).length >= 10, `${ms.j?.benchmarks?.filter?.((b) => b.matched).length}`);
  check('가이드마진<MAX마진 400', (await call('POST', '/api/rental-catalog/margin/simulate', 'admin', { max_margin: 0.3, guide_margin: 0.2 })).s === 400);
  const mopt = await call('POST', '/api/rental-catalog/margin/optimize', 'admin', { productivity: 50, discretion: 0.3, rate_tiers: [{ min: 0, rate: 0.35 }] });
  check('최적화 200·제약 충족', mopt.s === 200 && mopt.j.best.salary >= mopt.j.constraints.salary_min && mopt.j.best.guide_avg >= mopt.j.constraints.guide_avg_min && mopt.j.best.max_floor >= mopt.j.constraints.min_max_floor, `${mopt.s} ${JSON.stringify(mopt.j).slice(0, 160)}`);
  check('벤치마크 출처 없음 400', (await call('POST', '/api/rental-catalog/margin/benchmarks', 'admin', { competitor: 'QA', supplier_id: 'coway', model_code: 'X', contract_months: 60, care_type: 'visit', support_amount: 1, observed_at: '2026-09-17' })).s === 400);
  const sc = await call('POST', '/api/rental-catalog/margin/scenarios', 'admin', { name: 'QA-시나리오', params: { max_margin: 0.15, guide_margin: 0.33 } });
  check('시나리오 저장 200', sc.s === 200 && sc.j?.scenario?.summary?.proposed, `${sc.s} ${JSON.stringify(sc.j).slice(0, 120)}`);
  if (sc.j?.scenario?.id) await sb.from('rental_margin_scenarios').delete().eq('id', sc.j.scenario.id).eq('name', 'QA-시나리오');
  check('일괄규칙 금액하한 음수 400', (await call('POST', '/api/rental-catalog/offers/apply-margin', 'admin', { margin_pct: 10, max_floor: -1 })).s === 400);
  const dry = await call('POST', '/api/rental-catalog/offers/apply-margin', 'admin', { margin_pct: 14, guide_margin_pct: 31, max_floor: 66000, dry_run: true });
  check('일괄규칙 금액하한 드라이런 = 엔진 식', dry.s === 200 && (dry.j.samples || []).every((x) => { const b = Math.round(x.rebate / 1.1 * 1e6) / 1e6; const km = Math.max(b * 0.14, 66000); const kg = Math.max(b * 0.31, km); return x.new_m === Math.max(0, Math.floor(Math.round((b - km) * 1e6) / 1e6 / 1000) * 1000) && x.new_g === Math.max(0, Math.min(x.new_m, Math.floor(Math.round((b - kg) * 1e6) / 1e6 / 10000) * 10000)); }), JSON.stringify(dry.j).slice(0, 200));

  // ── 2-3. AI 가이드·MAX 엔진 · 공개 API · 렌탈 배분율
  check('상담원 엔진 403', (await call('GET', '/api/rental-catalog/margin/engine', 'agent')).s === 403);
  const eg = await call('GET', '/api/rental-catalog/margin/engine', 'admin');
  check('엔진 설정·실행기록 200', eg.s === 200 && eg.j?.settings?.policy && Array.isArray(eg.j.runs), `${eg.s}`);
  const ep = await call('POST', '/api/rental-catalog/margin/engine/run', 'admin', { apply: false });
  check('엔진 미리보기 200·가이드 만원·MAX≥가이드', ep.s === 200 && ep.j.plan.sample_changes.every((c) => c.guide % 10000 === 0 && c.max >= c.guide), `${ep.s} ${JSON.stringify(ep.j).slice(0, 160)}`);
  check('엔진 미리보기는 기준 대비 상담사 월급 유지', ep.s === 200 && ep.j.plan.summary.plan.per_head.salary + 1 >= ep.j.plan.summary.now.per_head.salary * 0.98);
  check('엔진 되돌리기 uuid 아님 400', (await call('POST', '/api/rental-catalog/margin/engine/runs/abc/rollback', 'admin')).s === 400);
  check('엔진 정책 잘못된 값 400', (await call('PATCH', '/api/rental-catalog/margin/engine', 'admin', { policy: { discretion: 5 } })).s === 400);
  const pub = await fetch(BASE + '/api/rental-catalog/public/models?category=water-purifier').then(async (r) => ({ s: r.status, j: await r.json() }));
  check('공개 모델 200 (로그인 없음)', pub.s === 200 && pub.j.models.length > 0, `${pub.s}`);
  check('공개 모델에 금액 없음', pub.s === 200 && !hasKey(pub.j.models, /guide|max_payout|rebate|payout|support|amount/i) && pub.j.models.every((m) => Number.isInteger(m.free_months_up_to)));
  const tr = await fetch(BASE + '/api/rental-catalog/public/trust').then(async (r) => ({ s: r.status, j: await r.json() }));
  check('공개 신뢰지표 200·금액·연락처 없음', tr.s === 200 && !hasKey(tr.j, /amount|phone|account/i) && typeof tr.j.show === 'boolean', JSON.stringify(tr.j).slice(0, 120));

  // ── 3. 관리자 입력 검증
  check('가이드 만원단위 아님 400', (await call('PATCH', `/api/rental-catalog/offers/${offer.id}`, 'admin', { guide_payout: 371000 })).s === 400);
  check('MAX<가이드 400', (await call('PATCH', `/api/rental-catalog/offers/${offer.id}`, 'admin', { max_payout: 100000 })).s === 400);
  check('빈문자 지급액 400', (await call('PATCH', `/api/rental-catalog/offers/${offer.id}`, 'admin', { guide_payout: '' })).s === 400);
  check('잘못된 상태 400', (await call('PATCH', `/api/rental-catalog/offers/${offer.id}`, 'admin', { status: 'hacked' })).s === 400);
  check('uuid 아님 400', (await call('PATCH', '/api/rental-catalog/offers/abc', 'admin', { admin_notes: 'x' })).s === 400);
  check('없는 조건 404', (await call('PATCH', '/api/rental-catalog/offers/00000000-0000-0000-0000-000000000000', 'admin', { admin_notes: 'x' })).s === 404);
  check('마진규칙 margin_pct 없음 400', (await call('POST', '/api/rental-catalog/offers/apply-margin', 'admin', {})).s === 400);
  check('프로모션 기간없음 400', (await call('POST', '/api/rental-catalog/promotions', 'admin', { supplier_id: 'coway', title: 'QA' })).s === 400);
  check('프로모션 기간역전 400', (await call('POST', '/api/rental-catalog/promotions', 'admin', { supplier_id: 'coway', title: 'QA', period_from: '2026-09-30', period_to: '2026-09-01' })).s === 400);
  const noteBefore = am.j?.offers?.find?.((o) => o.id === offer.id)?.admin_notes ?? null;
  const pn = await call('PATCH', `/api/rental-catalog/offers/${offer.id}`, 'admin', { admin_notes: 'QA메모' });
  check('관리자 메모 저장 200', pn.s === 200, JSON.stringify(pn.j).slice(0, 120));
  await call('PATCH', `/api/rental-catalog/offers/${offer.id}`, 'admin', { admin_notes: noteBefore });

  // ── 4. 계산기 → 렌탈 계약 등록
  const phone = `010-0000-${String(Date.now()).slice(-4)}`;
  const app = { holder_type: '개인', birth_date: '1990-01-01', payment_method: '카드', billing_day: '10', consent_privacy: true, consent_third_party: true, consent_credit: true };
  const base = { sale_kind: 'rental', rental_offer_id: offer.id, customer_name: 'QA렌탈테스트', customer_phone: phone, customer_address: 'QA 주소', customer_address_detail: '101호', notes: 'QA', rental_application: app };
  check('지급액 가이드 미만 400', (await call('POST', '/api/incentive/sales', 'agent', { ...base, actual_payout: offer.guide_payout - 1000 })).s === 400);
  check('지급액 MAX 초과 400', (await call('POST', '/api/incentive/sales', 'agent', { ...base, actual_payout: offer.max_payout + 1000 })).s === 400);
  check('지급액 문자 400', (await call('POST', '/api/incentive/sales', 'agent', { ...base, actual_payout: 'abc' })).s === 400);
  check('지급액 소수 400', (await call('POST', '/api/incentive/sales', 'agent', { ...base, actual_payout: offer.guide_payout + 0.5 })).s === 400);
  const miss = await call('POST', '/api/incentive/sales', 'agent', { ...base, actual_payout: offer.guide_payout, rental_application: { holder_type: '개인' } });
  check('필수 가입정보 누락 400+fields', miss.s === 400 && miss.j?.fields, JSON.stringify(miss.j).slice(0, 120));
  const biz = await call('POST', '/api/incentive/sales', 'agent', { ...base, actual_payout: offer.guide_payout, rental_application: { ...app, holder_type: '법인사업자' } });
  check('법인 사업자정보 누락 400', biz.s === 400, `${biz.s}`);
  const pay = offer.guide_payout + 20000;
  const ok = await call('POST', '/api/incentive/sales', 'agent', { ...base, actual_payout: pay });
  const sale = ok.j?.sale || ok.j;
  if (sale?.id) created.push(sale.id);
  check('렌탈 계약 등록 성공', (ok.s === 200 || ok.s === 201) && sale?.sale_kind === 'rental', JSON.stringify(ok.j).slice(0, 200));
  check('등록응답 리베이트 숨김(상담원)', !hasKey(sale, /rebate/i) && !hasKey(sale?.rental_snapshot, /^source$/));
  check('스냅샷 티켓·가이드·MAX', sale?.rental_ticket_number === 'R006159' && sale?.guide_payout_snapshot === offer.guide_payout && sale?.max_payout_snapshot === offer.max_payout);
  check('payback_snapshot=실지급액', sale?.payback_snapshot === pay);
  const dup = await call('POST', '/api/incentive/sales', 'agent', { ...base, actual_payout: pay });
  if (dup.j?.sale?.id || (dup.s < 300 && dup.j?.id)) created.push(dup.j?.sale?.id || dup.j.id);
  check('연속 중복제출 409', dup.s === 409, `${dup.s}`);
  const phone2 = phone.replace(/\d{4}$/, (d) => String((Number(d) + 1) % 10000).padStart(4, '0'));
  const both = await Promise.all([1, 2].map(() => call('POST', '/api/incentive/sales', 'agent', { ...base, customer_phone: phone2, actual_payout: pay })));
  both.forEach((r) => { const id = r.j?.sale?.id || (r.s < 300 && r.j?.id); if (id) created.push(id); });
  const codes = both.map((r) => r.s).sort().join();
  check('동시 중복제출 1건 성공+409', codes === '200,409' || codes === '201,409', codes);

  const { data: row } = await sb.from('incentive_sales').select('rebate_snapshot').eq('id', sale.id).single();
  check('DB 에는 리베이트 박제', row?.rebate_snapshot > 0, JSON.stringify(row));
  const ls = await call('GET', '/api/incentive/sales?month=' + new Date().toISOString().slice(0, 7), 'agent');
  const mine = (ls.j?.sales || []).find((x) => x.id === sale.id);
  check('상담원 목록 리베이트 숨김', ls.s === 200 && mine && !hasKey(mine, /rebate/i), `${ls.s} found=${!!mine}`);
  // 계약부서는 계약처리 목록(/contracts)으로 본다
  const lc = await call('GET', '/api/incentive/contracts?month=' + sale.contract_date.slice(0, 7), 'contract');
  const cm = (lc.j?.contracts || []).find((x) => x.id === sale.id);
  const la = await call('GET', '/api/incentive/contracts?month=' + sale.contract_date.slice(0, 7), 'agent');
  const am2 = (la.j?.contracts || []).find((x) => x.id === sale.id);
  check('상담원 계약목록 리베이트 숨김', la.s === 200 && am2 && !hasKey(am2, /rebate/i), `${la.s} found=${!!am2}`);
  check('계약부서 목록 리베이트 보임', lc.s === 200 && cm && cm.rebate_snapshot > 0, `${lc.s} found=${!!cm}`);

  // ── 5. 계약처리 상세
  const rf = await call('GET', `/api/incentive/sales/${sale.id}/rental-form`, 'contract');
  check('렌탈 폼·체크리스트 200', rf.s === 200 && Array.isArray(rf.j?.checklist) && rf.j.checklist.length > 0);
  const P = (b) => call('PATCH', `/api/incentive/sales/${sale.id}`, 'contract', b);
  check('체크 "false" 문자열 400', (await P({ rental_process: { identity_verified: 'false' } })).s === 400);
  check('날짜 형식 오류 400', (await P({ rental_process: { install_done: '내일' } })).s === 400);
  check('지급액 MAX 초과 수정 400', (await P({ actual_payout: offer.max_payout + 1 })).s === 400);
  const pay2 = offer.guide_payout + 30000;
  const up = await P({ actual_payout: pay2 });
  check('지급액 범위내 수정 200', up.s === 200, JSON.stringify(up.j).slice(0, 150));
  const { data: r2 } = await sb.from('incentive_sales').select('actual_payout,payback_snapshot').eq('id', sale.id).single();
  check('수정 지급액=원장금액 동기화', r2.actual_payout === pay2 && r2.payback_snapshot === pay2, JSON.stringify(r2));
  const early = await P({ status: 'completed' });
  check('체크리스트 미완료 완료차단 400', early.s === 400 && early.j?.missing?.length > 0, `${early.s}`);
  const proc = {};
  for (const i of rf.j.checklist) proc[i.key] = i.type === 'date' ? '2026-09-20' : i.type === 'text' ? 'QA-ORDER-1' : true;
  const fill = await P({ rental_process: proc });
  check('체크리스트 저장 200', fill.s === 200, JSON.stringify(fill.j).slice(0, 150));
  const done = await P({ status: 'completed' });
  check('계약완료 200', done.s === 200, JSON.stringify(done.j).slice(0, 200));
  const { data: gift } = await sb.from('bongi_gifts').select('amount,name,product_name,ticket_no,auth_status').eq('source_sale_id', sale.id);
  check('사은품 원장 1건 생성', gift?.length === 1, JSON.stringify(gift));
  check('원장 금액·상품·티켓', gift?.[0]?.amount === pay2 && gift?.[0]?.ticket_no === 'R006159' && !!gift?.[0]?.product_name && gift?.[0]?.name === 'QA렌탈테스트', JSON.stringify(gift?.[0]));
  check('완료후 지급액 변경 400', (await P({ actual_payout: offer.guide_payout })).s === 400);
  // 정산: 렌탈 잔존마진(MAX − 지급액)에 렌탈 배분율이 붙는다 (이번 달 이 상담원의 다른 완료 건이 없다는 가정 대신 차이로 확인)
  const { data: saleRow } = await sb.from('incentive_sales').select('agent_id').eq('id', sale.id).single();
  const { data: st2, error: stErr } = await sb.rpc('incentive_calc_monthly_settlement', { p_agent_id: saleRow.agent_id, p_year_month: new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7) });
  const srow = Array.isArray(st2) ? st2[0] : st2;
  check('정산 렌탈 잔존마진·렌탈 배분율 반영', srow && srow.rental_residual_margin >= offer.max_payout - pay2 && Number(srow.rental_incentive_rate) === 30
    && srow.incentive === Math.round((srow.total_residual_margin - srow.rental_residual_margin) * Number(srow.incentive_rate_applied) / 100 + srow.rental_residual_margin * 30 / 100), JSON.stringify(srow || stErr).slice(0, 200));

  // ── 6. 판매중지 조건은 계약 불가
  const { data: paused } = await sb.from('rental_cat_offers').select('id').neq('status', 'active').limit(1);
  if (paused?.length) {
    const r = await call('POST', '/api/incentive/sales', 'agent', { ...base, customer_phone: '010-0000-0001', rental_offer_id: paused[0].id, actual_payout: pay });
    if (r.j?.sale?.id) created.push(r.j.sale.id);
    check('판매중 아닌 조건 계약 400', r.s === 400, `${r.s}`);
  }
} catch (e) {
  fails.push('예외 ' + e.stack); console.error(e);
} finally {
  for (const id of created) {
    await sb.from('bongi_gifts').delete().eq('source_sale_id', id);
    await sb.from('incentive_sales_history').delete().eq('sale_id', id);
    await sb.from('incentive_sales').delete().eq('id', id).eq('customer_name', 'QA렌탈테스트');
  }
  const { count } = await sb.from('incentive_sales').select('id', { count: 'exact', head: true }).in('id', created.length ? created : ['00000000-0000-0000-0000-000000000000']);
  console.log(`정리: QA 계약 ${created.length}건 삭제, 잔존 ${count}`);
  console.log(`\n결과: ${pass}/${pass + fails.length} 통과`);
  if (fails.length) { console.log('실패:\n - ' + fails.join('\n - ')); process.exitCode = 1; }
}
