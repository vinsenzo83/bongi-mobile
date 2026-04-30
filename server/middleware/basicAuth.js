// Basic Auth 미들웨어 (어드민 보호)
export function basicAuth(req, res, next) {
  const expectedUser = process.env.ADMIN_USER || 'admin';
  const expectedPass = process.env.ADMIN_PASSWORD || '1111';

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Special Promo Admin"');
    return res.status(401).send('Authentication required');
  }
  try {
    const decoded = Buffer.from(auth.split(' ')[1], 'base64').toString('utf-8');
    const idx = decoded.indexOf(':');
    const user = decoded.slice(0, idx);
    const pass = decoded.slice(idx + 1);
    if (user === expectedUser && pass === expectedPass) {
      return next();
    }
  } catch (e) {}
  res.set('WWW-Authenticate', 'Basic realm="Special Promo Admin"');
  return res.status(401).send('Unauthorized');
}
