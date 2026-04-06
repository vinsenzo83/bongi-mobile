// 어드민 라이트 테마 (wireframe-admin.html 기준)
export const theme = {
  // 배경
  bg: '#f8f9fc',
  bgCard: '#ffffff',
  bgHover: 'rgba(96,165,250,0.08)',
  bgInput: '#fafafa',
  bgSidebar: '#0f172a',
  bgTopbar: '#ffffff',

  // 텍스트
  text: '#1a1a1a',
  textSecondary: '#555',
  textMuted: '#999',
  textWhite: '#fff',
  textDim: 'rgba(255,255,255,0.25)',

  // 브랜드
  navy: '#1a2744',
  blue: '#2563eb',
  blueBg: '#dbeafe',
  green: '#10b981',
  greenBg: '#d1fae5',
  red: '#ef4444',
  redBg: '#fee2e2',
  orange: '#d97706',
  orangeBg: '#fef3c7',
  purple: '#7c3aed',
  purpleBg: '#ede9fe',

  // 보더
  border: '#e8e8e8',
  borderDark: '#d0d0d0',

  // 상태 색상
  status: {
    blue: { bg: '#dbeafe', color: '#2563eb' },
    green: { bg: '#d1fae5', color: '#10b981' },
    orange: { bg: '#fef3c7', color: '#d97706' },
    red: { bg: '#fee2e2', color: '#ef4444' },
    gray: { bg: '#f3f4f6', color: '#6b7280' },
    navy: { bg: '#e0e7ff', color: '#1a2744' },
  },

  // 통신사 색상
  carrier: {
    SKT: '#e60012',
    KT: '#1a73e8',
    'LG U+': '#e5007d',
  },

  // 그림자
  shadow: '0 1px 3px rgba(0,0,0,0.08)',
  shadowLg: '0 4px 24px rgba(0,0,0,0.1)',

  // 반경
  radius: 8,
  radiusLg: 12,
  radiusSm: 4,

  // 사이드바
  sidebarWidth: 200,
  sidebarCollapsed: 60,
  topbarHeight: 48,

  // 폰트
  sans: "'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

// 공통 스타일 헬퍼
export const card = {
  background: theme.bgCard,
  border: `1px solid ${theme.border}`,
  borderRadius: 10,
  padding: 16,
};

export const input = {
  background: theme.bgInput,
  border: `1.5px solid ${theme.borderDark}`,
  borderRadius: 6,
  color: theme.text,
  padding: '8px 12px',
  fontSize: 12,
  outline: 'none',
  width: '100%',
  fontFamily: theme.sans,
};

export const button = {
  primary: {
    background: theme.navy,
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '6px 14px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: theme.sans,
  },
  secondary: {
    background: '#fff',
    color: theme.textSecondary,
    border: `1px solid ${theme.borderDark}`,
    borderRadius: 6,
    padding: '6px 14px',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: theme.sans,
  },
  danger: {
    background: theme.redBg,
    color: theme.red,
    border: 'none',
    borderRadius: 6,
    padding: '5px 12px',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: theme.sans,
  },
  success: {
    background: theme.greenBg,
    color: theme.green,
    border: 'none',
    borderRadius: 6,
    padding: '5px 12px',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: theme.sans,
  },
};

// 상태 뱃지
export function statusStyle(type) {
  const s = theme.status[type] || theme.status.gray;
  return {
    display: 'inline-block',
    fontSize: 10,
    padding: '2px 7px',
    borderRadius: 20,
    fontWeight: 700,
    background: s.bg,
    color: s.color,
  };
}

// KPI 카드 스타일
export const kpiCard = {
  background: '#fff',
  border: `1px solid ${theme.border}`,
  borderRadius: 10,
  padding: 16,
  textAlign: 'center',
};

// 테이블 스타일
export const tableStyles = {
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 12,
  },
  th: {
    background: '#f1f5f9',
    color: '#475569',
    fontWeight: 700,
    padding: '8px 12px',
    textAlign: 'left',
    border: `1px solid ${theme.border}`,
    fontSize: 11,
  },
  td: {
    padding: '8px 12px',
    border: `1px solid ${theme.border}`,
    color: theme.textSecondary,
    verticalAlign: 'middle',
  },
};

// 필터 버튼 스타일
export const filterBtn = (active) => ({
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
