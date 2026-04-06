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

  // 셀프가입 선택 시 → 카테고리별 개별 폼
  if (mode === 'self') {
    if (category === 'rental') {
      return <RentalApplySheet open={true} onClose={handleClose} product={product} />;
    }
    if (category === 'usedphone') {
      return <UsedPhoneIntakeSheet open={true} onClose={handleClose} phone={product} />;
    }
    if (category === 'internet') {
      // 인터넷은 별도 페이지로 이동
      handleClose();
      if (onNavigate) onNavigate('/apply/internet');
      return null;
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
