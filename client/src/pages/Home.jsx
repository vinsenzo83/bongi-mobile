import { Link } from 'react-router-dom';

const categories = [
  { id: 'internet', name: '인터넷+TV', icon: '📡', desc: '초고속 인터넷과 IPTV 결합', color: '#2563eb', badge: '수익 1위' },
  { id: 'rental', name: '가전렌탈', icon: '🧺', desc: '정수기, 공기청정기, 비데', color: '#f59e0b', badge: '수익 2위' },
  { id: 'usim', name: '유심/알뜰폰', icon: '📱', desc: '알뜰 요금제 유심 개통', color: '#10b981', badge: '수익 3위' },
  { id: 'usedPhone', name: '중고폰 매입', icon: '📦', desc: '사용 안 하는 폰 최고가 매입', color: '#ef4444', badge: '매입' },
];

const applySteps = [
  { icon: '📡', title: '상품 선택', desc: '원하는 상품을 둘러보세요' },
  { icon: '🎫', title: '티켓 확인', desc: '상품 티켓번호를 기억하세요' },
  { icon: '📞', title: '전화 한 통', desc: '1600-XXXX로 전화하세요' },
  { icon: '✅', title: '가입 완료', desc: '상담사가 바로 처리해드립니다' },
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section style={styles.hero}>
        <div className="container">
          <div style={styles.heroBadge}>🐟 광주/전라 8개 직영 매장</div>
          <h1 style={styles.heroTitle}>
            인터넷, 렌탈, 알뜰폰<br />
            <span style={{ color: 'var(--primary)' }}>리턴AI</span>에서 한 번에
          </h1>
          <p style={styles.heroDesc}>
            업계 최고 현금 사은품 + 직영 매장의 신뢰<br />
            가까운 매장에서 직접 상담받으세요
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <Link to="/apply" className="btn btn-primary btn-lg">상담 신청하기</Link>
            <Link to="/stores" className="btn btn-outline btn-lg">매장 찾기</Link>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="section">
        <div className="container">
          <h2 className="section-title">우리가 파는 상품</h2>
          <p className="section-desc">4가지 카테고리, 최고의 조건으로 제공합니다</p>
          <div className="grid-4">
            {categories.map(cat => (
              <Link key={cat.id} to={`/products/${cat.id}`} style={{ textDecoration: 'none' }}>
                <div className="card" style={{ textAlign: 'center', cursor: 'pointer', transition: 'transform 0.15s' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>{cat.icon}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{cat.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>{cat.desc}</div>
                  <span className="badge" style={{ background: cat.color + '20', color: cat.color }}>{cat.badge}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How to Apply */}
      <section className="section" style={{ background: '#f1f5f9' }}>
        <div className="container">
          <h2 className="section-title">신청은 이렇게</h2>
          <p className="section-desc">상품 고르고, 전화 한 통이면 끝</p>
          <div className="grid-4">
            {applySteps.map((s, i) => (
              <div key={s.title} className="card" style={{ textAlign: 'center', position: 'relative' }}>
                {i < applySteps.length - 1 && <div style={{ position: 'absolute', right: -16, top: '50%', transform: 'translateY(-50%)', fontSize: 20, color: 'var(--text-secondary)' }}>→</div>}
                <div style={{ fontSize: 32, marginBottom: 8 }}>{s.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Link to="/apply" className="btn btn-primary btn-lg">1600-XXXX 전화 신청</Link>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="section">
        <div className="container">
          <h2 className="section-title">왜 리턴AI인가?</h2>
          <div className="grid-3" style={{ marginTop: 24 }}>
            <div className="card">
              <div style={{ fontSize: 28, marginBottom: 12 }}>🏪</div>
              <h3 style={{ marginBottom: 8 }}>8개 직영 매장</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                온라인 판매점의 "사기 아닐까?" 불안을 해소합니다. 매장에 직접 방문하세요.
              </p>
            </div>
            <div className="card">
              <div style={{ fontSize: 28, marginBottom: 12 }}>💰</div>
              <h3 style={{ marginBottom: 8 }}>업계 최고 사은품</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                경쟁사와 동일하거나 더 높은 현금 사은품을 보장합니다.
              </p>
            </div>
            <div className="card">
              <div style={{ fontSize: 28, marginBottom: 12 }}>🤖</div>
              <h3 style={{ marginBottom: 8 }}>AI 맞춤 추천</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                AI가 고객님의 사용 패턴을 분석해 최적의 상품을 추천합니다.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

const styles = {
  hero: {
    background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
    color: '#fff',
    padding: '80px 0',
  },
  heroBadge: {
    display: 'inline-block',
    background: 'rgba(255,255,255,0.15)',
    padding: '6px 14px',
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 20,
  },
  heroTitle: {
    fontSize: 42,
    fontWeight: 900,
    lineHeight: 1.2,
    marginBottom: 16,
  },
  heroDesc: {
    fontSize: 17,
    opacity: 0.85,
    lineHeight: 1.7,
    marginBottom: 28,
  },
};
