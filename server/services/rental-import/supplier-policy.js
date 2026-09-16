/**
 * rental-import/supplier-policy.js
 * ------------------------------------------------------------------
 * 빌리고 "렌탈사 가입기준 및 정책" 엑셀 → 렌탈사별 구조화 정책 레코드.
 *
 * 시트 구조(양 파일 공통):
 *   - B2 제목(렌탈사명). 좌측 표: B=항목, C~K=내용(병합). B 가 빈 행은 윗 항목의 이어지는 내용.
 *   - 우측 M~Z: "진행 FLOW 관련 메뉴얼" 블록(번호 제목 + 본문) — 필요서류·선납·명의변경 예외 등이 섞여 있다.
 *   - 삽입 이미지(xl/drawings) — 신용한도표·전자서명 절차 등. 내용은 사람이 확인한 요약(IMAGE_NOTES, md5 키).
 *
 * 원칙: 원문에 없는 값은 만들지 않는다. 구조화 필드(min_age·billing_days 등)는 원문 정규식 추출이고,
 *       모든 비어있지 않은 셀은 어느 필드의 source 로 기록되거나 unclassified 에 남는다(coverage 로 검증).
 * ------------------------------------------------------------------
 */
import crypto from 'crypto';
import xlsx from 'xlsx';

const clean = (v) => (v == null ? '' : String(v).replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim());
const flat = (s) => clean(s).replace(/\s+/g, ' ');
const nospace = (s) => clean(s).replace(/\s/g, '');

// ── 이미지 요약 (각 이미지를 직접 열어 확인한 내용, md5 앞 6자리 키) ─────────────
const IMAGE_NOTES = {
  '9e126e': '코웨이 전자서명 절차(알림톡 고객인증 → 주문확인·서명 → 약관 동의 → 전자계약서 확인 → 서명 입력 → 주문확정)',
  '6ab986': '코웨이 회수비 정책: 고객사정 반환 시 제품군별 회수비(정수기 4만·청정기/비데/연수기 3만·매트리스/프레임/의류청정기 5만·전기레인지 4만·안마의자 9만), 14일내 반환·재렌탈·자사귀책 면제, 사망 시 위약금 면제·회수비 청구 / 일시불 사용고객 신규 시 기존제품 반환여부·멤버십 상태 확인',
  '1af33f': '코웨이 변칙 신규접수 및 재접수 기준: 신규설치 후 9개월 내 기존(동일제품군) 반환=변칙(수수료 100% 되물림+익월 건수 차감), 반환 후 9개월 내 신규=재접수(14일내·9개월내), 자진신고 절차',
  '9e7295': '쿠쿠 전자계약서 작성 예시(알림톡 → 인증방법 선택: 휴대폰/신용카드/카카오/ARS → 주문정보·납부정보 확인 → 약관·필수동의 → 서명 → 계약서 다운로드)',
  'a7c506': '쿠쿠 철거후 재설치 인정기준: 계약자 기준, 당월 철거·설치 불인정, 철거 180일 이후/제품군 다름/만기 철거/추가 설치건 인정',
  '06daa7': '쿠쿠 사다리 및 양중작업 비용표(층수·단품/셋트별 계단 양중 2~14만원, 사다리 8~30만원)',
  'afe60f': '청호 위탁상품군 출고·설치 프로세스(영업본부 접수 → 컨택센터 출고의뢰 → 업체 발주확인(+2일) → 설치일정 컨택 → 설치예정일 전산등록·판매인 알림톡 → 배송/설치 → 결과입력 → 매출확정)',
  '4a793e': '교원웰스 대면 서명 알림톡 프로세스(알림톡 계약자 서명 → 서명칸 → 이름 서명 → 완료 팝업)',
  '51027b': '세라젬 교환 및 반품안내(분실료, 중도해약 14일 전후 30만원(등록비20+회수비10)+위약금·사은품 반환, 위약금=구독료×잔여회차×10%, 선납금 반환 규정)',
  '5c81cb': '세라젬 구매 반품/교환 정보(치명적 결함 설치 후 7일 이내, 설치 전 취소 가능, 설치 후 7일 내 취소 시 설치/회수비 20만원, 단순변심·소음 등 불가)',
  'cd0927': '세라젬 AS·배송안내(구독 60개월 무상수리, 무료배송/등록비·설치비 면제, 구매일 3일 내 해피콜·10일 내 배송)',
  '75b4b6': '세라젬 밸런스 렌탈 청구 예시(1회차 청구일=설치 익월 결제일, 단 설치 후 14일 미경과 시 그 다음달)',
  '924828': '풀무원 빌리고 고객 계약/배송 프로세스(고객유치 → 고객정보 풀무원 전달(메일/모바일) → 상담 → 전자계약서 발송 → 서명 시 계약체결 → 매월 워터팩 배송·자동결제)',
  '5ee749': '정수기 배관공사/사전확인 프로세스(SK매직·코웨이: 사전답사 요청(고객명·연락처·주소·설치예정제품·사유·위치/현장사진) → 본사 승인 → 기사 방문; 쿠쿠: 사전답사 없음, 접수 후 공사 필요 시 비용 안내·공사 후 접수처 전달·일정 재조율)',
  '169be0': 'LG헬로비전 가입기준표: 신용등급(Blue1~3/Green4~5/Yellow6)×TPS결합/렌탈단독×신용카드/자동이체별 총렌탈료 한도(1,100만~180만), 리스크상품(노트북·무선청소기) 계정수·선납프로세스(상품가 30% 선납)',
  'c96a59': 'LG헬로비전 신용등급별 계정(회선)수·품목 제한(Blue 1~4회선 전품목, Green 1~2, Yellow 1~2 — 5·60대 여성 전품목 / 그 외 에어컨·냉난방기·공기청정기·로봇청소기·음식물처리기)',
  '493f77': '스마트 사업자 계약 FLOW(서류접수: 사업자등록증·결제정보(통장/카드사본)·대표자 신분증·연락처·제품정보 → SGI 개인정보 동의 → 보증보험 심사(1~2영업일) → 전자계약서 → 설치)',
  '1e8b5c': '유버스 신용등급/한도: 개인·개인사업자 일반가전/공조류 금융사 1~7등급 승인 시 1천만원(1~3등급 최대2대·4~6등급 1대), 부결 시 자체심사 1~3등급 600만·4등급 400만·5~6등급 300만(2차심사), 법인 B+ 2천만(개시1년·매출50억·흑자), 비영리 국가지원 증빙 1천만',
  '8312ca': '렌타나 업무 프로세스/접수기준: 개인·개인사업자(15백만 미만) 만25~70세·본인명의 휴대폰·외국인 불가·개인 명변 불가·사업자등록증 주소지만 설치, 법인(중소) 15백만 기준 분기, 대기업/관공서 서류(위임장·재직증명서·법인인감증명서), 선접수 5일',
  '321175': '렌타나 결제방법: 카드(개인·개인사업자, 법인카드X), 제휴카드(개인·개인사업자, 세금계산서X), CMS(개인/사업자/관공서), 가상계좌(개인 지양·관공서/공공기관), 지로 불가',
  '8b2c01': '소노 적용범위 및 증빙서류: 수령지(본인/가족 자택·직장·타인주소) 가능여부표, 증빙(가족관계증명서·가족 신분증/등본·실물명함 or 사업자등록증), 3개월 이내 발급·주민번호 뒷자리 마스킹, 가족 신분증 주소=설치주소 필수',
  '9ee683': '소노 계약 진행 현황 상태값(신용조회 → 실적등록 후 계약서발송 → 렌탈계약서 작성완료 → 상조계약서 작성완료 → 해피콜 → 출금완료)',
};

