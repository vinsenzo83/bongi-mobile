# 리턴AI 인증 구조 설계서

## 1. 현재 상태 분석

### 1.1 보안 취약점
- **모든 API 엔드포인트 공개** — 인증/인가 없이 누구나 접근 가능
- **CRM API 무방비** — `/api/crm/*` (고객 목록, 상담기록, 계약 등) 인증 없음
- **CTI API 무방비** — `/api/cti/*` (전화 발신/제어) 인증 없음
- **AI API 무방비** — `/api/ai/*` (Claude API 호출) 비용 발생 가능
- **어드민 RBAC가 프론트엔드 전용** — `rbac_switch()` 함수가 클라이언트에서만 UI를 숨김/표시, 서버 검증 전무
- **Supabase SERVICE_KEY 사용** — `server/db/supabase.js`에서 `SUPABASE_SERVICE_KEY`를 우선 사용하여 RLS 우회

### 1.2 현재 DB 구조 (bongi_ 테이블)
| 테이블 | 용도 | RLS | 행수 |
|--------|------|-----|------|
| `bongi_customers` | 고객 정보 | 활성화 (정책 미확인) | 8 |
| `bongi_agents` | 상담사 정보 | 활성화 | 4 |
| `bongi_consultations` | 상담 기록 | 활성화 | 0 |
| `bongi_contracts` | 계약 정보 | 활성화 | 0 |
| `bongi_applications` | 신청 접수 | 활성화 | 2 |
| `bongi_agent_performance` | 상담사 실적 | 활성화 | 0 |

### 1.3 현재 어드민 RBAC 역할 (프론트 전용)
```
super   → 모든 33개 화면
manager → 16개 화면
agent   → 9개 화면
owner   → 3개 화면 (매장 관련)
ops     → 정의되어 있으나 screens 목록 누락
```

---

## 2. 인증 아키텍처 설계

### 2.1 인증 방식: Supabase Auth (JWT)

```
┌─────────────────────────────────────────────────────────────────┐
│                       클라이언트                                  │
│                                                                   │
│  [고객 웹사이트]           [어드민 CRM]                            │
│  - Supabase Auth SDK       - Supabase Auth SDK                   │
│  - access_token 저장       - access_token 저장                   │
│  - Authorization header    - Authorization header                │
└──────────────┬──────────────────────────┬────────────────────────┘
               │ Bearer <JWT>             │ Bearer <JWT>
               ▼                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Express 서버                                │
│                                                                   │
│  ┌──────────────┐  ┌────────────────┐  ┌─────────────────────┐  │
│  │ sanitizeBody │→│ authenticateJWT │→│ requireRole(roles) │  │
│  └──────────────┘  └────────────────┘  └─────────────────────┘  │
│         │                  │                      │               │
│         │           JWT 검증 실패 → 401      역할 불일치 → 403    │
│         │           JWT 검증 성공 → req.user   역할 일치 → next() │
│         ▼                  ▼                      ▼               │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    라우트 핸들러                              │ │
│  │  req.user = { id, email, role, store_id, ... }              │ │
│  └─────────────────────────────────────────────────────────────┘ │
│         │                                                        │
│         ▼ Supabase 클라이언트 (서비스별 분리)                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ adminSupabase (SERVICE_KEY) — 관리 작업 전용               │   │
│  │ userSupabase(jwt)           — RLS 적용 쿼리                │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 역할(Role) 체계

| 역할 | 대상 | 접근 범위 |
|------|------|-----------|
| `customer` | 웹사이트 가입 고객 | 마이페이지, 신청 내역, AI 채팅 |
| `agent` | 상담사 | CRM 기본 (고객관리, 상담, 통화, AI추천) |
| `manager` | 팀장 | agent + 실적관리, 배정, 리포트 |
| `owner` | 매장 사업주 | 매장별 실적, 정산 |
| `ops` | 운영팀 | 시스템 모니터링, 로그, 설정 |
| `super` | 슈퍼어드민 | 전체 접근 |

### 2.3 역할 저장 위치

역할은 `auth.users.raw_app_meta_data.role`에 저장합니다. Supabase Auth의 JWT에 자동으로 포함됩니다.

```sql
-- JWT에서 역할 추출 예시
auth.jwt() ->> 'role'                          -- Supabase 기본 role (anon/authenticated)
auth.jwt() -> 'app_metadata' ->> 'role'        -- 커스텀 앱 역할 (bongi 역할)
```

---

## 3. DB 스키마 변경 사항

### 3.1 새 테이블: `bongi_user_profiles`

```sql
CREATE TABLE bongi_user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'customer'
    CHECK (role IN ('customer', 'agent', 'manager', 'owner', 'ops', 'super')),
  display_name TEXT,
  phone TEXT,
  store_id INTEGER,           -- 소속 매장 (agent, manager, owner)
  agent_id UUID REFERENCES bongi_agents(id),  -- agent/manager인 경우 bongi_agents 연결
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_user_profiles_role ON bongi_user_profiles(role);
CREATE INDEX idx_user_profiles_store ON bongi_user_profiles(store_id);
```

### 3.2 기존 테이블 변경

**bongi_agents** — `auth_user_id` 칼럼 추가:
```sql
ALTER TABLE bongi_agents
  ADD COLUMN auth_user_id UUID UNIQUE REFERENCES auth.users(id);
