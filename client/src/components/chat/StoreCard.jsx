const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];

export default function StoreCard({ store, index = 0 }) {
  const color = COLORS[index % COLORS.length];

  return (
    <div style={styles.card}>
      {store.image ? (
        <div style={styles.imageWrap}>
          <img src={store.image} alt={store.name} style={styles.storeImage} loading="lazy" />
        </div>
      ) : (
        <div style={{ ...styles.colorBar, background: color }} />
      )}
      <div style={styles.body}>
        <div style={{ ...styles.badge, background: color + '22', color }}>직영점</div>
        <div style={styles.name}>{store.name}</div>
        <div style={styles.address}>📍 {store.address}</div>
        {store.landmark && <div style={styles.landmark}>{store.landmark}</div>}
        <div style={styles.phone}>
          📞 <a href={`tel:${store.phone}`} style={styles.phoneLink}>{store.phone}</a>
          {store.phone2 && <span> / <a href={`tel:${store.phone2}`} style={styles.phoneLink}>{store.phone2}</a></span>}
        </div>
        {store.hours && <div style={styles.hours}>🕐 {store.hours}</div>}

        <div style={styles.btnRow}>
          {store.naver_map && (
            <a href={store.naver_map} target="_blank" rel="noopener noreferrer" style={styles.btnMap}>
              🗺️ 지도
            </a>
          )}
          {store.kakao && (
            <a href={store.kakao} target="_blank" rel="noopener noreferrer" style={styles.btnKakao}>
              💬 카톡
            </a>
          )}
          <a href={`tel:${store.phone}`} style={styles.btnCall}>
            📞 전화
          </a>
        </div>
      </div>
    </div>
  );
}

const styles = {
  card: {
    minWidth: 240,
    maxWidth: 280,
    background: '#1a1a1a',
    borderRadius: 14,
    overflow: 'hidden',
    border: '1px solid #2a2a2a',
  },
  imageWrap: {
    width: '100%',
    height: 140,
    overflow: 'hidden',
  },
  storeImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center 70%',
    filter: 'brightness(1.05) contrast(1.05)',
  },
  colorBar: {
    height: 3,
  },
  body: {
    padding: '14px 16px',
  },
  badge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 10,
    fontSize: 10,
    fontWeight: 700,
    marginBottom: 6,
  },
  name: {
    fontSize: 15,
    fontWeight: 800,
    color: '#fff',
    marginBottom: 8,
  },
  address: {
    fontSize: 12,
    color: '#bbb',
    lineHeight: 1.5,
  },
  landmark: {
    fontSize: 11,
    color: '#777',
    marginTop: 2,
    marginBottom: 4,
  },
  phone: {
    fontSize: 12,
    color: '#bbb',
    marginTop: 4,
  },
  phoneLink: {
    color: '#4ECDC4',
    textDecoration: 'none',
  },
  hours: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  btnRow: {
    display: 'flex',
    gap: 6,
    marginTop: 12,
  },
  btnMap: {
    flex: 1,
    padding: '8px 0',
    textAlign: 'center',
    borderRadius: 8,
    background: '#1a73e8',
    color: '#fff',
    fontSize: 12,
    fontWeight: 600,
    textDecoration: 'none',
  },
  btnKakao: {
    flex: 1,
    padding: '8px 0',
    textAlign: 'center',
    borderRadius: 8,
    background: '#FEE500',
    color: '#1a1a1a',
    fontSize: 12,
    fontWeight: 600,
    textDecoration: 'none',
  },
  btnCall: {
    flex: 1,
    padding: '8px 0',
    textAlign: 'center',
    borderRadius: 8,
    background: '#2a2a2a',
    color: '#fff',
    fontSize: 12,
    fontWeight: 600,
    textDecoration: 'none',
    border: '1px solid #333',
  },
};
