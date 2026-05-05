// V5 인센티브 — 상품 관리 (admin 전용)
// vanilla docs/incentive-products.html → React 변환
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useV5Auth } from '../../../hooks/useV5Auth.jsx';

const fmt = (n) => (n || 0).toLocaleString();
const TIER_STYLES = {
  S: { bg: '#fbbf24', c: '#78350f' },
  A: { bg: '#60a5fa', c: '#1e3a8a' },
  B: { bg: '#94a3b8', c: '#0f172a' },
  C: { bg: '#475569', c: '#cbd5e1' },
};

export default function V5Products() {
  const { isAdmin, apiCall } = useV5Auth();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  // 필터
  const [carrier, setCarrier] = useState('');
  const [type, setType] = useState('');
  const [tier, setTier] = useState('');
  const [search, setSearch] = useState('');

  // 인라인 편집 — { id: { field: value } }
  const [edits, setEdits] = useState({});

  // 변경 이력 모달
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyProductId, setHistoryProductId] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const fileInputRef = useRef(null);

  if (!isAdmin) {
    return (
      <div style={{ padding: 20, color: '#fbbf24' }}>
        ⚠️ admin 권한만 접근 가능합니다.
      </div>
    );
  }

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await apiCall('GET', '/products');
      if (!res.ok) throw new Error('상품 조회 실패');
      const data = await res.json();
      setProducts(data.products || []);
      setEdits({});
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [apiCall]);

  useEffect(() => { load(); }, [load]);

  // KPI
  const kpi = useMemo(() => ({
    total: products.length,
    active: products.filter(p => p.active).length,
    s: products.filter(p => p.tier === 'S').length,
    a: products.filter(p => p.tier === 'A').length,
    b: products.filter(p => p.tier === 'B').length,
    c: products.filter(p => p.tier === 'C').length,
  }), [products]);

  // 필터링
  const filtered = useMemo(() => {
    let list = products;
    if (carrier) list = list.filter(p => p.carrier === carrier);
    if (type) list = list.filter(p => p.type === type);
    if (tier) list = list.filter(p => p.tier === tier);
    if (search) {
      const q = search.toLowerCase().trim();
      list = list.filter(p => (p.name || '').toLowerCase().includes(q));
    }
    return list;
  }, [products, carrier, type, tier, search]);

  // 변경 감지
  const hasChange = useCallback((p) => {
    const e = edits[p.id]; if (!e) return false;
    return Object.keys(e).some(k => String(e[k]) !== String(p[k]));
  }, [edits]);

  const setEdit = (id, field, value) => {
    setEdits(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } }));
  };

  const valueOf = (p, field) => {
    const e = edits[p.id];
    if (e && Object.prototype.hasOwnProperty.call(e, field)) return e[field];
    return p[field] ?? (field === 'point_weight' ? 1.0 : 0);
  };

  const patchProduct = async (id, body) => {
    const res = await apiCall('PATCH', '/products/' + id, body);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || '실패');
    }
    const data = await res.json();
    return data.product;
  };

  const saveRow = async (id) => {
    const p = products.find(x => x.id === id);
    const e = edits[id];
    if (!p || !e) { showToast('변경사항 없음'); return; }
    const body = {};
    Object.keys(e).forEach(field => {
      let val = e[field];
      if (field === 'rebate' || field === 'payback') val = parseInt(val) || 0;
      if (field === 'point_weight') val = parseFloat(val);
      if (String(p[field]) !== String(val)) body[field] = val;
    });
    if (Object.keys(body).length === 0) { showToast('변경사항 없음'); return; }
    try {
      const updated = await patchProduct(id, body);
      setProducts(prev => prev.map(x => x.id === id ? updated : x));
      setEdits(prev => { const next = { ...prev }; delete next[id]; return next; });
      showToast('✅ 저장됨 — 마진/Tier 자동 재계산');
    } catch (err) { alert('오류: ' + err.message); }
  };

  const toggleActive = async (id, newVal) => {
    if (!confirm(newVal ? '이 상품을 활성화하시겠습니까?' : '⚠️ 이 상품을 단종 처리하시겠습니까?\n(기존 영업은 영향 없음, 신규 등록만 차단)')) return;
    try {
      const updated = await patchProduct(id, { active: newVal });
      setProducts(prev => prev.map(x => x.id === id ? updated : x));
      showToast(newVal ? '✅ 활성화됨' : '🚫 단종 처리됨');
    } catch (err) { alert('오류: ' + err.message); }
  };

  // 엑셀 다운로드
  const exportXlsx = () => {
    if (!products.length) { alert('상품이 없습니다.'); return; }
    const rows = products.map(p => ({
      'ID': p.id,
      '통신사': p.carrier,
      '종류': p.type,
      '상품명': p.name,
      '속도': p.speed || '',
      'TV 등급': p.tv_tier || '',
      '리베이트': p.rebate || 0,
      '페이백': p.payback || 0,
      '가중치': p.point_weight || 0,
      '마진 (자동)': p.margin || 0,
      'Tier (자동)': p.tier || '',
      '우수상품 (자동)': p.is_premium ? 'Y' : 'N',
      '활성': p.active ? 'Y' : 'N',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 6 }, { wch: 8 }, { wch: 8 }, { wch: 36 }, { wch: 8 }, { wch: 14 }, { wch: 11 }, { wch: 11 }, { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 8 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '상품 목록');
    XLSX.writeFile(wb, `상품관리_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('✅ 엑셀 다운로드 완료');
  };

  // 엑셀 업로드
  const importXlsx = async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    ev.target.value = '';
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws);
      if (!rows.length) { alert('빈 파일입니다.'); return; }

      const editableFields = { '리베이트': 'rebate', '페이백': 'payback', '가중치': 'point_weight', '활성': 'active' };
      const changes = [];
      for (const row of rows) {
        const id = parseInt(row['ID']);
        if (!id) continue;
        const cur = products.find(p => p.id === id);
        if (!cur) continue;
        const diff = {};
        for (const [colName, field] of Object.entries(editableFields)) {
          if (row[colName] === undefined || row[colName] === null || row[colName] === '') continue;
          let newVal = row[colName];
          if (field === 'active') newVal = (String(newVal).toUpperCase() === 'Y' || newVal === true || newVal === 1);
          else newVal = parseFloat(newVal) || 0;
          if (cur[field] !== newVal) diff[field] = newVal;
        }
        if (Object.keys(diff).length) changes.push({ id, name: cur.name, diff });
      }
      if (!changes.length) { alert('변경된 행이 없습니다.'); return; }
      const sample = changes.slice(0, 3).map(c => `${c.name}: ${JSON.stringify(c.diff)}`).join('\n');
      if (!confirm(`총 ${changes.length}개 상품 변경 예정.\n계속할까요?\n\n예시: ${sample}`)) return;

      let success = 0, failed = 0;
      for (const ch of changes) {
        try { await patchProduct(ch.id, ch.diff); success++; }
        catch (e) { console.error('❌', ch.id, e.message); failed++; }
      }
      showToast(`✅ ${success}건 업데이트 / ❌ ${failed}건 실패`);
      await load();
    } catch (e) {
      alert('업로드 실패: ' + e.message);
      console.error(e);
    }
  };

  // 변경 이력
  const showHistory = async (productId) => {
    setHistoryProductId(productId);
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const path = '/products/history' + (productId ? `?product_id=${productId}&limit=200` : '?limit=200');
      const res = await apiCall('GET', path);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || ('HTTP ' + res.status));
      }
      const data = await res.json();
      setHistoryData(data.history || []);
    } catch (e) { setHistoryError(e.message); }
    finally { setHistoryLoading(false); }
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 22, color: '#f8fafc', fontWeight: 800 }}>📦 상품 관리</h1>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>통신사별 — 리베이트·페이백·가중치 편집 (마진/Tier 자동 재계산)</div>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 18 }}>
        <Kpi label="전체 상품" val={`${kpi.total}개`} sub={`활성 ${kpi.active}개`} />
        <Kpi label="⭐ 우수상품 (S)" val={`${kpi.s}개`} sub="마진 25만+" />
        <Kpi label="A Tier" val={`${kpi.a}개`} sub="마진 18만+" />
        <Kpi label="B Tier" val={`${kpi.b}개`} sub="마진 12만+" />
        <Kpi label="⚠️ C Tier" val={`${kpi.c}개`} sub="위험 상품" />
      </div>

      {/* 섹션 */}
      <div style={{ background: 'linear-gradient(135deg,#1e293b,#0f172a)', border: '1px solid #475569', borderRadius: 12, padding: '18px 22px' }}>
        <h2 style={{ fontSize: 14, color: '#fbbf24', fontWeight: 800, marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid #334155' }}>
          📋 상품 목록 — 인라인 편집
        </h2>

        {/* 툴바 */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
          <label style={lblStyle}>통신사</label>
          <select value={carrier} onChange={e => setCarrier(e.target.value)} style={inpStyle}>
            <option value="">전체</option><option value="SKT">SKT</option><option value="KT">KT</option><option value="LGU+">LGU+</option>
          </select>
          <label style={lblStyle}>종류</label>
          <select value={type} onChange={e => setType(e.target.value)} style={inpStyle}>
            <option value="">전체</option><option value="단독">단독</option><option value="결합">결합</option>
          </select>
          <label style={lblStyle}>Tier</label>
          <select value={tier} onChange={e => setTier(e.target.value)} style={inpStyle}>
            <option value="">전체</option><option value="S">S (우수)</option><option value="A">A</option><option value="B">B</option><option value="C">C (위험)</option>
          </select>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 상품명 검색" style={{ ...inpStyle, minWidth: 200 }} />
          <button onClick={load} style={btnSecStyle}>🔄 새로고침</button>
          <button onClick={() => showHistory(null)} style={{ ...btnSecStyle, background: '#7c3aed' }}>📜 변경 이력</button>
          <button onClick={exportXlsx} style={{ ...btnSecStyle, background: '#16a34a' }}>📥 엑셀 다운로드</button>
          <button onClick={() => fileInputRef.current?.click()} style={{ ...btnSecStyle, background: '#0891b2' }}>📤 엑셀 업로드</button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={importXlsx} />
          <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto' }}>{filtered.length}개</span>
        </div>

        {error && <div style={{ color: '#fca5a5', fontSize: 12, marginBottom: 10 }}>⚠️ {error}</div>}

        {/* 테이블 */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#1e293b', borderRadius: 10, overflow: 'hidden' }}>
            <thead>
              <tr style={{ background: '#334155' }}>
                <th style={{ ...thStyle, width: 42 }}>ID</th>
                <th style={{ ...thStyle, width: 60 }}>통신사</th>
                <th style={{ ...thStyle, width: 60 }}>종류</th>
                <th style={thStyle}>상품명</th>
                <th style={{ ...thStyle, width: 60 }}>속도</th>
                <th style={{ ...thStyle, width: 110 }}>TV 등급</th>
                <th style={{ ...thStyle, width: 110 }}>리베이트</th>
                <th style={{ ...thStyle, width: 110 }}>페이백</th>
                <th style={{ ...thStyle, width: 75 }}>가중치</th>
                <th style={{ ...thStyle, width: 110 }}>마진 (자동)</th>
                <th style={{ ...thStyle, width: 75 }}>Tier</th>
                <th style={{ ...thStyle, width: 80 }}>활성</th>
                <th style={{ ...thStyle, width: 140 }}>작업</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && !loading && (
                <tr><td colSpan={13} style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b', fontSize: 13 }}>상품이 없습니다.</td></tr>
              )}
              {filtered.map(p => {
                const changed = hasChange(p);
                const ts = TIER_STYLES[p.tier] || TIER_STYLES.B;
                return (
                  <tr key={p.id} style={{ background: changed ? 'rgba(251,191,36,0.06)' : 'transparent', opacity: p.active ? 1 : 0.4, borderBottom: changed ? '1px solid #fbbf24' : '1px solid #334155' }}>
                    <td style={{ ...tdStyle, color: '#64748b' }}>#{p.id}</td>
                    <td style={tdStyle}><b>{p.carrier}</b></td>
                    <td style={tdStyle}>{p.type}</td>
                    <td style={tdStyle}>
                      <input className="cell-edit" value={valueOf(p, 'name')} onChange={e => setEdit(p.id, 'name', e.target.value)} style={cellInpStyle} />
                    </td>
                    <td style={tdStyle}>{p.speed || '-'}</td>
                    <td style={{ ...tdStyle, fontSize: 10, color: '#94a3b8' }}>{p.tv_tier || '-'}</td>
                    <td style={tdStyle}>
                      <input type="number" min="0" step="1000" value={valueOf(p, 'rebate')} onChange={e => setEdit(p.id, 'rebate', e.target.value)}
                        style={{ ...cellInpStyle, textAlign: 'right', color: '#86efac', fontWeight: 700 }} />
                    </td>
                    <td style={tdStyle}>
                      <input type="number" min="0" step="1000" value={valueOf(p, 'payback')} onChange={e => setEdit(p.id, 'payback', e.target.value)}
                        style={{ ...cellInpStyle, textAlign: 'right', color: '#fca5a5', fontWeight: 700 }} />
                    </td>
                    <td style={tdStyle}>
                      <select value={valueOf(p, 'point_weight')} onChange={e => setEdit(p.id, 'point_weight', e.target.value)}
                        style={{ ...cellInpStyle, fontWeight: 700 }}>
                        <option value="0.5">0.5</option>
                        <option value="1">1.0</option>
                        <option value="1.5">1.5</option>
                        <option value="2">2.0</option>
                      </select>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 800 }}>{fmt(p.margin)}</td>
                    <td style={tdStyle}>
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 800, background: ts.bg, color: ts.c }}>{p.tier}</span>
                      {p.is_premium && <span style={{ background: '#dc2626', color: '#fff', padding: '1px 6px', borderRadius: 3, fontSize: 8, marginLeft: 3, fontWeight: 800 }}>⭐</span>}
                    </td>
                    <td style={tdStyle}>
                      {p.active
                        ? <span style={{ color: '#86efac', fontWeight: 700 }}>✅</span>
                        : <span style={{ color: '#94a3b8' }}>❌</span>}
                    </td>
                    <td style={tdStyle}>
                      <button onClick={() => saveRow(p.id)} style={{ ...btnRowStyle, background: '#16a34a', color: '#fff' }}>💾 저장</button>
                      <button onClick={() => toggleActive(p.id, !p.active)} style={{ ...btnRowStyle, background: '#f59e0b', color: '#fff' }}>{p.active ? '단종' : '활성'}</button>
                      <button onClick={() => showHistory(p.id)} style={{ ...btnRowStyle, background: '#7c3aed', color: '#fff' }}>📜</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ fontSize: 10, color: '#64748b', marginTop: 10, lineHeight: 1.5 }}>
          💡 리베이트·페이백·가중치 셀에 직접 입력 후 [💾 저장] 클릭. 변경 시 마진/Tier/우수상품 자동 재계산.<br />
          ⚠️ Tier 임계값은 정책 관리(⚙️ 정책) 탭에서 변경 (현재: S=25만, A=18만, B=12만)
        </div>
      </div>

      {/* 변경 이력 모달 */}
      {historyOpen && (
        <HistoryModal
          productId={historyProductId}
          products={products}
          history={historyData}
          loading={historyLoading}
          error={historyError}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)', background: '#16a34a', color: '#fff', padding: '12px 22px', borderRadius: 8, fontSize: 13, fontWeight: 800, boxShadow: '0 6px 24px rgba(22,163,74,0.5)', zIndex: 99999 }}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ─── 변경 이력 모달 ───
function HistoryModal({ productId, products, history, loading, error, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const fmtNum = v => v == null ? '-' : (typeof v === 'number' ? v.toLocaleString() : String(v));
  const title = productId
    ? (() => {
        const p = products.find(x => x.id === productId);
        return p ? `📜 변경 이력 — ${p.carrier} / ${p.name}` : '📜 변경 이력';
      })()
    : `📜 전체 변경 이력 (최근 ${history.length}건)`;

  return (
    <div onClick={(e) => { if (e.currentTarget === e.target) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 12, maxWidth: 980, width: '100%', maxHeight: '85vh', overflow: 'auto', padding: 20, color: '#e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '1px solid #334155', paddingBottom: 10 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{title}</div>
          <button onClick={onClose} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>✕ 닫기</button>
        </div>
        <div style={{ fontSize: 12 }}>
          {loading && <div style={{ color: '#94a3b8', padding: '20px', textAlign: 'center' }}>로드 중...</div>}
          {error && <div style={{ color: '#fca5a5', padding: 20, textAlign: 'center' }}>⚠️ {error}</div>}
          {!loading && !error && history.length === 0 && <div style={{ color: '#94a3b8', padding: 30, textAlign: 'center' }}>변경 이력이 없습니다.</div>}
          {!loading && !error && history.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#0f172a' }}>
                  <th style={hThStyle}>시각</th>
                  {!productId && <th style={hThStyle}>상품</th>}
                  <th style={hThStyle}>필드</th>
                  <th style={{ ...hThStyle, textAlign: 'right' }}>이전</th>
                  <th style={{ ...hThStyle, textAlign: 'right' }}>→</th>
                  <th style={{ ...hThStyle, textAlign: 'right' }}>이후</th>
                  <th style={hThStyle}>변경자</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => {
                  const dt = new Date(h.changed_at);
                  const ts = dt.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #334155' }}>
                      <td style={{ padding: '6px 8px', fontSize: 11, color: '#94a3b8' }}>{ts}</td>
                      {!productId && (
                        <td style={{ padding: '6px 8px', fontSize: 11 }}>
                          {h.product ? `${h.product.carrier} ${h.product.name}` : `#${h.product_id}`}
                        </td>
                      )}
                      <td style={{ padding: '6px 8px', fontSize: 11, color: '#fbbf24', fontWeight: 700 }}>{h.field_name}</td>
                      <td style={{ padding: '6px 8px', fontSize: 11, textAlign: 'right', color: '#fca5a5' }}>{fmtNum(h.old_value)}</td>
                      <td style={{ padding: '6px 8px', fontSize: 11, textAlign: 'center', color: '#64748b' }}>→</td>
                      <td style={{ padding: '6px 8px', fontSize: 11, textAlign: 'right', color: '#86efac', fontWeight: 700 }}>{fmtNum(h.new_value)}</td>
                      <td style={{ padding: '6px 8px', fontSize: 11, color: '#cbd5e1' }}>{h.changed_by_name || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, val, sub }) {
  return (
    <div style={{ background: 'linear-gradient(135deg,#1e293b,#334155)', border: '1px solid #475569', borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 9.5, color: '#94a3b8', fontWeight: 700, letterSpacing: '0.04em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, color: '#f8fafc', fontWeight: 900, letterSpacing: '-0.02em' }}>{val}</div>
      {sub && <div style={{ fontSize: 9.5, color: '#64748b', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

const lblStyle = { fontSize: 11, color: '#94a3b8' };
const inpStyle = { background: '#0f172a', border: '1px solid #475569', color: '#e2e8f0', padding: '6px 10px', borderRadius: 6, fontSize: 12, colorScheme: 'dark' };
const cellInpStyle = { background: '#0f172a', border: '1px solid #475569', color: '#e2e8f0', padding: '5px 7px', borderRadius: 4, fontSize: 11.5, width: '100%', boxSizing: 'border-box' };
const btnSecStyle = { background: '#475569', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: 'pointer' };
const btnRowStyle = { padding: '4px 10px', fontSize: 10, fontWeight: 700, border: 'none', borderRadius: 4, cursor: 'pointer', marginRight: 4 };
const thStyle = { background: '#334155', color: '#f1f5f9', fontSize: 11, padding: '10px 8px', textAlign: 'left', fontWeight: 700 };
const tdStyle = { fontSize: 11.5, color: '#e2e8f0', padding: 8, verticalAlign: 'middle' };
const hThStyle = { padding: 8, textAlign: 'left', borderBottom: '1px solid #475569', fontSize: 11 };
