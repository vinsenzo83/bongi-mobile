import React, { useState } from 'react';
import { theme, statusStyle, tableStyles, card, button, filterBtn } from '../../styles/admin-theme.js';

const tbl = { width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 0 };
const th = { ...tableStyles.th, fontSize: 11 };
const td = { ...tableStyles.td, fontSize: 11 };

const kpiCard = {
  background: '#fff',
  border: `1px solid ${theme.border}`,
  borderRadius: 10,
  padding: 16,
  textAlign: 'center',
};

/* 조합 상품 mock data (실제로는 comboConfig에서 생성) */
const mockComboTickets = [
  { ticket: 'SK0001', carrier: 'SKT', speed: '100M', tv: 'Btv 이코노미', settop: '스마트3 미니', wifi: 'GIGA WiFi', total: '36,300', status: '활성' },
  { ticket: 'SK0002', carrier: 'SKT', speed: '100M', tv: 'Btv 이코노미', settop: 'AI NUGU', wifi: 'GIGA WiFi', total: '38,500', status: '활성' },
  { ticket: 'SK0003', carrier: 'SKT', speed: '500M', tv: 'Btv 스탠다드', settop: 'AI NUGU', wifi: 'GIGA WiFi 6', total: '53,800', status: '활성' },
  { ticket: 'SK0004', carrier: 'SKT', speed: '1G', tv: 'Btv 올', settop: '애플TV', wifi: 'GIGA WiFi 6', total: '62,700', status: '활성' },
  { ticket: 'KT0001', carrier: 'KT', speed: '100M', tv: '지니TV 베이직', settop: '기가지니A', wifi: 'KT GIGA WAVE2', total: '42,900', status: '활성' },
  { ticket: 'KT0002', carrier: 'KT', speed: '500M', tv: '지니TV 모든G', settop: '기가지니3', wifi: 'GIGA WIFI 홈AX', total: '61,600', status: '활성' },
  { ticket: 'KT0003', carrier: 'KT', speed: '1G', tv: '지니TV+넷플릭스 초이스HD', settop: '지니TV 올인원 사운드바', wifi: 'GIGA WIFI 홈AX', total: '79,500', status: '활성' },
  { ticket: 'LG0001', carrier: 'LGU', speed: '100M', tv: '실속형', settop: 'U+tv UHD4', wifi: '기가와이파이', total: '41,030', status: '활성' },
  { ticket: 'LG0002', carrier: 'LGU', speed: '500M', tv: '프리미엄', settop: 'U+tv 사운드바 블랙', wifi: '기가와이파이6', total: '57,200', status: '활성' },
  { ticket: 'LG0003', carrier: 'LGU', speed: '1G', tv: '프리미엄 넷플릭스 HD', settop: 'U+tv 사운드바 블랙', wifi: '기가와이파이6', total: '75,750', status: '활성' },
];

const mockRentalTickets = [
  { ticket: 'R001', category: '정수기', brand: '코웨이', name: '아이콘 정수기2', monthly: '35,900', afterCard: '25,900', promo: '반값할인', status: '활성' },
  { ticket: 'R002', category: '공기청정기', brand: 'LG', name: '퓨리케어 공기청정기 28평', monthly: '49,900', afterCard: '39,900', promo: '-', status: '활성' },
  { ticket: 'R003', category: 'TV', brand: '삼성', name: '크리스탈 UHD 65인치', monthly: '29,900', afterCard: '29,900', promo: '-', status: '활성' },
  { ticket: 'R004', category: '안마의자', brand: '코웨이', name: '페블 안마의자', monthly: '119,900', afterCard: '119,900', promo: '-', status: '활성' },
  { ticket: 'R005', category: '노트북', brand: 'LG', name: 'LG 그램 16', monthly: '45,000', afterCard: '45,000', promo: '-', status: '비활성' },
];

const filters = ['전체', 'SKT', 'KT', 'LGU', 'rental'];
const filterLabels = { '전체': '전체', SKT: 'SKT', KT: 'KT', LGU: 'LG U+', rental: '렌탈' };

