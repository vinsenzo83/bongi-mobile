/**
 * 가전 파일 — 수수료율 시트 + 기타 렌탈사 시트 어댑터
 *   (2609)렌탈사별 수수료율 · 스마트 · 유버스(가전판) · 렌타나 · 캐리어 · 세스코 · BS
 *   · 이니렌탈 삼성/LG/기타/생활가전 · 렌플
 *
 * 리베이트: 이 시트들에는 금액이 없다 → 수수료율 시트 규칙(ctx.supplierRules)으로 계산.
 *   rate_total      = 총 렌탈료 × 율 (시트에 총 렌탈료가 있으면 그 값, 없으면 월×약정)
 *   multiple_monthly = 월 렌탈료 × 배수 (세스코 6)
 *   flat            = 건당 고정
 */
import {
  applyRule, clean, colMap, conditionKey, findHeaderRow, findRule, hasVal,
  makeOffer, sheetBase, toMonths, toWon,
} from '../core.js';

const FILE = 'appliance';
const nonEmpty = (row) => !!row && row.some(hasVal);
const norm = (s) => clean(s).replace(/\s/g, '');

/** 월 렌탈료 값: 숫자 > 0 만 유효 */
function fee(v) {
  const n = toWon(v);
  return n != null && n > 0 ? n : null;
}

/** 규칙 적용 리베이트 필드 묶음 */
function rebateFields(rule, { monthly_fee, contract_months, total_fee }) {
  if (!rule) return { rebate: null, rebate_basis: null, rebate_rate: null };
  return {
    rebate: applyRule(rule, { monthly_fee, contract_months, total_fee }),
    rebate_basis: rule.basis,
    rebate_rate: rule.value,
    rebate_detail: { rule_supplier: rule.supplier, rule_subtype: rule.subtype, rule_label: rule.label, rule_row: rule.row },
  };
}

/**
 * 같은 시트 안에서 조건키가 겹치면 상품명 → 순번으로 구분한다.
 * (시트 NO/행번호는 월마다 바뀌므로 키에 넣지 않는다)
 */
function finalizeKeys(offers) {
  const group = (list) => list.reduce((m, o) => {
    const k = conditionKey(o); (m.get(k) || m.set(k, []).get(k)).push(o); return m;
  }, new Map());
  for (const list of group(offers).values()) {
    if (list.length < 2) continue;
    for (const o of list) o.variant_code = [o.variant_code, o.product_name].filter(Boolean).join(' / ') || null;
  }
  for (const list of group(offers).values()) {
    if (list.length < 2) continue;
    list.forEach((o, i) => { if (i > 0) { o.variant_code = `${o.variant_code || ''}#${i + 1}`; o.notes = [o.notes, '동일조건 중복행(순번 구분)'].filter(Boolean).join(' / '); } });
  }
  return offers;
}

const joinNotes = (...xs) => xs.map(clean).filter((x) => x && x !== '-').join(' / ') || null;

// ------------------------------------------------------------------
// 1. 수수료율 시트
// ------------------------------------------------------------------
const supplierRules = {
  id: 'supplier-rules',
  kind: 'supplier-rules',
  file: FILE,
  match: (n) => sheetBase(n).includes('렌탈사별 수수료율'),
  parse(rows) {
    const rules = [];
    const skipped = [];
    const hdr = findHeaderRow(rows, ['렌탈사', '수수료율']);
    // 시트가 B1 에서 시작해도(A열 비어 있음) 헤더 위치로 열을 잡는다
    const c0 = Math.max(0, (rows[hdr] || []).findIndex((v) => clean(v).replace(/\s/g, '') === '렌탈사'));
    let supplier = null;
    rows.forEach((row, i) => {
      if (!nonEmpty(row)) return;
      const r = i + 1;
      if (i <= hdr) { skipped.push({ row: r, reason: i === hdr ? '헤더' : '제목·안내' }); return; }
      if (hasVal(row[c0])) supplier = clean(row[c0]);
      const label = clean(row[c0 + 1]);
      if (!supplier || !label) { skipped.push({ row: r, reason: '렌탈사/라벨 없음' }); return; }
      const paren = label.match(/^\(([^)]+)\)/);
      const subtype = paren ? paren[1].replace(/상품$/, '') : '일반';
      const raw = row[c0 + 2];
      const num = typeof raw === 'number' ? raw : (/^\s*[\d.,]+\s*$/.test(String(raw ?? '')) ? parseFloat(String(raw).replace(/,/g, '')) : null);
      let basis = null;
      if (num != null) {
        if (label.includes('총 렌탈료') || label.includes('총렌탈료')) basis = 'rate_total';
        else if (label.includes('월 렌탈료') || label.includes('월렌탈료')) basis = 'multiple_monthly';
        else if (/(건\s*당|구좌\s*당)/.test(label)) basis = 'flat';
        else if (label.includes('일시불')) basis = 'rate_lump';
      }
      rules.push({
        supplier, subtype, basis, value: basis ? num : null, label,
        raw_value: raw == null ? null : String(raw), note: clean(row[c0 + 3]) || null, row: r,
      });
    });
    return { rules, skipped };
  },
};

