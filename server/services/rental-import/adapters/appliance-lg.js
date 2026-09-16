/**
 * 가전 파일 — LG전자구독(냉장고·쿠킹·TV·공청기·에어컨·리빙), LG헬로비전, KT가전구독(회선O/X·구독형(R)·BIZ형(R)).
 *
 * 리베이트: 가전은 금액이 없어 "(YYMM)렌탈사별 수수료율" 규칙(ctx.supplierRules)으로 계산한다.
 *   LG전자구독 = 총 렌탈료 × 율(일반/노트북/텀블러세척기)
 *   LG헬로비전 = 행의 수수료정책이 '정액'이면 정액수수료(최대) 컬럼 금액, '정률'이면 총 렌탈료 × 율(일반/현장)
 *   KT가전구독 = 모델코드 "(R)" 이면 건당 금액, 아니면 총 렌탈료 × 율
 *   규칙 시트를 못 읽으면 rebate=null, rebate_basis 만 채운다.
 */
import { clean, hasVal, toWon, toMonths, makeOffer, findRule, applyRule, conditionKey } from '../core.js';

const nospace = (v) => clean(v).replace(/\s/g, '');
const isStr = (v) => typeof v === 'string' && v.trim() !== '';

function ruleRebate(ctx, aliases, subtype, basisFallback, amounts) {
  const rule = findRule(ctx.supplierRules, aliases, subtype);
  if (!rule) return { rebate: null, rebate_basis: basisFallback, rebate_rate: null };
  return {
    rebate: applyRule(rule, amounts),
    rebate_basis: rule.basis,
    rebate_rate: rule.basis === 'flat' ? null : rule.value,
  };
}


/**
 * 같은 조건키가 시트 안에서 또 나오면:
 *  - 값이 같든 다르든 둘 다 보존(#n)
 */
function pushDedup(offers, seen, offer) {
  // 대표 지시: 반복행은 값이 같아도 둘 다 보존 — 순번(#n)으로 구분하고 원본 확인 표시
  const key = conditionKey(offer);
  const prev = seen.get(key);
  if (prev) {
    prev.n = (prev.n || 1) + 1;
    const same = prev.first.monthly_fee === offer.monthly_fee && prev.first.total_fee === offer.total_fee && prev.first.prepay_amount === offer.prepay_amount;
    offer.variant_code = `${offer.variant_code || ''}#${prev.n}`;
    offer.notes = [offer.notes, same ? `완전중복행(${prev.first.source.row}행과 동일) — 원본 확인 필요` : `동일조건 다른 요금(${prev.first.source.row}행) — 원본 확인 필요`].filter(Boolean).join(' / ');
  } else {
    seen.set(key, { first: offer, n: 1 });
  }
  offers.push(offer);
  return null;
}

function careFrom(raw) {
  const s = nospace(raw);
  if (!s) return { care_type: null, cycle_months: null };
  if (s === '-' || s === '0') return { care_type: 'none', cycle_months: null };  // 방문주기 칸이 '-' = 관리 없는 상품(TV 등)
  if (s.includes('자가')) return { care_type: 'self', cycle_months: null };
  const n = toMonths(s) ?? (/^\d+$/.test(s) ? parseInt(s, 10) : null);
  if (n) return { care_type: 'visit', cycle_months: n };
  return { care_type: null, cycle_months: null };
}

