// 입력값 sanitize 미들웨어
function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// HTML 콘텐츠로 의도된 필드는 escape 제외 (admin이 직접 등록한 견적·메모 등)
const RAW_HTML_FIELDS = new Set(['quote_full_html']);

// 필드별 최대 길이 (보안: 디스크 / DoS / DB 부하 방지)
const FIELD_MAX_LEN = {
  notes: 5000,
  contract_notes: 5000,
  quote_summary: 2000,
  quote_full_html: 100000, // ~100KB
  customer_name: 100,
  customer_phone: 20,
  customer_address: 500,
  customer_address_detail: 200,
  resident_id: 20,
  bank_account_holder: 50,
  bank_name: 50,
  bank_account_number: 50,
  gift_received: 500,
  cancellation_reason: 500,
};

function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const cleaned = Array.isArray(obj) ? [] : {};
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'string') {
      // 길이 제한 (DoS / DB 부하 방지)
      const maxLen = FIELD_MAX_LEN[key];
      const trimmed = (maxLen && val.length > maxLen) ? val.slice(0, maxLen) : val;
      cleaned[key] = RAW_HTML_FIELDS.has(key) ? trimmed : escapeHtml(trimmed);
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
