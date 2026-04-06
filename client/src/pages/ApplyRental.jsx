import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const NAVY = '#1a2744';
const ACCENT = '#2563eb';
const GREEN = '#10b981';

const REGIONS = ['광주', '전남', '전북', '서울', '경기', '기타'];
const CONTACT_TIMES = ['오전 (9~12시)', '오후 (12~18시)', '저녁 (18~21시)', '상관없음'];
const RELATIONS = ['본인', '배우자', '자녀', '부모', '기타'];

export default function ApplyRental() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [submitted, setSubmitted] = useState(false);

  const productName = params.get('product') || localStorage.getItem('apply_product') || '';
  const ticketNo = params.get('ticket') || localStorage.getItem('apply_ticket') || '';
  const giftAmount = params.get('gift') || localStorage.getItem('apply_gift') || '';

  const [form, setForm] = useState({
    relation: '',
    name: '',
    phone: '',
    contactTime: '',
    region: '',
    address: '',
    addressDetail: '',
    memo: '',
  });

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));
  const isValid = form.relation && form.name.trim() && form.phone.trim() && form.contactTime && form.region;

  if (submitted) {
    return (
      <div style={s.page}>
        <div style={s.container}>
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>{'🎉'}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: NAVY, marginBottom: 8 }}>신청이 완료됐어요!</div>
            <div style={{ fontSize: 14, color: '#555', marginBottom: 24, lineHeight: 1.6 }}>전문 상담사가 확인 후 연락드릴게요</div>
            <div style={s.summaryCard}>
              {productName && <Row label="상품" value={productName} />}
              {ticketNo && <Row label="티켓번호" value={ticketNo} />}
              {giftAmount && <Row label="사은품" value={giftAmount} />}
              <Row label="신청자" value={`${form.name} (${form.relation})`} />
              <Row label="연락처" value={form.phone} />
              <Row label="희망 상담" value={form.contactTime} />
              <Row label="설치 지역" value={form.region} />
              {form.address && <Row label="주소" value={`${form.address} ${form.addressDetail}`} />}
            </div>
            <div style={{ fontSize: 13, color: GREEN, fontWeight: 600, marginBottom: 24 }}>
              {'📞'} 1~2시간 내 상담사 연락 예정
            </div>
            <button onClick={() => navigate('/')} style={s.cta}>{'💬'} 채팅으로 돌아가기</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button onClick={() => navigate('/')} style={s.backBtn}>{'←'}</button>
        <span style={s.headerTitle}>렌탈 신청</span>
        <span style={{ width: 32 }} />
      </div>

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

        <div style={s.sectionTitle}>설치 정보</div>

        <Field label="설치 지역" required>
          <ChipGroup items={REGIONS} value={form.region} onChange={v => set('region', v)} />
        </Field>

        <Field label="설치 주소 (선택)">
          <input style={s.input} placeholder="주소를 입력하세요" value={form.address} onChange={e => set('address', e.target.value)} />
          <input style={{ ...s.input, marginTop: 8 }} placeholder="상세 주소 (동/호수)" value={form.addressDetail} onChange={e => set('addressDetail', e.target.value)} />
        </Field>

        <Field label="메모 (선택)">
          <textarea style={{ ...s.input, height: 60, padding: '12px 14px', resize: 'none' }} placeholder="추가 요청사항 (최대 100자)" maxLength={100} value={form.memo} onChange={e => set('memo', e.target.value)} />
        </Field>

        <div style={s.agreeBox}>
          <div style={{ fontSize: 11, color: '#555', lineHeight: 1.8 }}>
            <div>{'✅'} 개인정보 수집 및 이용에 동의합니다 (필수)</div>
            <div>{'✅'} 마케팅 정보 수신에 동의합니다 (필수)</div>
          </div>
        </div>
      </div>

      <div style={s.fixedBottom}>
        <button onClick={() => setSubmitted(true)} disabled={!isValid} style={{ ...s.cta, opacity: isValid ? 1 : 0.4 }}>
          신청 완료하기
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
  page: { minHeight: '100vh', background: '#f5f6fa', fontFamily: "'Noto Sans KR', -apple-system, sans-serif", paddingBottom: 80 },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: NAVY, color: '#fff', position: 'sticky', top: 0, zIndex: 10 },
  backBtn: { background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', padding: '0 8px' },
  headerTitle: { fontSize: 16, fontWeight: 700 },
  container: { padding: '16px', maxWidth: 480, margin: '0 auto' },
  productBanner: { background: '#dbeafe', border: '1px solid #bfdbfe', borderRadius: 10, padding: 14, marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 16, paddingBottom: 8, borderBottom: `2px solid ${ACCENT}` },
  label: { fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 8, display: 'block' },
  input: { width: '100%', height: 48, border: '1.5px solid #d0d0d0', borderRadius: 10, padding: '0 14px', fontSize: 14, color: '#1a1a1a', background: '#fafafa', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' },
  agreeBox: { background: '#f8f9fc', border: '1px solid #e8e8e8', borderRadius: 10, padding: 12, marginBottom: 16 },
  fixedBottom: { position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))', background: '#fff', borderTop: '1px solid #e8e8e8' },
  cta: { width: '100%', maxWidth: 480, margin: '0 auto', display: 'block', height: 52, borderRadius: 12, border: 'none', background: ACCENT, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  summaryCard: { background: '#f8f9fc', border: '1px solid #e8e8e8', borderRadius: 10, padding: 16, textAlign: 'left', marginBottom: 20 },
};
