# 봉이모바일 (리턴AI 통합 플랫폼)

광주/전라 8개 직영매장 기반 통신 판매 O2O CRM 플랫폼.

## 주요 페이지

### TM 도구 (영업 견적 + 인센티브)
| URL | 용도 | 권한 |
|-----|------|------|
| `/docs/tm.html` | TM 관리자 페이지 (요금 계산기 + 데이터 편집) | manager / admin |
| `/docs/tm-counselor.html` | TM 상담사 페이지 (조회·견적 전용, 데이터 수정 불가) | 모두 |

### V5 인센티브 시스템
| URL | 용도 | 권한 |
|-----|------|------|
| `/docs/incentive-contract.html` | 계약부서 어드민 (영업 → 주소·서류·상태 처리) | manager / admin |
| `/docs/incentive-rules.html` | 인센티브 정책 관리 (Grade·단가·임계값) | admin |
| `/docs/incentive-agents.html` | 상담사 계정 관리 (발급·비번 재설정·권한·활성/비활성) | admin |

### 메인
| URL | 용도 |
|-----|------|
| `/docs/master-map.html` | 전체 문서 맵 |
| `/docs/calculator.html` | 요금 계산기 (어드민 편집) |

## V5 인센티브 비즈니스 룰

### 가중치
- 인터넷 단독: **1.0 P**
- 인터넷 + TV 결합: **1.5 P**

### Grade 단가 (₩/P)
| Grade | 누적 P | 우수상품 의무 | 단가 |
|-------|--------|---------------|------|
| G1 | 1 ~ 15 | 없음 | 20,000 |
| G2 | 16 ~ 30 | 5건+ | 30,000 |
| G3 | 31+ | 10건+ | 40,000 |

**페널티:** 우수 의무 미달 시 한 단계 강등.

### 우수상품
- 마진 ≥ **250,000원** (S Tier)
- 보너스: **+10,000원/건**

### 추가 페이백
- 최대 50,000원/건 (CHECK 제약)
- 회사 부담: ≤ 30,000원
- 상담사 차감: 30,001~50,000원

### 기본급
- 230만원/월 (역할별 다름)

### 정산
- 매월 익월 정산 (`incentive_calc_monthly_settlement` RPC)
- `status='completed'`만 카운트
- `pending` / `cancelled`은 자동 제외

## 데이터 흐름

```
[TM 상담사 견적]
  ↓ 계약 완료 클릭
[POST /api/incentive/sales]
  · 자동 수집: tv_count, additional_products, wifi_option, quote_summary
  ↓
[incentive_sales 테이블 INSERT]
  ↓ Realtime 자동 푸시
[계약부서 어드민]
  · 모달에서 견적 요약 + 추가 TV/WiFi 옵션 자동 표시
  · 주소·주민번호·사은품·설치일 추가 입력
  · 상태 변경 (pending/completed/cancelled)
  ↓
[월말 정산]
  · agent_total = base_salary + incentive(P × applied_rate) + bonus(우수×1만) - 본인페이백차감
```

## 테스트 계정

| 이메일 | 비밀번호 | 이름 | 역할 | 센터 |
|--------|----------|------|------|------|
| `agent1@bongi.test` | `pass1234!` | 김상담 | agent | 광주센터 |
| `manager1@bongi.test` | `pass1234!` | 박매니저 | manager | 광주센터 |
| `admin1@bongi.test` | `pass1234!` | 빈센조 | admin | 본사 |

## 기술 스택

- **Frontend**: HTML/Vanilla JS (단일 파일) + Supabase JS CDN
- **Backend**: Express (ES modules)
- **DB**: Supabase (PostgreSQL + Realtime + Auth)
- **호스팅**: Railway
- **Realtime**: Supabase Realtime 구독 (incentive_sales 변경 자동 동기화)

## 디렉토리 구조

```
bongi-mobile/
├── docs/                     # 정적 HTML (모든 페이지)
│   ├── tm.html               # 관리자 TM 도구
│   ├── tm-counselor.html     # 상담사 TM 도구 (readonly)
│   ├── incentive-contract.html
│   ├── incentive-rules.html
│   ├── incentive-agents.html
│   ├── calculator.html       # 요금 계산기 (어드민 편집)
│   └── master-map.html
├── server/
│   ├── routes/incentive.js   # V5 인센티브 라우터 (15+ 엔드포인트)
│   ├── routes/auth.js        # JWT 로그인
│   └── public/docs/          # docs/ 동기화 (정적 서빙)
├── scripts/
│   └── create-test-incentive-agents.mjs
├── tests-incentive-auth.mjs  # E2E (Playwright)
├── Dockerfile                # Railway 빌드
└── railway.json              # 빌더 설정
```

## DB 스키마 (incentive_*)

### incentive_agents
- `id`, `user_id` (auth.users FK), `name`, `center`, `role` (agent/manager/admin)
- `hire_date`, `base_salary`, `active`

