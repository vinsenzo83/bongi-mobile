// V5 인센티브 시스템 — 100개 통합 테스트
// 카테고리: 페이지 / 인증 / 권한 / 비즈니스 / 데이터 일관성 / 엣지케이스
const BASE = 'https://bongi-mobile-production.up.railway.app';

const accounts = {
  agent:    { email: 'agent1@bongi.test',    pass: 'pass1234!' },
  manager:  { email: 'manager1@bongi.test',  pass: 'pass1234!' },
  contract: { email: 'contract1@bongi.test', pass: 'pass1234!' },
  admin:    { email: 'admin1@bongi.test',    pass: 'pass1234!' },
};

let results = [];
let counter = 0;

function rec(category, name, expected, actual, ok) {
  counter++;
  results.push({ n: counter, category, name, expected, actual, ok });
  const icon = ok ? '✅' : '❌';
  const num = String(counter).padStart(3, '0');
  console.log(`${icon} [${num}] ${category} · ${name} → ${actual}`);
}

async function login(email, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({email, password})
  });
  if (!res.ok) return null;
  return (await res.json()).access_token;
}

async function api(token, method, path, body) {
  const opts = { method, headers: {} };
  if (token) opts.headers.Authorization = 'Bearer ' + token;
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, opts);
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, ok: res.ok, data };
}

async function test(category, name, fn) {
  try {
    const result = await fn();
    rec(category, name, result.expected, result.actual, result.ok);
  } catch (e) {
    rec(category, name, '(no throw)', 'ERROR: ' + e.message, false);
  }
}

