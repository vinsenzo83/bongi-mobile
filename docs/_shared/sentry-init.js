// 봉이 어드민 클라이언트 Sentry — 어드민 SPA 런타임 에러 감지
// 사용: 어드민 HTML <head>에 <script src="/docs/_shared/sentry-init.js" defer></script> 추가
// DSN은 window.__SENTRY_DSN__ (서버에서 inject) 또는 빈 값 (비활성)

(function() {
  if (typeof window === 'undefined') return;
  const DSN = window.__SENTRY_DSN__ || '';
  if (!DSN) return;  // DSN 없으면 미초기화 (개발·로컬 안전)

  // Sentry browser CDN 동적 로드
  const script = document.createElement('script');
  script.src = 'https://browser.sentry-cdn.com/7.119.0/bundle.tracing.min.js';
  script.crossOrigin = 'anonymous';
  script.integrity = 'sha384-+wRMaqd3tKBVQ8sRDtwM1AHYbWiyu0t1Bd3IcXG3hKBgr+e7VPpKfRnxlhmS6OEZ';
  script.onload = function() {
    if (!window.Sentry) return;
    window.Sentry.init({
      dsn: DSN,
      environment: window.location.hostname.includes('dev-') ? 'staging' : 'production',
      release: window.__GIT_SHA__ || 'unknown',
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
      beforeSend(event) {
        // 클라이언트 PII redact (휴대폰·주민·카드·이메일)
        const redact = s => typeof s === 'string'
          ? s
            .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[card-redacted]')
            .replace(/\b\d{6}[\s-]?\d{7}\b/g, '[rrn-redacted]')
            .replace(/\b01[016789][\s-]?\d{3,4}[\s-]?\d{4}\b/g, '[phone-redacted]')
            .replace(/[\w.-]+@[\w.-]+\.\w+/g, '[email-redacted]')
          : s;
        if (event.message) event.message = redact(event.message);
        if (event.exception?.values) event.exception.values.forEach(ex => { if (ex.value) ex.value = redact(ex.value); });
        if (event.breadcrumbs) event.breadcrumbs.forEach(b => { if (b.message) b.message = redact(b.message); });
        // localStorage 토큰·쿠키 제거
        if (event.request?.cookies) delete event.request.cookies;
        if (event.request?.headers?.Authorization) event.request.headers.Authorization = '[redacted]';
        return event;
      },
    });
    console.log('🔴 [Sentry] 클라이언트 활성 (env:', window.location.hostname.includes('dev-') ? 'staging' : 'production', ')');
  };
  script.onerror = function() {
    console.warn('[Sentry] CDN 로드 실패 — 클라이언트 에러 트래킹 비활성');
  };
  document.head.appendChild(script);

  // 전역 unhandled error/promise 캐치 (Sentry init 전에도)
  window.addEventListener('error', function(e) {
    if (window.Sentry) window.Sentry.captureException(e.error || new Error(e.message));
  });
  window.addEventListener('unhandledrejection', function(e) {
    if (window.Sentry) window.Sentry.captureException(e.reason || new Error('unhandledrejection'));
  });
})();