// ── 항목 라벨 → 필드 ───────────────────────────────────────────
const LABEL_RULES = [
  [/가입명의자구분/, 'eligibility.holder'],
  [/예외품의.*서류/, 'required_documents.exception'],
  [/(사업자)?.*(필요서류|필요서류)/, 'required_documents'],
  [/^연령$/, 'eligibility.age'],
  [/실명인증/, 'identity'],
  [/신용심사/, 'credit'],
  [/예외승인/, 'credit.exception'],
  [/RISK/i, 'credit.risk'],
  [/가입한도|^한도$/, 'credit.limit'],
  [/동일품목제한/, 'credit.limit'],
  [/납부수단/, 'payment.methods'],
  [/타명의결제/, 'payment.third_party'],
  [/결제일/, 'payment.billing_day'],
  [/명의변경/, 'rules.name_change'],
  [/교환및해지|해지규정/, 'rules.cancel_exchange'],
  [/선접수/, 'rules.prior_application'],
  [/고객센터연락처/, 'contacts.customer_center'],
  [/고객센터운영시간/, 'contacts.hours'],
  [/해피콜발신/, 'contacts.happy_call'],
  [/해피콜운영/, 'contacts.happy_call_hours'],
  [/되물림|환수/, 'rules.clawback'],
  [/타사보상/, 'rules.trade_in'],
  [/^결합$/, 'rules.bundle'],
  [/신규접수기준/, 'rules.recontract'],
  [/수수료인정기준/, 'rules.commission_recognition'],
  [/14일이내제품변경|매변/, 'rules.product_change_14d'],
  [/사전답사/, 'process.pre_check'],
  [/특이사항|기타계약조건|예외승인$/, 'rules.special'],
];
// 쿠쿠 '예외승인'(계약서·해피콜 없이 승인)은 credit.exception 과 의미가 달라 special 로 — 라벨 완전일치일 때만
const labelField = (label) => {
  const k = nospace(label).replace(/\d\)$/, '');
  if (k === '예외승인') return 'rules.special';
  for (const [re, f] of LABEL_RULES) if (re.test(k)) return f;
  return null;
};

const PHONE_RE = /(?:0\d{1,2}-\d{3,4}-\d{4}|1[5-9]\d{2}-\d{4}|\b100\b)/g;

function sheetAsOf(sheetName, fileMonth) {
  const m = sheetName.match(/\((\d{2})\.(\d{2})\)\s*$/);
  return m ? `20${m[1]}-${m[2]}` : fileMonth;
}
function supplierName(title, sheetName) {
  const t = clean(title);
  const p = t.match(/\(\s*([^)]+?)\s*\)/);
  if (/가입정책/.test(t) && p) return p[1];
  return t || sheetName.replace(/\(\d{2}\.\d{2}\)$/, '');
}

