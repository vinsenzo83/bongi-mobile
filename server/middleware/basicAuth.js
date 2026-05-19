// 어드민 인증 미들웨어 (ID + 비밀번호)
// 자격 우선순위: ADMIN_USERNAME/ADMIN_PASSWORD 환경변수 > 코드 기본값
// 헤더: X-Admin-Username, X-Admin-Password | 쿠키: admin_user, admin_pw
const DEFAULT_USER = 'admin';
const DEFAULT_PASS = 'rhkdtp00!!';

function getCookie(req, name) {
  return (req.headers.cookie || '')
    .split(';')
    .map(s => s.trim())
    .find(s => s.startsWith(`${name}=`))
    ?.split('=')[1];
}

export function basicAuth(req, res, next) {
  const expectedUser = process.env.ADMIN_USERNAME || DEFAULT_USER;
  const expectedPass = process.env.ADMIN_PASSWORD || DEFAULT_PASS;

  const user = req.headers['x-admin-username'] || getCookie(req, 'admin_user') || '';
  const pass = req.headers['x-admin-password'] || getCookie(req, 'admin_pw') || '';

  if (user === expectedUser && pass === expectedPass) {
    return next();
  }
  return res.status(401).json({ ok: false, error: 'unauthorized' });
}
