import { useState } from 'react';
import { theme, statusStyle, tableStyles, card, button, filterBtn, kpiCard } from '../../styles/admin-theme.js';

const mockData = [
  ['홍길동','010-1234-5678','앱회원','셀프신청','KT0311','KT 1G+지니TV모든G+기가지니3','45만','2026.04.03','인증완료','국민 123-456-789012','지급 대기'],
  ['김철수','010-2345-6789','앱회원','티켓','SK0188','SKT 500M+Btv이코노미+AI NUGU','43만','2026.04.05','인증완료','신한 110-456-789012','지급 대기'],
  ['이영희','010-3456-7890','비회원','셀프신청','LG0079','LG U+ 500M+프리미엄+UHD4','47만','2026.03.15','미인증','미등록','비회원 대기'],
  ['정수민','010-6789-0123','앱회원','셀프신청','R015','LG 퓨리케어 공기청정기 28평','15만','2026.04.06','인증완료','카카오뱅크 3333-01-1234567','지급 대기'],
  ['박민수','010-4567-8901','비회원','CRM등록','-','KT 인터넷+TV (미정)','37만','2026.03.05','미인증','미등록','비회원 대기'],
  ['임도현','010-9012-3456','비회원','CRM등록','-','코웨이 아이콘3 정수기','반값할인','2026.04.01','미인증','미등록','비회원 대기'],
  ['강민준','010-0123-4567','앱회원','셀프신청','KT0146','KT 500M+지니TV베이직+기가지니A','45만','2026.03.20','인증완료','우리 1002-123-456789','지급 완료'],
  ['한지민','010-7890-1234','비회원','CRM등록','-','LG U+ 인터넷+TV','40만','2026.03.25','미인증','미등록','지급 보류'],
];

const statusColors = { '지급 대기': 'orange', '비회원 대기': 'red', '지급 완료': 'green', '지급 보류': 'gray' };
const typeColors = { '앱회원': 'green', '비회원': 'orange' };
const authColors = { '인증완료': 'green', '미인증': 'red' };

const statusFilters = ['전체', '지급 대기', '비회원 대기', '지급 완료', '지급 보류'];
const typeFilters = ['전체', '앱회원', '비회원'];

