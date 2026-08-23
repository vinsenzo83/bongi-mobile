/**
 * quoteEngine.js — Pure JS quote calculation engine
 *
 * Extracted from /docs/tm-counselor.html (vanilla calc()) on Phase A of the
 * React migration. The vanilla file remains untouched. This module exposes:
 *   - D: carrier data (SKT / KT / LGU+) — pricing, TV catalog, set-top options,
 *        bundle discount tables, gift amounts, install fees.
 *   - calc(opts): Pure function that takes inputs and returns structured data
 *        (NOT HTML — the React UI in Phase B will render its own DOM).
 *   - Helper functions: getGiftAmount, getSettopDiscount, generateTickets,
 *        findTicket, applyGiftOverrides (browser-only no-op on SSR),
 *        applyIncentivePaybackSync (server fetch).
 *
 * Output shape (calc returns):
 *   {
 *     ticket,            // { number, carrier, speed, tvIdx, wifi } | null
 *     carrierKey,        // 'skt' | 'kt' | 'lgu'
 *     carrierName,       // 'SKT (B tv)' etc
 *     speed,             // '100M' | '500M' | '1G'
 *     hasTv, tvIdx, tvName, wifi,
 *     sectorMain: {      // 섹터 1
 *       title, netBase, wifiCost, wifiName, netCombo,
 *       netDiscount, tvBase, tvDc, tvFinal,
 *       setTop, setTopName, settopDiscount,
 *       multiTv: [...], total
 *     },
 *     sectorFamily: {...} | null,   // 섹터 2 (가족결합 / 총액 / 프리미엄 등)
 *     mobileDiscount: number,        // 휴대폰 별도 차감
 *     gift: number,
 *     install: { weekday, weekend, additional },
 *   }
 *
 * NOTE: Pure JS. No React, no DOM, no localStorage at import-time.
 * The optional `applyGiftOverrides()` helper *does* read localStorage but is
 * only invoked when the caller asks for it.
 *
 * NOTE: Phase A scope = data extraction. Some niche UI-only branches
 * (premium-members table-of-five inputs etc.) are translated as
 * data-driven but the React UI in Phase B may need to feed
 * `premiumMembers` array directly. See `// TODO Phase A2` markers.
 */

