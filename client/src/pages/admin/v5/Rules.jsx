// V5 인센티브 — 정책 관리 (admin only)
// 정책 가이드 · 현재 정책 수정 · 새 버전 발행 · 영업이익 시뮬레이터 · 변경 이력
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useV5Auth } from '../../../hooks/useV5Auth.jsx';

// ── 스타일 ─────────────────────────────────────────────
const sectionStyle = {
  background: 'linear-gradient(135deg,#1e293b,#0f172a)',
  border: '1px solid #475569',
  borderRadius: 12,
  padding: '18px 22px',
  marginBottom: 20,
};
const h2Style = { fontSize: 15, color: '#fbbf24', fontWeight: 800, letterSpacing: '0.04em', marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid #334155' };
const fieldLabelStyle = { fontSize: 11, color: '#94a3b8', fontWeight: 700, marginBottom: 4, letterSpacing: '0.03em', display: 'block' };
const fieldInputStyle = {
  background: '#0f172a', border: '1px solid #475569', color: '#e2e8f0',
  padding: '8px 10px', borderRadius: 6, fontSize: 13, width: '100%',
  fontFamily: 'inherit', boxSizing: 'border-box', colorScheme: 'dark',
};
const hintStyle = { fontSize: 9.5, color: '#64748b', marginTop: 3, lineHeight: 1.4 };
const btnPrimary = { background: '#16a34a', color: '#fff', border: 'none', padding: '10px 22px', borderRadius: 8, fontWeight: 800, fontSize: 13, cursor: 'pointer' };
const btnSecondary = { background: '#475569', color: '#fff', border: 'none', padding: '10px 22px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' };
const btnDanger = { background: '#dc2626', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: 'pointer' };
const thStyle = { background: '#334155', color: '#f1f5f9', fontSize: 11, padding: '10px 8px', textAlign: 'left', fontWeight: 700 };
const tdStyle = { fontSize: 11.5, color: '#e2e8f0', padding: '10px 8px', borderBottom: '1px solid #334155' };
const summaryStyle = (color, bg) => ({
  cursor: 'pointer', fontWeight: 800, color, fontSize: 13,
  padding: '8px 12px', background: bg, borderRadius: 6,
});
const guideContentStyle = { padding: '14px 16px', fontSize: 12, color: '#cbd5e1', lineHeight: 1.7 };
const codeBlockStyle = {
  background: '#0f172a', border: '1px solid #334155', borderRadius: 6,
  padding: 12, margin: '10px 0',
  fontFamily: '"SF Mono", Monaco, monospace', fontSize: 12, color: '#86efac',
  lineHeight: 1.8,
};
const guideTableTh = { background: '#0f172a', padding: 8, textAlign: 'left', fontSize: 11 };
const activeBadge = { background: '#16a34a', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 800 };
const inactiveBadge = { background: '#475569', color: '#cbd5e1', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 800 };

// ── 토스트 ─────────────────────────────────────────────
function Toast({ message }) {
  if (!message) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)',
      background: '#16a34a', color: '#fff', padding: '14px 24px', borderRadius: 10,
      fontSize: 14, fontWeight: 800, boxShadow: '0 6px 24px rgba(22,163,74,0.5)', zIndex: 99999,
    }}>{message}</div>
  );
}

// ── 시뮬레이터 프리셋 ─────────────────────────────────
const SIM_PRESETS = {
  g3:        { agents: 1, sales: 30, weight: 1.5, premium_pct: 100, rebate: 924000, payback: 430000, add_payback: 50000 },
  g3penalty: { agents: 1, sales: 21, weight: 1.5, premium_pct: 0,   rebate: 660000, payback: 400000, add_payback: 0 },
  bep:       { agents: 1, sales: 30, weight: 1.5, premium_pct: 100, rebate: 924000, payback: 430000, add_payback: 50000 },
  current:   { agents: 9, sales: 1,  weight: 1.4, premium_pct: 25,  rebate: 776000, payback: 376000, add_payback: 5000 },
};

// ── 시뮬레이션 계산 (vanilla HTML과 100% 동일 로직) ──
function calcSimulation(p) {
  const agents = Math.max(1, p.agents || 0);
  const { sales, weight, rebate, payback, add_payback, tax_rate,
          base_salary, bonus, rate_g1, rate_g2, rate_g3, cap, th_g2, th_g3 } = p;
  const premPct = (p.premium_pct || 0) / 100;

  // per agent 계산
  const totalP = sales * weight;
  const premCount = Math.round(sales * premPct);

  // Grade 결정 (P 기준)
  let gradeTarget = 1;
  if (totalP >= th_g3) gradeTarget = 3;
  else if (totalP >= th_g2) gradeTarget = 2;

  // 페널티 — 우수 의무 (G2: 5건, G3: 10건)
  let gradeApplied = gradeTarget;
  let isPenalty = false;
  if (gradeTarget === 3 && premCount < 10) { gradeApplied = 2; isPenalty = true; }
  if (gradeApplied === 2 && premCount < 5) { gradeApplied = Math.min(gradeApplied, 1); isPenalty = true; }
  const appliedRate = gradeApplied === 3 ? rate_g3 : (gradeApplied === 2 ? rate_g2 : rate_g1);

  // 인센티브
  const incentive = totalP * appliedRate;
  const bonusTotal = premCount * bonus;
  const companyBurden = Math.min(add_payback, cap) * sales;
  const agentDeduct = Math.max(0, add_payback - cap) * sales;
  const agentTotal = base_salary + incentive + bonusTotal - agentDeduct;

  // 회사 손익 (× agents)
  const totalRev = rebate * sales * agents;
  const totalPayback = payback * sales * agents;
  const totalBurden = companyBurden * agents;
  const totalLabor = (base_salary + incentive + bonusTotal) * agents;
  const netRevenue = totalRev * tax_rate;
  const profit = netRevenue - totalPayback - totalBurden - totalLabor;
  const profitRate = totalRev > 0 ? (profit / totalRev * 100) : 0;
  const totalDeals = sales * agents;
  const perDealMargin = totalDeals > 0 ? (profit / totalDeals) : 0;

  // BEP — 인건비 / 건당 마진 (인건비 제외 회사 단위 마진)
  const perDealCompanyMargin = (rebate * tax_rate) - payback - Math.min(add_payback, cap);
  const labor1 = base_salary;
  const bepDeals = perDealCompanyMargin > 0 ? Math.ceil(labor1 / perDealCompanyMargin) : null;

  return {
    totalP, premCount, gradeApplied, isPenalty, appliedRate,
    incentive, bonusTotal, agentDeduct, agentTotal,
    netRevenue, totalPayback, totalBurden, totalLabor,
    profit, profitRate, totalDeals, perDealMargin, bepDeals,
  };
}

