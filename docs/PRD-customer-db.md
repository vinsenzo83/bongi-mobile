# 📋 봉이 콜 DB CRM 시스템 — 제품 요구 명세서 (PRD)

**버전**: v1.0
**작성일**: 2026-05-06
**상태**: 검토 단계 (개발 시작 전)
**대상 도메인**: `admin.prexymarket.com`

---

## 1. 개요

### 1.1 비즈니스 목적
매일 입수되는 고객 DB(엑셀)를 시스템에 적재 → 상담사에게 자동 분배 → 콜 결과 누적 관리 → TM 상담 화면에서 계약 전환 → V5/V5.1 인센티브 자동 반영.

### 1.2 규모 / 성능 목표
- 누적 100만+ 건 (월별 파티션)
- 매일 1만~5만건 import
- 동시 접속 상담사 5~30명
- 본인 콜 list 페이징 < 100ms

### 1.3 외부 시스템
- **CTI**: 타사 솔루션 별도 사용. 봉이는 CRM 부분만 담당. 연동 X (수동 다이얼)

### 1.4 봉이 기존 시스템 통합
- `incentive_db_sources` 재사용
- `incentive_agents` 분배 대상
- `incentive_sales` 계약 전환 자동 생성
- `incentive_calc_*` RPC 정산 자동 반영 (V5 + V5.1)
- `tm-counselor.html` 콜 작업 화면으로 확장

---

## 2. 페르소나

| Role | 핵심 작업 |
|---|---|
| **admin** | 매일 엑셀 import / 분배 / DB 출처 관리 / ROI 분석 / 컴플라이언스 / IP 관리 |
| **manager** (팀장) | 본인 센터 진척률 / 코칭 / 본인도 콜 가능 |
| **agent** (상담사) | 본인 콜 큐 / 통화 (외부 CTI) / 결과 1클릭 / 계약 전환 |
| **contract** | 계약 처리 (현재 시스템 그대로) |

---

## 3. 핵심 시나리오

### 3.1 매일 아침 import (admin)
1. admin이 엑셀 업로드 → DB 출처 + batch_id 자동 생성
2. 검증 (전화번호 형식, 중복, 동의 여부, 필수 필드)
3. PostgreSQL `COPY`로 적재 (10만건 < 1분)
4. 분배 정책 선택 → 자동 또는 수동 분배
5. 상담사 화면에 신규 큐 도착

### 3.2 상담사 콜 (agent)
1. 사이드바 **📋 내 콜** 클릭
2. 우선순위 큐 자동 정렬:
   - ① callback 약속 시간순 (오늘)
   - ② 신규 미연락
   - ③ 재시도 (부재 1H 후 / 거절 30D 후)
3. 고객 클릭 → TM 상담 화면 진입 (`?customer_id=X`)
4. 정보 prefill + 이전 시도 이력 표시
5. 번호 [📋 복사] → 외부 CTI에 붙여넣고 통화
6. 통화 종료 → 결과 1클릭:
   - `[1] 부재` → 1H 후 큐 재진입
   - `[2] 거절(사유)` → 30D 후 재시도 또는 영구 DNT
   - `[3] 콜백(시간)` → 약속 시간에 큐 최상단
   - `[4] 계약가능` → TM 견적 작성 → [✅ 계약 완료]
7. 다음 고객 자동 진입

### 3.3 계약 전환 (TM 상담 기존 흐름 활용)
1. 견적 작성 (통신사·속도·TV·페이백·DB 출처)
2. [✅ 이 견적으로 계약 완료] 클릭
3. `incentive_sales` 자동 생성 + `customer_db.converted_sale_id` 연결 + `call_status='converted'`
4. 정산 RPC 자동 반영 (V5 인센티브 + V5.1 팀장 오버라이드)
5. 다음 고객 자동

---

## 4. 데이터 모델

