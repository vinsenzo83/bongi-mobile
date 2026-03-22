import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../utils/api.js';

export default function ProductDetail() {
  const { ticket } = useParams();
  const [product, setProduct] = useState(null);

  useEffect(() => {
    api.getProductByTicket(ticket).then(setProduct).catch(() => setProduct(null));
  }, [ticket]);

  if (!product) return <div className="container section"><p>상품을 찾을 수 없습니다</p></div>;

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 640 }}>
        <div className="card">
          <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--text-secondary)' }}>티켓: {product.ticket}</span>
          <h2 style={{ fontSize: 24, margin: '12px 0' }}>{product.name}</h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 }}>
            {product.type} / {product.speed || product.brand || product.carrier}
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
            <Link to={`/apply/self?ticket=${product.ticket}`} className="btn btn-primary btn-lg" style={{ flex: 1, justifyContent: 'center' }}>바로 신청</Link>
            <Link to={`/apply/quick?ticket=${product.ticket}`} className="btn btn-outline btn-lg" style={{ flex: 1, justifyContent: 'center' }}>바로 상담 ({product.ticket})</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
