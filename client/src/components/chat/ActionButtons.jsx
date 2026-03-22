export default function ActionButtons({ buttons, onAction }) {
  if (!buttons || buttons.length === 0) return null;

  return (
    <div style={styles.container}>
      {buttons.map((btn, i) => (
        <button
          key={i}
          onClick={() => onAction(btn.action)}
          style={styles.button}
          onMouseEnter={e => { e.target.style.background = '#3a3a3a'; e.target.style.borderColor = '#666'; }}
          onMouseLeave={e => { e.target.style.background = '#2a2a2a'; e.target.style.borderColor = '#444'; }}
        >
          {btn.label}
        </button>
      ))}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  button: {
    padding: '8px 14px',
    borderRadius: 18,
    border: '1px solid #444',
    background: '#2a2a2a',
    color: '#ccc',
    fontSize: 13,
    cursor: 'pointer',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap',
  },
};
