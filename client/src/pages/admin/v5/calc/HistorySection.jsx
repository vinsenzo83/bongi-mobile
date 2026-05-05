// V5 어드민 — 10. 변경 이력 (전체 섹션 통합)
// localStorage 'bongi-edit-history' 보여주기 + 필터 + 초기화
import { useEffect, useState } from 'react';
import { tableStyle, thStyle, tdStyle, inputStyle, btnReset, SECTION_LABEL_COLORS } from './styles.js';
import { loadEditHistory, clearEditHistory } from './store.js';
import SectionShell from './SectionShell.jsx';

const SECTION_FILTERS = [
  { value: 'all', label: '전체' },
  { value: 'TV 상품', label: '2번 TV 상품' },
  { value: '셋톱박스', label: '3번 셋톱박스' },
  { value: 'WiFi', label: '1번 WiFi' },
  { value: '결합할인', label: '4번 결합할인' },
  { value: '설치비', label: '5번 설치비' },
  { value: '제휴카드', label: '6번 제휴카드' },
  { value: '사은품', label: '8번 사은품' },
];

function formatTimestamp(iso) {
  try {
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return iso;
  }
}

export default function HistorySection({ open, onToggle, refreshKey }) {
  const [filter, setFilter] = useState('all');
  const [hist, setHist] = useState([]);

  useEffect(() => {
    setHist(loadEditHistory());
  }, [open, refreshKey]);

  const filtered = filter === 'all' ? hist : hist.filter((h) => h.section === filter);
  const total = hist.length;

  const onClear = () => {
    if (!confirm('전체 변경 이력을 모두 삭제하시겠습니까?')) return;
    clearEditHistory();
    setHist([]);
  };

  return (
    <SectionShell
      id="sec-10"
      title="📜 10. 변경 이력 (전체 섹션 통합)"
      note="모든 섹션의 데이터 변경을 시간순으로 기록. localStorage 영구 저장 (최대 500건)."
      open={open}
      onToggle={onToggle}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ ...inputStyle, width: 180, padding: '6px 8px' }}>
          {SECTION_FILTERS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>총 {filtered.length}건 (전체 {total} / 최대 500)</span>
        <button type="button" onClick={onClear} style={{ ...btnReset, marginLeft: 'auto' }}>↻ 이력 초기화</button>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#64748b', padding: 20, fontSize: 12 }}>변경 이력 없음</div>
      ) : (
        <div style={{ overflowX: 'auto', maxHeight: 500, overflowY: 'auto', border: '1px solid #334155', borderRadius: 8 }}>
          <table style={tableStyle}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
              <tr>
                <th style={{ ...thStyle, width: 150 }}>시각</th>
                <th style={{ ...thStyle, width: 100 }}>섹션</th>
                <th style={thStyle}>변경 항목</th>
                <th style={{ ...thStyle, width: 120, textAlign: 'right' }}>변경 전</th>
                <th style={{ ...thStyle, width: 120, textAlign: 'right' }}>변경 후</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((h, i) => {
                const clr = SECTION_LABEL_COLORS[h.section] || '#64748b';
                const fromStr = (typeof h.from === 'number') ? h.from.toLocaleString() : String(h.from);
                const toStr = (typeof h.to === 'number') ? h.to.toLocaleString() : String(h.to);
                return (
                  <tr key={i}>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 10 }}>{formatTimestamp(h.at)}</td>
                    <td style={tdStyle}>
                      <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: 4, background: `${clr}33`, color: clr, fontSize: 10, fontWeight: 700 }}>
                        {h.section}
                      </span>
                    </td>
                    <td style={tdStyle}>{h.label}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: '#fca5a5' }}>{fromStr}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: '#86efac', fontWeight: 700 }}>{toStr}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {filtered.length > 200 && (
        <div style={{ fontSize: 10, color: '#64748b', textAlign: 'center', marginTop: 6 }}>
          최근 200건 표시 · 총 {filtered.length}건 보존
        </div>
      )}
    </SectionShell>
  );
}
