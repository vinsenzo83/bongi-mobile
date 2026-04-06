import React from 'react';
import { Link } from 'react-router-dom';

const card = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: 18,
};

export default function Home() {
  return (
    <div>
      {/* Hero KPI Card */}
      <div style={{ ...card, background: '#1a2744', color: '#fff', marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>안녕하세요</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
          {'홍길동 님 '}<span role="img" aria-label="wave">{'\u{1F44B}'}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#60a5fa' }}>1</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>진행중 신청</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#34d399' }}>370,000</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{'사은품 예정(원)'}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#fbbf24' }}>30,000</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>보유 포인트</div>
          </div>
        </div>
      </div>

      {/* 진행중인 신청 */}
      <div style={{ fontSize: 13, fontWeight: 700, color: '#1a2744', marginBottom: 10 }}>진행중인 신청</div>
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2744' }}>KT 인터넷+TV 500Mbps</div>
            <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{'신청일 2026.04.01 \u00B7 셀프 신청'}</div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '4px 10px', borderRadius: 20 }}>상담중</span>
        </div>
      </div>

      {/* 돈지키미 알림 */}
      <div style={{ ...card, background: '#fef3c7', borderColor: '#fcd34d', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2744' }}>
              <span role="img" aria-label="alarm">{'\u23F0'}</span> 돈지키미 알림
            </div>
            <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{'인터넷 약정 종료 D-30 (2026.05.01)'}</div>
          </div>
          <Link to="/my/guard" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 32, width: 80, fontSize: 12, borderRadius: 6, background: '#2563eb', color: '#fff', textDecoration: 'none', fontWeight: 600 }}>
            재계약 상담
          </Link>
        </div>
      </div>

      {/* 친구초대 배너 */}
      <div style={{ ...card, background: '#eff6ff', borderColor: '#bfdbfe', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2744' }}>
              <span role="img" aria-label="friends">{'\u{1F46B}'}</span> 친구 초대하고 포인트 받기
            </div>
            <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>친구가 계약하면 둘 다 포인트!</div>
          </div>
          <Link to="/my/referral" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 32, width: 80, fontSize: 12, borderRadius: 6, background: '#2563eb', color: '#fff', textDecoration: 'none', fontWeight: 600 }}>
            초대하기
          </Link>
        </div>
      </div>

      {/* 본인인증 안내 */}
      <div style={{ ...card, background: '#fffbeb', borderColor: '#fcd34d' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#92400e' }}>
              <span role="img" aria-label="warning">{'\u26A0\uFE0F'}</span> 본인인증을 완료해주세요
            </div>
            <div style={{ fontSize: 12, color: '#78350f', marginTop: 4 }}>
              {'사은품 지급 \u00B7 포인트 출금 \u00B7 중고폰 매입 시 필요해요'}
            </div>
          </div>
          <Link to="/my/verify" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 32, width: 80, fontSize: 12, borderRadius: 6, background: '#2563eb', color: '#fff', textDecoration: 'none', fontWeight: 600 }}>
            인증하기
          </Link>
        </div>
      </div>
    </div>
  );
}
