import { useState } from 'react';

const CARRIERS = ['SKT', 'KT', 'LG U+'];
const SPEEDS = ['100M', '500M', '1G'];
const TVS = {
  'SKT': ['TV 없음 (인터넷만)', 'Btv 이코노미', 'Btv 스탠다드', 'Btv 올', 'Btv 올+', 'Btv 올 넷플릭스'],
  'KT': ['TV 없음 (인터넷만)', '지니TV 베이직', '지니TV 라이트', '지니TV 모든G', '지니TV 디즈니+모든G', '지니TV+넷플릭스HD'],
  'LG U+': ['TV 없음 (인터넷만)', '실속형', '기본형', '프리미엄', '프리미엄 디즈니+', '프리미엄 넷플릭스HD', '프리미엄 넷플릭스UHD'],
};

export default function InternetSelectCard({ onComplete }) {
  const [step, setStep] = useState(1);
  const [carrier, setCarrier] = useState('');
  const [speed, setSpeed] = useState('');
  const [tv, setTv] = useState('');

  const handleComplete = (selectedTv) => {
    const tvPart = selectedTv.includes('없음') ? '' : ' ' + selectedTv;
    const query = `${carrier} 인터넷 ${speed}${tvPart} 사은품 알려줘`;
    onComplete(query);
  };

  return (
    <div style={s.card}>
      {/* 프로그래스 */}
      <div style={s.progress}>
        {['통신사', '속도', 'TV'].map((label, i) => (
          <div key={label} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ ...s.dot, background: i + 1 <= step ? '#2563eb' : '#e8e8e8', color: i + 1 <= step ? '#fff' : '#999' }}>{i + 1}</div>
            <div style={{ fontSize: 10, color: i + 1 === step ? '#2563eb' : '#999', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* 스텝 1: 통신사 */}
      {step === 1 && (
        <div>
          <div style={s.stepTitle}>통신사를 선택하세요</div>
          <div style={s.options}>
            {CARRIERS.map(c => (
              <button key={c} onClick={() => { setCarrier(c); setStep(2); }} style={s.optionBtn}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: c === 'SKT' ? '#fee2e2' : c === 'KT' ? '#dbeafe' : '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: c === 'SKT' ? '#ef4444' : c === 'KT' ? '#2563eb' : '#10b981', flexShrink: 0 }}>
                  {c === 'LG U+' ? 'LG' : c}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{c}</div>
                  <div style={{ fontSize: 11, color: '#999' }}>
                    {c === 'SKT' ? 'Btv + 온가족할인' : c === 'KT' ? '지니TV + 총액가족결합' : 'U+tv + 참쉬운가족결합'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 스텝 2: 속도 */}
      {step === 2 && (
        <div>
          <div style={s.stepTitle}>인터넷 속도를 선택하세요</div>
          <div style={s.selectedInfo}>{carrier}</div>
          <div style={s.options}>
            {SPEEDS.map(sp => (
              <button key={sp} onClick={() => { setSpeed(sp); setStep(3); }} style={s.optionBtn}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#1a2744', flexShrink: 0 }}>
                  {sp}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{sp}</div>
                  <div style={{ fontSize: 11, color: '#999' }}>
                    {sp === '100M' ? '1~2인 기본 (웹서핑, 유튜브)' : sp === '500M' ? '2~3인 추천 (넷플릭스, 재택)' : '4인+ 추천 (게임, 4K 스트리밍)'}
                  </div>
                </div>
              </button>
            ))}
          </div>
          <button onClick={() => setStep(1)} style={{ ...s.backBtn, width: '100%' }}>{'←'} 이전</button>
        </div>
      )}

      {/* 스텝 3: TV */}
      {step === 3 && (
        <div>
          <div style={s.stepTitle}>TV 상품을 선택하세요</div>
          <div style={s.selectedInfo}>{carrier} · {speed}</div>
          <div style={s.options}>
            {(TVS[carrier] || TVS['SKT']).map(t => (
              <button key={t} onClick={() => handleComplete(t)} style={{ ...s.optionBtn, padding: '10px 14px' }}>
                <span style={{ fontSize: 13 }}>{t.includes('없음') ? '🚫' : '📺'}</span>
                <span style={{ fontSize: 13 }}>{t}</span>
              </button>
            ))}
          </div>
          <button onClick={() => setStep(2)} style={{ ...s.backBtn, width: '100%' }}>{'←'} 이전</button>
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
  selectedInfo: { fontSize: 11, color: '#2563eb', background: '#dbeafe', borderRadius: 6, padding: '4px 10px', marginBottom: 10, display: 'inline-block' },
  options: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 },
  optionBtn: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e8e8e8', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, color: '#1a1a1a', textAlign: 'left', width: '100%' },
  backBtn: { height: 40, borderRadius: 8, border: '1px solid #d0d0d0', background: '#fff', color: '#555', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: '0 16px' },
};
