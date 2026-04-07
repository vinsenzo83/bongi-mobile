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

// 마이페이지 (lazy load)
const MyPageLayout = lazy(() => import('./layouts/MyPageLayout.jsx'));
const MyHome = lazy(() => import('./pages/my/Home.jsx'));
const MyProfile = lazy(() => import('./pages/my/Profile.jsx'));
const MyApplications = lazy(() => import('./pages/my/Applications.jsx'));
const MyGifts = lazy(() => import('./pages/my/Gifts.jsx'));
const MyPoints = lazy(() => import('./pages/my/Points.jsx'));
const MyMoneyGuard = lazy(() => import('./pages/my/MoneyGuard.jsx'));
const MyReferral = lazy(() => import('./pages/my/Referral.jsx'));
const MyAlertSettings = lazy(() => import('./pages/my/AlertSettings.jsx'));
const MyVerification = lazy(() => import('./pages/my/Verification.jsx'));
const MyBankAccount = lazy(() => import('./pages/my/BankAccount.jsx'));
const MyAddress = lazy(() => import('./pages/my/Address.jsx'));
const MyReviews = lazy(() => import('./pages/my/Reviews.jsx'));
const MyUsedPhone = lazy(() => import('./pages/my/UsedPhone.jsx'));

// 신청 페이지
const ApplyInternet = lazy(() => import('./pages/ApplyInternet.jsx'));
const ApplyRental = lazy(() => import('./pages/ApplyRental.jsx'));
const ApplyUsedPhone = lazy(() => import('./pages/ApplyUsedPhone.jsx'));
const RentalDetail = lazy(() => import('./pages/RentalDetail.jsx'));

// 어드민 페이지 (lazy load) — wireframe 25개 화면
const Dashboard = lazy(() => import('./pages/admin/Dashboard.jsx'));
const Members = lazy(() => import('./pages/admin/Members.jsx'));
const CarrierProducts = lazy(() => import('./pages/admin/CarrierProducts.jsx'));
const RentalProducts = lazy(() => import('./pages/admin/RentalProducts.jsx'));
const UsedPhones = lazy(() => import('./pages/admin/UsedPhones.jsx'));
const StoreManage = lazy(() => import('./pages/admin/StoreManage.jsx'));
const TicketManage = lazy(() => import('./pages/admin/TicketManage.jsx'));
const Applications = lazy(() => import('./pages/admin/Applications.jsx'));
const UsedPhoneBuyback = lazy(() => import('./pages/admin/UsedPhoneBuyback.jsx'));
const GiftManage = lazy(() => import('./pages/admin/GiftManage.jsx'));
const PointManage = lazy(() => import('./pages/admin/PointManage.jsx'));
const ReviewManage = lazy(() => import('./pages/admin/ReviewManage.jsx'));
const DonJikimi = lazy(() => import('./pages/admin/DonJikimi.jsx'));
const AlertManage = lazy(() => import('./pages/admin/AlertManage.jsx'));
const Statistics = lazy(() => import('./pages/admin/Statistics.jsx'));
const MobilePlans = lazy(() => import('./pages/admin/MobilePlans.jsx'));
const SubsidyData = lazy(() => import('./pages/admin/SubsidyData.jsx'));
const FamilyBundle = lazy(() => import('./pages/admin/FamilyBundle.jsx'));
const GuideManage = lazy(() => import('./pages/admin/GuideManage.jsx'));
const BundleSimulator = lazy(() => import('./pages/admin/BundleSimulator.jsx'));
const CrawlManage = lazy(() => import('./pages/admin/CrawlManage.jsx'));
const FeatureChecklist = lazy(() => import('./pages/admin/FeatureChecklist.jsx'));

const AdminFallback = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: '#999', fontSize: 14 }}>
    로딩 중...
  </div>
);

function W({ C }) {
  return <Suspense fallback={<AdminFallback />}><C /></Suspense>;
}

