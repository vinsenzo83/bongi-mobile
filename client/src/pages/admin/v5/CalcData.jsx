// V5 어드민 — 요금 계산기 데이터 편집 (Phase C)
// vanilla docs/calculator.html?admin=1 의 9개 섹션을 native React로 구현.
// localStorage 키는 vanilla와 동일 — 양쪽 fallback 호환 보존.
//
// role 가드: manager / admin 만 접근 허용.
import { useEffect, useMemo, useState } from 'react';
import { useV5Auth } from '../../../hooks/useV5Auth.jsx';
import { applyAllOverrides } from './calc/store.js';

import CategoryNav from './calc/CategoryNav.jsx';
import InternetSection from './calc/InternetSection.jsx';
import TvSection from './calc/TvSection.jsx';
import SettopSection from './calc/SettopSection.jsx';
import BundleSection from './calc/BundleSection.jsx';
import InstallSection from './calc/InstallSection.jsx';
import CardSection from './calc/CardSection.jsx';
import SalesPointsSection from './calc/SalesPointsSection.jsx';
import GiftsSection from './calc/GiftsSection.jsx';
import TicketsSection from './calc/TicketsSection.jsx';
import HistorySection from './calc/HistorySection.jsx';

const NAV_ITEMS = [
  { id: 'sec-1',  label: '📡 인터넷·WiFi' },
  { id: 'sec-2',  label: '📺 TV 상품' },
  { id: 'sec-3',  label: '📦 셋톱박스' },
  { id: 'sec-4',  label: '🤝 결합할인' },
  { id: 'sec-5',  label: '🔧 설치비' },
  { id: 'sec-6',  label: '💳 제휴카드' },
  { id: 'sec-7',  label: '💡 영업포인트' },
  { id: 'sec-8',  label: '🎁 사은품' },
  { id: 'sec-9',  label: '🎫 티켓' },
  { id: 'sec-10', label: '📜 변경이력' },
];

export default function CalcData() {
  const { agent } = useV5Auth();
  const role = agent?.role;
  const allowed = role === 'admin' || role === 'manager';

  // 페이지 진입 시 1회 — 모든 localStorage override 적용
  useEffect(() => {
    if (!allowed) return;
    applyAllOverrides();
  }, [allowed]);

  // 섹션 펼침/접힘 상태 (기본 모두 접힘 — vanilla와 동일)
  const [openSections, setOpenSections] = useState(() => ({
    'sec-1': false,
    'sec-2': false,
    'sec-3': false,
    'sec-4': false,
    'sec-5': false,
    'sec-6': false,
    'sec-7': false,
    'sec-8': false,
    'sec-9': false,
    'sec-10': false,
  }));

  // 데이터 변경 시 다른 read-only 섹션(티켓·이력)이 재계산하도록 트리거
  const [refreshKey, setRefreshKey] = useState(0);
  const onChange = () => setRefreshKey((k) => k + 1);

  const toggle = (id) => {
    setOpenSections((s) => ({ ...s, [id]: !s[id] }));
  };

  const jumpTo = (id) => {
    // 해당 섹션 펼치고 스크롤
    setOpenSections((s) => ({ ...s, [id]: true }));
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  if (!allowed) {
    return (
      <div style={{ padding: 40, color: '#fca5a5', background: '#1e293b', borderRadius: 10, border: '1px solid #475569', maxWidth: 520, margin: '40px auto' }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: '#f8fafc', marginBottom: 8 }}>접근 권한이 없습니다</h2>
        <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.6 }}>
          이 페이지는 <b>manager</b> 또는 <b>admin</b> 권한자만 접근할 수 있습니다.
          {role && <> (현재 역할: <code style={{ background: '#0f172a', padding: '1px 6px', borderRadius: 3 }}>{role}</code>)</>}
        </p>
      </div>
    );
  }

  return (
    <div style={{ color: '#e2e8f0', minHeight: '100vh' }}>
      <CategoryNav items={NAV_ITEMS} onJump={jumpTo} />

      <div style={{ marginBottom: 14 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: '#f8fafc', marginBottom: 4 }}>🧮 TM 데이터 관리 (요금 계산기)</h1>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>
          SKT · KT · LGU+ 3사 · 통합 어드민 · 변경 즉시 calc()·티켓 리스트에 반영 · localStorage 영구 저장
        </div>
      </div>

      <InternetSection
        open={openSections['sec-1']}
        onToggle={() => toggle('sec-1')}
        onChange={onChange}
      />
      <TvSection
        open={openSections['sec-2']}
        onToggle={() => toggle('sec-2')}
        onChange={onChange}
      />
      <SettopSection
        open={openSections['sec-3']}
        onToggle={() => toggle('sec-3')}
        onChange={onChange}
      />
      <BundleSection
        open={openSections['sec-4']}
        onToggle={() => toggle('sec-4')}
        onChange={onChange}
      />
      <InstallSection
        open={openSections['sec-5']}
        onToggle={() => toggle('sec-5')}
        onChange={onChange}
      />
      <CardSection
        open={openSections['sec-6']}
        onToggle={() => toggle('sec-6')}
        onChange={onChange}
      />
      <SalesPointsSection
        open={openSections['sec-7']}
        onToggle={() => toggle('sec-7')}
      />
      <GiftsSection
        open={openSections['sec-8']}
        onToggle={() => toggle('sec-8')}
      />
      <TicketsSection
        open={openSections['sec-9']}
        onToggle={() => toggle('sec-9')}
        refreshKey={refreshKey}
      />
      <HistorySection
        open={openSections['sec-10']}
        onToggle={() => toggle('sec-10')}
        refreshKey={refreshKey}
      />
    </div>
  );
}
