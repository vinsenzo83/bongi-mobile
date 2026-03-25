import { useState, useEffect } from 'react';
import Topbar from '../../components/admin/Topbar.jsx';
import DataTable from '../../components/admin/DataTable.jsx';
import KpiCard from '../../components/admin/KpiCard.jsx';
import Badge from '../../components/admin/Badge.jsx';
import { theme } from '../../styles/admin-theme.js';
import { api } from '../../utils/api.js';

export default function ReferralManage() {
  const [data, setData] = useState({ referrals: [], rewards: [], stats: {} });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const result = await api.admin.getReferrals();
        setData(result);
      } catch {
        setData({ referrals: [], rewards: [], stats: {} });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const columns = [
    { key: 'referrer_code', label: '추천코드', sortable: true },
    { key: 'referee_id', label: '피추천인' },
    {
      key: 'status', label: '상태',
      render: (v) => <Badge label={v === 'converted' ? '계약완료' : v === 'registered' ? '가입' : v || '대기'} variant={v === 'converted' ? 'completed' : v === 'registered' ? 'active' : 'pending'} />,
    },
    { key: 'created_at', label: '날짜', render: (v) => v ? new Date(v).toLocaleDateString('ko-KR') : '-' },
  ];

  return (
    <>
      <Topbar title="친구초대 현황" />
      <div style={{ padding: '16px 0' }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <KpiCard label="총 추천" value={data.stats.total || 0} icon="🤝" />
          <KpiCard label="계약 전환" value={data.stats.converted || 0} icon="✅" color={theme.green} />
          <KpiCard label="전환율" value={data.stats.total > 0 ? `${Math.round((data.stats.converted / data.stats.total) * 100)}%` : '0%'} icon="📊" color={theme.blue} />
          <KpiCard label="지급 보상" value={`${(data.rewards || []).reduce((s, r) => s + (r.amount || 0), 0).toLocaleString()}원`} icon="💰" color={theme.yellow} />
        </div>
        <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: theme.radiusLg, padding: 16 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: theme.textMuted }}>로딩 중...</div>
          ) : (
            <DataTable columns={columns} data={data.referrals} emptyText="추천 내역이 없습니다" />
          )}
        </div>
      </div>
    </>
  );
}
