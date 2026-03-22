# 봉이모바일 Phase 1 아키텍처 설계서

> 작성일: 2026-03-22
> 작성: architect 에이전트
> 범위: 회원 시스템 프론트엔드 + CRM React 전환 + 상태관리

---

## 1. 현재 상태 요약

| 영역 | 상태 | 비고 |
|------|------|------|
| JWT 미들웨어 | 구현 완료 | `server/middleware/auth.js` |
| RBAC 6역할 | 구현 완료 | `server/middleware/rbac.js` |
| Auth API | 구현 완료 | `server/routes/auth.js` (signup/login/me) |
| 프론트엔드 인증 | **미구현** | AuthContext, ProtectedRoute 없음 |
| api.js 토큰 주입 | **미구현** | 현재 헤더에 토큰 없이 요청 |
| 어드민 CRM | HTML 13K줄 31화면 | `server/public/admin/index.html` |
| React CRM | 3화면만 존재 | Dashboard, CustomerDetail, Incentive |

---

## 2. 회원 시스템 프론트엔드 구조

### 2.1 신규 파일 목록

```
client/src/
├── contexts/
│   └── AuthContext.jsx          # 인증 상태 관리 (로그인/로그아웃/토큰 갱신)
├── components/
│   └── ProtectedRoute.jsx       # 인증 필요 라우트 가드
├── pages/
│   ├── Login.jsx                # 로그인 페이지
│   ├── Signup.jsx               # 회원가입 페이지
│   └── MyPage.jsx               # 마이페이지 (신청 내역, 계약 상태, 내 정보)
└── utils/
    └── api.js                   # 토큰 자동 주입 추가 (기존 파일 수정)
```

### 2.2 AuthContext 설계

```jsx
// client/src/contexts/AuthContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);       // { id, email, role, displayName }
  const [token, setToken] = useState(null);      // access_token
  const [loading, setLoading] = useState(true);  // 초기 로딩 (토큰 복원 중)

  // 앱 시작 시 저장된 토큰으로 사용자 정보 복원
  useEffect(() => {
    const saved = sessionStorage.getItem('bongi_token');
    if (saved) {
      setToken(saved);
      fetchMe(saved).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // /api/auth/me 호출로 사용자 정보 갱신
  async function fetchMe(accessToken) {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const { user } = await res.json();
        setUser(user);
      } else {
        // 토큰 만료 또는 무효
        logout();
      }
    } catch {
      logout();
    }
  }

  // 로그인
  async function login(email, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    setToken(data.access_token);
    setUser(data.user);
    sessionStorage.setItem('bongi_token', data.access_token);
    return data.user;
  }

  // 회원가입
  async function signup(email, password, name, phone) {
    const res = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name, phone }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    // Supabase 이메일 검증이 활성화된 경우 session이 null일 수 있음
    if (data.session?.access_token) {
      setToken(data.session.access_token);
      setUser(data.user);
      sessionStorage.setItem('bongi_token', data.session.access_token);
    }
    return data;
  }

  // 로그아웃
  function logout() {
    setUser(null);
    setToken(null);
    sessionStorage.removeItem('bongi_token');
  }

  // 토큰 getter (api.js에서 사용)
  const getToken = useCallback(() => token, [token]);

  return (
    <AuthContext.Provider value={{
      user, token, loading,
      login, signup, logout, getToken,
      isAuthenticated: !!user,
      isAdmin: user && user.role !== 'customer',
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

**핵심 설계 결정:**

| 결정 | 이유 |
|------|------|
| `sessionStorage` 사용 | `localStorage`보다 안전 (탭 닫으면 삭제). Supabase SDK 직접 사용 대신 서버 경유 방식이므로 자체 관리 |
| 서버 경유 인증 | 클라이언트에 Supabase SDK를 넣지 않고 `POST /api/auth/login` 경유. 서버에서 토큰+프로필을 한번에 반환 |
| `fetchMe`로 복원 | 새로고침 시 `GET /api/auth/me`로 토큰 유효성 검증 + 사용자 정보 복원 |
| Refresh Token 미사용 (1단계) | 현재 서버 API에 refresh 엔드포인트 없음. 세션 만료 시 재로그인. Phase 2에서 자동 갱신 추가 |

### 2.3 ProtectedRoute 설계

```jsx
// client/src/components/ProtectedRoute.jsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children, requiredRole }) {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) return <div className="loading-screen">로딩 중...</div>;

  // 미인증 → 로그인 페이지로 (원래 가려던 경로 저장)
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // 역할 확인 (requiredRole이 지정된 경우)
  if (requiredRole) {
    const ROLE_LEVEL = { customer: 0, agent: 1, manager: 2, owner: 3, ops: 3, super: 4 };
    const userLevel = ROLE_LEVEL[user.role] || 0;
    const requiredLevel = ROLE_LEVEL[requiredRole] || 0;
    if (userLevel < requiredLevel) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
}
```

### 2.4 api.js 토큰 자동 주입

```javascript
// client/src/utils/api.js — 수정 사항

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api';

