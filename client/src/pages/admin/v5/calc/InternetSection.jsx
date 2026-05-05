// V5 어드민 — 1. 인터넷·WiFi 섹션
// - 통신사별 인터넷 단독가는 D 객체 직접 편집은 안 하고 read-only로 표시 (3사 동일 22k/33k/38.5k)
// - WiFi 옵션 (모델 추가/삭제/요금 편집/디폴트 전환)
import { useState } from 'react';
import { D } from '../../../../lib/quoteEngine.js';
import {
  CARRIERS, badge, subTitleStyle, tableStyle, thStyle, tdStyle,
  inputStyle, numInputStyle, btnDanger, btnSuccess,
} from './styles.js';
import { logEdit, persistDevices, resetDevices } from './store.js';
import SectionShell from './SectionShell.jsx';

const labelMap = { skt: 'SKT', kt: 'KT', lgu: 'LGU+' };

export default function InternetSection({ open, onToggle, onChange }) {
  const [tick, setTick] = useState(0);  // forceRender
  const refresh = () => { setTick((t) => t + 1); onChange && onChange(); };

  const updateWifiName = (carrierKey, idx, val) => {
    const arr = D[carrierKey].wifiOptions;
    const old = arr[idx].name;
    arr[idx].name = String(val);
    logEdit('WiFi', `${labelMap[carrierKey]} #${idx + 1} 모델명`, old, val);
    persistDevices();
    refresh();
  };
  const updateWifiFee = (carrierKey, idx, sp, val) => {
    const arr = D[carrierKey].wifiOptions;
    if (!arr[idx].fees) arr[idx].fees = { '100M': 0, '500M': 0, '1G': 0 };
    const n = parseInt(String(val).replace(/[^0-9]/g, ''), 10) || 0;
    const old = arr[idx].fees[sp] || 0;
    if (old === n) return;
    arr[idx].fees[sp] = n;
    logEdit('WiFi', `${labelMap[carrierKey]} ${arr[idx].name} ${sp}`, old, n);
    persistDevices();
    refresh();
  };
  const setDefault = (carrierKey, idx) => {
    const arr = D[carrierKey].wifiOptions;
    arr.forEach((o, i) => { o.isDefault = (i === idx); });
    logEdit('WiFi', `${labelMap[carrierKey]} 기본 모델`, '-', arr[idx].name);
    persistDevices();
    refresh();
  };
  const toggleActive = (carrierKey, idx) => {
    const arr = D[carrierKey].wifiOptions;
    arr[idx].active = !arr[idx].active;
    logEdit('WiFi', `${labelMap[carrierKey]} ${arr[idx].name} 활성`, !arr[idx].active, arr[idx].active);
    persistDevices();
    refresh();
  };
  const deleteRow = (carrierKey, idx) => {
    const arr = D[carrierKey].wifiOptions;
    if (arr.length <= 1) { alert('최소 1개는 유지해야 합니다.'); return; }
    if (!confirm(`${arr[idx].name} 모델을 삭제하시겠습니까?`)) return;
    const name = arr[idx].name;
    arr.splice(idx, 1);
    if (!arr.find((o) => o.isDefault && o.active)) {
      const f = arr.find((o) => o.active);
      if (f) f.isDefault = true;
    }
    logEdit('WiFi', `${labelMap[carrierKey]} 삭제`, name, '-');
    persistDevices();
    refresh();
  };
  const addRow = (carrierKey) => {
    const name = prompt('새 WiFi 모델명을 입력하세요 (예: GIGA WiFi 7)');
    if (!name) return;
    D[carrierKey].wifiOptions.push({
      id: 'custom-' + Date.now(),
      name: name.trim(),
      fees: { '100M': 0, '500M': 0, '1G': 0 },
      active: true,
    });
    logEdit('WiFi', `${labelMap[carrierKey]} 추가`, '-', name);
    persistDevices();
    refresh();
  };

  return (
    <SectionShell
      id="sec-1"
      title="📡 1. 인터넷 · WiFi"
      note="인터넷 단독: 100M 22,000원 / 500M 33,000원 / 1G 38,500원 (3사 공통, 3년 약정). WiFi 모델 추가·삭제·기본 전환 시 모든 티켓 요금 자동 재계산 (티켓번호는 유지)."
      open={open}
      onToggle={onToggle}
      onReset={() => {
        if (!confirm('WiFi/셋톱박스 변경 사항을 초기화하시겠습니까? (페이지 새로고침)')) return;
        resetDevices();
        location.reload();
      }}
    >
      {CARRIERS.map((c) => (
        <div key={c.key} style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={badge(c.key)}>{c.label}</span>
            <span style={subTitleStyle}>WiFi 공유기 ({D[c.key].wifiOptions.length}개)</span>
            <button type="button" onClick={() => addRow(c.key)} style={{ ...btnSuccess, marginLeft: 'auto', fontSize: 11, padding: '4px 10px' }}>+ 모델 추가</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 50 }}>기본</th>
                  <th style={thStyle}>모델명</th>
                  <th style={{ ...thStyle, width: 90 }}>100M</th>
                  <th style={{ ...thStyle, width: 90 }}>500M</th>
                  <th style={{ ...thStyle, width: 90 }}>1G</th>
                  <th style={{ ...thStyle, width: 70 }}>활성</th>
                  <th style={{ ...thStyle, width: 50 }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {D[c.key].wifiOptions.map((opt, idx) => (
                  <tr key={opt.id || idx} style={{ background: opt.isDefault ? 'rgba(34,197,94,0.07)' : 'transparent' }}>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <input type="radio" name={`wf-def-${c.key}`} checked={!!opt.isDefault} onChange={() => setDefault(c.key, idx)} />
                    </td>
                    <td style={tdStyle}>
                      <input type="text" defaultValue={opt.name} onBlur={(e) => updateWifiName(c.key, idx, e.target.value)} style={inputStyle} />
                    </td>
                    {['100M', '500M', '1G'].map((sp) => (
                      <td key={sp} style={tdStyle}>
                        <input
                          type="text" inputMode="numeric"
                          defaultValue={(opt.fees ? opt.fees[sp] || 0 : 0).toLocaleString()}
                          onBlur={(e) => {
                            updateWifiFee(c.key, idx, sp, e.target.value);
                            const n = parseInt(String(e.target.value).replace(/[^0-9]/g, ''), 10) || 0;
                            e.target.value = n.toLocaleString();
                          }}
                          style={numInputStyle}
                        />
                      </td>
                    ))}
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
