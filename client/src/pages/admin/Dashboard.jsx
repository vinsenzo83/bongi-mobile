import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../utils/api.js';

const STATUS_LABELS = {
  new: { label: '신규', color: '#2563eb', bg: '#dbeafe' },
  waiting: { label: '상담대기', color: '#f59e0b', bg: '#fef3c7' },
  consulting: { label: '상담중', color: '#8b5cf6', bg: '#ede9fe' },
  contracted: { label: '계약완료', color: '#10b981', bg: '#d1fae5' },
  aftercare: { label: '사후관리', color: '#6b7280', bg: '#f3f4f6' },
  lost: { label: '이탈', color: '#ef4444', bg: '#fee2e2' },
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.crm.getDashboard().then(setStats).catch(() => {});
    loadCustomers();
  }, [filter]);

  const loadCustomers = () => {
    const params = {};
    if (filter) params.status = filter;
    if (search) params.search = search;
    api.crm.getCustomers(params).then(r => setCustomers(r.data || [])).catch(() => setCustomers([]));
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadCustomers();
  };

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 60 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800 }}>CRM 대시보드</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>리턴AI 고객 관리 시스템</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/admin/incentive" className="btn btn-outline">인센티브</Link>
          <Link to="/" className="btn btn-outline">고객 사이트</Link>
        </div>
      </div>

      {/* 통계 카드 */}
      {stats && (
        <div className="grid-4" style={{ marginBottom: 28 }}>
          <StatCard label="전체 고객" value={stats.totalCustomers} color="var(--primary)" />
          <StatCard label="신규/대기" value={(stats.customersByStatus?.new || 0) + (stats.customersByStatus?.waiting || 0)} color="#f59e0b" />
          <StatCard label="계약 완료" value={stats.totalContracts} color="#10b981" />
          <StatCard label="미처리 신청" value={stats.pendingApplications} color="#ef4444" />
        </div>
      )}

      {/* 상태 필터 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={() => setFilter('')} className={`btn ${!filter ? 'btn-primary' : 'btn-outline'}`} style={{ fontSize: 13 }}>전체</button>
        {Object.entries(STATUS_LABELS).map(([key, v]) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`btn ${filter === key ? 'btn-primary' : 'btn-outline'}`} style={{ fontSize: 13 }}>
            {v.label} {stats?.customersByStatus?.[key] ? `(${stats.customersByStatus[key]})` : ''}
          </button>
        ))}
      </div>

      {/* 검색 */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="이름 또는 전화번호 검색" style={{ flex: 1 }} />
        <button type="submit" className="btn btn-outline">검색</button>
      </form>

      {/* 고객 목록 */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th style={th}>이름</th>
              <th style={th}>연락처</th>
              <th style={th}>DB유형</th>
              <th style={th}>유입</th>
              <th style={th}>상태</th>
              <th style={th}>등록일</th>
            </tr>
          </thead>
          <tbody>
            {customers.map(c => {
              const st = STATUS_LABELS[c.status] || {};
              return (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                  onClick={() => window.location.href = `/admin/customer/${c.id}`}>
                  <td style={td}><strong>{c.name}</strong></td>
                  <td style={td}>{c.phone}</td>
                  <td style={td}>
                    <span className="badge" style={{ background: '#f1f5f9', color: 'var(--text)' }}>
                      {c.db_type === 'mnp' ? 'MNP' : c.db_type === 'device_change' ? '기변' : c.db_type === 'new' ? '신규' : '-'}
                    </span>
                  </td>
                  <td style={td}>{c.source === 'store' ? '매장' : c.source === 'web' ? '웹' : c.source === 'app' ? '앱' : c.source}</td>
                  <td style={td}>
                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: st.bg, color: st.color }}>
                      {st.label}
                    </span>
                  </td>
                  <td style={{ ...td, color: 'var(--text-secondary)' }}>{new Date(c.created_at).toLocaleDateString('ko-KR')}</td>
                </tr>
              );
            })}
            {customers.length === 0 && (
              <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: 'var(--text-secondary)' }}>고객이 없습니다</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 28, fontWeight: 800, color, fontFamily: 'monospace' }}>{value}</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{label}</div>
    </div>
  );
}

const th = { textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 };
const td = { padding: '12px', verticalAlign: 'middle' };