// ------------------------------------------------------------------
// LG전자구독 5+1 시트 (가로 펼침: 약정 × 구독료/결합 + 선납 + 9월 프로모션 최종 요금)
// ------------------------------------------------------------------
function parseLgSubscription(rows, ctx) {
  const offers = [];
  const skipped = [];
  const sheet = ctx.sheetName;

  // 1) 하위 헤더 행(구독료/구독요금이 여러 칸) 찾기
  // 리빙 시트는 선납 칸의 "구독료" 가 한 줄 위에 있어 첫 매칭 행이 아니라 최다 매칭 행을 하위 헤더로 본다
  let subRow = -1;
  let best = 1;
  for (let r = 0; r < Math.min(rows.length, 20); r++) {
    const n = (rows[r] || []).filter((v) => /구독(료|요금)$/.test(nospace(v))).length;
    if (n > best) { subRow = r; best = n; }
  }
  if (subRow < 0) {
    rows.forEach((row, i) => { if (row && row.some(hasVal)) skipped.push({ row: i + 1, reason: '헤더 인식 실패' }); });
    return { offers, skipped };
  }

  // 2) 행 속성 컬럼 (라벨 행 = 모델 라벨이 있는 상단 행)
  const topRows = rows.slice(0, subRow);
  const labelOf = (c) => topRows.map((row) => (row && isStr(row[c]) ? nospace(row[c]) : '')).join('|');
  const width = Math.max(...rows.slice(0, subRow + 1).map((row) => (row ? row.length : 0)));
  const sub = rows[subRow] || [];
  const firstFee = sub.findIndex((v) => hasVal(v));
  const cols = {};
  for (let c = 0; c < firstFee; c++) {
    const l = labelOf(c);
    const set = (k) => { if (cols[k] == null) cols[k] = c; };
    if (l.includes('전월대비')) set('change');
    else if (l.includes('채널')) set('channel');
    else if (l.includes('제품군')) set('category');
    else if (l.includes('구분1')) set('div1');
    else if (l.includes('구분2')) set('div2');
    else if (l.includes('스윙모델')) set('swing');
    else if (l.includes('모델명')) set('model');
    else if (l.includes('방문주기') || l.includes('방문/주기')) set('cycle');
    else if (l.includes('서비스/타입') || l.includes('서비스타입') || l.includes('케어십형태')) set('svc');
    else if (l.includes('멤버십') || l === '|SIM' || l.endsWith('SIM')) set('member');
    else if (l.includes('케어서비스/금액') || l.includes('케어십/요금') || l.includes('케어십요금')) set('careFee');
    else if (l.includes('비고')) set('note');
  }
  // 냉장고 시트: 채널 라벨 없이 0열에 B2C/전매/온라인
  if (cols.channel == null && !labelOf(0).replace(/\|/g, '')) cols.channel = 0;

  // 3) 요금 컬럼 서술자
  const desc = [];
  let section = 'orig';
  let months = null;
  let prepay = null;
  for (let c = firstFee; c < width; c++) {
    const texts = topRows.map((row) => (row && isStr(row[c]) ? nospace(row[c]) : '')).filter(Boolean);
    const joined = texts.join('|');
    if (/2월|이전대비|차이/.test(joined)) { section = 'ignore'; months = null; prepay = null; }
    else if (/프로모션|구독료할인/.test(joined)) { section = 'promo'; months = null; prepay = null; }
    for (const t of texts) {
      if (/선납/.test(t) && /\d+%/.test(t)) {
        prepay = parseInt((t.match(/(\d+)%/) || [])[1], 10) || null;
        months = toMonths((t.match(/(\d+)개월/) || [])[0]) || 72;
      } else if (/^\(?\d+개월\)?$/.test(t) || /^\d+개월\//.test(t)) {
        months = toMonths(t); prepay = null;
      }
    }
    const s = nospace(sub[c]) || (subRow > 0 && /^(선납금|구독(료|요금))$/.test(nospace(rows[subRow - 1]?.[c])) ? nospace(rows[subRow - 1][c]) : '');
    if (!s || section === 'ignore') continue;
    let kind = null;
    if (/^구독(료|요금)$/.test(s)) kind = 'base';
    else if (s.includes('신규결합')) kind = 'new';
    else if (s.includes('기존결합')) kind = 'existing';
    else if (s.includes('선납금')) kind = 'prepayAmount';
    else if (/할인액|추가|최종|총요금할인/.test(s)) kind = 'discount';
    if (!kind) continue;
    desc.push({ c, section, months, prepay, kind, pct: parseInt((s.match(/(\d+)%/) || [])[1], 10) || null, label: s });
  }
  const feeCols = desc.filter((d) => d.kind !== 'discount');
  const seen = new Map();

  // 4) 데이터 행
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row.some(hasVal)) continue;
    const excelRow = r + 1;
    if (r <= subRow) { skipped.push({ row: excelRow, reason: '헤더·안내' }); continue; }
    if (row.slice(firstFee).some((v) => typeof v === 'string' && /구독(료|요금)|개월|선납|결합|할인/.test(nospace(v)))) {
      skipped.push({ row: excelRow, reason: '반복 헤더' }); continue;
    }
    const pick = (k) => (cols[k] != null && hasVal(row[cols[k]]) && nospace(row[cols[k]]) !== '0' ? clean(row[cols[k]]) : null);
    const model = pick('model') || pick('swing') || pick('div1');
    const hasFee = feeCols.some((d) => typeof row[d.c] === 'number');
    if (!model || !hasFee) { skipped.push({ row: excelRow, reason: model ? '요금 없음' : '모델 없음(안내·구분행)' }); continue; }

    const channel = pick('channel');
    const svc = pick('svc');
    const change = pick('change');
    const { care_type, cycle_months } = careFrom(cols.cycle != null ? row[cols.cycle] : null);
    const category = pick('category');
    const subtype = /노트북/.test(category || '') ? '노트북' : /텀블러/.test(category || '') ? '텀블러세척기' : '일반';
    const discount = desc.filter((d) => d.kind === 'discount').reduce((m, d) => { if (hasVal(row[d.c])) m[d.label] = row[d.c]; return m; }, {});

    const combos = new Map();
    for (const d of feeCols) {
      const key = `${d.months}|${d.prepay || ''}|${d.kind === 'prepayAmount' ? 'base' : d.kind}`;
      const e = combos.get(key) || { months: d.months, prepay: d.prepay, kind: d.kind === 'prepayAmount' ? 'base' : d.kind };
      const v = row[d.c];
      if (d.kind === 'prepayAmount') e.prepayAmount = typeof v === 'number' ? Math.round(v) : null;
      else if (d.section === 'promo') e.promo = typeof v === 'number' ? Math.round(v) : null;
      else { e.orig = typeof v === 'number' ? Math.round(v) : null; e.pct = d.pct; }
      combos.set(key, e);
    }

    let made = 0;
    let dupOf = null;
    for (const e of combos.values()) {
      const fee = e.promo ?? e.orig;
      if (!fee || !e.months) continue;
      const offer_type = e.prepay ? 'prepay' : e.kind === 'base' ? 'normal' : 'bundle';
      const offer_tags = [];
      if (e.kind === 'new') offer_tags.push(`bundle:new${e.pct ? `:${e.pct}%` : ''}`);
      if (e.kind === 'existing') offer_tags.push(`bundle:existing${e.pct ? `:${e.pct}%` : ''}`);
      if (e.prepay) offer_tags.push(`prepay:${e.prepay}%`);
      const total = fee * e.months + (e.prepayAmount || 0);
      const reb = ruleRebate(ctx, ['LG전자구독'], subtype, 'rate_total', { monthly_fee: fee, contract_months: e.months, total_fee: total });
      const dup = pushDedup(offers, seen, makeOffer({
        supplier: 'LG전자구독',
        brand: 'LG전자',
        category_raw: category,
        product_name: pick('div1') || pick('div2') || model,
        model_code: model,
        variant_code: [channel, svc].filter(Boolean).join('/'),
        contract_months: e.months,
        obligation_months: e.months,
        care_type,
        care_label: cols.cycle != null ? clean(row[cols.cycle]) : null,
        cycle_months,
        offer_type,
        offer_tags,
        offer_label: e.promo != null && e.orig != null && e.promo !== e.orig ? '9월 월간 프로모션 적용' : null,
        monthly_fee: fee,
        prepay_amount: e.prepayAmount ?? null,
        total_fee: total,
        ...reb,
        rebate_detail: {
          orig_fee: e.orig ?? null,
          promo_fee: e.promo ?? null,
          ...(Object.keys(discount).length ? { promo_discount: discount } : {}),
          care_fee: cols.careFee != null ? row[cols.careFee] : null,
          membership_base_price: cols.member != null ? row[cols.member] : null,
          install_type: pick('div2'),
        },
        status: change && change.includes('단종') ? 'discontinued' : 'active',
        notes: [change, pick('note')].filter(Boolean).join(' / '),
        source: { sheet, row: excelRow },
      }));
      if (dup) dupOf = dup; else made++;
    }
    if (!made) skipped.push({ row: excelRow, reason: dupOf ? `원본 중복행(${dupOf}행과 동일)` : '전 약정 미운영' });
  }
  return { offers, skipped };
}

