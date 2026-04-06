import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const card = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: 18,
};

const ITEMS = [
  {
    title: '인터넷 약정 종료',
    titleIcon: '\u26A0\uFE0F',
    date: '2026.05.01',
    dday: 'D-26',
    urgent: true,
    showConsult: true,
  },
  {
    title: '요금제 변경 가능일',
    date: '2026.08.15',
    dday: 'D-132',
    status: '여유',
  },
  {
    title: '렌탈 약정 종료',
    date: '2027.02.01',
    dday: 'D-302',
    status: '여유',
  },
];

export default function MoneyGuard() {
  const [alarms, setAlarms] = useState({ d30: true, d7: true, d1: false });

  const toggleAlarm = (key) => {
    setAlarms((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1a2744', marginBottom: 2 }}>
            {'돈지키미 '}<span role="img" aria-label="bell">{'\u{1F514}'}</span>
          </div>
          <div style={{ fontSize: 13, color: '#999' }}>약정 만료일을 등록하고 알람을 받으세요</div>
        </div>
        <button style={{
          height: 36,
          padding: '0 16px',
          fontSize: 13,
          borderRadius: 8,
          background: '#2563eb',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          fontWeight: 600,
        }}>
          + 항목 추가
        </button>
      </div>

      {/* Items */}
      {ITEMS.map((item, i) => (
        <div
          key={i}
          style={{
            ...card,
            marginBottom: 10,
            background: item.urgent ? '#fee2e2' : '#fff',
            borderColor: item.urgent ? '#fca5a5' : '#e5e7eb',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: item.urgent ? '#dc2626' : '#1a2744' }}>
                {item.titleIcon && <span role="img" aria-label="warning">{item.titleIcon}</span>}
                {item.titleIcon ? ' ' : ''}{item.title}
              </div>
              <div style={{ fontSize: 12, color: item.urgent ? '#dc2626' : '#999', marginTop: 4 }}>
                {`${item.date} (${item.dday})`}
              </div>
            </div>
            {item.showConsult ? (
              <Link to="/my/guard" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: 32, width: 80, fontSize: 12, borderRadius: 6,
                background: '#2563eb', color: '#fff', textDecoration: 'none', fontWeight: 600,
              }}>
                재계약 상담
              </Link>
            ) : (
              <span style={{
                fontSize: 11, fontWeight: 700, color: '#999',
                background: '#f3f4f6', padding: '4px 10px', borderRadius: 20,
              }}>
                {item.status}
              </span>
            )}
          </div>
        </div>
      ))}

      {/* 알람 설정 */}
      <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2744', marginTop: 6, marginBottom: 10 }}>알람 설정</div>
      <div style={card}>
        {[
          { key: 'd30', label: 'D-30 알람' },
          { key: 'd7', label: 'D-7 알람' },
          { key: 'd1', label: 'D-1 알람' },
        ].map((alarm, i) => (
          <div
            key={alarm.key}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: i < 2 ? 10 : 0,
            }}
          >
            <div style={{ fontSize: 13, color: '#666' }}>{alarm.label}</div>
            <button
              onClick={() => toggleAlarm(alarm.key)}
              style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                fontSize: 11,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                background: alarms[alarm.key] ? '#2563eb' : '#e5e7eb',
                color: alarms[alarm.key] ? '#fff' : '#999',
              }}
            >
              {alarms[alarm.key] ? 'ON' : 'OFF'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