// 토큰 getter를 외부에서 주입받는 패턴
let _getToken = () => null;
export function setTokenGetter(fn) { _getToken = fn; }

async function request(path, options = {}) {
  const token = _getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    headers,
    ...options,
    // options.headers가 있으면 merge
    headers: { ...headers, ...(options.headers || {}) },
  });

  if (res.status === 401) {
    // 토큰 만료 — 로그아웃 트리거
    sessionStorage.removeItem('bongi_token');
    window.dispatchEvent(new Event('auth:expired'));
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || '요청 실패');
  }
  return res.json();
}

// ... 기존 api 객체에 auth 추가
export const api = {
  // 기존 상품/CRM/CTI/AI 그대로 유지
  // ...

  // 인증 (AuthContext에서 직접 fetch하므로 보조용)
  auth: {
    me: () => request('/auth/me'),
  },

  // 마이페이지
  mypage: {
    getApplications: () => request('/mypage/applications'),
    getContracts: () => request('/mypage/contracts'),
    getProfile: () => request('/mypage/profile'),
    updateProfile: (data) => request('/mypage/profile', {
      method: 'PATCH', body: JSON.stringify(data),
    }),
  },
};
```

**토큰 주입 연결 (main.jsx 또는 App.jsx):**
```jsx
// AuthProvider 내부에서 setTokenGetter 호출
useEffect(() => {
  setTokenGetter(() => token);
}, [token]);
```

### 2.5 라우팅 구조 (App.jsx 변경)

```jsx
// client/src/App.jsx — 변경 후
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import MyPage from './pages/MyPage';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* 공개 페이지 */}
        <Route path="/" element={<Home />} />
        <Route path="/products/:category" element={<Products />} />
        <Route path="/product/:ticket" element={<ProductDetail />} />
        <Route path="/stores" element={<Stores />} />
        <Route path="/apply" element={<Apply />} />
        <Route path="/apply/:type" element={<Apply />} />
        <Route path="/chat" element={<AiChat />} />

        {/* 인증 페이지 */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* 고객 전용 (customer 이상) */}
        <Route path="/mypage" element={
          <ProtectedRoute><MyPage /></ProtectedRoute>
        } />

        {/* 어드민 CRM (agent 이상) */}
        <Route path="/admin/*" element={
          <ProtectedRoute requiredRole="agent">
            <AdminLayout />
          </ProtectedRoute>
        } />
      </Routes>
    </AuthProvider>
  );
}
```

### 2.6 페이지 구조

**Login.jsx:**
- 이메일 + 비밀번호 입력
- 로그인 성공 시: `state.from`으로 리다이렉트 (없으면 `/`)
- 어드민 사용자(agent 이상)는 `/admin`으로 리다이렉트
- 회원가입 링크

**Signup.jsx:**
- 이메일 + 비밀번호 + 이름 + 전화번호
- 이메일 검증 안내 (Supabase 설정에 따라)
- 가입 성공 시 로그인 페이지로

**MyPage.jsx (탭 구조):**
- 탭 1: 내 신청 내역 (`/mypage/applications`)
- 탭 2: 계약 진행 상태 (`/mypage/contracts`)
- 탭 3: 내 정보 수정 (`/mypage/profile`)

---

## 3. CRM React 전환 전략

### 3.1 현재 어드민 HTML 분석

| 항목 | 값 |
|------|------|
| 총 줄 수 | 13,167줄 |
| 화면 수 | 31개 (adm-home + adm001~adm033, 일부 번호 결번) |
| 네비게이션 | 3개 섹션 (콜센터 CRM, 플랫폼 관리, 대시보드) |
| RBAC | `data-roles` 속성으로 UI 표시/숨김 (클라이언트 전용) |
| 데이터 | Mock API (`/api/mock/*`) + 인라인 데이터 |

### 3.2 화면 목록 및 전환 우선순위

#### Phase 1-3: 핵심 5화면 (1주차)

| # | 화면 ID | 화면명 | 역할 | React 파일 | 이유 |
|---|---------|--------|------|-----------|------|
| 1 | adm-home | 오늘 할 일 | agent+ | `TodoDashboard.jsx` | 상담사 첫 화면, 업무 허브 |
| 2 | adm001 | 통합 고객 리스트 | agent+ | `CustomerList.jsx` | CRM 핵심, 이미 API 존재 |
| 3 | adm002 | CTI 상담 | agent+ | `CTIConsole.jsx` | 핵심 업무 화면 |
| 4 | adm005 | 계약 관리 | agent+ | `ContractList.jsx` | 계약 CRUD 필요 |
| 5 | adm006 | KPI 대시보드 | manager+ | `KPIDashboard.jsx` | 기존 React Dashboard.jsx 확장 |

#### Phase 2-4: 나머지 화면 (4주차)

| 그룹 | 화면 | 화면명 |
|------|------|--------|
| 상담 업무 | adm003, adm004, adm007, adm009, adm014 | 해피콜큐, 티켓칸반, 상담사배정, VOC, 사은품지급 |
| 정산 | adm015, adm029~033 | 수수료, 상품이력, 사은품관리, 리베이트, 인센티브, 정책등록 |
| 플랫폼 관리 | adm012~013, adm016~021 | CMS, 배너, 이벤트, 공지, FAQ, 콘텐츠, Q&A, 후기, 회원 |
| 대시보드 | adm022~028 | 친구초대, AI어시스턴트, 통화AI, LTV, O2O |
| CRM 알림 | adm008, adm011 | 알림설정, 발송이력 |

### 3.3 컴포넌트 분리 전략

#### 레이어 구조

```
client/src/
├── pages/admin/                    # 페이지 (라우트 단위)
│   ├── TodoDashboard.jsx           # 오늘 할 일
│   ├── CustomerList.jsx            # 고객 리스트 + 필터/검색
│   ├── CustomerDetail.jsx          # 고객 상세 (기존)
│   ├── CTIConsole.jsx              # CTI 상담 화면
│   ├── ContractList.jsx            # 계약 목록
│   ├── KPIDashboard.jsx            # KPI 대시보드 (기존 Dashboard.jsx 리네임)
│   └── Incentive.jsx               # 인센티브 (기존)
│
├── components/admin/               # 어드민 전용 공통 컴포넌트
│   ├── AdminLayout.jsx             # 사이드바 + 탑바 + 콘텐츠 레이아웃
│   ├── Sidebar.jsx                 # 사이드바 네비게이션
│   ├── Topbar.jsx                  # 탑바 (검색, 알림, 프로필)
│   ├── KPICard.jsx                 # KPI 카드 (숫자 + 라벨 + 트렌드)
│   ├── DataTable.jsx               # 범용 데이터 테이블 (정렬/페이징/필터)
│   ├── StatusBadge.jsx             # 상태 배지 (색상 매핑)
│   ├── SearchFilter.jsx            # 검색 + 필터 바
│   └── Modal.jsx                   # 공통 모달
│
├── components/                     # 고객+어드민 공통
│   ├── Header.jsx                  # (기존)
│   ├── Footer.jsx                  # (기존)
│   ├── CTIPanel.jsx                # (기존)
│   └── ProtectedRoute.jsx          # (신규)
│
└── contexts/
    ├── AuthContext.jsx              # (신규) 인증 상태
    └── AdminContext.jsx             # (신규) 어드민 상태 (사이드바 토글 등)
```

#### 컴포넌트 분리 원칙

1. **페이지 = 라우트 단위**: 하나의 URL에 하나의 페이지 컴포넌트
2. **공통 컴포넌트 추출 기준**: 2곳 이상에서 사용되는 UI 패턴만 추출 (KPICard, DataTable, StatusBadge)
3. **HTML 목업 1:1 대응하지 않음**: 목업의 UI/UX를 참고하되, React 컴포넌트 구조는 재설계
4. **데이터 로딩은 페이지에서**: 페이지 컴포넌트가 API 호출, 하위 컴포넌트는 props로 데이터 수신

### 3.4 어드민 전용 라우팅

```jsx
// client/src/pages/admin/AdminLayout.jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from '../../components/admin/Sidebar';
import Topbar from '../../components/admin/Topbar';

export default function AdminLayout() {
  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar />
        <main style={{ flex: 1, overflow: 'auto', padding: '20px', background: '#0F1117' }}>
          <Routes>
            <Route index element={<TodoDashboard />} />
            <Route path="customers" element={<CustomerList />} />
            <Route path="customers/:id" element={<CustomerDetail />} />
            <Route path="cti" element={<CTIConsole />} />
            <Route path="contracts" element={<ContractList />} />
            <Route path="dashboard" element={<KPIDashboard />} />
            <Route path="incentive" element={<Incentive />} />
            {/* Phase 2에서 추가 */}
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
```

**URL 매핑:**

| 기존 (HTML) | 신규 (React) | 화면 |
|-------------|-------------|------|
| `show('adm-home')` | `/admin` | 오늘 할 일 |
| `show('adm001')` | `/admin/customers` | 고객 리스트 |
| 고객 클릭 | `/admin/customers/:id` | 고객 상세 |
| `show('adm002')` | `/admin/cti` | CTI 상담 |
| `show('adm005')` | `/admin/contracts` | 계약 관리 |
| `show('adm006')` | `/admin/dashboard` | KPI 대시보드 |
| `show('adm015')` | `/admin/incentive` | 인센티브 |

### 3.5 AdminLayout 설계 (사이드바 + 탑바 + 콘텐츠)

```
┌──────────────────────────────────────────────────────────────┐
│                      AdminLayout                              │
│ ┌────────────┬──────────────────────────────────────────────┐│
│ │            │  Topbar                                       ││
│ │            │  [현재화면명] [검색] [알림🔔] [프로필 ▼]       ││
│ │  Sidebar   ├──────────────────────────────────────────────┤│
│ │            │                                               ││
│ │  [로고]    │  Content Area                                 ││
│ │  [상담원]  │  (React Router Outlet)                        ││
│ │            │                                               ││
│ │  CRM       │  - TodoDashboard                              ││
│ │  ├ 고객    │  - CustomerList                               ││
│ │  ├ CTI     │  - CustomerDetail                             ││
│ │  ├ 계약    │  - CTIConsole                                 ││
│ │  ├ ...     │  - ContractList                               ││
│ │            │  - KPIDashboard                               ││
│ │  플랫폼   │  - Incentive                                  ││
│ │  ├ CMS    │                                               ││
│ │  ├ ...    │                                               ││
│ │            │                                               ││
│ │  대시보드 │                                               ││
│ │  ├ KPI    │                                               ││
│ │  ├ ...    │                                               ││
│ └────────────┴──────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

