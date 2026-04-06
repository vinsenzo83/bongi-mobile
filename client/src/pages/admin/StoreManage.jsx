import { useState } from 'react';
import { theme, card, button, tableStyles, filterBtn, statusStyle, input } from '../../styles/admin-theme.js';

const initialStores = [
  { id: 1, name: '상무점', address: '광주 서구 상무중앙로 61', phone: '062-123-4567', hours: '10:00-20:00', kakao: 'bongi_sangmu', naver: 'https://naver.me/abc1', image: 'sangmu.jpg' },
  { id: 2, name: '익산점', address: '전북 익산시 영등동 123-4', phone: '063-234-5678', hours: '10:00-20:00', kakao: 'bongi_iksan', naver: 'https://naver.me/abc2', image: 'iksan.jpg' },
  { id: 3, name: '전대점', address: '광주 북구 용봉로 77', phone: '062-345-6789', hours: '10:00-21:00', kakao: 'bongi_jundae', naver: 'https://naver.me/abc3', image: 'jundae.jpg' },
  { id: 4, name: '신창점', address: '전남 무안군 삼향읍 신창로 45', phone: '061-456-7890', hours: '10:00-20:00', kakao: 'bongi_sinchang', naver: 'https://naver.me/abc4', image: 'sinchang.jpg' },
  { id: 5, name: '첨단점', address: '광주 광산구 첨단중앙로 88', phone: '062-567-8901', hours: '10:00-21:00', kakao: 'bongi_cheomdan', naver: 'https://naver.me/abc5', image: 'cheomdan.jpg' },
  { id: 6, name: '순천점', address: '전남 순천시 장천동 234-5', phone: '061-678-9012', hours: '10:00-20:00', kakao: 'bongi_suncheon', naver: 'https://naver.me/abc6', image: 'suncheon.jpg' },
  { id: 7, name: '남악점', address: '전남 무안군 남악로 112', phone: '061-789-0123', hours: '10:00-20:00', kakao: 'bongi_namak', naver: 'https://naver.me/abc7', image: 'namak.jpg' },
  { id: 8, name: '여수점', address: '전남 여수시 학동 567-8', phone: '061-890-1234', hours: '10:00-20:00', kakao: 'bongi_yeosu', naver: 'https://naver.me/abc8', image: 'yeosu.jpg' },
];

const CARRIERS = ['전체','SKT','KT','LG U+'];
const OPEN_TYPES = ['전체','신규','번이','기변'];

const initialPrices = [
  { id: 1, carrier: 'SKT', openType: '신규', model: 'Galaxy S25 Ultra 256GB', retail: 1699000, subsidy: 280000, actual: 1419000, fee: 85000, updated: '2026-04-05' },
  { id: 2, carrier: 'SKT', openType: '번이', model: 'Galaxy S25 Ultra 256GB', retail: 1699000, subsidy: 350000, actual: 1349000, fee: 95000, updated: '2026-04-05' },
  { id: 3, carrier: 'KT', openType: '신규', model: 'Galaxy S25+ 256GB', retail: 1349000, subsidy: 250000, actual: 1099000, fee: 75000, updated: '2026-04-05' },
  { id: 4, carrier: 'KT', openType: '기변', model: 'Galaxy S25+ 256GB', retail: 1349000, subsidy: 150000, actual: 1199000, fee: 60000, updated: '2026-04-05' },
  { id: 5, carrier: 'LG U+', openType: '번이', model: 'iPhone 16 Pro Max 256GB', retail: 1900000, subsidy: 300000, actual: 1600000, fee: 100000, updated: '2026-04-04' },
  { id: 6, carrier: 'SKT', openType: '신규', model: 'iPhone 16 Pro 256GB', retail: 1550000, subsidy: 270000, actual: 1280000, fee: 90000, updated: '2026-04-04' },
  { id: 7, carrier: 'KT', openType: '번이', model: 'Galaxy Z Flip7 256GB', retail: 1399000, subsidy: 320000, actual: 1079000, fee: 80000, updated: '2026-04-03' },
  { id: 8, carrier: 'LG U+', openType: '기변', model: 'Galaxy Z Fold7 256GB', retail: 2099000, subsidy: 200000, actual: 1899000, fee: 70000, updated: '2026-04-03' },
];