### 4.1 `incentive_customer_db` (월별 파티션)
```sql
CREATE TABLE incentive_customer_db (
  id BIGSERIAL,
  -- 고객 정보
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  age INTEGER,
  gender TEXT,
  region TEXT,
  carrier TEXT,
  notes TEXT,  -- 상담사 콜 메모 전용 (import 시 자동 박지 않음)
  -- 등급 시스템 (2026-05-12 확정 — S/A/B/R/C 5단계)
  tier SMALLINT,  -- 1=인터넷 없음(휴대폰 영업) / 2=인터넷 보유(렌탈 영업)
  category TEXT,  -- 이동·신규·기변·렌탈권유·기타
  quality_grade TEXT CHECK (quality_grade IN ('S','A','B','R','C')),
  -- 마감원장 원본 메모
  memo_etc TEXT,         -- '기타' 컬럼
  memo_activation TEXT,  -- '개통실 메모' 컬럼 (분류 룰엔 사용하지 않음)
  -- 마감원장 원본 row 보존 (jsonb array)
  source_data JSONB,
  -- 개인정보보호
  consent_status TEXT DEFAULT 'unknown',  -- 'agreed'/'declined'/'unknown'
  consent_date DATE,
  data_retention_until DATE,  -- 자동 삭제 예정일
  -- DB 출처
  db_source_id INTEGER REFERENCES incentive_db_sources(id),
  imported_batch_id UUID NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  imported_by_user_id UUID,
  -- 분배
  assigned_agent_id UUID REFERENCES incentive_agents(id),
  assigned_at TIMESTAMPTZ,
  assigned_by_user_id UUID,
  priority_score INTEGER DEFAULT 0,
  -- 콜 상태
  call_status TEXT DEFAULT 'pending',
    -- pending / contacted / callback / rejected / converted /
    -- no_answer / wrong_number / dnt / archived
  last_contacted_at TIMESTAMPTZ,
  call_count INTEGER DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  callback_at TIMESTAMPTZ,
  result_notes TEXT,
  reject_reason TEXT,  -- '약정중'/'관심없음'/'가격'/'기타'
  is_dnt BOOLEAN DEFAULT FALSE,
  -- 결과
  converted_sale_id UUID REFERENCES incentive_sales(id),
  -- 정리
  archived BOOLEAN DEFAULT FALSE,
  archived_at TIMESTAMPTZ,
  archived_reason TEXT,
  deleted_at TIMESTAMPTZ,  -- soft delete
  -- 메타
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, imported_at)
) PARTITION BY RANGE (imported_at);

-- 월별 파티션 (자동 생성 cron 또는 pg_partman)
CREATE TABLE incentive_customer_db_2026_05 PARTITION OF incentive_customer_db
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

-- 인덱스
CREATE INDEX idx_cust_assigned_status ON incentive_customer_db(assigned_agent_id, call_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_cust_phone ON incentive_customer_db(phone) WHERE deleted_at IS NULL;
CREATE INDEX idx_cust_batch ON incentive_customer_db(imported_batch_id);
CREATE INDEX idx_cust_retry ON incentive_customer_db(next_retry_at) WHERE call_status IN ('pending','no_answer','callback') AND deleted_at IS NULL;
CREATE INDEX idx_cust_callback ON incentive_customer_db(callback_at) WHERE callback_at IS NOT NULL AND deleted_at IS NULL;
-- 부분 검색 (이름·전화)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_cust_name_trgm ON incentive_customer_db USING gin (name gin_trgm_ops);
CREATE INDEX idx_cust_phone_trgm ON incentive_customer_db USING gin (phone gin_trgm_ops);

-- UNIQUE: 같은 출처 같은 전화번호 1건
CREATE UNIQUE INDEX uq_cust_source_phone ON incentive_customer_db(db_source_id, phone) WHERE deleted_at IS NULL;
```

#### 4.1.1 등급 시스템 (quality_grade) — 2026-05-12 확정

마감원장 import 시 자동 분류되는 5단계 영업 우선순위.

