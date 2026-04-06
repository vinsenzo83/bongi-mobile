import { useState } from 'react';
import { theme, card, button, tableStyles, filterBtn, statusStyle } from '../../styles/admin-theme.js';

const mockAlerts = [
  { id: 1, recipient: '홍길동', type: '가입유도', title: 'KT 인터넷 가입 혜택 안내', channel: '알림톡', status: '성공', sentAt: '2026-04-06 10:30' },
  { id: 2, recipient: '이영희', type: '사은품안내', title: '사은품 수령 안내드립니다', channel: '알림톡', status: '성공', sentAt: '2026-04-06 09:15' },
  { id: 3, recipient: '박철수', type: '약정만료', title: '약정 만료 90일 전 안내', channel: 'SMS', status: '성공', sentAt: '2026-04-05 14:00' },
  { id: 4, recipient: '김민수', type: '마케팅', title: '봄맞이 특별 프로모션', channel: '푸시알림', status: '실패', sentAt: '2026-04-05 11:20' },
  { id: 5, recipient: '정수연', type: '가입유도', title: 'LG U+ 결합상품 안내', channel: '알림톡', status: '성공', sentAt: '2026-04-04 16:45' },
  { id: 6, recipient: '최동혁', type: '사은품안내', title: '공기청정기 배송 안내', channel: 'SMS', status: '성공', sentAt: '2026-04-04 13:30' },
  { id: 7, recipient: '한지민', type: '약정만료', title: '인터넷 약정 만료 안내', channel: '알림톡', status: '성공', sentAt: '2026-04-03 10:00' },
  { id: 8, recipient: '오세훈', type: '마케팅', title: '신규 요금제 출시 안내', channel: '푸시알림', status: '성공', sentAt: '2026-04-03 09:00' },
];

const templates = [
  { id: 1, name: '가입 축하 알림', type: '가입유도' },
  { id: 2, name: '사은품 발송 안내', type: '사은품안내' },
  { id: 3, name: '약정 만료 D-90 안내', type: '약정만료' },
  { id: 4, name: '약정 만료 D-30 안내', type: '약정만료' },
  { id: 5, name: '프로모션 안내', type: '마케팅' },
];

const tabs = ['알림톡', '푸시알림', 'SMS'];
const statusFilters = ['전체', '성공', '실패', '대기'];
const typeFilters = ['전체', '가입유도', '사은품안내', '약정만료', '마케팅'];

const channelColor = { '알림톡': 'blue', '푸시알림': 'orange', 'SMS': 'green' };
const statusColor = { '성공': 'green', '실패': 'red', '대기': 'gray' };
const typeColor = { '가입유도': 'blue', '사은품안내': 'green', '약정만료': 'orange', '마케팅': 'navy' };

export default function AlertManage() {
  const [activeTab, setActiveTab] = useState('알림톡');
  const [statusFilter, setStatusFilter] = useState('전체');
  const [typeFilter, setTypeFilter] = useState('전체');
  const [showModal, setShowModal] = useState(false);

  const filtered = mockAlerts.filter(a => {
    if (activeTab !== a.channel && activeTab !== '전체') {
      // Tab filters by channel
      if (a.channel !== activeTab) return false;
    }
    if (statusFilter !== '전체' && a.status !== statusFilter) return false;
    if (typeFilter !== '전체' && a.type !== typeFilter) return false;
    return true;
  });

  const kpis = [
    { label: '총 발송', value: 15, color: theme.blue },
    { label: '성공', value: 14, color: theme.green },
    { label: '실패', value: 1, color: theme.red },
    { label: '대기', value: 0, color: theme.orange },
  ];

  return (
    <div style={{ padding: 24, fontFamily: theme.sans }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: theme.text, margin: 0 }}>알림 관리</h2>
        <button style={button.primary} onClick={() => setShowModal(true)}>알림 발송</button>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ ...card, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: `2px solid ${theme.border}` }}>
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              padding: '8px 20px',
              fontSize: 13,
              fontWeight: activeTab === t ? 700 : 400,
              color: activeTab === t ? theme.navy : theme.textMuted,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === t ? `2px solid ${theme.navy}` : '2px solid transparent',
              cursor: 'pointer',
              fontFamily: theme.sans,
              marginBottom: -2,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* 필터 */}
      <div style={{ ...card, marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: theme.text }}>상태</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {statusFilters.map(f => (
            <button key={f} style={filterBtn(statusFilter === f)} onClick={() => setStatusFilter(f)}>{f}</button>
          ))}
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: theme.text, marginLeft: 8 }}>유형</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {typeFilters.map(f => (
            <button key={f} style={filterBtn(typeFilter === f)} onClick={() => setTypeFilter(f)}>{f}</button>
          ))}
        </div>
      </div>

      {/* 테이블 */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              {['수신자', '유형', '제목', '채널', '상태', '발송일시', '관리'].map(h => (
                <th key={h} style={tableStyles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(a => (
              <tr key={a.id}>
                <td style={tableStyles.td}><span style={{ fontWeight: 600, color: theme.text }}>{a.recipient}</span></td>
                <td style={tableStyles.td}><span style={statusStyle(typeColor[a.type] || 'gray')}>{a.type}</span></td>
                <td style={tableStyles.td}>{a.title}</td>
                <td style={tableStyles.td}><span style={statusStyle(channelColor[a.channel] || 'gray')}>{a.channel}</span></td>
                <td style={tableStyles.td}><span style={statusStyle(statusColor[a.status] || 'gray')}>{a.status}</span></td>
                <td style={tableStyles.td}>{a.sentAt}</td>
                <td style={tableStyles.td}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button style={{ ...button.secondary, padding: '4px 8px', fontSize: 11 }}>상세</button>
                    {a.status === '실패' && (
                      <button style={{ ...button.danger, padding: '4px 8px', fontSize: 11 }}>재발송</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 템플릿 선택 모달 */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: 24, width: 480,
            boxShadow: theme.shadowLg,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: theme.text }}>알림 템플릿 선택</h3>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: theme.textMuted }}
              >
                &times;
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {templates.map(t => (
                <div
                  key={t.id}
                  style={{
                    ...card,
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: theme.text }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>{t.type}</div>
                  </div>
                  <button style={{ ...button.primary, padding: '5px 12px', fontSize: 11 }}>선택</button>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <button style={button.secondary} onClick={() => setShowModal(false)}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
