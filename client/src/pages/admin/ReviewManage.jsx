import { useState } from 'react';
import { theme, card, button, tableStyles, filterBtn, statusStyle } from '../../styles/admin-theme.js';

const initialReviews = [
  { id: 1, name: '홍길동', product: '5G 프리미엄 77', rating: 5, content: '개통 과정이 정말 빠르고 편리했습니다. 상담원분도 친절하셔서 기분 좋게 가입했어요. 통화 품질도 만족스럽고 데이터 속도도 빠릅니다.', status: '공개', reply: '감사합니다! 앞으로도 좋은 서비스 제공하겠습니다.', date: '2026-03-25' },
  { id: 2, name: '김철수', product: 'LTE 안심 49', rating: 4, content: '가격 대비 데이터가 넉넉해서 좋습니다. 다만 통화 품질이 가끔 떨어지는 느낌이 있어요. 전반적으로는 만족합니다.', status: '공개', reply: null, date: '2026-03-28' },
  { id: 3, name: '이영희', product: '5G 슬림 55', rating: 3, content: '보통입니다. 특별히 좋다고 느끼지는 못했지만 나쁘지도 않았어요. 사은품 지급이 좀 늦어진 점은 아쉬웠습니다.', status: '미답변', reply: null, date: '2026-04-01' },
  { id: 4, name: '최지은', product: 'LTE 실속 34', rating: 5, content: '알뜰폰인데 대형 통신사와 차이를 모르겠어요! 가격도 저렴하고 속도도 만족스럽습니다. 주변에도 추천하고 있어요.', status: '답변완료', reply: '추천까지 감사드립니다! 더 나은 서비스로 보답하겠습니다.', date: '2026-04-02' },
  { id: 5, name: '정수민', product: '5G 표준 62', rating: 2, content: '개통 후 첫 달 요금이 안내받은 것과 달랐습니다. 고객센터에 문의했더니 해결은 됐지만 처음부터 정확한 안내가 필요합니다.', status: '미답변', reply: null, date: '2026-04-03' },
  { id: 6, name: '박민호', product: '5G 프리미엄 77', rating: 4, content: '전반적으로 만족합니다. 5G 속도가 체감될 정도로 빠르고 영상 스트리밍도 끊김 없이 잘 됩니다. 가격만 좀 더 내려가면 완벽할 것 같아요.', status: '비공개', reply: null, date: '2026-04-05' },
];

