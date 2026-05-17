# API 카탈로그 — 라이브 어드민

> 라이브 (`https://admin.prexymarket.com`) 기준. `server/routes/` 자동 추출.

> 총 296 routes. 여기서는 **어드민 도메인 핵심** 위주로 정리.


## 인증 방식

- JWT (Supabase Auth ES256)
- Header: `Authorization: Bearer <access_token>`
- 로그인: `POST /api/auth/login` { email, password } → `{ access_token, refresh_token, user, agent }`
- 갱신: `POST /api/auth/refresh` { refresh_token } → 새 access_token
- 미들웨어: `authenticateJWT` (JWT 검증) + `requireMinRole('agent'/'manager'/'admin')` (role 위계)

## Role 위계 (낮음 → 높음)

`contract` < `agent` < `manager` < `admin`
- `requireMinRole('agent')`: agent 이상 통과
- `requireMinRole('manager')`: manager·admin 통과
- `requireMinRole('admin')`: admin만 통과

---

## `routes/incentive.js` — 66 routes

| method | auth | min role | endpoint |
|---|---|---|---|
| POST | ✓ | - | `/api/incentive/admin/create-agent` |
| GET | ✓ | - | `/api/incentive/agents` |
| POST | ✓ | - | `/api/incentive/agents` |
| PATCH | ✓ | - | `/api/incentive/agents/:id` |
| DELETE | ✓ | - | `/api/incentive/agents/:id` |
| POST | ✓ | - | `/api/incentive/agents/:id/reset-password` |
| POST | ✓ | - | `/api/incentive/agents/:id/restore` |
| GET | ✓ | - | `/api/incentive/agents/all` |
| GET | ✓ | - | `/api/incentive/agents/me` |
| POST | ✓ | - | `/api/incentive/calc-history` |
| GET | ✓ | - | `/api/incentive/calc-history` |
| GET | ✓ | - | `/api/incentive/calc-overrides` |
| PUT | ✓ | - | `/api/incentive/calc-overrides/:section` |
| GET | ✓ | - | `/api/incentive/contracts` |
| POST | ✓ | - | `/api/incentive/corrections` |
| GET | ✓ | - | `/api/incentive/corrections` |
| POST | ✓ | - | `/api/incentive/corrections/:id(\\d+)/reject` |
| POST | ✓ | - | `/api/incentive/corrections/:id(\\d+)/resolve` |
| GET | ✓ | - | `/api/incentive/dashboard/timeseries` |
| GET | ✓ | - | `/api/incentive/db-sources` |
| POST | ✓ | - | `/api/incentive/db-sources` |
| PATCH | ✓ | - | `/api/incentive/db-sources/:id` |
| DELETE | ✓ | - | `/api/incentive/db-sources/:id` |
| GET | ✓ | - | `/api/incentive/db-sources/all` |
| GET | ✓ | - | `/api/incentive/dealers` |
| POST | ✓ | - | `/api/incentive/dealers` |
| PATCH | ✓ | - | `/api/incentive/dealers/:id(\\d+)` |
| DELETE | ✓ | - | `/api/incentive/dealers/:id(\\d+)` |
| POST | ✓ | - | `/api/incentive/finalize` |
| GET | ✓ | - | `/api/incentive/gift-vouchers` |
| POST | ✓ | - | `/api/incentive/gift-vouchers` |
| PATCH | ✓ | - | `/api/incentive/gift-vouchers/:id(\\d+)` |
| DELETE | ✓ | - | `/api/incentive/gift-vouchers/:id(\\d+)` |
| GET | ✓ | - | `/api/incentive/goals` |
| POST | ✓ | - | `/api/incentive/goals` |
| DELETE | ✓ | - | `/api/incentive/goals/:id(\\d+)` |
| GET | ✓ | - | `/api/incentive/manager-exemptions` |
| POST | ✓ | - | `/api/incentive/manager-exemptions` |
| DELETE | ✓ | - | `/api/incentive/manager-exemptions/:id` |
| GET | ✓ | - | `/api/incentive/manager-overrides` |
| GET | ✓ | - | `/api/incentive/manager/overview` |
| GET | · | - | `/api/incentive/products` |
| PATCH | ✓ | - | `/api/incentive/products/:id` |
| GET | ✓ | - | `/api/incentive/products/history` |
| GET | ✓ | - | `/api/incentive/role-permissions` |
| PUT | ✓ | - | `/api/incentive/role-permissions/:role` |
| GET | ✓ | - | `/api/incentive/role-permissions/history` |
| GET | ✓ | - | `/api/incentive/role-permissions/me` |
| GET | · | - | `/api/incentive/rules` |
| POST | ✓ | - | `/api/incentive/rules` |
| PATCH | ✓ | - | `/api/incentive/rules/:id` |
| GET | ✓ | - | `/api/incentive/rules/all` |
| GET | ✓ | - | `/api/incentive/sales` |
| POST | ✓ | - | `/api/incentive/sales` |
| GET | ✓ | - | `/api/incentive/sales-history` |
| PATCH | ✓ | - | `/api/incentive/sales/:id` |
| DELETE | ✓ | - | `/api/incentive/sales/:id` |
| GET | ✓ | - | `/api/incentive/sales/:id/history` |
| GET | ✓ | - | `/api/incentive/sales/:id/quote` |
| POST | ✓ | - | `/api/incentive/sales/:id/restore` |
| GET | ✓ | - | `/api/incentive/settlement` |
| POST | · | - | `/api/incentive/simulate` |
| GET | ✓ | - | `/api/incentive/tm/memos` |
| PUT | ✓ | - | `/api/incentive/tm/memos` |
| GET | ✓ | - | `/api/incentive/tm/scripts` |
| PUT | ✓ | - | `/api/incentive/tm/scripts` |