const fmt = (n) => (Math.round(n || 0)).toLocaleString('ko-KR') + '원';

// ── 메인 컴포넌트 ──────────────────────────────────────
export default function V5Rules() {
  const { apiCall, agent, isAdmin } = useV5Auth();
  const [allRules, setAllRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  // 폼 (현재 활성 정책)
  const [version, setVersion] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [bonus, setBonus] = useState(0);
  const [paybackCompany, setPaybackCompany] = useState(0);
  const [paybackMax, setPaybackMax] = useState(0);
  const [premMargin, setPremMargin] = useState(0);
  const [notes, setNotes] = useState('');
  const [rate1, setRate1] = useState(0);
  const [rate2, setRate2] = useState(0);
  const [rate3, setRate3] = useState(0);
  const [thr2P, setThr2P] = useState(0);
  const [thr2Prem, setThr2Prem] = useState(0);
  const [thr3P, setThr3P] = useState(0);
  const [thr3Prem, setThr3Prem] = useState(0);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }, []);

  const activeRule = useMemo(() => allRules.find(r => r.active), [allRules]);

  // ── 데이터 로드 ──
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiCall('GET', '/rules/all');
      if (!res.ok) throw new Error((await res.json()).error || '조회 실패');
      const { rules } = await res.json();
      setAllRules(rules || []);
      setError('');
      // 활성 정책을 폼에 반영
      const active = (rules || []).find(r => r.active);
      if (active) {
        setVersion(active.version || '');
        setEffectiveFrom((active.effective_from || '').slice(0, 10));
        setBonus(active.bonus_per_premium || 0);
        setPaybackCompany(active.payback_company_limit || 0);
        setPaybackMax(active.payback_max || 0);
        setPremMargin(active.premium_margin_threshold || 0);
        setNotes(active.notes || '');
        const rates = active.grade_rates || {};
        const thrs = active.grade_thresholds || {};
        setRate1(rates['1'] || 0);
        setRate2(rates['2'] || 0);
        setRate3(rates['3'] || 0);
        setThr2P((thrs['2'] || {}).points || 0);
        setThr2Prem((thrs['2'] || {}).premium || 0);
        setThr3P((thrs['3'] || {}).points || 0);
        setThr3Prem((thrs['3'] || {}).premium || 0);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── 폼 데이터 수집 ──
  const collectForm = () => ({
    version: version.trim(),
    effective_from: effectiveFrom,
    base_salary: 2300000, // V5 기본 권장 (상담사별 override)
    bonus_per_premium: parseInt(bonus, 10) || 0,
    payback_company_limit: parseInt(paybackCompany, 10) || 0,
    payback_max: parseInt(paybackMax, 10) || 0,
    premium_margin_threshold: parseInt(premMargin, 10) || 0,
    notes: notes.trim() || null,
    grade_rates: {
      '1': parseInt(rate1, 10) || 0,
      '2': parseInt(rate2, 10) || 0,
      '3': parseInt(rate3, 10) || 0,
    },
    grade_thresholds: {
      '2': { points: parseFloat(thr2P) || 0, premium: parseInt(thr2Prem, 10) || 0 },
      '3': { points: parseFloat(thr3P) || 0, premium: parseInt(thr3Prem, 10) || 0 },
    },
  });

  // ── 현재 정책 수정 ──
  const handleSaveCurrent = async () => {
    if (!activeRule) { alert('활성 정책 없음'); return; }
    if (!confirm(`현재 정책 [${activeRule.version}]을 수정하시겠습니까?`)) return;
    try {
      const res = await apiCall('PATCH', `/rules/${activeRule.id}`, collectForm());
      if (!res.ok) throw new Error((await res.json()).error || '저장 실패');
      showToast('✅ 수정 완료');
      await loadAll();
    } catch (e) {
      alert('오류: ' + e.message);
    }
  };

  // ── 새 버전 발행 ──
  const handlePublishNew = async () => {
    const body = collectForm();
    if (!body.version) { alert('새 버전 이름 입력 필수 (예: V6)'); return; }
    if (activeRule && body.version === activeRule.version) {
      if (!confirm(`'${body.version}'은 이미 활성 정책. 새 발행 시 기존이 비활성화됩니다. 진행?`)) return;
    } else if (!confirm(`새 정책 [${body.version}] 발행 + 기존 비활성화. 진행?`)) return;
    body.deactivate_others = true;
    try {
      const res = await apiCall('POST', '/rules', body);
      if (!res.ok) throw new Error((await res.json()).error || '발행 실패');
      showToast('🚀 새 버전 발행 완료');
      await loadAll();
    } catch (e) {
      alert('오류: ' + e.message);
    }
  };

  // ── 활성/비활성 토글 ──
  const handleToggleActive = async (id, active) => {
    if (!confirm((active ? '활성화' : '비활성화') + ' 하시겠습니까?')) return;
    try {
      const res = await apiCall('PATCH', `/rules/${id}`, { active });
      if (!res.ok) throw new Error((await res.json()).error || '실패');
      showToast(active ? '✅ 활성화됨' : '❌ 비활성화됨');
      await loadAll();
    } catch (e) {
      alert('오류: ' + e.message);
    }
  };

  if (!isAdmin) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#fbbf24', fontSize: 14 }}>
        ⚠️ admin 권한 필요 (현재 {agent?.role || '미인증'})
      </div>
    );
  }

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, paddingBottom: 16, borderBottom: '1px solid #334155' }}>
        <div>
          <h1 style={{ fontSize: 22, color: '#f8fafc', fontWeight: 800, letterSpacing: '-0.02em' }}>⚙️ 인센티브 정책 관리 (V5)</h1>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>기본급 · Grade 단가 · 임계값 · 우수상품 보너스 · 추가 페이백 정책 · 변경 이력</div>
        </div>
      </div>

      {error && <div style={{ color: '#fca5a5', fontSize: 12, marginBottom: 16 }}>⚠️ {error}</div>}
      {loading && !allRules.length && <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 16 }}>로딩 중...</div>}

      <PolicyGuide />

      <CurrentRuleEditor
        version={version} setVersion={setVersion}
        effectiveFrom={effectiveFrom} setEffectiveFrom={setEffectiveFrom}
        bonus={bonus} setBonus={setBonus}
        paybackCompany={paybackCompany} setPaybackCompany={setPaybackCompany}
        paybackMax={paybackMax} setPaybackMax={setPaybackMax}
        premMargin={premMargin} setPremMargin={setPremMargin}
        notes={notes} setNotes={setNotes}
        rate1={rate1} setRate1={setRate1}
        rate2={rate2} setRate2={setRate2}
        rate3={rate3} setRate3={setRate3}
        thr2P={thr2P} setThr2P={setThr2P}
        thr2Prem={thr2Prem} setThr2Prem={setThr2Prem}
        thr3P={thr3P} setThr3P={setThr3P}
        thr3Prem={thr3Prem} setThr3Prem={setThr3Prem}
        onSave={handleSaveCurrent} onPublish={handlePublishNew}
      />

      <Simulator />

      <RuleHistory rules={allRules} onToggle={handleToggleActive} />

      <Toast message={toast} />
    </div>
  );
}

