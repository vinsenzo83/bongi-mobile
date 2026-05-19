// Slack/Discord webhook alert (운영 사고 시 즉시 알림)
// 환경변수 ALERT_WEBHOOK_URL 설정 시 활성 (Slack incoming webhook 또는 Discord webhook)
// 5xx 에러만 alert, 4xx는 client 문제라 skip
// 동일 path 중복 alert 방지 — 1분 throttle
const _alertCache = new Map();
async function postAlert(payload) {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  const key = payload.text.slice(0, 200);
  const now = Date.now();
  const last = _alertCache.get(key) || 0;
  if (now - last < 60_000) return;  // 1분 throttle
  _alertCache.set(key, now);
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error('[alert] webhook 실패:', e.message);
  }
}

// 전역 에러 핸들러
export function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  console.error(`❌ [${req.method} ${req.path}]`, err.message);
  // 5xx만 alert (4xx는 client 문제)
  if (status >= 500) {
    const env = process.env.NODE_ENV || 'dev';
    const release = (process.env.RAILWAY_GIT_COMMIT_SHA || 'unknown').slice(0, 7);
    postAlert({
      text: `🚨 [봉이 ${env}] 500 — ${req.method} ${req.path}\n\`\`\`${err.message?.slice(0, 500)}\`\`\`\nrelease: ${release}`,
    });
  }
  res.status(status).json({
    error: process.env.NODE_ENV === 'production' ? '서버 오류가 발생했습니다' : err.message,
  });
}

// async 라우트 래퍼
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
