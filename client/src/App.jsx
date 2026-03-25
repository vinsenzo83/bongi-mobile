import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AdminLayout from './layouts/AdminLayout.jsx';
import Chat from './pages/Chat.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import AuthCallback from './pages/AuthCallback.jsx';
import MyPage from './pages/MyPage.jsx';

// 어드민 페이지 (lazy load)
const PlatformHome = lazy(() => import('./pages/admin/PlatformHome.jsx'));
const ProductManage = lazy(() => import('./pages/admin/ProductManage.jsx'));
const GiftManage = lazy(() => import('./pages/admin/GiftManage.jsx'));
const CommissionSettle = lazy(() => import('./pages/admin/CommissionSettle.jsx'));
const ReviewManage = lazy(() => import('./pages/admin/ReviewManage.jsx'));
const MemberList = lazy(() => import('./pages/admin/MemberList.jsx'));
const ReferralManage = lazy(() => import('./pages/admin/ReferralManage.jsx'));
const CashManage = lazy(() => import('./pages/admin/CashManage.jsx'));

// CRM
const TodoDashboard = lazy(() => import('./pages/admin/TodoDashboard.jsx'));
const CustomerList = lazy(() => import('./pages/admin/CustomerList.jsx'));
const CustomerDetail = lazy(() => import('./pages/admin/CustomerDetail.jsx'));
const ContractList = lazy(() => import('./pages/admin/ContractList.jsx'));
const KpiDashboard = lazy(() => import('./pages/admin/KpiDashboard.jsx'));
const Incentive = lazy(() => import('./pages/admin/Incentive.jsx'));

// CTI
const CtiConsole = lazy(() => import('./pages/admin/CtiConsole.jsx'));

const AdminFallback = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: '#888' }}>
    로딩 중...
  </div>
);

function AppRoutes() {
  const location = useLocation();

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
      {/* 메인: 채팅 */}
      <Route path="/" element={<Chat />} />

      {/* 인증 */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/mypage" element={<MyPage />} />

      {/* 어드민 (중첩 라우트 + AdminLayout) */}
      <Route path="/admin" element={<ProtectedRoute minRole="agent"><AdminLayout /></ProtectedRoute>}>
        {/* 플랫폼 관리 */}
        <Route index element={<Suspense fallback={<AdminFallback />}><PlatformHome /></Suspense>} />
        <Route path="products" element={<Suspense fallback={<AdminFallback />}><ProductManage /></Suspense>} />
        <Route path="gifts" element={<Suspense fallback={<AdminFallback />}><GiftManage /></Suspense>} />
        <Route path="settlements" element={<Suspense fallback={<AdminFallback />}><CommissionSettle /></Suspense>} />
        <Route path="reviews" element={<Suspense fallback={<AdminFallback />}><ReviewManage /></Suspense>} />
        <Route path="members" element={<Suspense fallback={<AdminFallback />}><MemberList /></Suspense>} />
        <Route path="referrals" element={<Suspense fallback={<AdminFallback />}><ReferralManage /></Suspense>} />
        <Route path="cash" element={<Suspense fallback={<AdminFallback />}><CashManage /></Suspense>} />

        {/* CRM */}
        <Route path="crm" element={<Suspense fallback={<AdminFallback />}><TodoDashboard /></Suspense>} />
        <Route path="crm/customers" element={<Suspense fallback={<AdminFallback />}><CustomerList /></Suspense>} />
        <Route path="crm/customers/:id" element={<Suspense fallback={<AdminFallback />}><CustomerDetail /></Suspense>} />
        <Route path="crm/contracts" element={<Suspense fallback={<AdminFallback />}><ContractList /></Suspense>} />
        <Route path="crm/kpi" element={<Suspense fallback={<AdminFallback />}><KpiDashboard /></Suspense>} />
        <Route path="crm/incentive" element={<Suspense fallback={<AdminFallback />}><Incentive /></Suspense>} />

        {/* CTI */}
        <Route path="cti" element={<Suspense fallback={<AdminFallback />}><CtiConsole /></Suspense>} />
      </Route>
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
