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
  marginBottom: 10,
};

const labelStyle = {
  fontSize: 12,
  fontWeight: 600,
  color: '#666',
  marginBottom: 6,
};

const ADDRESSES = [
  {
    label: '집',
    isDefault: true,
    address: '광주시 서구 상무대로 123 아파트 101동 1001호',
    name: '홍길동',
    phone: '010-1234-5678',
  },
  {
    label: '직장',
    isDefault: false,
    address: '광주시 동구 금남로 456 오피스빌딩 5층',
    name: '홍길동',
    phone: '010-1234-5678',
    opacity: 0.85,
  },
];

export default function Address() {
  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#1a2744' }}>주소 관리</div>
        <button style={{
          height: 34, padding: '0 16px', borderRadius: 8, fontSize: 12,
          background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600,
        }}>
          + 주소 추가
        </button>
      </div>
      <div style={{ fontSize: 13, color: '#999', marginBottom: 16 }}>
        {'인터넷/렌탈 설치 \u00B7 중고폰 수거 시 사용할 주소를 등록하세요'}
      </div>

      {/* 안내 카드 */}
      <div style={{ ...card, background: '#eff6ff', borderColor: '#bfdbfe', marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: '#1a2744', lineHeight: 2 }}>
          <div><span role="img" aria-label="package">{'\u{1F4E6}'}</span> <strong>중고폰 수거</strong> — 신청 시 저장된 주소 자동완성</div>
          <div><span role="img" aria-label="globe">{'\u{1F310}'}</span> <strong>인터넷/TV 설치</strong> — 신청 시 저장된 주소 선택 가능</div>
          <div><span role="img" aria-label="wrench">{'\u{1F527}'}</span> <strong>렌탈 설치</strong> — 신청 시 저장된 주소 선택 가능</div>
        </div>
      </div>

      {/* Address cards */}
      {ADDRESSES.map((addr, i) => (
        <div
          key={i}
          style={{
            ...card,
            marginBottom: 12,
            borderColor: addr.isDefault ? '#bfdbfe' : '#e5e7eb',
            opacity: addr.opacity || 1,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1a2744' }}>{addr.label}</div>
                {addr.isDefault && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '2px 8px', borderRadius: 20 }}>기본 주소</span>
                )}
              </div>
              <div style={{ fontSize: 13, color: '#666' }}>{addr.address}</div>
              <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                {`${addr.name} \u00B7 ${addr.phone}`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {!addr.isDefault && (
                <button style={{
                  padding: '4px 10px', fontSize: 11, borderRadius: 4,
                  background: '#f3f4f6', color: '#666', border: '1px solid #e5e7eb', cursor: 'pointer',
                }}>기본으로</button>
              )}
              <button style={{
                padding: '4px 10px', fontSize: 11, borderRadius: 4,
                background: '#f3f4f6', color: '#666', border: '1px solid #e5e7eb', cursor: 'pointer',
              }}>수정</button>
              <button style={{
                padding: '4px 10px', fontSize: 11, borderRadius: 4,
                background: '#fff', color: '#ef4444', border: '1px solid #fca5a5', cursor: 'pointer',
              }}>삭제</button>
            </div>
          </div>
        </div>
      ))}

      {/* 주소 추가 폼 */}
      <div style={{ ...card, marginTop: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2744', marginBottom: 14 }}>주소 추가</div>

        <div style={{ marginBottom: 10 }}>
          <div style={labelStyle}>{'주소 별칭 (예: 집, 직장, 부모님댁)'}</div>
          <input style={inputStyle} placeholder="별칭을 입력하세요" />
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input style={{ ...inputStyle, flex: 1, marginBottom: 0 }} placeholder="우편번호" />
          <button style={{
            height: 42, width: 110, borderRadius: 8, fontSize: 12, flexShrink: 0,
            background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600,
          }}>주소 검색</button>
        </div>

        <input style={inputStyle} placeholder="도로명 주소" />
        <input style={inputStyle} placeholder="상세 주소 (동/호수)" />

        <div style={{ marginBottom: 10 }}>
          <div style={labelStyle}>수령인</div>
          <input style={{ ...inputStyle, background: '#f0fdf4', borderColor: '#6ee7b7', color: '#1a2744' }} defaultValue="홍길동 (자동완성)" />
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={labelStyle}>연락처</div>
          <input style={{ ...inputStyle, background: '#f0fdf4', borderColor: '#6ee7b7', color: '#1a2744', marginBottom: 0 }} defaultValue="010-1234-5678 (자동완성)" />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <div style={{
            width: 18, height: 18, borderRadius: 3, background: '#f3f4f6',
            border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, color: '#666', flexShrink: 0,
          }}>
            {'\u2713'}
          </div>
          <div style={{ fontSize: 13, color: '#666' }}>기본 주소로 설정</div>
        </div>

        <button style={{
          width: '100%', height: 44, borderRadius: 8, fontSize: 13, fontWeight: 700,
          background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer',
        }}>
          저장
        </button>
      </div>
    </div>
  );
}
