import { useState } from 'react';
import { theme, card, button, tableStyles, filterBtn, statusStyle } from '../../styles/admin-theme.js';

const statusMap = { 신청완료: 'blue', 상담중: 'orange', 계약완료: 'green', 설치완료: 'navy', 취소: 'gray' };
const statusFlow = ['신청완료', '상담중', '계약완료', '설치완료'];

const mockApps = [
  { id: 'AP-2026-001', customer: '김영수', channel: '셀프신청', product: '5G 프리미어 에센셜', carrier: 'SKT', status: '신청완료', gift: '갤럭시 버즈3', assignee: '박상담', date: '2026-04-06', phone: '010-1234-5678', memo: '', address: '서울 강남구 역삼동 123-4' },
  { id: 'AP-2026-002', customer: '이민지', channel: '티켓', product: 'Y덤 다이렉트 34', carrier: 'SKT', status: '상담중', gift: '배민 3만원권', assignee: '최매니저', date: '2026-04-05', phone: '010-2345-6789', memo: '고객 오후 2시 통화 요청', address: '서울 서초구 반포동 56-7' },
  { id: 'AP-2026-003', customer: '박서준', channel: 'CRM등록', product: '슈퍼플랜 베이직', carrier: 'KT', status: '계약완료', gift: '스타벅스 5만원권', assignee: '김대리', date: '2026-04-04', phone: '010-3456-7890', memo: '신분증 확인 완료', address: '경기 성남시 분당구 정자동 89' },
  { id: 'AP-2026-004', customer: '최하나', channel: '셀프신청', product: '다이렉트 49', carrier: 'LGU+', status: '상담중', gift: '현금 5만원', assignee: '박상담', date: '2026-04-04', phone: '010-4567-8901', memo: '', address: '서울 마포구 합정동 34-2' },
  { id: 'AP-2026-005', customer: '정우성', channel: '티켓', product: '5G 심플', carrier: 'SKT', status: '신청완료', gift: '갤럭시 워치7', assignee: '-', date: '2026-04-03', phone: '010-5678-9012', memo: '', address: '부산 해운대구 중동 45' },
  { id: 'AP-2026-006', customer: '한지민', channel: 'CRM등록', product: '슈퍼플랜 스페셜', carrier: 'KT', status: '계약완료', gift: '에어팟 프로', assignee: '최매니저', date: '2026-04-03', phone: '010-6789-0123', memo: '4/7 설치 예정', address: '대전 유성구 봉명동 12' },
  { id: 'AP-2026-007', customer: '오세훈', channel: '셀프신청', product: '다이렉트 34', carrier: 'LGU+', status: '상담중', gift: '배민 2만원권', assignee: '김대리', date: '2026-04-02', phone: '010-7890-1234', memo: '본인 인증 대기중', address: '인천 남동구 구월동 78' },
  { id: 'AP-2026-008', customer: '송혜교', channel: '티켓', product: 'Y덤 다이렉트 49', carrier: 'SKT', status: '취소', gift: '-', assignee: '박상담', date: '2026-04-01', phone: '010-8901-2345', memo: '고객 변심으로 취소', address: '서울 강동구 천호동 90' },
  { id: 'AP-2026-009', customer: '강동원', channel: 'CRM등록', product: '5G 프리미어 플러스', carrier: 'KT', status: '계약완료', gift: '현금 10만원', assignee: '최매니저', date: '2026-04-01', phone: '010-9012-3456', memo: '법인 계약', address: '서울 종로구 삼청동 15' },
  { id: 'AP-2026-010', customer: '유아인', channel: '셀프신청', product: '다이렉트 29', carrier: 'LGU+', status: '신청완료', gift: '스타벅스 2만원권', assignee: '-', date: '2026-04-06', phone: '010-0123-4567', memo: '', address: '경기 수원시 팔달구 인계동 33' },
];

