import { useState, useEffect } from 'react';
import { colors, fonts, sheetStyles } from './designTokens';

const GRADES = [
  { key: 'A', label: 'A등급', desc: '새제품 같은 상태', color: colors.gradeA },
  { key: 'B', label: 'B등급', desc: '스크래치, 찍힘 다소 있음', color: colors.gradeB },
  { key: 'C', label: 'C등급', desc: '외관 파손, 기능이상, 화면잔상', color: colors.gradeC },
  { key: 'D', label: 'D등급', desc: '디스플레이 불량, 손상', color: colors.gradeD },
  { key: 'E', label: 'E등급', desc: '전원불량, 심각한 파손', color: colors.gradeE },
];

const DEVICE_TYPES = [
  { key: 'phone', label: '스마트폰', icon: '📱' },
  { key: 'tablet', label: '태블릿PC', icon: '💻' },
  { key: 'watch', label: '워치', icon: '⌚' },
  { key: 'earbuds', label: '무선이어폰', icon: '🎧' },
];

const STEP_LABELS = ['제조사', '모델', '용량', '등급'];

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api';

export default function UsedPhoneSelectCard({ onComplete }) {
  const [step, setStep] = useState(1);
  const [deviceType, setDeviceType] = useState('phone');
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

  if (!catalog) {
    return (
      <div style={{ ...st.card, padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>📱</div>
        <div style={{ fontSize: 13, color: colors.textSecondary }}>중고폰 목록 불러오는 중...</div>
      </div>
    );
  }

  const makers = catalog.makers || [];
  const seriesList = (catalog.series || {})[maker] || [];
  const storageList = (catalog.storages || {})[series] || [];

  return (
    <div style={st.card}>
      {/* Title */}
      <div style={st.title}>중고폰 시세 확인</div>

      {/* Device type selector */}
      <div style={st.deviceTypeRow}>
        {DEVICE_TYPES.map(dt => (
          <button
            key={dt.key}
            onClick={() => setDeviceType(dt.key)}
            style={{
              ...st.deviceTypeBtn,
              ...(deviceType === dt.key ? st.deviceTypeBtnActive : {}),
            }}
          >
            <span style={{ fontSize: 22 }}>{dt.icon}</span>
            <span style={{
              fontSize: 10,
              fontWeight: deviceType === dt.key ? 700 : 400,
              color: deviceType === dt.key ? colors.primary : colors.textSecondary,
              marginTop: 4,
            }}>{dt.label}</span>
          </button>
        ))}
      </div>

      {/* Progress steps */}
      <div style={st.progressWrap}>
        {STEP_LABELS.map((label, i) => {
          const stepNum = i + 1;
          const active = stepNum <= step;
          const current = stepNum === step;
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{
                  ...st.stepDot,
                  background: active ? colors.primary : colors.border,
                  color: active ? '#fff' : colors.textSecondary,
                  boxShadow: current ? `0 0 0 3px ${colors.primaryLight}` : 'none',
                }}>
                  {stepNum}
                </div>
                <div style={{
                  fontSize: 10,
                  fontWeight: current ? 700 : 400,
                  color: current ? colors.primary : colors.textSecondary,
                  marginTop: 4,
                }}>{label}</div>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div style={{
                  width: 20,
                  height: 1,
                  background: active && step > stepNum ? colors.primary : colors.border,
                  flexShrink: 0,
                }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step 1: Maker */}
      {step === 1 && (
        <div>
          <div style={st.sectionTitle}>제조사 선택</div>
          <div style={st.optionList}>
            {makers.map(m => (
              <button
                key={m}
                onClick={() => { setMaker(m); setSeries(''); setStorage(''); setGrade(''); setStep(2); }}
                style={st.optionCard}
                onMouseEnter={e => { e.currentTarget.style.borderColor = colors.primary; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = colors.border; }}
              >
                <div style={st.logoCircle}>
                  <span style={{ fontSize: 20 }}>{m === 'Apple' ? '🍎' : m === '삼성전자' ? '📱' : '📱'}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: colors.text }}>{m}</div>
                  <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                    {m === 'Apple' ? '아이폰 시리즈' : m === '삼성전자' ? '갤럭시 시리즈' : `${m} 시리즈`}
                  </div>
                </div>
                <span style={{ color: colors.textSecondary, fontSize: 14 }}>{'>'}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Series/Model */}
      {step === 2 && (
        <div>
          <div style={st.sectionTitle}>시리즈 선택</div>
          <div style={st.selectedBadge}>📱 {maker}</div>
          <div style={st.modelGrid}>
            {seriesList.map(sr => (
              <button
                key={sr}
                onClick={() => { setSeries(sr); setStorage(''); setGrade(''); setStep(3); }}
                style={st.modelBtn}
                onMouseEnter={e => { e.currentTarget.style.borderColor = colors.primary; e.currentTarget.style.color = colors.primary; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.color = colors.text; }}
              >
                {sr}
              </button>
            ))}
          </div>
          <button onClick={() => setStep(1)} style={st.backBtn}>← 이전</button>
        </div>
      )}

      {/* Step 3: Storage */}
      {step === 3 && (
        <div>
          <div style={st.sectionTitle}>용량 선택</div>
          <div style={st.selectedBadge}>📱 {maker} · {series}</div>
          <div style={st.modelGrid}>
            {storageList.map(s => (
              <button
                key={s}
                onClick={() => { setStorage(s); setGrade(''); setStep(4); }}
                style={st.modelBtn}
                onMouseEnter={e => { e.currentTarget.style.borderColor = colors.primary; e.currentTarget.style.color = colors.primary; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.color = colors.text; }}
              >
                {s}
              </button>
            ))}
          </div>
          <button onClick={() => setStep(2)} style={st.backBtn}>← 이전</button>
        </div>
      )}

      {/* Step 4: Grade */}
      {step === 4 && (
        <div>
          <div style={st.sectionTitle}>등급별 보상 시세</div>
          <div style={st.selectedBadge}>📱 {series} {storage}</div>
          <div style={st.optionList}>
            {GRADES.map(g => (
              <button
                key={g.key}
                onClick={() => setGrade(g.key)}
                style={{
                  ...st.gradeCard,
                  borderColor: grade === g.key ? colors.primary : colors.border,
                  background: grade === g.key ? colors.primaryLight : colors.white,
                }}
              >
                <div style={{
                  ...st.gradeBadge,
                  background: g.color,
                }}>
                  {g.key}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: colors.text }}>{g.label}</div>
                  <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>{g.desc}</div>
                </div>
                {grade === g.key && (
                  <div style={{ color: colors.primary, fontSize: 16, fontWeight: 700 }}>✓</div>
                )}
              </button>
            ))}
          </div>

          {/* Submit */}
          <button
            onClick={handleComplete}
            disabled={!grade}
            style={{
              ...st.submitBtn,
              opacity: grade ? 1 : 0.4,
              cursor: grade ? 'pointer' : 'not-allowed',
            }}
          >
            매입가 확인하기
          </button>
          <button onClick={() => { setGrade(''); setStep(3); }} style={st.backBtn}>← 이전</button>
        </div>
      )}

      {/* Footer note */}
      <div style={st.footerNote}>
        📍 실제 매입가는 기기 상태에 따라 변동될 수 있습니다.
      </div>
    </div>
  );
}

const st = {
  card: {
    background: colors.white,
    borderRadius: '16px 16px 0 0',
    padding: '16px 20px 24px',
    maxHeight: '85vh',
    overflowY: 'auto',
    fontFamily: fonts.family,
    position: 'relative',
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 16,
  },
  // Device type row
  deviceTypeRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 16,
  },
  deviceTypeBtn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 4px',
    border: `1.5px solid ${colors.border}`,
    borderRadius: 12,
    background: colors.white,
    cursor: 'pointer',
    fontFamily: fonts.family,
  },
  deviceTypeBtnActive: {
    borderColor: colors.primary,
    background: colors.primaryLight,
  },
  // Progress
  progressWrap: {
    display: 'flex',
    alignItems: 'flex-start',
    marginBottom: 20,
    padding: '0 4px',
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 700,
    transition: 'all 0.2s',
  },
  // Section
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: colors.text,
    marginBottom: 12,
  },
  selectedBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: colors.primary,
    background: colors.primaryLight,
    borderRadius: 8,
    padding: '5px 12px',
    marginBottom: 12,
    fontWeight: 500,
  },
  // Option list (vertical)
  optionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginBottom: 12,
  },
  optionCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 14px',
    border: `1.5px solid ${colors.border}`,
    borderRadius: 12,
    background: colors.white,
    cursor: 'pointer',
    fontFamily: fonts.family,
    width: '100%',
    textAlign: 'left',
    transition: 'border-color 0.15s',
  },
  logoCircle: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: colors.surface,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  // Model grid
  modelGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
    marginBottom: 12,
  },
  modelBtn: {
    padding: '12px 8px',
    borderRadius: 10,
    border: `1.5px solid ${colors.border}`,
    background: colors.white,
    fontSize: 12,
    fontWeight: 600,
    color: colors.text,
    cursor: 'pointer',
    fontFamily: fonts.family,
    textAlign: 'center',
    transition: 'border-color 0.15s, color 0.15s',
  },
  // Grade card
  gradeCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 14px',
    border: `1.5px solid ${colors.border}`,
    borderRadius: 12,
    cursor: 'pointer',
    fontFamily: fonts.family,
    width: '100%',
    textAlign: 'left',
    transition: 'border-color 0.15s, background 0.15s',
  },
  gradeBadge: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: 700,
    fontSize: 14,
    flexShrink: 0,
  },
  // Buttons
  submitBtn: {
    width: '100%',
    height: 48,
    borderRadius: 10,
    border: 'none',
    background: colors.primary,
    color: '#fff',
    fontSize: 15,
    fontWeight: 700,
    fontFamily: fonts.family,
    marginTop: 4,
    transition: 'opacity 0.15s',
  },
  backBtn: {
    width: '100%',
    height: 40,
    borderRadius: 10,
    border: `1px solid ${colors.border}`,
    background: colors.white,
    color: colors.textSecondary,
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: fonts.family,
    marginTop: 8,
  },
  // Footer
  footerNote: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 14,
    padding: '8px 0 0',
    borderTop: `1px solid ${colors.border}`,
    lineHeight: 1.5,
  },
};
