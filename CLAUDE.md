# 리턴AI 통합 플랫폼

## 프로젝트 개요
광주/전라 8개 직영 매장 기반 통신 판매 플랫폼
- 고객용 웹사이트 (React + Vite)
- 어드민 CRM+CTI+AI (HTML 단일파일 + Mock API)
- Express 백엔드 + Supabase

## 기술 스택
- **Frontend**: React 19 + Vite + react-router-dom
- **Backend**: Node.js + Express (ES modules)
- **DB**: Supabase (PostgreSQL) + Mock JSON
- **AI**: Claude API (@anthropic-ai/sdk)
- **CTI**: Mock 어댑터 (NHN Contiple 연동 예정)

## 디렉토리 구조
```
bongi-mobile/
├── server/
│   ├── index.js              # Express 엔트리
│   ├── routes/               # API 라우트
│   │   ├── products.js       # 상품 API
│   │   ├── applications.js   # 신청 접수
│   │   ├── stores.js         # 매장 API
│   │   ├── crm.js            # CRM (Supabase)
│   │   ├── cti.js            # CTI 전화 제어
│   │   ├── ai.js             # AI 채팅/추천
│   │   └── mock.js           # Mock 데이터 API
│   ├── services/
│   │   ├── ai.js             # Claude API 서비스
│   │   └── incentive.js      # 인센티브 계산
│   ├── cti/adapter.js        # CTI 어댑터 (교체 가능)
│   ├── middleware/
│   │   ├── sanitize.js       # XSS 방어
│   │   └── errorHandler.js   # 전역 에러 핸들러
│   ├── data/
│   │   ├── constants.js      # 공통 상수
│   │   ├── products.js       # 상품 데이터
│   │   ├── stores.js         # 매장 데이터
│   │   └── mock/             # Mock JSON + store
│   ├── db/supabase.js        # Supabase 클라이언트
│   └── public/admin/         # 어드민 HTML (정적)
├── client/src/
│   ├── pages/                # 고객용 페이지
│   ├── pages/admin/          # React CRM (레거시)
│   ├── components/           # 공통 컴포넌트
│   └── utils/api.js          # API 유틸
└── .env                      # 환경변수
```

## 실행 방법
```bash
npm run dev        # 서버(3001) + 클라이언트(5173) 동시 실행
```

## URL
- 고객 사이트: http://localhost:5173
- 어드민 CRM: http://localhost:3001/admin
- API: http://localhost:3001/api

## 자동화 규칙 (필수)

### 1. 매 턴 대시보드 보고
모든 응답 시작 시 아래 형식으로 팀 상태를 표시한다:
```
📊 팀 상태 | Git: [커밋수] | Task: [진행/전체]
🟢 agent-name — 작업 중 (상세)
⏸️ agent-name — 대기
🔴 agent-name — 미소집
```

### 2. 자동 Git 커밋
- 태스크 완료 시 자동 커밋 (태스크명 기반 메시지)
- 파일 3개 이상 수정 시 중간 커밋
- .env, 시크릿 파일은 절대 커밋하지 않음

### 3. 에이전트 자동 소집
- 코드 작성/수정 후 → `code-reviewer` 자동 소집 (백그라운드)
- DB 스키마 변경 후 → `database-reviewer` 자동 소집
- 인증/보안 관련 변경 후 → `security-reviewer` 자동 소집
- 태스크 전체 완료 시 → `verify-agent` 자동 소집
- 새 Phase 시작 시 → `architect` + `tdd-guide` 자동 소집

## 에이전트 목록
| 에이전트 | 트리거 |
|---|---|
| architect | 새 Phase/기능 설계 시 |
| planner | 큰 작업 계획 시 |
| code-reviewer | **코드 변경 후 항상** |
| security-reviewer | 인증/보안 변경 시 |
| database-reviewer | DB 변경 시 |
| tdd-guide | 새 기능 전 테스트 계획 |
| build-error-resolver | 빌드 에러 시 |
| refactor-cleaner | 리팩토링 시 |
| doc-updater | Phase 완료 시 보고서 |
| e2e-runner | 배포 전 E2E |
| verify-agent | **태스크 완료 후 항상** |

## 코드 규칙
- ES modules (import/export)
- 서버: snake_case (DB), 클라이언트: camelCase
- 에러 핸들링: try-catch 필수, 전역 errorHandler 사용
- 입력 검증: sanitize 미들웨어 + 개별 검증
- 환경변수: .env, 하드코딩 금지