// ------------------------------------------------------------------
// 2. 스마트 — 36/48/60 월·총 렌탈료 가로형
// ------------------------------------------------------------------
const smart = {
  id: 'smart', file: FILE,
  match: (n) => sheetBase(n) === '스마트',
  parse(rows, ctx) {
    const offers = []; const skipped = [];
    const hdr = findHeaderRow(rows, ['모델명', '월렌탈료']);
    const H = rows[hdr] || [];
    const c = colMap(H, { gubun: '구분', maker: '제조사', cat: '품목', state: '상태', as: 'A/S', gift: '고객프로모션', name: '상품명', model: '모델명', note: '비고', cms: 'CMS', expose: '노출여부', applied: '적용일' });
    const terms = [];
    H.forEach((v, j) => {
      const s = norm(v);
      if (s.startsWith('월렌탈료')) terms.push({ months: toMonths(s), fee: j, total: norm(H[j + 1]).startsWith('총렌탈료') ? j + 1 : null });
    });
    const rule = findRule(ctx.supplierRules, ['스마트'], '일반');
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!nonEmpty(row)) continue;
      const r = i + 1;
      if (i <= hdr + 1) { skipped.push({ row: r, reason: i < hdr ? '제목·색상범례' : '헤더' }); continue; }
      const state = clean(row[c.state]);
      const special = clean(row[c.gift + 1]) === '특가';
      const noCms = c.cms != null && /^X$/i.test(clean(row[c.cms]));   // CMS(자동이체) 불가 = 카드결제만
      let made = 0;
      for (const t of terms) {
        const m = fee(row[t.fee]);
        if (!m) continue;
        const total = t.total != null ? toWon(row[t.total]) : null;
        offers.push(makeOffer({
          supplier: '스마트', brand: clean(row[c.maker]) || null, category_raw: joinNotes(row[c.gubun], row[c.cat]),
          product_name: row[c.name], model_code: row[c.model],
          contract_months: t.months, obligation_months: t.months,
          offer_type: special ? 'special' : 'normal', offer_label: special ? '특가' : null,
          offer_tags: noCms ? ['CMS불가'] : [],
          monthly_fee: m, total_fee: total,
          ...rebateFields(rule, { monthly_fee: m, contract_months: t.months, total_fee: total }),
          status: state === '일시중단' ? 'paused' : 'active',
          notes: joinNotes(noCms ? '카드결제만(CMS 불가)' : '',state && state !== '운영' ? `상태:${state}` : '', row[c.gift] ? `사은품:${clean(row[c.gift])}` : '', row[c.note], row[c.expose] ? `노출:${clean(row[c.expose])}` : '', row[c.as] ? `AS:${clean(row[c.as])}` : ''),
          source: { sheet: ctx.sheetName, row: r },
        }));
        made++;
      }
      if (!made) skipped.push({ row: r, reason: '전 약정 렌탈료 0/없음' });
    }
    return { offers: finalizeKeys(offers), skipped };
  },
};

