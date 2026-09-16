/* ═══════════════════════════════════════════════════════════════
 * 상품관리 — 🧊 렌탈 탭 (admin)
 *   요약 · 빌리고 월별 엑셀 적재(미리보기→확정) · 가이드·MAX 마진 규칙 · 상품/조건 편집 · 플랫폼 연동 표시 · 프로모션
 * API: /api/rental-catalog/*
 * ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var API = '/api/rental-catalog';
  var TYPE = { normal: '일반', package: '패키지', bundle: '결합', trade_in: '타사보상', half: '반값', prepay: '선납', promo: '프로모션', special: '특가', field: '현장', staff: '임직원', purchase: '일시불' };
  var CARE = { visit: '방문', self: '자가', delivery: '택배', none: '관리없음' };
  var ST = { inited: false, page: 1, total: 0, models: [], open: null, batchId: null, suppliers: [], categories: [] };
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function won(n) { return n == null ? '—' : Number(n).toLocaleString(); }
  function token() { return localStorage.getItem('incentive-auth-token-v1'); }
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

  // ─── 요약 ───
  async function loadStats() {
    try {
      var s = await call('/stats');
      $('rp-k-models').textContent = won(s.models);
      $('rp-k-offers').textContent = won(s.offers);
      $('rp-k-set').textContent = won(s.payout_set);
      $('rp-k-unset').textContent = won(s.payout_unset);
      $('rp-k-rebate').textContent = won(s.rebate_changed);
      $('rp-k-linked').textContent = won(s.linked_models);
    } catch (e) { msg('rp-msg', '요약 조회 실패: ' + e.message, true); }
  }

  // ─── 엑셀 적재 ───
  async function preview() {
    var f = $('rp-file').files[0];
    var month = $('rp-month').value;
    if (!f || !month) return msg('rp-import-msg', '월과 파일을 고르세요', true);
    var fd = new FormData(); fd.append('file', f); fd.append('month', month);
    msg('rp-import-msg', '엑셀 읽는 중… (가전 파일은 1분 정도 걸립니다)');
    $('rp-import-result').innerHTML = '';
    try {
      var j = await call('/import/preview', { method: 'POST', body: fd });
      ST.batchId = j.batch_id;
      var s = j.summary;
      $('rp-import-result').innerHTML =
        '<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin:10px 0">' +
        [['신규', s.new, '#86efac'], ['변경', s.changed, '#fbbf24'], ['유지', s.unchanged, '#94a3b8'], ['판매종료', s.removed, '#fca5a5'], ['재판매', s.reappeared, '#60a5fa'], ['리베이트 변동', s.rebate_changed, '#c4b5fd']]
          .map(function (x) { return '<div class="kpi-card"><div class="kpi-label">' + x[0] + '</div><div class="kpi-val" style="color:' + x[2] + '">' + won(x[1]) + '</div></div>'; }).join('') + '</div>' +
        '<table><thead><tr><th>시트</th><th>변환기</th><th>값 있는 행</th><th>조건</th><th>제외</th><th>누락</th><th>오류</th></tr></thead><tbody>' +
        j.sheets.map(function (x) {
          var bad = x.missing || (x.errors && x.errors.length);
          return '<tr style="' + (bad ? 'background:rgba(220,38,38,.15)' : '') + '"><td>' + esc(x.sheet) + '</td><td>' + esc(x.adapter || '없음') + '</td><td>' + won(x.dataRows) + '</td><td>' + won(x.offers) + '</td><td title="' + esc(JSON.stringify(x.skipReasons || {})) + '">' + won(x.skipped) + '</td><td>' + (x.missing ? '<b style="color:#fca5a5">' + x.missing + '</b>' : '0') + '</td><td>' + ((x.errors && x.errors.length) || 0) + '</td></tr>';
        }).join('') + '</tbody></table>' +
        (j.samples.changed.length ? '<div style="margin-top:8px;font-size:11px;color:#94a3b8">변경 예시: ' + j.samples.changed.slice(0, 5).map(function (c) { return esc(c.model) + ' ' + esc(c.fields.join('/')); }).join(' · ') + '</div>' : '');
      $('rp-commit').style.display = '';
      $('rp-commit').disabled = !!j.blocking.length;
      msg('rp-import-msg', j.blocking.length ? '⚠ 누락·오류 시트가 있어 확정할 수 없습니다: ' + j.blocking.join(', ') : '미리보기 완료 — 확인 후 확정하세요 (' + j.file_kind + ')', !!j.blocking.length);
    } catch (e) { msg('rp-import-msg', '실패: ' + e.message, true); }
  }
  async function commit() {
    if (!ST.batchId) return;
    if (!confirm('이 엑셀을 반영합니다. 가이드·MAX 는 바뀌지 않고, 요금·리베이트·판매상태만 갱신됩니다.')) return;
    msg('rp-import-msg', '반영 중…');
    $('rp-commit').disabled = true;
    try {
      var j = await call('/import/' + ST.batchId + '/commit', { method: 'POST', json: {} });
      msg('rp-import-msg', '✅ 반영 완료 — 신규 ' + won(j.summary.new) + ' · 변경 ' + won(j.summary.changed) + ' · 판매종료 ' + won(j.summary.removed));
      ST.batchId = null; $('rp-commit').style.display = 'none';
      loadStats(); loadModels();
    } catch (e) { msg('rp-import-msg', '실패: ' + e.message, true); $('rp-commit').disabled = false; }
  }

  // ─── 마진 규칙 ───
  async function applyMargin(dry) {
    var body = { margin_pct: Number($('rp-margin').value), guide_margin_pct: $('rp-guide-margin').value === '' ? null : Number($('rp-guide-margin').value), basis: $('rp-basis').value, supplier_id: $('rp-m-supplier').value || null, only_unset: $('rp-only-unset').checked, dry_run: dry };
    if (!dry && !confirm((body.supplier_id ? $('rp-m-supplier').selectedOptions[0].text : '전체 렌탈사') + ' 조건의 가이드·MAX 를 가이드 마진 ' + body.guide_margin_pct + '% · MAX 마진 ' + body.margin_pct + '% 규칙으로 덮어씁니다.' + (body.only_unset ? ' (미설정 조건만)' : ''))) return;
    msg('rp-margin-msg', dry ? '계산 중…' : '적용 중…');
    try {
      var j = await call('/offers/apply-margin', { method: 'POST', json: body });
      $('rp-margin-samples').innerHTML = '<table><thead><tr><th>티켓</th><th>리베이트</th><th>월요금</th><th>현재 가이드/MAX</th><th>새 가이드</th><th>새 MAX</th><th>무료개월</th></tr></thead><tbody>' +
        (j.samples || []).map(function (x) { return '<tr><td>' + esc(x.ticket_number) + '</td><td>' + won(x.rebate) + '</td><td>' + won(x.display_fee) + '</td><td>' + won(x.old_g) + ' / ' + won(x.old_m) + '</td><td><b>' + won(x.new_g) + '</b></td><td>' + won(x.new_m) + '</td><td>' + (x.free_months == null ? '—' : x.free_months + '개월') + '</td></tr>'; }).join('') + '</tbody></table>';
      msg('rp-margin-msg', (dry ? '미리보기: ' : '✅ 적용: ') + won(j.matched) + '개 조건' + (dry ? ' (예시 12개)' : ''));
      if (!dry) { loadStats(); loadModels(); }
    } catch (e) { msg('rp-margin-msg', '실패: ' + e.message, true); }
  }

  // ─── 상품 목록 ───
  async function loadModels(append) {
    var seq = ST.seq = (ST.seq || 0) + 1;   // 늦게 온 이전 응답이 최신 필터 결과를 덮지 않게
    ST.page = append ? ST.page + 1 : 1;
    var qs = '?size=40&page=' + ST.page;
    var q = $('rp-q').value.trim(); if (q) qs += '&q=' + encodeURIComponent(q);
    if ($('rp-f-supplier').value) qs += '&supplier=' + encodeURIComponent($('rp-f-supplier').value);
    if ($('rp-f-category').value) qs += '&category=' + encodeURIComponent($('rp-f-category').value);
    if ($('rp-f-flag').value === 'unset') qs += '&payout=unset';
    if ($('rp-f-flag').value === 'rebate') qs += '&rebate_changed=true';
    if ($('rp-f-flag').value === 'linked') qs += '&linked=true';
    try {
      var j = await call('/models' + qs);
      if (seq !== ST.seq) return;
      ST.models = append ? ST.models.concat(j.models) : j.models;
      ST.total = j.total;
      renderModels();
    } catch (e) { $('rp-models').innerHTML = '<tr><td colspan="9" style="color:#fca5a5">' + esc(e.message) + '</td></tr>'; }
  }
  function renderModels() {
    $('rp-count').textContent = won(ST.total) + '개 모델' + (ST.total > ST.models.length ? ' · ' + ST.models.length + '개 표시' : '');
    $('rp-more').style.display = ST.total > ST.models.length ? '' : 'none';
    $('rp-models').innerHTML = ST.models.map(function (m) {
      var unset = m.offer_count - m.payout_set_count;
      return '<tr class="rp-model" data-id="' + esc(m.id) + '" style="cursor:pointer">' +
        '<td>' + (m.image_url ? '<img src="' + esc(m.image_url) + '" style="width:36px;height:36px;object-fit:contain;background:#fff;border-radius:4px">' : '') + '</td>' +
        '<td>' + esc(m.supplier_name) + '</td><td>' + esc((ST.categories.filter(function (c) { return c.slug === m.category; })[0] || {}).label || m.category || '') + '</td>' +
        '<td><b>' + esc(m.product_name || '') + '</b><div style="font-size:10px;color:#94a3b8">' + esc(m.model_code || m.model_key) + '</div></td>' +
        '<td>' + won(m.offer_count) + '</td><td>' + won(m.min_display_fee) + '</td>' +
        '<td>' + (unset > 0 ? '<span style="color:#fca5a5">미설정 ' + unset + '</span>' : '<span style="color:#86efac">완료</span>') + (m.rebate_changed_count ? ' <span style="color:#c4b5fd">리베이트변동 ' + m.rebate_changed_count + '</span>' : '') + '</td>' +
        '<td>' + (m.max_free_months != null ? '최대 ' + m.max_free_months + '개월' : '—') + '</td>' +
        '<td><label style="font-size:11px" onclick="event.stopPropagation()"><input type="checkbox" class="rp-link" data-id="' + esc(m.id) + '"' + (m.platform_linked ? ' checked' : '') + '> 플랫폼</label></td>' +
        '</tr>' + (ST.open === m.id ? '<tr><td colspan="9" id="rp-offers-' + esc(m.id) + '" style="background:#0f172a;padding:10px">불러오는 중…</td></tr>' : '');
    }).join('');
    if (ST.open) loadOffers(ST.open);
  }
  async function loadOffers(modelId) {
    var box = $('rp-offers-' + modelId); if (!box) return;
    try {
      var j = await call('/models/' + modelId);
      box.innerHTML = '<table><thead><tr><th>티켓</th><th>유형</th><th>약정</th><th>관리</th><th>월요금(할인→기준)</th><th>리베이트</th><th>가이드</th><th>MAX</th><th>무료</th><th>상태</th><th></th></tr></thead><tbody>' +
        j.offers.map(function (o) {
          var fee = (o.price_phases || []).length ? o.price_phases.map(function (p) { return p.from + '~' + p.to + ' ' + won(p.fee); }).join(', ') + ' → ' + won(o.monthly_fee) : won(o.monthly_fee);
          var care = o.care_type === 'visit' ? '방문' + (o.cycle_months ? ' ' + o.cycle_months + 'M' : '') : (CARE[o.care_type] || o.care_label || '—');
          return '<tr data-oid="' + esc(o.id) + '" style="' + (o.status === 'discontinued' ? 'opacity:.45' : '') + '">' +
            '<td style="font-family:monospace">' + esc(o.ticket_number) + '</td>' +
            '<td>' + esc(TYPE[o.offer_type] || o.offer_type) + (o.offer_tags && o.offer_tags.length ? '<div style="font-size:9.5px;color:#94a3b8">' + esc(o.offer_tags.join('·')) + '</div>' : '') + '</td>' +
            '<td>' + esc(o.contract_months || '—') + '</td><td>' + esc(care) + '</td><td style="font-size:11px">' + esc(fee) + '</td>' +
            '<td>' + won(o.rebate) + (o.rebate_changed ? ' <span style="color:#c4b5fd">변동</span>' : '') + '</td>' +
            '<td><input class="rp-g" type="number" step="10000" value="' + (o.guide_payout == null ? '' : o.guide_payout) + '" style="width:90px"></td>' +
            '<td><input class="rp-m" type="number" step="1000" value="' + (o.max_payout == null ? '' : o.max_payout) + '" style="width:90px"></td>' +
            '<td>' + (o.free_months == null ? '—' : o.free_months + '개월') + '</td>' +
            '<td>' + esc({ active: '판매중', paused: '일시중단', discontinued: '판매종료' }[o.status] || o.status) + '</td>' +
            '<td><button class="btn-row btn-save rp-save">저장</button></td></tr>';
        }).join('') + '</tbody></table>';
    } catch (e) { box.textContent = '⚠ ' + e.message; }
  }
  async function saveOffer(tr) {
    var g = tr.querySelector('.rp-g').value, m = tr.querySelector('.rp-m').value;
    var btn = tr.querySelector('.rp-save');
    var bad = [['가이드', g], ['MAX', m]].filter(function (x) { return x[1] !== '' && (!/^\d+$/.test(x[1]) || (x[0] === '가이드' && Number(x[1]) % 10000)); });
    if (bad.length) {
      btn.textContent = bad[0][0] === '가이드' ? '만원단위' : '숫자만';
      setTimeout(function () { btn.textContent = '저장'; }, 1800);
      return;
    }
    if (m !== '' && g !== '' && Number(m) < Number(g)) { btn.textContent = 'MAX<가이드'; setTimeout(function () { btn.textContent = '저장'; }, 1800); return; }
    btn.textContent = '…';
    try {
      await call('/offers/' + tr.dataset.oid, { method: 'PATCH', json: { guide_payout: g === '' ? null : Number(g), max_payout: m === '' ? null : Number(m) } });
      btn.textContent = '✓'; setTimeout(function () { btn.textContent = '저장'; }, 1200);
      tr.querySelector('.rp-g').defaultValue = g; tr.querySelector('.rp-m').defaultValue = m;
      loadStats();
    } catch (e) {
      // 거절된 값은 되돌린다 — 저장 안 된 숫자가 화면에 남아 저장된 것처럼 보이지 않게
      tr.querySelector('.rp-g').value = tr.querySelector('.rp-g').defaultValue;
      tr.querySelector('.rp-m').value = tr.querySelector('.rp-m').defaultValue;
      btn.textContent = '실패'; btn.title = e.message;
      setTimeout(function () { btn.textContent = '저장'; }, 2500);
    }
  }

  // ─── 프로모션 ───
  async function loadPromos() {
    try {
      var j = await call('/promotions');
      $('rp-promos').innerHTML = (j.promotions || []).map(function (p) {
        var sup = (ST.suppliers.filter(function (s) { return s.id === p.supplier_id; })[0] || {}).name || p.supplier_id;
        var today = new Date().toISOString().slice(0, 10);
        var live = p.is_active && (!p.period_from || p.period_from <= today) && (!p.period_to || p.period_to >= today);
        return '<tr><td>' + esc(sup) + '</td><td><b>' + esc(p.title) + '</b><div style="font-size:10.5px;color:#94a3b8">' + esc(p.summary || '') + '</div></td><td>' + esc(p.period_from || '') + ' ~ ' + esc(p.period_to || '') + '</td><td>' + esc(p.stacking && p.stacking.text || '') + '</td><td>' + (live ? '<span style="color:#86efac">진행중</span>' : '<span style="color:#94a3b8">종료/대기</span>') + '</td></tr>';
      }).join('') || '<tr><td colspan="5" style="color:#94a3b8">등록된 프로모션이 없습니다.</td></tr>';
    } catch (e) { $('rp-promos').innerHTML = '<tr><td colspan="5" style="color:#fca5a5">' + esc(e.message) + '</td></tr>'; }
  }
  async function addPromo() {
    var body = { supplier_id: $('rp-p-supplier').value, title: $('rp-p-title').value.trim(), summary: $('rp-p-summary').value.trim() || null,
      period_from: $('rp-p-from').value || null, period_to: $('rp-p-to').value || null, stacking: $('rp-p-stack').value.trim() ? { text: $('rp-p-stack').value.trim() } : null };
    if (!body.supplier_id || !body.title) return msg('rp-promo-msg', '렌탈사와 제목은 필수', true);
    if (!body.period_from || !body.period_to) return msg('rp-promo-msg', '프로모션은 자주 바뀌므로 시작일·종료일이 필수입니다', true);
    if (body.period_from > body.period_to) return msg('rp-promo-msg', '종료일이 시작일보다 빠릅니다', true);
    try { await call('/promotions', { method: 'POST', json: body }); msg('rp-promo-msg', '✅ 등록됨'); ['rp-p-title', 'rp-p-summary', 'rp-p-stack'].forEach(function (id) { $(id).value = ''; }); loadPromos(); }
    catch (e) { msg('rp-promo-msg', e.message, true); }
  }

  window.initRentalAdmin = async function () {
    if (ST.inited) { loadStats(); return; }
    ST.inited = true;
    $('rp-month').value = new Date().toISOString().slice(0, 7);
    try {
      var sup = await call('/suppliers'); ST.suppliers = sup.suppliers || [];
      var opts = '<option value="">전체 렌탈사</option>' + ST.suppliers.map(function (s) { return '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>'; }).join('');
      ['rp-f-supplier', 'rp-m-supplier'].forEach(function (id) { $(id).innerHTML = opts; });
      $('rp-p-supplier').innerHTML = '<option value="">렌탈사 선택</option>' + ST.suppliers.map(function (s) { return '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>'; }).join('');
      var cat = await call('/agent/categories'); ST.categories = cat.categories || [];
      $('rp-f-category').innerHTML = '<option value="">전체 카테고리</option>' + ST.categories.map(function (c) { return '<option value="' + esc(c.slug) + '">' + esc(c.label) + ' (' + c.count + ')</option>'; }).join('');
    } catch (e) { msg('rp-msg', e.message, true); }
    $('rp-preview').addEventListener('click', preview);
    $('rp-commit').addEventListener('click', commit);
    $('rp-margin-preview').addEventListener('click', function () { applyMargin(true); });
    $('rp-margin-apply').addEventListener('click', function () { applyMargin(false); });
    var t; $('rp-q').addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { loadModels(); }, 300); });
    ['rp-f-supplier', 'rp-f-category', 'rp-f-flag'].forEach(function (id) { $(id).addEventListener('change', function () { loadModels(); }); });
    $('rp-more').addEventListener('click', function () { loadModels(true); });
    $('rp-models').addEventListener('click', function (e) {
      var save = e.target.closest('.rp-save'); if (save) return saveOffer(save.closest('tr'));
      if (e.target.closest('input')) return;
      var tr = e.target.closest('.rp-model'); if (!tr) return;
      ST.open = ST.open === tr.dataset.id ? null : tr.dataset.id;
      renderModels();
    });
    $('rp-models').addEventListener('change', async function (e) {
      if (!e.target.classList.contains('rp-link')) return;
      try { await call('/models/' + e.target.dataset.id, { method: 'PATCH', json: { platform_linked: e.target.checked } }); loadStats(); }
      catch (err) { e.target.checked = !e.target.checked; alert(err.message); }
    });
    $('rp-p-add').addEventListener('click', addPromo);
    loadStats(); loadModels(); loadPromos();
  };
})();
