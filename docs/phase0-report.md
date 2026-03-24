# 리턴AI Phase 0 완료 보고서

> 작성일: 2026-03-22
> 프로젝트: 리턴AI 통합 플랫폼
> 단계: Phase 0 (기반 정비) 완료

---

## 1. 프로젝트 개요

### 리턴AI이란

리턴AI은 **광주/전라 지역 8개 직영 매장**을 운영하는 통신 판매 플랫폼이다. 휴대폰 개통, 요금제 변경, 인터넷/TV 결합상품 등 통신 상품 전반을 온라인과 오프라인에서 판매한다.

### 목표

**아정당(ajungdang.com)과 동일 수준의 온라인 통신 판매 플랫폼** 구축을 목표로 한다. 고객이 셀프 개통부터 상담 신청까지 웹에서 처리할 수 있고, 내부적으로는 CRM + CTI + AI를 통합한 영업 관리 시스템을 갖춘다.

### 기술 스택

| 영역 | 기술 |
|------|------|
| **Frontend** | React 19 + Vite + react-router-dom |
| **Backend** | Node.js + Express (ES modules) |
| **Database** | Supabase (PostgreSQL) + Mock JSON |
| **AI** | Claude API (@anthropic-ai/sdk) |
| **CTI** | Mock 어댑터 (NHN Contiple CTI 연동 예정) |

---

## 2. Phase 0 이전 개발 완료 사항

### Phase 1: 플랫폼 웹사이트 (React)

- **상품 페이지**: 4개 카테고리 (5G 휴대폰, 인터넷, TV, 결합상품)
- **셀프가입 위자드**: 6단계 (상품선택 → 본인확인 → 약정선택 → 부가서비스 → 결제 → 완료)
- **바로상담**: 상담 신청 폼 + 콜백 요청
- **매장안내**: 8개 직영 매장 정보 + 지도
- **AI 채팅**: Claude 기반 실시간 상담 챗봇

### Phase 2: CRM + CTI + 인센티브

- **Supabase DB**: 6개 핵심 테이블 설계 및 구축
- **어드민 대시보드**: 실시간 KPI (고객수, 계약건수, 매출, 전환율)
- **고객 상세 + CTI 패널**: 고객 정보 조회 + 전화 제어 (발신/수신/보류/종료)
- **인센티브 시뮬레이터**: 상담원별 실적 기반 인센티브 자동 계산

### Phase 3: AI 연동

- **Claude API 채팅**: 통신 상품 전문 AI 상담
- **업셀링 추천**: 고객 프로필 기반 상위 요금제/결합상품 추천
- **리드 스코어링**: AI 기반 고객 전환 가능성 점수 산출

### 어드민 HTML 목업

- **33개 화면** 단일 HTML 파일로 서빙 (`server/public/admin/index.html`)
- Mock API 연동 (고객 50명, 상담 티켓 1,788건)

### 코드리뷰 11건 수정

- 보안 이슈 6건 (XSS, 입력 검증, API 키 노출 등)
- 개선 사항 5건 (에러 핸들링, 코드 구조, 성능)

---

## 3. Phase 0 수행 내용 (기반 정비)

### 에이전트 팀 운영

| 에이전트 | 역할 | 산출물 |
|---------|------|--------|
| **architect** | 인증 구조 설계 | `docs/auth-architecture.md` |
| **db-reviewer** | DB 스키마 검증 | 7개 이슈 발견 → 전부 수정 |
| **security-reviewer** | 보안 전수조사 | 18개 취약점 발견 |
| **code-reviewer** | Phase 0 코드리뷰 | 7개 이슈 (🔴 3건 즉시 수정) |
| **verify-agent** | 빌드/실행 검증 | **6/6 PASS** |

### 구현 내용

#### DB 정비

- **고객 상태값 통일**: 기존 6개 → 15개로 확장 (lead, contacted, consulting, contracted, activated, churned 등)
- **신규 테이블 6개**: products, stores, user_profiles, gifts, call_logs, notifications
- **인덱스 9개 추가**: 조회 성능 최적화