// ── 📚 정책 가이드 (details/summary 7개) ──
function PolicyGuide() {
  return (
    <div style={{
      ...sectionStyle,
      background: 'linear-gradient(135deg,rgba(139,92,246,0.06),#0f172a)',
      borderColor: 'rgba(139,92,246,0.4)',
    }}>
      <h2 style={{ ...h2Style, color: '#a78bfa' }}>📚 V5 정책 가이드 (용어·계산 방식)</h2>

      <details open style={{ marginBottom: 14 }}>
        <summary style={summaryStyle('#fbbf24', 'rgba(251,191,36,0.08)')}>⭐ 우수상품 (S Tier)이란?</summary>
        <div style={guideContentStyle}>
          <p>회사 마진(=수익)이 높은 상품. 마진 ≥ <b style={{ color: '#fbbf24' }}>우수상품 마진 임계값</b>(기본 250,000원)인 상품 자동 분류.</p>
          <p style={{ marginTop: 8 }}><b>혜택:</b></p>
          <ul style={{ marginLeft: 18, lineHeight: 1.8 }}>
            <li>상담사가 우수상품 1건 영업 시 <b style={{ color: '#22c55e' }}>+10,000원 보너스</b> (별도 지급)</li>
            <li>G2/G3 등급 승급 조건의 핵심 (G2: 우수 5건+, G3: 우수 10건+)</li>
            <li>본사 입장에서도 영업이익 큼 → 상담사·회사 모두 win-win</li>
          </ul>
          <p style={{ marginTop: 8 }}><b>예시 (V5 시드):</b> SKT 500M+B tv 올 (마진 296,600원), KT 1G+모든G (마진 277,500원)</p>
        </div>
      </details>

      <details style={{ marginBottom: 14 }}>
        <summary style={summaryStyle('#22c55e', 'rgba(34,197,94,0.08)')}>📐 마진 (Margin) 계산식</summary>
        <div style={guideContentStyle}>
          <p>각 상품 1건 영업이 회사에 남기는 추정 순이익. DB가 자동 계산 (수정 불가).</p>
          <div style={codeBlockStyle}>
            마진 = (리베이트 × 0.9) − 페이백 − (가중치 × 70,000원)
          </div>
          <ul style={{ marginLeft: 18, lineHeight: 1.9 }}>
            <li><b>리베이트 × 0.9</b>: 통신사가 주는 정산금에서 세금 10% 공제</li>
            <li><b>페이백</b>: 사은품 정가 (회사가 고객에게 지급한 비용)</li>
            <li><b>가중치 × 70,000원</b>: 평균 인센티브 비용 표준 (1P당 7만원, V4 평가 기준)</li>
          </ul>
          <p style={{ marginTop: 8, color: '#fca5a5' }}><b>마진 음수면 손해 영업.</b> Tier 'C' 상품은 회사 손실 위험.</p>
        </div>
      </details>

      <details style={{ marginBottom: 14 }}>
        <summary style={summaryStyle('#60a5fa', 'rgba(96,165,250,0.08)')}>🏅 Tier 자동 분류 (마진 기준)</summary>
        <div style={guideContentStyle}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6 }}>
            <thead>
              <tr><th style={guideTableTh}>Tier</th><th style={guideTableTh}>마진 임계값</th><th style={guideTableTh}>의미</th></tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: 8, borderBottom: '1px solid #334155' }}>
                  <span style={{ ...activeBadge, background: '#fbbf24', color: '#78350f' }}>⭐ S</span>
                </td>
                <td style={{ padding: 8, borderBottom: '1px solid #334155', color: '#fbbf24', fontWeight: 700 }}>≥ 250,000원</td>
                <td style={{ padding: 8, borderBottom: '1px solid #334155' }}>우수상품 — 보너스 +1만/건</td>
              </tr>
              <tr>
                <td style={{ padding: 8, borderBottom: '1px solid #334155' }}>
                  <span style={{ ...activeBadge, background: '#60a5fa', color: '#1e3a8a' }}>A</span>
                </td>
                <td style={{ padding: 8, borderBottom: '1px solid #334155', color: '#60a5fa', fontWeight: 700 }}>≥ 180,000원</td>
                <td style={{ padding: 8, borderBottom: '1px solid #334155' }}>권장 영업 상품</td>
              </tr>
              <tr>
                <td style={{ padding: 8, borderBottom: '1px solid #334155' }}>
                  <span style={{ ...activeBadge, background: '#94a3b8', color: '#0f172a' }}>B</span>
                </td>
                <td style={{ padding: 8, borderBottom: '1px solid #334155', color: '#94a3b8', fontWeight: 700 }}>≥ 120,000원</td>
                <td style={{ padding: 8, borderBottom: '1px solid #334155' }}>정상 상품</td>
              </tr>
              <tr>
                <td style={{ padding: 8 }}>
                  <span style={{ ...activeBadge, background: '#475569', color: '#cbd5e1' }}>C</span>
                </td>
                <td style={{ padding: 8, color: '#fca5a5', fontWeight: 700 }}>{'< 120,000원'}</td>
                <td style={{ padding: 8 }}>⚠️ 위험 상품 (손해 가능)</td>
              </tr>
            </tbody>
          </table>
          <p style={{ marginTop: 8 }}><b>자동 재분류:</b> 리베이트나 페이백을 변경하면 마진 자동 재계산 → Tier도 자동 변경.</p>
        </div>
      </details>

      <details style={{ marginBottom: 14 }}>
        <summary style={summaryStyle('#dc2626', 'rgba(220,38,38,0.08)')}>🎯 Grade & 단가 (인센티브 핵심)</summary>
        <div style={guideContentStyle}>
          <p>한 달 누적 P (포인트)에 따라 등급 결정 → P × 단가가 인센티브.</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6 }}>
            <thead>
              <tr>
                <th style={guideTableTh}>등급</th><th style={guideTableTh}>누적 P</th>
                <th style={guideTableTh}>우수 의무</th><th style={guideTableTh}>단가 (₩/P)</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={{ padding: 8, borderBottom: '1px solid #334155' }}><b>G1</b></td><td style={{ padding: 8, borderBottom: '1px solid #334155' }}>0 ~ 15</td><td style={{ padding: 8, borderBottom: '1px solid #334155', color: '#94a3b8' }}>없음</td><td style={{ padding: 8, borderBottom: '1px solid #334155', color: '#86efac', fontWeight: 800 }}>20,000</td></tr>
              <tr><td style={{ padding: 8, borderBottom: '1px solid #334155' }}><b>G2</b></td><td style={{ padding: 8, borderBottom: '1px solid #334155' }}>16 ~ 30</td><td style={{ padding: 8, borderBottom: '1px solid #334155', color: '#fbbf24' }}>우수 5건+</td><td style={{ padding: 8, borderBottom: '1px solid #334155', color: '#86efac', fontWeight: 800 }}>30,000</td></tr>
              <tr><td style={{ padding: 8 }}><b>G3</b></td><td style={{ padding: 8 }}>31+</td><td style={{ padding: 8, color: '#fbbf24' }}>우수 10건+</td><td style={{ padding: 8, color: '#86efac', fontWeight: 800 }}>40,000</td></tr>
            </tbody>
          </table>
          <p style={{ marginTop: 10 }}><b>가중치 (P)</b>: 인터넷 단독 = 1.0P, 인터넷+TV 결합 = 1.5P</p>
          <p style={{ marginTop: 6, color: '#fca5a5' }}><b>⚠️ 페널티:</b> 우수 의무 미달 시 한 단계 강등.<br/>
            예: 31P 달성했지만 우수 0건 → G3 자격 X → G2 단가(3만/P)로 강등 적용</p>
          <div style={{ background: '#0f172a', borderLeft: '3px solid #fbbf24', padding: '10px 12px', marginTop: 10, fontSize: 11, color: '#fbbf24' }}>
            💡 <b>소급 적용:</b> Grade 진입 시 누적 P 전체에 새 단가 적용. 1건 차이로 단가 점프 가능.<br/>
            예: 30P (G2 90만) → 31P (G3 124만) — 추가 1.5P가 34만원 가치
          </div>
        </div>
      </details>

      <details style={{ marginBottom: 14 }}>
        <summary style={summaryStyle('#0891b2', 'rgba(8,145,178,0.08)')}>💰 추가 페이백 분담</summary>
        <div style={guideContentStyle}>
          <p>고객에게 정가보다 더 주는 사은품 (협상용). 한도와 분담 정책 있음.</p>
          <ul style={{ marginLeft: 18, lineHeight: 1.9 }}>
            <li><b>최대 페이백</b>: 50,000원 (DB CHECK 제약, 초과 입력 거부)</li>
            <li><b>회사 부담</b>: 30,000원까지 (회사 영업이익에서 자동 차감)</li>
            <li><b>상담사 차감</b>: 30,001~50,000원은 상담사 인센티브에서 차감</li>
          </ul>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
            <thead>
              <tr>
                <th style={{ ...guideTableTh, padding: '6px 8px', fontSize: 10 }}>페이백 금액</th>
                <th style={{ ...guideTableTh, padding: '6px 8px', fontSize: 10 }}>회사 부담</th>
                <th style={{ ...guideTableTh, padding: '6px 8px', fontSize: 10 }}>상담사 차감</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={{ padding: '6px 8px', borderBottom: '1px solid #334155' }}>30,000</td><td style={{ padding: '6px 8px', borderBottom: '1px solid #334155' }}>30,000</td><td style={{ padding: '6px 8px', borderBottom: '1px solid #334155' }}>0</td></tr>
              <tr><td style={{ padding: '6px 8px', borderBottom: '1px solid #334155' }}>40,000</td><td style={{ padding: '6px 8px', borderBottom: '1px solid #334155' }}>30,000</td><td style={{ padding: '6px 8px', borderBottom: '1px solid #334155', color: '#fca5a5' }}>10,000</td></tr>
              <tr><td style={{ padding: '6px 8px', borderBottom: '1px solid #334155' }}>50,000</td><td style={{ padding: '6px 8px', borderBottom: '1px solid #334155' }}>30,000</td><td style={{ padding: '6px 8px', borderBottom: '1px solid #334155', color: '#fca5a5' }}>20,000</td></tr>
              <tr><td style={{ padding: '6px 8px', color: '#dc2626' }}>50,001+</td><td style={{ padding: '6px 8px' }} colSpan="2">❌ 입력 거부 (DB CHECK)</td></tr>
            </tbody>
          </table>
        </div>
      </details>

      <details style={{ marginBottom: 14 }}>
        <summary style={summaryStyle('#22c55e', 'rgba(34,197,94,0.08)')}>📊 월 총수령액 계산</summary>
        <div style={guideContentStyle}>
          <div style={codeBlockStyle}>
            월 총수령액 = 기본급<br/>
            &nbsp;&nbsp;+ 누적 P × 적용 단가 (인센티브)<br/>
            &nbsp;&nbsp;+ 우수 건수 × 10,000원 (보너스)<br/>
            &nbsp;&nbsp;− 본인 페이백 차감
          </div>
          <p style={{ marginTop: 8 }}><b>예시:</b> 김상담 1달 영업 → 누적 21P (전부 결합), 우수 14건, 페이백 0</p>
          <ul style={{ marginLeft: 18, lineHeight: 1.9 }}>
            <li>P 21 ≥ 16 → G2 자격, 우수 14 ≥ 5 → 페널티 없음</li>
            <li>인센티브: 21 × 30,000 = <b style={{ color: '#86efac' }}>630,000원</b></li>
            <li>보너스: 14 × 10,000 = <b style={{ color: '#86efac' }}>140,000원</b></li>
            <li>총수령: 2,300,000 + 630,000 + 140,000 = <b style={{ color: '#fbbf24', fontSize: 14 }}>3,070,000원</b></li>
          </ul>
        </div>
      </details>

      <details>
        <summary style={summaryStyle('#94a3b8', 'rgba(255,255,255,0.04)')}>⚙️ 정산 흐름 (계약 상태별)</summary>
        <div style={guideContentStyle}>
          <ul style={{ marginLeft: 18, lineHeight: 1.9 }}>
            <li><b>⏰ 계약대기 (pending)</b>: TM 등록 후 계약부서 처리 전. 정산 미반영.</li>
            <li><b>✅ 계약완료 (completed)</b>: 정산 포함 (인센티브·보너스·매출 카운트)</li>
            <li><b>❌ 계약취소 (cancelled)</b>: 정산 제외. 누적 P/우수 자동 차감.</li>
          </ul>
          <p style={{ marginTop: 8 }}><b>월말 정산:</b> admin이 📊 대시보드에서 [📌 전체 정산 확정] 버튼 클릭 → monthly_settlements 테이블에 확정 저장.</p>
          <p style={{ marginTop: 6 }}><b>정산 후 취소:</b> 익월 정산이라 영향 없음 (상태 변경만 기록).</p>
        </div>
      </details>
    </div>
  );
}

