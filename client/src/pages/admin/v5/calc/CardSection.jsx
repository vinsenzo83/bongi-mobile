// V5 어드민 — 6. 제휴카드 할인 섹션
import { useEffect, useState } from 'react';
import {
  CARRIERS, badge, tableStyle, thStyle, tdStyle,
  inputStyle, btnDanger, btnSuccess,
} from './styles.js';
import { logEdit, loadPartnerCards, savePartnerCards, resetPartnerCards } from './store.js';
import SectionShell from './SectionShell.jsx';

const labelMap = { skt: 'SKT', kt: 'KT', lgu: 'LGU+' };

export default function CardSection({ open, onToggle, onChange }) {
  const [data, setData] = useState(() => loadPartnerCards());
  const [newCard, setNewCard] = useState({ skt: {}, kt: {}, lgu: {} });

  useEffect(() => {
    if (open) setData(loadPartnerCards());
  }, [open]);

  const persist = (next) => {
    setData(next);
    savePartnerCards(next);
    onChange && onChange();
  };

  const updateField = (carrier, idx, field, val) => {
    const old = data[carrier][idx][field];
    if (old === val) return;
    const card = data[carrier][idx];
    logEdit('제휴카드', `${labelMap[carrier]} ${card.name || '#' + idx} / ${field}`, old, val);
    const next = JSON.parse(JSON.stringify(data));
    next[carrier][idx][field] = String(val);
    persist(next);
  };
  const deleteCard = (carrier, idx) => {
    const card = data[carrier][idx];
    if (!confirm(`"${card.issuer} / ${card.name}" 삭제?`)) return;
    logEdit('제휴카드', `${labelMap[carrier]} 카드 삭제`, `${card.issuer}/${card.name}`, '-');
    const next = JSON.parse(JSON.stringify(data));
    next[carrier].splice(idx, 1);
    persist(next);
  };
  const addCard = (carrier) => {
    const v = newCard[carrier] || {};
    if (!v.issuer || !v.name) { alert('카드사·카드명 필수'); return; }
    const next = JSON.parse(JSON.stringify(data));
    next[carrier].push({
      issuer: v.issuer, name: v.name,
      spend: v.spend || '-', discount: v.discount || '-',
    });
    logEdit('제휴카드', `${labelMap[carrier]} 카드 추가`, '-', `${v.issuer} / ${v.name}`);
    persist(next);
    setNewCard((s) => ({ ...s, [carrier]: {} }));
  };

  return (
    <SectionShell
      id="sec-6"
      title="💳 6. 제휴카드 할인"
      note="통신요금 자동이체 + 실적 조건 충족 시 월별 추가 할인. 셀 직접 편집 + 카드 추가/삭제."
      open={open}
      onToggle={onToggle}
      onReset={() => {
        if (!confirm('제휴카드를 초기 상태로 되돌리시겠습니까?')) return;
        resetPartnerCards();
        setData(loadPartnerCards());
        onChange && onChange();
      }}
    >
      {CARRIERS.map((c) => {
        const cards = data[c.key] || [];
        const nc = newCard[c.key] || {};
        return (
          <div key={c.key} style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={badge(c.key)}>{c.label}</span>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>({cards.length}종)</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, width: 40 }}>#</th>
                    <th style={{ ...thStyle, width: 110 }}>카드사</th>
                    <th style={thStyle}>카드명</th>
                    <th style={{ ...thStyle, width: 110 }}>실적</th>
                    <th style={{ ...thStyle, width: 200 }}>할인</th>
                    <th style={{ ...thStyle, width: 60 }}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {cards.map((card, i) => (
                    <tr key={i}>
                      <td style={{ ...tdStyle, textAlign: 'center', color: '#64748b', fontSize: 10 }}>{i + 1}</td>
                      <td style={tdStyle}>
                        <input type="text" defaultValue={card.issuer}
                          onBlur={(e) => updateField(c.key, i, 'issuer', e.target.value)}
                          style={inputStyle} />
                      </td>
                      <td style={tdStyle}>
                        <input type="text" defaultValue={card.name}
                          onBlur={(e) => updateField(c.key, i, 'name', e.target.value)}
                          style={inputStyle} />
                      </td>
                      <td style={tdStyle}>
                        <input type="text" defaultValue={card.spend}
                          onBlur={(e) => updateField(c.key, i, 'spend', e.target.value)}
                          style={inputStyle} />
                      </td>
                      <td style={tdStyle}>
                        <input type="text" defaultValue={card.discount}
                          onBlur={(e) => updateField(c.key, i, 'discount', e.target.value)}
                          style={{ ...inputStyle, color: '#fca5a5' }} />
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <button type="button" onClick={() => deleteCard(c.key, i)} style={btnDanger}>🗑</button>
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: 'rgba(34,197,94,0.06)' }}>
                    <td colSpan={6} style={{ padding: 8 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 110px 200px 70px', gap: 6, alignItems: 'center' }}>
                        <input type="text" placeholder="카드사" value={nc.issuer || ''}
                          onChange={(e) => setNewCard((s) => ({ ...s, [c.key]: { ...nc, issuer: e.target.value } }))}
                          style={inputStyle} />
                        <input type="text" placeholder="카드명" value={nc.name || ''}
                          onChange={(e) => setNewCard((s) => ({ ...s, [c.key]: { ...nc, name: e.target.value } }))}
                          style={inputStyle} />
                        <input type="text" placeholder="실적 (예: 30만원)" value={nc.spend || ''}
                          onChange={(e) => setNewCard((s) => ({ ...s, [c.key]: { ...nc, spend: e.target.value } }))}
                          style={inputStyle} />
                        <input type="text" placeholder="할인 (예: -7,000원)" value={nc.discount || ''}
                          onChange={(e) => setNewCard((s) => ({ ...s, [c.key]: { ...nc, discount: e.target.value } }))}
                          style={inputStyle} />
                        <button type="button" onClick={() => addCard(c.key)} style={btnSuccess}>+ 추가</button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </SectionShell>
  );
}
