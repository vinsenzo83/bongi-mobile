import { useState, useEffect } from 'react';
import Topbar from '../../components/admin/Topbar.jsx';
import DataTable from '../../components/admin/DataTable.jsx';
import FilterBar from '../../components/admin/FilterBar.jsx';
import Badge from '../../components/admin/Badge.jsx';
import Modal from '../../components/admin/Modal.jsx';
import { theme, button, input } from '../../styles/admin-theme.js';
import { api } from '../../utils/api.js';

export default function ProductManage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', provider: '', category: '', price: '' });

  useEffect(() => { loadProducts(); }, []);

  async function loadProducts() {
    setLoading(true);
    try {
      const data = await api.admin.getProducts();
      setProducts(data.products || []);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    try {
      await api.admin.createProduct(form);
      setModalOpen(false);
      setForm({ name: '', provider: '', category: '', price: '' });
      loadProducts();
    } catch (e) {
      console.error('상품 등록 실패:', e);
    }
  }

  async function handleDelete(id) {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      await api.admin.deleteProduct(id);
      loadProducts();
    } catch (e) {
      console.error('삭제 실패:', e);
    }
  }

  const columns = [
    { key: 'name', label: '상품명', sortable: true },
    { key: 'provider', label: '통신사', render: (v) => v || '-' },
    { key: 'category', label: '카테고리', render: (v) => <Badge label={v || '기타'} variant="default" /> },
    { key: 'price', label: '가격', render: (v) => v ? `${Number(v).toLocaleString()}원` : '-' },
    { key: 'is_active', label: '상태', render: (v) => <Badge label={v === false ? '비활성' : '활성'} variant={v === false ? 'cancelled' : 'active'} /> },
    { key: 'created_at', label: '등록일', render: (v) => v ? new Date(v).toLocaleDateString('ko-KR') : '-' },
    {
      key: '_actions', label: '',
      render: (_, row) => (
        <button style={{ ...button.danger, padding: '4px 10px', fontSize: 12 }} onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}>삭제</button>
      ),
    },
  ];

  const filters = [
    { key: 'provider', label: '통신사', options: [{ value: 'SKT', label: 'SKT' }, { value: 'KT', label: 'KT' }, { value: 'LG U+', label: 'LG U+' }] },
    { key: 'category', label: '카테고리', options: [{ value: 'internet', label: '인터넷' }, { value: 'rental', label: '렌탈' }, { value: 'mvno', label: '알뜰폰' }] },
  ];

  return (
    <>
      <Topbar title="상품 관리" actions={<button style={button.primary} onClick={() => setModalOpen(true)}>상품 등록</button>} />
      <div style={{ padding: '16px 0' }}>
        <FilterBar filters={filters} searchPlaceholder="상품명 검색..." />
        <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: theme.radiusLg, padding: 16 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: theme.textMuted }}>로딩 중...</div>
          ) : (
            <DataTable columns={columns} data={products} emptyText="등록된 상품이 없습니다 (JSON 데이터는 상품 관리에 포함되지 않습니다)" />
          )}
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="상품 등록" width={480}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 13, color: theme.textMuted, display: 'block', marginBottom: 4 }}>상품명</label>
            <input style={input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: 13, color: theme.textMuted, display: 'block', marginBottom: 4 }}>통신사</label>
            <select style={{ ...input, cursor: 'pointer' }} value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value })}>
              <option value="">선택</option>
              <option value="SKT">SKT</option>
              <option value="KT">KT</option>
              <option value="LG U+">LG U+</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 13, color: theme.textMuted, display: 'block', marginBottom: 4 }}>카테고리</label>
            <select style={{ ...input, cursor: 'pointer' }} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              <option value="">선택</option>
              <option value="internet">인터넷</option>
              <option value="rental">렌탈</option>
              <option value="mvno">알뜰폰</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 13, color: theme.textMuted, display: 'block', marginBottom: 4 }}>가격 (원)</label>
            <input style={input} type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
          </div>
          <button style={button.primary} onClick={handleCreate}>등록</button>
        </div>
      </Modal>
    </>
  );
}
