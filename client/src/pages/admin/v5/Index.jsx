// V5 어드민 진입 페이지 — 역할별 default 탭 자동 리다이렉트
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useV5Auth } from '../../../hooks/useV5Auth.jsx';

export default function V5Index() {
  const { agent, loading } = useV5Auth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    if (!agent) return; // V5AdminLayout이 LoginBox 표시
    const defaultPath = {
      agent: '/admin/v5/tm',
      manager: '/admin/v5/dashboard',
      contract: '/admin/v5/contracts',
      admin: '/admin/v5/dashboard',
    }[agent.role] || '/admin/v5/tm';
    navigate(defaultPath, { replace: true });
  }, [agent, loading, navigate]);

  return <div style={{ color: '#94a3b8', padding: 20 }}>이동 중...</div>;
}
