import { useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api';

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
  const [alarms, setAlarms] = useState(null);
  const [loading, setLoading] = useState(true);

  const fallbackAlarms = [
    { id: 'f1', alarm_type: 'internet_expire', title: '인터넷 약정 종료', target_date: '2026-05-01' },
    { id: 'f2', alarm_type: 'plan_change', title: '요금제 변경 가능일', target_date: '2026-08-15' },
    { id: 'f3', alarm_type: 'rental_expire', title: '렌탈 약정 종료', target_date: '2027-02-01' },
  ];

  useEffect(() => {
    fetch(`${API_BASE}/alarms`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setAlarms(data.alarms || []))
      .catch(() => setAlarms(fallbackAlarms))
      .finally(() => setLoading(false));
  }, []);

  const calcDday = (dateStr) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  const toggleAlarm = async (alarmId, field) => {
    try {
      const alarm = alarms.find(a => a.id === alarmId);
      if (!alarm) return;
      const updates = { [field]: !alarm[field] };
      const res = await fetch(`${API_BASE}/alarms/${alarmId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const data = await res.json();
        setAlarms(prev => prev.map(a => a.id === alarmId ? { ...a, ...data.alarm } : a));
      }
    } catch { /* ignore */ }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>로딩중...</div>;

  const list = alarms && alarms.length > 0 ? alarms : fallbackAlarms;

  return (
    <div>
      {list.map(alarm => {
        const dday = calcDday(alarm.target_date);
        const isUrgent = dday <= 30;
        return (
          <div key={alarm.id} style={{ ...s.card, ...(isUrgent ? { background: '#fee2e2', borderColor: '#fca5a5' } : {}) }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: isUrgent ? 700 : 600, color: isUrgent ? '#dc2626' : '#1a2744' }}>{alarm.title}</div>
                <div style={{ fontSize: 12, color: isUrgent ? '#dc2626' : '#999', marginTop: 2 }}>{formatDate(alarm.target_date)} (D-{dday})</div>
              </div>
              {!isUrgent && <span style={{ ...s.badge, background: '#f3f4f6', color: '#6b7280' }}>여유</span>}
            </div>
          </div>
        );
      })}
      <div style={s.card}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>알람 설정</div>
        {list.map(alarm => (
          <div key={alarm.id} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: '#1a2744' }}>{alarm.title}</div>
            {[['alarm_d30', 'D-30 알람'], ['alarm_d7', 'D-7 알람'], ['alarm_d1', 'D-1 알람']].map(([field, label]) => {
              const on = alarm[field] ?? (field !== 'alarm_d1');
              return (
                <div key={field} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13, paddingLeft: 8 }}>
                  <span>{label}</span>
                  <button
                    onClick={() => toggleAlarm(alarm.id, field)}
                    style={{ padding: '2px 10px', borderRadius: 12, border: 'none', fontSize: 11, fontWeight: 700, background: on ? '#2563eb' : '#e8e8e8', color: on ? '#fff' : '#999', cursor: 'pointer' }}
                  >{on ? 'ON' : 'OFF'}</button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 친구초대 ───
function ReferralTab() {
  const [code, setCode] = useState('');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const fallbackCode = 'HONG2026';
  const fallbackFriends = [
    { referred_name: '이영희', created_at: '2026-04-02', status: '계약완료', points: '+5,000P' },
    { referred_name: '박민수', created_at: '2026-03-25', status: '미계약', points: '-' },
  ];

  useEffect(() => {
    const loadData = async () => {
      try {
        const codeRes = await fetch(`${API_BASE}/referrals/my-code`);
        if (codeRes.ok) {
          const codeData = await codeRes.json();
          setCode(codeData.code || fallbackCode);

          const statsRes = await fetch(`${API_BASE}/referrals/stats?code=${codeData.code || fallbackCode}`);
          if (statsRes.ok) {
            const statsData = await statsRes.json();
            setStats(statsData);
          }
        } else {
          setCode(fallbackCode);
        }
      } catch {
        setCode(fallbackCode);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>로딩중...</div>;

  const friends = stats?.referrals || fallbackFriends;
  const totalInvited = stats?.total_invited ?? friends.length;

  return (
    <div>
      <div style={s.darkCard}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>내 초대 코드</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: '#fbbf24', letterSpacing: 4, marginBottom: 10 }}>{code}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleCopy} style={{ ...s.btnSm, background: '#2563eb', color: '#fff' }}>{copied ? '복사됨!' : '링크 복사'}</button>
          <button style={{ ...s.btnSm, background: 'rgba(255,255,255,0.1)', color: '#fff' }}>카카오 공유</button>
        </div>
      </div>
      {stats && (
        <div style={{ ...s.card, background: '#f0fdf4', borderColor: '#bbf7d0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
            <div><div style={{ fontSize: 18, fontWeight: 700, color: '#2563eb' }}>{stats.total_invited}</div><div style={{ fontSize: 10, color: '#999' }}>초대</div></div>
            <div><div style={{ fontSize: 18, fontWeight: 700, color: '#10b981' }}>{stats.contracted}</div><div style={{ fontSize: 10, color: '#999' }}>계약</div></div>
            <div><div style={{ fontSize: 18, fontWeight: 700, color: '#fbbf24' }}>{(stats.total_earned || 0).toLocaleString()}P</div><div style={{ fontSize: 10, color: '#999' }}>적립</div></div>
          </div>
        </div>
      )}
      <div style={{ ...s.card, background: '#dbeafe', borderColor: '#bfdbfe' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1a2744', marginBottom: 6 }}>포인트 적립 조건</div>
        <div style={{ fontSize: 11, color: '#1a2744', lineHeight: 2 }}>
          <div>친구 가입 시 → 추천인 3,000P</div>
          <div>친구 계약 시 → 추천인 최대 20,000P + 친구 최대 15,000P</div>
        </div>
      </div>
      <div style={s.card}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>내가 초대한 친구 ({totalInvited}명)</div>
        {friends.map((f, i) => {
          const name = f.referred_name || f[0];
          const date = formatDate(f.created_at || f[1]);
          const status = f.status || f[2];
          const isContracted = status === '계약완료' || status === '보상완료' || status === '완료';
          const pt = f.points || (isContracted ? '+5,000P' : '-');
          return (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0f0f0', fontSize: 12 }}>
              <span style={{ fontWeight: 600 }}>{name}</span>
              <span style={{ color: '#999' }}>{date}</span>
              <span>{status}</span>
              <span style={{ fontWeight: 700, color: pt !== '-' ? '#10b981' : '#999' }}>{pt}</span>
            </div>
          );
        })}
        {friends.length === 0 && <div style={{ fontSize: 12, color: '#999', textAlign: 'center', padding: 12 }}>아직 초대한 친구가 없습니다</div>}
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
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fallbackProfile = {
    name: '홍길동',
    phone: '010-1234-5678',
    social_provider: '카카오',
    created_at: '2026-01-01',
    is_verified: true,
  };

  useEffect(() => {
    fetch(`${API_BASE}/user/profile`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setProfile(data))
      .catch(() => setProfile(fallbackProfile))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>로딩중...</div>;

  const p = profile || fallbackProfile;
  const socialLabel = p.social_provider ? `${p.social_provider} 연동` : '미연동';
  const createdAt = p.created_at ? new Date(p.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, '') : '';

  return (
    <div>
      <div style={s.card}>
        <div style={s.fieldLabel}>이름</div><div style={s.fieldValue}>{p.name}</div>
        <div style={s.fieldLabel}>전화번호</div><div style={s.fieldValue}>{p.phone}</div>
        {p.email && <><div style={s.fieldLabel}>이메일</div><div style={s.fieldValue}>{p.email}</div></>}
        <div style={s.fieldLabel}>소셜 로그인</div><div style={s.fieldValue}>{socialLabel}</div>
        <div style={s.fieldLabel}>가입일</div><div style={s.fieldValue}>{createdAt}</div>
        <div style={s.fieldLabel}>본인인증</div><div style={s.fieldValue}>{p.is_verified ? '인증 완료' : '미인증'}</div>
        <button style={{ ...s.btnFull, background: '#2563eb', color: '#fff', marginTop: 14 }}>정보 수정</button>
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
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasAccount, setHasAccount] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/user/bank-account`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        if (data && data.bank_name) {
          setAccount(data);
          setHasAccount(true);
        } else {
          setHasAccount(false);
        }
      })
      .catch(() => {
        setAccount({ bank_name: '국민은행', account_number: '123-456-789012', holder_name: '홍길동', is_verified: true });
        setHasAccount(true);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>로딩중...</div>;

  if (!hasAccount || !account) {
    return (
      <div>
        <div style={{ ...s.card, background: '#fef3c7', borderColor: '#fcd34d' }}>
          <div style={{ fontSize: 12, color: '#92400e' }}>등록된 계좌가 없습니다</div>
        </div>
        <button style={{ ...s.btnFull, background: '#2563eb', color: '#fff' }}>계좌 등록하기</button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ ...s.card, background: '#d1fae5', borderColor: '#6ee7b7', marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: '#065f46' }}>{account.is_verified ? '본인인증 완료 — 계좌 등록 가능' : '본인인증이 필요합니다'}</div>
      </div>
      <div style={s.card}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a2744', marginBottom: 4 }}>{account.bank_name} {account.account_number}</div>
        <div style={{ fontSize: 12, color: '#999' }}>예금주: {account.holder_name} · {account.is_verified ? '실명확인 완료' : '실명확인 미완료'}</div>
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
