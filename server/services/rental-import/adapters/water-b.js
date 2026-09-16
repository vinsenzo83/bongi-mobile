/**
 * water-b.js — 빌리고 "정수기" 파일: SK매직·웰스·루헨스·큐밍·유버스(정수기)·LG구독·LG구독수수료율
 *
 * 공통 결정:
 *   - contract_months = 의무(약정) 개월, ownership_months = 소유권 개월(코웨이 "약정기간(의무사용기간)"과 같은 의미).
 *   - 반값 = 해당 구간 기준요금/2(core.halfPhases). 회차 면제 = fee 0 구간.
 *   - 프로모션 문장이 조건(관리주기·타사보상 등)을 완전히 해석할 수 없으면 phases 를 만들지 않고 notes 에 원문을 남긴다.
 *   - 값이 있는 모든 행은 offer 또는 skipped{row,reason}.
 */
import {
  clean, hasVal, toWon, toMonths, findHeaderRow, colMap, makeOffer, sheetBase, halfPhases, forwardFill, conditionKey,
} from '../core.js';

const FILE = 'water';
const nonEmpty = (row) => Array.isArray(row) && row.some(hasVal);
const lines = (v) => (v == null ? [] : String(v).split(/\n/).map(clean).filter(Boolean));
const HANGUL = /[가-힣]/;

/** 헤더 이전·빈 행이 아닌 행을 skipped 로 기록 */
function skipRange(rows, from, to, reason, skipped) {
  for (let i = from; i < to && i < rows.length; i++) if (nonEmpty(rows[i])) skipped.push({ row: i + 1, reason });
}

/**
 * 같은 조건키 중복 처리(대표 지시: 반복행은 둘 다 보존): variant_code 에 #n 을 붙이고 notes 에 경고.
 */
function dedupe(result) {
  const seen = new Map(); const offers = [];
  for (const o of result.offers) {
    const k = conditionKey(o);
    const sig = JSON.stringify([o.monthly_fee, o.rebate, o.price_phases, o.prepay_amount, o.total_fee]);
    const prev = seen.get(k);
    if (!prev) { seen.set(k, { first: o, sigs: new Map([[sig, o]]), n: 1 }); offers.push(o); continue; }
    const same = prev.sigs.get(sig);
    prev.n += 1;
    o.variant_code = `${o.variant_code || ''} #${prev.n}`.trim();
    o.notes = [o.notes, same
      ? `시트 내 완전중복행(${same.source.row}행과 동일) — 원본 확인 필요`
      : `시트 내 동일조건 다른 요금(${prev.first.source.row}행) — 원본 확인 필요`].filter(Boolean).join(' / ');
    prev.sigs.set(sig, o);
    offers.push(o);
  }
  return { offers, skipped: result.skipped };
}