// ── 📌 현재 정책 편집 ──
function CurrentRuleEditor(props) {
  const {
    version, setVersion, effectiveFrom, setEffectiveFrom,
    bonus, setBonus, paybackCompany, setPaybackCompany,
    paybackMax, setPaybackMax, premMargin, setPremMargin,
    notes, setNotes,
    rate1, setRate1, rate2, setRate2, rate3, setRate3,
    thr2P, setThr2P, thr2Prem, setThr2Prem,
    thr3P, setThr3P, thr3Prem, setThr3Prem,
    onSave, onPublish,
  } = props;

  return (
    <div style={sectionStyle}>
      <h2 style={h2Style}>📌 활성 정책 (현재 적용 중)</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 12 }}>
        <Field label="버전" hint="고유 식별자 (V5, V6 등)">
          <input type="text" value={version} onChange={e => setVersion(e.target.value)}
            placeholder="V5" style={fieldInputStyle} />
        </Field>
        <Field label="적용 시작일">
          <input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)}
            style={fieldInputStyle} />
        </Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 12 }}>
        <Field label="우수상품 건당 보너스 (₩)" hint="마진 ≥ 임계값인 영업 1건당 추가">
          <input type="number" value={bonus} onChange={e => setBonus(e.target.value)}
            min="0" step="1000" style={fieldInputStyle} />
        </Field>
        <Field label="비고 (행1 미사용)">
          <input type="text" disabled style={{ ...fieldInputStyle, opacity: 0.3 }}
            placeholder="(이 자리는 비고로 사용 안함)" />
        </Field>
      </div>
      <div style={{
        background: 'rgba(96,165,250,0.06)', borderLeft: '3px solid #60a5fa',
        padding: '8px 12px', marginBottom: 14, fontSize: 11, color: '#94a3b8', borderRadius: 4,
      }}>
        💡 <b>기본급</b>은 상담사별로 다를 수 있어 <b style={{ color: '#60a5fa' }}>👥 상담사 관리</b>에서 개인별로 설정합니다.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 12 }}>
        <Field label="회사 페이백 부담 한도 (₩)" hint="이 금액 이하는 회사가 자동 부담">
          <input type="number" value={paybackCompany} onChange={e => setPaybackCompany(e.target.value)}
            min="0" step="1000" style={fieldInputStyle} />
        </Field>
        <Field label="최대 페이백 (₩)" hint="초과 입력 불가 (DB CHECK 제약)">
          <input type="number" value={paybackMax} onChange={e => setPaybackMax(e.target.value)}
            min="0" step="1000" style={fieldInputStyle} />
        </Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 12 }}>
        <Field label="우수상품 마진 임계값 (₩)" hint="이 마진 이상이면 우수상품(S Tier)">
          <input type="number" value={premMargin} onChange={e => setPremMargin(e.target.value)}
            min="0" step="10000" style={fieldInputStyle} />
        </Field>
        <Field label="비고">
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="(선택) 변경 사유 등" style={fieldInputStyle} />
        </Field>
      </div>

      <h2 style={{ ...h2Style, marginTop: 18 }}>🎯 Grade 단가 (₩/P)</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <GradeCard title="G1 (기본)">
          <Field label="단가 (₩/P)">
            <input type="number" value={rate1} onChange={e => setRate1(e.target.value)}
              min="0" step="1000" style={fieldInputStyle} />
          </Field>
        </GradeCard>
        <GradeCard title="G2">
          <Field label="단가 (₩/P)">
            <input type="number" value={rate2} onChange={e => setRate2(e.target.value)}
              min="0" step="1000" style={fieldInputStyle} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 8 }}>
            <Field label="임계 P">
              <input type="number" value={thr2P} onChange={e => setThr2P(e.target.value)}
                min="0" step="0.5" style={fieldInputStyle} />
            </Field>
            <Field label="우수 의무">
              <input type="number" value={thr2Prem} onChange={e => setThr2Prem(e.target.value)}
                min="0" step="1" style={fieldInputStyle} />
            </Field>
          </div>
        </GradeCard>
        <GradeCard title="G3 (최고)">
          <Field label="단가 (₩/P)">
            <input type="number" value={rate3} onChange={e => setRate3(e.target.value)}
              min="0" step="1000" style={fieldInputStyle} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 8 }}>
            <Field label="임계 P">
              <input type="number" value={thr3P} onChange={e => setThr3P(e.target.value)}
                min="0" step="0.5" style={fieldInputStyle} />
            </Field>
            <Field label="우수 의무">
              <input type="number" value={thr3Prem} onChange={e => setThr3Prem(e.target.value)}
                min="0" step="1" style={fieldInputStyle} />
            </Field>
          </div>
        </GradeCard>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
        <button onClick={onSave} style={btnPrimary}>💾 현재 정책 수정 저장 (PATCH)</button>
        <button onClick={onPublish} style={btnSecondary}>📌 새 버전으로 발행 (POST + 기존 비활성화)</button>
      </div>
    </div>
  );
}

