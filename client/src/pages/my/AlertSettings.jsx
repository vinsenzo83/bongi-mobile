import React, { useState } from 'react';

const card = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: 18,
};

const SETTINGS = [
  { key: 'service', icon: '\u{1F514}', title: '서비스 알림', desc: '신청 완료 \u00B7 계약 \u00B7 사은품 지급 알림' },
  { key: 'marketing', icon: '\u{1F4E3}', title: '마케팅 알림', desc: '혜택 \u00B7 상품 추천 \u00B7 이벤트 안내' },
  { key: 'push', icon: '\u{1F4F1}', title: '앱 푸시', desc: '앱 알림 수신' },
  { key: 'kakao', icon: '\u{1F4AC}', title: '카카오 알림톡', desc: '카카오톡 알림 수신' },
];

export default function AlertSettings() {
  const [toggles, setToggles] = useState({
    service: true,
    marketing: true,
    push: true,
    kakao: true,
  });

  const handleToggle = (key) => {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#1a2744', marginBottom: 6 }}>알림 설정</div>
      <div style={{ fontSize: 13, color: '#999', marginBottom: 20 }}>수신할 알림 종류를 설정하세요</div>

      <div style={card}>
        {SETTINGS.map((s, i) => (
          <div
            key={s.key}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              ...(i > 0 ? { marginTop: 16, paddingTop: 16, borderTop: '1px solid #f3f4f6' } : {}),
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2744', marginBottom: 2 }}>
                <span role="img" aria-label={s.title}>{s.icon}</span> {s.title}
              </div>
              <div style={{ fontSize: 12, color: '#999' }}>{s.desc}</div>
            </div>
            <button
              onClick={() => handleToggle(s.key)}
              style={{
                width: 52,
                height: 28,
                borderRadius: 14,
                fontSize: 12,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                flexShrink: 0,
                background: toggles[s.key] ? '#2563eb' : '#e5e7eb',
                color: toggles[s.key] ? '#fff' : '#999',
              }}
            >
              {toggles[s.key] ? 'ON' : 'OFF'}
            </button>
          </div>
        ))}
      </div>

      <button style={{
        width: '100%',
        height: 44,
        marginTop: 16,
        background: '#2563eb',
        color: '#fff',
        border: 'none',
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer',
      }}>
        저장하기
      </button>
    </div>
  );
}
