import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const NAVY = '#1a2744';
const ACCENT = '#2563eb';
const GREEN = '#10b981';

const RELATIONS = ['본인', '배우자', '자녀', '부모', '기타'];
const CONTACT_TIMES = ['오전 (9~12시)', '오후 (12~18시)', '저녁 (18~21시)', '상관없음'];
const SUBSCRIBER_TYPES = ['개인', '개인사업자', '법인사업자', '외국인'];
const CARRIERS = ['SKT', 'KT', 'LG U+', '기타'];
const BANKS = ['국민은행', '신한은행', '우리은행', '하나은행', '농협', '카카오뱅크', '토스뱅크', '기업은행', '수협', '대구은행', '부산은행', '광주은행', '전북은행', '제주은행', '기타'];

export default function ApplyInternet() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState({
    // 스텝1: 신청자 정보
    relation: '',
    name: '',
    phone: '',
    contactTime: '',
    // 스텝2: 가입 정보
    subscriberType: '',
    usingInternet: null,
    currentCarrier: '',
    hasCombine: null,
    // 스텝3: 사은품 수령
    giftRecipient: '',
    giftPhone: '',
    bank: '',
    accountNumber: '',
  });

  // URL 파라미터에서 상품 정보
  const productName = params.get('product') || localStorage.getItem('apply_product') || '';
  const ticketNo = params.get('ticket') || localStorage.getItem('apply_ticket') || '';
  const giftAmount = params.get('gift') || localStorage.getItem('apply_gift') || '';

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const canNext = () => {
    if (step === 1) return form.relation && form.name.trim() && form.phone.trim() && form.contactTime;
    if (step === 2) return form.subscriberType && form.usingInternet !== null;
    if (step === 3) return form.bank && form.accountNumber.trim();
    return false;
  };

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
    else setSubmitted(true);
  };

  if (submitted) {
    return (
      <div style={s.page}>
        <div style={s.container}>
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>{'🎉'}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: NAVY, marginBottom: 8 }}>신청이 완료됐어요!</div>
            <div style={{ fontSize: 14, color: '#555', marginBottom: 24, lineHeight: 1.6 }}>
              전문 상담사가 확인 후 연락드릴게요
            </div>
            <div style={s.summaryCard}>
              {productName && <Row label="상품" value={productName} />}
              {ticketNo && <Row label="티켓번호" value={ticketNo} />}
              {giftAmount && <Row label="사은품" value={giftAmount} />}
              <Row label="신청자" value={`${form.name} (${form.relation})`} />
              <Row label="연락처" value={form.phone} />
              <Row label="희망 상담" value={form.contactTime} />
              <Row label="가입 유형" value={form.subscriberType} />
              <Row label="수령 계좌" value={`${form.bank} ${form.accountNumber}`} />
            </div>
            <div style={{ fontSize: 13, color: GREEN, fontWeight: 600, marginBottom: 24 }}>
              {'📞'} 희망 시간대에 상담사가 연락드립니다
            </div>
            <button onClick={() => navigate('/')} style={s.cta}>
              {'💬'} 채팅으로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      {/* 헤더 */}
      <div style={s.header}>
        <button onClick={() => step > 1 ? setStep(step - 1) : navigate('/')} style={s.backBtn}>
          {'←'}
        </button>
        <span style={s.headerTitle}>인터넷 신청</span>
        <span style={{ width: 32 }} />
      </div>

      {/* 프로그래스 */}
      <div style={s.progress}>
        {[1, 2, 3].map(n => (
          <div key={n} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ ...s.stepDot, background: n <= step ? ACCENT : '#e8e8e8', color: n <= step ? '#fff' : '#999' }}>{n}</div>
            <span style={{ fontSize: 10, color: n <= step ? ACCENT : '#999', fontWeight: n === step ? 700 : 400 }}>
              {n === 1 ? '신청자 정보' : n === 2 ? '가입 정보' : '사은품 수령'}
            </span>
          </div>
        ))}
      </div>

      {/* 상품 배너 */}
      {productName && (
        <div style={s.container}>
          <div style={s.productBanner}>
            <div style={{ fontSize: 11, color: ACCENT, fontWeight: 600 }}>{'📦'} 선택 상품</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginTop: 2 }}>{productName}</div>
            {ticketNo && <span style={{ fontSize: 11, color: ACCENT, fontFamily: 'monospace' }}>{'🎫'} {ticketNo}</span>}
            {giftAmount && <span style={{ fontSize: 11, color: '#d97706', marginLeft: 8 }}>{'🎁'} {giftAmount}</span>}
          </div>
        </div>
      )}

      <div style={s.container}>
        {/* 스텝 1: 신청자 정보 */}
        {step === 1 && (
          <div>
            <div style={s.sectionTitle}>신청자 정보</div>

            <Field label="가입자와의 관계" required>
              <ChipGroup items={RELATIONS} value={form.relation} onChange={v => set('relation', v)} />
            </Field>

            <Field label="이름" required>
              <input style={s.input} placeholder="이름을 입력하세요" value={form.name} onChange={e => set('name', e.target.value)} />
            </Field>

            <Field label="연락처" required>
              <input style={s.input} type="tel" placeholder="010-0000-0000" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </Field>

            <Field label="희망 상담 시간" required>
              <ChipGroup items={CONTACT_TIMES} value={form.contactTime} onChange={v => set('contactTime', v)} />
            </Field>
          </div>
        )}

        {/* 스텝 2: 가입 정보 */}
        {step === 2 && (
          <div>
            <div style={s.sectionTitle}>가입 정보</div>

            <Field label="가입 정보" required>
              <ChipGroup items={SUBSCRIBER_TYPES} value={form.subscriberType} onChange={v => set('subscriberType', v)} />
            </Field>

            <Field label="현재 인터넷 사용 여부" required>
              <ChipGroup items={['사용중', '미사용']} value={form.usingInternet === true ? '사용중' : form.usingInternet === false ? '미사용' : ''} onChange={v => set('usingInternet', v === '사용중')} />
            </Field>

            {form.usingInternet === true && (
              <Field label="사용중인 통신사">
                <ChipGroup items={CARRIERS} value={form.currentCarrier} onChange={v => set('currentCarrier', v)} />
              </Field>
            )}

            <Field label="결합 여부">
              <ChipGroup items={['결합 있음', '결합 없음', '모르겠음']} value={form.hasCombine === true ? '결합 있음' : form.hasCombine === false ? '결합 없음' : form.hasCombine === null && form.usingInternet ? '' : '모르겠음'} onChange={v => set('hasCombine', v === '결합 있음' ? true : v === '결합 없음' ? false : null)} />
            </Field>
          </div>
        )}

        {/* 스텝 3: 사은품 수령 */}
        {step === 3 && (
          <div>
            <div style={s.sectionTitle}>사은품 수령 정보</div>

            <div style={s.infoBox}>
              <div style={{ fontSize: 12, color: '#065f46', lineHeight: 1.6 }}>
                {'💰'} 계약 완료 시 사은품은 <strong>현금</strong>으로 지급됩니다.
                {giftAmount && <><br />예상 사은품: <strong style={{ color: '#d97706' }}>{giftAmount}</strong></>}
              </div>
            </div>

            <Field label="수령자 이름" required>
              <input style={s.input} placeholder="수령자 이름" value={form.giftRecipient || form.name} onChange={e => set('giftRecipient', e.target.value)} />
            </Field>

            <Field label="수령자 연락처">
              <input style={s.input} type="tel" placeholder="수령자 연락처 (신청자와 동일 시 생략)" value={form.giftPhone} onChange={e => set('giftPhone', e.target.value)} />
            </Field>

            <Field label="은행 선택" required>
              <select style={s.select} value={form.bank} onChange={e => set('bank', e.target.value)}>
                <option value="">은행을 선택하세요</option>
                {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </Field>

            <Field label="계좌번호" required>
              <input style={s.input} type="text" inputMode="numeric" placeholder="계좌번호 입력 (- 없이)" value={form.accountNumber} onChange={e => set('accountNumber', e.target.value)} />
            </Field>

            <div style={s.agreeBox}>
              <div style={{ fontSize: 11, color: '#555', lineHeight: 1.8 }}>
                <div>{'✅'} 개인정보 수집 및 이용에 동의합니다 (필수)</div>
                <div>{'✅'} 마케팅 정보 수신에 동의합니다 (필수)</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 고정 하단 CTA */}
      <div style={s.fixedBottom}>
        <button onClick={handleNext} disabled={!canNext()} style={{ ...s.cta, opacity: canNext() ? 1 : 0.4 }}>
          {step < 3 ? '다음' : '신청 완료하기'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={s.label}>{label} {required && <span style={{ color: '#ef4444' }}>*</span>}</label>
      {children}
    </div>
  );
}

function ChipGroup({ items, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {items.map(item => (
        <button key={item} onClick={() => onChange(item)} style={{
          padding: '10px 16px', borderRadius: 10, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
          border: value === item ? `2px solid ${ACCENT}` : '1.5px solid #d0d0d0',
          background: value === item ? '#dbeafe' : '#fff',
          color: value === item ? ACCENT : '#555',
          fontWeight: value === item ? 700 : 400,
        }}>{item}</button>
      ))}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13, borderBottom: '1px solid #f0f0f0' }}>
      <span style={{ color: '#999' }}>{label}</span>
      <strong style={{ color: NAVY }}>{value}</strong>
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', background: '#f5f6fa', fontFamily: "'Noto Sans KR', -apple-system, sans-serif" },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 16px', background: NAVY, color: '#fff', position: 'sticky', top: 0, zIndex: 10,
  },
  backBtn: { background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', padding: '0 8px' },
  headerTitle: { fontSize: 16, fontWeight: 700 },
  progress: { display: 'flex', gap: 8, padding: '16px 20px', background: '#fff', borderBottom: '1px solid #e8e8e8' },
  stepDot: {
    width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: 700,
  },
  container: { padding: '16px', maxWidth: 480, margin: '0 auto' },
  productBanner: { background: '#dbeafe', border: '1px solid #bfdbfe', borderRadius: 10, padding: 14, marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 16, paddingBottom: 8, borderBottom: `2px solid ${ACCENT}` },
  label: { fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 8, display: 'block' },
  input: {
    width: '100%', height: 48, border: '1.5px solid #d0d0d0', borderRadius: 10,
    padding: '0 14px', fontSize: 14, color: '#1a1a1a', background: '#fafafa',
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  },
  select: {
    width: '100%', height: 48, border: '1.5px solid #d0d0d0', borderRadius: 10,
    padding: '0 14px', fontSize: 14, color: '#1a1a1a', background: '#fafafa',
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', appearance: 'none',
  },
  infoBox: { background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 10, padding: 14, marginBottom: 18 },
  agreeBox: { background: '#f8f9fc', border: '1px solid #e8e8e8', borderRadius: 10, padding: 12, marginBottom: 16 },
  fixedBottom: {
    position: 'fixed', bottom: 0, left: 0, right: 0,
    padding: '12px 16px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
    background: '#fff', borderTop: '1px solid #e8e8e8',
  },
  cta: {
    width: '100%', maxWidth: 480, margin: '0 auto', display: 'block',
    height: 52, borderRadius: 12, border: 'none',
    background: ACCENT, color: '#fff', fontSize: 16, fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  summaryCard: {
    background: '#f8f9fc', border: '1px solid #e8e8e8', borderRadius: 10,
    padding: 16, textAlign: 'left', marginBottom: 20,
  },
};
