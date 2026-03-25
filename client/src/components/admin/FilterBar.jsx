import { useState } from 'react';
import { theme, input as inputStyle } from '../../styles/admin-theme.js';

export default function FilterBar({ filters = [], searchPlaceholder = '검색...', onSearch, onFilter, children }) {
  const [search, setSearch] = useState('');

  const handleSearch = (e) => {
    const val = e.target.value;
    setSearch(val);
    onSearch?.(val);
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.left}>
        {filters.map(f => (
          <select
            key={f.key}
            style={styles.select}
            onChange={e => onFilter?.(f.key, e.target.value)}
            defaultValue=""
          >
            <option value="">{f.label}</option>
            {f.options.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ))}
      </div>
      <div style={styles.right}>
        {children}
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={search}
          onChange={handleSearch}
          style={{ ...inputStyle, maxWidth: 240 }}
        />
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  left: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  right: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  select: {
    background: theme.bgInput,
    border: `1px solid ${theme.border}`,
    borderRadius: theme.radius,
    color: theme.text,
    padding: '7px 10px',
    fontSize: 13,
    outline: 'none',
    cursor: 'pointer',
  },
};