// ── 🧪 영업이익 시뮬레이터 ──
function Simulator() {
  // 기본 프리셋: g3 + default policy
  const [agents, setAgents] = useState(1);
  const [sales, setSales] = useState(30);
  const [weight, setWeight] = useState(1.5);
  const [premiumPct, setPremiumPct] = useState(100);
  const [rebate, setRebate] = useState(924000);
  const [payback, setPayback] = useState(430000);
  const [addPayback, setAddPayback] = useState(50000);
  const [taxRate, setTaxRate] = useState(0.9);

  // 정책 파라미터
  const [baseSalary, setBaseSalary] = useState(2300000);
  const [bonus, setBonus] = useState(10000);
  const [rateG1, setRateG1] = useState(20000);
  const [rateG2, setRateG2] = useState(30000);
  const [rateG3, setRateG3] = useState(40000);
  const [cap, setCap] = useState(30000);
  const [thG2, setThG2] = useState(16);
  const [thG3, setThG3] = useState(31);

  // 프리셋 적용
  const applyPreset = (key) => {
    const p = SIM_PRESETS[key];
    if (!p) return;
    setAgents(p.agents);
    setSales(p.sales);
    setWeight(p.weight);
    setPremiumPct(p.premium_pct);
    setRebate(p.rebate);
    setPayback(p.payback);
    setAddPayback(p.add_payback);
  };

  // 실시간 계산
  const result = useMemo(() => calcSimulation({
    agents: parseFloat(agents) || 0,
    sales: parseFloat(sales) || 0,
    weight: parseFloat(weight) || 0,
    premium_pct: parseFloat(premiumPct) || 0,
    rebate: parseFloat(rebate) || 0,
    payback: parseFloat(payback) || 0,
    add_payback: parseFloat(addPayback) || 0,
    tax_rate: parseFloat(taxRate) || 0,
    base_salary: parseFloat(baseSalary) || 0,
    bonus: parseFloat(bonus) || 0,
    rate_g1: parseFloat(rateG1) || 0,
    rate_g2: parseFloat(rateG2) || 0,
    rate_g3: parseFloat(rateG3) || 0,
    cap: parseFloat(cap) || 0,
    th_g2: parseFloat(thG2) || 0,
    th_g3: parseFloat(thG3) || 0,
  }), [agents, sales, weight, premiumPct, rebate, payback, addPayback, taxRate,
       baseSalary, bonus, rateG1, rateG2, rateG3, cap, thG2, thG3]);

  const gradeColor = ['', '#6b7280', '#3b82f6', '#dc2626'][result.gradeApplied] || '#6b7280';
  const numericSales = parseFloat(sales) || 0;

  return (
    <div style={sectionStyle}>
      <h2 style={h2Style}>🧪 영업이익 시뮬레이터 — 회사 마진 / 인센티브 분리</h2>
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>
        💡 V5 기획서 공식 그대로 — 정책·영업 가정 조정 시 회사 영업이익과 상담사 수령액 즉시 계산.
        추후 정책 변경 사전 영향 평가에 사용.
      </div>

      {/* 빠른 프리셋 */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        <button type="button" onClick={() => applyPreset('g3')}
          style={{ ...btnSecondary, background: '#16a34a' }}>📈 시나리오 1: G3 정상 (기획서)</button>
        <button type="button" onClick={() => applyPreset('g3penalty')}
          style={{ ...btnSecondary, background: '#dc2626' }}>⚠️ 시나리오 2: G3→G2 페널티</button>
        <button type="button" onClick={() => applyPreset('bep')}
          style={{ ...btnSecondary, background: '#3b82f6' }}>📊 시나리오 6: BEP·이익률</button>
        <button type="button" onClick={() => applyPreset('current')}
          style={{ ...btnSecondary, background: '#7c3aed' }}>🔍 현재 운영 추정</button>
      </div>

      {/* 입력 영역 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
        {/* 영업 가정 */}
        <div style={{
          background: 'rgba(59,130,246,0.06)', border: '1.5px solid rgba(59,130,246,0.3)',
          borderRadius: 8, padding: '14px 16px',
        }}>
          <div style={{ fontSize: 12, color: '#60a5fa', fontWeight: 800, marginBottom: 10, letterSpacing: '0.04em' }}>
            📊 영업 가정 (per 상담사 1명)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 11 }}>
            <SimInput label="상담사 수" value={agents} onChange={setAgents} min="1" />
            <SimInput label="월 영업/명" value={sales} onChange={setSales} min="0" />
            <SimInput label="평균 가중치 P (1.0~1.5)" value={weight} onChange={setWeight} min="0.5" max="2" step="0.1" />
            <SimInput label="우수상품 비율 (%)" value={premiumPct} onChange={setPremiumPct} min="0" max="100" />
            <SimInput label="평균 리베이트 (₩)" value={rebate} onChange={setRebate} min="0" step="10000" />
            <SimInput label="평균 페이백 정가 (₩)" value={payback} onChange={setPayback} min="0" step="10000" />
            <SimInput label="추가 페이백/건 (₩, 0~50K)" value={addPayback} onChange={setAddPayback} min="0" max="50000" step="1000" />
            <SimInput label="매출 인식률 (예: 0.9)" value={taxRate} onChange={setTaxRate} min="0.5" max="1" step="0.01" />
          </div>
        </div>

        {/* 정책 파라미터 */}
        <div style={{
          background: 'rgba(167,139,250,0.06)', border: '1.5px solid rgba(167,139,250,0.3)',
          borderRadius: 8, padding: '14px 16px',
        }}>
          <div style={{ fontSize: 12, color: '#a78bfa', fontWeight: 800, marginBottom: 10, letterSpacing: '0.04em' }}>
            ⚙️ 정책 파라미터 (변경 시뮬)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 11 }}>
            <SimInput label="기본급 (₩)" value={baseSalary} onChange={setBaseSalary} min="0" step="100000" />
            <SimInput label="우수 보너스/건 (₩)" value={bonus} onChange={setBonus} min="0" step="1000" />
            <SimInput label="G1 단가 (₩/P)" value={rateG1} onChange={setRateG1} min="0" step="1000" />
            <SimInput label="G2 단가 (₩/P)" value={rateG2} onChange={setRateG2} min="0" step="1000" />
            <SimInput label="G3 단가 (₩/P)" value={rateG3} onChange={setRateG3} min="0" step="1000" />
            <SimInput label="회사 페이백 한도 (₩)" value={cap} onChange={setCap} min="0" step="5000" />
            <SimInput label="G2 임계 P" value={thG2} onChange={setThG2} min="0" step="1" />
            <SimInput label="G3 임계 P" value={thG3} onChange={setThG3} min="0" step="1" />
          </div>
        </div>
      </div>

      {/* 결과 카드 3개 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        {/* 회사 손익 */}
        <div style={{
          background: 'rgba(34,197,94,0.06)', border: '1.5px solid rgba(34,197,94,0.4)',
          borderRadius: 10, padding: '14px 16px',
        }}>
          <div style={{ fontSize: 12, color: '#22c55e', fontWeight: 800, marginBottom: 10, letterSpacing: '0.04em' }}>🏢 회사 손익</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11.5 }}>
            <ResultRow label="매출 (리베이트 × 인식률)" value={'+' + fmt(result.netRevenue)} valueColor="#86efac" />
            <ResultRow label="− 페이백 정가" value={'-' + fmt(result.totalPayback)} valueColor="#fca5a5" />
            <ResultRow label="− 회사 부담 추가페이백" value={'-' + fmt(result.totalBurden)} valueColor="#fca5a5" />
            <ResultRow label="− 인건비 합계" value={'-' + fmt(result.totalLabor)} valueColor="#fca5a5" />
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1.5px solid #475569', fontSize: 14 }}>
              <span style={{ fontWeight: 800 }}>🟢 영업이익</span>
              <b style={{ color: result.profit >= 0 ? '#22c55e' : '#fca5a5', fontSize: 18, fontWeight: 900 }}>
                {(result.profit >= 0 ? '+' : '') + fmt(result.profit)}
              </b>
            </div>
            <ResultRow label="이익률" value={result.profitRate.toFixed(1) + '%'} small />
            <ResultRow label="건당 회사 마진" value={fmt(result.perDealMargin)} small />
          </div>
        </div>

        {/* 상담사 수령 */}
        <div style={{
          background: 'rgba(251,191,36,0.06)', border: '1.5px solid rgba(251,191,36,0.4)',
          borderRadius: 10, padding: '14px 16px',
        }}>
          <div style={{ fontSize: 12, color: '#fbbf24', fontWeight: 800, marginBottom: 10, letterSpacing: '0.04em' }}>👤 상담사 수령 (per 1명)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11.5 }}>
            <ResultRow label="+ 기본급" value={'+' + fmt(baseSalary)} valueColor="#86efac" />
            <ResultRow label="+ 인센티브 (P × 단가)" value={'+' + fmt(result.incentive)} valueColor="#86efac" />
            <ResultRow label="+ 우수 보너스" value={'+' + fmt(result.bonusTotal)} valueColor="#86efac" />
            <ResultRow label="− 본인 페이백 차감" value={'-' + fmt(result.agentDeduct)} valueColor="#fca5a5" />
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1.5px solid #475569', fontSize: 14 }}>
              <span style={{ fontWeight: 800 }}>💰 총 수령</span>
              <b style={{ color: '#fbbf24', fontSize: 18, fontWeight: 900 }}>{fmt(result.agentTotal)}</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: '#94a3b8' }}>
              <span>적용 Grade</span>
              <b>
                <span style={{ background: gradeColor, color: '#fff', padding: '1px 8px', borderRadius: 4 }}>G{result.gradeApplied}</span>
                {result.isPenalty && <span style={{ color: '#fbbf24', fontSize: 9.5, marginLeft: 6 }}>⚠️ 페널티</span>}
              </b>
            </div>
            <ResultRow label="건당 평균 수령" value={numericSales > 0 ? fmt(result.agentTotal / numericSales) : '-'} small />
          </div>
        </div>

        {/* 산출 지표 */}
        <div style={{
          background: 'rgba(99,102,241,0.06)', border: '1.5px solid rgba(99,102,241,0.4)',
          borderRadius: 10, padding: '14px 16px',
        }}>
          <div style={{ fontSize: 12, color: '#818cf8', fontWeight: 800, marginBottom: 10, letterSpacing: '0.04em' }}>📐 산출 지표</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11.5 }}>
            <ResultRow label="총 영업 건수" value={result.totalDeals + '건'} />
            <ResultRow label="총 P" value={(result.totalP * (parseFloat(agents) || 1)).toFixed(1) + 'P'} />
            <ResultRow label="우수 건수" value={(result.premCount * (parseFloat(agents) || 1)) + '건'} />
            <ResultRow label="페널티?" value={result.isPenalty ? '⚠️ 발동' : '없음'} />
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1.5px solid #475569' }}>
              <span>BEP (영업 건수)</span>
              <b style={{ color: '#fbbf24' }}>{result.bepDeals != null ? result.bepDeals + '건/명' : '계산불가'}</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: '#94a3b8' }}>
              <span>= 인건비 ÷ 건당 마진</span><span></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 📜 정책 변경 이력 ──
