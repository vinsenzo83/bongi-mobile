import { useState, useCallback } from 'react';
import { theme, statusStyle, tableStyles, card, button, filterBtn, kpiCard, input } from '../../styles/admin-theme.js';

export default function BundleSimulator() {
  const [carrier, setCarrier] = useState('');
  const [speed, setSpeed] = useState('');
  const [tv, setTv] = useState('0');
  const [settop, setSettop] = useState('0');
  const [wifi, setWifi] = useState('0');
  const [bundle, setBundle] = useState('없음');
  const [cardDisc, setCardDisc] = useState('0');
  const [showResult, setShowResult] = useState(false);

  const selectStyle = { ...input, marginBottom: 0 };

  const handleCalc = useCallback(() => {
    if (carrier && speed) setShowResult(true);
  }, [carrier, speed]);

  // Simple price lookup for demo
  const internetPrice = speed === '100M' ? 22000 : speed === '500M' ? 33000 : speed === '1G' ? 38500 : 0;
  const tvPrice = parseInt(tv) || 0;
  const optionPrice = (parseInt(settop) || 0) + (parseInt(wifi) || 0);
  const bundleDiscount = bundle !== '없음' ? 5500 : 0;
  const cardDiscountVal = parseInt(cardDisc) || 0;
  const finalPrice = internetPrice + tvPrice + optionPrice - bundleDiscount - cardDiscountVal;

  return (
    <div>
      {/* Info banner */}
      <div style={{ ...card, background: '#eff6ff', borderColor: '#bfdbfe', marginBottom: 14, padding: '12px 16px' }}>
        <div style={{ fontSize: 12, color: theme.navy }}>
          💡 인터넷 + TV + 셋톱 + 와이파이 각각 선택 → 결합할인 + 카드할인 적용 후 <strong>최종 월요금</strong> 자동 계산
        </div>
      </div>

      {/* Condition selection */}
      <div style={{ ...card, marginBottom: 14 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: theme.navy, marginBottom: 14, marginTop: 0 }}>📋 조건 선택</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: theme.textSecondary, marginBottom: 4 }}>① 통신사</div>
            <select style={selectStyle} value={carrier} onChange={e => { setCarrier(e.target.value); handleCalc(); }}>
              <option value="">선택하세요</option>
              <option>SKT</option>
              <option>KT</option>
              <option>LG U+</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: theme.textSecondary, marginBottom: 4 }}>② 인터넷 속도</div>
            <select style={selectStyle} value={speed} onChange={e => { setSpeed(e.target.value); handleCalc(); }}>
              <option value="">선택하세요</option>
              <option>100M</option>
              <option>500M</option>
              <option>1G</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: theme.textSecondary, marginBottom: 4 }}>③ TV 상품</div>
            <select style={selectStyle} value={tv} onChange={e => { setTv(e.target.value); handleCalc(); }}>
              <option value="0">{carrier ? '선택하세요' : '통신사 먼저 선택'}</option>
              {carrier && <>
                <option value="0">TV 없음</option>
                <option value="3300">기본형 (3,300원)</option>
                <option value="5500">경제형 (5,500원)</option>
                <option value="8800">프리미엄 (8,800원)</option>
              </>}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: theme.textSecondary, marginBottom: 4 }}>④ 셋톱박스</div>
            <select style={selectStyle} value={settop} onChange={e => { setSettop(e.target.value); handleCalc(); }}>
              <option value="0">{carrier ? '선택하세요' : '통신사 먼저 선택'}</option>
              {carrier && <>
                <option value="0">기본 제공</option>
                <option value="3300">사운드바형 (+3,300원)</option>
              </>}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: theme.textSecondary, marginBottom: 4 }}>⑤ 와이파이</div>
            <select style={selectStyle} value={wifi} onChange={e => { setWifi(e.target.value); handleCalc(); }}>
              <option value="0">{carrier ? '선택하세요' : '통신사 먼저 선택'}</option>
              {carrier && <>
                <option value="0">{carrier === 'LG U+' ? '기본 무료' : '기본'}</option>
                <option value="1100">일반 와이파이 (+1,100원)</option>
                <option value="3300">메시 와이파이 (+3,300원)</option>
              </>}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: theme.textSecondary, marginBottom: 4 }}>⑥ 결합 종류</div>
            <select style={selectStyle} value={bundle} onChange={e => { setBundle(e.target.value); handleCalc(); }}>
              <option value="없음">{carrier ? '선택하세요' : '통신사 먼저 선택'}</option>
              {carrier && <>
                <option value="없음">결합 없음</option>
                <option value="모바일">모바일 결합</option>
                <option value="패밀리">패밀리 결합</option>
                <option value="알뜰폰">알뜰폰 결합</option>
              </>}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: theme.textSecondary, marginBottom: 4 }}>⑦ 제휴카드</div>
            <select style={selectStyle} value={cardDisc} onChange={e => { setCardDisc(e.target.value); handleCalc(); }}>
              <option value="0">{carrier ? '선택하세요' : '통신사 먼저 선택'}</option>
              {carrier && <>
                <option value="0">카드 없음</option>
                <option value="5500">제휴카드 (-5,500원)</option>
                <option value="11000">제휴카드 (-11,000원)</option>
                <option value="16500">제휴카드 (-16,500원)</option>
              </>}
            </select>
          </div>
        </div>
      </div>

      {/* Result */}
      {carrier && speed && (
        <div style={card}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: theme.navy, marginBottom: 14, marginTop: 0 }}>📊 시뮬레이션 결과</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 14 }}>
            <div style={kpiCard}>
              <div style={{ fontSize: 18, fontWeight: 900, color: theme.navy }}>{internetPrice.toLocaleString()}원</div>
              <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>인터넷</div>
            </div>
            <div style={kpiCard}>
              <div style={{ fontSize: 18, fontWeight: 900, color: theme.blue }}>{tvPrice.toLocaleString()}원</div>
              <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>TV</div>
            </div>
            <div style={kpiCard}>
              <div style={{ fontSize: 18, fontWeight: 900, color: theme.orange }}>{optionPrice.toLocaleString()}원</div>
              <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>셋톱+와이파이</div>
            </div>
            <div style={kpiCard}>
              <div style={{ fontSize: 18, fontWeight: 900, color: theme.green }}>-{bundleDiscount.toLocaleString()}원</div>
              <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>결합할인</div>
            </div>
            <div style={kpiCard}>
              <div style={{ fontSize: 18, fontWeight: 900, color: theme.blue }}>-{cardDiscountVal.toLocaleString()}원</div>
              <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>카드할인</div>
            </div>
          </div>

          <div style={{ background: theme.navy, borderRadius: 12, padding: 20, textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>최종 월요금 (유저 노출가)</div>
            <div style={{ fontSize: 36, fontWeight: 900, color: '#fff' }}>{finalPrice.toLocaleString()}원</div>
          </div>

          <div style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 1.8 }}>
            <div>• 통신사: {carrier} / 인터넷: {speed} ({internetPrice.toLocaleString()}원)</div>
            {tvPrice > 0 && <div>• TV: {tvPrice.toLocaleString()}원</div>}
            {optionPrice > 0 && <div>• 셋톱+와이파이: {optionPrice.toLocaleString()}원</div>}
            {bundleDiscount > 0 && <div>• 결합할인 ({bundle}): -{bundleDiscount.toLocaleString()}원</div>}
            {cardDiscountVal > 0 && <div>• 카드할인: -{cardDiscountVal.toLocaleString()}원</div>}
          </div>
        </div>
      )}
    </div>
  );
}
