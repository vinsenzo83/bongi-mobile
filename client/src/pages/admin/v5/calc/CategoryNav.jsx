// V5 어드민 — 요금 계산기 데이터 (CalcData)
// sticky 상단 nav: 섹션 점프 + 펼침
import React from 'react';

const NAV_BG = 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)';

const navWrapStyle = {
  position: 'sticky',
  top: 0,
  zIndex: 50,
  background: NAV_BG,
  borderBottom: '1px solid #334155',
  padding: '10px 14px',
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 6,
  marginBottom: 16,
  marginLeft: -24,
  marginRight: -24,
  marginTop: -24,
};

const titleStyle = {
  fontSize: 13,
  fontWeight: 900,
  color: '#fbbf24',
  marginRight: 12,
  letterSpacing: '0.06em',
};

const linkStyle = {
  padding: '6px 11px',
  borderRadius: 6,
  fontSize: 11.5,
  fontWeight: 700,
  color: '#cbd5e1',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  cursor: 'pointer',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
};

const linkHoverStyle = {
  background: 'rgba(59,130,246,0.18)',
  color: '#fff',
  borderColor: '#3b82f6',
};

export default function CategoryNav({ items, onJump }) {
  const [hover, setHover] = React.useState(null);
  return (
    <nav style={navWrapStyle}>
      <span style={titleStyle}>⚡ TM 데이터 관리</span>
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={() => onJump(it.id)}
          onMouseEnter={() => setHover(it.id)}
          onMouseLeave={() => setHover(null)}
          style={hover === it.id ? { ...linkStyle, ...linkHoverStyle } : linkStyle}
        >
          {it.label}
        </button>
      ))}
    </nav>
  );
}
