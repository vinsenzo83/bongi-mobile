import { useState } from 'react';

export default function RentalCard({ product, onAction }) {
  const [expanded, setExpanded] = useState(false);

  if (!product) return null;

  const monthlyPrice = product.월렌탈료 || '-';
  const thumbnail = product.썸네일 || product.이미지 || '';
  const cardDiscount = product.카드할인 || null;

  return (
    <div style={styles.card}>
      <div style={styles.topSection}>
        {thumbnail && (
          <div style={styles.thumbnailWrap}>
            <img
              src={thumbnail}
              alt={product.상품명}
              style={styles.thumbnail}
              loading="lazy"
            />
          </div>
        )}
        <div style={styles.info}>
          <div style={styles.brand}>{product.브랜드}</div>
          <div style={styles.name}>{product.상품명}</div>
          <div style={styles.priceRow}>
            <span style={styles.priceLabel}>월 렌탈료</span>
            <span style={styles.price}>{monthlyPrice}</span>
          </div>
        </div>
      </div>

      {product.사은품 && product.사은품 !== '-' && (
        <div style={styles.gift}>
          <span>🎁 사은품</span>
          <span style={styles.giftValue}>{product.사은품}</span>
        </div>
      )}

      {cardDiscount && (
        <div style={styles.cardDiscount}>
          <span>💳 카드할인</span>
          <span style={styles.cardDiscountValue}>{cardDiscount}</span>
        </div>
      )}

      <button
        style={styles.toggleBtn}
        onClick={() => setExpanded(prev => !prev)}
      >
        {expanded ? '접기 ▲' : '상세보기 ▼'}
      </button>

      {expanded && (
        <div style={styles.detailSection}>
          {product.모델번호 && (
            <DetailRow label="모델번호" value={product.모델번호} />
          )}
          {product.기본기능 && product.기본기능.length > 0 && (
            <DetailRow
              label="기본기능"
              value={product.기본기능.join(', ')}
            />
          )}
          {product.상품URL && (
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>상품 링크</span>
              <a
                href={product.상품URL}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.link}
              >
                자세히 보기 →
              </a>
            </div>
          )}
        </div>
      )}

      {product.rating && (
        <div style={styles.ratingBadge}>
          <span>★ {product.rating} 고객만족도</span>
        </div>
      )}

      <div style={styles.ctaMent}>
        <span>🎁 평균 25만원 사은품 수령</span>
      </div>

      {onAction && (
        <div style={styles.actions}>
          <button
            style={styles.actionBtn}
            onClick={() => onAction(`${product.상품명} 렌탈 상담 받고 싶어요`)}
          >
            렌탈 상담
          </button>
          <button
            style={styles.detailBtn}
            onClick={() => onAction(`${product.상품명} 다른 옵션도 보여줘`)}
          >
            다른 상품
          </button>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div style={styles.detailRow}>
      <span style={styles.detailLabel}>{label}</span>
      <span style={styles.detailValue}>{value}</span>
    </div>
  );
}

const styles = {
  card: {
    background: '#1e1e1e',
    border: '1px solid #333',
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    maxWidth: 320,
  },
  topSection: {
    display: 'flex',
    gap: 12,
    marginBottom: 10,
  },
  thumbnailWrap: {
    flexShrink: 0,
    width: 90,
    height: 90,
    borderRadius: 8,
    overflow: 'hidden',
    background: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  info: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 4,
  },
  brand: {
    fontSize: 11,
    color: '#999',
    fontWeight: 600,
  },
  name: {
    fontSize: 14,
    fontWeight: 600,
    color: '#fff',
    lineHeight: 1.3,
  },
  priceRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 4,
  },
  priceLabel: {
    fontSize: 11,
    color: '#999',
  },
  price: {
    fontSize: 17,
    fontWeight: 700,
    color: '#4ade80',
  },
  gift: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '6px 10px',
    background: '#2d1f0f',
    border: '1px solid #6b4c1e',
    borderRadius: 8,
    fontSize: 13,
    color: '#fbbf24',
    marginBottom: 6,
  },
  giftValue: {
    fontWeight: 600,
  },
  cardDiscount: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '6px 10px',
    background: '#1a1f2e',
    border: '1px solid #334155',
    borderRadius: 8,
    fontSize: 13,
    color: '#60a5fa',
    marginBottom: 6,
  },
  cardDiscountValue: {
    fontWeight: 600,
  },
  toggleBtn: {
    width: '100%',
    padding: '6px 0',
    background: 'transparent',
    border: '1px solid #444',
    borderRadius: 8,
    color: '#999',
    fontSize: 12,
    cursor: 'pointer',
    marginBottom: 6,
  },
  detailSection: {
    padding: '8px 0',
    borderTop: '1px solid #333',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 12,
  },
  detailLabel: {
    color: '#999',
  },
  detailValue: {
    color: '#d1d5db',
    textAlign: 'right',
    maxWidth: '60%',
  },
  link: {
    color: '#60a5fa',
    textDecoration: 'none',
    fontSize: 12,
  },
  actions: {
    display: 'flex',
    gap: 8,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    padding: '7px 0',
    borderRadius: 8,
    border: 'none',
    background: '#4ade80',
    color: '#000',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  detailBtn: {
    flex: 1,
    padding: '7px 0',
    borderRadius: 8,
    border: '1px solid #444',
    background: 'transparent',
    color: '#ccc',
    fontSize: 13,
    cursor: 'pointer',
  },
  ratingBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    background: '#2d1f0f',
    border: '1px solid #6b4c1e',
    borderRadius: 8,
    fontSize: 12,
    color: '#fbbf24',
    fontWeight: 600,
    marginBottom: 6,
  },
  ctaMent: {
    padding: '6px 10px',
    background: '#0f2d1a',
    border: '1px solid #1e6b3a',
    borderRadius: 8,
    fontSize: 12,
    color: '#4ade80',
    fontWeight: 600,
    textAlign: 'center',
    marginBottom: 6,
  },
};
