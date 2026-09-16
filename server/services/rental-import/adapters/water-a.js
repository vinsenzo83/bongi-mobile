/**
 * 정수기 파일 어댑터 A — 코웨이 · 코웨이프로모션 · 쿠쿠 · 쿠쿠타사보상 · 청호
 */
import {
  clean, hasVal, toWon, toMonths, sheetBase, halfPhases, forwardFill,
  findHeaderRow, colMap, makeOffer, conditionKey,
} from '../core.js';

const rowHas = (row) => Array.isArray(row) && row.some(hasVal);

/** 헤더 이전 행 = 정책안내, 헤더 행 = 헤더 */
function skipHead(rows, headerIdx, skipped, reason = '정책안내') {
  for (let r = 0; r <= headerIdx; r++) {
    if (rowHas(rows[r])) skipped.push({ row: r + 1, reason: r === headerIdx ? '헤더' : reason });
  }
}

/** 헤더 라벨과 정확히 일치하는 컬럼(공백 제거) */
function exactCol(headerRow, label) {
  return (headerRow || []).findIndex((v) => clean(v).replace(/\s/g, '') === label);
}

/** 동일 조건키가 반복되는 행(원본에 구분값 없음) → variant_code 에 순번을 붙여 보존 */
function dedupeVariants(offers) {
  const seen = new Map();
  for (const o of offers) {
    const k = conditionKey(o);
    const n = (seen.get(k) || 0) + 1;
    seen.set(k, n);
    if (n > 1) {
      o.variant_code = `${o.variant_code || ''}#${n}`;
      o.notes = [o.notes, '동일 조건 반복행(수수료 상이) — 원본 확인 필요'].filter(Boolean).join(' / ');
    }
  }
}

// ------------------------------------------------------------------
// 코웨이
// ------------------------------------------------------------------
function cowayCare(raw) {
  const s = clean(raw);
  const n = s.match(/(\d+)\s*M/i);
  const cycle = n ? parseInt(n[1], 10) : null;
  if (/자가/.test(s)) return { care_type: 'self', cycle_months: cycle };
  if (/서비스\s*프리/.test(s)) return { care_type: 'none', cycle_months: null };
  if (/1\s*회\s*서비스/.test(s)) return { care_type: 'none', cycle_months: null };
  if (/점검주기|^\d+M$/.test(s)) return { care_type: 'visit', cycle_months: cycle };
  if (/베이직케어|토탈케어|방문관리/.test(s)) return { care_type: 'visit', cycle_months: cycle };
  if (/케어\s*X/i.test(s)) return { care_type: 'none', cycle_months: null };   // 매트리스 스페셜체인지(케어X,교체O) — 방문관리 없음, 교체만
  return { care_type: null, cycle_months: cycle };
}

// ─── 코웨이 9월 정책 프로모션 PDF (시트 밖 조건) ───────────────────────────
// 반값 개월 — PDF 반값표가 시트와 다를 때 PDF 를 따른다 (테라솔U: 시트가 약정별로 한 칸씩 밀려 있음, W·S인덕션: 시트 '-')
const COWAY_HALF_OVERRIDE = [
  { re: /^테라솔\s*U/, months: { 60: 12, 72: 18, 84: 24 } },
  { re: /W\s*인덕션\s*프로|^S\s*인덕션/, months: { 60: 6, 72: 9, 84: 12 } },
];
// 타사보상 — '26년 9월 총주문 마감. 반값할인과 중복 불가라 일반(normal) 조건에서만 만든다.
//   정수기: 약정할인가 10% + 1년간 월 1만원(A477), 얼음 데스크탑 6/7년은 월 2만원
//   청정기(LG/삼성/위닉스 사용고객)·비데(쿠쿠/노비타/SK/대림/더이누스/유스파 사용고객): 신규렌탈가 10%
const COWAY_TRADE_IN = [
  { re: /^아이콘얼음|^얼음정수기 RO/, target: '정수기', extra: (m) => (m >= 72 ? 20000 : 10000), who: '타사 정수기 사용고객' },
  { re: /^아이콘(2|3|\s*프로)|^노블 (정수기|빌트인)|^엘리트|^워터스탠드|^아이콘 스탠드|^아이스\s*스탠드(3\.0)?$|^아이스스탠드3\.0/, target: '정수기', extra: () => 10000, who: '타사 정수기 사용고객' },
  { models: ['AP-1519M', 'AP-1523D', 'AP-1023F', 'AP-3021D', 'AP-1623M', 'AP-2023K', 'AP-3024H', 'AP-4025D', 'APD-1023A', 'APD-1025E'], target: '청정기', extra: () => 0, who: 'LG/삼성/위닉스 청정기 사용고객' },
  { models: ['BAS37-C', 'BAS38-C', 'BAS40-A', 'BAS41-A', 'BAS49-A', 'BA36-B'], target: '비데', extra: () => 0, who: '쿠쿠/노비타/SK/대림/더이누스/유스파 비데 사용고객' },
];
function cowayTradeIn(product, model, contract, categoryRaw) {
  // 품목이 맞아야 한다 — '엘리트' 같은 이름이 매트리스에도 있다
  const hit = COWAY_TRADE_IN.find((t) => clean(categoryRaw).includes(t.target) && (t.models ? t.models.includes(model) : t.re.test(product)));
  if (!hit) return null;
  return { ...hit, extraWon: hit.extra(contract) };
}

