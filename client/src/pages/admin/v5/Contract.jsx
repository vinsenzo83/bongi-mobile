// V5 인센티브 — 계약 처리 (계약부서 어드민)
// vanilla docs/incentive-contract.html → React 변환
import { useEffect, useMemo, useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { useV5Auth } from '../../../hooks/useV5Auth.jsx';
import ContractEditModal from './ContractEditModal.jsx';

const STATUS_LABEL = { pending: '계약대기', in_progress: '계약진행', completed: '계약완료', cancelled: '계약취소' };
const STATUS_ICON  = { pending: '⏰', in_progress: '🚧', completed: '✅', cancelled: '❌' };

const fmt = (n) => (n || 0).toLocaleString();
const fmtDt = (v) => v ? new Date(v).toLocaleString('ko-KR') : '';
const stripHtml = (s) => (s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

export default function V5Contract() {
  const { agent, isContractAccess, apiCall } = useV5Auth();

  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [filterStatus, setFilterStatus] = useState('');
  const [filterAddress, setFilterAddress] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);

  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [toast, setToast] = useState('');

  // 권한 체크
  if (!isContractAccess) {
    return (
      <div style={{ padding: 20, color: '#fbbf24' }}>
        ⚠️ manager / contract / admin 권한만 접근 가능합니다.
      </div>
    );
  }

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (month) params.set('month', month);
      if (filterStatus) params.set('status', filterStatus);
      const path = '/contracts' + (params.toString() ? '?' + params : '');
      const res = await apiCall('GET', path);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || '조회 실패');
      }
      const data = await res.json();
      setContracts(data.contracts || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [apiCall, month, filterStatus]);

  useEffect(() => { load(); }, [load]);

  // 필터 변경 시 page reset
  useEffect(() => { setPage(1); }, [month, filterStatus, filterAddress, pageSize]);

  // 통계
  const stats = useMemo(() => {
    const total = contracts.length;
    const completed = contracts.filter(c => c.status === 'completed').length;
    const inProgress = contracts.filter(c => c.status === 'in_progress').length;
    const pending = contracts.filter(c => c.status === 'pending').length;
    const cancelled = contracts.filter(c => c.status === 'cancelled').length;
    const needAddr = contracts.filter(c => c.status !== 'cancelled' && (!c.customer_address || !c.customer_address.trim())).length;
    return { total, completed, inProgress, pending, cancelled, needAddr };
  }, [contracts]);

  // 주소 필터 적용
  const filtered = useMemo(() => {
    if (filterAddress === 'missing') return contracts.filter(c => !c.customer_address || !c.customer_address.trim());
    if (filterAddress === 'present') return contracts.filter(c => c.customer_address && c.customer_address.trim());
    return contracts;
  }, [contracts, filterAddress]);

  // 페이지네이션
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const pageItems = filtered.slice(startIdx, startIdx + pageSize);

  const editingContract = useMemo(
    () => contracts.find(c => c.id === editingId) || null,
    [contracts, editingId],
  );

  // 저장 (모달에서 호출)
  const handleSave = useCallback(async (id, body) => {
    const res = await apiCall('PATCH', '/sales/' + id, body);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || '저장 실패');
    }
    showToast('✅ 변경사항 저장 완료');
    await load();
    setEditingId(null);
  }, [apiCall, load, showToast]);

  // 견적서 lazy fetch
  const fetchQuote = useCallback(async (id) => {
    const res = await apiCall('GET', `/sales/${id}/quote`);
    if (!res.ok) return null;
    return await res.json();
  }, [apiCall]);

  // 엑셀 다운로드
  const exportXlsx = () => {
    if (!filtered.length) { alert('내보낼 데이터가 없습니다.'); return; }
    const rows = filtered.map(c => {
      const p = c.product || {};
      const a = c.agent || {};
      const additional = (c.additional_products && Array.isArray(c.additional_products))
        ? c.additional_products.map(x => `${x.position}: ${x.tv_name} (${(x.tv_price || 0).toLocaleString()}원, 할인 -${(x.tv_discount || 0).toLocaleString()}) + ${x.settop_name || '셋톱'} (${(x.settop_fee || 0).toLocaleString()}원)`).join(' | ')
        : '';
      const wifiOpt = c.wifi_option === 'wifi-speaker' ? 'WiFi 1대 + 스마트홈 스피커'
        : c.wifi_option === 'wifi2' ? 'WiFi 2대' : '';
      return {
        '영업ID': c.id || '',
        '영업 등록일': fmtDt(c.created_at),
        '마지막 변경일': fmtDt(c.updated_at),
        '계약일': c.contract_date || '',
        '상담사': a.name || '',
        '센터': a.center || '',
        '상담사 역할': a.role || '',
        '상품 ID': p.id || '',
        '통신사': p.carrier || '',
        '종류': p.type || '',
        '상품명': p.name || '',
        '속도': p.speed || '',
        'TV 등급': p.tv_tier || '',
        'Tier': p.tier || '',
        '우수상품': p.is_premium ? 'Y' : 'N',
        '가중치(P)': p.point_weight || 0,
        '페이백 (정가)': p.payback || 0,
        '월 요금 (실질)': c.monthly_fee || 0,
        'TV 대수': c.tv_count || 1,
        '추가 TV (다중)': additional,
        'WiFi 옵션': wifiOpt,
        '견적 요약': c.quote_summary || '',
        '견적 상세 (텍스트)': stripHtml(c.quote_full_html),
        '고객명': c.customer_name || '',
        '전화번호': c.customer_phone || '',
        '주민번호': c.resident_id || '',
        '주소': c.customer_address || '',
        '상세주소': c.customer_address_detail || '',
        '설치 희망일': c.installation_date || '',
        '설치 시간': c.installation_time || '',
        '개통완료일': c.activation_date || '',
        '실제 사은품': c.gift_received || '',
        '추가 페이백': c.add_payback || 0,
        '예금주': c.bank_account_holder || '',
        '은행': c.bank_name || '',
        '계좌번호': c.bank_account_number || '',
        '상태': STATUS_LABEL[c.status] || c.status || '',
        '계약대기 시각': fmtDt(c.contract_pending_at),
        '계약진행 시각': fmtDt(c.contract_in_progress_at),
        '계약완료 시각': fmtDt(c.contract_completed_at),
        '계약취소 시각': fmtDt(c.contract_cancelled_at),
        '취소 사유': c.cancellation_reason || '',
        '메모(상담사 TM)': c.notes || '',
        '메모(계약부서)': c.contract_notes || '',
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '계약목록');
    XLSX.writeFile(wb, `계약목록_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('📥 엑셀 다운로드 완료 (' + filtered.length + '건)');
  };

  // 페이지 번호 생성
  const pageNums = useMemo(() => {
    const out = [];
    const start = Math.max(1, safePage - 2);
    const end = Math.min(totalPages, safePage + 2);
    if (start > 1) out.push(1);
    if (start > 2) out.push('...');
    for (let i = start; i <= end; i++) out.push(i);
    if (end < totalPages - 1) out.push('...');
    if (end < totalPages) out.push(totalPages);
    return out;
  }, [safePage, totalPages]);

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 22, color: '#f8fafc', fontWeight: 800 }}>📋 계약부서 어드민</h1>
        <div style={{ fontSize: 11, color: '#94a3b8' }}>
          {agent?.name} · <span style={{ background: '#475569', color: '#fff', padding: '1px 6px', borderRadius: 3, fontWeight: 800 }}>{agent?.role}</span>
        </div>
      </div>

      {/* 통계 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 18 }}>
        <StatCard label="📋 이번 달 영업" val={`${stats.total}건`} sub={stats.needAddr ? `⚠️ 주소 미입력 ${stats.needAddr}건` : '주소 모두 입력'} />
        <StatCard label="✅ 계약완료"   val={`${stats.completed}건`}  color="#86efac" border="#22c55e" sub="인센티브 카운트" />
        <StatCard label="🚧 계약진행"   val={`${stats.inProgress}건`} color="#60a5fa" border="#3b82f6" sub="처리 중" />
        <StatCard label="⏰ 계약대기"   val={`${stats.pending}건`}    color="#fbbf24" border="#f59e0b" sub="처리 필요" />
        <StatCard label="❌ 계약취소"   val={`${stats.cancelled}건`}  color="#fca5a5" border="#dc2626" sub="정산 제외" />
      </div>

      {/* 툴바 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={lblStyle}>월</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={inpToolStyle} />
          <label style={lblStyle}>상태</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={inpToolStyle}>
            <option value="">전체</option>
            <option value="completed">✅ 계약완료</option>
            <option value="in_progress">🚧 계약진행</option>
            <option value="pending">⏰ 계약대기</option>
            <option value="cancelled">❌ 계약취소</option>
          </select>
          <label style={lblStyle}>주소</label>
          <select value={filterAddress} onChange={e => setFilterAddress(e.target.value)} style={inpToolStyle}>
            <option value="">전체</option>
            <option value="missing">주소 없음</option>
            <option value="present">주소 있음</option>
          </select>
          <button onClick={load} style={btnPrimaryStyle}>🔄 새로고침</button>
          <button onClick={exportXlsx} style={{ ...btnPrimaryStyle, background: '#16a34a' }}>📥 엑셀 다운로드</button>
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8' }}>{filtered.length}건</div>
      </div>

      {error && <div style={{ color: '#fca5a5', fontSize: 12, marginBottom: 10 }}>⚠️ {error}</div>}

      {/* 테이블 */}
      <div style={{ background: '#1e293b', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#334155' }}>
              <th style={{ ...thStyle, width: 36, textAlign: 'center' }}>#</th>
              <th style={{ ...thStyle, width: '8%' }}>날짜</th>
              <th style={{ ...thStyle, width: '11%' }}>상담사</th>
              <th style={{ ...thStyle, width: '18%' }}>상품 (Tier·P)</th>
              <th style={{ ...thStyle, width: '10%' }}>고객명</th>
              <th style={{ ...thStyle, width: '11%' }}>전화</th>
              <th style={{ ...thStyle, width: '16%' }}>주소</th>
              <th style={{ ...thStyle, width: '9%' }}>페이백</th>
              <th style={{ ...thStyle, width: '6%' }}>상태</th>
              <th style={{ ...thStyle, width: '9%' }}>작업</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 && !loading && (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b', fontSize: 13 }}>
                {error ? '오류 발생' : '조회된 영업이 없습니다.'}
              </td></tr>
            )}
            {pageItems.map((c, i) => {
              const rowNum = startIdx + i + 1;
              const p = c.product || {};
              const a = c.agent || {};
              const hasAddr = c.customer_address && c.customer_address.trim();
              return (
                <tr key={c.id} style={{ background: c.status === 'cancelled' ? 'rgba(220,38,38,0.06)' : 'transparent', opacity: c.status === 'cancelled' ? 0.55 : 1 }}>
                  <td style={{ ...tdStyle, textAlign: 'center', color: '#64748b', fontWeight: 700 }}>{rowNum}</td>
                  <td style={tdStyle}>{(c.contract_date || '').slice(5)}</td>
                  <td style={tdStyle}>
                    {a.name || '-'}
                    <div style={{ fontSize: 9, color: '#64748b' }}>{a.center || ''}</div>
                  </td>
                  <td style={tdStyle}>
                    {p.name || '-'}{' '}
                    {p.tier && <Tier t={p.tier} />}
                    {p.is_premium && <Badge color="#dc2626" text="우수" />}
                    {c.tv_count > 1 && <Badge color="#6366f1" text={`TV ${c.tv_count}대`} />}
                    {c.wifi_option === 'wifi-speaker' && <Badge color="#e40981" text="스피커" />}
                    <div style={{ fontSize: 9, color: '#64748b' }}>{p.point_weight || '?'}P</div>
                  </td>
                  <td style={tdStyle}>{c.customer_name || <i style={{ color: '#94a3b8' }}>-</i>}</td>
                  <td style={tdStyle}>{c.customer_phone || <i style={{ color: '#94a3b8' }}>-</i>}</td>
                  <td style={{ ...tdStyle, maxWidth: 240, wordBreak: 'break-all', fontSize: 10.5 }}>
                    {hasAddr ? c.customer_address : <i style={{ color: '#dc2626' }}>주소 미입력</i>}
                  </td>
                  <td style={tdStyle}>
                    {(c.add_payback || 0).toLocaleString()}
                    <div style={{ fontSize: 9, color: '#64748b' }}>본인 -{(c.agent_payback_deduct || 0).toLocaleString()}</div>
                  </td>
                  <td style={tdStyle}><StatusBadge s={c.status} /></td>
                  <td style={tdStyle}>
                    <button onClick={() => setEditingId(c.id)} style={btnEditStyle}>📝 편집</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {filtered.length > pageSize && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 16, flexWrap: 'wrap' }}>
          <PageBtn onClick={() => setPage(1)} disabled={safePage === 1} title="처음">«</PageBtn>
          <PageBtn onClick={() => setPage(p => p - 1)} disabled={safePage === 1} title="이전">‹</PageBtn>
          {pageNums.map((n, idx) =>
            n === '...'
              ? <span key={`d${idx}`} style={{ padding: '5px 4px', color: '#64748b' }}>...</span>
              : <PageBtn key={n} onClick={() => setPage(n)} active={n === safePage}>{n}</PageBtn>
          )}
          <PageBtn onClick={() => setPage(p => p + 1)} disabled={safePage === totalPages} title="다음">›</PageBtn>
          <PageBtn onClick={() => setPage(totalPages)} disabled={safePage === totalPages} title="끝">»</PageBtn>
          <select value={pageSize} onChange={e => setPageSize(parseInt(e.target.value))}
            style={{ marginLeft: 12, background: '#1e293b', border: '1px solid #475569', color: '#e2e8f0', padding: '5px 8px', borderRadius: 5, fontSize: 11 }}>
            <option value={20}>20개씩</option>
            <option value={50}>50개씩</option>
            <option value={100}>100개씩</option>
          </select>
          <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 8 }}>
            {startIdx + 1}~{Math.min(startIdx + pageSize, filtered.length)} / 총 {filtered.length}건
          </span>
        </div>
      )}

      {/* 편집 모달 */}
      {editingContract && (
        <ContractEditModal
          contract={editingContract}
          onClose={() => setEditingId(null)}
          onSave={handleSave}
          fetchQuote={fetchQuote}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)', background: '#1e293b', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, boxShadow: '0 4px 16px rgba(0,0,0,0.4)', border: '1px solid #475569', zIndex: 9999 }}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ─── 서브 컴포넌트 ───
function StatCard({ label, val, sub, color, border }) {
  return (
    <div style={{ background: 'linear-gradient(135deg,#1e293b,#334155)', border: `1px solid ${border || '#475569'}`, borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 10, color: color || '#94a3b8', fontWeight: 700, letterSpacing: '0.04em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, color: color || '#f8fafc', fontWeight: 900, letterSpacing: '-0.02em' }}>{val}</div>
      {sub && <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Tier({ t }) {
  const m = { S: { bg: '#fbbf24', c: '#78350f' }, A: { bg: '#60a5fa', c: '#1e3a8a' }, B: { bg: '#94a3b8', c: '#0f172a' }, C: { bg: '#475569', c: '#cbd5e1' } };
  const s = m[t] || m.B;
  return <span style={{ display: 'inline-block', padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 800, background: s.bg, color: s.c, marginLeft: 3 }}>{t}</span>;
}

function Badge({ color, text }) {
  return <span style={{ background: color, color: '#fff', padding: '1px 5px', borderRadius: 3, fontSize: 8, marginLeft: 3, fontWeight: 800 }}>{text}</span>;
}

function StatusBadge({ s }) {
  const colorMap = { completed: '#16a34a', pending: '#f59e0b', in_progress: '#3b82f6', cancelled: '#dc2626' };
  return (
    <span style={{ background: colorMap[s] || '#475569', color: '#fff', padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 800 }}>
      {STATUS_LABEL[s] || s}
    </span>
  );
}

function PageBtn({ children, onClick, disabled, active, title }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      style={{
        background: active ? '#3b82f6' : '#334155',
        color: active ? '#fff' : '#e2e8f0',
        border: `1px solid ${active ? '#3b82f6' : '#475569'}`,
        padding: '5px 11px',
        borderRadius: 5,
        fontSize: 12,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontWeight: 700,
        minWidth: 30,
        opacity: disabled ? 0.35 : 1,
      }}>
      {children}
    </button>
  );
}

const lblStyle = { fontSize: 11, color: '#94a3b8' };
const inpToolStyle = { background: '#1e293b', border: '1px solid #475569', color: '#e2e8f0', padding: '6px 10px', borderRadius: 6, fontSize: 12, colorScheme: 'dark' };
const btnPrimaryStyle = { background: '#3b82f6', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 12 };
const btnEditStyle = { background: '#3b82f6', color: '#fff', border: 'none', padding: '3px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 10, fontWeight: 700 };
const thStyle = { color: '#f1f5f9', fontSize: 11, padding: '10px 8px', textAlign: 'left', fontWeight: 700, letterSpacing: '0.03em', borderBottom: '2px solid #475569' };
const tdStyle = { fontSize: 11.5, color: '#e2e8f0', padding: '10px 8px', borderBottom: '1px solid #334155', verticalAlign: 'middle' };