### incentive_products (63개 상품 시드)
- `id`, `carrier` (SKT/KT/LGU+), `type` (단독/결합)
- `name`, `speed`, `tv_tier`, `rebate`, `payback`, `point_weight`
- **GENERATED**: `margin`, `tier` (S/A/B/C), `is_premium`

### incentive_sales (계약 영업)
- 기본: `agent_id`, `product_id`, `customer_name`, `customer_phone`, `customer_address`
- 추가 (계약부서): `resident_id`, `gift_received`, `installation_date`
- 다중 TV/옵션: `tv_count`, `additional_products` (JSONB), `wifi_option`, `quote_summary`
- 페이백: `add_payback`, `company_payback_burden` (GENERATED), `agent_payback_deduct` (GENERATED)
- 상태: `status`, `cancellation_reason`, `notes`

### incentive_rules
- `version`, `effective_from`, `base_salary`, `bonus_per_premium`
- `payback_company_limit`, `payback_max`
- `grade_rates` (JSONB), `grade_thresholds` (JSONB)
- `premium_margin_threshold`, `active`

### incentive_monthly_settlements
- 월별 정산 캐시/확정 (지표 + 인센티브 + 회사 영업이익)

## DB 함수

- `incentive_calc_grade(points, premium_count)` — Grade 결정 + 페널티 체크
- `incentive_calc_monthly_settlement(agent_id, year_month)` — 월별 정산 계산
- `incentive_finalize_monthly_settlement(...)` — 정산 확정 (UPSERT)
- `incentive_simulate_addition(...)` — 시뮬레이션 (현재 vs +1건 후 vs Δ)

## Realtime 구독

Supabase Realtime publication에 `incentive_sales` 등록됨:
- TM 도구: 본인 영업 변경 → 누적 자동 갱신
- 계약부서: 모든 영업 변경 → 테이블 자동 갱신

## 주요 API 엔드포인트 (`/api/incentive`)

| Method | Path | 권한 | 용도 |
|--------|------|------|------|
| GET | `/products` | - | 상품 카탈로그 |
| GET | `/rules` | - | 활성 정책 |
| POST | `/simulate` | - | 시뮬레이션 |
| GET | `/agents/me` | auth | 본인 정보 |
| GET | `/agents/all` | admin | 전체 상담사 |
| POST | `/admin/create-agent` | admin | 신규 상담사 발급 (auth+agent 통합) |
| POST | `/agents/:id/reset-password` | admin | 비밀번호 재설정 |
| PATCH | `/agents/:id` | admin | 권한·기본급·활성 변경 |
| GET | `/sales` | auth | 본인/팀 영업 조회 |
| POST | `/sales` | auth | 영업 등록 (TM 계약 완료) |
| PATCH | `/sales/:id` | auth | 영업 수정 (계약부서) |
| GET | `/contracts` | manager/admin | 모든 영업 (필터) |
| GET | `/settlement` | auth | 월별 정산 (live) |
| POST | `/finalize` | admin | 정산 확정 (월말) |
| GET | `/manager/overview` | manager/admin | 대시보드 집계 |
| POST | `/rules` | admin | 새 정책 발행 |
| PATCH | `/rules/:id` | admin | 정책 수정 |
| GET | `/rules/all` | admin | 정책 이력 |

## 환경변수 (Railway / .env)

```
SUPABASE_URL=https://dugaqvvnhsgenhmhuyju.supabase.co
SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_KEY=sb_secret_...
ANTHROPIC_API_KEY=...
NODE_ENV=production
```

⚠️ Railway 변수는 모두 **평문**으로 입력 (reference 형식 X). reference 잘못 들어가면 빌드 실패: `secret ID missing for "" environment variable`.

## 로컬 개발

```bash
npm install
npm run dev   # server (3001) + client (5173)
```

## 배포 (Railway)

```bash
git push origin master   # 자동 배포
```

## 검증 (E2E)

```bash
node tests-incentive-auth.mjs   # 로그인 → 견적 → 계약 → 누적 갱신
node tests-e2e.mjs              # TM 도구 31개 시나리오
node tests-e2e-v2.mjs           # 추가 26개 시나리오
```

## 변경 이력 주요 마일스톤

- Phase 1: DB (5 테이블 + 4 함수 + RLS) — 검증 6/6 PASS
- Phase 2: Express 라우터 12+개
- Phase 3: TM 도구 인센티브 미리보기 통합
- Phase 4: Supabase Auth 로그인 + 실제 계약 등록 흐름
- Phase 5: 계약부서 어드민 + 정책 관리 + 상담사 관리

## 테스트 데이터 정리

테스트 영업 데이터는 `incentive_sales`에서 `agent_id`로 필터링해서 삭제:

```sql
DELETE FROM incentive_sales WHERE agent_id IN (SELECT id FROM incentive_agents WHERE name LIKE '%테스트%');
```

## License

Internal — (주)파이어니컴퍼니
