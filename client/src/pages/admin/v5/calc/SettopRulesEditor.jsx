// V5 어드민 — 셋톱 할인규칙 편집 모달 (Phase C2)
// vanilla openRulesEditor (docs/calculator.html line ~2050) 의 React 포팅
import { useState } from 'react';
import { D } from '../../../../lib/quoteEngine.js';
import { logEdit, persistDevices } from './store.js';
import {
  badge, inputStyle, numInputStyle, btnSuccess, btnDanger, btnPrimary,
  tableStyle, thStyle, tdStyle,
} from './styles.js';

const SPEEDS_OPT = ['100M', '500M', '1G'];
const labelMap = { skt: 'SKT', kt: 'KT', lgu: 'LGU+' };

function num(val) {
  return parseInt(String(val).replace(/[^0-9]/g, ''), 10) || 0;
}

export default function SettopRulesEditor({ carrier, settopId, onClose, onChange }) {
  const [, force] = useState(0);
  const refresh = () => { force((t) => t + 1); onChange && onChange(); };

  const settop = D[carrier].setTopOptions.find((o) => o.id === settopId);
  if (!settop) return null;
  if (!settop.discountRules) settop.discountRules = [];

  const updField = (idx, field, value) => {
    const rule = settop.discountRules[idx];
    if (!rule) return;
    const old = rule[field];
    if (field === 'discount') rule[field] = num(value);
    else if (field === 'active') rule[field] = !!value;
    else if (field === 'speeds') {
      // value can be array (from checkbox toggle) or comma string
      if (Array.isArray(value)) rule[field] = value;
      else rule[field] = String(value).split(',').map((s) => s.trim()).filter(Boolean);
    }
    else if (field === 'startDate' || field === 'endDate') rule[field] = value || null;
    else rule[field] = String(value);
    logEdit('셋톱박스', `${labelMap[carrier]} ${settop.name} 규칙 ${rule.name || '#' + idx} / ${field}`, old, rule[field]);
    persistDevices();
    refresh();
  };

  const toggleSpeed = (idx, speed) => {
    const rule = settop.discountRules[idx];
    const set = new Set(rule.speeds || []);
    if (set.has(speed)) set.delete(speed); else set.add(speed);
    updField(idx, 'speeds', Array.from(set));
  };

  const addRule = () => {
    settop.discountRules.push({
      id: 'rule-' + Date.now(),
      name: '새 규칙',
      type: 'base',
      speeds: ['500M', '1G'],
      tvNameContains: '',
      discount: 0,
      startDate: null,
      endDate: null,
      active: true,
    });
    logEdit('셋톱박스', `${labelMap[carrier]} ${settop.name} 규칙 추가`, '-', '새 규칙');
    persistDevices();
    refresh();
  };

  const delRule = (idx) => {
    const rule = settop.discountRules[idx];
    if (!confirm(`규칙 [${rule.name}] 삭제?`)) return;
    const name = rule.name;
    settop.discountRules.splice(idx, 1);
    logEdit('셋톱박스', `${labelMap[carrier]} ${settop.name} 규칙 삭제`, name, '-');
    persistDevices();
    refresh();
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg,#1e293b,#0f172a)',
          border: '1px solid #475569',
          borderRadius: 12,
          padding: '18px 22px',
          width: 760,
          maxWidth: '95vw',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          color: '#e2e8f0',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 14, color: '#fbbf24', fontWeight: 800 }}>
            <span style={badge(carrier)}>{labelMap[carrier]}</span>{' '}
            ⚙ {settop.name} 할인 규칙 편집
          </h3>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#94a3b8' }}>×</button>
        </div>

        {settop.discountRules.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 12, background: '#0f172a', border: '1px dashed #475569', borderRadius: 8, marginBottom: 12 }}>
            규칙 없음. 아래 버튼으로 추가하세요.
          </div>
        )}

        {settop.discountRules.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
            {settop.discountRules.map((r, idx) => {
              const typeBg = r.type === 'promo' ? 'rgba(245,158,11,0.10)' : 'rgba(59,130,246,0.10)';
              const typeBorder = r.type === 'promo' ? '#f59e0b' : '#3b82f6';
              return (
                <div key={r.id || idx} style={{ border: `1.5px solid ${typeBorder}`, background: typeBg, borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 110px 50px', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <select value={r.type || 'base'} onChange={(e) => updField(idx, 'type', e.target.value)}
                      style={{ ...inputStyle, padding: '5px 6px', fontSize: 11 }}>
                      <option value="base">base</option>
                      <option value="promo">promo</option>
                    </select>
                    <input type="text" defaultValue={r.name || ''} placeholder="규칙명"
                      onBlur={(e) => updField(idx, 'name', e.target.value)}
                      style={{ ...inputStyle, fontSize: 11 }} />
                    <input type="text" inputMode="numeric" defaultValue={(r.discount || 0).toLocaleString()}
                      placeholder="할인 (원)"
                      onBlur={(e) => {
                        updField(idx, 'discount', e.target.value);
                        e.target.value = num(e.target.value).toLocaleString();
                      }}
                      style={{ ...numInputStyle, fontSize: 11 }} />
                    <button type="button" onClick={() => delRule(idx)} style={btnDanger}>🗑</button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 130px 70px', gap: 8, alignItems: 'center' }}>
                    <input type="text" defaultValue={r.tvNameContains || ''} placeholder="TV명 포함 (예: 올 플러스)"
                      onBlur={(e) => updField(idx, 'tvNameContains', e.target.value)}
                      style={{ ...inputStyle, fontSize: 11 }} />
                    <input type="date" value={r.startDate || ''}
                      onChange={(e) => updField(idx, 'startDate', e.target.value)}
                      style={{ ...inputStyle, fontSize: 11 }} />
                    <input type="date" value={r.endDate || ''}
                      onChange={(e) => updField(idx, 'endDate', e.target.value)}
                      style={{ ...inputStyle, fontSize: 11 }} />
                    <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, color: '#cbd5e1' }}>
                      <input type="checkbox" checked={!!r.active}
                        onChange={(e) => updField(idx, 'active', e.target.checked)} />
                      활성
                    </label>
                  </div>

                  <div style={{ marginTop: 8, fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 700 }}>대상 속도:</span>
                    {SPEEDS_OPT.map((sp) => {
                      const on = (r.speeds || []).includes(sp);
                      return (
                        <label key={sp} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                          <input type="checkbox" checked={on} onChange={() => toggleSpeed(idx, sp)} />
                          <span style={{ color: on ? '#fde68a' : '#94a3b8', fontWeight: on ? 700 : 400 }}>{sp}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button type="button" onClick={addRule}
          style={{
            width: '100%', padding: '10px',
            border: '1.5px dashed #6366f1', background: 'transparent',
            color: '#a5b4fc', borderRadius: 8,
            fontSize: 12, fontWeight: 800, cursor: 'pointer',
          }}
        >+ 새 할인 규칙 추가</button>

        <div style={{ fontSize: 10, color: '#64748b', marginTop: 10, lineHeight: 1.6 }}>
          ※ <b>type</b>: base = 상시 / promo = 프로모션(시작·종료일 적용).<br />
          ※ <b>TV명 포함</b>: 비워두면 모든 TV. 입력 시 해당 문자열을 포함하는 TV에서만 적용.<br />
          ※ <b>대상 속도</b>: 체크된 속도(인터넷)에서만 할인 적용. 매칭되는 모든 규칙은 합산 적용.
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <button type="button" onClick={onClose} style={btnPrimary}>닫기</button>
        </div>
      </div>
    </div>
  );
}
