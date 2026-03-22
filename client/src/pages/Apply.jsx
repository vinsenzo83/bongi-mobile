import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { api } from '../utils/api.js';

const CALL_CENTER = '1600-XXXX';

/* ══════════════════════════════════════════
   공통 컴포넌트
   ══════════════════════════════════════════ */

function ProductInfo({ product, ticket }) {
  if (!product) return null;
  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div style={s.label}>선택한 상품</div>
      <h3 style={{ fontSize: 18, marginBottom: 6 }}>{product.name}</h3>
      <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
        {product.carrier && <span className="badge badge-blue" style={{ marginRight: 6 }}>{product.carrier}</span>}
        {product.brand && <span className="badge badge-blue" style={{ marginRight: 6 }}>{product.brand}</span>}
        {product.speed && <span>{product.speed} / </span>}
        {product.type && <span>{product.type} / </span>}
        {product.contract && <span>{product.contract}</span>}
        {product.data && <span>데이터 {product.data}</span>}
      </div>
      {product.monthlyPrice && (
        <div style={{ marginTop: 10 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)' }}>
            월 {(product.actualPrice || product.monthlyPrice).toLocaleString()}원
          </span>
          {product.cashback && (
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--secondary)', marginLeft: 12 }}>
              현금 {product.cashback.toLocaleString()}원
            </span>
          )}
        </div>
      )}
      <div style={{ ...s.ticketWrap, marginTop: 16 }}>
        <div style={s.ticketCode}>{ticket}</div>
      </div>
    </div>
  );
}

function NoProduct() {
  return (
    <div className="card" style={{ marginTop: 20, textAlign: 'center' }}>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>
        상품을 먼저 선택해주세요
      </p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link to="/products/internet" className="btn btn-outline" style={{ fontSize: 13 }}>인터넷+TV</Link>
        <Link to="/products/rental" className="btn btn-outline" style={{ fontSize: 13 }}>가전렌탈</Link>
        <Link to="/products/usim" className="btn btn-outline" style={{ fontSize: 13 }}>알뜰폰</Link>
        <Link to="/products/usedPhone" className="btn btn-outline" style={{ fontSize: 13 }}>중고폰</Link>
      </div>
    </div>
  );
}

function StepIndicator({ current, total, labels }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 32 }}>
      {labels.map((label, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700,
              background: i <= current ? 'var(--primary)' : 'var(--border)',
              color: i <= current ? '#fff' : 'var(--text-secondary)',
              margin: '0 auto 4px',
            }}>{i + 1}</div>
            <div style={{ fontSize: 11, color: i <= current ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: i === current ? 700 : 400 }}>{label}</div>
          </div>
          {i < labels.length - 1 && (
            <div style={{ width: 40, height: 2, background: i < current ? 'var(--primary)' : 'var(--border)', margin: '0 6px', marginBottom: 16 }} />
          )}
        </div>
      ))}
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label>{label} {required && <span style={{ color: 'var(--danger)' }}>*</span>}</label>
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════
   바로상담 (전화)
   ══════════════════════════════════════════ */

