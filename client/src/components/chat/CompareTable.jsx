export default function CompareTable({ items, onAction }) {
  if (!items || items.length === 0) return null;

  // 모든 키 수집 (상품번호 제외)
  const allKeys = [...new Set(items.flatMap(Object.keys))].filter(k => k !== '상품번호' && k !== 'error');

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>항목</th>
              {items.map((item, i) => (
                <th key={i} style={styles.th}>
                  <span style={styles.badge}>{item.상품번호}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allKeys.map(key => (
              <tr key={key}>
                <td style={styles.labelTd}>{key}</td>
                {items.map((item, i) => (
                  <td key={i} style={styles.td}>{item[key] || '-'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {onAction && items.length > 0 && (
        <div style={styles.actions}>
          {items.filter(i => i.상품번호).map((item, i) => (
            <button
              key={i}
              style={styles.btn}
              onClick={() => onAction(`${item.상품번호} 가입 상담 받고 싶어요`)}
            >
              {item.상품번호} 가입
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  wrapper: { marginTop: 8 },
  container: {
    overflowX: 'auto',
    borderRadius: 10,
    border: '1px solid #333',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    background: '#1a1a1a',
    fontSize: 13,
  },
  th: {
    padding: '8px 12px',
    borderBottom: '2px solid #444',
    textAlign: 'center',
    color: '#fff',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  badge: {
    background: '#5b5fc7',
    color: '#fff',
    fontSize: 11,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 10,
  },
  labelTd: {
    padding: '6px 12px',
    borderBottom: '1px solid #333',
    color: '#999',
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '6px 12px',
    borderBottom: '1px solid #333',
    color: '#d1d5db',
    textAlign: 'center',
  },
  actions: {
    display: 'flex',
    gap: 8,
    marginTop: 8,
  },
  btn: {
    padding: '7px 14px',
    borderRadius: 8,
    border: '1px solid #444',
    background: '#2a2a2a',
    color: '#ccc',
    fontSize: 12,
    cursor: 'pointer',
  },
};
