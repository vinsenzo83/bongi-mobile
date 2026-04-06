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
  color: '#1a1a1a',
  boxSizing: 'border-box',
};

const labelStyle = {
  fontSize: 12,
  fontWeight: 600,
  color: '#666',
  marginBottom: 6,
};

export default function Profile() {
  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#1a2744', marginBottom: 20 }}>내 정보</div>

      <div style={card}>
        <div style={{ marginBottom: 16 }}>
          <div style={labelStyle}>이름</div>
          <input style={inputStyle} defaultValue="홍길동" />
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={labelStyle}>전화번호</div>
          <input style={inputStyle} defaultValue="010-1234-5678" />
        </div>
        <div>
          <div style={labelStyle}>소셜 연동</div>
          <div style={{
            padding: '10px 14px',
            fontSize: 13,
            background: '#f3f4f6',
            borderRadius: 8,
            color: '#666',
          }}>
            카카오 연동됨
          </div>
        </div>
      </div>

      <button style={{
        width: '100%',
        height: 44,
        marginTop: 16,
        marginBottom: 12,
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

      <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '16px 0' }} />

      <div style={{ textAlign: 'center', fontSize: 12, color: '#999', cursor: 'pointer' }}>
        회원 탈퇴
      </div>
    </div>
  );
}
