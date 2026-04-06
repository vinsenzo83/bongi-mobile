import { useState } from 'react';
import { theme, card, button, statusStyle } from '../../styles/admin-theme.js';

const STORAGE_KEY = 'bongi_feature_checklist';

const sections = [
  {
    title: '인증/회원',
    items: [
      { id: 'auth-1', label: '카카오 로그인', status: '완료' },
      { id: 'auth-2', label: '구글 로그인', status: '완료' },
      { id: 'auth-3', label: 'PASS 인증 (본인확인)', status: '진행중' },
      { id: 'auth-4', label: '회원 CRUD', status: '완료' },
      { id: 'auth-5', label: '회원 등급 관리', status: '진행중' },
      { id: 'auth-6', label: '비회원 → 회원 전환', status: '미시작' },
      { id: 'auth-7', label: '탈퇴 처리', status: '완료' },
      { id: 'auth-8', label: '관리자 권한 분리', status: '진행중' },
    ],
  },
  {
    title: '상품 관리',
    items: [
      { id: 'prod-1', label: '인터넷 상품 CRUD', status: '완료' },
      { id: 'prod-2', label: 'TV 상품 CRUD', status: '완료' },
      { id: 'prod-3', label: '렌탈 상품 CRUD', status: '완료' },
      { id: 'prod-4', label: '중고폰 CRUD', status: '진행중' },
      { id: 'prod-5', label: '모바일 요금제 관리', status: '완료' },
      { id: 'prod-6', label: '공시지원금 데이터', status: '완료' },
      { id: 'prod-7', label: '가족결합 데이터', status: '완료' },
      { id: 'prod-8', label: '결합할인 시뮬레이터', status: '진행중' },
    ],
  },
  {
    title: 'AI 챗봇',
    items: [
      { id: 'ai-1', label: '요금제 검색/추천', status: '진행중' },
      { id: 'ai-2', label: '결합할인 안내', status: '미시작' },
      { id: 'ai-3', label: '매장 조회', status: '미시작' },
      { id: 'ai-4', label: '가입 상담 플로우', status: '미시작' },
      { id: 'ai-5', label: '해지 방어 시나리오', status: '미시작' },
      { id: 'ai-6', label: 'FAQ 자동응답', status: '진행중' },
      { id: 'ai-7', label: '상담사 에스컬레이션', status: '미시작' },
      { id: 'ai-8', label: 'AI 학습 데이터 관리', status: '완료' },
    ],
  },
  {
    title: '어드민',
    items: [
      { id: 'admin-1', label: '대시보드', status: '완료' },
      { id: 'admin-2', label: '회원관리', status: '완료' },
      { id: 'admin-3', label: '상품관리 (캐리어)', status: '완료' },
      { id: 'admin-4', label: '렌탈 관리', status: '완료' },
      { id: 'admin-5', label: '계약/신청 관리', status: '완료' },
      { id: 'admin-6', label: '수수료 정산', status: '완료' },
      { id: 'admin-7', label: '사은품 관리', status: '완료' },
      { id: 'admin-8', label: '인센티브 관리', status: '완료' },
      { id: 'admin-9', label: '크롤링 관리', status: '진행중' },
      { id: 'admin-10', label: '기능 체크리스트', status: '완료' },
    ],
  },
  {
    title: 'CRM',
    items: [
      { id: 'crm-1', label: '신청 파이프라인', status: '완료' },
      { id: 'crm-2', label: '티켓 관리', status: '진행중' },
      { id: 'crm-3', label: '알림 발송 (카카오톡)', status: '미시작' },
      { id: 'crm-4', label: '알림 발송 (SMS)', status: '미시작' },
      { id: 'crm-5', label: '고객 상세 타임라인', status: '완료' },
      { id: 'crm-6', label: 'CTI 콘솔', status: '진행중' },
      { id: 'crm-7', label: '리뷰 관리', status: '완료' },
      { id: 'crm-8', label: '추천인 관리', status: '완료' },
      { id: 'crm-9', label: 'KPI 대시보드', status: '완료' },
    ],
  },
];

