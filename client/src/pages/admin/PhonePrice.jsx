import React, { useState } from 'react';
import { theme, statusStyle, tableStyles, card, button, filterBtn } from '../../styles/admin-theme.js';

const tbl = { width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 0 };
const th = { ...tableStyles.th, fontSize: 11 };
const td = { ...tableStyles.td, fontSize: 11 };

function fmt(v) {
  if (v < 0) return <span style={{ color: theme.green, fontWeight: 700 }}>{v}</span>;
  if (v === 0) return <span style={{ color: theme.blue, fontWeight: 700 }}>0</span>;
  return <span style={{ fontWeight: 600 }}>{v}</span>;
}

const models5g = [
  ['S26', 9, 19, -10, -5, -15, -10],
  ['S26+', 29, 39, 9, 14, 5, 9],
  ['S26U', 64, 74, 44, 49, 39, 44],
  ['플립7', 0, 54, 9, 14, 5, 0],
  ['폴드7', 104, 144, 109, 109, 104, 99],
  ['S25', 10, 59, 0, 39, 24, 24],
  ['S25+', 34, 79, 19, 59, 39, 44],
  ['S25U', 64, 114, 54, 89, 74, 79],
  ['S25 엣지', 39, 54, 14, 5, -15, 9],
  ['S25 FE', -5, 5, -40, -20, -50, -15],
  ['아이폰16 128G', 19, 54, -55, -25, -40, 14],
  ['아이폰16+ 128G', 59, 64, -45, -15, 0, 49],
  ['아이폰16 프로 128G', 49, 84, -25, 5, -5, 44],
  ['아이폰16 프로맥스 256G', 84, 119, 5, 34, 29, 79],
  ['아이폰17 256G', -5, 64, -10, 29, -15, 24],
  ['아이폰17 AIR 256G', 44, 84, 34, 59, -45, 57],
  ['아이폰17 프로 256G', 54, 114, 44, 82, 39, 74],
  ['아이폰17 프로맥스 256G', 104, 154, 99, 127, 94, 119],
];

const openboxModels = [
  ['S25 DP', -10, 39],
  ['S25+ DP', 9, 54],
  ['S25U DP', 34, 84],
];

const lowModels = [
  ['아이폰 13', '-', '-', '키즈폰 추천!'],
  ['갤럭시 A17', '가성비 추천!', '가성비 추천!', '가성비 추천!'],
  ['갤럭시 버디4', '-', '-', '효도폰/키즈폰 추천'],
  ['와이드8', '저가 요금 추천!', '-', '-'],
  ['퀀텀6', '가성비 추천!', '-', '-'],
  ['JUMP4/맘편한폰S', '-', '효도폰/키즈폰 추천', '-'],
  ['스타일 폴더2', '-', '-', '효도폰 추천!'],
  ['클래식 폴더', '-', '효도폰 추천!', '-'],
];

const addonRows = [
  { carrier: 'SK', carrierColor: 'red', carrierBg: '#fee2e2', rowSpan: 3, items: [
    ['우주패스', '혜택별 상이', '당월+6개월', '5만'],
    ['벅스 앤 데이터 플러스', '17,500원', '당월+4개월', '5만'],
    ['마이스마트콜3', '3,500원', '당월+2개월', '2만'],
  ]},
  { carrier: 'KT', carrierColor: 'blue', carrierBg: '#dbeafe', rowSpan: 4, items: [
    ['필수팩', '9,900원', '당월+3개월', '5만'],
    ['OTT+스타벅스', '13,900원', '당월+3개월', '5만'],
    ['모아진', '13,000원', '당월+3개월', '5만'],
    ['DC카드', '무료', '당월+3개월', '5만'],
  ]},
  { carrier: 'LG', carrierColor: 'green', carrierBg: '#d1fae5', rowSpan: 3, items: [
    ['교보SAM+구글원 패키지', '16,500원', '당월+3개월', '5만'],
    ['V컬러링 음악감상+벨링콘텐츠팩', '15,400원', '당월+3개월', '5만'],
    ['유플레이 프리미엄', '15,400원', '당월+4개월', '5만'],
  ]},
];

const notesRows = [
  ['워치', '워치 동시개통 조건. 워치 미개통시 추가금 발생', '5만원'],
  ['소노라이프', 'LG U+ 소노라이프 상품 가입조건. 비용 발생하지 않으며 미가입시 추가금 발생', '5만원'],
  ['보험', '휴대폰 보험은 부가서비스가 아닌 의무적으로 필수 가입', 'M+3개월'],
  ['할부이자', '할부 개통시 할부이자 발생, 금액 상이 할 수 있음', '5.9%'],
];

