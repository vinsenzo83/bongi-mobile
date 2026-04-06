import { useState } from 'react';
import { theme, card, button, tableStyles, filterBtn, statusStyle } from '../../styles/admin-theme.js';

const mockData = [
  { id: 1, name: '홍길동', type: '인터넷', product: 'KT 기가인터넷', startDate: '2025-04-01', endDate: '2029-04-01', dday: 'D-363', status: '활성', alert: true },
  { id: 2, name: '홍길동', type: '렌탈', product: '코웨이 정수기 AIS3.0', startDate: '2023-05-15', endDate: '2029-04-12', dday: 'D-1071', status: '활성', alert: true },
  { id: 3, name: '이영희', type: '인터넷', product: 'SK브로드밴드 기가프리미엄', startDate: '2023-04-10', endDate: '2029-05-05', dday: 'D-1094', status: '활성', alert: false },
  { id: 4, name: '이영희', type: '렌탈', product: 'LG 공기청정기 퓨리케어', startDate: '2023-06-01', endDate: '2029-04-18', dday: 'D-1077', status: '활성', alert: false },
];

const statusFilters = ['전체', '활성', '만료임박', '완료'];
const typeFilters = ['전체', '인터넷', '렌탈', '휴대폰'];

export default function DonJikimi() {
  const [statusFilter, setStatusFilter] = useState('전체');
  const [typeFilter, setTypeFilter] = useState('전체');
  const [alerts, setAlerts] = useState(() => {
    const map = {};
    mockData.forEach(d => { map[d.id] = d.alert; });
    return map;
  });

  const filtered = mockData.filter(item => {
    if (statusFilter !== '전체' && item.status !== statusFilter) return false;
    if (typeFilter !== '전체' && item.type !== typeFilter) return false;
    return true;
  });

  const toggleAlert = (id) => {
    setAlerts(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const kpis = [
    { label: '활성 추적', value: '4건', color: theme.blue },
    { label: 'D-90 이내', value: '0건', color: theme.orange },
    { label: '알림 발송', value: '2건', color: theme.green },
    { label: '재계약 전환', value: '0건', color: theme.purple },
  ];

  return (
    <div style={{ padding: 24, fontFamily: theme.sans }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: theme.text, margin: '0 0 16px' }}>돈지키미 관리</h2>

      {/* 설명 카드 */}
      <div style={{ ...card, marginBottom: 16, background: theme.blueBg, borderColor: theme.blue }}>
        <p style={{ margin: 0, fontSize: 13, color: theme.blue, fontWeight: 500 }}>
          돈지키미는 고객의 약정 만료일을 추적하고 최적 시점에 재계약/해지 안내를 하는 서비스입니다
        </p>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ ...card, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* 필터 */}
      <div style={{ ...card, marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: theme.text }}>상태</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {statusFilters.map(f => (
            <button key={f} style={filterBtn(statusFilter === f)} onClick={() => setStatusFilter(f)}>{f}</button>
          ))}
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: theme.text, marginLeft: 8 }}>항목</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {typeFilters.map(f => (
            <button key={f} style={filterBtn(typeFilter === f)} onClick={() => setTypeFilter(f)}>{f}</button>
          ))}
        </div>
      </div>

      {/* 테이블 */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              {['고객명', '항목', '상품명', '약정시작일', '약정종료일', 'D-day', '알림상태', '관리'].map(h => (
                <th key={h} style={tableStyles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => (
              <tr key={item.id} style={{ background: '#fff' }}>
                <td style={tableStyles.td}><span style={{ fontWeight: 600, color: theme.text }}>{item.name}</span></td>
                <td style={tableStyles.td}>
                  <span style={statusStyle(item.type === '인터넷' ? 'blue' : item.type === '렌탈' ? 'green' : 'orange')}>
                    {item.type}
                  </span>
                </td>
                <td style={tableStyles.td}>{item.product}</td>
                <td style={tableStyles.td}>{item.startDate}</td>
                <td style={tableStyles.td}>{item.endDate}</td>
                <td style={tableStyles.td}>
                  <span style={{
                    fontWeight: 700,
                    color: parseInt(item.dday.replace('D-', '')) <= 90 ? theme.red : theme.blue,
                    fontSize: 13,
                  }}>
                    {item.dday}
                  </span>
                </td>
                <td style={tableStyles.td}>
                  <span style={statusStyle(alerts[item.id] ? 'green' : 'gray')}>
                    {alerts[item.id] ? '알림ON' : '알림OFF'}
                  </span>
                </td>
                <td style={tableStyles.td}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {/* 알림 설정 토글 */}
                    <div
                      onClick={() => toggleAlert(item.id)}
                      style={{
                        width: 36,
                        height: 20,
                        borderRadius: 10,
                        background: alerts[item.id] ? theme.green : '#ccc',
                        cursor: 'pointer',
                        position: 'relative',
                        transition: 'background 0.2s',
                      }}
                    >
                      <div style={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        background: '#fff',
                        position: 'absolute',
                        top: 2,
                        left: alerts[item.id] ? 18 : 2,
                        transition: 'left 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }} />
                    </div>
                    <button style={{ ...button.secondary, padding: '4px 8px', fontSize: 11 }}>상세</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