// ------------------------------------------------------------------
// 3. 유버스(가전판) — 행 = 조건. 정수기 파일 유버스와 시트명이 같아 헤더로 구분
// ------------------------------------------------------------------
const ubusAppliance = {
  id: 'ubus-appliance', file: FILE,
  match: (n) => sheetBase(n) === '유버스',
  parse(rows, ctx) {
    const offers = []; const skipped = [];
    const hdr = findHeaderRow(rows, ['적용일자', '규정명', '렌탈기간']);
    if (hdr < 0) return { offers, skipped }; // 정수기 파일 유버스 → 이 어댑터 대상 아님
    const c = colMap(rows[hdr], { date: '적용일자', guide: '안내사항', maker: '제조사', cat: '품목', rule: '규정명', model: '모델명', term: '렌탈기간', fee: '렌탈료', island: '도서산간', jeju: '제주도', as: 'AS기간', special: '특이사항', extra: '추가비용', ret: '반환비', reg: '등록비' });
    const rule = findRule(ctx.supplierRules, ['현대유버스', '유버스'], '일반');
    rows.forEach((row, i) => {
      if (!nonEmpty(row)) return;
      const r = i + 1;
      if (i <= hdr) { skipped.push({ row: r, reason: i === hdr ? '헤더' : '범례' }); return; }
      const termRaw = clean(row[c.term]);
      const price = toWon(row[c.fee]);
      if (!price) { skipped.push({ row: r, reason: '렌탈료 없음' }); return; }
      const guide = clean(row[c.guide]);
      const makerRaw = clean(row[c.maker]);
      const common = {
        supplier: '현대유버스', brand: makerRaw.replace(/^\([^)]*\)\s*/, '') || null, category_raw: row[c.cat],
        // 규정명의 약정 표기 "(36)" 제거 → 같은 상품은 약정이 달라도 같은 이름
        product_name: clean(row[c.rule]).replace(/\s*\(\s*\d{2}\s*\)\s*/g, ' ').trim(), model_code: row[c.model],
        variant_code: makerRaw.match(/^\(([^)]*)\)/)?.[1] || null, // "(2Q)"·"(2607)" 가격그룹 — 월마다 바뀔 수 있음
        status: /일시품절/.test(guide) ? 'paused' : 'active',
        notes: joinNotes(guide ? `안내:${guide}` : '', row[c.special], row[c.extra], row[c.ret] ? `반환비:${clean(row[c.ret])}` : '', row[c.reg] ? `등록비:${clean(row[c.reg])}` : '', row[c.island] ? `도서산간:${clean(row[c.island])}` : '', row[c.jeju] ? `제주:${clean(row[c.jeju])}` : ''),
        source: { sheet: ctx.sheetName, row: r },
      };
      if (termRaw.includes('일시불')) {
        offers.push(makeOffer({ ...common, offer_type: 'purchase', prepay_amount: price, total_fee: price, notes: joinNotes(common.notes, '일시불 — 수수료 규칙(총 렌탈료 율) 적용 여부 미확인') }));
        return;
      }
      const months = toMonths(termRaw);
      offers.push(makeOffer({
        ...common, contract_months: months, obligation_months: months, offer_type: 'normal',
        monthly_fee: price, ...rebateFields(rule, { monthly_fee: price, contract_months: months }),
      }));
    });
    return { offers: finalizeKeys(offers), skipped };
  },
};

