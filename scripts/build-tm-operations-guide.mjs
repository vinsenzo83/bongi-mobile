// TM 운영가이드 엑셀 — 계산기 형식 (formula 포함).
// 시트: README · 인센티브 급여 계산기 · 가전렌탈 견적·마진 계산기 · 인터넷+TV 견적 계산기
// 실행: node scripts/build-tm-operations-guide.mjs
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import xlsx from 'xlsx';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
if (!URL || !KEY) { console.error('❌ env'); process.exit(1); }
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const { data: rp } = await sb.from('rental_policy').select('*').eq('active', true).single();
const { data: it } = await sb.from('incentive_rules').select('*')
  .eq('active', true).order('effective_from', { ascending: false }).limit(1).single();

const rentalRows = [];
for (let from = 0;; from += 1000) {
  const { data } = await sb.from('rental_product_options')
    .select(`ticket_number, months, care_service, inspection_cycle, ownership_months,
      monthly_fee, normal_price, rebate, payback, margin, tier_calculated, point_weight,
      promo_type, variant_label,
      product:rental_products(brand, model, name, market_score, is_premium,
        category:rental_categories(name, product_group))`)
    .eq('is_active', true).not('ticket_number', 'is', null)
    .order('ticket_number', { ascending: true }).range(from, from + 999);
  if (!data) break;
  rentalRows.push(...data);
  if (data.length < 1000) break;
}
const { data: itRows } = await sb.from('incentive_internet_tickets')
  .select('ticket_number, carrier, speed, tv_idx, tv_label, has_wifi, monthly_fee, gift_amount, is_active')
  .eq('is_active', true).order('ticket_number');

console.log(`정책 OK · 가전 ${rentalRows.length} · IT ${(itRows||[]).length}`);

const wb = xlsx.utils.book_new();
const today = new Date().toISOString().slice(0, 10);

// 셀 단축
const _F = (formula, type='n') => ({ t: type, f: formula });
const _N = (v) => ({ t: 'n', v });
const _S = (v) => ({ t: 's', v });

// ─────────────────────────────────────────────────────────────────
// 시트 1: README
// ─────────────────────────────────────────────────────────────────
const readme = [
  ['봉이 TM 운영가이드 — 계산기 버전'],
  [`기준일: ${today} · 라이브 데이터 (admin.prexymarket.com)`],
  [],
  ['■ 시트 구성'],
  ['1) 포인트(P) 시스템 — P가 어떻게 산정되는지·우수상품 보너스·등급 영향'],
  ['2) 상담사 급여 계산기 — 본인 P·우수건수 입력 → Grade 자동, 월급 자동 계산'],
  ['3) 팀장 인센티브 안내 — V5.1 정책 (오버라이드·페널티·면제·지급조건)'],
  ['4) 팀장 인센티브 계산기 — 본인 영업+팀원 인센 입력 → 페널티 자동, 최종 수령액'],
  ['5) 가전렌탈 견적·마진 — 티켓번호 입력(또는 페이백) → 마진/Tier 자동'],
  ['6) 인터넷+TV 견적 — 티켓번호 입력 → 통신사·속도·요금 자동'],
  [],
  ['■ 사용법'],
  ['- 노랑 셀(입력)에 값을 넣으면 회색 셀(계산)이 자동 채워집니다'],
  ['- 가전렌탈/인터넷+TV: 시트 하단 전체 목록에서 티켓번호 검색 후 입력'],
  ['- 모든 정책값(기본급·단가·임계값)은 라이브 활성 정책 기준 (정책 변경 시 재생성)'],
];
xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(readme), 'README');

// ─────────────────────────────────────────────────────────────────
// 시트 2: 포인트(P) 시스템 설명
// ─────────────────────────────────────────────────────────────────
const ppt = [];
ppt.push(['포인트(P) 시스템 설명']);
ppt.push([`정책: 가전렌탈 ${rp.version} · 인터넷+TV ${it.version} · 기준일 ${today}`]);
ppt.push([]);
ppt.push(['■ 포인트(P)란?']);
ppt.push(['- P = 상담사 영업 성과 단위. 계약 1건당 그 옵션의 Tier에 따라 P가 부여됨.']);
ppt.push(['- 이번 달 합산 P → Grade 결정 → P 1당 단가 × P = 인센티브 산정.']);
ppt.push(['- 가전렌탈 P와 인터넷+TV P는 합산되어 Grade 산정 (양쪽 단가는 다름).']);
ppt.push([]);
ppt.push(['■ 가전렌탈 — Tier·P 결정 흐름']);
ppt.push(['STEP', '내용', '예시']);
ppt.push(['① 옵션 마진 계산', 'margin = 리베이트 × 0.9 − 페이백 − P × ' + rp.weight_cost_per_p.toLocaleString(),
  '리베 500,000 / 페이백 30,000 / P 1.5 → 마진 = 450,000 − 30,000 − 30,000 = 390,000']);
