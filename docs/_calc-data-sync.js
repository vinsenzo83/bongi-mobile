// ═══════════════════════════════════════════════════════════════
// 봉이모바일 — 시드 데이터 동기화 공통 헬퍼
// (calculator.html / tm.html / tm-counselor.html 공유)
// ───────────────────────────────────────────────────────────────
// 시드 데이터 두 흐름:
//   1) incentive_calculator_overrides — TM 데이터관리(calculator.html?admin=1)에서 편집
//      섹션: tv·bundle·device·install·card·gift·gift-catalog-custom·sales
//      편집은 calculator만, 다른 페이지는 read-only 소비
//   2) incentive_products.payback     — 상품 관리 페이지에서 편집
//      모든 소비 페이지가 polling/storage event/BroadcastChannel로 자동 반영
//
// 핵심 보장:
//   - 견적 계산식·D 객체 default·calc 흐름 손대지 않음
//   - 기존 inline 함수와 동일 로직 — calculator.html line 286·992·2954·3798에서 그대로 이전
//   - 신규: visibilitychange + 60초 polling + storage event + BroadcastChannel
// ═══════════════════════════════════════════════════════════════

// ── 공유 상수 ──
var INCENTIVE_TOKEN_KEY = 'incentive-auth-token-v1';

// 섹션(DB 코드) ↔ localStorage 키 매핑 (calculator.html line 2960~2968과 동일)
var SECTION_TO_LS = {
  'tv': 'bongi-tv-overrides',
  'bundle': 'bongi-bundle-overrides',
  'device': 'bongi-device-overrides',
  'install': 'bongi-install-fees',
  'card': 'bongi-partner-cards',
  'gift': 'bongi-gift-overrides',
  'gift-catalog-custom': 'bongi-gift-catalog-custom',
  'sales': 'bongi-sales-overrides-v1',
};

// fetch 결과 분류 — bootstrap이 배너·잠금 결정에 사용
//   'no-token' → 익명 (배너 X, 편집 잠금 X — D default 폴백)
//   'ok'       → DB GET 성공
//   'failed'   → 토큰 있는데 GET 실패 → 배너 + 편집 잠금
var _lastDbFetchStatus = 'unknown';

// ── 토스트·배너·편집잠금 인프라 ──
// (calculator.html line 286~ 그대로 이전 — DOM 컨테이너는 페이지 측에 있어야 함)
function bongiToast(msg, type, opts) {
  type = type || 'success'; opts = opts || {};
  var c = document.getElementById('bongi-toast-container');
  if (!c) return null;
  var el = document.createElement('div');
  el.className = 'bongi-toast ' + type;
  var label = document.createElement('span');
  label.textContent = msg;
  el.appendChild(label);
  if (opts.action && opts.actionLabel) {
    var btn = document.createElement('button');
    btn.type = 'button'; btn.textContent = opts.actionLabel;
    btn.onclick = function(){ try { opts.action(); } catch(e) {} try { el.remove(); } catch(_) {} };
    el.appendChild(btn);
  }
  c.appendChild(el);
  var ms = (opts.durationMs != null) ? opts.durationMs : (type === 'error' ? 8000 : 4000);
  if (ms > 0) setTimeout(function(){ try { el.remove(); } catch(_) {} }, ms);
  return el;
}
function bongiSetDbBanner(visible, htmlMsg) {
  var b = document.getElementById('bongi-db-banner');
  if (!b) return;
  if (visible) {
    if (htmlMsg) { var sp = b.querySelector('span'); if (sp) sp.innerHTML = htmlMsg; }
    b.removeAttribute('hidden');
  } else {
    b.setAttribute('hidden', '');
  }
}
function bongiSetEditingLocked(locked) {
  if (locked) document.body.classList.add('bongi-edit-locked');
  else document.body.classList.remove('bongi-edit-locked');
}
function bongiRetryDbFetch() {
  bongiToast('재연결 시도 중…', 'warning', { durationMs: 2000 });
  if (typeof bootstrapCalculator === 'function') {
    Promise.resolve(bootstrapCalculator()).catch(function(e){
      bongiToast('재시도 실패: ' + (e && e.message || e), 'error');
    });
  } else if (typeof refreshSeedData === 'function') {
    Promise.resolve(refreshSeedData()).catch(function(e){
      bongiToast('재시도 실패: ' + (e && e.message || e), 'error');
    });
  }
}

