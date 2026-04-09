import { useState } from 'react';
import BottomSheet from './BottomSheet.jsx';
import RentalApplySheet from './RentalApplySheet.jsx';
import UsedPhoneIntakeSheet from './UsedPhoneIntakeSheet.jsx';
import { colors, fonts } from './designTokens.js';

export default function ConsultSheet({ open, onClose, product, category, onNavigate }) {
  const [mode, setMode] = useState(null); // null | 'call' | 'self'

  const handleClose = () => {
    setMode(null);
    onClose();
  };

  if (!open) return null;

  // 셀프가입 선택 시 -> 카테고리별 개별 폼 (바텀시트)
  if (mode === 'self') {
    if (category === 'rental') {
      return <RentalApplySheet open={true} onClose={handleClose} product={product} />;
    }
    if (category === 'usedphone') {
      return <UsedPhoneIntakeSheet open={true} onClose={handleClose} phone={product} />;
    }
    if (category === 'internet') {
      return (
        <BottomSheet open={true} onClose={handleClose} title="인터넷 신청" height="90vh">
          <InternetForm product={product} onComplete={handleClose} />
        </BottomSheet>
      );
    }
  }

  const ticketNo = product?.ticket || '';
  const productName = product?.name || '';
  const monthlyFee = product?.monthlyFee || '';
  const gift = product?.gift || '';
  const card = product?.card || '';

  return (
    <BottomSheet open={true} onClose={handleClose} title="">
      {mode === 'call' ? (
        /* 다이렉트 상담 상세 화면 */
        <div style={{ padding: '0 4px' }}>
          {/* 헤더 */}
          <div style={s.sheetTitle}>가입 상담</div>

          {/* 티켓 + 상품 정보 */}
          <div style={s.productInfoRow}>
            {ticketNo && (
              <span style={s.ticketBadge}>{ticketNo}</span>
            )}
            <span style={s.productNameText}>{productName}</span>
          </div>

          {/* 전화 안내 */}
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📞</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: colors.text, marginBottom: 8 }}>다이렉트 상담</div>
            <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 20, lineHeight: 1.6 }}>
              고객센터에 전화하시면<br />상담사에게 티켓번호를 말씀해주세요
            </div>

            {/* 티켓번호 강조 */}
            {ticketNo && (
              <div style={s.ticketCard}>
                <span style={s.ticketBadgeLarge}>{ticketNo}</span>
              </div>
            )}

            {/* 전화 버튼 */}
            <a href="tel:010-9442-8528" style={s.callBtn}>
              📞 전화 상담하기
            </a>
            <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 8 }}>
              봉이모바일 대표번호 010-9442-8528
            </div>
          </div>

          <button onClick={() => setMode(null)} style={s.backBtn}>
            ← 돌아가기
          </button>
        </div>
      ) : (
        /* 메인 선택 화면 (피그마 디자인) */
        <div style={{ padding: '0 4px' }}>
          {/* 제목 */}
          <div style={s.sheetTitle}>가입 상담</div>

          {/* 티켓 + 상품명 */}
          <div style={s.productInfoRow}>
            {ticketNo && (
              <span style={s.ticketBadge}>{ticketNo}</span>
            )}
            <span style={s.productNameText}>{productName}</span>
          </div>

          {/* 요금 정보 */}
          <div style={s.feeSection}>
            {monthlyFee && (
              <div style={s.feeRow}>
                <span style={s.feeLabel}>월 납부 금액</span>
                <span style={s.feeValue}>{monthlyFee}/월</span>
              </div>
            )}
            <div style={s.feeNote}>(설치비 별도 / 부가세 포함)</div>

            {card && (
              <div style={s.feeRow}>
                <span style={s.feeLabel}>제휴카드 할인 적용시</span>
                <span style={s.feeValueDanger}>{card}/월</span>
              </div>
            )}

            {gift && gift !== '-' && (
              <div style={s.feeRow}>
                <span style={{ ...s.feeLabel, color: colors.primary }}>사은품</span>
                <span style={s.feeValueGray}>최대 {gift}</span>
              </div>
            )}
          </div>

          <div style={s.divider} />

          {/* 다이렉트 상담 카드 */}
          <button onClick={() => setMode('call')} style={s.actionCard}>
            <div style={s.actionIconCircle}>
              <span style={{ fontSize: 20 }}>📞</span>
            </div>
            <div style={s.actionContent}>
              <div style={s.actionTitle}>다이렉트 상담</div>
              <div style={s.actionDesc}>
                클릭하시면 고객센터로 전화 연결 되며 상담원에게 티켓번호를 말씀 해주세요.
              </div>
              {ticketNo && (
                <span style={s.actionTicket}>{ticketNo}</span>
              )}
            </div>
            <span style={s.actionArrow}>›</span>
          </button>

          {/* 셀프 가입 카드 */}
          <button onClick={() => setMode('self')} style={{ ...s.actionCard, borderColor: colors.primary }}>
            <div style={{ ...s.actionIconCircle, background: colors.primaryLight }}>
              <span style={{ fontSize: 20 }}>📝</span>
            </div>
            <div style={s.actionContent}>
              <div style={{ ...s.actionTitle, color: colors.primary }}>셀프 가입 신청서 작성</div>
              <div style={s.actionDesc}>
                간편 신청서를 작성하시면 확인 후 상담원이 연락 드립니다.
              </div>
              <span style={s.actionBadgeYellow}>3분OK</span>
            </div>
            <span style={s.actionArrow}>›</span>
          </button>
        </div>
      )}
    </BottomSheet>
  );
}

