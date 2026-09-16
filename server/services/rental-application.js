/**
 * rental-application.js — 렌탈사 가입기준(signup_policy) + 선택 조건(offer) → 계약정보 입력폼 명세 · 검증 · 계약진행 체크리스트
 *
 * 렌탈사마다 받는 정보가 다르다(연령·납부수단·결제일·명의별 서류·타사보상 증빙 …).
 * 화면(TM 계산기·계약처리 상세)은 여기서 만든 명세를 그리기만 하고, 서버는 같은 명세로 검증한다.
 *
 * 필드 명세: { key, label, type: text|tel|date|email|select|checkbox|textarea|address|time,
 *             required, options?, show_if?: { field, in: [...] } | { field, truthy: true }, hint?, source? }
 * 민감정보 원칙: 주민번호·카드번호·계좌 원문은 이 폼에서 받지 않는다. 렌탈사 본인인증·해피콜 단계에서 고객이 직접 입력한다.
 */

const HOLDER_ALL = ['개인', '외국인', '개인사업자', '법인사업자'];
const BIZ = ['개인사업자', '법인사업자'];

const TYPE_LABEL = { normal: '일반', package: '패키지', bundle: '결합', trade_in: '타사보상', half: '반값할인', prepay: '선납', promo: '프로모션', special: '특가', field: '현장', staff: '임직원', purchase: '일시불' };

/** 정수기·가전 파일 정책 중 이 조건에 해당하는 것 */
export function pickPolicy(signupPolicy, fileKind) {
  if (!signupPolicy) return null;
  return signupPolicy[fileKind] || signupPolicy.water || signupPolicy.appliance || null;
}

function holderTypes(policy) {
  const raw = policy?.eligibility?.holder_types || [];
  if (!raw.length) return HOLDER_ALL;
  const out = new Set();
  for (const h of raw) {
    if (h === '사업자') BIZ.forEach((b) => out.add(b));
    else if (/법인|비영리|공공/.test(h)) out.add('법인사업자');
    else if (/개인사업자/.test(h)) out.add('개인사업자');
    else if (/외국인/.test(h)) out.add('외국인');
    else if (/개인/.test(h)) out.add('개인');
  }
  return HOLDER_ALL.filter((h) => out.has(h));
}

