import { useState } from 'react';
import { theme, statusStyle, tableStyles, card, button, filterBtn, kpiCard } from '../../styles/admin-theme.js';

const mockData = [
  ['2026.04.04','홍길동','KT0311','KT 1G+지니TV모든G+기가지니3','5','설치 빠르고 상담 친절했어요! 인터넷 속도도 만족스럽습니다.','2장','ON'],
  ['2026.04.03','김철수','SK0188','SKT 500M+Btv이코노미+AI NUGU+WiFi6','4','가격 대비 좋습니다. Btv 채널 다양하고 화질도 괜찮아요.','1장','ON'],
  ['2026.04.02','강민준','KT0146','KT 500M+지니TV베이직+기가지니A','5','사은품도 빵빵하고 설치 기사님도 친절했습니다. 추천!','3장','ON'],
  ['2026.04.01','홍길동','R015','LG 퓨리케어 공기청정기 28평','4','공기청정기 성능 좋고 디자인도 깔끔합니다. 관리도 편해요.','0장','ON'],
  ['2026.03.28','이영희','LG0079','LG U+ 500M+프리미엄+UHD4','5','TV 화질 좋고 채널 많아서 좋아요. 가족 모두 만족합니다.','1장','OFF'],
  ['2026.03.25','권홍석','-','Galaxy S23 Ultra 중고폰 매입','5','시세 좋고 빠르게 처리해줬어요. 입금도 바로 됐습니다.','0장','ON'],
];

const productFilters = ['전체', '인터넷+TV', '렌탈', '중고폰'];
const aiFilters = ['전체', 'ON', 'OFF'];

function renderStars(count) {
  let stars = '';
  for (let i = 0; i < 5; i++) {
    stars += i < parseInt(count) ? '⭐' : '☆';
  }
  return stars;
}

export default function ReviewManage() {
  const [productFilter, setProductFilter] = useState('전체');
  const [aiFilter, setAiFilter] = useState('전체');
  const [search, setSearch] = useState('');
  const [aiStates, setAiStates] = useState(mockData.map(r => r[7]));

  const filtered = mockData.map((r, idx) => [...r, idx]).filter(r => {
    if (productFilter !== '전체') {
      // Simple filter logic
      if (productFilter === '인터넷+TV' && !r[3].match(/SKT|KT|LG U\+/)) return false;
      if (productFilter === '렌탈' && !r[3].includes('퓨리케어')) return false;
      if (productFilter === '중고폰' && !r[3].includes('중고폰')) return false;
    }
    if (aiFilter !== '전체' && aiStates[r[8]] !== aiFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!r[1].toLowerCase().includes(s) && !r[3].toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const toggleAi = (idx) => {
    setAiStates(prev => {
      const next = [...prev];
      next[idx] = next[idx] === 'ON' ? 'OFF' : 'ON';
      return next;
    });
  };

  return (
    <div>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
        <div style={kpiCard}><div style={{ fontSize: 22, fontWeight: 900 }}>4.7</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>평균 별점 ⭐</div></div>
        <div style={kpiCard}><div style={{ fontSize: 22, fontWeight: 900, color: theme.green }}>1,248</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>전체 후기</div></div>
        <div style={kpiCard}><div style={{ fontSize: 22, fontWeight: 900, color: theme.blue }}>1,120</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>AI 노출중</div></div>
        <div style={kpiCard}><div style={{ fontSize: 22, fontWeight: 900, color: theme.textMuted }}>128</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>노출 OFF</div></div>
      </div>

      {/* Info banner */}
      <div style={{ ...card, background: '#eff6ff', borderColor: '#bfdbfe', marginBottom: 14, padding: '10px 16px' }}>
        <div style={{ fontSize: 11, color: theme.navy }}>
          📌 계약 완료 고객만 후기 작성 가능 · <strong>사진 첨부 필수</strong> · 렌트리 리뷰 사용 안 함 (봉이모바일 자체 후기) · AI 채팅에서 상담 시 관련 후기 자동 노출
        </div>
      </div>

      {/* Filter: 상품 */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: theme.textMuted, width: 40 }}>상품</span>
        {productFilters.map(f => (
          <div key={f} style={filterBtn(productFilter === f)} onClick={() => setProductFilter(f)}>{f}</div>
        ))}
      </div>

      {/* Filter: 노출 + 검색 */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: theme.textMuted, width: 40 }}>노출</span>
        {aiFilters.map(f => (
          <div key={f} style={filterBtn(aiFilter === f)} onClick={() => setAiFilter(f)}>{f}</div>
        ))}
        <input
          placeholder="이름 / 상품 검색"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ marginLeft: 'auto', width: 200, padding: '5px 10px', border: `1px solid ${theme.borderDark}`, borderRadius: 6, fontSize: 12, outline: 'none' }}
        />
      </div>

      {/* Table */}
      <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
        <table style={{ ...tableStyles.table, fontSize: 11, minWidth: 900, marginBottom: 0 }}>
          <thead>
            <tr>
              <th style={tableStyles.th}>등록일</th>
              <th style={tableStyles.th}>이름</th>
              <th style={tableStyles.th}>티켓번호</th>
              <th style={tableStyles.th}>상품</th>
              <th style={tableStyles.th}>별점</th>
              <th style={tableStyles.th}>내용</th>
              <th style={tableStyles.th}>사진</th>
              <th style={tableStyles.th}>AI노출</th>
              <th style={tableStyles.th}>상세</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const [date, name, ticket, product, star, content, photo, , idx] = r;
              const currentAi = aiStates[idx];
              return (
                <tr key={idx}>
                  <td style={{ ...tableStyles.td, fontSize: 10 }}>{date}</td>
                  <td style={{ ...tableStyles.td, fontWeight: 600, color: theme.blue, cursor: 'pointer', textDecoration: 'underline' }}>{name}</td>
                  <td style={tableStyles.td}>
                    {ticket !== '-'
                      ? <span style={{ fontFamily: 'monospace', fontWeight: 700, color: theme.blue, fontSize: 10 }}>{ticket}</span>
                      : '-'
                    }
                  </td>
                  <td style={{ ...tableStyles.td, fontSize: 10, maxWidth: 160 }}>{product}</td>
                  <td style={tableStyles.td}>{renderStars(star)}</td>
                  <td style={{ ...tableStyles.td, fontSize: 10, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={content}>{content}</td>
                  <td style={tableStyles.td}>
                    {photo !== '0장'
                      ? <span style={{ color: theme.blue, fontSize: 10 }}>📷 {photo}</span>
                      : '-'
                    }
                  </td>
                  <td style={tableStyles.td}>
                    <span
                      style={{ ...statusStyle(currentAi === 'ON' ? 'green' : 'gray'), cursor: 'pointer' }}
                      onClick={() => toggleAi(idx)}
                    >
                      {currentAi}
                    </span>
                  </td>
                  <td style={tableStyles.td}>
                    <span style={{ ...button.secondary, fontSize: 10, padding: '3px 8px', cursor: 'pointer' }}>상세</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
