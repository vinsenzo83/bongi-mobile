import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { theme, card, button, tableStyles, filterBtn, statusStyle, input } from '../../styles/admin-theme.js';

const carrierMap = { skt: 'SKT', kt: 'KT', lgu: 'LG U+' };

const typeOptions = ['인터넷', 'TV', '인터넷+TV', '전화'];

const commitmentOptions = ['12개월', '24개월', '36개월'];

const mockData = {
  SKT: [
    { id: 1, code: 'SKT-INT-001', name: 'Bstar 500M', type: '인터넷', price: '33,000', speed: '500Mbps', commitment: '36개월', promotion: '3개월 무료', giftMin: 100000, giftMax: 200000, status: '판매중' },
    { id: 2, code: 'SKT-INT-002', name: 'Bstar 1G', type: '인터넷', price: '38,500', speed: '1Gbps', commitment: '36개월', promotion: '설치비 면제 + 3개월 할인', giftMin: 150000, giftMax: 300000, status: '판매중' },
    { id: 3, code: 'SKT-BND-001', name: 'Bstar 500M+BtvAll', type: '인터넷+TV', price: '44,000', speed: '500Mbps', commitment: '36개월', promotion: '셋톱박스 무료 + BTV 3개월', giftMin: 200000, giftMax: 350000, status: '판매중' },
    { id: 4, code: 'SKT-TV-001', name: 'Btv 에센셜', type: 'TV', price: '12,100', speed: '-', commitment: '24개월', promotion: 'VOD 쿠폰 5천원', giftMin: 50000, giftMax: 100000, status: '판매중' },
    { id: 5, code: 'SKT-BND-002', name: 'Bstar 1G+BtvAll', type: '인터넷+TV', price: '49,500', speed: '1Gbps', commitment: '36개월', promotion: '6개월 할인 + 넷플릭스 3개월', giftMin: 250000, giftMax: 400000, status: '판매중' },
    { id: 6, code: 'SKT-TEL-001', name: 'B전화 기본', type: '전화', price: '3,300', speed: '-', commitment: '12개월', promotion: '-', giftMin: 0, giftMax: 30000, status: '중지' },
    { id: 7, code: 'SKT-INT-003', name: 'Bstar 2.5G', type: '인터넷', price: '44,000', speed: '2.5Gbps', commitment: '36개월', promotion: '와이파이6 공유기 무료', giftMin: 200000, giftMax: 350000, status: '판매중' },
  ],
  KT: [
    { id: 1, code: 'KT-INT-001', name: '슬림 500M', type: '인터넷', price: '30,800', speed: '500Mbps', commitment: '36개월', promotion: '3개월 무료', giftMin: 100000, giftMax: 200000, status: '판매중' },
    { id: 2, code: 'KT-INT-002', name: '에센스 1G', type: '인터넷', price: '36,300', speed: '1Gbps', commitment: '36개월', promotion: '설치비 면제 + 2개월 무료', giftMin: 150000, giftMax: 280000, status: '판매중' },
    { id: 3, code: 'KT-BND-001', name: '에센스 500M+지니TV', type: '인터넷+TV', price: '41,800', speed: '500Mbps', commitment: '36개월', promotion: '지니TV 베이직 6개월', giftMin: 180000, giftMax: 320000, status: '판매중' },
    { id: 4, code: 'KT-TV-001', name: '지니TV 에센스', type: 'TV', price: '13,200', speed: '-', commitment: '24개월', promotion: 'VOD 1만원 쿠폰', giftMin: 50000, giftMax: 100000, status: '판매중' },
    { id: 5, code: 'KT-BND-002', name: '프리미엄 1G+지니TV올', type: '인터넷+TV', price: '52,800', speed: '1Gbps', commitment: '36개월', promotion: '넷플릭스 6개월 + 설치비 면제', giftMin: 280000, giftMax: 450000, status: '판매중' },
    { id: 6, code: 'KT-TEL-001', name: 'KT 집전화', type: '전화', price: '3,300', speed: '-', commitment: '12개월', promotion: '-', giftMin: 0, giftMax: 20000, status: '중지' },
    { id: 7, code: 'KT-INT-003', name: '슬림 100M', type: '인터넷', price: '22,000', speed: '100Mbps', commitment: '24개월', promotion: '2개월 무료', giftMin: 50000, giftMax: 120000, status: '중지' },
    { id: 8, code: 'KT-INT-004', name: '프리미엄 2.5G', type: '인터넷', price: '44,000', speed: '2.5Gbps', commitment: '36개월', promotion: 'WiFi6E 공유기 무료', giftMin: 200000, giftMax: 380000, status: '판매중' },
  ],
  'LG U+': [
    { id: 1, code: 'LGU-INT-001', name: '베이직 500M', type: '인터넷', price: '30,800', speed: '500Mbps', commitment: '36개월', promotion: '3개월 무료', giftMin: 100000, giftMax: 200000, status: '판매중' },
    { id: 2, code: 'LGU-INT-002', name: '프리미엄 1G', type: '인터넷', price: '36,300', speed: '1Gbps', commitment: '36개월', promotion: '설치비 면제 + 3개월 할인', giftMin: 150000, giftMax: 300000, status: '판매중' },
    { id: 3, code: 'LGU-BND-001', name: '프리미엄 500M+유플러스tv', type: '인터넷+TV', price: '42,900', speed: '500Mbps', commitment: '36개월', promotion: '유플러스tv 베이직 6개월', giftMin: 200000, giftMax: 330000, status: '판매중' },
    { id: 4, code: 'LGU-TV-001', name: '유플러스tv 에센셜', type: 'TV', price: '12,100', speed: '-', commitment: '24개월', promotion: 'VOD 쿠폰 5천원', giftMin: 50000, giftMax: 100000, status: '판매중' },
    { id: 5, code: 'LGU-BND-002', name: '프리미엄 1G+유플러스tv올', type: '인터넷+TV', price: '51,700', speed: '1Gbps', commitment: '36개월', promotion: '넷플릭스 3개월 + 설치비 면제', giftMin: 250000, giftMax: 420000, status: '판매중' },
    { id: 6, code: 'LGU-TEL-001', name: 'U+집전화', type: '전화', price: '3,300', speed: '-', commitment: '12개월', promotion: '-', giftMin: 0, giftMax: 25000, status: '중지' },
    { id: 7, code: 'LGU-INT-003', name: '베이직 100M', type: '인터넷', price: '22,000', speed: '100Mbps', commitment: '24개월', promotion: '2개월 무료', giftMin: 50000, giftMax: 110000, status: '중지' },
  ],
};

