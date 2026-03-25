import { useState, useEffect } from 'react';
import Topbar from '../../components/admin/Topbar.jsx';
import DataTable from '../../components/admin/DataTable.jsx';
import TabGroup from '../../components/admin/TabGroup.jsx';
import Badge from '../../components/admin/Badge.jsx';
import KpiCard from '../../components/admin/KpiCard.jsx';
import { theme, button } from '../../styles/admin-theme.js';
import { api } from '../../utils/api.js';

export default function GiftManage() {
  const [gifts, setGifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');

  useEffect(() => { loadGifts(); }, [tab]);

  async function loadGifts() {
    setLoading(true);
    try {
      const params = tab !== 'all' ? { status: tab } : {};
      const data = await api.admin.getGifts(params);
      setGifts(data.gifts || []);
    } catch {
      setGifts([]);
    } finally {
      setLoading(false);
    }
  }

  async function handlePay(id) {
    try {
      await api.admin.updateGift(id, { status: 'paid' });
      loadGifts();
    } catch (e) {
      console.error('지급 처리 실패:', e);
    }
  }

  const pending = gifts.filter(g => g.status === 'pending');
  const paid = gifts.filter(g => g.status === 'paid');

  const tabs = [
    { key: 'all', label: '전체', count: gifts.length },
    { key: 'pending', label: '미지급', count: pending.length },
    { key: 'paid', label: '지급완료', count: paid.length },
  ];

  const columns = [
    { key: 'customer_id', label: '고객', sortable: true },
    { key: 'gift_type', label: '유형' },
    { key: 'amount', label: '금액', render: (v) => v ? `${Number(v).toLocaleString()}원` : '-' },
    {
      key: 'status', label: '상태',
      render: (v) => <Badge label={v === 'paid' ? '지급완료' : v === 'cancelled' ? '취소' : '미지급'} variant={v === 'paid' ? 'completed' : v === 'cancelled' ? 'cancelled' : 'pending'} />,
    },
    { key: 'paid_at', label: '지급일', render: (v) => v ? new Date(v).toLocaleDateString('ko-KR') : '-' },
    {
      key: '_actions', label: '',
      render: (_, row) => row.status === 'pending' ? (
        <button style={{ ...button.primary, padding: '4px 10px', fontSize: 12, background: theme.green }} onClick={(e) => { e.stopPropagation(); handlePay(row.id); }}>지급</button>
      ) : null,
    },
  ];

  return (
    <>
      <Topbar title="사은품 관리" />
      <div style={{ padding: '16px 0' }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <KpiCard label="미지급" value={pending.length} icon="⏳" color={theme.yellow} />
          <KpiCard label="지급완료" value={paid.length} icon="✅" color={theme.green} />
          <KpiCard label="총 금액" value={`${gifts.reduce((s, g) => s + (g.amount || 0), 0).toLocaleString()}원`} icon="💰" />
        </div>
        <TabGroup tabs={tabs} active={tab} onChange={setTab} />
        <div style={{ marginTop: 16, background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: theme.radiusLg, padding: 16 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: theme.textMuted }}>로딩 중...</div>
          ) : (
            <DataTable columns={columns} data={gifts} emptyText="사은품 내역이 없습니다" />
          )}
        </div>
      </div>
    </>
  );
}
