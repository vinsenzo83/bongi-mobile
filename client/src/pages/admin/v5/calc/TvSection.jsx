// V5 어드민 — 2. TV 상품 섹션
// 통신사별 TV 상품 인라인 편집 (채널수, 상품명, 기본요금, 할인) + 추가/삭제
import { useState } from 'react';
import { D } from '../../../../lib/quoteEngine.js';
import {
  CARRIERS, badge, tableStyle, thStyle, tdStyle,
  inputStyle, numInputStyle, btnDanger, btnSuccess,
} from './styles.js';
import { logEdit, persistTv, resetTv } from './store.js';
import SectionShell from './SectionShell.jsx';

const labelMap = { skt: 'SKT', kt: 'KT', lgu: 'LGU+' };

export default function TvSection({ open, onToggle, onChange }) {
  const [, force] = useState(0);
  const refresh = () => { force((t) => t + 1); onChange && onChange(); };

  const updateField = (carrier, idx, field, val) => {
    const v = (field === 'n')
      ? String(val)
      : (parseInt(String(val).replace(/[^0-9]/g, ''), 10) || 0);
    const old = D[carrier].tv[idx][field];
    if (old === v) return;
    D[carrier].tv[idx][field] = v;
    const fl = { n: '상품명', ch: '채널수', p: '기본요금', dc: '할인', tv2Discount: 'TV2할인' }[field] || field;
    logEdit('TV 상품', `${labelMap[carrier]} ${D[carrier].tv[idx].n || '#' + idx} / ${fl}`, old, v);
    persistTv(carrier);
    refresh();
  };
  const deleteRow = (carrier, idx) => {
    if (idx === 0) { alert('"TV 없음" 행은 삭제 불가'); return; }
    if (!confirm('이 TV 상품을 삭제하시겠습니까? (티켓 리스트 자동 갱신)')) return;
    const name = D[carrier].tv[idx].n;
    D[carrier].tv.splice(idx, 1);
    logEdit('TV 상품', `${labelMap[carrier]} 삭제`, name, '-');
    persistTv(carrier);
    refresh();
  };
  const addRow = (carrier) => {
    const name = prompt('상품명 (예: B tv 신상품)');
    if (!name) return;
    const ch = parseInt(prompt('채널수') || '0', 10) || 0;
    const p = parseInt(String(prompt('기본요금(원)') || '0').replace(/[^0-9]/g, ''), 10) || 0;
    const dc = parseInt(String(prompt('할인(원)') || '0').replace(/[^0-9]/g, ''), 10) || 0;
    if (!name || p <= 0) { alert('상품명과 기본요금 필수'); return; }
    D[carrier].tv.push({ n: name, ch, p, dc, tv2Discount: 0 });
    logEdit('TV 상품', `${labelMap[carrier]} 추가`, '-', `${name} (${p.toLocaleString()}원)`);
    persistTv(carrier);
    refresh();
  };

  return (
    <SectionShell
      id="sec-2"
      title="📺 2. TV 상품"
      note="통신사별 TV 상품. 변경 즉시 사은품 카탈로그·티켓 리스트·계산기 자동 재계산. 단종 시 행 삭제. ('TV 없음'은 인덱스 0 고정 — 표에서 제외)"
      open={open}
      onToggle={onToggle}
      onReset={() => {
        if (!confirm('TV 상품 변경 사항을 초기화하시겠습니까? (페이지 새로고침)')) return;
        resetTv();
        location.reload();
      }}
    >
      {CARRIERS.map((c) => (
        <div key={c.key} style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={badge(c.key)}>{c.label}</span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>({D[c.key].tv.length - 1}개 상품)</span>
            <button type="button" onClick={() => addRow(c.key)} style={{ ...btnSuccess, marginLeft: 'auto', fontSize: 11, padding: '4px 10px' }}>+ 상품 추가</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 40 }}>#</th>
                  <th style={{ ...thStyle, width: 70 }}>채널수</th>
                  <th style={thStyle}>상품명</th>
                  <th style={{ ...thStyle, width: 110 }}>기본 요금</th>
                  <th style={{ ...thStyle, width: 100 }}>할인</th>
                  <th style={{ ...thStyle, width: 110 }}>TV2/3 추가할인</th>
                  <th style={{ ...thStyle, width: 110 }}>최종 요금</th>
                  <th style={{ ...thStyle, width: 50 }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {D[c.key].tv.map((t, i) => {
                  if (i === 0) return null;
                  const final = (t.p || 0) - (t.dc || 0);
                  return (
                    <tr key={i}>
                      <td style={{ ...tdStyle, textAlign: 'center', color: '#64748b' }}>{i}</td>
                      <td style={tdStyle}>
                        <input type="text" inputMode="numeric" defaultValue={t.ch || 0}
                          onBlur={(e) => updateField(c.key, i, 'ch', e.target.value)}
                          style={numInputStyle} />
                      </td>
                      <td style={tdStyle}>
                        <input type="text" defaultValue={t.n}
                          onBlur={(e) => updateField(c.key, i, 'n', e.target.value)}
                          style={inputStyle} />
                      </td>
                      <td style={tdStyle}>
                        <input type="text" inputMode="numeric" defaultValue={(t.p || 0).toLocaleString()}
                          onBlur={(e) => {
                            updateField(c.key, i, 'p', e.target.value);
                            const n = parseInt(String(e.target.value).replace(/[^0-9]/g, ''), 10) || 0;
                            e.target.value = n.toLocaleString();
                          }}
                          style={numInputStyle} />
                      </td>
                      <td style={tdStyle}>
                        <input type="text" inputMode="numeric" defaultValue={(t.dc || 0).toLocaleString()}
                          onBlur={(e) => {
                            updateField(c.key, i, 'dc', e.target.value);
                            const n = parseInt(String(e.target.value).replace(/[^0-9]/g, ''), 10) || 0;
                            e.target.value = n.toLocaleString();
                          }}
                          style={{ ...numInputStyle, color: '#fca5a5' }} />
                      </td>
                      <td style={tdStyle}>
                        <input type="text" inputMode="numeric" defaultValue={(t.tv2Discount || 0).toLocaleString()}
                          onBlur={(e) => {
                            updateField(c.key, i, 'tv2Discount', e.target.value);
                            const n = parseInt(String(e.target.value).replace(/[^0-9]/g, ''), 10) || 0;
                            e.target.value = n.toLocaleString();
                          }}
                          style={{ ...numInputStyle, color: '#94a3b8' }} />
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: '#86efac', fontWeight: 700 }}>
                        {final.toLocaleString()}원
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <button type="button" onClick={() => deleteRow(c.key, i)} style={btnDanger}>🗑</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </SectionShell>
  );
}
