import { useState } from 'react';
import { theme, card, button, tableStyles, filterBtn, statusStyle } from '../../styles/admin-theme.js';

const statusMap = { 신청: 'blue', 감정중: 'orange', 감정완료: 'green', 입금완료: 'navy', 취소: 'gray' };

const mockBuybacks = [
  {
    id: 'BUY-2026-001', customer: '김영수', phone: '010-1234-5678', model: '갤럭시 S24 울트라 256GB',
    requestGrade: 'S', assessGrade: 'A+', assessPrice: 820000, status: '입금완료', date: '2026-04-02',
    photos: ['전면 양호', '후면 미세 스크래치', '측면 양호'],
    memo: '후면 미세 스크래치로 A+등급 책정',
    bank: '신한은행', account: '110-***-****78', paidDate: '2026-04-04', paidAmount: 820000,
    imei: '352345678901234', color: '블랙', storage: '256GB',
  },
  {
    id: 'BUY-2026-002', customer: '이민지', phone: '010-2345-6789', model: '아이폰 15 Pro 128GB',
    requestGrade: 'A', assessGrade: 'A', assessPrice: 750000, status: '입금완료', date: '2026-04-03',
    photos: ['전면 양호', '후면 양호', '측면 양호'],
    memo: '전체적으로 양호한 상태',
    bank: '카카오뱅크', account: '3333-**-****56', paidDate: '2026-04-05', paidAmount: 750000,
    imei: '356789012345678', color: '내추럴 티타늄', storage: '128GB',
  },
  {
    id: 'BUY-2026-003', customer: '박서준', phone: '010-3456-7890', model: '갤럭시 Z플립5 256GB',
    requestGrade: 'A', assessGrade: '-', assessPrice: null, status: '감정중', date: '2026-04-05',
    photos: ['전면 양호', '후면 미확인', '힌지 점검 필요'],
    memo: '힌지 부분 정밀 점검 진행중',
    bank: '국민은행', account: '012-***-****90', paidDate: null, paidAmount: null,
    imei: '359012345678901', color: '라벤더', storage: '256GB',
  },
  {
    id: 'BUY-2026-004', customer: '최하나', phone: '010-4567-8901', model: '아이폰 14 256GB',
    requestGrade: 'B', assessGrade: 'B', assessPrice: 480000, status: '감정완료', date: '2026-04-04',
    photos: ['전면 미세 스크래치', '후면 케이스 자국', '측면 양호'],
    memo: '전면 스크래치, 후면 케이스 자국 확인. B등급 적정.',
    bank: '우리은행', account: '1002-***-****01', paidDate: null, paidAmount: null,
    imei: '351234567890123', color: '미드나이트', storage: '256GB',
  },
  {
    id: 'BUY-2026-005', customer: '정우성', phone: '010-5678-9012', model: '갤럭시 S23 128GB',
    requestGrade: 'A', assessGrade: '-', assessPrice: null, status: '감정중', date: '2026-04-06',
    photos: ['전면 확인 예정', '후면 확인 예정', '측면 확인 예정'],
    memo: '택배 접수 완료, 감정 대기',
    bank: '하나은행', account: '910-***-****12', paidDate: null, paidAmount: null,
    imei: '354567890123456', color: '크림', storage: '128GB',
  },
];

