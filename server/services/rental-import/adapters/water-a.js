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
  return { care_type: null, cycle_months: cycle }; // 스페셜체인지 등 — 원문 care_label 로 보존
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
      const halfMonths = hasVal(row[c.half]) ? toMonths(row[c.half]) : null;
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
          price_phases: halfPhases(fee, halfMonths), rebate: detail.half,
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
      monthly_fee: fee, price_phases: halfM ? halfPhases(fee, parseInt(halfM[1], 10)) : [],
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
      const careType = cycle === 0 ? 'self' : cycle != null ? 'visit' : null;
      const p1 = clean(row[c.promo1]);
      const p2 = clean(row[c.promo2]);
      const tags = [];
      const letter = rule.match(/^[A-Za-z]/);
      if (letter) tags.push(`rule:${letter[0].toUpperCase()}`);
      let offerType = 'normal';
      const labels = [];
      if (p2) { offerType = 'half'; labels.push(p2); }
      if (p1) { if (offerType === 'normal') offerType = 'promo'; else tags.push(p1); labels.push(p1); }
      const obligation = toMonths(row[c.obligation]);
      offers.push(makeOffer({
        supplier: '청호', brand: '청호나이스', category_raw: row[c.category], product_name: row[c.product],
        model_code: row[c.model] || null, model_key: clean(row[c.model]) ? undefined : code,
        variant_code: `${code}-${rule}`,
        contract_months: obligation, obligation_months: obligation, ownership_months: toMonths(row[c.ownership]),
        care_type: careType, care_label: row[c.care], cycle_months: cycle || null,
        offer_type: offerType, offer_tags: tags, offer_label: labels.join(' + ') || null,
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