const emptyStore = { name: '', address: '', phone: '', hours: '10:00-20:00', kakao: '', naver: '', image: '' };
const emptyPrice = { carrier: 'SKT', openType: '신규', model: '', retail: '', subsidy: '', actual: '', fee: '' };

export default function StoreManage() {
  const [tab, setTab] = useState('store');

  // Store state
  const [stores, setStores] = useState(initialStores);
  const [storeModal, setStoreModal] = useState(false);
  const [editStoreId, setEditStoreId] = useState(null);
  const [storeForm, setStoreForm] = useState({ ...emptyStore });

  // Price state
  const [prices, setPrices] = useState(initialPrices);
  const [carrierFilter, setCarrierFilter] = useState('전체');
  const [openTypeFilter, setOpenTypeFilter] = useState('전체');
  const [priceModal, setPriceModal] = useState(false);
  const [editPriceId, setEditPriceId] = useState(null);
  const [priceForm, setPriceForm] = useState({ ...emptyPrice });

  // Store handlers
  function openAddStore() { setEditStoreId(null); setStoreForm({ ...emptyStore }); setStoreModal(true); }
  function openEditStore(s) { setEditStoreId(s.id); setStoreForm({ name: s.name, address: s.address, phone: s.phone, hours: s.hours, kakao: s.kakao, naver: s.naver, image: s.image }); setStoreModal(true); }
  function handleSaveStore() {
    if (editStoreId) {
      setStores(prev => prev.map(s => s.id === editStoreId ? { ...s, ...storeForm } : s));
    } else {
      const newId = Math.max(...stores.map(s => s.id)) + 1;
      setStores(prev => [...prev, { id: newId, ...storeForm }]);
    }
    setStoreModal(false);
  }
  function handleDeleteStore(id) {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    setStores(prev => prev.filter(s => s.id !== id));
  }

  // Price handlers
  const filteredPrices = prices.filter(p =>
    (carrierFilter === '전체' || p.carrier === carrierFilter) &&
    (openTypeFilter === '전체' || p.openType === openTypeFilter)
  );

  function openAddPrice() { setEditPriceId(null); setPriceForm({ ...emptyPrice }); setPriceModal(true); }
  function openEditPrice(p) { setEditPriceId(p.id); setPriceForm({ carrier: p.carrier, openType: p.openType, model: p.model, retail: p.retail, subsidy: p.subsidy, actual: p.actual, fee: p.fee }); setPriceModal(true); }
  function handleSavePrice() {
    const today = new Date().toISOString().slice(0, 10);
    if (editPriceId) {
      setPrices(prev => prev.map(p => p.id === editPriceId ? { ...p, ...priceForm, retail: Number(priceForm.retail), subsidy: Number(priceForm.subsidy), actual: Number(priceForm.actual), fee: Number(priceForm.fee), updated: today } : p));
    } else {
      const newId = Math.max(...prices.map(p => p.id)) + 1;
      setPrices(prev => [...prev, { id: newId, ...priceForm, retail: Number(priceForm.retail), subsidy: Number(priceForm.subsidy), actual: Number(priceForm.actual), fee: Number(priceForm.fee), updated: today }]);
    }
    setPriceModal(false);
  }
  function handleDeletePrice(id) {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    setPrices(prev => prev.filter(p => p.id !== id));
  }

  const fmt = (v) => v ? Number(v).toLocaleString() + '원' : '-';

  const storeFld = (label, key) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: theme.textSecondary, marginBottom: 4 }}>{label}</label>
      <input style={{ ...input }} value={storeForm[key]} onChange={e => setStoreForm({ ...storeForm, [key]: e.target.value })} />
    </div>
  );

  const carrierColor = (c) => theme.carrier[c] || theme.text;

  return (
    <div style={{ padding: 24, fontFamily: theme.sans }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: theme.text, margin: 0 }}>매장·시세 관리</h2>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: `2px solid ${theme.border}` }}>
        {[{ key: 'store', label: '매장 관리' }, { key: 'price', label: '휴대폰 시세' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '10px 24px', fontSize: 13, fontWeight: tab === t.key ? 700 : 400, cursor: 'pointer',
            border: 'none', borderBottom: tab === t.key ? `2px solid ${theme.navy}` : '2px solid transparent',
            color: tab === t.key ? theme.navy : theme.textMuted, background: 'none', marginBottom: -2, fontFamily: theme.sans,
          }}>{t.label}</button>
        ))}
      </div>

      {/* Store Tab */}
      {tab === 'store' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button style={button.primary} onClick={openAddStore}>+ 매장 추가</button>
          </div>
          <div style={{ ...card, padding: 0, overflow: 'auto' }}>
            <table style={tableStyles.table}>
              <thead>
                <tr>
                  {['매장명','주소','전화번호','영업시간','카카오톡','네이버지도','이미지','관리'].map(h => (
                    <th key={h} style={tableStyles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stores.map(s => (
                  <tr key={s.id} onMouseOver={e => e.currentTarget.style.background = theme.bgHover} onMouseOut={e => e.currentTarget.style.background = ''}>
                    <td style={{ ...tableStyles.td, fontWeight: 600, color: theme.text }}>{s.name}</td>
                    <td style={tableStyles.td}>{s.address}</td>
                    <td style={tableStyles.td}>{s.phone}</td>
                    <td style={tableStyles.td}>{s.hours}</td>
                    <td style={tableStyles.td}><span style={{ fontSize: 11, color: theme.blue }}>{s.kakao}</span></td>
                    <td style={tableStyles.td}>
                      <a href={s.naver} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: theme.green, textDecoration: 'none' }}>링크</a>
                    </td>
                    <td style={tableStyles.td}><span style={statusStyle('gray')}>{s.image}</span></td>
                    <td style={tableStyles.td}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button style={button.success} onClick={() => openEditStore(s)}>수정</button>
                        <button style={button.danger} onClick={() => handleDeleteStore(s.id)}>삭제</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Store Modal */}
          {storeModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setStoreModal(false)}>
              <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 480, maxHeight: '80vh', overflow: 'auto', boxShadow: theme.shadowLg }} onClick={e => e.stopPropagation()}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: theme.text, marginTop: 0, marginBottom: 16 }}>{editStoreId ? '매장 수정' : '매장 추가'}</h3>
                {storeFld('매장명', 'name')}
                {storeFld('주소', 'address')}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {storeFld('전화번호', 'phone')}
                  {storeFld('영업시간', 'hours')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {storeFld('카카오톡 ID', 'kakao')}
                  {storeFld('네이버지도 URL', 'naver')}
                </div>
                {storeFld('이미지 파일명', 'image')}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                  <button style={button.secondary} onClick={() => setStoreModal(false)}>취소</button>
                  <button style={button.primary} onClick={handleSaveStore}>{editStoreId ? '수정' : '추가'}</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Price Tab */}
      {tab === 'price' && (
        <>
          <div style={{ ...card, marginBottom: 16 }}>
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: theme.textSecondary, marginRight: 8 }}>통신사</span>
              <div style={{ display: 'inline-flex', gap: 4 }}>
                {CARRIERS.map(c => (
                  <button key={c} style={filterBtn(carrierFilter === c)} onClick={() => setCarrierFilter(c)}>{c}</button>
                ))}
              </div>
            </div>
            <div>
              <span style={{ fontSize: 11, fontWeight: 600, color: theme.textSecondary, marginRight: 8 }}>개통유형</span>
              <div style={{ display: 'inline-flex', gap: 4 }}>
                {OPEN_TYPES.map(t => (
                  <button key={t} style={filterBtn(openTypeFilter === t)} onClick={() => setOpenTypeFilter(t)}>{t}</button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button style={button.primary} onClick={openAddPrice}>+ 시세 추가</button>
          </div>

          <div style={{ ...card, padding: 0, overflow: 'auto' }}>
            <table style={tableStyles.table}>
              <thead>
                <tr>
                  {['통신사','개통유형','모델명','출고가','공시지원금','실구매가','차비(수수료)','수정일','관리'].map(h => (
                    <th key={h} style={tableStyles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPrices.map(p => (
                  <tr key={p.id} onMouseOver={e => e.currentTarget.style.background = theme.bgHover} onMouseOut={e => e.currentTarget.style.background = ''}>
                    <td style={{ ...tableStyles.td, fontWeight: 700, color: carrierColor(p.carrier) }}>{p.carrier}</td>
                    <td style={tableStyles.td}><span style={statusStyle(p.openType === '신규' ? 'blue' : p.openType === '번이' ? 'green' : 'orange')}>{p.openType}</span></td>
                    <td style={{ ...tableStyles.td, fontWeight: 600, color: theme.text }}>{p.model}</td>
                    <td style={tableStyles.td}>{fmt(p.retail)}</td>
                    <td style={{ ...tableStyles.td, fontWeight: 600, color: theme.red }}>{fmt(p.subsidy)}</td>
                    <td style={{ ...tableStyles.td, fontWeight: 700, color: theme.blue }}>{fmt(p.actual)}</td>
                    <td style={{ ...tableStyles.td, color: theme.green, fontWeight: 600 }}>{fmt(p.fee)}</td>
                    <td style={{ ...tableStyles.td, fontSize: 11, color: theme.textMuted }}>{p.updated}</td>
                    <td style={tableStyles.td}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button style={button.success} onClick={() => openEditPrice(p)}>수정</button>
                        <button style={button.danger} onClick={() => handleDeletePrice(p.id)}>삭제</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredPrices.length === 0 && (
                  <tr><td colSpan={9} style={{ ...tableStyles.td, textAlign: 'center', padding: 40, color: theme.textMuted }}>조건에 맞는 시세 정보가 없습니다</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Price Modal */}
          {priceModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setPriceModal(false)}>
              <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 480, boxShadow: theme.shadowLg }} onClick={e => e.stopPropagation()}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: theme.text, marginTop: 0, marginBottom: 16 }}>{editPriceId ? '시세 수정' : '시세 추가'}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: theme.textSecondary, marginBottom: 4 }}>통신사</label>
                    <select style={{ ...input }} value={priceForm.carrier} onChange={e => setPriceForm({ ...priceForm, carrier: e.target.value })}>
                      {CARRIERS.filter(c => c !== '전체').map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: theme.textSecondary, marginBottom: 4 }}>개통유형</label>
                    <select style={{ ...input }} value={priceForm.openType} onChange={e => setPriceForm({ ...priceForm, openType: e.target.value })}>
                      {OPEN_TYPES.filter(t => t !== '전체').map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: theme.textSecondary, marginBottom: 4 }}>모델명</label>
                  <input style={{ ...input }} value={priceForm.model} onChange={e => setPriceForm({ ...priceForm, model: e.target.value })} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[['출고가','retail'],['공시지원금','subsidy'],['실구매가','actual'],['차비(수수료)','fee']].map(([label, key]) => (
                    <div key={key} style={{ marginBottom: 12 }}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: theme.textSecondary, marginBottom: 4 }}>{label}</label>
                      <input style={{ ...input }} type="number" value={priceForm[key]} onChange={e => setPriceForm({ ...priceForm, [key]: e.target.value })} />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                  <button style={button.secondary} onClick={() => setPriceModal(false)}>취소</button>
                  <button style={button.primary} onClick={handleSavePrice}>{editPriceId ? '수정' : '추가'}</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