#### 인증 시스템

- **Supabase Auth**: JWT 기반 인증
- **JWT 미들웨어**: 토큰 검증 + 사용자 정보 주입 (`server/middleware/auth.js`)
- **RBAC**: 6개 역할 (super_admin, admin, manager, agent, viewer, customer) (`server/middleware/rbac.js`)
- **Rate Limiting**: 3단계 (공개 API, 인증 API, 관리자 API) (`server/middleware/rateLimit.js`)

#### 보안 강화

- **XSS 방어**: sanitize 미들웨어 (`server/middleware/sanitize.js`)
- **입력 검증**: 각 라우트별 파라미터 검증
- **CORS 제한**: 허용 도메인 명시
- **전역 에러 핸들러**: 민감 정보 노출 방지 (`server/middleware/errorHandler.js`)

#### API 보호 정책

- **CRM/CTI API**: `agent` 이상 역할만 접근 가능
- **공개 API** (상품, 매장): Rate Limit만 적용
- **인증 API**: `server/routes/auth.js` 신규 추가

---

## 4. 현재 DB 테이블 현황 (12개)

| # | 테이블명 | 설명 |
|---|---------|------|
| 1 | `bongi_customers` | 고객 정보 (이름, 연락처, 상태, 리드소스) |
| 2 | `bongi_agents` | 상담원 정보 (매장, 역할, 실적) |
| 3 | `bongi_consultations` | 상담 이력 (고객-상담원 매핑, 상태, 메모) |
| 4 | `bongi_contracts` | 계약 정보 (요금제, 단말기, 약정) |
| 5 | `bongi_applications` | 셀프가입 신청 (온라인 접수) |
| 6 | `bongi_agent_performance` | 상담원 실적 (월별 KPI) |
| 7 | `bongi_products` | 상품 마스터 (휴대폰, 요금제, 부가서비스) |
| 8 | `bongi_stores` | 매장 정보 (주소, 연락처, 영업시간) |
| 9 | `bongi_user_profiles` | 사용자 프로필 (Supabase Auth 연동) |
| 10 | `bongi_gifts` | 사은품 정보 (개통 시 제공) |
| 11 | `bongi_call_logs` | 통화 이력 (CTI 연동) |
| 12 | `bongi_notifications` | 알림 (상담원/고객 알림) |

---

## 5. 현재 프로젝트 구조

