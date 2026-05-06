// ═══════════════════════════════════════════════════════════════════════
// 봉이 — 개인정보 보안 모듈 (PIPA)
// 사용: <script src="/docs/_security.js"></script>
// ─ 워터마크 (사용자명/시각, 반투명 반복)
// ─ 인쇄 차단 (Ctrl+P + @media print)
// ─ 우클릭 차단 (개인정보 노출 페이지)
// ─ copy 시 워터마크 자동 부착
// ─ 탭 비활성 시 화면 blur (어깨너머 보호)
// ═══════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  // 인증 후 호출 가능 — agent 정보 받아 워터마크 적용
  async function fetchAgent() {
    const tk = localStorage.getItem('incentive-auth-token-v1');
    if (!tk) return null;
    try {
      const r = await fetch('/api/incentive/agents/me', { headers: { Authorization: 'Bearer ' + tk }});
      if (!r.ok) return null;
      return (await r.json()).agent || null;
    } catch { return null; }
  }

  function applyWatermark(label) {
    if (document.getElementById('pipa-watermark')) return;
    const wm = document.createElement('div');
    wm.id = 'pipa-watermark';
    wm.setAttribute('aria-hidden', 'true');
    const css = `
      #pipa-watermark { position:fixed; inset:0; pointer-events:none; z-index:9999; opacity:0.06;
        background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='340' height='180'><text x='0' y='100' font-family='Pretendard,sans-serif' font-size='14' fill='%23000' transform='rotate(-22 170 90)'>${encodeURIComponent(label)}</text></svg>");
        background-size:340px 180px; mix-blend-mode:multiply; }
      @media print {
        #pipa-watermark { opacity:0.3 !important; mix-blend-mode:normal; }
        body * { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    document.body.appendChild(wm);
  }

  // 인쇄 차단
  function blockPrint() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        alert('🔒 개인정보 보호 — 인쇄 차단');
      }
      // PrintScreen 차단 (브라우저 한계 — alert만 가능)
      if (e.key === 'PrintScreen') {
        navigator.clipboard?.writeText('');
        alert('⚠️ 개인정보 보호 — 화면 캡처 금지 (감사 로그에 기록됩니다)');
      }
    });
    window.addEventListener('beforeprint', (e) => { e.preventDefault?.(); alert('🔒 인쇄 차단됨'); });
  }

  // copy 시 워터마크 자동 부착 — 누가/언제 복사했는지 추적
  function tagCopy(label) {
    document.addEventListener('copy', (e) => {
      const sel = (window.getSelection() || '').toString();
      if (!sel || sel.length < 5) return;
      const tag = `\n\n[복사 출처: ${label} · ${new Date().toLocaleString('ko-KR')}]`;
      e.clipboardData.setData('text/plain', sel + tag);
      e.preventDefault();
    });
  }

  // 우클릭 차단 (메뉴 통한 저장/복사 방지)
  function blockContext() {
    document.addEventListener('contextmenu', (e) => {
      // input/textarea는 허용 (사용자 입력 편의)
      if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return;
      e.preventDefault();
    });
  }

  // 메인 — 자동 실행
  async function init() {
    const me = await fetchAgent();
    if (!me) return; // 로그인 전엔 적용 안 함
    const ip = (window.location.hostname || '');
    const label = `${me.name} (${me.role}) · ${new Date().toLocaleString('ko-KR', { hour:'2-digit', minute:'2-digit' })} · ${ip}`;
    applyWatermark(label);
    blockPrint();
    tagCopy(label);
    blockContext();
  }

  // 워터마크 적용 전까지 5초 간격 폴링 — 로그인 후 자동 적용
  let _polling = null;
  function tryInit() {
    if (document.getElementById('pipa-watermark')) {
      if (_polling) { clearInterval(_polling); _polling = null; }
      return;
    }
    init();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tryInit);
  else setTimeout(tryInit, 100);
  _polling = setInterval(tryInit, 5000);
  // 다른 탭에서 로그인 시 storage 이벤트 → 즉시 시도
  window.addEventListener('storage', (e) => { if (e.key && e.key.includes('auth-token')) tryInit(); });
})();
