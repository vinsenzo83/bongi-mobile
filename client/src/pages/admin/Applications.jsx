import { useState } from 'react';
import { theme, statusStyle, tableStyles, card, button, filterBtn, kpiCard } from '../../styles/admin-theme.js';

const mockData = [
  ['2026-04-06 14:23','홍길동','010-1234-5678','앱회원','셀프신청','어드민→CRM','SK0188','SKT 500M+Btv이코노미+AI NUGU+WiFi6','43만','신청완료'],
  ['2026-04-06 13:55','김철수','010-2345-6789','앱회원','티켓','어드민→CRM','KT0311','KT 1G+지니TV모든G+기가지니3','45만','상담중'],
  ['2026-04-06 13:12','이영희','010-3456-7890','비회원','셀프신청','어드민→CRM','LG0079','LG U+ 500M+프리미엄+UHD4+기가와이파이6','47만','계약완료'],
  ['2026-04-06 12:40','박민수','010-4567-8901','비회원','CRM등록','CRM→어드민','-','KT 인터넷+TV (미정)','-','상담중'],
  ['2026-04-06 11:30','최지은','010-5678-9012','비회원','CRM등록','CRM→어드민','-','SKT 인터넷 (미정)','-','신청완료'],
  ['2026-04-05 16:20','정수민','010-6789-0123','앱회원','셀프신청','어드민→CRM','R015','LG 퓨리케어 공기청정기 28평','15만','계약완료'],
  ['2026-04-05 15:10','한지민','010-7890-1234','비회원','CRM등록','CRM→어드민','-','LG U+ 인터넷+TV','-','상담중'],
  ['2026-04-05 14:00','윤서연','010-8901-2345','앱회원','티켓','어드민→CRM','SK0398','SKT 1G+Btv올+애플TV+WiFi6','49만','취소'],
  ['2026-04-05 10:30','임도현','010-9012-3456','비회원','CRM등록','CRM→어드민','-','코웨이 아이콘3 정수기','반값할인','계약완료'],
  ['2026-04-04 17:45','강민준','010-0123-4567','앱회원','셀프신청','어드민→CRM','KT0146','KT 500M+지니TV베이직+기가지니A','45만','신청완료'],
];

const statusColors = { '신청완료': 'blue', '상담중': 'orange', '계약완료': 'green', '취소': 'red' };
const typeColors = { '앱회원': 'green', '비회원': 'orange' };
const channelColors = { '셀프신청': 'blue', '티켓': 'navy', 'CRM등록': 'orange' };
const syncColors = { '어드민→CRM': 'blue', 'CRM→어드민': 'green' };

const statusFilters = ['전체', '신청완료', '상담중', '계약완료', '취소'];
const channelFilters = ['전체', '셀프신청', '티켓', 'CRM등록'];
const typeFilters = ['전체', '앱회원', '비회원'];

