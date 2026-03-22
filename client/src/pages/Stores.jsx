import { useState, useEffect } from 'react';
import { api } from '../utils/api.js';

export default function Stores() {
  const [stores, setStores] = useState([]);

  useEffect(() => {
    api.getStores().then(setStores).catch(() => setStores([]));
  }, []);

  return (
    <section className="section">
      <div className="container">
        <h2 className="section-title">매장 안내</h2>
        <p className="section-desc">가까운 봉이모바일 직영 매장을 방문하세요</p>
        <div className="grid-2">
          {stores.map(store => (
            <div key={store.id} className="card">
              <h3 style={{ fontSize: 17, marginBottom: 8 }}>{store.name}</h3>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                <div>📍 {store.address}</div>
                <div>📞 {store.phone}</div>
                <div>🕐 {store.hours}</div>
              </div>
              <a
                href={`https://map.naver.com/v5/search/${encodeURIComponent(store.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline"
                style={{ marginTop: 12, width: '100%', justifyContent: 'center' }}
              >
                지도에서 보기
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
