import { useState } from 'react';

const TABS = [
  { key: 'home', label: '홈', icon: '🏠' },
  { key: 'applications', label: '신청 내역', icon: '📋' },
  { key: 'gifts', label: '사은품', icon: '🎁' },
  { key: 'points', label: '포인트', icon: '💰' },
  { key: 'guard', label: '돈지키미', icon: '🔔' },
  { key: 'referral', label: '친구초대', icon: '👫' },
  { key: 'reviews', label: '후기', icon: '⭐' },
  { key: 'usedphone', label: '중고폰 매입', icon: '📱' },
  { key: 'profile', label: '내 정보', icon: '👤' },
  { key: 'verification', label: '본인인증', icon: '✅' },
  { key: 'account', label: '계좌 관리', icon: '🏦' },
  { key: 'address', label: '주소 관리', icon: '📍' },
  { key: 'alerts', label: '알림 설정', icon: '⚙️' },
];

export default function MyPageModal({ open, onClose, initialTab = 'home' }) {
  const [tab, setTab] = useState(initialTab);

  if (!open) return null;

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        {/* 헤더 */}
        <div style={s.header}>
          <span style={s.headerTitle}>마이페이지</span>
          <button onClick={onClose} style={s.closeBtn}>{'✕'}</button>
        </div>

        {/* 탭 바 (가로 스크롤) */}
        <div style={s.tabBar}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{ ...s.tab, ...(tab === t.key ? s.tabActive : {}) }}
            >
              <span>{t.icon}</span>
              <span style={{ fontSize: 10 }}>{t.label}</span>
            </button>
          ))}
        </div>

        {/* 본문 */}
        <div style={s.body}>
          {tab === 'home' && <HomeTab />}
          {tab === 'applications' && <ApplicationsTab />}
          {tab === 'gifts' && <GiftsTab />}
          {tab === 'points' && <PointsTab />}
          {tab === 'guard' && <GuardTab />}
          {tab === 'referral' && <ReferralTab />}
          {tab === 'reviews' && <ReviewsTab />}
          {tab === 'usedphone' && <UsedPhoneTab />}
          {tab === 'profile' && <ProfileTab />}
          {tab === 'verification' && <VerificationTab />}
          {tab === 'account' && <AccountTab />}
          {tab === 'address' && <AddressTab />}
          {tab === 'alerts' && <AlertsTab />}
        </div>
      </div>
    </div>
  );
}

// ─── 홈 ───
function HomeTab() {
  return (
    <div>
      <div style={s.darkCard}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>안녕하세요</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>홍길동 님</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={s.kpiBox}><div style={{ fontSize: 20, fontWeight: 700, color: '#60a5fa' }}>1</div><div style={s.kpiLabel}>진행중 신청</div></div>
          <div style={s.kpiBox}><div style={{ fontSize: 20, fontWeight: 700, color: '#34d399' }}>370,000</div><div style={s.kpiLabel}>사은품 예정(원)</div></div>
          <div style={s.kpiBox}><div style={{ fontSize: 20, fontWeight: 700, color: '#fbbf24' }}>30,000</div><div style={s.kpiLabel}>포인트(P)</div></div>
        </div>
      </div>
      <div style={s.card}>
        <div style={s.cardTitle}>진행중 신청</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2744' }}>KT 인터넷+TV 500Mbps</div>
        <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>04.06 신청 | 상담중</div>
        <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
          {['신청완료', '상담중', '계약완료', '설치완료'].map((st, i) => (
            <div key={st} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= 1 ? '#2563eb' : '#e8e8e8' }} />
          ))}
        </div>
      </div>
      <div style={{ ...s.card, background: '#fee2e2', borderColor: '#fca5a5' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>돈지키미 임박</div>
        <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>인터넷 약정 종료 D-26</div>
      </div>
    </div>
  );
}

