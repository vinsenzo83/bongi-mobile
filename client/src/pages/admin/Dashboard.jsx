import { useState } from 'react';
import { theme, card, button, statusStyle, kpiCard, tableStyles } from '../../styles/admin-theme.js';

export default function Dashboard() {
  const [kpis] = useState([
    { label: '오늘 신규 신청', value: 5, color: theme.blue },
    { label: '총 신청', value: 10, color: theme.navy },
    { label: '상담중 CRM', value: 3, color: theme.orange },
    { label: '총 회원', value: 9, color: theme.green },
    { label: '돈지키미 임박', value: 0, color: theme.red },
  ]);

  const [syncStatus] = useState({ tocrm: 6, fromcrm: 4 });

  const [actionCards] = useState([
    { label: '사은품 지급 현황', count: 2, sub: '미지급 건', color: theme.purple, bg: theme.purpleBg },
    { label: '포인트 출금', count: 1, sub: '출금 대기', color: theme.orange, bg: theme.orangeBg },
    { label: '알림 실패', count: 0, sub: '재발송 필요', color: theme.red, bg: theme.redBg },
  ]);

  const [recentApps] = useState([
    { time: '14:32', name: '홍길동', type: '번호이동', channel: '셀프신청', product: '5G 다이렉트 49', status: '신청완료' },
    { time: '13:15', name: '김철수', type: '기변', channel: '티켓', product: 'LTE 세이브 34', status: '상담중' },
    { time: '12:40', name: '이영희', type: '신규', channel: 'CRM등록', product: '5G 슬림 39', status: '계약완료' },
    { time: '11:05', name: '박민수', type: '번호이동', channel: '셀프신청', product: 'LTE 다이렉트 29', status: '취소' },
    { time: '10:22', name: '최지은', type: '기변', channel: '티켓', product: '5G 프리미엄 69', status: '신청완료' },
  ]);

  const [nonMembers] = useState([
    { name: '정수민', phone: '010-****-5678', date: '04-05', status: '미가입' },
    { name: '한지민', phone: '010-****-9012', date: '04-04', status: '미가입' },
    { name: '윤서연', phone: '010-****-3456', date: '04-03', status: '앱설치' },
  ]);

  const [donContract] = useState([
    { name: '홍길동', carrier: 'SKT', plan: '5G 다이렉트 49', remain: '23개월', amount: '120,000' },
    { name: '김철수', carrier: 'KT', plan: 'LTE 세이브 34', remain: '11개월', amount: '80,000' },
    { name: '이영희', carrier: 'LG U+', plan: '5G 슬림 39', remain: '2개월', amount: '45,000' },
  ]);

  const statusMap = {
    '신청완료': 'blue',
    '상담중': 'orange',
    '계약완료': 'green',
    '취소': 'red',
  };

  const channelMap = {
    '셀프신청': 'blue',
    '티켓': 'navy',
    'CRM등록': 'orange',
  };

  const memberTypeMap = {
    '앱회원': 'green',
    '비회원': 'orange',
  };

  return (
    <div style={{ padding: 24, fontFamily: theme.sans, background: theme.bg, minHeight: '100vh' }}>
      {/* Page Title */}
      <h1 style={{ fontSize: 20, fontWeight: 800, color: theme.text, marginBottom: 20 }}>
        대시보드
      </h1>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 16 }}>
        {kpis.map((k, i) => (
          <div key={i} style={{ ...kpiCard }}>
            <div style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: k.color, fontFamily: 'monospace' }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* CRM Sync Banner */}
      <div style={{
        ...card,
        background: theme.greenBg,
        border: `1px solid ${theme.green}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        padding: '12px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>&#9989;</span>
          <span style={{ fontWeight: 700, fontSize: 13, color: theme.green }}>CRM 동기화 상태</span>
        </div>
        <div style={{ display: 'flex', gap: 24, fontSize: 13, color: theme.text }}>
          <span>어드민 → CRM: <strong style={{ color: theme.blue }}>{syncStatus.tocrm}건</strong></span>
          <span>CRM → 어드민: <strong style={{ color: theme.green }}>{syncStatus.fromcrm}건</strong></span>
        </div>
        <span style={{ fontSize: 11, color: theme.textMuted }}>마지막 동기화: 2분 전</span>
      </div>

      {/* Action Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        {actionCards.map((ac, i) => (
          <div key={i} style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 4 }}>{ac.label}</div>
              <div style={{ fontSize: 11, color: theme.textMuted }}>{ac.sub}</div>
            </div>
            <div style={{
              width: 44, height: 44, borderRadius: 22,
              background: ac.bg, color: ac.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 800, fontFamily: 'monospace',
            }}>
              {ac.count}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Two Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>

        {/* Left: Recent Applications */}
        <div style={{ ...card }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: theme.text, margin: 0 }}>최근 신청 현황</h3>
            <button style={button.secondary}>전체보기</button>
          </div>
          <table style={tableStyles.table}>
            <thead>
              <tr>
                {['시간', '이름', '유형', '채널', '상품', '상태'].map(h => (
                  <th key={h} style={tableStyles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentApps.map((r, i) => (
                <tr key={i} style={{ cursor: 'pointer' }}>
                  <td style={tableStyles.td}>{r.time}</td>
                  <td style={{ ...tableStyles.td, fontWeight: 600, color: theme.text }}>{r.name}</td>
                  <td style={tableStyles.td}>{r.type}</td>
                  <td style={tableStyles.td}>
                    <span style={statusStyle(channelMap[r.channel] || 'gray')}>{r.channel}</span>
                  </td>
                  <td style={tableStyles.td}>{r.product}</td>
                  <td style={tableStyles.td}>
                    <span style={statusStyle(statusMap[r.status] || 'gray')}>{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Non-member -> App Signup */}
          <div style={{ ...card }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: theme.text, margin: 0, marginBottom: 12 }}>
              비회원 → 앱가입 유도
            </h3>
            <table style={tableStyles.table}>
              <thead>
                <tr>
                  {['이름', '전화번호', '일자', '상태'].map(h => (
                    <th key={h} style={tableStyles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {nonMembers.map((nm, i) => (
                  <tr key={i}>
                    <td style={{ ...tableStyles.td, fontWeight: 600, color: theme.text }}>{nm.name}</td>
                    <td style={tableStyles.td}>{nm.phone}</td>
                    <td style={tableStyles.td}>{nm.date}</td>
                    <td style={tableStyles.td}>
                      <span style={statusStyle(nm.status === '앱설치' ? 'green' : 'orange')}>{nm.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Don-jikimi Contract */}
          <div style={{ ...card }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: theme.text, margin: 0, marginBottom: 12 }}>
              돈지키미 약정 현황
            </h3>
            <table style={tableStyles.table}>
              <thead>
                <tr>
                  {['이름', '통신사', '요금제', '잔여', '위약금'].map(h => (
                    <th key={h} style={tableStyles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {donContract.map((dc, i) => (
                  <tr key={i}>
                    <td style={{ ...tableStyles.td, fontWeight: 600, color: theme.text }}>{dc.name}</td>
                    <td style={tableStyles.td}>
                      <span style={{ color: theme.carrier[dc.carrier] || theme.text, fontWeight: 600, fontSize: 11 }}>{dc.carrier}</span>
                    </td>
                    <td style={tableStyles.td}>{dc.plan}</td>
                    <td style={tableStyles.td}>
                      <span style={statusStyle(parseInt(dc.remain) <= 3 ? 'red' : 'gray')}>{dc.remain}</span>
                    </td>
                    <td style={tableStyles.td}>{dc.amount}원</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