**Sidebar 동작:**
- 너비: 230px (HTML 목업과 동일)
- 네비게이션 항목은 `useAuth()`의 `user.role`로 RBAC 필터링
- 현재 라우트와 매칭되는 항목 active 표시
- 섹션 접기/펼치기 지원

**Topbar 동작:**
- 현재 화면명 자동 표시
- 로그인한 상담원 정보 (이름 + 역할)
- 로그아웃 버튼

### 3.6 어드민 CSS 전략

**HTML 목업의 CSS 변수 재사용:**

```css
/* client/src/styles/admin.css — HTML 목업의 :root 변수를 그대로 가져옴 */
:root {
  --bg: #0F1117;
  --sidebar: #161B27;
  --card: #1E2536;
  --card2: #242A3B;
  --border: #2D3548;
  --blue: #3B82F6;
  --blue2: #1D4ED8;
  --teal: #14B8A6;
  --green: #22C55E;
  --amber: #F59E0B;
  --red: #EF4444;
  --purple: #A78BFA;
  --t1: #F1F5F9;
  --t2: #94A3B8;
  --t3: #475569;
}
```

- 어드민은 다크 테마 유지 (HTML 목업과 동일한 색상 체계)
- 고객 사이트는 별도 스타일 (현재 global.css)
- 어드민 전용 CSS는 `admin.css`로 분리, AdminLayout에서만 import

