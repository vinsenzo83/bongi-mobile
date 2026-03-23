export default function ProductCard({ product, onAction }) {
  if (!product) return null;

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={styles.badge}>{product.상품번호}</span>
        <span style={styles.provider}>{product.통신사 || ''}</span>
      </div>
      <div style={styles.name}>{product.상품명}</div>

      <div style={styles.details}>
        {product.속도 && <Row label="📶 속도" value={product.속도} />}
        {product.채널수 && product.채널수 !== '-' && <Row label="📺 채널" value={`${product.채널수}채널`} />}
        {product.인터넷요금 && <Row label="🌐 인터넷" value={product.인터넷요금} />}
        {product.TV요금 && <Row label="📺 TV" value={product.TV요금} />}
        {product.셋탑박스 && <Row label="📦 셋탑" value={product.셋탑박스} />}
        {product.WiFi && <Row label="📡 WiFi" value={product.WiFi} />}
        {product['인터넷+TV_월요금'] && !product.인터넷요금 && <Row label="💰 기본요금" value={product['인터넷+TV_월요금']} />}
        {product.소계 && <Row label="소계" value={product.소계} sub />}
        {product.결합할인 && product.결합할인 !== '없음' && <Row label="🏷️ 결합할인" value={product.결합할인} highlight />}
        {product.휴대폰할인 && <Row label="📱 폰할인" value={product.휴대폰할인} highlight />}
        {product.카드할인 && product.카드할인 !== '없음' && <Row label="💳 카드할인" value={product.카드할인} highlight />}
      </div>

      <div style={styles.finalRow}>
        <span>✅ 최종 월요금</span>
        <span style={styles.finalPrice}>{product['★최종_월요금'] || '-'}</span>
      </div>

      {product.사은품 && product.사은품 !== '-' && (
        <div style={styles.gift}>🎁 {product.사은품}</div>
      )}

      {onAction && (
        <div style={styles.actions}>
          <button
            style={styles.actionBtn}
            onClick={() => onAction(`${product.상품번호} 가입 상담 받고 싶어요`)}
          >
            가입 상담
          </button>
          <button
            style={styles.detailBtn}
            onClick={() => onAction(`${product.상품번호} 상세정보 알려줘`)}
          >
            상세보기
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, highlight, sub }) {
  return (
    <div style={{ ...styles.row, ...(sub ? { borderTop: '1px solid #333', paddingTop: 4, marginTop: 4 } : {}) }}>
      <span style={styles.label}>{label}</span>
      <span style={{ ...styles.value, ...(highlight ? { color: '#f87171' } : {}), ...(sub ? { fontWeight: 600 } : {}) }}>{value}</span>
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
    maxWidth: 340,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  badge: {
    background: '#5b5fc7',
    color: '#fff',
    fontSize: 11,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 10,
  },
  provider: {
    color: '#888',
    fontSize: 12,
  },
  name: {
    fontSize: 15,
    fontWeight: 600,
    color: '#fff',
    marginBottom: 10,
  },
  details: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 13,
  },
  label: { color: '#999' },
  value: { color: '#d1d5db' },
  finalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTop: '1px solid #333',
    fontSize: 14,
    fontWeight: 600,
    color: '#fff',
  },
  finalPrice: {
    color: '#60a5fa',
    fontSize: 16,
  },
  gift: {
    marginTop: 8,
    padding: '6px 10px',
    background: '#2d1f0f',
    border: '1px solid #6b4c1e',
    borderRadius: 8,
    fontSize: 13,
    color: '#fbbf24',
  },
  actions: {
    display: 'flex',
    gap: 8,
    marginTop: 10,
  },
  actionBtn: {
    flex: 1,
    padding: '7px 0',
    borderRadius: 8,
    border: 'none',
    background: '#5b5fc7',
    color: '#fff',
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
};