```
bongi-mobile/
├── .env                          # 환경변수 (Supabase, Claude API 키)
├── .env.example                  # 환경변수 예시
├── .gitignore
├── CLAUDE.md                     # 프로젝트 규칙 및 에이전트 가이드
├── package.json                  # 루트 (dev 스크립트: 서버+클라이언트 동시)
│
├── docs/
│   └── auth-architecture.md      # 인증 구조 설계 문서
│
├── server/
│   ├── package.json
│   ├── index.js                  # Express 엔트리포인트 (포트 3001)
│   │
│   ├── routes/
│   │   ├── ai.js                 # AI 채팅/추천 API
│   │   ├── applications.js       # 셀프가입 신청 접수 API
│   │   ├── auth.js               # 인증 API (로그인/로그아웃/프로필)
│   │   ├── crm.js                # CRM API (고객/상담/계약 CRUD)
│   │   ├── cti.js                # CTI 전화 제어 API
│   │   ├── mock.js               # Mock 데이터 API (개발용)
│   │   ├── products.js           # 상품 조회 API
│   │   └── stores.js             # 매장 조회 API
│   │
│   ├── services/
│   │   ├── ai.js                 # Claude API 서비스 (채팅, 추천, 스코어링)
│   │   └── incentive.js          # 인센티브 계산 로직
│   │
│   ├── middleware/
│   │   ├── auth.js               # JWT 인증 미들웨어
│   │   ├── rbac.js               # 역할 기반 접근 제어 (6개 역할)
│   │   ├── rateLimit.js          # Rate Limiting (3단계)
│   │   ├── sanitize.js           # XSS 방어 (입력 정제)
│   │   └── errorHandler.js       # 전역 에러 핸들러
│   │
│   ├── cti/
│   │   └── adapter.js            # CTI 어댑터 (Mock / NHN Contiple 교체 가능)
│   │
│   ├── db/
│   │   └── supabase.js           # Supabase 클라이언트 초기화
│   │
│   ├── data/
│   │   ├── constants.js          # 공통 상수 (상태값, 카테고리 등)
│   │   ├── products.js           # 상품 정적 데이터
│   │   ├── stores.js             # 매장 정적 데이터
│   │   └── mock/
│   │       ├── customers.json    # Mock 고객 50명
│   │       ├── tickets.json      # Mock 상담 티켓 1,788건
│   │       ├── store.js          # Mock 데이터 스토어
│   │       └── source.html       # 크롤링 원본 참고
│   │
│   └── public/
│       └── admin/
│           └── index.html        # 어드민 CRM 목업 (33개 화면, 단일 HTML)
│
└── client/
    ├── package.json
    ├── index.html                # Vite 엔트리 HTML
    ├── vite.config.js            # Vite 설정 (프록시: /api → 3001)
    ├── eslint.config.js
    │
    ├── public/
    │   ├── favicon.svg
    │   └── icons.svg
    │
    ├── dist/                     # 빌드 산출물
    │   ├── index.html
    │   ├── favicon.svg
    │   ├── icons.svg
    │   └── assets/
    │       ├── index-DJKLbZwB.js
    │       └── index-D1MjQ3PX.css
    │
    └── src/
        ├── main.jsx              # React 엔트리
        ├── App.jsx               # 라우터 설정
        │
        ├── pages/
        │   ├── Home.jsx          # 메인 랜딩 페이지
        │   ├── Products.jsx      # 상품 목록 (4개 카테고리)
        │   ├── ProductDetail.jsx  # 상품 상세
        │   ├── Apply.jsx         # 셀프가입 6단계 위자드
        │   ├── Stores.jsx        # 매장 안내
        │   ├── AiChat.jsx        # AI 채팅 상담
        │   └── admin/
        │       ├── Dashboard.jsx      # 어드민 대시보드 (KPI)
        │       ├── CustomerDetail.jsx # 고객 상세 + CTI 패널
        │       └── Incentive.jsx      # 인센티브 시뮬레이터
        │
        ├── components/
        │   ├── Header.jsx        # 공통 헤더/네비게이션
        │   ├── Footer.jsx        # 공통 푸터
        │   └── CTIPanel.jsx      # CTI 전화 제어 패널
        │
        ├── styles/
        │   └── global.css        # 전역 스타일
        │
        ├── utils/
        │   └── api.js            # API 호출 유틸 (fetch 래퍼)
        │
        └── assets/
            ├── hero.png          # 메인 히어로 이미지
            └── vite.svg          # Vite 로고
```

---

## 6. 아정당 대비 GAP 분석 요약

### 현재 완성도: 약 45%

| 영역 | 아정당 | 리턴AI | 상태 |
|------|--------|-----------|------|
| 상품 페이지 | 4개 카테고리 + 실시간 가격 | 4개 카테고리 (정적 데이터) | 부분 완료 |
| 셀프가입 | 본인인증 + 신용조회 + 전자서명 | 6단계 위자드 (본인인증 미연동) | 부분 완료 |
| 회원 시스템 | 회원가입/로그인/마이페이지 | Supabase Auth 구조만 구축 | 미완성 |
| CRM | React 기반 풀 CRM | HTML 목업 33화면 + React 3화면 | 부분 완료 |
| CTI | NHN Contiple 실연동 | Mock 어댑터 | 미완성 |
| 본인인증 | PASS/통신사 인증 | 미구현 | 미착수 |
| 결제 | PG 연동 | 미구현 | 미착수 |
| 배포 | 프로덕션 운영 중 | localhost 개발 환경 | 미착수 |
| AI 상담 | 없음 (리턴AI 우위) | Claude API 연동 완료 | **완료** |
| 인센티브 | 수동 관리 추정 | 자동 계산 시뮬레이터 | **완료** |

