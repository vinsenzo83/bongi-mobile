// V5 인센티브 — 상담사 관리 (admin only)
// 신규 발급 · 편집 · 비번 재설정 · 활성/비활성 토글
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useV5Auth } from '../../../hooks/useV5Auth.jsx';

// ── 유틸 ───────────────────────────────────────────────
function genPassword(len = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
  return Array.from(crypto.getRandomValues(new Uint8Array(len)))
    .map(b => chars[b % chars.length]).join('');
}
const todayStr = () => new Date().toISOString().slice(0, 10);
const ym = () => new Date().toISOString().slice(0, 7);

// ── 스타일 ─────────────────────────────────────────────
const sectionStyle = {
  background: 'linear-gradient(135deg,#1e293b,#0f172a)',
  border: '1px solid #475569',
  borderRadius: 12,
  padding: '18px 22px',
  marginBottom: 20,
};
const h2Style = { fontSize: 14, color: '#fbbf24', fontWeight: 800, marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid #334155' };
const fieldLabelStyle = { fontSize: 10, color: '#94a3b8', fontWeight: 700, marginBottom: 3, letterSpacing: '0.03em', display: 'block' };
const fieldInputStyle = {
  background: '#0f172a', border: '1px solid #475569', color: '#e2e8f0',
  padding: '7px 9px', borderRadius: 5, fontSize: 12, width: '100%',
  fontFamily: 'inherit', boxSizing: 'border-box', colorScheme: 'dark',
};
const hintStyle = { fontSize: 9, color: '#64748b', marginTop: 2 };
const btnPrimary = { background: '#16a34a', color: '#fff', border: 'none', padding: '10px 22px', borderRadius: 8, fontWeight: 800, fontSize: 13, cursor: 'pointer' };
const btnSecondary = { background: '#475569', color: '#fff', border: 'none', padding: '7px 14px', borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: 'pointer' };
const btnDanger = { background: '#dc2626', color: '#fff', border: 'none', padding: '5px 11px', borderRadius: 5, fontSize: 10.5, fontWeight: 700, cursor: 'pointer', marginRight: 4 };
const btnWarn = { background: '#f59e0b', color: '#fff', border: 'none', padding: '5px 11px', borderRadius: 5, fontSize: 10.5, fontWeight: 700, cursor: 'pointer', marginRight: 4 };
const btnOk = { background: '#16a34a', color: '#fff', border: 'none', padding: '5px 11px', borderRadius: 5, fontSize: 10.5, fontWeight: 700, cursor: 'pointer', marginRight: 4 };
const btnEdit = { background: '#3b82f6', color: '#fff', border: 'none', padding: '5px 11px', borderRadius: 5, fontSize: 10.5, fontWeight: 700, cursor: 'pointer', marginRight: 4 };
const thStyle = { background: '#334155', color: '#f1f5f9', fontSize: 11, padding: '10px 8px', textAlign: 'left', fontWeight: 700 };
const tdStyle = { fontSize: 11.5, color: '#e2e8f0', padding: '10px 8px', borderBottom: '1px solid #334155', verticalAlign: 'middle' };

const ROLE_BADGE_COLOR = {
  agent: '#3b82f6',
  manager: '#16a34a',
  contract: '#0891b2',
  admin: '#dc2626',
};
function RoleBadge({ role }) {
  return (
    <span style={{
      background: ROLE_BADGE_COLOR[role] || '#6b7280',
      color: '#fff', padding: '2px 7px', borderRadius: 4,
      fontSize: 9, fontWeight: 800, letterSpacing: '0.03em',
    }}>{role}</span>
  );
}

// ── 토스트 ─────────────────────────────────────────────
function Toast({ message }) {
  if (!message) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)',
      background: '#16a34a', color: '#fff', padding: '14px 24px', borderRadius: 10,
      fontSize: 14, fontWeight: 800, boxShadow: '0 6px 24px rgba(22,163,74,0.5)', zIndex: 99999,
    }}>{message}</div>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────
