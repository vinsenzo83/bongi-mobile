import { Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth.jsx';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Home from './pages/Home.jsx';
import Products from './pages/Products.jsx';
import ProductDetail from './pages/ProductDetail.jsx';
import Stores from './pages/Stores.jsx';
import Apply from './pages/Apply.jsx';
import AiChat from './pages/AiChat.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import MyPage from './pages/MyPage.jsx';
import Dashboard from './pages/admin/Dashboard.jsx';
import CustomerDetail from './pages/admin/CustomerDetail.jsx';
import Incentive from './pages/admin/Incentive.jsx';

function AppRoutes() {
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith('/admin');
  const isChat = pathname === '/chat';

  return (
    <>
      {!isAdmin && !isChat && <Header />}
      <main style={{ minHeight: isChat ? '100vh' : 'calc(100vh - 140px)' }}>
        <Routes>
          {/* 공개 */}
          <Route path="/" element={<Home />} />
          <Route path="/products/:category" element={<Products />} />
          <Route path="/product/:ticket" element={<ProductDetail />} />
          <Route path="/stores" element={<Stores />} />
          <Route path="/apply" element={<Apply />} />
          <Route path="/apply/:type" element={<Apply />} />
          <Route path="/chat" element={<AiChat />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* 로그인 필요 */}
          <Route path="/mypage" element={<ProtectedRoute><MyPage /></ProtectedRoute>} />

          {/* CRM 어드민 (agent 이상) */}
          <Route path="/admin" element={<ProtectedRoute minRole="agent"><Dashboard /></ProtectedRoute>} />
          <Route path="/admin/customer/:id" element={<ProtectedRoute minRole="agent"><CustomerDetail /></ProtectedRoute>} />
          <Route path="/admin/incentive" element={<ProtectedRoute minRole="agent"><Incentive /></ProtectedRoute>} />
        </Routes>
      </main>
      {!isAdmin && !isChat && <Footer />}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
