import { useState } from 'react';
import { theme, statusStyle, tableStyles, card, button, filterBtn, kpiCard, input } from '../../styles/admin-theme.js';

const priceData = [
  { model: '갤럭시 S26', s1: '9만', s2: '19만', k1: '-10만', k2: '-5만', l1: '-15만', l2: '-10만', date: '04.05' },
  { model: '갤럭시 S26+', s1: '29만', s2: '39만', k1: '9만', k2: '14만', l1: '5만', l2: '9만', date: '04.05' },
  { model: '아이폰 16 Pro', s1: '44만', s2: '54만', k1: '24만', k2: '29만', l1: '19만', l2: '24만', date: '04.05' },
  { model: '아이폰 16', s1: '14만', s2: '24만', k1: '-6만', k2: '-1만', l1: '-11만', l2: '-6만', date: '04.05' },
];

export default function UsedPhones() {
  const [tab, setTab] = useState('신규');

  const valColor = (v) => v.startsWith('-') ? theme.green : theme.navy;

  return (
    <div style={{ padding: 24, fontFamily: theme.sans, background: theme.bg, minHeight: '100vh' }}>

      {/* 탭 + 액션 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
        <span style={filterBtn(tab === '신규')} onClick={() => setTab('신규')}>휴대폰 시세 (신규)</span>
        <span style={filterBtn(tab === '중고')} onClick={() => setTab('중고')}>중고폰 시세</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <span style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: 34, width: 120, borderRadius: 6, fontSize: 12, fontWeight: 600,
            border: `1px solid ${theme.borderDark}`, background: '#fff', color: theme.textSecondary, cursor: 'pointer'
          }}>엑셀 업로드</span>
          <span style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: 34, width: 90, borderRadius: 6, fontSize: 12, fontWeight: 600,
            background: theme.blue, color: '#fff', cursor: 'pointer'
          }}>+ 등록</span>
        </div>
      </div>

      {/* 업데이트 경고 */}
      <div style={{ ...card, background: theme.orangeBg, borderColor: '#fcd34d', marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: theme.orange }}>⚠️ 마지막 업데이트: 2026.04.04 — 오늘 시세 업데이트가 필요합니다</div>
      </div>

      {/* 필터 바 */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <input style={{ ...input, width: 180 }} placeholder="모델명 검색" />
        <span style={filterBtn(true)}>전체</span>
        <span style={filterBtn(false)}>삼성</span>
        <span style={filterBtn(false)}>애플</span>
        <span style={filterBtn(false)}>5G</span>
      </div>

      {/* 테이블 */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <table style={{ ...tableStyles.table, marginBottom: 0 }}>
          <thead>
            <tr>
              <th style={tableStyles.th}>모델명</th>
              <th style={tableStyles.th}>SKT 번이</th>
              <th style={tableStyles.th}>SKT 기변</th>
              <th style={tableStyles.th}>KT 번이</th>
              <th style={tableStyles.th}>KT 기변</th>
              <th style={tableStyles.th}>LG 번이</th>
              <th style={tableStyles.th}>LG 기변</th>
              <th style={tableStyles.th}>업데이트일</th>
              <th style={tableStyles.th}>관리</th>
            </tr>
          </thead>
          <tbody>
            {priceData.map((row, i) => (
              <tr key={i}>
                <td style={{ ...tableStyles.td, fontWeight: 600 }}>{row.model}</td>
                {[row.s1, row.s2, row.k1, row.k2, row.l1, row.l2].map((v, j) => (
                  <td key={j} style={{ ...tableStyles.td, fontWeight: 600, color: valColor(v) }}>{v}</td>
                ))}
                <td style={tableStyles.td}>{row.date}</td>
                <td style={tableStyles.td}>
                  <span style={{ ...button.secondary, fontSize: 10, padding: '3px 8px' }}>수정</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