function CallPage({ product, ticket }) {
  return (
    <div className="container" style={{ maxWidth: 520 }}>
      <div style={s.callBox}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', opacity: 0.85, marginBottom: 4 }}>지금 바로 전화하세요</div>
        <a href={`tel:${CALL_CENTER.replace(/-/g, '')}`} style={s.callNum}>{CALL_CENTER}</a>
        <div style={{ fontSize: 13, color: '#fff', opacity: 0.7, marginTop: 8 }}>평일 09:00 ~ 18:00 / 토요일 10:00 ~ 15:00</div>
      </div>
      <ProductInfo product={product} ticket={ticket} />
      {!ticket && <NoProduct />}
      {ticket && (
        <div className="card" style={{ marginTop: 20, background: '#f8fafc' }}>
          <div style={s.label}>신청 방법</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[`위 상품 정보와 티켓번호를 확인하세요`, `${CALL_CENTER}로 전화해주세요`, `상담사에게 티켓번호 "${ticket}"를 말씀해주세요`, `상담사가 즉시 가입을 도와드립니다`].map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                <span style={{ fontSize: 14 }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <a href={`tel:${CALL_CENTER.replace(/-/g, '')}`} className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center', marginTop: 24, fontSize: 18 }}>
        {CALL_CENTER} 전화하기
      </a>
    </div>
  );
}

/* ══════════════════════════════════════════
   셀프가입 위자드 (아정당 스타일)
   ══════════════════════════════════════════ */

const STEPS = ['상품확인', '고객정보', '설치정보', '결제/계좌', '약관동의', '신청완료'];

const BANKS = ['국민은행', '신한은행', '우리은행', '하나은행', 'NH농협', '기업은행', 'SC제일', '카카오뱅크', '토스뱅크', '케이뱅크'];
const CARDS = ['삼성카드', '현대카드', 'KB국민카드', '신한카드', '롯데카드', '우리카드', 'NH카드', '하나카드', 'BC카드'];

function SelfPage({ product, ticket }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    // 고객정보
    customerType: 'personal',     // personal | business
    name: '',
    birthDate: '',
    gender: '',
    phone: '',
    verifyCode: '',
    verified: false,
    // 설치정보
    zipcode: '',
    address: '',
    addressDetail: '',
    installDate: '',
    installTime: '',
    ownerName: '',
    ownerPhone: '',
    // 결제
    payMethod: 'account',         // account | card
    payBank: '',
    payAccountNumber: '',
    payCardCompany: '',
    payCardNumber: '',
    payCardExpYear: '',
    payCardExpMonth: '',
    // 사은품 계좌
    giftBank: '',
    giftAccountNumber: '',
    giftAccountHolder: '',
    giftLater: false,
    // 약관
    agreeAll: false,
    agreeService: false,
    agreePrivacy: false,
    agreeMarketing: false,
    agreeThirdParty: false,
    // 메모
    memo: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);

  const u = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const next = () => setStep(s => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep(s => Math.max(s - 1, 0));

  const handleVerify = () => {
    if (!form.phone) return alert('휴대폰 번호를 입력해주세요');
    alert('인증번호가 발송되었습니다 (테스트: 123456)');
  };
  const handleVerifyCheck = () => {
    if (form.verifyCode === '123456') {
      u('verified', true);
      alert('인증 완료!');
    } else {
      alert('인증번호가 올바르지 않습니다');
    }
  };

  const handleAgreeAll = (checked) => {
    setForm(f => ({
      ...f,
      agreeAll: checked,
      agreeService: checked,
      agreePrivacy: checked,
      agreeMarketing: checked,
      agreeThirdParty: checked,
    }));
  };

  const handleSubmit = async () => {
    try {
      const data = await api.submitApplication({
        type: 'self',
        channel: 'web',
        name: form.name,
        phone: form.phone,
        productTicket: ticket,
        message: JSON.stringify({
          customerType: form.customerType,
          birthDate: form.birthDate,
          gender: form.gender,
          address: `${form.address} ${form.addressDetail}`,
          installDate: form.installDate,
          installTime: form.installTime,
          payMethod: form.payMethod,
          memo: form.memo,
        }),
      });
      setResult(data);
      setSubmitted(true);
      setStep(5);
    } catch (err) {
      alert('신청 실패: ' + err.message);
    }
  };

  // ─── Step 0: 상품확인 ───
  const Step0 = () => (
    <>
      <ProductInfo product={product} ticket={ticket} />
      {!ticket && <NoProduct />}
      {product && (
        <div className="card" style={{ marginTop: 16 }}>
          <div style={s.label}>상품 상세</div>
          <table style={{ width: '100%', fontSize: 14 }}>
            <tbody>
              {product.carrier && <tr><td style={s.td}>통신사</td><td>{product.carrier}</td></tr>}
              {product.type && <tr><td style={s.td}>유형</td><td>{product.type}</td></tr>}
              {product.speed && <tr><td style={s.td}>속도</td><td>{product.speed}</td></tr>}
              {product.contract && <tr><td style={s.td}>약정</td><td>{product.contract}</td></tr>}
              {product.monthlyPrice && <tr><td style={s.td}>월 요금</td><td>{product.monthlyPrice.toLocaleString()}원</td></tr>}
              {product.actualPrice && <tr><td style={s.td}>실납부</td><td style={{ color: 'var(--primary)', fontWeight: 700 }}>{product.actualPrice.toLocaleString()}원</td></tr>}
              {product.cashback && <tr><td style={s.td}>현금 사은품</td><td style={{ color: 'var(--secondary)', fontWeight: 700 }}>{product.cashback.toLocaleString()}원</td></tr>}
              {product.data && <tr><td style={s.td}>데이터</td><td>{product.data}</td></tr>}
              {product.brand && <tr><td style={s.td}>브랜드</td><td>{product.brand}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  );

  // ─── Step 1: 고객정보 ───
  const Step1 = () => (
    <div className="card">
      <div style={s.label}>고객 유형</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[['personal', '개인'], ['business', '개인사업자/법인']].map(([v, l]) => (
          <button key={v} type="button" onClick={() => u('customerType', v)}
            className={`btn ${form.customerType === v ? 'btn-primary' : 'btn-outline'}`} style={{ flex: 1, justifyContent: 'center' }}>
            {l}
          </button>
        ))}
      </div>

      <div style={s.label}>본인 인증</div>
      <Field label="이름" required>
        <input value={form.name} onChange={e => u('name', e.target.value)} placeholder="홍길동" />
      </Field>
      <Field label="생년월일" required>
        <input value={form.birthDate} onChange={e => u('birthDate', e.target.value)} placeholder="19900101 (8자리)" maxLength={8} />
      </Field>
      <Field label="성별" required>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['male', '남성'], ['female', '여성']].map(([v, l]) => (
            <button key={v} type="button" onClick={() => u('gender', v)}
              className={`btn ${form.gender === v ? 'btn-primary' : 'btn-outline'}`} style={{ flex: 1, justifyContent: 'center' }}>
              {l}
            </button>
          ))}
        </div>
      </Field>
      <Field label="휴대폰 번호" required>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={form.phone} onChange={e => u('phone', e.target.value)} placeholder="01012345678" style={{ flex: 1 }} />
          <button type="button" onClick={handleVerify} className="btn btn-secondary" style={{ whiteSpace: 'nowrap' }}>인증요청</button>
        </div>
      </Field>
      {!form.verified && (
        <Field label="인증번호">
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={form.verifyCode} onChange={e => u('verifyCode', e.target.value)} placeholder="6자리 입력" maxLength={6} style={{ flex: 1 }} />
            <button type="button" onClick={handleVerifyCheck} className="btn btn-outline" style={{ whiteSpace: 'nowrap' }}>확인</button>
          </div>
        </Field>
      )}
      {form.verified && (
        <div style={{ background: '#d1fae5', color: '#065f46', padding: '10px 14px', borderRadius: 8, fontSize: 14, fontWeight: 600 }}>
          본인인증 완료
        </div>
      )}
    </div>
  );

  // ─── Step 2: 설치정보 ───
  const Step2 = () => (
    <div className="card">
      <div style={s.label}>설치 주소</div>
      <Field label="우편번호" required>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={form.zipcode} onChange={e => u('zipcode', e.target.value)} placeholder="우편번호" style={{ flex: 1 }} />
          <button type="button" className="btn btn-outline" style={{ whiteSpace: 'nowrap' }}
            onClick={() => {
              if (window.daum?.Postcode) {
                new window.daum.Postcode({
                  oncomplete: (data) => {
                    setForm(f => ({ ...f, zipcode: data.zonecode, address: data.roadAddress || data.jibunAddress }));
                  }
                }).open();
              } else {
                alert('주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
              }
            }}>
            주소검색
          </button>
        </div>
      </Field>
      <Field label="주소" required>
        <input value={form.address} onChange={e => u('address', e.target.value)} placeholder="도로명 주소" />
      </Field>
      <Field label="상세주소" required>
        <input value={form.addressDetail} onChange={e => u('addressDetail', e.target.value)} placeholder="동/호수 입력" />
      </Field>

      <div style={{ ...s.label, marginTop: 24 }}>희망 설치일</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Field label="날짜">
          <input type="date" value={form.installDate} onChange={e => u('installDate', e.target.value)} />
        </Field>
        <Field label="시간대">
          <select value={form.installTime} onChange={e => u('installTime', e.target.value)}>
            <option value="">선택</option>
            <option value="09-12">오전 (09~12시)</option>
            <option value="12-15">오후1 (12~15시)</option>
            <option value="15-18">오후2 (15~18시)</option>
          </select>
        </Field>
      </div>

      <div style={{ ...s.label, marginTop: 24 }}>집주인 정보 (임차인인 경우)</div>
      <Field label="집주인 이름">
        <input value={form.ownerName} onChange={e => u('ownerName', e.target.value)} placeholder="생략 가능" />
      </Field>
      <Field label="집주인 연락처">
        <input value={form.ownerPhone} onChange={e => u('ownerPhone', e.target.value)} placeholder="생략 가능" />
      </Field>
    </div>
  );

  // ─── Step 3: 결제/계좌 ───
  const Step3 = () => (
    <div className="card">
      <div style={s.label}>요금 결제 수단</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[['account', '계좌이체'], ['card', '카드결제']].map(([v, l]) => (
          <button key={v} type="button" onClick={() => u('payMethod', v)}
            className={`btn ${form.payMethod === v ? 'btn-primary' : 'btn-outline'}`} style={{ flex: 1, justifyContent: 'center' }}>
            {l}
          </button>
        ))}
      </div>

      {form.payMethod === 'account' ? (
        <>
          <Field label="은행" required>
            <select value={form.payBank} onChange={e => u('payBank', e.target.value)}>
              <option value="">은행 선택</option>
              {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </Field>
          <Field label="계좌번호" required>
            <input value={form.payAccountNumber} onChange={e => u('payAccountNumber', e.target.value)} placeholder="- 없이 입력" />
          </Field>
        </>
      ) : (
        <>
          <Field label="카드사" required>
            <select value={form.payCardCompany} onChange={e => u('payCardCompany', e.target.value)}>
              <option value="">카드사 선택</option>
              {CARDS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="카드번호" required>
            <input value={form.payCardNumber} onChange={e => u('payCardNumber', e.target.value)} placeholder="- 없이 입력" />
          </Field>
          <div style={{ display: 'flex', gap: 8 }}>
            <Field label="유효기간 (월)">
              <select value={form.payCardExpMonth} onChange={e => u('payCardExpMonth', e.target.value)}>
                <option value="">월</option>
                {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="유효기간 (년)">
              <select value={form.payCardExpYear} onChange={e => u('payCardExpYear', e.target.value)}>
                <option value="">년</option>
                {Array.from({ length: 10 }, (_, i) => String(2025 + i)).map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </Field>
          </div>
        </>
      )}

      <div style={{ ...s.label, marginTop: 28 }}>사은품 입금 계좌</div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, cursor: 'pointer', fontSize: 14 }}>
        <input type="checkbox" checked={form.giftLater} onChange={e => u('giftLater', e.target.checked)} />
        나중에 입력하겠습니다
      </label>
      {!form.giftLater && (
        <>
          <Field label="은행" required>
            <select value={form.giftBank} onChange={e => u('giftBank', e.target.value)}>
              <option value="">은행 선택</option>
              {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </Field>
          <Field label="계좌번호" required>
            <input value={form.giftAccountNumber} onChange={e => u('giftAccountNumber', e.target.value)} placeholder="- 없이 입력" />
          </Field>
          <Field label="예금주" required>
            <input value={form.giftAccountHolder} onChange={e => u('giftAccountHolder', e.target.value)} placeholder="예금주명" />
          </Field>
        </>
      )}

      <Field label="요청사항">
        <textarea value={form.memo} onChange={e => u('memo', e.target.value)} placeholder="추가 요청사항 (선택)" rows={2} />
      </Field>
    </div>
  );

  // ─── Step 4: 약관동의 ───
  const Step4 = () => (
    <div className="card">
      <div style={s.label}>이용약관 동의</div>
      <label style={s.agreeAll}>
        <input type="checkbox" checked={form.agreeAll} onChange={e => handleAgreeAll(e.target.checked)} />
        <span style={{ fontWeight: 700, fontSize: 15 }}>전체 동의</span>
      </label>
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        {[
          ['agreeService', '[필수] 서비스 이용약관 동의', true],
          ['agreePrivacy', '[필수] 개인정보 수집 및 이용 동의', true],
          ['agreeThirdParty', '[필수] 개인정보 제3자 제공 동의', true],
          ['agreeMarketing', '[선택] 마케팅 정보 수신 동의', false],
        ].map(([key, label, required]) => (
          <label key={key} style={s.agreeItem}>
            <input type="checkbox" checked={form[key]}
              onChange={e => {
                const val = e.target.checked;
                setForm(f => {
                  const next = { ...f, [key]: val };
                  next.agreeAll = next.agreeService && next.agreePrivacy && next.agreeThirdParty && next.agreeMarketing;
                  return next;
                });
              }} />
            <span style={{ color: required ? 'var(--text)' : 'var(--text-secondary)' }}>{label}</span>
          </label>
        ))}
      </div>
    </div>
  );

  // ─── Step 5: 완료 ───
  const Step5 = () => (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
      <h2 style={{ fontSize: 26, marginBottom: 8 }}>셀프가입 신청이 완료되었습니다!</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>상담사가 확인 후 연락드리겠습니다</p>
      {result && (
        <div className="card" style={{ textAlign: 'left', maxWidth: 400, margin: '0 auto' }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>접수번호</div>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', marginBottom: 12 }}>{result.id}</div>
          <div style={{ fontSize: 14, marginBottom: 4 }}>이름: <strong>{form.name}</strong></div>
          <div style={{ fontSize: 14, marginBottom: 4 }}>연락처: <strong>{form.phone}</strong></div>
          {ticket && <div style={{ fontSize: 14 }}>상품 티켓: <strong>{ticket}</strong></div>}
        </div>
      )}
      <Link to="/" className="btn btn-primary btn-lg" style={{ marginTop: 24 }}>홈으로 돌아가기</Link>
    </div>
  );

  // ─── 유효성 검사 ───
  const canNext = () => {
    if (step === 0) return !!ticket;
    if (step === 1) return form.name && form.birthDate && form.gender && form.phone && form.verified;
    if (step === 2) return form.address && form.addressDetail;
    if (step === 3) {
      if (form.payMethod === 'account') return form.payBank && form.payAccountNumber;
      return form.payCardCompany && form.payCardNumber;
    }
    if (step === 4) return form.agreeService && form.agreePrivacy && form.agreeThirdParty;
    return true;
  };

  const steps = [Step0, Step1, Step2, Step3, Step4, Step5];
  const CurrentStep = steps[step];

  return (
    <div className="container" style={{ maxWidth: 560 }}>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <h2 style={{ fontSize: 24, marginBottom: 4 }}>셀프가입</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>정보를 입력하시면 상담사가 확인 후 가입을 처리합니다</p>
      </div>

      {step < 5 && <StepIndicator current={step} total={5} labels={STEPS.slice(0, 5)} />}

      <CurrentStep />

      {step < 5 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
          {step > 0 && (
            <button onClick={prev} className="btn btn-outline btn-lg" style={{ flex: 1, justifyContent: 'center' }}>이전</button>
          )}
          {step < 4 ? (
            <button onClick={next} disabled={!canNext()} className="btn btn-primary btn-lg"
              style={{ flex: 2, justifyContent: 'center', opacity: canNext() ? 1 : 0.5 }}>
              다음
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={!canNext()} className="btn btn-primary btn-lg"
              style={{ flex: 2, justifyContent: 'center', opacity: canNext() ? 1 : 0.5 }}>
              신청하기
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════
   메인 라우터
   ══════════════════════════════════════════ */

export default function Apply() {
  const { type } = useParams();
  const [searchParams] = useSearchParams();
  const ticket = searchParams.get('ticket') || '';
  const [product, setProduct] = useState(null);

  useEffect(() => {
    if (ticket) {
      api.getProductByTicket(ticket).then(setProduct).catch(() => setProduct(null));
    }
  }, [ticket]);

  if (type === 'ai_chat') {
    return (
      <section className="section">
        <div className="container" style={{ maxWidth: 480, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
          <h2 style={{ fontSize: 24, marginBottom: 8 }}>AI 채팅 상담</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Phase 3에서 Claude API 연동 예정</p>
          <div className="card" style={{ background: '#f1f5f9', border: '2px dashed var(--border)' }}>
            <Link to={`/apply/call${ticket ? `?ticket=${ticket}` : ''}`} className="btn btn-primary" style={{ marginTop: 8 }}>바로상담</Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      {type === 'self'
        ? <SelfPage product={product} ticket={ticket} />
        : <CallPage product={product} ticket={ticket} />
      }
    </section>
  );
}

/* ── 스타일 ── */
const s = {
  callBox: { background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)', borderRadius: 16, padding: '28px 24px', textAlign: 'center' },
  callNum: { fontSize: 36, fontWeight: 900, color: '#fff', textDecoration: 'none', letterSpacing: 2 },
  label: { fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 12 },
  ticketWrap: { textAlign: 'center', padding: '12px 0' },
  ticketCode: { display: 'inline-block', fontFamily: 'monospace', fontSize: 36, fontWeight: 800, color: 'var(--primary)', background: '#eff6ff', padding: '12px 32px', borderRadius: 12, letterSpacing: 4 },
  td: { color: 'var(--text-secondary)', paddingRight: 16, paddingBottom: 6, whiteSpace: 'nowrap' },
  agreeAll: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', marginBottom: 8, cursor: 'pointer' },
  agreeItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', cursor: 'pointer', fontSize: 14 },
};