---

## 4. 상태관리 방법

### 4.1 선택: Context API + useReducer

| 옵션 | 장점 | 단점 | 판정 |
|------|------|------|------|
| **Context API** | 의존성 없음, React 내장, 러닝커브 0 | 대규모 상태에서 리렌더링 이슈 | **채택** |
| Zustand | 가볍고 직관적 | 추가 의존성, 현재 규모에 불필요 | 보류 |
| Redux Toolkit | 강력한 devtools, 미들웨어 | 보일러플레이트 과다, 현재 규모에 과잉 | 불채택 |

**결정 근거:**
- 현재 전역 상태는 `auth` (사용자 정보)와 `admin` (사이드바 상태) 뿐
- CRM 데이터(고객, 계약 등)는 서버 상태 → 페이지 로컬 `useState`로 충분
- 복잡해지면 Zustand로 마이그레이션 용이 (Context API와 API 유사)

### 4.2 Context 분리

```
AuthContext    — 인증 상태 (user, token, login/logout)
                 사용처: 전체 앱 (고객 + 어드민)

AdminContext   — 어드민 UI 상태 (사이드바 열림/닫힘, 현재 화면명)
                 사용처: AdminLayout 하위만
```

### 4.3 어드민과 고객 사이트 분리

**같은 React 앱, 라우트로 분리:**

