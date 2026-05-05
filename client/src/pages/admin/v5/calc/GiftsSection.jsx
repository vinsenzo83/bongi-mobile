// V5 어드민 — 8. 사은품 (이전됨, disabled)
// 사은품 관리는 V5 인센티브 상품(incentive-products)으로 이전됨.
// 여기서는 리다이렉트 안내만 표시.
import { Link } from 'react-router-dom';
import SectionShell from './SectionShell.jsx';

export default function GiftsSection({ open, onToggle }) {
  return (
    <SectionShell
      id="sec-8"
      title="🎁 8. 사은품 (이전됨)"
      note="사은품 관리는 V5 인센티브 상품 페이지로 이전되었습니다. 변경은 그쪽에서 진행해주세요."
      open={open}
      onToggle={onToggle}
    >
      <div style={{ padding: 24, textAlign: 'center', background: '#0f172a', border: '1px dashed #475569', borderRadius: 10 }}>
        <div style={{ fontSize: 13, color: '#fbbf24', fontWeight: 800, marginBottom: 10 }}>
          📦 사은품(페이백) 데이터는 V5 인센티브 상품 관리에서 편집합니다.
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 14, lineHeight: 1.6 }}>
          여기서 편집된 값(D.gift)은 incentive_products.payback 데이터와 자동 동기화됩니다.<br />
          상품 추가·삭제·금액 변경은 admin 권한자만 가능합니다.
        </div>
        <Link
          to="/admin/v5/products"
          style={{
            display: 'inline-block', padding: '10px 22px',
            background: '#3b82f6', color: '#fff',
            borderRadius: 8, fontSize: 13, fontWeight: 800,
            textDecoration: 'none',
          }}
        >→ V5 인센티브 상품 관리로 이동</Link>
      </div>
    </SectionShell>
  );
}