| 등급 | tier | category | basePriority | 영업 방향 |
|:---:|:---:|:---|:---:|:---|
| **S** | 1 | 이동 | 100 | 🥇 1순위 — 인터넷·TV 권유 (통신사 이동·결합 자유) |
| **A** | 1 | 신규 | 80 | 🥈 1순위 — 인터넷·TV 권유 (신규·결합 자유) |
| **B** | 1 | 기변 | 60 | 🥉 1순위 — 인터넷·TV 권유 (기존 결합 협의) |
| **R** | 2 | 렌탈권유 | 50 | 🏠 2순위 — 렌탈 가전 권유 (이미 결합 中) |
| **C** | 1 | 기타 | 10 | 후순위 — 분류 미확정 |

**분배 정렬**: `priority_score DESC NULLS LAST → imported_at ASC` 단일 기준.
→ S→A→B→R→C 순서 자동 노출 (priority_score 100→80→60→50→10).

#### 4.1.2 인터넷·TV 회선 식별 룰 (R 등급 조건) — 2026-05-12 확정

마감원장 row의 **단말 컬럼이 정확히 "인+TV" 또는 "인터넷"** 인 경우만 tier=2 (R 등급) 분류.

```js
const isInternetTV = (row) => {
  const model = String(row['단말'] || '').trim();
  return ['인+TV', '인터넷'].includes(model);
};
```

**의도적으로 사용하지 않는 매칭 (false positive 위험)**:
- ❌ 유형 = "유선" → 휴대폰 약정유형 표기와 혼동
- ❌ 단말 prefix "인" → '인'으로 시작하는 다른 단말 광범위 매칭
- ❌ 결제유형 컬럼(공/선·현/할) = "유선" → 휴대폰 약정 표기
- ❌ 메모(기타·개통실 메모·비고) "유선"·"결합" 키워드 → 다른 사람 인터넷에 본인 결합되는 케이스 다수 (예: "개통후결합-박종국" = 박종국 인터넷에 본인 휴대폰만 합류)

**한계**: 단말 정확 매칭만으로는 "다른 사람 인터넷에 결합된 휴대폰 가입자"를 자동 식별 불가. TM 상담 시 상담사가 `memo_etc` 메모를 보고 판단.

#### 4.1.3 9단계 import 필터 (제외 룰)

| 단계 | 룰 | 기본값 | 동작 |
|:---:|:---|:---|:---|
| 1 | 워치 prefix | `L` | 단말이 이 글자로 시작하면 row 제외 |
| 2 | 연령 min | `19` | 만 나이가 이 값 미만 제외 (PIPA) |
| 3 | 연령 max | `100` | 이 값 초과 제외 |
| 4 | 전화 정규식 | `^01[016789][0-9]{7,8}$` | 한국 휴대폰만 통과 |
| 5 | 이름 빈값 | — | 공백·null 제외 |
| 6 | 생년월일 빈값 | — | null 제외 |
| 7 | 이름+생년월일 통합 | — | 같은 사람 여러 회선 → 우선순위 높은 1건 |
| 8 | category 결정 | 이동→신규→기변→기타 | tier=1만 적용 (tier=2는 '렌탈권유') |
| 9 | quality_grade 매핑 | 위 표 4.1.1 | tier·category → S/A/B/R/C |

**룰 저장 위치**: `incentive_calculator_overrides.section='import_rules'` (jsonb)
**변경 audit**: `incentive_calculator_history`
**적용 시점**: 다음 마감원장 import부터 (기존 customer 영향 없음)

#### 4.1.4 중복 방지 4중

| 단계 | 방식 | 처리 |
|:---:|:---|:---|
| 1 | 이름+생년월일 통합 | 같은 사람 → 우선순위 높은 1건 대표 |
| 2 | 전화번호 충돌 | priority_score 높은 1건 `available`, 나머지 `on_hold` |
| 3 | DB UNIQUE(db_source_id, phone) | INSERT 시 23505 → duplicate++ |
| 4 | batch 내부 dups | 1·2단계에서 제거 |

