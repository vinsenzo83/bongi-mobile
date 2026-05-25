# 👥 고객관리 페이지 PRD (incentive-customer-mgmt 전면 개편)

- **작성일**: 2026-05-25
- **작성자**: vinsenzo + Claude
- **대상 파일**: `docs/incentive-customer-mgmt.html` (현재 267줄 → 전면 개편)
- **버전**: V1.0
- **본질 근거**: `~/.claude/projects/-Users-vinsenzo/memory/project_bongi_unified_customer.md`

---

## 1. 배경 · 본질

### 1.1 봉이모바일 서비스 본질 (한 줄)
> **"여러 채널에서 유저가 유입된다. 전화번호 기준으로 통합한다. 웹·앱·매장은 리드(lead) 채널이고, 실제 계약은 TM CRM에서 콜로 마무리(close)한다. 양쪽 어드민은 양방향 연동된다. 모든 결과(계약·페이백·포인트)는 고객 마이페이지에 즉시 반영된다."**

### 1.2 현재 페이지 빈약 진단

현재 `incentive-customer-mgmt.html` (267줄):
- ✅ 좌측 list + 우측 상세 6 카드 (콜백 알람·기본 정보·통화 timeline·계약 이력)
- ❌ **누락된 본질 7가지**:
  1. 4상품 cross-sell view 없음
  2. 다채널 인입 추적 (매장·콜·웹·앱) 없음
  3. 회원 통합 (bongi_user_profiles + PASS) 없음
  4. 금융 lifecycle (페이백·포인트·친구초대) 없음
  5. 돈지키미 약정 알람 없음
  6. 재계약·환수·해지 lifecycle 없음
  7. NBA (다음 행동 추천) 없음

### 1.3 현황 실측 데이터 (2026-05-25 라이브)

| 영역 | 건수 | 비고 |
|---|---|---|
| 콜DB total | 3,114 | 마감원장 import 누적 |
| 통화 로그 | 11 | ⚠️ 매우 적음 (수기 입력 부족) |
| 인터넷+TV 영업 | 26 | |
| 가전 영업 | 3 | 가전 unique 고객 3명 |
| bongi 회원 | 13 | MVP 초기 |
| bongi 신청 | 10 | 셀프신청 |
| 페이백 (지급대기) | 3/8 | 현금 페이백 |
| 포인트 잔액 보유자 | 4 | |
| 친구초대 | 3 | |
| 돈지키미 알람 | 7 | 약정 만료 |

---

## 2. 목표 · KPI

| 지표 | 현재 | 목표 (3개월) |
|---|---|---|
| 통화 로그 입력률 | 11/3,114 = 0.4% | **80%+** |
| 콜DB → 계약 전환율 | 26/3,114 = 0.8% | **3%+** |
| 평균 콜 시도 횟수 | 측정 불가 | **3회 이상** |
| 재계약 유도 클릭 (NBA) | 미구현 | **계약자 30%** |
| 회원 매칭률 (전화번호) | 미측정 | **95%+** |

---

## 3. 사용자 (4 roles)

| Role | 권한 | 주요 사용 |
|---|---|---|
| **admin** | 전 고객 view·편집·통계 | 운영 분석 |
| **manager** | 부서 고객 view·재분배 | 팀 KPI |
| **agent** | 본인 분배 고객만 view·콜 시도·계약 등록 | 일상 close 작업 |
| **contract** | 계약 처리 권한 (status 변경·금액 수정) | 계약 확정 |

---

## 4. 핵심 기능 spec

### 4.1 좌측 리드 통합 list

**컬럼**:
- 🏷️ Status badge (신규 / 시도중 / 견적전달 / 결정대기 / 계약완료 / 거절 / 휴면)
- 👤 이름 + 전화번호 (마스킹 010-****-1234)
- 📍 채널 chip (📞콜DB · 🌐웹셀프 · 📱앱 · 🏪매장 · 🔄중고폰 · 🤖AI)
- 🔖 등급 (S/A/B/R/C)
- 📅 마지막 콜 (며칠 전) + 다음 콜 예정
- ⏰ 리드 age (며칠 됐는지 · 7일+ 노란 · 14일+ 빨강 — "rotting lead")
- 💰 보유 상품 chip (인터넷 · 가전 · 휴대폰 · 중고폰)
- 🚨 NBA badge ("재계약 유도", "cross-sell 기회", "페이백 미수령")

**필터**:
- Status · 채널 · 등급 · 담당 상담사 · 부서 · 인입 일자 range
- 검색: 이름·전화·티켓번호

**정렬**:
- 우선순위 자동 (S > rotting > 신규)
- 또는 수동 정렬

### 4.2 우측 고객 360° 패널

**구성** (위→아래):

