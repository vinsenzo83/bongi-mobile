import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api';

export default function InternetSelectCard({ onComplete }) {
  const [step, setStep] = useState(1);
  const [carrier, setCarrier] = useState('');
  const [speed, setSpeed] = useState('');
  const [tv, setTv] = useState('');
  const [settop, setSettop] = useState('');
  const [wifi, setWifi] = useState('');
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/admin/platform/carrier-products`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  const carriers = ['SKT', 'KT', 'LG U+'];
  const carrierKey = carrier === 'LG U+' ? 'LGU+' : carrier;

  const speeds = data ? data.internet_speeds.filter(s => s.carrier === carrierKey) : [];
  const tvs = data ? data.tv_products.filter(t => t.carrier === carrierKey && t.is_active !== false) : [];
  const settops = data ? data.settop_boxes.filter(s => s.carrier === carrierKey) : [];
  const wifis = data ? data.wifi_products.filter(w => w.carrier === carrierKey) : [];

  const handleComplete = () => {
    const tvName = tv === '없음' ? '' : ' ' + tv;
    const query = `${carrier} 인터넷 ${speed}${tvName} 사은품 알려줘`;
    onComplete(query);
  };

  const steps = ['통신사', '속도', 'TV', '셋톱', 'WiFi'];
  const fmt = (v) => v ? v.toLocaleString() + '원' : '무료';

  return (
    <div style={s.card}>
      {/* 프로그래스 */}
      <div style={s.progress}>
        {steps.map((label, i) => (
          <div key={label} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ ...s.dot, background: i + 1 <= step ? '#2563eb' : '#e8e8e8', color: i + 1 <= step ? '#fff' : '#999' }}>{i + 1}</div>
            <div style={{ fontSize: 9, color: i + 1 === step ? '#2563eb' : '#999', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* 스텝 1: 통신사 */}
      {step === 1 && (
        <div>
          <div style={s.stepTitle}>통신사를 선택하세요</div>
          <div style={s.options}>
            {carriers.map(c => (
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
            {speeds.map(sp => (
              <button key={sp.speed} onClick={() => { setSpeed(sp.speed); setStep(3); }} style={s.optionBtn}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#1a2744', flexShrink: 0 }}>
                  {sp.speed}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{sp.speed}</div>
                  <div style={{ fontSize: 11, color: '#999' }}>
                    {sp.speed === '100M' ? '1~2인 기본' : sp.speed === '500M' ? '2~3인 추천' : '4인+ 추천'}
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#2563eb' }}>{fmt(sp.monthly_fee)}</div>
              </button>
            ))}
          </div>
          <button onClick={() => { setCarrier(''); setStep(1); }} style={{ ...s.backBtn, width: '100%' }}>{'←'} 이전</button>
        </div>
      )}

      {/* 스텝 3: TV */}
      {step === 3 && (
        <div>
          <div style={s.stepTitle}>TV 상품을 선택하세요</div>
          <div style={s.selectedInfo}>{carrier} · {speed}</div>
          <div style={s.options}>
            {tvs.map(t => (
              <button key={t.name} onClick={() => { setTv(t.name); if (t.name === '없음') { setSettop('없음'); setStep(5); } else { setStep(4); } }} style={{ ...s.optionBtn, padding: '10px 14px' }}>
                <span style={{ fontSize: 13, flexShrink: 0 }}>{t.name === '없음' ? '🚫' : '📺'}</span>
                <span style={{ fontSize: 13, flex: 1 }}>{t.name}</span>
                {t.monthly_fee > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: '#059669' }}>{fmt(t.monthly_fee)}</span>}
              </button>
            ))}
          </div>
          <button onClick={() => setStep(2)} style={{ ...s.backBtn, width: '100%' }}>{'←'} 이전</button>
        </div>
      )}

      {/* 스텝 4: 셋톱박스 */}
      {step === 4 && (
        <div>
          <div style={s.stepTitle}>셋톱박스를 선택하세요</div>
          <div style={s.selectedInfo}>{carrier} · {speed} · {tv}</div>
          <div style={s.options}>
            {settops.map(st => (
              <button key={st.name} onClick={() => { setSettop(st.name); setStep(5); }} style={{ ...s.optionBtn, padding: '10px 14px' }}>
                <span style={{ fontSize: 13, flexShrink: 0 }}>{st.name === '없음' ? '🚫' : '📦'}</span>
                <span style={{ fontSize: 13, flex: 1 }}>{st.name}</span>
                {st.monthly_fee > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: '#d97706' }}>{fmt(st.monthly_fee)}</span>}
              </button>
            ))}
          </div>
          <button onClick={() => setStep(3)} style={{ ...s.backBtn, width: '100%' }}>{'←'} 이전</button>
        </div>
      )}

      {/* 스텝 5: WiFi */}
      {step === 5 && (
        <div>
          <div style={s.stepTitle}>WiFi를 선택하세요</div>
          <div style={s.selectedInfo}>{carrier} · {speed} · {tv}{settop !== '없음' ? ' · ' + settop : ''}</div>
          <div style={s.options}>
            {wifis.map(w => (
              <button key={w.name} onClick={() => { setWifi(w.name); handleComplete(); }} style={{ ...s.optionBtn, padding: '10px 14px' }}>
                <span style={{ fontSize: 13, flexShrink: 0 }}>{w.name === '없음' ? '🚫' : '📡'}</span>
                <span style={{ fontSize: 13, flex: 1 }}>{w.name}</span>
                {w.monthly_fee > 0 ? <span style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed' }}>{fmt(w.monthly_fee)}</span> : <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>무료</span>}
              </button>
            ))}
          </div>
          <button onClick={() => setStep(tv === '없음' ? 3 : 4)} style={{ ...s.backBtn, width: '100%' }}>{'←'} 이전</button>
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
