// V5 인센티브 — 계약 편집 모달
// vanilla openEditModal()의 완전한 React 변환
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import DOMPurify from 'dompurify';

const STATUS_LABEL = { pending: '계약대기', in_progress: '계약진행', completed: '계약완료', cancelled: '계약취소' };
const BANKS = ['국민은행', '신한은행', '우리은행', '하나은행', 'NH농협은행', 'IBK기업은행', 'SC제일은행', '카카오뱅크', '토스뱅크', '케이뱅크', '광주은행', '전북은행', '새마을금고', '신협', '우체국', '수협은행', '부산은행', '경남은행', '대구은행', '제주은행', '산업은행', 'KDB산업', '외환은행'];
const INSTALL_TIMES = ['오전 9~10시', '오전 10~11시', '오전 11~12시', '오후 12~13시', '오후 13~14시', '오후 14~15시', '오후 15~16시', '오후 16~17시', '오후 17~18시', '협의'];

// HTML escape 복원 — 서버 sanitize가 &lt;/&quot;로 인코딩한 것을 복원
function unescapeHtml(s) {
  if (!s || typeof s !== 'string') return s;
  let out = s, prev = null;
  while (out !== prev && /&(lt|gt|quot|amp|#39);/.test(out)) {
    prev = out;
    out = out
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');
  }
  return out;
}

function fmtDate(v) {
  return v ? new Date(v).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
}

function openDaumPostcode(onComplete) {
  if (!window.daum || !window.daum.Postcode) {
    alert('주소 검색 API 로드 중. 잠시 후 다시 시도하세요.');
    return;
  }
  new window.daum.Postcode({
    oncomplete: (data) => {
      const fullAddr = data.address + (data.buildingName ? ' (' + data.buildingName + ')' : '');
      onComplete(fullAddr);
    },
    width: '100%',
    height: '100%',
  }).open();
}

export default function ContractEditModal({ contract, onClose, onSave, fetchQuote }) {
  // 모든 편집 필드를 state로
  const [form, setForm] = useState(() => ({
    customer_name: contract.customer_name || '',
    customer_phone: contract.customer_phone || '',
    resident_id: contract.resident_id || '',
    customer_address: contract.customer_address || '',
    customer_address_detail: contract.customer_address_detail || '',
    installation_date: contract.installation_date || '',
    installation_time: contract.installation_time || '',
    gift_received: contract.gift_received || '',
    add_payback: contract.add_payback || 0,
    bank_account_holder: contract.bank_account_holder || '',
    bank_name: contract.bank_name || '',
    bank_account_number: contract.bank_account_number || '',
    status: contract.status || 'pending',
    activation_date: contract.activation_date || '',
    cancellation_reason: contract.cancellation_reason || '',
    contract_notes: contract.contract_notes || '',
  }));

  const [quoteHtml, setQuoteHtml] = useState(() => unescapeHtml(contract.quote_full_html));
  const [quoteSummary, setQuoteSummary] = useState(() => unescapeHtml(contract.quote_summary));
  const [quoteFetched, setQuoteFetched] = useState(!!contract.quote_full_html);
  const [saving, setSaving] = useState(false);
  const addrInputRef = useRef(null);

  const c = contract;
  const p = c.product || {};
  const a = c.agent || {};
  const hasAddr = !!(form.customer_address && form.customer_address.trim());

  // Esc to close
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // body scroll lock
  useEffect(() => {
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = orig; };
  }, []);

  // 견적서 lazy fetch
  useEffect(() => {
    if (quoteFetched || quoteHtml) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchQuote(contract.id);
        if (cancelled) return;
        if (data) {
          setQuoteHtml(unescapeHtml(data.quote_full_html));
          setQuoteSummary(unescapeHtml(data.quote_summary));
        }
        setQuoteFetched(true);
      } catch { setQuoteFetched(true); }
    })();
    return () => { cancelled = true; };
  }, [contract.id, fetchQuote, quoteFetched, quoteHtml]);

  // sanitized quote html
  const safeQuoteHtml = useMemo(() => {
    if (!quoteHtml) return null;
    return DOMPurify.sanitize(quoteHtml, {
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onsubmit'],
    });
  }, [quoteHtml]);

  const setField = (k) => (e) => {
    const val = e?.target ? e.target.value : e;
    setForm(prev => ({ ...prev, [k]: val }));
  };

  const submit = async () => {
    const payload = { ...form };
    payload.add_payback = parseInt(payload.add_payback) || 0;
    if (payload.add_payback < 0 || payload.add_payback > 50000) {
      alert('추가 페이백은 0~50,000원 범위'); return;
    }
    // null 처리 (빈 문자열 → null)
    Object.keys(payload).forEach(k => {
      if (k === 'add_payback') return;
      if (typeof payload[k] === 'string' && payload[k].trim() === '') payload[k] = null;
    });
    setSaving(true);
    try {
      await onSave(contract.id, payload);
    } catch (e) {
      alert('오류: ' + e.message);
    } finally { setSaving(false); }
  };

  const tierBadge = p.tier
    ? <span style={tierStyle(p.tier)}>{p.tier}</span>
    : null;
  const premBadge = p.is_premium ? <span style={{ background: '#dc2626', color: '#fff', padding: '1px 5px', borderRadius: 3, fontSize: 8, marginLeft: 3, fontWeight: 800 }}>우수</span> : null;

  return (
    <div onClick={(e) => { if (e.currentTarget === e.target) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '30px 20px', overflowY: 'auto' }}>
      <div style={{ background: 'linear-gradient(135deg,#1e293b,#0f172a)', border: '1.5px solid #475569', borderRadius: 14, maxWidth: 1100, width: '95%', boxShadow: '0 20px 60px rgba(0,0,0,0.6)', position: 'relative' }}>
        {/* 헤더 */}
        <div style={{ position: 'sticky', top: 0, background: 'linear-gradient(135deg,#1e293b,#0f172a)', borderBottom: '2px solid #475569', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '14px 14px 0 0', zIndex: 1 }}>
          <div>
            <div style={{ fontSize: 14, color: '#60a5fa', fontWeight: 800 }}>📝 계약 상세 정보 입력 / 수정</div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
              {c.contract_date || '-'} · {a.name || '?'} ({a.center || ''}) · ID {(c.id || '').slice(0, 8)}...
            </div>
          </div>
          <button onClick={onClose} style={{ background: '#475569', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>✕ 닫기 (Esc)</button>
        </div>

        {/* 바디 */}
        <div style={{ padding: '24px 30px', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', background: '#0a0f1c' }}>
          {/* 📦 계약 상품 정보 */}
          <SecCard color="#fbbf24" title="계약 상품 정보" icon="📦">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, padding: '14px 18px', background: 'rgba(0,0,0,0.25)', border: '1px solid #334155', borderRadius: 8, marginBottom: 14 }}>
              <div style={{ flex: 1, minWidth: 280 }}>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4, letterSpacing: '0.02em' }}>
                  [{p.carrier || '-'}] {p.type || '-'} · {p.speed || '-'} · TV {p.tv_tier || '없음'}
                </div>
                <div style={{ fontSize: 17, color: '#f8fafc', fontWeight: 900, letterSpacing: '-0.01em' }}>{p.name || '-'}</div>
                <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>{p.point_weight || '-'}P</span>
                  {tierBadge}{premBadge}
                  <span style={{ color: '#64748b' }}>·</span>
                  <span>📅 {c.contract_date}</span>
                  <span style={{ color: '#64748b' }}>·</span>
                  <span>👤 {a.name || '-'} <span style={{ color: '#94a3b8' }}>{a.center || ''}</span></span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
                <div style={{ textAlign: 'right', borderRight: '1px solid #334155', paddingRight: 18 }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>💵 월 요금</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#60a5fa', letterSpacing: '-0.02em' }}>
                    {(c.monthly_fee != null && !isNaN(c.monthly_fee)) ? Number(c.monthly_fee).toLocaleString() : '-'}
                    <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, marginLeft: 2 }}>원</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>💰 페이백</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#fca5a5', letterSpacing: '-0.02em' }}>
                    {(p.payback || 0).toLocaleString()}
                    <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, marginLeft: 2 }}>원</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '18px 20px' }}>
              <div style={{ fontSize: 11, color: '#fbbf24', fontWeight: 800, marginBottom: 12, letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 8, borderBottom: '1px dashed #334155' }}>
                🧮 상담사 견적서 {safeQuoteHtml ? '(TM 계산기 결과)' : ''}
              </div>
              {!quoteFetched && <div style={{ color: '#94a3b8', fontSize: 11, padding: 8 }}>불러오는 중...</div>}
              {quoteFetched && safeQuoteHtml && <div dangerouslySetInnerHTML={{ __html: safeQuoteHtml }} />}
              {quoteFetched && !safeQuoteHtml && quoteSummary && (
                <pre style={{ margin: 0, background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: '12px 14px', fontSize: 12, color: '#e2e8f0', whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.6 }}>{quoteSummary}</pre>
              )}
              {quoteFetched && !safeQuoteHtml && !quoteSummary && (
                <div style={{ padding: 24, background: 'rgba(0,0,0,0.25)', border: '1.5px dashed #475569', borderRadius: 8, color: '#94a3b8', fontSize: 12, textAlign: 'center' }}>
                  ⚠️ 상담사가 견적서를 등록하지 않았습니다.
                </div>
              )}
            </div>
          </SecCard>

          {/* 👤 고객 정보 */}
          <SecCard color="#60a5fa" title="고객 정보" icon="👤">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <Field label="이름" required>
                <Input value={form.customer_name} onChange={setField('customer_name')} placeholder="홍길동" />
              </Field>
              <Field label="전화번호" required>
                <Input value={form.customer_phone} onChange={setField('customer_phone')} placeholder="010-1234-5678" />
              </Field>
              <Field label="주민번호">
                <Input value={form.resident_id} onChange={setField('resident_id')} placeholder="000000-0000000" style={{ letterSpacing: '0.04em' }} />
              </Field>
            </div>
            <div style={{ marginTop: 14 }}>
              <Field label="📍 설치 주소 (기본)" required hint="📍 우편번호 검색으로 자동 입력">
                <div style={{ display: 'flex', gap: 8 }}>
                  <Input
                    ref={addrInputRef}
                    value={form.customer_address}
                    onChange={setField('customer_address')}
                    placeholder="주소 검색 또는 직접 입력"
                    readOnly
                    style={{ borderColor: hasAddr ? '#475569' : '#dc2626', flex: 1 }}
                  />
                  <button type="button" onClick={() => openDaumPostcode((addr) => setForm(f => ({ ...f, customer_address: addr })))}
                    style={{ padding: '0 18px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}>🔍 주소 검색</button>
                </div>
              </Field>
            </div>
            <div style={{ marginTop: 14 }}>
              <Field label="🏠 상세 주소 (동·호수·층)" required hint="⚠️ 설치 기사 방문에 필수 — 정확하게 입력">
                <Input value={form.customer_address_detail} onChange={setField('customer_address_detail')} placeholder="예: 101동 502호, 3층 사무실, 지하 1층 카페 옆" />
              </Field>
            </div>
          </SecCard>

          {/* 📅 설치·사은품·페이백 */}
          <SecCard color="#22c55e" title="설치 · 사은품 · 페이백" icon="📅">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 14 }}>
              <Field label="📅 설치 희망일 (달력)">
                <Input type="date" value={form.installation_date || ''} onChange={setField('installation_date')} />
              </Field>
              <Field label="⏰ 설치 시간">
                <Select value={form.installation_time} onChange={setField('installation_time')}>
                  <option value="">— 선택 —</option>
                  {INSTALL_TIMES.map(t => <option key={t} value={t}>{t === '협의' ? '고객과 협의' : t}</option>)}
                </Select>
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
              <Field label="🎁 실제 사은품">
                <Input value={form.gift_received} onChange={setField('gift_received')} placeholder="예: 현금 30만 / 다이슨 / 가전렌탈" />
              </Field>
              <Field label="💰 추가 페이백 (₩)" hint="회사 ≤30,000 / 상담사 차감 30,001~50K">
                <Input type="number" min="0" max="50000" step="1000" value={form.add_payback} onChange={setField('add_payback')} />
              </Field>
            </div>
          </SecCard>

          {/* 🏦 입금 정보 */}
          <SecCard color="#22d3ee" title="사은품/페이백 입금 정보" icon="🏦" hint="💡 현금 페이백 입금 시 사용. 사은품이 현금이 아니면 비워두세요.">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 16 }}>
              <Field label="예금주">
                <Input value={form.bank_account_holder} onChange={setField('bank_account_holder')} placeholder="홍길동" />
              </Field>
              <Field label="은행">
                <Select value={form.bank_name} onChange={setField('bank_name')}>
                  <option value="">— 선택 —</option>
                  {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                </Select>
              </Field>
              <Field label="계좌번호">
                <Input value={form.bank_account_number} onChange={setField('bank_account_number')} placeholder="000-0000-0000-00 (- 자유 입력)"
                  style={{ letterSpacing: '0.04em', fontFamily: "'SF Mono',Monaco,monospace" }} />
              </Field>
            </div>
          </SecCard>

          {/* 🚦 계약 진행 상태 */}
          <SecCard color="#a78bfa" title="계약 진행 상태" icon="🚦">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <Field label="상태" hint="⚠️ 계약대기/진행/취소는 정산 제외">
                <Select value={form.status} onChange={setField('status')} style={{ borderColor: '#a78bfa', fontWeight: 700 }}>
                  <option value="pending">⏰ 계약대기</option>
                  <option value="in_progress">🚧 계약진행</option>
                  <option value="completed">✅ 계약완료</option>
                  <option value="cancelled">❌ 계약취소</option>
                </Select>
              </Field>
              <Field label="📡 개통완료일" hint="실제 개통이 완료된 날짜">
                <Input type="date" value={form.activation_date || ''} onChange={setField('activation_date')} />
              </Field>
              <Field label="취소 사유 (cancelled일 때)">
                <Input value={form.cancellation_reason} onChange={setField('cancellation_reason')} placeholder="고객 변심 / 설치 불가 / 기타" />
              </Field>
            </div>

            {/* 상태 변경 이력 */}
            <div style={{ marginTop: 14, padding: '12px 14px', background: 'rgba(0,0,0,0.25)', border: '1px solid #334155', borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', marginBottom: 10, letterSpacing: '0.04em' }}>📅 상태 변경 이력</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, fontSize: 11 }}>
                {[
                  { label: '⏰ 계약대기', field: 'contract_pending_at',     color: '#fbbf24' },
                  { label: '🚧 계약진행', field: 'contract_in_progress_at', color: '#60a5fa' },
                  { label: '✅ 계약완료', field: 'contract_completed_at',   color: '#22c55e' },
                  { label: '❌ 계약취소', field: 'contract_cancelled_at',   color: '#dc2626' },
                ].map(s => {
                  const t = c[s.field];
                  return (
                    <div key={s.field} style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${t ? s.color : '#334155'}`, borderRadius: 6, padding: '8px 10px', opacity: t ? 1 : 0.4 }}>
                      <div style={{ color: t ? s.color : '#64748b', fontWeight: 700, fontSize: 10.5, marginBottom: 4 }}>{s.label}</div>
                      <div style={{ color: t ? '#e2e8f0' : '#475569', fontSize: 11 }}>{fmtDate(t) || '미발생'}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed #334155', display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: '#94a3b8' }}>
                <span>📌 영업 등록: <b style={{ color: '#cbd5e1' }}>{fmtDate(c.created_at) || '-'}</b></span>
                <span>💾 마지막 변경: <b style={{ color: '#cbd5e1' }}>{fmtDate(c.updated_at) || '-'}</b></span>
              </div>
            </div>
          </SecCard>

          {/* 📝 메모 (TM 메모 read-only / 계약부서 메모 editable) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <SecCard color="#fbbf24" title="TM 상담 메모" icon="📞" extra={<span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>읽기 전용</span>} noMb>
              {c.notes
                ? <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, padding: '12px 14px', fontSize: 13, color: '#e2e8f0', whiteSpace: 'pre-wrap', lineHeight: 1.6, minHeight: 90 }}>{c.notes}</div>
                : <div style={{ padding: 24, color: '#64748b', fontSize: 12, textAlign: 'center', background: 'rgba(0,0,0,0.25)', border: '1px dashed #475569', borderRadius: 6, minHeight: 90, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>상담사가 작성한 메모 없음</div>}
            </SecCard>
            <SecCard color="#60a5fa" title="계약부서 메모" icon="📋" extra={<span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>편집 가능</span>} noMb>
              <Textarea rows={5} value={form.contract_notes} onChange={setField('contract_notes')} placeholder="신분증 수령 여부, 계좌번호, 설치 일정 협의 결과, 고객 변심 사유 등" />
            </SecCard>
          </div>
        </div>

        {/* 푸터 */}
        <div style={{ position: 'sticky', bottom: 0, background: 'linear-gradient(135deg,#1e293b,#0f172a)', borderTop: '1.5px solid #475569', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '0 0 14px 14px' }}>
          <div style={{ fontSize: 9.5, color: '#64748b' }}>
            상태 <span style={statusInlineStyle(c.status)}>{STATUS_LABEL[c.status] || c.status}</span> · 계약일 {c.contract_date}
          </div>
          <button onClick={submit} disabled={saving} style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '8px 22px', borderRadius: 4, cursor: saving ? 'wait' : 'pointer', fontSize: 12, fontWeight: 700 }}>
            {saving ? '저장 중...' : '💾 모든 변경사항 저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 헬퍼 컴포넌트 ───
function SecCard({ color, title, icon, children, hint, extra, noMb }) {
  return (
    <div style={{ background: 'linear-gradient(180deg, rgba(30,41,59,0.5), rgba(15,23,42,0.6))', border: '1px solid #334155', borderLeft: `4px solid ${color}`, borderRadius: 10, padding: '18px 22px', marginBottom: noMb ? 0 : 16 }}>
      <div style={{ fontSize: 13.5, fontWeight: 800, color: '#f1f5f9', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', gap: 10, letterSpacing: '0.02em' }}>
        <span style={{ fontSize: 18, color }}>{icon}</span>
        <span>{title}</span>
        {extra && <span style={{ marginLeft: 'auto' }}>{extra}</span>}
      </div>
      {children}
      {hint && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 10, lineHeight: 1.5 }}>{hint}</div>}
    </div>
  );
}

function Field({ label, required, hint, children }) {
  return (
    <div>
      <label style={{ fontSize: 11.5, fontWeight: 700, color: '#cbd5e1', marginBottom: 4, display: 'block' }}>
        {label}{required && <span style={{ color: '#dc2626' }}> *</span>}
      </label>
      {children}
      {hint && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 5, lineHeight: 1.5 }}>{hint}</div>}
    </div>
  );
}

const detailInputStyle = {
  background: '#0f172a',
  border: '1.5px solid #475569',
  color: '#f8fafc',
  padding: '10px 14px',
  borderRadius: 8,
  fontSize: 14,
  marginTop: 5,
  width: '100%',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  colorScheme: 'dark',
};

const Input = forwardRef(function Input({ style, ...rest }, ref) {
  return <input ref={ref} style={{ ...detailInputStyle, ...style }} {...rest} />;
});
function Select({ style, children, ...rest }) {
  return <select style={{ ...detailInputStyle, ...style }} {...rest}>{children}</select>;
}
function Textarea({ style, ...rest }) {
  return <textarea style={{ ...detailInputStyle, resize: 'vertical', ...style }} {...rest} />;
}

function tierStyle(t) {
  const m = { S: { bg: '#fbbf24', c: '#78350f' }, A: { bg: '#60a5fa', c: '#1e3a8a' }, B: { bg: '#94a3b8', c: '#0f172a' }, C: { bg: '#475569', c: '#cbd5e1' } };
  const s = m[t] || m.B;
  return { display: 'inline-block', padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 800, background: s.bg, color: s.c };
}

function statusInlineStyle(s) {
  const m = { completed: '#16a34a', pending: '#f59e0b', in_progress: '#3b82f6', cancelled: '#dc2626' };
  return { background: m[s] || '#475569', color: '#fff', padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 800 };
}