```

**bongi_customers** — `auth_user_id` 칼럼 추가 (선택적, 가입한 고객만):
```sql
ALTER TABLE bongi_customers
  ADD COLUMN auth_user_id UUID UNIQUE REFERENCES auth.users(id);
```

### 3.3 RLS 정책 설계

```sql
-- bongi_customers: 고객은 자기 정보만, agent 이상은 전체
CREATE POLICY "customers_select" ON bongi_customers FOR SELECT USING (
  auth.jwt() -> 'app_metadata' ->> 'role' IN ('agent', 'manager', 'owner', 'ops', 'super')
  OR auth_user_id = auth.uid()
);

CREATE POLICY "customers_update" ON bongi_customers FOR UPDATE USING (
  auth.jwt() -> 'app_metadata' ->> 'role' IN ('agent', 'manager', 'super')
);

-- bongi_consultations: agent는 자기 상담만, manager 이상은 전체
CREATE POLICY "consultations_select" ON bongi_consultations FOR SELECT USING (
  auth.jwt() -> 'app_metadata' ->> 'role' IN ('manager', 'super')
  OR agent_id = (SELECT agent_id FROM bongi_user_profiles WHERE id = auth.uid())
);

-- bongi_contracts: agent는 자기 계약만, manager 이상은 전체
CREATE POLICY "contracts_select" ON bongi_contracts FOR SELECT USING (
  auth.jwt() -> 'app_metadata' ->> 'role' IN ('manager', 'super')
  OR agent_id = (SELECT agent_id FROM bongi_user_profiles WHERE id = auth.uid())
);

-- bongi_applications: 공개 INSERT (비회원 신청), SELECT는 agent 이상
CREATE POLICY "applications_insert" ON bongi_applications FOR INSERT
  WITH CHECK (true);  -- 비회원도 신청 가능

CREATE POLICY "applications_select" ON bongi_applications FOR SELECT USING (
  auth.jwt() -> 'app_metadata' ->> 'role' IN ('agent', 'manager', 'super')
);
```

---

## 4. 서버 미들웨어 설계

### 4.1 파일 구조

```
server/middleware/
├── sanitize.js          # (기존) XSS 방어
├── errorHandler.js      # (기존) 전역 에러 핸들러
├── auth.js              # (신규) JWT 인증 미들웨어
└── rbac.js              # (신규) 역할 기반 접근 제어
```

### 4.2 auth.js — JWT 인증 미들웨어

```javascript
// server/middleware/auth.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

/**
 * JWT 인증 미들웨어
 * Authorization: Bearer <access_token> 헤더에서 토큰 추출 후 Supabase로 검증
 * 성공 시 req.user에 사용자 정보 설정
 */
