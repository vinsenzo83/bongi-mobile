import { useState } from 'react';
import { theme, card, button, tableStyles, filterBtn, statusStyle, input } from '../../styles/admin-theme.js';

const mockBundles = [
  { id: 1, carrier: 'SKT', name: '온가족할인', lines: 2, discount: 10000, condition: '2회선 이상 결합' },
  { id: 2, carrier: 'SKT', name: '온가족할인', lines: 3, discount: 15000, condition: '3회선 이상 결합' },
  { id: 3, carrier: 'SKT', name: '온가족할인', lines: 4, discount: 20000, condition: '4회선 이상 결합' },
  { id: 4, carrier: 'KT', name: '가족결합', lines: 2, discount: 8000, condition: '2회선 결합 시' },
  { id: 5, carrier: 'KT', name: '가족결합', lines: 3, discount: 12000, condition: '3회선 결합 시' },
  { id: 6, carrier: 'KT', name: '가족결합', lines: 4, discount: 18000, condition: '4회선 결합 시' },
  { id: 7, carrier: 'LGU+', name: '가족무한결합', lines: 2, discount: 9000, condition: '2회선 이상 결합' },
  { id: 8, carrier: 'LGU+', name: '가족무한결합', lines: 3, discount: 14000, condition: '3회선 이상 결합' },
  { id: 9, carrier: 'LGU+', name: '가족무한결합', lines: 4, discount: 22000, condition: '4회선 이상, 인터넷 결합 필수' },
];

const carriers = ['전체', 'SKT', 'KT', 'LGU+'];

const overlay = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};
const modal = {
  background: '#fff', borderRadius: 12, padding: 24, width: 460,
  boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
};

export default function FamilyBundle() {
  const [bundles, setBundles] = useState(mockBundles);
  const [carrierFilter, setCarrierFilter] = useState('전체');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ carrier: 'SKT', name: '', lines: '', discount: '', condition: '' });

  const filtered = bundles.filter(b => carrierFilter === '전체' || b.carrier === carrierFilter);

  const openAdd = () => {
    setEditItem(null);
    setForm({ carrier: 'SKT', name: '', lines: '', discount: '', condition: '' });
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setForm({ carrier: item.carrier, name: item.name, lines: String(item.lines), discount: String(item.discount), condition: item.condition });
    setShowModal(true);
  };

  const save = () => {
    const entry = { ...form, lines: Number(form.lines), discount: Number(form.discount) };
    if (editItem) {
      setBundles(bundles.map(b => b.id === editItem.id ? { ...b, ...entry } : b));
    } else {
      setBundles([...bundles, { ...entry, id: Date.now() }]);
    }
    setShowModal(false);
  };

  const remove = (id) => setBundles(bundles.filter(b => b.id !== id));

  return (
    <div style={{ padding: 24, fontFamily: theme.sans, background: theme.bg, minHeight: '100vh' }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: theme.text, marginBottom: 20 }}>
        가족결합 (AI 학습 데이터)
      </h1>

      {/* Filters */}
      <div style={{ ...card, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: theme.text, marginRight: 4 }}>통신사</span>
        {carriers.map(c => (
          <button key={c} style={filterBtn(carrierFilter === c)} onClick={() => setCarrierFilter(c)}>{c}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button style={button.primary} onClick={openAdd}>+ 결합상품 추가</button>
      </div>

      {/* Table */}
      <div style={{ ...card, padding: 0, overflow: 'auto' }}>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              {['통신사', '결합명', '회선수', '할인금액', '적용조건', '관리'].map(h => (
                <th key={h} style={tableStyles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(b => (
              <tr key={b.id}>
                <td style={tableStyles.td}>
                  <span style={statusStyle(b.carrier === 'SKT' ? 'red' : b.carrier === 'KT' ? 'blue' : 'green')}>{b.carrier}</span>
                </td>
                <td style={{ ...tableStyles.td, fontWeight: 600, color: theme.text }}>{b.name}</td>
                <td style={tableStyles.td}>{b.lines}회선</td>
                <td style={{ ...tableStyles.td, fontWeight: 700, color: theme.blue }}>{b.discount.toLocaleString()}원</td>
                <td style={tableStyles.td}>{b.condition}</td>
                <td style={tableStyles.td}>
                  <button style={{ ...button.secondary, marginRight: 4, padding: '4px 10px', fontSize: 11 }} onClick={() => openEdit(b)}>수정</button>
                  <button style={{ ...button.danger, padding: '4px 10px' }} onClick={() => remove(b.id)}>삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={overlay} onClick={() => setShowModal(false)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: theme.text }}>
              {editItem ? '결합상품 수정' : '결합상품 추가'}
            </h3>
            {[
              { label: '통신사', key: 'carrier', type: 'select', options: ['SKT', 'KT', 'LGU+'] },
              { label: '결합명', key: 'name' },
              { label: '회선수', key: 'lines' },
              { label: '할인금액 (원)', key: 'discount' },
              { label: '적용조건', key: 'condition' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: theme.textSecondary, display: 'block', marginBottom: 4 }}>{f.label}</label>
                {f.type === 'select' ? (
                  <select style={input} value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}>
                    {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input style={input} value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
                )}
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button style={button.secondary} onClick={() => setShowModal(false)}>취소</button>
              <button style={button.primary} onClick={save}>저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
