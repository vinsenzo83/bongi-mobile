# 봉이모바일 Phase 1-1 TDD 테스트 계획

## 1. 테스트 프레임워크 선택: Vitest

### 선택 이유
- 클라이언트가 이미 **Vite 기반** (vite.config.js 존재) → Vitest는 동일 설정 재사용 가능
- ES modules (`"type": "module"`) 네이티브 지원 — Jest는 ESM 설정이 번거로움
- `@testing-library/react`와 완벽 호환
- 서버/클라이언트 **단일 프레임워크**로 통일 가능 (monorepo workspace config)
- 빠른 HMR 기반 watch 모드

### 설치 계획

```bash
# 루트 (서버+클라이언트 공통)
npm install -D vitest

# 서버 테스트용
cd server && npm install -D vitest supertest

# 클라이언트 테스트용
cd client && npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

### 설정 파일

**server/vitest.config.js**
```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.test.js'],
    setupFiles: ['./__tests__/setup.js'],
  },
});
```

**client/vitest.config.js** (기존 vite.config.js 확장)
```js
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}'],
    setupFiles: ['./src/test/setup.js'],
  },
});
```

---

## 2. 서버 API 테스트 목록

### 2-1. Auth API (`server/__tests__/routes/auth.test.js`)

| # | 테스트 케이스 | HTTP | 기대 결과 |
|---|-------------|------|----------|
| 1 | 정상 회원가입 | POST /api/auth/signup | 201, user.id + session 반환 |
| 2 | 이메일 누락 시 400 | POST /api/auth/signup | 400, "이메일과 비밀번호는 필수입니다" |
| 3 | 비밀번호 누락 시 400 | POST /api/auth/signup | 400, "이메일과 비밀번호는 필수입니다" |
| 4 | 비밀번호 8자 미만 시 400 | POST /api/auth/signup | 400, "비밀번호는 8자 이상" |
| 5 | Supabase signUp 에러 전파 | POST /api/auth/signup | 400, Supabase 에러 메시지 |
| 6 | 프로필 생성 실패해도 회원가입 성공 | POST /api/auth/signup | 201 (프로필 에러는 console.error만) |
| 7 | 정상 로그인 | POST /api/auth/login | 200, access_token + user 반환 |
| 8 | 이메일/비밀번호 누락 시 400 | POST /api/auth/login | 400 |
| 9 | 잘못된 자격증명 시 401 | POST /api/auth/login | 401, "이메일 또는 비밀번호가 올바르지 않습니다" |
| 10 | 프로필 없는 유저 로그인 → 자동 생성 | POST /api/auth/login | 200, 기본 role=customer |
| 11 | /me 인증된 요청 | GET /api/auth/me | 200, user 객체 |
| 12 | /me 토큰 없음 | GET /api/auth/me | 401 |
| 13 | /me 유효하지 않은 토큰 | GET /api/auth/me | 401 |

### 2-2. Auth Middleware (`server/__tests__/middleware/auth.test.js`)

| # | 테스트 케이스 | 기대 결과 |
|---|-------------|----------|
| 1 | authenticateJWT: 유효 토큰 → req.user 설정 | next() 호출, req.user에 id/email/role 존재 |
| 2 | authenticateJWT: Authorization 헤더 없음 | 401 |
| 3 | authenticateJWT: Bearer 형식 아님 | 401 |
| 4 | authenticateJWT: 만료/무효 토큰 | 401 |
| 5 | authenticateJWT: 프로필 없는 유저 → role=customer 기본값 | next(), role === 'customer' |
| 6 | optionalAuth: 토큰 있으면 req.user 설정 | next(), req.user 존재 |
| 7 | optionalAuth: 토큰 없으면 req.user = null | next(), req.user === null |
| 8 | optionalAuth: 잘못된 토큰 → req.user = null (에러 아님) | next(), req.user === null |

### 2-3. RBAC Middleware (`server/__tests__/middleware/rbac.test.js`)

| # | 테스트 케이스 | 기대 결과 |
|---|-------------|----------|
| 1 | requireRole('agent'): agent 유저 | next() |
| 2 | requireRole('agent'): customer 유저 | 403 |
| 3 | requireRole('agent','manager'): manager 유저 | next() |
| 4 | requireMinRole('agent'): manager 유저 (상위) | next() |
| 5 | requireMinRole('agent'): customer 유저 (하위) | 403 |
| 6 | requireMinRole: req.user 없음 | 401 |

### 2-4. CRM API (`server/__tests__/routes/crm.test.js`)

| # | 테스트 케이스 | HTTP | 기대 결과 |
|---|-------------|------|----------|
| 1 | 고객 목록 조회 | GET /api/crm/customers | 200, { data, total, page, limit } |
| 2 | 고객 목록 — status 필터 | GET /api/crm/customers?status=new | 200, 필터된 결과 |
| 3 | 고객 목록 — 검색 | GET /api/crm/customers?search=김 | 200, 검색 결과 |
| 4 | 고객 상세 | GET /api/crm/customers/:id | 200, 고객 객체 |
| 5 | 존재하지 않는 고객 | GET /api/crm/customers/:id | 404 |
| 6 | 고객 상태 변경 | PATCH /api/crm/customers/:id | 200, 업데이트된 객체 |
| 7 | 상담 기록 조회 | GET /api/crm/customers/:id/consultations | 200, 배열 |
| 8 | 상담 생성 | POST /api/crm/consultations | 201 |
| 9 | 상담 상태 업데이트 (in_progress → started_at) | PATCH /api/crm/consultations/:id | 200, started_at 포함 |
| 10 | 계약 생성 | POST /api/crm/contracts | 201 |
| 11 | 대시보드 통계 | GET /api/crm/dashboard/stats | 200, 통계 객체 |
| 12 | 인증 없이 CRM 접근 | GET /api/crm/customers | 401 |
| 13 | customer 역할로 CRM 접근 | GET /api/crm/customers | 403 |

### 2-5. Applications API (`server/__tests__/routes/applications.test.js`)

| # | 테스트 케이스 | HTTP | 기대 결과 |
|---|-------------|------|----------|
| 1 | 정상 신청 접수 | POST /api/applications | 201, application 객체 |
| 2 | 전화번호 누락 | POST /api/applications | 400, "연락처는 필수입니다" |
| 3 | 잘못된 전화번호 형식 | POST /api/applications | 400, "전화번호 형식이 올바르지 않습니다" |
| 4 | 이름 50자 초과 | POST /api/applications | 400 |
| 5 | 메시지 2000자 초과 | POST /api/applications | 400 |
| 6 | 신청 목록 조회 | GET /api/applications | 200, 배열 |

### 2-6. Middleware — Sanitize (`server/__tests__/middleware/sanitize.test.js`)

| # | 테스트 케이스 | 기대 결과 |
|---|-------------|----------|
| 1 | HTML 태그 이스케이프 | `<script>` → `&lt;script&gt;` |
| 2 | 중첩 객체 sanitize | 내부 문자열도 이스케이프 |
| 3 | 숫자/boolean 값 유지 | 변환 없음 |
| 4 | body 없는 요청 | 에러 없이 통과 |

---

## 3. 클라이언트 컴포넌트 테스트 목록

### 3-1. App 라우팅 (`client/src/App.test.jsx`)

| # | 테스트 케이스 | 기대 결과 |
|---|-------------|----------|
| 1 | / → Home 렌더링 | Home 컴포넌트 표시 |
| 2 | /products/internet → Products 렌더링 | Products 컴포넌트 표시 |
| 3 | /stores → Stores 렌더링 | Stores 컴포넌트 표시 |
| 4 | /apply → Apply 렌더링 | Apply 컴포넌트 표시 |
| 5 | /admin → Header/Footer 숨김 | Header/Footer 없음 |
| 6 | /chat → Header/Footer 숨김 | Header/Footer 없음 |

### 3-2. api.js 유틸 (`client/src/utils/api.test.js`)

| # | 테스트 케이스 | 기대 결과 |
|---|-------------|----------|
| 1 | 정상 응답 파싱 | JSON 데이터 반환 |
| 2 | 에러 응답 → throw | Error 메시지 = 서버 error 필드 |
| 3 | 네트워크 에러 | throw |
| 4 | auth 토큰 전달 확인 | Authorization 헤더에 Bearer 포함 |

### 3-3. Header (`client/src/components/Header.test.jsx`)

| # | 테스트 케이스 | 기대 결과 |
|---|-------------|----------|
| 1 | 네비게이션 링크 렌더링 | 홈, 상품, 매장 등 링크 존재 |
| 2 | 로고 클릭 → / 이동 | href="/" |

### 3-4. Apply 페이지 (`client/src/pages/Apply.test.jsx`)

| # | 테스트 케이스 | 기대 결과 |
|---|-------------|----------|
| 1 | 폼 필드 렌더링 | 이름, 전화번호, 메시지 입력란 표시 |
| 2 | 필수 입력값 없이 제출 | 에러 메시지 표시 |
| 3 | 정상 제출 → API 호출 | submitApplication 호출됨 |
| 4 | 제출 성공 → 완료 메시지 | 완료 상태 표시 |

---

## 4. 테스트 파일 구조

```
bongi-mobile/
├── server/
│   ├── __tests__/
│   │   ├── setup.js                          # Supabase mock 초기화
│   │   ├── helpers/
│   │   │   ├── mockSupabase.js               # Supabase mock 팩토리
│   │   │   └── testApp.js                    # supertest용 Express app 생성
│   │   ├── routes/
│   │   │   ├── auth.test.js
│   │   │   ├── crm.test.js
│   │   │   └── applications.test.js
│   │   └── middleware/
│   │       ├── auth.test.js
│   │       ├── rbac.test.js
│   │       └── sanitize.test.js
│   └── vitest.config.js
├── client/
│   ├── src/
│   │   ├── test/
│   │   │   └── setup.js                      # @testing-library/jest-dom 설정
│   │   ├── utils/
│   │   │   └── api.test.js
│   │   ├── components/
│   │   │   └── Header.test.jsx
│   │   ├── pages/
│   │   │   └── Apply.test.jsx
│   │   └── App.test.jsx
│   └── vitest.config.js                      # 기존 vite.config.js 대체
└── package.json                               # test 스크립트 추가
```

---

## 5. Mock 전략

### 5-1. Supabase Mock 방침

Supabase 클라이언트를 **모듈 레벨에서 mock**한다. 실제 Supabase 인스턴스에 의존하지 않는다.

**이유**: 단위 테스트는 외부 서비스 없이 빠르게 실행되어야 하고, CI 환경에서도 .env 없이 동작해야 한다.

### 5-2. 핵심 Mock: `server/__tests__/helpers/mockSupabase.js`

```js
// Supabase 클라이언트를 체이너블 mock으로 생성
export function createMockSupabase() {
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  return {
    from: vi.fn(() => mockChain),
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      getUser: vi.fn(),
    },
    _chain: mockChain, // 테스트에서 반환값 설정용
  };
}
```

### 5-3. Mock 적용 방식: `vi.mock()`

```js
// server/__tests__/setup.js
import { vi } from 'vitest';
import { createMockSupabase } from './helpers/mockSupabase.js';