// ── 텍스트 → 구조화 추출 ─────────────────────────────────────────
const HOLDER_WORDS = [
  ['개인사업자', /개인\s*\(?\s*개인사업자|개인사업자/], ['법인', /법인/], ['외국인', /외국인(?![^()]*불가)/],
  ['비영리단체', /비영리/], ['관공서/공공기관', /관공서|공공기관|공기업/], ['대기업', /대기업/], ['고유번호증', /고유번호증/],
];
function parseHolder(text) {
  const t = flat(text);
  const types = [];
  if (/개인/.test(t)) types.push('개인');
  for (const [name, re] of HOLDER_WORDS) if (re.test(t) && !types.includes(name)) types.push(name);
  if (/사업자/.test(t) && !types.some((x) => /사업자|법인/.test(x)) && !/사업자\s*(명의\s*진행\s*)?불가/.test(t)) types.push('사업자');
  const excluded = [];
  for (const m of t.matchAll(/\(([^)]*불가[^)]*)\)/g)) excluded.push(m[1].trim());
  if (/외국인\s*진행\s*불가|외국인,\s*사업자\s*불가/.test(t)) { const i = types.indexOf('외국인'); if (i >= 0) types.splice(i, 1); }
  if (/사업자\s*불가|사업자 명의 진행 불가/.test(t)) { const i = types.indexOf('사업자'); if (i >= 0) types.splice(i, 1); }
  return { types, excluded };
}
function parseAge(text) {
  const t = flat(text);
  const range = t.match(/(만|연|한국)?\s*(?:나이)?\s*(\d{2})\s*세?\s*~\s*(?:만\s*)?(\d{2})\s*세/);
  if (range) return { min_age: +range[2], max_age: +range[3], age_basis: range[1] || null };
  const r2 = t.match(/(만|연)?\s*(\d{2})\s*~\s*(\d{2})\s*세/);
  if (r2) return { min_age: +r2[2], max_age: +r2[3], age_basis: r2[1] || null };
  const min = t.match(/(만|연)?\s*(\d{2})\s*세\s*(이상)?/);
  if (min) return { min_age: +min[2], max_age: null, age_basis: min[1] || null };
  return { min_age: null, max_age: null, age_basis: null };
}
function parseCredit(text) {
  const t = flat(text);
  const bureau = /나이스|NICE/i.test(t) ? 'NICE' : /KCB|올크레딧/.test(t) ? 'KCB' : /SGI/.test(t) ? 'SGI' : /금융사/.test(t) ? '금융사' : null;
  const score = t.match(/(\d{3})\s*점\s*이상/) || t.match(/~\s*(\d{3})\s*점/);
  const grade = t.match(/(\d{1,2})\s*등급\s*(이내|이상|까지)?/) || t.match(/~\s*(\d{1,2})\s*등급/);
  const youth = t.match(/\(\s*20대는[^)]*\)/);
  const fallback = /선납/.test(t) ? t.match(/[^/]*선납[^/]*/)?.[0].trim() : null;
  return { bureau, min_score: score ? +score[1] : null, max_grade: grade ? +grade[1] : null, youth_rule: youth ? youth[0].replace(/[()]/g, '').trim() : null, fallback };
}
const PAY_WORDS = [['카드', /카드/], ['신용카드', /신용카드/], ['체크카드', /체크카드(?!\s*불가)/], ['계좌이체', /계좌이체|자동이체/], ['CMS', /CMS(?!\s*불가)/], ['가상계좌', /가상계좌(?!\s*불가)/], ['지로', /지로(?!\s*불가)/], ['KT요금합산', /KT\s*요금과\s*합산/]];
function parseMethods(text) {
  const t = flat(text);
  const out = [];
  for (const [n, re] of PAY_WORDS) if (re.test(t)) out.push(n);
  if (out.includes('신용카드') || out.includes('체크카드')) { const i = out.indexOf('카드'); if (i >= 0 && !/(^|[^용크])카드/.test(t.replace(/신용카드|체크카드/g, ''))) out.splice(i, 1); }
  if ((out.includes('신용카드') || out.includes('체크카드')) && out.includes('카드')) out.splice(out.indexOf('카드'), 1);
  const not = [...t.matchAll(/([가-힣A-Z]+)\s*(불가|X)\b/g)].map((m) => m[1]);
  return { methods: out, not_allowed: not };
}
function parseBillingDays(text) {
  const lines = clean(text).split('\n');
  const t = flat(lines.length > 1 && /계약 개시일/.test(text) ? lines[0] : text);
  const fixed = /고정/.test(t);
  const nums = [...t.matchAll(/(\d{1,2})\s*(?=일|,|\/|\s|$)/g)].map((m) => +m[1]).filter((n) => n >= 1 && n <= 31);
  const uniq = [...new Set(nums)];
  const auto = /확정/.test(clean(text));
  return { billing_days: uniq, billing_day_selectable: auto || fixed ? false : uniq.length > 1 ? true : null, billing_day_rule: auto ? '설치완료일 기준 자동 확정' : null, any_day: /일자에 상관 없이/.test(t) };
}
const phones = (t) => [...new Set(flat(t).match(PHONE_RE) || [])];

