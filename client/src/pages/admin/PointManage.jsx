import { useState } from 'react';
import { theme, statusStyle, tableStyles, card, button, filterBtn, kpiCard } from '../../styles/admin-theme.js';

const withdrawData = [
  ['2026.04.06','홍길동','010-1234-5678','셀프신청','52,000P','52,000P','인증완료','국민 123-456-789012','3회','충족','출금 대기'],
  ['2026.04.05','김철수','010-2345-6789','티켓','75,000P','75,000P','인증완료','신한 110-456-789012','1회','충족','출금 대기'],
  ['2026.04.04','강민준','010-0123-4567','셀프신청','50,000P','50,000P','인증완료','우리 1002-123-456789','2회','충족','승인완료'],
  ['2026.04.03','윤서연','010-8901-2345','티켓','45,000P','45,000P','인증완료','카카오뱅크 3333-01-1234','0회','미충족','반려'],
];

const historyData = [
  ['2026.04.06 14:23','홍길동','010-1234-5678','셀프신청','적립','친구초대 계약완료 — 이영희 / LG U+ 500M+프리미엄+UHD4 (LG0079)','+5,000P','52,000P'],
  ['2026.04.05 13:55','김철수','010-2345-6789','티켓','적립','본인 계약완료 — KT 1G+지니TV모든G+기가지니3 (KT0311)','+5,000P','75,000P'],
  ['2026.04.04 10:00','강민준','010-0123-4567','셀프신청','출금','포인트 출금 → 우리은행 1002-123-456789','-50,000P','0P'],
  ['2026.04.03 16:20','강민준','010-0123-4567','셀프신청','적립','친구초대 가입 — 한지민 (010-7890-****)','+5,000P','50,000P'],
  ['2026.04.01 09:00','홍길동','010-1234-5678','셀프신청','적립','회원가입 포인트','+5,000P','47,000P'],
  ['2026.03.30 11:30','김철수','010-2345-6789','티켓','적립','회원가입 포인트','+5,000P','70,000P'],
];

const statusFilters = ['전체', '출금 대기', '승인완료', '반려'];