const mockSupabase = createMockSupabase();

// db/supabase.js 모듈을 mock
vi.mock('../db/supabase.js', () => ({
  supabase: mockSupabase,
}));

export { mockSupabase };
```

### 5-4. 테스트별 반환값 제어

```js
// 예: auth.test.js
import { mockSupabase } from '../setup.js';

beforeEach(() => {
  vi.clearAllMocks();
});

it('정상 회원가입', async () => {
  mockSupabase.auth.signUp.mockResolvedValue({
    data: {
      user: { id: 'uuid-1', email: 'test@test.com' },
      session: { access_token: 'token-123' },
    },
    error: null,
  });
  mockSupabase._chain.single.mockResolvedValue({ data: null, error: null });

  const res = await request(app).post('/api/auth/signup')
    .send({ email: 'test@test.com', password: 'password123' });

  expect(res.status).toBe(201);
  expect(res.body.user.id).toBe('uuid-1');
});
```

### 5-5. Express App 헬퍼: `server/__tests__/helpers/testApp.js`

```js
// rate limit 없이 테스트용 Express app 생성
import express from 'express';
import authRoutes from '../../routes/auth.js';
import crmRoutes from '../../routes/crm.js';
import applicationRoutes from '../../routes/applications.js';
import { sanitizeBody } from '../../middleware/sanitize.js';
import { authenticateJWT } from '../../middleware/auth.js';
import { requireMinRole } from '../../middleware/rbac.js';