/** "12개월 반값" / "10M" / "3M (4~6회차)" → phases */
function halfFromText(text, fee) {
  const s = clean(text);
  if (!s || !fee) return null;
  let m = s.match(/(\d+)\s*개월\s*반값(?:\s*할인)?\s*(?:\(\s*(\d+)\s*~\s*(\d+)\s*(?:회차|차월|개월차)?\s*\))?/);
  if (!m) m = s.match(/^(\d+)\s*M\b\s*(?:\(\s*(\d+)\s*~\s*(\d+)\s*(?:회차|차월)?\s*\))?/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (m[2] && m[3]) {
    const a = parseInt(m[2], 10); const b = parseInt(m[3], 10);
    return [{ from: a, to: b, fee: Math.round(fee / 2) }];
  }
  return halfPhases(fee, n);
}

// ==================================================================
// SK매직
// ==================================================================
const CODE_LINE = /^[A-Z][A-Z0-9\-*,]*\d[A-Z0-9\-*,]*$/;

function skParse(rows, ctx) {
  const offers = []; const skipped = [];
  const h = findHeaderRow(rows, ['프로모션', '모델명', '의무', '소유권', '렌탈료']);
  if (h < 0) { skipRange(rows, 0, rows.length, '헤더없음', skipped); return { offers, skipped }; }
  skipRange(rows, 0, h + 1, '헤더/정책안내', skipped);
  const c = colMap(rows[h], { promo: '프로모션', model: '모델명', detail: '세부', oblig: '의무', own: '소유권', cycle: '점검주기', fee: '렌탈료', rebate: '수수료' });
  const textCol = c.detail + 1;

  let bText = null; let block = { code: null, name: null, program: null, programLines: [] }; let group = null;
  for (let i = h + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!nonEmpty(row)) continue;
    const r = i + 1;
    // B열 프로모션 안내는 병합셀(예: B278:B325 공기청정기 전체)이라 첫 행에만 값이 있다 → 병합 범위 전체에 적용
    const bCell = ctx.mergedValue ? ctx.mergedValue(i, c.promo) : row[c.promo];
    if (hasVal(bCell)) bText = clean(bCell);
    if (hasVal(row[c.model])) {
      const cl = lines(row[c.model]);
      group = null;
      if (cl[0] && cl[0].startsWith('[')) {
        // 프로그램 블록([ 구독 ] / [ 선결제 구독 ] 100만원 / [ 일시불 + 멤버쉽 ]) — 모델은 E열, 상품명은 B열
        block = { code: null, name: null, program: cl.join(' '), programLines: cl };
      } else {
        const codeLine = cl.find((l) => CODE_LINE.test(l.replace(/\s+/g, '')) && !HANGUL.test(l));
        const nameLines = cl.filter((l) => l !== codeLine && !/^\d/.test(l) && (HANGUL.test(l) || /^\[/.test(l)));
        block = { code: codeLine ? codeLine.replace(/\s+/g, '') : null, name: nameLines.join(' ') || codeLine || null, program: null, programLines: [] };
        if (!hasVal(bCell)) bText = null; // 다른 모델 블록으로 B열 안내가 번지지 않게 (병합 범위 밖일 때만)
      }
    }
    if (hasVal(row[c.detail])) group = clean(row[c.detail]);

    const text = clean(row[textCol]);
    const fee = toWon(row[c.fee]);
    const rebate = toWon(row[c.rebate]);
    if (fee == null && !text) { skipped.push({ row: r, reason: '빈행/안내' }); continue; }
    if (rebate == null) { skipped.push({ row: r, reason: '부가품(수수료 없음)' }); continue; }

    const modelFromE = text.split('(')[0].trim().split(/\s+/)[0] || null;
    const program = block.program || '';
    const bFirst = bText ? lines(bText)[0] : null;
    const productName = block.name || (program ? bFirst : null) || modelFromE;
    const cycleRaw = clean(row[c.cycle]);
    const cycle = toMonths(cycleRaw);
    const g = group || '';
    const careSrc = `${g} ${text}`;
    let care = null;
    if (/셀프/.test(careSrc)) care = 'self';
    else if (/무방문/.test(careSrc)) care = 'none';
    else if (/방문/.test(careSrc)) care = 'visit';
    else if (cycle) care = 'visit';
    else if (/없음/.test(cycleRaw)) care = 'none';

    let offerType = 'normal'; let phases = []; const tags = [];
    let prepay = null; let total = null; let monthly = fee; let contract = toMonths(row[c.oblig]);
    const halfM = text.match(/(\d+)\s*개월\s*반값/);
    if (/일시불/.test(program)) {
      offerType = 'purchase'; monthly = null; total = fee; contract = toMonths(g); tags.push('membership');
    } else if (/선결제/.test(program)) {
      offerType = 'prepay';
      const pm = program.match(/(\d+)\s*만\s*원/); prepay = pm ? parseInt(pm[1], 10) * 10000 : null;
      if (/타사보상/.test(g)) tags.push('trade_in');
      if (/할인/.test(g)) tags.push('discount');
    } else if (/타사보상/.test(g)) {
      offerType = 'trade_in'; if (/할인/.test(g)) tags.push('discount');
    } else if (halfM) {
      offerType = 'half'; phases = halfPhases(fee, parseInt(halfM[1], 10)); if (/할인/.test(g)) tags.push('discount');
    } else if (/특가/.test(g)) {
      offerType = 'special';
    } else if (/할인/.test(g) || /원\s*할인/.test(text)) {
      offerType = 'promo'; tags.push('discount');
    }
    // B열 안내에만 반값이 적힌 블록 (공기청정기 "의무5,6,7년 6개월 반값(1~6개월차)", WPUJCC104 "5년 6개월(1~6), 6·7년 12개월(1~12)",
    // BIDS51D "5년 6개월반값할인") — 할인 행에만 반값 구간을 붙이고, 같은 블록 일반 행은 확인필요로 남긴다
    const bHalf = offerType !== 'half' && offerType !== 'purchase' ? skHalfFromNotice(bText, toMonths(row[c.oblig])) : null;
    let extraNote = null;
    if (bHalf && offerType === 'promo') {
      offerType = 'half';
      phases = halfPhases(fee, bHalf.to - bHalf.from + 1, bHalf.from);
      tags.push(`반값${bHalf.to - bHalf.from + 1}개월`);
    } else if (bHalf && offerType === 'normal') {
      extraNote = '확인필요: B열 반값 안내가 일반 행에도 적용되는지';
    }

    offers.push(makeOffer({
      supplier: 'SK매직', brand: 'SK매직', category_raw: null,
      product_name: productName, model_code: block.code || modelFromE, variant_code: block.code ? text : `${productName} | ${text}`,
      contract_months: contract, obligation_months: offerType === 'purchase' ? null : toMonths(row[c.oblig]),
      ownership_months: offerType === 'purchase' ? null : toMonths(row[c.own]),
      care_type: care, care_label: [g, cycleRaw].filter(Boolean).join(' / '), cycle_months: cycle,
      offer_type: offerType, offer_tags: tags, offer_label: [program, g].filter(Boolean).join(' / '),
      monthly_fee: monthly, price_phases: phases, prepay_amount: prepay, total_fee: total,
      rebate, rebate_basis: 'amount', rebate_detail: { total: row[c.rebate] },
      notes: [bText ? `프로모션안내: ${bText}` : null, extraNote].filter(Boolean).join(' / ') || null,
      source: { sheet: ctx.sheetName, row: r },
    }));
  }
  return { offers, skipped };
}

/** SK매직 B열 안내 문구 → 이 의무기간의 반값 구간 { from, to } */
export function skHalfFromNotice(text, obligationMonths) {
  if (!text || !obligationMonths || !/반값|\(\s*\d+\s*~\s*\d+\s*\)/.test(text)) return null;
  const years = obligationMonths / 12;
  const t = String(text).replace(/\s+/g, ' ');
  // "5년 6개월(1~6), 6,7년 12개월(1~12)" / "의무5,6,7년 6개월 반값(1~6개월차)" / "5년 6개월반값할인"
  const re = /(?:의무\s*)?((?:\d\s*[,·/]\s*)*\d)\s*년\s*(?:의무)?\s*(\d+)\s*개월\s*(?:반값)?\s*(?:할인)?\s*(?:\(\s*(\d+)\s*~\s*(\d+)\s*(?:개월차|회차|차월)?\s*\))?/g;
  for (const m of t.matchAll(re)) {
    const ys = m[1].split(/[,·/]/).map((v) => parseInt(v, 10));
    if (!ys.includes(years)) continue;
    const n = parseInt(m[2], 10);
    const from = m[3] ? parseInt(m[3], 10) : 1;
    const to = m[4] ? parseInt(m[4], 10) : from + n - 1;
    if (!/반값/.test(t) && !m[3]) continue;   // 반값 표기도 회차 표기도 없으면 반값으로 보지 않는다
    return { from, to };
  }
  return null;
}

// ==================================================================
// 웰스
// ==================================================================
function wellsCare(raw) {
  const s = clean(raw);
  if (!s) return { care: null, cycle: null };
  if (/해당없음/.test(s)) return { care: 'none', cycle: null };
  const firstNum = (s.match(/(\d+)\s*개월/) || [])[1];
  if (/모종발송/.test(s)) return { care: 'delivery', cycle: firstNum ? +firstNum : null };
  const vm = s.match(/(\d+)\s*개월\s*(방문관리|방문|관리)(?!없음)/);
  if (vm) return { care: 'visit', cycle: +vm[1] };
  if (/관리/.test(s) && !/관리없음/.test(s)) {
    const nums = [...s.matchAll(/(\d+)\s*개월/g)].map((m) => +m[1]);
    return { care: 'visit', cycle: nums.length ? nums[nums.length - 1] : null };
  }
  if (/(필터발송|택배|필터배송|셀프)/.test(s)) return { care: 'self', cycle: firstNum ? +firstNum : null };
  return { care: null, cycle: null };
}

/**
 * 웰스 프로모션 문장 → phases. 해석 못 한 절은 unparsed 로 돌려준다.
 * 절 예: "5년약정 6개월관리,12개월관리시 3개월 면제 ( 13,25,37회차)", "6년약정 12개월 반값 (1~12회차)"
 */
function wellsPromo(text, o) {
  const applied = []; const unparsed = [];
  const clauses = String(text || '').split(/\n/).map(clean).filter(Boolean);
  for (const clause0 of clauses) {
    let cl = clause0;
    let effect = null;
    let m = cl.match(/(\d+)\s*개월\s*반값\s*(?:할인)?\s*(?:\(\s*(\d+)\s*(?:차월|회차|개월)?\s*~\s*(\d+)\s*(?:회차|차월|개월)?\s*(?:반값)?\s*\))?/);
    if (m) {
      const a = m[2] ? +m[2] : 1; const b = m[3] ? +m[3] : +m[1];
      effect = { type: 'half', from: a, to: b };
      cl = cl.replace(m[0], ' ');
    } else if (/면제/.test(cl)) {
      let months = null;
      const pm = cl.match(/\(\s*([\d\s,]+)\s*(?:회차|차월)?\s*\)/);
      if (pm) months = pm[1].split(',').map((x) => +x.trim()).filter(Boolean);
      const lm = cl.match(/렌탈료\s*([\d\s,]+)\s*개월\s*면제/);
      if (!months && lm) months = lm[1].split(',').map((x) => +x.trim()).filter(Boolean);
      if (months && months.length) {
        effect = { type: 'exempt', months };
        cl = cl.replace(pm ? pm[0] : lm[0], ' ');
        cl = cl.replace(/(렌탈료\s*)?\d+\s*개월\s*(렌탈료\s*)?면제/, ' ').replace(/렌탈료\s*면제|면제/, ' ');
      }
    }
    if (!effect) { unparsed.push(clause0); continue; }

    const ym = cl.match(/((?:\d\s*년\s*[\/,]?\s*)+)\s*약정\s*:?/);
    if (!ym) { unparsed.push(clause0); continue; }
    const years = [...ym[1].matchAll(/(\d)\s*년/g)].map((x) => +x[1]);
    cl = cl.replace(ym[0], ' ');

    // 조건: 타사보상 여부는 AND, 관리방식 목록은 OR ("셀프관리, 12개월방문" = 셀프 또는 12개월 방문)
    const cond = { care: [] };
    if (/타사보상\s*은?\s*제외/.test(cl)) { cond.notTradeIn = true; cl = cl.replace(/\(?\s*타사보상\s*은?\s*제외\s*\)?/, ' '); }
    if (/타사보상\s*시?/.test(cl)) { cond.tradeIn = true; cl = cl.replace(/타사보상\s*시?/, ' '); }
    cl = cl.replace(/\(?\s*모든\s*관리\s*주기\s*포함\s*\)?/, () => { cond.all = true; return ' '; });
    cl = cl.replace(/((?:\d+\s*개월\s*[,，]\s*)*\d+\s*개월)\s*(필터발송|택배발송|택배)/g, (_, nums) => {
      for (const n of nums.match(/\d+/g)) cond.care.push({ type: 'self', cycle: +n });
      return ' ';
    });
    cl = cl.replace(/((?:\d+\s*개월\s*(?:관리)?\s*[,，]\s*)*\d+\s*개월)\s*(방문관리|관리|방문)/g, (_, nums) => {
      for (const n of nums.match(/\d+/g)) cond.care.push({ type: 'visit', cycle: +n });
      return ' ';
    });
    cl = cl.replace(/셀프\s*관리/g, () => { cond.care.push({ type: 'self' }); return ' '; });
    cl = cl.replace(/방문\s*관리/g, () => { cond.care.push({ type: 'visit' }); return ' '; });
    const residual = cl.replace(/[\s,_()·\-~.:，]+/g, '').replace(/시|만/g, '');
    if (HANGUL.test(residual)) { unparsed.push(clause0); continue; }

    if (!o.obligation_months || !years.includes(o.obligation_months / 12)) continue;
    if (cond.tradeIn && o.offer_type !== 'trade_in') continue;
    if (cond.notTradeIn && o.offer_type === 'trade_in') continue;
    if (cond.care.length && !cond.care.some((k) => k.type === o.care_type && (k.cycle == null || k.cycle === o.cycle_months))) continue;

    const specificity = (cond.care.length ? 2 : 0) + (cond.tradeIn || cond.notTradeIn ? 1 : 0);
    const ph = effect.type === 'half'
      ? [{ from: effect.from, to: effect.to, fee: Math.round(o.monthly_fee / 2) }]
      : effect.months.map((mo) => ({ from: mo, to: mo, fee: 0 }));
    applied.push({ specificity, ph });
  }
  // 겹치는 구간은 조건이 더 구체적인 절이 이긴다 (예: "6년약정 6개월관리만 12개월반값" > "5년/6년약정 8개월반값")
  applied.sort((a, b) => b.specificity - a.specificity);
  const phases = [];
  for (const a of applied) {
    for (const p of a.ph) {
      if (phases.some((q) => p.from <= q.to && q.from <= p.to)) continue;
      phases.push(p);
    }
  }
  phases.sort((a, b) => a.from - b.from);
  return { phases, unparsed };
}

function wellsParse(rows, ctx) {
  const offers = []; const skipped = [];
  const h = findHeaderRow(rows, ['제품군', '프로모션', '상품명', '모델명', '의무', '렌탈료']);
  if (h < 0) { skipRange(rows, 0, rows.length, '헤더없음', skipped); return { offers, skipped }; }
  skipRange(rows, 0, h + 1, '헤더/정책안내', skipped);
  const c = colMap(rows[h], { cat: '제품군', promo: '프로모션', name: '상품명', model: '모델명', oblig: '의무', own: '소유권', cycle: '점검주기', fee: '렌탈료', rebate: '수수료' });
  const gubunCol = c.model + 1;
  let promoUnparsed = 0;
  for (let i = h + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!nonEmpty(row)) continue;
    const r = i + 1;
    const fee = toWon(row[c.fee]); const rebate = toWon(row[c.rebate]);
    if (!hasVal(row[c.model]) || rebate == null) { skipped.push({ row: r, reason: '모델/수수료 없음' }); continue; }
    const gubun = clean(row[gubunCol]);
    const obligRaw = clean(row[c.oblig]);
    const oblig = toMonths(obligRaw);
    const { care, cycle } = wellsCare(row[c.cycle]);
    let offerType = 'normal';
    if (/타사보상/.test(gubun)) offerType = 'trade_in';
    else if (/결합/.test(gubun)) offerType = 'bundle';
    else if (/일시불/.test(gubun)) offerType = 'purchase';
    else if (/프로모션|무이자|매트리스/.test(gubun)) offerType = 'promo';
    const label = [gubun, oblig == null && obligRaw ? obligRaw : null].filter(Boolean).join(' ');
    const o = makeOffer({
      supplier: '웰스', brand: '교원웰스', category_raw: row[c.cat],
      product_name: row[c.name], model_code: row[c.model], variant_code: [clean(row[c.model]), clean(row[c.cycle])].filter(Boolean).join(' / '),
      contract_months: offerType === 'purchase' ? null : oblig, obligation_months: oblig, ownership_months: toMonths(row[c.own]),
      care_type: care, care_label: row[c.cycle], cycle_months: cycle,
      offer_type: offerType, offer_label: label,
      monthly_fee: offerType === 'purchase' ? null : fee,
      rebate, rebate_basis: 'amount', rebate_detail: { total: row[c.rebate] },
      source: { sheet: ctx.sheetName, row: r },
    });
    if (offerType === 'purchase') o.notes = '일시불가 미기재(시트 렌탈료 0)';
    const promoText = clean(row[c.promo]);
    if (promoText && o.monthly_fee) {
      const { phases, unparsed } = wellsPromo(row[c.promo], o);
      o.price_phases = phases;
      const notes = [`프로모션원문: ${promoText}`];
      if (unparsed.length) { notes.push(`해석보류: ${unparsed.join(' | ')}`); promoUnparsed++; }
      o.notes = notes.join(' / ');
    }
    offers.push(o);
  }
  if (promoUnparsed) ctx._wellsUnparsed = promoUnparsed;
  return { offers, skipped };
}

