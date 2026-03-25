import { useState, useEffect } from 'react';
import Topbar from '../../components/admin/Topbar.jsx';
import DataTable from '../../components/admin/DataTable.jsx';
import Badge from '../../components/admin/Badge.jsx';
import KpiCard from '../../components/admin/KpiCard.jsx';
import { theme } from '../../styles/admin-theme.js';
import { api } from '../../utils/api.js';

export default function CommissionSettle() {
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await api.admin.getSettlements();
        setSettlements(data.settlements || []);
      } catch {
        setSettlements([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const totalCommission = settlements.reduce((s, r) => s + (r.total_commission || 0), 0);

  const columns = [
    { key: 'agent_name', label: '상담사', sortable: true },
    { key: 'role', label: '역할', render: (v) => <Badge label={v || 'agent'} variant={v || 'agent'} /> },
    { key: 'total_contracts', label: '계약 건수', sortable: true },
    { key: 'total_commission', label: '수수료', render: (v) => `${(v || 0).toLocaleString()}원` },
    {
      key: 'status', label: '상태',
      render: (v) => <Badge label={v === 'approved' ? '승인' : v === 'paid' ? '지급완료' : '미확정'} variant={v === 'paid' ? 'completed' : v === 'approved' ? 'active' : 'pending'} />,
    },
  ];

  return (
    <>
      <Topbar title="수수료 정산" />
      <div style={{ padding: '16px 0' }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <KpiCard label="상담사" value={settlements.length} icon="👤" />
          <KpiCard label="총 수수료" value={`${totalCommission.toLocaleString()}원`} icon="💰" color={theme.green} />
        </div>
        <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: theme.radiusLg, padding: 16 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: theme.textMuted }}>로딩 중...</div>
          ) : (
            <DataTable columns={columns} data={settlements} emptyText="정산 데이터가 없습니다" />
          )}
        </div>
      </div>
    </>
  );
}
