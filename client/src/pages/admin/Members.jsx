import { useState } from 'react';
import { theme, statusStyle, tableStyles, card, button, filterBtn, kpiCard } from '../../styles/admin-theme.js';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   memberData — wireframe 원본 그대로
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const memberData = [
  { name:'홍길동', phone:'010-1234-5678', type:'앱회원', channel:'셀프신청', social:'카카오', carrier:'KT', verify:'완료', account:'등록', address:'등록', date:'2026.04.01', cnt:'3건', pt:'51,000P',
    birth:'1990.01.01', gender:'남성', authDate:'2026.04.02',
    bank:'국민은행', accountNum:'123-456-789012', holder:'홍길동 ✓',
    addresses:[{alias:'집',addr:'광주시 서구 상무대로 123 아파트 101동 1001호',isDefault:true},{alias:'직장',addr:'광주시 동구 금남로 456 오피스빌딩 5층',isDefault:false}],
    orders:[['2026.04.01','KT0311','KT 1G+지니TV모든G+기가지니3','셀프신청','어드민→CRM','계약완료','45만','김상담','2026.04.03'],['2026.03.10','R015','LG 퓨리케어 공기청정기 28평','셀프신청','어드민→CRM','계약완료','15만','이상담','2026.03.12']],
    gifts:[['KT 인터넷+TV','370,000원','지급완료','2026.04.10','국민은행 123-456-789012'],['LG 정수기 렌탈','150,000원','지급완료','2026.03.20','국민은행 123-456-789012']],
    points:[['2026.04.10','적립','친구초대 계약완료 — 이영희 / LG U+ 인터넷+TV (LG0079)','+20,000P','51,000P'],['2026.03.15','적립','친구초대 가입 — 김철수 (010-2345-****)','+3,000P','31,000P'],['2026.03.10','적립','친구초대 가입 — 박민수 (010-4567-****)','+3,000P','28,000P'],['2026.02.20','적립','후기 작성 — KT 인터넷+TV','+15,000P','25,000P'],['2026.02.01','적립','친구초대 가입 — 이영희 (010-3456-****)','+3,000P','10,000P'],['2026.01.20','적립','친구초대 가입 — 최지은 (010-5678-****)','+3,000P','7,000P'],['2026.01.01','적립','회원가입 포인트','+5,000P','5,000P']],
    withdrawals:[],
    referralBy:'김철수', referralCode:'HONG2026', friends:[['이영희','2026.04.02','완료','+5,000P','+5,000P'],['박민수','2026.03.25','미계약','-','-']],
    guard:[['인터넷 약정','2027.04.03','D-363','ON'],['정수기 렌탈','2029.03.12','D-1071','ON']]
  },
  { name:'김철수', phone:'010-2345-6789', type:'앱회원', channel:'티켓', social:'구글', carrier:'-', verify:'미완료', account:'미등록', address:'미등록', date:'2026.03.15', cnt:'1건', pt:'5,000P',
    birth:null, gender:null, authDate:null,
    bank:null, accountNum:null, holder:null,
    addresses:[],
    orders:[['2026.03.15','SK0188','SKT 500M+Btv이코노미+AI NUGU+WiFi6','티켓','어드민→CRM','상담중','43만','미배정','-']],
    gifts:[],
    points:[['2026.03.15','적립','회원가입 포인트','+5,000P','2,000P']],
    withdrawals:[],
    referralBy:'홍길동', referralCode:'KIM2026', friends:[],
    guard:[]
  },
  { name:'이영희', phone:'010-3456-7890', type:'비회원', channel:'셀프신청', social:'-', carrier:'-', verify:'미완료', account:'미등록', address:'미등록', date:'2026.03.10', cnt:'1건', pt:'0P',
    birth:null, gender:null, authDate:null,
    bank:null, accountNum:null, holder:null,
    addresses:[],
    orders:[['2026.03.10','LG0079','LG U+ 500M+프리미엄+UHD4+기가와이파이6','셀프신청','어드민→CRM','계약완료','47만','김상담','2026.03.15']],
    gifts:[['LG U+ 인터넷+TV','400,000원','지급대기(앱가입필요)','-','계좌 미등록']],
    points:[],
    withdrawals:[],
    referralBy:'홍길동', referralCode:null, friends:[],
    guard:[['인터넷 약정','2029.04.04','D-1094','ON'],['공기청정기 렌탈','2029.03.18','D-1077','ON']]
  },
  { name:'박민수', phone:'010-4567-8901', type:'비회원', channel:'CRM등록', social:'-', carrier:'-', verify:'미완료', account:'미등록', address:'미등록', date:'2026.02.20', cnt:'2건', pt:'0P',
    birth:null, gender:null, authDate:null,
    bank:null, accountNum:null, holder:null,
    addresses:[],
    orders:[['2026.03.01','-','KT 인터넷+TV (미정)','CRM등록','CRM→어드민','계약완료','37만','김상담','2026.03.05']],
    gifts:[['KT 인터넷','250,000원','지급대기','-','계좌 미등록']],
    points:[],
    withdrawals:[],
    referralBy:'홍길동', referralCode:'PARK2026', friends:[],
    guard:[]
  },
  { name:'최지은', phone:'010-5678-9012', type:'앱회원', channel:'CRM등록', social:'카카오', carrier:'LG U+', verify:'완료', account:'등록', address:'미등록', date:'2026.02.01', cnt:'0건', pt:'4,000P',
    birth:'1998.11.22', gender:'여성', authDate:'2026.02.05',
    bank:'카카오뱅크', accountNum:'3333-01-1234567', holder:'최지은 ✓',
    addresses:[],
    orders:[],
    gifts:[],
    points:[['2026.02.01','적립','회원가입 포인트','+5,000P','5,000P'],['2026.03.01','차감','포인트 만료','-1,000P','4,000P']],
    withdrawals:[],
    referralBy:null, referralCode:'CHOI2026', friends:[],
    guard:[]
  },
  { name:'강민준', phone:'010-0123-4567', type:'앱회원', channel:'셀프신청', social:'카카오', carrier:'KT', verify:'완료', account:'등록', address:'등록', date:'2026.01.15', cnt:'2건', pt:'0P',
    birth:'1995.08.20', gender:'남성', authDate:'2026.01.16',
    bank:'우리은행', accountNum:'1002-123-456789', holder:'강민준 ✓',
    addresses:[{alias:'집',addr:'광주시 북구 첨단연신로 261',isDefault:true}],
    orders:[['2026.03.20','KT0146','KT 500M+지니TV베이직+기가지니A','셀프신청','어드민→CRM','계약완료','45만','김상담','2026.03.22']],
    gifts:[['KT 500M+지니TV베이직+기가지니A','450,000원','지급완료','2026.03.25','우리 1002-123-456789']],
    points:[['2026.04.04','출금','포인트 출금 → 우리은행 1002-123-456789','-58,000P','0P'],['2026.03.22','적립','친구 계약완료 (친구) — KT 인터넷+TV (KT0146)','+15,000P','58,000P'],['2026.03.10','적립','친구초대 가입 — 한지민 (010-7890-****)','+3,000P','43,000P'],['2026.02.15','적립','친구초대 계약완료 — 홍길동 / KT 인터넷+TV','+20,000P','40,000P'],['2026.02.10','적립','후기 작성 — KT 인터넷+TV','+15,000P','20,000P'],['2026.01.15','적립','회원가입 포인트','+5,000P','5,000P']],
    withdrawals:[['2026.04.04','50,000P','우리은행 1002-123-456789','승인완료','2026.04.05']],
    referralBy:null, referralCode:'KANG2026', friends:[['한지민','2026.03.10','미계약','-','-']],
    guard:[]
  },
  { name:'윤서연', phone:'010-8901-2345', type:'앱회원', channel:'티켓', social:'구글', carrier:'SKT', verify:'완료', account:'등록', address:'등록', date:'2026.02.10', cnt:'0건', pt:'5,000P',
    birth:'1993.06.10', gender:'여성', authDate:'2026.02.11',
    bank:'카카오뱅크', accountNum:'3333-01-5678901', holder:'윤서연 ✓',
    addresses:[{alias:'집',addr:'광주시 동구 금남로 456',isDefault:true}],
    orders:[['2026.04.05','SK0398','SKT 1G+Btv올+애플TV+WiFi6','티켓','어드민→CRM','취소','-','-','-']],
    gifts:[],
    points:[['2026.02.10','적립','회원가입 포인트','+5,000P','2,000P']],
    withdrawals:[],
    referralBy:null, referralCode:'YOON2026', friends:[],
    guard:[]
  },
  { name:'한지민', phone:'010-7890-1234', type:'비회원', channel:'CRM등록', social:'-', carrier:'-', verify:'미완료', account:'미등록', address:'미등록', date:'2026.03.10', cnt:'0건', pt:'0P',
    birth:null, gender:null, authDate:null,
    bank:null, accountNum:null, holder:null,
    addresses:[],
    orders:[['2026.03.10','-','LG U+ 인터넷+TV','CRM등록','CRM→어드민','상담중','-','이상담','-']],
    gifts:[],
    points:[],
    withdrawals:[],
    referralBy:'강민준', referralCode:null, friends:[],
    guard:[]
  },
  { name:'권홍석', phone:'010-6789-6010', type:'비회원', channel:'중고폰', social:'-', carrier:'SKT', verify:'완료', account:'등록', address:'등록', date:'2026.04.05', cnt:'0건', pt:'0P',
    birth:'1992.03.15', gender:'남성', authDate:'2026.04.05',
    bank:'국민은행', accountNum:'123-456-789012', holder:'권홍석 ✓',
    addresses:[{alias:'집',addr:'순천시 충효로 109',isDefault:true}],
    orders:[],
    gifts:[],
    points:[],
    withdrawals:[],
    referralBy:null, referralCode:null, friends:[],
    guard:[]
  }
];

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   테이블 행 데이터 (wireframe .map() 원본)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const tableRows = [
  ['홍길동','010-1234-5678','앱회원','셀프신청','카카오','KT','완료','등록','등록','2026.04.01','3건','12,000P'],
  ['김철수','010-2345-6789','앱회원','티켓','구글','-','미완료','미등록','미등록','2026.03.15','1건','2,000P'],
  ['이영희','010-3456-7890','비회원','셀프신청','-','-','미완료','미등록','미등록','2026.03.10','1건','0P'],
  ['박민수','010-4567-8901','비회원','CRM등록','-','-','미완료','미등록','미등록','2026.02.20','1건','0P'],
  ['최지은','010-5678-9012','앱회원','CRM등록','카카오','LG U+','완료','등록','미등록','2026.02.01','0건','1,000P'],
  ['강민준','010-0123-4567','앱회원','셀프신청','카카오','KT','완료','등록','등록','2026.01.15','2건','0P'],
  ['윤서연','010-8901-2345','앱회원','티켓','구글','SKT','완료','등록','등록','2026.02.10','0건','2,000P'],
  ['한지민','010-7890-1234','비회원','CRM등록','-','-','미완료','미등록','미등록','2026.03.10','0건','0P'],
  ['권홍석','010-6789-6010','비회원','중고폰','-','SKT','완료','등록','등록','2026.04.05','0건','0P'],
];

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   스타일 헬퍼
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const nameLink = { fontWeight: 600, color: theme.navy };
const nameLinkBlue = { fontWeight: 600, color: theme.blue, cursor: 'pointer', textDecoration: 'underline' };

const filterBarStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flexWrap: 'wrap',
};

const filterInputStyle = {
  padding: '5px 12px',
  border: `1px solid ${theme.borderDark}`,
  borderRadius: 6,
  fontSize: 11,
  outline: 'none',
  marginLeft: 'auto',
  width: 200,
};

const sectionTitle = { fontSize: 12, fontWeight: 700, color: theme.navy, marginBottom: 10 };

const modalOverlay = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.5)', zIndex: 9999,
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
  paddingTop: 30, overflowY: 'auto',
};

const modalBox = {
  background: '#fff', borderRadius: 12, width: '90%', maxWidth: 900,
  maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
};

const modalHeader = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '16px 20px', borderBottom: `1px solid ${theme.border}`,
  position: 'sticky', top: 0, background: '#fff', zIndex: 1,
};

const modalBody = { padding: 20 };

const missingBanner = {
  background: '#fef2f2', border: '1px solid #fca5a5', borderLeft: '4px solid #ef4444',
  borderRadius: 8, padding: '12px 16px', marginBottom: 10,
};

const completeBanner = {
  background: theme.greenBg, border: '1px solid #6ee7b7', borderLeft: `4px solid ${theme.green}`,
  borderRadius: 8, padding: '12px 16px', marginBottom: 10,
  fontSize: 12, fontWeight: 600, color: '#065f46',
};