// ==================================================================
// 루헨스
// ==================================================================
function luhensParse(rows, ctx) {
  const offers = []; const skipped = [];
  const h = findHeaderRow(rows, ['제품군', '모델명', '구분', '의무', '소유권', '렌탈료']);
  if (h < 0) { skipRange(rows, 0, rows.length, '헤더없음', skipped); return { offers, skipped }; }
  skipRange(rows, 0, h + 1, '헤더/정책안내', skipped);
  const c = colMap(rows[h], { cat: '제품군', model: '모델명', gubun: '구분', oblig: '의무', own: '소유권', cycle: '점검주기', fee: '렌탈료', rebate: '수수료', note: '비고' });
  forwardFill(rows, h + 1, [c.cat, c.model, c.cycle]);
  let baseKey = null; let base = null;
  for (let i = h + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!nonEmpty(row)) continue;
    const r = i + 1;
    const fee = toWon(row[c.fee]); const rebate = toWon(row[c.rebate]);
    if (fee == null || !hasVal(row[c.model])) { skipped.push({ row: r, reason: '빈행/안내' }); continue; }
    const g = clean(row[c.gubun]); const note = clean(row[c.note]);
    const cyc = clean(row[c.cycle]);
    const care = /자가|셀프/.test(cyc) ? 'self' : /방문/.test(cyc) ? 'visit' : null;
    const cycle = (cyc.match(/(\d+)\s*개월/) || [])[1];
    let offerType = 'normal'; let phases = []; let prepay = null; let label = g;
    const half = halfFromText(g, fee);
    const bk = `${clean(row[c.model])}|${cyc}`;
    if (bk !== baseKey) { baseKey = bk; base = null; }
    if (!/선납|반값/.test(g)) base = g;
    if (/선납/.test(g) && base && base !== '일반') label = `${base} ${g}`;
    if (/선납/.test(g)) {
      offerType = 'prepay';
      const pm = note.match(/선납금액\s*([\d,]+)/); prepay = pm ? toWon(pm[1]) : null;
    } else if (half) { offerType = 'half'; phases = half; }
    else if (/특가/.test(g)) offerType = 'special';
    else if (/균일가/.test(g)) offerType = 'promo';
    offers.push(makeOffer({
      supplier: '루헨스', brand: '루헨스', category_raw: clean(row[c.cat]).replace(/\s/g, ''),
      product_name: row[c.model], model_code: row[c.model],
      contract_months: toMonths(row[c.oblig]), obligation_months: toMonths(row[c.oblig]), ownership_months: toMonths(row[c.own]),
      care_type: care, care_label: cyc, cycle_months: cycle ? +cycle : null,
      // 선납(8%) = 전 기간 렌탈료를 8% 할인해 한 번에 내는 조건 — 월요금 칸은 정상가라 상담원이 월 납부로 오해하지 않게 표시
      offer_type: offerType, offer_label: offerType === 'prepay' ? `${label} (전 기간 일시 선납)` : label, monthly_fee: fee, price_phases: phases, prepay_amount: prepay,
      rebate, rebate_basis: 'amount', rebate_detail: { total: row[c.rebate] },
      notes: offerType === 'prepay' ? [note, '선납 후 월 납부 0원'].filter(Boolean).join(' / ') : note,
      source: { sheet: ctx.sheetName, row: r },
    }));
  }
  return { offers, skipped };
}

