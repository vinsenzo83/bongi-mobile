// 피그마 "상품별 카드UI/UX" 기준 디자인 토큰
export const colors = {
  primary: '#3617ce',       // 메인 보라
  primaryLight: '#ede9fc',  // 보라 연한 배경
  danger: '#ff404e',        // 최종요금, 할인 빨강
  bestBadge: '#ff383c',     // BEST 배지
  success: '#00df30',       // 최저요금 배지
  yellow: '#fece09',        // 사은품 배경
  white: '#ffffff',
  black: '#000000',
  text: '#201d1d',          // 본문 텍스트
  textSecondary: '#767676', // 부가 텍스트
  border: '#e5e7eb',        // 구분선, 입력 테두리
  surface: '#f5f5f5',       // 배경 서피스
  surfaceBlue: '#f0f3f8',   // 연한 파란 배경
  // 통신사별 배지 색상
  skt: '#3617ce',
  kt: '#000000',
  lgu: '#e40981',
  // 렌탈 배지
  rental: '#fece09',
  rentalText: '#201d1d',
  // 등급별 색상
  gradeA: '#3617ce',
  gradeB: '#19923e',
  gradeC: '#190b54',
  gradeD: '#e40981',
  gradeE: '#616161',
};

export const fonts = {
  family: "'Paperlogy', 'Noto Sans KR', -apple-system, sans-serif",
};

// 공통 바텀시트 모달 스타일
export const sheetStyles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    zIndex: 1500, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  },
  container: {
    width: '100%', maxWidth: 420, animation: 'slideUp 0.25s ease',
  },
  sheet: {
    background: '#fff', borderRadius: '16px 16px 0 0',
    padding: '16px 20px 24px', maxHeight: '85vh', overflowY: 'auto',
    fontFamily: fonts.family,
  },
  handle: {
    width: 36, height: 4, background: colors.border, borderRadius: 2,
    margin: '0 auto 16px',
  },
  title: {
    fontSize: 16, fontWeight: 600, color: colors.primary,
    textAlign: 'center', marginBottom: 20,
  },
  closeBtn: {
    position: 'absolute', top: 16, right: 16,
    width: 30, height: 30, borderRadius: '50%', background: colors.surface,
    border: 'none', fontSize: 12, color: colors.primary,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Gmarket Sans', sans-serif",
  },
  // 프로그래스 스텝
  progressWrap: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 24, gap: 0,
  },
  stepLabel: (active) => ({
    flex: 1, textAlign: 'center',
    color: active ? colors.primary : colors.textSecondary,
    fontSize: 12, fontWeight: active ? 700 : 300,
  }),
  stepNumber: (active) => ({
    fontSize: 14, fontWeight: 700,
    color: active ? colors.primary : colors.textSecondary,
  }),
  stepDivider: {
    width: 1, height: 30, background: colors.border,
    borderLeft: '1px dashed #d0d0d0', margin: '0 4px',
  },
  // 섹션 타이틀
  sectionTitle: {
    fontSize: 14, fontWeight: 700, color: colors.black, marginBottom: 12,
  },
  // 옵션 카드
  optionCard: {
    display: 'flex', alignItems: 'center', gap: 14,
    padding: '14px 16px', border: `1.5px solid ${colors.border}`,
    borderRadius: 12, background: colors.white, cursor: 'pointer',
    fontFamily: fonts.family, fontSize: 14, color: colors.text,
    textAlign: 'left', width: '100%', marginBottom: 8,
  },
  optionCardActive: {
    borderColor: colors.primary,
  },
  // 로고 원형
  logoCircle: (bg) => ({
    width: 40, height: 40, borderRadius: '50%', background: bg || colors.surface,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, overflow: 'hidden',
  }),
  // 가격 텍스트
  price: {
    fontSize: 13, fontWeight: 600, color: colors.primary,
  },
  priceSmall: {
    fontSize: 11, color: colors.textSecondary,
  },
  // 뒤로가기 버튼
  backBtn: {
    width: '100%', height: 44, borderRadius: 10,
    border: `1px solid ${colors.border}`, background: colors.white,
    color: colors.textSecondary, fontSize: 13, cursor: 'pointer',
    fontFamily: fonts.family, marginTop: 8,
  },
  // 선택 정보 뱃지
  selectedBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontSize: 12, color: colors.primary, background: colors.primaryLight,
    borderRadius: 8, padding: '5px 12px', marginBottom: 14, fontWeight: 500,
  },
};
