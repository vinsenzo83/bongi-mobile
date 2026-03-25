// 어드민 다크 테마 상수 (기존 HTML 목업 CSS 변수 매핑)
export const theme = {
  // 배경
  bg: '#0d0d0d',
  bgCard: '#1a1a1a',
  bgHover: '#252525',
  bgInput: '#1e1e1e',
  bgSidebar: '#111111',
  bgTopbar: '#141414',

  // 텍스트
  text: '#e0e0e0',
  textMuted: '#888',
  textDim: '#666',
  textWhite: '#fff',

  // 브랜드
  blue: '#4a9eff',
  blueHover: '#3a8eef',
  green: '#4ade80',
  greenDim: '#22c55e',
  red: '#f87171',
  redDim: '#ef4444',
  yellow: '#fbbf24',
  orange: '#fb923c',
  purple: '#a78bfa',

  // 보더
  border: '#2a2a2a',
  borderLight: '#333',
  borderFocus: '#4a9eff',

  // 상태 색상
  status: {
    new: '#4a9eff',
    pending: '#fbbf24',
    active: '#4ade80',
    completed: '#22c55e',
    cancelled: '#f87171',
    hold: '#fb923c',
  },

  // 통신사 색상
  carrier: {
    SKT: '#e60012',
    KT: '#1a73e8',
    'LG U+': '#e5007d',
  },

  // 그림자
  shadow: '0 2px 8px rgba(0,0,0,0.3)',
  shadowLg: '0 4px 16px rgba(0,0,0,0.4)',

  // 반경
  radius: 8,
  radiusLg: 12,
  radiusSm: 4,

  // 사이드바
  sidebarWidth: 240,
  sidebarCollapsed: 60,
  topbarHeight: 52,
};

// 공통 스타일 헬퍼
export const flex = (gap = 8, direction = 'row') => ({
  display: 'flex',
  flexDirection: direction,
  gap,
});

export const card = {
  background: theme.bgCard,
  border: `1px solid ${theme.border}`,
  borderRadius: theme.radiusLg,
  padding: 16,
};

export const input = {
  background: theme.bgInput,
  border: `1px solid ${theme.border}`,
  borderRadius: theme.radius,
  color: theme.text,
  padding: '8px 12px',
  fontSize: 14,
  outline: 'none',
  width: '100%',
};

export const button = {
  primary: {
    background: theme.blue,
    color: '#fff',
    border: 'none',
    borderRadius: theme.radius,
    padding: '8px 16px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  secondary: {
    background: 'transparent',
    color: theme.text,
    border: `1px solid ${theme.border}`,
    borderRadius: theme.radius,
    padding: '8px 16px',
    fontSize: 14,
    cursor: 'pointer',
  },
  danger: {
    background: theme.red,
    color: '#fff',
    border: 'none',
    borderRadius: theme.radius,
    padding: '8px 16px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
};
