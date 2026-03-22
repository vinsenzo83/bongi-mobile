import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../utils/api.js';

const categoryNames = {
  internet: '인터넷+TV',
  rental: '가전렌탈',
  usim: '유심/알뜰폰',
  usedPhone: '중고폰 매입',
};

function formatPrice(n) {
  return n?.toLocaleString() + '원';
}

function ApplyButtons({ ticket }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
      <Link to={`/apply/call?ticket=${ticket}`} className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
        바로상담
      </Link>
      <Link to={`/apply/self?ticket=${ticket}`} className="btn btn-outline" style={{ flex: 1, justifyContent: 'center' }}>
        셀프가입
      </Link>
    </div>
  );
}

function InternetCard({ product }) {
  return (
    <div className="card" style={{ position: 'relative' }}>
      {product.popular && <span className="badge badge-yellow" style={{ position: 'absolute', top: 16, right: 16 }}>인기</span>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span className="badge badge-blue">{product.carrier}</span>
        <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--text-secondary)' }}>{product.ticket}</span>
      </div>
      <h3 style={{ fontSize: 17, marginBottom: 8 }}>{product.name}</h3>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
        {product.speed} / {product.type} / {product.contract}
      </div>
      <div style={{ background: '#f8fafc', borderRadius: 8, padding: 14, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
          <span>월 요금</span><span>{formatPrice(product.monthlyPrice)}</span>
        </div>
        {product.discounts?.bundle !== 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4, color: 'var(--success)' }}>
            <span>결합할인</span><span>{formatPrice(product.discounts.bundle)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8, color: 'var(--success)' }}>
          <span>카드할인</span><span>{formatPrice(product.discounts.card)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          <span>실납부</span><span style={{ color: 'var(--primary)' }}>{formatPrice(product.actualPrice)}</span>
        </div>
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--secondary)', marginBottom: 16 }}>
        현금 사은품 {formatPrice(product.cashback)}
      </div>
      <ApplyButtons ticket={product.ticket} />
    </div>
  );
}

function RentalCard({ product }) {
  return (
    <div className="card">
      {product.popular && <span className="badge badge-yellow" style={{ float: 'right' }}>인기</span>}
      <span className="badge badge-blue" style={{ marginBottom: 12 }}>{product.brand}</span>
      <h3 style={{ fontSize: 17, marginBottom: 4 }}>{product.name}</h3>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>{product.contract} 약정</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary)', marginBottom: 4 }}>월 {formatPrice(product.monthlyPrice)}</div>
      <div style={{ fontSize: 14, color: 'var(--secondary)', fontWeight: 600, marginBottom: 12 }}>현금 {formatPrice(product.cashback)}</div>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', paddingLeft: 16, marginBottom: 16 }}>
        {product.features?.map(f => <li key={f}>{f}</li>)}
      </ul>
      <ApplyButtons ticket={product.ticket} />
    </div>
  );
}

function UsimCard({ product }) {
  return (
    <div className="card">
      {product.popular && <span className="badge badge-green" style={{ float: 'right' }}>인기</span>}
      <span className="badge badge-blue">{product.carrier}</span>
      <h3 style={{ fontSize: 17, margin: '12px 0 8px' }}>{product.name}</h3>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
        데이터 {product.data} / 통화 {product.call} / 문자 {product.sms}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary)', marginBottom: 16 }}>월 {formatPrice(product.monthlyPrice)}</div>
      <ApplyButtons ticket={product.ticket} />
    </div>
  );
}

function UsedPhoneCard({ product }) {
  return (
    <div className="card">
      <h3 style={{ fontSize: 20, marginBottom: 12 }}>{product.name}</h3>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>{product.description}</p>
      <div style={{ marginBottom: 16 }}>
        {product.process?.map((step, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{i + 1}</span>
            <span style={{ fontSize: 14 }}>{step}</span>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>{product.note}</p>
      <ApplyButtons ticket={product.ticket} />
    </div>
  );
}

const CardMap = { internet: InternetCard, rental: RentalCard, usim: UsimCard, usedPhone: UsedPhoneCard };

export default function Products() {
  const { category } = useParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getProducts(category)
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [category]);

  const Card = CardMap[category] || InternetCard;
  const cols = category === 'usedPhone' ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))';

  return (
    <section className="section">
      <div className="container">
        <h2 className="section-title">{categoryNames[category] || category}</h2>
        <p className="section-desc">최고 조건의 상품을 비교해보세요</p>
        {loading ? (
          <p>로딩 중...</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 20 }}>
            {products.map(p => <Card key={p.id} product={p} />)}
          </div>
        )}
      </div>
    </section>
  );
}