export function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: '인증 토큰이 필요합니다' });
  }

  const token = authHeader.slice(7);
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  supabase.auth.getUser(token).then(({ data: { user }, error }) => {
    if (error || !user) {
      return res.status(401).json({ error: '유효하지 않은 토큰입니다' });
    }
    req.user = {
      id: user.id,
      email: user.email,
      role: user.app_metadata?.role || 'customer',
      store_id: user.app_metadata?.store_id || null,
    };
    req.supabaseClient = supabase;  // RLS 적용 클라이언트
    next();
  });
}

/**
 * 선택적 인증 — 토큰이 있으면 검증, 없어도 통과
 * 비회원 + 회원 모두 접근 가능한 엔드포인트에 사용
 */
export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  authenticateJWT(req, res, next);
}
```

### 4.3 rbac.js — 역할 기반 접근 제어

```javascript
// server/middleware/rbac.js

// 역할 계층 (숫자가 높을수록 상위)
const ROLE_LEVEL = {
  customer: 1,
  agent: 2,
  manager: 3,
  owner: 3,   // manager와 동급이나 접근 범위 다름
  ops: 4,
  super: 5,
};

/**
 * 특정 역할만 허용
 * @param  {...string} allowedRoles - 허용할 역할 목록
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: '인증이 필요합니다' });
    }
    // super는 항상 통과
    if (req.user.role === 'super') return next();

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }
    next();
  };
}

/**
 * 최소 역할 레벨 이상만 허용
 * @param {string} minRole - 최소 필요 역할
 */
export function requireMinRole(minRole) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: '인증이 필요합니다' });
    }
    const userLevel = ROLE_LEVEL[req.user.role] || 0;
    const minLevel = ROLE_LEVEL[minRole] || 0;
    if (userLevel < minLevel) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }
    next();
  };
}
```

### 4.4 라우트별 미들웨어 적용 설계

```javascript
// server/index.js 변경 후

// 공개 API (인증 불필요)
app.use('/api/products', productRoutes);       // 상품 조회
app.use('/api/stores', storeRoutes);           // 매장 조회
app.use('/api/applications', applicationRoutes); // 신청 접수 (POST)

// 선택적 인증 (비회원/회원 모두)
app.use('/api/ai', optionalAuth, aiRoutes);    // AI 채팅 (rate limit 필요)

// 인증 필수 — 고객 이상
app.use('/api/mypage', authenticateJWT, mypageRoutes);  // (신규) 마이페이지

// 인증 필수 — agent 이상
app.use('/api/crm', authenticateJWT, requireMinRole('agent'), crmRoutes);
app.use('/api/cti', authenticateJWT, requireMinRole('agent'), ctiRoutes);