const coway = {
  id: 'coway',
  file: 'water',
  match: (name) => sheetBase(name) === '코웨이',
  parse(rows, ctx) {
    const offers = [];
    const skipped = [];
    const h = findHeaderRow(rows, ['제품군', '상품명', '모델명', '약정할인가']);
    if (h < 0) throw new Error(`[coway] 헤더를 찾지 못함: ${ctx.sheetName}`);
    const c = colMap(rows[h], {
      category: '제품군', product: '상품명', model: '모델명', contract: '약정기간', half: '반값할인적용기간',
      care: '점검주기', fee: '약정할인가', base: '기본수수료', extra: '추가수수료', ice: '얼음정수기군',
      hotcold: '냉온/냉정수기군', promoTrade: '타사보상프로모션', promoHalf: '반값할인프로모션',
      promoEtc: '반값할인外', total: '총수수료', trade: '타사보상(vat', halfRebate: '반값할인(vat',
    });
    skipHead(rows, h, skipped);
    for (let r = h + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!rowHas(row)) continue;
      const model = clean(row[c.model]);
      const fee = toWon(row[c.fee]);
      if (!model || fee == null) { skipped.push({ row: r + 1, reason: '모델·렌탈료 없음' }); continue; }
      const contract = toMonths(row[c.contract]);
      const care = cowayCare(row[c.care]);
      const product = clean(row[c.product]);
      const halfOverride = COWAY_HALF_OVERRIDE.find((o) => o.re.test(product));
      const halfMonths = halfOverride ? (halfOverride.months[contract] || null) : hasVal(row[c.half]) ? toMonths(row[c.half]) : null;
      const detail = {
        base: toWon(row[c.base]), extra: toWon(row[c.extra]), ice_group: toWon(row[c.ice]),
        hotcold_group: toWon(row[c.hotcold]), promo_trade_in: toWon(row[c.promoTrade]),
        promo_half: toWon(row[c.promoHalf]), promo_etc: toWon(row[c.promoEtc]),
        total: toWon(row[c.total]), trade_in: toWon(row[c.trade]), half: toWon(row[c.halfRebate]),
      };
      const common = {
        supplier: '코웨이', brand: '코웨이', category_raw: row[c.category], product_name: row[c.product],
        model_code: model, contract_months: contract, obligation_months: contract, ownership_months: null,
        variant_code: row[c.care],   // 점검주기 원문(서비스프리/서비스프리(케어X,교체X) 등 구분 보존)
        care_type: care.care_type, care_label: row[c.care], cycle_months: care.cycle_months,
        monthly_fee: fee, rebate_basis: 'amount', rebate_detail: detail,
        source: { sheet: ctx.sheetName, row: r + 1 },
      };
      offers.push(makeOffer({ ...common, offer_type: 'normal', rebate: detail.total }));
      if (halfMonths) {
        offers.push(makeOffer({
          ...common, offer_type: 'half', offer_label: `${halfMonths}개월 반값`,
          price_phases: halfPhases(fee, halfMonths),
          // 반값 수수료 칸이 비어 있는 행(PDF 로 반값을 추가한 인덕션 등)은 80% 차감 대상이 아니므로 총수수료
          rebate: detail.half ?? detail.total,
          notes: halfOverride ? '반값 개월: 코웨이 9월 정책 프로모션 PDF 반값표 기준(시트와 다름)' : undefined,
        }));
      }
      const trade = cowayTradeIn(product, model, contract, row[c.category]);
      if (trade) {
        const tFee = Math.floor((fee * 0.9) / 100) * 100;   // 약정할인가 10% (100원 미만 버림 — 최종 금액은 렌탈사 접수 화면 기준)
        offers.push(makeOffer({
          ...common, offer_type: 'trade_in',
          offer_label: trade.extraWon ? `타사보상 10% + 1년 월 ${trade.extraWon / 10000}만원(A477)` : '타사보상 10%',
          monthly_fee: tFee,
          price_phases: trade.extraWon ? [{ from: 1, to: 12, fee: Math.max(0, tFee - trade.extraWon) }] : [],
          rebate: detail.trade_in ?? detail.total,
          notes: `대상: ${trade.who} · 물마크 번호 필수(중복 시 수수료 100% 되물림) · 반값 중복 불가 · 9월 총주문 마감`,
        }));
      }
    }
    dedupeVariants(offers);
    return { offers, skipped };
  },
};

