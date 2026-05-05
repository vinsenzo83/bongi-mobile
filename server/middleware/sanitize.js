// 입력값 sanitize 미들웨어
function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// HTML 콘텐츠로 의도된 필드는 escape 제외 (admin이 직접 등록한 견적·메모 등)
const RAW_HTML_FIELDS = new Set(['quote_full_html']);

function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const cleaned = Array.isArray(obj) ? [] : {};
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'string') {
      cleaned[key] = RAW_HTML_FIELDS.has(key) ? val : escapeHtml(val);
    } else if (typeof val === 'object' && val !== null) {
      cleaned[key] = sanitizeObject(val);
    } else {
      cleaned[key] = val;
    }
  }
  return cleaned;
}

export function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
}
