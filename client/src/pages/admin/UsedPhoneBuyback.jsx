import { useState } from 'react';
import { theme, statusStyle, tableStyles, card, button, filterBtn, kpiCard, input } from '../../styles/admin-theme.js';

const BUYBACK_DATA = [
  [47, '순천점', '-', '20260405-0003855200802288205179', '권홍석 (6010)', 'Galaxy S23 Ultra( SM-S918 )', '후보상', '2026-04-05 19:20:40', '접수완료', '', 'A', '', '', '0', ''],
  [46, '상무점', '김상담', '20260405-0003842100501234567890', '홍길동 (5678)', 'Galaxy S25 Ultra( SM-S938 )', '후보상', '2026-04-05 15:10:22', '매입대기', '', 'A', 'A', 'A', '870,000', 'ORD-20260405-001'],
  [45, '전대점', '이상담', '20260404-0003831200601234567890', '김철수 (2345)', 'iPhone 16 Pro( A3291 )', '후보상', '2026-04-04 14:33:10', '송금완료', '2026-04-05', 'A', 'B', 'B', '740,000', 'ORD-20260404-003'],
  [44, '익산점', '-', '20260404-0003820300701234567890', '이영희 (3456)', 'Galaxy Z Flip6( SM-F741 )', '후보상', '2026-04-04 11:05:55', '동의대기', '', 'B', '', '', '0', ''],
  [43, '신창점', '박상담', '20260403-0003815400801234567890', '박민수 (4567)', 'iPhone 15 Pro Max( A2893 )', '후보상', '2026-04-03 16:42:18', '송금완료', '2026-04-04', 'A', 'A', 'A', '910,000', 'ORD-20260403-002'],
  [42, '상무점', '-', '20260403-0003801500901234567890', '최지은 (5678)', 'Galaxy S24( SM-S921 )', '후보상', '2026-04-03 10:15:30', '반송완료', '', 'C', '', '', '0', ''],
  [41, '첨단점', '김상담', '20260402-0003795601001234567890', '정수민 (7890)', 'iPhone 16 Pro Max( A3295 )', '후보상', '2026-04-02 13:28:45', '송금완료', '2026-04-03', 'A', 'A', 'A', '1,110,000', 'ORD-20260402-001'],
  [40, '남악점', '-', '20260401-0003782701101234567890', '한지민 (8901)', 'Galaxy S25+( SM-S936 )', '후보상', '2026-04-01 09:55:12', '접수완료', '', 'B', '', '', '0', ''],
];

function getStatusColor(status) {
  if (status === '송금완료') return 'green';
  if (status === '매입대기') return 'navy';
  if (status === '접수완료') return 'blue';
  if (status === '동의대기') return 'gray';
  if (status === '반송완료') return 'red';
  return 'orange';
}

function getGradeColor(grade) {
  if (grade === 'A') return 'green';
  if (grade === 'B') return 'blue';
  if (grade === 'C') return 'orange';
  return 'gray';
}

const USED_PHONE_SAMPLE = [
  ['Apple', 'iPhone 16', 'iPhone 16 Pro Max', '256G', '1,110,000', '980,000', '920,000', '560,000', '10,000'],
  ['Apple', 'iPhone 16', 'iPhone 16 Pro', '256G', '940,000', '810,000', '755,000', '475,000', '10,000'],
  ['Apple', 'iPhone 17', 'iPhone 17 Pro Max', '256G', '1,670,000', '1,430,000', '1,300,000', '820,000', '10,000'],
  ['삼성전자', '갤럭시 S', 'Galaxy S25 Ultra', '256G', '720,000', '600,000', '530,000', '300,000', '2,000'],
  ['삼성전자', '갤럭시 S', 'Galaxy S24', '256G', '390,000', '330,000', '260,000', '210,000', '2,000'],
];

