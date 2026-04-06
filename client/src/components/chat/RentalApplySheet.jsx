import React, { useState } from 'react';
import BottomSheet from './BottomSheet';

const ACCENT = '#2563eb';
const NAVY = '#1a2744';

const REGIONS = ['광주', '전남', '전북', '기타'];
const CONTACT_TIMES = ['오전', '오후', '저녁', '상관없음'];

export default function RentalApplySheet({ open, onClose, product }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [region, setRegion] = useState('');
  const [contactTime, setContactTime] = useState('');
  const [memo, setMemo] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const isValid = name.trim() && phone.trim();

  const handleSubmit = () => {
    if (!isValid) return;
    setSubmitted(true);
  };

  const handleClose = () => {
    setSubmitted(false);
    setName('');
    setPhone('');
    setRegion('');
    setContactTime('');
    setMemo('');
    onClose();
  };

  const inputStyle = {
    width: '100%',
    height: 48,
    border: '1px solid #d1d5db',
    borderRadius: 10,
    padding: '0 12px',
    fontSize: 15,
    boxSizing: 'border-box',
    outline: 'none',
  };

  const labelStyle = {
    display: 'block',
    fontSize: 14,
    fontWeight: 600,
    color: NAVY,
    marginBottom: 6,
  };

  const fieldGroup = {
    marginBottom: 16,
  };

  const readonlyStyle = {
    ...inputStyle,
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
  };

  const ctaStyle = {
    position: 'sticky',
    bottom: 0,
    padding: 16,
    backgroundColor: '#fff',
    borderTop: '1px solid #e5e7eb',
  };

  const btnStyle = {
    width: '100%',
    height: 52,
    backgroundColor: isValid ? ACCENT : '#d1d5db',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontSize: 16,
    fontWeight: 700,
    cursor: isValid ? 'pointer' : 'default',
  };

  if (submitted) {
    return (
      <BottomSheet open={open} onClose={handleClose} title="신청 완료">
        <div style={{ padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{'🎉'}</div>
          <h3 style={{ fontSize: 22, fontWeight: 700, color: NAVY, marginBottom: 8 }}>
            신청이 완료됐어요!
          </h3>
          <p style={{ fontSize: 15, color: '#6b7280', marginBottom: 24 }}>
            전문 상담사가 확인 후 연락드릴게요
          </p>
          <div
            style={{
              backgroundColor: '#f3f4f6',
              borderRadius: 10,
              padding: 16,
              textAlign: 'left',
            }}
          >
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>신청 상품</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: NAVY, marginBottom: 12 }}>
              {product?.name || '선택된 상품'}
            </div>
            {product?.gift && (
              <>
                <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>사은품</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: ACCENT }}>
                  {product.gift}
                </div>
              </>
            )}
          </div>
          <button
            style={{
              ...btnStyle,
              backgroundColor: ACCENT,
              marginTop: 24,
              cursor: 'pointer',
            }}
            onClick={handleClose}
          >
            확인
          </button>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet open={open} onClose={handleClose} title="렌탈 신청" height="85vh">
      <div style={{ padding: 16, paddingBottom: 80 }}>
        <div style={fieldGroup}>
          <label style={labelStyle}>이름 *</label>
          <input
            style={inputStyle}
            type="text"
            placeholder="이름을 입력해주세요"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div style={fieldGroup}>
          <label style={labelStyle}>전화번호 *</label>
          <input
            style={inputStyle}
            type="tel"
            placeholder="010-0000-0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>

        <div style={fieldGroup}>
          <label style={labelStyle}>관심 상품</label>
          <input
            style={readonlyStyle}
            type="text"
            value={product?.name || ''}
            readOnly
          />
        </div>

        <div style={fieldGroup}>
          <label style={labelStyle}>설치 지역</label>
          <select
            style={inputStyle}
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          >
            <option value="">선택해주세요</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div style={fieldGroup}>
          <label style={labelStyle}>희망 연락 시간</label>
          <select
            style={inputStyle}
            value={contactTime}
            onChange={(e) => setContactTime(e.target.value)}
          >
            <option value="">선택해주세요</option>
            {CONTACT_TIMES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div style={fieldGroup}>
          <label style={labelStyle}>메모 (선택)</label>
          <textarea
            style={{
              ...inputStyle,
              height: 80,
              padding: '12px',
              resize: 'none',
            }}
            placeholder="요청사항을 입력해주세요 (최대 100자)"
            value={memo}
            onChange={(e) => {
              if (e.target.value.length <= 100) setMemo(e.target.value);
            }}
            maxLength={100}
          />
          <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'right', marginTop: 4 }}>
            {memo.length}/100
          </div>
        </div>
      </div>

      <div style={ctaStyle}>
        <button style={btnStyle} onClick={handleSubmit} disabled={!isValid}>
          신청 완료하기
        </button>
      </div>
    </BottomSheet>
  );
}