export default function UsedPhoneBuyback() {
  const [statusFilter, setStatusFilter] = useState('전체');
  const [selected, setSelected] = useState(null);

  const statusList = ['전체', '신청', '감정중', '감정완료', '입금완료', '취소'];

  const filtered = mockBuybacks.filter(b => {
    if (statusFilter !== '전체' && b.status !== statusFilter) return false;
    return true;
  });

  const kpis = [
    { label: '총 매입신청', value: 5, color: theme.blue },
    { label: '감정중', value: 2, color: theme.orange },
    { label: '감정완료', value: 1, color: theme.green },
    { label: '입금완료', value: 2, color: theme.navy },
  ];

  const formatPrice = (v) => v != null ? `${v.toLocaleString()}원` : '-';

  return (
    <div style={{ padding: 24, fontFamily: theme.sans, color: theme.text, background: theme.bg, minHeight: '100vh' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>중고폰 매입 현황</h2>

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
      <div style={{ ...card, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 600, marginRight: 4 }}>상태</span>
        {statusList.map(s => (
          <button key={s} style={filterBtn(statusFilter === s)} onClick={() => setStatusFilter(s)}>{s}</button>
        ))}
      </div>

      {/* Table */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              {['매입번호', '고객명', '모델명', '신청등급', '감정등급', '감정가', '상태', '신청일', '관리'].map(h => (
                <th key={h} style={tableStyles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(b => (
              <tr key={b.id} onClick={() => setSelected(b)} style={{ cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = theme.bgHover}
                onMouseLeave={e => e.currentTarget.style.background = ''}>
                <td style={tableStyles.td}><span style={{ fontWeight: 600, color: theme.blue }}>{b.id}</span></td>
                <td style={tableStyles.td}>{b.customer}</td>
                <td style={tableStyles.td}>{b.model}</td>
                <td style={tableStyles.td}><span style={statusStyle('blue')}>{b.requestGrade}</span></td>
                <td style={tableStyles.td}><span style={statusStyle(b.assessGrade === '-' ? 'gray' : 'green')}>{b.assessGrade}</span></td>
                <td style={tableStyles.td}><span style={{ fontWeight: 700 }}>{formatPrice(b.assessPrice)}</span></td>
                <td style={tableStyles.td}><span style={statusStyle(statusMap[b.status] || 'gray')}>{b.status}</span></td>
                <td style={tableStyles.td}>{b.date}</td>
                <td style={tableStyles.td}>
                  <button style={button.primary} onClick={e => { e.stopPropagation(); setSelected(b); }}>상세</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} style={{ ...tableStyles.td, textAlign: 'center', padding: 32, color: theme.textMuted }}>데이터가 없습니다</td></tr>
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
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{selected.id} 매입 상세</h3>
              <button style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: theme.textMuted }} onClick={() => setSelected(null)}>✕</button>
            </div>

            {/* Phone Info */}
            <div style={{ background: theme.bgInput, borderRadius: 8, padding: 14, marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 8, fontWeight: 600 }}>단말기 정보</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  ['모델명', selected.model],
                  ['색상', selected.color],
                  ['용량', selected.storage],
                  ['IMEI', selected.imei],
                ].map(([label, val]) => (
                  <div key={label} style={{ fontSize: 12 }}>
                    <span style={{ color: theme.textMuted }}>{label}: </span>
                    <span style={{ fontWeight: 600 }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Photos */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>사진 점검 ({selected.photos.length}장)</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {selected.photos.map((p, i) => (
                  <div key={i} style={{ background: '#f1f5f9', borderRadius: 8, padding: 20, textAlign: 'center', border: `1px solid ${theme.border}` }}>
                    <div style={{ fontSize: 32, marginBottom: 6 }}>{i === 0 ? '📱' : i === 1 ? '🔙' : '📐'}</div>
                    <div style={{ fontSize: 11, color: theme.textSecondary }}>{p}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Grade Assessment */}
            <div style={{ background: theme.bgInput, borderRadius: 8, padding: 14, marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 8, fontWeight: 600 }}>등급 감정</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 4 }}>신청등급</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: theme.blue }}>{selected.requestGrade}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 4 }}>감정등급</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: selected.assessGrade === '-' ? theme.textMuted : theme.green }}>{selected.assessGrade}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 4 }}>감정가</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: theme.navy }}>{formatPrice(selected.assessPrice)}</div>
                </div>
              </div>
              {selected.memo && (
                <div style={{ marginTop: 12, fontSize: 12, color: theme.textSecondary, borderTop: `1px solid ${theme.border}`, paddingTop: 10 }}>
                  <span style={{ fontWeight: 600 }}>감정 메모: </span>{selected.memo}
                </div>
              )}
            </div>

            {/* Customer Info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div style={{ fontSize: 12 }}><span style={{ color: theme.textMuted }}>고객명: </span><span style={{ fontWeight: 600 }}>{selected.customer}</span></div>
              <div style={{ fontSize: 12 }}><span style={{ color: theme.textMuted }}>연락처: </span><span style={{ fontWeight: 600 }}>{selected.phone}</span></div>
            </div>

            {/* Payout Info */}
            <div style={{ background: selected.paidDate ? theme.greenBg : theme.bgInput, borderRadius: 8, padding: 14, marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 8, fontWeight: 600 }}>입금 정보</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  ['은행', selected.bank],
                  ['계좌번호', selected.account],
                  ['입금일', selected.paidDate || '미입금'],
                  ['입금액', selected.paidAmount ? formatPrice(selected.paidAmount) : '-'],
                ].map(([label, val]) => (
                  <div key={label} style={{ fontSize: 12 }}>
                    <span style={{ color: theme.textMuted }}>{label}: </span>
                    <span style={{ fontWeight: 600 }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>상태:</span>
              <span style={{ ...statusStyle(statusMap[selected.status] || 'gray'), fontSize: 13, padding: '4px 12px' }}>{selected.status}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button style={button.secondary} onClick={() => setSelected(null)}>닫기</button>
              {selected.status === '감정완료' && <button style={button.success} onClick={() => setSelected({ ...selected, status: '입금완료' })}>입금 처리</button>}
              {selected.status !== '취소' && selected.status !== '입금완료' && <button style={button.danger} onClick={() => setSelected({ ...selected, status: '취소' })}>취소</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