// ==================================================================
// 큐밍 — 기간/관리형 컬럼이 행마다 한 칸씩 밀려 있어 3~5열을 스캔한다
// ==================================================================
const PAREN_CODE = /\(\s*([A-Z][A-Z0-9\-_]*\d[A-Z0-9\-_()]*)\s*\)/;
const LEAD_CODE = /^([A-Z][A-Z0-9\-,()]*\d[A-Z0-9\-,()]*)$/;

function cumingName(raw) {
  const ls = lines(raw);
  let code = null; const rest = [];
  for (const l of ls) {
    const compact = l.replace(/\s+/g, '');
    if (!code && LEAD_CODE.test(compact) && !HANGUL.test(l)) { code = compact; continue; }
    const pm = !code && l.match(PAREN_CODE);
    if (pm) { code = pm[1]; const t = l.replace(pm[0], '').trim(); if (t) rest.push(t); continue; }
    rest.push(l);
  }
  return { code, desc: rest.join(' ') || null };
}

function cumingCare(block) {
  const v = block.variant || '';
  let care = block.care; let cycle = block.cycle;
  // "필터형(12개월 주기)" = 고객이 필터를 갈아 끼우는 자가관리, 주기는 괄호 안 개월
  if (/필터형/.test(v)) { care = 'self'; cycle = +((v.match(/(\d+)\s*개월/) || [])[1]) || cycle || null; }
  if (!care && /단독형/.test(v)) care = 'visit';
  const label = block.careLabel || (/필터형|단독형|관리형|셀프형/.test(v) ? v : null);
  return { care_type: care, care_label: label, cycle_months: cycle };
}

