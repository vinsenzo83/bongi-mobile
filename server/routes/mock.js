import { Router } from 'express';
import { customers, tickets } from '../data/mock/store.js';
import { BASE_SALARY, INCENTIVE_PER_ITEM, GRADES } from '../data/constants.js';

const router = Router();

// ─── 고객 목록 (필터/검색/페이지네이션) ───
router.get('/customers', (req, res) => {
  const { filter, q, agent, product, store, source, page = 1, perPage = 20 } = req.query;

  let result = [...customers];
  if (filter && filter !== '전체') result = result.filter(r => r.status === filter);
  if (q) result = result.filter(r => r.name.includes(q) || r.phone.includes(q));
  if (agent && agent !== '') result = result.filter(r => r.agent === agent);
  if (product && product !== '') result = result.filter(r => r.product === product);
  if (store && store !== '') result = result.filter(r => r.store === store);
  if (source && source !== '') result = result.filter(r => r.source === source);

  const total = result.length;
  const start = (page - 1) * perPage;
  const data = result.slice(start, start + Number(perPage));

  // 상태별 카운트
  const statusCounts = {};
  customers.forEach(c => { statusCounts[c.status] = (statusCounts[c.status] || 0) + 1; });

  res.json({ data, total, page: Number(page), perPage: Number(perPage), statusCounts });
});

// ─── 고객 상세 ───
router.get('/customers/:name', (req, res) => {
  const customer = customers.find(c => c.name === decodeURIComponent(req.params.name));
  if (!customer) return res.status(404).json({ error: '고객 없음' });
  res.json(customer);
});

// ─── 고객 상태 변경 ───
router.patch('/customers/:name', (req, res) => {
  const customer = customers.find(c => c.name === decodeURIComponent(req.params.name));
  if (!customer) return res.status(404).json({ error: '고객 없음' });
  Object.assign(customer, req.body);
  res.json(customer);
});

// ─── 고객 등록 ───
router.post('/customers', (req, res) => {
  const newCustomer = { ...req.body, time: '방금' };
  customers.unshift(newCustomer);
  res.status(201).json(newCustomer);
});

// ─── 일괄 배정 ───
router.post('/customers/bulk-assign', (req, res) => {
  const { names, agent } = req.body;
  let count = 0;
  names.forEach(name => {
    const c = customers.find(r => r.name === name);
    if (c) { c.agent = agent; count++; }
  });
  res.json({ assigned: count });
});

// ─── 티켓 목록 ───
router.get('/tickets', (req, res) => {
  const { carrier, category, q } = req.query;
  let result = [...tickets];
  if (carrier) result = result.filter(t => t.carrier === carrier);
  if (category) result = result.filter(t => t.category === category);
  if (q) result = result.filter(t => t.name.includes(q) || String(t.id) === q);
  res.json(result);
});

// ─── 티켓 단일 조회 ───
router.get('/tickets/:id', (req, res) => {
  const ticket = tickets.find(t => t.id === Number(req.params.id));
  if (!ticket) return res.status(404).json({ error: '티켓 없음' });
  res.json(ticket);
});

// ─── 상담사 목록 ───
router.get('/agents', (req, res) => {
  res.json([
    { id: 1, name: '김상담', role: 'agent', grade: 'ace', active: true, assigned: customers.filter(c => c.agent === '김상담').length },
    { id: 2, name: '이상담', role: 'agent', grade: 'pro', active: true, assigned: customers.filter(c => c.agent === '이상담').length },
    { id: 3, name: '박상담', role: 'agent', grade: 'rookie', active: true, assigned: customers.filter(c => c.agent === '박상담').length },
    { id: 4, name: '최상담', role: 'agent', grade: 'pro', active: true, assigned: customers.filter(c => c.agent === '최상담').length },
  ]);
});

// ─── 대시보드 KPI ───
router.get('/dashboard/kpi', (req, res) => {
  const statusCounts = {};
  customers.forEach(c => { statusCounts[c.status] = (statusCounts[c.status] || 0) + 1; });

  const newCount = statusCounts['신규유입'] || 0;
  const consultingCount = (statusCounts['진행중'] || 0) + (statusCounts['상담중'] || 0);
  const contractCount = statusCounts['계약완료'] || 0;
  const installCount = statusCounts['설치완료'] || 0;
  const happyCallCount = (statusCounts['해피콜대기'] || 0) + (statusCounts['업셀링관심있음'] || 0);
  const recallCount = statusCounts['재연락예약'] || 0;

  res.json({
    total: customers.length,
    newCount,
    consultingCount,
    contractCount,
    installCount,
    happyCallCount,
    recallCount,
    unassigned: customers.filter(c => c.agent === '미배정').length,
    statusCounts,
    ticketCount: tickets.length,
  });
});

// ─── 해피콜 대상 목록 ───
router.get('/happycall', (req, res) => {
  const list = customers.filter(c => ['해피콜대기', '업셀링관심있음'].includes(c.status));
  res.json(list);
});

