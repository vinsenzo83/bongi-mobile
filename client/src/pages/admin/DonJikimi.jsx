import { useState } from 'react';
import { theme, statusStyle, tableStyles, card, button, filterBtn, kpiCard } from '../../styles/admin-theme.js';

const mockData = [
  ['홍길동','010-1234-5678','인터넷 약정','KT 1G+지니TV모든G','2026.04.08','D-3','발송완료','전달완료','김상담','상담중'],
  ['김철수','010-2345-6789','렌탈 약정','코웨이 아이콘3 정수기','2026.04.12','D-7','발송완료','전달완료','이상담','상담중'],
  ['강민준','010-0123-4567','요금제 변경','SKT 5GX 프리미엄','2026.04.20','D-15','발송완료','전달완료','미배정','대기'],
  ['이영희','010-3456-7890','부가서비스 해지','KT 필수팩','2026.04.28','D-23','예정','전달완료','미배정','대기'],
  ['박민수','010-4567-8901','인터넷 약정','LG U+ 500M+프리미엄','2026.05.01','D-26','예정','대기','미배정','대기'],
  ['최지은','010-5678-9012','렌탈 약정','LG 퓨리케어 공기청정기','2026.06.15','D-71','예정','대기','미배정','-'],
  ['윤서연','010-8901-2345','인터넷 약정','SKT 1G+Btv올','2026.07.20','D-106','예정','대기','미배정','-'],
];

const periodFilters = ['전체', 'D-7 이내', 'D-30 이내', 'D-30 초과'];
const itemFilters = ['전체', '요금제 변경', '부가서비스 해지', '인터넷 약정', '렌탈 약정'];
const itemColors = { '인터넷 약정': 'blue', '렌탈 약정': 'green', '요금제 변경': 'navy', '부가서비스 해지': 'orange' };