export default function V5Agents() {
  const { apiCall, agent, isAdmin } = useV5Auth();
  const [allAgents, setAllAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [pointsByAgent, setPointsByAgent] = useState({});

  // 신규 발급 폼
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newCenter, setNewCenter] = useState('');
  const [newRole, setNewRole] = useState('agent');
  const [newBaseSalary, setNewBaseSalary] = useState(2300000);
  const [newHireDate, setNewHireDate] = useState(todayStr());
  const [credResult, setCredResult] = useState(null); // {email, password}

  // 필터
  const [filterRole, setFilterRole] = useState('');
  const [filterActive, setFilterActive] = useState('true'); // 기본: active만
  const [search, setSearch] = useState('');

  // 편집 모달
  const [editId, setEditId] = useState(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }, []);

  // ── 데이터 로드 ──
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiCall('GET', '/agents/all');
      if (!res.ok) throw new Error((await res.json()).error || '조회 실패');
      const { agents } = await res.json();
      setAllAgents(agents || []);
      setError('');

      // 이번달 P 비동기 로드 (백그라운드)
      const month = ym();
      (agents || []).forEach(async (a) => {
        try {
          const r = await apiCall('GET', `/settlement?agent_id=${a.id}&month=${month}`);
          if (!r.ok) return;
          const { settlement } = await r.json();
          if (!settlement) return;
          setPointsByAgent(prev => ({ ...prev, [a.id]: settlement }));
        } catch { /* ignore */ }
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── 센터 자동완성 목록 ──
  const centerOptions = useMemo(() => {
    return [...new Set(allAgents.map(a => a.center).filter(Boolean))];
  }, [allAgents]);

  // ── 필터링 ──
  const filtered = useMemo(() => {
    let arr = allAgents;
    if (filterRole) arr = arr.filter(a => a.role === filterRole);
    if (filterActive) arr = arr.filter(a => String(a.active) === filterActive);
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter(a =>
        (a.name || '').toLowerCase().includes(q) ||
        (a.center || '').toLowerCase().includes(q) ||
        (a.email || '').toLowerCase().includes(q)
      );
    }
    return arr;
  }, [allAgents, filterRole, filterActive, search]);

  // ── 신규 발급 ──
  const handleCreate = async () => {
    const email = newEmail.trim();
    const name = newName.trim();
    const center = newCenter.trim();
    let password = newPassword;

    if (!email || !name || !center) { alert('이메일/이름/센터 필수'); return; }
    if (!password) password = genPassword();
    if (password.length < 8) { alert('비밀번호 8자 이상'); return; }

    if (!confirm(`계정 발급:\n${email} (${name}, ${newRole}, ${center})\n비밀번호: ${password}\n\n진행?`)) return;

    try {
      const res = await apiCall('POST', '/admin/create-agent', {
        email, password, name, center, role: newRole,
        base_salary: parseInt(newBaseSalary, 10) || 2300000,
        hire_date: newHireDate || null,
      });
      if (!res.ok) throw new Error((await res.json()).error || '발급 실패');

      setCredResult({ email, password });
      setNewEmail(''); setNewName(''); setNewPassword('');
      showToast('✅ 계정 발급 완료');
      await loadAll();
    } catch (e) {
      alert('오류: ' + e.message);
    }
  };

  // ── 비밀번호 재설정 ──
  const handleResetPassword = async (id, name) => {
    const newPw = prompt(`'${name}' 비밀번호 재설정 — 새 비밀번호 (8자+):`, genPassword());
    if (!newPw || newPw.length < 8) return;
    try {
      const res = await apiCall('POST', `/agents/${id}/reset-password`, { password: newPw });
      if (!res.ok) throw new Error((await res.json()).error || '실패');
      alert(`✅ '${name}' 비밀번호 재설정 완료\n\n새 비밀번호: ${newPw}\n(본인에게 전달하세요)`);
      showToast('🔑 비밀번호 변경됨');
    } catch (e) {
      alert('오류: ' + e.message);
    }
  };

  // ── 부분 PATCH (활성 토글 등) ──
  const patchAgent = async (id, body, msg) => {
    try {
      const res = await apiCall('PATCH', `/agents/${id}`, body);
      if (!res.ok) throw new Error((await res.json()).error || '실패');
      showToast(msg);
      await loadAll();
    } catch (e) {
      alert('오류: ' + e.message);
    }
  };

  if (!isAdmin) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#fbbf24', fontSize: 14 }}>
        ⚠️ admin 권한 필요 (현재 {agent?.role || '미인증'})
      </div>
    );
  }

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, paddingBottom: 16, borderBottom: '1px solid #334155' }}>
        <div>
          <h1 style={{ fontSize: 22, color: '#f8fafc', fontWeight: 800, letterSpacing: '-0.02em' }}>👥 상담사 관리 (V5)</h1>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>신규 계정 발급 · 비밀번호 재설정 · 권한 변경 · 활성/비활성</div>
        </div>
      </div>

      {/* 신규 발급 */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>➕ 신규 상담사 발급</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 10 }}>
          <Field label={<>이메일 * <span style={{ color: '#dc2626' }}>필수</span></>}
            hint="로그인 ID로 사용 · 중복 시 발급 거부">
            <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
              placeholder="agent@bongi.test" autoComplete="off" style={fieldInputStyle} />
          </Field>
          <Field label="비밀번호 (8자 이상)" hint="12자 무작위 (숫자·영문·기호) · 본인이 변경 가능">
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                placeholder="비워두면 자동 생성" autoComplete="off"
                style={{ ...fieldInputStyle, flex: 1 }} />
              <button type="button" onClick={() => setNewPassword(genPassword())}
                style={{ ...btnSecondary, padding: '7px 12px' }}>🎲 자동</button>
            </div>
          </Field>
          <Field label={<>이름 * <span style={{ color: '#dc2626' }}>필수</span></>}
            hint="실명 (인센티브 정산서 표시용)">
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="홍길동" style={fieldInputStyle} />
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 10 }}>
          <Field label={<>센터 * <span style={{ color: '#dc2626' }}>필수</span></>}
            hint="매니저는 본인 센터만 조회 가능">
            <input type="text" value={newCenter} onChange={e => setNewCenter(e.target.value)}
              placeholder="광주센터" list="centers-list" style={fieldInputStyle} />
            <datalist id="centers-list">
              {centerOptions.map(c => <option key={c} value={c} />)}
            </datalist>
          </Field>
          <Field label="역할" hint="변경은 발급 후에도 가능">
            <select value={newRole} onChange={e => setNewRole(e.target.value)} style={fieldInputStyle}>
              <option value="agent">agent — 상담사 (본인 영업만)</option>
              <option value="manager">manager — 상담사팀장 (본인 센터)</option>
              <option value="contract">contract — 계약관리담당자</option>
              <option value="admin">admin — 총 관리자 (전체 + 정책)</option>
            </select>
          </Field>
          <Field label="기본급 (₩/월)" hint="기본 230만 (V5 표준)">
            <input type="number" value={newBaseSalary} onChange={e => setNewBaseSalary(e.target.value)}
              min="0" max="20000000" step="100000" style={fieldInputStyle} />
          </Field>
          <Field label="📅 입사일 (달력)" hint="기본값 오늘 · 클릭하면 달력 표시">
            <input type="date" value={newHireDate} onChange={e => setNewHireDate(e.target.value)}
              style={fieldInputStyle} />
          </Field>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          <div style={{ fontSize: 9.5, color: '#94a3b8' }}>계정 발급 후 이메일과 비밀번호를 본인에게 전달하세요. 첫 로그인 후 비밀번호 변경 권장.</div>
          <button onClick={handleCreate} style={btnPrimary}>➕ 발급</button>
        </div>
        {credResult && (
          <div style={{
            background: 'rgba(22,163,74,0.1)', border: '1.5px solid #22c55e', borderRadius: 8,
            padding: '12px 14px', marginTop: 10, fontSize: 12, color: '#86efac',
            fontFamily: '"SF Mono", Monaco, monospace',
          }}>
            <div style={{ fontWeight: 800, marginBottom: 6, color: '#22c55e' }}>✅ 계정 발급 완료 — 본인에게 안전하게 전달하세요</div>
            <div>📧 이메일: <b>{credResult.email}</b></div>
            <div>🔑 비밀번호: <b>{credResult.password}</b></div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 6 }}>⚠️ 이 비밀번호는 한 번만 표시됩니다. 잊지 말고 복사하세요.</div>
          </div>
        )}
      </div>

      {/* 목록 */}
      <div style={sectionStyle}>
        <h2 style={h2Style}>📋 전체 상담사 목록</h2>
        <div style={{ marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 11, color: '#94a3b8' }}>필터:</label>
          <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
            style={{ ...fieldInputStyle, width: 'auto', fontSize: 11, padding: '5px 9px' }}>
            <option value="">전체 역할</option>
            <option value="agent">agent (상담사)</option>
            <option value="manager">manager (팀장)</option>
            <option value="contract">contract (계약담당)</option>
            <option value="admin">admin (관리자)</option>
          </select>
          <select value={filterActive} onChange={e => setFilterActive(e.target.value)}
            style={{ ...fieldInputStyle, width: 'auto', fontSize: 11, padding: '5px 9px' }}>
            <option value="">전체 상태</option>
            <option value="true">활성</option>
            <option value="false">비활성</option>
          </select>
          <input type="text" placeholder="이름·센터·이메일 검색"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...fieldInputStyle, width: 220, fontSize: 11, padding: '5px 9px' }} />
          <button onClick={loadAll} style={btnSecondary}>🔄 새로고침</button>
          <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto' }}>{filtered.length}명</span>
        </div>
        {error && <div style={{ color: '#fca5a5', fontSize: 12, marginBottom: 10 }}>⚠️ {error}</div>}
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#1e293b', borderRadius: 10, overflow: 'hidden' }}>
          <thead>
            <tr>
              <th style={thStyle}>이름</th>
              <th style={thStyle}>센터</th>
              <th style={thStyle}>역할</th>
              <th style={thStyle}>입사일</th>
              <th style={thStyle}>기본급</th>
              <th style={thStyle}>활성</th>
              <th style={thStyle}>이번달 P</th>
              <th style={thStyle}>작업</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" style={{ ...tdStyle, textAlign: 'center', padding: 30, color: '#64748b' }}>로딩 중...</td></tr>
            ) : !filtered.length ? (
              <tr><td colSpan="8" style={{ ...tdStyle, textAlign: 'center', padding: 30, color: '#64748b' }}>없음</td></tr>
            ) : filtered.map(a => {
              const settlement = pointsByAgent[a.id];
              return (
                <tr key={a.id} style={{ opacity: a.active ? 1 : 0.5 }}>
                  <td style={tdStyle}>
                    <b>{a.name}</b>
                    <div style={{ fontSize: 9, color: '#64748b' }}>{a.id.slice(0, 8)}</div>
                  </td>
                  <td style={tdStyle}>{a.center || '-'}</td>
                  <td style={tdStyle}><RoleBadge role={a.role} /></td>
                  <td style={tdStyle}>{(a.hire_date || '-').slice(0, 10)}</td>
                  <td style={tdStyle}>{(a.base_salary || 0).toLocaleString()}</td>
                  <td style={tdStyle}>
                    {a.active
                      ? <span style={{ background: '#16a34a', color: '#fff', padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 800 }}>활성</span>
                      : <span style={{ background: '#475569', color: '#cbd5e1', padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 800 }}>비활성</span>}
                  </td>
                  <td style={{ ...tdStyle, fontSize: 10, color: '#94a3b8' }}>
                    {settlement ? (
                      <>
                        {settlement.total_points || 0}P · 우수 {settlement.premium_count || 0}
                        <div style={{ fontSize: 9 }}>G{settlement.grade_applied || 1}{settlement.is_penalty ? ' ⚠️' : ''}</div>
                      </>
                    ) : '-'}
                  </td>
                  <td style={tdStyle}>
                    <button style={btnEdit} onClick={() => setEditId(a.id)}>📝 편집</button>
                    <button style={btnSecondary} onClick={() => handleResetPassword(a.id, a.name)}>🔑 비번</button>
                    {a.active
                      ? <button style={btnWarn} onClick={() => patchAgent(a.id, { active: false }, '❌ 비활성화됨')}>비활성</button>
                      : <button style={btnOk} onClick={() => patchAgent(a.id, { active: true }, '✅ 활성화됨')}>활성화</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 편집 모달 */}
      {editId && (
        <EditModal
          agent={allAgents.find(a => a.id === editId)}
          onClose={() => setEditId(null)}
          onSave={async (body) => {
            await patchAgent(editId, body, '✅ 변경사항 저장 완료');
            setEditId(null);
          }}
        />
      )}

      <Toast message={toast} />
    </div>
  );
}

// ── 필드 헬퍼 ──
function Field({ label, hint, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <label style={fieldLabelStyle}>{label}</label>
      {children}
      {hint && <div style={hintStyle}>{hint}</div>}
    </div>
  );
}

// ── 편집 모달 ──
function EditModal({ agent, onClose, onSave }) {
  const [name, setName] = useState(agent?.name || '');
  const [center, setCenter] = useState(agent?.center || '');
  const [role, setRole] = useState(agent?.role || 'agent');
  const [hireDate, setHireDate] = useState((agent?.hire_date || '').slice(0, 10));
  const [baseSalary, setBaseSalary] = useState(agent?.base_salary || 2300000);
  const [active, setActive] = useState(agent?.active ?? true);

  // ESC로 닫기
  useEffect(() => {
    const onEsc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [onClose]);

  if (!agent) return null;

  const handleSubmit = () => {
    if (!name.trim() || !center.trim()) { alert('이름과 센터 필수'); return; }
    onSave({
      name: name.trim(),
      center: center.trim(),
      role,
      hire_date: hireDate || null,
      base_salary: parseInt(baseSalary, 10) || 0,
      active,
    });
  };

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
        padding: '30px 20px', overflowY: 'auto',
      }}>
      <div style={{
        background: 'linear-gradient(135deg,#1e293b,#0f172a)', border: '1.5px solid #475569',
        borderRadius: 14, maxWidth: 700, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
      }}>
        <div style={{ padding: '14px 20px', borderBottom: '2px solid #475569', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, color: '#60a5fa', fontWeight: 800 }}>📝 상담사 편집</div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{agent.name} · ID {agent.id.slice(0, 8)}...</div>
          </div>
          <button onClick={onClose} style={{ background: '#475569', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>✕ 닫기</button>
        </div>
        <div style={{ padding: '18px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 12 }}>
            <Field label="이름 *">
              <input type="text" value={name} onChange={e => setName(e.target.value)} style={fieldInputStyle} />
            </Field>
            <Field label="센터 *">
              <input type="text" value={center} onChange={e => setCenter(e.target.value)} style={fieldInputStyle} />
            </Field>
            <Field label="역할">
              <select value={role} onChange={e => setRole(e.target.value)} style={fieldInputStyle}>
                <option value="agent">agent (상담사)</option>
                <option value="manager">manager (상담사팀장)</option>
                <option value="contract">contract (계약관리담당자)</option>
                <option value="admin">admin (총 관리자)</option>
              </select>
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 12 }}>
            <Field label="📅 입사일">
              <input type="date" value={hireDate} onChange={e => setHireDate(e.target.value)} style={fieldInputStyle} />
            </Field>
            <Field label="기본급 (₩/월)" hint="변경 시 다음 정산부터 반영">
              <input type="number" value={baseSalary} onChange={e => setBaseSalary(e.target.value)}
                min="0" max="20000000" step="100000" style={fieldInputStyle} />
            </Field>
            <Field label="활성 상태">
              <select value={String(active)} onChange={e => setActive(e.target.value === 'true')} style={fieldInputStyle}>
                <option value="true">✅ 활성</option>
                <option value="false">❌ 비활성</option>
              </select>
            </Field>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14, paddingTop: 12, borderTop: '1px solid #475569' }}>
            <button onClick={onClose} style={btnSecondary}>취소</button>
            <button onClick={handleSubmit} style={btnPrimary}>💾 모든 변경사항 저장</button>
          </div>
        </div>
      </div>
    </div>
  );
}