// ─── 계약 목록 (mock) ───
router.get('/contracts', (req, res) => {
  const list = customers
    .filter(c => ['계약완료', '설치완료'].includes(c.status))
    .map((c, i) => ({
      id: i + 1,
      customer: c.name,
      phone: c.phone,
      product: c.product,
      agent: c.agent,
      status: c.status,
      store: c.store || '-',
      date: c.time,
    }));
  res.json(list);
});

// ─── 상담사 실적 (mock) ───
router.get('/agents/:name/stats', (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const myCustomers = customers.filter(c => c.agent === name);
  res.json({
    name,
    total: myCustomers.length,
    contracted: myCustomers.filter(c => c.status === '계약완료').length,
    installed: myCustomers.filter(c => c.status === '설치완료').length,
    inProgress: myCustomers.filter(c => c.status === '진행중').length,
    happyCall: myCustomers.filter(c => ['해피콜대기', '업셀링관심있음'].includes(c.status)).length,
    recall: myCustomers.filter(c => c.status === '재연락예약').length,
  });
});

// ─── 권한 데이터 (mock) ───
router.get('/permissions', (req, res) => {
  res.json({
    인터넷: { count: 3, maxAmount: '₩5만' },
    TV: { count: 2, maxAmount: '₩3만' },
    결합: { count: 3, maxAmount: '₩8만' },
    렌탈: { count: 0, maxAmount: '₩3만' },
  });
});

// ─── CTI 테스트 팝업 데이터 ───
router.get('/cti/test-popups', (req, res) => {
  res.json({
    ticket_call: { name:'이지현', phone:'010-****-5678', source:'ticket_call', carrier:'KT', contract_expiry:'D-12 ⚠', memo:null, ticket_no:41 },
    callback:    { name:'류승현', phone:'010-****-1122', source:'callback', carrier:'SKT', contract_expiry:'-', memo:null, ticket_no:27 },
    kakao_chat:  { name:'한지민', phone:'010-****-4433', source:'kakao_chat', carrier:'LGU+', contract_expiry:'-',
      memo:'[카카오채팅]\n고객: LG 인터넷 요금이 궁금해요\n상담원: 어떤 상품 보셨나요?\n고객: 앱에서 63번 상품이요', ticket_no:63 },
    qna_board:   { name:'송예진', phone:'010-****-5544', source:'qna_board', carrier:'LG헬로', contract_expiry:'-',
      memo:'[Q&A 게시판]\n제목: 헬로비전 500M 견적 문의\n내용: 티켓 119번 상품 상담 원합니다', ticket_no:119 },
    no_name:     { name:null, phone:'010-9999-3388', source:'ticket_call', carrier:'', contract_expiry:'-', memo:null, ticket_no:null },
  });
});

// ─── CTI 유입경로 메타 ───
router.get('/cti/source-meta', (req, res) => {
  res.json({
    ticket_call: { label:'📞 티켓전화', color:'var(--red)', bg:'rgba(239,68,68,.1)', desc:'티켓을 직접 열고 전화 — 전환율 최고' },
    callback:    { label:'🔔 콜백신청', color:'var(--amber)', bg:'rgba(245,158,11,.08)', desc:'상담 신청 후 연락 대기 중' },
    kakao_chat:  { label:'💬 카카오채팅', color:'#92700a', bg:'rgba(245,198,11,.08)', desc:'카카오 채팅 후 전화 연결' },
    qna_board:   { label:'📋 Q&A게시판', color:'var(--purple)', bg:'rgba(139,92,246,.08)', desc:'게시판 문의 후 전화 연결' },
    store:       { label:'🏪 매장개통', color:'var(--teal)', bg:'rgba(20,184,166,.08)', desc:'매장 개통 고객 해피콜' },
  });
});

// ─── 통신사 스타일 ───
router.get('/cti/carrier-style', (req, res) => {
  res.json({
    SKB:          { color:'#dc2626', bg:'rgba(220,38,38,.1)', label:'🔴 SKB' },
    SKT:          { color:'#dc2626', bg:'rgba(220,38,38,.1)', label:'🔴 SKT' },
    KT:           { color:'#2563eb', bg:'rgba(37,99,235,.1)', label:'🔵 KT' },
    'KT스카이라이프': { color:'#2563eb', bg:'rgba(37,99,235,.1)', label:'🔵 SKY' },
    'LGU+':       { color:'#7c3aed', bg:'rgba(124,58,237,.1)', label:'🟣 LGU+' },
    'LG헬로':     { color:'#7c3aed', bg:'rgba(124,58,237,.1)', label:'🟣 헬로' },
  });
});

