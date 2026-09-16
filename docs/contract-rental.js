/* ═══════════════════════════════════════════════════════════════
 * 계약처리 상세 — 렌탈 계약 (sale_kind = 'rental')
 *   ① 계약 조건 스냅샷(렌탈사·모델·티켓·약정·관리·요금구간·가이드/지급/MAX)
 *   ② 렌탈사 가입기준에 맞춘 계약정보 (계산기에서 받은 값 수정)
 *   ③ 계약 진행 체크리스트 (명의별 필요서류 수령 · 본인인증 · 전자서명 · 주문번호 · 해피콜 · 설치)
 *   서버가 같은 폼 명세로 검증하고, 필수 체크가 비면 계약완료를 막는다.
 * 의존: incentive-contract.html 의 API, getToken, showToast, loadContracts
 * ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var TYPE_LABEL = { normal: '일반', package: '패키지', bundle: '결합', trade_in: '타사보상', half: '반값할인', prepay: '선납', promo: '프로모션', special: '특가', field: '현장', staff: '임직원', purchase: '일시불' };
  var CARE_LABEL = { visit: '방문', self: '자가', delivery: '택배', none: '관리없음' };
  var FORMS = {};

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function won(v) { return v == null ? '-' : Number(v).toLocaleString() + '원'; }

  /** 목록·모달의 상품 자리에 쓰는 대체 상품 */
  window.rentalAsProduct = function (c) {
    if (!c || c.sale_kind !== 'rental' || !c.rental_snapshot) return null;
    var s = c.rental_snapshot;
    return { name: '🧊 ' + ((s.model && (s.model.product_name || s.model.model_code)) || '렌탈'), carrier: s.supplier && s.supplier.name, type: '렌탈', speed: c.rental_ticket_number || '' };
  };

  window.rentalContractCard = function (c) {
    var s = c.rental_snapshot || {};
    var o = s.offer || {};
    var m = s.model || {};
    var care = o.care_type === 'visit' ? '방문' + (o.cycle_months ? ' ' + o.cycle_months + '개월' : '') : (CARE_LABEL[o.care_type] || o.care_label || '-');
    var phases = (o.price_phases || []).map(function (p) { return p.from + '~' + p.to + '개월 ' + (p.fee === 0 ? '면제' : won(p.fee)); });
    if (phases.length) phases.push('이후 ' + won(o.monthly_fee));
    var pay = c.actual_payout, g = c.guide_payout_snapshot, mx = c.max_payout_snapshot;
    var fm = (pay && o.display_fee) ? Math.floor(pay / o.display_fee) : null;
    return '' +
      '<div class="sec-card acc-yellow">' +
        '<div class="sec-title"><span class="sec-icon">🧊</span>렌탈 계약 조건 <span style="font-size:10px;color:#94a3b8;margin-left:auto">계약 시점 스냅샷 · 가입기준 ' + esc(s.policy_as_of || '-') + '</span></div>' +
        '<div class="product-header"><div style="flex:1;min-width:280px">' +
          '<div class="ph-meta">[' + esc(s.supplier && s.supplier.name) + '] ' + esc(m.category || '') + ' · 티켓 <b>' + esc(o.ticket_number || c.rental_ticket_number) + '</b></div>' +
          '<div class="ph-name">' + esc(m.product_name || m.model_code) + ' <span style="font-size:12px;color:#94a3b8">' + esc(m.model_code && m.model_code !== m.product_name ? m.model_code : '') + '</span></div>' +
          '<div class="ph-tags"><span>약정 ' + esc(o.contract_months || '-') + '개월' + (o.ownership_months && o.ownership_months !== o.contract_months ? ' (소유권 ' + esc(o.ownership_months) + ')' : '') + '</span><span style="color:#64748b">·</span><span>' + esc(care) + '</span><span style="color:#64748b">·</span><span>' + esc(TYPE_LABEL[o.offer_type] || o.offer_type) + '</span>' +
          (o.offer_label ? '<span style="color:#64748b">·</span><span>' + esc(o.offer_label) + '</span>' : '') + '</div>' +
          (phases.length ? '<div style="margin-top:6px;font-size:12px;color:#fbbf24">' + esc(phases.join(' → ')) + '</div>' : '') +
          (o.prepay_amount ? '<div style="margin-top:4px;font-size:12px;color:#fbbf24">선납금 ' + won(o.prepay_amount) + '</div>' : '') +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(5,auto);gap:14px;text-align:right">' +
          '<div><div class="ph-payback-label">월 렌탈료</div><div style="font-size:18px;font-weight:900;color:#60a5fa">' + won(o.display_fee) + '</div></div>' +
          '<div><div class="ph-payback-label">가이드</div><div style="font-size:14px;font-weight:800;color:#86efac">' + won(g) + '</div></div>' +
          '<div><div class="ph-payback-label">실제 지급액</div><div style="font-size:17px;font-weight:900;color:#fbbf24">' + won(pay) + '</div><div style="font-size:10px;color:#fcd34d">' + (fm != null ? fm + '개월 무료' : '') + '</div></div>' +
          '<div><div class="ph-payback-label">MAX <span style="background:rgba(248,113,113,.16);color:#fca5a5;padding:1px 4px;border-radius:3px;font-size:8px;font-weight:800">고객 노출 금지</span></div><div style="font-size:14px;font-weight:800;color:#fca5a5">' + won(mx) + '</div></div>' +
          '<div><div class="ph-payback-label">잔존마진</div><div style="font-size:14px;font-weight:800;color:#60a5fa">' + (mx != null && pay != null ? won(mx - pay) : '-') + '</div></div>' +
        '</div></div>' +
      '</div>' +
      '<div class="sec-card acc-blue" id="rental-form-' + esc(c.id) + '">' +
        '<div class="sec-title"><span class="sec-icon">📝</span>렌탈 계약정보 · 진행 체크</div>' +
        '<div style="color:#94a3b8;font-size:12px;padding:8px">렌탈사 가입기준 불러오는 중…</div>' +
      '</div>';
  };

  function visible(rule, d) {
    if (!rule) return true;
    if (rule.truthy) return !!d[rule.field];
    return (rule.in || []).indexOf(d[rule.field]) >= 0;
  }

  function fieldHtml(id, f, v) {
    var key = 'rf-' + id + '-' + f.key;
    var req = f.required ? ' <span style="color:#f87171">*</span>' : '';
    var hint = f.hint ? '<div class="modal-field-hint">' + esc(f.hint) + '</div>' : '';
    if (f.type === 'checkbox') {
      return '<label class="rf-field" data-key="' + f.key + '" style="display:flex;gap:6px;align-items:center;font-size:12px;grid-column:1/-1"><input type="checkbox" id="' + key + '"' + (v === true ? ' checked' : '') + (f.disabled ? ' disabled' : '') + '> ' + esc(f.label) + req + (f.hint ? ' <span class="modal-field-hint" style="margin:0">' + esc(f.hint) + '</span>' : '') + '</label>';
    }
    var input;
    if (f.type === 'select') {
      input = '<select id="' + key + '" class="modal-field-input"><option value="">— 선택 —</option>' + (f.options || []).map(function (op) { return '<option' + (String(v) === String(op) ? ' selected' : '') + '>' + esc(op) + '</option>'; }).join('') + '</select>';
    } else if (f.type === 'textarea') {
      input = '<textarea id="' + key + '" class="modal-field-input" rows="2">' + esc(v) + '</textarea>';
    } else {
      var t = f.type === 'date' ? 'date' : f.type === 'email' ? 'email' : 'text';
      input = '<input type="' + t + '" id="' + key + '" class="modal-field-input" value="' + esc(v) + '">';
    }
    return '<div class="rf-field" data-key="' + f.key + '"><label class="modal-field-label">' + esc(f.label) + req + '</label>' + input + hint + '</div>';
  }

  // 고객명·연락처·주소·설치일·메모는 기존 고객정보/설치 카드에서 편집한다 → 렌탈 폼에서는 뺀다
  var SHARED = ['customer_name', 'customer_phone', 'customer_address', 'customer_address_detail', 'installation_date', 'installation_time', 'notes'];

  window.loadRentalContractForm = async function (c) {
    var box = document.getElementById('rental-form-' + c.id);
    if (!box) return;
    try {
      var r = await fetch(API + '/sales/' + c.id + '/rental-form', { headers: { Authorization: 'Bearer ' + getToken() } });
      var j = await r.json();
      if (!r.ok) throw new Error(j.error || r.status);
      FORMS[c.id] = j;
      render(c, j);
    } catch (e) {
      box.innerHTML = '<div class="sec-title"><span class="sec-icon">📝</span>렌탈 계약정보 · 진행 체크</div><div style="color:#fca5a5;font-size:12px;padding:8px">⚠ ' + esc(e.message) + '</div>';
    }
  };

  function render(c, j) {
    var box = document.getElementById('rental-form-' + c.id);
    var app = c.rental_application || {};
    var proc = c.rental_process || {};
    var html = '<div class="sec-title"><span class="sec-icon">📝</span>렌탈 계약정보 · 진행 체크' +
      (j.offer_status !== 'active' ? '<span style="margin-left:8px;font-size:10px;color:#fca5a5">⚠ 이 조건은 현재 판매중이 아님(' + esc(j.offer_status) + ')</span>' : '') + '</div>';
    if (j.form.notices && j.form.notices.length) {
      html += '<div style="margin-bottom:8px">' + j.form.notices.map(function (n) {
        return '<div style="font-size:11px;line-height:1.55;padding:5px 8px;border-radius:5px;margin-bottom:4px;white-space:pre-line;background:' + (n.kind === 'credit' ? 'rgba(248,113,113,.12);color:#fca5a5' : n.kind === 'stale' ? 'rgba(251,191,36,.12);color:#fcd34d' : 'rgba(148,163,184,.12);color:#cbd5e1') + '">' + esc(n.text) + '</div>';
      }).join('') + '</div>';
    }
    j.form.sections.forEach(function (s) {
      var fields = s.fields.filter(function (f) { return SHARED.indexOf(f.key) < 0; });
      if (!fields.length) return;
      html += '<div class="rf-section" data-sec="' + esc(s.id) + '" style="margin-bottom:10px"><div style="font-size:11.5px;font-weight:800;color:#e2e8f0;margin-bottom:5px">' + esc(s.title) + '</div>' +
        '<div class="sec-grid-2">' + fields.map(function (f) { return fieldHtml(c.id, f, app[f.key]); }).join('') + '</div></div>';
    });
    html += '<div id="rf-check-' + esc(c.id) + '"></div>';

    box.innerHTML = html;
    box.querySelectorAll('input,select,textarea').forEach(function (el) { el.addEventListener('change', function () { refresh(c.id); }); });
    refresh(c.id, proc, j.checklist);
  }

  function readApp(id) {
    var j = FORMS[id]; var d = {};
    j.form.sections.forEach(function (s) {
      s.fields.forEach(function (f) {
        var el = document.getElementById('rf-' + id + '-' + f.key);
        if (!el) return;
        d[f.key] = f.type === 'checkbox' ? el.checked : el.value;
      });
    });
    return d;
  }
  function readProc(id) {
    var j = FORMS[id]; var d = {};
    (j.checklist || []).forEach(function (i) {
      var el = document.getElementById('rp-' + id + '-' + i.key);
      if (!el) return;
      d[i.key] = el.type === 'checkbox' ? el.checked : (el.value || null);
    });
    return d;
  }

  // 명의·조건에 따라 보이는 항목과 필요서류 체크리스트를 다시 그린다
  function refresh(id, procInit, checklistInit) {
    var j = FORMS[id]; if (!j) return;
    var d = readApp(id);
    j.form.sections.forEach(function (s) {
      var sec = document.querySelector('#rental-form-' + id + ' .rf-section[data-sec="' + s.id + '"]');
      if (sec) sec.style.display = visible(s.show_if, d) ? '' : 'none';
      s.fields.forEach(function (f) {
        var el = document.querySelector('#rental-form-' + id + ' .rf-field[data-key="' + f.key + '"]');
        if (el) el.style.display = visible(f.show_if, d) ? '' : 'none';
      });
    });
    var proc = procInit || readProc(id);
    // 체크리스트는 서버가 명의·조건으로 만든다. 화면에서 명의를 바꾸면 서류 목록만 즉시 다시 계산한다.
    var list = checklistInit || buildChecklist(j, d);
    j.checklist = list;
    var groups = {};
    list.forEach(function (i) { (groups[i.group] = groups[i.group] || []).push(i); });
    var html = '<div style="font-size:11.5px;font-weight:800;color:#e2e8f0;margin:6px 0 5px">✅ 계약 진행 체크 <span class="modal-field-hint" style="display:inline">* 는 계약완료 전 필수</span></div>';
    Object.keys(groups).forEach(function (g) {
      html += '<div style="margin-bottom:6px"><div style="font-size:10.5px;color:#94a3b8;margin-bottom:3px">' + esc(g) + '</div>' +
        groups[g].map(function (i) {
          var key = 'rp-' + id + '-' + i.key;
          var v = proc[i.key];
          var star = i.required ? ' <span style="color:#f87171">*</span>' : '';
          var when = i.when && i.when !== '공통' ? ' <span class="modal-field-hint" style="display:inline">(' + esc(i.when) + ')</span>' : '';
          if (i.type === 'date' || i.type === 'text') {
            return '<div style="display:flex;align-items:center;gap:8px;font-size:12px;margin:2px 0"><span style="min-width:190px">' + esc(i.label) + star + '</span><input id="' + key + '" type="' + i.type + '" class="modal-field-input" style="max-width:200px" value="' + esc(v) + '"></div>';
          }
          return '<label style="display:flex;align-items:center;gap:6px;font-size:12px;margin:2px 0"><input id="' + key + '" type="checkbox"' + (v ? ' checked' : '') + '> ' + esc(i.label) + star + when + '</label>';
        }).join('') + '</div>';
    });
    document.getElementById('rf-check-' + id).innerHTML = html;
  }

  // 서버 buildProcessChecklist 와 같은 규칙 (명의·타명의납부로 서류 필터)
  function buildChecklist(j, app) {
    var base = (j.checklist || []).filter(function (i) { return i.group !== '서류'; });
    // 서버 buildProcessChecklist 와 같은 규칙 — 같은 서류는 한 줄, 하나라도 무조건 필요하면 필수
    var docs = [];
    (j.form.documents || []).forEach(function (d) {
      if (d.holders && d.holders.indexOf(app.holder_type) < 0) return;
      if (d.flag && !app[d.flag]) return;
      var prev = docs.filter(function (x) { return x.label === d.label; })[0];
      if (prev) { if (!d.situational) { prev.required = true; prev.when = d.when; } return; }
      docs.push({ key: 'doc:' + d.key, group: '서류', label: d.label, required: !d.situational, when: d.when });
    });
    return docs.concat(base);
  }

  function input(field, label, value, opts) {
    opts = opts || {};
    var req = opts.required ? ' <span style="color:#f87171">*</span>' : '';
    var el;
    if (opts.options) {
      el = '<select class="modal-field-input rc-in" data-field="' + field + '"><option value="">— 선택 —</option>' + opts.options.map(function (o) { return '<option' + (String(value) === String(o) ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>';
    } else if (opts.textarea) {
      el = '<textarea class="modal-field-input rc-in" data-field="' + field + '" rows="' + (opts.rows || 3) + '"' + (opts.readonly ? ' readonly' : '') + '>' + esc(value) + '</textarea>';
    } else {
      el = '<input class="modal-field-input rc-in" data-field="' + field + '" type="' + (opts.type || 'text') + '" value="' + esc(value) + '"' + (opts.readonly ? ' readonly style="cursor:pointer"' : '') + (opts.id ? ' id="' + opts.id + '"' : '') + '>';
    }
    return '<div><label class="modal-field-label">' + esc(label) + req + '</label>' + el + (opts.hint ? '<div class="modal-field-hint">' + esc(opts.hint) + '</div>' : '') + '</div>';
  }

  var STATUS = { pending: '⏰ 계약대기', in_progress: '🚧 계약진행', completed: '✅ 계약완료', cancelled: '❌ 계약취소' };
  var BANKS = ['국민은행', '신한은행', '우리은행', '하나은행', 'NH농협은행', 'IBK기업은행', 'SC제일은행', '카카오뱅크', '토스뱅크', '케이뱅크', '광주은행', '전북은행', '새마을금고', '신협', '우체국', '수협은행', '부산은행', '경남은행', '대구은행', '제주은행'];

  /** 렌탈 계약 전용 상세 — 인터넷 계약 폼을 쓰지 않는다 */
  window.openRentalContractModal = function (c) {
    var a = c.agent || {};
    document.getElementById('modal-subtitle').textContent = (c.contract_date || '-') + ' · ' + (a.name || '?') + ' (' + (a.center || '') + ') · 렌탈 · ID ' + String(c.id).slice(0, 8) + '...';
    var addrId = 'rc-addr-' + c.id;
    document.getElementById('modal-body').innerHTML =
      rentalContractCard(c) +
      '<div class="sec-card acc-green"><div class="sec-title"><span class="sec-icon">👤</span>계약자 · 설치</div>' +
        '<div class="sec-grid-2 sec-row">' +
          input('customer_name', '계약자 이름', c.customer_name, { required: true }) +
          input('customer_phone', '휴대폰', c.customer_phone, { required: true, type: 'tel' }) +
        '</div><div class="sec-grid-2 sec-row">' +
          input('customer_address', '설치 주소', c.customer_address, { required: true, readonly: true, id: addrId, hint: '클릭하면 주소 검색' }) +
          input('customer_address_detail', '상세 주소 (동·호수·층)', c.customer_address_detail, { required: true }) +
        '</div><div class="sec-grid-2 sec-row">' +
          input('installation_date', '설치 희망일', c.installation_date, { type: 'date' }) +
          input('installation_time', '설치 희망 시간', c.installation_time, { options: ['오전', '오후', '협의'] }) +
        '</div></div>' +
      '<div class="sec-card acc-purple"><div class="sec-title"><span class="sec-icon">🏦</span>페이백 지급 계좌 <span style="font-size:10px;color:#94a3b8;margin-left:auto">지급액 ' + won(c.actual_payout) + ' · 계약완료 후 사은품 지급 탭으로 넘어갑니다</span></div>' +
        '<div class="sec-grid-2 sec-row">' +
          input('bank_account_holder', '예금주', c.bank_account_holder) +
          input('bank_name', '은행', c.bank_name, { options: BANKS }) +
        '</div><div class="sec-row">' + input('bank_account_number', '계좌번호', c.bank_account_number) + '</div></div>' +
      '<div class="sec-card"><div class="sec-title"><span class="sec-icon">🚦</span>계약 진행 상태 · 메모</div>' +
        '<div class="sec-grid-2 sec-row">' +
          input('status', '상태', STATUS[c.status] || c.status, { options: Object.keys(STATUS).map(function (k) { return STATUS[k]; }) }) +
          input('cancellation_reason', '취소 사유 (취소일 때)', c.cancellation_reason) +
        '</div>' +
        (c.notes ? '<div class="sec-row">' + input('_tm_notes', 'TM 상담 메모 (읽기 전용)', c.notes, { textarea: true, readonly: true, rows: 2 }) + '</div>' : '') +
        '<div class="sec-row">' + input('contract_notes', '계약부서 메모', c.contract_notes, { textarea: true }) + '</div>' +
        '<div class="modal-field-hint">계약완료는 진행 체크의 * 항목이 모두 채워져야 저장됩니다.</div>' +
      '</div>';

    document.getElementById('modal-footer-info').innerHTML = '렌탈 · 티켓 ' + esc(c.rental_ticket_number || '') + ' · 계약일 ' + esc(c.contract_date || '');
    document.getElementById('modal-footer-actions').innerHTML = '<span id="rc-msg" style="font-size:12px;align-self:center"></span><button class="btn-action btn-save" id="rc-save" style="font-size:12px;padding:8px 22px">💾 렌탈 계약 저장</button>';
    document.getElementById('rc-save').addEventListener('click', function () { saveRentalContract(c.id); });
    var addr = document.getElementById(addrId);
    addr.addEventListener('click', function () { openAddr(addr); });
    document.getElementById('modal-overlay').style.display = 'flex';
    loadRentalContractForm(c);
  };

  function openAddr(target) {
    var go = function () {
      var modal = document.getElementById('rc-postcode');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'rc-postcode';
        modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:100000;align-items:center;justify-content:center';
        modal.innerHTML = '<div style="position:relative;width:min(560px,95vw);height:min(640px,90vh);background:#fff;border-radius:10px;overflow:hidden"><div id="rc-postcode-wrap" style="width:100%;height:100%"></div></div>';
        modal.addEventListener('click', function (e) { if (e.target === modal) modal.style.display = 'none'; });
        document.body.appendChild(modal);
      }
      var wrap = document.getElementById('rc-postcode-wrap'); wrap.innerHTML = '';
      modal.style.display = 'flex';
      new window.daum.Postcode({ oncomplete: function (d) { target.value = d.address + (d.buildingName ? ' (' + d.buildingName + ')' : ''); modal.style.display = 'none'; }, width: '100%', height: '100%' }).embed(wrap);
    };
    if (window.daum && window.daum.Postcode) go(); else alert('주소 검색을 불러오지 못했습니다');
  }

  window.saveRentalContract = async function (id) {
    var msg = document.getElementById('rc-msg');
    var body = {};
    document.querySelectorAll('#modal-body .rc-in[data-field]').forEach(function (el) {
      var f = el.dataset.field;
      if (f.charAt(0) === '_') return;
      body[f] = el.value.trim() === '' ? null : el.value.trim();
    });
    var statusKey = Object.keys(STATUS).filter(function (k) { return STATUS[k] === body.status; })[0];
    if (statusKey) body.status = statusKey; else delete body.status;
    if (!body.customer_name || !body.customer_phone) { msg.style.color = '#fca5a5'; msg.textContent = '이름·휴대폰은 필수'; return; }
    if (FORMS[id]) {
      // 빈칸·체크 해제도 그대로 보낸다 — 지우는 것도 저장돼야 한다 (서버가 명세로 다시 검증)
      var app = readApp(id);
      body.rental_application = app;
      body.rental_process = readProc(id);
    }
    msg.style.color = '#94a3b8'; msg.textContent = '저장 중…';
    try {
      var r = await fetch(API + '/sales/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getToken() }, body: JSON.stringify(body) });
      var j = await r.json().catch(function () { return {}; });
      if (!r.ok) {
        msg.style.color = '#fca5a5';
        msg.textContent = '⚠ ' + (j.error || r.status) + (j.fields ? ' — ' + j.fields.map(function (f) { return f.message; }).join(', ') : '');
        return;
      }
      msg.style.color = '#86efac'; msg.textContent = '✅ 저장됨';
      if (typeof showToast === 'function') showToast('✅ 렌탈 계약 저장');
      if (typeof loadContracts === 'function') loadContracts();
    } catch (e) { msg.style.color = '#fca5a5'; msg.textContent = '⚠ ' + e.message; }
  };
})();