// ─── 신청 내역 ───
function ApplicationsTab() {
  const apps = [
    { product: 'KT 인터넷+TV 500Mbps', date: '04.06', status: '상담중', color: '#d97706', bg: '#fef3c7', step: 1 },
    { product: 'LG 정수기 렌탈', date: '03.10', status: '설치완료', color: '#10b981', bg: '#d1fae5', step: 3 },
  ];
  return (
    <div>
      {apps.map((a, i) => (
        <div key={i} style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2744' }}>{a.product}</div>
            <span style={{ ...s.badge, background: a.bg, color: a.color }}>{a.status}</span>
          </div>
          <div style={{ fontSize: 11, color: '#999' }}>{a.date} 신청</div>
          <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
            {['신청완료', '상담중', '계약완료', '설치완료'].map((st, j) => (
              <div key={st} style={{ flex: 1, height: 4, borderRadius: 2, background: j <= a.step ? '#2563eb' : '#e8e8e8' }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── 사은품 ───
function GiftsTab() {
  return (
    <div>
      <div style={{ ...s.card, borderLeft: '3px solid #d97706' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={s.cardTitle}>KT 인터넷+TV 500Mbps</div>
          <span style={{ ...s.badge, background: '#fef3c7', color: '#d97706' }}>지급 대기</span>
        </div>
        <div style={{ fontSize: 11, color: '#999' }}>지급 예정일 2026.05.01</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#d97706', marginTop: 6 }}>370,000원</div>
      </div>
      <div style={{ ...s.card, borderLeft: '3px solid #10b981' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={s.cardTitle}>LG 정수기 렌탈</div>
          <span style={{ ...s.badge, background: '#d1fae5', color: '#10b981' }}>지급 완료</span>
        </div>
        <div style={{ fontSize: 11, color: '#999' }}>지급 완료 2026.03.10</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981', marginTop: 6 }}>150,000원</div>
      </div>
    </div>
  );
}

// ─── 포인트 ───
function PointsTab() {
  return (
    <div>
      <div style={s.darkCard}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>보유 포인트</div>
        <div style={{ fontSize: 32, fontWeight: 900, color: '#fbbf24' }}>30,000 P</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>현금 출금까지 20,000P 더 필요</div>
      </div>
      <div style={{ ...s.card, background: '#fef3c7', borderColor: '#fcd34d' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>현금 출금 조건</div>
        <div style={{ fontSize: 11, color: '#78350f', lineHeight: 2 }}>
          <div>{'⬜'} 5만 포인트 이상 (현재 30,000P)</div>
          <div>{'✅'} 1회 이상 계약 완료</div>
          <div>{'✅'} 본인인증 완료</div>
          <div>{'✅'} 계좌 등록 완료</div>
        </div>
      </div>
      {[
        ['+20,000P', '친구 계약 완료', '04.01', '#10b981'],
        ['+5,000P', '계약 완료 포인트', '03.20', '#10b981'],
        ['+5,000P', '회원가입 포인트', '01.01', '#10b981'],
      ].map(([pt, title, date, color], i) => (
        <div key={i} style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#1a2744' }}>{title}</div>
              <div style={{ fontSize: 10, color: '#999' }}>{date}</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color }}>{pt}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── 돈지키미 ───
function GuardTab() {
  return (
    <div>
      <div style={{ ...s.card, background: '#fee2e2', borderColor: '#fca5a5' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>인터넷 약정 종료</div>
        <div style={{ fontSize: 12, color: '#dc2626', marginTop: 2 }}>2026.05.01 (D-26)</div>
      </div>
      <div style={s.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div><div style={{ fontSize: 13, fontWeight: 600 }}>요금제 변경 가능일</div><div style={{ fontSize: 11, color: '#999' }}>2026.08.15 (D-132)</div></div>
          <span style={{ ...s.badge, background: '#f3f4f6', color: '#6b7280' }}>여유</span>
        </div>
      </div>
      <div style={s.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div><div style={{ fontSize: 13, fontWeight: 600 }}>렌탈 약정 종료</div><div style={{ fontSize: 11, color: '#999' }}>2027.02.01 (D-302)</div></div>
          <span style={{ ...s.badge, background: '#f3f4f6', color: '#6b7280' }}>여유</span>
        </div>
      </div>
      <div style={s.card}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>알람 설정</div>
        {[['D-30 알람', true], ['D-7 알람', true], ['D-1 알람', false]].map(([label, on]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
            <span>{label}</span>
            <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: on ? '#2563eb' : '#e8e8e8', color: on ? '#fff' : '#999' }}>{on ? 'ON' : 'OFF'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 친구초대 ───
function ReferralTab() {
  return (
    <div>
      <div style={s.darkCard}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>내 초대 코드</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: '#fbbf24', letterSpacing: 4, marginBottom: 10 }}>HONG2026</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ ...s.btnSm, background: '#2563eb', color: '#fff' }}>링크 복사</button>
          <button style={{ ...s.btnSm, background: 'rgba(255,255,255,0.1)', color: '#fff' }}>카카오 공유</button>
        </div>
      </div>
      <div style={{ ...s.card, background: '#dbeafe', borderColor: '#bfdbfe' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1a2744', marginBottom: 6 }}>포인트 적립 조건</div>
        <div style={{ fontSize: 11, color: '#1a2744', lineHeight: 2 }}>
          <div>친구 가입 시 → 추천인 3,000P</div>
          <div>친구 계약 시 → 추천인 최대 20,000P + 친구 최대 15,000P</div>
        </div>
      </div>
      <div style={s.card}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>내가 초대한 친구 (2명)</div>
        {[['이영희', '04.02', '완료', '+5,000P'], ['박민수', '03.25', '미계약', '-']].map(([name, date, st, pt]) => (
          <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0f0f0', fontSize: 12 }}>
            <span style={{ fontWeight: 600 }}>{name}</span>
            <span style={{ color: '#999' }}>{date}</span>
            <span>{st}</span>
            <span style={{ fontWeight: 700, color: pt !== '-' ? '#10b981' : '#999' }}>{pt}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 후기 ───
function ReviewsTab() {
  return (
    <div>
      <button style={{ ...s.btnFull, background: '#2563eb', color: '#fff', marginBottom: 12 }}>후기 작성하기 (15,000P 적립)</button>
      {[
        ['KT 인터넷+TV', 5, '상담사분이 친절하시고 사은품도 빠르게 받았어요.', '김**', '04.01'],
        ['LG 정수기 렌탈', 4, '설치도 빠르고 물맛이 좋아요.', '이**', '03.28'],
      ].map(([product, rating, content, author, date], i) => (
        <div key={i} style={s.card}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2744', marginBottom: 2 }}>{product}</div>
          <div style={{ fontSize: 14, color: '#fbbf24', marginBottom: 4 }}>{'★'.repeat(rating)}{'☆'.repeat(5 - rating)}</div>
          <div style={{ fontSize: 12, color: '#555', lineHeight: 1.5, marginBottom: 4 }}>{content}</div>
          <div style={{ fontSize: 10, color: '#999' }}>{author} | {date}</div>
        </div>
      ))}
    </div>
  );
}

// ─── 중고폰 매입 ───
function UsedPhoneTab() {
  return (
    <div>
      <button style={{ ...s.btnFull, background: '#2563eb', color: '#fff', marginBottom: 12 }}>매입 신청하기</button>
      <div style={s.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2744' }}>iPhone 16 Pro 256GB</div>
          <span style={{ ...s.badge, background: '#fef3c7', color: '#d97706' }}>검수중</span>
        </div>
        <div style={{ fontSize: 11, color: '#999' }}>BP001 | 04.05 | 셀프등급 A</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#2563eb', marginTop: 6 }}>940,000원</div>
        <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
          {['신청완료', '검수중', '검수완료', '입금완료'].map((st, i) => (
            <div key={st} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= 1 ? '#2563eb' : '#e8e8e8' }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── 내 정보 ───
function ProfileTab() {
  return (
    <div>
      <div style={s.card}>
        <div style={s.fieldLabel}>이름</div><div style={s.fieldValue}>홍길동</div>
        <div style={s.fieldLabel}>전화번호</div><div style={s.fieldValue}>010-1234-5678</div>
        <div style={s.fieldLabel}>소셜 로그인</div><div style={s.fieldValue}>카카오 연동</div>
        <div style={s.fieldLabel}>가입일</div><div style={s.fieldValue}>2026.01.01</div>
      </div>
    </div>
  );
}

// ─── 본인인증 ───
function VerificationTab() {
  return (
    <div>
      <div style={{ ...s.card, background: '#fef3c7', borderColor: '#fcd34d' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>본인인증이 필요한 서비스</div>
        <div style={{ fontSize: 11, color: '#78350f', lineHeight: 2 }}>
          <div>사은품 지급 신청</div>
          <div>포인트 현금 출금</div>
          <div>중고폰 매입 신청</div>
        </div>
      </div>
      <button style={{ ...s.btnFull, background: '#2563eb', color: '#fff', fontSize: 15, fontWeight: 700, height: 52 }}>PASS로 본인인증하기</button>
      <div style={{ textAlign: 'center', fontSize: 11, color: '#999', marginTop: 8 }}>PASS 앱이 없으면 SMS 인증으로 진행</div>
    </div>
  );
}

// ─── 계좌 관리 ───
function AccountTab() {
  return (
    <div>
      <div style={{ ...s.card, background: '#d1fae5', borderColor: '#6ee7b7', marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: '#065f46' }}>본인인증 완료 — 계좌 등록 가능</div>
      </div>
      <div style={s.card}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a2744', marginBottom: 4 }}>국민은행 123-456-789012</div>
        <div style={{ fontSize: 12, color: '#999' }}>예금주: 홍길동 · 실명확인 완료</div>
      </div>
    </div>
  );
}

// ─── 주소 관리 ───
function AddressTab() {
  return (
    <div>
      {[
        { alias: '집', addr: '광주시 서구 상무대로 123 아파트 101동 1001호', isDefault: true },
        { alias: '직장', addr: '광주시 동구 금남로 456 오피스빌딩 5층', isDefault: false },
      ].map((a, i) => (
        <div key={i} style={{ ...s.card, ...(a.isDefault ? { borderColor: '#bfdbfe' } : {}) }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1a2744' }}>{a.alias}</span>
            {a.isDefault && <span style={{ ...s.badge, background: '#dbeafe', color: '#2563eb' }}>기본</span>}
          </div>
          <div style={{ fontSize: 12, color: '#555' }}>{a.addr}</div>
        </div>
      ))}
      <button style={{ ...s.btnFull, background: '#2563eb', color: '#fff' }}>+ 주소 추가</button>
    </div>
  );
}

// ─── 알림 설정 ───
function AlertsTab() {
  const [alerts, setAlerts] = useState({ service: true, marketing: true, push: true, kakao: false });
  const toggle = (key) => setAlerts(prev => ({ ...prev, [key]: !prev[key] }));
  return (
    <div style={s.card}>
      {[['service', '서비스 알림'], ['marketing', '마케팅 알림'], ['push', '앱 푸시'], ['kakao', '카카오 알림톡']].map(([key, label]) => (
        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f0f0f0', fontSize: 13 }}>
          <span>{label}</span>
          <button onClick={() => toggle(key)} style={{ padding: '2px 10px', borderRadius: 12, border: 'none', fontSize: 11, fontWeight: 700, background: alerts[key] ? '#2563eb' : '#e8e8e8', color: alerts[key] ? '#fff' : '#999', cursor: 'pointer' }}>
            {alerts[key] ? 'ON' : 'OFF'}
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── 스타일 ───
const s = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000,
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  },
  modal: {
    background: '#f5f6fa', width: '100%', maxWidth: 480, height: '92vh',
    borderRadius: '16px 16px 0 0', display: 'flex', flexDirection: 'column',
    overflow: 'hidden', animation: 'slideUp 0.25s ease',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 18px', background: '#1a2744', flexShrink: 0,
  },
  headerTitle: { fontSize: 16, fontWeight: 700, color: '#fff' },
  closeBtn: {
    background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)',
    fontSize: 20, cursor: 'pointer', padding: '0 4px',
  },
  tabBar: {
    display: 'flex', gap: 4, padding: '8px 12px', background: '#fff',
    borderBottom: '1px solid #e8e8e8', overflowX: 'auto', flexShrink: 0,
    WebkitOverflowScrolling: 'touch',
  },
  tab: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    padding: '6px 10px', borderRadius: 8, border: 'none', background: 'transparent',
    color: '#999', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
    fontFamily: 'inherit',
  },
  tabActive: { background: '#dbeafe', color: '#2563eb', fontWeight: 600 },
  body: { flex: 1, overflow: 'auto', padding: 16, WebkitOverflowScrolling: 'touch' },
  darkCard: {
    background: '#1a2744', borderRadius: 12, padding: 16, color: '#fff', marginBottom: 12,
  },
  kpiBox: {
    flex: 1, background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: 10, textAlign: 'center',
  },
  kpiLabel: { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  card: {
    background: '#fff', border: '1px solid #e8e8e8', borderRadius: 10, padding: 14, marginBottom: 10,
  },
  cardTitle: { fontSize: 13, fontWeight: 700, color: '#1a2744', marginBottom: 6 },
  badge: {
    fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700,
  },
  btnSm: {
    padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
  },
  btnFull: {
    width: '100%', padding: '12px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  },
  fieldLabel: { fontSize: 11, fontWeight: 700, color: '#999', marginBottom: 4, marginTop: 10 },
  fieldValue: { fontSize: 14, color: '#1a2744', fontWeight: 500 },
};
