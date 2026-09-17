/* ═══════════════════════════════════════════════════════════════
 * TM 상담 — 렌탈 탭
 *   상품 검색(모델·상품명·티켓 R000000) → 조건 선택(할인유형·약정·관리·주기)
 *   → 가이드~MAX 지급액 → "N개월 무료" 환산 → 렌탈사 가입기준에 맞춘 계약정보 입력 → 계약 등록(sale_kind=rental)
 *
 * 상담 중에는 지급액 금액을 고객에게 말해도 된다(대표 확인 2026-09-16). 금액 표기 금지는 홈페이지·앱 등 공개 노출에만 해당.
 * MAX 는 인터넷·유심과 같이 상담원 전용.
 * 의존: tm-counselor.html 의 fmt, INC_API, authGetToken, formatPhoneAuto, window._incAgentRate
 * ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var API = '/api/rental-catalog';
  var TYPE_LABEL = { normal: '일반', package: '패키지', bundle: '결합', trade_in: '타사보상', half: '반값할인', prepay: '선납', promo: '프로모션', special: '특가', field: '현장', staff: '임직원', purchase: '일시불' };
  var CARE_LABEL = { visit: '방문', self: '자가', delivery: '택배', none: '관리없음' };
  var RT = { inited: false, models: [], model: null, offers: [], pick: {}, offer: null, form: null, searchSeq: 0, category: '', page: 1, total: 0 };

  var $ = function (id) { return document.getElementById(id); };
  // 모델명 칸에 상품명이 통째로 든 시트(BS·유버스·큐밍)는 코드가 이름과 같다 — 같은 글을 두 번 보이지 않게
  function codeIfDiff(m) { var c = m.model_code || m.model_key || ''; return c && c !== m.product_name ? c : ''; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function won(n) { return n == null ? '—' : Number(n).toLocaleString() + '원'; }
  function token() { return (typeof authGetToken === 'function') ? authGetToken() : localStorage.getItem('incentive-auth-token-v1'); }

  async function api(path) {
    var t = token();
    if (!t) throw new Error('로그인이 필요합니다');
    var r = await fetch(API + path, { headers: { Authorization: 'Bearer ' + t } });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
    return j;
  }

  // ─── 표시 헬퍼 ───
  function typeText(o) {
    var base = TYPE_LABEL[o.offer_type] || o.offer_type;
    // 반값은 몇 개월·몇 회차인지 항상 보이게 — 라벨에 개월이 없으면 요금 구간에서 계산
    if (o.offer_type === 'half' && !/개월/.test(o.offer_label || '')) {
      var hp = (o.price_phases || []).filter(function (p) { return p.fee > 0 && p.fee < (o.monthly_fee || 0); })[0];
      base = hp ? '반값 ' + (hp.to - hp.from + 1) + '개월(' + hp.from + '~' + hp.to + '회차)' : '반값할인(개월 확인필요)';
    }
    if (o.offer_label && o.offer_label !== base) return base + ' · ' + o.offer_label;
    var tags = (o.offer_tags || []).filter(function (t) { return !/^(rule|bundle|prepay):/.test(t); });
    return base + (tags.length ? ' · ' + tags.join('·') : '');
  }
  function careText(o) {
    if (o.care_type === 'visit') return '방문' + (o.cycle_months ? ' ' + o.cycle_months + '개월' : '');
    if (o.care_type) return CARE_LABEL[o.care_type] + (o.cycle_months && o.care_type === 'self' ? ' ' + o.cycle_months + '개월' : '');
    return o.care_label || '관리정보 없음';
  }
  function contractText(o) {
    if (!o.contract_months) return '약정 없음';
    var s = o.contract_months + '개월';
    if (o.ownership_months && o.ownership_months !== o.contract_months) s += ' (소유권 ' + o.ownership_months + '개월)';
    return s;
  }
  function phasesText(o) {
    var ph = (o.price_phases || []).slice().sort(function (a, b) { return a.from - b.from; });
    if (!ph.length) return won(o.monthly_fee) + ' / 월';
    var parts = ph.map(function (p) { return p.from + (p.to !== p.from ? '~' + p.to : '') + '개월 ' + (p.fee === 0 ? '면제' : won(p.fee)); });
    var last = ph[ph.length - 1];
    parts.push((last.to + 1) + '개월~ ' + won(o.monthly_fee));
    return parts.join(' → ');
  }
  function freeMonths(pay, o) { return (pay && o && o.display_fee > 0) ? Math.floor(pay / o.display_fee) : 0; }

  // ─── 1. 상품 검색 ───
  function renderModels() {
    var box = $('rt-models');
    if (!box) return;
    if (!RT.models.length) { box.innerHTML = '<div class="rt-empty">검색 결과가 없습니다.</div>'; return; }
    box.innerHTML = RT.models.map(function (m) {
      var sel = RT.model && RT.model.id === m.id ? ' sel' : '';
      return '<div class="usim-card' + sel + '" data-mid="' + esc(m.id) + '">' +
        (m.image_url ? '<img class="rt-thumb" loading="lazy" src="' + esc(m.image_url) + '" alt="">' : '') +
        '<div class="un">' + esc(m.product_name || m.model_code || m.model_key) + '</div>' +
        '<div class="uf"><span>' + esc(m.supplier_name) + '</span><b>' + esc(codeIfDiff(m)) + '</b></div>' +
        '<div class="uf"><span>조건 ' + m.offer_count + '개</span><span>가이드 설정 ' + (m.payout_set_count || 0) + '</span></div>' +
        '<div class="up"><span>월 ' + won(m.min_display_fee) + '~</span><span>' + (m.max_free_months ? '최대 ' + m.max_free_months + '개월 무료' : '') + '</span></div>' +
        '</div>';
    }).join('');
  }

  async function search(append) {
    var q = ($('rt-q').value || '').trim();
    var sup = $('rt-supplier').value;
    var msg = $('rt-search-msg');
    var seq = ++RT.searchSeq;
    if (/^R\d{6}$/i.test(q)) return openTicket(q.toUpperCase());
    RT.page = append ? RT.page + 1 : 1;
    msg.textContent = '불러오는 중…';
    try {
      var qs = '?size=30&page=' + RT.page + (q ? '&q=' + encodeURIComponent(q) : '') + (sup ? '&supplier=' + encodeURIComponent(sup) : '') + (RT.category ? '&category=' + encodeURIComponent(RT.category) : '');
      var j = await api('/agent/models' + qs);
      if (seq !== RT.searchSeq) return;
      RT.models = append ? RT.models.concat(j.models || []) : (j.models || []);
      RT.total = j.total || 0;
      msg.textContent = '총 ' + RT.total.toLocaleString() + '개' + (RT.total > RT.models.length ? ' · ' + RT.models.length + '개 표시' : '');
      $('rt-more').style.display = RT.total > RT.models.length ? '' : 'none';
      renderModels();
    } catch (e) { msg.textContent = '⚠ ' + e.message; }
  }

  async function loadCategories() {
    try {
      var j = await api('/agent/categories');
      var cats = [{ slug: '', label: '전체', count: (j.categories || []).reduce(function (n, c) { return n + c.count; }, 0) }].concat(j.categories || []);
      $('rt-cats').innerHTML = cats.map(function (c) {
        return '<div class="tm-option' + (RT.category === c.slug ? ' selected' : '') + '" data-cat="' + esc(c.slug) + '">' + esc(c.label) + ' <span style="opacity:.55;font-size:10px">' + c.count.toLocaleString() + '</span></div>';
      }).join('');
    } catch (e) { $('rt-search-msg').textContent = '⚠ ' + e.message; }
  }

  function renderProductInfo(m) {
    var box = $('rt-product-info');
    if (!box) return;
    if (!m) { box.innerHTML = ''; return; }
    var sp = m.specs || {};
    var rows = [];
    var add = function (k, v) { if (v != null && v !== '' && !(Array.isArray(v) && !v.length)) rows.push('<dt>' + esc(k) + '</dt><dd>' + esc(Array.isArray(v) ? v.join(', ') : v) + '</dd>'); };
    add('렌탈사', m.supplier_name); add('제조사', sp.brand || m.brand); add('모델', m.model_code || m.model_key); add('제품군', m.category_raw);
    add('추천 사용', sp.recommended_capacity); add('용도', sp.recommended_usage); add('크기(mm)', sp.size_mm); add('무게(kg)', sp.weight_kg);
    Object.keys(sp.specifications || {}).forEach(function (k) { var v = sp.specifications[k]; if (v != null && v !== '') add(SPEC_LABEL[k] || k, v); });
    box.innerHTML = '<div class="rt-info">' + (m.image_url ? '<img src="' + esc(m.image_url) + '" alt="">' : '') +
      '<div style="flex:1;min-width:0"><h4>' + esc(sp.name || m.product_name || m.model_code) + '</h4>' +
      (sp.description ? '<div style="font-size:11.5px;color:#334155">' + esc(sp.description) + '</div>' : '') +
      (sp.feature_tags && sp.feature_tags.length ? '<div class="rt-tags" style="margin-top:4px">' + sp.feature_tags.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>' : '') +
      (sp.spec_notes ? '<div class="rt-hint" style="margin-top:3px">' + esc(sp.spec_notes) + '</div>' : '') +
      '<dl>' + rows.join('') + '</dl>' +
      (sp.product_url ? '<a href="' + esc(sp.product_url) + '" target="_blank" rel="noopener" style="font-size:11px">제품 상세 페이지 ↗</a>' : '') +
      (!m.specs || !m.specs.source ? '<div class="rt-hint" style="margin-top:4px">등록된 상세 사양이 없습니다 (엑셀 기본정보만 표시)</div>' : '') +
      '</div></div>';
  }
  var SPEC_LABEL = { power_w: '소비전력(W)', output_mode: '출수', hot_temp_max: '온수 최고(℃)', ice_capacity: '제빙량', filter_stages: '필터 단계', warranty_years: '보증(년)', capacity_l: '용량(L)', area_m2: '사용면적(㎡)', noise_db: '소음(dB)', energy_grade: '에너지등급' };

  async function openTicket(ticket) {
    var msg = $('rt-search-msg');
    msg.textContent = '티켓 조회 중…';
    try {
      var j = await api('/agent/tickets/' + ticket);
      RT.models = [j.model];
      renderModels();
      await openModel(j.model.id, j.offer.id);
      msg.textContent = j.usable ? '✓ ' + ticket + ' 조건을 불러왔습니다' : '⚠ ' + ticket + ' 은 판매중이 아닙니다';
    } catch (e) { msg.textContent = '⚠ ' + e.message; }
  }

  async function openModel(modelId, offerId) {
    RT.model = RT.models.filter(function (m) { return m.id === modelId; })[0] || RT.model;
    RT.pick = {}; RT.offer = null; RT.form = null;
    renderModels();
    renderProductInfo(RT.model);
    $('rt-offer-card').style.display = '';
    $('rt-offer-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('rt-axes').innerHTML = '<div class="rt-empty">조건 불러오는 중…</div>';
    try {
      var j = await api('/agent/models/' + modelId + '/offers');
      RT.offers = j.offers || [];
      if (offerId) {
        var o = RT.offers.filter(function (x) { return x.id === offerId; })[0];
        if (o) RT.pick = pickFor(o);
      }
      renderOffers();
    } catch (e) { $('rt-axes').innerHTML = '<div class="rt-empty">⚠ ' + esc(e.message) + '</div>'; }
  }

  // ─── 2. 조건 선택 (축별 칩 + 남은 조건 표) ───
  var AXES = [
    { key: 'type', label: '할인유형', get: typeText },
    { key: 'contract', label: '약정', get: contractText },
    { key: 'care', label: '관리', get: careText },
    { key: 'variant', label: '세부', get: function (o) { return o.variant_code || '기본'; } },
  ];
  function axisValues(o) { var v = {}; AXES.forEach(function (a) { v[a.key] = a.get(o); }); return v; }
  // 조건 하나를 고를 때: 세부코드는 앞 세 축만으로 조건이 갈리지 않을 때만 고정한다
  // (코웨이는 세부코드에 관리방식이 들어 있어 고정하면 방문/자가 중 한쪽이 숨는다)
  function pickFor(o) {
    var v = axisValues(o);
    var same = RT.offers.filter(function (x) { return typeText(x) === v.type && contractText(x) === v.contract && careText(x) === v.care; });
    if (same.length <= 1) delete v.variant;
    return v;
  }
  function matches(o, except) {
    return AXES.every(function (a) { return a.key === except || !RT.pick[a.key] || a.get(o) === RT.pick[a.key]; });
  }

  function renderOffers() {
    var axesBox = $('rt-axes');
    var html = '';
    // 세부코드 고정이 다른 축 선택지를 가리지 않게: 앞 세 축으로 이미 하나로 좁혀지면 세부 고정 해제
    if (RT.pick.variant) {
      var core = RT.offers.filter(function (o) { return AXES.slice(0, 3).every(function (a) { return !RT.pick[a.key] || a.get(o) === RT.pick[a.key]; }); });
      if (core.length <= 1) delete RT.pick.variant;
    }
    AXES.forEach(function (a) {
      var vals = [];
      RT.offers.forEach(function (o) { if (matches(o, a.key)) { var v = a.get(o); if (vals.indexOf(v) < 0) vals.push(v); } });
      // 세부 칩은 할인유형·약정·관리를 다 고른 뒤에도 조건이 갈릴 때만 보인다
      if (a.key === 'variant' && (vals.length <= 1 || AXES.slice(0, 3).some(function (x) { return !RT.pick[x.key]; }))) {
        if (RT.pick.variant && vals.indexOf(RT.pick.variant) < 0) delete RT.pick.variant;
        return;
      }
      if (RT.pick[a.key] && vals.indexOf(RT.pick[a.key]) < 0) delete RT.pick[a.key];
      if (vals.length === 1) RT.pick[a.key] = vals[0];
      html += '<div class="rt-axis"><div class="rt-axis-label">' + a.label + '</div><div class="tm-options">' +
        vals.map(function (v) {
          return '<div class="tm-option' + (RT.pick[a.key] === v ? ' selected' : '') + '" data-axis="' + a.key + '" data-val="' + esc(v) + '">' + esc(v) + '</div>';
        }).join('') + '</div></div>';
    });
    axesBox.innerHTML = html;

    var left = RT.offers.filter(function (o) { return matches(o); });
    RT.offer = left.length === 1 ? left[0] : null;
    var tbl = $('rt-offer-table');
    tbl.innerHTML = left.length > 1 ? '<table class="rt-table"><thead><tr><th>티켓</th><th>유형</th><th>약정</th><th>관리</th><th>월요금</th><th>가이드</th></tr></thead><tbody>' +
      left.slice(0, 80).map(function (o) {
        return '<tr data-oid="' + esc(o.id) + '"><td>' + esc(o.ticket_number) + '</td><td>' + esc(typeText(o)) + '</td><td>' + esc(contractText(o)) + '</td><td>' + esc(careText(o)) + '</td><td>' + esc(phasesText(o)) + '</td><td>' + (o.guide_payout != null ? '✓' : '<span style="color:#dc2626">미설정</span>') + '</td></tr>';
      }).join('') + '</tbody></table>' + (left.length > 80 ? '<div class="rt-empty">' + left.length + '개 중 80개 — 위에서 조건을 더 고르세요</div>' : '')
      : '';
    renderSelected();
  }

  function renderSelected() {
    var o = RT.offer;
    var box = $('rt-selected');
    if (!o) {
      box.innerHTML = RT.offers.length ? '<div class="rt-empty">조건을 끝까지 고르면 티켓과 요금이 나옵니다.</div>' : '';
      payout(null); quote(null); renderForm(null);
      return;
    }
    box.innerHTML = '<div class="rt-picked"><b>' + esc(o.ticket_number) + '</b> · ' + esc(typeText(o)) + ' · ' + esc(contractText(o)) + ' · ' + esc(careText(o)) +
      '<div class="rt-picked-fee">' + esc(phasesText(o)) + '</div>' +
      (o.offer_label ? '<div class="rt-note">프로모션: ' + esc(o.offer_label) + '</div>' : '') +
      (o.notes ? '<div class="rt-note">비고: ' + esc(o.notes) + '</div>' : '') +
      '<div id="rt-promos"></div></div>';
    payout(o);
    loadForm(o);
    loadPromos(o);
  }

  // 이 렌탈사의 진행 중 프로모션 (기간 안인 것만) — 행사명·혜택·중복 조건
  var PROMO_CACHE = {};
  async function loadPromos(o) {
    var box = $('rt-promos'); if (!box) return;
    try {
      var list = PROMO_CACHE[o.supplier_id];
      if (!list) { list = (await api('/promotions?supplier=' + encodeURIComponent(o.supplier_id) + '&active=true')).promotions || []; PROMO_CACHE[o.supplier_id] = list; }
      if (RT.offer !== o || !list.length) { if (RT.offer === o) box.innerHTML = ''; return; }
      box.innerHTML = '<div style="margin-top:6px;padding:6px 8px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px">' +
        '<div style="font-size:11px;font-weight:800;color:#1d4ed8;margin-bottom:2px">📢 진행 중 프로모션 ' + list.length + '</div>' +
        list.map(function (p) {
          var st = p.stacking || {};
          var stack = Object.keys(st).filter(function (k) { return k !== 'note' && k !== '제외'; }).map(function (k) { return k + (st[k] === true ? 'O' : st[k] === false ? 'X' : ':' + st[k]); }).join(' ');
          return '<div style="font-size:11px;padding:3px 0;border-top:1px dashed #dbeafe"><b>' + esc(p.title) + '</b> <span style="color:#64748b">' + esc((p.period_from || '') + '~' + (p.period_to || '')) + '</span>' +
            '<div style="color:#334155">' + esc(p.summary || '') + '</div>' +
            (stack || st.note || st['제외'] ? '<div style="color:#64748b;font-size:10px">중복: ' + esc([stack, st.note, st['제외'] ? '제외 ' + st['제외'] : ''].filter(Boolean).join(' · ')) + '</div>' : '') + '</div>';
        }).join('') + '</div>';
    } catch (e) { box.innerHTML = ''; }
  }

  // ─── 3. 지급액 (가이드~MAX) ───
  function currentPay() { var sl = $('rt-payout'); return sl ? Number(sl.value) : null; }

  function payout(o) {
    var card = $('rt-pay-card');
    if (!o) { card.style.display = 'none'; return null; }
    card.style.display = '';
    var warn = $('rt-pay-warn');
    var body = $('rt-pay-body');
    if (o.guide_payout == null || o.max_payout == null || o.max_payout === 0) {
      warn.style.display = ''; body.style.display = 'none';
      warn.textContent = o.max_payout === 0 ? '이 조건은 지원금이 없습니다 (가이드·MAX 0원).' : '⚠ 이 조건은 가이드·MAX 가 아직 설정되지 않았습니다. 상품관리에서 설정해야 계약 등록이 됩니다.';
      quote(o);
      return null;
    }
    warn.style.display = 'none'; body.style.display = '';
    var guide = o.guide_payout, mx = o.max_payout;
    var sl = $('rt-payout'), num = $('rt-payout-num');
    var key = o.id + '|' + guide + '|' + mx;
    if (sl.dataset.key !== key) { sl.dataset.key = key; sl.min = guide; sl.max = mx; sl.value = guide; }
    var pay = Math.max(guide, Math.min(mx, Number(sl.value)));
    sl.value = pay;
    var residual = Math.max(0, mx - pay);
    var rate = Number(window._incAgentRate); if (!rate || isNaN(rate)) rate = 20;
    $('rt-guide').textContent = won(guide);
    $('rt-offer').textContent = won(pay);
    $('rt-max').textContent = won(mx);
    $('rt-room').textContent = '추가 지급 가능 ' + won(mx - pay);
    $('rt-free').textContent = freeMonths(pay, o) + '개월 무료';
    $('rt-free-sub').textContent = won(pay) + ' ÷ 월 ' + won(o.display_fee) + ' (버림)';
    $('rt-residual').textContent = won(residual);
    $('rt-inc').textContent = won(Math.round(residual * rate / 100));
    $('rt-inc-sub').textContent = won(residual) + ' × ' + rate + '% (내 배분율)';
    num.min = guide; num.max = mx;
    if (document.activeElement !== num) num.value = pay;
    quote(o);
    return pay;
  }

  // ─── 우측 견적 (고객 안내용 + 상담원 전용 박스) ───
  function customerQuoteHtml(o, pay) {
    var m = RT.model || {};
    var fm = freeMonths(pay, o);
    return '<div style="padding:4px 2px">' +
      '<div style="font-size:10px;color:#fcd34d;font-weight:800;letter-spacing:.05em;margin-bottom:6px">🧊 렌탈 · ' + esc(m.supplier_name || '') + ' · ' + esc(o.ticket_number) + '</div>' +
      '<div class="calc-line"><span class="l">' + esc(m.product_name || m.model_code || '') + '</span><span class="v" style="font-size:11px">' + esc(codeIfDiff(m)) + '</span></div>' +
      '<div class="calc-line"><span class="l">조건</span><span class="v" style="font-size:11px">' + esc(contractText(o)) + ' · ' + esc(careText(o)) + ' · ' + esc(typeText(o)) + '</span></div>' +
      (o.price_phases && o.price_phases.length
        ? o.price_phases.map(function (p) { return '<div class="calc-line discount"><span class="l">' + p.from + '~' + p.to + '개월</span><span class="v">' + (p.fee === 0 ? '면제' : won(p.fee)) + '</span></div>'; }).join('') +
          '<div class="calc-line"><span class="l">이후</span><span class="v">' + won(o.monthly_fee) + '</span></div>'
        : '') +
      '<div class="calc-line total" style="border-top:2px solid rgba(255,255,255,0.2);margin-top:8px;padding-top:10px"><span class="l">✨ 월 렌탈료</span><span class="v" style="font-size:20px">' + won(o.display_fee) + '</span></div>' +
      (pay > 0 ? '<div class="calc-line gift" style="background:rgba(251,191,36,0.14);border-radius:6px;padding:7px 10px;margin-top:8px"><span class="l" style="color:#fbbf24">🎁 혜택 ' + fm + '개월 무료</span><span class="v" style="color:#fbbf24;font-size:17px">' + won(pay) + '</span></div>' : '') +
      (o.prepay_amount ? '<div class="calc-line"><span class="l">선납금</span><span class="v">' + won(o.prepay_amount) + '</span></div>' : '') +
      cardsHtml(o) +
      '</div>';
  }

  // 제휴카드 — 카드로 자동이체하면 전월실적 구간별로 월 렌탈료에서 빠진다 (공개 정보라 고객 안내 가능)
  function cardsHtml(o) {
    var cards = (RT.offer === o && RT.cards) || [];
    if (!cards.length) return '';
    var fee = o.display_fee || o.monthly_fee || 0;
    var top = cards.slice(0, 5).map(function (c) {
      var tiers = (c.tiers || []).filter(function (t) { return t.total; });
      var best = tiers[tiers.length - 1];
      var tierText = tiers.map(function (t) { return (t.min_spend ? Math.round(t.min_spend / 10000) + '만↑ ' : '') + '-' + won(t.total); }).join(' / ');
      return '<div style="padding:4px 0;border-top:1px dashed rgba(255,255,255,0.12)">' +
        '<div class="calc-line" style="padding:0"><span class="l" style="font-size:11px">' + esc(c.card_name.indexOf(c.card_issuer) >= 0 ? c.card_name : c.card_issuer + ' ' + c.card_name) + '</span>' +
        (best ? '<span class="v" style="font-size:12px;color:#86efac">최대 월 ' + won(Math.max(0, fee - best.total)) + '</span>' : '') + '</div>' +
        '<div style="font-size:9.5px;color:rgba(255,255,255,0.55)">전월실적 ' + esc(tierText) +
        (c.discount_months ? ' · ' + c.discount_months + '개월' : '') + (c.verify_status && c.verify_status !== 'verified' ? ' · <span style="color:#fca5a5">확인필요</span>' : '') + '</div></div>';
    }).join('');
    return '<div style="margin-top:8px;padding:6px 10px;background:rgba(34,197,94,0.08);border:1px solid rgba(134,239,172,0.3);border-radius:6px">' +
      '<div style="font-size:10.5px;color:#86efac;font-weight:800;margin-bottom:2px">💳 제휴카드 할인 ' + cards.length + '장' + (cards.length > 5 ? ' (상위 5장)' : '') + '</div>' + top + '</div>';
  }

  function quote(o) {
    var el = $('c-result');
    if (!el || !document.body.classList.contains('cat-rental')) return;
    if (!o) {
      el.innerHTML = '<div style="padding:16px;font-size:12.5px;color:rgba(255,255,255,0.55);line-height:1.7">🧊 <b style="color:#fcd34d">렌탈</b><br>상품과 조건을 고르면 견적이 나옵니다.<br><br>혜택은 <b>"N개월 무료"</b>와 지급액으로 안내합니다. <span style="color:#fca5a5">MAX 는 비공개</span>.</div>';
      return;
    }
    var pay = (o.guide_payout != null && o.max_payout != null) ? currentPay() : null;
    el.innerHTML = customerQuoteHtml(o, pay) +
      '<div style="margin-top:8px;padding:7px 10px;background:rgba(139,92,246,0.12);border:1px solid rgba(167,139,250,0.35);border-radius:6px;font-size:10.5px;line-height:1.6">' +
        '<div style="color:#c4b5fd;font-weight:800;margin-bottom:3px">🔒 상담원 전용 — MAX 는 고객에게 말하지 마세요</div>' +
        '<div class="calc-line" style="padding:1px 0;font-size:10.5px"><span class="l">가이드</span><span class="v">' + won(o.guide_payout) + '</span></div>' +
        '<div class="calc-line" style="padding:1px 0;font-size:10.5px"><span class="l">현재 지급액</span><span class="v">' + won(pay) + '</span></div>' +
        '<div class="calc-line" style="padding:1px 0;font-size:10.5px"><span class="l">MAX</span><span class="v" style="color:#c4b5fd">' + won(o.max_payout) + '</span></div>' +
      '</div>';
  }

  // ─── 4. 계약정보 입력 (렌탈사 가입기준 기반 폼 명세) ───
  async function loadForm(o) {
    var box = $('rt-form');
    box.innerHTML = '<div class="rt-empty">계약정보 항목 불러오는 중…</div>';
    try {
      var j = await api('/agent/offers/' + o.id + '/form');
      if (RT.offer !== o) return;
      RT.form = j.form;
      RT.cards = j.cards || [];
      renderForm(j.form);
      quote(o);
    } catch (e) { box.innerHTML = '<div class="rt-empty">⚠ ' + esc(e.message) + '</div>'; }
  }

  function readForm() {
    var d = {};
    if (!RT.form) return d;
    RT.form.sections.forEach(function (s) {
      s.fields.forEach(function (f) {
        var el = $('rt-f-' + f.key);
        if (!el) return;
        d[f.key] = f.type === 'checkbox' ? el.checked : el.value;
      });
    });
    return d;
  }
  function isVisible(rule, d) {
    if (!rule) return true;
    if (rule.truthy) return !!d[rule.field];
    return (rule.in || []).indexOf(d[rule.field]) >= 0;
  }
  function fieldHtml(f) {
    var id = 'rt-f-' + f.key;
    var req = f.required ? ' <span class="rt-req">*</span>' : '';
    var hint = f.hint ? '<span class="rt-hint">' + esc(f.hint) + '</span>' : '';
    var input;
    if (f.type === 'select') {
      input = '<select id="' + id + '"><option value="">— 선택 —</option>' + (f.options || []).map(function (op) { return '<option>' + esc(op) + '</option>'; }).join('') + '</select>';
    } else if (f.type === 'checkbox') {
      return '<label class="rt-field rt-check" data-key="' + f.key + '"><input type="checkbox" id="' + id + '"' + (f.disabled ? ' disabled' : '') + '> ' + esc(f.label) + req + hint + '</label>';
    } else if (f.type === 'textarea') {
      input = '<textarea id="' + id + '" rows="2"></textarea>';
    } else if (f.type === 'address') {
      input = '<div style="display:flex;gap:4px"><input type="text" id="' + id + '" readonly placeholder="🔍 주소 검색" style="flex:1;cursor:pointer;background:#f9fafb"><button type="button" class="rt-addr-btn" data-target="' + id + '">검색</button></div>';
    } else {
      var t = f.type === 'tel' ? 'tel' : f.type === 'date' ? 'date' : f.type === 'email' ? 'email' : 'text';
      input = '<input type="' + t + '" id="' + id + '"' + (t === 'tel' ? ' inputmode="numeric" maxlength="13" placeholder="010-0000-0000"' : '') + '>';
    }
    return '<label class="rt-field" data-key="' + f.key + '">' + esc(f.label) + req + hint + input + '</label>';
  }

  function renderForm(form) {
    var box = $('rt-form');
    var card = $('rt-form-card');
    if (!form) { card.style.display = 'none'; box.innerHTML = ''; return; }
    card.style.display = '';
    var html = '';
    if (form.notices && form.notices.length) {
      html += '<div class="rt-notices">' + form.notices.map(function (n) { return '<div class="rt-notice rt-notice-' + esc(n.kind) + '">' + esc(n.text) + '</div>'; }).join('') + '</div>';
    }
    form.sections.forEach(function (s) {
      html += '<fieldset class="rt-section" data-sec="' + esc(s.id) + '"><legend>' + esc(s.title) + '</legend>' +
        (s.notice ? '<div class="rt-hint" style="margin-bottom:6px">' + esc(s.notice) + '</div>' : '') +
        '<div class="rt-grid">' + s.fields.map(fieldHtml).join('') + '</div></fieldset>';
    });
    html += '<div class="rt-docs" id="rt-docs"></div>';
    box.innerHTML = html;

    box.querySelectorAll('input,select,textarea').forEach(function (el) {
      el.addEventListener('input', applyVisibility);
      el.addEventListener('change', applyVisibility);
    });
    var phone = $('rt-f-customer_phone');
    if (phone && typeof formatPhoneAuto === 'function') phone.addEventListener('input', function () { phone.value = formatPhoneAuto(phone.value); });
    box.querySelectorAll('.rt-addr-btn').forEach(function (b) { b.addEventListener('click', function () { openAddress(b.dataset.target); }); });
    var addr = $('rt-f-customer_address');
    if (addr) addr.addEventListener('click', function () { openAddress('rt-f-customer_address'); });
    applyVisibility();
  }

  function applyVisibility() {
    if (!RT.form) return;
    var d = readForm();
    RT.form.sections.forEach(function (s) {
      var secEl = document.querySelector('#rt-form fieldset[data-sec="' + s.id + '"]');
      if (secEl) secEl.style.display = isVisible(s.show_if, d) ? '' : 'none';
      s.fields.forEach(function (f) {
        var el = document.querySelector('#rt-form .rt-field[data-key="' + f.key + '"]');
        if (!el) return;
        el.style.display = isVisible(f.show_if, d) ? '' : 'none';
        var star = f.required || (f.required_if && isVisible(f.required_if, d));
        el.classList.toggle('rt-required', !!star);
      });
    });
    renderDocs(d);
  }

  function renderDocs(d) {
    var box = $('rt-docs');
    if (!box || !RT.form) return;
    var docs = [];
    (RT.form.documents || []).forEach(function (doc) {
      if (doc.holders && doc.holders.indexOf(d.holder_type) < 0) return;
      if (doc.flag && !d[doc.flag]) return;
      var prev = docs.filter(function (x) { return x.label === doc.label; })[0];
      if (prev) { if (!doc.situational) { prev.situational = false; prev.when = doc.when; } return; }
      docs.push({ label: doc.label, situational: doc.situational, when: doc.when });
    });
    if (!d.holder_type) { box.innerHTML = '<div class="rt-hint">가입 명의를 고르면 필요한 서류가 나옵니다.</div>'; return; }
    box.innerHTML = '<div class="rt-docs-title">📎 ' + esc(d.holder_type) + ' 필요 서류 <span class="rt-hint">계약처리에서 수령 체크합니다</span></div>' +
      (docs.length ? docs.map(function (doc) {
        return '<div class="rt-doc">' + (doc.situational ? '◻︎' : '■') + ' ' + esc(doc.label) + (doc.situational ? ' <span class="rt-hint">(' + esc(doc.when) + ')</span>' : '') + '</div>';
      }).join('') : '<div class="rt-hint">추가 서류 없음</div>');
  }

  function openAddress(targetId) {
    var input = $(targetId);
    var proceed = function () {
      var modal = $('daum-postcode-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'daum-postcode-modal';
        modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:99999;align-items:center;justify-content:center';
        modal.innerHTML = '<div style="position:relative;width:min(560px,95vw);height:min(640px,90vh);background:#fff;border-radius:10px;overflow:hidden"><button type="button" id="daum-postcode-close" style="position:absolute;top:8px;right:8px;z-index:1;width:30px;height:30px;border:none;background:rgba(0,0,0,0.6);color:#fff;border-radius:50%;cursor:pointer">✕</button><div id="daum-postcode-wrap" style="width:100%;height:100%"></div></div>';
        document.body.appendChild(modal);
        modal.addEventListener('click', function (e) { if (e.target === modal) modal.style.display = 'none'; });
        modal.querySelector('#daum-postcode-close').addEventListener('click', function () { modal.style.display = 'none'; });
      }
      var wrap = $('daum-postcode-wrap');
      wrap.innerHTML = '';
      modal.style.display = 'flex';
      new window.daum.Postcode({
        oncomplete: function (data) {
          input.value = data.address + (data.buildingName ? ' (' + data.buildingName + ')' : '');
          modal.style.display = 'none';
          var detail = $('rt-f-customer_address_detail'); if (detail) detail.focus();
          applyVisibility();
        },
        width: '100%', height: '100%',
      }).embed(wrap);
    };
    if (window.daum && window.daum.Postcode) return proceed();
    var s = document.createElement('script');
    s.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
    s.onload = proceed;
    s.onerror = function () { alert('주소 검색을 불러오지 못했습니다'); };
    document.head.appendChild(s);
  }

  // ─── 5. 계약 등록 ───
  async function submit() {
    var msg = $('rt-deal-msg');
    var o = RT.offer;
    document.querySelectorAll('#rt-form .rt-field.rt-err').forEach(function (e) { e.classList.remove('rt-err'); });
    if (!o || !RT.form) { msg.className = 'rt-msg err'; msg.textContent = '조건을 먼저 고르세요.'; return; }
    if (o.guide_payout == null || o.max_payout == null) { msg.className = 'rt-msg err'; msg.textContent = '가이드·MAX 미설정 조건은 등록할 수 없습니다.'; return; }
    var d = readForm();
    var missing = [];
    RT.form.sections.forEach(function (s) {
      if (!isVisible(s.show_if, d)) return;
      s.fields.forEach(function (f) {
        if (!isVisible(f.show_if, d)) return;
        var need = f.required || (f.required_if && isVisible(f.required_if, d));
        var v = d[f.key];
        var empty = f.type === 'checkbox' ? v !== true : !String(v || '').trim();
        if (need && empty) {
          missing.push(f.label);
          var el = document.querySelector('#rt-form .rt-field[data-key="' + f.key + '"]'); if (el) el.classList.add('rt-err');
        }
      });
    });
    if (missing.length) { msg.className = 'rt-msg err'; msg.textContent = '필수 입력: ' + missing.join(', '); return; }

    var pay = currentPay();
    var m = RT.model || {};
    var base = ['customer_name', 'customer_phone', 'customer_address', 'customer_address_detail', 'installation_date', 'installation_time', 'notes'];
    var app = {};
    Object.keys(d).forEach(function (k) { if (base.indexOf(k) < 0 && d[k] !== '' && d[k] !== false) app[k] = d[k]; });
    var body = {
      sale_kind: 'rental',
      rental_offer_id: o.id,
      actual_payout: pay,
      customer_name: d.customer_name, customer_phone: d.customer_phone,
      customer_address: d.customer_address, customer_address_detail: d.customer_address_detail,
      installation_date: d.installation_date || null, installation_time: d.installation_time || null,
      notes: d.notes || null,
      contract_date: new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }),
      monthly_fee: o.display_fee,
      rental_application: app,
      quote_summary: '렌탈 · ' + (m.supplier_name || '') + ' · ' + (m.product_name || m.model_code || '') + ' · ' + o.ticket_number + ' · ' + contractText(o) + ' · ' + careText(o) + ' · ' + typeText(o) + ' · ' + freeMonths(pay, o) + '개월 무료',
      quote_full_html: customerQuoteHtml(o, pay),
    };
    msg.className = 'rt-msg'; msg.textContent = '등록 중…';
    var btn = $('rt-deal-submit');
    if (btn.disabled) return;
    btn.disabled = true;   // 더블클릭으로 같은 계약이 두 번 들어가지 않게
    try {
      var r = await fetch(INC_API + '/sales', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() }, body: JSON.stringify(body) });
      var j = await r.json().catch(function () { return {}; });
      if (!r.ok) {
        msg.className = 'rt-msg err';
        msg.textContent = '등록 실패: ' + (j.error || r.status) + (j.fields ? ' — ' + j.fields.map(function (f) { return f.message; }).join(', ') : '');
        (j.fields || []).forEach(function (f) { var el = document.querySelector('#rt-form .rt-field[data-key="' + f.key + '"]'); if (el) el.classList.add('rt-err'); });
        return;
      }
      msg.className = 'rt-msg ok';
      msg.textContent = '✅ 등록됨 — 계약 처리로 넘어갔습니다 (ID ' + String(j.sale && j.sale.id || '').slice(0, 8) + ')';
      renderForm(RT.form);
    } catch (e) { msg.className = 'rt-msg err'; msg.textContent = '등록 실패: ' + e.message; }
    finally { btn.disabled = false; }
  }

  // ─── 초기화 ───
  async function loadSuppliers() {
    try {
      var j = await api('/suppliers');
      $('rt-supplier').innerHTML = '<option value="">전체 렌탈사</option>' + (j.suppliers || []).map(function (s) { return '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>'; }).join('');
    } catch (e) { $('rt-search-msg').textContent = '⚠ ' + e.message; }
  }

  window.rentalInit = function () {
    quote(RT.offer);
    if (RT.inited) return;
    RT.inited = true;
    loadSuppliers();
    loadCategories();
    search();
    $('rt-cats').addEventListener('click', function (e) {
      var c = e.target.closest('[data-cat]'); if (!c) return;
      RT.category = c.dataset.cat;
      $('rt-cats').querySelectorAll('.tm-option').forEach(function (x) { x.classList.toggle('selected', x === c); });
      search();
    });
    $('rt-more').addEventListener('click', function () { search(true); });
    var timer;
    $('rt-q').addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { search(); }, 300); });
    $('rt-q').addEventListener('keypress', function (e) { if (e.key === 'Enter') { clearTimeout(timer); search(); } });
    $('rt-supplier').addEventListener('change', function () { search(); });
    $('rt-models').addEventListener('click', function (e) {
      var c = e.target.closest('[data-mid]'); if (c) openModel(c.dataset.mid);
    });
    $('rt-axes').addEventListener('click', function (e) {
      var op = e.target.closest('[data-axis]'); if (!op) return;
      var k = op.dataset.axis, v = op.dataset.val;
      if (RT.pick[k] === v) delete RT.pick[k]; else RT.pick[k] = v;
      renderOffers();
    });
    $('rt-offer-table').addEventListener('click', function (e) {
      var tr = e.target.closest('[data-oid]'); if (!tr) return;
      var o = RT.offers.filter(function (x) { return x.id === tr.dataset.oid; })[0];
      if (o) { RT.pick = pickFor(o); renderOffers(); }
    });
    var sl = $('rt-payout'), num = $('rt-payout-num');
    sl.addEventListener('input', function () { payout(RT.offer); });
    num.addEventListener('blur', function () {
      var v = parseInt(String(num.value).replace(/[^0-9]/g, ''), 10);
      if (isNaN(v)) v = Number(num.min);
      sl.value = Math.max(Number(num.min), Math.min(Number(num.max), v));
      payout(RT.offer);
    });
    num.addEventListener('keypress', function (e) { if (e.key === 'Enter') num.blur(); });
    $('rt-deal-submit').addEventListener('click', submit);
  };

  // 테스트용 노출
  window.__rentalTab = { RT: RT, freeMonths: freeMonths, phasesText: phasesText };
})();
