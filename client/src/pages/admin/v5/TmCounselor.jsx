// V5 — TM 견적·영업 (TM Counselor) — Native React (Phase B)
//
// vanilla docs/tm-counselor.html (170KB)을 React로 재구성한 컴포넌트.
// 계산 엔진은 Phase A에서 추출한 quoteEngine.js + useQuoteEngine 훅을 그대로 사용.
//
// 주요 기능:
//  - 통신사/속도/WiFi/TV/셋톱/결합/회선/구간/다중TV 카드 입력
//  - 인센티브 미리보기 (POST /simulate, 본인 settlement fetch, 매칭 product 표시)
//  - 영업 등록 (POST /sales, Daum Postcode 주소검색)
//  - Realtime 구독 (incentive_sales 변경 → 자동 갱신)
//  - 내 영업 내역 (GET /sales?month=YYYY-MM)
//
// TODO Phase B2:
//  - KT 프리미엄 가족결합 5-row 멤버 입력 UI (현재 미구현)
//  - 영업 내역 상세 모달 + 취소 기능 (목록 표시까지만 구현)
//  - 상담 스크립트 / 메모 좌측 패널 (vanilla에 있음, B1 범위 외)
//  - quote_full_html 전송 (현재 quote_summary + monthly_fee만 전송)

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useV5Auth } from '../../../hooks/useV5Auth.jsx';
import useQuoteEngine from '../../../hooks/useQuoteEngine.js';
import { D, applyIncentivePaybackSync } from '../../../lib/quoteEngine.js';
import { supabase } from '../../../lib/supabase.js';

const fmtWon = (n) => (n == null ? '0' : Number(n).toLocaleString()) + '원';
const fmt = (n) => (n == null ? '0' : Number(n).toLocaleString());

// 통신사 / 결합 메타데이터
const CARRIER_OPTIONS = [
  { value: 'skt', label: 'SKT (B tv)', color: '#ed1c24' },
  { value: 'kt', label: 'KT (지니TV)', color: '#000000' },
  { value: 'lgu', label: 'LGU+ (U+tv)', color: '#e6007e' },
];

const SPEED_OPTIONS = ['100M', '500M', '1G'];

const BUNDLE_BY_CARRIER = {
  skt: [
    { value: 'family', label: '휴대폰 결합 (요즘가족결합) ⭐' },
    { value: 'sk-onfamily', label: '온가족할인 (가입년수 기반)' },
    { value: 'home', label: 'TV만 결합 (휴대폰 없을 때)' },
  ],
  kt: [
    { value: 'kt-total', label: '휴대폰 결합 (총액) ⭐' },
    { value: 'kt-fixed', label: '휴대폰 결합 (정액)' },
    { value: 'kt-premium', label: '💎 프리미엄 가족결합 (77K↑ · 2회선+)' },
    { value: 'kt-premium-single', label: '💎 프리미엄 싱글결합 (77K↑ · 1회선 · 500M↑)' },
    { value: 'home', label: 'TV만 결합 (휴대폰 없을 때)' },
  ],
  lgu: [
    { value: 'lgu-chweyswun', label: '휴대폰 결합 (참쉬운) ⭐' },
    { value: 'lgu-together', label: '휴대폰 결합 (투게더, 고가요금제)' },
    { value: 'home', label: 'TV만 결합 (휴대폰 없을 때)' },
  ],
};

// 시간대 옵션
const INSTALL_TIMES = [
  '오전 9~10시', '오전 10~11시', '오전 11~12시', '오후 12~13시',
  '오후 13~14시', '오후 14~15시', '오후 15~16시', '오후 16~17시',
  '오후 17~18시', '협의',
];

// 전화번호 자동 - 포맷
function formatPhoneAuto(v) {
  const d = (v || '').replace(/\D/g, '').slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return d.slice(0, 3) + '-' + d.slice(3);
  if (d.startsWith('02')) {
    if (d.length <= 9) return d.slice(0, 2) + '-' + d.slice(2, 5) + (d.length > 5 ? '-' + d.slice(5) : '');
    return d.slice(0, 2) + '-' + d.slice(2, 6) + '-' + d.slice(6);
  }
  return d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7);
}

// TV name → tier 매핑 (incentive_products.tv_tier)
function getTvTier(tvName) {
  if (!tvName || tvName === 'TV 없음') return null;
  return tvName.replace(/^B tv /, '').replace(/^지니TV /, '').replace(/^U\+tv /, '').trim();
}