// ─────────────────────────────────────────────────────────────────────────────
// D — Carrier catalog data (SKT / KT / LGU+)
// Copied 1:1 from vanilla docs/tm-counselor.html lines 710-941.
// ─────────────────────────────────────────────────────────────────────────────
export const D = {
  skt: {
    name: 'SKT (B tv)', prefix: 'SK',
    internet: { '100M': 22000, '500M': 33000, '1G': 38500 },
    wifiCost: 1100,
    setTopOptions: [
      { id: 'smart3', name: 'Smart3', fee: 4400, isDefault: true, active: true, discountRules: [] },
      { id: 'smart3-mini', name: 'Smart3 미니', fee: 4400, active: true, discountRules: [] },
      { id: 'uhd', name: 'UHD', fee: 4400, active: true, discountRules: [] },
      { id: 'ai', name: 'AI', fee: 6600, active: true, discountRules: [] },
      { id: 'ai-speaker', name: 'AI 스피커형', fee: 6600, active: true, discountRules: [] },
      { id: 'ai-sound-max', name: 'AI Sound Max', fee: 8800, active: true, discountRules: [] },
      {
        id: 'ai-4-vision', name: 'AI 4 vision', fee: 8800, active: true,
        discountRules: [
          { id: 'base-all-500m', name: '요즘우리집 결합할인', type: 'base', speeds: ['500M', '1G'], tvNameContains: '올', discount: 2200, active: true },
          { id: 'promo-allplus-launch', name: 'AI 4 vision 출시 프로모션', type: 'promo', speeds: ['500M', '1G'], tvNameContains: '올 플러스', discount: 2200, startDate: '2026-01-01', endDate: null, active: true }
        ]
      },
      { id: 'ai-5', name: 'AI 5 셋톱', fee: 7700, active: true, discountRules: [] },
      { id: 'btv-air-3', name: 'Btv Air 3세대', fee: 8800, active: true, discountRules: [] },
      { id: 'btv-air-4', name: 'Btv Air 4세대', fee: 8800, active: true, discountRules: [] },
      { id: 'apple-tv-3', name: '애플TV 3세대', fee: 6600, active: true, discountRules: [] }
    ],
    settopDiscountRules: [],
    wifiOptions: [
      { id: 'giga-wifi', name: 'GIGA WiFi', fees: { '100M': 1100, '500M': 1100, '1G': 1100 }, isDefault: true, active: true },
      { id: 'giga-wifi-6', name: 'GIGA WiFi 6', fees: { '100M': 1100, '500M': 1100, '1G': 1100 }, active: true },
      { id: 'giga-wifi-prem', name: 'GIGA WiFi 프리미엄', fees: { '100M': 5500, '500M': 5500, '1G': 5500 }, active: true },
      { id: 'wings', name: '윙즈', fees: { '100M': 1650, '500M': 1650, '1G': 1650 }, active: true }
    ],
    tvInternetNoWifi: { '100M': 19800, '500M': 27500, '1G': 33000 },
    tvInternetWithWifi: { '100M': 22000, '500M': 28600, '1G': 34100 },
    tv: [
      { n: 'TV 없음', ch: 0, p: 0, dc: 0, tv2Discount: 0 },
      { n: 'B tv 이코노미', ch: 182, p: 12100, dc: 2200, tv2Discount: 6050 },
      { n: 'B tv 스탠다드', ch: 236, p: 15400, dc: 2200, tv2Discount: 7700 },
      { n: 'B tv 올', ch: 252, p: 18700, dc: 2200, tv2Discount: 9350 },
      { n: 'B tv 스탠다드 플러스', ch: 222, p: 23100, dc: 2200, tv2Discount: 7700 },
      { n: 'B tv 올 플러스', ch: 252, p: 24200, dc: 2200, tv2Discount: 9350 },
      { n: 'B tv 스탠다드 넷플릭스', ch: 222, p: 27700, dc: 2200, tv2Discount: 7700 },
      { n: 'B tv 올 넷플릭스', ch: 222, p: 30200, dc: 2200, tv2Discount: 9350 },
      { n: 'B tv 스탠다드 넷플릭스 프리미엄', ch: 252, p: 30700, dc: 2200, tv2Discount: 7700 },
      { n: 'B tv 올 넷플릭스 프리미엄', ch: 252, p: 33200, dc: 2200, tv2Discount: 9350 }
    ],
    additionalTvPolicy: {
      maxTvCount: 3,
      settopDiscountRate: 0.5,
      installDiscountRate: 0.5,
      additionalTvInstallFee: 17600,
      tv1KeepsRegularDiscount: true,
      enabled: true
    },
    install: { solo: 36300, combo: 56100 },
    installWeekend: { solo: 45375, combo: 70125 },
    gift: {
      solo: { '100M': 110000, '500M': 170000, '1G': 170000 },
      combo: { '100M': 400000, '500M': 430000, '1G': 490000 }
    },
    bundle: {
      family: {
        internet: { '100M': 4400, '500M': 11000, '1G': 13200 },
        iptv: 1100,
        mobilePerBySpeed: {
          '100M': { 1: 3500, 2: 3500, 3: 6000, 4: 4500, 5: 3600 },
          '500M': { 1: 3500, 2: 3500, 3: 6000, 4: 6000, 5: 4800 },
          '1G': { 1: 3500, 2: 3500, 3: 6000, 4: 6000, 5: 4800 }
        }
      },
      onfamily: {
        netYrLabels: ['인터넷 1년 미만', '인터넷 1년 이상', '인터넷 2년 이상', '인터넷 3년 이상'],
        famYrLabels: ['가족 10년 미만', '가족 10년 이상', '가족 20년 이상', '가족 30년 이상'],
        matrix: [
          [0, 0, 5, 10],
          [0, 5, 10, 20],
          [5, 10, 20, 30],
          [10, 20, 30, 50]
        ]
      }
    }
  },
  kt: {
    name: 'KT (지니TV)', prefix: 'KT',
    internet: { '100M': 22000, '500M': 33000, '1G': 38500 },
    wifiPrice: { '100M': 1100, '500M': 1100, '1G': 0 },
    setTopOptions: [
      { id: 'genie-2', name: '기가지니2', fee: 4400, isDefault: true, active: true, discountRules: [] },
      { id: 'genie-3', name: '기가지니3', fee: 4400, active: true, discountRules: [] },
      { id: 'genie-a', name: '기가지니A', fee: 3300, active: true, discountRules: [] },
      { id: 'genie-4', name: '기가지니4', fee: 6600, active: true, discountRules: [] },
      { id: 'soundbar', name: '지니TV 사운드바', fee: 8800, active: true, discountRules: [] },
      { id: 'tab4', name: '지니TV 탭4', fee: 8779, active: true, discountRules: [] }
    ],
    settopDiscountRules: [],
    wifiOptions: [
      { id: 'wave2', name: 'KT GIGA WAVE2', fees: { '100M': 1100, '500M': 1100, '1G': 0 }, isDefault: true, active: true },
      { id: 'home-ax', name: 'GIGA WIFI 홈AX', fees: { '100M': 0, '500M': 1100, '1G': 0 }, active: true },
      { id: 'buddy', name: 'GIGA WIFI BUDDY', fees: { '100M': 1650, '500M': 1650, '1G': 1650 }, active: true },
      { id: 'prem-24', name: 'GIGA WIFI 프리미엄 2.4', fees: { '100M': 4400, '500M': 4400, '1G': 4400 }, active: true },
      { id: 'prem-24-6e', name: 'GIGA WIFI 프리미엄 2.4 (6E)', fees: { '100M': 4400, '500M': 4400, '1G': 4400 }, active: true },
      { id: 'prem-48', name: 'GIGA WIFI 프리미엄 4.8', fees: { '100M': 4400, '500M': 4400, '1G': 4400 }, active: true }
    ],
    tvInternetNoWifi: { '100M': 22000, '500M': 27500, '1G': 33000 },
    tvInternetWithWifi: { '100M': 23100, '500M': 28600, '1G': 33000 },
    tv: [
      { n: 'TV 없음', ch: 0, p: 0, dc: 0, tv2Discount: 0 },
      { n: '지니TV 베이직', ch: 238, p: 14740, dc: 2640, tv2Discount: 7370 },
      { n: '지니TV 라이트', ch: 240, p: 15840, dc: 2640, tv2Discount: 7920 },
      { n: '지니TV 에센스', ch: 263, p: 20240, dc: 3740, tv2Discount: 11440 },
      { n: '지니TV 모든G', ch: 250, p: 21340, dc: 4400, tv2Discount: 0 },
      { n: '지니TV 디즈니+모든G', ch: 250, p: 28100, dc: 6600, tv2Discount: 0 }
    ],
    additionalTvPolicy: {
      maxTvCount: 3,
      settopDiscountRate: 0,
      installDiscountRate: 0.5,
      additionalTvInstallFee: 15400,
      tv1KeepsRegularDiscount: true,
      tv2PriceConstraint: 'leq',
      tv3PriceConstraint: 'leq',
      enabled: true
    },
    install: { solo: 36000, combo: 56200 },
    installWeekend: { solo: 45000, combo: 71250 },
    gift: {
      solo: { '100M': 90000, '500M': 140000, '1G': 140000 },
      combo: { '100M': 370000, '500M': 450000, '1G': 450000 }
    },
    bundle: {
      ranges_total: ['22,000원 이하', '22,000원 이상', '64,900원 이상', '108,900원 이상', '141,900원 이상', '174,900원 이상'],
      total: {
        internet: {
          '100M': [1650, 3300, 5500, 5500, 5500, 5500],
          '500M': [2200, 5500, 5500, 5500, 5500, 5500],
          '1G': [2200, 5500, 5500, 5500, 5500, 5500]
        },
        mobile: {
          '100M': [0, 0, 3300, 14300, 18700, 23100],
          '500M': [0, 0, 5500, 16610, 22110, 27610],
          '1G': [0, 0, 5500, 16610, 22110, 27610]
        }
      },
      ranges_fixed: ['37,000원 이하', '37,000원 이상', '61,000원 이상', '77,000원 이상'],
      fixed: {
        internet: [5500, 5500, 5500, 5500],
        mobile: [0, 3000, 5000, 7000]
      },
      premium: {
        internet: 5500,
        planCatalog: [
          { v: 0, label: '— 회선 없음 —', dc: 0, prem: false },
          { v: 32890, label: '32,890원 (LTE 데이터선택)', dc: 0, prem: false },
          { v: 47000, label: '47,000원', dc: 0, prem: false },
          { v: 55000, label: '55,000원', dc: 0, prem: false },
          { v: 65000, label: '65,000원', dc: 0, prem: false },
          { v: 77000, label: '77,000원 (임계값)', dc: 19250, prem: true },
          { v: 80000, label: '80,000원 (5G 슈퍼플랜 베이직)', dc: 20000, prem: true },
          { v: 87890, label: '87,890원 (데이터선택 87.8)', dc: 22000, prem: true },
          { v: 89000, label: '89,000원 (데이터ON 프리미엄)', dc: 22250, prem: true },
          { v: 90000, label: '90,000원 (슈퍼플랜 베이직 Plus/초이스)', dc: 22500, prem: true },
          { v: 100000, label: '100,000원 (슈퍼플랜 스페셜)', dc: 25000, prem: true },
          { v: 109000, label: '109,000원 (데이터선택 109)', dc: 27500, prem: true },
          { v: 110000, label: '110,000원 (슈퍼플랜 스페셜 Plus/초이스)', dc: 27500, prem: true },
          { v: 130000, label: '130,000원 (슈퍼플랜 프리미엄/초이스)', dc: 32500, prem: true }
        ]
      }
    }
  },
  lgu: {
    name: 'LGU+ (U+tv)', prefix: 'LG',
    internet: { '100M': 22000, '500M': 33000, '1G': 38500 },
    wifiCost: 0,
    setTopOptions: [
      { id: 'uhd4', name: '4K UHD4', fee: 4400, isDefault: true, active: true, discountRules: [] },
      { id: 'uhd3', name: '4K UHD3', fee: 4400, active: true, discountRules: [] },
      { id: 'high', name: '고급', fee: 3300, active: true, discountRules: [] },
      { id: 'chromecast', name: '크롬캐스트', fee: 2750, active: true, discountRules: [] },
      { id: 'soundbar2', name: 'U+tv 사운드바2', fee: 8800, active: true, discountRules: [] },
      { id: 'soundbar', name: 'U+tv 사운드바', fee: 6600, active: true, discountRules: [] },
      { id: 'free5-se', name: 'U+tv 프리5 SE', fee: 22214, active: true, discountRules: [] },
      { id: 'free4-se', name: 'U+tv 프리4 SE', fee: 21083, active: true, discountRules: [] },
      { id: 'free4-le', name: 'U+tv 프리4 LE', fee: 15705, active: true, discountRules: [] },
      { id: 'free3-le', name: 'U+tv 프리3 LE', fee: 12527, active: true, discountRules: [] }
    ],
    settopDiscountRules: [],
    wifiOptions: [
      { id: 'giga-wifi', name: '기가와이파이', fees: { '100M': 0, '500M': 0, '1G': 0 }, isDefault: true, active: true },
      { id: 'giga-wifi-6', name: '기가와이파이6', fees: { '100M': 0, '500M': 0, '1G': 0 }, active: true },
      { id: 'giga-wifi-mesh', name: '기가와이파이 메쉬', fees: { '100M': 0, '500M': 0, '1G': 0 }, active: true }
    ],
    bundle: {
      chweyswun: {
        internet: { '100M': 5500, '500M': 9900, '1G': 13200 },
        planLabels: ['69,000원 미만', '69,000원 이상', '88,000원 이상'],
        mobile: [
          [2200, 3300, 4400],
          [3300, 5500, 6600],
          [4400, 6600, 8800]
        ]
      },
      together: {
        internet: { '100M': 0, '500M': 11000, '1G': 11000 },
        mobile: [10000, 14000, 20000]
      }
    },
    tvInternetNoWifi: { '100M': 22000, '500M': 27500, '1G': 33000 },
    tvInternetWithWifi: { '100M': 22000, '500M': 27500, '1G': 33000 },
    tv: [
      { n: 'TV 없음', ch: 0, p: 0, dc: 0, tv2Discount: 0 },
      { n: 'U+tv 실속형', ch: 217, p: 15400, dc: 2200, tv2Discount: 7700 },
      { n: 'U+tv 기본형', ch: 223, p: 16500, dc: 2200, tv2Discount: 8250 },
      { n: 'U+tv 프리미엄', ch: 252, p: 18700, dc: 2200, tv2Discount: 9350 },
      { n: 'U+tv 프리미엄 VOD', ch: 257, p: 24200, dc: 5500, tv2Discount: 0, mainOnly: true }
    ],
    additionalTvPolicy: {
      maxTvCount: 3,
      settopDiscountRate: 0,
      installDiscountRate: 0.5,
      additionalTvInstallFee: 22000,
      tv1KeepsRegularDiscount: true,
      tv2PriceConstraint: 'leq',
      tv3PriceConstraint: 'leq',
      enabled: true
    },
    install: { solo: 36300, combo: 56100 },
    installWeekend: { solo: 45375, combo: 70125 },
    gift: {
      solo: { '100M': 200000, '500M': 230000, '1G': 230000 },
      combo: { '100M': 400000, '500M': 470000, '1G': 470000 }
    }
  }
};

