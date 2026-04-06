import { useState } from 'react';
import { theme, card, button, input } from '../../styles/admin-theme.js';

const carrierOptions = ['SKT', 'KT', 'LGU+'];
const internetProducts = {
  SKT: ['SK 브로드밴드 기가라이트 (100M)', 'SK 브로드밴드 기가프리미엄 (500M)', 'SK 브로드밴드 기가프리미엄 플러스 (1G)'],
  KT: ['KT 슬림 (100M)', 'KT 에센스 (500M)', 'KT 프리미엄 (1G)'],
  'LGU+': ['U+ 인터넷 베이직 (100M)', 'U+ 인터넷 스탠다드 (500M)', 'U+ 인터넷 프리미엄 (1G)'],
};
const tvProducts = {
  SKT: ['없음', 'B tv 라이트', 'B tv 베이직', 'B tv 프리미엄'],
  KT: ['없음', 'Genie TV 슬림', 'Genie TV 에센스', 'Genie TV 프리미엄'],
  'LGU+': ['없음', 'U+tv 베이직', 'U+tv 프라임', 'U+tv 프리미엄'],
};
const cardOptions = ['없음', 'KB국민 통신할인카드 (월 1만원)', '삼성 통신할인카드 (월 8천원)', '신한 통신할인카드 (월 5천원)'];

const internetPrices = { '100M': 22000, '500M': 33000, '1G': 44000 };
const tvPrices = { '없음': 0, '라이트': 10000, '슬림': 10000, '베이직': 15000, '에센스': 15000, '프라임': 20000, '프리미엄': 25000 };
const cardDiscounts = { '없음': 0, 'KB국민': 10000, '삼성': 8000, '신한': 5000 };

function getInternetPrice(product) {
  if (product.includes('1G')) return internetPrices['1G'];
  if (product.includes('500M')) return internetPrices['500M'];
  return internetPrices['100M'];
}

function getTvPrice(product) {
  if (product === '없음') return 0;
  for (const key of Object.keys(tvPrices)) {
    if (product.includes(key)) return tvPrices[key];
  }
  return 15000;
}

function getCardDiscount(c) {
  if (c === '없음') return 0;
  for (const key of Object.keys(cardDiscounts)) {
    if (c.includes(key)) return cardDiscounts[key];
  }
  return 0;
}

