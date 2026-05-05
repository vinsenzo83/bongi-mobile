// V5 어드민 — 4. 결합 할인 섹션
// SKT: 요즘가족결합 + 온가족할인
// KT: 총액 / 정액 / 프리미엄 (planCatalog) — Phase C2: 행 추가/삭제 지원
// LGU+: 참쉬운 / 투게더 — Phase C2: planLabels 추가/삭제 지원
//
// vanilla docs/calculator.html 의 BUNDLE_OVERRIDES_KEY 와 동일 구조 사용.
import { useState } from 'react';
import { D } from '../../../../lib/quoteEngine.js';
import {
  badge, subTitleStyle, tableStyle, thStyle, tdStyle,
  inputStyle, numInputStyle, btnSuccess, btnDanger,
} from './styles.js';
import { logEdit, persistBundle, resetBundle } from './store.js';
import SectionShell from './SectionShell.jsx';

const SPEEDS = ['100M', '500M', '1G'];

function NumCell({ value, onChange, color }) {
  return (
    <input
      type="text" inputMode="numeric"
      defaultValue={(value || 0).toLocaleString()}
      onBlur={(e) => {
        onChange(e.target.value);
        const n = parseInt(String(e.target.value).replace(/[^0-9]/g, ''), 10) || 0;
        e.target.value = n.toLocaleString();
      }}
      style={{ ...numInputStyle, color: color || '#fde68a', width: 90 }}
    />
  );
}

function num(val) {
  return parseInt(String(val).replace(/[^0-9]/g, ''), 10) || 0;
}