export default function Applications() {
  const [statusFilter, setStatusFilter] = useState('전체');
  const [channelFilter, setChannelFilter] = useState('전체');
  const [carrierFilter, setCarrierFilter] = useState('전체');
  const [selected, setSelected] = useState(null);
  const [memo, setMemo] = useState('');

  const statusList = ['전체', '신청완료', '상담중', '계약완료', '설치완료', '취소'];
  const channels = ['전체', '셀프신청', '티켓', 'CRM등록'];
  const carriers = ['전체', 'SKT', 'KT', 'LGU+'];

  const filtered = mockApps.filter(a => {
    if (statusFilter !== '전체' && a.status !== statusFilter) return false;
    if (channelFilter !== '전체' && a.channel !== channelFilter) return false;
    if (carrierFilter !== '전체' && a.carrier !== carrierFilter) return false;
    return true;
  });

  const kpis = [
    { label: '총 신청', value: 10, color: theme.blue },
    { label: '신청완료', value: 3, color: theme.blue },
    { label: '상담중', value: 3, color: theme.orange },
    { label: '계약완료', value: 3, color: theme.green },
    { label: '취소', value: 1, color: theme.red },
  ];

  function openDetail(app) {
    setSelected(app);
    setMemo(app.memo);
  }

  function changeStatus(newStatus) {
    if (!selected) return;
    setSelected({ ...selected, status: newStatus });
  }

  const carrierColor = (c) => theme.carrier[c === 'LGU+' ? 'LG U+' : c] || theme.textSecondary;

  return (
    <div style={{ padding: 24, fontFamily: theme.sans, color: theme.text, background: theme.bg, minHeight: '100vh' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>신청 현황</h2>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
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
          {statusList.map(s => (
            <button key={s} style={filterBtn(statusFilter === s)} onClick={() => setStatusFilter(s)}>{s}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>채널</span>
          {channels.map(c => (
            <button key={c} style={filterBtn(channelFilter === c)} onClick={() => setChannelFilter(c)}>{c}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>통신사</span>
          {carriers.map(c => (
            <button key={c} style={filterBtn(carrierFilter === c)} onClick={() => setCarrierFilter(c)}>{c}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              {['신청번호', '고객명', '채널', '상품', '통신사', '상태', '사은품', '담당자', '신청일', '관리'].map(h => (
                <th key={h} style={tableStyles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(a => (
              <tr key={a.id} onClick={() => openDetail(a)} style={{ cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = theme.bgHover}
                onMouseLeave={e => e.currentTarget.style.background = ''}>
                <td style={tableStyles.td}><span style={{ fontWeight: 600, color: theme.blue }}>{a.id}</span></td>
                <td style={tableStyles.td}>{a.customer}</td>
                <td style={tableStyles.td}><span style={statusStyle('navy')}>{a.channel}</span></td>
                <td style={{ ...tableStyles.td, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.product}</td>
                <td style={tableStyles.td}><span style={{ fontWeight: 700, color: carrierColor(a.carrier) }}>{a.carrier}</span></td>
                <td style={tableStyles.td}><span style={statusStyle(statusMap[a.status] || 'gray')}>{a.status}</span></td>
                <td style={tableStyles.td}>{a.gift}</td>
                <td style={tableStyles.td}>{a.assignee}</td>
                <td style={tableStyles.td}>{a.date}</td>
                <td style={tableStyles.td}>
                  <button style={button.primary} onClick={e => { e.stopPropagation(); openDetail(a); }}>상세</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={10} style={{ ...tableStyles.td, textAlign: 'center', padding: 32, color: theme.textMuted }}>데이터가 없습니다</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setSelected(null)}>
          <div style={{ background: '#fff', borderRadius: 12, width: 680, maxHeight: '85vh', overflow: 'auto', padding: 28, boxShadow: theme.shadowLg }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{selected.id} 신청 상세</h3>
              <button style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: theme.textMuted }} onClick={() => setSelected(null)}>✕</button>
            </div>

            {/* Info Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {[
                ['고객명', selected.customer],
                ['연락처', selected.phone],
                ['채널', selected.channel],
                ['상품', selected.product],
                ['통신사', selected.carrier],
                ['사은품', selected.gift],
                ['담당자', selected.assignee],
                ['신청일', selected.date],
                ['주소', selected.address],
              ].map(([label, val]) => (
                <div key={label} style={{ fontSize: 12 }}>
                  <span style={{ color: theme.textMuted }}>{label}: </span>
                  <span style={{ fontWeight: 600 }}>{val}</span>
                </div>
              ))}
            </div>

            {/* Status */}
            <div style={{ background: theme.bgInput, borderRadius: 8, padding: 14, marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 8, fontWeight: 600 }}>현재 상태</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ ...statusStyle(statusMap[selected.status] || 'gray'), fontSize: 13, padding: '4px 12px' }}>{selected.status}</span>
              </div>
              <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 8, fontWeight: 600 }}>상태 변경</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {statusFlow.map(s => (
                  <button key={s} style={{
                    ...button.secondary,
                    ...(selected.status === s ? { background: theme.navy, color: '#fff', borderColor: theme.navy } : {}),
                  }} onClick={() => changeStatus(s)}>
                    {s}
                  </button>
                ))}
                <button style={button.danger} onClick={() => changeStatus('취소')}>취소</button>
              </div>
            </div>

            {/* Memo */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>메모</div>
              <textarea
                value={memo}
                onChange={e => setMemo(e.target.value)}
                placeholder="메모를 입력하세요..."
                style={{ width: '100%', minHeight: 70, border: `1.5px solid ${theme.borderDark}`, borderRadius: 8, padding: 12, fontSize: 12, fontFamily: theme.sans, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button style={button.secondary} onClick={() => setSelected(null)}>닫기</button>
              <button style={button.primary} onClick={() => setSelected(null)}>저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