// ------------------------------------------------------------------
// LG헬로비전 (일반가·임직원가 × 24/36/39/48/60, 일시불가)
// ------------------------------------------------------------------
function parseLgHello(rows, ctx) {
  const offers = [];
  const skipped = [];
  const sheet = ctx.sheetName;
  let labelRow = -1;
  let termRow = -1;
  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const cells = (rows[r] || []).map(nospace);
    if (labelRow < 0 && cells.some((c) => c.includes('일반가')) && cells.some((c) => c.includes('모델코드'))) labelRow = r;
    if (cells.some((c) => c === '24개월') && cells.some((c) => c === '경로')) termRow = r;
  }
  if (labelRow < 0 || termRow < 0) {
    rows.forEach((row, i) => { if (row && row.some(hasVal)) skipped.push({ row: i + 1, reason: '헤더 인식 실패' }); });
    return { offers, skipped };
  }
  const lab = (rows[labelRow] || []).map(nospace);
  const term = (rows[termRow] || []).map(nospace);
  const find = (arr, pred) => arr.findIndex(pred);
  const col = {
    div: find(lab, (c) => c === '구분'),
    detail: find(lab, (c) => c === '상세'),
    free: find(lab, (c) => c.includes('무료개월')),
    path: find(term, (c) => c === '경로'),
    item: find(lab, (c) => c.includes('품목종류')),
    brand: find(lab, (c) => c === '브랜드'),
    model: find(lab, (c) => c === '모델코드'),
    name: find(lab, (c) => c === '모델명'),
    spec: find(lab, (c) => c === '규격'),
    color: find(lab, (c) => c === '색상'),
    vendor: find(lab, (c) => c === '공급사'),
    lump: find(lab, (c) => c.includes('일시불가')),
    policy: find(lab, (c) => c.includes('수수료정책')),
    flat: find(lab, (c) => c.includes('정액수수료')),
    online: find(lab, (c) => c.includes('온라인')),
    note: find(lab, (c) => c === '비고'),
    vendorPromo: find(lab, (c) => c.includes('공급사프로모션')),
  };
  const general = find(lab, (c) => c.includes('일반가'));
  const staff = find(lab, (c) => c.includes('임직원가'));
  const groups = [
    { type: 'general', from: general, to: col.lump },
    { type: 'staff', from: staff, to: col.policy },
  ];
  const seen = new Map();
  const termCols = (g) => {
    const out = [];
    for (let c = g.from; c < g.to; c++) { const m = /^(\d+)개월$/.exec(term[c]); if (m) out.push({ months: +m[1], monthly: c, total: c + 1 }); }
    return out;
  };

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row.some(hasVal)) continue;
    const excelRow = r + 1;
    if (r <= termRow) { skipped.push({ row: excelRow, reason: '헤더' }); continue; }
    const model = hasVal(row[col.model]) ? clean(row[col.model]) : null;
    if (!model) { skipped.push({ row: excelRow, reason: '모델코드 없음' }); continue; }
    const path = clean(row[col.path]);
    const policy = clean(row[col.policy]);
    const flatMax = toWon(row[col.flat]);
    const div = clean(row[col.div]);
    const status = /단종/.test(div) ? 'discontinued' : /판매중단/.test(div) ? 'paused' : 'active';
    const subtype = path.includes('현장') ? '현장' : '일반';
    const rebateFor = (amounts) => {
      if (policy === '정액') return { rebate: flatMax, rebate_basis: 'flat', rebate_rate: null };
      return ruleRebate(ctx, ['LG헬로비젼', 'LG헬로비전'], subtype, 'rate_total', amounts);
    };
    const base = {
      supplier: 'LG헬로비전',
      brand: clean(row[col.brand]) || null,
      category_raw: clean(row[col.item]) || null,
      product_name: clean(row[col.name]) || model,
      model_code: model,
      // 헬로 모델코드는 ND_A0610FG 처럼 '_' 가 코드 일부 → core.modelKey('_' 이후 절단)를 쓰면 다른 모델이 합쳐진다
      model_key: model.replace(/\s+/g, '').toUpperCase(),
      variant_code: path || null,
      status,
      notes: [div, clean(row[col.detail]), clean(row[col.note])].filter(Boolean).join(' / '),
      source: { sheet, row: excelRow },
    };
    const detail = {
      fee_policy: policy || null,
      flat_fee_max: flatMax,
      free_months: hasVal(row[col.free]) ? row[col.free] : null,
      path: path || null,
      online_exposure: clean(row[col.online]) || null,
      vendor: clean(row[col.vendor]) || null,
      vendor_promo: clean(row[col.vendorPromo]) || null,
      spec: clean(row[col.spec]) || null,
      color: clean(row[col.color]) || null,
    };
    let made = 0;
    let dupOf = null;
    const put = (o) => { const d = pushDedup(offers, seen, makeOffer(o)); if (d) dupOf = d; else made++; };
    for (const g of groups) {
      for (const t of termCols(g)) {
        const monthly = toWon(row[t.monthly]);
        if (!monthly) continue;
        const total = toWon(row[t.total]) ?? monthly * t.months;
        const offer_type = g.type === 'staff' ? 'staff' : path.includes('현장') ? 'field' : path.includes('콜특가') ? 'special' : 'normal';
        put({
          ...base,
          contract_months: t.months,
          obligation_months: t.months,
          offer_type,
          monthly_fee: monthly,
          total_fee: total,
          ...rebateFor({ monthly_fee: monthly, contract_months: t.months, total_fee: total }),
          rebate_detail: detail,
        });
      }
    }
    const lump = toWon(row[col.lump]);
    if (lump) {
      put({ ...base, offer_type: 'purchase', total_fee: lump, ...rebateFor({ monthly_fee: null, contract_months: null, total_fee: lump }), rebate_detail: detail });
    }
    if (!made) skipped.push({ row: excelRow, reason: dupOf ? `원본 중복행(${dupOf}행과 동일)` : '가격 없음' });
  }
  return { offers, skipped };
}

