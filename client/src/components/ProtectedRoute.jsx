import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';

const ROLE_LEVEL = { customer: 0, agent: 1, manager: 2, owner: 3, ops: 3, super: 4 };

export default function ProtectedRoute({ children, minRole = 'customer' }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: 'var(--text-secondary)' }}>로딩 중...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const userLevel = ROLE_LEVEL[user.role] || 0;
  const requiredLevel = ROLE_LEVEL[minRole] || 0;

  if (userLevel < requiredLevel) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: 'var(--danger)' }}>접근 권한이 없습니다</div>;
  }

  return children;
}
