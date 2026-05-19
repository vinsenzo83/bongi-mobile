// PII 마스킹 헬퍼 — 어드민 UI 목록 뷰용
// 편집 모달은 평문 유지, 목록·상세 뷰에서만 사용

/**
 * 휴대폰 마스킹: 010-1234-5678 → 010-****-5678 (010-****-****는 너무 강함)
 * 빈/짧은 값은 그대로 반환
 */
export function maskPhone(phone) {
  if (!phone || typeof phone !== 'string') return phone;
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length < 10) return phone;
  if (digits.length === 11) return digits.slice(0, 3) + '-****-' + digits.slice(-4);
  if (digits.length === 10) return digits.slice(0, 3) + '-***-' + digits.slice(-4);
  return phone;
}

/**
 * 주민번호 마스킹: 830111-1234567 → 830111-1******
 * 앞 7자리만 노출 (생년월일 + 성별), 뒤 6자리 마스킹
 */
export function maskRRN(rrn) {
  if (!rrn || typeof rrn !== 'string') return rrn;
  const digits = rrn.replace(/[^0-9]/g, '');
  if (digits.length !== 13) return rrn;
  return digits.slice(0, 6) + '-' + digits[6] + '******';
}

/**
 * 카드번호 마스킹: 1234-5678-9012-3456 → ****-****-****-3456
 * 끝 4자리만 노출
 */
export function maskCard(card) {
  if (!card || typeof card !== 'string') return card;
  const digits = card.replace(/[^0-9]/g, '');
  if (digits.length < 8) return card;
  return '****-****-****-' + digits.slice(-4);
}

/**
 * 계좌번호 마스킹: 110-123-456789 → 110-***-***6789
 * 은행 prefix(3-4자리) + 끝 4자리만 노출
 */
export function maskAccount(acc) {
  if (!acc || typeof acc !== 'string') return acc;
  const cleaned = acc.replace(/[^0-9-]/g, '');
  if (cleaned.length < 8) return acc;
  const digits = cleaned.replace(/-/g, '');
  return digits.slice(0, 3) + '-***-***' + digits.slice(-4);
}

/**
 * 이메일 마스킹: hong@gmail.com → h***@gmail.com
 */
export function maskEmail(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  if (local.length <= 1) return email;
  return local[0] + '***@' + domain;
}

/**
 * 이름 마스킹: 홍길동 → 홍*동 / 김민서 → 김*서 / 짧으면 그대로
 */
export function maskName(name) {
  if (!name || typeof name !== 'string' || name.length < 2) return name;
  if (name.length === 2) return name[0] + '*';
  return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
}

// 전역 window 노출 (브라우저 ES module 환경)
if (typeof window !== 'undefined') {
  window.PIIMask = { maskPhone, maskRRN, maskCard, maskAccount, maskEmail, maskName };
}
