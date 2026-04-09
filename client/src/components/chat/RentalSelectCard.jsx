import { useState } from 'react';

const CATEGORIES = [
  { key: '정수기', icon: '💧', desc: '냉온정/냉정/온정' },
  { key: '공기청정기', icon: '🌬️', desc: '가정용/대형' },
  { key: 'TV', icon: '📺', desc: 'OLED/QLED/스탠바이미' },
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

export default function RentalSelectCard({ onComplete }) {
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');

  const handleComplete = (selectedBrand) => {
    const query = `${category} ${selectedBrand} 렌탈 상품 추천해줘`;
    onComplete(query);
  };

  return (
    <div style={s.card}>
      {/* 프로그래스 */}
      <div style={s.progress}>
        {['카테고리', '브랜드'].map((label, i) => (
          <div key={label} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ ...s.dot, background: i + 1 <= step ? '#10b981' : '#e8e8e8', color: i + 1 <= step ? '#fff' : '#999' }}>{i + 1}</div>
            <div style={{ fontSize: 10, color: i + 1 === step ? '#10b981' : '#999', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* 스텝 1: 카테고리 */}
      {step === 1 && (
        <div>
          <div style={s.stepTitle}>어떤 가전을 찾으시나요?</div>
          <div style={s.grid}>
            {CATEGORIES.map(c => (
              <button key={c.key} onClick={() => { setCategory(c.key); setStep(2); }} style={s.catBtn}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>{c.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 12 }}>{c.key}</div>
                <div style={{ fontSize: 9, color: '#999' }}>{c.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 스텝 2: 브랜드 */}
      {step === 2 && (
        <div>
          <div style={s.stepTitle}>브랜드를 선택하세요</div>
          <div style={s.selectedInfo}>{category}</div>
          <div style={s.options}>
            <button onClick={() => handleComplete('전체')} style={{ ...s.optionBtn, borderColor: '#10b981' }}>
              <span style={{ fontSize: 14 }}>🔍</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>전체 브랜드</div>
                <div style={{ fontSize: 11, color: '#999' }}>{category} 전체 보기</div>
              </div>
            </button>
            {(BRANDS[category] || []).map(b => (
              <button key={b} onClick={() => handleComplete(b)} style={s.optionBtn}>
                <span style={{ fontSize: 14 }}>🏷️</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{b}</div>
                </div>
              </button>
            ))}
          </div>
          <button onClick={() => setStep(1)} style={{ ...s.backBtn, width: '100%' }}>{'←'} 이전</button>
        </div>
      )}
    </div>
  );
}

const s = {
  card: { background: '#fff', border: '1px solid #e8e8e8', borderRadius: 12, padding: 16, maxWidth: 340 },
  progress: { display: 'flex', gap: 4, marginBottom: 14 },
  dot: { width: 22, height: 22, borderRadius: '50%', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 },
  stepTitle: { fontSize: 14, fontWeight: 700, color: '#1a2744', marginBottom: 12 },
  selectedInfo: { fontSize: 11, color: '#10b981', background: '#d1fae5', borderRadius: 6, padding: '4px 10px', marginBottom: 10, display: 'inline-block' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 },
  catBtn: { padding: '12px 8px', borderRadius: 10, border: '1.5px solid #e8e8e8', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' },
  options: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 },
  optionBtn: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e8e8e8', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, color: '#1a1a1a', textAlign: 'left', width: '100%' },
  backBtn: { height: 40, borderRadius: 8, border: '1px solid #d0d0d0', background: '#fff', color: '#555', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: '0 16px' },
};