ppt.push(['② 마진→Tier', 'S/A/B/C 등급 임계값 매칭', '마진 39만 → S (200,000 이상)']);
ppt.push(['③ Tier→P', `S=${rp.tier_to_p.S} / A=${rp.tier_to_p.A} / B=${rp.tier_to_p.B} / C=${rp.tier_to_p.C}`,
  'S Tier → P=' + rp.tier_to_p.S]);
ppt.push(['④ 우수상품 판정', `마진 ≥ ${rp.premium_margin_threshold.toLocaleString()} → is_premium=true`,
  '마진 39만 → 우수 (+보너스 ' + rp.bonus_per_premium.toLocaleString() + '원/건)']);
ppt.push([]);
ppt.push(['■ 가전렌탈 Tier 매핑표 (마진 기준)']);
ppt.push(['Tier', '마진 임계값(원)', 'P', '우수상품 여부']);
ppt.push(['S', '≥ ' + rp.tier_s_min_margin.toLocaleString(), rp.tier_to_p.S, '⭐ (마진 ≥ ' + rp.premium_margin_threshold.toLocaleString() + ')']);
ppt.push(['A', '≥ ' + rp.tier_a_min_margin.toLocaleString(), rp.tier_to_p.A, '⭐ 가능']);
ppt.push(['B', '≥ ' + rp.tier_b_min_margin.toLocaleString(), rp.tier_to_p.B, '⭐ 가능']);
ppt.push(['C', '미만', rp.tier_to_p.C, 'X']);
ppt.push([]);
ppt.push(['■ 인터넷+TV — P 부여']);
ppt.push(['- 인터넷+TV는 상품 단위 P (티켓별 사전 정의값) — 가전렌탈처럼 마진 기반 자동 산출 아님.']);
ppt.push(['- 상품관리 화면에서 운영자가 각 티켓에 P 1.0~2.0 등 직접 설정.']);
ppt.push([]);
ppt.push(['■ Grade(등급) 산정 — 가전+IT 합산']);
ppt.push(['Grade', 'P 조건', '우수 조건', '비고']);
ppt.push(['G1', '< ' + rp.grade_thresholds[2].points, '< ' + rp.grade_thresholds[2].premium, '기본 (P·우수 둘 중 하나라도 미달 시)']);
ppt.push(['G2', '≥ ' + rp.grade_thresholds[2].points, '≥ ' + rp.grade_thresholds[2].premium, 'P와 우수 둘 다 충족']);
ppt.push(['G3', '≥ ' + rp.grade_thresholds[3].points, '≥ ' + rp.grade_thresholds[3].premium, 'P와 우수 둘 다 충족']);
ppt.push([]);
ppt.push(['■ Grade별 P 단가 (P 1당 지급액)']);
ppt.push(['Grade', '가전렌탈(원/P)', '인터넷+TV(원/P)', '비고']);
ppt.push(['G1', rp.grade_rates['1'], it.grade_rates['1'], '']);
ppt.push(['G2', rp.grade_rates['2'], it.grade_rates['2'], '']);
ppt.push(['G3', rp.grade_rates['3'], it.grade_rates['3'], '최고 단가']);
ppt.push([]);
ppt.push(['■ 우수상품 보너스']);
ppt.push(['- 우수상품(is_premium) 계약 1건당 + ' + rp.bonus_per_premium.toLocaleString() + '원 추가 지급.']);
ppt.push(['- 가전렌탈: 옵션 마진 ≥ ' + rp.premium_margin_threshold.toLocaleString() + '원 (자동 판정).']);
ppt.push(['- 인터넷+TV: 운영자가 상품관리에서 직접 우수 지정.']);
ppt.push([]);
ppt.push(['■ 페이백 정책']);
ppt.push(['- 페이백 = 고객에게 지급하는 현금 메리트 (페이백이 클수록 마진 ↓ → Tier ↓ → P ↓).']);
ppt.push(['- 페이백 최대 한도: ' + rp.payback_max.toLocaleString() + '원']);
ppt.push(['- 회사 부담 한도: ' + rp.payback_company_limit.toLocaleString() + '원 (초과분은 상담사 인센티브에서 차감).']);
ppt.push([]);
ppt.push(['■ 핵심 요약']);
ppt.push(['1) 마진 높은 옵션을 팔수록 P·Tier·우수보너스 모두 ↑']);
ppt.push(['2) 페이백 줄이면 마진 ↑ (단, 고객 메리트 ↓로 계약 성공률에 영향)']);
ppt.push(['3) Grade는 가전+IT 합산이라 인터넷+TV 영업도 함께 챙겨야 G2/G3 도달 빠름']);
ppt.push(['4) 우수상품 5건/10건이 G2/G3의 핵심 조건 — P만으론 등급 못 올라감']);

