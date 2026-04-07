import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import SocialLoginButtons from '../components/SocialLoginButtons.jsx';

export default function Signup() {
  const [step, setStep] = useState(1); // 1: 소셜로그인, 2: 추가정보 입력
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [agreements, setAgreements] = useState({ terms: false, privacy: false, marketing: false });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const allAgreed = agreements.terms && agreements.privacy && agreements.marketing;
  const canSubmit = name.trim().length >= 2 && phone.trim().length >= 10 && allAgreed;

  const toggleAll = () => {
    const newVal = !allAgreed;
    setAgreements({ terms: newVal, privacy: newVal, marketing: newVal });
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      await signup({ name, phone, role: 'customer' });
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.page}>
      <div style={s.container}>
        <button onClick={() => navigate('/')} style={s.closeBtn}>{'✕'}</button>

        <div style={s.header}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>{'🐟'}</div>
          <h1 style={s.title}>회원가입</h1>
          <p style={s.sub}>가입하시면 포인트와 다양한 혜택을 받으실 수 있어요 {'🎁'}</p>
        </div>

        {error && <div style={s.error}>{error}</div>}

        {/* 소셜 로그인 버튼 */}
        <div style={s.card}>
          <SocialLoginButtons />
        </div>

        {/* 소셜 로그인 후 추가 입력 */}
        <div style={s.dividerWrap}>
          <hr style={s.hr} />
          <span style={s.dividerText}>소셜 로그인 후 추가 입력</span>
          <hr style={s.hr} />
        </div>

        <div style={s.card}>
          {/* 이름 */}
          <div style={s.fieldGroup}>
            <label style={s.label}>이름 <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              style={s.input}
              placeholder="이름을 입력하세요"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          {/* 전화번호 */}
          <div style={s.fieldGroup}>
            <label style={s.label}>전화번호 <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              style={s.input}
              type="tel"
              placeholder="010-0000-0000"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
          </div>

          {/* 동의 항목 */}
          <div style={s.agreeBox}>
            <div style={s.agreeTitle}>{'✅'} 동의 항목</div>

            {/* 전체 동의 */}
            <div style={s.agreeRow} onClick={toggleAll}>
              <div style={{ ...s.checkbox, ...(allAgreed ? s.checkboxOn : {}) }}>
                {allAgreed ? '✓' : ''}
              </div>
              <span style={{ fontWeight: 700 }}>전체 동의</span>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #fcd34d', margin: '8px 0' }} />

            {/* 이용약관 */}
            <div style={s.agreeRow} onClick={() => setAgreements(a => ({ ...a, terms: !a.terms }))}>
              <div style={{ ...s.checkbox, ...(agreements.terms ? s.checkboxOn : {}) }}>
                {agreements.terms ? '✓' : ''}
              </div>
              <span>이용약관 동의 <span style={{ color: '#ef4444' }}>(필수)</span></span>
            </div>

            {/* 개인정보처리방침 */}
            <div style={s.agreeRow} onClick={() => setAgreements(a => ({ ...a, privacy: !a.privacy }))}>
              <div style={{ ...s.checkbox, ...(agreements.privacy ? s.checkboxOn : {}) }}>
                {agreements.privacy ? '✓' : ''}
              </div>
              <span>개인정보처리방침 동의 <span style={{ color: '#ef4444' }}>(필수)</span></span>
            </div>

            {/* 마케팅 수신 */}
            <div style={s.agreeRow} onClick={() => setAgreements(a => ({ ...a, marketing: !a.marketing }))}>
              <div style={{ ...s.checkbox, ...(agreements.marketing ? s.checkboxActive : {}) }}>
                {agreements.marketing ? '✓' : ''}
              </div>
              <span>마케팅 수신 동의 <span style={{ color: '#ef4444' }}>(필수)</span> — 동의하시면 가입 포인트 드려요!</span>
            </div>
          </div>

          {/* 가입 버튼 */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || loading}
            style={{ ...s.submitBtn, opacity: canSubmit && !loading ? 1 : 0.4 }}
          >
            {loading ? '가입 중...' : '가입 완료하기'}
          </button>

          <div style={s.pointBanner}>
            {'🎉'} 가입 완료 즉시 <strong style={{ color: '#2563eb' }}>5,000P</strong> 적립!
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13 }}>
          이미 계정이 있으신가요? <Link to="/login" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>로그인</Link>
        </div>
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', background: '#f5f6fa', display: 'flex', justifyContent: 'center', padding: '40px 20px', fontFamily: "'Noto Sans KR', -apple-system, sans-serif" },
  container: { width: '100%', maxWidth: 400, position: 'relative' },
  closeBtn: { position: 'absolute', top: -10, right: 0, background: 'none', border: 'none', fontSize: 24, color: '#999', cursor: 'pointer' },
  header: { textAlign: 'center', marginBottom: 24 },
  title: { fontSize: 22, fontWeight: 700, color: '#1a2744', marginBottom: 6 },
  sub: { fontSize: 13, color: '#999' },
  error: { background: '#fee2e2', color: '#b91c1c', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 },
  card: { background: '#fff', border: '1px solid #e8e8e8', borderRadius: 12, padding: 24, marginBottom: 16 },
  dividerWrap: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 },
  hr: { flex: 1, border: 'none', borderTop: '1px solid #e8e8e8' },
  dividerText: { fontSize: 12, color: '#999', whiteSpace: 'nowrap' },
  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 6, display: 'block' },
  input: { width: '100%', height: 48, border: '1.5px solid #d0d0d0', borderRadius: 10, padding: '0 14px', fontSize: 14, color: '#1a1a1a', background: '#fafafa', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' },
  agreeBox: { background: '#fff9c4', border: '1px solid #fcd34d', borderRadius: 10, padding: 16, marginBottom: 20 },
  agreeTitle: { fontSize: 13, fontWeight: 700, color: '#78350f', marginBottom: 10 },
  agreeRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer', fontSize: 13, color: '#78350f' },
  checkbox: { width: 20, height: 20, borderRadius: 4, border: '2px solid #d0d0d0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'transparent', flexShrink: 0, background: '#fff' },
  checkboxOn: { background: '#d0d0d0', borderColor: '#d0d0d0', color: '#fff' },
  checkboxActive: { background: '#2563eb', borderColor: '#2563eb', color: '#fff' },
  submitBtn: { width: '100%', height: 52, borderRadius: 12, border: 'none', background: '#2563eb', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  pointBanner: { textAlign: 'center', fontSize: 13, color: '#555', marginTop: 12, padding: '10px', background: '#dbeafe', borderRadius: 8 },
};