#### A. 회원 헤더 (회원 매칭 자동)
- 이름 (PASS > 카카오 > 구글 > 셀프 > CRM 우선순위)
- 전화번호 (마스킹 토글)
- PASS 인증 chip (✅ / ❌)
- 앱회원 여부 chip
- 소셜 (카카오·구글)
- 회원 가입일

#### B. 다채널 인입 history (시간순)
```
2026-05-20 📞 콜DB 분배 (등급 S)
2026-05-18 🌐 셀프신청 (인터넷+TV 견적 요청)
2026-05-15 🤖 AI 채팅 (정수기 문의)
2026-05-10 🏪 매장 방문 (광주 1호점, 휴대폰 시세 청취)
```

#### C. 통화 시도 timeline + 다음 콜 예약
- 각 통화: 시각·상담사·결과·요약 텍스트
- "📞 콜 시도" 액션 버튼 → 통화 결과 입력 모달
- "📅 다음 콜 예약" → datetime picker
- 콜백 알람 (오늘 예약 있을 때 강조)

#### D. 4상품 cross-sell 보드
- 🔵 인터넷+TV (해당 고객 계약 N건 · 페이백 합계)
- 🟢 가전렌탈 (계약 N건 · R티켓 list)
- 🟠 휴대폰 (매장 방문 history)
- 🟣 중고폰 (매입 history + Tredit 시세)

각 칸: "✅ 계약 X건" / "❗ 견적 보냄 미결정" / "○ 미접촉" 상태

#### E. 금융 lifecycle
- 💰 현금페이백 (지급대기 · 지급완료 · 합계)
- 🪙 포인트 잔액 + 누적 적립/출금
- 🎁 친구초대 받음/한 횟수
- ⏰ 돈지키미 약정 만료 알람

#### F. 다음 행동 추천 (NBA — Next Best Action)
- "인터넷 계약 6개월 경과 → 가전렌탈 권유"
- "페이백 지급대기 → 고객 안내"
- "약정 만료 30일 전 → 재계약 권유"
- "rotting 14일 → 마지막 시도 권유"

#### G. 콜 액션 카드 (sticky 하단)
- 📞 즉시 콜 시도 (전화 link)
- 📅 다음 콜 예약
- 📝 메모 추가
- 🚫 거절 처리 (사유 입력)
- 🔄 재분배 요청

### 4.3 일괄 액션 (admin/manager)

- 선택 다중 → 재분배·휴면 처리·우선순위 변경
- CSV export (PIPA 마스킹)
- 통계: 채널별 close rate · 평균 close 시간

---

## 5. 데이터 모델

### 5.1 통합 뷰 (신규)

```sql
CREATE OR REPLACE VIEW vw_unified_customer AS
SELECT
  cdb.phone AS phone,                             -- master key
  cdb.id AS calldb_id,
  cdb.name AS calldb_name,
  cdb.grade,
  cdb.assigned_agent_id,
  cdb.imported_at,
  -- 회원 매칭
  bup.id AS user_id,
  bup.name AS member_name,
  bup.kakao_id IS NOT NULL OR bup.google_id IS NOT NULL AS is_app_member,
  bup.pass_verified_at IS NOT NULL AS pass_verified,
  -- 통화 집계
  (SELECT count(*) FROM incentive_customer_call_log cl WHERE cl.customer_db_id = cdb.id) AS call_attempts,
  (SELECT max(call_at) FROM incentive_customer_call_log cl WHERE cl.customer_db_id = cdb.id) AS last_call_at,
  -- 영업 집계 (4상품)
  (SELECT count(*) FROM incentive_sales s WHERE s.customer_phone = cdb.phone AND s.status='완료') AS it_sales_count,
  (SELECT count(*) FROM rental_sales rs WHERE rs.customer_phone = cdb.phone AND rs.status='completed') AS rental_sales_count,
  (SELECT count(*) FROM bongi_used_phone_buyback bb WHERE bb.phone = cdb.phone) AS usedphone_count,
  -- 금융 lifecycle
  (SELECT count(*) FROM bongi_gifts g WHERE g.phone = cdb.phone AND g.status='지급대기') AS gifts_pending,
  (SELECT coalesce(sum(amount),0) FROM bongi_cash_balance cb WHERE cb.user_id = bup.id) AS cash_balance,
  -- 인입 채널 (마지막)
  CASE
    WHEN cdb.source = '셀프' THEN 'web'
    WHEN cdb.source = 'app' THEN 'app'
    WHEN cdb.source = '매장' THEN 'store'
    ELSE 'calldb'
  END AS last_channel,
  -- rotting (며칠 됐는지)
  EXTRACT(DAY FROM (NOW() - cdb.imported_at)) AS lead_age_days
FROM incentive_customer_db cdb
LEFT JOIN bongi_user_profiles bup ON bup.phone = cdb.phone;
```

