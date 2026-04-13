import { useState } from 'react';
import { colors, fonts, sheetStyles } from './designTokens';

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

const CARRIER_INFO = {
  SKT: { label: 'SKT', desc: 'T월드 공식 대리점', bg: '#fee2e2', color: '#ef4444', text: 'SK' },
  KT: { label: 'KT', desc: 'KT 공식 대리점', bg: '#dbeafe', color: '#2563eb', text: 'KT' },
  'LG U+': { label: 'LG U+', desc: 'U+ 공식 대리점', bg: '#fce7f3', color: '#e40981', text: 'LG' },
};

const OPEN_TYPE_INFO = {
  '번호이동': { desc: '다른 통신사에서 옮겨오기', emoji: '🔄' },
  '기기변경': { desc: '같은 통신사에서 기기만 변경', emoji: '📱' },
};

const MAKER_INFO = {
  '삼성': { desc: '갤럭시 시리즈', emoji: '📱' },
  '애플': { desc: '아이폰 시리즈', emoji: '🍎' },
};

export default function PhoneSelectCard({ onComplete, onClose }) {
  const [step, setStep] = useState(1);
  const [carrier, setCarrier] = useState('');
  const [openType, setOpenType] = useState('');
  const [maker, setMaker] = useState('');

  const handleComplete = (selectedModel) => {
    const carrierMap = { 'SKT': 'SKT', 'KT': 'KT', 'LG U+': 'LGU+' };
    const query = `${selectedModel} ${carrierMap[carrier] || carrier} ${openType} 시세`;
    onComplete(query);
  };

  /* ── Carrier Logo ── */
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
      {[1, 2, 3, 4].map((n, i) => (
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
          {i < 3 && <div style={sheetStyles.stepDivider} />}
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

  /* ── Icon Circle ── */
  const IconCircle = ({ emoji }) => (
    <div style={{
      ...sheetStyles.logoCircle(colors.surface),
      fontSize: 18,
    }}>
      {emoji}
    </div>
  );

  /* ── Option Card ── */
  const OptionCard = ({ icon, label, desc, onClick, active }) => (
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
    </button>
  );

  /* ── Back Button ── */
  const BackButton = ({ onClick }) => (
    <button onClick={onClick} style={sheetStyles.backBtn}>
      ← 이전
    </button>
  );

  /* ── Model Grid Button ── */
  const ModelButton = ({ label, onClick }) => (
    <button
      onClick={onClick}
      style={{
        padding: '14px 8px',
        borderRadius: 12,
        border: `1.5px solid ${colors.border}`,
        background: colors.white,
        fontSize: 13,
        fontWeight: 600,
        color: colors.text,
        cursor: 'pointer',
        fontFamily: fonts.family,
        textAlign: 'center',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{
      background: colors.white,
      borderRadius: '16px 16px 0 0',
      padding: '16px 20px 24px',
      maxHeight: '85vh',
      overflowY: 'auto',
      fontFamily: fonts.family,
      position: 'relative',
    }}>
      {/* Handle */}
      <div style={sheetStyles.handle} />

      {/* Close Button */}
      {onClose && (
        <button onClick={onClose} style={sheetStyles.closeBtn}>✕</button>
      )}

      {/* Title */}
      <div style={sheetStyles.title}>휴대폰 시세 조회</div>

      {/* Progress */}
      {renderProgress()}

      {/* Step 1: 통신사 선택 */}
      {step === 1 && (
        <div>
          <div style={sheetStyles.sectionTitle}>통신사를 선택하세요</div>
          {CARRIERS.map(c => {
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

      {/* Step 2: 개통유형 선택 */}
      {step === 2 && (
        <div>
          <div style={sheetStyles.sectionTitle}>개통 유형을 선택하세요</div>
          {renderSelectedBadge(carrier)}
          {OPEN_TYPES.map(t => {
            const info = OPEN_TYPE_INFO[t];
            return (
              <OptionCard
                key={t}
                icon={<IconCircle emoji={info.emoji} />}
                label={t}
                desc={info.desc}
                onClick={() => { setOpenType(t); setStep(3); }}
              />
            );
          })}
          <BackButton onClick={() => { setCarrier(''); setStep(1); }} />
        </div>
      )}

      {/* Step 3: 제조사 선택 */}
      {step === 3 && (
        <div>
          <div style={sheetStyles.sectionTitle}>제조사를 선택하세요</div>
          {renderSelectedBadge(`${carrier} · ${openType}`)}
          {[['삼성'], ['애플']].map(([m]) => {
            const info = MAKER_INFO[m];
            return (
              <OptionCard
                key={m}
                icon={<IconCircle emoji={info.emoji} />}
                label={m}
                desc={info.desc}
                onClick={() => { setMaker(m); setStep(4); }}
              />
            );
          })}
          <BackButton onClick={() => { setOpenType(''); setStep(2); }} />
        </div>
      )}

      {/* Step 4: 기종 선택 */}
      {step === 4 && (
        <div>
          <div style={sheetStyles.sectionTitle}>기종을 선택하세요</div>
          {renderSelectedBadge(`${carrier} · ${openType} · ${maker}`)}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            marginBottom: 12,
          }}>
            {(maker === '삼성' ? SAMSUNG_MODELS : APPLE_MODELS).map(m => (
              <ModelButton
                key={m}
                label={m}
                onClick={() => handleComplete(m)}
              />
            ))}
          </div>
          <BackButton onClick={() => { setMaker(''); setStep(3); }} />
        </div>
      )}
    </div>
  );
}
