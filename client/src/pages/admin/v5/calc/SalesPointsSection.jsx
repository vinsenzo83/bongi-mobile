// V5 어드민 — 7. 영업 포인트 (read-only)
// vanilla 의 7번 섹션 — 단순 안내 텍스트
import { tableStyle, thStyle, tdStyle, subTitleStyle } from './styles.js';
import SectionShell from './SectionShell.jsx';

const PRIORITY = [
  { rank: 1, kind: '약정 할인',   scale: '가장 큼 (3년 약정 기본)' },
  { rank: 2, kind: '가족결합 할인', scale: '최대 월 33,000원' },
  { rank: 3, kind: '제휴카드 할인', scale: '월 5,000~22,000원' },
  { rank: 4, kind: '복지 할인',    scale: '아주 제한적' },
];

const CONTRACT_COMPARE = [
  { term: '1년',         monthly: '58,520원', yr: '702,240원', gift: '없음', penalty: '-', net: '702,240원' },
  { term: '3년 (권장)', monthly: '38,500~39,600원', yr: '448,800~475,200원', gift: '약 37~40만원', penalty: '약 20~30만원', net: '약 275,000~392,000원' },
];

export default function SalesPointsSection({ open, onToggle }) {
  return (
    <SectionShell
      id="sec-7"
      title="💡 7. 공통 영업 포인트 (read-only)"
      note="3사 공통 영업 핵심 포인트. 통신 요금 자체는 대리점에 따라 달라지지 않음 — 할인 조합에서 차이가 발생."
      open={open}
      onToggle={onToggle}
    >
      <div style={subTitleStyle}>① 할인 우선순위 (큰 순서)</div>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: 60 }}>순위</th>
            <th style={thStyle}>할인 종류</th>
            <th style={thStyle}>규모</th>
          </tr>
        </thead>
        <tbody>
          {PRIORITY.map((p) => (
            <tr key={p.rank}>
              <td style={{ ...tdStyle, fontWeight: 800 }}>{p.rank}</td>
              <td style={tdStyle}>{p.kind}</td>
              <td style={tdStyle}>{p.scale}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={subTitleStyle}>② 약정 비교 (3년 권장 근거 — 100M + 기본 TV)</div>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>약정</th>
            <th style={thStyle}>월 요금</th>
            <th style={thStyle}>12개월 합계</th>
            <th style={thStyle}>사은품</th>
            <th style={thStyle}>위약금</th>
            <th style={thStyle}>실부담</th>
          </tr>
        </thead>
        <tbody>
          {CONTRACT_COMPARE.map((r, i) => (
            <tr key={i}>
              <td style={{ ...tdStyle, fontWeight: 800 }}>{r.term}</td>
              <td style={tdStyle}>{r.monthly}</td>
              <td style={tdStyle}>{r.yr}</td>
              <td style={tdStyle}>{r.gift}</td>
              <td style={tdStyle}>{r.penalty}</td>
              <td style={{ ...tdStyle, fontWeight: 700, color: '#86efac' }}>{r.net}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: 11, color: '#fbbf24', marginTop: 10, lineHeight: 1.6 }}>
        <b>결론:</b> 1년 약정이 30~40만원 이상 손해. ⚠️ 단, 설치 12개월 내 중도해지 시 사은품 전액 반환 의무.
      </div>
    </SectionShell>
  );
}