### 4.2 `incentive_customer_call_log` (월별 파티션)
```sql
CREATE TABLE incentive_customer_call_log (
  id BIGSERIAL,
  customer_id BIGINT NOT NULL,
  agent_id UUID NOT NULL REFERENCES incentive_agents(id),
  called_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  result TEXT NOT NULL,  -- no_answer/rejected/callback/converted/wrong_number
  notes TEXT,
  callback_at TIMESTAMPTZ,
  reject_reason TEXT,
  PRIMARY KEY (id, called_at)
) PARTITION BY RANGE (called_at);

CREATE INDEX idx_calllog_customer ON incentive_customer_call_log(customer_id, called_at DESC);
CREATE INDEX idx_calllog_agent ON incentive_customer_call_log(agent_id, called_at DESC);
```

### 4.3 `incentive_customer_db_access_log` (개인정보보호)
```sql
CREATE TABLE incentive_customer_db_access_log (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL,
  accessed_by_user_id UUID NOT NULL,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action TEXT NOT NULL,  -- view/copy/search/export
  ip TEXT,
  user_agent TEXT,
  metadata JSONB
);
CREATE INDEX idx_access_user ON incentive_customer_db_access_log(accessed_by_user_id, accessed_at DESC);
CREATE INDEX idx_access_customer ON incentive_customer_db_access_log(customer_id, accessed_at DESC);
```

### 4.4 `incentive_customer_import_batch`
```sql
CREATE TABLE incentive_customer_import_batch (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  db_source_id INTEGER REFERENCES incentive_db_sources(id),
  imported_by_user_id UUID NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_count INTEGER NOT NULL DEFAULT 0,
  valid_count INTEGER NOT NULL DEFAULT 0,
  invalid_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',  -- active/rolled_back/expired
  rolled_back_at TIMESTAMPTZ,
  rolled_back_by_user_id UUID,
  rolled_back_reason TEXT,
  notes TEXT
);
```

### 4.5 `incentive_ip_whitelist` (보안 — OFF 상태로 시작)
```sql
CREATE TABLE incentive_ip_whitelist (
  id BIGSERIAL PRIMARY KEY,
  ip TEXT NOT NULL,  -- v4 또는 CIDR
  label TEXT,
  expires_at TIMESTAMPTZ,
  created_by_user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  active BOOLEAN DEFAULT TRUE
);

-- 글로벌 활성화 플래그 (env 또는 별도 테이블)
-- IP_WHITELIST_ENABLED=false (default) → middleware 패스
```

---

## 5. API 명세

### 5.1 Import
```
POST   /api/incentive/customer-db/import
  multipart: file (xlsx/csv)
  body: { db_source_id }
  → 검증 → batch 생성 → COPY 적재 → 결과 리턴
  
GET    /api/incentive/customer-db/batches?limit=50&status=active
  → 최근 batch list

POST   /api/incentive/customer-db/batches/:id/rollback
  body: { mode: 'all' | 'unconfirmed_only', reason }
  → soft delete (30일 휴지통)
```

### 5.2 List + 검색
```
GET    /api/incentive/customer-db?
  agent_id=&status=&db_source_id=&q=&limit=50&cursor=
  → 페이징 (max 100건/req)
  → access_log 자동 기록

GET    /api/incentive/customer-db/:id
  → 단건 + 콜 이력 묶음
```

### 5.3 분배
```
POST   /api/incentive/customer-db/distribute
  body: {
    batch_id (또는 filter),
    method: 'round_robin' | 'manual' | 'proportional',
    agent_ids: [...]  // 분배 대상
  }
  → 자동 분배 실행

PATCH  /api/incentive/customer-db/:id/assign
  body: { agent_id }
  → 단건 재분배
```

### 5.4 결과 기록
```
POST   /api/incentive/customer-db/:id/log
  body: { result, notes, callback_at, reject_reason }
  → call_log + customer 상태 동시 업데이트
  → 재컨택 룰 자동 (next_retry_at 계산)
  → DNT 명시 시 is_dnt=true

POST   /api/incentive/customer-db/:id/dnt
  → 영구 차단 (재컨택 거부 명시)
```

