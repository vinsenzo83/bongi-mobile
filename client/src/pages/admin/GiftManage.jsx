import { useState } from 'react';
import { theme, card, button, tableStyles, filterBtn, statusStyle } from '../../styles/admin-theme.js';

const initialGifts = [
  { id: 1, name: '홍길동', product: '5G 프리미엄 77', amount: 320000, method: '계좌이체', status: '지급완료', date: '2026-03-28', bank: '국민은행', account: '123-456-789012', phone: '010-1234-5678' },
  { id: 2, name: '김철수', product: 'LTE 안심 49', amount: 300000, method: '계좌이체', status: '지급대기', date: null, bank: '신한은행', account: '987-654-321098', phone: '010-2345-6789' },
  { id: 3, name: '이영희', product: '5G 슬림 55', amount: 400000, method: '상품권', status: '지급대기', date: null, bank: '-', account: '-', phone: '010-3456-7890' },
  { id: 4, name: '최지은', product: 'LTE 실속 34', amount: 150000, method: '계좌이체', status: '지급완료', date: '2026-03-30', bank: '우리은행', account: '111-222-333444', phone: '010-4567-8901' },
  { id: 5, name: '정수민', product: '5G 표준 62', amount: 200000, method: '계좌이체', status: '지급완료', date: '2026-04-01', bank: '하나은행', account: '555-666-777888', phone: '010-5678-9012' },
];

