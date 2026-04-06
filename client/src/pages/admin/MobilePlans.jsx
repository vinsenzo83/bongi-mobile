import { useState } from 'react';
import { theme, statusStyle, tableStyles, card, button, filterBtn, kpiCard, input } from '../../styles/admin-theme.js';

const samplePlans = [
  { carrier: 'SKT', name: '5G 프리미어 에센셜', price: '85,000', discount: '63,750', data: '무제한', voice: '무제한', net: '5G', ott: '디즈니+', category: '프리미엄' },
  { carrier: 'SKT', name: '5G 다이렉트 49', price: '49,000', discount: '36,750', data: '110GB', voice: '무제한', net: '5G', ott: '-', category: '중간' },
  { carrier: 'SKT', name: 'LTE 세이브 34', price: '34,000', discount: '25,500', data: '6GB', voice: '무제한', net: 'LTE', ott: '-', category: '알뜰' },
  { carrier: 'KT', name: '5G 슈퍼플랜 베이직', price: '55,000', discount: '41,250', data: '150GB', voice: '무제한', net: '5G', ott: '지니TV', category: '중간' },
  { carrier: 'KT', name: '5G 슈퍼플랜 스페셜', price: '80,000', discount: '60,000', data: '무제한', voice: '무제한', net: '5G', ott: '지니TV+넷플릭스', category: '프리미엄' },
  { carrier: 'KT', name: 'LTE 심플 29', price: '29,000', discount: '21,750', data: '3GB', voice: '무제한', net: 'LTE', ott: '-', category: '알뜰' },
  { carrier: 'LG U+', name: '5G 시그니처', price: '89,000', discount: '66,750', data: '무제한', voice: '무제한', net: '5G', ott: '유플레이', category: '프리미엄' },
  { carrier: 'LG U+', name: '5G 라이트+', price: '55,000', discount: '41,250', data: '120GB', voice: '무제한', net: '5G', ott: '-', category: '중간' },
  { carrier: 'LG U+', name: 'LTE 데이터33', price: '33,000', discount: '24,750', data: '5GB', voice: '무제한', net: 'LTE', ott: '-', category: '알뜰' },
  { carrier: 'SKT', name: '5G 슬림 39', price: '39,000', discount: '29,250', data: '10GB', voice: '무제한', net: '5G', ott: '-', category: '알뜰' },
];

export default function MobilePlans() {
  const [carrierFilter, setCarrierFilter] = useState('전체');
  const [netFilter, setNetFilter] = useState('전체');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const filtered = samplePlans.filter(p => {
    if (carrierFilter !== '전체' && p.carrier !== carrierFilter) return false;
    if (netFilter !== '전체' && p.net !== netFilter) return false;
    if (search && !p.name.includes(search) && !p.ott.includes(search)) return false;
    return true;
  });

  const pageSize = 10;
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  const carrierColor = (c) => c === 'SKT' ? theme.red : c === 'KT' ? theme.blue : theme.green;

  return (
    <div style={{ padding: 24, fontFamily: theme.sans, background: theme.bg, minHeight: '100vh' }}>

      {/* KPI 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 14 }}>
        <div style={kpiCard}><div style={{ fontSize: 28, fontWeight: 900, color: theme.red }}>68</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>SKT</div></div>
        <div style={kpiCard}><div style={{ fontSize: 28, fontWeight: 900, color: theme.blue }}>50</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>KT</div></div>
        <div style={kpiCard}><div style={{ fontSize: 28, fontWeight: 900, color: theme.green }}>50</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>LG U+</div></div>
      </div>

      {/* 필터 바 */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          style={{ ...input, width: 200 }}
          placeholder="요금제명 / OTT 검색"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
        />
        <span style={filterBtn(carrierFilter === '전체')} onClick={() => { setCarrierFilter('전체'); setPage(0); }}>전체 (168)</span>
        <span style={filterBtn(carrierFilter === 'SKT')} onClick={() => { setCarrierFilter('SKT'); setPage(0); }}>SKT</span>
        <span style={filterBtn(carrierFilter === 'KT')} onClick={() => { setCarrierFilter('KT'); setPage(0); }}>KT</span>
        <span style={filterBtn(carrierFilter === 'LG U+')} onClick={() => { setCarrierFilter('LG U+'); setPage(0); }}>LG U+</span>
        <span style={filterBtn(netFilter === '전체')} onClick={() => { setNetFilter('전체'); setPage(0); }}>전체</span>
        <span style={filterBtn(netFilter === '5G')} onClick={() => { setNetFilter('5G'); setPage(0); }}>5G</span>
        <span style={filterBtn(netFilter === 'LTE')} onClick={() => { setNetFilter('LTE'); setPage(0); }}>LTE</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <span style={{ ...button.success, fontSize: 11, cursor: 'pointer' }}>✏️ 편집</span>
          <span style={{ ...button.primary, fontSize: 11, cursor: 'pointer' }}>+ 요금제 추가</span>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
            background: theme.navy, color: '#fff', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer'
          }}>
            📂 엑셀 업로드
            <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {/* 테이블 */}
      <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
        <table style={{ ...tableStyles.table, fontSize: 11, minWidth: 1100, marginBottom: 0 }}>
          <thead>
            <tr>
              <th style={tableStyles.th}>통신사</th>
              <th style={tableStyles.th}>요금제명</th>
              <th style={tableStyles.th}>월정액</th>
              <th style={tableStyles.th}>약정할인가</th>
              <th style={tableStyles.th}>데이터</th>
              <th style={tableStyles.th}>음성</th>
              <th style={tableStyles.th}>네트워크</th>
              <th style={tableStyles.th}>OTT/부가혜택</th>
              <th style={tableStyles.th}>카테고리</th>
              <th style={tableStyles.th}>관리</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((p, i) => (
              <tr key={i}>
                <td style={{ ...tableStyles.td, fontWeight: 700, color: carrierColor(p.carrier) }}>{p.carrier}</td>
                <td style={{ ...tableStyles.td, fontWeight: 600 }}>{p.name}</td>
                <td style={{ ...tableStyles.td, fontWeight: 600 }}>{p.price}</td>
                <td style={{ ...tableStyles.td, color: theme.blue, fontWeight: 600 }}>{p.discount}</td>
                <td style={tableStyles.td}>{p.data}</td>
                <td style={tableStyles.td}>{p.voice}</td>
                <td style={tableStyles.td}>
                  <span style={statusStyle(p.net === '5G' ? 'blue' : 'green')}>{p.net}</span>
                </td>
                <td style={{ ...tableStyles.td, fontSize: 10 }}>{p.ott}</td>
                <td style={tableStyles.td}>{p.category}</td>
                <td style={tableStyles.td}>
                  <div style={{ display: 'flex', gap: 3 }}>
                    <span style={{ ...button.secondary, fontSize: 10, padding: '3px 8px' }}>수정</span>
                    <span style={{ ...button.danger, fontSize: 10, padding: '3px 8px' }}>삭제</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12 }}>
        {Array.from({ length: totalPages }, (_, i) => (
          <span key={i} style={filterBtn(i === page)} onClick={() => setPage(i)}>{i + 1}</span>
        ))}
      </div>
      <div style={{ textAlign: 'center', fontSize: 11, color: theme.textMuted, marginTop: 6 }}>
        총 {filtered.length}개 중 {page * pageSize + 1}-{Math.min((page + 1) * pageSize, filtered.length)}
      </div>
    </div>
  );
}