export default function GiftManage() {
  const [statusFilter, setStatusFilter] = useState('전체');
  const [typeFilter, setTypeFilter] = useState('전체');
  const [search, setSearch] = useState('');

  const filtered = mockData.filter(r => {
    if (statusFilter !== '전체' && r[10] !== statusFilter) return false;
    if (typeFilter !== '전체' && r[2] !== typeFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!r[0].toLowerCase().includes(s) && !r[1].includes(s) && !r[4].toLowerCase().includes(s)) return false;
    }
    return true;
  });

  return (
    <div>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 14 }}>
        <div style={kpiCard}><div style={{ fontSize: 22, fontWeight: 900, color: theme.orange }}>47</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>지급 대기</div></div>
        <div style={kpiCard}><div style={{ fontSize: 22, fontWeight: 900, color: theme.red }}>23</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>비회원 대기</div></div>
        <div style={kpiCard}><div style={{ fontSize: 22, fontWeight: 900, color: theme.green }}>1,823</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>지급 완료</div></div>
        <div style={kpiCard}><div style={{ fontSize: 22, fontWeight: 900, color: theme.textMuted }}>8</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>지급 보류</div></div>
        <div style={kpiCard}><div style={{ fontSize: 22, fontWeight: 900, color: theme.navy }}>1,901</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>전체</div></div>
      </div>

      {/* 비회원 가입 유도 알림톡 자동 발송 */}
      <div style={{ ...card, background: '#dbeafe', borderColor: '#bfdbfe', marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: theme.navy, marginBottom: 8 }}>📱 비회원 가입 유도 알림톡 자동 발송 (3단계)</div>
        <table style={{ ...tableStyles.table, fontSize: 11, marginBottom: 0 }}>
          <thead>
            <tr>
              <th style={tableStyles.th}>발송 시점</th>
              <th style={tableStyles.th}>내용</th>
              <th style={tableStyles.th}>상태</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tableStyles.td}>1차: 신청 완료 즉시</td>
              <td style={tableStyles.td}>"앱 가입 + 계좌 등록 시 사은품 즉시 지급"</td>
              <td style={tableStyles.td}><span style={statusStyle('blue')}>자동</span></td>
            </tr>
            <tr>
              <td style={tableStyles.td}>2차: 계약 완료 시</td>
              <td style={tableStyles.td}>"사은품 OO만원 준비됨 → 앱 가입 → PASS 인증 → 계좌 등록 → 즉시 입금"</td>
              <td style={tableStyles.td}><span style={statusStyle('blue')}>자동</span></td>
            </tr>
            <tr>
              <td style={tableStyles.td}>3차: D+7 (미가입 시)</td>
              <td style={tableStyles.td}>"사은품이 아직 대기 중이에요 → 계좌 등록 즉시 입금"</td>
              <td style={tableStyles.td}><span style={statusStyle('orange')}>자동</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Filter: 상태 */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: theme.textMuted, width: 40 }}>상태</span>
        {statusFilters.map(f => (
          <div
            key={f}
            style={{
              ...filterBtn(statusFilter === f),
              ...(f === '비회원 대기' && statusFilter !== f ? { borderColor: theme.orange, color: theme.orange } : {}),
            }}
            onClick={() => setStatusFilter(f)}
          >
            {f}
          </div>
        ))}
      </div>

      {/* Filter: 유형 + 검색 + 액션 */}
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
        <span style={{ ...button.secondary, fontSize: 11, cursor: 'pointer' }}>📥 엑셀 다운로드</span>
        <span style={{ ...button.primary, fontSize: 11, cursor: 'pointer' }}>일괄 지급처리</span>
      </div>

      {/* Table */}
      <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
        <table style={{ ...tableStyles.table, fontSize: 11, minWidth: 1100, marginBottom: 0 }}>
          <thead>
            <tr>
              <th style={tableStyles.th}><input type="checkbox" /></th>
              <th style={tableStyles.th}>이름</th>
              <th style={tableStyles.th}>연락처</th>
              <th style={tableStyles.th}>유형</th>
              <th style={tableStyles.th}>유입경로</th>
              <th style={tableStyles.th}>티켓번호</th>
              <th style={tableStyles.th}>상품</th>
              <th style={tableStyles.th}>사은품(현금)</th>
              <th style={tableStyles.th}>계약완료일</th>
              <th style={tableStyles.th}>본인인증</th>
              <th style={tableStyles.th}>계좌</th>
              <th style={tableStyles.th}>상태</th>
              <th style={tableStyles.th}>관리</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => {
              const [name, phone, type, channel, ticket, product, amount, contractDate, auth, account, status] = r;
              return (
                <tr key={i}>
                  <td style={tableStyles.td}><input type="checkbox" /></td>
                  <td style={{ ...tableStyles.td, fontWeight: 600, color: theme.blue, cursor: 'pointer', textDecoration: 'underline' }}>{name}</td>
                  <td style={{ ...tableStyles.td, fontSize: 10 }}>{phone}</td>
                  <td style={tableStyles.td}><span style={{ ...statusStyle(typeColors[type]), fontSize: 10 }}>{type}</span></td>
                  <td style={{ ...tableStyles.td, fontSize: 10 }}>{channel}</td>
                  <td style={tableStyles.td}>
                    {ticket !== '-'
                      ? <span style={{ fontFamily: 'monospace', fontWeight: 700, color: theme.blue, fontSize: 10 }}>{ticket}</span>
                      : <span style={{ color: theme.textMuted, fontSize: 10 }}>-</span>
                    }
                  </td>
                  <td style={{ ...tableStyles.td, fontSize: 10, maxWidth: 160 }}>{product}</td>
                  <td style={{ ...tableStyles.td, fontWeight: 900, color: theme.orange }}>{amount}</td>
                  <td style={{ ...tableStyles.td, fontSize: 10 }}>{contractDate}</td>
                  <td style={tableStyles.td}><span style={{ ...statusStyle(authColors[auth]), fontSize: 10 }}>{auth}</span></td>
                  <td style={{ ...tableStyles.td, fontSize: 10, color: account === '미등록' ? theme.red : theme.textSecondary }}>{account}</td>
                  <td style={tableStyles.td}><span style={statusStyle(statusColors[status])}>{status}</span></td>
                  <td style={{ ...tableStyles.td, whiteSpace: 'nowrap' }}>
                    <span style={{ ...button.secondary, fontSize: 10, padding: '3px 8px', cursor: 'pointer', marginRight: 4 }}>상세</span>
                    {status === '비회원 대기' && <span style={{ ...button.primary, fontSize: 10, padding: '3px 8px', cursor: 'pointer' }}>알림톡</span>}
                    {status === '지급 대기' && (
                      <>
                        <span style={{ ...button.success, fontSize: 10, padding: '3px 8px', cursor: 'pointer' }}>지급</span>
                        <span style={{ ...button.danger, fontSize: 10, padding: '3px 8px', cursor: 'pointer' }}>보류</span>
                      </>
                    )}
                    {status === '지급 보류' && (
                      <>
                        <span style={{ ...button.success, fontSize: 10, padding: '3px 8px', cursor: 'pointer' }}>지급</span>
                        <span style={{ ...button.primary, fontSize: 10, padding: '3px 8px', cursor: 'pointer' }}>알림톡</span>
                      </>
                    )}
                    {status === '지급 완료' && <span style={{ color: theme.green, fontSize: 10 }}>✅</span>}
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