function AppRoutes() {
  const location = useLocation();

  // ?ref= 파라미터 처리
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

      {/* 신청 페이지 */}
      <Route path="/apply/internet" element={<W C={ApplyInternet} />} />
      <Route path="/apply/rental" element={<W C={ApplyRental} />} />
      <Route path="/apply/used-phone" element={<W C={ApplyUsedPhone} />} />
      <Route path="/product/rental/:ticket" element={<W C={RentalDetail} />} />

      {/* 마이페이지 (와이어프레임 14개 화면) */}
      <Route path="/my" element={<Suspense fallback={<AdminFallback />}><MyPageLayout /></Suspense>}>
        <Route index element={<W C={MyHome} />} />
        <Route path="profile" element={<W C={MyProfile} />} />
        <Route path="applications" element={<W C={MyApplications} />} />
        <Route path="gifts" element={<W C={MyGifts} />} />
        <Route path="points" element={<W C={MyPoints} />} />
        <Route path="guard" element={<W C={MyMoneyGuard} />} />
        <Route path="referral" element={<W C={MyReferral} />} />
        <Route path="alerts" element={<W C={MyAlertSettings} />} />
        <Route path="verification" element={<W C={MyVerification} />} />
        <Route path="account" element={<W C={MyBankAccount} />} />
        <Route path="address" element={<W C={MyAddress} />} />
        <Route path="reviews" element={<W C={MyReviews} />} />
        <Route path="used-phone" element={<W C={MyUsedPhone} />} />
      </Route>

      {/* 어드민 (25개 화면) */}
      <Route path="/admin" element={<AdminLayout />}>
        {/* 01. 대시보드 */}
        <Route index element={<W C={Dashboard} />} />
        {/* 02. 회원 관리 */}
        <Route path="members" element={<W C={Members} />} />
        {/* 03-05. 통신사별 상품 */}
        <Route path="products/:carrier" element={<W C={CarrierProducts} />} />
        {/* 06. 렌탈 상품 */}
        <Route path="rental" element={<W C={RentalProducts} />} />
        {/* 07. 중고폰 매입 */}
        <Route path="used-phones" element={<W C={UsedPhones} />} />
        {/* 08. 매장·시세 */}
        <Route path="stores" element={<W C={StoreManage} />} />
        {/* 09. 티켓 관리 */}
        <Route path="tickets" element={<W C={TicketManage} />} />
        {/* 10. 신청 현황 */}
        <Route path="applications" element={<W C={Applications} />} />
        {/* 11. 중고폰 매입 현황 */}
        <Route path="buyback" element={<W C={UsedPhoneBuyback} />} />
        {/* 12. 사은품 관리 */}
        <Route path="gifts" element={<W C={GiftManage} />} />
        {/* 13. 포인트 관리 */}
        <Route path="points" element={<W C={PointManage} />} />
        {/* 14. 후기 관리 */}
        <Route path="reviews" element={<W C={ReviewManage} />} />
        {/* 15. 돈지키미 */}
        <Route path="donjikimi" element={<W C={DonJikimi} />} />
        {/* 16. 알림 관리 */}
        <Route path="alerts" element={<W C={AlertManage} />} />
        {/* 17. 통계 */}
        <Route path="statistics" element={<W C={Statistics} />} />
        {/* 18. 모바일 요금제 (AI) */}
        <Route path="ai/mobile-plans" element={<W C={MobilePlans} />} />
        {/* 19. 공시지원금 (AI) */}
        <Route path="ai/subsidy" element={<W C={SubsidyData} />} />
        {/* 20. 가족결합 (AI) */}
        <Route path="ai/family-bundle" element={<W C={FamilyBundle} />} />
        {/* 21. 가이드 (AI) */}
        <Route path="ai/guides" element={<W C={GuideManage} />} />
        {/* 22. 결합할인 시뮬레이터 */}
        <Route path="simulator" element={<W C={BundleSimulator} />} />
        {/* 23. 크롤링 관리 */}
        <Route path="crawling" element={<W C={CrawlManage} />} />
        {/* 24. 기능 체크리스트 */}
        <Route path="checklist" element={<W C={FeatureChecklist} />} />
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