const pptSheet = xlsx.utils.aoa_to_sheet(ppt);
pptSheet['!cols'] = [{ wch: 18 }, { wch: 50 }, { wch: 18 }, { wch: 50 }];
xlsx.utils.book_append_sheet(wb, pptSheet, '포인트(P) 시스템');

// ─────────────────────────────────────────────────────────────────
// 시트 3: 상담사 급여 계산기
// ─────────────────────────────────────────────────────────────────
// A열: 라벨 · B열: 값/입력 · C~D열: 보조
const pay = [];
pay.push(['봉이 상담사(agent) 급여 계산기', null, null, null]);
pay.push([`정책: 가전렌탈 ${rp.version} · 인터넷+TV ${it.version} · 기준일 ${today}`, null, null, null]);
pay.push([]);
pay.push(['■ 입력 (노랑 셀)', null, null, null]);
pay.push(['가전렌탈 합산 P', 10, null, '이번 달 누적 P (옵션 P × 계약건수)']);
pay.push(['인터넷+TV 합산 P', 6, null, '이번 달 누적 P']);
pay.push(['우수상품 계약 건수', 4, null, 'is_premium=true 계약 수']);
pay.push([]);
pay.push(['■ Grade 자동 산정 (가전+IT 합산 기준)', null, null, null]);
pay.push(['합산 P', { t: 'n', f: 'B5+B6' }, null, '가전 + IT']);
pay.push(['합산 우수', { t: 'n', f: 'B7' }, null, null]);
pay.push(['Grade', { t: 's', f: `IF(AND(B10>=${rp.grade_thresholds[3].points},B11>=${rp.grade_thresholds[3].premium}),"G3",IF(AND(B10>=${rp.grade_thresholds[2].points},B11>=${rp.grade_thresholds[2].premium}),"G2","G1"))` }, null, `G3: P≥${rp.grade_thresholds[3].points}+우수≥${rp.grade_thresholds[3].premium} / G2: P≥${rp.grade_thresholds[2].points}+우수≥${rp.grade_thresholds[2].premium} / 그 외 G1`]);
pay.push([]);
pay.push(['■ 단가 자동 조회 (Grade 기준)', null, null, null]);
pay.push(['가전렌탈 P 단가(원)', { t: 'n', f: `IF(B12="G3",${rp.grade_rates['3']},IF(B12="G2",${rp.grade_rates['2']},${rp.grade_rates['1']}))` }, null, `G1=${rp.grade_rates['1'].toLocaleString()} / G2=${rp.grade_rates['2'].toLocaleString()} / G3=${rp.grade_rates['3'].toLocaleString()}`]);
pay.push(['인터넷+TV P 단가(원)', { t: 'n', f: `IF(B12="G3",${it.grade_rates['3']},IF(B12="G2",${it.grade_rates['2']},${it.grade_rates['1']}))` }, null, `G1=${it.grade_rates['1'].toLocaleString()} / G2=${it.grade_rates['2'].toLocaleString()} / G3=${it.grade_rates['3'].toLocaleString()}`]);
pay.push([]);
pay.push(['■ 월급 계산 (자동)', null, null, null]);
pay.push(['기본급', rp.base_salary, null, '월 고정']);
pay.push(['가전렌탈 P 수당', { t: 'n', f: 'B5*B15' }, null, '가전 P × 단가']);
pay.push(['인터넷+TV P 수당', { t: 'n', f: 'B6*B16' }, null, 'IT P × 단가']);
pay.push(['우수상품 보너스', { t: 'n', f: `B7*${rp.bonus_per_premium}` }, null, `건당 ${rp.bonus_per_premium.toLocaleString()}원`]);
pay.push(['── 총 월급 ──', { t: 'n', f: 'B19+B20+B21+B22' }, null, '합계']);
pay.push([]);
pay.push(['■ 가전렌탈 Tier·P 매핑 (마진 기준)', null, null, null]);
pay.push(['Tier', '마진 임계값(원)', 'P', null]);
pay.push(['S', rp.tier_s_min_margin, rp.tier_to_p.S, '우수상품 임계: ' + rp.premium_margin_threshold.toLocaleString()]);
pay.push(['A', rp.tier_a_min_margin, rp.tier_to_p.A, null]);
pay.push(['B', rp.tier_b_min_margin, rp.tier_to_p.B, null]);
pay.push(['C', '미만', rp.tier_to_p.C, null]);
pay.push([]);
pay.push(['■ 마진 공식', null, null, null]);
pay.push(['margin = 리베이트 × 0.9 − 페이백 − P × ' + rp.weight_cost_per_p.toLocaleString(), null, null, 'weight_cost_per_p = ' + rp.weight_cost_per_p.toLocaleString()]);
pay.push(['페이백 최대 한도', rp.payback_max, null, null]);
pay.push(['회사 부담 한도', rp.payback_company_limit, null, '초과분 = 상담사 차감']);