export default function UsedPhoneBuyback() {
  const [makerFilter, setMakerFilter] = useState('전체');

  return (
    <div>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 14 }}>
        <div style={kpiCard}><div style={{ fontSize: 24, fontWeight: 900, color: theme.textMuted }}>8</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>동의대기</div></div>
        <div style={kpiCard}><div style={{ fontSize: 24, fontWeight: 900, color: theme.blue }}>23</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>접수완료</div></div>
        <div style={kpiCard}><div style={{ fontSize: 24, fontWeight: 900, color: theme.orange }}>15</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>매입대기</div></div>
        <div style={kpiCard}><div style={{ fontSize: 24, fontWeight: 900, color: theme.green }}>142</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>송금완료</div></div>
        <div style={kpiCard}><div style={{ fontSize: 24, fontWeight: 900, color: theme.red }}>3</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>반송완료</div></div>
      </div>

      {/* Tredit API Status */}
      <div style={{ ...card, background: '#d1fae5', borderColor: '#6ee7b7', marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: theme.green }}>🔗 Tredit API 연동 상태</div>
            <div style={{ fontSize: 11, color: '#065f46', marginTop: 2 }}>마지막 동기화: 2026.04.05 19:25 · 응답시간 0.3s · soprs.tredit.ai</div>
          </div>
          <span style={statusStyle('green')}>정상 연결</span>
        </div>
      </div>

      {/* Info banner */}
      <div style={{ ...card, background: '#eff6ff', borderColor: '#bfdbfe', marginBottom: 14, padding: '10px 16px' }}>
        <div style={{ fontSize: 11, color: theme.navy }}>
          📌 <strong>중고폰 매입 관리 데이터</strong>와 <strong>중고폰 매입 시세</strong>는 모두 <strong>Tredit API</strong>에서 실시간으로 수신합니다. 수동 입력 불필요.
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ margin: 0, fontSize: 10, fontWeight: 700, color: theme.textMuted, width: 40 }}>매장</div>
          <select style={{ ...input, width: 120, margin: 0, padding: '5px 8px', fontSize: 11 }}>
            <option>ALL</option>
            <option>상무점</option><option>익산점</option><option>전대점</option><option>신창점</option>
            <option>첨단점</option><option>순천점</option><option>남악점</option><option>여수점</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ margin: 0, fontSize: 10, fontWeight: 700, color: theme.textMuted, width: 30 }}>상태</div>
          <select style={{ ...input, width: 110, margin: 0, padding: '5px 8px', fontSize: 11 }}>
            <option>ALL</option>
            <option>동의대기</option><option>접수완료</option><option>매입대기</option><option>송금완료</option><option>반송완료</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ margin: 0, fontSize: 10, fontWeight: 700, color: theme.textMuted, width: 40 }}>기간</div>
          <input type="date" style={{ ...input, width: 130, margin: 0, padding: '5px 8px', fontSize: 11 }} defaultValue="2026-03-26" />
          <span style={{ fontSize: 11, color: theme.textMuted }}>~</span>
          <input type="date" style={{ ...input, width: 130, margin: 0, padding: '5px 8px', fontSize: 11 }} defaultValue="2026-04-05" />
        </div>
        <input style={{ ...input, marginLeft: 'auto', width: 150, marginBottom: 0 }} placeholder="키워드 검색" />
      </div>

      {/* Main table */}
      <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
        <table style={{ ...tableStyles.table, fontSize: 11, minWidth: 1300 }}>
          <thead>
            <tr>
              {['순번', '매장명', '접수자', '접수번호', '고객명(뒷자리)', '모델명', '구분', '접수일자', '상태', '입금일자', '셀프등급', '입고후검수', '보상등급', '보상가격', '주문번호', '관리'].map(h => (
                <th key={h} style={tableStyles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {BUYBACK_DATA.map((r, i) => {
              const status = r[8];
              const selfGrade = r[10];
              return (
                <tr key={i}>
                  <td style={{ ...tableStyles.td, fontFamily: 'monospace', color: theme.textMuted }}>{r[0]}</td>
                  <td style={{ ...tableStyles.td, fontWeight: 600 }}>{r[1]}</td>
                  <td style={{ ...tableStyles.td, fontSize: 10 }}>{r[2]}</td>
                  <td style={{ ...tableStyles.td, fontFamily: 'monospace', fontSize: 10, color: theme.blue, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r[3]}>{r[3].substring(0, 16)}...</td>
                  <td style={{ ...tableStyles.td, fontWeight: 600 }}>{r[4]}</td>
                  <td style={{ ...tableStyles.td, fontWeight: 600, fontSize: 10 }}>{r[5]}</td>
                  <td style={tableStyles.td}><span style={statusStyle('orange')}>{r[6]}</span></td>
                  <td style={{ ...tableStyles.td, fontSize: 10 }}>{r[7]}</td>
                  <td style={tableStyles.td}><span style={statusStyle(getStatusColor(status))}>{status}</span></td>
                  <td style={{ ...tableStyles.td, fontSize: 10 }}>{r[9] || '-'}</td>
                  <td style={tableStyles.td}><span style={statusStyle(getGradeColor(selfGrade))}>{selfGrade || '-'}</span></td>
                  <td style={tableStyles.td}><span style={statusStyle(r[11] ? 'navy' : 'gray')}>{r[11] || '-'}</span></td>
                  <td style={tableStyles.td}><span style={statusStyle(r[12] ? 'green' : 'gray')}>{r[12] || '-'}</span></td>
                  <td style={{ ...tableStyles.td, fontWeight: 700, color: theme.orange }}>{r[13] && r[13] !== '0' ? r[13] : '-'}</td>
                  <td style={{ ...tableStyles.td, fontFamily: 'monospace', fontSize: 10, color: theme.textMuted }}>{r[14] || '-'}</td>
                  <td style={tableStyles.td}><span style={{ ...button.secondary, fontSize: 10, cursor: 'pointer' }}>상세</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Used phone price table */}
      <div style={{ ...card, marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: theme.navy }}>
            📋 중고폰 매입 시세 (AI 채팅 참조용) — 302개 <span style={{ fontSize: 10, fontWeight: 400, color: theme.blue }}>Tredit API 자동 수신</span>
          </h3>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {['전체', 'Apple', '삼성', 'LG'].map(m => (
            <div key={m} onClick={() => setMakerFilter(m)} style={filterBtn(makerFilter === m)}>{m}</div>
          ))}
          <input style={{ ...input, width: 160, marginLeft: 'auto', marginBottom: 0 }} placeholder="모델명 검색" />
        </div>
        <div style={{ ...card, background: '#eff6ff', borderColor: '#bfdbfe', marginBottom: 8, padding: '8px 14px' }}>
          <div style={{ fontSize: 10, color: theme.navy }}>
            📌 <strong>A</strong>=외관깨끗 / <strong>B</strong>=미세기스 / <strong>C</strong>=눈에보이는기스 / <strong>D</strong>=파손·깨짐 / <strong>E</strong>=심각손상 &nbsp;|&nbsp; Tredit API 자동 수신
          </div>
        </div>
        <div style={{ overflowX: 'auto', maxHeight: 400, overflowY: 'auto' }}>
          <table style={{ ...tableStyles.table, fontSize: 11, minWidth: 800 }}>
            <thead style={{ position: 'sticky', top: 0 }}>
              <tr>
                <th style={tableStyles.th}>제조사</th>
                <th style={tableStyles.th}>시리즈</th>
                <th style={tableStyles.th}>모델명</th>
                <th style={tableStyles.th}>용량</th>
                <th style={{ ...tableStyles.th, color: theme.green }}>A등급</th>
                <th style={{ ...tableStyles.th, color: theme.blue }}>B등급</th>
                <th style={{ ...tableStyles.th, color: theme.orange }}>C등급</th>
                <th style={{ ...tableStyles.th, color: theme.red }}>D등급</th>
                <th style={{ ...tableStyles.th, color: theme.textMuted }}>E등급</th>
              </tr>
            </thead>
            <tbody>
              {USED_PHONE_SAMPLE.map((r, i) => (
                <tr key={i}>
                  <td style={tableStyles.td}>{r[0]}</td>
                  <td style={tableStyles.td}>{r[1]}</td>
                  <td style={{ ...tableStyles.td, fontWeight: 600 }}>{r[2]}</td>
                  <td style={tableStyles.td}>{r[3]}</td>
                  <td style={{ ...tableStyles.td, color: theme.green, fontWeight: 600 }}>{r[4]}</td>
                  <td style={{ ...tableStyles.td, color: theme.blue, fontWeight: 600 }}>{r[5]}</td>
                  <td style={{ ...tableStyles.td, color: theme.orange, fontWeight: 600 }}>{r[6]}</td>
                  <td style={{ ...tableStyles.td, color: theme.red, fontWeight: 600 }}>{r[7]}</td>
                  <td style={{ ...tableStyles.td, color: theme.textMuted }}>{r[8]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, color: theme.textMuted, marginTop: 6 }}>전체 302개 중 5개 표시</div>
      </div>
    </div>
  );
}
