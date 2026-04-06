import { useState } from 'react';
import { theme, card, button, tableStyles, filterBtn, statusStyle, input } from '../../styles/admin-theme.js';

const mockSubsidies = [
  { id: 1, model: '갤럭시 S25 울트라', carrier: 'SKT', plan: '5G 프리미엄 69', subsidy: 300000, extra: 150000, total: 450000, retail: 1650000, maker: '삼성' },
  { id: 2, model: '갤럭시 S25', carrier: 'KT', plan: '5G 슈퍼플랜 베이직', subsidy: 270000, extra: 120000, total: 390000, retail: 1350000, maker: '삼성' },
  { id: 3, model: '아이폰 16 Pro Max', carrier: 'LGU+', plan: '5G 프리미엄 69', subsidy: 280000, extra: 140000, total: 420000, retail: 1900000, maker: '애플' },
  { id: 4, model: '아이폰 16 Pro', carrier: 'SKT', plan: '5G 다이렉트 49', subsidy: 250000, extra: 100000, total: 350000, retail: 1550000, maker: '애플' },
  { id: 5, model: '갤럭시 Z 폴드6', carrier: 'KT', plan: '5G 슈퍼플랜 프리미엄', subsidy: 320000, extra: 160000, total: 480000, retail: 2100000, maker: '삼성' },
  { id: 6, model: '갤럭시 A56', carrier: 'LGU+', plan: '5G 스탠다드 52', subsidy: 200000, extra: 80000, total: 280000, retail: 550000, maker: '삼성' },
  { id: 7, model: '아이폰 16', carrier: 'SKT', plan: '5G 슬림 39', subsidy: 230000, extra: 110000, total: 340000, retail: 1250000, maker: '애플' },
  { id: 8, model: '갤럭시 S25+', carrier: 'KT', plan: '5G 심플 47', subsidy: 290000, extra: 130000, total: 420000, retail: 1450000, maker: '삼성' },
];

const carriers = ['전체', 'SKT', 'KT', 'LGU+'];
const makers = ['전체', '삼성', '애플'];

const overlay = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};
const modal = {
  background: '#fff', borderRadius: 12, padding: 24, width: 520,
  boxShadow: '0 8px 32px rgba(0,0,0,0.18)', maxHeight: '80vh', overflowY: 'auto',
};

export default function SubsidyData() {
  const [data, setData] = useState(mockSubsidies);
  const [carrierFilter, setCarrierFilter] = useState('전체');
  const [makerFilter, setMakerFilter] = useState('전체');
  const [crawling, setCrawling] = useState(false);
  const [lastCrawl] = useState('2026-04-06 09:00:12');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ model: '', carrier: 'SKT', plan: '', subsidy: '', extra: '', retail: '', maker: '삼성' });

  const filtered = data.filter(d =>
    (carrierFilter === '전체' || d.carrier === carrierFilter) &&
    (makerFilter === '전체' || d.maker === makerFilter)
  );

  const runCrawl = () => {
    setCrawling(true);
    setTimeout(() => setCrawling(false), 2000);
  };

  const openAdd = () => {
    setEditItem(null);
    setForm({ model: '', carrier: 'SKT', plan: '', subsidy: '', extra: '', retail: '', maker: '삼성' });
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setForm({ model: item.model, carrier: item.carrier, plan: item.plan, subsidy: String(item.subsidy), extra: String(item.extra), retail: String(item.retail), maker: item.maker });
    setShowModal(true);
  };

  const save = () => {
    const s = Number(form.subsidy), e = Number(form.extra);
    const entry = { ...form, subsidy: s, extra: e, total: s + e, retail: Number(form.retail) };
    if (editItem) {
      setData(data.map(d => d.id === editItem.id ? { ...d, ...entry } : d));
    } else {
      setData([...data, { ...entry, id: Date.now() }]);
    }
    setShowModal(false);
  };

  return (
    <div style={{ padding: 24, fontFamily: theme.sans, background: theme.bg, minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: theme.text, margin: 0 }}>공시지원금 (AI 학습 데이터)</h1>
        <span style={statusStyle('green')}>자동갱신 ON</span>
      </div>

      {/* Last crawl info */}
      <div style={{ ...card, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 12, color: theme.textSecondary }}>마지막 크롤링: <strong style={{ color: theme.text }}>{lastCrawl}</strong></span>
        <button style={{ ...button.primary, background: crawling ? theme.textMuted : theme.navy }} onClick={runCrawl} disabled={crawling}>
          {crawling ? '크롤링 중...' : '크롤링 실행'}
        </button>
        <div style={{ flex: 1 }} />
        <button style={button.primary} onClick={openAdd}>+ 수동 추가</button>
      </div>

      {/* Filters */}
      <div style={{ ...card, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: theme.text, marginRight: 4 }}>통신사</span>
        {carriers.map(c => (
          <button key={c} style={filterBtn(carrierFilter === c)} onClick={() => setCarrierFilter(c)}>{c}</button>
        ))}
        <span style={{ fontSize: 12, fontWeight: 600, color: theme.text, margin: '0 8px 0 16px' }}>제조사</span>
        {makers.map(m => (
          <button key={m} style={filterBtn(makerFilter === m)} onClick={() => setMakerFilter(m)}>{m}</button>
        ))}
      </div>

      {/* Table */}
      <div style={{ ...card, padding: 0, overflow: 'auto' }}>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              {['모델명', '통신사', '요금제', '공시지원금', '추가지원금', '총지원금', '출고가', '관리'].map(h => (
                <th key={h} style={tableStyles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => (
              <tr key={d.id}>
                <td style={{ ...tableStyles.td, fontWeight: 600, color: theme.text }}>{d.model}</td>
                <td style={tableStyles.td}>
                  <span style={statusStyle(d.carrier === 'SKT' ? 'red' : d.carrier === 'KT' ? 'blue' : 'green')}>{d.carrier}</span>
                </td>
                <td style={tableStyles.td}>{d.plan}</td>
                <td style={tableStyles.td}>{d.subsidy.toLocaleString()}원</td>
                <td style={tableStyles.td}>{d.extra.toLocaleString()}원</td>
                <td style={{ ...tableStyles.td, fontWeight: 700, color: theme.blue }}>{d.total.toLocaleString()}원</td>
                <td style={tableStyles.td}>{d.retail.toLocaleString()}원</td>
                <td style={tableStyles.td}>
                  <button style={{ ...button.secondary, padding: '4px 10px', fontSize: 11 }} onClick={() => openEdit(d)}>수정</button>
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
              {editItem ? '공시지원금 수정' : '공시지원금 수동 추가'}
            </h3>
            {[
              { label: '모델명', key: 'model' },
              { label: '제조사', key: 'maker', type: 'select', options: ['삼성', '애플'] },
              { label: '통신사', key: 'carrier', type: 'select', options: ['SKT', 'KT', 'LGU+'] },
              { label: '요금제', key: 'plan' },
              { label: '공시지원금 (원)', key: 'subsidy' },
              { label: '추가지원금 (원)', key: 'extra' },
              { label: '출고가 (원)', key: 'retail' },
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