const cowayPromo = {
  id: 'coway-promo',
  file: 'water',
  match: (name) => sheetBase(name) === '코웨이프로모션',
  parse(rows) {
    const skipped = [];
    rows.forEach((row, i) => { if (rowHas(row)) skipped.push({ row: i + 1, reason: '프로모션안내(텍스트)' }); });
    return { offers: [], skipped };
  },
};

// ------------------------------------------------------------------
// 쿠쿠 · 쿠쿠타사보상
// ------------------------------------------------------------------
// 쿠쿠 타사보상 시트 모델칸 문구 — "※ 의무 3 / 5 / 6 / 7 년 : 12회차 1만원 추가 할인", "의무 3 / 5년 : 12회차 … 의무 6 / 년 : 16회차 …"
//   '6 / 년' 처럼 뒤 연수가 빠진 표기는 앞 문구(3/5/6/7년)와 짝을 맞춰 7년까지로 본다
export function extraPhase(cell, obligationMonths, fee) {
  const text = String(cell).replace(/\s+/g, ' ');
  if (!obligationMonths || !/회차\s*1만원/.test(text)) return [];
  const years = obligationMonths / 12;
  const re = /의무\s*([\d\s/]+?)\s*\/?\s*년\s*:?\s*(\d+)\s*회차\s*1만원/g;
  for (const m of text.matchAll(re)) {
    const ys = m[1].split('/').map((v) => parseInt(v, 10)).filter(Boolean);
    if (/\d\s*\/\s*년/.test(m[0])) { const last = ys[ys.length - 1]; if (last) ys.push(last + 1); }
    if (ys.includes(years)) return [{ from: 1, to: parseInt(m[2], 10), fee: Math.max(0, fee - 10000) }];
  }
  return [];
}