export default function TicketManage() {
  const [activeFilter, setActiveFilter] = useState('전체');
  const [search, setSearch] = useState('');

  const filteredCombos = mockComboTickets.filter(t => {
    if (activeFilter === 'rental') return false;
    if (activeFilter !== '전체' && t.carrier !== activeFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return t.ticket.toLowerCase().includes(s) || t.tv.toLowerCase().includes(s) || t.settop.toLowerCase().includes(s) || t.wifi.toLowerCase().includes(s);
    }
    return true;
  });

  const showCombo = activeFilter !== 'rental';
  const showRental = activeFilter === '전체' || activeFilter === 'rental';

  return (
    <div>
      {/* 안내 배너 */}
      <div style={{ ...card, background: '#eff6ff', borderColor: '#bfdbfe', marginBottom: 14, padding: '12px 16px' }}>
        <div style={{ fontSize: 12, color: theme.navy }}>
          💡 티켓번호 = <strong>상품 식별 코드</strong>. 플랫폼에 등록된 모든 인터넷/렌탈 상품에 자동 부여. 고객이 콜센터 전화 시 티켓번호만 말하면 상품 즉시 파악.
        </div>
      </div>

      {/* KPI 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
        <div style={kpiCard}>
          <div style={{ fontSize: 24, fontWeight: 900, color: theme.red }}>450</div>
          <div style={{ fontSize: 11, color: theme.textMuted }}>SKT (SK0001~)</div>
        </div>
        <div style={kpiCard}>
          <div style={{ fontSize: 24, fontWeight: 900, color: theme.blue }}>360</div>
          <div style={{ fontSize: 11, color: theme.textMuted }}>KT (KT0001~)</div>
        </div>
        <div style={kpiCard}>
          <div style={{ fontSize: 24, fontWeight: 900, color: theme.green }}>288</div>
          <div style={{ fontSize: 11, color: theme.textMuted }}>LG U+ (LG0001~)</div>
        </div>
        <div style={kpiCard}>
          <div style={{ fontSize: 24, fontWeight: 900, color: theme.navy }}>1,149</div>
          <div style={{ fontSize: 11, color: theme.textMuted }}>전체 (인터넷1,098+렌탈51)</div>
        </div>
      </div>

      {/* 필터바 */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="티켓번호 / TV / 셋톱 / 와이파이 검색"
          style={{
            width: 220, padding: '6px 12px', border: `1.5px solid ${theme.borderDark}`,
            borderRadius: 6, fontSize: 11, outline: 'none', background: '#fafafa',
          }}
        />
        {filters.map(f => (
          <div
            key={f}
            onClick={() => setActiveFilter(f)}
            style={filterBtn(activeFilter === f)}
          >
            {filterLabels[f]}
          </div>
        ))}
      </div>

      {/* 인터넷+TV 조합 상품 티켓 */}
      {showCombo && (
        <div style={{ ...card, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ ...statusStyle('blue'), fontSize: 12, padding: '4px 10px' }}>인터넷+TV</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: theme.navy, margin: 0 }}>조합 상품 티켓</span>
            <span style={{ fontSize: 11, color: theme.textMuted, marginLeft: 8 }}>{filteredCombos.length}개</span>
          </div>
          <div style={{ overflowX: 'auto', maxHeight: 450, overflowY: 'auto' }}>
            <table style={{ ...tbl, minWidth: 900 }}>
              <thead style={{ position: 'sticky', top: 0 }}>
                <tr>
                  <th style={th}>티켓번호</th>
                  <th style={th}>통신사</th>
                  <th style={th}>속도</th>
                  <th style={th}>TV</th>
                  <th style={th}>셋톱박스</th>
                  <th style={th}>와이파이</th>
                  <th style={th}>합계 월요금</th>
                  <th style={th}>상태</th>
                  <th style={th}>상세</th>
                </tr>
              </thead>
              <tbody>
                {filteredCombos.map((t, i) => {
                  const carrierColor = t.carrier === 'SKT' ? 'red' : t.carrier === 'KT' ? 'blue' : 'green';
                  return (
                    <tr key={i}>
                      <td style={td}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: theme.blue, fontSize: 11 }}>{t.ticket}</span>
                      </td>
                      <td style={td}>
                        <span style={statusStyle(carrierColor)}>{t.carrier === 'LGU' ? 'LG U+' : t.carrier}</span>
                      </td>
                      <td style={td}>{t.speed}</td>
                      <td style={{ ...td, fontWeight: 600, fontSize: 10 }}>{t.tv}</td>
                      <td style={{ ...td, fontSize: 10 }}>{t.settop}</td>
                      <td style={{ ...td, fontSize: 10 }}>{t.wifi}</td>
                      <td style={{ ...td, fontWeight: 900, color: theme.navy }}>{t.total}</td>
                      <td style={td}>
                        <span style={{ ...statusStyle('green'), fontSize: 10 }}>{t.status}</span>
                      </td>
                      <td style={td}>
                        <span style={{ ...button.secondary, fontSize: 10, padding: '3px 8px', cursor: 'pointer' }}>상세</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 10 }}>
            {[1, 2, 3, 4, 5].map(p => (
              <div key={p} style={{
                width: 26, height: 26, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, cursor: 'pointer', fontWeight: 600,
                background: p === 1 ? theme.navy : '#f8f9fc',
                color: p === 1 ? '#fff' : theme.textSecondary,
                border: p === 1 ? 'none' : `1px solid ${theme.border}`,
              }}>{p}</div>
            ))}
          </div>
          <div style={{ textAlign: 'center', fontSize: 11, color: theme.textMuted, marginTop: 4 }}>
            1~{filteredCombos.length} / 전체 1,098개
          </div>
        </div>
      )}

      {/* 렌탈 상품 티켓 */}
      {showRental && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ ...statusStyle('green'), fontSize: 12, padding: '4px 10px' }}>렌탈</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: theme.navy, margin: 0 }}>렌탈 상품 티켓</span>
            <span style={{ fontSize: 11, color: theme.textMuted, marginLeft: 'auto' }}>51개 상품</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={tbl}>
              <thead>
                <tr>
                  <th style={th}>티켓번호</th>
                  <th style={th}>카테고리</th>
                  <th style={th}>브랜드</th>
                  <th style={th}>상품명</th>
                  <th style={th}>월요금</th>
                  <th style={th}>카드후</th>
                  <th style={th}>프로모션</th>
                  <th style={th}>상태</th>
                  <th style={th}>관리</th>
                </tr>
              </thead>
              <tbody>
                {mockRentalTickets.map((t, i) => (
                  <tr key={i}>
                    <td style={td}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: theme.blue, fontSize: 11 }}>{t.ticket}</span>
                    </td>
                    <td style={td}>{t.category}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{t.brand}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{t.name}</td>
                    <td style={{ ...td, color: theme.navy, fontWeight: 600 }}>{t.monthly}</td>
                    <td style={{ ...td, color: theme.blue, fontWeight: 600 }}>{t.afterCard}</td>
                    <td style={td}>
                      {t.promo !== '-' ? <span style={{ ...statusStyle('orange'), fontSize: 10 }}>{t.promo}</span> : '-'}
                    </td>
                    <td style={td}>
                      <span style={{ ...statusStyle(t.status === '활성' ? 'green' : 'gray'), fontSize: 10 }}>{t.status}</span>
                    </td>
                    <td style={td}>
                      <span style={{ ...button.secondary, fontSize: 10, padding: '3px 8px', cursor: 'pointer' }}>상세</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12 }}>
            {[1, 2, 3].map(p => (
              <div key={p} style={{
                width: 26, height: 26, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, cursor: 'pointer', fontWeight: 600,
                background: p === 1 ? theme.navy : '#f8f9fc',
                color: p === 1 ? '#fff' : theme.textSecondary,
                border: p === 1 ? 'none' : `1px solid ${theme.border}`,
              }}>{p}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