function cumingParse(rows, ctx) {
  const offers = []; const skipped = [];
  const h = findHeaderRow(rows, ['제품군', '프로모션', '모델명', '기간', '렌탈료']);
  if (h < 0) { skipRange(rows, 0, rows.length, '헤더없음', skipped); return { offers, skipped }; }
  skipRange(rows, 0, h + 1, '헤더/정책안내', skipped);
  const c = colMap(rows[h], { cat: '제품군', promo: '프로모션', name: '모델명', fee: '렌탈료', rebate: '수수료' });
  const scanCols = [c.name + 1, c.name + 2, c.name + 3];
  let cat = null; let block = null;
  for (let i = h + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!nonEmpty(row)) continue;
    const r = i + 1;
    if (hasVal(row[c.cat])) cat = clean(row[c.cat]);
    if (hasVal(row[c.name])) {
      const raw = String(row[c.name]);
      const { code, desc } = cumingName(raw);
      const flat = clean(raw);
      const care = /관리\s*없음/.test(flat) ? 'none' : /셀프|자가관리/.test(flat) ? 'self' : /관리형|관리/.test(flat) ? 'visit' : null;
      const cyc = (flat.match(/(\d+)\s*개월\s*(?:주기\s*)?관리/) || [])[1];
      const slurry = flat.match(/\(([^()]*포함)\s*\/\s*([^()]*미포함)\)/);
      block = { code, desc: code ? desc : null, name: code ? (desc || code) : flat, care, cycle: cyc ? +cyc : null, variant: null, careLabel: null, slurry: slurry ? [slurry[1].trim(), slurry[2].trim()] : null };
    }
    if (!block) { skipped.push({ row: r, reason: '모델 없음' }); continue; }
    let contract = null;
    for (const col of scanCols) {
      const v = row[col]; if (!hasVal(v)) continue;
      const s = clean(v);
      if (/^\d+\s*개월$/.test(s)) contract = toMonths(s);
      else if (/^관리형$/.test(s)) block.care = 'visit';
      else if (/^셀프형$/.test(s)) block.care = 'self';
      else if (/주기/.test(s) && col === c.name + 2) { block.careLabel = s; block.care = /택배/.test(s) ? 'delivery' : block.care; }
      else if (col === c.name + 1) {
        block.variant = s;
        if (/셀프형/.test(s)) block.care = 'self'; else if (/관리형/.test(s)) block.care = 'visit';
        const cm = s.match(/(\d+)\s*개월/); if (cm && /단독형/.test(s)) block.cycle = +cm[1];
      }
    }
    const feeRaw = row[c.fee]; const rebate = toWon(row[c.rebate]);
    if (!hasVal(feeRaw) && rebate == null) { skipped.push({ row: r, reason: '빈행/안내' }); continue; }
    const promo = hasVal(row[c.promo]) ? clean(row[c.promo]) : null;
    if (!contract) {
      // 약정 칸이 없는 행 — 결합가 행("결합시")·택배형 주기 상품(클린샤워 1/2/3개월)은 조건으로 살리고, 그 밖은 해석불가로 남긴다
      const rowText = row.map((v) => clean(v)).filter(Boolean).join(' ');
      const fee0 = toWon(typeof feeRaw === 'string' ? feeRaw.split('/')[0] : feeRaw);
      const bundle = /결합/.test(rowText);
      const cyc = rowText.match(/(\d+)\s*개월\s*(?:주기)?/);
      if (fee0 != null && rebate != null && (bundle || /택배|주기/.test(rowText))) {
        offers.push(makeOffer({
          supplier: '큐밍', brand: null, category_raw: cat, product_name: block.name, model_code: block.code,
          variant_code: [block.desc, block.variant, rowText.slice(0, 60)].filter(Boolean).join(' / '),
          contract_months: null, obligation_months: null,
          ...(bundle ? cumingCare(block) : { care_type: 'delivery', care_label: rowText.slice(0, 40), cycle_months: cyc ? +cyc[1] : null }),
          offer_type: bundle ? 'bundle' : 'normal', offer_tags: bundle ? ['결합시', '약정없음'] : ['약정없음'], offer_label: bundle ? '결합시' : (cyc ? `${cyc[1]}개월 주기 택배형` : promo),
          monthly_fee: fee0, rebate, rebate_basis: 'amount', rebate_detail: { total: row[c.rebate] },
          notes: '확인필요: 약정기간 미기재 행', source: { sheet: ctx.sheetName, row: r },
        }));
        continue;
      }
      skipped.push({ row: r, reason: '약정기간 미기재(해석불가)' }); continue;
    }
    const fees = typeof feeRaw === 'string' && feeRaw.includes('/') ? feeRaw.split('/').map(toWon) : [toWon(feeRaw)];
    fees.forEach((fee, k) => {
      const phases = promo ? (halfFromText(promo, fee) || []) : [];
      const extra = fees.length > 1 ? (block.slurry?.[k] || `요금${k + 1}`) : null;
      offers.push(makeOffer({
        supplier: '큐밍', brand: null, category_raw: cat,
        product_name: block.name, model_code: block.code,
        variant_code: [block.desc, block.variant, extra].filter(Boolean).join(' / '),
        contract_months: contract, obligation_months: contract,
        // K/Q/SS 같은 사이즈·등급 값은 관리방식이 아니다 → variant 로만 쓴다
        ...cumingCare(block),
        offer_type: phases.length ? 'half' : 'normal', offer_label: promo,
        monthly_fee: fee, price_phases: phases,
        rebate, rebate_basis: 'amount', rebate_detail: { total: row[c.rebate] },
        notes: promo && !phases.length ? `프로모션원문: ${promo}` : (/^\d+\s*M/i.test(promo || '') ? `확인필요: 프로모션코드 ${promo} → 반값으로 해석` : null),
        source: { sheet: ctx.sheetName, row: r },
      }));
    });
  }
  return { offers, skipped };
}

