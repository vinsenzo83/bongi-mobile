// V5 어드민 — 요금 계산기 데이터 store 헬퍼
// vanilla docs/calculator.html 의 localStorage 키와 동일하게 사용 (호환성 보존).
//
// vanilla 가 fallback이므로 같은 키를 쓰면 양쪽에서 자유롭게 편집 가능.

import { D, generateTickets } from '../../../../lib/quoteEngine.js';

// ─────────────────────────────────────────────────────────────────────
// localStorage 키 (vanilla 와 동일)
// ─────────────────────────────────────────────────────────────────────
export const KEYS = {
  GIFT_OVERRIDE: 'bongi-gift-overrides',
  GIFT_HISTORY: 'bongi-gift-history',
  GIFT_CATALOG: 'bongi-gift-catalog-custom',
  GIFT_CATALOG_DELETED: 'bongi-gift-catalog-deleted',
  DEVICE_OVERRIDES: 'bongi-device-overrides',  // wifiOptions / setTopOptions
  TV_OVERRIDES: 'bongi-tv-overrides',
  BUNDLE_OVERRIDES: 'bongi-bundle-overrides',
  INSTALL_FEES: 'bongi-install-fees',
  PARTNER_CARDS: 'bongi-partner-cards',
  EDIT_HISTORY: 'bongi-edit-history',
};

// ─────────────────────────────────────────────────────────────────────
// 공통 read / write
// ─────────────────────────────────────────────────────────────────────
function read(key, fallback) {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function write(key, val) {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* swallow */ }
}
function remove(key) {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.removeItem(key); } catch { /* swallow */ }
}

// ─────────────────────────────────────────────────────────────────────
// 변경 이력
// ─────────────────────────────────────────────────────────────────────
export function logEdit(section, label, from, to) {
  if (from === to) return;
  const list = read(KEYS.EDIT_HISTORY, []);
  list.unshift({
    at: new Date().toISOString(),
    section,
    label,
    from,
    to,
  });
  if (list.length > 500) list.length = 500;
  write(KEYS.EDIT_HISTORY, list);
}

export function loadEditHistory() {
  return read(KEYS.EDIT_HISTORY, []);
}
export function clearEditHistory() {
  write(KEYS.EDIT_HISTORY, []);
}

// ─────────────────────────────────────────────────────────────────────
// 디폴트 백업 (페이지 첫 로드 시 D 깊은 복사 → reset 가능)
// ─────────────────────────────────────────────────────────────────────
let _DEFAULT_SNAPSHOT = null;
function snapshot() {
  if (_DEFAULT_SNAPSHOT) return _DEFAULT_SNAPSHOT;
  _DEFAULT_SNAPSHOT = JSON.parse(JSON.stringify({
    skt: { tv: D.skt.tv, bundle: D.skt.bundle, setTopOptions: D.skt.setTopOptions, wifiOptions: D.skt.wifiOptions, gift: D.skt.gift },
    kt:  { tv: D.kt.tv,  bundle: D.kt.bundle,  setTopOptions: D.kt.setTopOptions,  wifiOptions: D.kt.wifiOptions,  gift: D.kt.gift  },
    lgu: { tv: D.lgu.tv, bundle: D.lgu.bundle, setTopOptions: D.lgu.setTopOptions, wifiOptions: D.lgu.wifiOptions, gift: D.lgu.gift },
  }));
  return _DEFAULT_SNAPSHOT;
}

