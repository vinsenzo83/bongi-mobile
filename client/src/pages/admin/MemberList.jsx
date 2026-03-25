import Topbar from '../../components/admin/Topbar.jsx';
import { theme } from '../../styles/admin-theme.js';

export default function MemberList() {
  return (
    <>
      <Topbar title="회원 관리" />
      <div style={{ padding: '24px 0', textAlign: 'center', color: theme.textMuted }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🚧</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: theme.textWhite, marginBottom: 8 }}>회원 관리</div>
        <div>구현 예정입니다</div>
      </div>
    </>
  );
}
