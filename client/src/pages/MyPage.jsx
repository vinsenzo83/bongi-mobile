import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { api } from '../utils/api.js';

const REVIEW_CATEGORIES = [
  '인터넷', '정수기', '공기청정기', 'TV', '세탁건조기', '비데', '냉장고', '에어컨', '기타',
];

const BANK_LIST = [
  '신한은행', '국민은행', 'NH농협은행', '우리은행', '하나은행',
  'IBK기업은행', 'SC제일은행', '카카오뱅크', '토스뱅크', '케이뱅크',
  '광주은행', '전북은행', '새마을금고', '신협', '우체국',
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
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'applications';
  const [tab, setTab] = useState(initialTab);
  const [applications, setApplications] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [reviewForm, setReviewForm] = useState(INITIAL_REVIEW_FORM);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [referralStats, setReferralStats] = useState(null);
  const [codeCopied, setCodeCopied] = useState(false);

  // 리턴캐쉬 상태
  const [cashBalance, setCashBalance] = useState(0);
  const [cashHistory, setCashHistory] = useState([]);
  const [cashLoading, setCashLoading] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawForm, setWithdrawForm] = useState({
    bank_name: '',
    account_number: '',
    account_holder: '',
    amount: '',
  });
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');
  const [withdrawSuccess, setWithdrawSuccess] = useState('');

  useEffect(() => {
    api.crm.getApplications()
      .then(setApplications)
      .catch(() => setApplications([]));
  }, []);

  useEffect(() => {
    if (tab === 'referral') {
      const savedCode = localStorage.getItem('my_referral_code');
      api.referrals.getMyCode(savedCode || undefined)
        .then(res => {
          setReferralCode(res.code);
          localStorage.setItem('my_referral_code', res.code);
          return api.referrals.getStats(res.code);
        })
        .then(setReferralStats)
        .catch(() => {});
    }
  }, [tab]);

  useEffect(() => {
    if (tab === 'cash') {
      setCashLoading(true);
      Promise.all([
        api.cash.getBalance().catch(() => ({ balance: 0 })),
        api.cash.getHistory().catch(() => ({ history: [] })),
      ]).then(([balanceRes, historyRes]) => {
        setCashBalance(balanceRes.balance || 0);
        setCashHistory(historyRes.history || []);
      }).finally(() => setCashLoading(false));
    }
  }, [tab]);

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

  const handleWithdrawChange = (field, value) => {
    setWithdrawForm(prev => ({ ...prev, [field]: value }));
  };

  const handleWithdrawSubmit = async () => {
    setWithdrawError('');
    setWithdrawSuccess('');

    if (!user) {
      setWithdrawError('출금 신청은 로그인이 필요합니다.');
      return;
    }
    if (!withdrawForm.bank_name) {
      setWithdrawError('은행을 선택해주세요.');
      return;
    }
    if (!withdrawForm.account_number || withdrawForm.account_number.trim().length < 8) {
      setWithdrawError('올바른 계좌번호를 입력해주세요.');
      return;
    }
    if (!withdrawForm.account_holder || withdrawForm.account_holder.trim().length < 2) {
      setWithdrawError('예금주명을 입력해주세요.');
      return;
    }
    const amount = parseInt(withdrawForm.amount);
    if (!amount || amount < 10000) {
      setWithdrawError('최소 출금 금액은 10,000원입니다.');
      return;
    }
    if (amount > cashBalance) {
      setWithdrawError('잔액이 부족합니다.');
      return;
    }

    try {
      setWithdrawSubmitting(true);
      const result = await api.cash.withdraw({
        bank_name: withdrawForm.bank_name,
        account_number: withdrawForm.account_number.trim(),
        account_holder: withdrawForm.account_holder.trim(),
        amount,
      });
      setWithdrawSuccess(result.message);
      setCashBalance(prev => prev - amount);
      setCashHistory(prev => [{
        id: result.withdrawal_id,
        type: 'withdraw',
        amount,
        description: `출금 신청 (${withdrawForm.bank_name})`,
        status: 'pending',
        created_at: new Date().toISOString(),
      }, ...prev]);
      setWithdrawForm({ bank_name: '', account_number: '', account_holder: '', amount: '' });
      setWithdrawOpen(false);
    } catch (error) {
      setWithdrawError(error.message || '출금 신청에 실패했습니다.');
    } finally {
      setWithdrawSubmitting(false);
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
    { id: 'referral', label: '친구초대' },
    { id: 'cash', label: '리턴캐쉬' },
    { id: 'profile', label: '내 정보' },
  ];

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 700, position: 'relative' }}>
        <button onClick={() => navigate('/')} style={{ position: 'fixed', top: 16, right: 16, background: '#333', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', padding: '4px 10px', borderRadius: '50%', zIndex: 1000, lineHeight: 1 }}>✕</button>
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
        <div style={{ display: 'flex', gap: 4, marginTop: 20, marginBottom: 16, overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none', paddingBottom: 2 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`btn ${tab === t.id ? 'btn-primary' : 'btn-outline'}`} style={{ fontSize: 14, whiteSpace: 'nowrap', flexShrink: 0 }}>
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
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse', minWidth: 500 }}>
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
              </div>
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

        {/* 친구초대 */}
        {tab === 'referral' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* 혜택 안내 */}
            <div className="card" style={{ background: 'linear-gradient(135deg, #1a3a5c, #2a4a6c)', border: '1px solid #3a6a9c' }}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>친구초대 프로그램</div>
              <div style={{ fontSize: 14, color: '#ccc', lineHeight: 1.8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ background: '#60a5fa', color: '#fff', borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>1단계</span>
                  <span>친구 가입 시: <strong style={{ color: '#60a5fa' }}>2,000원</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ background: '#34d399', color: '#fff', borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>2단계</span>
                  <span>친구 계약 시: <strong style={{ color: '#34d399' }}>+20,000원</strong>(나) + <strong style={{ color: '#fbbf24' }}>10,000원</strong>(친구)</span>
                </div>
                <div style={{ marginTop: 8, fontSize: 13, color: '#aaa' }}>
                  1명당 최대 <strong style={{ color: '#fff' }}>22,000원</strong> 보상!
                </div>
              </div>
            </div>

            {/* 내 추천 코드 */}
            <div className="card">
              <h3 style={{ fontSize: 16, marginBottom: 12 }}>내 추천코드</h3>
              {referralCode ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <code style={{
                    flex: 1,
                    padding: '12px 16px',
                    background: '#2a2a2a',
                    borderRadius: 8,
                    border: '1px solid #444',
                    fontSize: 18,
                    fontWeight: 700,
                    letterSpacing: 2,
                    color: '#60a5fa',
                    textAlign: 'center',
                  }}>{referralCode}</code>
                  <button
                    className="btn btn-primary"
                    style={{ flexShrink: 0 }}
                    onClick={() => {
                      navigator.clipboard.writeText(referralCode);
                      setCodeCopied(true);
                      setTimeout(() => setCodeCopied(false), 2000);
                    }}
                  >
                    {codeCopied ? '복사됨!' : '복사'}
                  </button>
                </div>
              ) : (
                <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>코드 불러오는 중...</p>
              )}

              {/* 공유 버튼 */}
              {referralCode && (
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    onClick={() => {
                      const shareUrl = `https://bongi-mobile-production.up.railway.app/?ref=${referralCode}`;
                      const shareText = `리턴AI에서 인터넷/렌탈 상담받고 보상 받자! 내 추천 코드: ${referralCode}\n${shareUrl}`;
                      if (navigator.share) {
                        navigator.share({ title: '리턴AI 친구초대', text: shareText, url: shareUrl }).catch(() => {});
                      } else {
                        navigator.clipboard.writeText(shareText);
                        alert('공유 링크가 복사되었습니다!');
                      }
                    }}
                  >
                    공유하기
                  </button>
                  <button
                    className="btn btn-outline"
                    style={{ flex: 1 }}
                    onClick={() => {
                      const shareUrl = `https://bongi-mobile-production.up.railway.app/?ref=${referralCode}`;
                      navigator.clipboard.writeText(shareUrl);
                      alert('링크가 복사되었습니다!');
                    }}
                  >
                    링크 복사
                  </button>
                </div>
              )}
            </div>

            {/* 내 실적 */}
            <div className="card">
              <h3 style={{ fontSize: 16, marginBottom: 12 }}>내 실적</h3>
              {referralStats ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* 실적 카운트 */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1, padding: 12, background: '#2a2a2a', borderRadius: 8, textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: '#60a5fa' }}>{referralStats.total_invited}</div>
                      <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>초대</div>
                    </div>
                    <div style={{ flex: 1, padding: 12, background: '#2a2a2a', borderRadius: 8, textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: '#818cf8' }}>{referralStats.registered}</div>
                      <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>가입</div>
                    </div>
                    <div style={{ flex: 1, padding: 12, background: '#2a2a2a', borderRadius: 8, textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: '#34d399' }}>{referralStats.contracted}</div>
                      <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>계약</div>
                    </div>
                  </div>

                  {/* 보상 금액 */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1, padding: 12, background: '#2a2a2a', borderRadius: 8, textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#fbbf24' }}>{(referralStats.total_earned || 0).toLocaleString()}원</div>
                      <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>누적 보상</div>
                    </div>
                    <div style={{ flex: 1, padding: 12, background: '#2a2a2a', borderRadius: 8, textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#f97316' }}>{(referralStats.pending || 0).toLocaleString()}원</div>
                      <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>대기 중</div>
                    </div>
                  </div>

                  {/* 보상 계산 안내 */}
                  <div style={{ fontSize: 12, color: '#666', lineHeight: 1.6, marginTop: 4 }}>
                    가입 {referralStats.registered}명 x 2,000원 = {(referralStats.registered * 2000).toLocaleString()}원<br/>
                    계약 {referralStats.contracted}명 x 20,000원 = {(referralStats.contracted * 20000).toLocaleString()}원
                  </div>
                </div>
              ) : (
                <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>아직 초대한 친구가 없습니다</p>
              )}
            </div>
          </div>
        )}

        {/* 리턴캐쉬 */}
        {tab === 'cash' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* 잔액 카드 */}
            <div className="card" style={{ background: 'linear-gradient(135deg, #2a1a00, #3a2a10)', border: '1px solid #5a4a20', textAlign: 'center', padding: '28px 20px' }}>
              <div style={{ fontSize: 14, color: '#aaa', marginBottom: 8 }}>내 리턴캐쉬</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: '#fbbf24', marginBottom: 16 }}>
                {cashLoading ? '...' : `${cashBalance.toLocaleString()}원`}
              </div>
              <button
                className="btn btn-primary"
                style={{ background: 'linear-gradient(135deg, #d97706, #f59e0b)', border: 'none', padding: '10px 32px', fontSize: 15, fontWeight: 700 }}
                onClick={() => {
                  if (!user) {
                    setWithdrawError('출금 신청은 로그인이 필요합니다.');
                    return;
                  }
                  setWithdrawOpen(prev => !prev);
                  setWithdrawError('');
                  setWithdrawSuccess('');
                }}
              >
                출금 신청
              </button>
            </div>

            {/* 출금 신청 폼 */}
            {withdrawOpen && (
              <div className="card">
                <h3 style={{ fontSize: 16, marginBottom: 16 }}>출금 신청</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 13, color: '#aaa', marginBottom: 4, display: 'block' }}>은행</label>
                    <select value={withdrawForm.bank_name} onChange={e => handleWithdrawChange('bank_name', e.target.value)} style={inputStyle}>
                      <option value="">은행 선택</option>
                      {BANK_LIST.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 13, color: '#aaa', marginBottom: 4, display: 'block' }}>계좌번호</label>
                    <input type="text" placeholder="- 없이 입력" value={withdrawForm.account_number} onChange={e => handleWithdrawChange('account_number', e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, color: '#aaa', marginBottom: 4, display: 'block' }}>예금주</label>
                    <input type="text" placeholder="예금주명" value={withdrawForm.account_holder} onChange={e => handleWithdrawChange('account_holder', e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, color: '#aaa', marginBottom: 4, display: 'block' }}>출금 금액</label>
                    <input type="number" placeholder="10,000원 이상" value={withdrawForm.amount} onChange={e => handleWithdrawChange('amount', e.target.value)} style={inputStyle} />
                  </div>
                  {withdrawError && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{withdrawError}</p>}
                  {withdrawSuccess && <p style={{ color: '#34d399', fontSize: 13 }}>{withdrawSuccess}</p>}
                  <button className="btn btn-primary" onClick={handleWithdrawSubmit} disabled={withdrawSubmitting} style={{ alignSelf: 'flex-start' }}>
                    {withdrawSubmitting ? '처리 중...' : '출금 신청'}
                  </button>
                </div>
              </div>
            )}

            {/* 적립/출금 내역 */}
            <div className="card">
              <h3 style={{ fontSize: 16, marginBottom: 16 }}>적립/출금 내역</h3>
              {cashLoading ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>불러오는 중...</p>
              ) : cashHistory.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>아직 내역이 없습니다</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {cashHistory.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #333' }}>
                      <div>
                        <div style={{ fontSize: 14, color: 'var(--text)' }}>{item.description || (item.type === 'earn' ? '적립' : '출금')}</div>
                        <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                          {item.created_at ? new Date(item.created_at).toLocaleDateString('ko-KR') : ''}
                          {item.status === 'pending' && <span style={{ color: '#f59e0b', marginLeft: 8 }}>대기중</span>}
                          {item.status === 'rejected' && <span style={{ color: 'var(--danger)', marginLeft: 8 }}>거절</span>}
                        </div>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: item.type === 'earn' ? '#34d399' : '#f87171', whiteSpace: 'nowrap' }}>
                        {item.type === 'earn' ? '+' : '-'}{item.amount.toLocaleString()}원
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 출금 정책 */}
            <div className="card">
              <h3 style={{ fontSize: 16, marginBottom: 16 }}>출금 정책</h3>
              <div style={{ fontSize: 14, color: '#aaa', lineHeight: 2 }}>
                <div>- 출금 자격: 1회 이상 계약 완료 고객</div>
                <div>- 최소 출금 금액: 10,000원</div>
                <div>- 출금 수수료: 무료</div>
                <div>- 처리 기간: 영업일 기준 3~5일</div>
                <div>- 출금 계좌: 본인 명의만 가능</div>
                <div>- 월 출금 한도: 500,000원</div>
              </div>
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
