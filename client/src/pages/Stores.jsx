import { useState, useEffect } from 'react';
import { api } from '../utils/api.js';
import { useIsMobile } from '../hooks/useIsMobile.js';

const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];

export default function Stores() {
  const [stores, setStores] = useState([]);
  const isMobile = useIsMobile();

  useEffect(() => {
    api.getStores().then(setStores).catch(() => setStores([]));
  }, []);

  return (
    <section style={styles.section}>
      <div style={styles.container}>
        {/* 헤더 */}
        <div style={styles.header}>
          <h2 style={styles.title}>📍 봉이모바일 매장 안내</h2>
          <p style={styles.subtitle}>가까운 직영 매장을 방문하세요</p>
          <div style={styles.links}>
            <a href="https://bong2mobile.com" target="_blank" rel="noopener noreferrer" style={styles.linkBadge}>
              🌐 홈페이지
            </a>
            <a href="https://www.instagram.com/bongee_phone/" target="_blank" rel="noopener noreferrer" style={styles.linkBadge}>
              📸 인스타그램
            </a>
          </div>
        </div>

        {/* 매장 카드 그리드 */}
        <div style={{ ...styles.grid, gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)' }}>
          {stores.map((store, i) => (
            <div key={store.id} style={styles.card}>
              {/* 매장 이미지 */}
              {store.image ? (
                <div style={styles.imageWrap}>
                  <img src={store.image} alt={store.name} style={styles.storeImage} loading="lazy" />
                </div>
              ) : (
                <div style={{ ...styles.colorBar, background: COLORS[i % COLORS.length] }} />
              )}

              {/* 매장명 */}
              <div style={styles.cardHeader}>
                <div style={{ ...styles.badge, background: COLORS[i % COLORS.length] + '22', color: COLORS[i % COLORS.length] }}>
                  직영점
                </div>
                <h3 style={styles.storeName}>{store.name}</h3>
              </div>

              {/* 정보 */}
              <div style={styles.infoList}>
                <div style={styles.infoRow}>
                  <span style={styles.infoIcon}>📍</span>
                  <div>
                    <div style={styles.infoText}>{store.address}</div>
                    {store.landmark && <div style={styles.landmark}>{store.landmark}</div>}
                  </div>
                </div>

                <div style={styles.infoRow}>
                  <span style={styles.infoIcon}>📞</span>
                  <div>
                    <a href={`tel:${store.phone}`} style={styles.phoneLink}>{store.phone}</a>
                    {store.phone2 && <a href={`tel:${store.phone2}`} style={styles.phoneLink}> / {store.phone2}</a>}
                  </div>
                </div>

                <div style={styles.infoRow}>
                  <span style={styles.infoIcon}>🕐</span>
                  <span style={styles.infoText}>{store.hours}</span>
                </div>
              </div>

              {/* 버튼 그룹 */}
              <div style={styles.btnGroup}>
                {store.naver_map ? (
                  <a href={store.naver_map} target="_blank" rel="noopener noreferrer" style={styles.btnPrimary}>
                    🗺️ 네이버 지도
                  </a>
                ) : (
                  <a href={`https://map.naver.com/v5/search/${encodeURIComponent(store.name)}`}
                    target="_blank" rel="noopener noreferrer" style={styles.btnPrimary}>
                    🗺️ 지도에서 보기
                  </a>
                )}

                {store.kakao && (
                  <a href={store.kakao} target="_blank" rel="noopener noreferrer" style={styles.btnKakao}>
                    💬 카카오톡
                  </a>
                )}

                <a href={`tel:${store.phone}`} style={styles.btnCall}>
                  📞 전화하기
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const styles = {
  section: {
    minHeight: '100vh',
    background: '#0a0a0a',
    padding: '40px 0 80px',
  },
  container: {
    maxWidth: 900,
    margin: '0 auto',
    padding: '0 20px',
  },
  header: {
    textAlign: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 800,
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#888',
    marginBottom: 16,
  },
  links: {
    display: 'flex',
    justifyContent: 'center',
    gap: 12,
  },
  linkBadge: {
    display: 'inline-block',
    padding: '6px 16px',
    borderRadius: 20,
    background: '#1a1a1a',
    color: '#aaa',
    fontSize: 13,
    textDecoration: 'none',
    border: '1px solid #333',
  },
  grid: {
    display: 'grid',
    gap: 20,
  },
  card: {
    background: '#141414',
    borderRadius: 16,
    overflow: 'hidden',
    border: '1px solid #222',
    transition: 'transform 0.2s, border-color 0.2s',
  },
  imageWrap: {
    width: '100%',
    height: 180,
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
    height: 4,
  },
  cardHeader: {
    padding: '20px 20px 0',
  },
  badge: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 8,
  },
  storeName: {
    fontSize: 18,
    fontWeight: 800,
    color: '#fff',
    marginBottom: 4,
  },
  infoList: {
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  infoRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
  },
  infoIcon: {
    fontSize: 14,
    flexShrink: 0,
    marginTop: 2,
  },
  infoText: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 1.5,
  },
  landmark: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },
  phoneLink: {
    fontSize: 14,
    color: '#4ECDC4',
    textDecoration: 'none',
  },
  btnGroup: {
    padding: '0 20px 20px',
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  btnPrimary: {
    flex: 1,
    minWidth: 100,
    padding: '10px 0',
    textAlign: 'center',
    borderRadius: 10,
    background: '#1a73e8',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    textDecoration: 'none',
  },
  btnKakao: {
    flex: 1,
    minWidth: 100,
    padding: '10px 0',
    textAlign: 'center',
    borderRadius: 10,
    background: '#FEE500',
    color: '#1a1a1a',
    fontSize: 13,
    fontWeight: 600,
    textDecoration: 'none',
  },
  btnCall: {
    flex: 1,
    minWidth: 100,
    padding: '10px 0',
    textAlign: 'center',
    borderRadius: 10,
    background: '#2a2a2a',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    textDecoration: 'none',
    border: '1px solid #333',
  },
};
