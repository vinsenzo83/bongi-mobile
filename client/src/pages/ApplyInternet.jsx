import React, { useState, useEffect } from 'react';

const NAVY = '#1a2744';
const ACCENT = '#2563eb';
const GREEN = '#10b981';

const APPLY_TYPES = ['신규가입', '이전설치', '재약정'];
const CARRIERS = ['SKT', 'KT', 'LGU+', '없음'];

export default function ApplyInternet() {
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);

  // Step 1
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [applyType, setApplyType] = useState('');
  const [carrier, setCarrier] = useState('');

  // Step 2
  const [product, setProduct] = useState('');
  const [ticketNo, setTicketNo] = useState('');
  const [carrierSpeed, setCarrierSpeed] = useState('');
  const [tv, setTv] = useState('');
  const [installAddr, setInstallAddr] = useState('');
  const [installAddrDetail, setInstallAddrDetail] = useState('');
  const [installDate, setInstallDate] = useState('');

  // Step 3
  const [giftAmount, setGiftAmount] = useState('');
  const [privacyAgree, setPrivacyAgree] = useState(false);
  const [marketingAgree, setMarketingAgree] = useState(false);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const p = params.get('product') || localStorage.getItem('bongi_product') || '';
      const t = params.get('ticketNo') || localStorage.getItem('bongi_ticketNo') || '';
      const cs = params.get('carrierSpeed') || localStorage.getItem('bongi_carrierSpeed') || '';
      const tvParam = params.get('tv') || localStorage.getItem('bongi_tv') || '';
      const g = params.get('gift') || localStorage.getItem('bongi_gift') || '';
      setProduct(p);
      setTicketNo(t);
      setCarrierSpeed(cs);
      setTv(tvParam);
      setGiftAmount(g);
    } catch {
      // ignore
    }
  }, []);

  const isStep1Valid = name.trim() && phone.trim() && applyType;
  const isStep2Valid = installAddr.trim();
  const isStep3Valid = privacyAgree && marketingAgree;

  const canProceed = step === 1 ? isStep1Valid : step === 2 ? isStep2Valid : isStep3Valid;

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      setSubmitted(true);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
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

  const pageStyle = {
    minHeight: '100vh',
    backgroundColor: '#fff',
    display: 'flex',
    flexDirection: 'column',
    maxWidth: 480,
    margin: '0 auto',
  };

  const headerStyle = {
    backgroundColor: NAVY,
    color: '#fff',
    padding: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexShrink: 0,
  };

  const backBtnStyle = {
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: 20,
    cursor: 'pointer',
    padding: 0,
    lineHeight: 1,
  };

  const progressWrap = {
    display: 'flex',
    gap: 8,
    padding: '16px',
    backgroundColor: '#f9fafb',
  };

  const ctaWrap = {
    position: 'sticky',
    bottom: 0,
    padding: 16,
    backgroundColor: '#fff',
    borderTop: '1px solid #e5e7eb',
  };

  const ctaBtn = {
    width: '100%',
    height: 52,
    backgroundColor: canProceed ? ACCENT : '#d1d5db',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontSize: 16,
    fontWeight: 700,
    cursor: canProceed ? 'pointer' : 'default',
  };

  if (submitted) {
    return (
      <div style={pageStyle}>
        <div style={headerStyle}>
          <span style={{ fontSize: 17, fontWeight: 700 }}>신청 완료</span>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{'🎉'}</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: NAVY, marginBottom: 8 }}>
            {'신청이 완료됐어요! '}{'🎉'}
          </h2>
          <p style={{ fontSize: 15, color: '#6b7280', marginBottom: 8 }}>
            전문 상담사가 확인 후 연락드릴게요
          </p>
          <p style={{ fontSize: 14, color: '#9ca3af', marginBottom: 32 }}>
            영업일 기준 1~2일 내 연락드립니다
          </p>

          <div style={{ backgroundColor: '#f3f4f6', borderRadius: 10, padding: 16, width: '100%', textAlign: 'left', marginBottom: 24 }}>
            <Row label="이름" value={name} />
            <Row label="전화번호" value={phone} />
            <Row label="신청 유형" value={applyType} />
            <Row label="신청 상품" value={product} />
            {giftAmount && <Row label="예상 사은품" value={giftAmount} highlight />}
          </div>

          <button
            style={{ ...ctaBtn, backgroundColor: ACCENT, cursor: 'pointer' }}
            onClick={() => {
              try { window.history.back(); } catch { /* ignore */ }
            }}
          >
            채팅으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={headerStyle}>
        {step > 1 && (
          <button style={backBtnStyle} onClick={handleBack}>
            {'←'}
          </button>
        )}
        <span style={{ fontSize: 17, fontWeight: 700 }}>인터넷 신청</span>
      </div>

      {/* Progress */}
      <div style={progressWrap}>
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: s <= step ? ACCENT : '#e5e7eb',
              transition: 'background-color 0.2s',
            }}
          />
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: 16, paddingBottom: 80, overflowY: 'auto' }}>
        {step === 1 && (
          <>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: NAVY, marginBottom: 20, marginTop: 0 }}>
              기본 정보
            </h3>

            <div style={fieldGroup}>
              <label style={labelStyle}>이름 *</label>
              <input style={inputStyle} type="text" placeholder="이름" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div style={fieldGroup}>
              <label style={labelStyle}>전화번호 *</label>
              <input style={inputStyle} type="tel" placeholder="010-0000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>

            <div style={fieldGroup}>
              <label style={labelStyle}>신청 유형 *</label>
              <select style={inputStyle} value={applyType} onChange={(e) => setApplyType(e.target.value)}>
                <option value="">선택해주세요</option>
                {APPLY_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div style={fieldGroup}>
              <label style={labelStyle}>현재 통신사</label>
              <select style={inputStyle} value={carrier} onChange={(e) => setCarrier(e.target.value)}>
                <option value="">선택해주세요 (선택)</option>
                {CARRIERS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: NAVY, marginBottom: 20, marginTop: 0 }}>
              상품/설치 정보
            </h3>

            <div style={fieldGroup}>
              <label style={labelStyle}>신청 상품</label>
              <input style={readonlyStyle} type="text" value={product} readOnly />
            </div>

            <div style={fieldGroup}>
              <label style={labelStyle}>티켓번호</label>
              <input style={readonlyStyle} type="text" value={ticketNo} readOnly />
            </div>

            <div style={fieldGroup}>
              <label style={labelStyle}>통신사/속도</label>
              <input style={readonlyStyle} type="text" value={carrierSpeed} readOnly />
            </div>

            <div style={fieldGroup}>
              <label style={labelStyle}>TV</label>
              <input style={readonlyStyle} type="text" value={tv} readOnly />
            </div>

            <div style={fieldGroup}>
              <label style={labelStyle}>설치 주소 *</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  type="text"
                  placeholder="주소를 입력해주세요"
                  value={installAddr}
                  onChange={(e) => setInstallAddr(e.target.value)}
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
                value={installAddrDetail}
                onChange={(e) => setInstallAddrDetail(e.target.value)}
              />
            </div>

            <div style={fieldGroup}>
              <label style={labelStyle}>희망 설치일</label>
              <input
                style={inputStyle}
                type="date"
                value={installDate}
                onChange={(e) => setInstallDate(e.target.value)}
              />
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: NAVY, marginBottom: 20, marginTop: 0 }}>
              신청 정보 확인
            </h3>

            <div style={{ backgroundColor: '#f3f4f6', borderRadius: 10, padding: 16, marginBottom: 20 }}>
              <Row label="이름" value={name} />
              <Row label="전화번호" value={phone} />
              <Row label="신청 유형" value={applyType} />
              {carrier && <Row label="현재 통신사" value={carrier} />}
              <Row label="신청 상품" value={product} />
              {ticketNo && <Row label="티켓번호" value={ticketNo} />}
              {carrierSpeed && <Row label="통신사/속도" value={carrierSpeed} />}
              {tv && <Row label="TV" value={tv} />}
              <Row label="설치 주소" value={`${installAddr} ${installAddrDetail}`.trim()} />
              {installDate && <Row label="희망 설치일" value={installDate} />}
            </div>

            {giftAmount && (
              <div style={{ backgroundColor: '#eff6ff', borderRadius: 10, padding: 16, marginBottom: 20 }}>
                <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>
                  예상 사은품 금액
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: ACCENT }}>
                  {giftAmount}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, color: NAVY, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={privacyAgree}
                  onChange={(e) => setPrivacyAgree(e.target.checked)}
                  style={{ marginTop: 2, accentColor: ACCENT }}
                />
                <span>[필수] 개인정보 수집 및 이용에 동의합니다</span>
              </label>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, color: NAVY, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={marketingAgree}
                  onChange={(e) => setMarketingAgree(e.target.checked)}
                  style={{ marginTop: 2, accentColor: ACCENT }}
                />
                <span>[필수] 마케팅 정보 수신에 동의합니다</span>
              </label>
            </div>
          </>
        )}
      </div>

      {/* CTA */}
      <div style={ctaWrap}>
        <button style={ctaBtn} onClick={handleNext} disabled={!canProceed}>
          {step < 3 ? '다음' : '신청 완료하기'}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, highlight }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
      <span style={{ fontSize: 14, color: '#6b7280' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: highlight ? 700 : 500, color: highlight ? ACCENT : NAVY }}>
        {value || '-'}
      </span>
    </div>
  );
}
