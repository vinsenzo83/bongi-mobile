import { useState } from 'react';
import { theme, card, button, statusStyle, kpiCard, tableStyles } from '../../styles/admin-theme.js';

const filterBtn = (active) => ({
  padding: '5px 12px',
  border: `1px solid ${active ? theme.navy : theme.borderDark}`,
  borderRadius: 6,
  fontSize: 11,
  color: active ? '#fff' : theme.textSecondary,
  background: active ? theme.navy : '#fff',
  cursor: 'pointer',
  fontWeight: active ? 600 : 400,
  fontFamily: theme.sans,
});

const MEMBERS = [
  { id: 1, name: '홍길동', phone: '010-1234-5678', type: '앱회원', source: '직접가입', social: '카카오', carrier: 'SKT', auth: '인증완료', account: '국민은행 123-456', accountBank: '국민은행', accountNum: '123-456-789012', accountHolder: '홍길동', address: '서울 강남구 테헤란로 123', joinDate: '2024-12-01', apps: 2, points: 15000, birth: '1990-05-15', gender: '남', addresses: [{ label: '자택', addr: '서울 강남구 테헤란로 123' }, { label: '직장', addr: '서울 서초구 반포대로 45' }], contracts: [{ date: '2025-01-10', type: '번호이동', product: '5G 다이렉트 49', status: '계약완료' }], gifts: [{ date: '2025-01-12', item: '스타벅스 아메리카노', status: '지급완료' }], pointHistory: [{ date: '2025-03-01', desc: '친구초대 보너스', amount: '+5,000' }, { date: '2025-02-15', desc: '출금', amount: '-10,000' }], referrals: [{ name: '김민호', date: '2025-02-20', status: '가입완료' }], donjikimi: { carrier: 'SKT', plan: '5G 다이렉트 49', remain: '23개월', penalty: '120,000원' } },
  { id: 2, name: '김철수', phone: '010-2345-6789', type: '앱회원', source: '친구초대', social: '네이버', carrier: 'KT', auth: '인증완료', account: '신한은행 987-654', accountBank: '신한은행', accountNum: '987-654-321098', accountHolder: '김철수', address: '서울 마포구 월드컵로 200', joinDate: '2025-01-15', apps: 1, points: 8000, birth: '1985-11-22', gender: '남', addresses: [{ label: '자택', addr: '서울 마포구 월드컵로 200' }], contracts: [{ date: '2025-02-05', type: '기변', product: 'LTE 세이브 34', status: '상담중' }], gifts: [], pointHistory: [{ date: '2025-03-10', desc: '가입 축하 포인트', amount: '+3,000' }], referrals: [], donjikimi: null },
  { id: 3, name: '이영희', phone: '010-3456-7890', type: '비회원', source: 'CRM등록', social: '-', carrier: 'LG U+', auth: '미완료', account: null, accountBank: null, accountNum: null, accountHolder: null, address: '경기 성남시 분당구 판교로 100', joinDate: '2025-02-20', apps: 1, points: 0, birth: '1992-08-03', gender: '여', addresses: [{ label: '자택', addr: '경기 성남시 분당구 판교로 100' }], contracts: [{ date: '2025-03-01', type: '신규', product: '5G 슬림 39', status: '계약완료' }], gifts: [{ date: '2025-03-03', item: 'CU 5000원 쿠폰', status: '발송완료' }], pointHistory: [], referrals: [], donjikimi: null },
  { id: 4, name: '박민수', phone: '010-4567-8901', type: 'CRM등록', source: '티켓', social: '-', carrier: 'SKT', auth: '미완료', account: null, accountBank: null, accountNum: null, accountHolder: null, address: '부산 해운대구 해운대로 500', joinDate: '2025-03-01', apps: 0, points: 0, birth: '1988-03-20', gender: '남', addresses: [{ label: '자택', addr: '부산 해운대구 해운대로 500' }], contracts: [], gifts: [], pointHistory: [], referrals: [], donjikimi: null },
  { id: 5, name: '최지은', phone: '010-5678-9012', type: '앱회원', source: '직접가입', social: '카카오', carrier: 'KT', auth: '인증완료', account: '우리은행 111-222', accountBank: '우리은행', accountNum: '111-222-333444', accountHolder: '최지은', address: '서울 송파구 올림픽로 300', joinDate: '2025-01-20', apps: 3, points: 22000, birth: '1995-07-10', gender: '여', addresses: [{ label: '자택', addr: '서울 송파구 올림픽로 300' }], contracts: [{ date: '2025-02-15', type: '번호이동', product: '5G 프리미엄 69', status: '신청완료' }], gifts: [{ date: '2025-02-17', item: '배달의민족 1만원 쿠폰', status: '지급완료' }], pointHistory: [{ date: '2025-03-05', desc: '리뷰 작성 보너스', amount: '+2,000' }], referrals: [{ name: '박소연', date: '2025-01-25', status: '가입완료' }, { name: '이준혁', date: '2025-02-10', status: '가입완료' }], donjikimi: { carrier: 'KT', plan: '5G 프리미엄 69', remain: '11개월', penalty: '80,000원' } },
  { id: 6, name: '정수민', phone: '010-6789-0123', type: '비회원', source: '셀프신청', social: '-', carrier: 'SKT', auth: '미완료', account: null, accountBank: null, accountNum: null, accountHolder: null, address: '대구 수성구 범어로 88', joinDate: '2025-03-15', apps: 1, points: 0, birth: '1998-01-30', gender: '여', addresses: [{ label: '자택', addr: '대구 수성구 범어로 88' }], contracts: [{ date: '2025-03-18', type: '번호이동', product: 'LTE 다이렉트 29', status: '상담중' }], gifts: [], pointHistory: [], referrals: [], donjikimi: null },
  { id: 7, name: '한지민', phone: '010-7890-1234', type: '앱회원', source: '직접가입', social: '구글', carrier: 'LG U+', auth: '인증완료', account: '하나은행 555-666', accountBank: '하나은행', accountNum: '555-666-777888', accountHolder: '한지민', address: '인천 연수구 송도대로 250', joinDate: '2024-11-10', apps: 2, points: 31000, birth: '1993-12-05', gender: '여', addresses: [{ label: '자택', addr: '인천 연수구 송도대로 250' }, { label: '직장', addr: '서울 영등포구 여의대로 108' }], contracts: [{ date: '2024-12-20', type: '기변', product: '5G 다이렉트 49', status: '계약완료' }, { date: '2025-03-10', type: '번호이동', product: '5G 슬림 39', status: '신청완료' }], gifts: [{ date: '2024-12-22', item: '스타벅스 아메리카노', status: '지급완료' }], pointHistory: [{ date: '2025-01-01', desc: '친구초대 보너스', amount: '+5,000' }, { date: '2025-02-01', desc: '리뷰 작성 보너스', amount: '+2,000' }, { date: '2025-03-01', desc: '출금', amount: '-5,000' }], referrals: [{ name: '조은서', date: '2025-01-05', status: '가입완료' }], donjikimi: { carrier: 'LG U+', plan: '5G 슬림 39', remain: '2개월', penalty: '45,000원' } },
  { id: 8, name: '윤서연', phone: '010-8901-2345', type: '중고폰', source: '직접가입', social: '카카오', carrier: 'SKT', auth: '인증완료', account: '카카오뱅크 3333-01', accountBank: '카카오뱅크', accountNum: '3333-01-1234567', accountHolder: '윤서연', address: '서울 강서구 화곡로 77', joinDate: '2025-02-01', apps: 1, points: 5000, birth: '2000-04-18', gender: '여', addresses: [{ label: '자택', addr: '서울 강서구 화곡로 77' }], contracts: [], gifts: [], pointHistory: [{ date: '2025-02-05', desc: '중고폰 매입 보너스', amount: '+5,000' }], referrals: [], donjikimi: null },
  { id: 9, name: '임도현', phone: '010-9012-3456', type: '앱회원', source: '친구초대', social: '네이버', carrier: 'KT', auth: '인증완료', account: '토스뱅크 1000-01', accountBank: '토스뱅크', accountNum: '1000-01-9876543', accountHolder: '임도현', address: '경기 용인시 수지구 성복로 50', joinDate: '2025-03-05', apps: 0, points: 3000, birth: '1997-09-25', gender: '남', addresses: [{ label: '자택', addr: '경기 용인시 수지구 성복로 50' }], contracts: [], gifts: [], pointHistory: [{ date: '2025-03-05', desc: '가입 축하 포인트', amount: '+3,000' }], referrals: [], donjikimi: null },
  { id: 10, name: '강민준', phone: '010-0123-4567', type: 'CRM등록', source: 'CRM등록', social: '-', carrier: 'LG U+', auth: '미완료', account: null, accountBank: null, accountNum: null, accountHolder: null, address: '광주 서구 상무대로 60', joinDate: '2025-03-20', apps: 0, points: 0, birth: '1991-06-12', gender: '남', addresses: [{ label: '자택', addr: '광주 서구 상무대로 60' }], contracts: [{ date: '2025-03-22', type: '신규', product: 'LTE 세이브 34', status: '상담중' }], gifts: [], pointHistory: [], referrals: [], donjikimi: null },
  { id: 11, name: '권홍석', phone: '010-1111-2222', type: '비회원', source: '셀프신청', social: '-', carrier: 'SKT', auth: '미완료', account: null, accountBank: null, accountNum: null, accountHolder: null, address: '제주 제주시 연동 1234', joinDate: '2025-04-01', apps: 1, points: 0, birth: '1986-02-28', gender: '남', addresses: [{ label: '자택', addr: '제주 제주시 연동 1234' }], contracts: [{ date: '2025-04-02', type: '번호이동', product: '5G 다이렉트 49', status: '신청완료' }], gifts: [], pointHistory: [], referrals: [], donjikimi: null },
];

