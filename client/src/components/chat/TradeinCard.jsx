const GRADE_COLORS = { A: '#16a34a', B: '#65a30d', C: '#d97706', D: '#ea580c', E: '#dc2626' };

export default function TradeinCard({ item, tradeinUrl }) {
  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div style={styles.model}>{item.full_name || item.model}</div>
        <div style={styles.storage}>{item.storage}</div>
      </div>
      <div style={styles.grades}>
        {Object.entries(item.prices || {}).map(([grade, price]) => (
          <div key={grade} style={styles.gradeRow}>
            <span style={{ ...styles.badge, background: GRADE_COLORS[grade] || '#666' }}>{grade}</span>
            <span style={styles.price}>{typeof price === 'number' ? price.toLocaleString() + '원' : price}</span>
          </div>
        ))}
      </div>
      {tradeinUrl && (
        <a href={tradeinUrl} target="_blank" rel="noopener noreferrer" style={styles.btn}>
          ♻️ 트레딧 매입 신청 →
        </a>
      )}
    </div>
  );
}

const styles = {
  card: {
    minWidth: 220,
    maxWidth: 260,
    background: '#1a1a1a',
    borderRadius: 14,
    overflow: 'hidden',
    border: '1px solid #2a2a2a',
  },
  header: {
    padding: '14px 16px 8px',
    background: 'linear-gradient(135deg, #11998e, #38ef7d)',
  },
  model: { fontSize: 14, fontWeight: 800, color: '#fff' },
  storage: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  grades: { padding: '10px 16px' },
  gradeRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '5px 0',
    borderBottom: '1px solid #2a2a2a',
  },
  badge: {
    width: 24, height: 24, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: 700, color: '#fff',
  },
  price: { fontSize: 13, fontWeight: 700, color: '#fff' },
  btn: {
    display: 'block',
    textAlign: 'center',
    padding: '12px',
    background: 'linear-gradient(135deg, #11998e, #38ef7d)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    textDecoration: 'none',
  },
};
