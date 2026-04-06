import { useState } from 'react';

const CARRIERS = ['SKT', 'KT', 'LG U+'];
const OPEN_TYPES = ['번호이동', '기기변경'];
const SAMSUNG_MODELS = [
  '갤럭시 S26 Ultra', '갤럭시 S26+', '갤럭시 S26',
  '갤럭시 Z폴드7', '갤럭시 Z플립7',
  '갤럭시 S25 Ultra', '갤럭시 S25+', '갤럭시 S25',
];
const APPLE_MODELS = [
  '아이폰 17 Pro Max', '아이폰 17 Pro', '아이폰 17', '아이폰 17 Air',
  '아이폰 16 Pro Max', '아이폰 16 Pro', '아이폰 16',
];

export default function PhoneSelectCard({ onComplete }) {
  const [step, setStep] = useState(1);
  const [carrier, setCarrier] = useState('');
  const [openType, setOpenType] = useState('');
  const [maker, setMaker] = useState('');
  const [model, setModel] = useState('');

  const handleComplete = (selectedModel) => {
    const query = `${selectedModel} 3사 전체 ${openType} 시세 비교해줘 (현재 ${carrier} 사용중)`;
    onComplete(query);
  };

  return (
    <div style={s.card}>
      {/* 프로그래스 */}
      <div style={s.progress}>
        {['통신사', '개통유형', '제조사', '기종'].map((label, i) => (
          <div key={label} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ ...s.dot, background: i + 1 <= step ? '#2563eb' : '#e8e8e8', color: i + 1 <= step ? '#fff' : '#999' }}>{i + 1}</div>
            <div style={{ fontSize: 9, color: i + 1 === step ? '#2563eb' : '#999', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* 스텝 1: 통신사 */}
      {step === 1 && (
        <div>
          <div style={s.stepTitle}>현재 사용중인 통신사를 선택하세요</div>
          <div style={s.options}>
            {CARRIERS.map(c => (
              <button key={c} onClick={() => setCarrier(c)} style={{ ...s.optionBtn, ...(carrier === c ? s.optionActive : {}) }}>
                <span style={{ ...s.checkbox, ...(carrier === c ? s.checkboxActive : {}) }}>
                  {carrier === c ? '✓' : ''}
                </span>
                {c}
              </button>
            ))}
          </div>
          <button onClick={() => carrier && setStep(2)} disabled={!carrier} style={{ ...s.nextBtn, opacity: carrier ? 1 : 0.4 }}>
            다음
          </button>
        </div>
      )}

      {/* 스텝 2: 개통유형 */}
      {step === 2 && (
        <div>
          <div style={s.stepTitle}>개통 유형을 선택하세요</div>
          <div style={s.selectedInfo}>{'📡'} {carrier}</div>
          <div style={s.options}>
            {OPEN_TYPES.map(t => (
              <button key={t} onClick={() => setOpenType(t)} style={{ ...s.optionBtn, ...(openType === t ? s.optionActive : {}) }}>
                <span style={{ ...s.checkbox, ...(openType === t ? s.checkboxActive : {}) }}>
                  {openType === t ? '✓' : ''}
                </span>
                <div>
                  <div style={{ fontWeight: 600 }}>{t}</div>
                  <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>
                    {t === '번호이동' ? '다른 통신사에서 옮겨오기' : '같은 통신사에서 기기만 변경'}
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div style={s.btnRow}>
            <button onClick={() => setStep(1)} style={s.backBtn}>{'←'} 이전</button>
            <button onClick={() => openType && setStep(3)} disabled={!openType} style={{ ...s.nextBtn, flex: 1, opacity: openType ? 1 : 0.4 }}>다음</button>
          </div>
        </div>
      )}

      {/* 스텝 3: 제조사 */}
      {step === 3 && (
        <div>
          <div style={s.stepTitle}>제조사를 선택하세요</div>
          <div style={s.selectedInfo}>{'📡'} {carrier} · {openType}</div>
          <div style={s.options}>
            {[['삼성', '갤럭시 시리즈'], ['애플', '아이폰 시리즈']].map(([m, desc]) => (
              <button key={m} onClick={() => { setMaker(m); setStep(4); }} style={{ ...s.optionBtn, ...(maker === m ? s.optionActive : {}) }}>
                <span style={{ fontSize: 20, marginRight: 8 }}>{m === '삼성' ? '📱' : '🍎'}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{m}</div>
                  <div style={{ fontSize: 11, color: '#999' }}>{desc}</div>
                </div>
              </button>
            ))}
          </div>
          <button onClick={() => setStep(2)} style={{ ...s.backBtn, width: '100%' }}>{'←'} 이전</button>
        </div>
      )}

      {/* 스텝 4: 기종 선택 */}
      {step === 4 && (
        <div>
          <div style={s.stepTitle}>기종을 선택하세요</div>
          <div style={s.selectedInfo}>{'📡'} {carrier} · {openType} · {maker}</div>
          <div style={s.modelGrid}>
            {(maker === '삼성' ? SAMSUNG_MODELS : APPLE_MODELS).map(m => (
              <button key={m} onClick={() => handleComplete(m)} style={s.modelBtn}>
                {m}
              </button>
            ))}
          </div>
          <button onClick={() => setStep(3)} style={{ ...s.backBtn, width: '100%' }}>{'←'} 이전</button>
        </div>
      )}
    </div>
  );
}

const s = {
  card: {
    background: '#fff', border: '1px solid #e8e8e8', borderRadius: 12,
    padding: 16, maxWidth: 340,
  },
  progress: { display: 'flex', gap: 4, marginBottom: 14 },
  dot: {
    width: 22, height: 22, borderRadius: '50%', margin: '0 auto',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 10, fontWeight: 700,
  },
  stepTitle: { fontSize: 14, fontWeight: 700, color: '#1a2744', marginBottom: 12 },
  selectedInfo: {
    fontSize: 11, color: '#2563eb', background: '#dbeafe', borderRadius: 6,
    padding: '4px 10px', marginBottom: 10, display: 'inline-block',
  },
  options: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 },
  optionBtn: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
    borderRadius: 10, border: '1.5px solid #e8e8e8', background: '#fff',
    cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, color: '#1a1a1a',
    textAlign: 'left', transition: 'all 0.15s',
  },
  optionActive: { borderColor: '#2563eb', background: '#eff6ff' },
  checkbox: {
    width: 20, height: 20, borderRadius: 4, border: '2px solid #d0d0d0',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, color: 'transparent', flexShrink: 0,
  },
  checkboxActive: { background: '#2563eb', borderColor: '#2563eb', color: '#fff' },
  nextBtn: {
    width: '100%', height: 44, borderRadius: 10, border: 'none',
    background: '#2563eb', color: '#fff', fontSize: 14, fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  backBtn: {
    height: 40, borderRadius: 8, border: '1px solid #d0d0d0', background: '#fff',
    color: '#555', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: '0 16px',
  },
  btnRow: { display: 'flex', gap: 8 },
  modelGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12,
  },
  modelBtn: {
    padding: '12px 8px', borderRadius: 10, border: '1.5px solid #e8e8e8',
    background: '#fff', fontSize: 12, fontWeight: 600, color: '#1a2744',
    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
    transition: 'all 0.15s',
  },
};