// ── 서류 항목 사전 (원문 토큰 → 신청폼 key) ────────────────────────
const DOC_KEYS = [
  [/^(?!사업자\s+등록증\s*\().*사업자등록증명원/, 'biz_registration_cert_doc', '사업자등록증명원'],
  [/사업자\s*(등록)?증|사업자증/, 'biz_registration_doc', '사업자등록증'],
  [/고유번호증/, 'nonprofit_id_doc', '고유번호증'],
  [/이메일/, 'email', '이메일주소'],
  [/결제정보|통장\s*사본|카드\s*(정보|사본|실물)|자동이체\s*(사본|\()|출금이체신청서|법인통장/, 'payment_info_doc', '결제정보(통장사본/카드정보)'],
  [/법인\s*인감증명|인감증명|임감증명|본인서명사실/, 'seal_certificate_doc', '인감증명서'],
  [/위임장/, 'power_of_attorney_doc', '위임장'],
  [/재직증명|명함|사원증/, 'employment_proof_doc', '재직증명서/명함'],
  [/공무원증/, 'public_officer_id_doc', '대리인 공무원증'],
  [/대리인\s*신분증|대리인 신분증/, 'agent_id_doc', '대리인 신분증'],
  [/신분증|외국인\s*등록증/, 'id_card_doc', '신분증'],
  [/임대차\s*계약서|부동산\s*계약서/, 'lease_contract_doc', '임대차(부동산)계약서'],
  [/가족관계증명/, 'family_relation_doc', '가족관계증명서'],
  [/등기부\s*등본/, 'registry_doc', '등기부등본'],
  [/계산서\s*종류|세금계산서\s*or\s*현금영수증/, 'tax_invoice_type', '계산서종류(세금계산서/현금영수증)'],
  [/대표자\s*연락처|연락처/, 'representative_phone', '대표자 연락처'],
  [/영업신고증/, 'business_permit_doc', '영업신고증'],
  [/주주명부/, 'shareholder_list_doc', '주주명부'],
  [/외부사진|내부사진|사진/, 'site_photo_doc', '현장/매장 사진'],
  [/수기작성계약서/, 'paper_contract_doc', '수기작성계약서'],
  [/감사보고서|재무제표/, 'financial_statement_doc', '감사보고서/재무제표'],
  [/복지카드/, 'welfare_card_doc', '복지카드 사본'],
  [/기본증명서|법정대리인/, 'guardian_doc', '법정대리인 서류'],
  [/공동인증서|공인인증서/, 'certificate_auth', '공동(공인)인증서'],
  [/건강보험자격득실|전역증/, 'age_exception_doc', '25세 미만 예외심사 증빙'],
];
function docItems(text) {
  const items = [];
  for (const part of clean(text).split(/\s*(?:\/\/|\/|,|\+|⏎|\n| - |·)\s*/)) {
    const p = part.replace(/^[\s\-└ㄴ①②③ⓐⓑⓒ\d.)]+/, '').trim();
    if (!p || /\s[xX]\.?\s*\)?$|^[xX]\b/.test(p)) continue;
    for (const [re, key, label] of DOC_KEYS) {
      if (re.test(p)) { if (!items.some((i) => i.key === key)) items.push({ key, label, raw: p }); break; }
    }
  }
  return items;
}
const HOLDER_SPLIT = /(개인사업자\s*\(\s*대표자\s*:\s*외국인\s*\)|개인\s*\/\s*법인\s*사업자|개인\s*및\s*법인사업자|개인\s*\(\s*개인사업자\s*\)|개인사업자|법인사업자|법인\s*\(\s*국가기관\s*\)|관공서\s*\/\s*공공기관|비영리법인(?:\s*\([^)]*\))?|\(\s*대리인\s*\)|대리인\s*가입시|\[\s*개인사업자\s*\]|\[\s*개인\s*\]|\[\s*법인,\s*고유번호증\s*\]|●\s*[^⏎]*?신규[^⏎]*|^개인(?=\s|$))/m;
function splitDocsByHolder(raw) {
  const text = clean(raw).replace(/\n/g, ' ⏎ ');
  const out = [];
  const tokens = text.split(HOLDER_SPLIT).filter((s) => s != null && s.trim() !== '');
  let holder = null;
  const push = (when, body) => {
    const items = docItems(body);
    if (!items.length) return;
    out.push({ holder_type: holder || '공통', when, items: items.map((i) => i.label), keys: items.map((i) => i.key), raw: flat(body) });
  };
  for (const tok of tokens) {
    if (HOLDER_SPLIT.test(tok) && tok.length < 40) { holder = tok.replace(/[[\]●:]/g, '').trim(); continue; }
    const body = tok.replace(/^\s*:\s*/, '');
    // "조건 : 서류" 줄(주소지 =/≠ 설치주소 등)은 줄 단위로 분리 — 조건별 서류가 다르다
    const condLines = body.split('⏎').map((l) => l.replace(/^\s*-\s*/, '').trim()).filter((l) => /^[^:]*(주소지|시)\s*[^:]*:\s*\S/.test(l) && /주소지/.test(l));
    if (condLines.length) {
      for (const l of condLines) {
        const [cond, docs] = l.split(/\s*:\s*/);
        if (/불필요/.test(docs)) out.push({ holder_type: holder || '공통', when: cond.trim(), items: [], keys: [], raw: l, none_required: true });
        else push(cond.trim(), docs);
      }
      const rest = body.split('⏎').filter((l) => !condLines.includes(l.replace(/^\s*-\s*/, '').trim())).join('⏎');
      if (docItems(rest).length) push(null, rest);
      continue;
    }
    const when = body.match(/자동이체\s*시|필요\s*시|3개월\s*이내\s*발급[^,)⏎]*/)?.[0] || null;
    push(when, body);
  }
  return out;
}

// ── 워크북 파서 ────────────────────────────────────────────────
function sheetImageMap(wb) {
  const files = wb.files || {};
  const read = (p) => files[p]?.content;
  const text = (p) => { const c = read(p); return c ? Buffer.from(c).toString('utf8') : ''; };
  const wbRels = text('xl/_rels/workbook.xml.rels');
  const ridTarget = {};
  for (const m of wbRels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = m[0].match(/Id="([^"]+)"/)?.[1]; const tg = m[0].match(/Target="([^"]+)"/)?.[1];
    if (id && tg) ridTarget[id] = tg.replace(/^\/?xl\//, '');
  }
  const out = {};
  for (const m of text('xl/workbook.xml').matchAll(/<sheet\b[^>]*>/g)) {
    const name = m[0].match(/name="([^"]+)"/)?.[1]?.replace(/&amp;/g, '&');
    const rid = m[0].match(/r:id="([^"]+)"/)?.[1];
    const sp = 'xl/' + ridTarget[rid];
    const rels = text(sp.replace(/worksheets\//, 'worksheets/_rels/') + '.rels');
    const imgs = [];
    for (const d of rels.matchAll(/Target="([^"]*drawings\/drawing\d+\.xml)"/g)) {
      const dp = 'xl/drawings/' + d[1].split('/').pop();
      const dx = text(dp);
      const drels = text(dp.replace('drawings/', 'drawings/_rels/') + '.rels');
      const rmap = {};
      for (const r of drels.matchAll(/<Relationship\b[^>]*>/g)) rmap[r[0].match(/Id="([^"]+)"/)?.[1]] = r[0].match(/Target="([^"]+)"/)?.[1];
      for (const a of dx.matchAll(/<xdr:(twoCellAnchor|oneCellAnchor)[\s\S]*?<\/xdr:\1>/g)) {
        const emb = a[0].match(/r:embed="([^"]+)"/)?.[1];
        if (!emb) continue;
        const col = +a[0].match(/<xdr:col>(\d+)/)[1]; const row = +a[0].match(/<xdr:row>(\d+)/)[1];
        const file = (rmap[emb] || '').split('/').pop();
        const content = read('xl/media/' + file);
        const md5 = content ? crypto.createHash('md5').update(Buffer.from(content)).digest('hex').slice(0, 6) : null;
        imgs.push({ file, anchor_cell: xlsx.utils.encode_cell({ c: col, r: row }), md5, note: IMAGE_NOTES[md5] || null });
      }
    }
    out[name] = imgs;
  }
  return out;
}

