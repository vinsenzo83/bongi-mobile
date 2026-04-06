import { useState } from 'react';
import BottomSheet from './BottomSheet.jsx';
import RentalApplySheet from './RentalApplySheet.jsx';
import UsedPhoneIntakeSheet from './UsedPhoneIntakeSheet.jsx';

export default function ConsultSheet({ open, onClose, product, category, onNavigate }) {
  const [mode, setMode] = useState(null); // null | 'call' | 'self'

  const handleClose = () => {
    setMode(null);
    onClose();
  };

  if (!open) return null;

  // 셀프가입 선택 시 → 카테고리별 개별 폼 (바텀시트)
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

  return (
    <BottomSheet open={true} onClose={handleClose} title="가입 상담">
      {mode === 'call' ? (
        /* 바로상담 화면 */
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{'📞'}</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1a2744', marginBottom: 8 }}>바로 상담</div>
          <div style={{ fontSize: 13, color: '#555', marginBottom: 20, lineHeight: 1.6 }}>
            고객센터에 전화하시면<br />상담사가 빠르게 안내해드��니다
          </div>

          {/* 티켓번호 */}
          {product?.ticket && (
            <div style={s.ticketCard}>
              <div style={{ fontSize: 11, color: '#2563eb', fontWeight: 600, marginBottom: 4 }}>{'🎫'} 티켓번호</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#1a2744', letterSpacing: 2, fontFamily: 'monospace' }}>{product.ticket}</div>
              <div style={{ fontSize: 11, color: '#d97706', marginTop: 6, fontWeight: 600 }}>
                {'⚠️'} 상담원에게 이 티켓번호를 말씀해주세요
              </div>
            </div>
          )}

          {/* 상품 정보 */}
          {product?.name && (
            <div style={s.productInfo}>
              <div style={{ fontSize: 12, color: '#999', marginBottom: 2 }}>선택 상품</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2744' }}>{product.name}</div>
              {product.gift && <div style={{ fontSize: 12, color: '#10b981', marginTop: 2 }}>{'🎁'} 사은품 {product.gift}</div>}
            </div>
          )}

          {/* 전화 버튼 */}
          <a href="tel:010-9442-8528" style={s.callBtn}>
            {'📞'} 전화 상담하기
          </a>
          <div style={{ fontSize: 11, color: '#999', marginTop: 8 }}>봉이모바일 대표번호 010-9442-8528</div>

          {/* 카카오톡 */}
          <button style={s.kakaoBtn}>
            {'💬'} 카카오톡 문의
          </button>

          <button onClick={() => setMode(null)} style={s.backBtn}>
            {'←'} 돌아가기
          </button>
        </div>
      ) : (
        /* 선택 화면 */
        <div style={{ padding: '10px 0' }}>
          {/* 상품 표시 */}
          {product?.name && (
            <div style={s.productBanner}>
              <div style={{ fontSize: 11, color: '#2563eb', fontWeight: 600 }}>{'📦'} 선택 상품</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1a2744', marginTop: 4 }}>{product.name}</div>
              {product.gift && <div style={{ fontSize: 13, color: '#d97706', marginTop: 4 }}>{'🎁'} 사은품 {product.gift}</div>}
              {product.ticket && <div style={{ fontSize: 12, color: '#2563eb', marginTop: 4, fontFamily: 'monospace' }}>{'🎫'} {product.ticket}</div>}
            </div>
          )}

          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2744', marginBottom: 14, textAlign: 'center' }}>
            어떤 방식으로 진행하시겠어요?
          </div>

          {/* 바로상담 */}
          <button onClick={() => setMode('call')} style={s.optionCard}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{'📞'}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a2744', marginBottom: 4 }}>바로 상담</div>
            <div style={{ fontSize: 12, color: '#555', lineHeight: 1.5 }}>
              고객센터에 전화해서<br />티켓번호만 말씀해주세요
            </div>
            {product?.ticket && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#2563eb', fontWeight: 600, fontFamily: 'monospace' }}>
                티켓번호: {product.ticket}
              </div>
            )}
          </button>

          {/* 셀프가입 */}
          <button onClick={() => setMode('self')} style={{ ...s.optionCard, borderColor: '#2563eb' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{'📝'}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#2563eb', marginBottom: 4 }}>셀프 신청</div>
            <div style={{ fontSize: 12, color: '#555', lineHeight: 1.5 }}>
              간단한 신청서 작성 후<br />상담사가 연락드립니다
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#10b981', fontWeight: 600 }}>
              {'⏱️'} 3분이면 완료!
            </div>
          </button>
        </div>
      )}
    </BottomSheet>
  );
}

const s = {
  productBanner: {
    background: '#dbeafe', border: '1px solid #bfdbfe', borderRadius: 10,
    padding: 14, marginBottom: 16,
  },
  ticketCard: {
    background: '#f8f9fc', border: '2px solid #2563eb', borderRadius: 12,
    padding: 20, marginBottom: 16,
  },
  productInfo: {
    background: '#f8f9fc', border: '1px solid #e8e8e8', borderRadius: 10,
    padding: 14, marginBottom: 20, textAlign: 'left',
  },
  callBtn: {
    display: 'block', width: '100%', height: 52, borderRadius: 12,
    background: '#10b981', color: '#fff', fontSize: 16, fontWeight: 700,
    textDecoration: 'none', lineHeight: '52px', textAlign: 'center',
  },
  kakaoBtn: {
    width: '100%', height: 48, borderRadius: 12, border: '1px solid #fcd34d',
    background: '#fef3c7', color: '#92400e', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit', marginTop: 10,
  },
  backBtn: {
    width: '100%', height: 44, borderRadius: 10, border: '1px solid #d0d0d0',
    background: '#fff', color: '#555', fontSize: 13, cursor: 'pointer',
    fontFamily: 'inherit', marginTop: 10,
  },
  optionCard: {
    width: '100%', padding: 20, borderRadius: 12, border: '1.5px solid #e8e8e8',
    background: '#fff', textAlign: 'center', cursor: 'pointer', marginBottom: 12,
    fontFamily: 'inherit',
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
      <div style={{ textAlign: 'center', padding: '40px 16px' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>{'🎉'}</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#1a2744', marginBottom: 8 }}>신청 완료!</div>
        <div style={{ fontSize: 13, color: '#555', marginBottom: 20 }}>상담사가 확인 후 연락드릴게요</div>
        <div style={{ background: '#f8f9fc', borderRadius: 10, padding: 14, textAlign: 'left', marginBottom: 20, fontSize: 13 }}>
          {product?.name && <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #f0f0f0' }}><span style={{color:'#999'}}>상품</span><strong>{product.name}</strong></div>}
          <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #f0f0f0' }}><span style={{color:'#999'}}>신청자</span><strong>{f.name} ({f.relation})</strong></div>
          <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #f0f0f0' }}><span style={{color:'#999'}}>연락처</span><strong>{f.phone}</strong></div>
          <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 0' }}><span style={{color:'#999'}}>계좌</span><strong>{f.bank} {f.account}</strong></div>
        </div>
        <button onClick={onComplete} style={{ width:'100%', height:48, borderRadius:12, border:'none', background:'#1a2744', color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}>{'💬'} 채팅으로 돌아가기</button>
      </div>
    );
  }

  const Chip = ({items, value, onChange}) => (
    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
      {items.map(item => (
        <button key={item} onClick={() => onChange(item)} style={{
          padding:'9px 14px', borderRadius:10, fontSize:12, cursor:'pointer', fontFamily:'inherit',
          border: value===item ? '2px solid #2563eb' : '1.5px solid #d0d0d0',
          background: value===item ? '#dbeafe' : '#fff',
          color: value===item ? '#2563eb' : '#555',
          fontWeight: value===item ? 700 : 400,
        }}>{item}</button>
      ))}
    </div>
  );

  const inp = { width:'100%', height:46, border:'1.5px solid #d0d0d0', borderRadius:10, padding:'0 14px', fontSize:14, color:'#1a1a1a', background:'#fafafa', outline:'none', fontFamily:'inherit', boxSizing:'border-box' };
  const lbl = { fontSize:12, fontWeight:600, color:'#444', marginBottom:6, display:'block' };

  return (
    <div style={{ padding: '0 16px 16px' }}>
      {/* 프로그래스 */}
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        {[1,2,3].map(n => (
          <div key={n} style={{ flex:1, textAlign:'center' }}>
            <div style={{ width:24, height:24, borderRadius:'50%', margin:'0 auto 4px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, background: n<=step ? '#2563eb' : '#e8e8e8', color: n<=step ? '#fff' : '#999' }}>{n}</div>
            <div style={{ fontSize:9, color: n===step ? '#2563eb' : '#999' }}>{n===1?'신청자':n===2?'가입정보':'사은품'}</div>
          </div>
        ))}
      </div>

      {step === 1 && <>
        <div style={{ marginBottom:14 }}><label style={lbl}>가입자와의 관계 <span style={{color:'#ef4444'}}>*</span></label><Chip items={RELATIONS} value={f.relation} onChange={v=>set('relation',v)} /></div>
        <div style={{ marginBottom:14 }}><label style={lbl}>이름 <span style={{color:'#ef4444'}}>*</span></label><input style={inp} placeholder="이름" value={f.name} onChange={e=>set('name',e.target.value)} /></div>
        <div style={{ marginBottom:14 }}><label style={lbl}>연락처 <span style={{color:'#ef4444'}}>*</span></label><input style={inp} type="tel" placeholder="010-0000-0000" value={f.phone} onChange={e=>set('phone',e.target.value)} /></div>
        <div style={{ marginBottom:14 }}><label style={lbl}>희망 상담 시간 <span style={{color:'#ef4444'}}>*</span></label><Chip items={CONTACT_TIMES} value={f.contactTime} onChange={v=>set('contactTime',v)} /></div>
      </>}

      {step === 2 && <>
        <div style={{ marginBottom:14 }}><label style={lbl}>가입 정보 <span style={{color:'#ef4444'}}>*</span></label><Chip items={SUB_TYPES} value={f.subType} onChange={v=>set('subType',v)} /></div>
        <div style={{ marginBottom:14 }}><label style={lbl}>현재 인터넷 사용 여부 <span style={{color:'#ef4444'}}>*</span></label><Chip items={['사용중','미사용']} value={f.usingNet===true?'사용중':f.usingNet===false?'미사용':''} onChange={v=>set('usingNet',v==='사용중')} /></div>
        {f.usingNet && <div style={{ marginBottom:14 }}><label style={lbl}>사용중인 통신사</label><Chip items={CARRIERS_LIST} value={f.carrier} onChange={v=>set('carrier',v)} /></div>}
        <div style={{ marginBottom:14 }}><label style={lbl}>결합 여부</label><Chip items={['결합 있음','결합 없음','모르겠음']} value={f.combine===true?'결합 있음':f.combine===false?'결합 없음':''} onChange={v=>set('combine',v==='결합 있음'?true:v==='결합 없음'?false:null)} /></div>
      </>}

      {step === 3 && <>
        <div style={{ background:'#d1fae5', border:'1px solid #6ee7b7', borderRadius:10, padding:12, marginBottom:14, fontSize:12, color:'#065f46' }}>
          {'💰'} 계약 완료 시 사은품은 현금으로 지급됩니다
          {product?.gift && <><br/>예상 사은품: <strong style={{color:'#d97706'}}>{product.gift}</strong></>}
        </div>
        <div style={{ marginBottom:14 }}><label style={lbl}>은행 선택 <span style={{color:'#ef4444'}}>*</span></label>
          <select style={{...inp, appearance:'none'}} value={f.bank} onChange={e=>set('bank',e.target.value)}>
            <option value="">은행을 선택하세요</option>
            {BANKS.map(b=><option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div style={{ marginBottom:14 }}><label style={lbl}>계좌번호 <span style={{color:'#ef4444'}}>*</span></label><input style={inp} inputMode="numeric" placeholder="계좌번호 (- 없이)" value={f.account} onChange={e=>set('account',e.target.value)} /></div>
        <div style={{ background:'#f8f9fc', border:'1px solid #e8e8e8', borderRadius:10, padding:10, marginBottom:14, fontSize:11, color:'#555', lineHeight:1.8 }}>
          <div>{'✅'} 개인정보 수집 동의 (필수)</div>
          <div>{'✅'} 마케팅 수신 동의 (필수)</div>
        </div>
      </>}

      <button onClick={() => step<3 ? setStep(step+1) : setDone(true)} disabled={!canNext} style={{
        width:'100%', height:50, borderRadius:12, border:'none',
        background:'#2563eb', color:'#fff', fontSize:15, fontWeight:700,
        cursor:'pointer', opacity: canNext?1:0.4, fontFamily:'inherit',
      }}>{step<3 ? '다음' : '신청 완료하기'}</button>

      {step > 1 && <button onClick={() => setStep(step-1)} style={{
        width:'100%', height:42, borderRadius:10, border:'1px solid #d0d0d0',
        background:'#fff', color:'#555', fontSize:13, cursor:'pointer',
        fontFamily:'inherit', marginTop:8,
      }}>{'←'} 이전</button>}
    </div>
  );
}
