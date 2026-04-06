import { useState } from 'react';
import { theme, card, button, tableStyles, filterBtn, statusStyle } from '../../styles/admin-theme.js';

const periods = ['오늘', '이번주', '이번달', '3개월'];

const monthlyData = [
  { month: '2026-01', sales: '12,500,000', newCustomers: 18, conversion: '32%', avgGift: '45,000' },
  { month: '2026-02', sales: '15,200,000', newCustomers: 22, conversion: '35%', avgGift: '48,000' },
  { month: '2026-03', sales: '18,700,000', newCustomers: 28, conversion: '38%', avgGift: '52,000' },
  { month: '2026-04', sales: '4,300,000', newCustomers: 8, conversion: '40%', avgGift: '50,000' },
];

export default function Statistics() {
  const [period, setPeriod] = useState('이번달');

  const kpis = [
    { label: '총 매출', value: '18,700,000원', sub: '전월 대비 +23%', color: theme.blue },
    { label: '신규 고객', value: '28명', sub: '전월 대비 +27%', color: theme.green },
    { label: '계약 전환율', value: '38%', sub: '전월 대비 +3%p', color: theme.purple },
    { label: '평균 사은품', value: '52,000원', sub: '전월 대비 +8%', color: theme.orange },
  ];

  const chartPlaceholder = (title, height = 300) => (
    <div style={{
      ...card,
      height,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 12 }}>{title}</div>
      <div style={{
        flex: 1,
        background: `linear-gradient(135deg, ${theme.blueBg} 0%, ${theme.purpleBg} 100%)`,
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: `1px dashed ${theme.borderDark}`,
      }}>
        <span style={{ fontSize: 13, color: theme.textMuted, fontWeight: 500 }}>{title} 차트 영역</span>
      </div>
    </div>
  );

  return (
    <div style={{ padding: 24, fontFamily: theme.sans }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: theme.text, margin: '0 0 16px' }}>통계</h2>

      {/* 기간 선택 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {periods.map(p => (
          <button key={p} style={filterBtn(period === p)} onClick={() => setPeriod(p)}>{p}</button>
        ))}
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ ...card, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 10, color: theme.green, marginTop: 4, fontWeight: 600 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* 차트 영역 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginBottom: 20 }}>
        {chartPlaceholder('일별 신청 추이', 300)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
        {chartPlaceholder('통신사별 분포', 260)}
        {chartPlaceholder('채널별 유입', 260)}
        {chartPlaceholder('상품 유형별', 260)}
      </div>

      {/* 월별 실적 요약 */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${theme.border}` }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>월별 실적 요약</span>
        </div>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              {['월', '총 매출', '신규 고객', '계약 전환율', '평균 사은품'].map(h => (
                <th key={h} style={tableStyles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {monthlyData.map(row => (
              <tr key={row.month}>
                <td style={tableStyles.td}><span style={{ fontWeight: 600, color: theme.text }}>{row.month}</span></td>
                <td style={tableStyles.td}>{row.sales}원</td>
                <td style={tableStyles.td}>{row.newCustomers}명</td>
                <td style={tableStyles.td}>
                  <span style={statusStyle(parseInt(row.conversion) >= 35 ? 'green' : 'blue')}>{row.conversion}</span>
                </td>
                <td style={tableStyles.td}>{row.avgGift}원</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
