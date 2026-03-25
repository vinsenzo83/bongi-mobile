import { useState, useEffect } from 'react';
import Topbar from '../../components/admin/Topbar.jsx';
import DataTable from '../../components/admin/DataTable.jsx';
import TabGroup from '../../components/admin/TabGroup.jsx';
import Badge from '../../components/admin/Badge.jsx';
import Modal from '../../components/admin/Modal.jsx';
import { theme, button } from '../../styles/admin-theme.js';
import { api } from '../../utils/api.js';

export default function ReviewManage() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [selected, setSelected] = useState(null);

  useEffect(() => { loadReviews(); }, [tab]);

  async function loadReviews() {
    setLoading(true);
    try {
      const params = tab !== 'all' ? { status: tab } : {};
      const data = await api.admin.getReviews(params);
      setReviews(data.reviews || []);
    } catch {
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(id) {
    try {
      await api.admin.updateReview(id, { is_approved: true });
      loadReviews();
    } catch (e) {
      console.error('승인 실패:', e);
    }
  }

  async function handleDelete(id) {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      await api.admin.deleteReview(id);
      loadReviews();
    } catch (e) {
      console.error('삭제 실패:', e);
    }
  }

  const tabs = [
    { key: 'all', label: '전체', count: reviews.length },
    { key: 'pending', label: '대기', count: reviews.filter(r => !r.is_approved).length },
    { key: 'approved', label: '승인', count: reviews.filter(r => r.is_approved).length },
  ];

  const columns = [
    { key: 'rating', label: '별점', width: 80, render: (v) => '★'.repeat(v || 0) + '☆'.repeat(5 - (v || 0)) },
    { key: 'product_name', label: '상품', sortable: true },
    { key: 'author_name', label: '작성자' },
    { key: 'content', label: '내용', render: (v) => (v || '').slice(0, 50) + ((v || '').length > 50 ? '...' : '') },
    {
      key: 'is_approved', label: '상태',
      render: (v) => <Badge label={v ? '승인' : '대기'} variant={v ? 'completed' : 'pending'} />,
    },
    { key: 'created_at', label: '작성일', render: (v) => v ? new Date(v).toLocaleDateString('ko-KR') : '-' },
    {
      key: '_actions', label: '',
      render: (_, row) => (
        <div style={{ display: 'flex', gap: 4 }}>
          {!row.is_approved && (
            <button style={{ ...button.primary, padding: '4px 10px', fontSize: 12, background: theme.green }} onClick={(e) => { e.stopPropagation(); handleApprove(row.id); }}>승인</button>
          )}
          <button style={{ ...button.danger, padding: '4px 10px', fontSize: 12 }} onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}>삭제</button>
        </div>
      ),
    },
  ];

  return (
    <>
      <Topbar title="후기 관리" />
      <div style={{ padding: '16px 0' }}>
        <TabGroup tabs={tabs} active={tab} onChange={setTab} />
        <div style={{ marginTop: 16, background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: theme.radiusLg, padding: 16 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: theme.textMuted }}>로딩 중...</div>
          ) : (
            <DataTable columns={columns} data={reviews} onRowClick={setSelected} />
          )}
        </div>
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="후기 상세" width={560}>
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 18, color: theme.yellow }}>{'★'.repeat(selected.rating || 0)}{'☆'.repeat(5 - (selected.rating || 0))}</div>
            <div style={{ color: theme.text }}><strong style={{ color: theme.textWhite }}>상품:</strong> {selected.product_name || '-'}</div>
            <div style={{ color: theme.text }}><strong style={{ color: theme.textWhite }}>작성자:</strong> {selected.author_name || '-'}</div>
            <div style={{ color: theme.text }}><strong style={{ color: theme.textWhite }}>카테고리:</strong> {selected.category || '-'}</div>
            {selected.image_url && (
              <img src={selected.image_url} alt="후기 이미지" style={{ maxWidth: 200, borderRadius: 8 }} />
            )}
            <div style={{ background: theme.bg, padding: 12, borderRadius: 8, lineHeight: 1.6, color: theme.text }}>
              {selected.content}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              {!selected.is_approved && (
                <button style={button.primary} onClick={() => { handleApprove(selected.id); setSelected(null); }}>승인</button>
              )}
              <button style={button.danger} onClick={() => { handleDelete(selected.id); setSelected(null); }}>삭제</button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