export default function ReviewManage() {
  const [reviews, setReviews] = useState(initialReviews);
  const [ratingFilter, setRatingFilter] = useState('전체');
  const [statusFilter, setStatusFilter] = useState('전체');
  const [selectedReview, setSelectedReview] = useState(null);
  const [replyText, setReplyText] = useState('');

  const ratingOptions = ['전체', '5점', '4점', '3점', '2점', '1점'];
  const statusOptions = ['전체', '공개', '비공개', '답변완료', '미답변'];

  const filtered = reviews.filter(r => {
    if (ratingFilter !== '전체' && r.rating !== parseInt(ratingFilter)) return false;
    if (statusFilter !== '전체' && r.status !== statusFilter) return false;
    return true;
  });

  const totalCount = reviews.length;
  const avgRating = (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1);
  const thisMonth = reviews.filter(r => r.date.startsWith('2026-04')).length;
  const unanswered = reviews.filter(r => r.status === '미답변').length;

  const reviewStatusColor = (s) => {
    if (s === '공개') return 'green';
    if (s === '비공개') return 'gray';
    if (s === '답변완료') return 'blue';
    if (s === '미답변') return 'orange';
    return 'gray';
  };

  function handleOpenDetail(review) {
    setSelectedReview(review);
    setReplyText(review.reply || '');
  }

  function handleSubmitReply() {
    if (!replyText.trim()) return;
    setReviews(prev => prev.map(r => r.id === selectedReview.id ? { ...r, reply: replyText, status: '답변완료' } : r));
    setSelectedReview(prev => ({ ...prev, reply: replyText, status: '답변완료' }));
  }

  function toggleVisibility(id) {
    setReviews(prev => prev.map(r => {
      if (r.id !== id) return r;
      const newStatus = r.status === '비공개' ? '공개' : '비공개';
      return { ...r, status: newStatus };
    }));
    if (selectedReview && selectedReview.id === id) {
      setSelectedReview(prev => {
        const newStatus = prev.status === '비공개' ? '공개' : '비공개';
        return { ...prev, status: newStatus };
      });
    }
  }

  function renderStars(rating) {
    return (
      <span style={{ color: '#f59e0b', fontSize: 14, letterSpacing: 1 }}>
        {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
      </span>
    );
  }

  return (
    <div style={{ padding: 24, fontFamily: theme.sans, background: theme.bg, minHeight: '100vh' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: theme.text, marginBottom: 20 }}>후기 관리</h2>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <div style={{ ...card, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 4 }}>총 후기</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: theme.text }}>{totalCount}건</div>
        </div>
        <div style={{ ...card, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 4 }}>평균 별점</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#f59e0b' }}>{avgRating}</div>
          <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 2 }}>{'★'.repeat(Math.round(avgRating))}</div>
        </div>
        <div style={{ ...card, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 4 }}>이번달 신규</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: theme.blue }}>{thisMonth}건</div>
        </div>
        <div style={{ ...card, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 4 }}>미답변</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: theme.orange }}>{unanswered}건</div>
        </div>
      </div>

      {/* Filter */}
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: theme.text, marginRight: 4 }}>별점</span>
        {ratingOptions.map(r => (
          <button key={r} style={filterBtn(ratingFilter === r)} onClick={() => setRatingFilter(r)}>{r}</button>
        ))}
        <div style={{ width: 1, height: 20, background: theme.border, margin: '0 8px' }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: theme.text, marginRight: 4 }}>상태</span>
        {statusOptions.map(s => (
          <button key={s} style={filterBtn(statusFilter === s)} onClick={() => setStatusFilter(s)}>{s}</button>
        ))}
      </div>

      {/* Table */}
      <div style={card}>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              <th style={tableStyles.th}>고객명</th>
              <th style={tableStyles.th}>상품</th>
              <th style={tableStyles.th}>별점</th>
              <th style={tableStyles.th}>내용</th>
              <th style={tableStyles.th}>상태</th>
              <th style={tableStyles.th}>작성일</th>
              <th style={tableStyles.th}>관리</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => handleOpenDetail(r)}>
                <td style={tableStyles.td}>{r.name}</td>
                <td style={tableStyles.td}>{r.product}</td>
                <td style={tableStyles.td}>{renderStars(r.rating)}</td>
                <td style={{ ...tableStyles.td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.content.length > 30 ? r.content.slice(0, 30) + '...' : r.content}</td>
                <td style={tableStyles.td}><span style={statusStyle(reviewStatusColor(r.status))}>{r.status}</span></td>
                <td style={tableStyles.td}>{r.date}</td>
                <td style={tableStyles.td}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button style={button.secondary} onClick={e => { e.stopPropagation(); toggleVisibility(r.id); }}>
                      {r.status === '비공개' ? '공개' : '비공개'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ ...tableStyles.td, textAlign: 'center', padding: 32, color: theme.textMuted }}>데이터가 없습니다</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {selectedReview && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setSelectedReview(null)}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 540, maxHeight: '85vh', overflow: 'auto', boxShadow: theme.shadowLg }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: theme.text, margin: 0 }}>후기 상세</h3>
              <button style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: theme.textMuted }} onClick={() => setSelectedReview(null)}>✕</button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: theme.text }}>{selectedReview.name}</span>
                <span style={statusStyle(reviewStatusColor(selectedReview.status))}>{selectedReview.status}</span>
              </div>
              <div style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 8 }}>상품: {selectedReview.product}</div>
              <div style={{ marginBottom: 8 }}>{renderStars(selectedReview.rating)}</div>
              <div style={{ fontSize: 12, color: theme.textMuted }}>작성일: {selectedReview.date}</div>
            </div>

            <div style={{ background: theme.bg, padding: 16, borderRadius: 8, marginBottom: 16, lineHeight: 1.7, fontSize: 13, color: theme.text }}>
              {selectedReview.content}
            </div>

            {/* Reply section */}
            {selectedReview.reply && (
              <div style={{ background: theme.blueBg, padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
                <div style={{ fontWeight: 600, color: theme.blue, marginBottom: 4, fontSize: 11 }}>관리자 답변</div>
                <div style={{ color: theme.text, lineHeight: 1.6 }}>{selectedReview.reply}</div>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: theme.text, display: 'block', marginBottom: 6 }}>
                {selectedReview.reply ? '답변 수정' : '답변 작성'}
              </label>
              <textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                rows={3}
                placeholder="답변을 입력하세요..."
                style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${theme.borderDark}`, borderRadius: 6, fontSize: 13, fontFamily: theme.sans, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                style={selectedReview.status === '비공개' ? button.success : button.danger}
                onClick={() => toggleVisibility(selectedReview.id)}
              >
                {selectedReview.status === '비공개' ? '공개로 전환' : '비공개로 전환'}
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={button.secondary} onClick={() => setSelectedReview(null)}>닫기</button>
                <button style={button.primary} onClick={handleSubmitReply}>답변 등록</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