const emptyField = {
  background: '#f9fafb', border: `1px dashed ${theme.border}`, borderRadius: 8,
  padding: 16, textAlign: 'center',
};

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Component
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function Members() {
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [typeFilter, setTypeFilter] = useState('전체');
  const [authFilter, setAuthFilter] = useState('전체');
  const [socialFilter, setSocialFilter] = useState('전체');

  const openMemberDetail = (idx) => setSelectedIdx(idx);
  const closeMemberDetail = () => setSelectedIdx(null);

  const findAndOpenMember = (name) => {
    const idx = memberData.findIndex(m => m.name === name);
    if (idx >= 0) {
      setSelectedIdx(null);
      setTimeout(() => setSelectedIdx(idx), 50);
    }
  };

  const m = selectedIdx !== null ? memberData[selectedIdx] : null;

  /* ━━ 소셜 뱃지 렌더 ━━ */
  const renderSocial = (social) => {
    if (social === '카카오') return <span style={{ ...statusStyle('orange'), background: '#fef3c7' }}>카카오</span>;
    if (social === '구글') return <span style={{ ...statusStyle('blue'), background: theme.blueBg }}>구글</span>;
    return <span style={{ color: theme.textMuted, fontSize: 10 }}>미가입</span>;
  };

  /* ━━ 출금 조건 확인 (buildPointSection) ━━ */
  const BuildPointSection = ({ m, children }) => {
    const ptVal = parseInt(m.pt) || 0;
    const cntVal = parseInt(m.cnt) || 0;
    return (
      <>
        <div style={{ background: theme.blueBg, borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: theme.navy, marginBottom: 6 }}>✅ 출금 조건 확인</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11 }}>
            <div>① 5만P 이상: <span style={{ color: ptVal >= 50000 ? theme.green : theme.red, fontWeight: 700 }}>{ptVal >= 50000 ? '충족' : '미충족'} ({m.pt})</span></div>
            <div>② 계약 1회+: <span style={{ color: cntVal >= 1 ? theme.green : theme.red, fontWeight: 700 }}>{cntVal >= 1 ? '충족' : '미충족'} ({m.cnt})</span></div>
            <div>③ PASS 인증: <span style={{ color: m.verify === '완료' ? theme.green : theme.red, fontWeight: 700 }}>{m.verify}</span></div>
            <div>④ 계좌 등록: <span style={{ color: m.account === '등록' ? theme.green : theme.red, fontWeight: 700 }}>{m.account}</span></div>
          </div>
          {m.verify === '완료' && m.account === '등록' && cntVal >= 1 && ptVal >= 50000 ? (
            <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
              <span style={{ ...button.success, cursor: 'pointer', fontSize: 11 }}>출금 승인</span>
              <span style={{ ...button.danger, cursor: 'pointer', fontSize: 11 }}>반려</span>
            </div>
          ) : (
            <div style={{ marginTop: 6, fontSize: 10, color: theme.red }}>※ 조건 미충족 — 출금 불가</div>
          )}
        </div>
        {children}
      </>
    );
  };

  /* ━━ 모달 렌더 ━━ */
  const renderModal = () => {
    if (!m) return null;
    const isNonMember = m.type === '비회원';
    const missing = [];
    if (m.verify === '미완료') missing.push('본인인증');
    if (m.account === '미등록') missing.push('계좌');
    if (m.address === '미등록') missing.push('주소');

    /* 유형 배너 */
    const typeBanner = isNonMember ? (
      <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderLeft: `4px solid ${theme.orange}`, borderRadius: 8, padding: '12px 16px', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div><span style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>👤 비회원</span> <span style={{ fontSize: 11, color: '#a16207', marginLeft: 8 }}>유입: {m.channel || '-'} · 이름+전화번호만 보유</span></div>
          <span style={{ fontSize: 10, fontWeight: 600, color: theme.orange }}>포인트 적립 불가 · 출금 불가 · 마이페이지 없음</span>
        </div>
        <div style={{ fontSize: 11, color: '#78350f', lineHeight: 1.6 }}>📌 사은품 지급 절차: <strong>① 앱 가입</strong> (전화번호 자동 매칭) → <strong>② PASS 본인인증</strong> (생년월일/성별/통신사 확보) → <strong>③ 계좌 등록</strong> → <strong>④ 사은품 즉시 지급</strong></div>
      </div>
    ) : (
      <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderLeft: `4px solid ${theme.green}`, borderRadius: 8, padding: '12px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#065f46' }}>👤 앱회원</span>
        <span style={{ fontSize: 11, color: '#065f46' }}>유입: {m.channel || '-'} · 소셜: {m.social || '-'}</span>
      </div>
    );

    /* 미등록 배너 */
    const missingBannerEl = missing.length > 0 ? (
      <div style={missingBanner}>
        <div style={{ fontSize: 12, fontWeight: 700, color: theme.red, marginBottom: 4 }}>⚠️ 미등록 항목 <span style={{ background: theme.red, color: '#fff', padding: '2px 8px', borderRadius: 10, fontSize: 11, marginLeft: 6 }}>{missing.length}건</span></div>
        <div style={{ display: 'flex', gap: 6 }}>{missing.map(t => <span key={t} style={{ background: '#fee2e2', color: theme.red, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{t} ✗</span>)}</div>
      </div>
    ) : !isNonMember ? (
      <div style={completeBanner}>✅ 모든 정보 등록 완료 — 사은품 지급 / 포인트 출금 가능</div>
    ) : null;

    /* 기본정보 rows */
    const basicRows = [
      ['이름', m.name],
      ['전화번호', m.phone],
      ['고객 유형', { isStatus: true, type: isNonMember ? 'orange' : 'green', text: m.type || '앱회원' }],
      ['유입 경로', m.channel || '-'],
      ['소셜 로그인', isNonMember ? { raw: <span style={{ color: theme.textMuted }}>미가입</span> } : (m.social || '-')],
      ['생년월일', isNonMember
        ? { raw: <span style={{ color: theme.textMuted }}>앱 가입 후 PASS 인증 필요</span> }
        : (m.birth || { raw: <span style={{ color: theme.red }}>미인증 <span style={{ background: '#fee2e2', padding: '2px 6px', borderRadius: 4, fontSize: 10 }}>PASS 인증 필요</span></span> })],
      ['성별', isNonMember ? { raw: <span style={{ color: theme.textMuted }}>—</span> } : (m.gender || { raw: <span style={{ color: theme.red }}>미인증</span> })],
      ['통신사', m.carrier !== '-'
        ? { raw: <span style={{ fontWeight: 700, color: theme.blue }}>{m.carrier} <small style={{ color: theme.textMuted }}>(PASS 인증)</small></span> }
        : (isNonMember ? { raw: <span style={{ color: theme.textMuted }}>—</span> } : { raw: <span style={{ color: theme.red }}>미인증 <span style={{ background: '#fee2e2', padding: '2px 6px', borderRadius: 4, fontSize: 10 }}>TM 불가</span></span> })],
      ['가입일', m.date],
      ['포인트', isNonMember ? { raw: <span style={{ color: theme.textMuted }}>비회원 — 적립/출금 불가</span> } : { raw: <span style={{ fontWeight: 700, color: theme.orange }}>{m.pt}</span> }],
    ];

    const renderCellValue = (v) => {
      if (v && typeof v === 'object' && v.isStatus) return <span style={statusStyle(v.type)}>{v.text}</span>;
      if (v && typeof v === 'object' && v.raw) return v.raw;
      return v;
    };

    /* 계좌 */
    const accountHtml = m.bank ? (
      <table style={{ ...tableStyles.table, marginBottom: 16 }}>
        <tbody>
          <tr><td style={{ ...tableStyles.td, fontWeight: 700, width: 80 }}>은행</td><td style={tableStyles.td}>{m.bank}</td></tr>
          <tr><td style={{ ...tableStyles.td, fontWeight: 700 }}>계좌번호</td><td style={tableStyles.td}>{m.accountNum}</td></tr>
          <tr><td style={{ ...tableStyles.td, fontWeight: 700 }}>예금주</td><td style={tableStyles.td}>{m.holder}</td></tr>
        </tbody>
      </table>
    ) : (
      <div style={{ ...emptyField, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, color: theme.red, marginBottom: 4 }}>계좌 미등록</div>
        <div style={{ fontSize: 11, color: theme.textMuted }}>사은품 / 포인트 출금 불가</div>
      </div>
    );

    /* 주소 */
    const addrHtml = m.addresses.length > 0 ? (
      <table style={{ ...tableStyles.table, marginBottom: 0 }}>
        <tbody>
          {m.addresses.map((a, i) => (
            <tr key={i}>
              <td style={{ ...tableStyles.td, fontWeight: 700, width: 50 }}>{a.alias}</td>
              <td style={{ ...tableStyles.td, fontSize: 11 }}>{a.addr}</td>
              <td style={tableStyles.td}>{a.isDefault && <span style={{ ...statusStyle('blue'), fontSize: 10 }}>기본</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    ) : (
      <div style={emptyField}>
        <div style={{ fontWeight: 700, color: theme.red, marginBottom: 4 }}>주소 미등록</div>
        <div style={{ fontSize: 11, color: theme.textMuted }}>설치 / 수거 배정 불가</div>
      </div>
    );

    /* 신청이력 */
    const ordersHtml = m.orders.length > 0 ? (
      <table style={{ ...tableStyles.table, marginBottom: 0 }}>
        <thead>
          <tr>
            <th style={tableStyles.th}>신청일</th><th style={tableStyles.th}>티켓번호</th><th style={tableStyles.th}>상품</th>
            <th style={tableStyles.th}>유입경로</th><th style={tableStyles.th}>동기화</th><th style={tableStyles.th}>상태</th>
            <th style={tableStyles.th}>사은품</th><th style={tableStyles.th}>담당자</th><th style={tableStyles.th}>계약일</th>
          </tr>
        </thead>
        <tbody>
          {m.orders.map((r, i) => {
            const [d, ticket, p, ch, sync, st, gift, mg, cd] = r;
            return (
              <tr key={i}>
                <td style={{ ...tableStyles.td, fontSize: 11 }}>{d}</td>
                <td style={tableStyles.td}>{ticket !== '-' ? <span style={{ fontFamily: 'monospace', fontWeight: 700, color: theme.blue, fontSize: 10 }}>{ticket}</span> : <span style={{ color: theme.textMuted }}>-</span>}</td>
                <td style={{ ...tableStyles.td, fontWeight: 600, fontSize: 11 }}>{p}</td>
                <td style={tableStyles.td}><span style={{ ...statusStyle('navy'), fontSize: 10 }}>{ch}</span></td>
                <td style={{ ...tableStyles.td, fontSize: 10, color: sync === '어드민→CRM' ? theme.blue : theme.green }}>{sync}</td>
                <td style={tableStyles.td}><span style={statusStyle(st === '계약완료' ? 'green' : st === '취소' ? 'red' : 'orange')}>{st}</span></td>
                <td style={{ ...tableStyles.td, color: theme.orange, fontWeight: 700 }}>{gift || '-'}</td>
                <td style={{ ...tableStyles.td, fontSize: 11, ...(mg === '미배정' ? { color: theme.red, fontWeight: 600 } : {}) }}>{mg}</td>
                <td style={{ ...tableStyles.td, fontSize: 11 }}>{cd}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    ) : (
      <div style={{ textAlign: 'center', padding: 16, color: theme.textMuted, fontSize: 12 }}>신청 내역 없음</div>
    );

    /* 사은품 */
    const giftsHtml = m.gifts.length > 0 ? (
      <table style={{ ...tableStyles.table, marginBottom: 0 }}>
        <thead>
          <tr>
            <th style={tableStyles.th}>계약 상품</th><th style={tableStyles.th}>사은품 금액</th>
            <th style={tableStyles.th}>지급 상태</th><th style={tableStyles.th}>지급일</th><th style={tableStyles.th}>입금 계좌</th>
          </tr>
        </thead>
        <tbody>
          {m.gifts.map((r, i) => {
            const [p, a, st, d, ac] = r;
            return (
              <tr key={i}>
                <td style={tableStyles.td}>{p}</td>
                <td style={{ ...tableStyles.td, fontWeight: 700, color: theme.orange }}>{a}</td>
                <td style={tableStyles.td}><span style={statusStyle(st === '지급완료' ? 'green' : 'orange')}>{st}</span></td>
                <td style={{ ...tableStyles.td, fontSize: 11 }}>{d || '-'}</td>
                <td style={{ ...tableStyles.td, fontSize: 11, color: theme.textMuted }}>{ac}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    ) : (
      <div style={{ textAlign: 'center', padding: 16, color: theme.textMuted, fontSize: 12 }}>사은품 내역 없음</div>
    );

    /* 포인트 테이블 */
    const pointsTable = (
      <table style={{ ...tableStyles.table, marginBottom: 0 }}>
        <thead>
          <tr>
            <th style={tableStyles.th}>일시</th><th style={tableStyles.th}>구분</th>
            <th style={tableStyles.th}>내용</th><th style={tableStyles.th}>포인트</th><th style={tableStyles.th}>잔액</th>
          </tr>
        </thead>
        <tbody>
          {m.points.map((r, i) => {
            const [d, t, desc, p, b] = r;
            return (
              <tr key={i}>
                <td style={{ ...tableStyles.td, fontSize: 11 }}>{d}</td>
                <td style={tableStyles.td}><span style={statusStyle(t === '적립' ? 'green' : 'red')}>{t}</span></td>
                <td style={{ ...tableStyles.td, fontSize: 11 }}>{desc}</td>
                <td style={{ ...tableStyles.td, fontWeight: 700, color: t === '적립' ? theme.green : theme.red }}>{p}</td>
                <td style={{ ...tableStyles.td, fontSize: 11 }}>{b}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );

    /* 출금 이력 */
    const hasReason = m.withdrawals && m.withdrawals.some(w => w.length > 5);
    const withdrawHtml = m.withdrawals && m.withdrawals.length > 0 ? (
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${theme.border}` }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: theme.orange, marginBottom: 10 }}>💸 출금 이력</div>
        <table style={{ ...tableStyles.table, marginBottom: 0 }}>
          <thead>
            <tr>
              <th style={tableStyles.th}>신청일</th><th style={tableStyles.th}>출금 금액</th>
              <th style={tableStyles.th}>출금 계좌</th><th style={tableStyles.th}>상태</th><th style={tableStyles.th}>처리일</th>
              {hasReason && <th style={tableStyles.th}>사유</th>}
            </tr>
          </thead>
          <tbody>
            {m.withdrawals.map((w, i) => {
              const [d, amt, acc, st, pDate, ...rest] = w;
              const reason = rest[0] || '';
              return (
                <tr key={i}>
                  <td style={{ ...tableStyles.td, fontSize: 11 }}>{d}</td>
                  <td style={{ ...tableStyles.td, fontWeight: 700, color: theme.navy }}>{amt}</td>
                  <td style={{ ...tableStyles.td, fontSize: 11, color: theme.textMuted }}>{acc}</td>
                  <td style={tableStyles.td}><span style={statusStyle(st === '승인완료' ? 'green' : st === '승인대기' ? 'orange' : 'red')}>{st}</span></td>
                  <td style={{ ...tableStyles.td, fontSize: 11 }}>{pDate}</td>
                  {hasReason && <td style={{ ...tableStyles.td, fontSize: 11, color: theme.red }}>{reason}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    ) : (
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${theme.border}` }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: theme.orange, marginBottom: 10 }}>💸 출금 이력</div>
        <div style={{ textAlign: 'center', padding: 16, color: theme.textMuted, fontSize: 12 }}>출금 이력 없음</div>
      </div>
    );

    /* 친구초대 */
    const referralLink = m.referralBy ? (
      <strong style={{ color: theme.blue, cursor: 'pointer', textDecoration: 'underline' }} onClick={() => findAndOpenMember(m.referralBy)}>{m.referralBy}</strong>
    ) : '없음';

    const friendsHtml = (
      <>
        <div style={{ display: 'flex', gap: 20, marginBottom: 10, fontSize: 12, color: theme.textMuted }}>
          <div>추천인: {referralLink}</div>
          <div>내 초대 코드: <strong style={{ color: theme.blue }}>{m.referralCode}</strong></div>
        </div>
        {m.friends.length > 0 ? (
          <table style={{ ...tableStyles.table, marginBottom: 0 }}>
            <thead>
              <tr>
                <th style={tableStyles.th}>초대한 친구</th><th style={tableStyles.th}>가입일</th>
                <th style={tableStyles.th}>계약</th><th style={tableStyles.th}>추천인 포인트</th><th style={tableStyles.th}>친구 포인트</th>
              </tr>
            </thead>
            <tbody>
              {m.friends.map((f, i) => {
                const [n, d, cc, mp, fp] = f;
                return (
                  <tr key={i}>
                    <td style={{ ...tableStyles.td, ...nameLinkBlue }} onClick={() => findAndOpenMember(n)}>{n}</td>
                    <td style={{ ...tableStyles.td, fontSize: 11 }}>{d}</td>
                    <td style={tableStyles.td}><span style={statusStyle(cc === '완료' ? 'green' : 'gray')}>{cc}</span></td>
                    <td style={{ ...tableStyles.td, color: mp !== '-' ? theme.green : theme.textMuted }}>{mp}</td>
                    <td style={{ ...tableStyles.td, color: fp !== '-' ? theme.green : theme.textMuted }}>{fp}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: 'center', padding: 12, color: theme.textMuted, fontSize: 12 }}>초대한 친구 없음</div>
        )}
      </>
    );

    /* 돈지키미 */
    const guardHtml = m.guard.length > 0 ? (
      <table style={{ ...tableStyles.table, marginBottom: 0 }}>
        <thead>
          <tr><th style={tableStyles.th}>항목</th><th style={tableStyles.th}>만료일</th><th style={tableStyles.th}>D-day</th><th style={tableStyles.th}>알림</th></tr>
        </thead>
        <tbody>
          {m.guard.map(([it, d, dd, al], i) => (
            <tr key={i}>
              <td style={tableStyles.td}>{it}</td>
              <td style={tableStyles.td}>{d}</td>
              <td style={tableStyles.td}><span style={statusStyle('blue')}>{dd}</span></td>
              <td style={tableStyles.td}><span style={statusStyle(al === 'ON' ? 'green' : 'gray')}>{al}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    ) : (
      <div style={{ textAlign: 'center', padding: 12, color: theme.textMuted, fontSize: 12 }}>등록된 항목 없음</div>
    );

    return (
      <div style={modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) closeMemberDetail(); }}>
        <div style={modalBox}>
          <div style={modalHeader}>
            <h3 style={{ margin: 0, fontSize: 16 }}>👤 {m.name} <span style={{ fontSize: 12, color: theme.textMuted, fontWeight: 400, marginLeft: 8 }}>{m.phone}</span></h3>
            <button onClick={closeMemberDetail} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: theme.textMuted }}>✕</button>
          </div>
          <div style={modalBody}>
            {typeBanner}
            {missingBannerEl}

            {/* 2열: 기본정보 + 계좌/주소 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div style={{ ...card, marginBottom: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: theme.navy, marginBottom: 10 }}>👤 기본 정보</div>
                <table style={{ ...tableStyles.table, marginBottom: 0 }}>
                  <tbody>
                    {basicRows.map(([k, v], i) => (
                      <tr key={i}>
                        <td style={{ ...tableStyles.td, fontWeight: 700, width: 80 }}>{k}</td>
                        <td style={tableStyles.td}>{renderCellValue(v)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ ...card, marginBottom: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: theme.navy, marginBottom: 10 }}>🏦 계좌 정보</div>
                {accountHtml}
                <div style={{ fontSize: 12, fontWeight: 700, color: theme.navy, marginBottom: 10 }}>📍 주소 목록</div>
                {addrHtml}
              </div>
            </div>

            {/* 신청/계약 이력 */}
            <div style={{ ...card }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: theme.navy, marginBottom: 10 }}>📋 신청 / 계약 이력</div>
              {ordersHtml}
            </div>

            {/* 사은품 */}
            <div style={{ ...card }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: theme.navy, marginBottom: 10 }}>🎁 사은품 지급 내역</div>
              {giftsHtml}
            </div>

            {/* 포인트 */}
            <div style={{ ...card }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: theme.navy, marginBottom: 10 }}>💰 포인트 내역</div>
              {isNonMember ? (
                <div style={{ textAlign: 'center', padding: 16, color: theme.textMuted, fontSize: 12 }}>비회원 — 앱 가입 후 포인트 적립/출금 가능</div>
              ) : (
                <BuildPointSection m={m}>
                  {pointsTable}
                  {withdrawHtml}
                </BuildPointSection>
              )}
            </div>

            {/* 친구초대 */}
            <div style={{ ...card }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: theme.navy, marginBottom: 10 }}>👫 친구초대 현황</div>
              {isNonMember ? (
                <div style={{ textAlign: 'center', padding: 16, color: theme.textMuted, fontSize: 12 }}>비회원 — 앱 가입 후 친구초대 가능</div>
              ) : friendsHtml}
            </div>

            {/* 돈지키미 */}
            <div style={{ ...card }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: theme.navy, marginBottom: 10 }}>🔔 돈지키미 등록 현황</div>
              {isNonMember ? (
                <div style={{ textAlign: 'center', padding: 16, color: theme.textMuted, fontSize: 12 }}>비회원 — 앱 가입 후 돈지키미 등록 가능</div>
              ) : guardHtml}
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     메인 렌더
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  return (
    <div>
      {/* 필터: 고객유형 */}
      <div style={{ ...filterBarStyle, marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: theme.textMuted, width: 40 }}>유형</span>
        {['전체', '앱회원', '비회원', 'CRM등록', '중고폰'].map(f => (
          <div
            key={f}
            onClick={() => setTypeFilter(f)}
            style={{
              ...filterBtn(typeFilter === f),
              ...(f === '비회원' && typeFilter !== f ? { borderColor: theme.orange, color: theme.orange } : {}),
            }}
          >
            {f}
          </div>
        ))}
      </div>

      {/* 필터: 인증상태 */}
      <div style={{ ...filterBarStyle, marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: theme.textMuted, width: 40 }}>인증</span>
        {['전체', '인증완료', '미인증', '계좌등록', '계좌미등록'].map(f => (
          <div
            key={f}
            onClick={() => setAuthFilter(f)}
            style={{
              ...filterBtn(authFilter === f),
              ...(f === '인증완료' && authFilter !== f ? { borderColor: theme.green, color: theme.green } : {}),
              ...(f === '미인증' && authFilter !== f ? { borderColor: theme.orange, color: theme.orange } : {}),
            }}
          >
            {f}
          </div>
        ))}
      </div>

      {/* 필터: 소셜 + 검색 */}
      <div style={{ ...filterBarStyle, marginBottom: 14 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: theme.textMuted, width: 40 }}>소셜</span>
        {['전체', '카카오', '구글', '미가입'].map(f => (
          <div key={f} onClick={() => setSocialFilter(f)} style={filterBtn(socialFilter === f)}>{f}</div>
        ))}
        <input style={filterInputStyle} placeholder="이름 / 전화번호 검색" />
        <span style={{ ...button.primary, cursor: 'pointer', fontSize: 11 }}>+ 앱 푸시 발송</span>
      </div>

      {/* 미인증 배너 */}
      <div style={{ ...card, background: theme.orangeBg, borderColor: '#fcd34d', marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: theme.orange }}>⚠️ 미인증 회원 <strong>342명</strong> — 인증 유도 알림톡 발송 가능</div>
          <span style={button.primary}>알림톡 발송</span>
        </div>
      </div>

      {/* 비회원 배너 */}
      <div style={{ ...card, background: '#eff6ff', borderColor: '#bfdbfe', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: theme.navy }}>📱 비회원 <strong>128명</strong> — 앱 가입 유도 알림톡 발송 가능 (전화번호 기준 자동 매칭)</div>
          <span style={button.primary}>가입유도 알림톡</span>
        </div>
      </div>

      {/* 회원 테이블 */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <table style={{ ...tableStyles.table, marginBottom: 0 }}>
          <thead>
            <tr>
              <th style={tableStyles.th}><input type="checkbox" /></th>
              <th style={tableStyles.th}>이름</th><th style={tableStyles.th}>전화번호</th><th style={tableStyles.th}>유형</th>
              <th style={tableStyles.th}>유입경로</th><th style={tableStyles.th}>소셜</th><th style={tableStyles.th}>통신사</th>
              <th style={tableStyles.th}>인증</th><th style={tableStyles.th}>계좌</th><th style={tableStyles.th}>주소</th>
              <th style={tableStyles.th}>가입일</th><th style={tableStyles.th}>신청</th><th style={tableStyles.th}>포인트</th>
              <th style={tableStyles.th}>관리</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map(([name, phone, type, channel, social, carrier, verify, account, address, date, cnt, pt], i) => (
              <tr key={i}>
                <td style={tableStyles.td}><input type="checkbox" /></td>
                <td style={{ ...tableStyles.td, fontWeight: 600, color: theme.navy }}>{name}</td>
                <td style={{ ...tableStyles.td, fontSize: 11 }}>{phone}</td>
                <td style={tableStyles.td}><span style={{ ...statusStyle(type === '앱회원' ? 'green' : 'orange'), fontSize: 10 }}>{type}</span></td>
                <td style={tableStyles.td}><span style={{ fontSize: 10, color: theme.textMuted }}>{channel}</span></td>
                <td style={tableStyles.td}>{renderSocial(social)}</td>
                <td style={{ ...tableStyles.td, fontWeight: 600, color: carrier === '-' ? theme.textMuted : theme.navy }}>{carrier}</td>
                <td style={tableStyles.td}><span style={statusStyle(verify === '완료' ? 'green' : 'orange')}>{verify}</span></td>
                <td style={tableStyles.td}><span style={statusStyle(account === '등록' ? 'green' : 'gray')}>{account}</span></td>
                <td style={tableStyles.td}><span style={statusStyle(address === '등록' ? 'green' : 'gray')}>{address}</span></td>
                <td style={{ ...tableStyles.td, fontSize: 11 }}>{date}</td>
                <td style={tableStyles.td}>{cnt}</td>
                <td style={{ ...tableStyles.td, fontWeight: 600, color: theme.orange }}>{pt}</td>
                <td style={tableStyles.td}>
                  <span style={{ ...button.secondary, cursor: 'pointer', fontSize: 11, padding: '4px 10px' }} onClick={() => openMemberDetail(i)}>상세</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 하단 안내 */}
      <div style={{ textAlign: 'center', padding: 20 }}>
        <div style={{ fontSize: 13, color: theme.textMuted, marginBottom: 6 }}>👆 회원 목록에서 <strong style={{ color: theme.navy }}>상세</strong> 버튼을 클릭하면 팝업이 열립니다</div>
        <div style={{ fontSize: 11, color: theme.textMuted }}>인증 완료 회원 / 미인증 회원별로 다르게 표시됩니다</div>
      </div>

      {/* 회원 상세 모달 */}
      {renderModal()}
    </div>
  );
}
