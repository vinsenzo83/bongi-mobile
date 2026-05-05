// V5 인센티브 — 대시보드
import { useEffect, useState } from 'react';
import { useV5Auth } from '../../../hooks/useV5Auth.jsx';

const fmt = (v) => (v == null) ? '-' : Number(v).toLocaleString() + '원';

export default function V5Dashboard() {
  const { apiCall, agent } = useV5Auth();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const res = await apiCall('GET', `/manager/overview?month=${month}`);
      if (!res.ok) throw new Error((await res.json()).error || '조회 실패');
      setOverview(await res.json());
      setError('');
    } catch (e) { setError(e.message); }
  };
  useEffect(() => { load(); }, [month]);

  if (!overview) return <div style={{ color: '#94a3b8' }}>{error || '로딩 중...'}</div>;

  const t = overview.totals || {};
  const isAdmin = agent.role === 'admin';
  const isContractOnly = agent.role === 'contract';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, color: '#f8fafc', fontWeight: 800 }}>📊 인센티브 대시보드</h1>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          style={{ background: '#0f172a', border: '1px solid #475569', color: '#e2e8f0', padding: '6px 10px', borderRadius: 6, fontSize: 12 }} />
      </div>

      {/* KPI 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 18 }}>
        <Kpi label="활성 상담사" val={`${overview.agents_count}명`} />
        <Kpi label="총 영업" val={`${t.total_sales_count || 0}건`} sub={`우수 ${t.total_premium_count || 0}건`} />
        {!isContractOnly && <Kpi label="총 매출" val={fmt(t.total_revenue)} cls="financial-mid" />}
        {!isContractOnly && <Kpi label="총 인센티브" val={fmt(t.total_incentive)} sub={`+ 보너스 ${fmt(t.total_bonus)}`} cls="financial-mid" />}
        {isAdmin && <Kpi label="회사 영업이익" val={fmt(t.total_company_profit)} color={t.total_company_profit >= 0 ? '#86efac' : '#fca5a5'} />}
        <Kpi label="페널티" val={`${t.penalty_count || 0}명`} color="#f59e0b" />
      </div>

      {/* 상담사별 표 */}
      <h2 style={{ fontSize: 14, color: '#fbbf24', fontWeight: 800, margin: '20px 0 10px' }}>👥 상담사별 실적</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#1e293b', borderRadius: 10, overflow: 'hidden' }}>
        <thead>
          <tr style={{ background: '#334155' }}>
            <th style={th}>상담사</th>
            <th style={th}>Grade</th>
            <th style={th}>영업/우수</th>
            <th style={th}>P</th>
            {!isContractOnly && <th style={th}>단가</th>}
            {!isContractOnly && <th style={th}>기본급</th>}
            {!isContractOnly && <th style={th}>인센티브</th>}
            {!isContractOnly && <th style={th}>총수령</th>}
            {!isContractOnly && <th style={th}>매출</th>}
            {isAdmin && <th style={th}>회사이익</th>}
            <th style={th}>상태</th>
          </tr>
        </thead>
        <tbody>
          {(overview.settlements || []).map(s => {
            const a = s.agent || {};
            const isFin = !!s.finalized_at;
            return (
              <tr key={a.id} style={{ background: isFin ? 'rgba(22,163,74,0.06)' : (s.is_penalty ? 'rgba(220,38,38,0.06)' : 'transparent') }}>
                <td style={td}><b>{a.name}</b><div style={{ fontSize: 9, color: '#64748b' }}>{a.role}</div></td>
                <td style={td}>
                  <span style={{ background: ['','#6b7280','#3b82f6','#dc2626'][s.grade_applied || 1], color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 9, fontWeight: 800 }}>G{s.grade_applied || 1}</span>
                  {s.is_penalty && <span style={{ background: '#f59e0b', color: '#fff', padding: '1px 6px', borderRadius: 3, fontSize: 9, fontWeight: 800, marginLeft: 4 }}>⚠️ 페널티</span>}
                </td>
                <td style={td}>{s.total_count || 0}건<div style={{ fontSize: 9, color: '#64748b' }}>우수 {s.premium_count || 0}건</div></td>
                <td style={td}><b>{s.total_points || 0}P</b></td>
                {!isContractOnly && <td style={td}>{(s.applied_rate || 0).toLocaleString()}/P</td>}
                {!isContractOnly && <td style={td}><span style={{ color: '#cbd5e1' }}>{fmt(s.base_salary)}</span></td>}
                {!isContractOnly && <td style={td}>{fmt(s.incentive)}<div style={{ fontSize: 9, color: '#64748b' }}>+ {fmt(s.bonus)}</div></td>}
                {!isContractOnly && <td style={td}><b style={{ color: '#86efac' }}>{fmt(s.agent_total)}</b></td>}
                {!isContractOnly && <td style={td}>{fmt(s.total_revenue)}</td>}
                {isAdmin && <td style={{ ...td, color: (s.company_profit || 0) > 0 ? '#86efac' : '#fca5a5' }}>{fmt(s.company_profit)}</td>}
                <td style={td}>
                  {isFin
                    ? <span style={{ background: '#16a34a', color: '#fff', padding: '1px 7px', borderRadius: 3, fontSize: 9, fontWeight: 800 }}>확정</span>
                    : <span style={{ background: '#475569', color: '#cbd5e1', padding: '1px 7px', borderRadius: 3, fontSize: 9, fontWeight: 800 }}>미확정</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p style={{ fontSize: 10, color: '#64748b', marginTop: 14 }}>
        ⚠️ 미확정은 라이브 계산. 월말 확정 후엔 스냅샷으로 잠금 (admin이 수동 확정).
      </p>
    </div>
  );
}

function Kpi({ label, val, sub, color, cls }) {
  return (
    <div className={cls} style={{ background: 'linear-gradient(135deg,#1e293b,#334155)', border: '1px solid #475569', borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 9.5, color: '#94a3b8', fontWeight: 700, letterSpacing: '0.04em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, color: color || '#f8fafc', fontWeight: 900, letterSpacing: '-0.02em' }}>{val}</div>
      {sub && <div style={{ fontSize: 9.5, color: '#64748b', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

const th = { color: '#f1f5f9', fontSize: 11, padding: '10px 8px', textAlign: 'left', fontWeight: 700 };
const td = { fontSize: 11.5, color: '#e2e8f0', padding: '10px 8px', borderBottom: '1px solid #334155', verticalAlign: 'middle' };
