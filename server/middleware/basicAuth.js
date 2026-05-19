// 어드민 인증 미들웨어 (X-Admin-Password 헤더 또는 cookie)
// 운영 환경에서는 ADMIN_PASSWORD 환경변수 필수 — 미설정 시 모든 요청 차단
export function basicAuth(req, res, next) {
  const expectedPass = process.env.ADMIN_PASSWORD;
  if (!expectedPass || expectedPass.length < 8) {
    console.error('[basicAuth] ADMIN_PASSWORD 환경변수 미설정 또는 너무 짧음 (>=8자 필수). 모든 요청 차단.');
    return res.status(503).json({ ok: false, error: 'admin_password_not_configured' });
  }
  const headerPass = req.headers['x-admin-password'];
  const cookiePass = (req.headers.cookie || '')
    .split(';')
    .map(s => s.trim())
    .find(s => s.startsWith('admin_pw='))
    ?.split('=')[1];

  if (headerPass === expectedPass || cookiePass === expectedPass) {
    return next();
  }
  return res.status(401).json({ ok: false, error: 'unauthorized' });
}
