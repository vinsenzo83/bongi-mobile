import { useState } from 'react';
import { theme, card, button, tableStyles, filterBtn, statusStyle } from '../../styles/admin-theme.js';

const initialPoints = [
  { id: 1, name: '홍길동', type: '적립', amount: 50000, desc: '개통 추천 리워드', balance: 120000, status: '승인', date: '2026-04-01 14:30' },
  { id: 2, name: '김철수', type: '차감', amount: -20000, desc: '사은품 교환 차감', balance: 80000, status: '승인', date: '2026-04-02 09:15' },
  { id: 3, name: '이영희', type: '출금', amount: -100000, desc: '출금 요청', balance: 50000, status: '대기', date: '2026-04-03 11:20' },
  { id: 4, name: '최지은', type: '적립', amount: 30000, desc: '후기 작성 보너스', balance: 95000, status: '승인', date: '2026-04-03 16:45' },
  { id: 5, name: '정수민', type: '출금', amount: -70000, desc: '출금 요청', balance: 30000, status: '대기', date: '2026-04-04 10:00' },
  { id: 6, name: '박민호', type: '적립', amount: 80000, desc: '번호이동 인센티브', balance: 200000, status: '승인', date: '2026-04-04 13:30' },
  { id: 7, name: '강서연', type: '차감', amount: -15000, desc: '포인트 만료 차감', balance: 45000, status: '승인', date: '2026-04-05 08:00' },
  { id: 8, name: '윤지호', type: '적립', amount: 25000, desc: '이벤트 당첨', balance: 75000, status: '승인', date: '2026-04-05 15:20' },
  { id: 9, name: '한소희', type: '출금', amount: -60000, desc: '출금 요청', balance: 10000, status: '반려', date: '2026-04-05 17:40' },
  { id: 10, name: '오태양', type: '적립', amount: 40000, desc: '추천인 적립', balance: 140000, status: '승인', date: '2026-04-06 09:00' },
];

export default function PointManage() {
  const [points, setPoints] = useState(initialPoints);
  const [typeFilter, setTypeFilter] = useState('전체');
  const [statusFilter, setStatusFilter] = useState('전체');

  const typeOptions = ['전체', '적립', '차감', '출금'];
  const statusOptions = ['전체', '승인', '대기', '반려'];

  const filtered = points.filter(p => {
    if (typeFilter !== '전체' && p.type !== typeFilter) return false;
    if (statusFilter !== '전체' && p.status !== statusFilter) return false;
    return true;
  });

  const totalIssued = points.filter(p => p.type === '적립').reduce((s, p) => s + p.amount, 0);
  const totalUsed = points.filter(p => p.type === '차감').reduce((s, p) => s + Math.abs(p.amount), 0);
  const totalRemaining = totalIssued - totalUsed;
  const withdrawalRequests = points.filter(p => p.type === '출금' && p.status === '대기');

  function handleApprove(id) {
    setPoints(prev => prev.map(p => p.id === id ? { ...p, status: '승인' } : p));
  }

  function handleReject(id) {
    setPoints(prev => prev.map(p => p.id === id ? { ...p, status: '반려' } : p));
  }

  const pointStatusColor = (s) => {
    if (s === '승인') return 'green';
    if (s === '대기') return 'orange';
    if (s === '반려') return 'red';
    return 'gray';
  };

  const typeColor = (t) => {
    if (t === '적립') return 'blue';
    if (t === '차감') return 'red';
    if (t === '출금') return 'orange';
    return 'gray';
  };

  return (
    <div style={{ padding: 24, fontFamily: theme.sans, background: theme.bg, minHeight: '100vh' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: theme.text, marginBottom: 20 }}>포인트 관리</h2>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <div style={{ ...card, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 4 }}>총 발행 포인트</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: theme.blue }}>{totalIssued.toLocaleString()}P</div>
        </div>
        <div style={{ ...card, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 4 }}>사용 포인트</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: theme.red }}>{totalUsed.toLocaleString()}P</div>
        </div>
        <div style={{ ...card, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 4 }}>잔여 포인트</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: theme.green }}>{totalRemaining.toLocaleString()}P</div>
        </div>
        <div style={{ ...card, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 4 }}>출금 요청</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: theme.orange }}>{withdrawalRequests.length}건</div>
        </div>
      </div>

      {/* Filter */}
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: theme.text, marginRight: 4 }}>유형</span>
        {typeOptions.map(t => (
          <button key={t} style={filterBtn(typeFilter === t)} onClick={() => setTypeFilter(t)}>{t}</button>
        ))}
        <div style={{ width: 1, height: 20, background: theme.border, margin: '0 8px' }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: theme.text, marginRight: 4 }}>상태</span>
        {statusOptions.map(s => (
          <button key={s} style={filterBtn(statusFilter === s)} onClick={() => setStatusFilter(s)}>{s}</button>
        ))}
      </div>

      {/* Transactions Table */}
      <div style={{ ...card, marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: theme.text, marginBottom: 12, marginTop: 0 }}>포인트 내역</h3>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              <th style={tableStyles.th}>회원명</th>
              <th style={tableStyles.th}>유형</th>
              <th style={tableStyles.th}>금액</th>
              <th style={tableStyles.th}>설명</th>
              <th style={tableStyles.th}>잔액</th>
              <th style={tableStyles.th}>상태</th>
              <th style={tableStyles.th}>일시</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id}>
                <td style={tableStyles.td}>{p.name}</td>
                <td style={tableStyles.td}><span style={statusStyle(typeColor(p.type))}>{p.type}</span></td>
                <td style={{ ...tableStyles.td, fontWeight: 600, color: p.amount > 0 ? theme.blue : theme.red }}>
                  {p.amount > 0 ? '+' : ''}{p.amount.toLocaleString()}P
                </td>
                <td style={tableStyles.td}>{p.desc}</td>
                <td style={tableStyles.td}>{p.balance.toLocaleString()}P</td>
                <td style={tableStyles.td}><span style={statusStyle(pointStatusColor(p.status))}>{p.status}</span></td>
                <td style={tableStyles.td}>{p.date}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ ...tableStyles.td, textAlign: 'center', padding: 32, color: theme.textMuted }}>데이터가 없습니다</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Withdrawal Requests */}
      <div style={card}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: theme.text, marginBottom: 12, marginTop: 0 }}>출금 요청 처리</h3>
        {withdrawalRequests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: theme.textMuted, fontSize: 13 }}>대기 중인 출금 요청이 없습니다</div>
        ) : (
          <table style={tableStyles.table}>
            <thead>
              <tr>
                <th style={tableStyles.th}>회원명</th>
                <th style={tableStyles.th}>출금 금액</th>
                <th style={tableStyles.th}>잔액</th>
                <th style={tableStyles.th}>요청일시</th>
                <th style={tableStyles.th}>처리</th>
              </tr>
            </thead>
            <tbody>
              {withdrawalRequests.map(w => (
                <tr key={w.id}>
                  <td style={tableStyles.td}>{w.name}</td>
                  <td style={{ ...tableStyles.td, fontWeight: 600, color: theme.red }}>{Math.abs(w.amount).toLocaleString()}P</td>
                  <td style={tableStyles.td}>{w.balance.toLocaleString()}P</td>
                  <td style={tableStyles.td}>{w.date}</td>
                  <td style={tableStyles.td}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button style={button.success} onClick={() => handleApprove(w.id)}>승인</button>
                      <button style={button.danger} onClick={() => handleReject(w.id)}>반려</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
