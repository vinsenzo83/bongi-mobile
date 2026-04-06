import { useState } from 'react';

const MAKERS = ['Apple', '삼성전자', 'LG'];

const SERIES = {
  'Apple': ['iPhone 17', 'iPhone 16', 'iPhone 15', 'iPhone 14', 'iPhone 13', 'iPhone 12', 'iPhone 11', 'iPhone SE', 'iPhone X'],
  '삼성전자': ['갤럭시 S26', '갤럭시 S25', '갤럭시 S24', '갤럭시 S23', '갤럭시 S22', '갤럭시 S21', '갤럭시 Z폴드', '갤럭시 Z플립', '갤럭시 A', '갤럭시 노트'],
  'LG': ['V 시리즈', 'G 시리즈', 'Velvet', 'Wing', 'Q 시리즈'],
};

export default function UsedPhoneSelectCard({ onComplete }) {
  const [step, setStep] = useState(1);
  const [maker, setMaker] = useState('');
  const [series, setSeries] = useState('');

  const handleSeriesSelect = (s) => {
    const query = `${s} 중고폰 매입가 알려줘`;
    onComplete(query);
  };

  return (
    <div style={s.card}>
      {/* 프로그래스 */}
      <div style={s.progress}>
        {['제조사', '모델 선택'].map((label, i) => (
          <div key={label} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ ...s.dot, background: i + 1 <= step ? '#2563eb' : '#e8e8e8', color: i + 1 <= step ? '#fff' : '#999' }}>{i + 1}</div>
            <div style={{ fontSize: 10, color: i + 1 === step ? '#2563eb' : '#999', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* 스텝 1: 제조사 */}
      {step === 1 && (
        <div>
          <div style={s.stepTitle}>제조사를 선택하세요</div>
          <div style={s.options}>
            {MAKERS.map(m => (
              <button key={m} onClick={() => { setMaker(m); setStep(2); }} style={s.optionBtn}>
                <span style={{ fontSize: 20, marginRight: 8 }}>
                  {m === 'Apple' ? '🍎' : m === '삼성전자' ? '📱' : '📱'}
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{m}</div>
                  <div style={{ fontSize: 11, color: '#999' }}>
                    {m === 'Apple' ? '아이폰 시리즈' : m === '삼성전자' ? '갤럭시 시리즈' : 'LG 시리즈'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 스텝 2: 시리즈/모델 */}
      {step === 2 && (
        <div>
          <div style={s.stepTitle}>모델을 선택하세요</div>
          <div style={s.selectedInfo}>{'📱'} {maker}</div>
          <div style={s.modelGrid}>
            {(SERIES[maker] || []).map(sr => (
              <button key={sr} onClick={() => handleSeriesSelect(sr)} style={s.modelBtn}>
                {sr}
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
  selectedInfo: { fontSize: 11, color: '#2563eb', background: '#dbeafe', borderRadius: 6, padding: '4px 10px', marginBottom: 10, display: 'inline-block' },
  options: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 },
  optionBtn: { display: 'flex', alignItems: 'center', gap: 10, padding: '14px', borderRadius: 10, border: '1.5px solid #e8e8e8', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, color: '#1a1a1a', textAlign: 'left', width: '100%' },
  modelGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 },
  modelBtn: { padding: '12px 8px', borderRadius: 10, border: '1.5px solid #e8e8e8', background: '#fff', fontSize: 12, fontWeight: 600, color: '#1a2744', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' },
  backBtn: { height: 40, borderRadius: 8, border: '1px solid #d0d0d0', background: '#fff', color: '#555', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: '0 16px' },
};
