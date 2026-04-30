// 어드민 인증 미들웨어 (X-Admin-Password 헤더 또는 cookie)
export function basicAuth(req, res, next) {
  const expectedPass = process.env.ADMIN_PASSWORD || '1111';
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
