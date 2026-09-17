// 2026년 9월 렌탈사 프로모션 등록 — 출처: 빌리고 9월 엑셀(시트 문구·첨부 이미지), 코웨이 9월 정책 프로모션 PDF
//   node scripts/rental-catalog-load-promotions.mjs --env .env.dev [--commit]
//   · (supplier_id, title, period_from) 가 같은 프로모션이 있으면 내용을 갱신, 없으면 추가
//   · 조건별 요금 반영(반값 구간·타사보상 조건)은 적재 어댑터가 하고, 여기는 상담원이 읽을 행사 설명·기간·중복조건
import fs from 'fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const envFile = arg('--env');
if (!envFile) { console.error('--env 필수'); process.exit(1); }
const env = dotenv.parse(fs.readFileSync(envFile));
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
console.log('대상 DB:', new URL(env.SUPABASE_URL).host.split('.')[0]);

const EXCEL_W = '★ 26.09 (빌리고_정수기) 수수료 및 상품리스트_5차.xlsx';
const EXCEL_A = '★ 26.09(빌리고_가전) 수수료율 및 상품리스트_3차 .xlsx';
const PDF = '코웨이_9월 정책 프로모션.pdf';

const PROMOS = [
  { supplier_id: 'coway', title: '코웨이 반값 할인 프로모션', period_from: '2026-09-01', period_to: '2026-09-30',
    summary: '신규렌탈 약정기간별 반값 — 워터스탠드·매너비데 3년3/5년6/6년9개월, 아이콘프로 6/12, 아이콘2·3 6/18, 얼음데스크탑 3/6/18, 테라솔U/P 12/18/24',
    benefit: { type: 'half', table: '약정기간별 반값 개월(PDF 반값표)', note: '전월 比 제습(청정기) 종료, 테라솔U/P 확대' },
    targets: { customer: '신규렌탈' }, stacking: { 'Pre-Pass': true, 동시구매결합: true, 선납할인: true, 단체할인: false, 타사보상: false },
    source: { file: PDF, image: `${EXCEL_W} 코웨이프로모션 시트 이미지` } },
  { supplier_id: 'coway', title: '코웨이 패키지 플러스 프로모션', period_from: '2026-08-28', period_to: '2026-10-31',
    summary: '2대 이상 구매 시 15% 할인 + 수량별 반값(3대 3개월·4대 4개월·5대 이상 5개월). 온라인 전용 제품 제외',
    benefit: { discount_pct: 15, half_months_by_qty: { 3: 3, 4: 4, 5: 5 } },
    targets: { customer: '신규렌탈', products: '렌탈 가능한 전 제품(온라인 전용 제외)' },
    stacking: { 동시구매결합: false, 선납할인: true, 선납2할인: false, 단체할인: false, 프로모션: 'A141만 가능' },
    source: { file: PDF, image: `${EXCEL_W} 코웨이프로모션 시트 이미지` } },
  { supplier_id: 'coway', title: '비렉스 페스타 프로모션', period_from: '2026-08-27', period_to: '2026-10-31',
    summary: 'BEREX 전 제품 약정별 렌탈료 1만원만 청구 — 5년 5개월·7년 10개월·9년 15개월 (원바디2 3년 3개월, R/M 시리즈 세트는 2만원 청구)',
    benefit: { type: 'fixed_bill', won: 10000, months_by_contract: { 60: 5, 84: 10, 108: 15 } },
    targets: { customer: '신규렌탈', products: 'BEREX 전 제품(침대·안마의자·R/M시리즈·의료기기)' },
    stacking: { 동시구매결합: true, 선납할인: true, 선납2할인: true, 단체할인: false, 타사보상: false },
    source: { file: PDF, image: `${EXCEL_W} 코웨이프로모션 시트 이미지` } },
  { supplier_id: 'coway', title: '코웨이 타사보상(정수기)', period_from: '2026-09-01', period_to: '2026-09-30',
    summary: '타사 정수기 사용고객 약정할인가 10% + 1년간 월 1만원(A477), 얼음 데스크탑 6/7년 월 2만원. 물마크 번호 필수 — 중복 시 수수료 100% 되물림',
    benefit: { discount_pct: 10, extra_monthly_first_year: 10000, exception: '얼음 데스크탑 6/7년 20000', code: 'A477' },
    targets: { customer: '타사 정수기 사용고객(개인/개인사업자/법인)', products: '아이콘(2,3,프로)·얼음정수기 데스크탑·노블·엘리트·워터스탠드·아이콘 스탠드·AIS스탠드' },
    stacking: { 'Pre-Pass': true, 동시구매: true, 선납할인: true, 단체할인: false, 반값: false },
    source: { file: PDF } },
  { supplier_id: 'coway', title: '코웨이 타사보상(청정기·비데)', period_from: '2026-09-01', period_to: '2026-09-30',
    summary: 'LG/삼성/위닉스 청정기 사용고객 신규렌탈가 10% (멀티액션·싱글파워·노블1·노블2·듀얼클린·노블 제습공기청정기), 쿠쿠/노비타/SK/대림/더이누스/유스파 비데 사용고객 10% (더블케어·스스로케어·스타일케어·슬리믹·프라임). 반값 중복 불가',
    benefit: { discount_pct: 10 }, targets: { customer: '타사 청정기·비데 사용고객' },
    stacking: { 'Pre-Pass': true, 동시구매: true, 선납할인: true, 단체할인: false, 반값: false }, source: { file: PDF } },
  { supplier_id: 'coway', title: '코웨이 추가 수수료(9월)', period_from: '2026-09-01', period_to: '2026-09-30',
    summary: '얼음정수기군(CHPI/CPI) 5/6/7년 3만원, 냉온·냉정수기군(CHP/CP) 5/6/7년 2만원, 아이콘3 반값 15만원·반값 外 5만원 (3년 약정 제외) — 조건별 리베이트에 포함됨. 시즌상품 패키지(동시구매)·렌탈 단체 건당 2만원은 조건부 별도',
    benefit: { type: 'extra_commission' }, targets: {}, stacking: {},
    source: { file: EXCEL_W, image: '코웨이(9월) 시트 이미지', sheet_text: '코웨이프로모션(9월) O56 — 아이콘얼음 미니/스탠다드 반값 14만·반값外 3/7만(시트 칸과 불일치, 확인필요)' } },
  { supplier_id: 'lg-subscribe', title: 'LG구독 정수기 9월 프로모션', period_from: '2026-09-01', period_to: '2026-09-30',
    summary: '① 전사판촉 반값: 얼음 12개월(2~13회차, 4년은 6개월), 얼음Lite·얼음AI 12개월, 듀얼·음성·맞춤·라이트온(520MC) 6개월(2~7회차) ② 타사보상(6·5년, 수동심사) 1년차 월 얼음 2만·듀얼/빌트인/음성/맞춤/스탠드 1만·라이트온 0.5만 ③ 전용모델: 빌트인 A/S 월 1만(1년차), 상하좌우 자가관리 12개월 반값(1~12회차)',
    benefit: { type: 'half+trade_in' }, targets: { products: 'LG 정수기' }, stacking: { note: '반값·타사보상 중복 여부 확인필요' },
    source: { file: EXCEL_W, image: 'LG구독(9월) 시트 이미지' } },
  { supplier_id: 'lg-subscribe', title: 'LG구독 가전 9월 월간 프로모션', period_from: '2026-09-01', period_to: '2026-09-30',
    summary: '쿠킹·에어컨·리빙 월간 프로모션 구독료 할인 적용가. 구매 9/1~9/30, 배송 10/31까지. 커머셜·납품·임직원·폐쇄몰·특별할인 제외. 리빙 6년 한정 반값(MX91WR·MH65CC 12개월, MH21 8개월)',
    benefit: { type: 'monthly_discount' }, targets: { products: '쿠킹·에어컨·리빙' },
    stacking: { 제외: '커머셜·납품·임직원·폐쇄몰·특별할인' }, source: { file: EXCEL_A, image: 'LG구독에어컨(9월) 시트 이미지' } },
  { supplier_id: 'chungho', title: '청호 규정별 렌탈료(9월)', period_from: '2026-09-01', period_to: '2026-09-30',
    summary: 'S규정 신규(대부분) · P규정 패키지 · J규정 재렌탈/타사보상(소유권만기 고객) · O,N,H규정 특별 할인렌탈료. 프로모션1 렌탈료할인·렌탈료할인(TheM타사), 프로모션2 반값 — 반값 개월수·할인 기간은 시트에 없음(확인필요), A규정 설명 없음',
    benefit: { type: 'rule_codes' }, targets: {}, stacking: {}, source: { file: EXCEL_W, sheet: '청호(9월) 특이사항' } },
  { supplier_id: 'cesco', title: '세스코 9월 렌탈료 할인·반값', period_from: '2026-09-01', period_to: '2026-09-30',
    summary: '9월 렌탈료 할인, 해충 시즌(3~9월), 9월 3천원 추가할인, 렌탈료 총 9개월 반값(2~10개월차)·3개월 반값(2~4개월차) 등 — 조건별 반영. EBCB152 추가 인센티브 금액 미기재(확인필요)',
    benefit: { type: 'monthly' }, targets: {}, stacking: {}, source: { file: EXCEL_A, sheet: '세스코(9월)' } },
];

const { data: existing } = await sb.from('rental_cat_promotions').select('id, supplier_id, title, period_from').throwOnError();
let ins = 0; let upd = 0;
for (const p of PROMOS) {
  const hit = existing.find((e) => e.supplier_id === p.supplier_id && e.title === p.title && e.period_from === p.period_from);
  console.log(hit ? '갱신' : '추가', p.supplier_id, p.title, `${p.period_from}~${p.period_to}`);
  if (!process.argv.includes('--commit')) continue;
  if (hit) { await sb.from('rental_cat_promotions').update({ ...p, is_active: true, updated_at: new Date().toISOString() }).eq('id', hit.id).throwOnError(); upd++; }
  else { await sb.from('rental_cat_promotions').insert({ ...p, is_active: true }).throwOnError(); ins++; }
}
if (process.argv.includes('--commit')) console.log('반영 — 추가', ins, '갱신', upd);