// ── B 모드 PUT (calculator.html에서 그대로 이전) ──
async function syncCalcOverrideToDbNow(section, payload) {
  var tk = null;
  try { tk = localStorage.getItem(INCENTIVE_TOKEN_KEY); } catch(_) {}
  if (!tk) return { skipped: 'no-token' };
  var res;
  try {
    res = await fetch('/api/incentive/calc-overrides/' + encodeURIComponent(section), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk },
      body: JSON.stringify({ data: payload == null ? {} : payload }),
    });
  } catch (netErr) {
    throw new Error('네트워크 오류 (' + section + '): ' + (netErr && netErr.message || netErr));
  }
  if (!res.ok) {
    var bodyText = '';
    try { bodyText = await res.text(); } catch(_) {}
    var msg = 'PUT ' + section + ' ' + res.status;
    if (bodyText) msg += ' — ' + bodyText.slice(0, 200);
    throw new Error(msg);
  }
  var json = null;
  try { json = await res.json(); } catch(_) {}
  return { ok: true, response: json };
}

var _calcOverridePutTimers = {};
function syncCalcOverrideToDb(section, payload, debounceMs) {
  var ms = (typeof debounceMs === 'number') ? debounceMs : 600;
  if (_calcOverridePutTimers[section]) {
    clearTimeout(_calcOverridePutTimers[section].timer);
    try { _calcOverridePutTimers[section].resolve({ skipped: 'debounced' }); } catch(_) {}
  }
  return new Promise(function(resolve, reject) {
    _calcOverridePutTimers[section] = {
      resolve: resolve,
      timer: setTimeout(function(){
        delete _calcOverridePutTimers[section];
        syncCalcOverrideToDbNow(section, payload).then(resolve, reject);
      }, ms)
    };
  });
}

async function persistOverride(section, sectionLabel, lsKey, payload, options) {
  options = options || {};
  try {
    var r;
    if (options.debounceMs) {
      r = await syncCalcOverrideToDb(section, payload, options.debounceMs);
    } else {
      r = await syncCalcOverrideToDbNow(section, payload);
    }
    if (r.skipped === 'debounced') return { ok: false, skipped: 'debounced' };
    if (r.skipped === 'no-token') {
      try { localStorage.setItem(lsKey, JSON.stringify(payload)); } catch(_) {}
      return { ok: false, skipped: 'no-token' };
    }
    try { localStorage.setItem(lsKey, JSON.stringify(payload)); } catch(_) {}
    if (!options.silent) bongiToast(sectionLabel + ' 저장 완료', 'success', { durationMs: 1800 });
    return { ok: true };
  } catch (e) {
    bongiToast('❌ ' + sectionLabel + ' DB 저장 실패: ' + (e && e.message || e), 'error', {
      actionLabel: '재시도',
      action: function(){ persistOverride(section, sectionLabel, lsKey, payload, options); }
    });
    return { ok: false, error: e };
  }
}

// ── DB → LS 동기화 GET (calculator.html line 3798과 동일) ──
async function fetchCalcOverridesFromDb() {
  var tk = null;
  try { tk = localStorage.getItem(INCENTIVE_TOKEN_KEY); } catch(_) {}
  if (!tk) { _lastDbFetchStatus = 'no-token'; return false; }
  try {
    var res = await fetch('/api/incentive/calc-overrides', {
      headers: { Authorization: 'Bearer ' + tk }
    });
    if (!res.ok) { _lastDbFetchStatus = 'failed'; return false; }
    var json = await res.json();
    var overrides = (json && json.overrides) || {};
    Object.keys(SECTION_TO_LS).forEach(function(section) {
      var lsKey = SECTION_TO_LS[section];
      if (overrides[section] !== undefined && overrides[section] !== null) {
        try { localStorage.setItem(lsKey, JSON.stringify(overrides[section])); } catch(e) {}
      }
    });
    _lastDbFetchStatus = 'ok';
    return true;
  } catch (e) {
    console.warn('[calc-overrides DB fetch]', e);
    _lastDbFetchStatus = 'failed';
    return false;
  }
}

