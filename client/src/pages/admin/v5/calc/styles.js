// V5 어드민 — 요금 계산기 (CalcData) 공유 스타일
// 다크 테마 일관성 유지용

export const sectionStyle = {
  background: 'linear-gradient(135deg,#1e293b,#0f172a)',
  border: '1px solid #475569',
  borderRadius: 12,
  marginBottom: 12,
  overflow: 'hidden',
};

export const sectionHeaderStyle = (open) => ({
  cursor: 'pointer',
  padding: '16px 22px',
  fontSize: 16,
  fontWeight: 900,
  color: '#fbbf24',
  letterSpacing: '0.02em',
  borderBottom: open ? '1px solid #334155' : 'none',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  userSelect: 'none',
});

export const sectionBodyStyle = {
  padding: '18px 22px',
};

export const noteStyle = {
  fontSize: 11.5,
  color: '#94a3b8',
  lineHeight: 1.6,
  marginBottom: 12,
};

export const subTitleStyle = {
  fontSize: 12,
  color: '#cbd5e1',
  fontWeight: 800,
  marginTop: 14,
  marginBottom: 8,
  letterSpacing: '0.04em',
};

export const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 12,
};

export const thStyle = {
  background: '#334155',
  color: '#f1f5f9',
  fontSize: 11,
  padding: '8px 8px',
  textAlign: 'left',
  fontWeight: 700,
  borderBottom: '1px solid #475569',
};

export const tdStyle = {
  fontSize: 12,
  color: '#e2e8f0',
  padding: '6px 8px',
  borderBottom: '1px solid #334155',
  verticalAlign: 'middle',
};

export const inputStyle = {
  background: '#0f172a',
  border: '1px solid #475569',
  color: '#e2e8f0',
  padding: '6px 8px',
  borderRadius: 5,
  fontSize: 12,
  width: '100%',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  colorScheme: 'dark',
};

export const numInputStyle = {
  ...inputStyle,
  textAlign: 'right',
  fontFamily: '"SF Mono", Monaco, monospace',
  color: '#fde68a',
  fontWeight: 700,
};

export const btnPrimary = {
  background: '#3b82f6',
  color: '#fff',
  border: 'none',
  padding: '6px 14px',
  borderRadius: 6,
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
};

export const btnSuccess = {
  background: '#16a34a',
  color: '#fff',
  border: 'none',
  padding: '6px 14px',
  borderRadius: 6,
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
};

export const btnDanger = {
  background: 'transparent',
  color: '#fca5a5',
  border: '1px solid #7f1d1d',
  padding: '4px 10px',
  borderRadius: 5,
  fontWeight: 700,
  fontSize: 11,
  cursor: 'pointer',
};

export const btnReset = {
  background: 'transparent',
  color: '#fca5a5',
  border: '1px solid #b91c1c',
  padding: '5px 12px',
  borderRadius: 6,
  fontWeight: 700,
  fontSize: 11,
  cursor: 'pointer',
};

export const badge = (carrierKey) => {
  const map = {
    skt: { bg: '#7f1d1d', c: '#fecaca', label: 'SKT' },
    kt: { bg: '#1e3a8a', c: '#bfdbfe', label: 'KT' },
    lgu: { bg: '#831843', c: '#fbcfe8', label: 'LGU+' },
  };
  const m = map[carrierKey] || { bg: '#475569', c: '#cbd5e1', label: carrierKey };
  return {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 5,
    background: m.bg,
    color: m.c,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.04em',
  };
};

export const CARRIERS = [
  { key: 'skt', label: 'SKT' },
  { key: 'lgu', label: 'LGU+' },
  { key: 'kt', label: 'KT' },
];

export const SECTION_LABEL_COLORS = {
  'TV 상품': '#3b82f6',
  '셋톱박스': '#0891b2',
  WiFi: '#7c3aed',
  결합할인: '#fbbf24',
  설치비: '#10b981',
  제휴카드: '#dc2626',
  사은품: '#f59e0b',
};