// LocalStorage state for incentive
const INC_STATE_KEY = 'incentive-current-state-v1';
function loadIncState() {
  try {
    const s = JSON.parse(localStorage.getItem(INC_STATE_KEY) || '{}');
    return {
      points: Number(s.points) || 0,
      premium: Number(s.premium) || 0,
      payback: Number(s.payback) || 0,
    };
  } catch { return { points: 0, premium: 0, payback: 0 }; }
}
function saveIncState(s) {
  try { localStorage.setItem(INC_STATE_KEY, JSON.stringify(s)); } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────────────────────────────────────
export default function TmCounselor() {
  const { agent, getToken, apiCall } = useV5Auth();
  const { input, patch, result } = useQuoteEngine();
  const [products, setProducts] = useState([]);
  const [productsLoaded, setProductsLoaded] = useState(false);

  // 인센티브 상태 (수동 입력 + 누적 + 시뮬 결과)
  const [incInput, setIncInput] = useState(loadIncState);
  const [incShowInput, setIncShowInput] = useState(false);
  const [mySettlement, setMySettlement] = useState(null);
  const [simResult, setSimResult] = useState(null);
  const [matchedProduct, setMatchedProduct] = useState(null);

  // 영업 내역
  const [sales, setSales] = useState([]);
  const [salesOpen, setSalesOpen] = useState(false);

  // 계약 폼
  const [showDealForm, setShowDealForm] = useState(false);

  // 상품 카탈로그 로드 + payback 동기화
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await applyIncentivePaybackSync();
        const res = await fetch('/api/incentive/products');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setProducts(data.products || []);
        setProductsLoaded(true);
      } catch (e) {
        console.warn('[tm] products load failed', e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // BroadcastChannel — 같은 브라우저에서 상품 관리 탭 변경 시 reload
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const bc = new BroadcastChannel('incentive-products');
    bc.onmessage = async () => {
      try {
        await applyIncentivePaybackSync();
        const res = await fetch('/api/incentive/products');
        if (res.ok) {
          const data = await res.json();
          setProducts(data.products || []);
        }
      } catch {}
    };
    return () => bc.close();
  }, []);

  // 본인 settlement fetch
  const fetchMySettlement = useCallback(async () => {
    if (!agent) { setMySettlement(null); return; }
    const ym = new Date().toISOString().slice(0, 7);
    try {
      const res = await apiCall('GET', `/settlement?month=${ym}`);
      if (!res.ok) { setMySettlement(null); return; }
      const data = await res.json();
      const s = data.settlement || null;
      setMySettlement(s);
      // 누적 P / 우수 자동 갱신 (로그인 시 자동 동기화)
      if (s) {
        setIncInput((prev) => ({
          ...prev,
          points: Number(s.total_points) || 0,
          premium: Number(s.premium_count) || 0,
        }));
      }
    } catch { setMySettlement(null); }
  }, [agent, apiCall]);

  useEffect(() => { fetchMySettlement(); }, [fetchMySettlement]);

  // 영업 내역 fetch
  const fetchSales = useCallback(async () => {
    if (!agent) { setSales([]); return; }
    const ym = new Date().toISOString().slice(0, 7);
    try {
      const res = await apiCall('GET', `/sales?month=${ym}`);
      if (!res.ok) return;
      const data = await res.json();
      setSales(data.sales || []);
    } catch {}
  }, [agent, apiCall]);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  // Supabase Realtime — 본인 영업 변경 자동 갱신
  useEffect(() => {
    if (!agent) return;
    const tk = getToken();
    if (!tk) return;
    try { supabase.realtime.setAuth(tk); } catch {}
    const channel = supabase.channel('tm-sales-' + agent.id)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'incentive_sales',
        filter: 'agent_id=eq.' + agent.id,
      }, () => {
        fetchMySettlement();
        fetchSales();
      })
      .subscribe();
    return () => { try { supabase.removeChannel(channel); } catch {} };
  }, [agent, getToken, fetchMySettlement, fetchSales]);

  // 매칭 상품 찾기
  const findMatchedProduct = useCallback((carrier, speed, tvName) => {
    if (!productsLoaded) return null;
    const carrierMap = { skt: 'SKT', kt: 'KT', lgu: 'LGU+' };
    const c = carrierMap[carrier];
    const tier = getTvTier(tvName);
    if (!tier) return products.find(p => p.carrier === c && p.type === '단독' && p.speed === speed) || null;
    return products.find(p => p.carrier === c && p.type === '결합' && p.speed === speed && p.tv_tier === tier) || null;
  }, [products, productsLoaded]);

  // 매칭 상품 갱신 (carrier/speed/tv 변경 시)
  useEffect(() => {
    const tvName = D[input.carrier] && D[input.carrier].tv[input.tv] ? D[input.carrier].tv[input.tv].n : null;
    const p = findMatchedProduct(input.carrier, input.speed, tvName);
    setMatchedProduct(p);
  }, [input.carrier, input.speed, input.tv, findMatchedProduct]);

  // 인센티브 시뮬레이션 (debounce 200ms)
  const simTimerRef = useRef(null);
  useEffect(() => {
    if (!matchedProduct) { setSimResult(null); return; }
    if (simTimerRef.current) clearTimeout(simTimerRef.current);
    simTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/incentive/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            current_points: incInput.points,
            current_premium: incInput.premium,
            add_product_id: matchedProduct.id,
            add_qty: 1,
            add_payback: incInput.payback,
          }),
        });
        if (!res.ok) { setSimResult({ error: await res.text() }); return; }
        const { simulation } = await res.json();
        setSimResult(simulation);
      } catch (e) {
        setSimResult({ error: e.message });
      }
    }, 200);
    return () => { if (simTimerRef.current) clearTimeout(simTimerRef.current); };
  }, [matchedProduct, incInput.points, incInput.premium, incInput.payback]);

  // 인센티브 입력 변경 시 localStorage save
  useEffect(() => { saveIncState(incInput); }, [incInput]);

  // 셋톱 옵션이 carrier 변경 시 reset
  useEffect(() => {
    const d = D[input.carrier];
    if (!d || !d.setTopOptions) return;
    const def = d.setTopOptions.find(o => o.isDefault && o.active) || d.setTopOptions.find(o => o.active);
    if (def && (!input.settopId || !d.setTopOptions.some(o => o.id === input.settopId && o.active))) {
      patch({ settopId: def.id });
    }
    // settop2/3 default
    if (def && !input.settop2) patch({ settop2: def.id });
    if (def && !input.settop3) patch({ settop3: def.id });
  }, [input.carrier]); // eslint-disable-line react-hooks/exhaustive-deps

  // bundle reset on carrier change
  useEffect(() => {
    const opts = BUNDLE_BY_CARRIER[input.carrier] || [];
    if (!opts.some(o => o.value === input.bundle)) {
      patch({ bundle: opts[0]?.value || '', range: 0, lines: 1 });
    }
  }, [input.carrier]); // eslint-disable-line react-hooks/exhaustive-deps

  // bundle 변경 시 lines/range 기본값 리셋
  useEffect(() => {
    if (input.bundle === 'lgu-chweyswun' || input.bundle === 'lgu-together') {
      if (input.lines < 2) patch({ lines: 2 });
    } else if (input.bundle === 'family' || input.bundle === 'sk-onfamily') {
      if (input.lines < 1) patch({ lines: 1 });
    }
  }, [input.bundle]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={pageStyle}>
      <div style={layoutStyle}>
        <QuoteInputPanel input={input} patch={patch} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <IncentivePreview
            agent={agent}
            mySettlement={mySettlement}
            matchedProduct={matchedProduct}
            simResult={simResult}
            incInput={incInput}
            setIncInput={setIncInput}
            showInput={incShowInput}
            setShowInput={setIncShowInput}
            onCloseDeal={() => setShowDealForm(true)}
          />
          {showDealForm && agent && matchedProduct && (
            <DealForm
              agent={agent}
              apiCall={apiCall}
              matchedProduct={matchedProduct}
              quote={result}
              input={input}
              addPayback={incInput.payback}
              onClose={() => setShowDealForm(false)}
              onSuccess={() => { fetchMySettlement(); fetchSales(); setShowDealForm(false); }}
            />
          )}
          {agent && (
            <SalesList
              sales={sales}
              open={salesOpen}
              setOpen={setSalesOpen}
              apiCall={apiCall}
              onChanged={() => { fetchSales(); fetchMySettlement(); }}
            />
          )}
        </div>
        <QuoteResultPanel quote={result} input={input} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 견적 입력 패널 (가운데)
// ─────────────────────────────────────────────────────────────────────────────
function QuoteInputPanel({ input, patch }) {
  const d = D[input.carrier];
  const sp = input.speed;
  const ti = parseInt(input.tv, 10) || 0;
  const hasTv = ti > 0;
  const wifiIncluded = d.tvInternetNoWifi && d.tvInternetWithWifi && d.tvInternetNoWifi[sp] === d.tvInternetWithWifi[sp];

  // 셋톱 옵션
  const settopOptions = (d.setTopOptions || []).filter(o => o.active);
  // 결합 옵션
  const bundleOptions = BUNDLE_BY_CARRIER[input.carrier] || [];

  // lines/range 옵션 (bundle별 분기)
  const linesOpts = useMemo(() => {
    if (input.carrier === 'skt' && input.bundle === 'family') {
      return [1, 2, 3, 4, 5].map(n => ({ value: n, label: `${n}명 결합` }));
    }
    if (input.carrier === 'skt' && input.bundle === 'sk-onfamily') {
      return D.skt.bundle.onfamily.netYrLabels.map((l, i) => ({ value: i, label: l }));
    }
    if (input.carrier === 'lgu' && (input.bundle === 'lgu-chweyswun' || input.bundle === 'lgu-together')) {
      return [{ value: 2, label: '2회선' }, { value: 3, label: '3회선' }, { value: 4, label: '4회선+' }];
    }
    return [];
  }, [input.carrier, input.bundle]);

  const rangeOpts = useMemo(() => {
    if (input.carrier === 'skt' && input.bundle === 'sk-onfamily') {
      return D.skt.bundle.onfamily.famYrLabels.map((l, i) => ({ value: i, label: l }));
    }
    if (input.carrier === 'kt' && input.bundle === 'kt-total') {
      return D.kt.bundle.ranges_total.map((l, i) => ({ value: i, label: l }));
    }
    if (input.carrier === 'kt' && input.bundle === 'kt-fixed') {
      return D.kt.bundle.ranges_fixed.map((l, i) => ({ value: i, label: l }));
    }
    if (input.carrier === 'lgu' && input.bundle === 'lgu-chweyswun') {
      return D.lgu.bundle.chweyswun.planLabels.map((l, i) => ({ value: i, label: `휴대폰 월요금 ${l}` }));
    }
    return [];
  }, [input.carrier, input.bundle]);

  const showLgu500Bonus = input.carrier === 'lgu' && (sp === '500M' || sp === '1G');
  const showYouth = input.carrier === 'lgu' && input.bundle === 'lgu-together';
  const showPremiumSingle = input.carrier === 'kt' && input.bundle === 'kt-premium-single';
  const showPremium = input.carrier === 'kt' && input.bundle === 'kt-premium';

  return (
    <div style={panelStyle}>
      <Card label="1" title="통신사">
        <Options
          options={CARRIER_OPTIONS.map(c => ({ value: c.value, label: c.label }))}
          value={input.carrier}
          onChange={(v) => patch({ carrier: v, tv: 0, tv2: 0, tv3: 0, tvCount: 1 })}
          colorMap={Object.fromEntries(CARRIER_OPTIONS.map(c => [c.value, c.color]))}
        />
      </Card>

      <Card label="2" title="인터넷 속도">
        <Options
          options={SPEED_OPTIONS.map(s => ({ value: s, label: s }))}
          value={input.speed}
          onChange={(v) => patch({ speed: v })}
        />
      </Card>

      <Card label="3" title="WiFi" hint={wifiIncluded ? '기본 포함' : null}>
        <Options
          options={[{ value: 0, label: '미사용' }, { value: 1, label: '사용' }]}
          value={input.wifi ? 1 : 0}
          onChange={(v) => patch({ wifi: !!v })}
          disabled={wifiIncluded}
        />
        {wifiIncluded && (
          <div style={{ marginTop: 10, padding: '8px 11px', borderRadius: 8, background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', border: '1px solid #10b981', color: '#065f46', fontSize: 11.5, fontWeight: 600 }}>
            📶 이 통신사·속도는 WiFi 라우터가 무료로 기본 제공됩니다
          </div>
        )}
      </Card>

      {showLgu500Bonus && (
        <Card icon="🎁" title="LG U+ 500M·1G 기본제공 (무료 · 둘 중 하나)" highlight="lgu">
          <Options
            options={[
              { value: 'wifi2', label: '와이파이 2대 (0원)' },
              { value: 'wifi-speaker', label: '와이파이 1대 + 스마트홈 스피커 (0원)' },
            ]}
            value={input.lguBonus}
            onChange={(v) => patch({ lguBonus: v })}
          />
        </Card>
      )}

      <Card label="4" title="TV 상품">
        <Options
          options={d.tv.map((t, i) => ({ value: i, label: t.n + (t.p ? ` — ${fmtWon(t.p)}` : '') }))}
          value={input.tv}
          onChange={(v) => patch({ tv: parseInt(v, 10), tv2: 0, tv3: 0, tvCount: 1 })}
        />
      </Card>

      {hasTv && (
        <Card label="5" title="셋톱박스" hint="TV 임대료 별도">
          <Options
            options={settopOptions.map(o => ({ value: o.id, label: `${o.name} (${fmt(o.fee)})` }))}
            value={input.settopId || (settopOptions.find(o => o.isDefault) || {}).id || ''}
            onChange={(v) => patch({ settopId: v })}
          />
        </Card>
      )}

      {hasTv && (
        <Card icon="📺" title="TV 개수">
          <Options
            options={[1, 2, 3].map(n => ({ value: n, label: `${n}대` }))}
            value={input.tvCount}
            onChange={(v) => patch({ tvCount: parseInt(v, 10) })}
          />
        </Card>
      )}

      {hasTv && input.tvCount >= 2 && (
        <Card icon="📺" title="TV2 (추가)" hint="셋톱 50% 할인" highlight="indigo">
          <div style={{ fontSize: 11, fontWeight: 700, color: '#4f46e5', marginBottom: 4 }}>TV2 상품</div>
          <Options
            options={d.tv.map((t, i) => ({ value: i, label: t.n + (t.p ? ` — ${fmtWon(t.p)}` : '') }))}
            value={input.tv2}
            onChange={(v) => patch({ tv2: parseInt(v, 10) })}
          />
          <div style={{ fontSize: 11, fontWeight: 700, color: '#4f46e5', margin: '8px 0 4px' }}>셋톱2 (50% 할인)</div>
          <Options
            options={settopOptions.map(o => ({ value: o.id, label: `${o.name} — ${fmt(o.fee)}원` }))}
            value={input.settop2}
            onChange={(v) => patch({ settop2: v })}
          />
        </Card>
      )}

      {hasTv && input.tvCount >= 3 && (
        <Card icon="📺" title="TV3 (추가)" hint="셋톱 50% 할인" highlight="indigo">
          <div style={{ fontSize: 11, fontWeight: 700, color: '#4f46e5', marginBottom: 4 }}>TV3 상품</div>
          <Options
            options={d.tv.map((t, i) => ({ value: i, label: t.n + (t.p ? ` — ${fmtWon(t.p)}` : '') }))}
            value={input.tv3}
            onChange={(v) => patch({ tv3: parseInt(v, 10) })}
          />
          <div style={{ fontSize: 11, fontWeight: 700, color: '#4f46e5', margin: '8px 0 4px' }}>셋톱3 (50% 할인)</div>
          <Options
            options={settopOptions.map(o => ({ value: o.id, label: `${o.name} — ${fmt(o.fee)}원` }))}
            value={input.settop3}
            onChange={(v) => patch({ settop3: v })}
          />
        </Card>
      )}

      <Card label="6" title="결합 종류">
        <Options
          options={bundleOptions}
          value={input.bundle}
          onChange={(v) => patch({ bundle: v, range: 0 })}
        />
      </Card>

      {showYouth && (
        <Card icon="👶" title="청소년 추가 (-10,000원, 투게더 결합 한정)" highlight="pink">
          <Options
            options={[{ value: 0, label: '미적용' }, { value: 1, label: '청소년 추가 -10,000원' }]}
            value={input.youthAdd ? 1 : 0}
            onChange={(v) => patch({ youthAdd: !!v })}
          />
        </Card>
      )}

      {linesOpts.length > 0 && (
        <Card label="7" title="결합 인원 / 회선">
          <Options
            options={linesOpts}
            value={input.lines}
            onChange={(v) => patch({ lines: parseInt(v, 10) })}
          />
        </Card>
      )}

      {rangeOpts.length > 0 && (
        <Card label="8" title="요금 구간">
          <Options
            options={rangeOpts}
            value={input.range}
            onChange={(v) => patch({ range: parseInt(v, 10) })}
          />
        </Card>
      )}

      {showPremium && (
        <Card icon="💎" title="KT 프리미엄 가족결합 (회선별)">
          <div style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 6, padding: '10px 12px', fontSize: 11, color: '#7f1d1d', lineHeight: 1.5 }}>
            ⚠️ TODO Phase B2: 5-row 멤버 입력 UI 미구현. 현재는 결합 선택만 가능 (계산 결과 0건 처리). vanilla 페이지에서 사용하세요.
          </div>
        </Card>
      )}

      {showPremiumSingle && (
        <Card icon="💎" title="KT 프리미엄 싱글결합 (1회선)">
          <div className="tm-field" style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8' }}>📱 휴대폰 요금제 선택 (77,000원 이상)</label>
            <select
              value={input.premiumPlan}
              onChange={e => patch({ premiumPlan: parseInt(e.target.value, 10) })}
              style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #93c5fd', borderRadius: 8, fontSize: 12, background: '#fff', marginTop: 4 }}
            >
              {D.kt.bundle.premium.planCatalog.map((p, i) => (
                <option key={i} value={p.v}>{p.label}{p.dc ? ` → 프리미엄 -${p.dc.toLocaleString()}원` : ''}</option>
              ))}
            </select>
          </div>
          <div style={{ fontSize: 9, color: '#64748b', lineHeight: 1.5, background: '#eff6ff', borderRadius: 6, padding: '6px 8px' }}>
            ℹ️ 인터넷 <b>500M↑</b> · 1대만 결합 · 1인 가정 OK<br/>
            💡 <b>휴대폰 25% 할인</b>은 인터넷 단독이어도 적용 · 인터넷 단독 시 추가 -5,500원
          </div>
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Card / Options 공용
// ─────────────────────────────────────────────────────────────────────────────
function Card({ label, icon, title, hint, highlight, children }) {
  let bg = '#fff', border = '1.5px solid #e2e8f0';
  if (highlight === 'lgu') { bg = 'rgba(228,9,129,0.08)'; border = '1.5px solid rgba(228,9,129,0.4)'; }
  if (highlight === 'indigo') { bg = 'rgba(99,102,241,0.06)'; border = '1px solid rgba(99,102,241,0.3)'; }
  if (highlight === 'pink') { bg = 'rgba(236,72,153,0.08)'; border = '1.5px solid rgba(236,72,153,0.4)'; }
  return (
    <div style={{ background: bg, border, borderRadius: 14, padding: '14px 16px', boxShadow: '0 1px 2px rgba(15,23,42,0.03)', marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 10, letterSpacing: '0.04em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
        {label && (
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)', color: '#fff', borderRadius: '50%', fontSize: 10.5, fontWeight: 800 }}>{label}</span>
        )}
        {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
        <span style={{ textTransform: 'none', fontSize: 12 }}>{title}</span>
        {hint && <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 600, color: '#0ea5e9', background: '#e0f2fe', padding: '2px 7px', borderRadius: 10, textTransform: 'none', letterSpacing: 0 }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Options({ options, value, onChange, disabled, colorMap }) {
  return (
    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
      {options.map(o => {
        const sel = String(o.value) === String(value);
        const brandColor = colorMap?.[o.value];
        const baseStyle = {
          padding: '9px 14px', border: '1.5px solid #e2e8f0', borderRadius: 9, cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: 13, fontWeight: 600, background: '#fff', color: '#334155',
          userSelect: 'none', lineHeight: 1.3, opacity: disabled ? 0.5 : 1,
          transition: 'all 0.14s',
        };
        const selStyle = sel ? {
          background: brandColor ? `linear-gradient(135deg, ${brandColor}, ${brandColor})` : 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
          borderColor: brandColor || '#3b82f6',
          color: '#fff',
          boxShadow: '0 2px 8px rgba(59,130,246,0.35)',
          transform: 'translateY(-1px)',
        } : {};
        return (
          <div
            key={String(o.value)}
            style={{ ...baseStyle, ...selStyle }}
            onClick={() => !disabled && onChange(o.value)}
          >
            {o.label}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 견적 결과 패널 (우측, 다크)
// ─────────────────────────────────────────────────────────────────────────────
function QuoteResultPanel({ quote, input }) {
  if (!quote || !quote.isValid) return <div style={resultPanelStyle}>견적 입력을 확인하세요</div>;
  const sm = quote.sectorMain;
  const sf = quote.sectorFamily;

  return (
    <aside style={resultPanelStyle}>
      <h2 style={{ color: '#e2e8f0', borderBottom: '1.5px solid rgba(255,255,255,0.1)', fontSize: 12, marginBottom: 8, paddingBottom: 5, fontWeight: 800 }}>💰 견적 결과</h2>

      {/* 티켓번호 */}
      {quote.ticket && (
        <div style={{ background: 'rgba(99,102,241,0.13)', border: '1px solid rgba(129,140,248,0.6)', borderRadius: 7, padding: '7px 9px', marginBottom: 10 }}>
          <div style={{ fontSize: 9.5, color: '#a5b4fc', fontWeight: 700, marginBottom: 4, letterSpacing: '0.04em' }}>🎫 티켓번호</div>
          <div style={{ fontSize: 14, color: '#fff', fontWeight: 800, fontFamily: "'SF Mono', Monaco, monospace", letterSpacing: '0.8px' }}>
            {quote.ticket.number}
          </div>
        </div>
      )}

      {/* 섹터 1 */}
      {sm && <Sector1Display sm={sm} sp={input.speed} />}

      {/* 섹터 2 */}
      {sf && <Sector2Display sf={sf} input={input} />}

      {/* 휴대폰 할인 */}
      {quote.mobileDiscount > 0 && sf && (
        <div style={{ marginTop: 8, padding: '7px 9px', background: 'rgba(34,197,94,0.10)', borderRadius: 7, border: '1px solid rgba(34,197,94,0.3)' }}>
          <div style={{ fontSize: 11, color: '#86efac', fontWeight: 700, marginBottom: 3 }}>📱 휴대폰 결합 할인 (별도 차감)</div>
          <Line l="휴대폰 요금에서" v={`-${fmtWon(quote.mobileDiscount)}`} dc />
        </div>
      )}

      {/* 사은품 */}
      {quote.gift > 0 && (
        <div className="calc-line gift" style={{ background: 'rgba(251,191,36,0.12)', borderRadius: 6, padding: '6px 10px', marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ color: '#fbbf24', fontSize: 16, fontWeight: 800 }}>🎁 현금 사은품</span>
          <span style={{ color: '#fbbf24', fontSize: 22, fontWeight: 900 }}>{fmtWon(quote.gift)}</span>
        </div>
      )}

      {/* 설치비 */}
      <div style={{ marginTop: 5, padding: '5px 8px', background: 'rgba(255,255,255,0.04)', borderRadius: 5, border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.55)', fontWeight: 700, marginBottom: 2, letterSpacing: '0.04em' }}>🔧 설치비 (1회)</div>
        <Line l="평일 (본 인터넷+TV)" v={fmtWon(quote.install.weekday)} small />
        <Line l={<>주말 <span style={{ fontSize: 9.5, color: 'rgba(248,113,113,0.7)' }}>(+25%)</span></>} v={fmtWon(quote.install.weekend)} valColor="#fca5a5" small />
        {quote.install.additional > 0 && (
          <>
            <Line l={`└ 추가 TV (${(input.tvCount || 1) - 1}대 × ${(quote.install.additionalBase / Math.max(1, (input.tvCount || 1) - 1)).toLocaleString()})`} v={`+${fmtWon(quote.install.additionalBase)}`} small sub />
            <Line l="└ 추가 TV 50% 할인" v={`-${fmtWon(quote.install.additionalDiscount)}`} small dc />
            <Line l="→ 추가 설치비 실납" v={fmtWon(quote.install.additional)} small sub />
            <div style={{ borderTop: '1px dashed rgba(255,255,255,0.2)', marginTop: 3, paddingTop: 3 }}>
              <Line l="평일 합계" v={fmtWon(quote.install.weekdayWithAdditional)} small total />
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

function Sector1Display({ sm, sp }) {
  if (sm.kind === 'internet-only') {
    return (
      <div style={{ background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, padding: '8px 10px', marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: '#93c5fd', fontWeight: 800, marginBottom: 4 }}>🌐 인터넷 단독</div>
        <Line l={`인터넷 (${sp})`} v={fmtWon(sm.netBase)} />
        {sm.wifiOn && sm.wifiCost > 0 && <Line l={`WiFi${sm.wifiName ? ` (${sm.wifiName})` : ''}`} v={`+${fmtWon(sm.wifiCost)}`} />}
        {sm.wifiOn && sm.wifiCost === 0 && <Line l={`WiFi${sm.wifiName ? ` (${sm.wifiName})` : ''} (무료)`} v="0원" />}
        {sm.ktPremiumSingleInetDc > 0 && (
          <>
            <Line l="└ 소계" v={fmtWon(sm.subTotal)} sub />
            <Line l="💎 KT 프리미엄 싱글결합 추가 할인" v={`-${fmtWon(sm.ktPremiumSingleInetDc)}`} dc />
          </>
        )}
        <Line l="월 합계" v={fmtWon(sm.total)} total />
        {sm.lguBonus && <div style={{ fontSize: 10, color: '#fbcfe8', marginTop: 4 }}>🎁 {sm.lguBonus}</div>}
      </div>
    );
  }
  // tv-bundle
  return (
    <div style={{ background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, padding: '8px 10px', marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: '#93c5fd', fontWeight: 800, marginBottom: 4 }}>📺 {sm.title}</div>
      <Line l={`인터넷 (${sp})`} v={fmtWon(sm.netBase)} />
      {sm.wifiOn && sm.wifiCost > 0 && <Line l={`+ WiFi${sm.wifiName ? ` (${sm.wifiName})` : ''}`} v={`+${fmtWon(sm.wifiCost)}`} />}
      {sm.netDiscount > 0 && <Line l="인터넷 결합 할인" v={`-${fmtWon(sm.netDiscount)}`} dc />}
      <Line l={`→ 인터넷 결합가${sm.wifiOn ? ' (WiFi 포함)' : ''}`} v={fmtWon(sm.netCombo)} sub />
      <Line l={sm.tvName.split('(')[0].trim()} v={`+${fmtWon(sm.tvBase)}`} />
      {sm.tvDc > 0 && <Line l="TV 결합 할인" v={`-${fmtWon(sm.tvDc)}`} dc />}
      <Line l="→ TV 최종요금" v={fmtWon(sm.tvFinal)} sub />
      {sm.setTopFee > 0 && (
        <>
          <Line l={`📦 셋톱 기본료${sm.setTopName ? ` (${sm.setTopName})` : ''}`} v={`+${fmtWon(sm.setTopFee)}`} />
          {sm.settopDiscount > 0 && (
            <>
              <Line l="└ 결합 할인" v={`-${fmtWon(sm.settopDiscount)}`} dc />
              <Line l="→ 셋톱 실납" v={fmtWon(sm.setTopFee - sm.settopDiscount)} sub valColor="#60a5fa" />
            </>
          )}
        </>
      )}
      {/* 추가 TV */}
      {sm.multiTv && sm.multiTv.map((m) => (
        <MultiTvDisplay key={m.slot} m={m} />
      ))}
      <Line l="월 합계" v={fmtWon(sm.total)} total valColor="#60a5fa" />
      {sm.lguBonus && <div style={{ fontSize: 10, color: '#fbcfe8', marginTop: 4 }}>🎁 {sm.lguBonus}</div>}
    </div>
  );
}

function MultiTvDisplay({ m }) {
  return (
    <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed rgba(255,255,255,0.15)' }}>
      <div style={{ fontSize: 11, color: '#a5b4fc', fontWeight: 700, marginBottom: 4 }}>📺 TV{m.slot} 추가 ({m.tvName})</div>
      <Line l={`TV${m.slot} 기본료`} v={`+${fmtWon(m.tvBase)}`} />
      {m.tvDc > 0 && <Line l={`└ TV${m.slot} 추가 할인`} v={`-${fmtWon(m.tvDc)}`} dc />}
      <Line l={`→ TV${m.slot} 결합가`} v={fmtWon(m.tvFinal)} sub />
      {m.settopName && (
        <>
          <Line l={`📦 셋톱${m.slot} (${m.settopName})`} v={`+${fmtWon(m.settopFee)}`} />
          {m.settopDiscount > 0 && (
            <>
              <Line l={`└ 셋톱${m.slot} 추가 50% 할인`} v={`-${fmtWon(m.settopDiscount)}`} dc />
              <Line l={`→ 셋톱${m.slot} 실납`} v={fmtWon(m.settopFinal)} sub />
            </>
          )}
        </>
      )}
    </div>
  );
}

function Sector2Display({ sf, input }) {
  if (!sf) return null;
  const k = sf.kind;
  // 공용 wrapper
  const wrapper = (color, content) => (
    <div style={{ marginTop: 6, padding: '7px 9px', background: `rgba(${color},0.12)`, border: `1.5px solid rgba(${color},0.5)`, borderRadius: 8, marginBottom: 6 }}>
      {content}
    </div>
  );

  if (k === 'kt-total' || k === 'kt-fixed') {
    const isTotal = k === 'kt-total';
    return wrapper('99,102,241', (
      <>
        <div style={{ fontSize: 12, color: '#a5b4fc', fontWeight: 800, marginBottom: 4 }}>📊 섹터 2 — {sf.title} ({sf.rangeLabel})</div>
        <Line l={`인터넷 (${input.speed})${input.wifi ? ' + WiFi' : ''}`} v={fmtWon(sf.netSingleWithWifi)} />
        {sf.ktBaseInetDc > 0 && <Line l="KT 기본 TV결합 인터넷 할인" v={`-${fmtWon(sf.ktBaseInetDc)}`} dc />}
        <Line l={`${isTotal ? '총액' : '정액'} 결합 인터넷 추가 할인 (중복)`} v={`-${fmtWon(sf.inetDc)}`} dc />
        <Line l="→ 인터넷 실질" v={fmtWon(sf.inetAfterAll)} sub />
        {sf.tvBase > 0 && (
          <>
            <Line l="TV 기본료" v={fmtWon(sf.tvBase)} />
            <Line l="TV 결합 할인" v={`-${fmtWon(sf.tvDc)}`} dc />
            <Line l="→ TV 실질" v={fmtWon(sf.tvAfter)} sub />
            {sf.setTopFee > 0 && <Line l="셋톱박스" v={`+${fmtWon(sf.setTopFee)}`} />}
          </>
        )}
        {sf.multiTv && sf.multiTv.map(m => <MultiTvDisplay key={m.slot} m={m} />)}
        <Line l="✨ 인터넷+TV 월 실질요금" v={fmtWon(sf.finalInet)} total valColor="#60a5fa" />
        <Line l={`휴대폰 할인 (${sf.rangeLabel} 구간)`} v={`-${fmtWon(sf.mobileDiscount)}`} dc />
      </>
    ));
  }
  if (k === 'kt-premium-single') {
    return wrapper('251,191,36', (
      <>
        <div style={{ fontSize: 12, color: '#fde68a', fontWeight: 800, marginBottom: 4 }}>💎 {sf.title}</div>
        {!sf.eligible && sf.warnings && sf.warnings.length > 0 && (
          <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 6, padding: '6px 8px', marginBottom: 6, fontSize: 10.5, color: '#fca5a5' }}>
            ⚠️ {sf.warnings.join(' · ')}
          </div>
        )}
        {sf.eligible && (
          <>
            <Line l={`휴대폰 25% 할인 (${sf.psPlanV.toLocaleString()}원 요금제)`} v={`-${fmtWon(sf.psDc)}`} dc />
            {sf.inetSoloDc > 0 && <Line l="인터넷 단독 추가 할인" v={`-${fmtWon(sf.inetSoloDc)}`} dc />}
            <Line l="총 할인 합계" v={fmtWon(sf.psTotalDc)} total />
          </>
        )}
      </>
    ));
  }
  if (k === 'kt-premium') {
    return wrapper('220,38,38', (
      <>
        <div style={{ fontSize: 12, color: '#fca5a5', fontWeight: 800, marginBottom: 4 }}>💎 {sf.title}</div>
        <div style={{ fontSize: 11, color: '#fee2e2' }}>5-row 멤버 입력 UI는 vanilla 페이지에서 사용 (TODO Phase B2)</div>
        {sf.eligible && (
          <>
            <Line l="총액 결합 멤버 합" v={fmtWon(sf.totalSum)} />
            <Line l={`총액 휴대폰 할인 (${sf.rangeLabel})`} v={`-${fmtWon(sf.totalMobDc)}`} dc />
            <Line l="프리미엄 휴대폰 할인 합" v={`-${fmtWon(sf.premTotalDc)}`} dc />
            <Line l="총 할인 (인터넷+휴대폰)" v={fmtWon(sf.totalGrandDc)} total />
          </>
        )}
      </>
    ));
  }
  if (k === 'lgu-chweyswun' || k === 'lgu-together') {
    const isTogether = k === 'lgu-together';
    return wrapper('230,0,126', (
      <>
        <div style={{ fontSize: 12, color: '#fbcfe8', fontWeight: 800, marginBottom: 4 }}>📱 {sf.title} ({sf.lines}회선 · {sf.planLabel})</div>
        <Line l={`인터넷 (${input.speed})${input.wifi ? ' + WiFi' : ''}`} v={fmtWon(sf.netSingleWithWifi)} />
        <Line l="결합 인터넷 할인" v={`-${fmtWon(sf.lguInetDc)}`} dc />
        <Line l="→ 인터넷 실질" v={fmtWon(sf.inetAfter)} sub />
        {sf.tvBase > 0 && (
          <>
            <Line l="TV 기본료" v={fmtWon(sf.tvBase)} />
            <Line l="TV 결합 할인" v={`-${fmtWon(sf.tvDc)}`} dc />
            <Line l="→ TV 실질" v={fmtWon(sf.tvAfter)} sub />
            {sf.setTopFee > 0 && <Line l="셋톱박스" v={`+${fmtWon(sf.setTopFee)}`} />}
          </>
        )}
        {sf.multiTv && sf.multiTv.map(m => <MultiTvDisplay key={m.slot} m={m} />)}
        <Line l="✨ 인터넷+TV 월 실질요금" v={fmtWon(sf.finalInet)} total valColor="#f472b6" />
        <Line l={`휴대폰 할인 (1인당)`} v={`-${fmtWon(sf.lguMobDc)}`} dc />
        {isTogether && sf.youthDc > 0 && <Line l="청소년 추가 할인" v={`-${fmtWon(sf.youthDc)}`} dc />}
      </>
    ));
  }
  if (k === 'family') {
    return wrapper('99,102,241', (
      <>
        <div style={{ fontSize: 12, color: '#a5b4fc', fontWeight: 800, marginBottom: 4 }}>👨‍👩‍👧‍👦 섹터 2 — {sf.title} ({sf.lines}명 결합)</div>
        <Line l={`인터넷 (${input.speed})${input.wifi ? ' + WiFi' : ''}`} v={fmtWon(sf.netSingleWithWifi)} />
        <Line l="요즘가족결합 인터넷 할인" v={`-${fmtWon(sf.famInetDc)}`} dc />
        <Line l="→ 인터넷 실질" v={fmtWon(sf.inetAfterFamily)} sub />
        {sf.tvBase > 0 && (
          <>
            <Line l="TV 기본료" v={fmtWon(sf.tvBase)} />
            <Line l="TV 결합 할인" v={`-${fmtWon(sf.tvBaseDc)}`} dc />
            {sf.famIptvDc > 0 && <Line l="요즘가족결합 IPTV 추가 할인" v={`-${fmtWon(sf.famIptvDc)}`} dc />}
            <Line l="→ TV 실질" v={fmtWon(sf.tvAfterFamily)} sub />
            {sf.setTopFee > 0 && <Line l="셋톱박스" v={`+${fmtWon(sf.setTopFee)}`} />}
          </>
        )}
        {sf.multiTv && sf.multiTv.map(m => <MultiTvDisplay key={m.slot} m={m} />)}
        <Line l="✨ 인터넷+TV 월 실질요금" v={fmtWon(sf.finalInet)} total valColor="#60a5fa" />
        <Line l={`휴대폰 할인 (1인 ${sf.perPerson.toLocaleString()}원 × ${sf.lines}명)`} v={`-${fmtWon(sf.mobileDiscount)}`} dc />
      </>
    ));
  }
  if (k === 'sk-onfamily') {
    return wrapper('168,85,247', (
      <>
        <div style={{ fontSize: 12, color: '#d8b4fe', fontWeight: 800, marginBottom: 4 }}>👨‍👩‍👧‍👦 섹터 2 — {sf.title} ({sf.netYrLabel} × {sf.famYrLabel} → <b>{sf.pct}%</b>)</div>
        {sf.pct === 0 && <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 6, padding: '8px 10px', marginBottom: 10, fontSize: 11, color: '#fca5a5' }}>⚠️ 이 조건은 온가족할인 적용 불가</div>}
        <Line l={`인터넷 ${input.tv > 0 ? '결합가' : '단독가'} (${input.speed}${input.wifi ? ' + WiFi' : ''})`} v={fmtWon(sf.inetBase)} />
        <Line l={`온가족할인 ${sf.pct}% (인터넷에 적용)`} v={`-${fmtWon(sf.onfamilyDc)}`} dc />
        <Line l="→ 인터넷 실질" v={fmtWon(sf.inetAfterOf)} sub />
        {sf.tvBase > 0 && (
          <>
            <Line l="TV 기본료" v={fmtWon(sf.tvBase)} />
            <Line l="TV 결합 할인" v={`-${fmtWon(sf.tvDc)}`} dc />
            <Line l="→ TV 실질" v={fmtWon(sf.tvAfter)} sub />
            {sf.setTopFee > 0 && <Line l="셋톱박스" v={`+${fmtWon(sf.setTopFee)}`} />}
          </>
        )}
        {sf.multiTv && sf.multiTv.map(m => <MultiTvDisplay key={m.slot} m={m} />)}
        <Line l={`✨ ${input.tv > 0 ? '인터넷+TV ' : '인터넷 '}월 실질요금`} v={fmtWon(sf.finalInet)} total valColor="#a855f7" />
      </>
    ));
  }
  return null;
}

function Line({ l, v, total, sub, dc, small, valColor }) {
  let fontSize = 'clamp(11.5px, 0.95vw, 14px)';
  let fontWeight = 700;
  let labelColor = 'rgba(226,232,240,0.7)';
  let valueColor = valColor || '#f8fafc';
  let extra = {};
  if (total) {
    fontSize = 'clamp(16px, 1.5vw, 22px)';
    fontWeight = 900;
    labelColor = '#f8fafc';
    extra = { borderTop: '1.5px solid rgba(255,255,255,0.2)', marginTop: 9, paddingTop: 11 };
  } else if (sub) {
    fontSize = 'clamp(10px, 0.85vw, 12.5px)';
    labelColor = 'rgba(226,232,240,0.45)';
    valueColor = valColor || 'rgba(226,232,240,0.55)';
    extra = { paddingLeft: 12 };
  } else if (dc) {
    valueColor = '#4ade80';
  }
  if (small) fontSize = '11px';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', lineHeight: 1.5, fontSize, fontWeight: 500, ...extra }}>
      <span style={{ color: labelColor, fontWeight: total ? 800 : 500 }}>{l}</span>
      <span style={{ color: valueColor, fontWeight }}>{v}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 인센티브 미리보기
// ─────────────────────────────────────────────────────────────────────────────
function IncentivePreview({ agent, mySettlement, matchedProduct, simResult, incInput, setIncInput, showInput, setShowInput, onCloseDeal }) {
  const isAdmin = agent && (agent.role === 'admin' || agent.role === 'manager');
  const tierEmoji = matchedProduct ? ({ S: '🌟', A: '⭐', B: '🔵', C: '⚪' })[matchedProduct.tier] || '' : '';

  return (
    <div style={{ background: 'linear-gradient(135deg,#fef3c7,#fde68a)', border: '1.5px solid #f59e0b', borderRadius: 12, padding: '12px 14px', boxShadow: '0 2px 8px rgba(245,158,11,0.15)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: '#92400e', letterSpacing: '0.04em' }}>💰 V5 인센티브 미리보기</div>
        <button type="button" onClick={() => setShowInput(!showInput)} style={{ fontSize: 10, padding: '2px 6px', background: '#fff', border: '1px solid #f59e0b', color: '#92400e', borderRadius: 4, cursor: 'pointer' }}>
          ⚙️ 누적
        </button>
      </div>

      {/* 내 현재 상태 (로그인 시) */}
      {mySettlement && (
        <div style={{ background: 'linear-gradient(135deg,rgba(255,255,255,0.7),rgba(255,255,255,0.5))', border: '1.5px solid #d97706', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
          <div style={{ fontSize: 9.5, color: '#78350f', fontWeight: 800, marginBottom: 6, letterSpacing: '0.04em' }}>📊 내 현재 상태 (이번 달)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, textAlign: 'center' }}>
            <StatusBox label="Grade" v={<GradeBadge g={mySettlement.grade_applied || mySettlement.grade_target || 1} />} />
            <StatusBox label="누적 P" v={`${mySettlement.total_points || 0}P`} />
            <StatusBox label="우수 건수" v={`${mySettlement.premium_count || 0}건`} />
            <StatusBox label="예상 수령" v={fmt(mySettlement.agent_total) + '원'} valueColor="#16a34a" />
          </div>
        </div>
      )}

      {/* 수동 입력 (toggle) */}
      {showInput && (
        <div style={{ background: 'rgba(255,255,255,0.6)', borderRadius: 6, padding: '8px 10px', marginBottom: 8 }}>
          <div style={{ fontSize: 9.5, color: '#78350f', marginBottom: 4, fontWeight: 700 }}>📊 이번 달 누적 (수동 입력)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            <NumLabel label="누적 P" value={incInput.points} step={0.5} readOnly={!!mySettlement} onChange={v => setIncInput({ ...incInput, points: v })} />
            <NumLabel label="우수 건수" value={incInput.premium} step={1} readOnly={!!mySettlement} onChange={v => setIncInput({ ...incInput, premium: v })} />
            <NumLabel label="추가 페이백" value={incInput.payback} step={1000} max={50000} onChange={v => setIncInput({ ...incInput, payback: v })} />
          </div>
        </div>
      )}

      {/* 시뮬 결과 */}
      <div style={{ fontSize: 11, color: '#78350f', lineHeight: 1.6 }}>
        {!matchedProduct && (
          <div style={{ color: '#92400e', opacity: 0.7 }}>⚠️ 매칭 상품 없음 (carrier/speed/tv 조합 확인)</div>
        )}
        {matchedProduct && simResult && simResult.error && (
          <div style={{ color: '#dc2626' }}>시뮬 오류: {String(simResult.error).slice(0, 200)}</div>
        )}
        {matchedProduct && simResult && !simResult.error && (
          <SimResultDisplay isAdmin={isAdmin} product={matchedProduct} sim={simResult} mySettlement={mySettlement} incInput={incInput} tierEmoji={tierEmoji} />
        )}
      </div>

      {/* 계약 완료 버튼 */}
      <button
        type="button"
        disabled={!agent || !matchedProduct}
        onClick={onCloseDeal}
        style={{
          marginTop: 8, width: '100%', padding: 8, background: '#16a34a', color: '#fff', border: 'none',
          borderRadius: 6, fontWeight: 800, cursor: (!agent || !matchedProduct) ? 'not-allowed' : 'pointer',
          fontSize: 12, letterSpacing: '0.04em', opacity: (!agent || !matchedProduct) ? 0.5 : 1,
        }}
      >
        📝 이 견적으로 계약 완료{!agent ? ' (로그인 필요)' : ''}
      </button>
    </div>
  );
}

function StatusBox({ label, v, valueColor }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: '#78350f', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 900, color: valueColor || '#1e293b' }}>{v}</div>
    </div>
  );
}

function GradeBadge({ g }) {
  const c = ['', '#6b7280', '#3b82f6', '#dc2626'][g] || '#6b7280';
  return <span style={{ background: c, color: '#fff', padding: '2px 10px', borderRadius: 5, fontWeight: 800 }}>G{g}</span>;
}

function NumLabel({ label, value, step, max, readOnly, onChange }) {
  return (
    <label style={{ fontSize: 10, color: '#78350f' }}>{label}
      <input
        type="number" min="0" step={step} max={max} value={value}
        readOnly={readOnly}
        onChange={e => onChange(Number(e.target.value) || 0)}
        style={{ width: '100%', padding: '3px 5px', border: '1px solid #d97706', borderRadius: 4, fontSize: 11, background: readOnly ? '#f3f4f6' : '#fff' }}
      />
    </label>
  );
}

function SimResultDisplay({ isAdmin, product, sim, mySettlement, incInput, tierEmoji }) {
  const newP = (incInput.points || 0) + (parseFloat(product.point_weight) || 0);
  const newPrem = (incInput.premium || 0) + (product.is_premium ? 1 : 0);
  const gradeUp = sim.after_grade > sim.current_grade;
  const deltaC = sim.delta_total > 0 ? '#16a34a' : sim.delta_total < 0 ? '#dc2626' : '#6b7280';

  if (!isAdmin) {
    const baseSalary = mySettlement ? mySettlement.base_salary : 2300000;
    const currentTotal = mySettlement ? mySettlement.agent_total : 2300000;
    const newDeduct = (mySettlement ? mySettlement.total_agent_payback_deduct : 0) + (incInput.payback > 30000 ? incInput.payback - 30000 : 0);
    const newAgentTotal = baseSalary + sim.after_incentive + sim.after_bonus - newDeduct;
    const totalDelta = newAgentTotal - currentTotal;
    const totalDeltaC = totalDelta > 0 ? '#16a34a' : totalDelta < 0 ? '#dc2626' : '#6b7280';

    return (
      <>
        <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 6, padding: '8px 10px', marginBottom: 8, fontSize: 11 }}>
          🎯 <b>{product.name}</b> {tierEmoji} <b style={{ color: '#92400e' }}>{product.tier}</b>
          {product.is_premium && <span style={{ background: '#dc2626', color: '#fff', padding: '1px 6px', borderRadius: 4, fontSize: 9, marginLeft: 6, fontWeight: 700 }}>⭐ 우수상품</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11 }}>
          <div style={{ background: 'rgba(255,255,255,0.6)', borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 9.5, color: '#78350f', fontWeight: 700, marginBottom: 3 }}>📊 포인트</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#78350f' }}>{incInput.points} → <span style={{ color: '#15803d' }}>{newP}</span>P</div>
            <div style={{ fontSize: 9.5, color: '#16a34a', marginTop: 2 }}>+{(newP - incInput.points).toFixed(1)}P</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.6)', borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 9.5, color: '#78350f', fontWeight: 700, marginBottom: 3 }}>⭐ 우수</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#78350f' }}>{incInput.premium} → <span style={{ color: product.is_premium ? '#15803d' : '#78350f' }}>{newPrem}</span>건</div>
            <div style={{ fontSize: 9.5, color: product.is_premium ? '#16a34a' : '#9ca3af', marginTop: 2 }}>{product.is_premium ? '+1' : '변동 없음'}</div>
          </div>
        </div>
        {mySettlement && (
          <div style={{ marginTop: 8, background: gradeUp ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.6)', borderRadius: 6, padding: '8px 10px', fontSize: 10.5, border: gradeUp ? '1.5px solid #22c55e' : 'none' }}>
            <div style={{ fontSize: 9.5, color: gradeUp ? '#15803d' : '#78350f', fontWeight: 700, marginBottom: 4 }}>🚀 +1건 추가 시 ({gradeUp ? '⬆️ 승급!' : '예상'})</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <GradeBadge g={sim.after_grade} />
              <div style={{ fontWeight: 700, color: '#78350f', flex: 1 }}>{newP}P · 우수 {newPrem}건</div>
              <div style={{ fontWeight: 900, color: gradeUp ? '#15803d' : '#78350f', fontSize: 13 }}>{fmt(newAgentTotal)}원</div>
            </div>
          </div>
        )}
        <div style={{ marginTop: 8, background: 'linear-gradient(135deg,#fff,#fef9c3)', borderRadius: 6, padding: 10, border: `1.5px dashed ${totalDeltaC}`, textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#78350f', fontWeight: 700, marginBottom: 3 }}>📈 이 한 건의 가치 (월 수령 변동)</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: totalDeltaC, letterSpacing: '-0.02em' }}>{totalDelta > 0 ? '+' : ''}{fmt(totalDelta)}원</div>
          {gradeUp && <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 700, marginTop: 3 }}>⚡ Grade 승급 → 누적 P 전체 단가 소급 적용!</div>}
          {incInput.payback > 30000 && <div style={{ fontSize: 9, color: '#dc2626', marginTop: 3 }}>⚠️ 페이백 {fmt(incInput.payback - 30000)}원 본인 차감 반영</div>}
        </div>
      </>
    );
  }

  // 관리자 뷰
  const gradeColor = ['', '#6b7280', '#3b82f6', '#dc2626'][sim.after_grade] || '#6b7280';
  return (
    <>
      <div style={{ background: 'rgba(255,255,255,0.6)', borderRadius: 6, padding: '6px 8px', marginBottom: 6, fontSize: 10 }}>
        🎯 매칭: <b>{product.name}</b> {tierEmoji} {product.tier}
        {product.is_premium && <span style={{ background: '#dc2626', color: '#fff', padding: '1px 6px', borderRadius: 4, fontSize: 9, marginLeft: 4 }}>우수</span>}
        {' · 가중치 '}{product.point_weight}P
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11 }}>
        <div style={{ background: 'rgba(255,255,255,0.5)', borderRadius: 6, padding: '6px 8px' }}>
          <div style={{ fontSize: 9, color: '#78350f', fontWeight: 700, marginBottom: 2 }}>현재 (G{sim.current_grade})</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#78350f' }}>{fmt(sim.current_total)}원</div>
        </div>
        <div style={{ background: gradeUp ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.5)', borderRadius: 6, padding: '6px 8px', border: gradeUp ? '1.5px solid #22c55e' : 'none' }}>
          <div style={{ fontSize: 9, color: gradeColor, fontWeight: 700, marginBottom: 2 }}>+1건 후 (G{sim.after_grade}){gradeUp ? ' ⬆️ 승급!' : ''}</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: gradeColor }}>{fmt(sim.after_total)}원</div>
        </div>
      </div>
      <div style={{ marginTop: 6, background: 'linear-gradient(135deg,#fff,#fef9c3)', borderRadius: 6, padding: '8px 10px', border: `1.5px dashed ${deltaC}`, textAlign: 'center' }}>
        <div style={{ fontSize: 9.5, color: '#78350f', fontWeight: 700, marginBottom: 2 }}>📈 이 한 건 추가 시 변화 (P: {incInput.points}→{newP}, 우수: {incInput.premium}→{newPrem})</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: deltaC, letterSpacing: '-0.02em' }}>{sim.delta_total > 0 ? '+' : ''}{fmt(sim.delta_total)}원</div>
        {gradeUp && <div style={{ fontSize: 9.5, color: '#16a34a', fontWeight: 700, marginTop: 2 }}>⚡ Grade 승급으로 누적 P 전체 단가 소급</div>}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 계약 폼 (Daum Postcode)
// ─────────────────────────────────────────────────────────────────────────────
function DealForm({ matchedProduct, quote, input, addPayback, apiCall, onClose, onSuccess }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [installDate, setInstallDate] = useState('');
  const [installTime, setInstallTime] = useState('');
  const [address, setAddress] = useState('');
  const [addressDetail, setAddressDetail] = useState('');
  const [notes, setNotes] = useState('');
  const [payback, setPayback] = useState(addPayback || 0);
  const [msg, setMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Daum postcode
  const openAddressSearch = useCallback(() => {
    if (typeof window === 'undefined' || !window.daum || !window.daum.Postcode) {
      alert('주소 검색 API 로드 중. 잠시 후 다시 시도하세요.');
      return;
    }
    new window.daum.Postcode({
      oncomplete: (data) => {
        const fullAddr = data.address + (data.buildingName ? ` (${data.buildingName})` : '');
        setAddress(fullAddr);
      },
    }).open();
  }, []);

  const handleSubmit = async () => {
    setMsg('');
    if (payback < 0 || payback > 50000) { setMsg('페이백은 0~50,000원'); return; }

    // quote_summary 빌드
    const carrierName = { skt: 'SKT', kt: 'KT', lgu: 'LGU+' }[input.carrier] || input.carrier;
    const bundleName = {
      family: '요즘가족결합', 'sk-onfamily': 'SKT 온가족할인',
      'kt-total': 'KT 총액결합', 'kt-fixed': 'KT 정액결합',
      'kt-premium': 'KT 프리미엄 가족결합', 'kt-premium-single': 'KT 프리미엄 싱글결합',
      'lgu-chweyswun': 'LGU+ 참쉬운', 'lgu-together': 'LGU+ 투게더',
      home: 'TV만 결합',
    }[input.bundle] || input.bundle;
    const tv1 = D[input.carrier]?.tv?.[input.tv]?.n || '인터넷 단독';
    const tv1Disp = input.tv === 0 ? '인터넷 단독' : tv1;
    const tvCntDisp = input.tvCount > 1 ? ` (TV ${input.tvCount}대)` : '';
    const wifiDisp = input.wifi ? ' + WiFi' : ' WiFi 미사용';
    const summary = `[${carrierName} ${input.speed}] ${tv1Disp}${tvCntDisp}${wifiDisp}\n└ ${bundleName}`;

    // 추가 TV 정보
    const additional = [];
    const d = D[input.carrier];
    if (input.tvCount >= 2 && d && d.additionalTvPolicy && d.additionalTvPolicy.enabled) {
      [2, 3].forEach(n => {
        if (n > input.tvCount) return;
        const tvIdx = n === 2 ? input.tv2 : input.tv3;
        if (tvIdx === 0) return;
        const tv = d.tv[tvIdx];
        const settopId = n === 2 ? input.settop2 : input.settop3;
        const settop = d.setTopOptions?.find(o => o.id === settopId);
        additional.push({
          position: 'TV' + n,
          tv_name: tv.n, tv_price: tv.p, tv_discount: tv.tv2Discount || 0,
          settop_id: settopId, settop_name: settop?.name || null, settop_fee: settop?.fee || 0,
        });
      });
    }

    // monthly_fee — 섹터 2 우선, 없으면 섹터 1
    const monthlyFee = (quote.sectorFamily?.finalInet) || quote.sectorMain?.total || null;

    const payload = {
      product_id: matchedProduct.id,
      customer_name: name || null,
      customer_phone: phone || null,
      customer_address: address || null,
      customer_address_detail: addressDetail || null,
      installation_date: installDate || null,
      installation_time: installTime || null,
      notes: notes || null,
      add_payback: payback,
      tv_count: input.tvCount,
      additional_products: additional.length ? additional : null,
      wifi_option: (input.carrier === 'lgu' && (input.speed === '500M' || input.speed === '1G')) ? input.lguBonus : null,
      quote_summary: summary,
      monthly_fee: monthlyFee,
    };

    try {
      setSubmitting(true);
      const res = await apiCall('POST', '/sales', payload);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || '저장 실패');
      }
      const dat = await res.json();
      const saleId = dat.sale ? dat.sale.id.slice(0, 8) : '?';
      setMsg(`✅ 계약 등록 완료! ID ${saleId}`);
      setTimeout(() => { onSuccess(); }, 1500);
    } catch (e) {
      setMsg('❌ ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ background: '#fff', border: '1.5px solid #16a34a', borderRadius: 6, padding: 10, fontSize: 11 }}>
      <div style={{ fontWeight: 800, color: '#15803d', marginBottom: 6 }}>📝 계약 정보 입력</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
        <FieldLabel label="고객명">
          <input type="text" placeholder="홍길동" value={name} onChange={e => setName(e.target.value)} style={inputCss} />
        </FieldLabel>
        <FieldLabel label="전화 (자동 - 입력)">
          <input type="tel" inputMode="numeric" maxLength={13} placeholder="010-0000-0000" value={phone} onChange={e => setPhone(formatPhoneAuto(e.target.value))} style={inputCss} />
        </FieldLabel>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
        <FieldLabel label="📅 설치 희망일">
          <input type="date" value={installDate} onChange={e => setInstallDate(e.target.value)} style={inputCss} />
        </FieldLabel>
        <FieldLabel label="⏰ 설치 시간">
          <select value={installTime} onChange={e => setInstallTime(e.target.value)} style={{ ...inputCss, height: 24 }}>
            <option value="">— 선택 —</option>
            {INSTALL_TIMES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </FieldLabel>
      </div>
      <label style={{ fontSize: 10, color: '#374151', display: 'block', marginBottom: 4 }}>📍 설치 주소</label>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        <input type="text" placeholder="🔍 주소 검색 클릭" readOnly value={address}
          onClick={openAddressSearch}
          style={{ ...inputCss, flex: 1, background: '#f9fafb', cursor: 'pointer' }} />
        <button type="button" onClick={openAddressSearch}
          style={{ padding: '4px 10px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          🔍 검색
        </button>
      </div>
      <FieldLabel label="🏠 상세 주소 (동·호수·층)">
        <input type="text" placeholder="예: 101동 502호" value={addressDetail} onChange={e => setAddressDetail(e.target.value)} style={inputCss} />
      </FieldLabel>
      <FieldLabel label="📝 상담 메모">
        <textarea rows={3} placeholder="상담 내용 / 특이사항 / 고객 요청 등" value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inputCss, resize: 'vertical', fontFamily: 'inherit' }} />
      </FieldLabel>
      <FieldLabel label="추가 페이백 (₩, 0~50,000)">
        <input type="number" min={0} max={50000} step={1000} value={payback} onChange={e => setPayback(Number(e.target.value) || 0)} style={inputCss} />
      </FieldLabel>
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" onClick={onClose} disabled={submitting}
          style={{ flex: 1, padding: 6, background: '#fff', border: '1px solid #94a3b8', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>
          취소
        </button>
        <button type="button" onClick={handleSubmit} disabled={submitting}
          style={{ flex: 1, padding: 6, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1 }}>
          {submitting ? '저장 중...' : '✅ 등록'}
        </button>
      </div>
      {msg && <div style={{ fontSize: 10, marginTop: 4, color: msg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{msg}</div>}
    </div>
  );
}

function FieldLabel({ label, children }) {
  return (
    <label style={{ fontSize: 10, color: '#374151', display: 'block', marginBottom: 6 }}>{label}
      {children}
    </label>
  );
}

const inputCss = { width: '100%', padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 11, background: '#fff', boxSizing: 'border-box' };

// ─────────────────────────────────────────────────────────────────────────────
// 영업 내역 리스트
// ─────────────────────────────────────────────────────────────────────────────
function SalesList({ sales, open, setOpen, apiCall, onChanged }) {
  const handleCancel = async (id) => {
    if (!confirm('이 영업을 취소하시겠습니까? (인센티브에서 제외)')) return;
    try {
      const res = await apiCall('PATCH', `/sales/${id}`, { status: 'cancelled', cancellation_reason: '본인 취소' });
      if (!res.ok) throw new Error('취소 실패');
      onChanged();
    } catch (e) { alert(e.message); }
  };

  return (
    <div style={{ marginTop: 0, borderTop: '1px dashed rgba(245,158,11,0.4)', paddingTop: 8 }}>
      <button type="button" onClick={() => setOpen(!open)}
        style={{ width: '100%', padding: 6, background: '#fff', border: '1px solid #f59e0b', color: '#92400e', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 11 }}>
        📋 내 영업 내역 (이번 달) · {sales.length}건 {open ? '▲' : '▼'}
      </button>
      {open && (
        <div style={{ marginTop: 6, maxHeight: 240, overflowY: 'auto', background: 'rgba(255,255,255,0.7)', borderRadius: 6, padding: 6 }}>
          {sales.length === 0 && (
            <div style={{ textAlign: 'center', color: '#9ca3af', padding: 14, fontSize: 10 }}>아직 영업 내역이 없습니다.</div>
          )}
          {sales.map(s => {
            const p = s.product || {};
            const dateShort = (s.contract_date || '').slice(5);
            const cancelled = s.status === 'cancelled';
            return (
              <div key={s.id} style={{ borderBottom: '1px solid rgba(245,158,11,0.2)', padding: '5px 4px', fontSize: 10, opacity: cancelled ? 0.5 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <div style={{ fontWeight: 700, color: '#374151' }}>
                    {dateShort} · {p.name || '?'}
                    {p.tier && <span style={{ background: '#92400e', color: '#fff', padding: '1px 4px', borderRadius: 3, fontSize: 8, marginLeft: 3 }}>{p.tier}</span>}
                    {p.is_premium && <span style={{ background: '#dc2626', color: '#fff', padding: '1px 4px', borderRadius: 3, fontSize: 8, marginLeft: 3 }}>우수</span>}
                    {s.tv_count > 1 && <span style={{ background: '#6366f1', color: '#fff', padding: '1px 5px', borderRadius: 3, fontSize: 8, marginLeft: 3 }}>TV {s.tv_count}대</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {cancelled && <span style={{ background: '#dc2626', color: '#fff', padding: '1px 5px', borderRadius: 3, fontSize: 8 }}>취소</span>}
                    {s.status === 'pending' && <span style={{ background: '#f59e0b', color: '#fff', padding: '1px 5px', borderRadius: 3, fontSize: 8 }}>대기</span>}
                    {s.status === 'completed' && (
                      <button onClick={() => handleCancel(s.id)} style={{ fontSize: 9, padding: '1px 5px', background: '#fff', border: '1px solid #dc2626', color: '#dc2626', borderRadius: 3, cursor: 'pointer' }}>취소</button>
                    )}
                  </div>
                </div>
                <div style={{ color: '#6b7280', fontSize: 9.5 }}>
                  {s.customer_name ? `👤 ${s.customer_name}` : '익명'}
                  {s.customer_phone ? ` · ${s.customer_phone}` : ''}
                  {' · 가중치 '}{p.point_weight || '?'}P
                  {s.add_payback > 0 && ` · 페이백 ${(s.add_payback || 0).toLocaleString()}원`}
                </div>
                {s.quote_summary && (
                  <div style={{ color: '#92400e', fontSize: 9, marginTop: 2, whiteSpace: 'pre-wrap', background: 'rgba(245,158,11,0.08)', borderRadius: 3, padding: '3px 5px', lineHeight: 1.4 }}>
                    {s.quote_summary}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const pageStyle = {
  background: '#0f172a',
  minHeight: '100vh',
  margin: -24,
  padding: 12,
  fontFamily: "'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif",
  color: '#f8fafc',
};

const layoutStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 400px',
  gap: 12,
  maxWidth: 1800,
  margin: '0 auto',
};

const panelStyle = {
  background: '#fff',
  borderRadius: 14,
  padding: 18,
  boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.04)',
  color: '#0f172a',
  fontSize: 13,
};

const resultPanelStyle = {
  background: 'linear-gradient(160deg, #1e293b 0%, #0f172a 60%, #020617 100%)',
  color: '#fff',
  padding: '12px 14px',
  borderRadius: 14,
  boxShadow: '0 4px 20px rgba(15,23,42,0.15), inset 0 1px 0 rgba(255,255,255,0.05)',
  height: 'fit-content',
  position: 'sticky',
  top: 12,
  maxHeight: 'calc(100vh - 24px)',
  overflowY: 'auto',
};