const s = {
  sheetTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: fonts.family,
  },
  productInfoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  ticketBadge: {
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 10px',
    borderRadius: 10,
    background: colors.primary,
    color: '#fff',
    letterSpacing: 0.5,
    flexShrink: 0,
  },
  productNameText: {
    fontSize: 14,
    fontWeight: 600,
    color: colors.text,
    fontFamily: fonts.family,
  },
  feeSection: {
    marginBottom: 4,
  },
  feeRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  feeLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: fonts.family,
  },
  feeValue: {
    fontSize: 16,
    fontWeight: 700,
    color: colors.primary,
    fontFamily: fonts.family,
  },
  feeValueDanger: {
    fontSize: 16,
    fontWeight: 700,
    color: colors.danger,
    fontFamily: fonts.family,
  },
  feeValueGray: {
    fontSize: 14,
    fontWeight: 600,
    color: colors.textSecondary,
    fontFamily: fonts.family,
  },
  feeNote: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'right',
    marginBottom: 10,
    fontFamily: fonts.family,
  },
  divider: {
    height: 1,
    background: colors.border,
    margin: '12px 0 16px',
  },
  actionCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    width: '100%',
    padding: '16px 14px',
    border: `1.5px solid ${colors.border}`,
    borderRadius: 12,
    background: colors.white,
    cursor: 'pointer',
    fontFamily: fonts.family,
    textAlign: 'left',
    marginBottom: 10,
  },
  actionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: colors.surface,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  actionContent: {
    flex: 1,
    minWidth: 0,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: colors.text,
    marginBottom: 4,
  },
  actionDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 1.5,
    marginBottom: 6,
  },
  actionTicket: {
    display: 'inline-block',
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 10px',
    borderRadius: 10,
    background: colors.primary,
    color: '#fff',
    letterSpacing: 0.5,
  },
  actionBadgeYellow: {
    display: 'inline-block',
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 10px',
    borderRadius: 10,
    background: colors.yellow,
    color: colors.rentalText,
  },
  actionArrow: {
    fontSize: 22,
    color: colors.textSecondary,
    flexShrink: 0,
    lineHeight: 1,
    marginTop: 10,
  },
  ticketCard: {
    background: colors.primaryLight,
    border: `2px solid ${colors.primary}`,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    textAlign: 'center',
  },
  ticketBadgeLarge: {
    display: 'inline-block',
    fontSize: 22,
    fontWeight: 800,
    padding: '6px 20px',
    borderRadius: 12,
    background: colors.primary,
    color: '#fff',
    letterSpacing: 2,
    fontFamily: 'monospace',
  },
  callBtn: {
    display: 'block',
    width: '100%',
    height: 52,
    borderRadius: 12,
    background: colors.primary,
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    textDecoration: 'none',
    lineHeight: '52px',
    textAlign: 'center',
    fontFamily: fonts.family,
  },
  backBtn: {
    width: '100%',
    height: 44,
    borderRadius: 10,
    border: `1px solid ${colors.border}`,
    background: colors.white,
    color: colors.textSecondary,
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: fonts.family,
    marginTop: 10,
  },
};

