import { useState } from 'react';
import { colors, fonts, sheetStyles } from './designTokens';

const CATEGORIES = [
  { key: '정수기', icon: '💧', desc: '냉온정/냉정/온정' },
  { key: '공기청정기', icon: '🌬️', desc: '가정용/대형' },
  { key: 'TV', icon: '📺', desc: 'OLED/QLED' },
  { key: '세탁기', icon: '🧺', desc: '드럼/통돌이' },
  { key: '건조기', icon: '☀️', desc: '히트펌프/전기식' },
  { key: '세탁기+건조기', icon: '🧺☀️', desc: '세트 할인' },
  { key: '노트북', icon: '💻', desc: '사무용/게이밍' },
  { key: '안마의자', icon: '🪑', desc: '안마의자/안마기' },
  { key: '비데', icon: '🚽', desc: '방수/건조' },
  { key: '매트리스', icon: '🛏️', desc: '라텍스/메모리폼' },
  { key: '로봇청소기', icon: '🤖', desc: '물걸레/흡입' },
  { key: '식기세척기', icon: '🍽️', desc: '빌트인/프리스탠딩' },
];

const BRANDS = {
  '정수기': ['코웨이', 'LG', '쿠쿠', 'SK인텔릭스'],
  '공기청정기': ['LG', '코웨이', '삼성', '위닉스'],
  'TV': ['LG', '삼성'],
  '세탁기': ['LG', '삼성'],
  '건조기': ['LG', '삼성'],
  '세탁기+건조기': ['LG', '삼성'],
  '노트북': ['LG', '삼성', '레노버'],
  '안마의자': ['코웨이', '바디프랜드'],
  '비데': ['코웨이', '노비타'],
  '매트리스': ['코웨이', '시몬스'],
  '로봇청소기': ['LG', '삼성', '로보락'],
  '식기세척기': ['LG', '삼성', '쿠쿠'],
};

export default function RentalSelectCard({ onComplete, onClose }) {
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState('');

  const handleComplete = (selectedBrand) => {
    const query = `${category} ${selectedBrand} 렌탈 상품 추천해줘`;
    onComplete(query);
  };

  return (
    <div style={s.sheet}>
      {/* Handle bar */}
      <div style={sheetStyles.handle} />

      {/* Header: title + close */}
      <div style={s.header}>
        <div style={sheetStyles.title}>렌탈 상품 조회</div>
        {onClose && (
          <button style={sheetStyles.closeBtn} onClick={onClose}>X</button>
        )}
      </div>

      {/* Progress steps */}
      <div style={sheetStyles.progressWrap}>
        <div style={sheetStyles.stepLabel(step === 1)}>
          <span style={sheetStyles.stepNumber(step === 1)}>01</span> STEP
        </div>
        <div style={sheetStyles.stepDivider} />
        <div style={sheetStyles.stepLabel(step === 2)}>
          <span style={sheetStyles.stepNumber(step === 2)}>02</span> STEP
        </div>
      </div>

      {/* Step 1: Category selection */}
      {step === 1 && (
        <div>
          <div style={sheetStyles.sectionTitle}>어떤 가전을 찾으시나요?</div>
          <div style={s.grid}>
            {CATEGORIES.map(c => (
              <button
                key={c.key}
                onClick={() => { setCategory(c.key); setStep(2); }}
                style={s.catBtn}
              >
                <div style={s.catIcon}>{c.icon}</div>
                <div style={s.catName}>{c.key}</div>
                <div style={s.catDesc}>{c.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Brand selection */}
      {step === 2 && (
        <div>
          <div style={sheetStyles.sectionTitle}>브랜드를 선택하세요</div>
          <div style={sheetStyles.selectedBadge}>
            {CATEGORIES.find(c => c.key === category)?.icon} {category}
          </div>
          <div style={s.brandList}>
            {/* All brands option */}
            <button
              onClick={() => handleComplete('전체')}
              style={{ ...sheetStyles.optionCard, ...sheetStyles.optionCardActive }}
            >
              <div style={sheetStyles.logoCircle(colors.primaryLight)}>
                <span style={{ fontSize: 18 }}>🔍</span>
              </div>
              <div>
                <div style={s.brandName}>전체 브랜드</div>
                <div style={s.brandSub}>{category} 전체 보기</div>
              </div>
            </button>

            {/* Individual brands */}
            {(BRANDS[category] || []).map(b => (
              <button
                key={b}
                onClick={() => handleComplete(b)}
                style={sheetStyles.optionCard}
              >
                <div style={sheetStyles.logoCircle(colors.surface)}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: colors.text }}>{b[0]}</span>
                </div>
                <div>
                  <div style={s.brandName}>{b}</div>
                </div>
              </button>
            ))}
          </div>

          <button onClick={() => setStep(1)} style={sheetStyles.backBtn}>
            ← 이전
          </button>
        </div>
      )}
    </div>
  );
}

const s = {
  sheet: {
    background: colors.white,
    borderRadius: '16px 16px 0 0',
    padding: '16px 20px 24px',
    maxHeight: '85vh',
    overflowY: 'auto',
    fontFamily: fonts.family,
    position: 'relative',
  },
  header: {
    position: 'relative',
    marginBottom: 4,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 10,
    marginBottom: 12,
  },
  catBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '14px 4px 10px',
    borderRadius: 12,
    border: `1.5px solid ${colors.border}`,
    background: colors.white,
    cursor: 'pointer',
    fontFamily: fonts.family,
    textAlign: 'center',
    aspectRatio: '1 / 1',
    minHeight: 0,
  },
  catIcon: {
    fontSize: 26,
    marginBottom: 6,
    lineHeight: 1,
  },
  catName: {
    fontWeight: 700,
    fontSize: 11,
    color: colors.text,
    lineHeight: 1.3,
    wordBreak: 'keep-all',
  },
  catDesc: {
    fontSize: 9,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 1.2,
  },
  brandList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    marginBottom: 8,
  },
  brandName: {
    fontWeight: 700,
    fontSize: 14,
    color: colors.text,
  },
  brandSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
};