function cuckooParse(rows, ctx, { tradeInSheet }) {
  const offers = [];
  const skipped = [];
  const h = findHeaderRow(rows, ['제품군', '모델명(세부)', '렌탈료']);
  if (h < 0) throw new Error(`[cuckoo] 헤더를 찾지 못함: ${ctx.sheetName}`);
  const c = colMap(rows[h], {
    category: '제품군', detail: '모델명(세부)', kind: '구분', obligation: '의무', ownership: '소유권',
    care: '점검주기', fee: '렌탈료', rebate: '총수수료', note: '비고',
  });
  // "모델명" 은 "모델명(세부)" 와 겹치므로 정확히 일치하는 컬럼을 따로 찾는다
  c.model = (rows[h] || []).findIndex((v) => clean(v).replace(/\s/g, '') === '모델명');
  skipHead(rows, h, skipped);
  const hadData = rows.map(rowHas);
  forwardFill(rows, h + 1, [c.category, c.model]);

  for (let r = h + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!hadData[r]) continue;
    const detail = clean(row[c.detail]);
    const fee = toWon(row[c.fee]);
    if (!detail || fee == null) { skipped.push({ row: r + 1, reason: '세부모델·렌탈료 없음' }); continue; }

    const modelCode = clean(detail.split('(')[0]) || clean(String(row[c.model] || '').split(/\n/)[0]);
    const kind = clean(row[c.kind]);
    const note = clean(row[c.note]);
    const text = `${detail} ${note}`;
    const tags = [];

    // 약정: "/60M/" 토큰, 없으면 의무
    const cm = detail.match(/[/(](\d{1,3})M(?=[/)])/);
    const obligation = toMonths(row[c.obligation]);
    const contract = cm ? parseInt(cm[1], 10) : obligation;

    // 관리
    const careRaw = clean(row[c.care]);
    let careType; let cycle = null;
    const cycleM = careRaw.match(/(\d+)\s*(개월|C)/);
    if (cycleM) cycle = parseInt(cycleM[1], 10);
    if (/셀프/.test(detail)) careType = 'self';
    else if (/^없음/.test(careRaw)) careType = 'none';
    else if (cycle != null || /회/.test(careRaw)) careType = 'visit';
    else careType = null;
    if (cycle == null) { const dc = detail.match(/(\d+)C(?=[/)])/); if (dc && careType !== 'none') cycle = parseInt(dc[1], 10); }

    // 할인유형
    const halfM = text.match(/(\d+)M\s*반값/);
    const isPackage = /패키지/.test(kind) || /[/(]P[/)]/.test(detail) || /[/(]패키지\d*[/)]/.test(detail);
    if (/10\s*(%|프로)/.test(`${kind} ${detail}`)) tags.push('10%할인');
    const won = text.match(/(\d+)천원할인/); if (won) tags.push(`${won[1]}천원할인`);
    if (/특가/.test(text)) tags.push('특가');
    const trade = detail.match(/타사보상(\d*)/);

    let offerType = 'normal';
    let label = null;
    if (halfM) { offerType = 'half'; label = `${halfM[1]}개월 반값`; if (isPackage) tags.push('package'); }
    else if (tradeInSheet || trade) { offerType = 'trade_in'; label = trade ? `타사보상${trade[1] || ''}` : '타사보상'; if (isPackage) tags.push('package'); }
    else if (/세트/.test(kind)) { offerType = 'bundle'; tags.push('세트'); }
    else if (isPackage) offerType = 'package';

    offers.push(makeOffer({
      supplier: '쿠쿠', brand: '쿠쿠', category_raw: row[c.category],
      // 타사보상 시트 모델칸은 '● 미니100 / 초고온 직수 정수기 / (빈줄) / 코드들…' — 빈 줄·코드 전까지를 이름으로 쓴다
      product_name: (() => {
        const lines = String(row[c.model] || '').split(/\n/).map(clean);
        const out = [];
        for (const l of lines) { if (!l || /^[A-Z]{2,}-/.test(l) || /^※/.test(l)) break; out.push(l); }
        return out.join(' ') || modelCode;
      })(),
      model_code: modelCode, variant_code: detail,
      contract_months: contract, obligation_months: obligation, ownership_months: toMonths(row[c.ownership]),
      care_type: careType, care_label: careRaw, cycle_months: cycle,
      offer_type: offerType, offer_tags: [...new Set(tags)], offer_label: label,
      monthly_fee: fee, price_phases: halfM ? halfPhases(fee, parseInt(halfM[1], 10)) : extraPhase(String(row[c.model] || ''), obligation, fee),
      rebate: toWon(row[c.rebate]), rebate_basis: 'amount', rebate_detail: { total: toWon(row[c.rebate]), kind },
      notes: note, source: { sheet: ctx.sheetName, row: r + 1 },
    }));
  }
  dedupeVariants(offers);
  return { offers, skipped };
}

const cuckoo = {
  id: 'cuckoo',
  file: 'water',
  match: (name) => sheetBase(name) === '쿠쿠',
  parse: (rows, ctx) => cuckooParse(rows, ctx, { tradeInSheet: false }),
};

const cuckooTradeIn = {
  id: 'cuckoo-trade-in',
  file: 'water',
  match: (name) => sheetBase(name) === '쿠쿠타사보상',
  parse: (rows, ctx) => cuckooParse(rows, ctx, { tradeInSheet: true }),
};

