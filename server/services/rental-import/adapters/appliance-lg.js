/**
 * 가전 파일 — LG전자구독(냉장고·쿠킹·TV·공청기·에어컨·리빙), LG헬로비전, KT가전구독(회선O/X·구독형(R)·BIZ형(R)).
 *
 * 리베이트: 가전은 금액이 없어 "(YYMM)렌탈사별 수수료율" 규칙(ctx.supplierRules)으로 계산한다.
 *   LG전자구독 = 총 렌탈료 × 율(일반/노트북/텀블러세척기)
 *   LG헬로비전 = 행의 수수료정책이 '정액'이면 정액수수료(최대) 컬럼 금액, '정률'이면 총 렌탈료 × 율(일반/현장)
 *   KT가전구독 = 모델코드 "(R)" 이면 건당 금액, 아니면 총 렌탈료 × 율
 *   규칙 시트를 못 읽으면 rebate=null, rebate_basis 만 채운다.
 */
import { clean, hasVal, toWon, toMonths, makeOffer, findRule, applyRule, conditionKey, isCodeName } from '../core.js';

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
    else if (l.includes('멤버십') || l.split('|').includes('SIM')) set('member');
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
    // 비고·전월대비(A·B열)는 병합셀("단종예정…", "종합몰/쿠팡", "공급은 9월15일이후…")이라 병합 범위 값을 읽는다
    const merged = (k) => {
      if (cols[k] == null) return null;
      const v = ctx.mergedValue ? ctx.mergedValue(r, cols[k]) : row[cols[k]];
      return hasVal(v) && nospace(v) !== '0' ? clean(v) : null;
    };
    const change = merged('change');
    const note = merged('note');
    let { care_type, cycle_months } = careFrom(cols.cycle != null ? row[cols.cycle] : null);
    // 케어십형태 "베이직(자가)"·"자가관리"·"자가" 가 방문주기 숫자보다 우선 (주기 = 소모품 교체 주기)
    if (/자가/.test(svc || '')) care_type = 'self';
    // TV 는 방문주기·서비스타입이 비어 있어도 관리 없는 상품 ('-' 인 다른 TV 와 같게)
    if (!care_type && /TV/i.test(sheet)) care_type = 'none';
    const category = pick('category');
    const flags = { tags: [], notes: [], status: null };
    if (/미운영/.test(change || '') || /전매미운영/.test(channel || '')) { flags.status = 'paused'; flags.notes.push('미운영'); }
    if (/출시예정/.test(change || '')) { flags.status = 'paused'; flags.notes.push(change); }
    if (/단종예정/.test(`${change || ''} ${note || ''}`)) { flags.tags.push('단종예정'); }
    if (/전매전용/.test(channel || '')) { flags.tags.push('전매전용'); flags.notes.push('전매 채널 전용'); }
    // 리빙 G1 범례 "집중모델(추가수수료)" — 분홍 칠 모델. 추가수수료 금액은 시트·수수료율표·이미지 어디에도 없다
    if (/^(FH24ENE|W2320WANR|SC3GTE52)/.test(model)) { flags.tags.push('집중모델'); flags.notes.push('확인필요: 집중모델 추가수수료 금액 미기재'); }
    const swing = pick('swing');
    if (swing && swing !== model) flags.notes.push(`우선판매 스윙모델: ${swing}`);
    // 리빙 "★ 6년계약한정 12개월 반값할인(2~13개월차 / 49.5천원 할인)" — 적힌 약정·회차·할인액 그대로
    const halfNote = (note || '').match(/(\d)\s*년\s*계약\s*한정\s*(\d+)\s*개월\s*반값\s*할인\s*\(\s*(\d+)\s*~\s*(\d+)\s*개월차\s*\/?\s*([\d.]+)\s*천원/);
    // 리빙 "~9월14일까지 3천원할인, 9/15~2천원할인" — 오늘(9/17) 기준 뒤 금액
    const stepNote = (note || '').match(/(\d+)\s*천원\s*할인\s*,\s*9\/15~\s*(\d+)\s*천원\s*할인/);
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
    const baseFee = (m) => [...combos.values()].find((x) => x.months === m && x.kind === 'base' && !x.prepay);
    for (const e of combos.values()) {
      let fee = e.promo ?? e.orig;
      if (!fee || !e.months) continue;
      const stepped = stepNote && e.promo != null && e.orig != null && e.orig - e.promo === +stepNote[1] * 1000;
      if (stepped) fee = e.orig - +stepNote[2] * 1000;
      const offer_type = e.prepay ? 'prepay' : e.kind === 'base' ? 'normal' : 'bundle';
      // TV "결합할인 선반영 / 구독료에 선반영" — 결합 칸이 기본 구독료와 같다 → 추가 % 할인이 있는 것처럼 보이지 않게
      const b0 = baseFee(e.months);
      const preApplied = e.kind !== 'base' && b0 && (b0.promo ?? b0.orig) === fee && /선반영/.test(`${note || ''} ${change || ''}`);
      const offer_tags = [...flags.tags];
      if (e.kind === 'new') offer_tags.push(preApplied ? 'bundle:new:선반영' : `bundle:new${e.pct ? `:${e.pct}%` : ''}`);
      if (e.kind === 'existing') offer_tags.push(preApplied ? 'bundle:existing:선반영' : `bundle:existing${e.pct ? `:${e.pct}%` : ''}`);
      if (e.prepay) offer_tags.push(`prepay:${e.prepay}%`);
      const isPromo = e.promo != null && e.orig != null && e.promo !== e.orig;
      const half = halfNote && e.months === +halfNote[1] * 12
        // 적힌 할인액(49.5천)은 기본 구독료 기준 — 선납·결합 조건은 그 조건 요금의 절반(100원 반올림)
        ? [{ from: +halfNote[3], to: +halfNote[4], fee: Math.round(fee / 2 / 100) * 100 }] : [];
      const labels = [preApplied ? '결합(할인 선반영)' : null, isPromo ? '9월 월간 프로모션 적용' : null, half.length ? `${halfNote[2]}개월 반값(${halfNote[3]}~${halfNote[4]}회차)` : null].filter(Boolean);
      const extraNotes = [...flags.notes];
      let status = flags.status;
      if (/선납필수/.test(note || '') && !e.prepay) { status = 'paused'; extraNotes.push('선납필수 — 선납 조건으로만 판매'); }
      if (isPromo) extraNotes.push('9월 월간 프로모션: 구매 9/1~9/30, 배송 10/31까지, 커머셜·납품·임직원·폐쇄몰·특별할인 제외');
      if (stepped) extraNotes.push(`9/14까지 ${stepNote[1]}천원 할인 → 9/15부터 ${stepNote[2]}천원 할인 적용`);
      if (half.length) extraNotes.push('확인필요: 반값 적용 시 수수료 변동');
      const total = fee * e.months + (e.prepayAmount || 0);
      const reb = ruleRebate(ctx, ['LG전자구독'], subtype, 'rate_total', { monthly_fee: fee, contract_months: e.months, total_fee: total });
      const dup = pushDedup(offers, seen, makeOffer({
        supplier: 'LG전자구독',
        brand: 'LG전자',
        category_raw: category,
        product_name: lgSubscribeName({ category, div1: pick('div1'), div2: pick('div2'), model }),
        model_code: model,
        variant_code: [channel, svc].filter(Boolean).join('/'),
        contract_months: e.months,
        obligation_months: e.months,
        care_type,
        care_label: cols.cycle != null ? clean(row[cols.cycle]) : null,
        cycle_months,
        offer_type,
        offer_tags,
        offer_label: labels.join(' · ') || null,
        monthly_fee: fee,
        price_phases: half,
        valid_to: isPromo ? '2026-09-30' : null,
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
        status: change && /단종(?!예정)/.test(change) ? 'discontinued' : status || 'active',
        notes: [change, note, ...extraNotes].filter(Boolean).join(' / '),
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
    ship: find(lab, (c) => c.includes('배송방식')),
    filter: find(lab, (c) => c.includes('필터')),
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
    // 관리 칸이 없는 시트 — 배송방식 "설치배송(케어포함)" = 방문, "설치배송(자가관리)"·모델명 "(자가)" = 자가, 주기는 필터 칸 개월
    const ship = col.ship >= 0 ? clean(row[col.ship]) : '';
    const filterCyc = col.filter >= 0 ? toMonths(row[col.filter]) : null;
    const helloCare = /자가관리/.test(ship) || /\(자가\)/.test(clean(row[col.name]))
      ? { care_type: 'self', care_label: ship || '자가', cycle_months: filterCyc }
      : /케어포함/.test(ship) ? { care_type: 'visit', care_label: ship, cycle_months: filterCyc } : {};
    // D 무료개월 "[무2]" = 렌탈사가 주는 무료 개월(우리 'N개월 무료' 페이백과 다른 것)
    const supplierFree = hasVal(row[col.free]) ? parseInt(String(row[col.free]).replace(/[^\d]/g, ''), 10) || null : null;
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
      ...helloCare,
      notes: [div, clean(row[col.detail]), clean(row[col.note]),
        policy === '정액' ? '확인필요: 정액수수료(최대) 기준' : ''].filter(Boolean).join(' / '),
      source: { sheet, row: excelRow },
    };
    const detail = {
      fee_policy: policy || null,
      flat_fee_max: flatMax,
      supplier_free_months: hasVal(row[col.free]) ? row[col.free] : null,
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
        const totalRaw = toWon(row[t.total]);
        const total = totalRaw > 0 ? totalRaw : monthly * t.months;   // 원본 총액 칸이 0·공란이면 월요금×개월 (0 이 리베이트 0 으로 새지 않게)
        const offer_type = g.type === 'staff' ? 'staff' : path.includes('현장') ? 'field' : path.includes('콜특가') ? 'special' : 'normal';
        const freeDeducted = supplierFree && totalRaw > 0 && totalRaw === monthly * (t.months - supplierFree);
        put({
          ...base,
          contract_months: t.months,
          obligation_months: t.months,
          offer_type,
          offer_label: supplierFree ? `렌탈사 ${supplierFree}개월 무료` : null,
          // 1개월차부터 0원 구간을 넣으면 표시 월요금이 0이 되어 페이백 개월 계산이 깨진다 → 라벨·태그로만 안내
          offer_tags: supplierFree ? [`렌탈사무료${supplierFree}개월`] : [],
          notes: [base.notes, supplierFree && !freeDeducted ? '확인필요: 렌탈사 무료개월이 총액에 반영됐는지' : '',
            offer_type === 'staff' ? '확인필요: 임직원가 수수료 기준' : ''].filter(Boolean).join(' / '),
          monthly_fee: monthly,
          total_fee: total,
          ...rebateFor({ monthly_fee: monthly, contract_months: t.months, total_fee: total }),
          rebate_detail: detail,
        });
      }
    }
    const lump = toWon(row[col.lump]);
    if (lump) {
      put({ ...base, offer_type: 'purchase', total_fee: lump, ...rebateFor({ monthly_fee: null, contract_months: null, total_fee: lump }), rebate_detail: detail,
        notes: [base.notes, '확인필요: 일시불 수수료 기준'].filter(Boolean).join(' / ') });
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
    const rowText = row.map((v) => clean(v)).join(' ');
    // D열 등 "운영중단"·"미운영" → 일시중단, "단종" → 판매종료
    const ktStatus = /단종/.test(rowText) ? 'discontinued' : /운영\s*중단|미운영/.test(rowText) ? 'paused' : 'active';
    // "할부기간동안 4개월/12개월 1회 교체용 필터 제공" → 필터 배송
    const filterM = rowText.match(/(\d+)\s*개월\s*1회\s*교체용\s*필터/);
    const base = {
      supplier: 'KT가전구독',
      product_name: clean(row[col.name]) || model,
      model_code: model,
      offer_tags: [line],
      status: ktStatus,
      ...(filterM ? { care_type: 'delivery', care_label: '교체용 필터 제공', cycle_months: +filterM[1] } : {}),
      notes: [clean(row[col.note]), clean(row[col.install]), ktStatus !== 'active' ? '운영중단' : ''].filter(Boolean).join(' / '),
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
      offers.push(makeOffer({ ...base, offer_type: 'purchase', total_fee: lump, ...ktRebate(ctx, model, { monthly_fee: null, contract_months: null, total_fee: lump }), rebate_detail: detail,
        notes: [base.notes, /\(R\)/i.test(model) ? '' : '확인필요: 즉납 수수료 기준'].filter(Boolean).join(' / ') }));
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
  // 시트 상단 안내(B2·B3·J6·J7: 할부 불가 대상·미기재 모델 판매불가·사다리차 유상·소상공인 환급 등) — 조건 비고에 요약
  const notice = rows.slice(0, Math.max(labelRow, 0)).flatMap((r) => (r || []).filter((v) => isStr(v)).map(clean))
    .filter((s) => /할부|판매|사다리차|환급|법인|외국인|미성년|정책|ONLY/i.test(s)).join(' · ').slice(0, 300);

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
      // "자가관리용 필터배송 포함 (3년간 6개월마다 1회)"
      ...(/자가관리용\s*필터배송/.test(row.map((v) => clean(v)).join(' '))
        ? { care_type: 'self', care_label: '자가관리용 필터배송', cycle_months: +((row.map((v) => clean(v)).join(' ').match(/(\d+)\s*개월마다/) || [])[1]) || null } : {}),
      notes: [clean(row[col.note]), notice ? `안내: ${notice}` : ''].filter(Boolean).join(' / '),
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

/**
 * LG구독 시트엔 상품명 칸이 없다 — 제품군 + 구분1·구분2(5벌·MX8(구.시드니)·빌트인·벽걸이 …) + TV 인치(모델코드 앞 숫자)로 이름을 만든다
 *   구분1 이 단품 모델코드인 시트(냉장고·TV·쿠킹)는 코드를 빼고, '없음'·'26년' 같은 값도 뺀다
 */
export function lgSubscribeName({ category, div1, div2, model }) {
  const parts = [];
  const cat = clean(category);
  if (cat) parts.push(cat);
  if (/TV|OLED|QNED|MRGB|스바미|사운드바/i.test(cat)) {
    const inch = String(model || '').match(/^[A-Z]*?(\d{2,3})(?=[A-Z])/);
    if (inch && +inch[1] >= 24) parts.push(`${inch[1]}형`);
  }
  if (/에어컨/.test(cat)) {
    const py = String(model || '').match(/^[A-Z]{2}(\d{2})[A-Z]/);   // FQ18… = 18평형, SW07… = 7평형
    if (py && +py[1] > 0) parts.push(`${+py[1]}평`);
  }
  for (const d of [div1, div2]) {
    const v = clean(d);
    if (!v || v === '없음' || /^\d{2}년$/.test(v) || v === cat || isCodeName(v, model)) continue;
    if (!parts.includes(v)) parts.push(v);
  }
  return parts.length ? `LG ${parts.join(' ')}` : model;
}

export default [
  { id: 'lg-subscription', file: 'appliance', match: (n) => /^LG구독(냉장고|쿠킹|TV|공청기|에어컨|리빙)$/.test(base(n)), parse: parseLgSubscription },
  { id: 'lg-hello', file: 'appliance', match: (n) => /^LG헬로/.test(base(n)), parse: parseLgHello },
  { id: 'kt-line', file: 'appliance', match: (n) => /^KT회선[OX]$/i.test(base(n)), parse: parseKtLine },
  { id: 'kt-subscribe', file: 'appliance', match: (n) => /^KT구독(BIZ)?형\(R\)$/i.test(base(n)), parse: parseKtSubscribe },
];