### 5.2 인덱스 (성능)
- `incentive_customer_db (phone)` — master key 매칭
- `incentive_sales (customer_phone, status)`
- `rental_sales (customer_phone, status)`
- `bongi_user_profiles (phone)` — 회원 매칭
- `bongi_gifts (phone, status)`

### 5.3 RLS (Row-Level Security)
- agent: `assigned_agent_id = auth_user_id`만 SELECT
- manager: 부서원 agent_id 전부 SELECT
- admin/contract: 전부 SELECT

---

## 6. API spec (신규 endpoint)

### 6.1 통합 list
```
GET /api/incentive/customers/unified?status=&channel=&grade=&page=1&limit=50
→ { customers: [...], total: N }
```

### 6.2 단일 고객 360°
```
GET /api/incentive/customers/:phone/360
→ {
  member: {...},
  channels: [...],
  calls: [...],
  it_sales: [...],
  rental_sales: [...],
  usedphone: [...],
  gifts: [...],
  cash_balance, rewards, alarms,
  nba: [{type, message, action_url}]
}
```

### 6.3 콜 시도 기록
```
POST /api/incentive/customers/:phone/call-attempt
body: { result: '성공/거절/부재/콜백', summary: '...', next_call_at: '...' }
→ incentive_customer_call_log insert + customer_db status 갱신
```

### 6.4 NBA trigger
```
GET /api/incentive/customers/:phone/nba
→ 자동 추천 list (rule-based + 향후 Claude API)
```

### 6.5 양방향 sync trigger (DB trigger)
- `incentive_sales` insert (status='완료') → 7 자동 트리거 발사 (bongi_gifts insert 등)
- `bongi_applications` insert → `incentive_customer_db` upsert (없으면 신규)
- `bongi_gifts` update → CRM 알림 broadcast

---

## 7. UI/UX 골격

### 7.1 레이아웃
```
┌────────────────────────────────────────────────────┐
│ 👥 고객관리 [필터 toolbar]      [검색]  [📥 CSV]   │
├──────────────────┬─────────────────────────────────┤
│ 리드 통합 list   │ 고객 360° 패널 (sticky scroll)  │
│ (좌 35%)         │ (우 65%)                         │
│                  │                                  │
│ [Status filter]  │ A. 회원 헤더 + PASS chip         │
│ [채널 chip]      │ B. 다채널 인입 history (timeline)│
│                  │ C. 통화 timeline + 콜 액션       │
│ ☑ 홍길동 (S)     │ D. 4상품 cross-sell 보드 (2x2)   │
│   010-****-1234  │ E. 금융 lifecycle (4 KPI)        │
│   📞콜DB · 3일   │ F. NBA (다음 행동 추천)          │
│   [📞] [📅]      │ G. 콜 액션 카드 (sticky 하단)    │
│ ─────────────    │                                  │
│ ☐ 김영희 (A)     │                                  │
│   ...            │                                  │
└──────────────────┴─────────────────────────────────┘
```

### 7.2 다크 테마 (봉이 일관성)
- 배경: `#0f172a` · 카드 `#1e293b` · 강조 `#fbbf24`
- 채널 chip 색상:
  - 콜DB: `#a5b4fc` 인디고
  - 웹: `#60a5fa` 파랑
  - 앱: `#86efac` 초록
  - 매장: `#fbbf24` 황금
  - 중고폰: `#a78bfa` 보라
  - AI: `#67e8f9` 청록
- Status badge 색상:
  - 신규: 회색 · 시도중: 파랑 · 견적전달: 청록 · 결정대기: 황금 · 완료: 초록 · 거절: 빨강 · 휴면: 진회색
- Rotting age 색상:
  - 0-3일: 정상 · 4-7일: 노랑 · 8-14일: 주황 · 15일+: 빨강

---

## 8. 권한 매트릭스 (4 roles)

| 기능 | admin | manager | agent | contract |
|---|---|---|---|---|
| 전 고객 list | ✅ | 부서원만 | 본인 분배만 | ✅ |
| 고객 360° view | ✅ | 부서원만 | 본인 분배만 | ✅ |
| 콜 시도 기록 | ✅ | ✅ | ✅ (본인) | ❌ |
| 재분배 | ✅ | ✅ | 요청만 | ❌ |
| 계약 status 변경 | ✅ | ✅ | ❌ | ✅ |
| 금액 수정 | ✅ | ✅ | ❌ | ✅ |
| 휴면 처리 | ✅ | ✅ | ❌ | ❌ |
| CSV export (PIPA) | ✅ | ✅ | ❌ | ❌ |
| 통계 view | ✅ | ✅ (부서) | ❌ | ❌ |