export function parseSupplierPolicyWorkbook(input, { fileMonth = null } = {}) {
  const wb = xlsx.read(input, { type: Buffer.isBuffer(input) ? 'buffer' : 'array', bookFiles: true });
  const images = sheetImageMap(wb);
  const policies = [];
  const coverage = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const range = xlsx.utils.decode_range(ws['!ref'] || 'A1');
    const cells = [];
    for (let r = range.s.r; r <= range.e.r; r++) for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = xlsx.utils.encode_cell({ r, c }); const v = ws[addr]?.v;
      if (v != null && clean(v) !== '') cells.push({ addr, r, c, text: clean(v), indented: /^[ \t\u3000]/.test(String(v).replace(/^\s*\n/, '')) });
    }
    const covered = new Set();
    const use = (addr) => covered.add(addr);
    const at = (r, c) => cells.find((x) => x.r === r && x.c === c);

    const title = at(1, 1)?.text || '';
    if (title) use('B2');
    const p = {
      supplier: supplierName(title, sheetName), sheet: sheetName, as_of: sheetAsOf(sheetName, fileMonth), kind: 'supplier',
      eligibility: { holder_types: [], excluded: [], min_age: null, max_age: null, age_basis: null, notes: [] },
      identity: { methods: [], notes: [] },
      credit: { bureau: null, min_score: null, max_grade: null, youth_rule: null, fallback: null, exception: [], risk: [], limit: [], notes: [] },
      payment: { methods: [], not_allowed: [], third_party_payment: [], billing_days: [], billing_day_selectable: null, notes: [] },
      required_documents: [],
      application_fields: [],
      process: { steps: [], esign: null, happy_call_number: null, pre_check: [], flow: [] },
      rules: { name_change: [], prior_application: [], recontract: [], product_change_14d: [], clawback: [], clawback_repay: [], trade_in: [], bundle: [], cancel_exchange: [], commission_recognition: [], special: [] },
      contacts: { customer_center: [], customer_center_hours: null, happy_call: [], happy_call_hours: null },
      images: (images[sheetName] || []).map(({ md5, ...i }) => ({ ...i, md5 })),
      unclassified: [],
    };
    const src = (addr) => `${sheetName}!${addr}`;

    // 공통 프로세스 시트(배관공사)
    if (!title && /프로세스/.test(sheetName)) {
      p.supplier = '공통'; p.kind = 'process';
      for (const x of cells) { p.process.flow.push({ cell: x.addr, text: x.text }); use(x.addr); }
      p.process.pre_check.push(...p.images.map((i) => i.note).filter(Boolean));
      policies.push(p); coverage.push({ sheet: sheetName, cells: cells.length, covered: covered.size }); continue;
    }

    // 1) 좌측 표 B/C (A열 이미지 제외, D~K 는 C 병합 연장) — 이어지는 행은 윗 항목에 합친다
    const left = cells.filter((x) => x.c <= 10 && x.r >= 2);
    let cur = null;
    const entries = [];
    for (let r = 2; r <= range.e.r; r++) {
      const row = left.filter((x) => x.r === r);
      if (!row.length) continue;
      const b = row.find((x) => x.c === 1);
      const rest = row.filter((x) => x.c !== 1);
      if (b) { cur = { label: b.text, labelCell: b.addr, parts: [] }; entries.push(cur); use(b.addr); }
      for (const x of rest) {
        if (!cur) { p.unclassified.push({ cell: x.addr, label: null, text: x.text }); use(x.addr); continue; }
        cur.parts.push(x);
      }
    }
    // 렌플 각주 "2) 스마트렌탈과 달리…" 는 B 열 라벨로 들어온다 → 번호 각주는 해당 번호 라벨 항목 notes 로
    const footnotes = entries.filter((e) => /^\d\)\s/.test(e.label) && !e.parts.length);

    for (const e of entries) {
      if (footnotes.includes(e)) continue;
      const field = labelField(e.label);
      const text = e.parts.map((x) => x.text).join('\n');
      const refs = e.parts.map((x) => src(x.addr));
      const rec = { label: e.label, text, source: [src(e.labelCell), ...refs] };
      const mark = () => e.parts.forEach((x) => use(x.addr));
      if (!e.parts.length) {
        // 내용 없는 라벨: 이미지 섹션 제목(예: "4. 변칙판매 및 재접수 기준")
        const img = p.images.find((i) => xlsx.utils.decode_cell(i.anchor_cell).r >= xlsx.utils.decode_cell(e.labelCell).r - 1 && xlsx.utils.decode_cell(i.anchor_cell).r <= xlsx.utils.decode_cell(e.labelCell).r + 1);
        if (img) { p.rules.recontract.push({ ...rec, text: img.note, image: img.file }); continue; }
        if (!field) p.unclassified.push({ cell: e.labelCell, label: e.label, text: '' });
        else if (field.startsWith('rules.')) p.rules[field.split('.')[1]]?.push(rec);
        else p.unclassified.push({ cell: e.labelCell, label: e.label, text: '(내용 없음)' });
        continue;
      }
      mark();
      const note = footnotes.find((f) => nospace(e.label).endsWith(f.label.match(/^(\d\))/)[1]));
      if (note) { rec.text += `\n※ ${note.label}`; rec.source.push(src(note.labelCell)); }
      const dash = /^-$/.test(text.trim());
      switch (field) {
        case 'eligibility.holder': {
          // 첫 줄 = 명의 구분, 이어지는 행(C5 등) = 외국인/장애인/신분증 조건
          const [first, ...more] = e.parts;
          const h = parseHolder(first.text);
          p.eligibility.holder_types = h.types; p.eligibility.excluded = h.excluded;
          p.eligibility.notes.push({ text: first.text, source: src(first.addr) });
          for (const x of more) p.eligibility.notes.push({ text: x.text, source: src(x.addr) });
          break;
        }
        case 'eligibility.age': Object.assign(p.eligibility, parseAge(text)); p.eligibility.notes.push(rec); break;
        case 'identity': p.identity.methods = text.split(/\s*(?:\/|,| or |및)\s*/).map((s) => s.trim()).filter((s) => s && s !== '-'); p.identity.notes.push(rec); break;
        case 'credit': Object.assign(p.credit, Object.fromEntries(Object.entries(parseCredit(text)).filter(([, v]) => v != null))); p.credit.notes.push(rec); break;
        case 'credit.exception': if (!dash) p.credit.exception.push(rec); else p.credit.exception.push({ ...rec, text: null }); break;
        case 'credit.risk': p.credit.risk.push(dash ? { ...rec, text: null } : rec); break;
        case 'credit.limit': p.credit.limit.push(dash ? { ...rec, text: null } : rec); break;
        case 'payment.methods': { const m = parseMethods(text); p.payment.methods = m.methods; p.payment.not_allowed = m.not_allowed; p.payment.notes.push(rec); break; }
        case 'payment.third_party': p.payment.third_party_payment.push(rec); break;
        case 'payment.billing_day': Object.assign(p.payment, parseBillingDays(text)); p.payment.notes.push(rec); break;
        case 'required_documents': case 'required_documents.exception': {
          const groups = splitDocsByHolder(text).map((g) => ({ ...g, when: field.endsWith('exception') ? '예외 품의 진행시' : g.when, source: rec.source }));
          if (groups.length) p.required_documents.push(...groups);
          else p.required_documents.push({ holder_type: '공통', when: null, items: [], keys: [], raw: text, source: rec.source, ...(/서류\s*없음|^-$/.test(text.trim()) ? { none_required: true } : { refer: '우측 표/이미지 참고' }) });
          break;
        }
        case 'contacts.customer_center': p.contacts.customer_center = phones(text).length ? phones(text) : [text]; p.contacts.customer_center_raw = rec; break;
        case 'contacts.happy_call': p.contacts.happy_call = phones(text); p.contacts.happy_call_raw = rec; p.process.happy_call_number = phones(text)[0] || null; break;
        case 'contacts.hours': p.contacts.customer_center_hours = rec; break;
        case 'contacts.happy_call_hours': p.contacts.happy_call_hours = rec; break;
        case 'process.pre_check': p.process.pre_check.push(rec); break;
        default:
          if (field?.startsWith('rules.')) {
            const key = field.split('.')[1];
            if (key === 'clawback') {
              for (const x of e.parts) (/재지급/.test(x.text) ? p.rules.clawback_repay : p.rules.clawback).push({ label: e.label, text: x.text, source: [src(e.labelCell), src(x.addr)] });
            } else p.rules[key].push(dash ? { ...rec, text: null } : rec);
          } else {
            for (const x of e.parts) p.unclassified.push({ cell: x.addr, label: e.label, text: x.text });
          }
      }
    }
    for (const f of footnotes) if (!covered.has(f.labelCell)) { use(f.labelCell); p.rules.special.push({ label: '각주', text: f.label, source: [src(f.labelCell)] }); }

    // 2) 우측 블록(M 이후): 제목 셀(번호/●/[ ]) 기준으로 묶어 분류
    const right = cells.filter((x) => x.c >= 11 && x.r >= 1).sort((a, b) => a.r - b.r || a.c - b.c);
    let block = null;
    const blocks = [];
    for (const x of right) {
      use(x.addr);
      const firstLine = x.text.split('\n')[0];
      const isHead = (/^\s*(\d\.\s|●|\[\s*진행|■|◀|※ 동일)/.test(firstLine) || /프로세스$/.test(firstLine.trim())) && firstLine.length < 60 && !x.indented && (x.text.length < 40 || x.c === 12 || !/^\s*\d\./.test(firstLine));
      if (isHead || !block) {
        block = { head: isHead ? firstLine.trim() : '(본문)', cells: [] }; blocks.push(block);
        if (isHead) {
          block.headCell = x.addr;
          const rest = x.text.split('\n').slice(1).join('\n').trim();
          if (rest) block.cells.push({ ...x, text: rest });
          continue;
        }
      }
      block.cells.push(x);
    }
    for (const bl of blocks) {
      const head = nospace(bl.head);
      const text = bl.cells.map((x) => x.text).join('\n');
      const source = [bl.headCell, ...bl.cells.map((x) => x.addr)].filter(Boolean).map(src);
      if (/필요정보및서류|필요서류/.test(head) || /위임장/.test(head)) {
        // 코웨이 M5:O8 표 / 힘펠 N8:Z9 위임장 서류(구분 헤더 → 열별 서류)
        const byCol = {};
        for (const x of bl.cells) (byCol[x.c] ||= []).push(x);
        const headers = /위임장/.test(head)
          ? bl.cells.filter((x) => /^(법인사업자|개인사업자|개인)$/.test(x.text))
          : bl.cells.filter((x) => /^(구분2?|필요서류)$/.test(x.text));
        if (/위임장/.test(head)) {
          const intro = bl.cells.filter((x) => x.text.startsWith('■'));
          for (const h of headers) {
            const body = bl.cells.filter((x) => x.c === h.c && x.r > h.r).map((x) => x.text).join('\n');
            const items = docItems(body);
            p.required_documents.push({ holder_type: h.text, when: '대표자 통화 불가·단체주문 위임 진행 시', items: items.map((i) => i.label), keys: items.map((i) => i.key), raw: flat(body), source: [src(h.addr), ...bl.cells.filter((x) => x.c === h.c && x.r > h.r).map((x) => src(x.addr))] });
          }
          if (intro.length) p.process.flow.push({ head: bl.head, text: intro.map((x) => x.text).join('\n'), source: intro.map((x) => src(x.addr)) });
        } else {
          const rows = {};
          for (const x of bl.cells) if (!headers.includes(x)) (rows[x.r] ||= {})[x.c] = x;
          let lastHolder = null;
          for (const r of Object.keys(rows).sort((a, b) => a - b)) {
            const row = rows[r]; const cols = Object.keys(row).map(Number).sort((a, b) => a - b);
            const holder = row[12]?.text || lastHolder; lastHolder = holder;
            const when = row[13]?.text && row[13].text !== '-' ? row[13].text : null;
            const body = cols.filter((c) => c >= 14).map((c) => row[c].text).join(' / ');
            const items = docItems(body);
            p.required_documents.push({ holder_type: holder, when, items: items.map((i) => i.label), keys: items.map((i) => i.key), raw: flat(body), source: cols.map((c) => src(row[c].addr)) });
          }
        }
      } else if (/신용심사/.test(head)) {
        const img = p.images.filter((i) => /신용|한도|가입기준/.test(i.note || ''));
        p.credit.limit.push({ label: bl.head, text: text || img.map((i) => i.note).join('\n') || null, images: img.map((i) => i.file), source });
      } else if (/선납/.test(head) || /선납/.test(text)) {
        p.credit.fallback = p.credit.fallback || bl.head.replace(/^\s*\d\.\s*/, '');
        p.process.flow.push({ head: bl.head, text, source });
      } else if (/명의변경/.test(head)) {
        p.rules.name_change.push({ label: bl.head, text, source });
      } else if (/회수비/.test(head)) {
        const img = p.images.find((i) => i.note?.includes('회수비'));
        p.rules.cancel_exchange.push({ label: bl.head, text: img?.note || text, image: img?.file, source });
      } else if (/전자서명/.test(head) || /렌탈계약서/.test(head)) {
        const img = p.images.find((i) => i.anchor_cell.replace(/\d+/, '') >= 'M' && /서명|계약/.test(i.note || ''));
        p.process.esign = { head: bl.head, text: text || img?.note || null, image: img?.file || null, source };
      } else {
        p.process.flow.push({ head: bl.head, text, source });
        if (/^\s*\d\.\s/.test(bl.head) && !text && !/flow|메뉴얼/i.test(bl.head)) p.process.steps.push(bl.head.replace(/^\s*\d\.\s*/, ''));
        for (const line of text.split('\n')) {
          const s = line.replace(/^[\s　]*\d\.\s*/, '').trim();
          if (/^[\s　]*\d\.\s/.test(line) && s) p.process.steps.push(s);
        }
      }
    }
    // 흐름 본문에서 단계 추출(1. / 2. 로 시작하는 줄), 전자서명·해피콜 키워드
    const flowText = p.process.flow.map((f) => `${f.head}\n${f.text}`).join('\n');
    if (!p.process.esign && /전자\s*(서명|동의|계약)/.test(flowText)) p.process.esign = { text: flowText.match(/[^\n]*전자\s*(서명|동의|계약)[^\n]*/)[0].trim(), source: p.process.flow.flatMap((f) => f.source) };
    // 이미지 전자서명 절차 연결
    const esImg = p.images.find((i) => /전자(서명|계약서)|서명 알림톡/.test(i.note || ''));
    if (esImg) p.process.esign = { ...(p.process.esign || {}), image: esImg.file, image_note: esImg.note };

    p.application_fields = deriveApplicationFields(p);
    policies.push(p);
    coverage.push({ sheet: sheetName, cells: cells.length, covered: covered.size, missing: cells.filter((x) => !covered.has(x.addr)).map((x) => x.addr) });
  }
  return { policies, coverage };
}

