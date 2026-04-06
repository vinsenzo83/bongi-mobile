import { useState } from 'react';
import { theme, card, button, tableStyles, filterBtn, statusStyle } from '../../styles/admin-theme.js';

const statusMap = { 신규: 'blue', 처리중: 'orange', 완료: 'green', 취소: 'gray' };
const typeMap = { 상담요청: 'blue', 견적요청: 'navy', 불만: 'red', 기타: 'gray' };

const mockTickets = [
  { id: 'TK-2026-001', customer: '김영수', type: '상담요청', title: '요금제 변경 문의', status: '신규', assignee: '박상담', created: '2026-04-06', content: '현재 34,900원 요금제인데 49,900원으로 변경하고 싶습니다. 데이터가 부족해서요.', phone: '010-1234-5678', email: 'kim@example.com', history: [] },
  { id: 'TK-2026-002', customer: '이민지', type: '견적요청', title: '가족결합 견적 요청', status: '처리중', assignee: '최매니저', created: '2026-04-05', content: '가족 4명 결합 시 할인 금액을 알고 싶습니다.', phone: '010-2345-6789', email: 'lee@example.com', history: [{ date: '2026-04-05', author: '최매니저', text: '가족결합 견적서 작성 중입니다.' }] },
  { id: 'TK-2026-003', customer: '박서준', type: '불만', title: '통화 품질 불량 신고', status: '처리중', assignee: '박상담', created: '2026-04-05', content: '최근 일주일간 통화 중 자주 끊깁니다. 서울 강남구 역삼동 지역입니다.', phone: '010-3456-7890', email: 'park@example.com', history: [{ date: '2026-04-05', author: '박상담', text: '네트워크팀에 품질 점검 요청했습니다.' }] },
  { id: 'TK-2026-004', customer: '최하나', type: '상담요청', title: '번호이동 절차 안내', status: '완료', assignee: '김대리', created: '2026-04-04', content: 'KT에서 SKT로 번호이동하고 싶습니다.', phone: '010-4567-8901', email: 'choi@example.com', history: [{ date: '2026-04-04', author: '김대리', text: '번호이동 절차 안내 완료했습니다.' }, { date: '2026-04-05', author: '김대리', text: '고객 확인 후 처리 완료.' }] },
  { id: 'TK-2026-005', customer: '정우성', type: '기타', title: '청구서 재발행 요청', status: '완료', assignee: '최매니저', created: '2026-04-03', content: '3월 청구서를 분실해서 재발행 부탁드립니다.', phone: '010-5678-9012', email: 'jung@example.com', history: [{ date: '2026-04-03', author: '최매니저', text: '청구서 재발행 완료, 이메일 발송.' }] },
  { id: 'TK-2026-006', customer: '한지민', type: '견적요청', title: '단체 가입 견적', status: '완료', assignee: '박상담', created: '2026-04-02', content: '직원 15명 단체 가입 시 할인 가능한가요?', phone: '010-6789-0123', email: 'han@example.com', history: [{ date: '2026-04-02', author: '박상담', text: '단체 할인 견적서 발송 완료.' }] },
  { id: 'TK-2026-007', customer: '오세훈', type: '상담요청', title: '해외 로밍 요금 문의', status: '신규', assignee: '-', created: '2026-04-06', content: '일본 출장 시 로밍 요금을 알고 싶습니다.', phone: '010-7890-1234', email: 'oh@example.com', history: [] },
  { id: 'TK-2026-008', customer: '송혜교', type: '불만', title: '사은품 미수령 항의', status: '미처리', assignee: '-', created: '2026-04-01', content: '개통 후 2주가 지났는데 사은품을 아직 못 받았습니다.', phone: '010-8901-2345', email: 'song@example.com', history: [] },
];