// ==================================================================
// 유버스(정수기판) — 가전 파일의 "유버스(9월)"(적용일자 헤더)는 처리하지 않는다
// ==================================================================
function ubusWaterParse(rows, ctx) {
  const offers = []; const skipped = [];
  const h = findHeaderRow(rows, ['제품군', '상품명', '모델명', '규정', '의무', '렌탈료', '총수수료']);
  if (h < 0) return { offers, skipped };
  skipRange(rows, 0, h + 1, '헤더/정책안내', skipped);
  const c = colMap(rows[h], { cat: '제품군', promo: '프로모션', name: '상품명', model: '모델명', rule: '규정', oblig: '의무', own: '소유권', care: '주기', fee: '렌탈료', rebate: '총수수료', svc: '케어서비스', note: '비고' });
  let cat = null; let name = null; let promo = null; let rule = null;
  for (let i = h + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!nonEmpty(row)) continue;
    const r = i + 1;
    if (hasVal(row[c.cat])) cat = clean(row[c.cat]);
    if (hasVal(row[c.name])) { name = clean(row[c.name]); promo = null; rule = null; }
    if (hasVal(row[c.promo])) promo = clean(row[c.promo]);
    if (hasVal(row[c.rule])) rule = clean(row[c.rule]);
    const fee = toWon(row[c.fee]); const rebate = toWon(row[c.rebate]);
    if (fee == null && rebate == null) { skipped.push({ row: r, reason: '빈행/안내' }); continue; }
    const obligRaw = clean(row[c.oblig]);
    const careRaw = clean(row[c.care]);
    const isPurchase = /구매/.test(rule || '') || /구매/.test(obligRaw);
    if (!isPurchase && !toMonths(obligRaw)) { skipped.push({ row: r, reason: `약정기간 미기재(${obligRaw || '-'})` }); continue; }
    const svc = clean(row[c.svc]);
    const care = /자가|셀프/.test(careRaw) ? 'self' : /방문/.test(careRaw) ? 'visit' : (careRaw === '' || !hasVal(row[c.care])) ? 'none' : null;
    // "셀프케어(12개월택배)" 처럼 주기 칸 안에 개월이 있으면 그 값
    const cyc = (careRaw.match(/(\d+)\s*개월/) || `${name || ''} ${rule || ''}`.match(/(\d+)\s*개월\s*택배/) || String(rule || '').match(/(\d+)\s*개월\s*방문/) || svc.match(/^(\d+)\s*개월/) || svc.match(/(\d+)\s*개월\s*(?:마다|주기)/) || [])[1];
    let offerType = 'normal'; let phases = []; const tags = [];
    const half = promo ? halfFromText(promo, fee) : null;
    if (isPurchase) offerType = 'purchase';
    else if (half) { offerType = 'half'; phases = half; if (/할인/.test(rule || '')) tags.push('discount'); }
    else if (/할인/.test(rule || '')) offerType = 'promo';
    const model = hasVal(row[c.model]) ? clean(row[c.model]) : null;
    offers.push(makeOffer({
      supplier: '유버스', brand: null, category_raw: cat,
      product_name: name, model_code: model, variant_code: name,
      contract_months: isPurchase ? null : toMonths(obligRaw), obligation_months: isPurchase ? null : toMonths(obligRaw),
      ownership_months: isPurchase ? null : toMonths(row[c.own]),
      care_type: isPurchase ? null : care, care_label: [careRaw, svc].filter(Boolean).join(' / '), cycle_months: isPurchase ? null : (cyc ? +cyc : null),
      offer_type: offerType, offer_tags: tags, offer_label: rule,
      monthly_fee: isPurchase ? null : fee, total_fee: isPurchase ? fee : null, price_phases: phases,
      rebate, rebate_basis: 'amount', rebate_detail: { total: row[c.rebate] },
      notes: [promo && !half ? `프로모션원문: ${promo}` : null, clean(row[c.note]) || null].filter(Boolean).join(' / '),
      source: { sheet: ctx.sheetName, row: r },
    }));
  }
  return { offers, skipped };
}