const emptyForm = {
  code: '', name: '', type: '인터넷', price: '', speed: '', commitment: '36개월',
  promotion: '', giftMin: '', giftMax: '', memo: '',
};

export default function CarrierProducts() {
  const { carrier: carrierParam } = useParams();
  const carrier = carrierMap[carrierParam] || 'SKT';
  const carrierColor = theme.carrier[carrier] || theme.navy;

  const [products, setProducts] = useState(mockData[carrier] || []);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [filters, setFilters] = useState({ type: '전체', status: '전체' });

  const filtered = useMemo(() => {
    return products.filter(p => {
      if (filters.type !== '전체' && p.type !== filters.type) return false;
      if (filters.status !== '전체' && p.status !== filters.status) return false;
      return true;
    });
  }, [products, filters]);

  const openAdd = () => {
    setEditingProduct(null);
    setForm({ ...emptyForm });
    setShowModal(true);
  };

  const openEdit = (product) => {
    setEditingProduct(product);
    setForm({
      code: product.code, name: product.name, type: product.type,
      price: product.price, speed: product.speed, commitment: product.commitment,
      promotion: product.promotion, giftMin: product.giftMin, giftMax: product.giftMax, memo: '',
    });
    setShowModal(true);
  };

  const handleSave = () => {
    if (editingProduct) {
      setProducts(prev => prev.map(p =>
        p.id === editingProduct.id
          ? { ...p, code: form.code, name: form.name, type: form.type, price: form.price, speed: form.speed, commitment: form.commitment, promotion: form.promotion, giftMin: Number(form.giftMin), giftMax: Number(form.giftMax), status: p.status }
          : p
      ));
    } else {
      const newId = Math.max(0, ...products.map(p => p.id)) + 1;
      setProducts(prev => [...prev, {
        id: newId, code: form.code, name: form.name, type: form.type, price: form.price,
        speed: form.speed, commitment: form.commitment, promotion: form.promotion,
        giftMin: Number(form.giftMin), giftMax: Number(form.giftMax), status: '판매중',
      }]);
    }
    setShowModal(false);
  };

  const handleDelete = (id) => {
    if (window.confirm('정말 삭제하시겠습니까?')) {
      setProducts(prev => prev.filter(p => p.id !== id));
    }
  };

  const updateForm = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const formatGift = (min, max) => {
    const fmt = v => v >= 10000 ? `${(v / 10000).toLocaleString()}만` : `${v.toLocaleString()}원`;
    if (!min && !max) return '-';
    return `${fmt(min)} ~ ${fmt(max)}`;
  };

  // Styles
  const overlay = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', zIndex: 1000,
  };

  const modal = {
    background: '#fff', borderRadius: 12, padding: 24, width: 520,
    maxHeight: '85vh', overflowY: 'auto', boxShadow: theme.shadowLg,
  };

  const formRow = { marginBottom: 12 };
  const formLabel = { display: 'block', fontSize: 11, fontWeight: 600, color: theme.textSecondary, marginBottom: 4 };
  const formGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 };

  const selectStyle = { ...input, appearance: 'auto' };

  return (
    <div style={{ fontFamily: theme.sans }}>
      {/* Page Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{ width: 4, height: 24, borderRadius: 2, background: carrierColor }} />
        <h2 style={{ margin: 0, fontSize: 18, color: theme.text, fontWeight: 700 }}>
          {carrier} 인터넷·TV 상품 관리
        </h2>
        <span style={{ fontSize: 12, color: theme.textMuted, marginLeft: 4 }}>
          총 {filtered.length}건
        </span>
      </div>

      {/* Filter Bar + Actions */}
      <div style={{ ...card, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* 상품유형 필터 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: theme.textSecondary, marginRight: 4 }}>상품유형</span>
            {['전체', '인터넷', 'TV', '인터넷+TV', '전화'].map(t => (
              <button key={t} style={filterBtn(filters.type === t)}
                onClick={() => setFilters(f => ({ ...f, type: t }))}>
                {t}
              </button>
            ))}
          </div>

          {/* 상태 필터 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: theme.textSecondary, marginRight: 4 }}>상태</span>
            {['전체', '판매중', '중지'].map(s => (
              <button key={s} style={filterBtn(filters.status === s)}
                onClick={() => setFilters(f => ({ ...f, status: s }))}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={button.primary} onClick={openAdd}>+ 상품 추가</button>
          <button style={button.secondary}>엑셀 업로드</button>
          <button style={button.secondary}>엑셀 다운로드</button>
        </div>
      </div>

      {/* Product Table */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              {['상품코드', '상품명', '유형', '월요금', '속도', '약정', '프로모션', '사은품범위', '상태', '관리'].map(col => (
                <th key={col} style={tableStyles.th}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ ...tableStyles.td, textAlign: 'center', padding: 32, color: theme.textMuted }}>
                  조건에 맞는 상품이 없습니다.
                </td>
              </tr>
            ) : (
              filtered.map(p => (
                <tr key={p.id} style={{ cursor: 'default' }}
                  onMouseEnter={e => e.currentTarget.style.background = theme.bgHover}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td style={{ ...tableStyles.td, fontFamily: 'monospace', fontSize: 11, color: theme.textMuted }}>{p.code}</td>
                  <td style={{ ...tableStyles.td, fontWeight: 600, color: theme.text }}>{p.name}</td>
                  <td style={tableStyles.td}>
                    <span style={{
                      fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 600,
                      background: p.type === '인터넷' ? theme.blueBg : p.type === 'TV' ? theme.purpleBg : p.type === '인터넷+TV' ? theme.orangeBg : theme.status.gray.bg,
                      color: p.type === '인터넷' ? theme.blue : p.type === 'TV' ? theme.purple : p.type === '인터넷+TV' ? theme.orange : theme.status.gray.color,
                    }}>{p.type}</span>
                  </td>
                  <td style={{ ...tableStyles.td, textAlign: 'right', fontWeight: 600 }}>{p.price}원</td>
                  <td style={{ ...tableStyles.td, textAlign: 'center' }}>{p.speed}</td>
                  <td style={{ ...tableStyles.td, textAlign: 'center' }}>{p.commitment}</td>
                  <td style={{ ...tableStyles.td, fontSize: 11, maxWidth: 160 }}>{p.promotion}</td>
                  <td style={{ ...tableStyles.td, fontSize: 11, textAlign: 'center' }}>{formatGift(p.giftMin, p.giftMax)}</td>
                  <td style={{ ...tableStyles.td, textAlign: 'center' }}>
                    <span style={statusStyle(p.status === '판매중' ? 'green' : 'gray')}>{p.status}</span>
                  </td>
                  <td style={{ ...tableStyles.td, textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <button onClick={() => openEdit(p)}
                      style={{ background: 'none', border: 'none', color: theme.blue, cursor: 'pointer', fontSize: 11, fontWeight: 600, padding: '2px 6px', fontFamily: theme.sans }}>
                      수정
                    </button>
                    <span style={{ color: theme.border }}>|</span>
                    <button onClick={() => handleDelete(p.id)}
                      style={{ background: 'none', border: 'none', color: theme.red, cursor: 'pointer', fontSize: 11, fontWeight: 600, padding: '2px 6px', fontFamily: theme.sans }}>
                      삭제
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={overlay} onClick={() => setShowModal(false)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 18px', fontSize: 15, fontWeight: 700, color: theme.text }}>
              {editingProduct ? '상품 수정' : '상품 추가'}
            </h3>

            <div style={formGrid}>
              <div style={formRow}>
                <label style={formLabel}>상품코드</label>
                <input style={input} value={form.code} onChange={e => updateForm('code', e.target.value)} placeholder="예: SKT-INT-001" />
              </div>
              <div style={formRow}>
                <label style={formLabel}>상품명</label>
                <input style={input} value={form.name} onChange={e => updateForm('name', e.target.value)} placeholder="상품명 입력" />
              </div>
            </div>

            <div style={formGrid}>
              <div style={formRow}>
                <label style={formLabel}>유형</label>
                <select style={selectStyle} value={form.type} onChange={e => updateForm('type', e.target.value)}>
                  {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={formRow}>
                <label style={formLabel}>월요금</label>
                <input style={input} value={form.price} onChange={e => updateForm('price', e.target.value)} placeholder="예: 33,000" />
              </div>
            </div>

            <div style={formGrid}>
              <div style={formRow}>
                <label style={formLabel}>속도</label>
                <input style={input} value={form.speed} onChange={e => updateForm('speed', e.target.value)} placeholder="예: 500Mbps" />
              </div>
              <div style={formRow}>
                <label style={formLabel}>약정기간</label>
                <select style={selectStyle} value={form.commitment} onChange={e => updateForm('commitment', e.target.value)}>
                  {commitmentOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div style={formRow}>
              <label style={formLabel}>프로모션</label>
              <textarea style={{ ...input, minHeight: 56, resize: 'vertical' }} value={form.promotion}
                onChange={e => updateForm('promotion', e.target.value)} placeholder="프로모션 내용 입력" />
            </div>

            <div style={formGrid}>
              <div style={formRow}>
                <label style={formLabel}>사은품 범위 (최소)</label>
                <input style={input} type="number" value={form.giftMin} onChange={e => updateForm('giftMin', e.target.value)} placeholder="0" />
              </div>
              <div style={formRow}>
                <label style={formLabel}>사은품 범위 (최대)</label>
                <input style={input} type="number" value={form.giftMax} onChange={e => updateForm('giftMax', e.target.value)} placeholder="300000" />
              </div>
            </div>

            <div style={formRow}>
              <label style={formLabel}>메모</label>
              <textarea style={{ ...input, minHeight: 48, resize: 'vertical' }} value={form.memo}
                onChange={e => updateForm('memo', e.target.value)} placeholder="관리용 메모 (선택)" />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <button style={button.secondary} onClick={() => setShowModal(false)}>취소</button>
              <button style={button.primary} onClick={handleSave}>저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
