import React from 'react';

const card = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: 18,
};

const FRIENDS = [
  { name: '이영희', date: '2026.04.02', contract: 'done', point: '+5,000P' },
  { name: '박민수', date: '2026.03.25', contract: 'pending', point: '-' },
];

export default function Referral() {
  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#1a2744', marginBottom: 6 }}>친구초대</div>
      <div style={{ fontSize: 13, color: '#999', marginBottom: 16 }}>친구가 계약하면 둘 다 포인트!</div>

      {/* 초대 코드 카드 */}
      <div style={{ ...card, background: '#1a2744', color: '#fff', textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>내 초대 코드</div>
        <div style={{ fontSize: 28, fontWeight: 900, color: '#fbbf24', letterSpacing: 4, marginBottom: 12 }}>HONG2026</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button style={{
            height: 36, width: 120, borderRadius: 8, fontSize: 12,
            background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600,
          }}>
            링크 복사
          </button>
          <button style={{
            height: 36, width: 120, borderRadius: 8, fontSize: 12,
            background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', cursor: 'pointer',
          }}>
            카카오 공유
          </button>
        </div>
      </div>

      {/* 포인트 적립 조건 */}
      <div style={{ ...card, background: '#eff6ff', borderColor: '#bfdbfe', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2744', marginBottom: 10 }}>
          <span role="img" aria-label="gift">{'\u{1F381}'}</span> 포인트 적립 조건
        </div>
        <div style={{ fontSize: 12, color: '#1a2744', lineHeight: 2 }}>
          <div>
            <span role="img" aria-label="person">{'\u{1F464}'}</span>
            {' 친구 앱 가입 시 → 추천인 '}<strong>3,000P</strong>{' 적립'}
          </div>
          <div>
            <span role="img" aria-label="handshake">{'\u{1F91D}'}</span>
            {' 친구 계약 완료 시 → 추천인 최대 '}<strong>20,000P</strong>{' + 친구 최대 '}<strong>15,000P</strong>
          </div>
          <div style={{ fontSize: 10, color: '#999', marginTop: 4 }}>
            {'인터넷 15K/인터넷+TV 20K/렌탈 10K (추천인) \u00B7 인터넷 10K/인터넷+TV 15K/렌탈 5K (친구)'}
          </div>
        </div>
      </div>

      {/* 나를 초대한 사람 */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2744', marginBottom: 6 }}>나를 초대한 사람</div>
        <div style={{ fontSize: 13, color: '#666' }}>
          <span role="img" aria-label="person">{'\u{1F464}'}</span> 김철수 님의 초대로 가입했어요
        </div>
      </div>

      {/* 내가 초대한 친구 */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2744' }}>내가 초대한 친구</div>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '4px 10px', borderRadius: 20 }}>2명</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ textAlign: 'left', padding: '8px 4px', fontSize: 12, color: '#999', fontWeight: 600 }}>이름</th>
              <th style={{ textAlign: 'left', padding: '8px 4px', fontSize: 12, color: '#999', fontWeight: 600 }}>가입일</th>
              <th style={{ textAlign: 'left', padding: '8px 4px', fontSize: 12, color: '#999', fontWeight: 600 }}>계약</th>
              <th style={{ textAlign: 'left', padding: '8px 4px', fontSize: 12, color: '#999', fontWeight: 600 }}>내 포인트</th>
            </tr>
          </thead>
          <tbody>
            {FRIENDS.map((f, i) => (
              <tr key={i} style={{ borderBottom: i < FRIENDS.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                <td style={{ padding: '8px 4px', fontWeight: 600, color: '#1a2744' }}>{f.name}</td>
                <td style={{ padding: '8px 4px', fontSize: 11, color: '#999' }}>{f.date}</td>
                <td style={{ padding: '8px 4px' }}>
                  {f.contract === 'done'
                    ? <><span role="img" aria-label="done">{'\u2705'}</span>{' 완료'}</>
                    : <><span role="img" aria-label="pending">{'\u23F3'}</span>{' 미계약'}</>
                  }
                </td>
                <td style={{ padding: '8px 4px', fontWeight: 700, color: f.point !== '-' ? '#10b981' : '#999' }}>{f.point}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
