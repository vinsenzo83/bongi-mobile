/**
 * products-rental-margin.js — 상품관리 › 렌탈 › 📐 마진 설계 탭
 * 서버 엔진(/api/rental-catalog/margin/*)을 호출해 가이드·MAX 규칙을 시험·저장·경쟁사 비교한다. 조건 데이터는 바꾸지 않는다.
 */
(function () {
  'use strict';
  var API = '/api/rental-catalog';
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function won(n) { return n == null || !isFinite(n) ? '—' : Math.round(n).toLocaleString(); }
  function man(n) { if (n == null || !isFinite(n)) return '—'; var a = Math.abs(n); return (n < 0 ? '−' : '') + (a >= 1e8 ? (a / 1e8).toFixed(2) + '억' : Math.round(a / 1e4).toLocaleString() + '만'); }
  function pct(x) { return x == null || !isFinite(x) ? '—' : (x * 100).toFixed(1) + '%'; }
  function token() { try { return localStorage.getItem('incentive-auth-token-v1'); } catch (e) { return null; } }
  async function call(path, opts) {
    opts = opts || {};
    var headers = { Authorization: 'Bearer ' + token() };
    if (opts.json !== undefined) { headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(opts.json); }
    var r = await fetch(API + path, { method: opts.method || 'GET', headers: headers, body: opts.body });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
    return j;
  }
  function msg(id, text, bad) { var el = $(id); if (el) { el.textContent = text; el.style.color = bad ? '#fca5a5' : '#86efac'; } }

  var ST = { inited: false, suppliers: [], categories: [], last: null };

  function setForm(p) {
    $('mg-max').value = +(p.max_margin * 100).toFixed(2);
    $('mg-guide').value = +(p.guide_margin * 100).toFixed(2);
    $('mg-max-floor').value = p.max_floor || 0;
    $('mg-guide-floor').value = p.guide_floor || 0;
    $('mg-prod').value = p.productivity;
    $('mg-disc').value = Math.round(p.discretion * 100);
    $('mg-base').value = p.base_salary;
    $('mg-oh-head').value = p.overhead_per_head || 0;
    $('mg-oh-fixed').value = p.fixed_overhead || 0;
    $('mg-basis').value = p.basis || 'supply';
    $('mg-weight').value = p.weight || 'equal';
    $('mg-tiers').value = (p.rate_tiers || []).map(function (t) { return t.min + ':' + +(t.rate * 100).toFixed(1); }).join(', ');
    $('mg-vols').value = (p.volumes || []).join(', ');
    if (p.filter) { $('mg-supplier').value = p.filter.supplier_id || ''; $('mg-category').value = p.filter.category || ''; }
  }
  function readForm() {
    var tiers = $('mg-tiers').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean).map(function (s) {
      var m = s.match(/^(\d+)\s*:\s*(\d+(?:\.\d+)?)$/); if (!m) throw new Error('배분율 구간 형식: "0:30, 60:35" (월 건수:배분율%)');
      return { min: Number(m[1]), rate: Number(m[2]) / 100 };
    });
    return {
      supplier_id: $('mg-supplier').value || undefined, category: $('mg-category').value || undefined,
      max_margin: Number($('mg-max').value) / 100, guide_margin: Number($('mg-guide').value) / 100,
      max_floor: Number($('mg-max-floor').value || 0), guide_floor: Number($('mg-guide-floor').value || 0),
      productivity: Number($('mg-prod').value), discretion: Number($('mg-disc').value) / 100,
      base_salary: Number($('mg-base').value), overhead_per_head: Number($('mg-oh-head').value || 0), fixed_overhead: Number($('mg-oh-fixed').value || 0),
      basis: $('mg-basis').value, weight: $('mg-weight').value, rate_tiers: tiers,
      current_rate: $('mg-o-cur-rate') && $('mg-o-cur-rate').value !== '' ? Number($('mg-o-cur-rate').value) / 100 : 0.2,
      volumes: $('mg-vols').value.split(',').map(function (s) { return Number(s.replace(/[^\d]/g, '')); }).filter(Boolean),
    };
  }

  // ── 결과 ──
  function cmpRow(label, a, b, fmt, higherIsGood) {
    var d = (a != null && b != null) ? a - b : null;
    var cls = d == null || d === 0 || higherIsGood == null ? '' : ((d > 0) === higherIsGood ? 'mg-good' : 'mg-bad');
    return '<tr><td>' + label + '</td><td class="num"><b>' + fmt(a) + '</b></td><td class="num">' + fmt(b) + '</td><td class="num ' + cls + '">' + (d == null ? '—' : (d > 0 ? '+' : '') + fmt(d)) + '</td></tr>';
  }
  function chart(o) {
    var W = 900, H = 300, L = 64, R = 20, T = 16, B = 36;
    var vols = o.proposed.volumes.map(function (v) { return v.volume; });
    var xMax = vols[vols.length - 1] || 1;
    var all = o.proposed.volumes.map(function (v) { return v.company; }).concat(o.live ? o.live.volumes.map(function (v) { return v.company; }) : []);
    var yMax = Math.max.apply(null, all.concat([1])), yMin = Math.min.apply(null, all.concat([0]));
    var step = Math.pow(10, Math.floor(Math.log10(Math.max(1, yMax - yMin)))) ; if ((yMax - yMin) / step < 4) step /= 2;
    yMax = Math.ceil(yMax / step) * step; yMin = Math.floor(yMin / step) * step;
    var X = function (v) { return L + v / xMax * (W - L - R); }, Y = function (v) { return T + (1 - (v - yMin) / (yMax - yMin || 1)) * (H - T - B); };
    var g = '';
    for (var v = yMin; v <= yMax + 1; v += step) g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="' + (v === 0 ? '#64748b' : '#334155') + '"/><text x="' + (L - 6) + '" y="' + (Y(v) + 4) + '" text-anchor="end" fill="#94a3b8" font-size="10">' + man(v) + '</text>';
    [0, 0.25, 0.5, 0.75, 1].forEach(function (f) { var xv = Math.round(xMax * f); g += '<text x="' + X(xv) + '" y="' + (H - B + 16) + '" text-anchor="middle" fill="#94a3b8" font-size="10">' + xv.toLocaleString() + '건</text>'; });
    function line(sc, color, width) {
      var pts = sc.volumes.map(function (v) { return X(v.volume) + ',' + Y(v.company); }).join(' ');
      var last = sc.volumes[sc.volumes.length - 1];
      return '<polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="' + width + '"/>' +
        '<circle cx="' + X(last.volume) + '" cy="' + Y(last.company) + '" r="3.5" fill="' + color + '"/>' +
        '<text x="' + (X(last.volume) - 6) + '" y="' + (Y(last.company) - 8) + '" text-anchor="end" fill="' + color + '" font-size="11" font-weight="700">' + man(last.company) + '</text>';
    }
    if (o.live) g += line(o.live, '#94a3b8', 2);
    g += line(o.proposed, '#38bdf8', 3);
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;display:block" role="img" aria-label="판매량별 회사 이익">' + g + '</svg>' +
      '<div style="font-size:11px;color:#94a3b8;display:flex;gap:16px;margin-top:4px"><span><b style="color:#38bdf8">━</b> 설계안</span><span><b style="color:#94a3b8">━</b> 지금 조건에 들어 있는 가이드·MAX</span><span>회사 이익 = 기본급·운영비 뺀 뒤</span></div>';
  }
  function render(o) {
    var P = o.proposed, Lv = o.live;
    var lp = Lv ? Lv.per_sale : {}, lh = Lv ? Lv.per_head : {}, lb = Lv ? Lv.break_even : {};
    var h = '';
    h += '<div class="section"><h2>설계안 vs 지금 <span style="font-size:11px;color:#94a3b8;font-weight:600">' + o.dataset.conditions.toLocaleString() + '개 조건 · ' + (o.dataset.weight === 'sales' ? '실제 판매 비중' : '조건 균등' + (o.params.weight === 'sales' ? ' (판매 데이터 없음)' : '')) + ' · 1인 월 ' + o.params.productivity + '건 · 배분율 ' + pct(P.per_head.rate) + '</span></h2>' +
      '<div style="overflow-x:auto"><table class="mg-cmp"><thead><tr><th>항목 (건당 평균)</th><th class="num">설계안</th><th class="num">지금</th><th class="num">차이</th></tr></thead><tbody>' +
      cmpRow('공급가 리베이트', P.per_sale.rebate, lp.rebate, won) +
      cmpRow('고객 가이드', P.per_sale.guide, lp.guide, won, true) +
      cmpRow('고객 MAX', P.per_sale.max, lp.max, won, true) +
      cmpRow('실제 고객 지급 (재량 ' + Math.round(o.params.discretion * 100) + '%)', P.per_sale.customer_pay, lp.customer_pay, won) +
      cmpRow('상담사 인센티브', P.per_sale.counselor_incentive, lp.counselor_incentive, won, true) +
      cmpRow('회사 몫 (기본급 전)', P.per_sale.company, lp.company, won, true) +
      cmpRow('상담사 월급', P.per_head.salary, lh.salary, won, true) +
      cmpRow('1인당 회사 월 이익', P.per_head.company, lh.company, won, true) +
      cmpRow('손익분기 건수 (재량 그대로)', P.break_even.at_discretion, lb.at_discretion, function (v) { return v == null ? '—' : Math.round(v) + '건'; }, false) +
      cmpRow('손익분기 건수 (MAX까지 다 줄 때)', P.break_even.at_max, lb.at_max, function (v) { return v == null ? '1000건↑' : Math.round(v) + '건'; }, false) +
      '</tbody></table></div></div>';
    h += '<div class="section"><h2>판매량별 회사 이익</h2>' + chart(o) +
      '<div style="overflow-x:auto;margin-top:10px"><table class="mg-cmp"><thead><tr><th>월 판매</th><th class="num">상담사</th><th class="num">배분율</th><th class="num">1인 월급</th><th class="num">리베이트 합계</th><th class="num">고객 지급 합계</th><th class="num">회사 이익 (설계안)</th><th class="num">비율</th><th class="num">회사 이익 (지금)</th></tr></thead><tbody>' +
      P.volumes.map(function (v, i) { var lv = Lv ? Lv.volumes[i] : null; return '<tr><td>' + v.volume.toLocaleString() + '건</td><td class="num">' + v.heads + '명</td><td class="num">' + pct(v.rate) + '</td><td class="num">' + man(v.salary) + '</td><td class="num">' + man(v.rebate_total) + '</td><td class="num">' + man(v.customer_total) + '</td><td class="num"><b class="' + (v.company >= 0 ? 'mg-good' : 'mg-bad') + '">' + man(v.company) + '</b></td><td class="num">' + pct(v.company_pct) + '</td><td class="num">' + (lv ? man(lv.company) : '—') + '</td></tr>'; }).join('') +
      '</tbody></table></div></div>';
    var catLabel = {}; ST.categories.forEach(function (c) { catLabel[c.slug] = c.label; });
    h += '<div class="section"><h2>카테고리별 건당 (설계안)</h2><div style="overflow-x:auto"><table class="mg-cmp"><thead><tr><th>카테고리</th><th class="num">조건</th><th class="num">리베이트</th><th class="num">가이드</th><th class="num">MAX</th><th class="num">고객 지급 비율</th><th class="num">회사 몫</th><th class="num">회사 비율</th></tr></thead><tbody>' +
      o.categories.map(function (c) { return '<tr><td>' + esc(catLabel[c.category] || c.category) + '</td><td class="num">' + c.conditions.toLocaleString() + '</td><td class="num">' + won(c.rebate) + '</td><td class="num">' + won(c.guide) + '</td><td class="num">' + won(c.max) + '</td><td class="num">' + pct(c.customer_pct) + '</td><td class="num">' + won(c.company) + '</td><td class="num">' + pct(c.company_pct) + '</td></tr>'; }).join('') +
      '</tbody></table></div></div>';
    $('mg-result').innerHTML = h;
    renderBenchmarks(o);
  }
  function renderBenchmarks(o) {
    var list = (o && o.benchmarks) || [];
    var c = o && o.competitor;
    $('mg-bm-count').textContent = list.length + '건' + (c ? ' · 경쟁사 지원금 = 공급가의 평균 ' + pct(c.avg_pct) + ' · 설계안 가이드가 낮은 상품 ' + c.guide_below + ' · MAX도 낮은 상품 ' + c.max_below : '');
    $('mg-bm-table').innerHTML = '<table class="mg-cmp"><thead><tr><th>경쟁사</th><th>모델</th><th>조건</th><th class="num">지원금</th><th class="num">설계안 가이드</th><th class="num">설계안 MAX</th><th class="num">가이드 차이</th><th class="num">MAX 차이</th><th class="num">지원금/리베이트</th><th>우리 티켓</th><th>확인일</th></tr></thead><tbody>' +
      list.map(function (b) {
        var cond = (b.contract_months / 12) + '년 · ' + ({ visit: '방문', self: '자가', delivery: '택배', none: '없음' }[b.care_type] || b.care_type) + ' · ' + won(b.monthly_fee) + (b.after_fee ? '→' + won(b.after_fee) : '');
        if (!b.matched) return '<tr><td>' + esc(b.competitor) + '</td><td>' + esc(b.model_code) + '</td><td>' + cond + '</td><td class="num">' + won(b.support_amount) + '</td><td colspan="7" style="color:#fca5a5">같은 모델·약정·관리 판매중 조건 없음</td></tr>';
        var gcls = b.guide_gap >= 0 ? 'mg-good' : 'mg-bad', mcls = b.max_gap >= 0 ? 'mg-good' : 'mg-bad';
        return '<tr><td>' + esc(b.competitor) + '</td><td title="' + esc(b.product_name || '') + '">' + esc(b.model_code) + '</td><td>' + cond + (b.same_fee ? '' : ' <span style="color:#fcd34d" title="요금 구조가 같은 조건이 없어 리베이트 최대 조건과 비교">*</span>') + '</td><td class="num">' + won(b.support_amount) + '</td><td class="num">' + won(b.guide) + '</td><td class="num">' + won(b.max) + '</td><td class="num ' + gcls + '">' + (b.guide_gap > 0 ? '+' : '') + won(b.guide_gap) + '</td><td class="num ' + mcls + '">' + (b.max_gap > 0 ? '+' : '') + won(b.max_gap) + '</td><td class="num">' + pct(b.competitor_pct) + '</td><td>' + esc(b.ticket || '') + '</td><td><a href="' + esc(b.source_url) + '" target="_blank" rel="noopener" style="color:#7dd3fc">' + esc(b.observed_at) + '</a></td></tr>';
      }).join('') + '</tbody></table>';
  }

  async function run() {
    var body;
    try { body = readForm(); } catch (e) { msg('mg-msg', e.message, true); return; }
    msg('mg-msg', '계산 중…');
    $('mg-run').disabled = true;
    try {
      var o = await call('/margin/simulate', { method: 'POST', json: body });
      ST.last = { params: body, result: o };
      render(o);
      msg('mg-msg', '✅ 계산 완료 · 데이터 ' + new Date(o.loaded_at).toLocaleTimeString('ko-KR'));
    } catch (e) { msg('mg-msg', e.message, true); }
    finally { $('mg-run').disabled = false; }
  }
  async function save() {
    var name = $('mg-name').value.trim();
    if (!name) { msg('mg-msg', '시나리오 이름을 입력하세요', true); return; }
    var body; try { body = readForm(); } catch (e) { msg('mg-msg', e.message, true); return; }
    var params = Object.assign({}, body, { filter: { supplier_id: body.supplier_id, category: body.category } });
    try { await call('/margin/scenarios', { method: 'POST', json: { name: name, params: params } }); msg('mg-msg', '✅ 저장됨'); $('mg-name').value = ''; loadScenarios(); }
    catch (e) { msg('mg-msg', e.message, true); }
  }
  async function loadScenarios() {
    try {
      var j = await call('/margin/scenarios');
      $('mg-scenarios').innerHTML = (j.scenarios || []).length ? '<table class="mg-cmp"><thead><tr><th>이름</th><th>MAX/가이드 마진</th><th>1인 건수</th><th>재량</th><th class="num">상담사 월급</th><th class="num">1인당 회사</th><th class="num">손익분기(MAX)</th><th>엔진</th><th>저장</th><th></th></tr></thead><tbody>' +
        j.scenarios.map(function (s, i) {
          var p = s.params, x = (s.summary && s.summary.proposed) || {};
          return '<tr><td>' + esc(s.name) + '</td><td>' + pct(p.max_margin) + ' / ' + pct(p.guide_margin) + '</td><td>' + p.productivity + '</td><td>' + Math.round(p.discretion * 100) + '%</td><td class="num">' + won(x.per_head && x.per_head.salary) + '</td><td class="num">' + won(x.per_head && x.per_head.company) + '</td><td class="num">' + (x.break_even && x.break_even.at_max != null ? x.break_even.at_max + '건' : '—') + '</td><td>' + esc(s.engine_version) + '</td><td>' + esc((s.created_by || '') + ' ' + new Date(s.created_at).toLocaleDateString('ko-KR')) + '</td><td><button class="btn-secondary" data-load="' + i + '" type="button">불러오기</button></td></tr>';
        }).join('') + '</tbody></table>' : '<div style="font-size:12px;color:#94a3b8">저장한 시나리오가 없습니다.</div>';
      ST.scenarios = j.scenarios || [];
    } catch (e) { $('mg-scenarios').textContent = e.message; }
  }
  async function addBenchmark() {
    var body = { competitor: $('mg-b-comp').value, supplier_id: $('mg-b-sup').value, model_code: $('mg-b-code').value, contract_months: $('mg-b-months').value, care_type: $('mg-b-care').value,
      monthly_fee: $('mg-b-fee').value, after_fee: $('mg-b-after').value, support_amount: $('mg-b-support').value, observed_at: $('mg-b-date').value, source_url: $('mg-b-url').value };
    try { await call('/margin/benchmarks', { method: 'POST', json: body }); msg('mg-bm-msg', '✅ 추가됨 — 다시 계산하면 반영됩니다'); ['mg-b-code', 'mg-b-months', 'mg-b-fee', 'mg-b-after', 'mg-b-support', 'mg-b-url'].forEach(function (id) { $(id).value = ''; }); run(); }
    catch (e) { msg('mg-bm-msg', e.message, true); }
  }
  // 운영 탭의 「가이드·MAX 일괄 규칙」 입력에 채우고 그쪽으로 이동 (적용은 거기서 미리보기 후 사람이 누른다)
  function toRule() {
    try {
      var b = readForm();
      $('rp-margin').value = +(b.max_margin * 100).toFixed(2);
      $('rp-guide-margin').value = +(b.guide_margin * 100).toFixed(2);
      $('rp-basis').value = b.basis;
      $('rp-max-floor').value = b.max_floor || 0;
      $('rp-guide-floor').value = b.guide_floor || 0;
      if ($('rp-m-supplier')) $('rp-m-supplier').value = b.supplier_id || '';
      showSub('ops');
      $('rp-margin').scrollIntoView({ behavior: 'smooth', block: 'center' });
      msg('rp-margin-msg', '마진 설계 값이 채워졌습니다 — 미리보기로 확인한 뒤 적용하세요');
    } catch (e) { msg('mg-msg', e.message, true); }
  }


  // ── 최적 설계 ──
  async function optimizeRun() {
    var body; try { body = readForm(); } catch (e) { msg('mg-o-msg', e.message, true); return; }
    var v = function (id, scale) { var x = $(id).value; return x === '' ? undefined : Number(x) / (scale || 1); };
    Object.assign(body, { salary_min: v('mg-o-salary'), guide_avg_min: v('mg-o-guide'), competitor_max_share: v('mg-o-maxshare', 100), competitor_guide_share: v('mg-o-guideshare', 100) });
    msg('mg-o-msg', '탐색 중… (수 초)'); $('mg-optimize').disabled = true;
    try {
      var o = await call('/margin/optimize', { method: 'POST', json: body });
      var c = o.constraints, b = o.best, cur = o.current, d = o.detail.proposed;
      var row = function (x) { return '<tr><td>' + pct(x.max_margin) + ' · 최소 ' + won(x.max_floor) + '</td><td>' + pct(x.guide_margin) + (x.guide_floor ? ' · 최소 ' + won(x.guide_floor) : '') + '</td><td class="num">' + won(x.guide_avg) + '</td><td class="num">' + won(x.max_avg) + '</td><td class="num">' + won(x.salary) + '</td><td class="num"><b>' + won(x.company_per_head) + '</b></td><td class="num">' + pct(x.competitor_max_win) + '</td></tr>'; };
      $('mg-o-result').innerHTML =
        '<div style="font-size:12px;color:#cbd5e1;margin-bottom:6px">제약: 월급 ≥ ' + won(c.salary_min) + ' · 평균 가이드 ≥ ' + won(c.guide_avg_min) + ' · MAX 최소 남김 ≥ ' + won(c.min_max_floor) + '(인건비÷건수) · MAX≥경쟁사 ' + pct(c.competitor_max_share) + ' · 가이드≥경쟁사×' + c.competitor_guide_ratio + ' ' + pct(c.competitor_guide_share) + ' · 배분율 ' + pct(c.rate) + ' · 탐색 ' + o.searched.tried.toLocaleString() + '개 중 가능 ' + o.searched.feasible.toLocaleString() + '개</div>' +
        '<div style="overflow-x:auto"><table class="mg-cmp"><thead><tr><th>MAX 마진</th><th>가이드 마진</th><th class="num">평균 가이드</th><th class="num">평균 MAX</th><th class="num">상담사 월급</th><th class="num">1인당 회사</th><th class="num">MAX≥경쟁사</th></tr></thead><tbody>' +
        '<tr style="color:#94a3b8"><td colspan="2">지금 (배분율 ' + pct(c.current_rate) + ')</td><td class="num">' + won(cur.per_sale.guide) + '</td><td class="num">' + won(cur.per_sale.max) + '</td><td class="num">' + won(cur.per_head.salary) + '</td><td class="num">' + won(cur.per_head.company) + '</td><td class="num">—</td></tr>' +
        row(b).replace('<tr>', '<tr style="background:#0c4a6e55">') + o.alternatives.map(row).join('') + '</tbody></table></div>' +
        '<div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap"><button class="btn-secondary" id="mg-o-use" type="button">1순위를 설계 입력에 넣고 계산</button><span style="font-size:11.5px;color:#fcd34d">⚠ 배분율 ' + pct(c.rate) + ' 가정입니다. 상담사 배분율이 실제로 다르면 월급 결과도 달라집니다. 최소 남김 금액이 크면 리베이트가 작은 상품의 가이드가 크게 낮아집니다 — 카테고리별 표를 확인하세요.</span></div>';
      $('mg-o-use').onclick = function () {
        $('mg-max').value = +(b.max_margin * 100).toFixed(2); $('mg-guide').value = +(b.guide_margin * 100).toFixed(2);
        $('mg-max-floor').value = b.max_floor; $('mg-guide-floor').value = b.guide_floor; run();
      };
      msg('mg-o-msg', '✅ 1인당 회사 ' + won(cur.per_head.company) + ' → ' + won(b.company_per_head));
    } catch (e) { msg('mg-o-msg', e.message, true); }
    finally { $('mg-optimize').disabled = false; }
  }

  async function init() {
    if (ST.inited) return;
    ST.inited = true;
    try {
      var [d, sup, cat] = await Promise.all([call('/margin/defaults'), call('/suppliers'), call('/agent/categories')]);
      ST.suppliers = sup.suppliers || []; ST.categories = cat.categories || [];
      var supOpts = ST.suppliers.map(function (s) { return '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>'; }).join('');
      $('mg-supplier').innerHTML = '<option value="">전체 렌탈사</option>' + supOpts;
      $('mg-b-sup').innerHTML = supOpts;
      $('mg-category').innerHTML = '<option value="">전체 카테고리</option>' + ST.categories.map(function (c) { return '<option value="' + esc(c.slug) + '">' + esc(c.label) + '</option>'; }).join('');
      $('mg-version').textContent = 'v' + d.engine_version;
      $('mg-live-rule').textContent = d.live_rule_label ? '지금 조건에 적용된 규칙: ' + d.live_rule_label : '';
      $('mg-b-date').value = new Date().toISOString().slice(0, 10);
      $('mg-b-comp').value = '모요';
      setForm(d.defaults);
      run(); loadScenarios();
    } catch (e) { msg('mg-msg', e.message, true); }
    $('mg-run').addEventListener('click', run);
    $('mg-optimize').addEventListener('click', optimizeRun);
    $('mg-save').addEventListener('click', save);
    $('mg-to-rule').addEventListener('click', toRule);
    $('mg-b-add').addEventListener('click', addBenchmark);
    $('mg-scenarios').addEventListener('click', function (e) {
      var i = e.target.getAttribute('data-load'); if (i == null) return;
      var s = ST.scenarios[Number(i)]; if (!s) return;
      setForm(s.params); run();
      msg('mg-msg', '「' + s.name + '」 불러옴 (엔진 ' + s.engine_version + ' 저장 → 지금 엔진으로 다시 계산)');
    });
  }

  function showSub(sub) {
    document.querySelectorAll('.rp-subtab').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-sub') === sub); });
    $('rp-sub-ops').style.display = sub === 'ops' ? '' : 'none';
    $('rp-sub-margin').style.display = sub === 'margin' ? '' : 'none';
    if (sub === 'margin') init();
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('.rp-subtab');
    if (t) showSub(t.getAttribute('data-sub'));
  });
})();