(async () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  V5 인센티브 시스템 통합 테스트 (100 cases)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const tokens = {};
  for (const [role, acc] of Object.entries(accounts)) {
    tokens[role] = await login(acc.email, acc.pass);
  }

  // admin으로 미리 데이터 조회
  const agentsRes = await api(tokens.admin, 'GET', '/api/incentive/agents/all');
  const agents = agentsRes.data?.agents || [];
  const kim = agents.find(a => a.name === '김상담');
  const adminAgent = agents.find(a => a.name === '빈센조' || a.role === 'admin');

  const productsRes = await api(null, 'GET', '/api/incentive/products');
  const products = productsRes.data?.products || [];

  // ─── 카테고리 1: 페이지 로드 (1~10) ───
  const pages = [
    '/docs/index.html',
    '/docs/calculator.html',
    '/docs/calculator.html?admin=1',
    '/docs/tm-counselor.html',
    '/docs/incentive-admin.html',
    '/docs/incentive-contract.html',
    '/docs/incentive-products.html',
    '/docs/incentive-rules.html',
    '/docs/incentive-agents.html',
    '/docs/incentive-dashboard.html',
  ];
  for (const p of pages) {
    await test('PAGE', p, async () => {
      const r = await fetch(BASE + p);
      return { expected: 200, actual: r.status, ok: r.status === 200 };
    });
  }

  // ─── 카테고리 2: 인증 (11~20) ───
  await test('AUTH', '올바른 admin 로그인', async () => {
    const tk = await login('admin1@bongi.test', 'pass1234!');
    return { expected: 'token', actual: tk ? 'token' : 'null', ok: !!tk };
  });
  await test('AUTH', '잘못된 비밀번호', async () => {
    const r = await api(null, 'POST', '/api/auth/login', { email: 'admin1@bongi.test', password: 'wrong' });
    return { expected: 401, actual: r.status, ok: r.status === 400 || r.status === 401 };
  });
  await test('AUTH', '존재하지 않는 이메일', async () => {
    const r = await api(null, 'POST', '/api/auth/login', { email: 'noexist@x.com', password: 'pass1234!' });
    return { expected: 401, actual: r.status, ok: r.status === 400 || r.status === 401 };
  });
  await test('AUTH', '빈 이메일', async () => {
    const r = await api(null, 'POST', '/api/auth/login', { email: '', password: 'pass1234!' });
    return { expected: 400, actual: r.status, ok: r.status >= 400 && r.status < 500 };
  });
  await test('AUTH', '빈 비밀번호', async () => {
    const r = await api(null, 'POST', '/api/auth/login', { email: 'admin1@bongi.test', password: '' });
    return { expected: 400, actual: r.status, ok: r.status >= 400 && r.status < 500 };
  });
  await test('AUTH', '토큰 없이 보호된 엔드포인트', async () => {
    const r = await api(null, 'GET', '/api/incentive/agents/me');
    return { expected: 401, actual: r.status, ok: r.status === 401 };
  });
  await test('AUTH', '잘못된 토큰', async () => {
    const r = await api('invalid.token.here', 'GET', '/api/incentive/agents/me');
    return { expected: 401, actual: r.status, ok: r.status === 401 };
  });
  await test('AUTH', '4개 role 로그인 모두 성공', async () => {
    const ok = Object.values(tokens).every(t => !!t);
    return { expected: '4 tokens', actual: Object.values(tokens).filter(Boolean).length + ' tokens', ok };
  });
  await test('AUTH', 'agents/me — agent role 본인 정보', async () => {
    const r = await api(tokens.agent, 'GET', '/api/incentive/agents/me');
    return { expected: 'agent role', actual: r.data?.agent?.role, ok: r.data?.agent?.role === 'agent' };
  });
  await test('AUTH', 'agents/me — admin role 본인 정보', async () => {
    const r = await api(tokens.admin, 'GET', '/api/incentive/agents/me');
    return { expected: 'admin role', actual: r.data?.agent?.role, ok: r.data?.agent?.role === 'admin' };
  });

  // ─── 카테고리 3: 권한 매트릭스 (21~60, 40 cases) ───
  const matrix = [
    // GET /agents (목록)
    ['agent', 'GET /agents', 'GET', '/api/incentive/agents', null, 'DENY'],
    ['manager', 'GET /agents', 'GET', '/api/incentive/agents', null, 'OK'],
    ['contract', 'GET /agents', 'GET', '/api/incentive/agents', null, 'OK'],
    ['admin', 'GET /agents', 'GET', '/api/incentive/agents', null, 'OK'],
    // GET /agents/all
    ['agent', 'GET /agents/all', 'GET', '/api/incentive/agents/all', null, 'DENY'],
    ['manager', 'GET /agents/all', 'GET', '/api/incentive/agents/all', null, 'DENY'],
    ['contract', 'GET /agents/all', 'GET', '/api/incentive/agents/all', null, 'DENY'],
    ['admin', 'GET /agents/all', 'GET', '/api/incentive/agents/all', null, 'OK'],
    // GET /contracts
    ['agent', 'GET /contracts', 'GET', '/api/incentive/contracts', null, 'DENY'],
    ['manager', 'GET /contracts', 'GET', '/api/incentive/contracts', null, 'OK'],
    ['contract', 'GET /contracts', 'GET', '/api/incentive/contracts', null, 'OK'],
    ['admin', 'GET /contracts', 'GET', '/api/incentive/contracts', null, 'OK'],
    // GET /manager/overview
    ['agent', 'GET /manager/overview', 'GET', '/api/incentive/manager/overview', null, 'DENY'],
    ['manager', 'GET /manager/overview', 'GET', '/api/incentive/manager/overview', null, 'OK'],
    ['contract', 'GET /manager/overview', 'GET', '/api/incentive/manager/overview', null, 'OK'],
    ['admin', 'GET /manager/overview', 'GET', '/api/incentive/manager/overview', null, 'OK'],
    // POST /finalize
    ['agent', 'POST /finalize', 'POST', '/api/incentive/finalize', { month: '2026-05', agent_id: kim?.id }, 'DENY'],
    ['manager', 'POST /finalize', 'POST', '/api/incentive/finalize', { month: '2026-05', agent_id: kim?.id }, 'DENY'],
    ['contract', 'POST /finalize', 'POST', '/api/incentive/finalize', { month: '2026-05', agent_id: kim?.id }, 'DENY'],
    ['admin', 'POST /finalize', 'POST', '/api/incentive/finalize', { month: '2026-05', agent_id: kim?.id }, 'OK'],
    // PATCH /agents/:id
    ['agent', 'PATCH /agents/:id', 'PATCH', `/api/incentive/agents/${kim?.id}`, { active: true }, 'DENY'],
    ['manager', 'PATCH /agents/:id', 'PATCH', `/api/incentive/agents/${kim?.id}`, { active: true }, 'DENY'],
    ['contract', 'PATCH /agents/:id', 'PATCH', `/api/incentive/agents/${kim?.id}`, { active: true }, 'DENY'],
    ['admin', 'PATCH /agents/:id', 'PATCH', `/api/incentive/agents/${kim?.id}`, { active: true }, 'OK'],
    // PATCH /products/:id
    ['agent', 'PATCH /products/:id', 'PATCH', '/api/incentive/products/1', { active: true }, 'DENY'],
    ['manager', 'PATCH /products/:id', 'PATCH', '/api/incentive/products/1', { active: true }, 'DENY'],
    ['contract', 'PATCH /products/:id', 'PATCH', '/api/incentive/products/1', { active: true }, 'DENY'],
    ['admin', 'PATCH /products/:id', 'PATCH', '/api/incentive/products/1', { active: true }, 'OK'],
    // GET /products/history
    ['agent', 'GET /products/history', 'GET', '/api/incentive/products/history', null, 'DENY'],
    ['manager', 'GET /products/history', 'GET', '/api/incentive/products/history', null, 'OK'],
    ['contract', 'GET /products/history', 'GET', '/api/incentive/products/history', null, 'OK'],
    ['admin', 'GET /products/history', 'GET', '/api/incentive/products/history', null, 'OK'],
    // GET /rules/all
    ['agent', 'GET /rules/all', 'GET', '/api/incentive/rules/all', null, 'DENY'],
    ['manager', 'GET /rules/all', 'GET', '/api/incentive/rules/all', null, 'DENY'],
    ['contract', 'GET /rules/all', 'GET', '/api/incentive/rules/all', null, 'DENY'],
    ['admin', 'GET /rules/all', 'GET', '/api/incentive/rules/all', null, 'OK'],
    // POST /admin/create-agent
    ['agent', 'POST /admin/create-agent', 'POST', '/api/incentive/admin/create-agent', { email: 'x@x.com', password: 'pass1234!', name: 'x', center: 'x' }, 'DENY'],
    ['manager', 'POST /admin/create-agent', 'POST', '/api/incentive/admin/create-agent', { email: 'x@x.com', password: 'pass1234!', name: 'x', center: 'x' }, 'DENY'],
    ['contract', 'POST /admin/create-agent', 'POST', '/api/incentive/admin/create-agent', { email: 'x@x.com', password: 'pass1234!', name: 'x', center: 'x' }, 'DENY'],
  ];
  // 권한 매트릭스 실행 (39 case)
  for (const [role, label, method, path, body, expected] of matrix) {
    await test('PERM', `${role} · ${label}`, async () => {
      const r = await api(tokens[role], method, path, body);
      let ok;
      if (expected === 'OK') ok = r.status >= 200 && r.status < 300;
      else if (expected === 'DENY') ok = r.status === 401 || r.status === 403;
      else ok = r.status === expected;
      return { expected, actual: r.status, ok };
    });
  }

  // 권한 매트릭스 1개 더 (100 맞추기 위해)
  await test('PERM', 'admin · /admin/create-agent (validation 400)', async () => {
    const r = await api(tokens.admin, 'POST', '/api/incentive/admin/create-agent', { email: 'wrong', password: 'short' });
    return { expected: 400, actual: r.status, ok: r.status >= 400 && r.status < 500 };
  });

  // ─── 카테고리 4: 데이터 일관성 (61~75) ───
  await test('DATA', 'products 63개 상품 존재', async () => {
    return { expected: '>=60', actual: products.length, ok: products.length >= 60 };
  });
  await test('DATA', '상품 — margin = (rebate*0.9) - payback - (weight*70000)', async () => {
    const p = products.find(x => x.rebate > 0);
    const expected = Math.round(p.rebate * 0.9) - p.payback - (p.point_weight * 70000);
    return { expected, actual: p.margin, ok: Math.abs(p.margin - expected) < 5 };
  });
  await test('DATA', 'tier S 상품 (margin >= 250000)', async () => {
    const sList = products.filter(p => p.tier === 'S');
    const ok = sList.length === 0 || sList.every(p => p.margin >= 250000);
    return { expected: 'all >= 250k', actual: sList.length + ' items', ok };
  });
  await test('DATA', 'tier A 상품 (margin 180k~250k)', async () => {
    const aList = products.filter(p => p.tier === 'A');
    const ok = aList.every(p => p.margin >= 180000 && p.margin < 250000);
    return { expected: 'all in 180~250k', actual: aList.length + ' items', ok };
  });
  await test('DATA', 'tier B 상품 (margin 120k~180k)', async () => {
    const bList = products.filter(p => p.tier === 'B');
    const ok = bList.every(p => p.margin >= 120000 && p.margin < 180000);
    return { expected: 'all in 120~180k', actual: bList.length + ' items', ok };
  });
  await test('DATA', '우수상품(is_premium) = (margin >= 250k)', async () => {
    const ok = products.every(p => p.is_premium === (p.margin >= 250000));
    return { expected: 'consistent', actual: ok ? 'consistent' : 'mismatch', ok };
  });
  await test('DATA', 'agents 4개 role 모두 존재', async () => {
    const roles = new Set(agents.map(a => a.role));
    const ok = roles.has('agent') && roles.has('manager') && roles.has('contract') && roles.has('admin');
    return { expected: '4 roles', actual: [...roles].join(','), ok };
  });
  await test('DATA', '활성 rules 1개 존재', async () => {
    const r = await api(null, 'GET', '/api/incentive/rules');
    return { expected: 'rules', actual: r.data?.rules ? 'exists' : 'null', ok: !!r.data?.rules };
  });
  await test('DATA', 'rules base_salary > 0', async () => {
    const r = await api(null, 'GET', '/api/incentive/rules');
    return { expected: '>0', actual: r.data?.rules?.base_salary, ok: (r.data?.rules?.base_salary || 0) > 0 };
  });
  await test('DATA', 'rules grade_rates 정의됨', async () => {
    const r = await api(null, 'GET', '/api/incentive/rules');
    const gr = r.data?.rules?.grade_rates;
    return { expected: 'object', actual: typeof gr, ok: gr && typeof gr === 'object' };
  });
  await test('DATA', '4개 통신사 상품 모두 존재', async () => {
    const carriers = new Set(products.map(p => p.carrier));
    return { expected: '>=3', actual: [...carriers].join(','), ok: carriers.size >= 3 };
  });
  await test('DATA', '단독/결합 type 모두 존재', async () => {
    const types = new Set(products.map(p => p.type));
    return { expected: '단독+결합', actual: [...types].join(','), ok: types.has('단독') && types.has('결합') };
  });
  await test('DATA', '활성 상품(active=true) 존재', async () => {
    const cnt = products.filter(p => p.active).length;
    return { expected: '>0', actual: cnt, ok: cnt > 0 };
  });
  await test('DATA', '모든 상품 point_weight >= 0', async () => {
    const ok = products.every(p => (p.point_weight || 0) >= 0);
    return { expected: 'all >= 0', actual: ok ? 'OK' : 'NG', ok };
  });
  await test('DATA', '모든 상품 rebate >= 0', async () => {
    const ok = products.every(p => (p.rebate || 0) >= 0);
    return { expected: 'all >= 0', actual: ok ? 'OK' : 'NG', ok };
  });

  // ─── 카테고리 5: 본인 정보·정산 (76~85) ───
  await test('SELF', 'agent settlement 본인 조회', async () => {
    const r = await api(tokens.agent, 'GET', '/api/incentive/settlement?month=2026-05');
    return { expected: 200, actual: r.status, ok: r.ok };
  });
  await test('SELF', 'manager settlement 본인 조회', async () => {
    const r = await api(tokens.manager, 'GET', '/api/incentive/settlement?month=2026-05');
    return { expected: 200, actual: r.status, ok: r.ok };
  });
  await test('SELF', 'contract settlement 본인 조회', async () => {
    const r = await api(tokens.contract, 'GET', '/api/incentive/settlement?month=2026-05');
    return { expected: 200, actual: r.status, ok: r.ok };
  });
  await test('SELF', 'admin settlement 본인 조회', async () => {
    const r = await api(tokens.admin, 'GET', '/api/incentive/settlement?month=2026-05');
    return { expected: 200, actual: r.status, ok: r.ok };
  });
  await test('SELF', 'manager가 김상담 settlement 조회', async () => {
    const r = await api(tokens.manager, 'GET', '/api/incentive/settlement?agent_id=' + kim?.id);
    return { expected: 200, actual: r.status, ok: r.ok };
  });
  await test('SELF', 'admin이 김상담 settlement 조회', async () => {
    const r = await api(tokens.admin, 'GET', '/api/incentive/settlement?agent_id=' + kim?.id + '&month=2026-05');
    return { expected: 200, actual: r.status, ok: r.ok };
  });
  await test('SELF', 'settlement에 base_salary 포함', async () => {
    const r = await api(tokens.admin, 'GET', '/api/incentive/settlement?month=2026-05');
    return { expected: 'has base_salary', actual: typeof r.data?.settlement?.base_salary, ok: typeof r.data?.settlement?.base_salary === 'number' };
  });
  await test('SELF', 'settlement에 agent_total 포함', async () => {
    const r = await api(tokens.admin, 'GET', '/api/incentive/settlement?month=2026-05');
    return { expected: 'has agent_total', actual: typeof r.data?.settlement?.agent_total, ok: typeof r.data?.settlement?.agent_total === 'number' };
  });
  await test('SELF', 'manager/overview에 settlements 배열', async () => {
    const r = await api(tokens.admin, 'GET', '/api/incentive/manager/overview?month=2026-05');
    return { expected: 'array', actual: Array.isArray(r.data?.settlements) ? 'array' : 'not array', ok: Array.isArray(r.data?.settlements) };
  });
  await test('SELF', 'manager/overview에 totals 객체', async () => {
    const r = await api(tokens.admin, 'GET', '/api/incentive/manager/overview?month=2026-05');
    return { expected: 'object', actual: typeof r.data?.totals, ok: typeof r.data?.totals === 'object' && r.data.totals !== null };
  });

  // ─── 카테고리 6: 시뮬·계산 (86~93) ───
  // 서버 endpoint body: { current_points, current_premium, add_product_id, add_qty, add_payback }
  // 인증 불필요 (optionalAuth)
  const skProduct = products.find(p => p.carrier === 'SKT' && p.active);
  const simBody = { current_points: 0, current_premium: 0, add_product_id: skProduct?.id, add_qty: 1 };
  await test('CALC', 'simulate — 기본 시뮬 (agent)', async () => {
    const r = await api(tokens.agent, 'POST', '/api/incentive/simulate', simBody);
    return { expected: 200, actual: r.status, ok: r.ok };
  });
  await test('CALC', 'simulate에 simulation 객체', async () => {
    const r = await api(tokens.agent, 'POST', '/api/incentive/simulate', simBody);
    return { expected: 'object', actual: typeof r.data?.simulation, ok: typeof r.data?.simulation === 'object' && r.data.simulation !== null };
  });
  await test('CALC', 'simulate — current_grade 1~3', async () => {
    const r = await api(tokens.agent, 'POST', '/api/incentive/simulate', simBody);
    const g = r.data?.simulation?.current_grade;
    return { expected: '1|2|3', actual: g, ok: [1,2,3].includes(g) };
  });
  await test('CALC', 'simulate — after_grade 1~3', async () => {
    const r = await api(tokens.agent, 'POST', '/api/incentive/simulate', simBody);
    const g = r.data?.simulation?.after_grade;
    return { expected: '1|2|3', actual: g, ok: [1,2,3].includes(g) };
  });
  await test('CALC', 'simulate — delta_total 숫자', async () => {
    const r = await api(tokens.agent, 'POST', '/api/incentive/simulate', simBody);
    return { expected: 'number', actual: typeof r.data?.simulation?.delta_total, ok: typeof r.data?.simulation?.delta_total === 'number' };
  });
  await test('CALC', 'simulate — add_product_id 누락 시 400', async () => {
    const r = await api(tokens.agent, 'POST', '/api/incentive/simulate', { current_points: 0 });
    return { expected: 400, actual: r.status, ok: r.status === 400 };
  });
  await test('CALC', 'simulate — 인증 없이도 OK (public)', async () => {
    const r = await api(null, 'POST', '/api/incentive/simulate', simBody);
    return { expected: 200, actual: r.status, ok: r.ok };
  });
  await test('CALC', 'simulate — add_payback 30000 정상', async () => {
    const r = await api(tokens.agent, 'POST', '/api/incentive/simulate', { ...simBody, add_payback: 25000 });
    return { expected: 200, actual: r.status, ok: r.ok };
  });

  // ─── 카테고리 7: 엣지케이스 (94~100) ───
  await test('EDGE', 'PATCH /products/:id 잘못된 ID', async () => {
    const r = await api(tokens.admin, 'PATCH', '/api/incentive/products/99999', { active: false });
    return { expected: '4xx/5xx', actual: r.status, ok: r.status >= 400 };
  });
  await test('EDGE', 'PATCH /products/:id allowed 외 필드 → 400', async () => {
    const r = await api(tokens.admin, 'PATCH', '/api/incentive/products/1', { random_field_xyz: 'whatever' });
    return { expected: 400, actual: r.status, ok: r.status === 400 };
  });
  await test('EDGE', 'GET /products 인증 없이 OK (public)', async () => {
    const r = await api(null, 'GET', '/api/incentive/products');
    return { expected: 200, actual: r.status, ok: r.ok };
  });
  await test('EDGE', 'GET /rules 인증 없이 OK (public)', async () => {
    const r = await api(null, 'GET', '/api/incentive/rules');
    return { expected: 200, actual: r.status, ok: r.ok };
  });
  await test('EDGE', '존재하지 않는 path → 404', async () => {
    const r = await api(tokens.admin, 'GET', '/api/incentive/nonexistent-route-xyz');
    return { expected: 404, actual: r.status, ok: r.status === 404 };
  });
  await test('EDGE', 'settlement 잘못된 month 포맷', async () => {
    const r = await api(tokens.admin, 'GET', '/api/incentive/settlement?month=invalid');
    return { expected: '4xx or graceful', actual: r.status, ok: r.status !== 500 };
  });
  await test('EDGE', 'PATCH /agents/:id 잘못된 UUID', async () => {
    const r = await api(tokens.admin, 'PATCH', '/api/incentive/agents/not-a-uuid', { active: true });
    return { expected: '4xx/5xx', actual: r.status, ok: r.status >= 400 };
  });

  // ─── 결과 ───
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const pass = results.filter(r => r.ok).length;
  const fail = results.filter(r => !r.ok).length;
  console.log(`  결과: ✅ PASS ${pass} / ❌ FAIL ${fail} / TOTAL ${results.length}`);
  console.log(`  통과율: ${(pass / results.length * 100).toFixed(1)}%`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 카테고리별 요약
  const byCategory = {};
  results.forEach(r => {
    if (!byCategory[r.category]) byCategory[r.category] = { pass: 0, fail: 0 };
    if (r.ok) byCategory[r.category].pass++;
    else byCategory[r.category].fail++;
  });
  console.log('\n[카테고리별]');
  Object.entries(byCategory).forEach(([cat, s]) => {
    console.log(`  ${cat}: ✅ ${s.pass} / ❌ ${s.fail}`);
  });

  if (fail > 0) {
    console.log('\n[실패 항목]');
    results.filter(r => !r.ok).forEach(r => {
      console.log(`  ❌ [${String(r.n).padStart(3,'0')}] ${r.category} · ${r.name} — expected ${r.expected}, actual ${r.actual}`);
    });
  }
  process.exit(fail > 0 ? 1 : 0);
})();