// ─── 권한 데이터 (ADM-002) ───
router.get('/cti/permissions', (req, res) => {
  res.json({
    internet: { cnt:3, max:50000, label:'📡 인터넷', color:'var(--blue)' },
    tv:       { cnt:2, max:30000, label:'📺 TV', color:'var(--teal)' },
    comb:     { cnt:3, max:80000, label:'📦 결합', color:'var(--green)' },
    rental:   { cnt:0, max:30000, label:'🏠 렌탈', color:'var(--amber)' },
  });
});

// ─── KPI 대시보드 (ADM-006) ───
router.get('/dashboard/kpi/detail', (req, res) => {
  const statusCounts = {};
  customers.forEach(c => { statusCounts[c.status] = (statusCounts[c.status] || 0) + 1; });

  const agentStats = ['김상담', '이상담', '박상담', '최상담'].map(name => {
    const my = customers.filter(c => c.agent === name);
    return {
      name,
      total: my.length,
      contracted: my.filter(c => c.status === '계약완료').length,
      installed: my.filter(c => c.status === '설치완료').length,
      inProgress: my.filter(c => c.status === '진행중').length,
      conversionRate: my.length > 0 ? Math.round((my.filter(c => ['계약완료','설치완료'].includes(c.status)).length / my.length) * 100) : 0,
    };
  });

  const channelStats = {};
  customers.forEach(c => { channelStats[c.source] = (channelStats[c.source] || 0) + 1; });

  const productStats = {};
  customers.forEach(c => { productStats[c.product] = (productStats[c.product] || 0) + 1; });

  res.json({
    total: customers.length,
    statusCounts,
    agentStats,
    channelStats,
    productStats,
    avgAHT: '08:42',
    todayNew: statusCounts['신규유입'] || 0,
    todayContract: statusCounts['계약완료'] || 0,
    monthlyTarget: 150,
    monthlyActual: (statusCounts['계약완료'] || 0) + (statusCounts['설치완료'] || 0),
  });
});

// ─── 인센티브 설정 (ADM-032) — 공통 상수에서 가져옴 ───
router.get('/incentive/config', (req, res) => {
  res.json({ baseSalary: BASE_SALARY, perItem: INCENTIVE_PER_ITEM, grades: GRADES });
});

// ─── 사은품 지급 목록 (ADM-016/030) ───
router.get('/gifts', (req, res) => {
  const list = customers
    .filter(c => ['계약완료', '설치완료'].includes(c.status))
    .map((c, i) => ({
      id: i + 1,
      customer: c.name,
      phone: c.phone,
      product: c.product,
      amount: c.product === '인터넷/TV' ? 370000 : c.product === '렌탈' ? 150000 : c.product === '유심' ? 20000 : 30000,
      status: i % 3 === 0 ? '입금완료' : i % 3 === 1 ? '입금대기' : '확인필요',
      agent: c.agent,
      date: c.time,
    }));
  res.json(list);
});

// ─── 수수료 정산 (ADM-015) ───
router.get('/commission', (req, res) => {
  const agents = ['김상담', '이상담', '박상담', '최상담'].map(name => {
    const my = customers.filter(c => c.agent === name && ['계약완료','설치완료'].includes(c.status));
    const internet = my.filter(c => c.product === '인터넷/TV').length;
    const rental = my.filter(c => c.product === '렌탈').length;
    const usim = my.filter(c => c.product === '유심').length;
    const etc = my.filter(c => !['인터넷/TV','렌탈','유심'].includes(c.product)).length;
    return {
      name,
      internet, rental, usim, etc,
      total: my.length,
      commission: internet * 25000 + rental * 30000 + usim * 7000 + etc * 4000,
    };
  });
  res.json({ agents, totalCommission: agents.reduce((a, b) => a + b.commission, 0) });
});

// ─── 칸반 티켓 (ADM-004) ───
router.get('/kanban', (req, res) => {
  const columns = {
    waiting: customers.filter(c => ['신규유입','해피콜대기'].includes(c.status)).map(c => ({ ...c, priority: c.time.includes('⚠') ? 'urgent' : 'normal' })),
    reviewing: customers.filter(c => ['진행중','상담중','업셀링관심있음'].includes(c.status)),
    approving: customers.filter(c => ['재연락예약'].includes(c.status)),
    done: customers.filter(c => ['계약완료','설치완료'].includes(c.status)).slice(0, 10),
  };
  res.json(columns);
});

// ─── 매장 목록 ───
router.get('/stores', (req, res) => {
  res.json([
    { id:1, name:'상무점', region:'광주' },
    { id:2, name:'동구점', region:'광주' },
    { id:3, name:'서구점', region:'광주' },
    { id:4, name:'북구점', region:'광주' },
    { id:5, name:'남구점', region:'광주' },
    { id:6, name:'광산점', region:'광주' },
    { id:7, name:'목포점', region:'전남' },
    { id:8, name:'여수점', region:'전남' },
    { id:9, name:'순천점', region:'전남' },
    { id:10, name:'나주점', region:'전남' },
  ]);
});

// Mock Store에서 로드됨 (store.js에서 로그 출력)

export default router;
