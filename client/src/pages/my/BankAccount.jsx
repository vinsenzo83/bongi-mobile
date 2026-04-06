import React from 'react';

const card = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: 18,
};

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  fontSize: 13,
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  background: '#fff',
  color: '#999',
  boxSizing: 'border-box',
};

const labelStyle = {
  fontSize: 12,
  fontWeight: 600,
  color: '#666',
  marginBottom: 6,
};

export default function BankAccount() {
  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#1a2744', marginBottom: 6 }}>계좌 관리</div>
      <div style={{ fontSize: 13, color: '#999', marginBottom: 16 }}>
        {'사은품 \u00B7 포인트 출금 \u00B7 중고폰 대금 수령 계좌를 등록하세요'}
      </div>

      {/* 본인인증 완료 배너 */}
      <div style={{ ...card, background: '#ecfdf5', borderColor: '#6ee7b7', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: '#065f46' }}>
            <span role="img" aria-label="check">{'\u2705'}</span> 본인인증 완료 — 계좌 등록이 가능합니다
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981', background: '#ecfdf5', padding: '4px 10px', borderRadius: 20 }}>인증완료</span>
        </div>
      </div>

      {/* 등록된 계좌 */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2744' }}>등록된 계좌</div>
        </div>
        <div style={{ background: '#f8f9fc', border: '1px solid #e5e7eb', borderRadius: 8, padding: 14, marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a2744', marginBottom: 4 }}>국민은행 123-456-789012</div>
              <div style={{ fontSize: 12, color: '#999' }}>
                {'예금주: 홍길동 \u00B7 실명확인 완료 \u2713'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={{
                padding: '4px 12px', fontSize: 11, borderRadius: 4,
                background: '#f3f4f6', color: '#666', border: '1px solid #e5e7eb', cursor: 'pointer',
              }}>변경</button>
              <button style={{
                padding: '4px 12px', fontSize: 11, borderRadius: 4,
                background: '#fff', color: '#ef4444', border: '1px solid #fca5a5', cursor: 'pointer',
              }}>삭제</button>
            </div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#999', lineHeight: 2, background: '#f8f9fc', borderRadius: 8, padding: '10px 14px' }}>
          <div><span role="img" aria-label="check">{'\u2705'}</span> 사은품 지급 시 이 계좌로 자동 입금</div>
          <div><span role="img" aria-label="check">{'\u2705'}</span> 포인트 현금 출금 시 이 계좌로 자동 입금</div>
          <div><span role="img" aria-label="check">{'\u2705'}</span> 중고폰 매입 대금도 이 계좌로 입금</div>
        </div>
      </div>

      {/* 계좌 변경 폼 */}
      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2744', marginBottom: 14 }}>계좌 변경</div>
        <div style={{ marginBottom: 14 }}>
          <div style={labelStyle}>은행 선택</div>
          <select style={{ ...inputStyle, color: '#999' }}>
            <option>{'은행을 선택하세요 \u25BE'}</option>
          </select>
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={labelStyle}>계좌번호</div>
          <input style={inputStyle} placeholder="계좌번호를 입력하세요 (- 없이)" />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{
            height: 44, flex: 1, borderRadius: 8, fontSize: 13,
            background: '#f3f4f6', color: '#666', border: '1px solid #e5e7eb', cursor: 'pointer',
          }}>실명 조회</button>
          <button style={{
            height: 44, flex: 1, borderRadius: 8, fontSize: 13, fontWeight: 700,
            background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer',
          }}>저장</button>
        </div>
        <div style={{ fontSize: 11, color: '#999', marginTop: 10, lineHeight: 1.6 }}>
          {'※ 예금주명이 본인인증 이름과 일치해야 등록 가능합니다'}<br />
          {'※ 타인 계좌 등록 불가'}
        </div>
      </div>
    </div>
  );
}