// ─────────────────────────────────────────────────────────────────────
// 디바이스 (WiFi / Settop) overrides
// ─────────────────────────────────────────────────────────────────────
export function applyDeviceOverrides() {
  snapshot();
  const ov = read(KEYS.DEVICE_OVERRIDES, {});
  ['skt', 'kt', 'lgu'].forEach((k) => {
    if (ov[k]) {
      if (ov[k].setTopOptions) D[k].setTopOptions = ov[k].setTopOptions;
      if (ov[k].wifiOptions)   D[k].wifiOptions   = ov[k].wifiOptions;
    }
  });
  resolveDefaults();
}
export function persistDevices() {
  resolveDefaults();
  const ov = read(KEYS.DEVICE_OVERRIDES, {});
  ['skt', 'kt', 'lgu'].forEach((k) => {
    if (!ov[k]) ov[k] = {};
    ov[k].setTopOptions = D[k].setTopOptions;
    ov[k].wifiOptions   = D[k].wifiOptions;
  });
  write(KEYS.DEVICE_OVERRIDES, ov);
}
export function resetDevices() {
  remove(KEYS.DEVICE_OVERRIDES);
  const snap = snapshot();
  ['skt', 'kt', 'lgu'].forEach((k) => {
    D[k].setTopOptions = JSON.parse(JSON.stringify(snap[k].setTopOptions));
    D[k].wifiOptions   = JSON.parse(JSON.stringify(snap[k].wifiOptions));
  });
  resolveDefaults();
}

function resolveDefaults() {
  ['skt', 'kt', 'lgu'].forEach((k) => {
    const d = D[k];
    if (d.setTopOptions) {
      const defSt = d.setTopOptions.find((o) => o.isDefault && o.active)
                 || d.setTopOptions.find((o) => o.active);
      if (defSt) { d.setTop = defSt.fee; d.setTopName = defSt.name; }
    }
    if (d.wifiOptions) {
      const defWf = d.wifiOptions.find((o) => o.isDefault && o.active)
                 || d.wifiOptions.find((o) => o.active);
      if (defWf) {
        d.wifiName = defWf.name;
        if (defWf.fees) {
          d.wifiPrice = defWf.fees;
          d.wifiCost = defWf.fees['100M'];
        }
      }
    }
  });
}

// ─────────────────────────────────────────────────────────────────────
// TV overrides
// ─────────────────────────────────────────────────────────────────────
export function applyTvOverrides() {
  snapshot();
  const ov = read(KEYS.TV_OVERRIDES, {});
  ['skt', 'kt', 'lgu'].forEach((k) => {
    if (ov[k] && Array.isArray(ov[k])) D[k].tv = ov[k];
  });
}
export function persistTv(carrierKey) {
  const ov = read(KEYS.TV_OVERRIDES, {});
  ov[carrierKey] = D[carrierKey].tv;
  write(KEYS.TV_OVERRIDES, ov);
}
export function resetTv() {
  remove(KEYS.TV_OVERRIDES);
  const snap = snapshot();
  ['skt', 'kt', 'lgu'].forEach((k) => {
    D[k].tv = JSON.parse(JSON.stringify(snap[k].tv));
  });
}

// ─────────────────────────────────────────────────────────────────────
// Bundle overrides
// ─────────────────────────────────────────────────────────────────────
export function applyBundleOverrides() {
  snapshot();
  const ov = read(KEYS.BUNDLE_OVERRIDES, {});
  ['skt', 'kt', 'lgu'].forEach((k) => {
    if (ov[k] && ov[k].bundle) {
      Object.keys(ov[k].bundle).forEach((bk) => {
        D[k].bundle[bk] = ov[k].bundle[bk];
      });
    }
  });
}
export function persistBundle(carrierKey) {
  const ov = read(KEYS.BUNDLE_OVERRIDES, {});
  if (!ov[carrierKey]) ov[carrierKey] = {};
  ov[carrierKey].bundle = D[carrierKey].bundle;
  write(KEYS.BUNDLE_OVERRIDES, ov);
}
export function resetBundle() {
  remove(KEYS.BUNDLE_OVERRIDES);
  const snap = snapshot();
  ['skt', 'kt', 'lgu'].forEach((k) => {
    D[k].bundle = JSON.parse(JSON.stringify(snap[k].bundle));
  });
}

