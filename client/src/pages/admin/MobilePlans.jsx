import { useState } from 'react';
import { theme, card, button, tableStyles, filterBtn, statusStyle, input } from '../../styles/admin-theme.js';

const mockPlans = [
  { id: 1, carrier: 'SKT', name: '5G 다이렉트 49', monthly: 49000, data: '150GB', voice: '무제한', sms: '무제한', benefit: 'T멤버십 VIP', network: '5G' },
  { id: 2, carrier: 'SKT', name: '5G 슬림 39', monthly: 39000, data: '12GB', voice: '무제한', sms: '무제한', benefit: 'T멤버십', network: '5G' },
  { id: 3, carrier: 'SKT', name: 'LTE 세이브 34', monthly: 34000, data: '6GB', voice: '무제한', sms: '무제한', benefit: '-', network: 'LTE' },
  { id: 4, carrier: 'KT', name: '5G 슈퍼플랜 베이직', monthly: 55000, data: '200GB', voice: '무제한', sms: '무제한', benefit: '슈퍼할인', network: '5G' },
  { id: 5, carrier: 'KT', name: '5G 심플 47', monthly: 47000, data: '100GB', voice: '무제한', sms: '무제한', benefit: '-', network: '5G' },
  { id: 6, carrier: 'KT', name: 'LTE 베이직 33', monthly: 33000, data: '5GB', voice: '무제한', sms: '무제한', benefit: '-', network: 'LTE' },
  { id: 7, carrier: 'LGU+', name: '5G 프리미엄 69', monthly: 69000, data: '무제한', voice: '무제한', sms: '무제한', benefit: 'U+멤버십 VIP', network: '5G' },
  { id: 8, carrier: 'LGU+', name: '5G 스탠다드 52', monthly: 52000, data: '150GB', voice: '무제한', sms: '무제한', benefit: 'U+멤버십', network: '5G' },
  { id: 9, carrier: 'LGU+', name: 'LTE 데이터 29', monthly: 29000, data: '3GB', voice: '무제한', sms: '무제한', benefit: '-', network: 'LTE' },
  { id: 10, carrier: 'SKT', name: '5G 프리미엄 69', monthly: 69000, data: '무제한', voice: '무제한', sms: '무제한', benefit: 'T멤버십 VVIP', network: '5G' },
];

const carriers = ['전체', 'SKT', 'KT', 'LGU+'];
const networks = ['전체', '5G', 'LTE'];

const overlay = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};

const modal = {
  background: '#fff', borderRadius: 12, padding: 24, width: 480,
  boxShadow: '0 8px 32px rgba(0,0,0,0.18)', maxHeight: '80vh', overflowY: 'auto',
};

export default function MobilePlans() {
  const [plans, setPlans] = useState(mockPlans);
  const [carrierFilter, setCarrierFilter] = useState('전체');
  const [networkFilter, setNetworkFilter] = useState('전체');
  const [showModal, setShowModal] = useState(false);
  const [editPlan, setEditPlan] = useState(null);
  const [form, setForm] = useState({ carrier: 'SKT', name: '', monthly: '', data: '', voice: '무제한', sms: '무제한', benefit: '', network: '5G' });

  const filtered = plans.filter(p =>
    (carrierFilter === '전체' || p.carrier === carrierFilter) &&
    (networkFilter === '전체' || p.network === networkFilter)
  );

  const openAdd = () => {
    setEditPlan(null);
    setForm({ carrier: 'SKT', name: '', monthly: '', data: '', voice: '무제한', sms: '무제한', benefit: '', network: '5G' });
    setShowModal(true);
  };

  const openEdit = (p) => {
    setEditPlan(p);
    setForm({ ...p, monthly: String(p.monthly) });
    setShowModal(true);
  };

  const save = () => {
    if (editPlan) {
      setPlans(plans.map(p => p.id === editPlan.id ? { ...p, ...form, monthly: Number(form.monthly) } : p));
    } else {
      setPlans([...plans, { ...form, id: Date.now(), monthly: Number(form.monthly) }]);
    }
    setShowModal(false);
  };

  const remove = (id) => setPlans(plans.filter(p => p.id !== id));

  return (
    <div style={{ padding: 24, fontFamily: theme.sans, background: theme.bg, minHeight: '100vh' }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: theme.text, marginBottom: 20 }}>
        모바일 요금제 (AI 학습 데이터)
      </h1>

      {/* Filters */}
      <div style={{ ...card, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: theme.text, marginRight: 4 }}>통신사</span>
        {carriers.map(c => (
          <button key={c} style={filterBtn(carrierFilter === c)} onClick={() => setCarrierFilter(c)}>{c}</button>
        ))}
        <span style={{ fontSize: 12, fontWeight: 600, color: theme.text, margin: '0 8px 0 16px' }}>네트워크</span>
        {networks.map(n => (
          <button key={n} style={filterBtn(networkFilter === n)} onClick={() => setNetworkFilter(n)}>{n}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button style={button.primary} onClick={openAdd}>+ 요금제 추가</button>
        <button style={button.secondary}>엑셀 업로드</button>
      </div>

      {/* Table */}
      <div style={{ ...card, padding: 0, overflow: 'auto' }}>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              {['통신사', '요금제명', '월요금', '데이터', '음성', '문자', '혜택', '관리'].map(h => (
                <th key={h} style={tableStyles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id}>
                <td style={tableStyles.td}>
                  <span style={{ ...statusStyle(p.carrier === 'SKT' ? 'red' : p.carrier === 'KT' ? 'blue' : 'green') }}>
                    {p.carrier}
                  </span>
                </td>
                <td style={{ ...tableStyles.td, fontWeight: 600, color: theme.text }}>{p.name}</td>
                <td style={tableStyles.td}>{p.monthly.toLocaleString()}원</td>
                <td style={tableStyles.td}>{p.data}</td>
                <td style={tableStyles.td}>{p.voice}</td>
                <td style={tableStyles.td}>{p.sms}</td>
                <td style={tableStyles.td}>{p.benefit}</td>
                <td style={tableStyles.td}>
                  <button style={{ ...button.secondary, marginRight: 4, padding: '4px 10px', fontSize: 11 }} onClick={() => openEdit(p)}>수정</button>
                  <button style={{ ...button.danger, padding: '4px 10px' }} onClick={() => remove(p.id)}>삭제</button>
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
              {editPlan ? '요금제 수정' : '요금제 추가'}
            </h3>
            {[
              { label: '통신사', key: 'carrier', type: 'select', options: ['SKT', 'KT', 'LGU+'] },
              { label: '요금제명', key: 'name' },
              { label: '월요금 (원)', key: 'monthly' },
              { label: '데이터', key: 'data' },
              { label: '음성', key: 'voice' },
              { label: '문자', key: 'sms' },
              { label: '혜택', key: 'benefit' },
              { label: '네트워크', key: 'network', type: 'select', options: ['5G', 'LTE'] },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: theme.textSecondary, display: 'block', marginBottom: 4 }}>{f.label}</label>
                {f.type === 'select' ? (
                  <select style={{ ...input }} value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}>
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