const paySheet = xlsx.utils.aoa_to_sheet(pay);
paySheet['!cols'] = [{ wch: 30 }, { wch: 16 }, { wch: 6 }, { wch: 56 }];
xlsx.utils.book_append_sheet(wb, paySheet, '상담사 급여 계산기');

// ─────────────────────────────────────────────────────────────────
// 시트 4: 팀장 인센티브 안내 (V5.1)
// ─────────────────────────────────────────────────────────────────
const mgrTeamBase = 2800000;   // 팀장 기본급 (안내서 기준)
const ovRate = Number(it.manager_override_rate) || 0.12;
const oblig = it.manager_obligation_count || 20;
const partial = it.manager_penalty_partial_min || 10;
const prMin = Number(it.manager_team_profit_rate_min) || 0.20;

const mgr = [];
mgr.push(['🏢 팀장(manager) 인센티브 안내 — V5.1']);
mgr.push([`정책 ${it.version} · 기준일 ${today}`]);
mgr.push([]);
mgr.push(['■ 팀장 급여 구성']);
mgr.push(['1) 기본급', mgrTeamBase, '월 고정 (상담사 230만 < 팀장 280만, 상담사별 admin 설정 가능)']);
mgr.push(['2) 본인 영업 인센티브', null, 'V5 정책 그대로 (상담사와 동일 — 옆 시트 「상담사 급여 계산기」 참조)']);
mgr.push(['3) 팀 오버라이드', null, 'V5.1 핵심 — 본 안내서']);
mgr.push([]);
mgr.push(['■ 팀 오버라이드 공식']);
mgr.push(['팀 오버라이드 = 팀원 인센·보너스 합계 × ' + (ovRate*100).toFixed(0) + '% × 페널티 계수 (0%/50%/100%)']);
mgr.push(['- 팀원 정의', '같은 센터의 role=agent + active 상담사 (본인 제외)']);
mgr.push(['- 합계 기준', '각 팀원의 (인센티브 + 우수 보너스) 합산']);
mgr.push(['- 지급 시점', "팀원이 영업을 'completed' 등록 → 즉시 반영"]);
mgr.push([]);
mgr.push(['■ 페널티 매트릭스']);
mgr.push(['본인 영업(completed)', '팀 영업이익률', '페널티 계수', '오버라이드']);
mgr.push(['≥ ' + oblig + '건 (의무 충족)', '≥ ' + (prMin*100).toFixed(0) + '%', '100%', '정상 지급']);
mgr.push(['≥ ' + oblig + '건', '< ' + (prMin*100).toFixed(0) + '%', '0%', '미지급']);
mgr.push([partial + ' ~ ' + (oblig-1) + '건', '≥ ' + (prMin*100).toFixed(0) + '%', '50%', '절반 차감']);
mgr.push([partial + ' ~ ' + (oblig-1) + '건', '< ' + (prMin*100).toFixed(0) + '%', '0%', '미지급']);
mgr.push(['< ' + partial + '건', '(무관)', '0%', '미지급']);
mgr.push([]);
mgr.push(['■ 팀 영업이익률 정의']);
mgr.push(['팀 영업이익률 = (팀 매출 − 팀 페이백) ÷ 팀 매출']);
mgr.push(['- 팀원(본인 제외) 매출·페이백 합계 기준']);
mgr.push(['- ' + (prMin*100).toFixed(0) + '% 미달 시 오버라이드 0%']);
mgr.push([]);
mgr.push(['■ 페널티 면제 조건 (admin 승인 시)']);
mgr.push(['🛡 신입 OJT', '신규 팀장 인계 기간']);
mgr.push(['🛡 시스템 장애', '회사 측 사유로 영업 불가']);
mgr.push(['🛡 경조사', '본인·가족 사유로 영업 부재']);
mgr.push(['- 면제 시 페널티 무시 + 오버라이드 100% 지급']);
mgr.push([]);
mgr.push(['■ 팀장 행동 가이드']);
mgr.push(['1) 본인 영업 의무(' + oblig + '건) 우선 달성 → 페널티 회피']);
mgr.push(['2) 팀원 매출 ↑ + 페이백 ↓ 코칭으로 팀 이익률 ' + (prMin*100).toFixed(0) + '% 이상 유지']);
mgr.push(['3) 본인 영업 부족 시 부분 페널티(50% 차감) → 오버라이드 손실 큼']);
mgr.push(['4) 팀원 우수 등록 독려 → 팀원 인센 합계 ↑ → 본인 오버라이드 ↑']);
mgr.push(['5) 면제 사유 발생 시 admin에 즉시 보고 → 해당 월 페널티 무시']);
mgr.push([]);
mgr.push(['■ KPI 보너스']);
mgr.push(['없음 (V5.1) — 향후 정책 변경 시 별도 공지']);

