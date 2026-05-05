// V5 어드민 — 요금 계산기 데이터 (CalcData) 섹션 공용 collapsible shell
import { sectionStyle, sectionHeaderStyle, sectionBodyStyle, noteStyle, btnReset } from './styles.js';

export default function SectionShell({ id, title, note, open, onToggle, onReset, children }) {
  return (
    <section id={id} style={{ ...sectionStyle, scrollMarginTop: 64 }}>
      <header
        style={sectionHeaderStyle(open)}
        onClick={onToggle}
        role="button"
        aria-expanded={open}
      >
        <span style={{ display: 'inline-block', transition: 'transform 0.18s', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▼</span>
        <span style={{ flex: 1 }}>{title}</span>
        {onReset && open && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onReset(); }}
            style={btnReset}
          >↻ 초기화</button>
        )}
      </header>
      {open && (
        <div style={sectionBodyStyle}>
          {note && <div style={noteStyle}>{note}</div>}
          {children}
        </div>
      )}
    </section>
  );
}
