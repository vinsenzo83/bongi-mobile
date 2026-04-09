import { colors, fonts } from './designTokens';

// 통신사별 배지 색상 (피그마 기준)
const CARRIER_BADGE = {
  SKT: { bg: colors.skt, text: '#fff' },
  SK: { bg: colors.skt, text: '#fff' },
  KT: { bg: colors.kt, text: '#fff' },
  'LG U+': { bg: colors.lgu, text: '#fff' },
  LG: { bg: colors.lgu, text: '#fff' },
};

// 통신사 로고 텍스트
const CARRIER_LOGO = {
  SKT: 'SK', SK: 'SK', KT: 'KT', 'LG U+': 'LG', LG: 'LG',
};

function formatPrice(v) {
  if (!v) return '-';
  if (typeof v === 'string') return v;
  return Number(v).toLocaleString() + ' 원';
}

export default function ProductCard({ product, onAction }) {
  if (!product) return null;

  // 인터넷 vs 렌탈 판별
  const isRental = !!(product.월렌탈료 || product.렌탈조건 || product.계약기간 ||
    (product.카테고리 && product.카테고리.includes('렌탈')) ||
    (product.상품번호 && product.상품번호.startsWith('R')));

  const carrier = product.통신사 || '';
  const badge = CARRIER_BADGE[carrier] || { bg: isRental ? colors.rental : colors.primary, text: isRental ? colors.rentalText : '#fff' };
  const ticketNo = product.상품번호 || product.티켓번호 || '';
  const productName = product.상품명 || '';
  const description = product.설명 || product.추천대상 || '';

  // 배지 타입 (BEST / 최저요금)
  const badgeType = product.배지 || product.badge || null;

  // 통신사 로고
  const logoText = CARRIER_LOGO[carrier] || (isRental ? '렌탈' : '');
  const thumbnail = product.썸네일 || product.이미지 || '';

  // 요금 항목들
  const feeItems = product.요금항목 || [];
  const discountItems = product.할인항목 || [];
  const monthlyTotal = product.소계 || product['인터넷+TV_월요금'] || product.월요금 || '';
  const discountTotal = product.할인합계 || '';
  const finalPrice = product['★최종_월요금'] || product.최종월요금 || '';
  const giftText = product.사은품 || '';

  // 렌탈 전용
  const rentalConditions = product.렌탈조건 || [];
  const productOptions = product.상품옵션 || [];
  const rentalFee = product.월렌탈료 || '';

  return (
    <div style={styles.card}>
      {/* 상단 배지 영역 */}
      <div style={styles.badgeRow}>
        <span style={{ ...styles.ticketBadge, background: badge.bg, color: badge.text }}>
          {ticketNo}
        </span>
        {badgeType === 'BEST' && (
          <span style={{ ...styles.typeBadge, background: colors.bestBadge, color: '#fff' }}>BEST</span>
        )}
        {badgeType === '최저요금' && (
          <span style={{ ...styles.typeBadge, background: colors.success, color: '#fff' }}>최저요금</span>
        )}
      </div>

      {/* 로고 + 상품명 */}
      <div style={styles.logoSection}>
        {thumbnail ? (
          <div style={styles.logoCircle}>
            <img src={thumbnail} alt={productName} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
        ) : (
          <div style={styles.logoCircle}>
            <span style={styles.logoText}>{logoText}</span>
          </div>
        )}
      </div>
      <div style={styles.productName}>{productName}</div>
      {description && <div style={styles.description}>{description}</div>}

      {/* ── 인터넷 상품 요금 섹션 ── */}
      {!isRental && (
        <>
          {/* 월 이용요금 */}
          <div style={styles.sectionRow}>
            <span style={styles.sectionLabel}>월 이용요금</span>
            <span style={styles.sectionValue}>월 {formatPrice(monthlyTotal)}</span>
          </div>
          {feeItems.length > 0 && feeItems.map((item, i) => (
            <div key={i} style={styles.subRow}>
              <span style={styles.subLabel}>└ {item.label}</span>
              <span style={styles.subValue}>{formatPrice(item.price)}</span>
            </div>
          ))}
          {/* 개별 필드 폴백 */}
          {feeItems.length === 0 && (
            <>
              {product.인터넷요금 && (
                <div style={styles.subRow}>
                  <span style={styles.subLabel}>└ 인터넷{product.WiFi ? '+와이파이' : ''}</span>
                  <span style={styles.subValue}>{product.인터넷요금}</span>
                </div>
              )}
              {product.TV요금 && (
                <div style={styles.subRow}>
                  <span style={styles.subLabel}>└ TV</span>
                  <span style={styles.subValue}>{product.TV요금}</span>
                </div>
              )}
              {product.셋탑박스 && (
                <div style={styles.subRow}>
                  <span style={styles.subLabel}>└ 셋탑박스</span>
                  <span style={styles.subValue}>{product.셋탑박스}</span>
                </div>
              )}
            </>
          )}
          <div style={styles.divider} />

          {/* 요금 할인 */}
          {(discountItems.length > 0 || product.결합할인 || product.카드할인) && (
            <>
              <div style={styles.sectionRow}>
                <span style={{ ...styles.sectionLabel, color: colors.primary }}>요금 할인</span>
                <span style={{ ...styles.sectionValue, color: colors.primary }}>
                  월 {formatPrice(discountTotal || '')}
                </span>
              </div>
              {discountItems.map((item, i) => (
                <div key={i} style={styles.subRow}>
                  <span style={styles.subLabel}>└ {item.label}</span>
                  <span style={{ ...styles.subValue, color: colors.primary }}>{formatPrice(item.price)}</span>
                </div>
              ))}
              {discountItems.length === 0 && (
                <>
                  {product.결합할인 && product.결합할인 !== '없음' && (
                    <div style={styles.subRow}>
                      <span style={styles.subLabel}>└ 결합 할인</span>
                      <span style={{ ...styles.subValue, color: colors.primary }}>{product.결합할인}</span>
                    </div>
                  )}
                  {product.휴대폰할인 && (
                    <div style={styles.subRow}>
                      <span style={styles.subLabel}>└ 휴대폰 할인</span>
                      <span style={{ ...styles.subValue, color: colors.primary }}>{product.휴대폰할인}</span>
                    </div>
                  )}
                  {product.카드할인 && product.카드할인 !== '없음' && (
                    <div style={styles.subRow}>
                      <span style={styles.subLabel}>└ 제휴카드 할인</span>
                      <span style={{ ...styles.subValue, color: colors.primary }}>{product.카드할인}</span>
                    </div>
                  )}
                </>
              )}
              <div style={styles.divider} />
            </>
          )}

          {/* 최종 요금 */}
          <div style={styles.finalSection}>
            <span style={styles.finalLabel}>예상 납부 요금 ⓘ</span>
            <span style={styles.finalPrice}>월 {formatPrice(finalPrice)}</span>
          </div>
          <div style={styles.finalNote}>(부가세 포함)</div>
          <div style={styles.finalNote}>3년 약정 기준, 설치비 별도</div>
        </>
      )}

      {/* ── 렌탈 상품 섹션 ── */}
      {isRental && (
        <>
          {/* 렌탈 조건 */}
          {(rentalConditions.length > 0 || product.계약기간) && (
            <>
              <div style={styles.sectionRow}>
                <span style={styles.sectionLabel}>렌탈 조건</span>
              </div>
              {product.계약기간 && (
                <div style={styles.subRow}>
                  <span style={styles.subLabel}>└ 계약기간</span>
                  <span style={styles.subValue}>{product.계약기간}</span>
                </div>
              )}
              {product.케어서비스 && (
                <div style={styles.subRow}>
                  <span style={styles.subLabel}>└ 케어서비스 주기</span>
                  <span style={styles.subValue}>{product.케어서비스}</span>
                </div>
              )}
              {rentalConditions.map((item, i) => (
                <div key={i} style={styles.subRow}>
                  <span style={styles.subLabel}>└ {item.label}</span>
                  <span style={styles.subValue}>{item.value}</span>
                </div>
              ))}
              <div style={styles.divider} />
            </>
          )}

          {/* 상품 옵션 */}
          {(productOptions.length > 0 || product.색상) && (
            <>
              <div style={styles.sectionRow}>
                <span style={styles.sectionLabel}>상품 옵션</span>
              </div>
              {product.색상 && (
                <div style={styles.subRow}>
                  <span style={styles.subLabel}>└ 색상</span>
                  <span style={styles.subValue}>{product.색상}</span>
                </div>
              )}
              {productOptions.map((item, i) => (
                <div key={i} style={styles.subRow}>
                  <span style={styles.subLabel}>└ {item.label}</span>
                  <span style={styles.subValue}>{item.value}</span>
                </div>
              ))}
              <div style={styles.divider} />
            </>
          )}

          {/* 이용 요금 */}
          <div style={styles.sectionRow}>
            <span style={styles.sectionLabel}>이용 요금</span>
            <span style={styles.sectionValue}>월 {formatPrice(rentalFee || monthlyTotal)}</span>
          </div>
          {feeItems.map((item, i) => (
            <div key={i} style={styles.subRow}>
              <span style={styles.subLabel}>└ {item.label}</span>
              <span style={styles.subValue}>{formatPrice(item.price)}</span>
            </div>
          ))}

          {/* 할인 */}
          {(discountItems.length > 0 || product.카드할인) && (
            <>
              <div style={styles.divider} />
              <div style={styles.sectionRow}>
                <span style={{ ...styles.sectionLabel, color: colors.primary }}>요금 할인</span>
                <span style={{ ...styles.sectionValue, color: colors.primary }}>
                  월 {formatPrice(discountTotal || '')}
                </span>
              </div>
              {discountItems.map((item, i) => (
                <div key={i} style={styles.subRow}>
                  <span style={styles.subLabel}>└ {item.label}</span>
                  <span style={{ ...styles.subValue, color: colors.primary }}>{formatPrice(item.price)}</span>
                </div>
              ))}
              {discountItems.length === 0 && product.카드할인 && product.카드할인 !== '없음' && (
                <div style={styles.subRow}>
                  <span style={styles.subLabel}>└ 제휴카드 할인</span>
                  <span style={{ ...styles.subValue, color: colors.primary }}>{product.카드할인}</span>
                </div>
              )}
            </>
          )}
          <div style={styles.divider} />

          {/* 예상 이용 요금 */}
          <div style={styles.finalSection}>
            <span style={styles.finalLabel}>예상 이용 요금 ⓘ</span>
            <span style={styles.finalPrice}>월 {formatPrice(finalPrice || rentalFee)}</span>
          </div>
          <div style={styles.finalNote}>(부가세 포함)</div>
        </>
      )}

      {/* 사은품 */}
      {giftText && giftText !== '-' && (
        <div style={styles.giftStrip}>
          <span>🎁</span>
          <span style={styles.giftText}>현금 사은품 최대 {giftText} 받아가기</span>
        </div>
      )}

      {/* 버튼 */}
      {onAction && (
        <div style={styles.actions}>
          <button
            style={styles.outlineBtn}
            onClick={() => onAction(`${ticketNo} 상세정보 알려줘`)}
          >
            상세보기
          </button>
          <button
            style={styles.filledBtn}
            onClick={() => {
              const p = {
                name: product.상품명 || '',
                provider: product.통신사 || '',
                speed: product.속도 || '',
                tv: product.TV || '',
                monthlyFee: product.최종월요금 || product.월요금 || product.월렌탈료 || '',
                gift: product.사은품 || '',
                ticket: ticketNo,
                brand: product.브랜드 || '',
                card: product.카드할인 || '',
              };
              const cat = isRental ? 'rental' : 'internet';
              onAction('__consult__' + JSON.stringify({ product: p, category: cat }));
            }}
          >
            가입 상담
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  card: {
    background: colors.white,
    border: `1px solid ${colors.border}`,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    width: 200,
    minWidth: 200,
    maxWidth: 290,
    fontFamily: fonts.family,
    boxSizing: 'border-box',
  },
  badgeRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ticketBadge: {
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 10px',
    borderRadius: 10,
    letterSpacing: 0.5,
  },
  typeBadge: {
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 10,
  },
  logoSection: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: 8,
  },
  logoCircle: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: colors.surface,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  logoText: {
    fontSize: 12,
    fontWeight: 800,
    color: colors.text,
  },
  productName: {
    fontSize: 16,
    fontWeight: 700,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 4,
    lineHeight: 1.3,
    wordBreak: 'keep-all',
  },
  description: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 1.4,
  },
  sectionRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: colors.text,
  },
  sectionValue: {
    fontSize: 13,
    fontWeight: 700,
    color: colors.text,
  },
  subRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 4,
    marginBottom: 2,
  },
  subLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    flex: 1,
  },
  subValue: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'right',
    flexShrink: 0,
  },
  divider: {
    height: 1,
    background: colors.border,
    margin: '8px 0',
  },
  finalSection: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 2,
  },
  finalLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: colors.primary,
  },
  finalPrice: {
    fontSize: 18,
    fontWeight: 800,
    color: colors.danger,
  },
  finalNote: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'right',
    lineHeight: 1.5,
  },
  giftStrip: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 10px',
    background: colors.primaryLight,
    borderRadius: 8,
    marginTop: 10,
    marginBottom: 4,
  },
  giftText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: 500,
  },
  actions: {
    display: 'flex',
    gap: 8,
    marginTop: 10,
  },
  outlineBtn: {
    flex: 1,
    padding: '9px 0',
    borderRadius: 8,
    border: `1.5px solid ${colors.primary}`,
    background: colors.white,
    color: colors.primary,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: fonts.family,
  },
  filledBtn: {
    flex: 1,
    padding: '9px 0',
    borderRadius: 8,
    border: 'none',
    background: colors.primary,
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: fonts.family,
  },
};