### 5.5 통계
```
GET    /api/incentive/customer-db/stats?month=YYYY-MM
  → 컨택률 / 전환율 / DB 출처별 ROI / 시간대별

GET    /api/incentive/customer-db/stats/agent/:id
  → 본인 KPI (오늘/이번달)
```

### 5.6 자동 재분배 (퇴사·휴직)
```
POST   /api/incentive/customer-db/redistribute
  body: { from_agent_id, to_agent_ids: [...] }
  → 미컨택만 재분배
```

### 5.7 컴플라이언스
```
GET    /api/incentive/customer-db/access-log?
  user_id=&customer_id=&date_from=&date_to=
  → 접근 로그 조회 (admin 전용)

POST   /api/incentive/customer-db/export
  body: { filter, reason }
  → admin 전용, 사유 필수, 자동 audit
  → 응답: 다운로드 URL (1회용 + 만료)
```

### 5.8 IP 화이트리스트
```
GET    /api/incentive/ip-whitelist
POST   /api/incentive/ip-whitelist
DELETE /api/incentive/ip-whitelist/:id
PATCH  /api/incentive/security/ip-whitelist-mode { enabled: true/false }
```

---

## 6. 화면 명세

### 6.1 📞 DB 관리 (admin 전용) — `/docs/incentive-customer-db.html`
- **Section 1: 엑셀 업로드**
  - 드래그+드롭 영역 / 클릭 업로드
  - DB 출처 select (필수)
  - 검증 미리보기 (유효 N건 / 오류 X건 / 중복 Y건)
  - [import 시작] 버튼
- **Section 2: Batch 관리**
  - 최근 30일 batch list (출처·날짜·건수·상태)
  - 각 행 [롤백] 버튼 → 모달 (전체 / 미컨택만)
  - [영구 삭제] 30일 후 자동
- **Section 3: 분배 관리**
  - 배치 선택 → 분배 정책 (라운드 로빈 / 비례 / 수동)
  - 대상 상담사 multi-select
  - [분배 실행]
- **Section 4: DB 출처 ROI**
  - 출처별 / 월별 표
  - 컬럼: 출처 / 도입 건수 / 컨택 / 전환 / ROI / 평균 매출
  - 시간대별 컨택률 차트

### 6.2 📋 내 콜 (agent / manager) — `/docs/incentive-call-list.html`
- **상단**: 본인 KPI 카드 (오늘 콜/컨택/계약/V5.1 진척)
- **사이드바 배지**: 🔔 오늘 callback N건
- **메인 큐 list**:
  - 우선순위 자동 정렬 (callback 시간 → 신규 → 재시도)
  - 컬럼: 이름 / 전화 / DB 출처 색상 / 지역 / 상태 / 다음 시도
  - 검색 (이름·전화 부분 매칭)
  - 상태 필터
  - 페이징 (50건)
- **각 행 클릭** → TM 상담 화면 (`?customer_id=X`)

### 6.3 📊 콜 현황 대시보드 (manager / admin) — `/docs/incentive-call-stats.html`
- 월/일별 KPI
- 본인 센터 / 전체 컨택률·전환율
- 상담사별 효율 표 (V5.1 페널티 위험 표시)
- DB 출처별 ROI
- 시간대별 컨택률 차트
- 분배 효율 (분배량 vs 처리량)

### 6.4 📞 TM 상담 (기존 확장) — `tm-counselor.html?customer_id=X`
- **콜 모드 진입 시 추가 UI**:
  - 상단 고객 카드 (정보 + 이전 시도 이력)
  - 전화번호 [📋 복사] 버튼 → 클립보드 + audit log
  - 좌측: 기존 견적 폼 (그대로)
  - 우측: 콜 결과 패널
    - [1] 부재 [2] 거절(사유) [3] 콜백(시간) [4] 계약가능
    - 메모 (자동 저장)
    - [⏭️ 다음 고객]