// ───── SKT 요즘가족결합 + 온가족할인 ─────
function SktBundles({ refresh }) {
  const fam = D.skt.bundle.family;
  const onfam = D.skt.bundle.onfamily;

  const updFamInternet = (sp, val) => {
    const n = num(val);
    const old = fam.internet[sp];
    if (old === n) return;
    fam.internet[sp] = n;
    logEdit('결합할인', `SKT 요즘가족결합 인터넷 ${sp}`, old, n);
    persistBundle('skt'); refresh();
  };
  const updFamMobile = (sp, lines, val) => {
    const n = num(val);
    const old = fam.mobilePerBySpeed[sp][lines];
    if (old === n) return;
    fam.mobilePerBySpeed[sp][lines] = n;
    logEdit('결합할인', `SKT 요즘가족결합 휴대폰 ${sp}/${lines}회선`, old, n);
    persistBundle('skt'); refresh();
  };
  const updFamIptv = (val) => {
    const n = num(val);
    const old = fam.iptv;
    if (old === n) return;
    fam.iptv = n;
    logEdit('결합할인', 'SKT 요즘가족결합 IPTV', old, n);
    persistBundle('skt'); refresh();
  };
  const updOnfamMatrix = (r, c, val) => {
    const n = num(val);
    const old = onfam.matrix[r][c];
    if (old === n) return;
    onfam.matrix[r][c] = n;
    logEdit('결합할인', `SKT 온가족할인 [${r},${c}]`, old, n);
    persistBundle('skt'); refresh();
  };

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={badge('skt')}>SKT</span>
        <span style={subTitleStyle}>요즘가족결합 + 온가족할인</span>
      </div>

      <div style={subTitleStyle}>① 요즘가족결합 — 인터넷 할인 (속도별)</div>
      <table style={tableStyle}>
        <thead><tr><th style={thStyle}>속도</th><th style={thStyle}>할인액</th></tr></thead>
        <tbody>
          {SPEEDS.map((sp) => (
            <tr key={sp}>
              <td style={tdStyle}>{sp}</td>
              <td style={tdStyle}><NumCell value={fam.internet[sp]} onChange={(v) => updFamInternet(sp, v)} color="#fca5a5" /></td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={subTitleStyle}>② 요즘가족결합 — IPTV 할인 (TV 결합 추가)</div>
      <NumCell value={fam.iptv} onChange={updFamIptv} color="#fca5a5" />

      <div style={subTitleStyle}>③ 요즘가족결합 — 휴대폰 1인당 할인 (속도 × 회선수)</div>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>속도</th>
            {[1, 2, 3, 4, 5].map((n) => <th key={n} style={thStyle}>{n}회선</th>)}
          </tr>
        </thead>
        <tbody>
          {SPEEDS.map((sp) => (
            <tr key={sp}>
              <td style={tdStyle}>{sp}</td>
              {[1, 2, 3, 4, 5].map((n) => (
                <td key={n} style={tdStyle}>
                  <NumCell value={fam.mobilePerBySpeed[sp][n] || 0} onChange={(v) => updFamMobile(sp, n, v)} color="#fca5a5" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div style={subTitleStyle}>④ 온가족할인 — 가입년수 % 할인 매트릭스</div>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>인터넷 가입년수 ↓ / 가족 결합년수 →</th>
            {onfam.famYrLabels.map((l, i) => <th key={i} style={thStyle}>{l}</th>)}
          </tr>
        </thead>
        <tbody>
          {onfam.netYrLabels.map((nl, r) => (
            <tr key={r}>
              <td style={tdStyle}>{nl}</td>
              {onfam.matrix[r].map((v, c) => (
                <td key={c} style={tdStyle}>
                  <NumCell value={v} onChange={(val) => updOnfamMatrix(r, c, val)} color="#86efac" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>※ 단위: % (퍼센트)</div>
    </div>
  );
}

// ───── KT 총액 / 정액 / 프리미엄 ─────
function KtBundles({ refresh }) {
  const total = D.kt.bundle;
  const updTotalRangeLabel = (idx, val) => {
    const old = total.ranges_total[idx];
    total.ranges_total[idx] = String(val);
    logEdit('결합할인', `KT 총액 구간 라벨 [${idx}]`, old, val);
    persistBundle('kt'); refresh();
  };
  const updTotal = (field, sp, idx, val) => {
    const n = num(val);
    const old = total.total[field][sp][idx];
    if (old === n) return;
    total.total[field][sp][idx] = n;
    logEdit('결합할인', `KT 총액 ${field === 'internet' ? '인터넷' : '휴대폰'} ${sp}/${total.ranges_total[idx]}`, old, n);
    persistBundle('kt'); refresh();
  };
  const updFixedRangeLabel = (idx, val) => {
    const old = total.ranges_fixed[idx];
    total.ranges_fixed[idx] = String(val);
    logEdit('결합할인', `KT 정액 구간 라벨 [${idx}]`, old, val);
    persistBundle('kt'); refresh();
  };
  const updFixed = (field, idx, val) => {
    const n = num(val);
    const old = total.fixed[field][idx];
    if (old === n) return;
    total.fixed[field][idx] = n;
    logEdit('결합할인', `KT 정액 ${field === 'internet' ? '인터넷' : '휴대폰'} ${total.ranges_fixed[idx]}`, old, n);
    persistBundle('kt'); refresh();
  };
  const updPremItem = (idx, field, val) => {
    const item = total.premium.planCatalog[idx];
    if (!item) return;
    const old = item[field];
    if (field === 'v' || field === 'dc') item[field] = num(val);
    else if (field === 'prem') item.prem = (val === 'true' || val === true);
    else item[field] = String(val);
    logEdit('결합할인', `KT 프리미엄 ${item.label || '#' + idx} / ${field}`, old, item[field]);
    persistBundle('kt'); refresh();
  };
  const updPremFixedInet = (val) => {
    const n = num(val);
    const old = total.premium.internet;
    if (old === n) return;
    total.premium.internet = n;
    logEdit('결합할인', 'KT 프리미엄 고정 인터넷할인', old, n);
    persistBundle('kt'); refresh();
  };

  // ─── 총액결합 구간 add/delete ───
  const addTotalRange = () => {
    const label = prompt('새 월 요금 구간 라벨 입력 (예: 200,000원 이상)');
    if (!label) return;
    total.ranges_total.push(String(label));
    SPEEDS.forEach((sp) => {
      total.total.internet[sp].push(0);
      total.total.mobile[sp].push(0);
    });
    logEdit('결합할인', 'KT 총액 구간 추가', '-', label);
    persistBundle('kt'); refresh();
  };
  const delTotalRange = (idx) => {
    if (total.ranges_total.length <= 1) { alert('최소 1개 구간 유지 필요'); return; }
    if (!confirm(`구간 [${total.ranges_total[idx]}] 삭제?`)) return;
    const label = total.ranges_total[idx];
    total.ranges_total.splice(idx, 1);
    SPEEDS.forEach((sp) => {
      total.total.internet[sp].splice(idx, 1);
      total.total.mobile[sp].splice(idx, 1);
    });
    logEdit('결합할인', 'KT 총액 구간 삭제', label, '-');
    persistBundle('kt'); refresh();
  };

  // ─── 정액결합 구간 add/delete ───
  const addFixedRange = () => {
    const label = prompt('새 월 요금 구간 라벨 입력');
    if (!label) return;
    total.ranges_fixed.push(String(label));
    total.fixed.internet.push(0);
    total.fixed.mobile.push(0);
    logEdit('결합할인', 'KT 정액 구간 추가', '-', label);
    persistBundle('kt'); refresh();
  };
  const delFixedRange = (idx) => {
    if (total.ranges_fixed.length <= 1) { alert('최소 1개 구간 유지 필요'); return; }
    if (!confirm(`구간 [${total.ranges_fixed[idx]}] 삭제?`)) return;
    const label = total.ranges_fixed[idx];
    total.ranges_fixed.splice(idx, 1);
    total.fixed.internet.splice(idx, 1);
    total.fixed.mobile.splice(idx, 1);
    logEdit('결합할인', 'KT 정액 구간 삭제', label, '-');
    persistBundle('kt'); refresh();
  };

  // ─── 프리미엄 카탈로그 add/delete ───
  const addPremRow = () => {
    const v = prompt('월정액 (원, 예: 77000)');
    if (v == null) return;
    const label = prompt('요금제명 (예: 77,000원 (5G 슈퍼플랜))');
    if (!label) return;
    const dc = prompt('할인액 (원, 0 가능)') || '0';
    const prem = confirm('프리미엄 자격 가능? (확인=가능, 취소=불가)');
    total.premium.planCatalog.push({
      v: num(v),
      label: String(label),
      dc: num(dc),
      prem: !!prem,
    });
    logEdit('결합할인', 'KT 프리미엄 요금제 추가', '-', label);
    persistBundle('kt'); refresh();
  };
  const delPremRow = (idx) => {
    if (total.premium.planCatalog.length <= 1) { alert('최소 1개 요금제 유지 필요'); return; }
    const item = total.premium.planCatalog[idx];
    if (!confirm(`[${item.label}] 삭제?`)) return;
    total.premium.planCatalog.splice(idx, 1);
    logEdit('결합할인', 'KT 프리미엄 요금제 삭제', item.label, '-');
    persistBundle('kt'); refresh();
  };

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={badge('kt')}>KT</span>
        <span style={subTitleStyle}>총액 / 정액 / 프리미엄</span>
      </div>

      <div style={{ ...subTitleStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>① 총액결합 — 월 요금 합산 구간 × 속도</span>
        <button type="button" onClick={addTotalRange} style={{ ...btnSuccess, fontSize: 11, padding: '4px 10px' }}>+ 구간 추가</button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>구간 라벨</th>
              <th style={thStyle}>인터넷 100M</th>
              <th style={thStyle}>500M</th>
              <th style={thStyle}>1G</th>
              <th style={thStyle}>휴대폰 100M</th>
              <th style={thStyle}>500M</th>
              <th style={thStyle}>1G</th>
              <th style={{ ...thStyle, width: 50 }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {total.ranges_total.map((label, idx) => (
              <tr key={idx}>
                <td style={tdStyle}>
                  <input type="text" defaultValue={label}
                    onBlur={(e) => updTotalRangeLabel(idx, e.target.value)}
                    style={{ ...inputStyle, width: 130 }} />
                </td>
                {SPEEDS.map((sp) => (
                  <td key={'i' + sp} style={tdStyle}><NumCell value={total.total.internet[sp][idx]} onChange={(v) => updTotal('internet', sp, idx, v)} color="#fca5a5" /></td>
                ))}
                {SPEEDS.map((sp) => (
                  <td key={'m' + sp} style={tdStyle}><NumCell value={total.total.mobile[sp][idx]} onChange={(v) => updTotal('mobile', sp, idx, v)} color="#fca5a5" /></td>
                ))}
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <button type="button" onClick={() => delTotalRange(idx)} style={btnDanger}>🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ ...subTitleStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>② 정액결합 — 휴대폰 요금 구간</span>
        <button type="button" onClick={addFixedRange} style={{ ...btnSuccess, fontSize: 11, padding: '4px 10px' }}>+ 구간 추가</button>
      </div>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>구간</th>
            <th style={thStyle}>인터넷 할인</th>
            <th style={thStyle}>휴대폰 할인</th>
            <th style={{ ...thStyle, width: 50 }}>관리</th>
          </tr>
        </thead>
        <tbody>
          {total.ranges_fixed.map((label, idx) => (
            <tr key={idx}>
              <td style={tdStyle}>
                <input type="text" defaultValue={label}
                  onBlur={(e) => updFixedRangeLabel(idx, e.target.value)}
                  style={{ ...inputStyle, width: 150 }} />
              </td>
              <td style={tdStyle}><NumCell value={total.fixed.internet[idx]} onChange={(v) => updFixed('internet', idx, v)} color="#fca5a5" /></td>
              <td style={tdStyle}><NumCell value={total.fixed.mobile[idx]} onChange={(v) => updFixed('mobile', idx, v)} color="#fca5a5" /></td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>
                <button type="button" onClick={() => delFixedRange(idx)} style={btnDanger}>🗑</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ ...subTitleStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>③ 프리미엄 가족결합 — 요금제 카탈로그</span>
        <button type="button" onClick={addPremRow} style={{ ...btnSuccess, fontSize: 11, padding: '4px 10px' }}>+ 요금제 추가</button>
      </div>
      <div style={{ marginBottom: 8, fontSize: 11, color: '#94a3b8' }}>
        고정 인터넷 할인: <NumCell value={total.premium.internet} onChange={updPremFixedInet} color="#fca5a5" /> 원
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 110 }}>월정액(원)</th>
              <th style={thStyle}>요금제명</th>
              <th style={{ ...thStyle, width: 100 }}>자격</th>
              <th style={{ ...thStyle, width: 110 }}>할인액</th>
              <th style={{ ...thStyle, width: 50 }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {total.premium.planCatalog.map((p, idx) => (
              <tr key={idx}>
                <td style={tdStyle}><NumCell value={p.v} onChange={(v) => updPremItem(idx, 'v', v)} color="#fde68a" /></td>
                <td style={tdStyle}>
                  <input type="text" defaultValue={p.label}
                    onBlur={(e) => updPremItem(idx, 'label', e.target.value)}
                    style={inputStyle} />
                </td>
                <td style={tdStyle}>
                  <select defaultValue={String(p.prem)}
                    onChange={(e) => updPremItem(idx, 'prem', e.target.value)}
                    style={{ ...inputStyle, padding: '5px 6px' }}>
                    <option value="false">✗ 불가</option>
                    <option value="true">✓ 가능</option>
                  </select>
                </td>
                <td style={tdStyle}><NumCell value={p.dc} onChange={(v) => updPremItem(idx, 'dc', v)} color="#fca5a5" /></td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <button type="button" onClick={() => delPremRow(idx)} style={btnDanger}>🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ───── LGU+ 참쉬운 / 투게더 ─────
function LguBundles({ refresh }) {
  const cw = D.lgu.bundle.chweyswun;
  const tg = D.lgu.bundle.together;

  const updCwInternet = (sp, val) => {
    const n = num(val);
    const old = cw.internet[sp];
    if (old === n) return;
    cw.internet[sp] = n;
    logEdit('결합할인', `LGU+ 참쉬운 인터넷 ${sp}`, old, n);
    persistBundle('lgu'); refresh();
  };
  const updCwMobile = (planIdx, lineIdx, val) => {
    const n = num(val);
    if (!cw.mobile[planIdx]) cw.mobile[planIdx] = [0, 0, 0];
    const old = cw.mobile[planIdx][lineIdx] || 0;
    if (old === n) return;
    cw.mobile[planIdx][lineIdx] = n;
    logEdit('결합할인', `LGU+ 참쉬운 휴대폰 [${planIdx},${lineIdx}]`, old, n);
    persistBundle('lgu'); refresh();
  };
  const updTgInternet = (sp, val) => {
    const n = num(val);
    const old = tg.internet[sp];
    if (old === n) return;
    tg.internet[sp] = n;
    logEdit('결합할인', `LGU+ 투게더 인터넷 ${sp}`, old, n);
    persistBundle('lgu'); refresh();
  };
  const updTgMobile = (idx, val) => {
    const n = num(val);
    const old = tg.mobile[idx];
    if (old === n) return;
    tg.mobile[idx] = n;
    logEdit('결합할인', `LGU+ 투게더 휴대폰 ${idx + 2}회선`, old, n);
    persistBundle('lgu'); refresh();
  };

  // ─── 참쉬운 plan 라벨 add/edit/delete ───
  const updCwLabel = (idx, val) => {
    const old = cw.planLabels[idx];
    cw.planLabels[idx] = String(val);
    logEdit('결합할인', `LGU+ 참쉬운 구간 라벨 [${idx}]`, old, val);
    persistBundle('lgu'); refresh();
  };
  const addCwPlan = () => {
    const label = prompt('새 요금제 구간 라벨 (예: 95,000원 이상)');
    if (!label) return;
    cw.planLabels.push(String(label));
    cw.mobile.push([0, 0, 0]);  // [2회선, 3회선, 4회선] 기본값
    logEdit('결합할인', 'LGU+ 참쉬운 구간 추가', '-', label);
    persistBundle('lgu'); refresh();
  };
  const delCwPlan = (idx) => {
    if (cw.planLabels.length <= 1) { alert('최소 1개 구간 유지 필요'); return; }
    const label = cw.planLabels[idx];
    if (!confirm(`구간 [${label}] 삭제?`)) return;
    cw.planLabels.splice(idx, 1);
    cw.mobile.splice(idx, 1);
    logEdit('결합할인', 'LGU+ 참쉬운 구간 삭제', label, '-');
    persistBundle('lgu'); refresh();
  };

  const lineLabels = ['2회선', '3회선', '4회선'];

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={badge('lgu')}>LGU+</span>
        <span style={subTitleStyle}>참쉬운 / 투게더</span>
      </div>

      <div style={subTitleStyle}>① 참쉬운 가족결합 — 인터넷 할인 (속도별)</div>
      <table style={tableStyle}>
        <thead><tr><th style={thStyle}>속도</th><th style={thStyle}>할인액</th></tr></thead>
        <tbody>
          {SPEEDS.map((sp) => (
            <tr key={sp}>
              <td style={tdStyle}>{sp}</td>
              <td style={tdStyle}><NumCell value={cw.internet[sp]} onChange={(v) => updCwInternet(sp, v)} color="#fca5a5" /></td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ ...subTitleStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>② 참쉬운 — 휴대폰 1인당 할인 (요금제 × 회선수)</span>
        <button type="button" onClick={addCwPlan} style={{ ...btnSuccess, fontSize: 11, padding: '4px 10px' }}>+ 요금제 구간 추가</button>
      </div>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>요금제 구간</th>
            {lineLabels.map((l) => <th key={l} style={thStyle}>{l}</th>)}
            <th style={{ ...thStyle, width: 50 }}>관리</th>
          </tr>
        </thead>
        <tbody>
          {cw.planLabels.map((label, pIdx) => (
            <tr key={pIdx}>
              <td style={tdStyle}>
                <input type="text" defaultValue={label}
                  onBlur={(e) => updCwLabel(pIdx, e.target.value)}
                  style={{ ...inputStyle, width: 150 }} />
              </td>
              {lineLabels.map((_, lIdx) => (
                <td key={lIdx} style={tdStyle}>
                  <NumCell value={(cw.mobile[pIdx] && cw.mobile[pIdx][lIdx]) || 0} onChange={(v) => updCwMobile(pIdx, lIdx, v)} color="#fca5a5" />
                </td>
              ))}
              <td style={{ ...tdStyle, textAlign: 'center' }}>
                <button type="button" onClick={() => delCwPlan(pIdx)} style={btnDanger}>🗑</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={subTitleStyle}>③ 투게더 결합 — 인터넷 (속도별) + 휴대폰 (회선수)</div>
      <table style={tableStyle}>
        <thead><tr><th style={thStyle}>속도</th><th style={thStyle}>인터넷 할인</th></tr></thead>
        <tbody>
          {SPEEDS.map((sp) => (
            <tr key={sp}>
              <td style={tdStyle}>{sp}</td>
              <td style={tdStyle}><NumCell value={tg.internet[sp]} onChange={(v) => updTgInternet(sp, v)} color="#fca5a5" /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <table style={{ ...tableStyle, marginTop: 8 }}>
        <thead>
          <tr>{lineLabels.map((l) => <th key={l} style={thStyle}>{l} 휴대폰</th>)}</tr>
        </thead>
        <tbody>
          <tr>
            {tg.mobile.map((v, idx) => (
              <td key={idx} style={tdStyle}><NumCell value={v} onChange={(val) => updTgMobile(idx, val)} color="#fca5a5" /></td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function BundleSection({ open, onToggle, onChange }) {
  const [, force] = useState(0);
  const refresh = () => { force((t) => t + 1); onChange && onChange(); };

  return (
    <SectionShell
      id="sec-4"
      title="🤝 4. 결합 할인"
      note="SKT 요즘가족결합·온가족할인 / KT 총액·정액·프리미엄 / LGU+ 참쉬운·투게더. 변경 즉시 calc()·티켓 리스트에 반영."
      open={open}
      onToggle={onToggle}
      onReset={() => {
        if (!confirm('결합 할인 변경 사항을 초기화하시겠습니까? (페이지 새로고침)')) return;
        resetBundle();
        location.reload();
      }}
    >
      <SktBundles refresh={refresh} />
      <KtBundles refresh={refresh} />
      <LguBundles refresh={refresh} />
    </SectionShell>
  );
}