export function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(sanitizeBody);

  app.use('/api/auth', authRoutes);
  app.use('/api/applications', applicationRoutes);
  app.use('/api/crm', authenticateJWT, requireMinRole('agent'), crmRoutes);

  return app;
}
```

> **Note**: `rateLimit` 미들웨어는 테스트 app에 포함하지 않는다. rate limit 자체의 테스트가 필요하면 별도 테스트 파일에서 실제 미들웨어를 붙여 검증한다.

### 5-6. 클라이언트 Mock

| 대상 | Mock 방식 |
|------|----------|
| `fetch` (api.js) | `vi.stubGlobal('fetch', vi.fn())` 또는 `msw` |
| `react-router-dom` | `MemoryRouter`로 감싸서 테스트 |
| `import.meta.env` | vitest `define` 설정으로 주입 |

---

## 6. TDD 실행 순서 (Phase 1-1 기준)

Phase 1-1은 회원 시스템이므로 아래 순서로 Red → Green → Refactor 진행:

### Step 1: 서버 미들웨어 테스트 (의존성 없는 것부터)
1. `sanitize.test.js` — 순수 함수, mock 불필요
2. `rbac.test.js` — req/res mock만 필요

### Step 2: 서버 Auth 테스트
3. `middleware/auth.test.js` — Supabase mock 필요
4. `routes/auth.test.js` — supertest + Supabase mock

### Step 3: 서버 CRM/Applications 테스트
5. `routes/applications.test.js`
6. `routes/crm.test.js`

### Step 4: 클라이언트 테스트
7. `api.test.js` — fetch mock
8. `Header.test.jsx`
9. `App.test.jsx` — 라우팅
10. `Apply.test.jsx` — 폼 인터랙션

---

## 7. package.json 스크립트 추가 계획

```jsonc
// 루트 package.json
{
  "scripts": {
    "test": "npm run test:server && npm run test:client",
    "test:server": "cd server && npx vitest run",
    "test:client": "cd client && npx vitest run",
    "test:watch": "concurrently \"npm run test:server -- --watch\" \"npm run test:client -- --watch\""
  }
}
```

---

## 8. CI 고려사항

- Supabase mock이므로 CI에서 `.env` 불필요
- `vitest run`으로 single-pass 실행 (watch 모드 아님)
- coverage 추가 시: `vitest run --coverage` (후속 Phase에서 설정)