---

## 9. 마이그레이션 + 롤백

### 9.1 마이그레이션 SQL (`server/db/2026-05-25-customer-unified-view.sql`)

```sql
BEGIN;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_incentive_sales_phone ON incentive_sales(customer_phone, status);
CREATE INDEX IF NOT EXISTS idx_rental_sales_phone ON rental_sales(customer_phone, status);
CREATE INDEX IF NOT EXISTS idx_bongi_user_profiles_phone ON bongi_user_profiles(phone);
CREATE INDEX IF NOT EXISTS idx_bongi_gifts_phone_status ON bongi_gifts(phone, status);

-- 통합 view
CREATE OR REPLACE VIEW vw_unified_customer AS ...;

-- 자동 트리거 (계약 close → bongi_gifts insert)
CREATE OR REPLACE FUNCTION trg_sales_to_gift() RETURNS trigger AS $$
BEGIN
  IF NEW.status = '완료' AND OLD.status != '완료' THEN
    INSERT INTO bongi_gifts (phone, amount, status, source_sale_id)
    VALUES (NEW.customer_phone, NEW.payback_snapshot, '지급대기', NEW.id)
    ON CONFLICT (source_sale_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_incentive_sales_to_gift
  AFTER UPDATE ON incentive_sales FOR EACH ROW
  EXECUTE FUNCTION trg_sales_to_gift();

CREATE TRIGGER trg_rental_sales_to_gift
  AFTER UPDATE ON rental_sales FOR EACH ROW
  EXECUTE FUNCTION trg_sales_to_gift();

COMMIT;
```

### 9.2 롤백
```sql
DROP TRIGGER IF EXISTS trg_incentive_sales_to_gift ON incentive_sales;
DROP TRIGGER IF EXISTS trg_rental_sales_to_gift ON rental_sales;
DROP FUNCTION IF EXISTS trg_sales_to_gift();
DROP VIEW IF EXISTS vw_unified_customer;
-- 인덱스는 유지 (성능)
```

---

## 10. 5라운드 검증 plan

| Round | 영역 |
|---|---|
| **R1 JS 무결성** | 신규 페이지 SyntaxError·const 충돌·BroadcastChannel scope |
| **R2 데브↔라이브** | 마이그레이션 양쪽 적용·view·trigger 검증 |
| **R3 보안** | RLS 4 roles · PIPA 마스킹 · trigger SECURITY DEFINER |
| **R4 성능** | view 쿼리 시간 (3,114 row) · PostgREST max-rows 1000 cap |
| **R5 4 roles E2E** | admin·manager·agent·contract 각 시나리오 |

---

## 11. 자동 audit 체크리스트

- [ ] **listCols 4곳 동기화** (HTML · destructure · update · listCols)
- [ ] **전화번호 master key** join 일관성
- [ ] **라이브·데브 양쪽 적용** (마이그레이션·view·trigger)
- [ ] **snapshot 박제** — 계약 변경 시 기존 페이백·포인트 보존
- [ ] **RLS 정책** 신규 view에 적용
- [ ] `(select auth.uid())` 패턴 (initplan 최적화)
- [ ] **Sentry alert** 신규 endpoint 추가
- [ ] **SW_VERSION 증가** + cache-buster
- [ ] **PIPA 마스킹** 전화·이름·주소 (`010-****-1234`)
- [ ] **빈 값 PATCH 함정** (`val !== ''` 체크)
- [ ] **CLAUDE.md 갱신** 신규 도메인 룰
- [ ] **incentive-manual.html 동기화** (룰)
- [ ] **양방향 sync trigger 검증** (계약→마이페이지 즉시 반영)

---

## 12. 다음 step

1. ✅ **PRD 작성** (이 문서)
2. ⏭️ **와이어프레임 prototype** (`docs/wireframes/customer-mgmt.html`)
3. ⏭️ **사용자 확인 + 의견 수렴**
4. ⏭️ **DB 마이그레이션 + endpoint 구현**
5. ⏭️ **UI 구현 (incentive-customer-mgmt.html 전면 개편)**
6. ⏭️ **양방향 sync 검증 + 매뉴얼 동기화**
7. ⏭️ **라이브 배포 + 5라운드 검증**

---

## 13. 관련 문서

- `~/.claude/projects/-Users-vinsenzo/memory/project_bongi_unified_customer.md`
- `~/.claude/projects/-Users-vinsenzo/memory/project_bongi_customer_db.md`
- `docs/master-map.html` (서비스 본질)
- `docs/incentive-manual.html` (운영 매뉴얼)
- `docs/incentive-customer-db.html` (콜DB 관리 — 같은 데이터원)