## `routes/auth.js` — 10 routes

| method | auth | min role | endpoint |
|---|---|---|---|
| POST | ✓ | - | `/api/auth/2fa/disable` |
| POST | ✓ | - | `/api/auth/2fa/setup` |
| GET | ✓ | - | `/api/auth/2fa/status` |
| POST | ✓ | - | `/api/auth/2fa/verify` |
| POST | ✓ | - | `/api/auth/change-password` |
| POST | · | - | `/api/auth/login` |
| GET | ✓ | - | `/api/auth/me` |
| POST | · | - | `/api/auth/refresh` |
| POST | · | - | `/api/auth/signup` |
| POST | ✓ | - | `/api/auth/social-profile` |

## `routes/dashboard.js` — 3 routes

| method | auth | min role | endpoint |
|---|---|---|---|
| GET | · | - | `/admin/agents` |
| POST | · | - | `/admin/report` |
| GET | · | - | `/admin/reports` |

## `routes/crm.js` — 14 routes

| method | auth | min role | endpoint |
|---|---|---|---|
| GET | · | - | `/api/crm/agents` |
| GET | · | - | `/api/crm/agents/:id/performance` |
| GET | · | - | `/api/crm/applications` |
| POST | · | - | `/api/crm/consultations` |
| PATCH | · | - | `/api/crm/consultations/:id` |
| POST | · | - | `/api/crm/contracts` |
| GET | · | - | `/api/crm/customers` |
| GET | · | - | `/api/crm/customers/:id` |
| PATCH | · | - | `/api/crm/customers/:id` |
| GET | · | - | `/api/crm/customers/:id/consultations` |
| GET | · | - | `/api/crm/customers/:id/contracts` |
| GET | · | - | `/api/crm/dashboard/stats` |
| POST | · | - | `/api/crm/incentive/calculate` |
| GET | · | - | `/api/crm/incentive/info` |

## `routes/cti.js` — 10 routes

| method | auth | min role | endpoint |
|---|---|---|---|
| GET | · | - | `/api/cti/agent/:agentId` |
| POST | · | - | `/api/cti/answer/:callId` |
| POST | · | - | `/api/cti/call` |
| GET | · | - | `/api/cti/call/:callId` |
| GET | · | - | `/api/cti/events/:callId` |
| POST | · | - | `/api/cti/hangup/:callId` |
| POST | · | - | `/api/cti/hold/:callId` |
| POST | · | - | `/api/cti/resume/:callId` |
| POST | · | - | `/api/cti/simulate-incoming` |
| POST | · | - | `/api/cti/transfer/:callId` |

## `routes/cache.js` — 2 routes

| method | auth | min role | endpoint |
|---|---|---|---|
| POST | · | - | `/api/cache/clear` |
| GET | · | - | `/api/cache/stats` |

---

## 나머지 라우트 파일 (요약)

| 파일 | route 수 |
|---|---|
| `routes/admin-platform.js` | 63 |
| `routes/ai.js` | 3 |
| `routes/alarms.js` | 4 |
| `routes/applications.js` | 2 |
| `routes/cash.js` | 5 |
| `routes/chat.js` | 6 |
| `routes/customer-db.js` | 42 |
| `routes/mock.js` | 23 |
| `routes/policy-docs.js` | 5 |
| `routes/products.js` | 4 |
| `routes/referrals.js` | 5 |
| `routes/rental.js` | 19 |
| `routes/reviews.js` | 3 |
| `routes/special-promo.js` | 5 |
| `routes/stores.js` | 2 |

## 사용 예시 (curl)

```bash
# 1) 로그인
TOKEN=$(curl -s -X POST https://admin.prexymarket.com/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin1@bongi.test","password":"<REDACTED>"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

# 2) 어드민 권한 매트릭스 조회
curl https://admin.prexymarket.com/api/incentive/role-permissions \
  -H "Authorization: Bearer $TOKEN"

# 3) 콜DB 목록 (admin 전용 + IP 화이트리스트)
curl https://admin.prexymarket.com/api/customer-db?ym=2026-05 \
  -H "Authorization: Bearer $TOKEN"
```