// Resolve default set-top + wifi (mirrors vanilla resolveDefaults IIFE).
(function resolveDefaults() {
  for (const k in D) {
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
  }
})();

// ─────────────────────────────────────────────────────────────────────────────
// Optional: gift overrides from localStorage (admin sync)
// Identical to vanilla applyGiftOverrides — only invoke from browser code.
// ─────────────────────────────────────────────────────────────────────────────
export const GIFT_OVERRIDE_KEY = 'bongi-gift-overrides';

export function applyGiftOverrides() {
  if (typeof localStorage === 'undefined') return;
  try {
    const ov = JSON.parse(localStorage.getItem(GIFT_OVERRIDE_KEY) || '{}');
    Object.keys(ov).forEach((carrier) => {
      if (!D[carrier] || !D[carrier].gift) return;
      Object.keys(ov[carrier] || {}).forEach((bucket) => {
        if (!D[carrier].gift[bucket]) D[carrier].gift[bucket] = {};
        Object.keys(ov[carrier][bucket] || {}).forEach((sp) => {
          D[carrier].gift[bucket][sp] = ov[carrier][bucket][sp];
        });
      });
    });
  } catch { /* swallow */ }
}

/**
 * Sync incentive_products payback values from the server into D.gift.
 * Equivalent to vanilla applyIncentivePaybackSync (but no calc() side-effect).
 * Caller is responsible for triggering a re-calc/render after this resolves.
 */
