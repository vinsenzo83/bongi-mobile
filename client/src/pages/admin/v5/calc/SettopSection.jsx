// V5 어드민 — 3. 셋톱박스 섹션
// 통신사별 셋톱 모델 (모델명 / 월 임대료 / 기본 / 활성 / 삭제) + 추가
import { useState } from 'react';
import { D } from '../../../../lib/quoteEngine.js';
import {
  CARRIERS, badge, tableStyle, thStyle, tdStyle,
  inputStyle, numInputStyle, btnDanger, btnSuccess,
} from './styles.js';
import { logEdit, persistDevices, resetDevices } from './store.js';
import SectionShell from './SectionShell.jsx';

const labelMap = { skt: 'SKT', kt: 'KT', lgu: 'LGU+' };

export default function SettopSection({ open, onToggle, onChange }) {
  const [, force] = useState(0);
  const refresh = () => { force((t) => t + 1); onChange && onChange(); };

  const updateName = (carrier, idx, val) => {
    const arr = D[carrier].setTopOptions;
    const old = arr[idx].name;
    arr[idx].name = String(val);
    logEdit('셋톱박스', `${labelMap[carrier]} #${idx + 1} 모델명`, old, val);
    persistDevices(); refresh();
  };
  const updateFee = (carrier, idx, val) => {
    const arr = D[carrier].setTopOptions;
    const n = parseInt(String(val).replace(/[^0-9]/g, ''), 10) || 0;
    const old = arr[idx].fee || 0;
    if (old === n) return;
    arr[idx].fee = n;
    logEdit('셋톱박스', `${labelMap[carrier]} ${arr[idx].name} 임대료`, old, n);
    persistDevices(); refresh();
  };
  const setDefault = (carrier, idx) => {
    const arr = D[carrier].setTopOptions;
    arr.forEach((o, i) => { o.isDefault = (i === idx); });
    logEdit('셋톱박스', `${labelMap[carrier]} 기본 모델`, '-', arr[idx].name);
    persistDevices(); refresh();
  };
  const toggleActive = (carrier, idx) => {
    const arr = D[carrier].setTopOptions;
    arr[idx].active = !arr[idx].active;
    logEdit('셋톱박스', `${labelMap[carrier]} ${arr[idx].name} 활성`, !arr[idx].active, arr[idx].active);
    persistDevices(); refresh();
  };
  const deleteRow = (carrier, idx) => {
    const arr = D[carrier].setTopOptions;
    if (arr.length <= 1) { alert('최소 1개 유지 필요'); return; }
    if (!confirm(`${arr[idx].name} 삭제?`)) return;
    const name = arr[idx].name;
    arr.splice(idx, 1);
    if (!arr.find((o) => o.isDefault && o.active)) {
      const f = arr.find((o) => o.active);
      if (f) f.isDefault = true;
    }
    logEdit('셋톱박스', `${labelMap[carrier]} 삭제`, name, '-');
    persistDevices(); refresh();
  };
  const addRow = (carrier) => {
    const name = prompt('모델명 (예: 스마트4)');
    if (!name) return;
    const fee = parseInt(String(prompt('월 임대료(원)') || '0').replace(/[^0-9]/g, ''), 10) || 0;
    D[carrier].setTopOptions.push({
      id: 'custom-' + Date.now(),
      name: name.trim(), fee, active: true, discountRules: [],
    });
    logEdit('셋톱박스', `${labelMap[carrier]} 추가`, '-', `${name} (${fee.toLocaleString()}원)`);
    persistDevices(); refresh();
  };

  return (
    <SectionShell
      id="sec-3"
      title="📦 3. 셋톱박스"
      note="통신사별 셋톱 모델. 기본 모델 변경 시 모든 티켓 요금 자동 재계산. 비활성 모델은 계산기 셀렉트에서 제외."
      open={open}
      onToggle={onToggle}
      onReset={() => {
        if (!confirm('셋톱박스/WiFi 변경 사항을 초기화하시겠습니까? (페이지 새로고침)')) return;
        resetDevices();
        location.reload();
      }}
    >
      {CARRIERS.map((c) => (
        <div key={c.key} style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={badge(c.key)}>{c.label}</span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>({D[c.key].setTopOptions.length}종)</span>
            <button type="button" onClick={() => addRow(c.key)} style={{ ...btnSuccess, marginLeft: 'auto', fontSize: 11, padding: '4px 10px' }}>+ 셋톱 추가</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 50 }}>기본</th>
                  <th style={thStyle}>모델명</th>
                  <th style={{ ...thStyle, width: 110 }}>월 임대료</th>
                  <th style={{ ...thStyle, width: 110 }}>할인규칙</th>
                  <th style={{ ...thStyle, width: 70 }}>활성</th>
                  <th style={{ ...thStyle, width: 50 }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {D[c.key].setTopOptions.map((opt, idx) => (
                  <tr key={opt.id || idx} style={{ background: opt.isDefault ? 'rgba(34,197,94,0.07)' : 'transparent' }}>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <input type="radio" name={`st-def-${c.key}`} checked={!!opt.isDefault} onChange={() => setDefault(c.key, idx)} />
                    </td>
                    <td style={tdStyle}>
                      <input type="text" defaultValue={opt.name}
                        onBlur={(e) => updateName(c.key, idx, e.target.value)}
                        style={inputStyle} />
                    </td>
                    <td style={tdStyle}>
                      <input type="text" inputMode="numeric" defaultValue={(opt.fee || 0).toLocaleString()}
                        onBlur={(e) => {
                          updateFee(c.key, idx, e.target.value);
                          const n = parseInt(String(e.target.value).replace(/[^0-9]/g, ''), 10) || 0;
                          e.target.value = n.toLocaleString();
                        }}
                        style={numInputStyle} />
                    </td>
                    <td style={{ ...tdStyle, fontSize: 11, color: '#94a3b8' }}>
                      {opt.discountRules && opt.discountRules.length > 0
                        ? `${opt.discountRules.length}개 (TODO Phase C2)`
                        : <span style={{ color: '#64748b' }}>없음</span>}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <input type="checkbox" checked={!!opt.active} onChange={() => toggleActive(c.key, idx)} />
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <button type="button" onClick={() => deleteRow(c.key, idx)} style={btnDanger}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </SectionShell>
  );
}
