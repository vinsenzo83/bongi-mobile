import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const NAVY = '#1a2744';
const ACCENT = '#2563eb';
const GREEN = '#10b981';

const GRADES = [
  { key: 'A', desc: '외관 깨끗' },
  { key: 'B', desc: '미세 기스' },
  { key: 'C', desc: '눈에 보이는 기스' },
  { key: 'D', desc: '파손/깨짐' },
  { key: 'E', desc: '심각 손상' },
];
const DAMAGE_OPTIONS = ['없음', '미세기스', '화면깨짐', '기타'];

export default function ApplyUsedPhone() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [submitted, setSubmitted] = useState(false);

  const modelName = params.get('model') || localStorage.getItem('apply_model') || '';
  const storage = params.get('storage') || localStorage.getItem('apply_storage') || '';
  const estimatedPrice = params.get('price') || localStorage.getItem('apply_price') || '';

  const [form, setForm] = useState({
    name: '',
    phone: '',
    grade: '',
    damage: '',
    address: '',
    addressDetail: '',
  });

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));
  const isValid = form.name.trim() && form.phone.trim() && form.grade && form.damage && form.address.trim();

  if (submitted) {
    return (
      <div style={s.page}>
        <div style={s.container}>
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>{'🎉'}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: NAVY, marginBottom: 8 }}>접수가 완료됐어요!</div>
            <div style={{ fontSize: 14, color: '#555', marginBottom: 24, lineHeight: 1.6 }}>검수 후 최종 매입가를 안내드릴게요</div>
            <div style={s.summaryCard}>
              {modelName && <Row label="모델" value={`${modelName} ${storage}`} />}
              <Row label="셀프 등급" value={`${form.grade}등급`} />
              <Row label="파손 여부" value={form.damage} />
              {estimatedPrice && <Row label="예상 매입가" value={estimatedPrice} />}
              <Row label="신청자" value={form.name} />
              <Row label="연락처" value={form.phone} />
              <Row label="수거 주소" value={`${form.address} ${form.addressDetail}`} />
            </div>
            {/* 진행 바 */}
            <div style={{ margin: '20px 40px' }}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                {['신청완료', '검수중', '검수완료', '입금완료'].map((st, i) => (
                  <div key={st} style={{ flex: 1, height: 6, borderRadius: 3, background: i === 0 ? ACCENT : '#e8e8e8' }} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {['신청완료', '검수중', '검수완료', '입금완료'].map((st, i) => (
                  <span key={st} style={{ fontSize: 10, color: i === 0 ? ACCENT : '#999', fontWeight: i === 0 ? 700 : 400 }}>{st}</span>
                ))}
              </div>
            </div>
            <div style={{ fontSize: 13, color: GREEN, fontWeight: 600, marginBottom: 24 }}>
              {'📦'} 수거 일정 안내 문자 ��송 예정
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
        <span style={s.headerTitle}>중고폰 매입 접수</span>
        <span style={{ width: 32 }} />
      </div>

      {(modelName || estimatedPrice) && (
        <div style={s.container}>
          <div style={s.productBanner}>
            <div style={{ fontSize: 11, color: ACCENT, fontWeight: 600 }}>{'📱'} 매입 대상</div>
            {modelName && <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginTop: 2 }}>{modelName} {storage}</div>}
            {estimatedPrice && <div style={{ fontSize: 13, color: '#d97706', marginTop: 4 }}>{'💰'} 예상 매입가: {estimatedPrice}</div>}
          </div>
        </div>
      )}

      <div style={s.container}>
        <div style={s.sectionTitle}>신청자 정보</div>

        <Field label="이름" required>
          <input style={s.input} placeholder="이름을 입력하세요" value={form.name} onChange={e => set('name', e.target.value)} />
        </Field>

        <Field label="연락처" required>
          <input style={s.input} type="tel" placeholder="010-0000-0000" value={form.phone} onChange={e => set('phone', e.target.value)} />
        </Field>

        <div style={s.sectionTitle}>폰 상태</div>

        <Field label="셀프 등급 선정" required>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {GRADES.map(g => (
              <button key={g.key} onClick={() => set('grade', g.key)} style={{
                padding: '10px 14px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                border: form.grade === g.key ? `2px solid ${ACCENT}` : '1.5px solid #d0d0d0',
                background: form.grade === g.key ? '#dbeafe' : '#fff',
                color: form.grade === g.key ? ACCENT : '#555',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 56,
              }}>
                <span style={{ fontSize: 16, fontWeight: 700 }}>{g.key}</span>
                <span style={{ fontSize: 9 }}>{g.desc}</span>
              </button>
            ))}
          </div>
        </Field>

        <Field label="파손 여부" required>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {DAMAGE_OPTIONS.map(d => (
              <button key={d} onClick={() => set('damage', d)} style={{
                padding: '10px 16px', borderRadius: 10, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                border: form.damage === d ? `2px solid ${ACCENT}` : '1.5px solid #d0d0d0',
                background: form.damage === d ? '#dbeafe' : '#fff',
                color: form.damage === d ? ACCENT : '#555',
                fontWeight: form.damage === d ? 700 : 400,
              }}>{d}</button>
            ))}
          </div>
        </Field>

        <div style={s.sectionTitle}>수거 정보</div>

        <Field label="수거 주소" required>
          <input style={s.input} placeholder="주소를 입력하세요" value={form.address} onChange={e => set('address', e.target.value)} />
          <input style={{ ...s.input, marginTop: 8 }} placeholder="상세 주소 (동/호수)" value={form.addressDetail} onChange={e => set('addressDetail', e.target.value)} />
        </Field>

        <Field label="사진 첨부 (선택)">
          <div style={{ display: 'flex', gap: 8 }}>
            {['전면', '후면', '측면'].map(side => (
              <div key={side} style={{ flex: 1, height: 70, border: '1.5px dashed #d0d0d0', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#999', cursor: 'pointer', gap: 4 }}>
                <span style={{ fontSize: 18 }}>{'📷'}</span>
                <span>{side}</span>
              </div>
            ))}
          </div>
        </Field>

        <div style={{ ...s.infoBox, marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#92400e', lineHeight: 1.6 }}>
            {'⚠️'} 본인인증(PASS)이 필요합니다. 매입 확정 후 계좌번호를 별도로 수집합니다.
          </div>
        </div>

        <div style={s.agreeBox}>
          <div style={{ fontSize: 11, color: '#555', lineHeight: 1.8 }}>
            <div>{'✅'} 개인정보 수집 및 이용에 동의합니다 (필수)</div>
            <div>{'✅'} 마케팅 정보 수신에 동의합니다 (필수)</div>
          </div>
        </div>
      </div>

      <div style={s.fixedBottom}>
        <button onClick={() => setSubmitted(true)} disabled={!isValid} style={{ ...s.cta, opacity: isValid ? 1 : 0.4 }}>
          접수 신청하기
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
  infoBox: { background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 10, padding: 12 },
  agreeBox: { background: '#f8f9fc', border: '1px solid #e8e8e8', borderRadius: 10, padding: 12, marginBottom: 16 },
  fixedBottom: { position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))', background: '#fff', borderTop: '1px solid #e8e8e8' },
  cta: { width: '100%', maxWidth: 480, margin: '0 auto', display: 'block', height: 52, borderRadius: 12, border: 'none', background: ACCENT, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  summaryCard: { background: '#f8f9fc', border: '1px solid #e8e8e8', borderRadius: 10, padding: 16, textAlign: 'left', marginBottom: 20 },
};