export default function DonJikimi() {
  const [periodFilter, setPeriodFilter] = useState('전체');
  const [itemFilter, setItemFilter] = useState('전체');
  const [search, setSearch] = useState('');

  const filtered = mockData.filter(r => {
    const ddayNum = parseInt(r[5].replace('D-', ''));
    if (periodFilter === 'D-7 이내' && ddayNum > 7) return false;
    if (periodFilter === 'D-30 이내' && ddayNum > 30) return false;
    if (periodFilter === 'D-30 초과' && ddayNum <= 30) return false;
    if (itemFilter !== '전체' && r[2] !== itemFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!r[0].toLowerCase().includes(s) && !r[1].includes(s)) return false;
    }
    return true;
  });

  return (
    <div>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 14 }}>
        <div style={kpiCard}><div style={{ fontSize: 22, fontWeight: 900, color: theme.red }}>8</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>D-7 이내</div></div>
        <div style={kpiCard}><div style={{ fontSize: 22, fontWeight: 900, color: theme.orange }}>30</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>D-30 이내</div></div>
        <div style={kpiCard}><div style={{ fontSize: 22, fontWeight: 900, color: theme.blue }}>142</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>CRM 전달</div></div>
        <div style={kpiCard}><div style={{ fontSize: 22, fontWeight: 900, color: theme.green }}>38</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>재계약 완료</div></div>
        <div style={kpiCard}><div style={{ fontSize: 22, fontWeight: 900, color: theme.navy }}>856</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>전체 등록</div></div>
      </div>

      {/* Info banner */}
      <div style={{ ...card, background: '#eff6ff', borderColor: '#bfdbfe', marginBottom: 14, padding: '10px 16px' }}>
        <div style={{ fontSize: 11, color: theme.navy }}>
          📌 등록 항목: <strong>요금제 변경일 / 부가서비스 해지일 / 인터넷 약정 종료일 / 렌탈 약정 종료일</strong> · 알림: <strong>앱 자체 알림</strong> (D-90/D-30/D-7/D-1) · D-30 도래 시 <strong>CRM 해피콜 자동 추가</strong>
        </div>
      </div>

      {/* Filter: 기간 */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: theme.textMuted, width: 40 }}>기간</span>
        {periodFilters.map(f => (
          <div
            key={f}
            style={{
              ...filterBtn(periodFilter === f),
              ...(f === 'D-7 이내' && periodFilter !== f ? { borderColor: theme.red, color: theme.red } : {}),
            }}
            onClick={() => setPeriodFilter(f)}
          >
            {f}
          </div>
        ))}
      </div>

      {/* Filter: 항목 + 검색 */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: theme.textMuted, width: 40 }}>항목</span>
        {itemFilters.map(f => (
          <div key={f} style={filterBtn(itemFilter === f)} onClick={() => setItemFilter(f)}>{f}</div>
        ))}
        <input
          placeholder="이름 / 전화번호 검색"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ marginLeft: 'auto', width: 200, padding: '5px 10px', border: `1px solid ${theme.borderDark}`, borderRadius: 6, fontSize: 12, outline: 'none' }}
        />
      </div>

      {/* Table */}
      <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
        <table style={{ ...tableStyles.table, fontSize: 11, minWidth: 900, marginBottom: 0 }}>
          <thead>
            <tr>
              <th style={tableStyles.th}>이름</th>
              <th style={tableStyles.th}>전화번호</th>
              <th style={tableStyles.th}>항목</th>
              <th style={tableStyles.th}>상품</th>
              <th style={tableStyles.th}>종료일</th>
              <th style={tableStyles.th}>D-day</th>
              <th style={tableStyles.th}>앱알림</th>
              <th style={tableStyles.th}>CRM 전달</th>
              <th style={tableStyles.th}>담당</th>
              <th style={tableStyles.th}>상태</th>
              <th style={tableStyles.th}>관리</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => {
              const [name, phone, item, product, date, dday, appAlarm, crm, manager, status] = r;
              const ddayNum = parseInt(dday.replace('D-', ''));
              const ddayClass = ddayNum <= 7 ? 'red' : ddayNum <= 30 ? 'orange' : 'blue';
              return (
                <tr key={i}>
                  <td style={{ ...tableStyles.td, fontWeight: 600, color: theme.blue, cursor: 'pointer', textDecoration: 'underline' }}>{name}</td>
                  <td style={{ ...tableStyles.td, fontSize: 10 }}>{phone}</td>
                  <td style={tableStyles.td}><span style={statusStyle(itemColors[item])}>{item}</span></td>
                  <td style={{ ...tableStyles.td, fontSize: 10 }}>{product}</td>
                  <td style={{ ...tableStyles.td, fontSize: 10 }}>{date}</td>
                  <td style={tableStyles.td}><span style={{ ...statusStyle(ddayClass), fontWeight: 700 }}>{dday}</span></td>
                  <td style={tableStyles.td}><span style={statusStyle(appAlarm === '발송완료' ? 'green' : 'gray')}>{appAlarm}</span></td>
                  <td style={tableStyles.td}><span style={statusStyle(crm === '전달완료' ? 'green' : 'orange')}>{crm}</span></td>
                  <td style={{ ...tableStyles.td, fontSize: 10, color: manager === '미배정' ? theme.red : theme.textSecondary, fontWeight: manager === '미배정' ? 600 : 400 }}>{manager}</td>
                  <td style={tableStyles.td}>
                    {status !== '-'
                      ? <span style={statusStyle(status === '상담중' ? 'orange' : status === '재계약완료' ? 'green' : 'gray')}>{status}</span>
                      : '-'
                    }
                  </td>
                  <td style={{ ...tableStyles.td, whiteSpace: 'nowrap' }}>
                    {status === '상담중' && (
                      <span style={{ ...button.success, fontSize: 10, padding: '3px 8px', cursor: 'pointer', marginRight: 4 }}>재계약완료</span>
                    )}
                    <span style={{ ...button.secondary, fontSize: 10, padding: '3px 8px', cursor: 'pointer' }}>상세</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
