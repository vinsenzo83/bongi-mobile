import { useState } from 'react';
import { theme, card, button, tableStyles, filterBtn, statusStyle, input } from '../../styles/admin-theme.js';

const CATEGORIES = ['전체','정수기','공기청정기','비데','TV','건조기','에어컨','식기세척기','로봇청소기','안마의자'];
const BRANDS = ['전체','LG','삼성','코웨이','청호','SK매직'];

const initialProducts = [
  { id: 1, category: '정수기', brand: '코웨이', model: '아이콘 정수기 CHP-7210N', monthly: 39900, term: 36, install: 0, gift: '상품권 10만원', status: '판매중' },
  { id: 2, category: '공기청정기', brand: 'LG', model: '퓨리케어 360 AS351', monthly: 29900, term: 48, install: 0, gift: '상품권 5만원', status: '판매중' },
  { id: 3, category: '비데', brand: '코웨이', model: '비데 BA19-A', monthly: 19900, term: 36, install: 30000, gift: '필터 1년분', status: '판매중' },
  { id: 4, category: 'TV', brand: '삼성', model: '네오 QLED 65인치 QN65QN85C', monthly: 54900, term: 48, install: 0, gift: '사운드바', status: '일시중단' },
  { id: 5, category: '건조기', brand: 'LG', model: '트롬 건조기 RH19VTA', monthly: 34900, term: 48, install: 50000, gift: '상품권 7만원', status: '판매중' },
  { id: 6, category: '에어컨', brand: 'LG', model: '휘센 오브제 FQ18SDNHA1', monthly: 49900, term: 60, install: 0, gift: '상품권 15만원', status: '판매중' },
  { id: 7, category: '식기세척기', brand: 'SK매직', model: 'DWA-81R0P', monthly: 24900, term: 36, install: 30000, gift: '세제 1년분', status: '판매중' },
  { id: 8, category: '안마의자', brand: '청호', model: '안마의자 MCH-A901', monthly: 89900, term: 60, install: 0, gift: '상품권 20만원', status: '일시중단' },
];

const emptyForm = { category: '', brand: '', model: '', monthly: '', term: '', install: '', gift: '', status: '판매중' };