// 인증 필수 — super만
app.use('/api/admin', authenticateJWT, requireRole('super'), adminRoutes);
```

---

## 5. API 엔드포인트별 접근 제어 매트릭스

| 엔드포인트 | 인증 | customer | agent | manager | owner | ops | super |
|-----------|------|----------|-------|---------|-------|-----|-------|
| `GET /api/products/*` | 불필요 | O | O | O | O | O | O |
| `GET /api/stores` | 불필요 | O | O | O | O | O | O |
| `POST /api/applications` | 불필요 | O | O | O | O | O | O |
| `POST /api/ai/chat` | 선택적 | O | O | O | O | O | O |
| `GET /api/mypage/*` | 필수 | O | - | - | - | - | O |
| `GET /api/crm/customers` | 필수 | - | O | O | - | - | O |
| `PATCH /api/crm/customers/:id` | 필수 | - | O | O | - | - | O |
| `POST /api/crm/consultations` | 필수 | - | O | O | - | - | O |
| `POST /api/crm/contracts` | 필수 | - | O | O | - | - | O |
| `GET /api/crm/agents` | 필수 | - | - | O | - | - | O |
| `GET /api/crm/dashboard/*` | 필수 | - | O | O | O | - | O |
| `POST /api/cti/*` | 필수 | - | O | O | - | - | O |
| `GET /api/crm/incentive/*` | 필수 | - | O | O | O | - | O |
| `GET /api/admin/users` | 필수 | - | - | - | - | - | O |

---

## 6. Supabase Auth 설정

### 6.1 필요 환경변수 (.env 추가)

```env
# 기존
SUPABASE_URL=https://dugaqvvnhsgenhmhuyju.supabase.co
SUPABASE_ANON_KEY=...

# 추가
SUPABASE_SERVICE_KEY=...              # 서비스 키 (admin 작업 전용)
SUPABASE_JWT_SECRET=...               # JWT 검증 (선택: getUser 대신 로컬 검증 시)
```

### 6.2 Supabase 클라이언트 분리 (server/db/supabase.js 변경)

```javascript
// admin용 — SERVICE_KEY 사용, RLS 우회
export const adminSupabase = createClient(supabaseUrl, serviceKey);

// 사용자 요청용 — ANON_KEY + JWT로 RLS 적용
export function createUserClient(accessToken) {
  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
```

### 6.3 회원가입 시 역할 할당 (DB Trigger)

```sql
-- 회원가입 시 bongi_user_profiles 자동 생성
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO bongi_user_profiles (id, role, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_app_meta_data ->> 'role', 'customer'),
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

### 6.4 역할 승격 (super admin만 가능)

```sql
-- 역할 변경 함수 (서버에서 SERVICE_KEY로 호출)
CREATE OR REPLACE FUNCTION set_user_role(target_user_id UUID, new_role TEXT)
RETURNS VOID AS $$
BEGIN
  -- app_metadata에 역할 저장 (JWT에 반영됨)
  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', new_role)
  WHERE id = target_user_id;

  -- profiles 테이블도 동기화
  UPDATE bongi_user_profiles
  SET role = new_role, updated_at = now()
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 7. 프론트엔드 인증 플로우

### 7.1 고객 웹사이트 (React + Vite)

```
┌───────────────────────────────────────────────────────┐
│                   고객 웹사이트 플로우                    │
│                                                         │
│  비회원:                                                │
│  ┌────────┐  ┌──────────┐  ┌────────────┐             │
│  │ 상품조회 │  │ 매장조회  │  │ 신청/상담  │  ← 인증불필요  │
│  └────────┘  └──────────┘  └────────────┘             │
│                                                         │
│  회원가입/로그인:                                        │
│  ┌──────────┐  Supabase Auth  ┌──────────────┐        │
│  │ /login   │ ───────────────→│ 이메일+비밀번호│        │
│  │ /signup  │                 │ 카카오 (향후)  │        │
│  └──────────┘                 └──────────────┘        │
│       │ 로그인 성공                                     │
│       ▼                                                │
│  ┌──────────────────────────────────┐                  │
│  │ /mypage                           │                  │
│  │ - 내 신청 내역                     │  ← 인증 필수     │
│  │ - 계약 진행 상태                   │                  │
│  │ - 내 정보 수정                     │                  │
│  └──────────────────────────────────┘                  │
└───────────────────────────────────────────────────────┘
```

**필요 파일 (신규):**
```
client/src/
├── contexts/AuthContext.jsx     # Supabase Auth 상태 관리
├── components/ProtectedRoute.jsx # 인증 필요 라우트 가드
├── pages/Login.jsx              # 로그인 페이지
├── pages/Signup.jsx             # 회원가입 페이지
└── pages/MyPage.jsx             # 마이페이지
```

**AuthContext 핵심 로직:**
```javascript
// Supabase onAuthStateChange로 세션 감시
// access_token을 api.js의 request()에 자동 주입
// 역할 정보를 user.app_metadata.role에서 추출
```

**api.js 변경 — Authorization 헤더 자동 주입:**
```javascript
async function request(path, options = {}) {
  const session = await supabase.auth.getSession();
  const headers = { 'Content-Type': 'application/json' };
  if (session?.data?.session?.access_token) {
    headers['Authorization'] = `Bearer ${session.data.session.access_token}`;
  }
  // ... 기존 로직
}
```

### 7.2 어드민 CRM (server/public/admin/index.html)

```
┌───────────────────────────────────────────────────────┐
│                  어드민 CRM 플로우                       │
│                                                         │
│  ┌──────────────┐                                      │
│  │ /admin/login │  ← 별도 로그인 페이지                  │
│  │ 이메일+비밀번호│                                      │
│  └──────┬───────┘                                      │
│         │ Supabase Auth 로그인                          │
│         ▼                                               │
│  ┌──────────────┐  역할 확인                            │
│  │ role 검증    │  customer → 접근 거부 (403)            │
│  │ agent 이상?  │  agent 이상 → CRM 진입                │
│  └──────┬───────┘                                      │
│         ▼                                               │
│  ┌──────────────────────────────────────────┐          │
│  │ CRM 메인 (/admin)                        │          │
│  │ - 서버 RBAC: API 호출마다 역할 검증       │          │
│  │ - 클라이언트 RBAC: 기존 rbac_switch()유지 │          │
│  │ - 세션 만료 시 자동 로그아웃              │          │
│  └──────────────────────────────────────────┘          │
└───────────────────────────────────────────────────────┘
```

**어드민 HTML 변경 사항:**
1. 로그인 화면 추가 (CRM 진입 전)
2. `@supabase/supabase-js` CDN으로 로드
3. API 호출 시 Authorization 헤더 추가
4. 기존 `rbac_switch()` 유지하되, 실제 역할은 JWT에서 결정
5. 세션 만료 감지 → 자동 리다이렉트

---

## 8. 구현 순서 (권장)

### Phase 1: 기반 (서버)
1. `bongi_user_profiles` 테이블 생성 + trigger
2. `server/middleware/auth.js` 작성
3. `server/middleware/rbac.js` 작성
4. `server/db/supabase.js` 클라이언트 분리 (admin/user)
5. 테스트 유저 생성 (super, agent 각 1명)

### Phase 2: API 보호
1. CRM 라우트에 `authenticateJWT + requireMinRole('agent')` 적용
2. CTI 라우트에 동일 적용
3. AI 라우트에 `optionalAuth` + rate limit 적용
4. 공개 API는 그대로 유지 (products, stores, applications POST)

### Phase 3: 어드민 CRM 인증
1. admin/login.html 페이지 추가 또는 index.html 내 로그인 섹션
2. Supabase Auth SDK 연동 (CDN)
3. API 호출에 토큰 주입
4. 기존 RBAC UI를 실제 역할로 연동

### Phase 4: 고객 웹사이트 인증
1. AuthContext + ProtectedRoute 구현
2. Login/Signup 페이지
3. MyPage (신청 내역, 계약 상태)
4. api.js에 토큰 자동 주입

### Phase 5: RLS 강화
1. 기존 RLS 정책 점검 및 역할 기반 재설정
2. SERVICE_KEY 사용 최소화 (admin 작업만)
3. 사용자 요청은 createUserClient(jwt)로 RLS 적용

---

## 9. 보안 고려사항

1. **토큰 저장**: `localStorage`에 저장 금지, Supabase SDK의 내장 세션 관리 사용
2. **CORS**: 운영 환경에서 origin 엄격 제한 (현재 설정 유지)
3. **Rate Limiting**: AI 채팅 엔드포인트에 rate limit 필수 (비인증 사용자 특히)
4. **SERVICE_KEY 보호**: 클라이언트에 절대 노출 금지, 서버 환경변수로만 관리
5. **감사 로그**: 역할 변경, 로그인 실패 등 보안 이벤트 기록
6. **세션 만료**: access_token 기본 1시간, refresh_token으로 자동 갱신
7. **비밀번호 정책**: Supabase Auth 기본 정책 (최소 6자) + 강화 권장
