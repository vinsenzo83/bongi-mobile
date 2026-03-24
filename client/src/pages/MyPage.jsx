import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { api } from '../utils/api.js';

const REVIEW_CATEGORIES = [
  '인터넷', '정수기', '공기청정기', 'TV', '세탁건조기', '비데', '냉장고', '에어컨', '기타',
];

const INITIAL_REVIEW_FORM = {
  category: '',
  productName: '',
  rating: 0,
  content: '',
  imagePreview: null,
  imageFile: null,
};

function StarRating({ value, onChange, readOnly = false }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(star => (
        <span
          key={star}
          onClick={() => !readOnly && onChange(star)}
          style={{
            cursor: readOnly ? 'default' : 'pointer',
            fontSize: readOnly ? 14 : 24,
            color: star <= value ? '#FFD700' : '#555',
            userSelect: 'none',
          }}
        >
          ★
        </span>
      ))}
    </span>
  );
}

export default function MyPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('applications');
  const [applications, setApplications] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [reviewForm, setReviewForm] = useState(INITIAL_REVIEW_FORM);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState('');

  useEffect(() => {
    api.crm.getApplications()
      .then(setApplications)
      .catch(() => setApplications([]));
  }, []);

  useEffect(() => {
    if (tab === 'reviews') {
      api.reviews.list()
        .then(data => setReviews(Array.isArray(data) ? data : (data.reviews || [])))
        .catch(() => setReviews([]));
    }
  }, [tab]);

  const handleReviewChange = (field, value) => {
    setReviewForm(prev => ({ ...prev, [field]: value }));
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setReviewError('이미지 파일만 업로드 가능합니다.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setReviewError('이미지 크기는 3MB 이하여야 합니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setReviewForm(prev => ({
        ...prev,
        imagePreview: reader.result,
        imageFile: file,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleImageRemove = () => {
    setReviewForm(prev => ({
      ...prev,
      imagePreview: null,
      imageFile: null,
    }));
  };

  const handleReviewSubmit = async () => {
    setReviewError('');
    if (!reviewForm.category) {
      setReviewError('카테고리를 선택해주세요');
      return;
    }
    if (!reviewForm.productName.trim()) {
      setReviewError('상품명을 입력해주세요');
      return;
    }
    if (reviewForm.rating === 0) {
      setReviewError('별점을 선택해주세요');
      return;
    }
    if (reviewForm.content.trim().length < 10) {
      setReviewError('후기 내용을 10자 이상 입력해주세요');
      return;
    }

    try {
      setReviewSubmitting(true);

      let imageUrl = null;
      if (reviewForm.imagePreview) {
        const uploadResult = await api.reviews.uploadImage(reviewForm.imagePreview);
        imageUrl = uploadResult.url;
      }

      const created = await api.reviews.create({
        category: reviewForm.category,
        product_name: reviewForm.productName.trim(),
        rating: reviewForm.rating,
        content: reviewForm.content.trim(),
        image_url: imageUrl,
      });
      setReviews(prev => [created, ...prev]);
      setReviewForm(INITIAL_REVIEW_FORM);
    } catch (error) {
      setReviewError(error.message || '후기 작성에 실패했습니다');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const tabs = [
    { id: 'applications', label: '신청 내역' },
    { id: 'contracts', label: '계약 상태' },
    { id: 'reviews', label: '후기' },
    { id: 'profile', label: '내 정보' },
  ];

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 700 }}>
        {/* 프로필 헤더 */}
        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: 22, marginBottom: 4 }}>{user?.displayName || user?.email || '게스트'}</h2>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{user?.email || '로그인 없이 이용 중'}</div>
            <span className="badge badge-blue" style={{ marginTop: 8 }}>{user?.role || 'guest'}</span>
          </div>
          {user ? (
            <button onClick={handleLogout} className="btn btn-outline" style={{ color: 'var(--danger)' }}>로그아웃</button>
          ) : (
            <button onClick={() => navigate('/login')} className="btn btn-outline">로그인</button>
          )}
        </div>

        {/* 탭 */}
        <div style={{ display: 'flex', gap: 4, marginTop: 20, marginBottom: 16 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`btn ${tab === t.id ? 'btn-primary' : 'btn-outline'}`} style={{ fontSize: 14 }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* 신청 내역 */}
        {tab === 'applications' && (
          <div className="card">
            <h3 style={{ fontSize: 16, marginBottom: 16 }}>신청 내역</h3>
            {applications.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>아직 신청 내역이 없습니다</p>
            ) : (
              <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={th}>접수번호</th>
                    <th style={th}>유형</th>
                    <th style={th}>상품</th>
                    <th style={th}>상태</th>
                    <th style={th}>날짜</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map(a => (
                    <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={td}><code>{a.id}</code></td>
                      <td style={td}>{a.type === 'self' ? '셀프가입' : a.type === 'call' ? '바로상담' : a.type}</td>
                      <td style={td}>{a.productTicket || a.product_ticket || '-'}</td>
                      <td style={td}><span className="badge badge-blue">{a.status}</span></td>
                      <td style={td}>{(() => { const d = new Date(a.createdAt || a.created_at); return isNaN(d) ? '-' : d.toLocaleDateString('ko-KR'); })()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* 계약 상태 */}
        {tab === 'contracts' && (
          <div className="card">
            <h3 style={{ fontSize: 16, marginBottom: 16 }}>계약 상태</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>계약 내역은 상담사 확인 후 표시됩니다</p>
          </div>
        )}

        {/* 후기 */}
        {tab === 'reviews' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* 후기 작성 폼 */}
            <div className="card">
              <h3 style={{ fontSize: 16, marginBottom: 16 }}>후기 작성</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label>카테고리</label>
                  <select
                    value={reviewForm.category}
                    onChange={e => handleReviewChange('category', e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">카테고리 선택</option>
                    {REVIEW_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>상품명</label>
                  <input
                    type="text"
                    placeholder="이용 중인 상품명"
                    value={reviewForm.productName}
                    onChange={e => handleReviewChange('productName', e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label>별점</label>
                  <div>
                    <StarRating
                      value={reviewForm.rating}
                      onChange={val => handleReviewChange('rating', val)}
                    />
                  </div>
                </div>
                <div>
                  <label>후기 내용 (최소 10자)</label>
                  <textarea
                    rows={4}
                    placeholder="최소 10자 이상"
                    value={reviewForm.content}
                    onChange={e => handleReviewChange('content', e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label>사진 첨부 (선택, 3MB 이하)</label>
                  {reviewForm.imagePreview ? (
                    <div style={{ position: 'relative', display: 'inline-block', marginTop: 8 }}>
                      <img
                        src={reviewForm.imagePreview}
                        alt="미리보기"
                        style={{
                          maxWidth: '100%',
                          maxHeight: 200,
                          borderRadius: 8,
                          border: '1px solid var(--border)',
                          display: 'block',
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleImageRemove}
                        style={{
                          position: 'absolute',
                          top: -8,
                          right: -8,
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          background: 'var(--danger)',
                          color: '#fff',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: 14,
                          lineHeight: '24px',
                          textAlign: 'center',
                          padding: 0,
                        }}
                      >
                        X
                      </button>
                    </div>
                  ) : (
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      style={{ ...inputStyle, marginTop: 4, padding: 8 }}
                    />
                  )}
                </div>
                {reviewError && (
                  <p style={{ color: 'var(--danger)', fontSize: 13 }}>{reviewError}</p>
                )}
                <button
                  className="btn btn-primary"
                  onClick={handleReviewSubmit}
                  disabled={reviewSubmitting}
                  style={{ alignSelf: 'flex-start' }}
                >
                  {reviewSubmitting ? '작성 중...' : '후기 작성'}
                </button>
              </div>
            </div>

            {/* 내 후기 목록 */}
            <div className="card">
              <h3 style={{ fontSize: 16, marginBottom: 16 }}>내 후기 목록</h3>
              {reviews.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                  아직 작성한 후기가 없어요. 이용 중인 상품의 후기를 남겨주세요!
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {reviews.map(review => (
                    <div
                      key={review.id}
                      style={{
                        padding: 16,
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        background: 'var(--bg)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>{review.product_name}</span>
                        <span className="badge badge-blue">{review.category}</span>
                      </div>
                      <div style={{ marginBottom: 8 }}>
                        <StarRating value={review.rating} readOnly />
                      </div>
                      {review.image_url && (
                        <img
                          src={review.image_url}
                          alt="후기 사진"
                          style={{
                            maxWidth: '100%',
                            maxHeight: 200,
                            borderRadius: 8,
                            marginBottom: 8,
                            display: 'block',
                          }}
                        />
                      )}
                      <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6 }}>
                        {review.content}
                      </p>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
                        {review.created_at
                          ? new Date(review.created_at).toLocaleDateString('ko-KR')
                          : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 내 정보 */}
        {tab === 'profile' && (
          <div className="card">
            <h3 style={{ fontSize: 16, marginBottom: 16 }}>내 정보</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>이메일</span><div style={{ fontSize: 15 }}>{user?.email}</div></div>
              <div><span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>이름</span><div style={{ fontSize: 15 }}>{user?.displayName || '-'}</div></div>
              <div><span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>역할</span><div style={{ fontSize: 15 }}>{user?.role}</div></div>
              <div><span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>가입일</span><div style={{ fontSize: 15 }}>{user?.created_at ? new Date(user.created_at).toLocaleDateString('ko-KR') : '-'}</div></div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

const th = { textAlign: 'left', padding: '8px 10px', fontSize: 12, color: 'var(--text-secondary)' };
const td = { padding: '10px', verticalAlign: 'middle' };
const inputStyle = { background: '#2a2a2a', border: '1px solid #444', borderRadius: 6, padding: '10px 12px', color: 'var(--text)', width: '100%', fontSize: 14 };
