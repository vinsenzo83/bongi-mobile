import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const NAVY = '#1a2744';
const ACCENT = '#2563eb';

export default function RentalDetail() {
  const { ticket } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imgIdx, setImgIdx] = useState(0);

  useEffect(() => {
    fetch('/api/rental/' + ticket)
      .then(r => r.json())
      .then(d => { setProduct(d); setLoading(false); })
      .catch(() => {
        // API 없으면 직접 JSON에서 찾기
        fetch('/api/products')
          .then(r => r.json())
          .catch(() => null);
        setLoading(false);
      });
  }, [ticket]);

  if (loading) return <div style={s.page}><div style={s.container}><div style={{ textAlign: 'center', padding: 60, color: '#999' }}>로딩 중...</div></div></div>;
  if (!product) return <div style={s.page}><div style={s.container}><div style={{ textAlign: 'center', padding: 60, color: '#999' }}>상품을 찾을 수 없습니다</div></div></div>;

  const images = [product.image, product.image2, product.image3].filter(Boolean);
  const hasCard = product.card_name && product.card_name !== '해당없음' && product.card_name !== '';

  return (
    <div style={s.page}>
      {/* 헤더 */}
      <div style={s.header}>
        <button onClick={() => navigate(-1)} style={s.backBtn}>{'←'}</button>
        <span style={s.headerTitle}>{product.name}</span>
        <span style={{ width: 32 }} />
      </div>

      <div style={s.container}>
        {/* 이미지 */}
        {images.length > 0 && (
          <div style={s.imageWrap}>
            <img src={images[imgIdx]} alt={product.name} style={s.image} />
            {images.length > 1 && (
              <div style={s.imageDots}>
                {images.map((_, i) => (
                  <div key={i} onClick={() => setImgIdx(i)} style={{ width: 8, height: 8, borderRadius: '50%', background: i === imgIdx ? ACCENT : '#d0d0d0', cursor: 'pointer' }} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* 상품 기본 정보 */}
        <div style={s.section}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <span style={s.badge}>{product.category}</span>
            <span style={{ ...s.badge, background: '#f3f4f6', color: '#555' }}>{product.brand}</span>
            {product.ticket && <span style={{ ...s.badge, background: '#dbeafe', color: ACCENT, fontFamily: 'monospace' }}>{product.ticket}</span>}
          </div>
          <h1 style={s.productName}>{product.name}</h1>
          {product.model_number && <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>모델번호: {product.model_number}</div>}
        </div>

        {/* 가격 */}
        <div style={s.priceCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: 12, color: '#999' }}>월 렌탈료</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: NAVY }}>{product.monthly_fee}<span style={{ fontSize: 14 }}>원</span></div>
            </div>
            {product.normal_fee > 0 && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: '#999', textDecoration: 'line-through' }}>정상가 {typeof product.normal_fee === 'number' ? product.normal_fee.toLocaleString() : product.normal_fee}원</div>
                <div style={{ fontSize: 13, color: '#10b981', fontWeight: 700 }}>
                  {product.normal_fee && product.monthly_fee ? Math.round((1 - (typeof product.monthly_fee === 'string' ? parseInt(product.monthly_fee.replace(/,/g, '')) : product.monthly_fee) / product.normal_fee) * 100) : 0}% 할인
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 카드 할인 */}
        {hasCard && (
          <div style={s.cardSection}>
            <div style={s.sectionTitle}>{'💳'} 제휴카드 할인</div>
            <div style={s.infoRow}><span>제휴카드</span><strong style={{ color: ACCENT }}>{product.card_name}</strong></div>
            <div style={s.infoRow}><span>전월실적</span><strong>{product.card_condition}</strong></div>
            {product.card_after_fee > 0 && <div style={s.infoRow}><span>카드 적용 후</span><strong style={{ color: '#10b981' }}>{typeof product.card_after_fee === 'number' ? product.card_after_fee.toLocaleString() : product.card_after_fee}원</strong></div>}
            {product.card_discount > 0 && <div style={s.infoRow}><span>월 할인액</span><strong style={{ color: '#10b981' }}>{typeof product.card_discount === 'number' ? product.card_discount.toLocaleString() : product.card_discount}원</strong></div>}
            {product.card_note && <div style={{ fontSize: 11, color: '#999', marginTop: 6 }}>{product.card_note}</div>}
          </div>
        )}

        {/* 혜택/프로모션 */}
        <div style={s.section}>
          <div style={s.sectionTitle}>{'🎁'} 혜택 & 프로모션</div>
          {product.benefit && <div style={s.infoRow}><span>혜택</span><strong style={{ color: '#d97706' }}>{product.benefit}</strong></div>}
          {product.promotion_detail && <div style={s.infoRow}><span>프로모션</span><strong>{product.promotion_detail}</strong></div>}
          {product.promo_period && <div style={s.infoRow}><span>기간</span><strong>{product.promo_period}</strong></div>}
        </div>

        {/* 상품 상세 */}
        <div style={s.section}>
          <div style={s.sectionTitle}>{'📋'} 상품 정보</div>
          {product.contract_period && <div style={s.infoRow}><span>약정기간</span><strong>{product.contract_period}</strong></div>}
          {product.management && <div style={s.infoRow}><span>관리방식</span><strong>{product.management}</strong></div>}
          {product.product_type && <div style={s.infoRow}><span>제품타입</span><strong>{product.product_type}</strong></div>}
          {product.size && <div style={s.infoRow}><span>크기</span><strong>{product.size}</strong></div>}
          {product.release && <div style={s.infoRow}><span>출시시기</span><strong>{product.release}</strong></div>}
          {product.filter_type && <div style={s.infoRow}><span>필터종류</span><strong>{product.filter_type}</strong></div>}
        </div>

        {/* 주요기능 */}
        {product.features && (
          <div style={s.section}>
            <div style={s.sectionTitle}>{'⚙️'} 주요 기능</div>
            <div style={{ fontSize: 13, color: '#555', lineHeight: 1.8 }}>{product.features}</div>
          </div>
        )}
      </div>

      {/* 고정 하단 CTA */}
      <div style={s.fixedBottom}>
        <a href="tel:010-9442-8528" style={s.ctaSecondary}>{'📞'} 바로 상담</a>
        <button onClick={() => {
          localStorage.setItem('apply_product', product.name);
          localStorage.setItem('apply_ticket', product.ticket);
          localStorage.setItem('apply_gift', product.benefit || '');
          navigate('/apply/rental');
        }} style={s.ctaPrimary}>{'📝'} 셀프 신청</button>
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', background: '#f5f6fa', fontFamily: "'Noto Sans KR', -apple-system, sans-serif", paddingBottom: 80 },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: NAVY, color: '#fff', position: 'sticky', top: 0, zIndex: 10 },
  backBtn: { background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', padding: '0 8px' },
  headerTitle: { fontSize: 14, fontWeight: 600, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  container: { maxWidth: 480, margin: '0 auto' },
  imageWrap: { background: '#fff', padding: 20, textAlign: 'center' },
  image: { maxWidth: '100%', maxHeight: 300, objectFit: 'contain', borderRadius: 8 },
  imageDots: { display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12 },
  section: { background: '#fff', padding: 16, marginTop: 8 },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #f0f0f0' },
  badge: { fontSize: 10, padding: '3px 8px', borderRadius: 4, background: '#dbeafe', color: ACCENT, fontWeight: 600 },
  productName: { fontSize: 20, fontWeight: 800, color: NAVY, lineHeight: 1.4 },
  priceCard: { background: '#fff', padding: 20, marginTop: 8 },
  cardSection: { background: '#eff6ff', padding: 16, marginTop: 8, borderLeft: '3px solid ' + ACCENT },
  infoRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13, borderBottom: '1px solid #f0f0f0' },
  fixedBottom: { position: 'fixed', bottom: 0, left: 0, right: 0, padding: '10px 16px', paddingBottom: 'max(10px, env(safe-area-inset-bottom))', background: '#fff', borderTop: '1px solid #e8e8e8', display: 'flex', gap: 10, maxWidth: 480, margin: '0 auto' },
  ctaSecondary: { flex: 1, height: 50, borderRadius: 12, border: '1.5px solid ' + NAVY, background: '#fff', color: NAVY, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  ctaPrimary: { flex: 2, height: 50, borderRadius: 12, border: 'none', background: ACCENT, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
};
