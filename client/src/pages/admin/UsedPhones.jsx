import { useState } from 'react';
import { theme, card, button, tableStyles, filterBtn, statusStyle, input } from '../../styles/admin-theme.js';

const MAKERS = ['전체','삼성','애플'];
const GRADES = ['전체','S','A','B','C','D'];

const initialPhones = [
  { id: 1, model: 'Galaxy S25 Ultra', maker: '삼성', storage: '256GB', S: 950000, A: 880000, B: 790000, C: 650000, D: 450000, source: '민팃', updated: '2026-04-05' },
  { id: 2, model: 'Galaxy S25+', maker: '삼성', storage: '256GB', S: 780000, A: 720000, B: 640000, C: 530000, D: 370000, source: '민팃', updated: '2026-04-05' },
  { id: 3, model: 'Galaxy S25', maker: '삼성', storage: '256GB', S: 650000, A: 590000, B: 520000, C: 420000, D: 290000, source: '민팃', updated: '2026-04-05' },
  { id: 4, model: 'iPhone 16 Pro Max', maker: '애플', storage: '256GB', S: 1250000, A: 1150000, B: 1020000, C: 850000, D: 600000, source: '셀잇', updated: '2026-04-04' },
  { id: 5, model: 'iPhone 16 Pro', maker: '애플', storage: '256GB', S: 1050000, A: 970000, B: 860000, C: 710000, D: 500000, source: '셀잇', updated: '2026-04-04' },
  { id: 6, model: 'iPhone 16', maker: '애플', storage: '128GB', S: 780000, A: 720000, B: 640000, C: 530000, D: 370000, source: '셀잇', updated: '2026-04-04' },
  { id: 7, model: 'Galaxy Z Flip7', maker: '삼성', storage: '256GB', S: 820000, A: 750000, B: 660000, C: 540000, D: 380000, source: '민팃', updated: '2026-04-03' },
  { id: 8, model: 'Galaxy Z Fold7', maker: '삼성', storage: '256GB', S: 1350000, A: 1240000, B: 1100000, C: 910000, D: 640000, source: '민팃', updated: '2026-04-03' },
];

export default function UsedPhones() {
  const [phones, setPhones] = useState(initialPhones);
  const [makerFilter, setMakerFilter] = useState('전체');
  const [gradeFilter, setGradeFilter] = useState('전체');
  const [editModal, setEditModal] = useState(false);
  const [editPhone, setEditPhone] = useState(null);
  const [form, setForm] = useState({ S: '', A: '', B: '', C: '', D: '', source: '' });

  const filtered = phones.filter(p =>
    (makerFilter === '전체' || p.maker === makerFilter) &&
    (gradeFilter === '전체' || true) // grade filter highlights column
  );

  function openEdit(p) {
    setEditPhone(p);
    setForm({ S: p.S, A: p.A, B: p.B, C: p.C, D: p.D, source: p.source });
    setEditModal(true);
  }

  function handleSave() {
    const today = new Date().toISOString().slice(0, 10);
    setPhones(prev => prev.map(p => p.id === editPhone.id ? {
      ...p,
      S: Number(form.S), A: Number(form.A), B: Number(form.B), C: Number(form.C), D: Number(form.D),
      source: form.source, updated: today,
    } : p));
    setEditModal(false);
  }

  const fmt = (v) => v ? v.toLocaleString() + '원' : '-';

  const gradeHighlight = (grade) => gradeFilter !== '전체' && gradeFilter === grade;

  const gradeTd = (val, grade) => ({
    ...tableStyles.td,
    fontWeight: 600,
    color: gradeHighlight(grade) ? theme.blue : theme.text,
    background: gradeHighlight(grade) ? theme.blueBg : undefined,
  });

  const priceFld = (label, key) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: theme.textSecondary, marginBottom: 4 }}>{label}</label>
      <input style={{ ...input }} type="number" value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} />
    </div>
  );

  return (
    <div style={{ padding: 24, fontFamily: theme.sans }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: theme.text, margin: 0 }}>중고폰 매입 관리</h2>
      </div>

      {/* Filters */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: theme.textSecondary, marginRight: 8 }}>제조사</span>
          <div style={{ display: 'inline-flex', gap: 4 }}>
            {MAKERS.map(m => (
              <button key={m} style={filterBtn(makerFilter === m)} onClick={() => setMakerFilter(m)}>{m}</button>
            ))}
          </div>
        </div>
        <div>
          <span style={{ fontSize: 11, fontWeight: 600, color: theme.textSecondary, marginRight: 8 }}>등급</span>
          <div style={{ display: 'inline-flex', gap: 4 }}>
            {GRADES.map(g => (
              <button key={g} style={filterBtn(gradeFilter === g)} onClick={() => setGradeFilter(g)}>{g}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ ...card, padding: 0, overflow: 'auto' }}>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              {['모델명','제조사','용량','S등급','A등급','B등급','C등급','D등급','매입처','수정일','관리'].map(h => (
                <th key={h} style={tableStyles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} onMouseOver={e => e.currentTarget.style.background = theme.bgHover} onMouseOut={e => e.currentTarget.style.background = ''}>
                <td style={{ ...tableStyles.td, fontWeight: 600, color: theme.text }}>{p.model}</td>
                <td style={tableStyles.td}>{p.maker}</td>
                <td style={tableStyles.td}>{p.storage}</td>
                <td style={gradeTd(p.S, 'S')}>{fmt(p.S)}</td>
                <td style={gradeTd(p.A, 'A')}>{fmt(p.A)}</td>
                <td style={gradeTd(p.B, 'B')}>{fmt(p.B)}</td>
                <td style={gradeTd(p.C, 'C')}>{fmt(p.C)}</td>
                <td style={gradeTd(p.D, 'D')}>{fmt(p.D)}</td>
                <td style={tableStyles.td}><span style={statusStyle('blue')}>{p.source}</span></td>
                <td style={{ ...tableStyles.td, fontSize: 11, color: theme.textMuted }}>{p.updated}</td>
                <td style={tableStyles.td}>
                  <button style={button.success} onClick={() => openEdit(p)}>수정</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={11} style={{ ...tableStyles.td, textAlign: 'center', padding: 40, color: theme.textMuted }}>조건에 맞는 중고폰이 없습니다</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editModal && editPhone && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setEditModal(false)}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 440, boxShadow: theme.shadowLg }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: theme.text, marginTop: 0, marginBottom: 4 }}>매입가 수정</h3>
            <p style={{ fontSize: 12, color: theme.textMuted, marginTop: 0, marginBottom: 16 }}>{editPhone.model} ({editPhone.storage})</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {priceFld('S등급 매입가', 'S')}
              {priceFld('A등급 매입가', 'A')}
              {priceFld('B등급 매입가', 'B')}
              {priceFld('C등급 매입가', 'C')}
              {priceFld('D등급 매입가', 'D')}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: theme.textSecondary, marginBottom: 4 }}>매입처</label>
                <select style={{ ...input }} value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}>
                  <option value="민팃">민팃</option>
                  <option value="셀잇">셀잇</option>
                  <option value="직접매입">직접매입</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button style={button.secondary} onClick={() => setEditModal(false)}>취소</button>
              <button style={button.primary} onClick={handleSave}>저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