export default function PointManage() {
  const [statusFilter, setStatusFilter] = useState('전체');
  const [search, setSearch] = useState('');

  const filteredWithdraw = withdrawData.filter(r => {
    if (statusFilter !== '전체' && r[10] !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!r[1].toLowerCase().includes(s) && !r[2].includes(s)) return false;
    }
    return true;
  });

  return (
    <div>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 14 }}>
        <div style={kpiCard}><div style={{ fontSize: 22, fontWeight: 900, color: theme.orange }}>12</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>출금 대기</div></div>
        <div style={kpiCard}><div style={{ fontSize: 22, fontWeight: 900, color: theme.green }}>1,250,000P</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>이번달 출금</div></div>
        <div style={kpiCard}><div style={{ fontSize: 22, fontWeight: 900, color: theme.navy }}>4,280,000P</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>이번달 발행</div></div>
        <div style={kpiCard}><div style={{ fontSize: 22, fontWeight: 900, color: theme.red }}>3</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>반려</div></div>
        <div style={kpiCard}><div style={{ fontSize: 22, fontWeight: 900, color: theme.textMuted }}>35,800,000P</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>누적 잔여</div></div>
      </div>

      {/* 적립 정책 */}
      <div style={{ ...card, marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: theme.navy, marginBottom: 8 }}>📋 포인트 적립 정책 (앱회원만)</div>
        <table style={{ ...tableStyles.table, fontSize: 11, marginBottom: 0 }}>
          <thead>
            <tr>
              <th style={tableStyles.th}>적립 조건</th>
              <th style={tableStyles.th}>대상</th>
              <th style={tableStyles.th}>포인트</th>
              <th style={tableStyles.th}>비고</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...tableStyles.td, fontWeight: 600 }}>회원가입</td>
              <td style={tableStyles.td}>본인</td>
              <td style={{ ...tableStyles.td, color: theme.green, fontWeight: 700 }}>5,000P</td>
              <td style={{ ...tableStyles.td, fontSize: 10 }}>마케팅 수신 동의 필수</td>
            </tr>
            <tr>
              <td style={{ ...tableStyles.td, fontWeight: 600 }}>친구초대 가입</td>
              <td style={tableStyles.td}>추천인</td>
              <td style={{ ...tableStyles.td, color: theme.green, fontWeight: 700 }}>3,000P</td>
              <td style={{ ...tableStyles.td, fontSize: 10 }}>친구가 가입 완료 시</td>
            </tr>
            <tr>
              <td style={{ ...tableStyles.td, fontWeight: 600 }}>친구 계약 완료 (추천인)</td>
              <td style={tableStyles.td}>추천인</td>
              <td style={{ ...tableStyles.td, color: theme.green, fontWeight: 700 }}>인터넷 15,000 / 인터넷+TV 20,000 / 렌탈 10,000P</td>
              <td style={{ ...tableStyles.td, fontSize: 10 }}>친구가 계약 완료 시</td>
            </tr>
            <tr>
              <td style={{ ...tableStyles.td, fontWeight: 600 }}>친구 계약 완료 (친구)</td>
              <td style={tableStyles.td}>친구</td>
              <td style={{ ...tableStyles.td, color: theme.green, fontWeight: 700 }}>인터넷 10,000 / 인터넷+TV 15,000 / 렌탈 5,000P</td>
              <td style={{ ...tableStyles.td, fontSize: 10 }}>본인 계약 완료 시 (추천 경유)</td>
            </tr>
            <tr>
              <td style={{ ...tableStyles.td, fontWeight: 600 }}>후기 작성</td>
              <td style={tableStyles.td}>본인</td>
              <td style={{ ...tableStyles.td, color: theme.green, fontWeight: 700 }}>15,000P</td>
              <td style={{ ...tableStyles.td, fontSize: 10 }}>계약 완료 후 후기 작성 시 (상품 무관)</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 출금 조건 */}
      <div style={{ ...card, background: '#dbeafe', borderColor: '#bfdbfe', marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: theme.navy, marginBottom: 6 }}>💰 출금 조건 (4가지 모두 충족 필수)</div>
        <div style={{ display: 'flex', gap: 16, fontSize: 11, color: theme.navy }}>
          <span>① 5만 포인트 이상 보유</span>
          <span>② 계약 1회 이상 완료</span>
          <span>③ PASS 본인인증 완료</span>
          <span>④ 계좌 등록 완료</span>
        </div>
        <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>※ 앱회원만 포인트 적립/출금 가능. 비회원은 포인트 기능 없음.</div>
      </div>

      {/* 필터 */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: theme.textMuted, width: 40 }}>상태</span>
        {statusFilters.map(f => (
          <div key={f} style={filterBtn(statusFilter === f)} onClick={() => setStatusFilter(f)}>{f}</div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 14 }}>
        <input
          placeholder="이름 / 전화번호 검색"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 200, padding: '5px 10px', border: `1px solid ${theme.borderDark}`, borderRadius: 6, fontSize: 12, outline: 'none' }}
        />
        <span style={{ ...button.secondary, fontSize: 11, cursor: 'pointer', marginLeft: 'auto' }}>📥 엑셀 다운로드</span>
      </div>

      {/* 출금 신청 목록 */}
      <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 10 }}>출금 신청 목록</div>
      <div style={{ ...card, padding: 0, overflowX: 'auto', marginBottom: 16 }}>
        <table style={{ ...tableStyles.table, fontSize: 11, minWidth: 1000, marginBottom: 0 }}>
          <thead>
            <tr>
              <th style={tableStyles.th}>신청일</th>
              <th style={tableStyles.th}>이름</th>
              <th style={tableStyles.th}>연락처</th>
              <th style={tableStyles.th}>유입경로</th>
              <th style={tableStyles.th}>신청 포인트</th>
              <th style={tableStyles.th}>보유 포인트</th>
              <th style={tableStyles.th}>본인인증</th>
              <th style={tableStyles.th}>계좌</th>
              <th style={tableStyles.th}>계약횟수</th>
              <th style={tableStyles.th}>조건</th>
              <th style={tableStyles.th}>상태</th>
              <th style={tableStyles.th}>관리</th>
            </tr>
          </thead>
          <tbody>
            {filteredWithdraw.map((r, i) => {
              const [date, name, phone, channel, reqPt, holdPt, auth, account, contract, cond, status] = r;
              const stClass = status === '출금 대기' ? 'orange' : status === '승인완료' ? 'green' : 'red';
              const condClass = cond === '충족' ? 'green' : 'red';
              return (
                <tr key={i}>
                  <td style={{ ...tableStyles.td, fontSize: 10 }}>{date}</td>
                  <td style={{ ...tableStyles.td, fontWeight: 600, color: theme.blue, cursor: 'pointer', textDecoration: 'underline' }}>{name}</td>
                  <td style={{ ...tableStyles.td, fontSize: 10 }}>{phone}</td>
                  <td style={{ ...tableStyles.td, fontSize: 10 }}>{channel}</td>
                  <td style={{ ...tableStyles.td, fontWeight: 700, color: theme.orange }}>{reqPt}</td>
                  <td style={{ ...tableStyles.td, fontSize: 10 }}>{holdPt}</td>
                  <td style={tableStyles.td}><span style={{ ...statusStyle(auth === '인증완료' ? 'green' : 'red'), fontSize: 10 }}>{auth}</span></td>
                  <td style={{ ...tableStyles.td, fontSize: 10 }}>{account}</td>
                  <td style={{ ...tableStyles.td, fontSize: 10 }}>{contract}</td>
                  <td style={tableStyles.td}><span style={statusStyle(condClass)}>{cond}</span></td>
                  <td style={tableStyles.td}><span style={statusStyle(stClass)}>{status}</span></td>
                  <td style={{ ...tableStyles.td, whiteSpace: 'nowrap' }}>
                    {status === '출금 대기' && cond === '충족' && (
                      <>
                        <span style={{ ...button.success, fontSize: 10, padding: '3px 8px', cursor: 'pointer' }}>승인</span>
                        <span style={{ ...button.danger, fontSize: 10, padding: '3px 8px', cursor: 'pointer' }}>반려</span>
                      </>
                    )}
                    {status === '출금 대기' && cond === '미충족' && (
                      <span style={{ ...button.danger, fontSize: 10, padding: '3px 8px', cursor: 'pointer' }}>반려</span>
                    )}
                    {status === '승인완료' && <span style={{ color: theme.green, fontSize: 10 }}>✅ 입금완료</span>}
                    {status === '반려' && <span style={{ color: theme.red, fontSize: 10 }}>❌ 조건미충족</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 포인트 적립 내역 */}
      <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 10 }}>포인트 적립 내역</div>
      <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
        <table style={{ ...tableStyles.table, fontSize: 11, marginBottom: 0 }}>
          <thead>
            <tr>
              <th style={tableStyles.th}>일시</th>
              <th style={tableStyles.th}>이름</th>
              <th style={tableStyles.th}>연락처</th>
              <th style={tableStyles.th}>유입경로</th>
              <th style={tableStyles.th}>구분</th>
              <th style={tableStyles.th}>내용</th>
              <th style={tableStyles.th}>포인트</th>
              <th style={tableStyles.th}>잔액</th>
            </tr>
          </thead>
          <tbody>
            {historyData.map((r, i) => {
              const [time, name, phone, channel, type, desc, pt, balance] = r;
              return (
                <tr key={i}>
                  <td style={{ ...tableStyles.td, fontSize: 10 }}>{time}</td>
                  <td style={{ ...tableStyles.td, fontWeight: 600, color: theme.blue, cursor: 'pointer', textDecoration: 'underline' }}>{name}</td>
                  <td style={{ ...tableStyles.td, fontSize: 10 }}>{phone}</td>
                  <td style={{ ...tableStyles.td, fontSize: 10 }}>{channel}</td>
                  <td style={tableStyles.td}><span style={statusStyle(type === '적립' ? 'green' : 'red')}>{type}</span></td>
                  <td style={{ ...tableStyles.td, fontSize: 10 }}>{desc}</td>
                  <td style={{ ...tableStyles.td, fontWeight: 700, color: pt.startsWith('+') ? theme.green : theme.red }}>{pt}</td>
                  <td style={{ ...tableStyles.td, fontSize: 10, color: theme.textMuted }}>{balance}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