// ------------------------------------------------------------------
// 4. 렌타나 — 블록 여러 개(한정특가 / 단독운영 / 단종 / 냉난방기 표 2개), 약정 가로형
// ------------------------------------------------------------------
const rentana = {
  id: 'rentana', file: FILE,
  match: (n) => sheetBase(n) === '렌타나',
  parse(rows, ctx) {
    const offers = []; const skipped = [];
    const rule = findRule(ctx.supplierRules, ['렌타나'], '일반');
    let c = null; let terms = []; let section = ''; let discontinued = false;
    let last = {};
    rows.forEach((row, i) => {
      if (!nonEmpty(row)) return;
      const r = i + 1;
      const cells = row.map(norm);
      // 헤더 행: 모델명 + 약정 컬럼
      if (cells.includes('모델명') && cells.some((s) => /^\d{2}(개월)?$/.test(s))) {
        c = colMap(row, { brand: '브랜드', as: 'A/S', cat: '제품군', target: '접수대상', name: '제품명', model: '모델명', pickup: '수거비', note: '비고', info: '상품정보' });
        terms = [];
        row.forEach((v, j) => { const s = norm(v); if (/^\d{2}(개월)?$/.test(s)) terms.push({ months: toMonths(s), col: j }); });
        last = {}; discontinued = false;
        skipped.push({ row: r, reason: '헤더' });
        return;
      }
      const filled = row.filter(hasVal).length;
      if (!c || filled <= 1) {
        const t = clean(row.find(hasVal));
        if (/단\s*종/.test(t)) discontinued = true;
        else if (t.includes('특가') || t.includes('운영')) section = t;
        skipped.push({ row: r, reason: '섹션제목·단위표기' });
        return;
      }
      if (!hasVal(row[c.model]) && !hasVal(row[c.name])) { skipped.push({ row: r, reason: '서브헤더(수거비 구분)' }); return; }
      // 수거비·설치보장·비고 등은 병합셀(H142:H253 등)이라 첫 행에만 값이 있다 → 병합 범위 값을 읽는다
      const mv = (col) => (col == null ? null : ctx.mergedValue ? ctx.mergedValue(i, col) : row[col]);
      for (const k of ['brand', 'cat', 'target', 'as']) {
        if (c[k] == null) continue;
        if (hasVal(mv(c[k]))) last[k] = clean(mv(c[k]));
      }
      const pickupVal = mv(c.pickup); const noteVal = mv(c.note); const infoVal = mv(c.info);
      const name = clean(row[c.name]);
      const special = section.includes('특가') || name.includes('특가');
      let made = 0;
      for (const t of terms) {
        const m = fee(row[t.col]);
        if (!m) continue;
        offers.push(makeOffer({
          supplier: '렌타나', brand: last.brand || null, category_raw: last.cat || null,
          product_name: name, model_code: row[c.model],
          contract_months: t.months, obligation_months: t.months,
          offer_type: special ? 'special' : 'normal', offer_label: special ? (section.includes('특가') ? section : '한정수량특가') : null,
          monthly_fee: m, ...rebateFields(rule, { monthly_fee: m, contract_months: t.months }),
          status: discontinued ? 'discontinued' : 'active',
          notes: joinNotes(last.target ? `접수대상:${last.target}` : '', last.as ? `AS:${last.as}` : '', hasVal(pickupVal) ? `수거비:${clean(pickupVal)}` : '', noteVal, hasVal(infoVal) ? clean(infoVal) : '', discontinued ? '단종 구역' : ''),
          source: { sheet: ctx.sheetName, row: r },
        }));
        made++;
      }
      if (!made) skipped.push({ row: r, reason: '전 약정 렌탈료 0/없음' });
    });
    return { offers: finalizeKeys(offers), skipped };
  },
};

// ------------------------------------------------------------------
// 5. 캐리어 — 좌(B~K)·우(M~V) 두 표, 모델/케어 병합
// ------------------------------------------------------------------
function carrierCare(raw) {
  const s = clean(raw);
  if (!s) return { care_type: null, cycle_months: null, tags: [] };
  if (s.includes('미포함')) return { care_type: 'none', cycle_months: null, tags: ['케어미포함'] };
  const cyc = s.match(/(\d+)\s*개월/);
  if (s.includes('방문')) return { care_type: 'visit', cycle_months: cyc ? +cyc[1] : null, tags: ['케어포함'] };
  if (s.includes('포함')) return { care_type: 'visit', cycle_months: null, tags: [`케어포함${(s.match(/\(([^)]+)\)/) || [])[1] ? `(${s.match(/\(([^)]+)\)/)[1]})` : ''}`] };
  return { care_type: null, cycle_months: null, tags: [s] };
}

