import { useState, useEffect } from 'react';
import Topbar from '../../components/admin/Topbar.jsx';
import DataTable from '../../components/admin/DataTable.jsx';
import FilterBar from '../../components/admin/FilterBar.jsx';
import Badge from '../../components/admin/Badge.jsx';
import { theme } from '../../styles/admin-theme.js';
import { api } from '../../utils/api.js';

export default function MemberList() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadMembers(); }, []);

  async function loadMembers() {
    setLoading(true);
    try {
      const data = await api.admin.getMembers();
      setMembers(data.members || []);
    } catch {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }

  const tierLabels = { normal: '일반', bronze: '브론즈', silver: '실버', gold: '골드' };
  const tierColors = { normal: '#888', bronze: '#cd7f32', silver: '#c0c0c0', gold: '#fbbf24' };

  const columns = [
    { key: 'name', label: '이름', sortable: true },
    { key: 'email', label: '이메일' },
    { key: 'phone', label: '전화번호' },
    {
      key: 'member_type', label: '구분',
      render: (v) => <Badge label={v === 'agent' ? '상담원' : '고객'} variant={v === 'agent' ? 'agent' : 'customer'} />,
    },
    {
      key: 'role', label: '역할',
      render: (v) => <Badge label={v || 'customer'} variant={v || 'customer'} />,
    },
    {
      key: 'member_tier', label: '등급',
      render: (v) => {
        const tier = v || 'normal';
        return <span style={{ color: tierColors[tier], fontWeight: 600, fontSize: 13 }}>{tierLabels[tier] || '일반'}</span>;
      },
    },
    {
      key: 'total_conversions', label: '계약수',
      render: (v) => <span style={{ fontWeight: 600 }}>{v || 0}건</span>,
    },
    { key: 'created_at', label: '가입일', render: (v) => v ? new Date(v).toLocaleDateString('ko-KR') : '-' },
  ];

  const filters = [
    { key: 'type', label: '구분', options: [{ value: 'agent', label: '상담원' }, { value: 'customer', label: '고객' }] },
  ];

  return (
    <>
      <Topbar title="회원 관리" />
      <div style={{ padding: '16px 0' }}>
        <FilterBar filters={filters} searchPlaceholder="이름/이메일 검색..." />
        <div style={{ background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: theme.radiusLg, padding: 16 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: theme.textMuted }}>로딩 중...</div>
          ) : (
            <DataTable columns={columns} data={members} emptyText="등록된 회원이 없습니다" />
          )}
        </div>
      </div>
    </>
  );
}
