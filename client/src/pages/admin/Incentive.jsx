import { useState } from 'react';

const BASE_SALARY = 2200000;
const ITEMS = {
  internet: { label: '인터넷+TV', perItem: 25000, icon: '📡' },
  rental: { label: '가전렌탈', perItem: 30000, icon: '🧺' },
  usim: { label: '알뜰폰', perItem: 7000, icon: '📱' },
  usedPhone: { label: '중고폰', perItem: 4000, icon: '📦' },
};
const GRADES = [
  { id: 'rookie', label: '루키', min: 0, max: 20, mult: 1.0, bonus: 0, color: '#94a3b8' },
  { id: 'pro', label: '프로', min: 21, max: 40, mult: 1.2, bonus: 100000, color: '#2563eb' },
  { id: 'ace', label: '에이스', min: 41, max: 60, mult: 1.5, bonus: 300000, color: '#10b981' },
  { id: 'master', label: '마스터', min: 61, max: 999, mult: 2.0, bonus: 500000, color: '#f59e0b' },
];

function fmt(n) { return n.toLocaleString() + '원'; }
function getGrade(total) { return GRADES.find(g => total >= g.min && total <= g.max) || GRADES[0]; }

export default function Incentive() {
  const [counts, setCounts] = useState({ internet: 30, rental: 15, usim: 10, usedPhone: 5 });
  const set = (key, val) => setCounts(c => ({ ...c, [key]: Math.max(0, Number(val) || 0) }));

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const grade = getGrade(total);

  const breakdown = Object.entries(ITEMS).map(([key, info]) => ({
    key, ...info,
    count: counts[key],
    raw: counts[key] * info.perItem,
    applied: Math.round(counts[key] * info.perItem * grade.mult),
  }));

  const rawTotal = breakdown.reduce((a, b) => a + b.raw, 0);
  const appliedTotal = breakdown.reduce((a, b) => a + b.applied, 0);
  const totalIncentive = appliedTotal + grade.bonus;
  const totalSalary = BASE_SALARY + totalIncentive;

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 60, maxWidth: 800 }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>인센티브 시뮬레이터</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 28 }}>건수를 조절하면 예상 월급이 자동 계산됩니다</p>

      {/* 등급 표시 */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {GRADES.map(g => (
          <div key={g.id} className="card" style={{
            textAlign: 'center', borderColor: grade.id === g.id ? g.color : 'var(--border)',
            borderWidth: grade.id === g.id ? 2 : 1,
            background: grade.id === g.id ? g.color + '10' : 'var(--bg-card)',
          }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: g.color }}>{g.label}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0' }}>{g.min}~{g.max === 999 ? '∞' : g.max}건</div>
            <div style={{ fontSize: 13, fontFamily: 'monospace' }}>x{g.mult} +{(g.bonus / 10000).toFixed(0)}만</div>
          </div>
        ))}
      </div>

      {/* 건수 입력 */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 16, letterSpacing: 1 }}>월간 계약 건수</div>
        <div className="grid-4">
          {breakdown.map(b => (
            <div key={b.key} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 4 }}>{b.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{b.label}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                <button onClick={() => set(b.key, counts[b.key] - 1)} style={s.stepBtn}>-</button>
                <input value={counts[b.key]} onChange={e => set(b.key, e.target.value)}
                  style={{ width: 50, textAlign: 'center', padding: '6px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 16, fontWeight: 700, fontFamily: 'monospace' }} />
                <button onClick={() => set(b.key, counts[b.key] + 1)} style={s.stepBtn}>+</button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>건당 {fmt(b.perItem)}</div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 16, padding: '12px', background: '#f8fafc', borderRadius: 8 }}>
          <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>총 건수</span>
          <span style={{ fontSize: 24, fontWeight: 800, color: grade.color, marginLeft: 12, fontFamily: 'monospace' }}>{total}건</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: grade.color, marginLeft: 8 }}>({grade.label})</span>
        </div>
      </div>

      {/* 급여 계산표 */}
      <div className="card">
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 16, letterSpacing: 1 }}>급여 상세</div>
        <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th style={s.th}>항목</th>
              <th style={s.th}>계산</th>
              <th style={{ ...s.th, textAlign: 'right' }}>금액</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map(b => (
              <tr key={b.key} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={s.td}>{b.icon} {b.label} {b.count}건</td>
                <td style={{ ...s.td, fontFamily: 'monospace', color: 'var(--text-secondary)', fontSize: 13 }}>
                  {b.count} x {fmt(b.perItem)} x {grade.mult}
                </td>
                <td style={{ ...s.td, textAlign: 'right', fontFamily: 'monospace' }}>{fmt(b.applied)}</td>
              </tr>
            ))}
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={s.td}>등급 보너스</td>
              <td style={{ ...s.td, color: grade.color, fontWeight: 600 }}>{grade.label}</td>
              <td style={{ ...s.td, textAlign: 'right', fontFamily: 'monospace' }}>{fmt(grade.bonus)}</td>
            </tr>
            <tr style={{ borderBottom: '2px solid var(--border)', background: '#f8fafc' }}>
              <td style={{ ...s.td, fontWeight: 700 }}>인센티브 합계</td>
              <td></td>
              <td style={{ ...s.td, textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: 'var(--primary)' }}>{fmt(totalIncentive)}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={s.td}>기본급</td>
              <td></td>
              <td style={{ ...s.td, textAlign: 'right', fontFamily: 'monospace' }}>{fmt(BASE_SALARY)}</td>
            </tr>
            <tr style={{ background: grade.color + '15' }}>
              <td style={{ ...s.td, fontWeight: 800, fontSize: 16 }}>월급 합계</td>
              <td></td>
              <td style={{ ...s.td, textAlign: 'right', fontWeight: 800, fontSize: 20, fontFamily: 'monospace', color: grade.color }}>
                {fmt(totalSalary)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 프리셋 */}
      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>프리셋</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setCounts({ internet: 10, rental: 5, usim: 3, usedPhone: 2 })} className="btn btn-outline" style={{ fontSize: 12 }}>루키 (20건)</button>
          <button onClick={() => setCounts({ internet: 20, rental: 10, usim: 5, usedPhone: 3 })} className="btn btn-outline" style={{ fontSize: 12 }}>프로 (38건)</button>
          <button onClick={() => setCounts({ internet: 30, rental: 15, usim: 10, usedPhone: 5 })} className="btn btn-outline" style={{ fontSize: 12 }}>에이스 (60건)</button>
          <button onClick={() => setCounts({ internet: 40, rental: 20, usim: 15, usedPhone: 10 })} className="btn btn-outline" style={{ fontSize: 12 }}>마스터 (85건)</button>
        </div>
      </div>
    </div>
  );
}

const s = {
  th: { textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 },
  td: { padding: '10px 12px' },
  stepBtn: { width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' },
};