const carrier = {
  id: 'carrier', file: FILE,
  match: (n) => sheetBase(n) === '캐리어',
  parse(rows, ctx) {
    const offers = []; const skipped = [];
    const rule = findRule(ctx.supplierRules, ['캐리어'], '일반');
    const LABELS = { cat: '품목', group: '모델구분', grade: '등급', area: '사용면적', model: '모델명', care: '케어', term: '계약기간', fee: '월렌탈료', install: '기본설치비', note: '비고' };
    // 좌 A~K(0~10), 우 L~V(11~21) — 끝 열(K·V 비고)까지 포함해야 "* 정액 상품" 안내가 들어온다
    const sides = [{ start: 0, end: 11 }, { start: 11, end: 22 }].map((s) => ({ ...s, c: null, st: {} }));
    rows.forEach((row, i) => {
      if (!nonEmpty(row)) return;
      const r = i + 1;
      let isHeader = false; let made = 0; let hasData = false;
      for (const side of sides) {
        const seg = row.slice(side.start, side.end);
        if (seg.map(norm).includes('모델명')) {
          side.c = colMap(seg, LABELS); side.st = {}; isHeader = true; continue;
        }
        if (!side.c || !seg.some(hasVal)) continue;
        const get = (k) => (side.c[k] == null ? null : seg[side.c[k]]);
        const st = side.st;
        for (const k of ['cat', 'group', 'grade', 'area']) if (hasVal(get(k))) st[k] = clean(get(k));
        if (hasVal(get('model'))) { st.model = clean(get('model')); st.note = null; }
        for (const k of ['care', 'install', 'note']) if (hasVal(get(k))) st[k] = get(k);
        const months = toMonths(get('term'));
        const m = fee(get('fee'));
        if (!months || !m) { if (seg.some(hasVal)) hasData = true; continue; }
        const care = carrierCare(st.care);
        offers.push(makeOffer({
          supplier: '캐리어', brand: '캐리어', category_raw: joinNotes(st.cat, st.group),
          product_name: joinNotes(st.cat, st.group, st.grade, st.area), model_code: st.model,
          contract_months: months, obligation_months: months,
          care_type: care.care_type, care_label: st.care, cycle_months: care.cycle_months,
          offer_type: 'normal', offer_tags: /정액/.test(clean(st.note)) ? [...care.tags, '정액'] : care.tags,
          monthly_fee: m, ...rebateFields(rule, { monthly_fee: m, contract_months: months }),
          notes: joinNotes(st.install ? `기본설치비(면제):${clean(st.install)}` : '', st.note, side.start === 0 ? '' : '전문가전 표', '캐치서비스 건당 5,000원은 별도 규칙',
            /정액/.test(clean(st.note)) ? '확인필요: 정액 상품 — 수수료 금액 미기재(총렌탈료 11% 아닐 수 있음)' : '',
            months === 72 ? '72개월 계약은 무상AS 60개월까지' : ''),
          source: { sheet: ctx.sheetName, row: r },
        }));
        made++;
      }
      if (made) return;
      skipped.push({ row: r, reason: isHeader ? '헤더' : (hasData && row.filter(hasVal).length > 1 ? '약정/렌탈료 없음' : '섹션제목·안내') });
    });
    return { offers: finalizeKeys(offers), skipped };
  },
};

// ------------------------------------------------------------------
// 6. 세스코 — 행 = 조건. 기준 렌탈료 + 할인 렌탈료/반값 프로모션
// ------------------------------------------------------------------
function cescoHalf(label) {
  const s = clean(label);
  if (!s.includes('반값') || /반값\s*프로모션\s*종료/.test(s)) return null;
  const range = s.match(/(\d+)\s*~\s*(\d+)\s*개월\s*차/);
  if (range) return { from: +range[1], to: +range[2] };
  const n = s.match(/(\d+)\s*개월\s*(렌탈료\s*)?반값/);
  if (n) return { from: 1, to: +n[1] };
  return null;
}