- **계약 완료 시**: sale 생성 + customer 상태 변경 + 다음 고객 자동
- **일반 모드**: 기존 화면 그대로 (영향 없음)

### 6.5 🔒 IP 화이트리스트 (admin 전용) — `/docs/incentive-security.html`
- 활성/비활성 토글 (기본 OFF)
- 등록 IP list + 라벨 + 만료일
- 임시 IP 추가 (만료일 설정)
- 비상 모드 (이메일 토큰)

---

## 7. 권한 매트릭스

| 기능 | admin | manager | agent | contract |
|---|---|---|---|---|
| 엑셀 import | ✅ | ❌ | ❌ | ❌ |
| Batch 롤백 | ✅ | ❌ | ❌ | ❌ |
| 분배 (수동/자동) | ✅ | ✅ 본인 센터 | ❌ | ❌ |
| DB 출처 관리 | ✅ | ❌ | ❌ | ❌ |
| 본인 콜 list | ✅ 전체 | ✅ 센터 | ✅ 본인 | ❌ |
| 다른 상담사 콜 보기 | ✅ | ✅ 센터 (마스킹 일부) | ❌ | ❌ |
| 통계 대시보드 | ✅ 전체 | ✅ 센터 | ✅ 본인 | ❌ |
| TM 상담 + 계약 전환 | ✅ | ✅ | ✅ | ❌ |
| 자동 폐기 / DNT 관리 | ✅ | ❌ | ❌ | ❌ |
| 개인정보 access log | ✅ | ❌ | ❌ | ❌ |
| Export | ✅ + 사유 | ❌ | ❌ | ❌ |
| 상담사 자동 재분배 | ✅ | ✅ 본인 센터 | ❌ | ❌ |
| IP 화이트리스트 관리 | ✅ | ❌ | ❌ | ❌ |
| 보안 설정 | ✅ | ❌ | ❌ | ❌ |

---

## 8. 운영 정책

### 8.1 개인정보보호법 컴플라이언스 (필수)
- 각 customer에 `consent_status` 컬럼 (동의/미동의/미상)
- 자동 삭제 cron: `data_retention_until` 도달 시 archived → 30일 후 영구 삭제
- 모든 개인정보 접근 audit log
- 화면 마스킹: 본인 분배 외 `010-****-5678`
- Export: admin 전용 + 사유 필수 + 자동 audit
- 인쇄 차단 (CSS `@media print { body { display:none } }`)
- 상담사 본인 분배 = 전체 표시 (콜 작업 필수)

### 8.2 잘못된 import 롤백
- batch 단위 30일 휴지통 보관
- 1클릭 복구 (rolled_back → active)
- 옵션:
  - **전체 삭제**: 해당 batch 모든 customer
  - **미컨택만 삭제**: 이미 콜 진행된 건은 보존
- 30일 경과 후 영구 삭제 cron

### 8.3 상담사 퇴사·휴직 자동 재분배
- `agents.active=false` 변경 시 (퇴사 가정):
  - 미컨택 customer → 자동 라운드 로빈 재분배
  - 진행 중(callback 약속 등)은 admin 수동 처리
- `agents.on_leave_until` 설정 시 (휴가):
  - 콜 큐 일시 정지
  - 만료일 자동 재개
- 신규 상담사 OJT (선택): 분배 비율 점진 증가 (1주차 30% → 3주차 100%)

### 8.4 재컨택 자동화 룰
| 결과 | 다음 컨택 | 정책 | 컬럼 |
|---|---|---|---|
| pending | 즉시 | 큐 진입 | next_retry_at = now |
| no_answer | 1시간 후 | 큐 재진입 | next_retry_at = now + 1H |
| callback | 약속 시간 | 알림 | callback_at |
| rejected | 30일 후 | 재시도 | next_retry_at = now + 30D |
| dnt | **영구** | 차단 | is_dnt=true |
| wrong_number | 즉시 archived | 폐기 | archived=true |
| 5회 미컨택 | **archived** | 자동 폐기 | call_count>=5 |
| 3년 미컨택 | **삭제** | 법적 보유 만료 | data_retention_until |