const mgrSheet = xlsx.utils.aoa_to_sheet(mgr);
mgrSheet['!cols'] = [{ wch: 28 }, { wch: 22 }, { wch: 14 }, { wch: 50 }];
xlsx.utils.book_append_sheet(wb, mgrSheet, '팀장 인센티브 안내');

// ─────────────────────────────────────────────────────────────────
// 시트 5: 팀장 인센티브 계산기
// ─────────────────────────────────────────────────────────────────
const mgrCalc = [];
mgrCalc.push(['🏢 팀장 인센티브 계산기 — V5.1', null, null, null]);
mgrCalc.push([`정책 ${it.version} · 오버라이드 ${(ovRate*100).toFixed(0)}% · 의무 ${oblig}건 · 이익률 ${(prMin*100).toFixed(0)}% · 기준일 ${today}`, null, null, null]);
mgrCalc.push([]);
mgrCalc.push(['■ 입력 — 본인 영업 (노랑 셀)', null, null, null]);
mgrCalc.push(['본인 가전렌탈 P', 20, null, '본인 이번 달 가전 P']);
mgrCalc.push(['본인 인터넷+TV P', 0, null, '본인 이번 달 IT P']);
mgrCalc.push(['본인 우수 건수', 5, null, '본인 우수상품 계약 수']);
mgrCalc.push(['본인 영업 completed 건수', 22, null, '의무 ' + oblig + '건 이상 충족 필요']);
mgrCalc.push([]);
mgrCalc.push(['■ 입력 — 팀 (노랑 셀)', null, null, null]);
mgrCalc.push(['팀원 인센·보너스 합계(원)', 800000, null, '팀원(본인 제외) 인센티브+우수보너스 합']);
mgrCalc.push(['팀 매출(원)', 5000000, null, '팀원 매출 합 (영업이익률 계산용)']);
mgrCalc.push(['팀 페이백 합계(원)', 1400000, null, '팀원 페이백 합']);
mgrCalc.push(['admin 페널티 면제', 'X', null, 'O 입력 시 페널티 100% 무시 (admin 승인 시만)']);
mgrCalc.push([]);
mgrCalc.push(['■ 자동 계산 — Grade·본인 인센티브', null, null, null]);
mgrCalc.push(['합산 P', { t: 'n', f: 'B5+B6' }, null, '가전 + IT']);
mgrCalc.push(['Grade', { t: 's', f: `IF(AND(B16>=${rp.grade_thresholds[3].points},B7>=${rp.grade_thresholds[3].premium}),"G3",IF(AND(B16>=${rp.grade_thresholds[2].points},B7>=${rp.grade_thresholds[2].premium}),"G2","G1"))` }, null, null]);
mgrCalc.push(['가전 P 단가', { t: 'n', f: `IF(B17="G3",${rp.grade_rates['3']},IF(B17="G2",${rp.grade_rates['2']},${rp.grade_rates['1']}))` }, null, null]);
mgrCalc.push(['IT P 단가', { t: 'n', f: `IF(B17="G3",${it.grade_rates['3']},IF(B17="G2",${it.grade_rates['2']},${it.grade_rates['1']}))` }, null, null]);
mgrCalc.push(['본인 가전 수당', { t: 'n', f: 'B5*B18' }, null, null]);
mgrCalc.push(['본인 IT 수당', { t: 'n', f: 'B6*B19' }, null, null]);
mgrCalc.push(['본인 우수 보너스', { t: 'n', f: `B7*${rp.bonus_per_premium}` }, null, null]);
mgrCalc.push(['본인 인센티브 소계', { t: 'n', f: 'B20+B21+B22' }, null, null]);
mgrCalc.push([]);
mgrCalc.push(['■ 자동 계산 — 팀 오버라이드·페널티', null, null, null]);
mgrCalc.push(['팀 영업이익', { t: 'n', f: 'B11-B12' }, null, '팀 매출 − 팀 페이백']);
mgrCalc.push(['팀 영업이익률', { t: 'n', f: 'IF(B11>0,B25/B11,0)' }, null, '0% ~ 100%']);
mgrCalc.push(['이익률 충족 여부', { t: 's', f: `IF(B26>=${prMin},"O (≥${(prMin*100).toFixed(0)}%)","X (<${(prMin*100).toFixed(0)}%)")` }, null, null]);
mgrCalc.push(['본인 영업 충족 여부', { t: 's', f: `IF(B8>=${oblig},"의무충족",IF(B8>=${partial},"부분(50%)","미지급"))` }, null, null]);
// 페널티 계수: 면제O면 1.0, 아니면 매트릭스
mgrCalc.push(['페널티 계수', { t: 'n', f: `IF(UPPER(B13)="O",1,IF(B8<${partial},0,IF(B8>=${oblig},IF(B26>=${prMin},1,0),IF(B26>=${prMin},0.5,0))))` }, null, '0 / 0.5 / 1.0 (면제 O 입력 시 강제 1.0)']);
mgrCalc.push(['팀 오버라이드(원)', { t: 'n', f: `ROUND(B10*${ovRate}*B29,0)` }, null, '팀원합계 × ' + (ovRate*100).toFixed(0) + '% × 페널티계수']);
mgrCalc.push([]);
mgrCalc.push(['■ 최종 월 수령액', null, null, null]);
mgrCalc.push(['팀장 기본급', mgrTeamBase, null, null]);
mgrCalc.push(['본인 인센티브 (가전+IT+우수)', { t: 'n', f: 'B23' }, null, null]);
mgrCalc.push(['🏢 팀 오버라이드', { t: 'n', f: 'B30' }, null, null]);
mgrCalc.push(['── 총 수령액 ──', { t: 'n', f: 'B32+B33+B34' }, null, '합계']);
mgrCalc.push([]);
mgrCalc.push(['■ 페널티 매트릭스 (참조)']);
mgrCalc.push(['본인 영업', '팀 이익률', '계수', '결과']);
mgrCalc.push(['≥ ' + oblig + '건', '≥ ' + (prMin*100).toFixed(0) + '%', '100%', '정상']);
mgrCalc.push(['≥ ' + oblig + '건', '< ' + (prMin*100).toFixed(0) + '%', '0%', '미지급']);
mgrCalc.push([partial + '~' + (oblig-1) + '건', '≥ ' + (prMin*100).toFixed(0) + '%', '50%', '절반차감']);
mgrCalc.push([partial + '~' + (oblig-1) + '건', '< ' + (prMin*100).toFixed(0) + '%', '0%', '미지급']);
mgrCalc.push(['< ' + partial + '건', '(무관)', '0%', '미지급']);