const cesco = {
  id: 'cesco', file: FILE,
  match: (n) => sheetBase(n) === '세스코',
  parse(rows, ctx) {
    const offers = []; const skipped = [];
    const hdr = findHeaderRow(rows, ['품목', '모델명', '렌탈료[기준]']);
    const c = colMap(rows[hdr], { gubun: '구분', name: '품목', model: '모델명', term: '의무', cycle: '관리', base: '렌탈료[기준]', code: '접수코드', disc: '[할인]', note: '비고' });
    const extraCol = (c.note ?? 12) + 1;
    const rule = findRule(ctx.supplierRules, ['세스코'], '일반');
    rows.forEach((row, i) => {
      if (!nonEmpty(row)) return;
      const r = i + 1;
      if (i <= hdr) { skipped.push({ row: r, reason: i === hdr ? '헤더' : '단가표 안내문' }); return; }
      const base = fee(row[c.base]);
      const months = toMonths(row[c.term]);
      if (!base || !months) { skipped.push({ row: r, reason: '렌탈료/의무기간 없음' }); return; }
      const name = clean(row[c.name]);
      // 결합 표기가 "(결합)" 끝괄호 또는 "…판테온(25평형)_결합_화이트" 형태 둘 다 있다
      const paren = (name.match(/\(([^)]+)\)\s*$/) || [])[1]?.replace(/\s/g, '') === '결합' || /_결합(_|$)/.test(name)
        ? '결합' : ((name.match(/\(([^)]+)\)\s*$/) || [])[1] || null);
      const offerType = paren === '결합' ? 'bundle' : !paren || paren === '단품' ? 'normal' : 'bundle';
      const cycle = toMonths(row[c.cycle]);
      const label = clean(row[c.note]);
      const extra = clean(row[extraCol]);
      const ended = /운영종료|단종/.test(label);
      // "9월 렌탈료 할인", "해충 시즌 (3~9월)", "9월 3천원 추가할인" — 이번 달 한정
      const monthOnly = /9월|시즌\s*\(\s*\d+\s*~\s*9월\s*\)/.test(`${label} ${extra}`);
      const incentive = /추가\s*인센티브/.test(`${label} ${extra}`);
      const common = {
        supplier: '세스코', brand: '세스코', category_raw: row[c.gubun], product_name: name,
        model_code: row[c.model], variant_code: paren,
        contract_months: months, obligation_months: months,
        care_type: cycle ? 'visit' : null, cycle_months: cycle,
        status: ended ? 'discontinued' : 'active',
        source: { sheet: ctx.sheetName, row: r },
      };
      const baseNotes = joinNotes(label, extra, row[c.code] ? `접수코드:${clean(row[c.code])}` : '');
      const tagsFor = () => [...(paren && offerType === 'bundle' ? [paren] : []), ...(incentive ? ['추가인센티브'] : [])];
      const incentiveNote = incentive ? '확인필요: 추가 인센티브 금액 미기재' : '';
      offers.push(makeOffer({
        ...common, offer_type: offerType, offer_tags: tagsFor(),
        monthly_fee: base, ...rebateFields(rule, { monthly_fee: base, contract_months: months }), notes: joinNotes(baseNotes, incentiveNote),
      }));
      const half = cescoHalf(label);
      if (half) {
        offers.push(makeOffer({
          ...common, offer_type: 'half', offer_tags: tagsFor(), offer_label: label,
          monthly_fee: base, price_phases: [{ from: half.from, to: half.to, fee: Math.round(base / 2) }],
          ...rebateFields(rule, { monthly_fee: base, contract_months: months }),
          valid_to: monthOnly ? '2026-09-30' : null,
          notes: joinNotes(extra, incentiveNote, /혜택강화/.test(label) ? '확인필요: 반값 시작 회차(다른 세스코 프로모션은 2개월차부터)' : ''),
        }));
      }
      const disc = fee(row[c.disc]);
      if (disc && disc < base) {
        offers.push(makeOffer({
          ...common, offer_type: 'promo', offer_tags: tagsFor(), offer_label: label || '렌탈료 할인',
          monthly_fee: disc, ...rebateFields(rule, { monthly_fee: disc, contract_months: months }),
          valid_to: monthOnly ? '2026-09-30' : null,
          notes: joinNotes(`기준 렌탈료 ${base}`, extra, incentiveNote, '확인필요: 수수료 기준(할인가×6 vs 정상가×6)'),
        }));
      }
    });
    return { offers: finalizeKeys(offers), skipped };
  },
};

