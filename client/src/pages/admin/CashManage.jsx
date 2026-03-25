import { useState, useEffect } from 'react';
import Topbar from '../../components/admin/Topbar.jsx';
import DataTable from '../../components/admin/DataTable.jsx';
import TabGroup from '../../components/admin/TabGroup.jsx';
import Badge from '../../components/admin/Badge.jsx';
import KpiCard from '../../components/admin/KpiCard.jsx';
import Modal from '../../components/admin/Modal.jsx';
import { theme, button, input } from '../../styles/admin-theme.js';
import { api } from '../../utils/api.js';

export default function CashManage() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [creditModal, setCreditModal] = useState(false);
  const [creditForm, setCreditForm] = useState({ user_id: '', amount: '', reason: '' });

  useEffect(() => { loadWithdrawals(); }, [tab]);

  async function loadWithdrawals() {
    setLoading(true);
    try {
      const params = tab !== 'all' ? { status: tab } : {};
      const data = await api.admin.getWithdrawals(params);
      setWithdrawals(data.withdrawals || []);
    } catch {
      setWithdrawals([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(id) {
    try {
      await api.admin.updateWithdrawal(id, { status: 'approved' });
      loadWithdrawals();
    } catch (e) {
      console.error('승인 실패:', e);
    }
  }

  async function handleReject(id) {
    try {
      await api.admin.updateWithdrawal(id, { status: 'rejected' });
      loadWithdrawals();
    } catch (e) {
      console.error('거절 실패:', e);
    }
  }

  async function handleManualCredit() {
    if (!creditForm.user_id || !creditForm.amount) return;
    try {
      await api.admin.manualCredit({
        user_id: creditForm.user_id,
        amount: Number(creditForm.amount),
        reason: creditForm.reason,
      });
      setCreditModal(false);
      setCreditForm({ user_id: '', amount: '', reason: '' });
      alert('적립 완료');
    } catch (e) {
      console.error('적립 실패:', e);
    }
  }

  const pending = withdrawals.filter(w => w.status === 'pending');

  const tabs = [
    { key: 'all', label: '전체', count: withdrawals.length },
    { key: 'pending', label: '대기', count: pending.length },
    { key: 'approved', label: '승인', count: withdrawals.filter(w => w.status === 'approved').length },
    { key: 'rejected', label: '거절', count: withdrawals.filter(w => w.status === 'rejected').length },
  ];

  const columns = [
    { key: 'user_id', label: '사용자', sortable: true },
    { key: 'amount', label: '금액', render: (v) => v ? `${Number(v).toLocaleString()}원` : '-' },
    { key: 'bank_name', label: '은행' },
    { key: 'account_number', label: '계좌번호' },
    {
      key: 'status', label: '상태',
      render: (v) => <Badge label={v === 'approved' ? '승인' : v === 'rejected' ? '거절' : '대기'} variant={v === 'approved' ? 'completed' : v === 'rejected' ? 'cancelled' : 'pending'} />,
    },
    { key: 'created_at', label: '신청일', render: (v) => v ? new Date(v).toLocaleDateString('ko-KR') : '-' },
    {
      key: '_actions', label: '',
      render: (_, row) => row.status === 'pending' ? (
        <div style={{ display: 'flex', gap: 4 }}>
          <button style={{ ...button.primary, padding: '4px 10px', fontSize: 12, background: theme.green }} onClick={(e) => { e.stopPropagation(); handleApprove(row.id); }}>승인</button>
          <button style={{ ...button.danger, padding: '4px 10px', fontSize: 12 }} onClick={(e) => { e.stopPropagation(); handleReject(row.id); }}>거절</button>
        </div>
      ) : null,
    },
  ];

  return (
    <>
      <Topbar
        title="리턴캐쉬 관리"
        actions={<button style={button.primary} onClick={() => setCreditModal(true)}>수동 적립</button>}
      />
      <div style={{ padding: '16px 0' }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <KpiCard label="출금 대기" value={pending.length} icon="⏳" color={theme.yellow} />
          <KpiCard label="총 출금 요청액" value={`${withdrawals.reduce((s, w) => s + (w.amount || 0), 0).toLocaleString()}원`} icon="💰" />
        </div>
        <TabGroup tabs={tabs} active={tab} onChange={setTab} />
        <div style={{ marginTop: 16, background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: theme.radiusLg, padding: 16 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: theme.textMuted }}>로딩 중...</div>
          ) : (
            <DataTable columns={columns} data={withdrawals} emptyText="출금 신청 내역이 없습니다" />
          )}
        </div>
      </div>

      <Modal open={creditModal} onClose={() => setCreditModal(false)} title="수동 적립" width={400}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 13, color: theme.textMuted, marginBottom: 4, display: 'block' }}>사용자 ID</label>
            <input style={input} value={creditForm.user_id} onChange={e => setCreditForm({ ...creditForm, user_id: e.target.value })} placeholder="UUID" />
          </div>
          <div>
            <label style={{ fontSize: 13, color: theme.textMuted, marginBottom: 4, display: 'block' }}>금액 (원)</label>
            <input style={input} type="number" value={creditForm.amount} onChange={e => setCreditForm({ ...creditForm, amount: e.target.value })} placeholder="10000" />
          </div>
          <div>
            <label style={{ fontSize: 13, color: theme.textMuted, marginBottom: 4, display: 'block' }}>사유</label>
            <input style={input} value={creditForm.reason} onChange={e => setCreditForm({ ...creditForm, reason: e.target.value })} placeholder="관리자 수동 적립" />
          </div>
          <button style={button.primary} onClick={handleManualCredit}>적립</button>
        </div>
      </Modal>
    </>
  );
}