// ------------------------------------------------------------------
// KT 가전구독 — 회선O/X (즉납 + 36/48/60 총납부·월납입)
// ------------------------------------------------------------------
function ktRebate(ctx, model, amounts) {
  const isR = /\(R\)/i.test(model || '');
  if (isR) return ruleRebate(ctx, ['KT가전구독'], 'R', 'flat', amounts);
  return ruleRebate(ctx, ['KT가전구독'], '일반', 'rate_total', amounts);
}

function parseKtLine(rows, ctx) {
  const offers = [];
  const skipped = [];
  const sheet = ctx.sheetName;
  const line = /회선\s*O/i.test(sheet) ? 'line:O' : 'line:X';
  let labelRow = -1;
  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    if ((rows[r] || []).some((v) => nospace(v) === '모델코드')) { labelRow = r; break; }
  }
  const lab = (rows[labelRow] || []).map(nospace);
  const termRow = rows[labelRow + 1] || [];
  const subRow = rows[labelRow + 2] || [];
  const col = { name: lab.findIndex((c) => c === '상품명'), note: lab.findIndex((c) => c.includes('비고')), install: lab.findIndex((c) => c === '설치비'), model: lab.findIndex((c) => c === '모델코드') };
  const lumpCol = termRow.findIndex((v) => nospace(v) === '즉납');
  const terms = [];
  termRow.forEach((v, c) => {
    const m = toMonths(v);
    if (m && nospace(v) !== '즉납') {
      const totalC = [c, c + 1].find((x) => nospace(subRow[x]).includes('총납부'));
      const monthC = [c, c + 1].find((x) => nospace(subRow[x]).includes('월납입'));
      terms.push({ months: m, totalC, monthC });
    }
  });

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row.some(hasVal)) continue;
    const excelRow = r + 1;
    if (labelRow < 0 || r <= labelRow + 2) { skipped.push({ row: excelRow, reason: '헤더' }); continue; }
    const model = hasVal(row[col.model]) ? clean(row[col.model]) : null;
    if (!model) { skipped.push({ row: excelRow, reason: '모델코드 없음' }); continue; }
    const base = {
      supplier: 'KT가전구독',
      product_name: clean(row[col.name]) || model,
      model_code: model,
      offer_tags: [line],
      notes: [clean(row[col.note]), clean(row[col.install])].filter(Boolean).join(' / '),
      source: { sheet, row: excelRow },
    };
    const detail = { color: clean(row[col.note]) || null, install: clean(row[col.install]) || null, lump_price: toWon(row[lumpCol]) };
    let made = 0;
    for (const t of terms) {
      const monthly = toWon(row[t.monthC]);
      if (!monthly) continue;
      const total = toWon(row[t.totalC]) ?? monthly * t.months;
      offers.push(makeOffer({ ...base, contract_months: t.months, obligation_months: t.months, offer_type: 'normal', monthly_fee: monthly, total_fee: total, ...ktRebate(ctx, model, { monthly_fee: monthly, contract_months: t.months, total_fee: total }), rebate_detail: detail }));
      made++;
    }
    const lump = toWon(row[lumpCol]);
    if (lump) {
      offers.push(makeOffer({ ...base, offer_type: 'purchase', total_fee: lump, ...ktRebate(ctx, model, { monthly_fee: null, contract_months: null, total_fee: lump }), rebate_detail: detail }));
      made++;
    }
    if (!made) skipped.push({ row: excelRow, reason: '가격 없음' });
  }
  return { offers, skipped };
}