### 주요 GAP (우선순위순)

1. **회원 시스템**: 회원가입/로그인/마이페이지 UI 미구현
2. **본인인증**: PASS 또는 통신사 본인인증 연동 필요
3. **CTI 실연동**: NHN Contiple API 실연동 (현재 Mock)
4. **배포**: 도메인 + HTTPS + 클라우드 배포
5. **어드민 React 전환**: HTML 목업 33화면 → React 컴포넌트 전환

---

## 7. 남은 로드맵

### Phase 1 (4주) — 핵심 기능 완성

| 주차 | 작업 | 산출물 |
|------|------|--------|
| 1주 | 회원 시스템 (가입/로그인/마이페이지) | 회원 UI + Supabase Auth 연동 |
| 2주 | 본인인증 연동 (PASS/통신사) | 본인인증 플로우 완성 |
| 3주 | CTI 실연동 (NHN Contiple) | 실제 발신/수신/녹취 |
| 4주 | CRM React 전환 (핵심 화면 10개) | 고객목록, 상담관리, 계약관리 |

### Phase 2 (4주) — 영업 자동화

| 주차 | 작업 | 산출물 |
|------|------|--------|
| 1주 | TM 캠페인 관리 | 캠페인 생성/배분/실적 추적 |
| 2주 | 정산 자동화 | 수수료 계산 + 정산서 생성 |
| 3주 | 알림톡 연동 (카카오) | 상담결과/계약확인/프로모션 발송 |
| 4주 | 어드민 잔여 화면 전환 | 나머지 23개 화면 React 전환 |

### Phase 3 (4주) — 성장 기반

| 주차 | 작업 | 산출물 |
|------|------|--------|
| 1주 | SEO 최적화 + 메타태그 | 검색 노출 개선 |
| 2주 | 이벤트/프로모션 시스템 | 할인, 사은품, 한정 이벤트 |
| 3주 | CMS (콘텐츠 관리) | 배너, 공지사항, FAQ 관리 |
| 4주 | AI 고도화 | 자동 응대, 감성 분석, 이탈 예측 |

### Phase 4 (지속) — 확장

- React Native 모바일 앱 (iOS/Android)
- 스케일업 (CDN, 캐싱, DB 리플리카)
- 다지역 매장 확장 지원
- 파트너 API 개방

---

## 8. URL 정리

| 서비스 | URL | 설명 |
|--------|-----|------|
| 고객 사이트 | http://localhost:5173 | React 고객용 웹사이트 |
| 어드민 CRM | http://localhost:3001/admin | HTML 목업 기반 CRM 대시보드 |
| API 서버 | http://localhost:3001/api | Express REST API |

### 주요 API 엔드포인트

| 경로 | 설명 | 인증 |
|------|------|------|
| `GET /api/products` | 상품 목록 | 공개 (Rate Limit) |
| `GET /api/stores` | 매장 목록 | 공개 (Rate Limit) |
| `POST /api/applications` | 셀프가입 신청 | 공개 (Rate Limit) |
| `POST /api/auth/login` | 로그인 | 공개 |
| `GET /api/crm/*` | CRM 데이터 | agent 이상 |
| `POST /api/cti/*` | CTI 제어 | agent 이상 |
| `POST /api/ai/chat` | AI 채팅 | 공개 (Rate Limit) |
| `GET /api/mock/*` | Mock 데이터 | 개발용 |

---

## 9. 실행 방법

```bash
# 프로젝트 루트에서
npm run dev        # 서버(3001) + 클라이언트(5173) 동시 실행
```

---

> **Phase 0 완료 상태**: 기반 정비 완료. 인증/보안/DB 구조가 안정화되어 Phase 1 본격 개발 진입 가능.