export default function Applications() {
  const [statusFilter, setStatusFilter] = useState('전체');
  const [channelFilter, setChannelFilter] = useState('전체');
  const [typeFilter, setTypeFilter] = useState('전체');
  const [search, setSearch] = useState('');

  const filtered = mockData.filter(r => {
    if (statusFilter !== '전체' && r[9] !== statusFilter) return false;
    if (channelFilter !== '전체' && r[4] !== channelFilter) return false;
    if (typeFilter !== '전체' && r[3] !== typeFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!r[1].toLowerCase().includes(s) && !r[2].includes(s) && !r[6].toLowerCase().includes(s)) return false;
    }
    return true;
  });

  return (
    <div>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 14 }}>
        <div style={kpiCard}><div style={{ fontSize: 22, fontWeight: 900, color: theme.blue }}>1,204</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>신청완료</div></div>
        <div style={kpiCard}><div style={{ fontSize: 22, fontWeight: 900, color: theme.orange }}>382</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>상담중</div></div>
        <div style={kpiCard}><div style={{ fontSize: 22, fontWeight: 900, color: theme.green }}>2,156</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>계약완료</div></div>
        <div style={kpiCard}><div style={{ fontSize: 22, fontWeight: 900, color: theme.red }}>98</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>취소</div></div>
        <div style={kpiCard}><div style={{ fontSize: 22, fontWeight: 900, color: theme.navy }}>3,840</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>전체</div></div>
      </div>

      {/* Filter: 상태 */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: theme.textMuted, width: 40 }}>상태</span>
        {statusFilters.map(f => (
          <div key={f} style={filterBtn(statusFilter === f)} onClick={() => setStatusFilter(f)}>{f}</div>
        ))}
      </div>

      {/* Filter: 유입경로 */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: theme.textMuted, width: 40 }}>경로</span>
        {channelFilters.map(f => (
          <div key={f} style={filterBtn(channelFilter === f)} onClick={() => setChannelFilter(f)}>{f}</div>
        ))}
      </div>

      {/* Filter: 고객유형 + 검색 */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: theme.textMuted, width: 40 }}>유형</span>
        {typeFilters.map(f => (
          <div key={f} style={filterBtn(typeFilter === f)} onClick={() => setTypeFilter(f)}>{f}</div>
        ))}
        <input
          placeholder="이름 / 전화번호 / 티켓번호 검색"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ marginLeft: 'auto', width: 220, padding: '5px 10px', border: `1px solid ${theme.borderDark}`, borderRadius: 6, fontSize: 12, outline: 'none' }}
        />
      </div>

      {/* Table */}
      <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
        <table style={{ ...tableStyles.table, fontSize: 11, minWidth: 1100, marginBottom: 0 }}>
          <thead>
            <tr>
              <th style={tableStyles.th}>신청일시</th>
              <th style={tableStyles.th}>고객명</th>
              <th style={tableStyles.th}>연락처</th>
              <th style={tableStyles.th}>유형</th>
              <th style={tableStyles.th}>유입경로</th>
              <th style={tableStyles.th}>동기화</th>
              <th style={tableStyles.th}>티켓번호</th>
              <th style={tableStyles.th}>상품</th>
              <th style={tableStyles.th}>사은품</th>
              <th style={tableStyles.th}>상태</th>
              <th style={tableStyles.th}>관리</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => {
              const [time, name, phone, type, channel, sync, ticket, product, gift, status] = r;
              return (
                <tr key={i}>
                  <td style={{ ...tableStyles.td, fontSize: 10 }}>{time}</td>
                  <td style={{ ...tableStyles.td, fontWeight: 600, color: theme.blue, cursor: 'pointer', textDecoration: 'underline' }}>{name}</td>
                  <td style={{ ...tableStyles.td, fontSize: 10 }}>{phone}</td>
                  <td style={tableStyles.td}><span style={{ ...statusStyle(typeColors[type]), fontSize: 10 }}>{type}</span></td>
                  <td style={tableStyles.td}><span style={{ ...statusStyle(channelColors[channel]), fontSize: 10 }}>{channel}</span></td>
                  <td style={tableStyles.td}>
                    <span style={{ fontSize: 10, color: syncColors[sync] === 'blue' ? theme.blue : theme.green, fontWeight: 600 }}>{sync}</span>
                  </td>
                  <td style={tableStyles.td}>
                    {ticket !== '-'
                      ? <span style={{ fontFamily: 'monospace', fontWeight: 700, color: theme.blue, fontSize: 10 }}>{ticket}</span>
                      : <span style={{ color: theme.textMuted, fontSize: 10 }}>-</span>
                    }
                  </td>
                  <td style={{ ...tableStyles.td, fontSize: 10, maxWidth: 180 }}>{product}</td>
                  <td style={{ ...tableStyles.td, color: theme.orange, fontWeight: 700, fontSize: 11 }}>{gift || '-'}</td>
                  <td style={tableStyles.td}><span style={statusStyle(statusColors[status])}>{status}</span></td>
                  <td style={tableStyles.td}>
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
