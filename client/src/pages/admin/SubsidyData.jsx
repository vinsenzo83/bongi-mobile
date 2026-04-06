import { useState } from 'react';
import { theme, statusStyle, tableStyles, card, button, filterBtn, kpiCard, input } from '../../styles/admin-theme.js';

const sampleSubsidy = [
  { product: '갤럭시 S26 256GB', carrier: 'SKT', plan: '5G 프리미어 에센셜 85', subsidy: '350,000', date: '2026.04.06' },
  { product: '갤럭시 S26 256GB', carrier: 'KT', plan: '5G 슈퍼플랜 스페셜 80', subsidy: '320,000', date: '2026.04.06' },
  { product: '갤럭시 S26 256GB', carrier: 'LG U+', plan: '5G 시그니처 89', subsidy: '300,000', date: '2026.04.06' },
  { product: '아이폰 16 Pro 256GB', carrier: 'SKT', plan: '5G 프리미어 에센셜 85', subsidy: '280,000', date: '2026.04.06' },
  { product: '아이폰 16 Pro 256GB', carrier: 'KT', plan: '5G 슈퍼플랜 스페셜 80', subsidy: '260,000', date: '2026.04.06' },
  { product: '아이폰 16 Pro 256GB', carrier: 'LG U+', plan: '5G 시그니처 89', subsidy: '240,000', date: '2026.04.06' },
  { product: '갤럭시 S26+ 256GB', carrier: 'SKT', plan: '5G 다이렉트 49', subsidy: '150,000', date: '2026.04.06' },
  { product: '갤럭시 S26+ 256GB', carrier: 'KT', plan: '5G 슈퍼플랜 베이직 55', subsidy: '140,000', date: '2026.04.06' },
  { product: '갤럭시 폴드7 512GB', carrier: 'SKT', plan: '5G 프리미어 에센셜 85', subsidy: '400,000', date: '2026.04.06' },
  { product: '갤럭시 폴드7 512GB', carrier: 'KT', plan: '5G 슈퍼플랜 스페셜 80', subsidy: '380,000', date: '2026.04.06' },
  { product: '아이폰 17 Pro 256GB', carrier: 'SKT', plan: '5G 프리미어 에센셜 85', subsidy: '310,000', date: '2026.04.06' },
  { product: '아이폰 17 Pro 256GB', carrier: 'LG U+', plan: '5G 시그니처 89', subsidy: '290,000', date: '2026.04.06' },
];

export default function SubsidyData() {
  const [carrierFilter, setCarrierFilter] = useState('전체');
  const [makerFilter, setMakerFilter] = useState('전체');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const filtered = sampleSubsidy.filter(s => {
    if (carrierFilter !== '전체' && s.carrier !== carrierFilter) return false;
    if (makerFilter === '삼성' && !s.product.includes('갤럭시')) return false;
    if (makerFilter === '아이폰' && !s.product.includes('아이폰')) return false;
    if (search && !s.product.includes(search)) return false;
    return true;
  });

  const pageSize = 20;
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  const carrierColor = (c) => c === 'SKT' ? theme.red : c === 'KT' ? theme.blue : theme.green;

  return (
    <div style={{ padding: 24, fontFamily: theme.sans, background: theme.bg, minHeight: '100vh' }}>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 14 }}>
        <div style={kpiCard}><div style={{ fontSize: 28, fontWeight: 900, color: theme.navy }}>54</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>모델</div></div>
        <div style={kpiCard}><div style={{ fontSize: 28, fontWeight: 900, color: theme.blue }}>1,134</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>총 데이터</div></div>
        <div style={kpiCard}><div style={{ fontSize: 28, fontWeight: 900, color: theme.green }}>3사</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>SKT / KT / LG U+</div></div>
        <div style={kpiCard}><div style={{ fontSize: 14, fontWeight: 900, color: theme.textMuted }}>04.06 14:32</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>마지막 크롤링</div></div>
      </div>

      {/* 안내 배너 */}
      <div style={{ ...card, background: '#eff6ff', borderColor: '#bfdbfe', marginBottom: 10, padding: '10px 16px' }}>
        <div style={{ fontSize: 11, color: theme.navy }}>📌 <strong>smartchoice.or.kr</strong> (방통위 운영) 자동 크롤링 — 3사 통합 · 요금제별 공시지원금</div>
      </div>

      {/* 필터 바 */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          style={{ ...input, width: 180 }}
          placeholder="모델명 검색"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
        />
        <span style={filterBtn(carrierFilter === '전체')} onClick={() => { setCarrierFilter('전체'); setPage(0); }}>전체</span>
        <span style={{ ...filterBtn(carrierFilter === 'SKT'), color: carrierFilter === 'SKT' ? '#fff' : theme.red, borderColor: carrierFilter === 'SKT' ? theme.navy : theme.red }} onClick={() => { setCarrierFilter('SKT'); setPage(0); }}>SKT</span>
        <span style={{ ...filterBtn(carrierFilter === 'KT'), color: carrierFilter === 'KT' ? '#fff' : theme.blue, borderColor: carrierFilter === 'KT' ? theme.navy : theme.blue }} onClick={() => { setCarrierFilter('KT'); setPage(0); }}>KT</span>
        <span style={{ ...filterBtn(carrierFilter === 'LG U+'), color: carrierFilter === 'LG U+' ? '#fff' : theme.green, borderColor: carrierFilter === 'LG U+' ? theme.navy : theme.green }} onClick={() => { setCarrierFilter('LG U+'); setPage(0); }}>LG U+</span>
        <span style={filterBtn(makerFilter === '삼성')} onClick={() => { setMakerFilter(makerFilter === '삼성' ? '전체' : '삼성'); setPage(0); }}>삼성</span>
        <span style={filterBtn(makerFilter === '아이폰')} onClick={() => { setMakerFilter(makerFilter === '아이폰' ? '전체' : '아이폰'); setPage(0); }}>아이폰</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <span style={{ ...button.success, fontSize: 11, cursor: 'pointer' }}>🔄 수동 크롤링</span>
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
      <div style={{ ...card, padding: 0, overflowX: 'auto', maxHeight: 600, overflowY: 'auto' }}>
        <table style={{ ...tableStyles.table, fontSize: 11, minWidth: 600, marginBottom: 0 }}>
          <thead style={{ position: 'sticky', top: 0 }}>
            <tr>
              <th style={tableStyles.th}>상품명</th>
              <th style={tableStyles.th}>통신사</th>
              <th style={tableStyles.th}>요금제</th>
              <th style={tableStyles.th}>공시지원금</th>
              <th style={tableStyles.th}>공시일</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((row, i) => (
              <tr key={i}>
                <td style={{ ...tableStyles.td, fontWeight: 600 }}>{row.product}</td>
                <td style={{ ...tableStyles.td, fontWeight: 700, color: carrierColor(row.carrier) }}>{row.carrier}</td>
                <td style={tableStyles.td}>{row.plan}</td>
                <td style={{ ...tableStyles.td, fontWeight: 700, color: theme.blue }}>{row.subsidy}</td>
                <td style={tableStyles.td}>{row.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 10 }}>
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
