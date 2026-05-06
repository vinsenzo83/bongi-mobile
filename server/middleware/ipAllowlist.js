// IP 화이트리스트 미들웨어 — customer-db 라우트 보호 (PIPA)
// active=true인 cidr만 통과. localhost/사설망은 기본 허용 (개발 편의).
import { supabase } from '../db/supabase.js';

let _cache = { ips: [], loaded_at: 0 };
const CACHE_TTL = 60_000;

async function loadAllowlist() {
  if (Date.now() - _cache.loaded_at < CACHE_TTL) return _cache.ips;
  try {
    const { data } = await supabase.from('incentive_ip_whitelist')
      .select('cidr').eq('active', true).in('scope', ['customer_db', 'all']);
    _cache = { ips: (data || []).map(r => r.cidr), loaded_at: Date.now() };
  } catch (e) { console.warn('[ipAllowlist]', e.message); }
  return _cache.ips;
}

function ipMatch(ip, cidr) {
  if (!ip || !cidr) return false;
  // 정확 일치 또는 CIDR /N (간이 — IPv4 prefix 일치)
  if (cidr.indexOf('/') === -1) return ip === cidr;
  const [base, bitsStr] = cidr.split('/');
  const bits = parseInt(bitsStr);
  if (!bits || bits < 1 || bits > 32) return false;
  const toInt = (s) => s.split('.').reduce((a,o) => (a<<8) + (parseInt(o)||0), 0) >>> 0;
  const mask = bits === 32 ? 0xFFFFFFFF : ((0xFFFFFFFF << (32-bits)) >>> 0);
  return (toInt(ip) & mask) === (toInt(base) & mask);
}

function isPrivate(ip) {
  if (!ip) return false;
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('::ffff:127.')) return true;
  if (ip.startsWith('10.') || ip.startsWith('192.168.')) return true;
  if (ip.startsWith('172.')) {
    const x = parseInt(ip.split('.')[1]);
    if (x >= 16 && x <= 31) return true;
  }
  return false;
}

export async function ipAllowlist(req, res, next) {
  let ip = req.ip || '';
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (isPrivate(ip)) return next(); // 개발/사내망 항상 허용
  const allow = await loadAllowlist();
  if (!allow.length) return next(); // 등록 0건이면 화이트리스트 비활성 (admin이 켜기 전)
  if (allow.some(c => ipMatch(ip, c))) return next();
  return res.status(403).json({ error: 'IP 화이트리스트 외 접근 차단', ip });
}

export function invalidateIpAllowlistCache() { _cache.loaded_at = 0; }