// ------------------------------------------------------------------
// 7. BS — 행 = 조건
// ------------------------------------------------------------------
const bs = {
  id: 'bs', file: FILE,
  match: (n) => sheetBase(n) === 'BS',
  parse(rows, ctx) {
    const offers = []; const skipped = [];
    const hdr = findHeaderRow(rows, ['모델명', '월렌탈료', '기간']);
    const c = colMap(rows[hdr], { date: '일자', cat: '구분', channel: '판매채널', state: '운영여부', brand: '브랜드', model: '모델명', code: '모델코드', name: '상품명', fee: '월렌탈료', term: '기간', total: '총렌탈료', as: 'a/s', gift: '사은품', note: '비고' });
    const general = findRule(ctx.supplierRules, ['BS'], '일반');
    const console_ = findRule(ctx.supplierRules, ['BS'], '플스,엑박');
    rows.forEach((row, i) => {
      if (!nonEmpty(row)) return;
      const r = i + 1;
      if (i <= hdr) { skipped.push({ row: r, reason: '헤더' }); return; }
      const m = fee(row[c.fee]);
      const months = toMonths(row[c.term]);
      if (!m || !months) { skipped.push({ row: r, reason: '렌탈료/기간 없음' }); return; }
      const name = clean(row[c.name]);
      // 게임기만 — '플스'는 "래플스 침대"에, 'PS5'는 냉장고 모델 "M451PS53"에 걸려 8% 로 잘못 계산됐다
      const isConsole = /플레이스테이션|엑스박스|닌텐도|(?<![A-Za-z0-9])(PS5|PS4|XBOX)(?![A-Za-z0-9])/i.test(name) || /게임기|콘솔/.test(clean(row[c.cat]));
      const bsText = joinNotes(row[c.note], row[c.gift]) || '';
      const bsCare = /(1년에\s*1회|연\s*1회)\s*방문|케어서비스\s*총\s*\d+회/.test(bsText) ? { care_type: 'visit', cycle_months: 12 }
        : /연\s*1회[^/]*택배\s*발송/.test(bsText) ? { care_type: 'delivery', cycle_months: 12 } : {};
      const rule = isConsole && console_?.subtype === '플스,엑박' ? console_ : general;
      const total = toWon(row[c.total]);
      const state = clean(row[c.state]);
      offers.push(makeOffer({
        supplier: 'BS', brand: clean(row[c.brand]) || null, category_raw: row[c.cat],
        product_name: name, model_code: row[c.model], variant_code: hasVal(row[c.code]) ? String(row[c.code]) : null,
        contract_months: months, obligation_months: months, offer_type: 'normal', ...bsCare,
        monthly_fee: m, total_fee: total, ...rebateFields(rule, { monthly_fee: m, contract_months: months, total_fee: total }),
        status: state && state !== '판매중' ? 'paused' : 'active',
        notes: joinNotes(state && state !== '판매중' ? `운영:${state}` : '', row[c.gift] ? `사은품:${clean(row[c.gift])}` : '', row[c.note], row[c.channel] ? `채널:${clean(row[c.channel])}` : '', row[c.as] ? `AS:${clean(row[c.as])}` : ''),
        source: { sheet: ctx.sheetName, row: r },
      }));
    });
    return { offers: finalizeKeys(offers), skipped };
  },
};

