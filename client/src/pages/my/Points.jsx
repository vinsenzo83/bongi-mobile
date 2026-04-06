import React from 'react';

const card = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: 18,
};

const HISTORY = [
  { point: '+20,000P', title: '친구 계약 완료 (추천인)', desc: '이영희 님 KT 인터넷+TV 계약', date: '2026.04.01', color: '#10b981' },
  { point: '+5,000P', title: '계약 완료 포인트', desc: 'KT 인터넷+TV 계약', date: '2026.03.20', color: '#10b981' },
  { point: '+5,000P', title: '회원가입 포인트', desc: '신규 가입', date: '2026.01.01', color: '#10b981' },
  { point: '-5,000P', title: '출금 처리', desc: '현금 출금 완료', date: '2026.02.15', color: '#ef4444' },
];

export default function Points() {
  return (
    <div>
      {/* 보유 포인트 */}
      <div style={{ ...card, background: '#1a2744', color: '#fff', textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>보유 포인트</div>
        <div style={{ fontSize: 36, fontWeight: 900, color: '#fbbf24', marginBottom: 4 }}>30,000 P</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>현금 출금까지 38,000P 더 필요해요</div>
      </div>

      {/* 출금 조건 */}
      <div style={{ ...card, background: '#fef3c7', borderColor: '#fcd34d', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2744', marginBottom: 8 }}>
              <span role="img" aria-label="money">{'\u{1F4B0}'}</span> 현금 출금 조건
            </div>
            <div style={{ fontSize: 12, color: '#78350f', lineHeight: 2 }}>
              <div>{'\u2B1C'} 5만 포인트 이상 보유 (현재 30,000P)</div>
              <div>{'\u2705'} 1회 이상 계약 완료</div>
              <div>{'\u2705'} 본인인증 완료</div>
              <div>{'\u2705'} 계좌 등록 완료</div>
            </div>
          </div>
          <button style={{
            height: 36,
            width: 90,
            borderRadius: 8,
            fontSize: 12,
            background: '#f3f4f6',
            color: '#999',
            border: 'none',
            opacity: 0.4,
            cursor: 'not-allowed',
            flexShrink: 0,
          }}>
            출금 신청
          </button>
        </div>
        <div style={{ fontSize: 11, color: '#92400e', marginTop: 10, paddingTop: 10, borderTop: '1px solid #fcd34d' }}>
          {'※ 5만 포인트 달성 시 출금 신청 버튼이 활성화됩니다'}
        </div>
      </div>

      {/* 포인트 내역 */}
      <div style={{ fontSize: 18, fontWeight: 700, color: '#1a2744', marginBottom: 12 }}>포인트 내역</div>
      {HISTORY.map((item, i) => (
        <div key={i} style={{ ...card, marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2744' }}>{item.title}</div>
              <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                {`${item.desc} \u00B7 ${item.date}`}
              </div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: item.color }}>{item.point}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
