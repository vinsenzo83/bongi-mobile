import { theme } from '../../styles/admin-theme.js';

export default function TabGroup({ tabs, active, onChange }) {
  return (
    <div style={styles.wrap}>
      {tabs.map(tab => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            style={{
              ...styles.tab,
              ...(isActive ? styles.active : {}),
            }}
            onClick={() => onChange(tab.key)}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span style={{
                ...styles.count,
                background: isActive ? theme.blue : theme.bgHover,
              }}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

const styles = {
  wrap: {
    display: 'flex',
    gap: 2,
    background: theme.bgInput,
    borderRadius: theme.radius,
    padding: 2,
    overflow: 'auto',
  },
  tab: {
    background: 'transparent',
    border: 'none',
    color: theme.textMuted,
    fontSize: 13,
    fontWeight: 500,
    padding: '7px 14px',
    borderRadius: 6,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    transition: 'all 0.15s',
  },
  active: {
    background: theme.bgCard,
    color: theme.textWhite,
    fontWeight: 600,
  },
  count: {
    fontSize: 11,
    padding: '1px 6px',
    borderRadius: 8,
    color: theme.textWhite,
    fontWeight: 600,
  },
};