// ── 사은품 동기화 (calculator.html line 1001 / tm.html line 885 / tm-counselor.html line 1991 동일) ──
//   incentive_products.payback → window.D[carrier].gift[bucket][speed]
//   admin이 상품 관리에서 페이백 변경 시 모든 페이지에 자동 반영
async function applyIncentivePaybackSync() {
  try {
    const res = await fetch('/api/incentive/products');
    if (!res.ok) return;
    const { products } = await res.json();
    if (!products || !Array.isArray(products)) return;

    // 'SK'/'LG'(신표기) + 'SKT'/'LGU+'(구표기 backward compat) 둘 다 허용
    const carrierMap = { 'SK': 'skt', 'SKT': 'skt', 'KT': 'kt', 'LG': 'lgu', 'LGU+': 'lgu' };
    products.forEach(p => {
      const cKey = carrierMap[p.carrier];
      if (!cKey || !window.D || !window.D[cKey]) return;
      if (!window.D[cKey].gift) window.D[cKey].gift = { solo: {}, combo: {} };
      const bucket = p.type === '단독' ? 'solo' : 'combo';
      if (p.speed && p.payback != null) {
        if (!window.D[cKey].gift[bucket]) window.D[cKey].gift[bucket] = {};
        window.D[cKey].gift[bucket][p.speed] = p.payback;
      }
    });

    // 9번 티켓 조합 리스트 재생성 + 렌더 (사은품 값이 표시에 박혀 있음)
    if (typeof generateTickets === 'function') {
      try { window.TICKETS = generateTickets(); } catch(e) {}
    }
    if (typeof renderTicketList === 'function') {
      try { renderTicketList(); } catch(e) {}
    }
    if (typeof calc === 'function') calc();
  } catch (e) { console.warn('[gift sync]', e); }
}

// ── 즉시 반영 강화 — 통합 신규 ──
//   1. visibilitychange : 탭 활성화 시 즉시 fetch
//   2. polling 60초    : 기존 5분 → 1분으로 단축
//   3. storage event   : 같은 origin 다른 탭/iframe LS 변경 → 자동 반영
//   4. BroadcastChannel('incentive-products') : 양방향 통신
//
// applyOverridesHook(선택): 페이지가 fetchCalcOverridesFromDb 후 D를 갱신하는 훅 (calculator만 사용)
//   미지정 시 사은품 polling만 (tm/tm-counselor 패턴)
function startSeedAutoSync(opts) {
  opts = opts || {};
  var POLL_MS = opts.pollMs || 60 * 1000;       // 60초
  var FIRST_DELAY = opts.firstDelay || 1000;    // 첫 동기화 1초 후 (D 정의 + bootstrap 여유)
  var applyOverridesHook = opts.applyOverridesHook || null;
  var pageName = opts.pageName || 'page';

  // 통합 동기화 한 사이클: payback (+ optional overrides apply)
  async function tickOnce(reason) {
    try {
      // overrides 갱신 (calculator만 — tm/tm-counselor는 hook 없으면 skip)
      if (applyOverridesHook) {
        await fetchCalcOverridesFromDb();
        try { applyOverridesHook(); } catch(e) { console.warn('[seed sync apply]', e); }
      }
      // 사은품 payback (모든 페이지)
      await applyIncentivePaybackSync();
    } catch (e) { console.warn('[seed sync ' + reason + ']', e); }
  }

  // ─── 모든 핸들·리스너·타이머 참조 보존 + pagehide/beforeunload 시 cleanup ───
  var _firstTimer = setTimeout(function(){ tickOnce('first'); }, FIRST_DELAY);
  var _pollTimer = setInterval(function(){ tickOnce('poll'); }, POLL_MS);
  var _visHandler = function(){ if (!document.hidden) tickOnce('visible'); };
  var _storageHandler = function(e){
    if (!e || !e.key) return;
    var lsKeys = Object.values(SECTION_TO_LS);
    if (lsKeys.indexOf(e.key) >= 0 && applyOverridesHook) {
      try { applyOverridesHook(); } catch(e2) {}
      if (typeof calc === 'function') calc();
    }
  };
  var _bc = null;
  try { document.addEventListener('visibilitychange', _visHandler); } catch(e) {}
  try { window.addEventListener('storage', _storageHandler); } catch(e) {}
  try {
    _bc = new BroadcastChannel('incentive-products');
    _bc.onmessage = function(ev) {
      if (!ev.data || ev.data.type !== 'product-updated') return;
      tickOnce('broadcast');
    };
  } catch(e) { /* unsupported */ }

  // 페이지 종료 시 cleanup — 메모리 누수·중복 핸들러 방지 (SPA 페이지 전환·iframe 재로드 포함)
  function _cleanup() {
    try { clearTimeout(_firstTimer); } catch(_) {}
    try { clearInterval(_pollTimer); } catch(_) {}
    try { document.removeEventListener('visibilitychange', _visHandler); } catch(_) {}
    try { window.removeEventListener('storage', _storageHandler); } catch(_) {}
    try { if (_bc) { _bc.onmessage = null; _bc.close(); _bc = null; } } catch(_) {}
  }
  try { window.addEventListener('pagehide', _cleanup, { once: true }); } catch(_) {}
  try { window.addEventListener('beforeunload', _cleanup, { once: true }); } catch(_) {}

  // 디버깅용 — 페이지에서 명시적 cleanup 호출 가능
  return _cleanup;
}