export async function applyIncentivePaybackSync(fetchImpl) {
  if (typeof fetch === 'undefined' && !fetchImpl) return;
  const _fetch = fetchImpl || fetch;
  try {
    const res = await _fetch('/api/incentive/products');
    if (!res.ok) return;
    const { products } = await res.json();
    if (!products || !Array.isArray(products)) return;
    const carrierMap = { SKT: 'skt', KT: 'kt', 'LGU+': 'lgu' };
    products.forEach((p) => {
      const cKey = carrierMap[p.carrier];
      if (!cKey || !D[cKey]) return;
      if (!D[cKey].gift) D[cKey].gift = { solo: {}, combo: {} };
      const bucket = p.type === '단독' ? 'solo' : 'combo';
      if (p.speed && p.payback != null) {
        if (!D[cKey].gift[bucket]) D[cKey].gift[bucket] = {};
        D[cKey].gift[bucket][p.speed] = p.payback;
      }
    });
  } catch { /* swallow */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
export function getGiftAmount(d, sp, tvIdx) {
  if (!d || !d.gift) return 0;
  const bucket = tvIdx > 0 ? d.gift.combo : d.gift.solo;
  return bucket ? (bucket[sp] || 0) : 0;
}

/**
 * Compute set-top discount via the discountRules attached to the set-top option.
 * Returns: { discount: number, matched: rule[] }
 */
export function getSettopDiscount(carrierKey, sp, tvIdx, settopId, now = new Date()) {
  if (tvIdx === 0 || !settopId) return { discount: 0, matched: [] };
  const d = D[carrierKey];
  if (!d || !d.setTopOptions) return { discount: 0, matched: [] };
  const tv = d.tv[tvIdx];
  if (!tv) return { discount: 0, matched: [] };
  const settop = d.setTopOptions.find((o) => o.id === settopId);
  if (!settop || !settop.discountRules) return { discount: 0, matched: [] };
  const matched = [];
  let total = 0;
  for (let i = 0; i < settop.discountRules.length; i++) {
    const rule = settop.discountRules[i];
    if (!rule.active) continue;
    if (rule.startDate) { const sd = new Date(rule.startDate); if (now < sd) continue; }
    if (rule.endDate) { const ed = new Date(rule.endDate); if (now > ed) continue; }
    if (rule.speed && rule.speed !== sp) continue;
    if (rule.speeds && Array.isArray(rule.speeds) && rule.speeds.indexOf(sp) === -1) continue;
    if (rule.tvNameContains && tv.n.indexOf(rule.tvNameContains) === -1) continue;
    matched.push(rule);
    total += (rule.discount || 0);
  }
  return { discount: total, matched };
}

function pad4(n) { return ('0000' + n).slice(-4); }

function wifiIsOptional(d, sp, hasTv) {
  if (hasTv) return d.tvInternetNoWifi[sp] !== d.tvInternetWithWifi[sp];
  const wifiForSp = d.wifiPrice ? d.wifiPrice[sp] : (typeof d.wifiCost === 'number' ? d.wifiCost : 1100);
  return wifiForSp > 0;
}

/**
 * Build the global ticket catalog. Same combinatorial enumeration as vanilla.
 */
export function generateTickets() {
  const tickets = [];
  const speeds = ['100M', '500M', '1G'];
  ['skt', 'kt', 'lgu'].forEach((key) => {
    const d = D[key];
    let num = 1;
    const pushTicket = (sp, tvIdx, wifi) => {
      tickets.push({ number: d.prefix + pad4(num++), carrier: key, speed: sp, tvIdx, wifi });
    };
    speeds.forEach((sp) => {
      if (wifiIsOptional(d, sp, false)) { pushTicket(sp, 0, false); pushTicket(sp, 0, true); }
      else { pushTicket(sp, 0, true); }
    });
    for (let i = 1; i < d.tv.length; i++) {
      speeds.forEach((sp) => {
        if (wifiIsOptional(d, sp, true)) { pushTicket(sp, i, false); pushTicket(sp, i, true); }
        else { pushTicket(sp, i, true); }
      });
    }
  });
  return tickets;
}

export const TICKETS = generateTickets();

export function findTicket(carrier, speed, tvIdx, wifi) {
  for (let i = 0; i < TICKETS.length; i++) {
    const t = TICKETS[i];
    if (t.carrier === carrier && t.speed === speed && t.tvIdx === tvIdx && t.wifi === wifi) return t;
  }
  for (let j = 0; j < TICKETS.length; j++) {
    const tt = TICKETS[j];
    if (tt.carrier === carrier && tt.speed === speed && tt.tvIdx === tvIdx) return tt;
  }
  return null;
}

/**
 * Compute additional TV (TV2/TV3) charges. Pure version of getMultiTvAddon.
 * Returns an array of structured items (UI renders its own labels).
 */
function buildMultiTvAddon(carrierKey, opts) {
  const d = D[carrierKey];
  if (!d || !d.additionalTvPolicy || !d.additionalTvPolicy.enabled) return { items: [], totalAdd: 0 };
  const tvCount = opts.tvCount || 1;
  if (tvCount < 2) return { items: [], totalAdd: 0 };
  const policy = d.additionalTvPolicy;
  const items = [];
  let totalAdd = 0;
  [2, 3].forEach((n) => {
    if (n > tvCount) return;
    const tv2Idx = n === 2 ? (opts.tv2 || 0) : (opts.tv3 || 0);
    if (tv2Idx === 0) return;
    const settopId = n === 2 ? opts.settop2 : opts.settop3;
    const tv = d.tv[tv2Idx];
    if (!tv) return;
    const tvBase = tv.p || 0;
    const tvDc = tv.tv2Discount || 0;
    const tvFinal = tvBase - tvDc;
    const stItem = settopId ? (d.setTopOptions || []).find((o) => o.id === settopId) : null;
    const stFee = stItem ? (stItem.fee || 0) : 0;
    const stRate = policy.settopDiscountRate || 0;
    const stDcAmount = Math.round(stFee * stRate);
    const stFinal = stFee - stDcAmount;
    totalAdd += tvFinal + stFinal;
    items.push({
      slot: n, tvIdx: tv2Idx, tvName: tv.n,
      tvBase, tvDc, tvFinal,
      settopId: stItem ? stItem.id : null,
      settopName: stItem ? stItem.name : null,
      settopFee: stFee, settopDiscount: stDcAmount, settopFinal: stFinal
    });
  });
  return { items, totalAdd };
}

// ─────────────────────────────────────────────────────────────────────────────
// calc(opts) — Pure JS replacement for vanilla calc()
//
// opts shape (all optional unless noted):
//   carrier:   'skt' | 'kt' | 'lgu'   (required)
//   speed:     '100M' | '500M' | '1G' (required)
//   tv:        index into D[carrier].tv  (default 0 = no TV)
//   wifi:      boolean                  (default true)
//   bundle:    '' | 'family' | 'sk-onfamily' | 'home' | 'kt-total' |
//              'kt-fixed' | 'kt-premium' | 'kt-premium-single' |
//              'lgu-chweyswun' | 'lgu-together'
//   lines:     number (1~5 for family / lgu)   — for sk-onfamily this is netYrIdx
//   range:     number (rangeIdx)               — for sk-onfamily this is famYrIdx
//   settopId:  set-top option id (defaults to default option)
//   tvCount:   1 | 2 | 3
//   tv2, tv3:  index into D[carrier].tv (default 0)
//   settop2, settop3:  set-top ids for additional TVs
//   youthAdd:  boolean (LGU+ together only)
//   lguBonus:  'wifi2' | 'wifi-speaker'  (LGU+ premium 안심 옵션)
//   premiumPlan:  number (kt-premium-single, won) — picks dc from planCatalog
//   premiumMembers: array of { planV, usePrem, isRep } for kt-premium
//                   (5-row vanilla table → array; up to 5 entries)
// ─────────────────────────────────────────────────────────────────────────────
export function calc(opts) {
  const o = opts || {};
  const c = o.carrier;
  const sp = o.speed;
  const ti = parseInt(o.tv || 0, 10) || 0;
  const wf = o.wifi !== false; // default true
  const d = D[c];
  if (!d) {
    return { error: 'unknown carrier: ' + c, isValid: false };
  }
  if (!d.internet || d.internet[sp] == null) {
    return { error: 'unknown speed: ' + sp, isValid: false };
  }

  const hasTv = ti > 0;
  const netBase = d.internet[sp];
  const installPrice = hasTv ? d.install.combo : d.install.solo;
  const wifiForSp = d.wifiPrice ? d.wifiPrice[sp] : (typeof d.wifiCost === 'number' ? d.wifiCost : 1100);

  const ticket = findTicket(c, sp, ti, wf);
  const tvName = hasTv ? d.tv[ti].n : '';

  // ───────────────────────────────────────────────────────────────
  // 섹터 1 — 기본 결합 / 단독
  // ───────────────────────────────────────────────────────────────
  let sectorMain;
  if (hasTv) {
    const netCombo = wf ? d.tvInternetWithWifi[sp] : d.tvInternetNoWifi[sp];
    const tvBase = d.tv[ti].p;
    const tvDc = d.tv[ti].dc || 0;
    const tvFinal = tvBase - tvDc;
    const setTopFee = d.setTop || 0;
    const netDiscount = netBase + (wf ? wifiForSp : 0) - netCombo;

    // Set-top discount via discountRules (defaults to default set-top, override via settopId)
    const defSt = d.setTopOptions ? d.setTopOptions.find((x) => x.isDefault && x.active) : null;
    const settopId = o.settopId || (defSt ? defSt.id : null);
    const stDcInfo = getSettopDiscount(c, sp, ti, settopId);

    // multi-TV add-ons
    const multi = buildMultiTvAddon(c, {
      tvCount: o.tvCount || 1,
      tv2: o.tv2 || 0,
      tv3: o.tv3 || 0,
      settop2: o.settop2,
      settop3: o.settop3,
    });

    const total = netCombo + tvFinal + setTopFee - stDcInfo.discount + multi.totalAdd;

    sectorMain = {
      kind: 'tv-bundle',
      title: c === 'skt' ? '요즘우리집결합 (TV만)' : c === 'kt' ? 'KT TV 결합 기본' : 'TV 결합 기본',
      netBase, wifiOn: wf, wifiCost: wf ? wifiForSp : 0, wifiName: d.wifiName || '',
      netCombo, netDiscount,
      tvName, tvBase, tvDc, tvFinal,
      setTopFee, setTopName: d.setTopName || '',
      settopId,
      settopDiscount: stDcInfo.discount,
      settopMatched: stDcInfo.matched,
      multiTv: multi.items,
      multiTvTotal: multi.totalAdd,
      total,
      lguBonus: (c === 'lgu' && (sp === '500M' || sp === '1G'))
        ? (o.lguBonus === 'wifi-speaker' ? '와이파이 1대 + 스마트홈 스피커' : '와이파이 2대')
        : null
    };
  } else {
    const addWifi = wf ? wifiForSp : 0;
    const subTotal = netBase + addWifi;
    // KT 프리미엄 싱글결합 인터넷 추가 할인 (TV 미가입 + 500M↑ + 휴대폰 77K↑)
    const psPlan = (o.bundle === 'kt-premium-single') ? (parseInt(o.premiumPlan || 0, 10) || 0) : 0;
    const inetSoloDcSec1 = (c === 'kt' && o.bundle === 'kt-premium-single'
                            && (sp === '500M' || sp === '1G')
                            && psPlan >= 77000) ? 5500 : 0;
    const totalAfterInetDc = subTotal - inetSoloDcSec1;
    sectorMain = {
      kind: 'internet-only',
      title: '인터넷 단독',
      netBase, wifiOn: wf, wifiCost: addWifi, wifiName: d.wifiName || '',
      subTotal,
      ktPremiumSingleInetDc: inetSoloDcSec1,
      total: totalAfterInetDc,
      lguBonus: (c === 'lgu' && (sp === '500M' || sp === '1G'))
        ? (o.lguBonus === 'wifi-speaker' ? '와이파이 1대 + 스마트홈 스피커' : '와이파이 2대')
        : null
    };
  }

  // ───────────────────────────────────────────────────────────────
  // 섹터 2 — bundle별 분기
  // ───────────────────────────────────────────────────────────────
  let sectorFamily = null;
  let mobileDiscount = 0;
  const bundleType = o.bundle || '';

  // KT 총액 / 정액 결합
  if (c === 'kt' && (bundleType === 'kt-total' || bundleType === 'kt-fixed')) {
    const rangeIdx = parseInt(o.range || 0, 10) || 0;
    const isTotal = bundleType === 'kt-total';
    const tbl = isTotal ? d.bundle.total : d.bundle.fixed;
    const rangeLabels = isTotal ? d.bundle.ranges_total : d.bundle.ranges_fixed;
    let inetDc, mobDc;
    if (isTotal) { inetDc = tbl.internet[sp][rangeIdx] || 0; mobDc = tbl.mobile[sp][rangeIdx] || 0; }
    else { inetDc = tbl.internet[rangeIdx] || 0; mobDc = tbl.mobile[rangeIdx] || 0; }
    const netSingleWithWifi = netBase + (wf ? wifiForSp : 0);
    // ★ 2026-08-23: KT 기본 결합할인(500M·1G 5,500원)은 TV 결합뿐 아니라
    //   휴대폰(무선) 결합만 있어도 적용된다. 요금 구간과 무관하게 항상 적용.
    //   (docs/calculator.html · docs/tm-counselor.html 과 동일 로직)
    const ktTierDiff = netSingleWithWifi - (wf ? d.tvInternetWithWifi[sp] : d.tvInternetNoWifi[sp]);
    const ktNetCombo = hasTv
      ? (wf ? d.tvInternetWithWifi[sp] : d.tvInternetNoWifi[sp])
      : (netSingleWithWifi - Math.max(0, ktTierDiff));
    const ktBaseInetDc = netSingleWithWifi - ktNetCombo;  // TV 결합 시 / 무선 결합 시
    const inetAfterAll = ktNetCombo - inetDc;
    const tvBaseVal = hasTv ? d.tv[ti].p : 0;
    const tvBaseDc = hasTv ? (d.tv[ti].dc || 0) : 0;
    const tvAfter = tvBaseVal - tvBaseDc;
    const setTopFee = hasTv ? (d.setTop || 0) : 0;
    const multi = buildMultiTvAddon(c, {
      tvCount: o.tvCount || 1, tv2: o.tv2, tv3: o.tv3, settop2: o.settop2, settop3: o.settop3,
    });
    const finalInet = inetAfterAll + tvAfter + setTopFee + multi.totalAdd;

    sectorFamily = {
      kind: isTotal ? 'kt-total' : 'kt-fixed',
      title: 'KT ' + (isTotal ? '총액' : '정액') + ' 결합할인',
      rangeLabel: rangeLabels[rangeIdx],
      rangeIdx,
      netSingleWithWifi, ktNetCombo, ktBaseInetDc,
      inetDc, inetAfterAll,
      tvBase: tvBaseVal, tvDc: tvBaseDc, tvAfter, setTopFee,
      multiTv: multi.items, multiTvTotal: multi.totalAdd,
      finalInet,
      mobileDiscount: mobDc
    };
    mobileDiscount = mobDc;
  }

  // KT 프리미엄 가족결합 (premium-members array)
  if (c === 'kt' && bundleType === 'kt-premium') {
    const premData = D.kt.bundle.premium;
    const catalog = premData.planCatalog;
    // TODO Phase A2: vanilla reads from .c-prem-plan inputs (5 rows). React UI must
    // pass `premiumMembers: [{ planIdx | planV, usePrem, isRep }, ...]`.
    const membersInput = Array.isArray(o.premiumMembers) ? o.premiumMembers : [];
    const members = [];
    membersInput.forEach((m, idx) => {
      let plan = null;
      if (m.planIdx != null) plan = catalog[m.planIdx];
      else if (m.planV != null) plan = catalog.find((p) => p.v === m.planV);
      if (!plan || plan.v === 0) return;
      const isRep = m.isRep === true || idx === 0;
      const usePrem = !isRep && plan.prem && m.usePrem === true;
      members.push({ idx, isRep, plan, usePrem });
    });
    const premMembers = members.filter((m) => m.usePrem);
    const totalMembers = members.filter((m) => !m.usePrem);
    const totalSum = totalMembers.reduce((a, b) => a + b.plan.v, 0);
    const premCount = premMembers.length;
    const highPlanCount = members.filter((m) => m.plan.prem).length;
    const eligible = highPlanCount >= 2 && premCount >= 1;
    const totalRanges = d.bundle.ranges_total;
    let rngIdx = 0;
    if (totalSum >= 174900) rngIdx = 5;
    else if (totalSum >= 141900) rngIdx = 4;
    else if (totalSum >= 108900) rngIdx = 3;
    else if (totalSum >= 64900) rngIdx = 2;
    else if (totalSum >= 22000) rngIdx = 1;
    else rngIdx = 0;
    const totalMobDc = totalSum > 0 ? (d.bundle.total.mobile[sp][rngIdx] || 0) : 0;
    const premTotalDc = premMembers.reduce((a, b) => a + b.plan.dc, 0);
    const fixedDc = premData.internet;
    const totalGrandDc = fixedDc + totalMobDc + premTotalDc;
    const netSingleWithWifi2 = netBase + (wf ? wifiForSp : 0);
    const ktNetCombo2 = hasTv ? (wf ? d.tvInternetWithWifi[sp] : d.tvInternetNoWifi[sp]) : netSingleWithWifi2;
    const inetAfterPrem = ktNetCombo2 - fixedDc;
    const tvBaseValP = hasTv ? d.tv[ti].p : 0;
    const tvBaseDcP = hasTv ? (d.tv[ti].dc || 0) : 0;
    const tvAfterP = tvBaseValP - tvBaseDcP;
    const setTopFeeP = hasTv ? (d.setTop || 0) : 0;
    const multi = buildMultiTvAddon(c, {
      tvCount: o.tvCount || 1, tv2: o.tv2, tv3: o.tv3, settop2: o.settop2, settop3: o.settop3,
    });
    const finalInetP = inetAfterPrem + tvAfterP + setTopFeeP + multi.totalAdd;

    sectorFamily = {
      kind: 'kt-premium',
      title: 'KT 프리미엄 가족결합',
      eligible,
      members,
      totalSum, premCount, totalMembersCount: totalMembers.length,
      rangeIdx: rngIdx, rangeLabel: totalRanges[rngIdx],
      fixedInternetDc: fixedDc,
      totalMobDc,
      premTotalDc,
      totalGrandDc,
      netSingleWithWifi: netSingleWithWifi2,
      ktNetCombo: ktNetCombo2,
      inetAfterPrem,
      tvBase: tvBaseValP, tvDc: tvBaseDcP, tvAfter: tvAfterP, setTopFee: setTopFeeP,
      multiTv: multi.items, multiTvTotal: multi.totalAdd,
      finalInet: finalInetP,
      mobileDiscount: totalMobDc + premTotalDc
    };
    mobileDiscount = totalMobDc + premTotalDc;
  }

  // KT 프리미엄 싱글결합
  if (c === 'kt' && bundleType === 'kt-premium-single') {
    const catalog = D.kt.bundle.premium.planCatalog;
    const psPlanV = parseInt(o.premiumPlan || 0, 10) || 0;
    const planObj = catalog.find((p) => p.v === psPlanV);
    const psDc = planObj ? (planObj.dc || 0) : 0;
    const psSpeedOk = (sp === '500M' || sp === '1G');
    const psPlanOk = psPlanV >= 77000;
    const inetSoloDc = !hasTv ? 5500 : 0;
    const psTotalDc = psDc + inetSoloDc;
    const warnings = [];
    if (!psSpeedOk) warnings.push('인터넷 500M 이상 필수 (현재 ' + sp + ')');
    if (!psPlanOk) warnings.push('휴대폰 요금제 77,000원 이상 필수');

    sectorFamily = {
      kind: 'kt-premium-single',
      title: 'KT 프리미엄 싱글결합 (1회선)',
      psPlanV, psDc, inetSoloDc, psTotalDc,
      psSpeedOk, psPlanOk, eligible: psSpeedOk && psPlanOk,
      warnings,
      mobileDiscount: psDc
    };
    mobileDiscount = psDc;
  }

  // LGU+ 참쉬운 / 투게더 결합
  if (c === 'lgu' && (bundleType === 'lgu-chweyswun' || bundleType === 'lgu-together')) {
    const isChweyswun = bundleType === 'lgu-chweyswun';
    const lguData = isChweyswun ? d.bundle.chweyswun : d.bundle.together;
    const lguInetDc = lguData.internet[sp] || 0;
    const lines = parseInt(o.lines || 2, 10) || 2;
    const idx = Math.min(lines, 4) - 2;
    let lguMobDc = 0;
    let planLabel = '';
    if (isChweyswun) {
      const planIdx = parseInt(o.range || 0, 10) || 0;
      lguMobDc = lguData.mobile[planIdx][idx] || 0;
      planLabel = lguData.planLabels[planIdx];
    } else {
      lguMobDc = lguData.mobile[idx] || 0;
      planLabel = '85,000원 이상 고가요금제';
    }
    const netSingleWithWifi3 = netBase + (wf ? wifiForSp : 0);
    // ★ 2026-08-23: 참쉬운·투게더 인터넷 할인은 TV 결합 기본할인을 '대체'하지 않고 '중복' 적용된다.
    const lguNetCombo = hasTv ? (wf ? d.tvInternetWithWifi[sp] : d.tvInternetNoWifi[sp]) : netSingleWithWifi3;
    const lguTvBundleDc = netSingleWithWifi3 - lguNetCombo;
    const inetAfter = lguNetCombo - lguInetDc;
    const tvBaseVal2 = hasTv ? d.tv[ti].p : 0;
    const tvBaseDc2 = hasTv ? (d.tv[ti].dc || 0) : 0;
    const tvAfter2 = tvBaseVal2 - tvBaseDc2;
    const setTopFee2 = hasTv ? (d.setTop || 0) : 0;
    const multi = buildMultiTvAddon(c, {
      tvCount: o.tvCount || 1, tv2: o.tv2, tv3: o.tv3, settop2: o.settop2, settop3: o.settop3,
    });
    const finalInet2 = inetAfter + tvAfter2 + setTopFee2 + multi.totalAdd;
    const youthDc = (!isChweyswun && o.youthAdd === true) ? 10000 : 0;

    sectorFamily = {
      kind: isChweyswun ? 'lgu-chweyswun' : 'lgu-together',
      title: 'LGU+ ' + (isChweyswun ? '참쉬운 가족결합' : '투게더 결합'),
      lines, planLabel,
      netSingleWithWifi: netSingleWithWifi3,
      lguInetDc, lguTvBundleDc, inetAfter,
      tvBase: tvBaseVal2, tvDc: tvBaseDc2, tvAfter: tvAfter2, setTopFee: setTopFee2,
      multiTv: multi.items, multiTvTotal: multi.totalAdd,
      finalInet: finalInet2,
      lguMobDc, youthDc,
      mobileDiscount: lguMobDc + youthDc,
      lguBonus: (sp === '500M' || sp === '1G')
        ? (o.lguBonus === 'wifi-speaker' ? '와이파이 1대 + 스마트홈 스피커' : '와이파이 2대')
        : null
    };
    mobileDiscount = lguMobDc + youthDc;
  }

  // SKT 요즘가족결합 (family)
  if (bundleType === 'family' && d.bundle && d.bundle.family) {
    const famInet = d.bundle.family.internet[sp];
    const famIptv = hasTv ? (d.bundle.family.iptv || 0) : 0;
    const lines2 = parseInt(o.lines || 1, 10) || 1;
    const mobileTable = d.bundle.family.mobilePerBySpeed[sp] || d.bundle.family.mobilePerBySpeed['1G'];
    const perPerson = mobileTable[lines2] || 0;
    const mobDc2 = perPerson * lines2;
    const netSingleWithWifi4 = netBase + (wf ? wifiForSp : 0);
    const inetAfterFamily = netSingleWithWifi4 - famInet;
    const tvBaseVal3 = hasTv ? d.tv[ti].p : 0;
    const tvBaseDc3 = hasTv ? (d.tv[ti].dc || 0) : 0;
    const tvTotalDc = tvBaseDc3 + famIptv;
    const tvAfterFamily = tvBaseVal3 - tvTotalDc;
    const setTopFee3 = hasTv ? (d.setTop || 0) : 0;
    const multi = buildMultiTvAddon(c, {
      tvCount: o.tvCount || 1, tv2: o.tv2, tv3: o.tv3, settop2: o.settop2, settop3: o.settop3,
    });
    const finalInet3 = inetAfterFamily + tvAfterFamily + setTopFee3 + multi.totalAdd;

    sectorFamily = {
      kind: 'family',
      title: '요즘가족결합 (무선결합)',
      lines: lines2, perPerson,
      netSingleWithWifi: netSingleWithWifi4,
      famInetDc: famInet, inetAfterFamily,
      tvBase: tvBaseVal3, tvBaseDc: tvBaseDc3, famIptvDc: famIptv,
      tvTotalDc, tvAfterFamily, setTopFee: setTopFee3,
      multiTv: multi.items, multiTvTotal: multi.totalAdd,
      finalInet: finalInet3,
      mobileDiscount: mobDc2
    };
    mobileDiscount = mobDc2;
  }

  // SKT 온가족할인 (sk-onfamily)
  if (c === 'skt' && bundleType === 'sk-onfamily' && d.bundle && d.bundle.onfamily) {
    const ofData = d.bundle.onfamily;
    const netYrIdx = parseInt(o.lines || 0, 10) || 0;
    const famYrIdx = parseInt(o.range || 0, 10) || 0;
    const pct = (ofData.matrix[netYrIdx] && ofData.matrix[netYrIdx][famYrIdx]) || 0;
    const netSingleWithWifi5 = netBase + (wf ? wifiForSp : 0);
    const inetBase = hasTv ? (wf ? d.tvInternetWithWifi[sp] : d.tvInternetNoWifi[sp]) : netSingleWithWifi5;
    const onfamilyDc = Math.round(inetBase * pct / 100);
    const inetAfterOf = inetBase - onfamilyDc;
    const tvBaseValO = hasTv ? d.tv[ti].p : 0;
    const tvBaseDcO = hasTv ? (d.tv[ti].dc || 0) : 0;
    const tvAfterO = tvBaseValO - tvBaseDcO;
    const setTopFeeO = hasTv ? (d.setTop || 0) : 0;
    const multi = buildMultiTvAddon(c, {
      tvCount: o.tvCount || 1, tv2: o.tv2, tv3: o.tv3, settop2: o.settop2, settop3: o.settop3,
    });
    const finalInetO = inetAfterOf + tvAfterO + setTopFeeO + multi.totalAdd;

    sectorFamily = {
      kind: 'sk-onfamily',
      title: 'SKT 온가족할인',
      netYrLabel: ofData.netYrLabels[netYrIdx],
      famYrLabel: ofData.famYrLabels[famYrIdx],
      pct,
      inetBase, onfamilyDc, inetAfterOf,
      tvBase: tvBaseValO, tvDc: tvBaseDcO, tvAfter: tvAfterO, setTopFee: setTopFeeO,
      multiTv: multi.items, multiTvTotal: multi.totalAdd,
      finalInet: finalInetO,
      mobileDiscount: 0
    };
    mobileDiscount = 0;
  }

  // ───────────────────────────────────────────────────────────────
  // Gift / install
  // ───────────────────────────────────────────────────────────────
  const giftAmount = getGiftAmount(d, sp, ti);

  const installWeekday = installPrice;
  const installWeekend = hasTv ? d.installWeekend.combo : d.installWeekend.solo;
  let additionalInstall = 0;
  let additionalInstallBase = 0;
  let additionalInstallDiscount = 0;
  const tvCntForInstall = o.tvCount || 1;
  if (tvCntForInstall >= 2 && d.additionalTvPolicy && d.additionalTvPolicy.enabled) {
    const addBaseFee = d.additionalTvPolicy.additionalTvInstallFee || 17600;
    const addRate = d.additionalTvPolicy.installDiscountRate || 0.5;
    const addPerTv = Math.round(addBaseFee * (1 - addRate));
    const addCount = tvCntForInstall - 1;
    additionalInstall = addPerTv * addCount;
    additionalInstallBase = addBaseFee * addCount;
    additionalInstallDiscount = additionalInstallBase - additionalInstall;
  }

  return {
    isValid: true,
    carrierKey: c,
    carrierName: d.name,
    speed: sp,
    hasTv, tvIdx: ti, tvName, wifi: wf,
    bundleType,
    ticket,
    sectorMain,
    sectorFamily,
    monthlyFeeSector1: sectorMain ? sectorMain.total : 0,
    monthlyFeeSector2: sectorFamily ? (sectorFamily.finalInet || 0) : 0,
    mobileDiscount,
    gift: giftAmount,
    install: {
      weekday: installWeekday,
      weekend: installWeekend,
      additional: additionalInstall,
      additionalBase: additionalInstallBase,
      additionalDiscount: additionalInstallDiscount,
      weekdayWithAdditional: installWeekday + additionalInstall
    }
  };
}

// Default export — convenience.
export default { D, calc, getGiftAmount, getSettopDiscount, generateTickets, findTicket, applyGiftOverrides, applyIncentivePaybackSync };