cron: 매시간 `next_retry_at` 도달 customer → 큐 재진입

### 8.5 DB 출처별 ROI 분석
- **데이터 집계**: import_batch 단위 + db_source 단위 + 월별
- **핵심 지표**:
  - 도입 건수 (n)
  - 컨택률 (contacted / n)
  - 콜백률 (callback / contacted)
  - 전환율 (converted / contacted)
  - 평균 매출 (sum revenue / converted)
  - **ROI** = (총 매출 × 0.9 − 총 페이백 − 인건비) / 도입 비용
- **시간대별** 컨택률 (출처마다 시간대 다름)
- admin 다음 DB 구매 결정 근거

---

## 9. 보안

### 9.1 즉시 적용
- ✅ Export 완전 차단 (admin도 사유+승인)
- ✅ API 응답 max 100건/요청 (페이징 강제)
- ✅ Rate Limit: 분당 60회 / 시간당 1000회 (IP+user)
- ✅ 워터마크 (사용자명·시간 반투명)
- ✅ 모든 접근 access_log
- ✅ 마스킹 (본인 분배 외)
- ✅ 인쇄 차단 (default ON)
- ✅ 우클릭·드래그 차단 (default OFF, admin 토글)

### 9.2 기능만 + 기본 OFF
- 🟡 2FA (TOTP) — admin부터 단계 적용
- 🟡 중복 로그인 차단
- 🟡 IP 화이트리스트
- 🟡 비상 모드 (이메일 토큰)

### 9.3 미적용
- ❌ 개발자 도구 감지 (효과 제한적, 디버그 방해)

---

## 10. 성능 요구

| 작업 | SLA | 기술 |
|---|---|---|
| 본인 콜 list 페이징 50 | < 100ms | 인덱스 (assigned_agent_id, call_status) |
| 검색 (이름·전화 trigram) | < 300ms | GIN trgm 인덱스 |
| import 10만건 (COPY) | < 1분 | PostgreSQL COPY + 파티션 |
| 자동 분배 10만건 | < 10초 | 단일 UPDATE 쿼리 |
| 통계 대시보드 | < 500ms | materialized view 또는 캐시 |
| 자동 폐기 cron | < 30초 | 배치 처리 |
| 재컨택 큐 갱신 cron | < 10초/시간 | 인덱스 + 부분 |
| Realtime 영업 갱신 | 1초 내 | Supabase Realtime + 디바운스 |

---

## 11. 봉이 기존 시스템 통합

| 자산 | 활용 |
|---|---|
| `incentive_db_sources` | 매일 import 시 db_source_id 지정 (그대로 재사용) |
| `incentive_agents` | assigned_agent_id 참조 + active 상태 자동 재분배 |
| `incentive_sales` | 계약 전환 시 자동 생성 (기존 POST /sales 호출) |
| `incentive_calc_monthly_settlement` | 정산 자동 반영 (V5) |
| `incentive_calc_manager_override` | V5.1 팀장 오버라이드 자동 |
| `incentive_sales_history` | 계약 변경 audit 자동 |
| `tm-counselor.html` | 콜 모드 hook (~30줄) 추가 |
| `incentive_role_permissions` | 신규 메뉴 entry 3개 추가 |
| 통합 어드민 사이드바 | 메뉴 3개 추가 (DB 관리/내 콜/콜 현황) |
| 대시보드 | 콜 통계 카드 추가 |
| Cloudflare CDN | 정적 자산 캐싱 그대로 |
| Service Worker | 그대로 |

---

## 12. Phase 마일스톤

### Phase 1 — 데이터 + import (3~4일)
**목표**: admin이 엑셀 import → 분배 → DB 적재 가능
- [ ] DB 스키마 + 월별 파티션 + 인덱스
- [ ] `incentive_customer_import_batch` + 30일 휴지통
- [ ] POST /customer-db/import (xlsx → CSV → COPY)
- [ ] POST /customer-db/distribute (라운드 로빈)
- [ ] POST /customer-db/batches/:id/rollback
- [ ] GET /customer-db (페이징 + 검색)
- [ ] access_log middleware
- [ ] Rate limit middleware
- [ ] 단위 테스트