```
/                    → 고객 사이트 (Header + Footer)
/login, /signup      → 인증 (공통)
/mypage              → 고객 마이페이지
/admin/*             → 어드민 CRM (AdminLayout)
```

| 영역 | 레이아웃 | 인증 | 스타일 |
|------|---------|------|--------|
| 고객 사이트 | Header + Footer | 선택적 | global.css (밝은 테마) |
| 인증 페이지 | 없음 (센터 카드) | 불필요 | global.css |
| 마이페이지 | Header + Footer | 필수 (customer+) | global.css |
| 어드민 CRM | Sidebar + Topbar | 필수 (agent+) | admin.css (다크 테마) |

**코드 스플리팅 (React.lazy):**
```jsx
// 어드민 번들 분리 — 고객 사이트 방문자는 어드민 코드 다운로드하지 않음
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
```

---

## 5. 서버 API 추가 사항

### 5.1 마이페이지 API (신규)

```javascript
// server/routes/mypage.js (신규)
router.get('/applications', authenticateJWT, async (req, res) => {
  // req.user.id로 본인 신청 내역 조회
  // bongi_applications에서 auth_user_id 또는 email 매칭
});

router.get('/contracts', authenticateJWT, async (req, res) => {
  // 본인 계약 진행 상태 조회
});

router.get('/profile', authenticateJWT, async (req, res) => {
  // bongi_user_profiles + bongi_customers에서 본인 정보
});

router.patch('/profile', authenticateJWT, async (req, res) => {
  // 이름, 전화번호 수정 (이메일은 불가)
});
```

### 5.2 Refresh Token 엔드포인트 (Phase 2)

```javascript
// server/routes/auth.js에 추가 예정
router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body;
  const { data, error } = await supabase.auth.refreshSession({ refresh_token });
  // 새 access_token 반환
});
```

### 5.3 server/index.js 라우트 등록

```javascript
// 기존 라우트에 추가
import mypageRoutes from './routes/mypage.js';

app.use('/api/mypage', authenticateJWT, mypageRoutes);
```

---

## 6. Supabase 이메일 검증 이슈

현재 Supabase 대시보드에서 이메일 검증 설정이 필요한 상태.

**권장 설정 (개발 단계):**
1. Supabase Dashboard > Authentication > Providers > Email
2. "Confirm email" 비활성화 (개발 중에는 즉시 로그인 가능하게)
3. 운영 배포 시 다시 활성화