const mgrCalcSheet = xlsx.utils.aoa_to_sheet(mgrCalc);
mgrCalcSheet['!cols'] = [{ wch: 32 }, { wch: 18 }, { wch: 8 }, { wch: 50 }];
xlsx.utils.book_append_sheet(wb, mgrCalcSheet, '팀장 인센티브 계산기');

// ─────────────────────────────────────────────────────────────────
// 시트 3: 가전렌탈 견적·마진 계산기
// ─────────────────────────────────────────────────────────────────
// 상단: 견적 계산기 (입력+VLOOKUP)
// 하단: 전체 티켓 목록 (VLOOKUP 소스)
const rentalAoa = [];
rentalAoa.push(['가전렌탈 견적·마진 계산기']);
rentalAoa.push([`기준일 ${today} · 활성 옵션 ${rentalRows.length}건 · 정책 ${rp.version}`]);
rentalAoa.push([]);
rentalAoa.push(['■ 입력 (노랑 셀)']);
rentalAoa.push(['티켓번호', 'R0001', '하단 목록에서 검색 후 입력 (R0001~R'+String(rentalRows.length).padStart(4,'0')+')']);
rentalAoa.push(['페이백 (원, 운영자 입력)', 0, '0 = 페이백 없음. 회사부담 한도 '+rp.payback_company_limit.toLocaleString()+' 초과 시 상담사 차감']);
rentalAoa.push([]);
rentalAoa.push(['■ 티켓 자동 조회 (VLOOKUP)']);
// 데이터 영역: 하단에 19행부터 시작 (헤더 18행)
const dataStartRow = 19;   // 1-indexed (헤더는 18)
const dataEndRow = dataStartRow + rentalRows.length - 1;
const rng = `A${dataStartRow}:U${dataEndRow}`;
// 컬럼 인덱스: A티켓·B카테고리·C그룹·D브랜드·E모델·F상품명·G약정·H케어·I점검·J소유권·K월납·L정상가·M리베·N페이백(목록)·O마진·P Tier·Q P·R우수·S시장성·T프로모션·U옵션변형
rentalAoa.push(['브랜드',     { t: 's', f: `IFERROR(VLOOKUP($B$5,${rng},4,FALSE),"")` }]);
rentalAoa.push(['모델',       { t: 's', f: `IFERROR(VLOOKUP($B$5,${rng},5,FALSE),"")` }]);
rentalAoa.push(['상품명',     { t: 's', f: `IFERROR(VLOOKUP($B$5,${rng},6,FALSE),"")` }]);
rentalAoa.push(['카테고리·그룹', { t: 's', f: `IFERROR(VLOOKUP($B$5,${rng},2,FALSE)&" · "&VLOOKUP($B$5,${rng},3,FALSE),"")` }]);
rentalAoa.push(['약정·케어',  { t: 's', f: `IFERROR(VLOOKUP($B$5,${rng},7,FALSE)&" · "&VLOOKUP($B$5,${rng},8,FALSE),"")` }]);
rentalAoa.push(['월납(원)',   { t: 'n', f: `IFERROR(VLOOKUP($B$5,${rng},11,FALSE),0)` }]);
rentalAoa.push(['리베이트(원)', { t: 'n', f: `IFERROR(VLOOKUP($B$5,${rng},13,FALSE),0)` }]);
rentalAoa.push([]);
rentalAoa.push(['■ 마진 재계산 (페이백 적용)']);
// 12행=리베, 6행=페이백입력
rentalAoa.push(['마진 = 리베×0.9 − 페이백 − P×' + rp.weight_cost_per_p.toLocaleString(), null]);
rentalAoa.push(['Tier (자동)', { t: 's', f: `IFERROR(VLOOKUP($B$5,${rng},16,FALSE),"")` }]);
rentalAoa.push(['상담사 P (자동)', { t: 'n', f: `IFERROR(VLOOKUP($B$5,${rng},17,FALSE),0)` }]);
rentalAoa.push(['최종 마진(원)', { t: 'n', f: `IFERROR(ROUND(VLOOKUP($B$5,${rng},13,FALSE)*0.9-$B$6-VLOOKUP($B$5,${rng},17,FALSE)*${rp.weight_cost_per_p},0),0)` }]);
rentalAoa.push([]);
rentalAoa.push(['■ 전체 티켓·상품 목록 (' + rentalRows.length + '건)']);