### Phase 2 — 상담사 화면 + TM 확장 (2~3일)
**목표**: 상담사가 본인 큐 보고 콜 + 결과 기록 + 계약 전환
- [ ] `/docs/incentive-call-list.html`
- [ ] 우선순위 큐 + 검색 + 페이징
- [ ] TM 상담 콜 모드 (`?customer_id=X` hook)
- [ ] 결과 1클릭 (4가지) + 다음 고객 자동
- [ ] 재컨택 룰 cron (매시간)
- [ ] 통합 어드민 사이드바 메뉴 추가
- [ ] 권한 매트릭스 entry 추가

### Phase 3 — admin + 분석 (2~3일)
**목표**: admin이 import + 분배 + ROI 분석 + 자동 재분배
- [ ] `/docs/incentive-customer-db.html` (admin)
- [ ] Batch 관리 + 롤백 UI
- [ ] DB 출처별 ROI 표 + 시간대 차트
- [ ] `/docs/incentive-call-stats.html` (대시보드)
- [ ] 상담사 자동 재분배 (active=false 시)
- [ ] 자동 폐기 cron (5회 미컨택)
- [ ] DNT 관리 화면

### Phase 4 — 컴플라이언스 + 보안 + 안정화 (1~2일)
**목표**: 운영 안정성
- [ ] 자동 삭제 cron (data_retention_until)
- [ ] 마스킹 옵션 + 인쇄 차단
- [ ] 워터마크
- [ ] Export 화면 (사유 + audit)
- [ ] IP 화이트리스트 (기능 + OFF)
- [ ] 부하 테스트 (100만건 시뮬)
- [ ] 모니터링 + 알림

**총 8~12일**

---

## 13. 리스크 + 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 100만건 쿼리 느림 | SLA 미충족 | 월별 파티션 + 적극 인덱스 + 페이징 강제 |
| 매일 대량 import → 서버 부하 | 다른 사용자 영향 | COPY + 야간 cron / 비동기 |
| 같은 고객 여러 출처 (중복 컨택) | 컴플라이언스 위반 | (phone, db_source_id) UNIQUE + 화면 흔적 표시 |
| 상담사 실수로 모든 거절 | 데이터 손실 | 거절 사유 필수 + DNT 별도 버튼 |
| admin 잘못된 import | 운영 혼란 | 30일 휴지통 + 미컨택만 삭제 옵션 |
| 개인정보 유출 | 법적 책임 | 접근 로그 + 마스킹 + Export 차단 + 워터마크 |
| 상담사 퇴사 시 콜 정체 | 매출 손실 | active=false 시 자동 재분배 |
| Realtime 부하 | 성능 저하 | 디바운스 + 본인 row만 subscribe |
| CTI 미연동 | 결과 기록 수동 | UX 빠른 결과 1클릭 + 자동 다음 고객 |

---

## 14. 미정 / 후순위 (Phase 5+)

- 모바일 반응형 (외근 상담사)
- 시간대별 자동 콜 권장 (오후 2~4시)
- 자주 쓰는 응답 템플릿 (메모 빠르게)
- A/B 분배 테스트 (라운드 로빈 vs 능력순 ROI 비교)
- 통화 종료 후 SMS 만족도 조사 (외부 SMS 연동)
- 음성 인식 메모 (선택)
- 통화 녹음 통합 (CTI 연동 시)
- 자동 알림톡 (계약 후 안내)

---

## 15. 변경 이력

| 버전 | 날짜 | 변경 |
|---|---|---|
| v1.0 | 2026-05-06 | 최초 작성 (CTI 미연동 가정) |

---

**검토자**: 빈센조 (admin)
**개발 시작**: PRD 승인 후 Phase 1
**상태**: 검토 대기
