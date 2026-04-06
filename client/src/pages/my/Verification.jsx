import React from 'react';

const card = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: 18,
};

export default function Verification() {
  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#1a2744', marginBottom: 6 }}>본인인증</div>
      <div style={{ fontSize: 13, color: '#999', marginBottom: 16 }}>PASS 앱으로 간편하게 인증하세요</div>

      {/* 본인인증 필요 서비스 */}
      <div style={{ ...card, background: '#fffbeb', borderColor: '#fcd34d', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 8 }}>
          <span role="img" aria-label="warning">{'\u26A0\uFE0F'}</span> 본인인증이 필요한 서비스
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
          <div style={{ fontSize: 12, color: '#78350f' }}>
            <div style={{ marginBottom: 4 }}><span role="img" aria-label="gift">{'\u{1F381}'}</span> 사은품 지급 신청</div>
            <div style={{ marginBottom: 4 }}><span role="img" aria-label="money">{'\u{1F4B0}'}</span> 포인트 현금 출금</div>
          </div>
          <div style={{ fontSize: 12, color: '#78350f' }}>
            <div style={{ marginBottom: 4 }}><span role="img" aria-label="package">{'\u{1F4E6}'}</span> 중고폰 매입 신청</div>
            <div style={{ marginBottom: 4 }}><span role="img" aria-label="gift">{'\u{1F381}'}</span> 이벤트 경품 수령</div>
          </div>
        </div>
      </div>

      {/* PASS 인증 */}
      <div style={{ ...card, borderColor: '#bfdbfe', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a2744', marginBottom: 12 }}>
          <span role="img" aria-label="phone">{'\u{1F4F1}'}</span> PASS로 인증하기
        </div>
        <div style={{ fontSize: 12, color: '#666', marginBottom: 16, lineHeight: 1.8 }}>
          {'통신사 PASS 앱으로 1초 만에 인증이 완료됩니다.'}<br />
          {'SKT \u00B7 KT \u00B7 LG U+ 모두 지원합니다.'}
        </div>
        <button style={{
          width: '100%',
          height: 52,
          borderRadius: 10,
          fontSize: 15,
          fontWeight: 700,
          background: '#2563eb',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          marginBottom: 10,
        }}>
          PASS로 본인인증하기
        </button>
        <div style={{ textAlign: 'center', fontSize: 12, color: '#999' }}>
          {'PASS 앱이 없으시면 '}<span style={{ color: '#2563eb', cursor: 'pointer' }}>SMS 인증</span>{'으로 진행하세요'}
        </div>
      </div>

      {/* 수집 정보 안내 */}
      <div style={{ ...card, background: '#f8f9fc' }}>
        <div style={{ fontSize: 12, color: '#999', lineHeight: 1.8 }}>
          <div style={{ fontWeight: 700, color: '#666', marginBottom: 6 }}>인증 시 수집되는 정보</div>
          <div>{'이름 \u00B7 생년월일 \u00B7 성별 \u00B7 휴대폰번호 \u00B7 통신사'}</div>
          <div style={{ marginTop: 4 }}>수집된 정보는 서비스 제공 목적으로만 사용됩니다.</div>
        </div>
      </div>

      {/* 인증 완료 시 화면 (참고용) */}
      <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #e5e7eb' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#999', marginBottom: 12 }}>
          <span role="img" aria-label="check">{'\u2705'}</span> 인증 완료 시 화면
        </div>
        <div style={{ ...card, background: '#ecfdf5', borderColor: '#6ee7b7' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#065f46' }}>본인인증 완료</div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981', background: '#ecfdf5', padding: '4px 10px', borderRadius: 20 }}>인증완료</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
            <div style={{ fontSize: 12, color: '#065f46' }}>
              <div style={{ marginBottom: 4 }}>이름: 홍길동</div>
              <div style={{ marginBottom: 4 }}>생년월일: 1990.01.01</div>
              <div>성별: 남성</div>
            </div>
            <div style={{ fontSize: 12, color: '#065f46' }}>
              <div style={{ marginBottom: 4 }}>통신사: KT</div>
              <div style={{ marginBottom: 4 }}>인증일: 2026.04.05</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