// ==================================================================
// LG구독(정수기) — 약정 블록 × 단품/신규결합/기존결합 가로형
// ==================================================================
// LG구독 정수기 9월 프로모션 — 시트에 붙은 이미지(전사판촉·전용판촉) + 시트 R5~R7 노트
//   ① 반값(전사판촉): 반값 가능 모델은 '적용 수수료' 칸이 반값 차감 후 수수료다 → 이 모델들의 조건은 반값 조건으로 만든다
//   ② 타사보상(전용판촉, 1년차 1~12회차 월 할인, 6·5년 약정만, 수동심사)
//   ③ 전용 모델 할인(1년차): WU523AS 월 1만원 / 상하좌우 자가관리 12개월 반값(1~12회차)
//   반값 금액은 시트 관례대로 100원 단위 반올림 (36,900 → 18,500)
const LG_WATER_HALF = [
  { re: /^WD722/, months: (m) => (m >= 60 ? 12 : 6), from: 2 },
  { re: /^WD72[34]/, months: () => 12, from: 2 },
  { re: /^WU[89]23|^WD524|^WD[35]23/, months: () => 6, from: 2 },
  { re: /^WD520MC/, months: () => 6, from: 2 },
  { re: /^WD[35]25/, months: () => 12, from: 1, selfOnly: true },
];
const LG_WATER_TRADE_IN = [
  { re: /^WD72[234]/, won: 20000 },
  { re: /^WU[89]23|^WU523|^WD524|^WD[35]23|^WD520VCT|^WS51/, won: 10000 },
  { re: /^WD520MC/, won: 5000 },
];
const LG_WATER_EXCLUSIVE = [{ re: /^WU523AS/, won: 10000 }];
const round100 = (v) => Math.round(v / 100) * 100;

