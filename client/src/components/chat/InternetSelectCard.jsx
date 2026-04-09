import { useState, useEffect } from 'react';
import { colors, fonts, sheetStyles } from './designTokens';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api';

const CARRIER_INFO = {
  SKT: { label: 'SKT', desc: 'Btv + 온가족할인', bg: '#fee2e2', color: '#ef4444', text: 'SK' },
  KT: { label: 'KT', desc: '지니TV + 총액가족결합', bg: '#dbeafe', color: '#2563eb', text: 'KT' },
  'LG U+': { label: 'LG U+', desc: 'U+tv + 참쉬운가족결합', bg: '#fce7f3', color: '#e40981', text: 'LG' },
};

const STEP_LABELS = ['통신사 선택', '속도 선택', 'TV 선택', '셋톱박스 선택', 'WiFi 선택'];

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

  const fmt = (v) => v ? v.toLocaleString() + '원' : '무료';

  const renderCarrierLogo = (c, size = 40) => {
    const info = CARRIER_INFO[c];
    if (!info) return null;
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: info.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.3, fontWeight: 800, color: info.color, flexShrink: 0,
        fontFamily: fonts.family,
      }}>
        {info.text}
      </div>
    );
  };

  /* ── Progress Steps ── */
  const renderProgress = () => (
    <div style={sheetStyles.progressWrap}>
      {[1, 2, 3, 4, 5].map((n, i) => (
        <div key={n} style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{
            ...sheetStyles.stepLabel(n === step),
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            minWidth: 40,
          }}>
            <span style={sheetStyles.stepNumber(n === step)}>
              {String(n).padStart(2, '0')}
            </span>
            <span style={{ fontSize: 10, fontWeight: n === step ? 700 : 300, marginTop: 1 }}>
              STEP
            </span>
          </div>
          {i < 4 && <div style={sheetStyles.stepDivider} />}
        </div>
      ))}
    </div>
  );

  /* ── Selected Info Badge ── */
  const renderSelectedBadge = (text) => (
    <div style={sheetStyles.selectedBadge}>
      {carrier && renderCarrierLogo(carrier, 20)}
      <span>{text}</span>
    </div>
  );

  /* ── Option Card ── */
  const OptionCard = ({ icon, label, desc, price, onClick, active }) => (
    <button
      onClick={onClick}
      style={{
        ...sheetStyles.optionCard,
        ...(active ? sheetStyles.optionCardActive : {}),
      }}
    >
      {icon}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: colors.text }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{desc}</div>}
      </div>
      {price !== undefined && (
        <div style={sheetStyles.price}>{price}</div>
      )}
    </button>
  );

  /* ── Back Button ── */
  const BackButton = ({ onClick }) => (
    <button onClick={onClick} style={sheetStyles.backBtn}>
      ← 이전
    </button>
  );

  /* ── Speed icon ── */
  const SpeedIcon = ({ label }) => (
    <div style={{
      ...sheetStyles.logoCircle(colors.surface),
      fontSize: 11, fontWeight: 700, color: colors.text,
    }}>
      {label}
    </div>
  );

  /* ── Generic icon circle ── */
  const IconCircle = ({ emoji }) => (
    <div style={{
      ...sheetStyles.logoCircle(colors.surface),
      fontSize: 18,
    }}>
      {emoji}
    </div>
  );

  return (
    <div style={{ position: 'relative', fontFamily: fonts.family }}>
      {/* Handle */}
      <div style={sheetStyles.handle} />

      {/* Title */}
      <div style={sheetStyles.title}>인터넷 TV 상품 조회</div>

      {/* Progress */}
      {renderProgress()}

      {/* Step 1: 통신사 선택 */}
      {step === 1 && (
        <div>
          <div style={sheetStyles.sectionTitle}>통신사를 선택하세요</div>
          {carriers.map(c => {
            const info = CARRIER_INFO[c];
            return (
              <OptionCard
                key={c}
                icon={renderCarrierLogo(c)}
                label={info.label}
                desc={info.desc}
                onClick={() => { setCarrier(c); setStep(2); }}
              />
            );
          })}
        </div>
      )}

      {/* Step 2: 속도 선택 */}
      {step === 2 && (
        <div>
          <div style={sheetStyles.sectionTitle}>인터넷 속도를 선택하세요</div>
          {renderSelectedBadge(carrier)}
          {speeds.map(sp => (
            <OptionCard
              key={sp.speed}
              icon={<SpeedIcon label={sp.speed} />}
              label={sp.speed}
              desc={sp.speed === '100M' ? '1~2인 기본' : sp.speed === '500M' ? '2~3인 추천' : '4인+ 추천'}
              price={fmt(sp.monthly_fee)}
              onClick={() => { setSpeed(sp.speed); setStep(3); }}
            />
          ))}
          <BackButton onClick={() => { setCarrier(''); setStep(1); }} />
        </div>
      )}

      {/* Step 3: TV 선택 */}
      {step === 3 && (
        <div>
          <div style={sheetStyles.sectionTitle}>TV 상품을 선택하세요</div>
          {renderSelectedBadge(`${carrier} · ${speed}`)}
          {tvs.map(t => (
            <OptionCard
              key={t.name}
              icon={<IconCircle emoji={t.name === '없음' ? '🚫' : '📺'} />}
              label={t.name}
              price={t.monthly_fee > 0 ? fmt(t.monthly_fee) : (t.name === '없음' ? undefined : '무료')}
              onClick={() => {
                setTv(t.name);
                if (t.name === '없음') { setSettop('없음'); setStep(5); }
                else { setStep(4); }
              }}
            />
          ))}
          <BackButton onClick={() => setStep(2)} />
        </div>
      )}

      {/* Step 4: 셋톱박스 선택 */}
      {step === 4 && (
        <div>
          <div style={sheetStyles.sectionTitle}>셋톱박스를 선택하세요</div>
          {renderSelectedBadge(`${carrier} · ${speed} · ${tv}`)}
          {settops.map(st => (
            <OptionCard
              key={st.name}
              icon={<IconCircle emoji={st.name === '없음' ? '🚫' : '📦'} />}
              label={st.name}
              price={st.monthly_fee > 0 ? fmt(st.monthly_fee) : (st.name === '없음' ? undefined : '무료')}
              onClick={() => { setSettop(st.name); setStep(5); }}
            />
          ))}
          <BackButton onClick={() => setStep(3)} />
        </div>
      )}

      {/* Step 5: WiFi 선택 */}
      {step === 5 && (
        <div>
          <div style={sheetStyles.sectionTitle}>WiFi를 선택하세요</div>
          {renderSelectedBadge(
            `${carrier} · ${speed} · ${tv}${settop !== '없음' ? ' · ' + settop : ''}`
          )}
          {wifis.map(w => (
            <OptionCard
              key={w.name}
              icon={<IconCircle emoji={w.name === '없음' ? '🚫' : '📡'} />}
              label={w.name}
              price={w.monthly_fee > 0 ? fmt(w.monthly_fee) : '무료'}
              onClick={() => { setWifi(w.name); handleComplete(); }}
            />
          ))}
          <BackButton onClick={() => setStep(tv === '없음' ? 3 : 4)} />
        </div>
      )}
    </div>
  );
}