// ------------------------------------------------------------------
// 8. 이니렌탈 4종 — 위탁 렌탈료/총 렌탈료 × 36/48/60, 윗줄이 약정 라벨
// ------------------------------------------------------------------
function iniAdapter(id, sheet, brandFixed) {
  return {
    id, file: FILE,
    match: (n) => sheetBase(n) === sheet,
    parse(rows, ctx) {
      const offers = []; const skipped = [];
      const hdr = findHeaderRow(rows, ['모델명', '위탁렌탈료']);
      const H = rows[hdr]; const T = rows[hdr - 1] || [];
      const c = colMap(H, { brand: '브랜드', gubun: '구분', cat: '품목', model: '모델명', name: '상품명', as: 'A/S', note: '비고', main: '주력', ship: '배송방법' });
      const terms = [];
      H.forEach((v, j) => { if (norm(v) === '위탁렌탈료') terms.push({ months: toMonths(T[j]), fee: j, total: norm(H[j + 1]) === '총렌탈료' ? j + 1 : null }); });
      const prevCol = H.findIndex((v) => /^\d+개월렌탈료$/.test(norm(v)));
      const month = (sheet.match(/\((\d+월)\)/) || ctx.sheetName.match(/\((\d+월)\)/) || [])[1];
      const rule = findRule(ctx.supplierRules, ['이니'], '일반');
      rows.forEach((row, i) => {
        if (!nonEmpty(row)) return;
        const r = i + 1;
        if (i <= hdr) { skipped.push({ row: r, reason: i === hdr ? '헤더' : '약정 라벨행' }); return; }
        const note = clean(row[c.note]);
        const category = c.gubun != null ? clean(row[c.gubun]) : clean(row[c.cat]);
        // "연간1회 방문관리 3년간" 같은 관리 문구 (관리 칸이 없는 시트)
        const rowText = row.map((v) => clean(v)).join(' ');
        const iniCare = /(연간?\s*1회|1년에\s*1회)\s*방문/.test(rowText) ? { care_type: 'visit', cycle_months: 12 } : {};
        let made = 0;
        for (const t of terms) {
          const m = fee(row[t.fee]);
          if (!m || !t.months) continue;
          const total = t.total != null ? toWon(row[t.total]) : null;
          offers.push(makeOffer({
            supplier: '이니렌탈', brand: brandFixed || clean(row[c.brand]) || null,
            category_raw: joinNotes(category, c.gubun != null && c.cat != null ? row[c.cat] : ''),
            product_name: row[c.name], model_code: row[c.model],
            contract_months: t.months, obligation_months: t.months, offer_type: 'normal', ...iniCare,
            monthly_fee: m, total_fee: total, ...rebateFields(rule, { monthly_fee: m, contract_months: t.months, total_fee: total }),
            status: /단종/.test(note) ? 'discontinued' : 'active',
            notes: joinNotes(`${month || '8월'} 자료`, note, c.main != null && hasVal(row[c.main]) ? `주력:${clean(row[c.main])}` : '', row[c.ship] ? `배송:${clean(row[c.ship])}` : '', prevCol >= 0 && hasVal(row[prevCol]) && typeof row[prevCol] !== 'number' ? `전월비교:${clean(row[prevCol])}` : '', row[c.as] ? `AS:${clean(row[c.as])}` : ''),
            source: { sheet: ctx.sheetName, row: r },
          }));
          made++;
        }
        if (!made) skipped.push({ row: r, reason: '전 약정 렌탈료 없음' });
      });
      return { offers: finalizeKeys(offers), skipped };
    },
  };
}

// ------------------------------------------------------------------
// 9. 렌플(5월) — 36/48/60 가로
// ------------------------------------------------------------------
const renple = {
  id: 'renple', file: FILE,
  match: (n) => sheetBase(n) === '렌플',
  parse(rows, ctx) {
    const offers = []; const skipped = [];
    const hdr = findHeaderRow(rows, ['브랜드', '모델명']);
    const H = rows[hdr];
    const c = colMap(H, { brand: '브랜드', cat: '카테고리', name: '상품명', model: '모델명' });
    const terms = [];
    H.forEach((v, j) => { if (/^\d{2}(개월)?$/.test(norm(v))) terms.push({ months: toMonths(norm(v)), col: j }); });
    const month = (ctx.sheetName.match(/\((\d+월)\)/) || [])[1];
    const rule = findRule(ctx.supplierRules, ['렌플'], '일반');
    rows.forEach((row, i) => {
      if (!nonEmpty(row)) return;
      const r = i + 1;
      if (i <= hdr) { skipped.push({ row: r, reason: i === hdr ? '헤더' : '제목' }); return; }
      let made = 0;
      for (const t of terms) {
        const m = fee(row[t.col]);
        if (!m) continue;
        offers.push(makeOffer({
          supplier: '렌플', brand: clean(row[c.brand]) || null, category_raw: row[c.cat],
          product_name: row[c.name], model_code: row[c.model],
          contract_months: t.months, obligation_months: t.months, offer_type: 'normal',
          monthly_fee: m, ...rebateFields(rule, { monthly_fee: m, contract_months: t.months }),
          notes: `${month || '5월'} 자료`,
          source: { sheet: ctx.sheetName, row: r },
        }));
        made++;
      }
      if (!made) skipped.push({ row: r, reason: '전 약정 렌탈료 없음' });
    });
    return { offers: finalizeKeys(offers), skipped };
  },
};

export default [
  supplierRules, smart, ubusAppliance, rentana, carrier, cesco, bs,
  iniAdapter('ini-samsung', '이니렌탈삼성', '삼성'),
  iniAdapter('ini-lg', '이니렌탈LG', 'LG'),
  iniAdapter('ini-etc', '이니렌탈기타', null),
  iniAdapter('ini-living', '이니렌탈생활가전', null),
  renple,
];