// ─── 인터넷 신청 폼 (바텀시트용) ───
const RELATIONS = ['본인', '배우자', '자녀', '부모', '기타'];
const CONTACT_TIMES = ['오전 (9~12시)', '오후 (12~18시)', '저녁 (18~21시)', '상관없음'];
const SUB_TYPES = ['개인', '개인사업자', '법인사업자', '외국인'];
const CARRIERS_LIST = ['SKT', 'KT', 'LG U+', '기타'];
const BANKS = ['국민은행','신한은행','우리은행','하나은행','농협','카카오뱅크','토스뱅크','기업은행','기타'];

function InternetForm({ product, onComplete }) {
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [f, setF] = useState({ relation:'', name:'', phone:'', contactTime:'', subType:'', usingNet:null, carrier:'', combine:null, bank:'', account:'' });
  const set = (k,v) => setF(p => ({...p,[k]:v}));

  const canNext = step === 1 ? f.relation && f.name && f.phone && f.contactTime
    : step === 2 ? f.subType && f.usingNet !== null
    : f.bank && f.account;

  if (done) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 16px', fontFamily: fonts.family }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: colors.text, marginBottom: 8 }}>신청 완료!</div>
        <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 20 }}>상담사가 확인 후 연락드릴게요</div>
        <div style={{ background: colors.surface, borderRadius: 10, padding: 14, textAlign: 'left', marginBottom: 20, fontSize: 13 }}>
          {product?.name && <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:`1px solid ${colors.border}` }}><span style={{color: colors.textSecondary}}>상품</span><strong>{product.name}</strong></div>}
          <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:`1px solid ${colors.border}` }}><span style={{color: colors.textSecondary}}>신청자</span><strong>{f.name} ({f.relation})</strong></div>
          <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:`1px solid ${colors.border}` }}><span style={{color: colors.textSecondary}}>연락처</span><strong>{f.phone}</strong></div>
          <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 0' }}><span style={{color: colors.textSecondary}}>계좌</span><strong>{f.bank} {f.account}</strong></div>
        </div>
        <button onClick={onComplete} style={{ width:'100%', height:48, borderRadius:12, border:'none', background: colors.primary, color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer', fontFamily: fonts.family }}>💬 채팅으로 돌아가기</button>
      </div>
    );
  }

  const Chip = ({items, value, onChange}) => (
    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
      {items.map(item => (
        <button key={item} onClick={() => onChange(item)} style={{
          padding:'9px 14px', borderRadius:10, fontSize:12, cursor:'pointer', fontFamily: fonts.family,
          border: value===item ? `2px solid ${colors.primary}` : `1.5px solid ${colors.border}`,
          background: value===item ? colors.primaryLight : colors.white,
          color: value===item ? colors.primary : colors.textSecondary,
          fontWeight: value===item ? 700 : 400,
        }}>{item}</button>
      ))}
    </div>
  );

  const inp = { width:'100%', height:46, border:`1.5px solid ${colors.border}`, borderRadius:10, padding:'0 14px', fontSize:14, color: colors.text, background: colors.surface, outline:'none', fontFamily: fonts.family, boxSizing:'border-box' };
  const lbl = { fontSize:12, fontWeight:600, color: colors.text, marginBottom:6, display:'block', fontFamily: fonts.family };

  return (
    <div style={{ padding: '0 16px 16px', fontFamily: fonts.family }}>
      {/* 프로그래스 */}
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        {[1,2,3].map(n => (
          <div key={n} style={{ flex:1, textAlign:'center' }}>
            <div style={{ width:24, height:24, borderRadius:'50%', margin:'0 auto 4px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, background: n<=step ? colors.primary : colors.border, color: n<=step ? '#fff' : colors.textSecondary }}>{n}</div>
            <div style={{ fontSize:9, color: n===step ? colors.primary : colors.textSecondary }}>{n===1?'신청자':n===2?'가입정보':'사은품'}</div>
          </div>
        ))}
      </div>

      {step === 1 && <>
        <div style={{ marginBottom:14 }}><label style={lbl}>가입자와의 관계 <span style={{color: colors.danger}}>*</span></label><Chip items={RELATIONS} value={f.relation} onChange={v=>set('relation',v)} /></div>
        <div style={{ marginBottom:14 }}><label style={lbl}>이름 <span style={{color: colors.danger}}>*</span></label><input style={inp} placeholder="이름" value={f.name} onChange={e=>set('name',e.target.value)} /></div>
        <div style={{ marginBottom:14 }}><label style={lbl}>연락처 <span style={{color: colors.danger}}>*</span></label><input style={inp} type="tel" placeholder="010-0000-0000" value={f.phone} onChange={e=>set('phone',e.target.value)} /></div>
        <div style={{ marginBottom:14 }}><label style={lbl}>희망 상담 시간 <span style={{color: colors.danger}}>*</span></label><Chip items={CONTACT_TIMES} value={f.contactTime} onChange={v=>set('contactTime',v)} /></div>
      </>}

      {step === 2 && <>
        <div style={{ marginBottom:14 }}><label style={lbl}>가입 정보 <span style={{color: colors.danger}}>*</span></label><Chip items={SUB_TYPES} value={f.subType} onChange={v=>set('subType',v)} /></div>
        <div style={{ marginBottom:14 }}><label style={lbl}>현재 인터넷 사용 여부 <span style={{color: colors.danger}}>*</span></label><Chip items={['사용중','미사용']} value={f.usingNet===true?'사용중':f.usingNet===false?'미사용':''} onChange={v=>set('usingNet',v==='사용중')} /></div>
        {f.usingNet && <div style={{ marginBottom:14 }}><label style={lbl}>사용중인 통신사</label><Chip items={CARRIERS_LIST} value={f.carrier} onChange={v=>set('carrier',v)} /></div>}
        <div style={{ marginBottom:14 }}><label style={lbl}>결합 여부</label><Chip items={['결합 있음','결합 없음','모르겠음']} value={f.combine===true?'결합 있음':f.combine===false?'결합 없음':''} onChange={v=>set('combine',v==='결합 있음'?true:v==='결합 없음'?false:null)} /></div>
      </>}

      {step === 3 && <>
        <div style={{ background: colors.primaryLight, border:`1px solid ${colors.primary}`, borderRadius:10, padding:12, marginBottom:14, fontSize:12, color: colors.primary }}>
          💰 계약 완료 시 사은품은 현금으로 지급됩니다
          {product?.gift && <><br/>예상 사은품: <strong style={{color: colors.danger}}>{product.gift}</strong></>}
        </div>
        <div style={{ marginBottom:14 }}><label style={lbl}>은행 선택 <span style={{color: colors.danger}}>*</span></label>
          <select style={{...inp, appearance:'none'}} value={f.bank} onChange={e=>set('bank',e.target.value)}>
            <option value="">은행을 선택하세요</option>
            {BANKS.map(b=><option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div style={{ marginBottom:14 }}><label style={lbl}>계좌번호 <span style={{color: colors.danger}}>*</span></label><input style={inp} inputMode="numeric" placeholder="계좌번호 (- 없이)" value={f.account} onChange={e=>set('account',e.target.value)} /></div>
        <div style={{ background: colors.surface, border:`1px solid ${colors.border}`, borderRadius:10, padding:10, marginBottom:14, fontSize:11, color: colors.textSecondary, lineHeight:1.8 }}>
          <div>✅ 개인정보 수집 동의 (필수)</div>
          <div>✅ 마케팅 수신 동의 (필수)</div>
        </div>
      </>}

      <button onClick={() => step<3 ? setStep(step+1) : setDone(true)} disabled={!canNext} style={{
        width:'100%', height:50, borderRadius:12, border:'none',
        background: colors.primary, color:'#fff', fontSize:15, fontWeight:700,
        cursor:'pointer', opacity: canNext?1:0.4, fontFamily: fonts.family,
      }}>{step<3 ? '다음' : '신청 완료하기'}</button>

      {step > 1 && <button onClick={() => setStep(step-1)} style={{
        width:'100%', height:42, borderRadius:10, border:`1px solid ${colors.border}`,
        background: colors.white, color: colors.textSecondary, fontSize:13, cursor:'pointer',
        fontFamily: fonts.family, marginTop:8,
      }}>← 이전</button>}
    </div>
  );
}
