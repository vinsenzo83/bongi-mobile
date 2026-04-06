import { useState } from 'react';

const mockReviews = [
  { id: 1, product: 'KT 인터넷+TV 500Mbps', rating: 5, content: '상담사분이 친절하시고 사은품도 빠르게 받았어요. 인터넷 속도도 만족합니다!', date: '2026.04.01', photos: true, mine: false, author: '김**' },
  { id: 2, product: 'LG 정수기 렌탈', rating: 4, content: '설치도 빠르고 물맛이 좋아요. 카드 할인까지 받으니 월 부담이 적네요.', date: '2026.03.28', photos: true, mine: false, author: '이**' },
  { id: 3, product: 'SKT 인터넷 1G', rating: 5, content: '기가 인터넷 쾌적합니다. 사은품 45만원 현금으로 받았습니다.', date: '2026.03.20', photos: false, mine: false, author: '박**' },
];

export default function Reviews() {
  const [filter, setFilter] = useState('all');
  const [showWrite, setShowWrite] = useState(false);

  const stars = (n) => Array.from({length: 5}, (_, i) => i < n ? '\u2605' : '\u2606').join('');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={h2}>{'⭐'} {' '}후기</div>
          <div style={p}>봉이모바일 고객 후기를 확인하세요</div>
        </div>
        <button onClick={() => setShowWrite(!showWrite)} style={{ ...btn, background: '#2563eb', color: '#fff', border: 'none' }}>
          {'✏️'} {' '}후기 작성
        </button>
      </div>

      {/* 필터 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[['all','전체'],['internet','인터넷+TV'],['rental','렌탈'],['phone','중고폰']].map(([k,v]) => (
          <button key={k} onClick={() => setFilter(k)} style={{
            padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontWeight: filter === k ? 600 : 400,
            background: filter === k ? '#2563eb' : '#fff', color: filter === k ? '#fff' : '#555',
            border: `1px solid ${filter === k ? '#2563eb' : '#d0d0d0'}`,
          }}>{v}</button>
        ))}
      </div>

      {/* 후기 작성 폼 */}
      {showWrite && (
        <div style={{ ...card, borderColor: '#bfdbfe', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2744', marginBottom: 12 }}>후기 작성</div>
          <div style={{ fontSize: 12, color: '#999', marginBottom: 12 }}>계약 완료한 상품만 작성 가능합니다</div>
          <div style={{ marginBottom: 10 }}>
            <div style={label}>상품 선택</div>
            <select style={input}><option>KT 인터넷+TV 500Mbps</option><option>LG 정수기 렌탈</option></select>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={label}>별점</div>
            <div style={{ fontSize: 24, color: '#fbbf24' }}>{'\u2605\u2605\u2605\u2605\u2605'}</div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={label}>후기 내용</div>
            <textarea style={{ ...input, height: 80, resize: 'none' }} placeholder="후기를 작성해주세요" />
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={label}>사진 첨부 (필수)</div>
            <div style={{ border: '1.5px dashed #d0d0d0', borderRadius: 8, padding: 20, textAlign: 'center', color: '#999', fontSize: 12, cursor: 'pointer' }}>
              {'📷'} {' '}사진을 첨부해주세요 (필수)
            </div>
          </div>
          <button style={{ ...btn, background: '#2563eb', color: '#fff', border: 'none', width: '100%' }}>후기 등록하기</button>
          <div style={{ fontSize: 11, color: '#999', marginTop: 8, textAlign: 'center' }}>후기 작성 시 15,000P 적립!</div>
        </div>
      )}

      {/* 후기 목록 */}
      {mockReviews.map(r => (
        <div key={r.id} style={{ ...card, marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a2744', marginBottom: 2 }}>{r.product}</div>
              <div style={{ fontSize: 14, color: '#fbbf24' }}>{stars(r.rating)}</div>
            </div>
            <div style={{ fontSize: 11, color: '#999' }}>{r.author} | {r.date}</div>
          </div>
          <div style={{ fontSize: 12, color: '#555', lineHeight: 1.6, marginBottom: 8 }}>{r.content}</div>
          {r.photos && <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ width: 60, height: 60, background: '#eef0f4', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#8090a8' }}>{'📷'}</div>
            <div style={{ width: 60, height: 60, background: '#eef0f4', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#8090a8' }}>{'📷'}</div>
          </div>}
        </div>
      ))}
    </div>
  );
}

const h2 = { fontSize: 16, fontWeight: 700, color: '#1a2744', marginBottom: 4 };
const p = { fontSize: 12, color: '#999', marginBottom: 0 };
const card = { background: '#fff', border: '1px solid #e8e8e8', borderRadius: 10, padding: 16 };
const label = { fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 6 };
const input = { width: '100%', border: '1.5px solid #d0d0d0', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#999', marginBottom: 0, background: '#fafafa', fontFamily: 'inherit' };
const btn = { padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