**또는 `server/routes/auth.js`의 signup에서:**
```javascript
// emailRedirectTo 설정으로 검증 후 리다이렉트 URL 지정
options: {
  data: { display_name: name, role: 'customer' },
  emailRedirectTo: `${process.env.CLIENT_URL}/login?verified=true`,
}
```

---

## 7. 구현 순서 (Phase 1 세부)

### Week 1: 회원 시스템 프론트엔드

| 순서 | 작업 | 파일 |
|------|------|------|
| 1 | AuthContext 구현 | `contexts/AuthContext.jsx` |
| 2 | api.js 토큰 주입 수정 | `utils/api.js` |
| 3 | ProtectedRoute 구현 | `components/ProtectedRoute.jsx` |
| 4 | Login 페이지 | `pages/Login.jsx` |
| 5 | Signup 페이지 | `pages/Signup.jsx` |
| 6 | MyPage 페이지 | `pages/MyPage.jsx` |
| 7 | 서버 mypage 라우트 | `server/routes/mypage.js` |
| 8 | App.jsx 라우팅 수정 | `App.jsx` |
| 9 | Header에 로그인/마이페이지 링크 추가 | `components/Header.jsx` |

### Week 4: CRM 핵심 5화면 React 전환

| 순서 | 작업 | 파일 |
|------|------|------|
| 1 | AdminLayout (사이드바+탑바) | `pages/admin/AdminLayout.jsx`, `components/admin/Sidebar.jsx`, `components/admin/Topbar.jsx` |
| 2 | 공통 컴포넌트 | `KPICard.jsx`, `DataTable.jsx`, `StatusBadge.jsx` |
| 3 | TodoDashboard (오늘 할 일) | `pages/admin/TodoDashboard.jsx` |
| 4 | CustomerList (고객 리스트) | `pages/admin/CustomerList.jsx` |
| 5 | CTIConsole (CTI 상담) | `pages/admin/CTIConsole.jsx` |
| 6 | ContractList (계약 관리) | `pages/admin/ContractList.jsx` |
| 7 | KPIDashboard 확장 | `pages/admin/KPIDashboard.jsx` |
| 8 | App.jsx에 어드민 라우트 통합 | `App.jsx` |

---

## 8. HTML 목업과의 공존 전략

React 전환 완료 전까지 HTML 목업(`/admin`)과 React CRM(`/admin-v2` 또는 `localhost:5173/admin`)이 공존해야 함.

**전략: 병렬 운영**

```
http://localhost:3001/admin       → HTML 목업 (기존, 변경 없음)
http://localhost:5173/admin       → React CRM (신규, Vite 개발 서버)
```

- HTML 목업은 그대로 유지 — 레퍼런스 + 전환 전 화면 확인용
- React CRM은 Vite 클라이언트에서 `/admin/*` 라우트로 서빙
- API는 동일한 Express 서버(`localhost:3001`)를 공유 (Vite 프록시)
- 핵심 5화면 전환 완료 후 HTML 목업에서 해당 화면 링크를 React로 리다이렉트
- 모든 화면 전환 완료 시 HTML 목업 제거

---

## 9. 의존성 추가

```json
// client/package.json — 추가 필요 없음
// react-router-dom은 이미 설치됨
// Context API는 React 내장
// 추가 라이브러리 불필요
```

Phase 1에서는 추가 npm 패키지 없이 진행 가능.

---

## 10. 위험 요소 및 대응

| 위험 | 영향 | 대응 |
|------|------|------|
| Supabase 이메일 검증 활성화 상태 | 회원가입 후 로그인 불가 | 대시보드에서 비활성화 또는 수동 검증 |
| access_token 1시간 만료 | CRM 사용 중 세션 끊김 | Phase 2에서 refresh token 자동 갱신. 1단계는 재로그인 |
| HTML 목업 ↔ React 동시 운영 혼란 | 어떤 URL이 최신인지 혼동 | 명확한 URL 분리 (포트 구분) |
| CRM 화면 31개 전환 부담 | 일정 지연 | 핵심 5화면만 Phase 1, 나머지는 Phase 2 |
| RBAC owner와 ops 역할 레벨 동일(3) | 접근 범위 구분 안 됨 | `requireRole`로 명시적 역할 지정 (레벨 비교 대신) |
