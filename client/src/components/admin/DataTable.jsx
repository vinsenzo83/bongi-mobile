import { useState } from 'react';
import { theme } from '../../styles/admin-theme.js';

export default function DataTable({ columns, data = [], onRowClick, selectable, onSelect, pagination, emptyText = '데이터가 없습니다' }) {
  const [selected, setSelected] = useState(new Set());
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sorted = sortKey
    ? [...data].sort((a, b) => {
        const va = a[sortKey] ?? '';
        const vb = b[sortKey] ?? '';
        const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb));
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : data;

  const toggleAll = () => {
    if (selected.size === data.length) {
      setSelected(new Set());
      onSelect?.([]);
    } else {
      const all = new Set(data.map((_, i) => i));
      setSelected(all);
      onSelect?.(data);
    }
  };

  const toggleOne = (idx) => {
    const next = new Set(selected);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setSelected(next);
    onSelect?.(data.filter((_, i) => next.has(i)));
  };

  if (data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: theme.textMuted, fontSize: 14 }}>
        {emptyText}
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={styles.table}>
        <thead>
          <tr>
            {selectable && (
              <th style={styles.th}>
                <input type="checkbox" checked={selected.size === data.length} onChange={toggleAll} />
              </th>
            )}
            {columns.map(col => (
              <th
                key={col.key}
                style={{ ...styles.th, cursor: col.sortable ? 'pointer' : 'default', minWidth: col.width }}
                onClick={() => col.sortable && handleSort(col.key)}
              >
                {col.label}
                {sortKey === col.key && <span style={{ marginLeft: 4 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, idx) => (
            <tr
              key={row.id || idx}
              style={{ ...styles.tr, cursor: onRowClick ? 'pointer' : 'default' }}
              onClick={() => onRowClick?.(row)}
              onMouseEnter={e => e.currentTarget.style.background = theme.bgHover}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {selectable && (
                <td style={styles.td} onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(idx)} onChange={() => toggleOne(idx)} />
                </td>
              )}
              {columns.map(col => (
                <td key={col.key} style={styles.td}>
                  {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '-')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {pagination && (
        <div style={styles.pagination}>
          <span style={{ fontSize: 13, color: theme.textMuted }}>
            총 {pagination.total}건 (페이지 {pagination.page}/{Math.ceil(pagination.total / pagination.limit) || 1})
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              style={styles.pageBtn}
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPage(pagination.page - 1)}
            >이전</button>
            <button
              style={styles.pageBtn}
              disabled={pagination.page >= Math.ceil(pagination.total / pagination.limit)}
              onClick={() => pagination.onPage(pagination.page + 1)}
            >다음</button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 14,
  },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    color: theme.textMuted,
    fontSize: 12,
    fontWeight: 600,
    borderBottom: `1px solid ${theme.border}`,
    whiteSpace: 'nowrap',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tr: {
    transition: 'background 0.1s',
  },
  td: {
    padding: '10px 12px',
    color: theme.text,
    borderBottom: `1px solid ${theme.border}`,
    whiteSpace: 'nowrap',
  },
  pagination: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0',
  },
  pageBtn: {
    background: theme.bgInput,
    border: `1px solid ${theme.border}`,
    borderRadius: theme.radiusSm,
    color: theme.text,
    padding: '5px 12px',
    fontSize: 13,
    cursor: 'pointer',
  },
};