export default function GiftManage() {
  const [gifts, setGifts] = useState(initialGifts);
  const [statusFilter, setStatusFilter] = useState('전체');
  const [search, setSearch] = useState('');
  const [selectedGift, setSelectedGift] = useState(null);

  const statusOptions = ['전체', '지급대기', '지급완료', '보류'];

  const filtered = gifts.filter(g => {
    if (statusFilter !== '전체' && g.status !== statusFilter) return false;
    if (search && !g.name.includes(search) && !g.product.includes(search)) return false;
    return true;
  });

  const totalCount = gifts.length;
  const paidItems = gifts.filter(g => g.status === '지급완료');
  const pendingItems = gifts.filter(g => g.status === '지급대기');
  const paidTotal = paidItems.reduce((s, g) => s + g.amount, 0);
  const pendingTotal = pendingItems.reduce((s, g) => s + g.amount, 0);

  function handlePay(id) {
    setGifts(prev => prev.map(g => g.id === id ? { ...g, status: '지급완료', date: '2026-04-06' } : g));
    if (selectedGift && selectedGift.id === id) {
      setSelectedGift(prev => ({ ...prev, status: '지급완료', date: '2026-04-06' }));
    }
  }

  const giftStatusColor = (s) => {
    if (s === '지급완료') return 'green';
    if (s === '지급대기') return 'orange';
    if (s === '보류') return 'red';
    return 'gray';
  };

  return (
    <div style={{ padding: 24, fontFamily: theme.sans, background: theme.bg, minHeight: '100vh' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: theme.text, marginBottom: 20 }}>사은품 관리</h2>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <div style={{ ...card, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 4 }}>총 사은품</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: theme.text }}>{totalCount}건</div>
        </div>
        <div style={{ ...card, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 4 }}>지급완료</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: theme.green }}>{paidItems.length}건</div>
          <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>{(paidTotal / 10000).toFixed(0)}만원</div>
        </div>
        <div style={{ ...card, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 4 }}>지급대기</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: theme.orange }}>{pendingItems.length}건</div>
          <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>{(pendingTotal / 10000).toFixed(0)}만원</div>
        </div>
      </div>

      {/* Filter */}
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: theme.text, marginRight: 4 }}>상태</span>
        {statusOptions.map(s => (
          <button key={s} style={filterBtn(statusFilter === s)} onClick={() => setStatusFilter(s)}>{s}</button>
        ))}
        <div style={{ flex: 1 }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="고객명 / 상품 검색"
          style={{ padding: '6px 12px', border: `1px solid ${theme.borderDark}`, borderRadius: 6, fontSize: 12, width: 200, outline: 'none', fontFamily: theme.sans }}
        />
      </div>

      {/* Table */}
      <div style={card}>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              <th style={tableStyles.th}>고객명</th>
              <th style={tableStyles.th}>신청상품</th>
              <th style={tableStyles.th}>사은품 금액</th>
              <th style={tableStyles.th}>지급방식</th>
              <th style={tableStyles.th}>상태</th>
              <th style={tableStyles.th}>지급일</th>
              <th style={tableStyles.th}>계좌정보</th>
              <th style={tableStyles.th}>관리</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(g => (
              <tr key={g.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedGift(g)}>
                <td style={tableStyles.td}>{g.name}</td>
                <td style={tableStyles.td}>{g.product}</td>
                <td style={tableStyles.td}>{g.amount.toLocaleString()}원</td>
                <td style={tableStyles.td}>{g.method}</td>
                <td style={tableStyles.td}><span style={statusStyle(giftStatusColor(g.status))}>{g.status}</span></td>
                <td style={tableStyles.td}>{g.date || '-'}</td>
                <td style={tableStyles.td}>{g.bank !== '-' ? `${g.bank} ${g.account}` : '-'}</td>
                <td style={tableStyles.td}>
                  {g.status === '지급대기' && (
                    <button style={button.success} onClick={e => { e.stopPropagation(); handlePay(g.id); }}>지급 처리</button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ ...tableStyles.td, textAlign: 'center', padding: 32, color: theme.textMuted }}>데이터가 없습니다</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {selectedGift && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setSelectedGift(null)}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 480, maxHeight: '80vh', overflow: 'auto', boxShadow: theme.shadowLg }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: theme.text, margin: 0 }}>사은품 상세</h3>
              <button style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: theme.textMuted }} onClick={() => setSelectedGift(null)}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
              <div><span style={{ color: theme.textMuted }}>고객명</span><div style={{ fontWeight: 600, color: theme.text, marginTop: 2 }}>{selectedGift.name}</div></div>
              <div><span style={{ color: theme.textMuted }}>연락처</span><div style={{ fontWeight: 600, color: theme.text, marginTop: 2 }}>{selectedGift.phone}</div></div>
              <div><span style={{ color: theme.textMuted }}>신청상품</span><div style={{ fontWeight: 600, color: theme.text, marginTop: 2 }}>{selectedGift.product}</div></div>
              <div><span style={{ color: theme.textMuted }}>사은품 금액</span><div style={{ fontWeight: 700, color: theme.blue, marginTop: 2 }}>{selectedGift.amount.toLocaleString()}원</div></div>
              <div><span style={{ color: theme.textMuted }}>지급방식</span><div style={{ fontWeight: 600, color: theme.text, marginTop: 2 }}>{selectedGift.method}</div></div>
              <div><span style={{ color: theme.textMuted }}>상태</span><div style={{ marginTop: 4 }}><span style={statusStyle(giftStatusColor(selectedGift.status))}>{selectedGift.status}</span></div></div>
              <div><span style={{ color: theme.textMuted }}>지급일</span><div style={{ fontWeight: 600, color: theme.text, marginTop: 2 }}>{selectedGift.date || '-'}</div></div>
              <div><span style={{ color: theme.textMuted }}>은행</span><div style={{ fontWeight: 600, color: theme.text, marginTop: 2 }}>{selectedGift.bank}</div></div>
              <div style={{ gridColumn: '1 / -1' }}><span style={{ color: theme.textMuted }}>계좌번호</span><div style={{ fontWeight: 600, color: theme.text, marginTop: 2 }}>{selectedGift.account}</div></div>
            </div>

            {selectedGift.status === '지급대기' && (
              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                <button style={button.primary} onClick={() => { handlePay(selectedGift.id); }}>지급 처리</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
