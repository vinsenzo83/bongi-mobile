import { useState } from 'react';
import { theme, statusStyle, tableStyles, card, button, filterBtn, kpiCard, input } from '../../styles/admin-theme.js';

const REVIEW_ITEMS = [
  ['green', '신규', '모바일 요금제', 'SKT 5GX 신규 요금제 추가 — 월 75,000원', '09:00'],
  ['orange', '변경', '공시지원금', '갤럭시 S26 공시지원금 변경 234,960원 → 265,000원', '09:00'],
  ['orange', '변경', '모바일 요금제', 'KT 슈퍼플랜 베이직 데이터 200GB → 250GB', '09:00'],
  ['red', '삭제', '공시지원금', '갤럭시 S24 FE 단종으로 공시지원금 삭제', '09:00'],
  ['orange', '변경', '공시지원금', '아이폰 16 Pro KT 공시지원금 변경', '09:00'],
];

export default function CrawlManage() {
  const [activeFilter, setActiveFilter] = useState('전체');

  return (
    <div>
      {/* Top filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
        {['전체', '모바일 요금제', '공시지원금'].map(f => (
          <div key={f} onClick={() => setActiveFilter(f)} style={filterBtn(activeFilter === f)}>{f}</div>
        ))}
      </div>

      {/* Two crawling cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        {/* Mobile plans crawling */}
        <div style={{ ...card, borderColor: '#bfdbfe' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: theme.navy, marginBottom: 12, marginTop: 0 }}>📱 모바일 요금제 크롤링</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: theme.textMuted }}>출처: 각 통신사 공식 홈페이지</div>
            <span style={statusStyle('green')}>정상</span>
          </div>
          <div style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 8 }}>마지막 실행: 2026.04.05 09:00</div>
          <div style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 12 }}>주기: 매일 오전 9시</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div style={{ ...kpiCard, padding: 10 }}><div style={{ fontSize: 18, fontWeight: 900, color: theme.green }}>3</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>신규</div></div>
            <div style={{ ...kpiCard, padding: 10 }}><div style={{ fontSize: 18, fontWeight: 900, color: theme.orange }}>8</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>변경</div></div>
            <div style={{ ...kpiCard, padding: 10 }}><div style={{ fontSize: 18, fontWeight: 900, color: theme.red }}>1</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>삭제</div></div>
          </div>
          <div style={{ height: 34, fontSize: 12, borderRadius: 6, background: theme.blue, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 600 }}>검토 시작</div>
        </div>

        {/* Subsidy crawling */}
        <div style={{ ...card, borderColor: '#bfdbfe' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: theme.navy, marginBottom: 12, marginTop: 0 }}>💰 공시지원금 크롤링</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: theme.textMuted }}>출처: 스마트초이스 (smartchoice.or.kr)</div>
            <span style={statusStyle('green')}>정상</span>
          </div>
          <div style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 8 }}>마지막 실행: 2026.04.05 09:00</div>
          <div style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 12 }}>주기: 매일 오전 9시 (자동)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div style={{ ...kpiCard, padding: 10 }}><div style={{ fontSize: 18, fontWeight: 900, color: theme.green }}>12</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>신규</div></div>
            <div style={{ ...kpiCard, padding: 10 }}><div style={{ fontSize: 18, fontWeight: 900, color: theme.orange }}>45</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>변경</div></div>
            <div style={{ ...kpiCard, padding: 10 }}><div style={{ fontSize: 18, fontWeight: 900, color: theme.red }}>3</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>삭제</div></div>
          </div>
          <div style={{ height: 34, fontSize: 12, borderRadius: 6, background: theme.blue, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 600 }}>검토 시작</div>
        </div>
      </div>

      {/* Review list */}
      <h2 style={{ fontSize: 15, fontWeight: 800, color: theme.navy, marginBottom: 10 }}>📋 검토 대기 목록</h2>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 14, padding: '8px 0' }}>
        <div style={filterBtn(true)}>전체 (72건)</div>
        <div style={{ ...filterBtn(false), borderColor: theme.green, color: theme.green }}>신규 (15건)</div>
        <div style={{ ...filterBtn(false), borderColor: theme.orange, color: theme.orange }}>변경 (53건)</div>
        <div style={{ ...filterBtn(false), borderColor: theme.red, color: theme.red }}>삭제 (4건)</div>
      </div>

      <div style={{ ...card, padding: 0, overflow: 'hidden', marginBottom: 10 }}>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              {['구분', '카테고리', '항목', '변경 내용', '수집일시', '처리'].map(h => (
                <th key={h} style={tableStyles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {REVIEW_ITEMS.map(([color, type, cat, desc, time], i) => (
              <tr key={i}>
                <td style={tableStyles.td}>
                  <span style={statusStyle(color === 'green' ? 'green' : color === 'orange' ? 'orange' : 'red')}>{type}</span>
                </td>
                <td style={tableStyles.td}><span style={statusStyle('navy')}>{cat}</span></td>
                <td style={{ ...tableStyles.td, fontWeight: 600, fontSize: 11 }}>{desc.split(' — ')[0] || desc.split(' ')[0]}</td>
                <td style={{ ...tableStyles.td, fontSize: 11, color: theme.textMuted }}>{desc}</td>
                <td style={{ ...tableStyles.td, fontSize: 11 }}>{time}</td>
                <td style={{ ...tableStyles.td, display: 'flex', gap: 4 }}>
                  <span style={button.success}>승인</span>
                  <span style={button.danger}>반려</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ height: 34, width: 120, borderRadius: 6, fontSize: 12, background: theme.blue, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 600 }}>전체 일괄 승인</div>
        <div style={{ height: 34, width: 120, borderRadius: 6, fontSize: 12, border: `1px solid ${theme.borderDark}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>신규만 승인</div>
      </div>
    </div>
  );
}
