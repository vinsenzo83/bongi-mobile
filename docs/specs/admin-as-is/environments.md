# 환경 비교 — LIVE · DEV · LOCAL

> 기준: 라이브(`https://admin.prexymarket.com/`). 데브·로컬은 drift 여부 표시.
> 측정 시각: 2026-05-17 19:00 KST

## 0. 진입점

| 환경 | URL | NODE_ENV | 인증 |
|---|---|---|---|
| **LIVE** | https://admin.prexymarket.com/ | `production` | admin1@bongi.test / [REDACTED — 내부 vault 참조] |
| DEV  | https://dev-admin.prexymarket.com/ | `staging` | (동일) |
| LOCAL | http://localhost:3001/ | `development` | (동일) |

세 환경 모두 동일한 Supabase 프로젝트 (`dugaqvvnhsgenhmhuyju`) 사용. 인증 사용자·DB 공유.

## 1. Health

| 항목 | LIVE | DEV | LOCAL |
|---|---|---|---|
| status | ok | ok | ok |
| supabase | ok | ok | ok |
| agents_count | 11 | 11 | 11 |
| uptime (측정 시점) | 169,155s (≈47h) | 169,158s (≈47h) | 3,272s (≈55m) |
| env_supabase_url | true | true | true |
| env_service_key | true | true | true |

→ **라이브·데브 동시 배포** 흔적 (uptime 거의 동일). 로컬은 최근 재시작.

## 2. ⚠️ 권한 매트릭스 drift (LIVE ↔ DEV)

라이브 미반영 변경이 데브에 존재.

| role | LIVE menus | DEV menus | LIVE updated_at | DEV updated_at |
|---|---|---|---|---|
| admin | 19 | 19 | 2026-05-06 | 2026-05-15 |
| **agent** | **11** | **8** | 2026-05-06 | 2026-05-15 |
| **contract** | **8** | **4** | 2026-05-15 | 2026-05-15 |
| manager | 14 | 14 | 2026-05-15 | 2026-05-15 |

### 의미
- 데브가 2026-05-15에 **agent에서 3개 메뉴 제거, contract에서 4개 메뉴 제거** 작업했으나 라이브 미반영
- → 데브 ↔ 라이브 권한 동기화 필요 (master 머지 또는 라이브 권한 매트릭스 동기화 cron 검토)
- 로컬은 라이브 미러 (`updated_at` 동일)

### 정확한 drift 메뉴 (LIVE에는 있고 DEV에는 빠진 것)
```sh
# 확인 명령
diff <(curl -s LIVE/api/incentive/role-permissions | jq '.permissions[] | select(.role=="agent") | .menus | sort') \
     <(curl -s DEV/api/incentive/role-permissions | jq '.permissions[] | select(.role=="agent") | .menus | sort')
```

## 3. 데이터 row 차이 (시드)

| endpoint | LIVE | DEV | LOCAL | 비고 |
|---|---|---|---|---|
| `/api/incentive/agents` | 9 | 9 | 9 | 동일 |
| `/api/incentive/products` | **63** | **45** | **63** | 데브가 18개 적음 (작업용 데이터 정리?) |
| `/api/incentive/sales?ym=2026-05` | 8 | 9 | 8 | 데브 +1 (테스트 데이터) |
| `/api/incentive/contracts?ym=2026-05` | 22 | 23 | 22 | 데브 +1 |

→ 로컬은 라이브 100% 미러. 데브는 작업/테스트 데이터로 인한 의도적 drift로 추정.

## 4. 검증 방법 재현

```bash
# Bearer token 확보
TOKEN=$(curl -s -X POST https://admin.prexymarket.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin1@bongi.test","password":"<REDACTED>"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

# 권한 매트릭스
curl -s https://admin.prexymarket.com/api/incentive/role-permissions \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# 헬스
curl -s https://admin.prexymarket.com/api/health | python3 -m json.tool
```

전체 환경 비교 스크립트: `/tmp/env-diff.py`

## 5. 액션 아이템

| # | 항목 | 우선도 | 상태 |
|---|---|---|---|
| 1 | 데브 권한 매트릭스(agent·contract 변경)를 라이브로 동기화할지 결정 | 높음 | 대기 |
| 2 | 데브 products 시드를 라이브 기준으로 재정렬할지 결정 | 중 | 대기 |
| 3 | 환경별 drift 자동 모니터링 cron 추가 (이 스크립트 일 1회) | 중 | 대기 |
| 4 | 라이브 `/admin/` 와이어프레임 비공개 처리 (인증 없이 노출 + deprecated, 사용·업데이트 X) | 높음 | 대기 |
| 5 | `bongi_tickets` 정리 시도 → **롤백 완료** (잘못된 판단) | 완료 | **2026-05-17 롤백** |

## 6. 변경 로그

### 2026-05-17 — bongi_tickets 정리 → ⚠️ 즉시 롤백

**오해**: 운영 어드민(`calculator.html` JS 105)과 DB(`bongi_tickets` 949)가 불일치 → mock 누적으로 판단.
**실제**: 두 시스템 모두 운영 중이지만 **다른 흐름**:
- 어드민 105개 = TM 견적/상담 계산기 표시값 (JS 메모리)
- DB 949개 = **봉이 메인 고객 사이트**(bongi-mobile.com)의 신청 카탈로그

**증거**: `bongi_applications` (rows=10) `product_ticket` 컬럼에 SK0188 / KT0311 / LG0079 / SK0398 / KT0146 등 **105 범위 밖** 티켓번호로 실제 신청 데이터 존재.

**작업**:
1. 19:30 — UPDATE bongi_tickets SET is_active=false (897건) — ❌ 잘못된 판단
2. 20:30 — bongi_applications 발견 → 즉시 롤백 (897건 is_active=true 복원, updated_at='2026-05-17' 조건으로 안전 타겟)
3. 결과: 정리 전 상태와 100% 동일 (internet SK 450/KT 360/LG 192 모두 active, rental R 50 active+1 inactive)

**교훈**: 봉이 어드민 도메인(`incentive_*`)과 봉이 고객 사이트 도메인(`bongi_*`)을 별개 시스템으로 분리 인식. `bongi_tickets`는 incentive_* 외부 — 어드민 영향 점검 시 incentive_* 만 보면 안 됨.