/** applies_to 원문 → 어느 명의/상황에서 필요한지 */
function conditionOf(appliesTo) {
  const s = String(appliesTo || 'all');
  if (s === 'all') return { always: true };
  if (/타사보상/.test(s)) return { offer: 'trade_in' };
  if (/타명의|대리납/.test(s)) return { flag: 'third_party_payer' };
  if (/대리인/.test(s)) return { flag: 'proxy' };
  const holders = new Set();
  const t = s.replace(/\s/g, '');
  if (/외국인/.test(t) && !/대표자외국인/.test(t)) holders.add('외국인');
  if (/개인\/법인사업자|개인및법인사업자|개인\(개인사업자\)/.test(t)) BIZ.forEach((b) => holders.add(b));
  if (/개인사업자/.test(t)) holders.add('개인사업자');
  if (/법인|고유번호증|국가기관|관공서|공공기관/.test(t)) holders.add('법인사업자');
  if (/사업자/.test(t) && !/개인사업자|법인/.test(t)) BIZ.forEach((b) => holders.add(b));
  // "개인" 단독(개인사업자·개인/법인사업자 표기가 아닌 것)
  if (/^개인($|\(|\s|대표자|전입)/.test(t) || /^개인\(전입/.test(t)) holders.add('개인');
  if (/공통/.test(t)) HOLDER_ALL.forEach((h) => holders.add(h));
  const situational = /필요\s*시|필요시|예외|≠|상이|대표자 통화 불가|단체주문|공동대표|4천만원|신용\s*미달|카드 선납|사전답사|장애인|관공서|국가기관|비영리|명의변경|자동이체|지로|가상계좌/.test(s);   // 납부수단에 따라 갈리는 서류도 상황별
  return { holders: holders.size ? [...holders] : null, situational, text: s };
}

/** 계약정보 입력폼 명세 */
export function buildApplicationForm({ supplier, offer, model }) {
  const fileKind = offer?.source?.file_kind || supplier?.file_kind;
  const policy = pickPolicy(supplier?.signup_policy, fileKind);
  const holders = holderTypes(policy);
  const minAge = policy?.eligibility?.min_age ?? null;
  const maxAge = policy?.eligibility?.max_age ?? null;
  const payMethods = policy?.payment?.methods?.length ? policy.payment.methods : ['카드', '계좌이체'];
  const billingDays = (policy?.payment?.billing_days || []).slice().sort((a, b) => a - b);
  const daySelectable = policy?.payment?.billing_day_selectable !== false && billingDays.length > 0;
  const thirdPartyText = (policy?.payment?.third_party_payment || []).map((t) => t.text).join(' / ');
  const thirdPartyAllowed = !/^\s*불가/.test(thirdPartyText);
  const isTradeIn = offer?.offer_type === 'trade_in' || (offer?.offer_tags || []).some((t) => /타사보상|trade/.test(t));
  const isBundle = offer?.offer_type === 'bundle';
  const isPrepay = offer?.offer_type === 'prepay' || offer?.prepay_amount != null;
  const appFields = policy?.application_fields || [];
  const has = (key) => appFields.some((f) => f.key === key);

  const sections = [];
  const bizShow = { field: 'holder_type', in: BIZ.filter((b) => holders.includes(b)) };

  sections.push({
    id: 'customer', title: '계약자',
    fields: [
      { key: 'holder_type', label: '가입 명의', type: 'select', required: true, options: holders },
      { key: 'customer_name', label: '계약자 이름', type: 'text', required: true },
      { key: 'customer_phone', label: '휴대폰', type: 'tel', required: true, hint: (policy?.identity?.methods || []).join(' · ') || null },
      { key: 'birth_date', label: '생년월일', type: 'date', required: true,
        hint: minAge || maxAge ? `만 ${minAge ?? ''}${minAge ? '세 이상' : ''}${maxAge ? ` ${maxAge}세 이하` : ''}` : null, min_age: minAge, max_age: maxAge },
      { key: 'customer_email', label: '이메일', type: 'email', required: false, required_if: has('email') ? bizShow : null },
    ],
  });

  if (bizShow.in.length) {
    sections.push({
      id: 'business', title: '사업자 정보', show_if: bizShow,
      fields: [
        { key: 'biz_name', label: '상호(법인명)', type: 'text', required: true },
        { key: 'biz_number', label: '사업자등록번호', type: 'text', required: true, pattern: '^\\d{3}-?\\d{2}-?\\d{5}$' },
        { key: 'biz_owner', label: '대표자명', type: 'text', required: true },
        ...(has('tax_invoice_request') || has('tax_invoice_type')
          ? [{ key: 'tax_invoice', label: '계산서', type: 'select', required: false, options: ['세금계산서', '현금영수증', '필요없음'] }] : []),
      ],
    });
  }
  if (holders.includes('외국인')) {
    sections.push({
      id: 'foreigner', title: '외국인', show_if: { field: 'holder_type', in: ['외국인'] },
      fields: [
        { key: 'foreigner_visa', label: '체류자격(비자)', type: 'text', required: has('foreigner_visa') },
        { key: 'foreigner_stay_until', label: '체류 만료일', type: 'date', required: false },
      ],
    });
  }

  sections.push({
    id: 'install', title: '설치',
    fields: [
      { key: 'customer_address', label: '설치 주소', type: 'address', required: true },
      { key: 'customer_address_detail', label: '상세 주소', type: 'text', required: true },
      { key: 'installation_date', label: '설치 희망일', type: 'date', required: false },
      { key: 'installation_time', label: '설치 희망 시간', type: 'select', required: false, options: ['오전', '오후', '협의'] },
      ...(has('install_address_proof') || has('lease_contract_doc')
        ? [{ key: 'install_address_differs', label: '등록(전입·사업자) 주소와 설치 주소가 다름', type: 'checkbox', required: false, hint: '다르면 임대차계약서 등 증빙이 필요할 수 있음' }] : []),
      ...(has('site_survey') ? [{ key: 'site_survey', label: '사전답사 대상 제품', type: 'checkbox', required: false }] : []),
    ],
  });

  const payFields = [
    { key: 'payment_method', label: '납부 수단', type: 'select', required: true, options: payMethods },
  ];
  if (daySelectable) payFields.push({ key: 'billing_day', label: '결제일', type: 'select', required: true, options: billingDays.map(String), hint: policy?.payment?.billing_day_rule || null });
  if (thirdPartyText) {
    payFields.push({ key: 'third_party_payer', label: '다른 사람 명의로 납부', type: 'checkbox', required: false, hint: thirdPartyText, disabled: !thirdPartyAllowed });
    if (thirdPartyAllowed) {
      payFields.push({ key: 'payer_name', label: '납부자 이름', type: 'text', required: true, show_if: { field: 'third_party_payer', truthy: true } });
      payFields.push({ key: 'payer_relation', label: '계약자와 관계', type: 'text', required: true, show_if: { field: 'third_party_payer', truthy: true } });
    }
  }
  sections.push({ id: 'payment', title: '납부', fields: payFields, notice: '카드번호·계좌번호는 여기 적지 않습니다. 렌탈사 본인인증·해피콜에서 고객이 직접 등록합니다.' });

  if (isTradeIn) {
    sections.push({
      id: 'trade_in', title: '타사보상',
      fields: [
        { key: 'trade_in_brand', label: '기존 사용 렌탈사/브랜드', type: 'text', required: true },
        { key: 'trade_in_model', label: '기존 제품명', type: 'text', required: false },
        ...(has('trade_in_watermark_no') ? [{ key: 'trade_in_watermark_no', label: '물마크(검사필증) 번호', type: 'text', required: true }] : []),
        ...(has('trade_in_removal') ? [{ key: 'trade_in_removal', label: '기존 제품 철거 요청', type: 'select', required: true, options: ['철거 요청', '고객 자체 처리'] }] : []),
      ],
    });
  }
  if (isBundle) {
    sections.push({
      id: 'bundle', title: '결합',
      fields: [
        { key: 'bundle_kind', label: '결합 구분', type: 'select', required: true, options: ['신규 결합(동시 가입)', '기존 계정 결합'] },
        { key: 'bundle_existing_holder', label: '기존 계정 명의자', type: 'text', required: false, show_if: { field: 'bundle_kind', in: ['기존 계정 결합'] } },
        { key: 'bundle_existing_product', label: '기존 이용 제품', type: 'text', required: false, show_if: { field: 'bundle_kind', in: ['기존 계정 결합'] } },
      ],
    });
  }
  if (isPrepay) {
    sections.push({
      id: 'prepay', title: '선납',
      fields: [
        { key: 'prepay_confirmed', label: `선납금 ${offer?.prepay_amount ? offer.prepay_amount.toLocaleString() + '원 ' : ''}안내 완료`, type: 'checkbox', required: true },
        { key: 'prepay_method', label: '선납 결제 방법', type: 'select', required: true, options: ['카드', '가상계좌'] },
      ],
    });
  }

  sections.push({
    id: 'consent', title: '고객 동의 (구두 확인)',
    fields: [
      { key: 'consent_privacy', label: '개인정보 수집·이용 동의', type: 'checkbox', required: true },
      { key: 'consent_third_party', label: `개인정보 제3자(${supplier?.name || '렌탈사'}) 제공 동의`, type: 'checkbox', required: true },
      { key: 'consent_credit', label: '신용정보 조회 동의', type: 'checkbox', required: true },
      { key: 'consent_marketing', label: '마케팅 수신 동의', type: 'checkbox', required: false },
    ],
  });
  sections.push({ id: 'memo', title: '상담 메모', fields: [{ key: 'notes', label: '메모', type: 'textarea', required: false }] });

  // 명의별 필요 서류 (계약처리에서 수령 체크)
  const documents = buildDocuments(appFields, { isTradeIn });

  // 상담원 안내
  const notices = [];
  const credit = policy?.credit || {};
  const creditText = (credit.notes || []).map((n) => n.text).join(' / ');
  if (creditText) notices.push({ kind: 'credit', text: `신용: ${creditText}` });
  if (credit.fallback) notices.push({ kind: 'credit', text: `신용 미달 시: ${credit.fallback}` });
  for (const s of policy?.process?.steps || []) notices.push({ kind: 'process', text: s });
  for (const r of policy?.rules?.prior_application || []) notices.push({ kind: 'rule', text: `선접수: ${r.text}` });
  for (const r of policy?.rules?.bundle || []) if (isBundle) notices.push({ kind: 'rule', text: `결합: ${r.text}` });
  for (const r of policy?.rules?.trade_in || []) if (isTradeIn) notices.push({ kind: 'rule', text: `타사보상: ${r.text}` });
  const asOf = policy?.as_of || supplier?.signup_policy_as_of || null;
  if (asOf && asOf < '2026-08') notices.push({ kind: 'stale', text: `가입기준 자료가 ${asOf} 기준입니다. 최신 여부를 렌탈사에 확인하세요.` });
  if (!policy) notices.push({ kind: 'stale', text: '이 렌탈사 가입기준 자료가 없습니다. 기본 항목만 받습니다.' });

  return {
    supplier: { id: supplier?.id, name: supplier?.name, policy_as_of: asOf, contacts: policy?.contacts || null },
    offer_summary: offer ? {
      ticket_number: offer.ticket_number, model: model?.model_code || model?.model_key, product_name: model?.product_name,
      contract_months: offer.contract_months, care: offer.care_label, offer_type: TYPE_LABEL[offer.offer_type] || offer.offer_type,
    } : null,
    sections, documents, notices,
  };
}

function buildDocuments(appFields, { isTradeIn }) {
  const docs = [];
  const seen = new Set();
  for (const f of appFields) {
    if (!/_doc$|_docs$|proof/.test(f.key)) continue;
    const cond = conditionOf(f.applies_to);
    if (cond.offer === 'trade_in' && !isTradeIn) continue;
    const id = `${f.key}|${f.applies_to}`;
    if (seen.has(id)) continue;
    seen.add(id);
    docs.push({
      key: f.key, label: f.label, when: f.applies_to === 'all' ? '공통' : f.applies_to,
      holders: cond.always ? HOLDER_ALL : cond.holders, flag: cond.flag || null,
      situational: !!cond.situational, note: f.note || null,
    });
  }
  return docs;
}

function visible(field, data) {
  const c = field.show_if;
  if (!c) return true;
  if (c.truthy) return !!data[c.field];
  return (c.in || []).includes(data[c.field]);
}

function ageOn(birth, today = new Date()) {
  const b = new Date(birth);
  if (Number.isNaN(b.getTime())) return null;
  let age = today.getFullYear() - b.getFullYear();
  if (today.getMonth() < b.getMonth() || (today.getMonth() === b.getMonth() && today.getDate() < b.getDate())) age--;
  return age;
}

/** 폼 명세로 입력값 검증 → { ok, errors:[{key,message}], data(보이는 필드만) } */
export function validateApplication(form, input, { today = new Date() } = {}) {
  const data = {};
  const errors = [];
  for (const section of form.sections) {
    if (!visible(section, input)) continue;
    for (const f of section.fields) {
      if (!visible(f, input)) continue;
      let v = input[f.key];
      if (typeof v === 'string') v = v.trim();
      const required = f.required || (f.required_if && visible({ show_if: f.required_if }, input));
      const empty = v == null || v === '' || (f.type === 'checkbox' && v !== true);
      if (required && empty) { errors.push({ key: f.key, message: `${f.label}: 필수` }); continue; }
      if (empty) continue;
      if (f.type === 'select' && f.options && !f.options.map(String).includes(String(v))) {
        errors.push({ key: f.key, message: `${f.label}: 선택지에 없는 값` }); continue;
      }
      if (f.pattern && !new RegExp(f.pattern).test(String(v))) { errors.push({ key: f.key, message: `${f.label}: 형식 오류` }); continue; }
      if (f.type === 'tel' && !/^01\d-?\d{3,4}-?\d{4}$/.test(String(v))) { errors.push({ key: f.key, message: `${f.label}: 휴대폰 형식 오류` }); continue; }
      if (f.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v))) { errors.push({ key: f.key, message: `${f.label}: 이메일 형식 오류` }); continue; }
      if (f.key === 'birth_date') {
        const age = ageOn(v, today);
        if (age == null) { errors.push({ key: f.key, message: '생년월일 형식 오류' }); continue; }
        if (f.min_age != null && age < f.min_age) { errors.push({ key: f.key, message: `만 ${f.min_age}세 미만은 가입 불가 (만 ${age}세)` }); continue; }
        if (f.max_age != null && age > f.max_age) { errors.push({ key: f.key, message: `만 ${f.max_age}세 초과는 가입 불가 (만 ${age}세)` }); continue; }
      }
      data[f.key] = v;
    }
  }
  return { ok: errors.length === 0, errors, data };
}

