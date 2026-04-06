import React from 'react';

const card = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: 18,
};

const GIFTS = [
  {
    title: 'KT 인터넷+TV 500Mbps',
    dateLabel: '지급 예정일 2026.05.01',
    status: '지급 대기',
    statusColor: '#d97706',
    statusBg: '#fffbeb',
    amount: '370,000원',
    amountColor: '#d97706',
    cardBg: '#fef3c7',
    cardBorder: '#fcd34d',
  },
  {
    title: 'LG 정수기 렌탈',
    dateLabel: '지급 완료 2026.03.10',
    status: '지급 완료',
    statusColor: '#10b981',
    statusBg: '#ecfdf5',
    amount: '150,000원',
    amountColor: '#059669',
    cardBg: '#fff',
    cardBorder: '#e5e7eb',
  },
];

export default function Gifts() {
  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#1a2744', marginBottom: 8 }}>사은품 현황</div>
      <div style={{ fontSize: 13, color: '#999', marginBottom: 16 }}>설치 완료 후 현금으로 지급됩니다</div>

      {GIFTS.map((gift, i) => (
        <div
          key={i}
          style={{
            ...card,
            background: gift.cardBg,
            borderColor: gift.cardBorder,
            marginBottom: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2744' }}>{gift.title}</div>
              <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{gift.dateLabel}</div>
            </div>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              color: gift.statusColor,
              background: gift.statusBg,
              padding: '4px 10px',
              borderRadius: 20,
            }}>
              {gift.status}
            </span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: gift.amountColor }}>{gift.amount}</div>
        </div>
      ))}
    </div>
  );
}