function RuleHistory({ rules, onToggle }) {
  return (
    <div style={sectionStyle}>
      <h2 style={h2Style}>📜 정책 변경 이력</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#1e293b', borderRadius: 10, overflow: 'hidden' }}>
        <thead>
          <tr>
            <th style={thStyle}>버전</th>
            <th style={thStyle}>적용일</th>
            <th style={thStyle}>활성</th>
            <th style={thStyle}>G1/G2/G3</th>
            <th style={thStyle}>임계 P</th>
            <th style={thStyle}>우수 의무</th>
            <th style={thStyle}>보너스</th>
            <th style={thStyle}>페이백 (회사/최대)</th>
            <th style={thStyle}>비고</th>
            <th style={thStyle}>작업</th>
          </tr>
        </thead>
        <tbody>
          {!rules.length ? (
            <tr><td colSpan="10" style={{ ...tdStyle, textAlign: 'center', padding: 30, color: '#64748b' }}>없음</td></tr>
          ) : rules.map(r => {
            const rates = r.grade_rates || {};
            const thrs = r.grade_thresholds || {};
            return (
              <tr key={r.id}>
                <td style={tdStyle}><b>{r.version}</b></td>
                <td style={tdStyle}>{(r.effective_from || '').slice(0, 10)}</td>
                <td style={tdStyle}>
                  {r.active ? <span style={activeBadge}>활성</span> : <span style={inactiveBadge}>비활성</span>}
                </td>
                <td style={tdStyle}>
                  {(rates['1'] || 0).toLocaleString()} / {(rates['2'] || 0).toLocaleString()} / {(rates['3'] || 0).toLocaleString()}
                </td>
                <td style={tdStyle}>{(thrs['2'] || {}).points || 0}P / {(thrs['3'] || {}).points || 0}P</td>
                <td style={tdStyle}>{(thrs['2'] || {}).premium || 0} / {(thrs['3'] || {}).premium || 0}건</td>
                <td style={tdStyle}>{(r.bonus_per_premium || 0).toLocaleString()}</td>
                <td style={tdStyle}>
                  {(r.payback_company_limit || 0).toLocaleString()} / {(r.payback_max || 0).toLocaleString()}
                </td>
                <td style={{ ...tdStyle, fontSize: 10, color: '#94a3b8' }}>{r.notes || '-'}</td>
                <td style={tdStyle}>
                  {r.active
                    ? <button style={btnDanger} onClick={() => onToggle(r.id, false)}>비활성화</button>
                    : <button style={{ ...btnDanger, background: '#16a34a' }} onClick={() => onToggle(r.id, true)}>활성화</button>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── 헬퍼 컴포넌트 ──
function Field({ label, hint, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <label style={fieldLabelStyle}>{label}</label>
      {children}
      {hint && <div style={hintStyle}>{hint}</div>}
    </div>
  );
}

function GradeCard({ title, children }) {
  return (
    <div style={{
      background: 'rgba(0,0,0,0.3)', border: '1px solid #475569', borderRadius: 8, padding: 12,
    }}>
      <div style={{ fontSize: 12, color: '#fbbf24', fontWeight: 800, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function SimInput({ label, value, onChange, min, max, step }) {
  return (
    <label style={{ color: '#cbd5e1', fontWeight: 600 }}>
      {label}
      <input type="number" value={value} onChange={e => onChange(e.target.value)}
        min={min} max={max} step={step}
        style={{
          display: 'block', width: '100%', marginTop: 4, padding: '6px 8px',
          background: '#0f172a', border: '1px solid #475569', color: '#e2e8f0',
          borderRadius: 5, fontSize: 11.5, fontFamily: 'inherit', boxSizing: 'border-box',
        }} />
    </label>
  );
}

function ResultRow({ label, value, valueColor, small }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      ...(small ? { fontSize: 10.5, color: '#94a3b8' } : {}),
    }}>
      <span>{label}</span>
      <b style={valueColor ? { color: valueColor } : undefined}>{value}</b>
    </div>
  );
}