export default function TicketManage() {
  const [statusFilter, setStatusFilter] = useState('전체');
  const [typeFilter, setTypeFilter] = useState('전체');
  const [selected, setSelected] = useState(null);
  const [reply, setReply] = useState('');

  const statuses = ['전체', '신규', '처리중', '완료', '취소'];
  const types = ['전체', '상담요청', '견적요청', '불만', '기타'];

  const filtered = mockTickets.filter(t => {
    if (statusFilter !== '전체' && t.status !== statusFilter) return false;
    if (typeFilter !== '전체' && t.type !== typeFilter) return false;
    return true;
  });

  const kpis = [
    { label: '오늘 신규', value: 3, color: theme.blue },
    { label: '처리중', value: 2, color: theme.orange },
    { label: '완료', value: 5, color: theme.green },
    { label: '미처리', value: 1, color: theme.red },
  ];

  function handleReply() {
    if (!reply.trim() || !selected) return;
    const updated = { ...selected, history: [...selected.history, { date: '2026-04-06', author: '나', text: reply }] };
    setSelected(updated);
    setReply('');
  }

  return (
    <div style={{ padding: 24, fontFamily: theme.sans, color: theme.text, background: theme.bg, minHeight: '100vh' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>티켓 관리</h2>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ ...card, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ ...card, marginBottom: 16, display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>상태</span>
          {statuses.map(s => (
            <button key={s} style={filterBtn(statusFilter === s)} onClick={() => setStatusFilter(s)}>{s}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>유형</span>
          {types.map(t => (
            <button key={t} style={filterBtn(typeFilter === t)} onClick={() => setTypeFilter(t)}>{t}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              {['티켓번호', '고객명', '유형', '제목', '상태', '담당자', '생성일', '관리'].map(h => (
                <th key={h} style={tableStyles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => (
              <tr key={t.id} onClick={() => setSelected(t)} style={{ cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = theme.bgHover}
                onMouseLeave={e => e.currentTarget.style.background = ''}>
                <td style={tableStyles.td}><span style={{ fontWeight: 600, color: theme.blue }}>{t.id}</span></td>
                <td style={tableStyles.td}>{t.customer}</td>
                <td style={tableStyles.td}><span style={statusStyle(typeMap[t.type] || 'gray')}>{t.type}</span></td>
                <td style={tableStyles.td}>{t.title}</td>
                <td style={tableStyles.td}><span style={statusStyle(statusMap[t.status] || 'gray')}>{t.status}</span></td>
                <td style={tableStyles.td}>{t.assignee}</td>
                <td style={tableStyles.td}>{t.created}</td>
                <td style={tableStyles.td}>
                  <button style={button.primary} onClick={e => { e.stopPropagation(); setSelected(t); }}>상세</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ ...tableStyles.td, textAlign: 'center', padding: 32, color: theme.textMuted }}>데이터가 없습니다</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => { setSelected(null); setReply(''); }}>
          <div style={{ background: '#fff', borderRadius: 12, width: 640, maxHeight: '85vh', overflow: 'auto', padding: 28, boxShadow: theme.shadowLg }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{selected.id} 상세</h3>
              <button style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: theme.textMuted }} onClick={() => { setSelected(null); setReply(''); }}>✕</button>
            </div>

            {/* Ticket Info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {[
                ['고객명', selected.customer],
                ['연락처', selected.phone],
                ['이메일', selected.email],
                ['유형', selected.type],
                ['상태', selected.status],
                ['담당자', selected.assignee],
              ].map(([label, val]) => (
                <div key={label} style={{ fontSize: 12 }}>
                  <span style={{ color: theme.textMuted }}>{label}: </span>
                  <span style={{ fontWeight: 600 }}>{val}</span>
                </div>
              ))}
            </div>

            {/* Content */}
            <div style={{ background: theme.bgInput, borderRadius: 8, padding: 14, marginBottom: 20, fontSize: 13, lineHeight: 1.6 }}>
              <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 6, fontWeight: 600 }}>문의 내용</div>
              {selected.content}
            </div>

            {/* Response History */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>응대 이력 ({selected.history.length}건)</div>
              {selected.history.length === 0 && (
                <div style={{ fontSize: 12, color: theme.textMuted, padding: 12, background: theme.bgInput, borderRadius: 8 }}>응대 이력이 없습니다</div>
              )}
              {selected.history.map((h, i) => (
                <div key={i} style={{ borderLeft: `3px solid ${theme.blue}`, paddingLeft: 12, marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: theme.textMuted }}>{h.date} · {h.author}</div>
                  <div style={{ fontSize: 12, marginTop: 2 }}>{h.text}</div>
                </div>
              ))}
            </div>

            {/* Reply Form */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>답변 작성</div>
              <textarea
                value={reply}
                onChange={e => setReply(e.target.value)}
                placeholder="답변 내용을 입력하세요..."
                style={{ width: '100%', minHeight: 80, border: `1.5px solid ${theme.borderDark}`, borderRadius: 8, padding: 12, fontSize: 12, fontFamily: theme.sans, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                <button style={button.secondary} onClick={() => { setSelected(null); setReply(''); }}>닫기</button>
                <button style={button.primary} onClick={handleReply}>답변 등록</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
