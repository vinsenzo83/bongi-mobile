import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const NAVY = '#1a2744';
const ACCENT = '#2563eb';
const CATEGORIES = ['전체', '정수기', '공기청정기', 'TV', '세탁기+건조기', '세탁기', '건조기', '노트북', '안마의자', '비데', '매트리스', '로봇청소기'];
const CAT_ICONS = { '정수기': '💧', '공기청정기': '🌬️', 'TV': '📺', '세탁기+건조기': '👕', '세탁기': '👕', '건조기': '🌀', '노트북': '💻', '안마의자': '💆', '비데': '🚽', '매트리스': '🛏️', '로봇청소기': '🤖' };

export default function RentalCatalog() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState(params.get('cat') || '전체');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/rental')
      .then(r => r.json())
      .then(d => { setProducts(d.items || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = products.filter(p => {
    const matchCat = category === '전체' || p.category === category;
    const matchSearch = !search || p.name.includes(search) || p.brand.includes(search);
    return matchCat && matchSearch;
  });

  return (
    <div style={s.page}>
      {/* 헤더 */}
      <div style={s.header}>
        <button onClick={() => navigate('/')} style={s.backBtn}>{'←'}</button>
        <span style={s.headerTitle}>렌탈 상품 카달로그</span>
        <span style={{ width: 32 }} />
      </div>

      {/* 카테고리 필터 */}
      <div style={s.catBar}>
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setCategory(c)} style={{ ...s.catBtn, ...(category === c ? s.catActive : {}) }}>
            {c !== '전체' && <span>{CAT_ICONS[c] || ''}</span>}
            {c}
          </button>
        ))}
      </div>

      {/* 검색 */}
      <div style={s.searchWrap}>
        <input style={s.searchInput} placeholder="상품명, 브랜드 검색" value={search} onChange={e => setSearch(e.target.value)} />
        <span style={s.count}>{filtered.length}개 상품</span>
      </div>

      {/* 상품 리스트 */}
      <div style={s.container}>
        {loading && <div style={s.empty}>로딩 중...</div>}
        {!loading && filtered.length === 0 && <div style={s.empty}>상품이 없습니다</div>}

        {filtered.map(p => (
          <div key={p.ticket} style={s.card} onClick={() => navigate('/product/rental/' + p.ticket)}>
            <div style={s.cardTop}>
              {p.image ? (
                <img src={p.image} alt={p.name} style={s.cardImg} />
              ) : (
                <div style={s.cardImgPlaceholder}>{'📦'}</div>
              )}
              <div style={s.cardInfo}>
                <div style={s.cardBadges}>
                  <span style={s.badge}>{p.category}</span>
                  <span style={{ ...s.badge, background: '#f3f4f6', color: '#555' }}>{p.brand}</span>
                  <span style={{ ...s.badge, background: '#dbeafe', color: ACCENT, fontFamily: 'monospace' }}>{p.ticket}</span>
                </div>
                <div style={s.cardName}>{p.name}</div>
                {p.model_number && <div style={s.cardModel}>{p.model_number}</div>}
              </div>
            </div>

            <div style={s.cardPriceRow}>
              <div>
                <span style={s.priceLabel}>월 </span>
                <span style={s.price}>{p.monthly_fee}</span>
                <span style={s.priceLabel}>원</span>
                {p.normal_fee > 0 && <span style={s.normalPrice}>{typeof p.normal_fee === 'number' ? p.normal_fee.toLocaleString() : p.normal_fee}원</span>}
              </div>
              {p.card_name && p.card_name !== '해당없음' && (
                <div style={s.cardDiscount}>
                  {'💳'} {p.card_name} → {p.card_after_fee > 0 ? (typeof p.card_after_fee === 'number' ? p.card_after_fee.toLocaleString() : p.card_after_fee) + '원' : '무료!'}
                </div>
              )}
            </div>

            <div style={s.cardBottom}>
              {p.benefit && <span style={s.promoTag}>{'🎁'} {p.benefit}</span>}
              {p.contract_period && <span style={s.infoTag}>{p.contract_period}</span>}
              {p.management && <span style={s.infoTag}>{p.management}</span>}
            </div>

            <div style={s.cardActions}>
              <button onClick={e => { e.stopPropagation(); navigate('/product/rental/' + p.ticket); }} style={s.actionDetail}>상세보기</button>
              <a href="tel:010-9442-8528" onClick={e => e.stopPropagation()} style={s.actionCall}>{'📞'} 바로상담</a>
              <button onClick={e => {
                e.stopPropagation();
                localStorage.setItem('apply_product', p.name);
                localStorage.setItem('apply_ticket', p.ticket);
                localStorage.setItem('apply_gift', p.benefit || '');
                navigate('/apply/rental');
              }} style={s.actionApply}>{'📝'} 셀프신청</button>
            </div>
          </div>
        ))}
      </div>

      {/* 하단 CTA */}
      <div style={s.fixedBottom}>
        <button onClick={() => navigate('/')} style={s.ctaChat}>{'💬'} AI 상담</button>
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', background: '#f5f6fa', fontFamily: "'Noto Sans KR', -apple-system, sans-serif", paddingBottom: 70 },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: NAVY, color: '#fff', position: 'sticky', top: 0, zIndex: 10 },
  backBtn: { background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', padding: '0 8px' },
  headerTitle: { fontSize: 16, fontWeight: 700 },
  catBar: { display: 'flex', gap: 6, padding: '12px 16px', overflowX: 'auto', background: '#fff', borderBottom: '1px solid #e8e8e8', WebkitOverflowScrolling: 'touch' },
  catBtn: { padding: '6px 12px', borderRadius: 20, border: '1px solid #d0d0d0', background: '#fff', color: '#555', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 },
  catActive: { background: ACCENT, color: '#fff', borderColor: ACCENT, fontWeight: 600 },
  searchWrap: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#fff' },
  searchInput: { flex: 1, height: 40, border: '1.5px solid #d0d0d0', borderRadius: 10, padding: '0 14px', fontSize: 13, outline: 'none', fontFamily: 'inherit' },
  count: { fontSize: 12, color: '#999', whiteSpace: 'nowrap' },
  container: { padding: '8px 16px', maxWidth: 480, margin: '0 auto' },
  empty: { textAlign: 'center', padding: 40, color: '#999', fontSize: 14 },
  card: { background: '#fff', border: '1px solid #e8e8e8', borderRadius: 12, padding: 14, marginBottom: 10, cursor: 'pointer' },
  cardTop: { display: 'flex', gap: 12, marginBottom: 10 },
  cardImg: { width: 80, height: 80, borderRadius: 8, objectFit: 'cover', flexShrink: 0 },
  cardImgPlaceholder: { width: 80, height: 80, borderRadius: 8, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 },
  cardInfo: { flex: 1, minWidth: 0 },
  cardBadges: { display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 },
  badge: { fontSize: 9, padding: '2px 6px', borderRadius: 4, background: '#dbeafe', color: ACCENT, fontWeight: 600 },
  cardName: { fontSize: 14, fontWeight: 700, color: NAVY, lineHeight: 1.3 },
  cardModel: { fontSize: 11, color: '#999', marginTop: 2 },
  cardPriceRow: { marginBottom: 8 },
  priceLabel: { fontSize: 12, color: '#999' },
  price: { fontSize: 20, fontWeight: 900, color: NAVY },
  normalPrice: { fontSize: 11, color: '#999', textDecoration: 'line-through', marginLeft: 8 },
  cardDiscount: { fontSize: 11, color: '#10b981', fontWeight: 600, marginTop: 4 },
  cardBottom: { display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 },
  promoTag: { fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#fef3c7', color: '#d97706', fontWeight: 600 },
  infoTag: { fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#f3f4f6', color: '#555' },
  cardActions: { display: 'flex', gap: 6 },
  actionDetail: { flex: 1, padding: '8px', borderRadius: 8, border: '1px solid #d0d0d0', background: '#fff', color: '#555', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' },
  actionCall: { flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: '#10b981', color: '#fff', fontSize: 12, fontWeight: 600, textDecoration: 'none', textAlign: 'center' },
  actionApply: { flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: ACCENT, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' },
  fixedBottom: { position: 'fixed', bottom: 0, left: 0, right: 0, padding: '10px 16px', paddingBottom: 'max(10px, env(safe-area-inset-bottom))', background: '#fff', borderTop: '1px solid #e8e8e8' },
  ctaChat: { width: '100%', maxWidth: 480, margin: '0 auto', display: 'block', height: 48, borderRadius: 12, border: 'none', background: NAVY, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
};