export default function PhonePrice() {
  const [history] = useState([]);

  return (
    <div>
      {/* 상단 액션바 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: theme.textMuted }}>전체 시세 통합 관리</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ ...button.secondary, fontSize: 11, cursor: 'pointer' }}>📥 엑셀폼 다운로드</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: theme.navy, color: '#fff', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            📂 엑셀 업로드
            <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }} />
          </label>
          <span style={{ ...button.success, fontSize: 11, cursor: 'pointer' }}>✏️ 직접 편집</span>
          <span style={{ fontSize: 11, color: theme.textMuted }}></span>
        </div>
      </div>

      {/* 업데이트 이력 */}
      <div style={{ ...card, marginBottom: 14, padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.navy, margin: 0 }}>📅 업데이트 이력</div>
          <span style={{ ...button.primary, fontSize: 11, cursor: 'pointer' }}>💾 현재 시세 저장 (새 차수)</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {history.length === 0 ? (
            <div style={{ fontSize: 11, color: theme.textMuted }}>저장된 이력이 없습니다. 시세 입력 후 저장하세요.</div>
          ) : history.slice(0, 10).map((h, i) => (
            <div key={i} style={{
              background: i === 0 ? theme.blueBg : '#f8f9fc',
              border: `1px solid ${i === 0 ? '#bfdbfe' : theme.border}`,
              borderRadius: 8, padding: '8px 12px', fontSize: 11, cursor: 'pointer', minWidth: 120,
            }}>
              <div style={{ fontWeight: 700, color: i === 0 ? theme.blue : theme.navy }}>{h.label}</div>
              <div style={{ color: theme.textMuted, fontSize: 10, marginTop: 2 }}>{h.date}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 오늘의 특가 — 유심 이동 */}
      <div style={{ ...card, background: '#eff6ff', borderColor: '#bfdbfe', marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: theme.navy, marginBottom: 10 }}>⚡ 오늘의 특가 — 유심 이동</div>
        <table style={tbl}>
          <thead>
            <tr>
              <th style={th}></th>
              <th style={{ ...th, textAlign: 'center', background: '#fee2e2', color: theme.red }}>
                SK<br /><span style={{ fontSize: 10, fontWeight: 400 }}>세이브 (24,750)</span>
              </th>
              <th style={{ ...th, textAlign: 'center', background: '#dbeafe', color: theme.blue }}>
                KT<br /><span style={{ fontSize: 10, fontWeight: 400 }}>데이터ON 비디오+(51,750)</span>
              </th>
              <th style={{ ...th, textAlign: 'center', background: '#d1fae5', color: theme.green }}>
                LG<br /><span style={{ fontSize: 10, fontWeight: 400 }}>심플+(45,750)</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...td, fontWeight: 700 }}>유심 이동</td>
              <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: theme.green }}>-40</td>
              <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: theme.green }}>-25</td>
              <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: theme.green }}>-30</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 5G 모델 시세표 */}
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: theme.navy, marginBottom: 10 }}>
          📱 5G 모델 시세표 <span style={{ fontSize: 11, color: theme.textMuted, fontWeight: 400 }}>(단위: 만원, 공시지원금 기준)</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ ...tbl, textAlign: 'center' }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: 'left' }}>모델</th>
                <th colSpan={2} style={{ ...th, textAlign: 'center', background: '#fee2e2', color: theme.red }}>SK 프리미엄(109,000)</th>
                <th colSpan={2} style={{ ...th, textAlign: 'center', background: '#dbeafe', color: theme.blue }}>KT 초이스스페셜(110,000)</th>
                <th colSpan={2} style={{ ...th, textAlign: 'center', background: '#d1fae5', color: theme.green }}>LG 프리미어슈퍼(115,000)</th>
              </tr>
              <tr>
                <th style={th}></th>
                <th style={th}>번이</th><th style={th}>기변</th>
                <th style={th}>번이</th><th style={th}>기변</th>
                <th style={th}>번이</th><th style={th}>기변</th>
              </tr>
            </thead>
            <tbody>
              {models5g.map((r, i) => (
                <tr key={i}>
                  <td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>{r[0]}</td>
                  <td style={td}>{fmt(r[1])}</td>
                  <td style={td}>{fmt(r[2])}</td>
                  <td style={td}>{fmt(r[3])}</td>
                  <td style={td}>{fmt(r[4])}</td>
                  <td style={td}>{fmt(r[5])}</td>
                  <td style={td}>{fmt(r[6])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 오픈박스 */}
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: theme.navy, marginBottom: 10 }}>
          📦 오픈박스 특가 <span style={{ fontSize: 11, color: theme.textMuted, fontWeight: 400 }}>SK 프리미엄(109,000)</span>
        </div>
        <table style={{ ...tbl, textAlign: 'center' }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left' }}>모델</th>
              <th style={th}>번이</th>
              <th style={th}>기변</th>
            </tr>
          </thead>
          <tbody>
            {openboxModels.map((r, i) => (
              <tr key={i}>
                <td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>{r[0]}</td>
                <td style={td}>{fmt(r[1])}</td>
                <td style={td}>{fmt(r[2])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 저가 모델 */}
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: theme.navy, marginBottom: 10 }}>💰 저가 모델 특가</div>
        <table style={{ ...tbl, textAlign: 'center' }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left' }}>모델</th>
              <th style={{ ...th, background: '#fee2e2', color: theme.red }}>
                SK<br /><span style={{ fontSize: 10, fontWeight: 400 }}>세이브(33,000)</span>
              </th>
              <th style={{ ...th, background: '#dbeafe', color: theme.blue }}>
                KT<br /><span style={{ fontSize: 10, fontWeight: 400 }}>슬림4G(37,000)</span>
              </th>
              <th style={{ ...th, background: '#d1fae5', color: theme.green }}>
                LG<br /><span style={{ fontSize: 10, fontWeight: 400 }}>5G미니(37,000)</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {lowModels.map((r, i) => (
              <tr key={i}>
                <td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>{r[0]}</td>
                {[1, 2, 3].map(j => (
                  <td key={j} style={td}>
                    {r[j] === '-' ? '-' : <span style={{ fontSize: 10, color: theme.blue }}>{r[j]}</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 부가서비스 */}
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: theme.navy, marginBottom: 6 }}>📋 부가서비스</div>
        <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 12 }}>부가서비스는 필수가 아닌 선택 가능. 할부 개통시 5.9% 할부이자 발생.</div>
        <table style={tbl}>
          <thead>
            <tr>
              <th style={th}>통신사</th>
              <th style={th}>부가서비스명</th>
              <th style={th}>월청구금</th>
              <th style={th}>유지기간</th>
              <th style={th}>미가입 추가금</th>
            </tr>
          </thead>
          <tbody>
            {addonRows.map((group) =>
              group.items.map((item, j) => (
                <tr key={`${group.carrier}-${j}`}>
                  {j === 0 && (
                    <td rowSpan={group.rowSpan} style={td}>
                      <span style={{ ...statusStyle(group.carrierColor), background: group.carrierBg }}>{group.carrier}</span>
                    </td>
                  )}
                  <td style={{ ...td, fontWeight: 600 }}>{item[0]}</td>
                  <td style={td}>{item[1]}</td>
                  <td style={td}>{item[2]}</td>
                  <td style={{ ...td, fontWeight: 600, color: theme.orange }}>{item[3]}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* 유의사항 */}
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.navy, marginBottom: 8 }}>📌 유의사항</div>
          <table style={tbl}>
            <thead>
              <tr>
                <th style={{ ...th, width: 40 }}>구분</th>
                <th style={th}>내용</th>
                <th style={{ ...th, width: 100 }}>추가금</th>
              </tr>
            </thead>
            <tbody>
              {notesRows.map((r, i) => (
                <tr key={i}>
                  <td style={{ ...td, fontWeight: 700 }}>{r[0]}</td>
                  <td style={td}>{r[1]}</td>
                  <td style={{ ...td, fontWeight: 700, color: (r[0] === '워치' || r[0] === '소노라이프') ? theme.orange : theme.navy }}>{r[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 단가표 보는 법 */}
      <div style={{ ...card, background: '#f8f9fc', borderColor: '#e8e8e8' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: theme.navy, marginBottom: 8 }}>💡 단가표 보는 법</div>
        <table style={tbl}>
          <tbody>
            <tr>
              <td style={{ ...td, fontWeight: 700, width: 100, textAlign: 'center' }}>
                <span style={{ color: theme.blue, fontWeight: 700 }}>0</span>
              </td>
              <td style={td}>기기값 0원 (공짜폰) — 예: S25 → 0 = 폰 무료</td>
            </tr>
            <tr>
              <td style={{ ...td, fontWeight: 700, textAlign: 'center' }}>
                <span style={{ fontWeight: 700 }}>64</span>
              </td>
              <td style={td}>기기값 본인 부담 (만원) — 예: S26U → 64 = 64만원 부담</td>
            </tr>
            <tr>
              <td style={{ ...td, fontWeight: 700, textAlign: 'center' }}>
                <span style={{ color: theme.green, fontWeight: 700 }}>-10</span>
              </td>
              <td style={td}>기기값 0원 + 현금 사은품 지급 — 예: S25 DP → -10 = 공짜 + 10만원 현금</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
