// V5 어드민 — 5. 설치비 섹션
// 통신사 × 평일/주말 × 컬럼(인터넷/TV/추가/등). vanilla INSTALL_FEES_KEY 사용.
import { useEffect, useState } from 'react';
import {
  CARRIERS, badge, tableStyle, thStyle, tdStyle,
  inputStyle, numInputStyle, btnDanger, btnSuccess,
} from './styles.js';
import { logEdit, loadInstallFees, saveInstallFees, resetInstallFees } from './store.js';
import SectionShell from './SectionShell.jsx';

const labelMap = { skt: 'SKT', kt: 'KT', lgu: 'LGU+' };

export default function InstallSection({ open, onToggle, onChange }) {
  const [data, setData] = useState(() => loadInstallFees());

  useEffect(() => {
    if (open) setData(loadInstallFees());
  }, [open]);

  const persist = (next) => {
    setData(next);
    saveInstallFees(next);
    onChange && onChange();
  };

  const updateFee = (carrier, day, colIdx, val) => {
    const n = parseInt(String(val).replace(/[^0-9]/g, ''), 10) || 0;
    const old = data[carrier][day][colIdx];
    if (old === n) return;
    const dayLabel = day === 'weekday' ? '평일' : '주말';
    const colName = data[carrier].columns[colIdx];
    logEdit('설치비', `${labelMap[carrier]} ${dayLabel} / ${colName}`, old, n);
    const next = JSON.parse(JSON.stringify(data));
    next[carrier][day][colIdx] = n;
    persist(next);
  };
  const updateColName = (carrier, colIdx, val) => {
    const old = data[carrier].columns[colIdx];
    if (old === val) return;
    logEdit('설치비', `${labelMap[carrier]} 컬럼명`, old, val);
    const next = JSON.parse(JSON.stringify(data));
    next[carrier].columns[colIdx] = String(val).trim() || `컬럼${colIdx + 1}`;
    persist(next);
  };
  const addCol = (carrier) => {
    const name = prompt('새 컬럼 이름 (예: WiFi 추가)');
    if (!name) return;
    const next = JSON.parse(JSON.stringify(data));
    next[carrier].columns.push(name.trim());
    next[carrier].weekday.push(0);
    next[carrier].weekend.push(0);
    logEdit('설치비', `${labelMap[carrier]} 컬럼 추가`, '-', name);
    persist(next);
  };
  const delCol = (carrier, colIdx) => {
    const colName = data[carrier].columns[colIdx];
    if (!confirm(`컬럼 "${colName}"을 삭제하시겠습니까?`)) return;
    const next = JSON.parse(JSON.stringify(data));
    next[carrier].columns.splice(colIdx, 1);
    next[carrier].weekday.splice(colIdx, 1);
    next[carrier].weekend.splice(colIdx, 1);
    logEdit('설치비', `${labelMap[carrier]} 컬럼 삭제`, colName, '-');
    persist(next);
  };

  return (
    <SectionShell
      id="sec-5"
      title="🔧 5. 설치비"
      note="통신사 × 평일/주말 × 추가 TV. 셀 클릭 편집. 컬럼 이름·추가·삭제 가능. 주말 설치비는 평일 대비 약 25% 할증."
      open={open}
      onToggle={onToggle}
      onReset={() => {
        if (!confirm('설치비를 초기 상태로 되돌리시겠습니까?')) return;
        resetInstallFees();
        setData(loadInstallFees());
        onChange && onChange();
      }}
    >
      {CARRIERS.map((c) => {
        const d = data[c.key];
        if (!d) return null;
        return (
          <div key={c.key} style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={badge(c.key)}>{c.label}</span>
              <button type="button" onClick={() => addCol(c.key)} style={{ ...btnSuccess, marginLeft: 'auto', fontSize: 11, padding: '4px 10px' }}>+ 컬럼 추가</button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, width: 80 }}>구분</th>
                    {d.columns.map((col, i) => (
                      <th key={i} style={{ ...thStyle, minWidth: 130 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input type="text" defaultValue={col}
                            onBlur={(e) => updateColName(c.key, i, e.target.value)}
                            style={{ ...inputStyle, fontSize: 11, fontWeight: 700 }} />
                          <button type="button" onClick={() => delCol(c.key, i)} style={btnDanger}>🗑</button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[['weekday', '평일'], ['weekend', '주말']].map(([dayKey, dayLabel]) => (
                    <tr key={dayKey}>
                      <td style={{ ...tdStyle, fontWeight: 800 }}>{dayLabel}</td>
                      {d[dayKey].map((v, i) => (
                        <td key={i} style={tdStyle}>
                          <input type="text" inputMode="numeric"
                            defaultValue={(v || 0).toLocaleString()}
                            onBlur={(e) => {
                              updateFee(c.key, dayKey, i, e.target.value);
                              const n = parseInt(String(e.target.value).replace(/[^0-9]/g, ''), 10) || 0;
                              e.target.value = n.toLocaleString();
                            }}
                            style={numInputStyle} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </SectionShell>
  );
}
