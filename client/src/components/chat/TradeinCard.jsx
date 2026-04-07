const GRADE_COLORS = { A: '#16a34a', B: '#2563eb', C: '#d97706', D: '#ea580c', E: '#999' };
const GRADE_DESC = { A: '외관 깨끗', B: '미세 기스', C: '눈에 보이는 기스', D: '파손/깨짐', E: '심각 손상' };

export default function TradeinCard({ item, tradeinUrl, onAction }) {
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
    <div style={s.card}>
      {/* 헤더 */}
      <div style={s.header}>
        <span style={s.makerBadge}>{maker || '중고폰'}</span>
        <span style={s.model}>{modelName}</span>
        {storage && <span style={s.storage}>{storage}</span>}
      </div>

      {/* 등급별 가격 */}
      <div style={s.gradeSection}>
        {grades.map(({ grade, price }) => (
          <div key={grade} style={s.gradeRow}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ ...s.gradeBadge, background: GRADE_COLORS[grade] || '#666' }}>{grade}</span>
              <span style={s.gradeDesc}>{GRADE_DESC[grade] || ''}</span>
            </div>
            <span style={{ ...s.gradePrice, color: GRADE_COLORS[grade] || '#1a2744' }}>{price}</span>
          </div>
        ))}
        {grades.length === 0 && (
          <div style={{ padding: 12, textAlign: 'center', color: '#999', fontSize: 12 }}>가격 정보를 불러올 수 없습니다</div>
        )}
      </div>

      {/* 안내 */}
      <div style={s.notice}>정확한 금액은 기기 검수 후 확정됩니다</div>

      {/* 하단 버튼 */}
      {onAction && (
        <div style={s.actions}>
          <button style={s.actionPrimary} onClick={() => {
            const name = item.full_name || item.model || item['모델명'] || '';
            const storage = item.storage || item['용량'] || '';
            localStorage.setItem('apply_model', name);
            localStorage.setItem('apply_storage', storage);
            localStorage.setItem('apply_price', item['A등급'] || '');
            window.location.href = '/apply/used-phone?model=' + encodeURIComponent(name) + '&storage=' + encodeURIComponent(storage);
          }}>
            {'📦'} 접수하기
          </button>
          <button style={s.actionSecondary} onClick={() => onAction('__open_usedphone_select__')}>
            다른 모델
          </button>
        </div>
      )}
    </div>
  );
}

const s = {
  card: {
    minWidth: 260, maxWidth: 300, background: '#fff', borderRadius: 12,
    overflow: 'hidden', border: '1px solid #e8e8e8', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  },
  header: {
    padding: '14px 16px 10px', borderBottom: '1px solid #f0f0f0',
  },
  makerBadge: {
    fontSize: 10, padding: '2px 8px', borderRadius: 4, background: '#1a2744',
    color: '#fff', fontWeight: 600, marginRight: 6,
  },
  model: { fontSize: 15, fontWeight: 800, color: '#1a2744', display: 'block', marginTop: 6 },
  storage: { fontSize: 12, color: '#999', marginTop: 2, display: 'block' },
  gradeSection: { padding: '8px 16px' },
  gradeRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 0', borderBottom: '1px solid #f5f5f5',
  },
  gradeBadge: {
    width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff',
  },
  gradeDesc: { fontSize: 11, color: '#999' },
  gradePrice: { fontSize: 15, fontWeight: 700 },
  notice: { padding: '6px 16px', fontSize: 10, color: '#999', textAlign: 'center', background: '#f8f9fc' },
  actions: { display: 'flex', borderTop: '1px solid #f0f0f0' },
  actionPrimary: {
    flex: 2, padding: '12px', border: 'none', background: '#2563eb', color: '#fff',
    fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
  },
  actionSecondary: {
    flex: 1, padding: '12px', border: 'none', borderLeft: '1px solid #e8e8e8',
    background: '#f8f9fc', color: '#555', fontSize: 12, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
  },
};