export default function RentalProducts() {
  const [products, setProducts] = useState(initialProducts);
  const [catFilter, setCatFilter] = useState('전체');
  const [brandFilter, setBrandFilter] = useState('전체');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [parseModal, setParseModal] = useState(false);
  const [parseUrl, setParseUrl] = useState('');

  const filtered = products.filter(p =>
    (catFilter === '전체' || p.category === catFilter) &&
    (brandFilter === '전체' || p.brand === brandFilter)
  );

  function openAdd() {
    setEditId(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  }

  function openEdit(p) {
    setEditId(p.id);
    setForm({ category: p.category, brand: p.brand, model: p.model, monthly: p.monthly, term: p.term, install: p.install, gift: p.gift, status: p.status });
    setModalOpen(true);
  }

  function handleSave() {
    if (editId) {
      setProducts(prev => prev.map(p => p.id === editId ? { ...p, ...form, monthly: Number(form.monthly), term: Number(form.term), install: Number(form.install) } : p));
    } else {
      const newId = Math.max(...products.map(p => p.id)) + 1;
      setProducts(prev => [...prev, { id: newId, ...form, monthly: Number(form.monthly), term: Number(form.term), install: Number(form.install) }]);
    }
    setModalOpen(false);
  }

  function handleDelete(id) {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    setProducts(prev => prev.filter(p => p.id !== id));
  }

  function handleParse() {
    alert(`URL 파싱 요청: ${parseUrl}\n(실제 구현 시 서버에서 렌트리 상품 정보를 자동 수집합니다)`);
    setParseModal(false);
    setParseUrl('');
  }

  const fld = (label, key, type = 'text') => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: theme.textSecondary, marginBottom: 4 }}>{label}</label>
      {key === 'category' ? (
        <select style={{ ...input }} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}>
          <option value="">선택</option>
          {CATEGORIES.filter(c => c !== '전체').map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      ) : key === 'brand' ? (
        <select style={{ ...input }} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}>
          <option value="">선택</option>
          {BRANDS.filter(b => b !== '전체').map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      ) : key === 'status' ? (
        <select style={{ ...input }} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}>
          <option value="판매중">판매중</option>
          <option value="일시중단">일시중단</option>
        </select>
      ) : (
        <input style={{ ...input }} type={type} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} />
      )}
    </div>
  );

  const getStatusType = (s) => s === '판매중' ? 'green' : 'orange';

  return (
    <div style={{ padding: 24, fontFamily: theme.sans }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: theme.text, margin: 0 }}>렌탈 상품 관리</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={button.secondary} onClick={() => setParseModal(true)}>렌트리 URL 파싱</button>
          <button style={button.primary} onClick={openAdd}>+ 상품 추가</button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: theme.textSecondary, marginRight: 8 }}>카테고리</span>
          <div style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
            {CATEGORIES.map(c => (
              <button key={c} style={filterBtn(catFilter === c)} onClick={() => setCatFilter(c)}>{c}</button>
            ))}
          </div>
        </div>
        <div>
          <span style={{ fontSize: 11, fontWeight: 600, color: theme.textSecondary, marginRight: 8 }}>브랜드</span>
          <div style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
            {BRANDS.map(b => (
              <button key={b} style={filterBtn(brandFilter === b)} onClick={() => setBrandFilter(b)}>{b}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ ...card, padding: 0, overflow: 'auto' }}>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              {['카테고리','브랜드','모델명','월렌탈료','약정(개월)','설치비','사은품','상태','관리'].map(h => (
                <th key={h} style={tableStyles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} style={{ cursor: 'pointer' }} onMouseOver={e => e.currentTarget.style.background = theme.bgHover} onMouseOut={e => e.currentTarget.style.background = ''}>
                <td style={tableStyles.td}>{p.category}</td>
                <td style={tableStyles.td}>{p.brand}</td>
                <td style={{ ...tableStyles.td, fontWeight: 600, color: theme.text }}>{p.model}</td>
                <td style={{ ...tableStyles.td, fontWeight: 600, color: theme.blue }}>{p.monthly.toLocaleString()}원</td>
                <td style={tableStyles.td}>{p.term}개월</td>
                <td style={tableStyles.td}>{p.install === 0 ? '무료' : p.install.toLocaleString() + '원'}</td>
                <td style={tableStyles.td}>{p.gift}</td>
                <td style={tableStyles.td}><span style={statusStyle(getStatusType(p.status))}>{p.status}</span></td>
                <td style={tableStyles.td}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button style={button.success} onClick={() => openEdit(p)}>수정</button>
                    <button style={button.danger} onClick={() => handleDelete(p.id)}>삭제</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} style={{ ...tableStyles.td, textAlign: 'center', padding: 40, color: theme.textMuted }}>조건에 맞는 상품이 없습니다</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setModalOpen(false)}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 480, maxHeight: '80vh', overflow: 'auto', boxShadow: theme.shadowLg }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: theme.text, marginTop: 0, marginBottom: 16 }}>{editId ? '상품 수정' : '상품 추가'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {fld('카테고리', 'category')}
              {fld('브랜드', 'brand')}
            </div>
            {fld('모델명', 'model')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {fld('월렌탈료 (원)', 'monthly', 'number')}
              {fld('약정 (개월)', 'term', 'number')}
              {fld('설치비 (원)', 'install', 'number')}
            </div>
            {fld('사은품', 'gift')}
            {fld('상태', 'status')}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button style={button.secondary} onClick={() => setModalOpen(false)}>취소</button>
              <button style={button.primary} onClick={handleSave}>{editId ? '수정' : '추가'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Parse Modal */}
      {parseModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setParseModal(false)}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 480, boxShadow: theme.shadowLg }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: theme.text, marginTop: 0, marginBottom: 16 }}>렌트리 URL 파싱</h3>
            <p style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 12 }}>렌트리 상품 URL을 입력하면 상품 정보를 자동으로 가져옵니다.</p>
            <input style={{ ...input, marginBottom: 16 }} placeholder="https://www.rentree.co.kr/product/..." value={parseUrl} onChange={e => setParseUrl(e.target.value)} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={button.secondary} onClick={() => setParseModal(false)}>취소</button>
              <button style={button.primary} onClick={handleParse}>자동 파싱</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