// ------------------------------------------------------------------
// KT 가전구독 구독형(R) / BIZ형(R) — 즉납 구매가 + 할부 "총액\n(월)" 문자열
// ------------------------------------------------------------------
function splitTotalMonthly(v) {
  const s = clean(v);
  if (!s || /미운영/.test(s)) return null;
  const m = s.match(/^([\d,]+)\s*\/?\s*\(([\d,]+)\)/) || String(v).match(/([\d,]+)\s*\n?\s*\(([\d,]+)\)/);
  if (!m) return null;
  return { total: toWon(m[1]), monthly: toWon(m[2]) };
}

function parseKtSubscribe(rows, ctx) {
  const offers = [];
  const skipped = [];
  const sheet = ctx.sheetName;
  const tag = /BIZ/i.test(sheet) ? 'kt:biz' : 'kt:subscribe';
  let labelRow = -1;
  for (let r = 0; r < Math.min(rows.length, 20); r++) {
    if ((rows[r] || []).some((v) => nospace(v).startsWith('모델코드'))) { labelRow = r; break; }
  }
  const lab = (rows[labelRow] || []).map(nospace);
  const col = {
    maker: lab.findIndex((c) => c === '제조사'),
    name: lab.findIndex((c) => c === '모델명'),
    model: lab.findIndex((c) => c.startsWith('모델코드')),
    msrp: lab.findIndex((c) => c === '출고가'),
    extra: lab.findIndex((c, i) => i > 4 && (c.includes('설치비') || c.includes('환급'))),
    policy: lab.findIndex((c) => c.includes('정책')),
    note: lab.findIndex((c) => c === '비고'),
    lump: lab.findIndex((c) => c === '즉납'),
  };
  const terms = [];
  lab.forEach((c, i) => { const m = /할부(\d+)개월/.exec(c); if (m) terms.push({ months: +m[1], c: i }); });

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row.some(hasVal)) continue;
    const excelRow = r + 1;
    if (labelRow < 0 || r <= labelRow + 1) { skipped.push({ row: excelRow, reason: '헤더·안내' }); continue; }
    const model = hasVal(row[col.model]) ? clean(row[col.model]) : null;
    if (!model) { skipped.push({ row: excelRow, reason: '카테고리 구분행' }); continue; }
    const base = {
      supplier: 'KT가전구독',
      brand: clean(row[col.maker]) || null,
      product_name: clean(row[col.name]) || model,
      model_code: model,
      offer_tags: [tag],
      notes: clean(row[col.note]),
      source: { sheet, row: excelRow },
    };
    const detail = {
      policy_zbc14: clean(row[col.policy]) || null,
      msrp: toWon(row[col.msrp]),
      [tag === 'kt:biz' ? 'smb_refund' : 'wall_install_fee']: clean(row[col.extra]) || null,
    };
    let made = 0;
    for (const t of terms) {
      const p = splitTotalMonthly(row[t.c]);
      if (!p || !p.monthly) continue;
      const calc = p.total ? Math.round(p.total / t.months) : null;
      const note = calc && Math.abs(calc - p.monthly) > 100 ? `월할부금 표기(${clean(row[t.c])}) ≠ 총액/개월(${calc})` : null;
      offers.push(makeOffer({
        ...base,
        contract_months: t.months,
        obligation_months: t.months,
        offer_type: 'normal',
        monthly_fee: note ? calc : p.monthly,
        total_fee: p.total,
        ...ktRebate(ctx, model, { monthly_fee: p.monthly, contract_months: t.months, total_fee: p.total }),
        rebate_detail: { ...detail, ...(note ? { raw_installment: clean(row[t.c]) } : {}) },
        notes: [base.notes, note].filter(Boolean).join(' / '),
      }));
      made++;
    }
    const lump = toWon(row[col.lump]);
    if (lump) {
      offers.push(makeOffer({ ...base, offer_type: 'purchase', total_fee: lump, ...ktRebate(ctx, model, { monthly_fee: null, contract_months: null, total_fee: lump }), rebate_detail: detail }));
      made++;
    }
    if (!made) skipped.push({ row: excelRow, reason: '전 약정 미운영' });
  }
  return { offers, skipped };
}

const base = (n) => clean(n).replace(/\(\s*\d{1,2}월\s*\)/g, '').replace(/\s/g, '');

export default [
  { id: 'lg-subscription', file: 'appliance', match: (n) => /^LG구독(냉장고|쿠킹|TV|공청기|에어컨|리빙)$/.test(base(n)), parse: parseLgSubscription },
  { id: 'lg-hello', file: 'appliance', match: (n) => /^LG헬로/.test(base(n)), parse: parseLgHello },
  { id: 'kt-line', file: 'appliance', match: (n) => /^KT회선[OX]$/i.test(base(n)), parse: parseKtLine },
  { id: 'kt-subscribe', file: 'appliance', match: (n) => /^KT구독(BIZ)?형\(R\)$/i.test(base(n)), parse: parseKtSubscribe },
];