export default function BundleSimulator() {
  const [carrier, setCarrier] = useState('SKT');
  const [internet, setInternet] = useState(internetProducts.SKT[0]);
  const [tv, setTv] = useState('없음');
  const [lines, setLines] = useState(2);
  const [selectedCard, setSelectedCard] = useState('없음');
  const [result, setResult] = useState(null);

  const handleCarrierChange = (c) => {
    setCarrier(c);
    setInternet(internetProducts[c][0]);
    setTv('없음');
    setResult(null);
  };

  const simulate = () => {
    const iPrice = getInternetPrice(internet);
    const tPrice = getTvPrice(tv);
    const baseMobile = 49000;
    const bundleDiscount = tv !== '없음' ? 12000 : 6000;
    const familyDiscount = lines >= 4 ? 20000 : lines >= 3 ? 15000 : lines >= 2 ? 10000 : 0;
    const cDiscount = getCardDiscount(selectedCard);
    const totalBase = iPrice + tPrice + (baseMobile * lines);
    const totalDiscount = bundleDiscount + (familyDiscount * lines) + cDiscount;
    const finalMonthly = totalBase - totalDiscount;

    setResult({
      breakdown: [
        { label: '인터넷 요금', amount: iPrice },
        { label: 'TV 요금', amount: tPrice },
        { label: `모바일 요금 (${lines}회선 x 49,000원)`, amount: baseMobile * lines },
      ],
      discounts: [
        { label: '결합할인 (인터넷+TV+모바일)', amount: bundleDiscount },
        { label: `가족결합 (${lines}회선 x ${familyDiscount.toLocaleString()}원)`, amount: familyDiscount * lines },
        ...(cDiscount > 0 ? [{ label: '제휴카드 할인', amount: cDiscount }] : []),
      ],
      totalBase,
      totalDiscount,
      finalMonthly,
      yearlySaving: totalDiscount * 12,
    });
  };

  const labelStyle = { fontSize: 11, fontWeight: 600, color: theme.textSecondary, display: 'block', marginBottom: 4 };
  const fieldWrap = { marginBottom: 14 };

  return (
    <div style={{ padding: 24, fontFamily: theme.sans, background: theme.bg, minHeight: '100vh' }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: theme.text, marginBottom: 20 }}>
        결합할인 시뮬레이터
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 20, alignItems: 'start' }}>
        {/* Left: Input */}
        <div style={card}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: theme.text, marginBottom: 16 }}>시뮬레이션 입력</h3>

          <div style={fieldWrap}>
            <label style={labelStyle}>통신사</label>
            <select style={input} value={carrier} onChange={e => handleCarrierChange(e.target.value)}>
              {carrierOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div style={fieldWrap}>
            <label style={labelStyle}>인터넷 상품</label>
            <select style={input} value={internet} onChange={e => setInternet(e.target.value)}>
              {(internetProducts[carrier] || []).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div style={fieldWrap}>
            <label style={labelStyle}>TV 상품 (선택)</label>
            <select style={input} value={tv} onChange={e => setTv(e.target.value)}>
              {(tvProducts[carrier] || []).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div style={fieldWrap}>
            <label style={labelStyle}>결합 회선수</label>
            <input
              style={input}
              type="number"
              min={1}
              max={10}
              value={lines}
              onChange={e => setLines(Math.max(1, Number(e.target.value)))}
            />
          </div>

          <div style={fieldWrap}>
            <label style={labelStyle}>제휴카드 (선택)</label>
            <select style={input} value={selectedCard} onChange={e => setSelectedCard(e.target.value)}>
              {cardOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <button style={{ ...button.primary, width: '100%', padding: '10px 0', fontSize: 14 }} onClick={simulate}>
            시뮬레이션 실행
          </button>
        </div>

        {/* Right: Result */}
        <div style={card}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: theme.text, marginBottom: 16 }}>결과</h3>

          {!result ? (
            <div style={{ textAlign: 'center', color: theme.textMuted, padding: 60, fontSize: 13 }}>
              왼쪽에서 조건을 입력하고 시뮬레이션을 실행하세요.
            </div>
          ) : (
            <>
              {/* Breakdown */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: theme.textSecondary, marginBottom: 8 }}>월 요금 내역</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <tbody>
                    {result.breakdown.map((r, i) => (
                      <tr key={i}>
                        <td style={{ padding: '6px 0', color: theme.textSecondary, borderBottom: `1px solid ${theme.border}` }}>{r.label}</td>
                        <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600, color: theme.text, borderBottom: `1px solid ${theme.border}` }}>{r.amount.toLocaleString()}원</td>
                      </tr>
                    ))}
                    <tr>
                      <td style={{ padding: '8px 0', fontWeight: 700, color: theme.text }}>소계</td>
                      <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700, color: theme.text }}>{result.totalBase.toLocaleString()}원</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Discounts */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: theme.red, marginBottom: 8 }}>할인 항목</div>
                {result.discounts.map((d, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 12, color: theme.red, borderBottom: `1px solid ${theme.border}` }}>
                    <span>{d.label}</span>
                    <span style={{ fontWeight: 600 }}>-{d.amount.toLocaleString()}원</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 12, fontWeight: 700, color: theme.red }}>
                  <span>총 할인</span>
                  <span>-{result.totalDiscount.toLocaleString()}원</span>
                </div>
              </div>

              {/* Final */}
              <div style={{
                background: theme.navy, borderRadius: 10, padding: 20, textAlign: 'center', marginBottom: 12,
              }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>최종 월 납부액</div>
                <div style={{ fontSize: 36, fontWeight: 800, color: '#fff', fontFamily: 'monospace' }}>
                  {result.finalMonthly.toLocaleString()}원
                </div>
              </div>

              <div style={{
                background: theme.greenBg, borderRadius: 8, padding: 14, textAlign: 'center',
                border: `1px solid ${theme.green}`,
              }}>
                <div style={{ fontSize: 11, color: theme.green, marginBottom: 2 }}>연간 절약액</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: theme.green, fontFamily: 'monospace' }}>
                  {result.yearlySaving.toLocaleString()}원
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
