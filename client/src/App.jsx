import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Chat from './pages/Chat.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import AuthCallback from './pages/AuthCallback.jsx';
import MyPage from './pages/MyPage.jsx';
import Dashboard from './pages/admin/Dashboard.jsx';
import CustomerDetail from './pages/admin/CustomerDetail.jsx';
import Incentive from './pages/admin/Incentive.jsx';

function AppRoutes() {
  const location = useLocation();
  const { pathname } = location;
  const isAdmin = pathname.startsWith('/admin');
  const isAuth = ['/login', '/signup'].includes(pathname);

  // ?ref= 파라미터 처리: localStorage에 저장
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const ref = params.get('ref');
    if (ref && ref.startsWith('RETURN_')) {
      localStorage.setItem('referral_code', ref);
    }
  }, [location.search]);

  return (
    <Routes>
      {/* 메인: 채팅 (ChatGPT 스타일) */}
      <Route path="/" element={<Chat />} />

      {/* 인증 */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/mypage" element={<MyPage />} />

      {/* CRM 어드민 */}
      <Route path="/admin" element={<ProtectedRoute minRole="agent"><Dashboard /></ProtectedRoute>} />
      <Route path="/admin/customer/:id" element={<ProtectedRoute minRole="agent"><CustomerDetail /></ProtectedRoute>} />
      <Route path="/admin/incentive" element={<ProtectedRoute minRole="agent"><Incentive /></ProtectedRoute>} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