// ─────────────────────────────────────────────────────────────────────
// Gift overrides (D.gift 직접 + GIFT_OVERRIDE_KEY 동기화)
// ─────────────────────────────────────────────────────────────────────
export function applyGiftOverrides() {
  snapshot();
  const ov = read(KEYS.GIFT_OVERRIDE, {});
  Object.keys(ov).forEach((carrier) => {
    if (!D[carrier] || !D[carrier].gift) return;
    Object.keys(ov[carrier] || {}).forEach((bucket) => {
      if (!D[carrier].gift[bucket]) D[carrier].gift[bucket] = {};
      Object.keys(ov[carrier][bucket] || {}).forEach((sp) => {
        D[carrier].gift[bucket][sp] = ov[carrier][bucket][sp];
      });
    });
  });
}
export function saveGiftOverride(carrier, bucket, speed, value) {
  const ov = read(KEYS.GIFT_OVERRIDE, {});
  if (!ov[carrier]) ov[carrier] = {};
  if (!ov[carrier][bucket]) ov[carrier][bucket] = {};
  ov[carrier][bucket][speed] = value;
  write(KEYS.GIFT_OVERRIDE, ov);
}
export function resetGifts() {
  remove(KEYS.GIFT_OVERRIDE);
  const snap = snapshot();
  ['skt', 'kt', 'lgu'].forEach((k) => {
    D[k].gift = JSON.parse(JSON.stringify(snap[k].gift));
  });
}

// ─────────────────────────────────────────────────────────────────────
// 설치비 INSTALL_FEES (별도 구조 — D.install 과 다름)
// ─────────────────────────────────────────────────────────────────────
export const DEFAULT_INSTALL_FEES = {
  skt: {
    columns: ['인터넷 단독', '인터넷 (TV 동시)', 'IPTV', '인터넷+TV 합계', 'TV 추가', '인터넷전화', '일반전화'],
    weekday: [36300, 34100, 22000, 56100, 17600, 13200, 6600],
    weekend: [45375, 42620, 27500, 70120, 22000, 13200, 6600],
  },
  lgu: {
    columns: ['인터넷 단독', '인터넷 (TV 동시)', 'IPTV', '인터넷+TV 합계', 'TV 추가', '인터넷전화', '일반전화'],
    weekday: [36300, 34100, 22000, 56100, 22000, 11000, 11000],
    weekend: [45375, 42620, 27500, 70120, 27500, 11000, 11000],
  },
  kt: {
    columns: ['인터넷 단독', '인터넷 (TV 동시)', 'IPTV', '인터넷+TV 합계', 'TV 추가', '인터넷전화', '일반전화 신규', '일반전화 번호이동'],
    weekday: [36000, 32000, 24200, 56200, 15400, 24000, 32000, 36000],
    weekend: [45000, 41000, 30250, 71250, 19250, 33000, 41000, 45000],
  },
};

export function loadInstallFees() {
  const v = read(KEYS.INSTALL_FEES, null);
  if (v) return v;
  return JSON.parse(JSON.stringify(DEFAULT_INSTALL_FEES));
}
export function saveInstallFees(data) {
  write(KEYS.INSTALL_FEES, data);
}
export function resetInstallFees() {
  remove(KEYS.INSTALL_FEES);
}

