import React, { useState } from 'react';
import BottomSheet from './BottomSheet';

const ACCENT = '#2563eb';
const NAVY = '#1a2744';
const GREEN = '#10b981';

const GRADES = [
  { key: 'A', label: 'A 외관깨끗' },
  { key: 'B', label: 'B 미세기스' },
  { key: 'C', label: 'C 눈에보이는기스' },
  { key: 'D', label: 'D 파손깨짐' },
  { key: 'E', label: 'E 심각손상' },
];

const DAMAGE_OPTIONS = ['없음', '미세기스', '화면깨짐', '기타'];

const PROGRESS_STEPS = ['신청완료', '검수중', '검수완료', '입금완료'];

export default function UsedPhoneIntakeSheet({ open, onClose, phone }) {
  const [name, setName] = useState('');
  const [tel, setTel] = useState('');
  const [grade, setGrade] = useState('');
  const [damage, setDamage] = useState('');
  const [address, setAddress] = useState('');
  const [addressDetail, setAddressDetail] = useState('');
  const [photos, setPhotos] = useState({ front: null, back: null, side: null });
  const [submitted, setSubmitted] = useState(false);

  const isValid = name.trim() && tel.trim() && grade && damage && address.trim();

  const handleSubmit = () => {
    if (!isValid) return;
    setSubmitted(true);
  };

  const handleClose = () => {
    setSubmitted(false);
    setName('');
    setTel('');
    setGrade('');
    setDamage('');
    setAddress('');
    setAddressDetail('');
    setPhotos({ front: null, back: null, side: null });
    onClose();
  };

  const handlePhoto = (position) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (file) {
        setPhotos((prev) => ({ ...prev, [position]: file.name }));
      }
    };
    input.click();
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

  const fieldGroup = { marginBottom: 16 };

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
      <BottomSheet open={open} onClose={handleClose} title="접수 완료">
        <div style={{ padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{'📱'}</div>
          <h3 style={{ fontSize: 22, fontWeight: 700, color: NAVY, marginBottom: 8 }}>
            접수가 완료됐어요!
          </h3>
          <p style={{ fontSize: 15, color: '#6b7280', marginBottom: 32 }}>
            검수 후 안내드릴게요
          </p>

          {/* Progress bar */}
          <div style={{ padding: '0 8px', marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
              {/* Background line */}
              <div
                style={{
                  position: 'absolute',
                  top: 14,
                  left: 20,
                  right: 20,
                  height: 3,
                  backgroundColor: '#e5e7eb',
                  zIndex: 0,
                }}
              />
              {/* Active line segment */}
              <div
                style={{
                  position: 'absolute',
                  top: 14,
                  left: 20,
                  width: '0%',
                  height: 3,
                  backgroundColor: GREEN,
                  zIndex: 1,
                }}
              />
              {PROGRESS_STEPS.map((step, i) => (
                <div key={step} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      backgroundColor: i === 0 ? GREEN : '#e5e7eb',
                      color: i === 0 ? '#fff' : '#9ca3af',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 13,
                      fontWeight: 700,
                      marginBottom: 6,
                    }}
                  >
                    {i === 0 ? '✓' : i + 1}
                  </div>
                  <div style={{ fontSize: 12, color: i === 0 ? GREEN : '#9ca3af', fontWeight: i === 0 ? 600 : 400 }}>
                    {step}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              backgroundColor: '#f3f4f6',
              borderRadius: 10,
              padding: 16,
              textAlign: 'left',
              marginBottom: 24,
            }}
          >
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>접수 모델</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: NAVY }}>
              {phone?.model || '선택된 모델'} {phone?.storage || ''}
            </div>
          </div>

          <button
            style={{ ...btnStyle, backgroundColor: ACCENT, cursor: 'pointer' }}
            onClick={handleClose}
          >
            확인
          </button>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet open={open} onClose={handleClose} title="중고폰 매입 접수">
      <div style={{ padding: 16, paddingBottom: 80 }}>
        <div style={fieldGroup}>
          <label style={labelStyle}>이름 *</label>
          <input
            style={inputStyle}
            type="text"
            placeholder="이름을 입력해주세요"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div style={fieldGroup}>
          <label style={labelStyle}>전화번호 *</label>
          <input
            style={inputStyle}
            type="tel"
            placeholder="010-0000-0000"
            value={tel}
            onChange={(e) => setTel(e.target.value)}
          />
        </div>

        <div style={fieldGroup}>
          <label style={labelStyle}>모델명</label>
          <input style={readonlyStyle} type="text" value={phone?.model || ''} readOnly />
        </div>

        <div style={fieldGroup}>
          <label style={labelStyle}>용량</label>
          <input style={readonlyStyle} type="text" value={phone?.storage || ''} readOnly />
        </div>

        <div style={fieldGroup}>
          <label style={labelStyle}>셀프 등급 *</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {GRADES.map((g) => (
              <button
                key={g.key}
                onClick={() => setGrade(g.key)}
                style={{
                  flex: '1 1 calc(50% - 4px)',
                  minWidth: 0,
                  height: 44,
                  border: grade === g.key ? `2px solid ${ACCENT}` : '1px solid #d1d5db',
                  borderRadius: 10,
                  backgroundColor: grade === g.key ? '#eff6ff' : '#fff',
                  color: grade === g.key ? ACCENT : NAVY,
                  fontSize: 13,
                  fontWeight: grade === g.key ? 700 : 400,
                  cursor: 'pointer',
                }}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        <div style={fieldGroup}>
          <label style={labelStyle}>파손 여부 *</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {DAMAGE_OPTIONS.map((opt) => (
              <label
                key={opt}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 15,
                  color: NAVY,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="damage"
                  checked={damage === opt}
                  onChange={() => setDamage(opt)}
                  style={{ accentColor: ACCENT }}
                />
                {opt}
              </label>
            ))}
          </div>
        </div>

        <div style={fieldGroup}>
          <label style={labelStyle}>수거 주소 *</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              style={{ ...inputStyle, flex: 1 }}
              type="text"
              placeholder="주소를 입력해주세요"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <button
              style={{
                height: 48,
                padding: '0 14px',
                border: `1px solid ${ACCENT}`,
                borderRadius: 10,
                backgroundColor: '#fff',
                color: ACCENT,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              주소 검색
            </button>
          </div>
        </div>

        <div style={fieldGroup}>
          <label style={labelStyle}>상세 주소</label>
          <input
            style={inputStyle}
            type="text"
            placeholder="상세 주소를 입력해주세요"
            value={addressDetail}
            onChange={(e) => setAddressDetail(e.target.value)}
          />
        </div>

        <div style={fieldGroup}>
          <label style={labelStyle}>사진 첨부 (선택)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['전면', '후면', '측면'].map((pos) => {
              const key = pos === '전면' ? 'front' : pos === '후면' ? 'back' : 'side';
              return (
                <div
                  key={pos}
                  onClick={() => handlePhoto(key)}
                  style={{
                    flex: 1,
                    height: 80,
                    border: '1px dashed #d1d5db',
                    borderRadius: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    backgroundColor: photos[key] ? '#eff6ff' : '#f9fafb',
                  }}
                >
                  <div style={{ fontSize: 20, marginBottom: 4 }}>
                    {photos[key] ? '✓' : '📷'}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{pos}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={ctaStyle}>
        <button style={btnStyle} onClick={handleSubmit} disabled={!isValid}>
          접수 신청하기
        </button>
      </div>
    </BottomSheet>
  );
}