const typeMap = { '앱회원': 'green', '비회원': 'orange', 'CRM등록': 'orange', '중고폰': 'navy' };
const authMap = { '인증완료': 'green', '미완료': 'red' };
const statusMap = { '신청완료': 'blue', '상담중': 'orange', '계약완료': 'green', '취소': 'red' };

export default function Members() {
  const [typeFilter, setTypeFilter] = useState('전체');
  const [authFilter, setAuthFilter] = useState('전체');
  const [accountFilter, setAccountFilter] = useState('전체');
  const [search, setSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);

  const typeOptions = ['전체', '앱회원', '비회원', 'CRM등록', '중고폰'];
  const authOptions = ['전체', '인증완료', '미완료'];
  const accountOptions = ['전체', '등록', '미등록'];

  const filtered = MEMBERS.filter(m => {
    if (typeFilter !== '전체' && m.type !== typeFilter) return false;
    if (authFilter !== '전체' && m.auth !== authFilter) return false;
    if (accountFilter === '등록' && !m.account) return false;
    if (accountFilter === '미등록' && m.account) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!m.name.includes(q) && !m.phone.includes(q)) return false;
    }
    return true;
  });

  return (
    <div style={{ padding: 24, fontFamily: theme.sans, background: theme.bg, minHeight: '100vh' }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: theme.text, marginBottom: 20 }}>회원 관리</h1>

      {/* Filters */}
      <div style={{ ...card, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Type filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: theme.textSecondary, minWidth: 40 }}>유형</span>
          {typeOptions.map(o => (
            <button key={o} style={filterBtn(typeFilter === o)} onClick={() => setTypeFilter(o)}>{o}</button>
          ))}
        </div>
        {/* Auth filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: theme.textSecondary, minWidth: 40 }}>인증</span>
          {authOptions.map(o => (
            <button key={o} style={filterBtn(authFilter === o)} onClick={() => setAuthFilter(o)}>{o}</button>
          ))}
        </div>
        {/* Account filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: theme.textSecondary, minWidth: 40 }}>계좌</span>
          {accountOptions.map(o => (
            <button key={o} style={filterBtn(accountFilter === o)} onClick={() => setAccountFilter(o)}>{o}</button>
          ))}
        </div>
        {/* Search */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="이름 또는 전화번호 검색"
            style={{
              flex: 1, padding: '8px 12px', border: `1.5px solid ${theme.borderDark}`,
              borderRadius: 6, fontSize: 12, outline: 'none', fontFamily: theme.sans,
              background: theme.bgInput,
            }}
          />
          <button style={button.primary} onClick={() => {}}>검색</button>
        </div>
      </div>

      {/* Member Count */}
      <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 8 }}>
        총 <strong style={{ color: theme.text }}>{filtered.length}</strong>명
      </div>

      {/* Table */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyles.table}>
            <thead>
              <tr>
                {['이름', '전화번호', '유형', '유입경로', '소셜', '통신사', '인증', '계좌', '주소', '가입일', '신청', '포인트'].map(h => (
                  <th key={h} style={tableStyles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => (
                <tr
                  key={m.id}
                  onClick={() => setSelectedMember(m)}
                  style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = theme.bgHover}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  <td style={{ ...tableStyles.td, fontWeight: 600, color: theme.text }}>{m.name}</td>
                  <td style={tableStyles.td}>{m.phone}</td>
                  <td style={tableStyles.td}><span style={statusStyle(typeMap[m.type] || 'gray')}>{m.type}</span></td>
                  <td style={tableStyles.td}>{m.source}</td>
                  <td style={tableStyles.td}>{m.social}</td>
                  <td style={tableStyles.td}>
                    <span style={{ color: theme.carrier[m.carrier] || theme.text, fontWeight: 600, fontSize: 11 }}>{m.carrier}</span>
                  </td>
                  <td style={tableStyles.td}><span style={statusStyle(authMap[m.auth] || 'gray')}>{m.auth}</span></td>
                  <td style={tableStyles.td}>
                    {m.account
                      ? <span style={statusStyle('green')}>등록</span>
                      : <span style={statusStyle('red')}>미등록</span>
                    }
                  </td>
                  <td style={{ ...tableStyles.td, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.address}</td>
                  <td style={tableStyles.td}>{m.joinDate}</td>
                  <td style={{ ...tableStyles.td, textAlign: 'center' }}>{m.apps}</td>
                  <td style={{ ...tableStyles.td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                    {m.points.toLocaleString()}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={12} style={{ ...tableStyles.td, textAlign: 'center', padding: 32, color: theme.textMuted }}>
                    검색 결과가 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedMember && (
        <MemberDetailModal member={selectedMember} onClose={() => setSelectedMember(null)} />
      )}
    </div>
  );
}

function MemberDetailModal({ member, onClose }) {
  const m = member;

  const sectionTitle = (text) => ({
    fontSize: 14, fontWeight: 700, color: theme.text,
    borderBottom: `2px solid ${theme.navy}`, paddingBottom: 6, marginBottom: 12, marginTop: 20,
  });

  const infoRow = (label, value) => (
    <div key={label} style={{ display: 'flex', padding: '6px 0', borderBottom: `1px solid ${theme.border}` }}>
      <span style={{ width: 100, fontSize: 12, color: theme.textMuted, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: theme.text, fontWeight: 500 }}>{value || '-'}</span>
    </div>
  );

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 14, width: 680, maxHeight: '85vh', overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)', padding: 28, fontFamily: theme.sans,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: theme.text, margin: 0 }}>
            {m.name} <span style={{ ...statusStyle(typeMap[m.type] || 'gray'), marginLeft: 8, fontSize: 11 }}>{m.type}</span>
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: theme.textMuted, padding: 4 }}
          >
            ✕
          </button>
        </div>

        {/* 기본 정보 */}
        <div style={sectionTitle('기본 정보')}>기본 정보</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
          {infoRow('이름', m.name)}
          {infoRow('전화번호', m.phone)}
          {infoRow('생년월일', m.birth)}
          {infoRow('성별', m.gender)}
          {infoRow('통신사', m.carrier)}
          {infoRow('가입일', m.joinDate)}
          {infoRow('포인트 잔액', `${m.points.toLocaleString()}P`)}
          {infoRow('소셜 로그인', m.social)}
        </div>

        {/* 계좌 정보 */}
        <div style={sectionTitle('계좌 정보')}>계좌 정보</div>
        {m.accountBank ? (
          <div>
            {infoRow('은행', m.accountBank)}
            {infoRow('계좌번호', m.accountNum)}
            {infoRow('예금주', m.accountHolder)}
          </div>
        ) : (
          <div style={{
            background: theme.orangeBg, border: `1px solid ${theme.orange}`,
            borderRadius: 8, padding: '10px 16px', fontSize: 12, color: theme.orange, fontWeight: 600,
          }}>
            계좌 미등록 상태입니다
          </div>
        )}

        {/* 주소 목록 */}
        <div style={sectionTitle('주소 목록')}>주소 목록</div>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              <th style={tableStyles.th}>구분</th>
              <th style={tableStyles.th}>주소</th>
            </tr>
          </thead>
          <tbody>
            {m.addresses.map((a, i) => (
              <tr key={i}>
                <td style={{ ...tableStyles.td, fontWeight: 600 }}>{a.label}</td>
                <td style={tableStyles.td}>{a.addr}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 신청/계약 이력 */}
        <div style={sectionTitle('신청/계약 이력')}>신청/계약 이력</div>
        {m.contracts.length > 0 ? (
          <table style={tableStyles.table}>
            <thead>
              <tr>
                <th style={tableStyles.th}>일자</th>
                <th style={tableStyles.th}>유형</th>
                <th style={tableStyles.th}>상품</th>
                <th style={tableStyles.th}>상태</th>
              </tr>
            </thead>
            <tbody>
              {m.contracts.map((c, i) => (
                <tr key={i}>
                  <td style={tableStyles.td}>{c.date}</td>
                  <td style={tableStyles.td}>{c.type}</td>
                  <td style={tableStyles.td}>{c.product}</td>
                  <td style={tableStyles.td}><span style={statusStyle(statusMap[c.status] || 'gray')}>{c.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ fontSize: 12, color: theme.textMuted, padding: '8px 0' }}>이력 없음</div>
        )}

        {/* 사은품 내역 */}
        <div style={sectionTitle('사은품 내역')}>사은품 내역</div>
        {m.gifts.length > 0 ? (
          <table style={tableStyles.table}>
            <thead>
              <tr>
                <th style={tableStyles.th}>일자</th>
                <th style={tableStyles.th}>사은품</th>
                <th style={tableStyles.th}>상태</th>
              </tr>
            </thead>
            <tbody>
              {m.gifts.map((g, i) => (
                <tr key={i}>
                  <td style={tableStyles.td}>{g.date}</td>
                  <td style={tableStyles.td}>{g.item}</td>
                  <td style={tableStyles.td}><span style={statusStyle('green')}>{g.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ fontSize: 12, color: theme.textMuted, padding: '8px 0' }}>내역 없음</div>
        )}

        {/* 포인트 내역 */}
        <div style={sectionTitle('포인트 내역')}>포인트 내역</div>
        {m.pointHistory.length > 0 ? (
          <table style={tableStyles.table}>
            <thead>
              <tr>
                <th style={tableStyles.th}>일자</th>
                <th style={tableStyles.th}>내용</th>
                <th style={tableStyles.th}>금액</th>
              </tr>
            </thead>
            <tbody>
              {m.pointHistory.map((p, i) => (
                <tr key={i}>
                  <td style={tableStyles.td}>{p.date}</td>
                  <td style={tableStyles.td}>{p.desc}</td>
                  <td style={{
                    ...tableStyles.td, fontWeight: 700, fontFamily: 'monospace',
                    color: p.amount.startsWith('+') ? theme.green : theme.red,
                  }}>
                    {p.amount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ fontSize: 12, color: theme.textMuted, padding: '8px 0' }}>내역 없음</div>
        )}

        {/* 친구초대 */}
        <div style={sectionTitle('친구초대')}>친구초대</div>
        {m.referrals.length > 0 ? (
          <table style={tableStyles.table}>
            <thead>
              <tr>
                <th style={tableStyles.th}>이름</th>
                <th style={tableStyles.th}>초대일</th>
                <th style={tableStyles.th}>상태</th>
              </tr>
            </thead>
            <tbody>
              {m.referrals.map((r, i) => (
                <tr key={i}>
                  <td style={{ ...tableStyles.td, fontWeight: 600 }}>{r.name}</td>
                  <td style={tableStyles.td}>{r.date}</td>
                  <td style={tableStyles.td}><span style={statusStyle('green')}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ fontSize: 12, color: theme.textMuted, padding: '8px 0' }}>초대 내역 없음</div>
        )}

        {/* 돈지키미 */}
        <div style={sectionTitle('돈지키미')}>돈지키미</div>
        {m.donjikimi ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
            {(() => {
              const d = m.donjikimi;
              return (
                <>
                  <div style={{ display: 'flex', padding: '6px 0', borderBottom: `1px solid ${theme.border}` }}>
                    <span style={{ width: 100, fontSize: 12, color: theme.textMuted, flexShrink: 0 }}>통신사</span>
                    <span style={{ fontSize: 12, color: theme.carrier[d.carrier] || theme.text, fontWeight: 600 }}>{d.carrier}</span>
                  </div>
                  <div style={{ display: 'flex', padding: '6px 0', borderBottom: `1px solid ${theme.border}` }}>
                    <span style={{ width: 100, fontSize: 12, color: theme.textMuted, flexShrink: 0 }}>요금제</span>
                    <span style={{ fontSize: 12, color: theme.text, fontWeight: 500 }}>{d.plan}</span>
                  </div>
                  <div style={{ display: 'flex', padding: '6px 0', borderBottom: `1px solid ${theme.border}` }}>
                    <span style={{ width: 100, fontSize: 12, color: theme.textMuted, flexShrink: 0 }}>잔여 약정</span>
                    <span style={statusStyle(parseInt(d.remain) <= 3 ? 'red' : 'gray')}>{d.remain}</span>
                  </div>
                  <div style={{ display: 'flex', padding: '6px 0', borderBottom: `1px solid ${theme.border}` }}>
                    <span style={{ width: 100, fontSize: 12, color: theme.textMuted, flexShrink: 0 }}>위약금</span>
                    <span style={{ fontSize: 12, color: theme.red, fontWeight: 700, fontFamily: 'monospace' }}>{d.penalty}</span>
                  </div>
                </>
              );
            })()}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: theme.textMuted, padding: '8px 0' }}>등록된 약정 정보 없음</div>
        )}

        {/* Close button */}
        <div style={{ marginTop: 24, textAlign: 'right' }}>
          <button onClick={onClose} style={button.primary}>닫기</button>
        </div>
      </div>
    </div>
  );
}