// ─────────────────────────────────────────────────────────────────────
// 제휴카드
// ─────────────────────────────────────────────────────────────────────
export const DEFAULT_PARTNER_CARDS = {
  skt: [
    { issuer: '롯데카드', name: 'SK브로드밴드 B롯데카드', spend: '50만원', discount: '-10,000원' },
    { issuer: '삼성카드', name: 'SK브로드밴드 삼성카드', spend: '30만원', discount: '-7,000원' },
  ],
  lgu: [
    { issuer: '삼성카드', name: 'LG U+ 삼성카드', spend: '30만원', discount: '-7,000원' },
    { issuer: '현대카드', name: 'LG U+ 현대카드M Edition3', spend: '50만원', discount: '-15,000원 (1~24개월)' },
    { issuer: '하나카드', name: '더 심플 하나카드', spend: '30만원', discount: '-10,000원' },
    { issuer: '하나카드', name: 'LG U+Family 하나카드', spend: '30만원', discount: '통신료 25% 청구 (25개월↑ 15%)' },
    { issuer: '신한카드', name: 'LG U+ 사장님 통할인', spend: '70만원', discount: '-10,000원 (25개월↑ -6,000)' },
    { issuer: '롯데카드', name: 'LG U+ x LOCA', spend: '30만원', discount: '-10,000원 (25개월↑ -6,000)' },
    { issuer: 'NH카드', name: 'NH올원 LG U+ 카드', spend: '30만원', discount: '-9,000원' },
  ],
  kt: [
    { issuer: 'KB국민', name: 'KT DC Plus 국민카드', spend: '30만원', discount: '-7,000원' },
    { issuer: '현대', name: 'KT-현대카드M Edition3 (청구할인형)', spend: '30만원', discount: '-13,000원 (1~24개월)' },
    { issuer: '현대', name: 'KT-현대카드M Edition3 (청구할인형2.0)', spend: '100만원', discount: '-22,000원 (1~36개월)' },
    { issuer: '신한', name: 'KT 신한 체크카드', spend: '30만원', discount: '3,000원 캐시백' },
    { issuer: '신한', name: 'KT 가족만족 DC 신한카드', spend: '30만원', discount: '-7,000원' },
    { issuer: '신한', name: 'KT 으랏차차 신한카드', spend: '50만원', discount: '-12,000원' },
    { issuer: 'IBK', name: 'olleh super DC IBK카드', spend: '30만원', discount: '-7,000원' },
    { issuer: 'IBK', name: 'KT 으랏차차 IBK카드', spend: '자동납부', discount: '5% 청구할인' },
    { issuer: '삼성', name: 'KT 삼성카드', spend: '30만원', discount: '-7,000원' },
    { issuer: '우리', name: 'KT Plus 우리카드', spend: '40만원', discount: '-10,000원 (1~24개월)' },
    { issuer: '우리', name: 'KT 36 Plus 우리카드', spend: '40만원', discount: '-8,000원 (1~24개월)' },
    { issuer: '하나', name: 'KT DC Plus 더 심플 하나카드', spend: '30만원', discount: '-10,000원' },
    { issuer: 'NH농협', name: 'KT 할부 Plus NH농협카드', spend: '40만원', discount: '-5,000원 (할부 중복 불가)' },
    { issuer: '롯데', name: 'KT DC Plus 롯데카드', spend: '40만원', discount: '-10,000원' },
    { issuer: '비씨', name: 'KT SUPER DC BC 바로카드', spend: '40만원', discount: '-5,000원' },
    { issuer: '비씨', name: 'KT DC Plus BC 바로카드', spend: '30만원', discount: '-7,000원' },
    { issuer: '케이뱅크', name: 'KT멤버십x케이뱅크 더블혜택 체크카드', spend: '20만원', discount: '5% 캐시백 (최대 5,000원)' },
  ],
};

export function loadPartnerCards() {
  const v = read(KEYS.PARTNER_CARDS, null);
  if (v) return v;
  return JSON.parse(JSON.stringify(DEFAULT_PARTNER_CARDS));
}
export function savePartnerCards(data) {
  write(KEYS.PARTNER_CARDS, data);
}
export function resetPartnerCards() {
  remove(KEYS.PARTNER_CARDS);
}

// ─────────────────────────────────────────────────────────────────────
// 티켓 재생성 (값 변경 시 호출)
// ─────────────────────────────────────────────────────────────────────
export function rebuildTickets() {
  return generateTickets();
}

// ─────────────────────────────────────────────────────────────────────
// 페이지 진입 시 1회 호출 — 모든 override 적용
// ─────────────────────────────────────────────────────────────────────
export function applyAllOverrides() {
  snapshot();
  applyDeviceOverrides();
  applyTvOverrides();
  applyBundleOverrides();
  applyGiftOverrides();
}
