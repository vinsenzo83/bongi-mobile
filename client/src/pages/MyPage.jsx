import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { api } from '../utils/api.js';

export default function MyPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('applications');
  const [applications, setApplications] = useState([]);

  useEffect(() => {
    api.crm.getApplications()
      .then(setApplications)
      .catch(() => setApplications([]));
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const tabs = [
    { id: 'applications', label: '신청 내역' },
    { id: 'contracts', label: '계약 상태' },
    { id: 'profile', label: '내 정보' },
  ];

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 700 }}>
        {/* 프로필 헤더 */}
        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: 22, marginBottom: 4 }}>{user?.displayName || user?.email}</h2>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{user?.email}</div>
            <span className="badge badge-blue" style={{ marginTop: 8 }}>{user?.role || 'customer'}</span>
          </div>
          <button onClick={handleLogout} className="btn btn-outline" style={{ color: 'var(--danger)' }}>로그아웃</button>
        </div>

        {/* 탭 */}
        <div style={{ display: 'flex', gap: 4, marginTop: 20, marginBottom: 16 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`btn ${tab === t.id ? 'btn-primary' : 'btn-outline'}`} style={{ fontSize: 14 }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* 신청 내역 */}
        {tab === 'applications' && (
          <div className="card">
            <h3 style={{ fontSize: 16, marginBottom: 16 }}>신청 내역</h3>
            {applications.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>아직 신청 내역이 없습니다</p>
            ) : (
              <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={th}>접수번호</th>
                    <th style={th}>유형</th>
                    <th style={th}>상품</th>
                    <th style={th}>상태</th>
                    <th style={th}>날짜</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map(a => (
                    <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={td}><code>{a.id}</code></td>
                      <td style={td}>{a.type === 'self' ? '셀프가입' : a.type === 'call' ? '바로상담' : a.type}</td>
                      <td style={td}>{a.productTicket || a.product_ticket || '-'}</td>
                      <td style={td}><span className="badge badge-blue">{a.status}</span></td>
                      <td style={td}>{(() => { const d = new Date(a.createdAt || a.created_at); return isNaN(d) ? '-' : d.toLocaleDateString('ko-KR'); })()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* 계약 상태 */}
        {tab === 'contracts' && (
          <div className="card">
            <h3 style={{ fontSize: 16, marginBottom: 16 }}>계약 상태</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>계약 내역은 상담사 확인 후 표시됩니다</p>
          </div>
        )}

        {/* 내 정보 */}
        {tab === 'profile' && (
          <div className="card">
            <h3 style={{ fontSize: 16, marginBottom: 16 }}>내 정보</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>이메일</span><div style={{ fontSize: 15 }}>{user?.email}</div></div>
              <div><span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>이름</span><div style={{ fontSize: 15 }}>{user?.displayName || '-'}</div></div>
              <div><span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>역할</span><div style={{ fontSize: 15 }}>{user?.role}</div></div>
              <div><span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>가입일</span><div style={{ fontSize: 15 }}>{user?.created_at ? new Date(user.created_at).toLocaleDateString('ko-KR') : '-'}</div></div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

const th = { textAlign: 'left', padding: '8px 10px', fontSize: 12, color: 'var(--text-secondary)' };
const td = { padding: '10px', verticalAlign: 'middle' };