// 헤더 (18행)
rentalAoa.push(['티켓', '카테고리', '그룹', '브랜드', '모델', '상품명',
  '약정', '케어', '점검', '소유권', '월납', '정상가', '리베', '페이백', '마진',
  'Tier', 'P', '우수', '시장성', '프로모션', '옵션변형']);
// 데이터
for (const r of rentalRows) {
  const p = r.product || {};
  const c = p.category || {};
  rentalAoa.push([
    r.ticket_number, c.name || '', c.product_group || '',
    p.brand || '', p.model || '', p.name || '',
    r.months != null ? r.months + 'M' : '',
    r.care_service || '',
    r.inspection_cycle || '',
    r.ownership_months || '',
    Number(r.monthly_fee || 0),
    Number(r.normal_price || 0),
    Number(r.rebate || 0),
    Number(r.payback || 0),
    Number(r.margin || 0),
    r.tier_calculated || '',
    Number(r.point_weight || 0),
    p.is_premium ? '⭐' : '',
    Number(p.market_score || 0),
    r.promo_type || '',
    r.variant_label || '',
  ]);
}
const rentalSheet = xlsx.utils.aoa_to_sheet(rentalAoa);
rentalSheet['!cols'] = [
  { wch: 32 }, { wch: 16 }, { wch: 8 }, { wch: 10 }, { wch: 18 }, { wch: 40 },
  { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 8 }, { wch: 10 }, { wch: 10 },
  { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 20 }, { wch: 14 },
];
rentalSheet['!freeze'] = { xSplit: 0, ySplit: 18 };   // 헤더 행 고정
xlsx.utils.book_append_sheet(wb, rentalSheet, '가전렌탈 견적·마진');