// ── 신청폼 필드 도출 (원문 근거 source 필수) ─────────────────────────
function deriveApplicationFields(p) {
  const f = [];
  const add = (key, label, required, applies_to, source, note) => {
    const ex = f.find((x) => x.key === key && x.applies_to === applies_to);
    if (ex) { ex.source = [...new Set([...[].concat(ex.source), ...[].concat(source)])]; return; }
    f.push({ key, label, required, applies_to, source: [].concat(source).filter(Boolean), ...(note ? { note } : {}) });
  };
  const eh = p.eligibility.notes[0];
  if (eh) add('holder_type', `가입 명의자 구분(${p.eligibility.holder_types.join('/') || '원문 확인'})`, true, 'all', eh.source);
  const ageRec = p.eligibility.notes.find((n) => n.label && /연령/.test(n.label));
  if (ageRec && (p.eligibility.min_age || p.eligibility.max_age)) add('birth_date', `생년월일(연령 ${p.eligibility.min_age ?? ''}~${p.eligibility.max_age ?? ''}세 확인)`, true, 'all', ageRec.source);
  for (const n of p.identity.notes) {
    if (/휴대폰|세이프키/.test(n.text)) add('identity_phone', '계약자 본인 명의 휴대폰', true, 'all', n.source);
    if (/신용카드/.test(n.text)) add('identity_card', '본인인증 신용카드(대체수단)', false, 'all', n.source);
    if (/주민등록번호/.test(n.text)) add('resident_number', '주민등록번호 입력(통신사 본인인증)', true, 'all', n.source);
    if (/공인인증서|공동인증서/.test(n.text)) add('certificate_auth', '공동(공인)인증서', true, '법인', n.source);
    if (/KT TPS/.test(n.text)) add('kt_tps_subscriber', '기존 KT TPS(방송·인터넷·모바일) 이용 여부', true, 'all', n.source);
  }
  for (const n of p.eligibility.notes.slice(1).filter((x) => !x.label)) {
    if (/외국인/.test(n.text) && !/외국인\s*(가입|진행)?\s*불가/.test(n.text)) add('foreigner_visa', '외국인 체류자격(비자)·외국인등록증', true, '외국인', n.source, flat(n.text).slice(0, 120));
    if (/65세.*신분증/.test(n.text)) add('id_card_doc', '신분증(65세 이상 개인)', true, '65세 이상', n.source);
    if (/장애인\s*가입|대리\s*가입/.test(n.text)) add('disabled_proxy_docs', '장애인 대리가입 서류(위임장·인감/신분증·복지카드·대리인 신분증·가족관계증명서)', true, '장애인 대리가입', n.source);
    if (/세이프키|신용카드 본인인증/.test(n.text)) add('identity_card', '신용카드 본인인증(본인명의 휴대폰 미사용 시)', false, '휴대폰 미사용', n.source);
  }
  const pm = p.payment.notes.find((n) => /납부수단/.test(n.label));
  if (pm && p.payment.methods.length) add('payment_method', `납부수단(${p.payment.methods.join('/')})`, true, 'all', pm.source);
  if (pm && /결제정보 필수 X/.test(pm.text)) add('payment_info', '결제정보(접수 시 필수 아님, 해피콜 확인)', false, 'all', pm.source);
  const bd = p.payment.notes.find((n) => /결제일/.test(n.label));
  if (bd && p.payment.billing_days.length) add('billing_day', `결제일(${p.payment.billing_days.join(',')}${p.payment.billing_day_selectable === false ? ' 고정' : ''})`, p.payment.billing_day_selectable !== false, 'all', bd.source);
  for (const t of p.payment.third_party_payment) {
    if (/가능/.test(t.text) && !/^불가/.test(t.text.trim())) {
      add('payer_relation', '타명의 결제자·관계', false, '타명의 결제', t.source, flat(t.text).slice(0, 120));
      if (/가족관계증명|등본|의료보험증|증명서류/.test(t.text)) add('family_relation_doc', '가족관계 증빙서류', true, '타명의 결제', t.source);
      if (/대리납 동의서/.test(t.text)) add('proxy_payment_consent_doc', '대리납 동의서·계약자/대리납자 신분증', true, '타명의 결제', t.source);
    }
  }
  for (const d of p.required_documents) {
    const who = d.when ? `${d.holder_type} (${d.when})` : d.holder_type;
    d.items.forEach((label, i) => add(d.keys[i], label, true, who, d.source));
  }
  for (const t of p.rules.trade_in) {
    if (!t.text || /^불가/.test(t.text.trim())) continue;
    if (/물마크/.test(t.text) && /필수/.test(t.text)) add('trade_in_watermark_no', '타사 제품 물마크(검사필증) 번호', true, '타사보상', t.source);
    if (/철거 여부/.test(t.text)) add('trade_in_removal', '기존 제품 철거 여부', true, '타사보상', t.source);
    if (/계약서|납부내역|이체 내역|검사필증|사진/.test(t.text)) add('trade_in_proof_doc', '타사보상 증빙(계약서/납부내역/검사필증·제품사진 등)', true, '타사보상', t.source, flat(t.text).slice(0, 160));
  }
  for (const s of [...p.rules.special, ...p.credit.limit, ...p.eligibility.notes, ...p.required_documents.map((d) => ({ text: d.raw, source: d.source })), ...p.process.flow.map((f) => ({ text: `${f.head}\n${f.text}`, source: f.source }))]) {
    if (/세금계산서/.test(s.text || '')) add('tax_invoice_request', '세금계산서 발행 요청 여부', false, '사업자', s.source);
    if (/보증보험|SGI/.test(s.text || '')) add('guarantee_insurance_consent', '보증보험(SGI) 개인정보 동의', true, /4천만원/.test(s.text) ? '총렌탈료 4천만원 이상' : '법인사업자', s.source);
    if (/실설치 주소|설치처 상이|주소지 ≠|설치주소 상이|주소 및 설치처/.test(s.text || '')) add('install_address_proof', '설치주소 상이 시 증빙', true, '설치주소≠등록주소', s.source);
  }
  for (const d of p.required_documents) if (/주소지/.test(d.raw || '') || /주소지/.test(d.when || '')) add('install_address_proof', '설치주소 상이 시 증빙(임대차/부동산계약서 등)', true, '설치주소≠등록주소', d.source);
  if (/선납/.test(`${p.credit.fallback || ''}`)) add('prepay_option', '신용 미달 시 선납 진행(선납 결제수단)', false, '신용 미달', p.credit.notes[0]?.source || []);
  for (const fl of p.process.flow) if (/카드 선납시 카드 정보/.test(fl.text)) add('prepay_card_info', '카드 선납 정보(카드번호·유효기간·비밀번호 앞2자리·할부개월)', true, '카드 선납', fl.source);
  for (const pc of p.process.pre_check) if (pc.text && /사전답사/.test(pc.label || '')) add('site_survey', `사전답사 대상 여부(${flat(pc.text)})`, true, '사전답사 대상 제품', pc.source);
  return f;
}

export default parseSupplierPolicyWorkbook;