// ─── tm·tm-counselor 공통 시드 override 적용 (calculator.html은 자체 함수 유지) ───
// 통합 전: 두 파일에 동일 함수 4종(apply{Device,Bundle,TV,Install}Overrides_TM) + KEY 4종 중복
// 통합 후: applyTMSeedOverrides(D) 단일 호출. applyGiftOverrides는 각 파일 자체 정의 유지(폴백)
function applyTMSeedOverrides(D) {
  if (!D) return;
  const KEYS = {
    device: 'bongi-device-overrides',
    bundle: 'bongi-bundle-overrides',
    tv: 'bongi-tv-overrides',
    install: 'bongi-install-fees',
  };
  // device — setTopOptions / wifiOptions
  try {
    const ov = JSON.parse(localStorage.getItem(KEYS.device) || '{}');
    ['skt','kt','lgu'].forEach(k => {
      if (ov[k] && D[k]) {
        if (ov[k].setTopOptions) D[k].setTopOptions = ov[k].setTopOptions;
        if (ov[k].wifiOptions) D[k].wifiOptions = ov[k].wifiOptions;
      }
    });
  } catch(_) {}
  // bundle — deep merge
  try {
    const ov = JSON.parse(localStorage.getItem(KEYS.bundle) || '{}');
    ['skt','kt','lgu'].forEach(k => {
      if (ov[k] && ov[k].bundle && D[k] && D[k].bundle) {
        Object.keys(ov[k].bundle).forEach(key => { D[k].bundle[key] = ov[k].bundle[key]; });
      }
    });
  } catch(_) {}
  // tv — array 그대로 교체
  try {
    const ov = JSON.parse(localStorage.getItem(KEYS.tv) || '{}');
    ['skt','kt','lgu'].forEach(k => {
      if (ov[k] && Array.isArray(ov[k]) && D[k]) D[k].tv = ov[k];
    });
  } catch(_) {}
  // install — INSTALL_FEES 배열 → D[k].install.{solo,combo} 매핑 (인덱스 0=solo, 2=combo)
  try {
    const ov = JSON.parse(localStorage.getItem(KEYS.install) || 'null');
    if (ov) {
      ['skt','kt','lgu'].forEach(k => {
        if (!ov[k] || !D[k]) return;
        const weekday = ov[k].weekday || [];
        const weekend = ov[k].weekend || [];
        if (D[k].install) {
          if (typeof weekday[0] === 'number') D[k].install.solo = weekday[0];
          if (typeof weekday[2] === 'number') D[k].install.combo = weekday[2];
        }
        if (D[k].installWeekend) {
          if (typeof weekend[0] === 'number') D[k].installWeekend.solo = weekend[0];
          if (typeof weekend[2] === 'number') D[k].installWeekend.combo = weekend[2];
        }
      });
    }
  } catch(_) {}
}
// 전역 노출 (tm.html / tm-counselor.html에서 호출)
window.applyTMSeedOverrides = applyTMSeedOverrides;

// 페이지에서 명시적 재시도 호출용
window.refreshSeedData = function() {
  return Promise.all([
    fetchCalcOverridesFromDb(),
    applyIncentivePaybackSync(),
  ]).then(function(){
    if (_lastDbFetchStatus === 'failed') {
      bongiSetDbBanner(true);
      bongiSetEditingLocked(true);
    } else {
      bongiSetDbBanner(false);
      bongiSetEditingLocked(false);
    }
  });
};
