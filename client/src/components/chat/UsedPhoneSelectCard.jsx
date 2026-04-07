import { useState, useEffect } from 'react';

const GRADES = [
  { key: 'A', label: 'A등급', desc: '외관 깨끗', color: '#10b981' },
  { key: 'B', label: 'B등급', desc: '미세 기스', color: '#2563eb' },
  { key: 'C', label: 'C등급', desc: '눈에 보이는 기스', color: '#d97706' },
  { key: 'D', label: 'D등급', desc: '파손/깨짐', color: '#ef4444' },
  { key: 'E', label: 'E등급', desc: '심각 손상', color: '#999' },
];

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api';

export default function UsedPhoneSelectCard({ onComplete }) {
  const [step, setStep] = useState(1);
  const [maker, setMaker] = useState('');
  const [series, setSeries] = useState('');
  const [storage, setStorage] = useState('');
  const [grade, setGrade] = useState('');
  const [catalog, setCatalog] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/products/used-phone-catalog`)
      .then(r => r.json())
      .then(setCatalog)
      .catch(() => {});
  }, []);

  const handleComplete = () => {
    const query = `${series} ${storage} ${grade}등급 중고폰 매입가 알려줘`;
    onComplete(query);
  };

  if (!catalog) return <div style={{ padding: 16, color: '#999', fontSize: 13 }}>중고폰 목록 불러오는 중...</div>;

  const makers = catalog.makers || [];
  const seriesList = (catalog.series || {})[maker] || [];
  const storageList = (catalog.storages || {})[series] || [];

  return (
    <div style={st.card}>
      {/* 프로그래스 */}
      <div style={st.progress}>
        {['제조사', '모델', '용량', '상태'].map((label, i) => (
          <div key={label} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ ...st.dot, background: i + 1 <= step ? '#2563eb' : '#e8e8e8', color: i + 1 <= step ? '#fff' : '#999' }}>{i + 1}</div>
            <div style={{ fontSize: 9, color: i + 1 === step ? '#2563eb' : '#999', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* 스텝 1: 제조사 */}
      {step === 1 && (
        <div>
          <div style={st.stepTitle}>제조사를 선택하세요</div>
          <div style={st.options}>
            {makers.map(m => (
              <button key={m} onClick={() => { setMaker(m); setStep(2); }} style={st.optionBtn}>
                <span style={{ fontSize: 20, marginRight: 8 }}>{m === 'Apple' ? '🍎' : '📱'}</span>
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

      {/* 스텝 2: 모델 */}
      {step === 2 && (
        <div>
          <div style={st.stepTitle}>모델을 선택하세요</div>
          <div style={st.selectedInfo}>{'📱'} {maker}</div>
          <div style={st.modelGrid}>
            {seriesList.map(sr => (
              <button key={sr} onClick={() => { setSeries(sr); setStep(3); }} style={st.modelBtn}>{sr}</button>
            ))}
          </div>
          <button onClick={() => setStep(1)} style={{ ...st.backBtn, width: '100%' }}>{'←'} 이전</button>
        </div>
      )}

      {/* 스텝 3: 용량 */}
      {step === 3 && (
        <div>
          <div style={st.stepTitle}>용량을 선택하세요</div>
          <div style={st.selectedInfo}>{'📱'} {maker} · {series}</div>
          <div style={st.modelGrid}>
            {storageList.map(s => (
              <button key={s} onClick={() => { setStorage(s); setStep(4); }} style={st.modelBtn}>{s}</button>
            ))}
          </div>
          <button onClick={() => setStep(2)} style={{ ...st.backBtn, width: '100%' }}>{'←'} 이전</button>
        </div>
      )}

      {/* 스텝 4: 상태(등급) */}
      {step === 4 && (
        <div>
          <div style={st.stepTitle}>폰 상태를 선택하세요</div>
          <div style={st.selectedInfo}>{'📱'} {series} {storage}</div>
          <div style={st.options}>
            {GRADES.map(g => (
              <button key={g.key} onClick={() => { setGrade(g.key); }} style={{
                ...st.optionBtn,
                ...(grade === g.key ? { borderColor: '#2563eb', background: '#eff6ff' } : {}),
              }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: g.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                  {g.key}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{g.label}</div>
                  <div style={{ fontSize: 11, color: '#999' }}>{g.desc}</div>
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={handleComplete}
            disabled={!grade}
            style={{ ...st.submitBtn, opacity: grade ? 1 : 0.4 }}
          >
            매입가 확인하기
          </button>
          <button onClick={() => { setGrade(''); setStep(3); }} style={{ ...st.backBtn, width: '100%', marginTop: 8 }}>{'←'} 이전</button>
        </div>
      )}
    </div>
  );
}

const st = {
  card: { background: '#fff', border: '1px solid #e8e8e8', borderRadius: 12, padding: 16, maxWidth: 340 },
  progress: { display: 'flex', gap: 4, marginBottom: 14 },
  dot: { width: 22, height: 22, borderRadius: '50%', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 },
  stepTitle: { fontSize: 14, fontWeight: 700, color: '#1a2744', marginBottom: 12 },
  selectedInfo: { fontSize: 11, color: '#2563eb', background: '#dbeafe', borderRadius: 6, padding: '4px 10px', marginBottom: 10, display: 'inline-block' },
  options: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 },
  optionBtn: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e8e8e8', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, color: '#1a1a1a', textAlign: 'left', width: '100%' },
  modelGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 },
  modelBtn: { padding: '12px 8px', borderRadius: 10, border: '1.5px solid #e8e8e8', background: '#fff', fontSize: 12, fontWeight: 600, color: '#1a2744', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' },
  backBtn: { height: 40, borderRadius: 8, border: '1px solid #d0d0d0', background: '#fff', color: '#555', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: '0 16px' },
  submitBtn: { width: '100%', height: 48, borderRadius: 10, border: 'none', background: '#2563eb', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
};