function lgWaterParse(rows, ctx) {
  const offers = []; const skipped = [];
  let header = null; let sub = null; let blocks = []; let c = null;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!nonEmpty(row)) continue;
    const r = i + 1;
    const cells = row.map((v) => clean(v).replace(/\s/g, ''));
    if (cells.some((x) => x.includes('판매모델코드'))) {
      header = row; sub = rows[i + 1] || [];
      c = colMap(header, { cat: '제품군', line: '라인업', g1: '구분1', g2: '구분2', model: '판매모델코드', cycle: '방문주기', newRate: '신규결합할인', oldRate: '기존결합할인' });
      blocks = [];
      header.forEach((v, col) => {
        const m = clean(v).replace(/\s/g, '').match(/계약\/의무,(\d)년\/(\d)년/);
        if (!m) return;
        const subLabel = clean(sub[col]);
        blocks.push({ col, contract: +m[1] * 12, oblig: +m[2] * 12, layout: /1년차/.test(subLabel) ? 'B' : 'A' });
      });
      skipped.push({ row: r, reason: '헤더' });
      if (nonEmpty(rows[i + 1])) skipped.push({ row: r + 1, reason: '헤더' });
      i++;
      continue;
    }
    if (!header || !hasVal(row[c.model])) { skipped.push({ row: r, reason: '정책안내/약정표식' }); continue; }
    const cycRaw = clean(row[c.cycle]);
    const care = /자가/.test(cycRaw) ? 'self' : toMonths(cycRaw) ? 'visit' : null;
    const cycle = care === 'visit' ? toMonths(cycRaw) : null;
    const name = [clean(row[c.line]), clean(row[c.g1])].filter(Boolean).join(' ');
    const code = clean(row[c.model]).replace(/\s/g, '');
    const half = LG_WATER_HALF.find((h) => h.re.test(code) && (!h.selfOnly || care === 'self'));
    const exclusive = LG_WATER_EXCLUSIVE.find((x) => x.re.test(code));
    const tradeIn = LG_WATER_TRADE_IN.find((x) => x.re.test(code));
    let made = 0;
    for (const b of blocks) {
      const x = b.col;
      const variants = b.layout === 'A'
        ? [
          { tags: [], type: 'normal', fee: x, basic: x + 1, reb: x + 2 },
          { tags: ['new'], type: 'bundle', fee: x + 3, reb: x + 4 },
          { tags: ['existing'], type: 'bundle', fee: x + 5, reb: x + 6 },
        ]
        : [
          { tags: [], type: 'normal', fee1: x, basic: x + 1, reb: x + 2, fee: x + 7 },
          { tags: ['new'], type: 'bundle', fee1: x + 3, reb: x + 4, fee: x + 8 },
          { tags: ['existing'], type: 'bundle', fee1: x + 5, reb: x + 6, fee: x + 9 },
        ];
      for (const v of variants) {
        const fee = toWon(row[v.fee]);
        if (fee == null) continue;
        const fee1 = v.fee1 != null ? toWon(row[v.fee1]) : null;
        const kindLabel = v.type === 'bundle' ? (v.tags[0] === 'new' ? `신규결합(${row[c.newRate]})` : `기존결합(${row[c.oldRate]})`) : '단품';
        let phases = fee1 != null && fee1 !== fee ? [{ from: 1, to: 12, fee: fee1 }] : [];
        let type = v.type; let label = kindLabel; const notes = [];
        if (exclusive) {
          phases = [{ from: 1, to: 12, fee: Math.max(0, fee - exclusive.won) }];
          label = `${kindLabel} · 전용모델 할인 1년 월 ${exclusive.won / 10000}만원`;
        }
        if (half) {
          const n = half.months(b.contract); const to = half.from + n - 1;
          phases = [{ from: half.from, to, fee: round100(fee / 2) }];
          type = 'half';
          label = `${kindLabel} · ${n}개월 반값(${half.from}~${to}회차)`;
          notes.push('반값 가능 모델 — 수수료는 시트 "적용 수수료"(반값 차감 후)');
        }
        const common = {
          supplier: 'LG구독', brand: 'LG전자', category_raw: row[c.cat],
          product_name: name, model_code: row[c.model], variant_code: clean(row[c.g2]) || null,
          contract_months: b.contract, obligation_months: b.oblig,
          care_type: care, care_label: cycRaw, cycle_months: cycle,
          monthly_fee: fee, rebate: toWon(row[v.reb]), rebate_basis: 'amount',
          rebate_detail: { applied: row[v.reb], basic: v.basic != null ? row[v.basic] : null },
          source: { sheet: ctx.sheetName, row: r },
        };
        offers.push(makeOffer({ ...common, offer_type: type, offer_tags: v.tags, offer_label: label, price_phases: phases, notes: notes.join(' / ') || null }));
        made++;
        // ② 타사보상 — 6·5년 약정만, 1~12회차 월 할인. 반값과 겹치는지·수수료 변동은 이미지에 없다
        if (tradeIn && (b.contract === 72 || b.contract === 60)) {
          offers.push(makeOffer({
            ...common, offer_type: 'trade_in', offer_tags: [...v.tags, 'trade_in'],
            offer_label: `${kindLabel} · 타사보상 1년 월 ${tradeIn.won / 10000}만원`,
            price_phases: [{ from: 1, to: 12, fee: Math.max(0, fee - tradeIn.won) }],
            notes: '수동심사 · 확인필요: 반값과 중복 여부, 타사보상 적용 시 수수료 변동 여부',
          }));
          made++;
        }
      }
    }
    if (!made) skipped.push({ row: r, reason: '요금 없음' });
  }
  return { offers, skipped };
}

function lgRateSheetParse(rows) {
  const skipped = [];
  rows.forEach((row, i) => { if (nonEmpty(row)) skipped.push({ row: i + 1, reason: '수수료율참고' }); });
  return { offers: [], skipped };
}

export default [
  { id: 'skmagic', file: FILE, match: (n) => sheetBase(n) === 'SK매직', parse: (rows, ctx) => dedupe(skParse(rows, ctx)) },
  { id: 'wells', file: FILE, match: (n) => sheetBase(n) === '웰스', parse: (rows, ctx) => dedupe(wellsParse(rows, ctx)) },
  { id: 'luhens', file: FILE, match: (n) => sheetBase(n) === '루헨스', parse: (rows, ctx) => dedupe(luhensParse(rows, ctx)) },
  { id: 'cuming', file: FILE, match: (n) => sheetBase(n) === '큐밍', parse: (rows, ctx) => dedupe(cumingParse(rows, ctx)) },
  { id: 'ubus-water', file: FILE, match: (n) => sheetBase(n) === '유버스', parse: (rows, ctx) => dedupe(ubusWaterParse(rows, ctx)) },
  { id: 'lg-sub-water', file: FILE, match: (n) => sheetBase(n) === 'LG구독', parse: (rows, ctx) => dedupe(lgWaterParse(rows, ctx)) },
  { id: 'lg-sub-water-rate', file: FILE, match: (n) => sheetBase(n) === 'LG구독수수료율', parse: lgRateSheetParse },
];