/** 계약처리 상세 — 이 계약에 필요한 진행 체크리스트 */
export function buildProcessChecklist(form, application = {}) {
  const holder = application.holder_type;
  const items = [];
  for (const d of form.documents) {
    const holderMatch = !d.holders || d.holders.includes(holder);
    const flagMatch = !d.flag || application[d.flag];
    if (!holderMatch || !flagMatch) continue;
    // 같은 서류가 여러 조건으로 나오면 한 줄로 — 하나라도 무조건 필요하면 필수
    const prev = items.find((x) => x.group === '서류' && x.label === d.label);
    if (prev) { if (!d.situational) { prev.required = true; prev.when = d.when; } continue; }
    items.push({ key: `doc:${d.key}`, group: '서류', label: d.label, required: !d.situational, when: d.when, note: d.note });
  }
  const contacts = form.supplier?.contacts;
  items.push(
    { key: 'identity_verified', group: '렌탈사 접수', label: '본인인증 완료', required: true },
    { key: 'esign_sent', group: '렌탈사 접수', label: '전자서명(알림톡) 발송', required: true },
    { key: 'esign_done', group: '렌탈사 접수', label: '전자서명 완료', required: true },
    { key: 'supplier_order_no', group: '렌탈사 접수', label: '렌탈사 주문(접수)번호', type: 'text', required: true },
    { key: 'happy_call_done', group: '렌탈사 접수', label: `해피콜 완료${contacts?.happy_call?.length ? ` (발신 ${contacts.happy_call.join('/')})` : ''}`, required: true },
    { key: 'install_scheduled', group: '설치', label: '설치일 확정', type: 'date', required: true },
    { key: 'install_done', group: '설치', label: '설치 완료', type: 'date', required: true },
  );
  return items;
}
