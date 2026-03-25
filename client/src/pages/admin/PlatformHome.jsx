import Topbar from '../../components/admin/Topbar.jsx';
import KpiCard from '../../components/admin/KpiCard.jsx';
import { theme } from '../../styles/admin-theme.js';

export default function PlatformHome() {
  return (
    <>
      <Topbar title="플랫폼 관리" />
      <div style={{ padding: '24px 0' }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
          <KpiCard label="총 회원" value="1,247" icon="👥" trend={12} />
          <KpiCard label="이번 달 계약" value="38" icon="📄" trend={5} color={theme.green} />
          <KpiCard label="미지급 사은품" value="12" icon="🎁" trend={-3} color={theme.yellow} />
          <KpiCard label="출금 대기" value="5" icon="💳" color={theme.orange} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          <QuickLink icon="📦" label="상품 관리" desc="인터넷/렌탈/알뜰폰 상품 등록 및 수정" path="/admin/products" />
          <QuickLink icon="🎁" label="사은품 관리" desc="지급 현황 확인 및 입금 처리" path="/admin/gifts" />
          <QuickLink icon="💰" label="수수료 정산" desc="월별 에이전트 수익 정산" path="/admin/settlements" />
          <QuickLink icon="⭐" label="후기 관리" desc="고객 후기 승인 및 관리" path="/admin/reviews" />
          <QuickLink icon="👥" label="회원 관리" desc="고객/상담원 목록 및 역할 관리" path="/admin/members" />
          <QuickLink icon="🤝" label="친구초대" desc="추천 현황 및 보상 처리" path="/admin/referrals" />
          <QuickLink icon="💳" label="리턴캐쉬" desc="출금 승인 및 수동 적립" path="/admin/cash" />
        </div>
      </div>
    </>
  );
}

function QuickLink({ icon, label, desc, path }) {
  return (
    <a href={path} style={{
      display: 'block',
      background: theme.bgCard,
      border: `1px solid ${theme.border}`,
      borderRadius: theme.radiusLg,
      padding: 20,
      textDecoration: 'none',
      transition: 'border-color 0.15s',
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = theme.blue}
    onMouseLeave={e => e.currentTarget.style.borderColor = theme.border}
    >
      <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: theme.textWhite, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, color: theme.textMuted }}>{desc}</div>
    </a>
  );
}