// ─────────────────────────────────────────────────────────────────
// 시트 4: 인터넷+TV 견적 계산기
// ─────────────────────────────────────────────────────────────────
const itAoa = [];
itAoa.push(['인터넷+TV 견적 계산기']);
itAoa.push([`기준일 ${today} · 활성 티켓 ${(itRows||[]).length}건 · 정책 ${it.version}`]);
itAoa.push([]);
itAoa.push(['■ 입력 (노랑 셀)']);
itAoa.push(['티켓번호', (itRows||[])[0]?.ticket_number || 'KT0001', '하단 목록에서 검색 후 입력']);
itAoa.push([]);
itAoa.push(['■ 티켓 자동 조회 (VLOOKUP)']);
const itDataStart = 14;
const itDataEnd = itDataStart + (itRows||[]).length - 1;
const itRng = `A${itDataStart}:G${itDataEnd}`;
// 컬럼: A티켓·B통신사·C속도·D TV·E WiFi·F월요금·G사은품
itAoa.push(['통신사', { t: 's', f: `IFERROR(VLOOKUP($B$5,${itRng},2,FALSE),"")` }]);
itAoa.push(['속도', { t: 's', f: `IFERROR(VLOOKUP($B$5,${itRng},3,FALSE),"")` }]);
itAoa.push(['TV 상품', { t: 's', f: `IFERROR(VLOOKUP($B$5,${itRng},4,FALSE),"")` }]);
itAoa.push(['WiFi', { t: 's', f: `IFERROR(VLOOKUP($B$5,${itRng},5,FALSE),"")` }]);
itAoa.push(['월 요금(원)', { t: 'n', f: `IFERROR(VLOOKUP($B$5,${itRng},6,FALSE),0)` }]);
itAoa.push(['사은품(원)', { t: 'n', f: `IFERROR(VLOOKUP($B$5,${itRng},7,FALSE),0)` }]);
itAoa.push([]);
itAoa.push(['■ 전체 티켓 목록 (' + (itRows||[]).length + '건)']);
itAoa.push(['티켓', '통신사', '속도', 'TV', 'WiFi', '월요금', '사은품']);
for (const t of itRows || []) {
  itAoa.push([
    t.ticket_number, t.carrier || '', t.speed || '',
    t.tv_label || '', t.has_wifi ? 'O' : '',
    Number(t.monthly_fee || 0), Number(t.gift_amount || 0),
  ]);
}
const itSheet = xlsx.utils.aoa_to_sheet(itAoa);
itSheet['!cols'] = [{ wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 24 }, { wch: 6 }, { wch: 12 }, { wch: 12 }];
itSheet['!freeze'] = { xSplit: 0, ySplit: 14 };
xlsx.utils.book_append_sheet(wb, itSheet, '인터넷+TV 견적');

const out = `/Users/vinsenzo/Downloads/봉이_TM_운영가이드_${today}.xlsx`;
xlsx.writeFile(wb, out);
console.log('\n✅ 생성: ' + out);
console.log('시트: ' + wb.SheetNames.join(' / '));
