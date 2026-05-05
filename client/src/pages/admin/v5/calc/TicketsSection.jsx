// V5 어드민 — 9. 티켓 조합 리스트 (read-only)
// quoteEngine 의 generateTickets() 결과를 통신사별로 표시.
// 데이터 변경 시 (TV/WiFi/셋톱) 자동 재생성.
import { useMemo } from 'react';
import { D, generateTickets, getGiftAmount } from '../../../../lib/quoteEngine.js';
import { CARRIERS, badge, tableStyle, thStyle, tdStyle } from './styles.js';
import SectionShell from './SectionShell.jsx';

function calcTicketPrice(d, sp, tvIdx, hasWifi) {
  const hasTv = tvIdx > 0;
  const wifiForSp = d.wifiPrice ? d.wifiPrice[sp] : (typeof d.wifiCost === 'number' ? d.wifiCost : 1100);
  if (hasTv) {
    const netCombo = hasWifi ? d.tvInternetWithWifi[sp] : d.tvInternetNoWifi[sp];
    const tvBase = d.tv[tvIdx].p;
    const tvDc = d.tv[tvIdx].dc || 0;
    return netCombo + (tvBase - tvDc) + (d.setTop || 0);
  }
  return d.internet[sp] + (hasWifi ? wifiForSp : 0);
}

export default function TicketsSection({ open, onToggle, refreshKey }) {
  const tickets = useMemo(() => generateTickets(), [refreshKey, open]);

  return (
    <SectionShell
      id="sec-9"
      title={`🎫 9. 티켓 조합 리스트 (전체 ${tickets.length}개)`}
      note="속도 × TV × WiFi 유/무 조합으로 자동 생성. 데이터 변경 시 요금만 재계산, 티켓번호는 영구 발급. (read-only)"
      open={open}
      onToggle={onToggle}
    >
      {CARRIERS.map((c) => {
        const d = D[c.key];
        const list = tickets.filter((t) => t.carrier === c.key);
        if (list.length === 0) return null;
        return (
          <div key={c.key} style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={badge(c.key)}>{c.label}</span>
              <span style={{ fontSize: 12, color: '#cbd5e1' }}>{d.name} — {list.length}개 ({list[0].number} ~ {list[list.length - 1].number})</span>
            </div>
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>
              기본 셋톱: <b style={{ color: '#cbd5e1' }}>{d.setTopName}</b> ({(d.setTop || 0).toLocaleString()}) · 기본 WiFi: <b style={{ color: '#cbd5e1' }}>{d.wifiName}</b>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>티켓번호</th>
                    <th style={thStyle}>속도</th>
                    <th style={thStyle}>TV 상품</th>
                    <th style={thStyle}>WiFi</th>
                    <th style={thStyle}>월 요금</th>
                    <th style={thStyle}>🎁 사은품</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((t) => {
                    const tvLabel = t.tvIdx === 0 ? '인터넷 단독' : (d.tv[t.tvIdx]?.n || '-');
                    const price = calcTicketPrice(d, t.speed, t.tvIdx, t.wifi);
                    const gift = getGiftAmount(d, t.speed, t.tvIdx);
                    return (
                      <tr key={t.number}>
                        <td style={{ ...tdStyle, fontFamily: '"SF Mono", Monaco, monospace', color: '#a78bfa', fontWeight: 700 }}>{t.number}</td>
                        <td style={{ ...tdStyle, fontWeight: 700 }}>{t.speed}</td>
                        <td style={tdStyle}>{tvLabel}</td>
                        <td style={tdStyle}>{t.wifi
                          ? <span style={{ color: '#86efac', fontWeight: 700 }}>✓ 사용</span>
                          : <span style={{ color: '#fca5a5', fontWeight: 700 }}>✗ 미사용</span>}
                        </td>
                        <td style={{ ...tdStyle, fontWeight: 700, color: '#fde68a' }}>{price.toLocaleString()}</td>
                        <td style={tdStyle}>{gift > 0 ? <span style={{ color: '#fbbf24', fontWeight: 700 }}>{gift.toLocaleString()}</span> : <span style={{ color: '#475569' }}>-</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </SectionShell>
  );
}