// ------------------------------------------------------------------
// 청호
// ------------------------------------------------------------------
// 청호 규정 알파벳 — 시트 상단 '특이사항' 원문
//   S규정(신규) · P규정(패키지) · J규정(재렌탈, 타사보상 = 소유권만기 고객) · O,N,H규정(특별 할인렌탈료)
//   A·Z 는 시트에 설명이 없어 '규정 코드'로만 보여준다
const CHUNGHO_RULES = {
  S: { label: '신규', type: 'normal' },
  P: { label: '패키지', type: 'package' },
  J: { label: '재렌탈·타사보상', type: 'trade_in' },
  O: { label: '특별할인', type: 'special' },
  N: { label: '특별할인', type: 'special' },
  H: { label: '특별할인', type: 'special' },
};

const chungho = {
  id: 'chungho',
  file: 'water',
  match: (name) => sheetBase(name) === '청호',
  parse(rows, ctx) {
    const offers = [];
    const skipped = [];
    const h = findHeaderRow(rows, ['제품군', '상품코드', '규정', '렌탈료']);
    if (h < 0) throw new Error(`[chungho] 헤더를 찾지 못함: ${ctx.sheetName}`);
    const c = colMap(rows[h], {
      category: '제품군', promo1: '프로모션1', promo2: '프로모션2', code: '상품코드', model: '모델명',
      product: '상품명', rule: '규정', obligation: '의무', ownership: '소유권', care: '점검주기',
      fee: '렌탈료', rebate: '총수수료',
    });
    c.fee = exactCol(rows[h], '렌탈료');   // "프로모션1(렌탈료할인)" 과 구분
    skipHead(rows, h, skipped);
    for (let r = h + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!rowHas(row)) continue;
      const code = clean(row[c.code]);
      const fee = toWon(row[c.fee]);
      if (!code || fee == null) { skipped.push({ row: r + 1, reason: '상품코드·렌탈료 없음' }); continue; }
      const rule = clean(row[c.rule]);
      const cycle = toMonths(row[c.care]) ?? toWon(row[c.care]);
      // 점검주기 0 = 관리 없음(매트리스·위탁판매). 상품명에 '자가관리'가 있으면 주기는 필터 교체 주기이고 관리는 자가.
      const selfCare = /자가관리/.test(clean(row[c.product]));
      const careType = cycle == null ? null : cycle === 0 ? 'none' : selfCare ? 'self' : 'visit';
      const p1 = clean(row[c.promo1]);
      const p2 = clean(row[c.promo2]);
      const tags = [];
      const letter = (rule.match(/^[A-Za-z]/) || [])[0]?.toUpperCase();
      if (letter) tags.push(`rule:${letter}`);
      const ruleInfo = CHUNGHO_RULES[letter] || null;
      let offerType = ruleInfo ? ruleInfo.type : 'normal';
      // 라벨 = 규정 + 프로모션 칸 원문 (예: '특별할인 · 렌탈료할인', '신규 · 반값')
      const labels = [ruleInfo ? `${ruleInfo.label}(${letter})` : letter ? `${letter}규정` : null];
      if (p1) { labels.push(p1); tags.push(p1); if (offerType === 'normal') offerType = 'promo'; }
      if (p2) { labels.push(p2); offerType = 'half'; }
      const obligation = toMonths(row[c.obligation]);
      offers.push(makeOffer({
        supplier: '청호', brand: '청호나이스', category_raw: row[c.category], product_name: row[c.product],
        model_code: row[c.model] || null, model_key: clean(row[c.model]) ? undefined : code,
        variant_code: `${code}-${rule}`,
        contract_months: obligation, obligation_months: obligation, ownership_months: toMonths(row[c.ownership]),
        care_type: careType, care_label: row[c.care], cycle_months: cycle || null,
        offer_type: offerType, offer_tags: tags, offer_label: labels.filter(Boolean).join(' · ') || null,
        monthly_fee: fee, price_phases: [],
        rebate: toWon(row[c.rebate]), rebate_basis: 'amount', rebate_detail: { total: toWon(row[c.rebate]), rule },
        notes: p2 ? '반값 적용 개월수 시트에 없음 — 정책 공지 확인' : null,
        source: { sheet: ctx.sheetName, row: r + 1 },
      }));
    }
    dedupeVariants(offers);
    return { offers, skipped };
  },
};

export default [coway, cowayPromo, cuckoo, cuckooTradeIn, chungho];
