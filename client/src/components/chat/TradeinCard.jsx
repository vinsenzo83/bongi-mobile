const GRADE_COLORS = { A: '#16a34a', B: '#2563eb', C: '#d97706', D: '#ea580c', E: '#999' };
const GRADE_DESC = { A: '외관 깨끗', B: '미세 기스', C: '눈에 보이는 기스', D: '파손/깨짐', E: '심각 손상' };

export default function TradeinCard({ item, tradeinUrl }) {
  // 데이터 형식 통합: prices 객체 or A등급/B등급 문자열
  const grades = [];
  if (item.prices) {
    Object.entries(item.prices).forEach(([g, p]) => {
      grades.push({ grade: g, price: typeof p === 'number' ? p.toLocaleString() + '원' : p });
    });
  } else {
    ['A', 'B', 'C', 'D', 'E'].forEach(g => {
      const val = item[g + '등급'];
      if (val && val !== '-') grades.push({ grade: g, price: val });
    });
  }

  const modelName = item.full_name || item.model || item['모델명'] || '';
  const storage = item.storage || item['용량'] || '';
  const maker = item.manufacturer || item['제조사'] || '';

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div style={styles.model}>{modelName}</div>
        <div style={styles.sub}>{maker} {storage}</div>
      </div>
      <div style={styles.grades}>
        {grades.map(({ grade, price }) => (
          <div key={grade} style={styles.gradeRow}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ ...styles.badge, background: GRADE_COLORS[grade] || '#666' }}>{grade}</span>
              <span style={{ fontSize: 10, color: '#999' }}>{GRADE_DESC[grade] || ''}</span>
            </div>
            <span style={styles.price}>{price}</span>
          </div>
        ))}
      </div>
      {grades.length === 0 && (
        <div style={{ padding: '16px', textAlign: 'center', color: '#999', fontSize: 12 }}>가격 정보 없음</div>
      )}
    </div>
  );
}

const styles = {
  card: {
    minWidth: 240,
    maxWidth: 300,
    background: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    border: '1px solid #e8e8e8',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  },
  header: {
    padding: '14px 16px 10px',
    background: '#1a2744',
  },
  model: { fontSize: 15, fontWeight: 800, color: '#fff' },
  sub: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  grades: { padding: '8px 16px 12px' },
  gradeRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid #f0f0f0',
  },
  badge: {
    width: 26, height: 26, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 700, color: '#fff',
  },
  price: { fontSize: 14, fontWeight: 700, color: '#1a2744' },
};
