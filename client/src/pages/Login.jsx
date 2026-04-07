import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import SocialLoginButtons from '../components/SocialLoginButtons.jsx';

export default function Login() {
  const navigate = useNavigate();
  const { user } = useAuth();

  if (user) {
    navigate('/');
    return null;
  }

  return (
    <div style={s.page}>
      <div style={s.container}>
        <button onClick={() => navigate('/')} style={s.closeBtn}>{'✕'}</button>

        <div style={s.header}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>{'🐟'}</div>
          <h1 style={s.title}>봉이모바일 로그인</h1>
          <p style={s.sub}>소셜 계정으로 간편하게 로그인하세요</p>
        </div>

        <div style={s.card}>
          <SocialLoginButtons />
        </div>

        <div style={s.divider}>
          <hr style={s.hr} />
        </div>

        <div style={s.links}>
          <Link to="/signup" style={s.link}>회원가입하고 신청 내역 확인하기</Link>
          <span style={{ color: '#d0d0d0' }}>|</span>
          <Link to="/signup" style={s.link}>회원가입</Link>
        </div>

        <div style={s.notice}>
          <p>{'💡'} 비회원도 AI 채팅으로 상품 조회, 신청이 가능해요!</p>
          <p>회원가입하면 신청 내역 조회, 사은품 확인, 포인트 적립이 가능합니다.</p>
        </div>
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', background: '#f5f6fa', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20, fontFamily: "'Noto Sans KR', -apple-system, sans-serif" },
  container: { width: '100%', maxWidth: 400, position: 'relative' },
  closeBtn: { position: 'absolute', top: -10, right: 0, background: 'none', border: 'none', fontSize: 24, color: '#999', cursor: 'pointer' },
  header: { textAlign: 'center', marginBottom: 28 },
  title: { fontSize: 22, fontWeight: 700, color: '#1a2744', marginBottom: 6 },
  sub: { fontSize: 14, color: '#999' },
  card: { background: '#fff', border: '1px solid #e8e8e8', borderRadius: 12, padding: 24, marginBottom: 20 },
  divider: { marginBottom: 20 },
  hr: { border: 'none', borderTop: '1px solid #e8e8e8' },
  links: { display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 24, fontSize: 13 },
  link: { color: '#2563eb', textDecoration: 'none', fontWeight: 500 },
  notice: { background: '#fff', border: '1px solid #e8e8e8', borderRadius: 12, padding: 16, fontSize: 12, color: '#999', lineHeight: 1.6, textAlign: 'center' },
};
