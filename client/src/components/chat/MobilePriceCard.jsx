const carrierColors = {
  'SK': { bg: '#e60012', border: '#e60012' },
  'KT': { bg: '#1a73e8', border: '#1a73e8' },
  'LG U+': { bg: '#e5007d', border: '#e5007d' },
};

export default function MobilePriceCard({ item, services, plan, onAction }) {
  if (!item) return null;

  const 번이 = item['번이_raw'];
  const 기변 = item['기변_raw'];
  const colors = carrierColors[item.통신사] || { bg: '#555', border: '#555' };

  return (
    <div style={{ ...styles.card, borderColor: colors.border }}>
      <div style={styles.header}>
        <span style={{ ...styles.carrier, background: colors.bg }}>{item.통신사}</span>
        <span style={styles.model}>{item.모델}</span>
      </div>

      {plan && (
        <div style={styles.planRow}>
          <span style={styles.planLabel}>📋 요금제</span>
          <span style={styles.planValue}>{plan.요금제}</span>
        </div>
      )}

      <div style={styles.priceRow}>
        <div style={styles.priceBox}>
          <span style={styles.priceLabel}>🔄 번호이동</span>
          <span style={{ ...styles.priceValue, color: priceColor(번이) }}>
            {item['번호이동(공시)'] || item.번호이동}
          </span>
        </div>
        <div style={styles.divider} />
        <div style={styles.priceBox}>
          <span style={styles.priceLabel}>🔧 기기변경</span>
          <span style={{ ...styles.priceValue, color: priceColor(기변) }}>
            {item['기기변경(공시)'] || item.기기변경}
          </span>
        </div>
      </div>

      {services && services.length > 0 && (
        <div style={styles.serviceSection}>
          <span style={styles.serviceTitle}>📋 부가서비스</span>
          {services.map((s, i) => (
            <div key={i} style={styles.serviceRow}>
              <span style={styles.serviceName}>{s.서비스 || s.service}</span>
              <span style={styles.serviceFee}>{s.월정액 || formatFee(s.fee)}</span>
            </div>
          ))}
        </div>
      )}

      {onAction && (
        <div style={styles.actions}>
          <button
            style={{ ...styles.actionBtn, background: colors.bg }}
            onClick={() => onAction(`${item.모델} ${item.통신사} 번호이동으로 가입 상담 받고 싶어요`)}
          >
            가입 상담
          </button>
          <button
            style={styles.detailBtn}
            onClick={() => onAction(`${item.모델} 상세 조건 알려줘`)}
          >
            상세보기
          </button>
        </div>
      )}
    </div>
  );
}

function priceColor(raw) {
  if (raw === undefined || raw === null) return '#d1d5db';
  if (raw < 0) return '#4ade80'; // 캐시백 = 녹색
  if (raw === 0) return '#fbbf24'; // 공짜폰 = 노란색
  return '#d1d5db'; // 일반
}

function formatFee(fee) {
  if (fee === 0 || fee === '0') return '무료';
  if (typeof fee === 'number') return `${fee.toLocaleString()}원`;
  return fee || '-';
}

const styles = {
  card: {
    background: '#1e1e1e',
    border: '1px solid #333',
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    maxWidth: 340,
    minWidth: 280,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  planRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 11,
    padding: '4px 8px',
    background: '#252525',
    borderRadius: 6,
    marginBottom: 8,
  },
  planLabel: { color: '#999' },
  planValue: { color: '#60a5fa', fontWeight: 600 },
  carrier: {
    background: '#dc2626',
    color: '#fff',
    fontSize: 11,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 10,
  },
  model: {
    fontSize: 15,
    fontWeight: 600,
    color: '#fff',
  },
  priceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 0,
    background: '#252525',
    borderRadius: 8,
    padding: '10px 0',
  },
  priceBox: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  divider: {
    width: 1,
    height: 36,
    background: '#444',
  },
  priceLabel: {
    fontSize: 11,
    color: '#999',
  },
  priceValue: {
    fontSize: 15,
    fontWeight: 700,
  },
  serviceSection: {
    marginTop: 10,
    paddingTop: 8,
    borderTop: '1px solid #333',
  },
  serviceTitle: {
    fontSize: 12,
    color: '#999',
    display: 'block',
    marginBottom: 4,
  },
  serviceRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 12,
    padding: '2px 0',
  },
  serviceName: {
    color: '#aaa',
  },
  serviceFee: {
    color: '#d1d5db',
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
    background: '#dc2626',
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