function loadChecked() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export default function FeatureChecklist() {
  const [checked, setChecked] = useState(() => loadChecked());
  const [collapsed, setCollapsed] = useState({});

  const allItems = sections.flatMap(s => s.items);
  const total = allItems.length;
  const completedCount = allItems.filter(i => i.status === '완료').length;
  const inProgressCount = allItems.filter(i => i.status === '진행중').length;
  const notStartedCount = allItems.filter(i => i.status === '미시작').length;
  const checkedCount = Object.keys(checked).filter(k => checked[k]).length;
  const progress = Math.round((checkedCount / total) * 100);

  const toggleCheck = (id) => {
    const next = { ...checked, [id]: !checked[id] };
    setChecked(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const toggleCollapse = (title) => {
    setCollapsed({ ...collapsed, [title]: !collapsed[title] });
  };

  const statusColor = (s) => s === '완료' ? 'green' : s === '진행중' ? 'orange' : 'gray';

  const kpiCard = {
    background: '#fff', border: `1px solid ${theme.border}`, borderRadius: 10, padding: 16, textAlign: 'center',
  };

  return (
    <div style={{ padding: 24, fontFamily: theme.sans, background: theme.bg, minHeight: '100vh' }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: theme.text, marginBottom: 20 }}>기능 체크리스트</h1>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 16 }}>
        <div style={kpiCard}>
          <div style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 6 }}>전체</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: theme.navy, fontFamily: 'monospace' }}>{total}</div>
        </div>
        <div style={kpiCard}>
          <div style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 6 }}>완료</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: theme.green, fontFamily: 'monospace' }}>{completedCount}</div>
        </div>
        <div style={kpiCard}>
          <div style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 6 }}>진행중</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: theme.orange, fontFamily: 'monospace' }}>{inProgressCount}</div>
        </div>
        <div style={kpiCard}>
          <div style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 6 }}>미시작</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: theme.textMuted, fontFamily: 'monospace' }}>{notStartedCount}</div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: theme.text }}>체크 진행률</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: theme.blue }}>{checkedCount}/{total} ({progress}%)</span>
        </div>
        <div style={{ background: '#e5e7eb', borderRadius: 6, height: 10, overflow: 'hidden' }}>
          <div style={{
            width: `${progress}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${theme.blue}, ${theme.green})`,
            borderRadius: 6,
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      {/* Sections */}
      {sections.map(section => {
        const isCollapsed = collapsed[section.title];
        const sectionChecked = section.items.filter(i => checked[i.id]).length;
        return (
          <div key={section.title} style={{ ...card, marginBottom: 12 }}>
            <div
              style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => toggleCollapse(section.title)}
            >
              <span style={{ fontSize: 14, marginRight: 8, color: theme.textSecondary }}>
                {isCollapsed ? '\u25B6' : '\u25BC'}
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: theme.text, flex: 1 }}>
                {section.title}
              </span>
              <span style={{ fontSize: 11, color: theme.textSecondary }}>
                {sectionChecked}/{section.items.length}
              </span>
            </div>
            {!isCollapsed && (
              <div style={{ marginTop: 12 }}>
                {section.items.map(item => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 0',
                      borderBottom: `1px solid ${theme.border}`,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!checked[item.id]}
                      onChange={() => toggleCheck(item.id)}
                      style={{ width: 16, height: 16, cursor: 'pointer', accentColor: theme.blue }}
                    />
                    <span style={{
                      fontSize: 13,
                      color: checked[item.id] ? theme.textMuted : theme.text,
                      textDecoration: checked[item.id] ? 'line-through' : 'none',
                      flex: 1,
                    }}>
                      {item.label}
                    </span>
                    <span style={statusStyle(statusColor(item.status))}>{item.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
