# PITR — Point-in-Time Recovery runbook

> **목표**: Supabase 30일 PITR 기능으로 분 단위 시점 복구
> 사용 시점: P2 데이터 손실 — git revert·rollback SQL로 복구 불가능한 상황
> 복구 시간: **15~60분** (DB 크기·다운타임 정책에 따라)

## 1. 언제 PITR을 사용하나

**일반 rollback으로 충분한 경우 (PITR 불필요)**:
- 코드 사고 → `git revert` (P0 runbook)
- 마이그레이션 실패 → `*-rollback.sql` (P2 runbook)
- RLS 정책 사고 → 정책 재적용 (P1 runbook)

**PITR이 필요한 경우**:
- 실수로 `DROP TABLE` / `TRUNCATE` 실행
- 잘못된 UPDATE/DELETE로 대규모 데이터 손실
- 트리거가 silent fail로 데이터 sync 안 됨 + 백필 불가능 (R9는 백필로 해결됨)
- 보안 사고로 데이터 변조 의심 (특정 시점으로 되돌려야)
- 일일 백업이 손상돼 복구 불가

## 2. 사전 준비

### A. PITR 활성 여부 확인
```
Supabase 대시보드 → Project Settings → Database → Backups
- "Point in Time Recovery"  toggle: ON
- 보관 기간 (Pro: 7일, Pro+: 30일)
```

봉이 라이브: **Pro tier 가정** (대시보드에서 확인 필요)

### B. 복구 시점 결정

**가장 중요**: "**언제로 되돌릴 것인가**"

```
시간 t0 — 사고 발생
시간 t1 — 사고 인지 (t1 - t0 = 인지 지연)
시간 t2 — 복구 결정
복구 목표 시점: t0 직전 (1~10분 전 권장)
```

복구 시점이 너무 이르면 → 정상 작업분 손실 (사고 이후 정상 활동 데이터)
복구 시점이 너무 늦으면 → 사고가 일부 포함 (복구 의미 X)

**권장**: t0 - 5분 ~ t0 - 1분 (사고 직전)

### C. staging environment 결정

라이브 PITR은 **전체 DB를 새 timestamp로 덮어씀** → 일반 사용자 영향. 다음 중 선택:

| 옵션 | 다운타임 | 데이터 손실 | 비용 |
|---|---|---|---|
| **A. 라이브 직접 복구** | 30~60분 | t2~복구시점 사이 정상 작업 손실 | 무료 (PITR 기본) |
| **B. 별도 프로젝트 생성** | 0분 (병행) | 0건 (라이브 유지) | $25/월 (월 단위) |
| **C. PITR branch 생성 (실험적)** | 0분 | 0건 | Supabase 결정 |

봉이 critical 사고는 보통 **B** 권장 — 라이브 유지 + staging에서 데이터 추출 → 수동 백필.

## 3. 라이브 직접 복구 절차 (옵션 A)

### Step 1: 사용자 안내 (~5분)
- 어드민 메인 페이지에 다운타임 배너 (수동 + SW 캐시 무효화)
- 사용자에게 영향 예상 시간 안내

### Step 2: 진행 중 트랜잭션 차단
```sql
-- Supabase 대시보드 SQL editor
-- 새 connection block (revoke 시 기존 connection은 유지)
REVOKE CONNECT ON DATABASE postgres FROM authenticated, anon;
-- server endpoint도 503으로 (Railway env에 MAINTENANCE_MODE=true)
```

### Step 3: PITR 복구 trigger
```
Supabase 대시보드 → Database → Backups → Point in time
1. "Restore" 버튼 클릭
2. 복구 시점 선택 (YYYY-MM-DD HH:MM:SS UTC)
   ※ 한국시간 KST에서 9시간 빼서 입력
3. "I understand" 확인 후 Restore 시작
```

소요 시간: DB 크기 비례 — 봉이 ~ 10 GB 가정 → **15~30분**

### Step 4: 복구 검증
```bash
# 핵심 row count 확인
psql "$DATABASE_URL" -c "
  SELECT 'incentive_agents' AS tbl, count(*) FROM incentive_agents
  UNION ALL SELECT 'incentive_sales', count(*) FROM incentive_sales
  UNION ALL SELECT 'rental_sales', count(*) FROM rental_sales
  UNION ALL SELECT 'incentive_customer_db', count(*) FROM incentive_customer_db
"

# 트리거·정책 존재
psql "$DATABASE_URL" -c "
  SELECT count(*) AS triggers FROM information_schema.triggers
  WHERE event_object_schema = 'public';
"
```

복구 시점이 R9 fix(2026-05-30) 이전이라면 → **gift trigger 다시 깨짐**. R9 fix SQL 재적용 필요.

### Step 5: connection 재허용
```sql
GRANT CONNECT ON DATABASE postgres TO authenticated, anon;
```
- Railway env에서 `MAINTENANCE_MODE=false` 변경
- server 재배포
- SW_VERSION bump

### Step 6: post-recovery 작업
- 사용자 통보 (복구 시점 이후 입력 데이터 손실 여부)
- 손실 데이터 백필 (logs·외부 ledger에서 가능 시)
- post-mortem (`feedback_<incident>.md`)

## 4. 별도 프로젝트 복구 (옵션 B — 권장)

라이브 영향 0건. 사고 데이터 추출 + 수동 백필.

### Step 1: 별도 프로젝트 생성
```
Supabase 대시보드 → New Project
- 이름: bongi-recovery-2026-05-30
- region: 라이브와 동일
- Database password: 임시
```

### Step 2: PITR restore
```
새 프로젝트 → Database → Backups → Restore from existing project
- Source: dugaqvvnhsgenhmhuyju (라이브)
- 복구 시점: 사고 직전
```

### Step 3: 손실 데이터 추출
```sql
-- recovery 프로젝트에서 service_role JWT로 query
-- 사고로 손실됐던 row만 추출
SELECT * FROM incentive_sales
WHERE created_at BETWEEN '<사고 시각 - 1시간>' AND '<사고 시각>';
```

### Step 4: 라이브에 백필
```sql
-- 라이브에서 service_role JWT
INSERT INTO incentive_sales (col1, col2, ...)
VALUES <recovery에서 가져온 row들>
ON CONFLICT (id) DO NOTHING;
```

### Step 5: recovery 프로젝트 삭제
```
복구 완료 후 — 비용 절감을 위해 삭제
Supabase 대시보드 → Settings → Delete project
```

## 5. 분기 시뮬레이션 plan

### 목적
- 실제 incident 발생 전 PITR 절차 숙달
- 복구 시점 결정 능력 향상
- DB 크기·복구 시간 측정 (capacity planning)

### 분기별 절차 (2026 Q3 권장: 2026-08-15)

```
1. staging 환경 준비
   - 별도 Supabase 프로젝트 생성 (옵션 B 패턴)
   - 비용 절약 위해 시뮬레이션 후 즉시 삭제

2. 시나리오 가정
   - "관리자 실수로 incentive_sales 테이블에 TRUNCATE 실행"
   - 사고 시각 = (시뮬레이션 시작 - 30분)

3. 측정 항목
   - PITR restore 시작 → 완료 소요 시간
   - 복구 후 row count vs 사고 직전 추정
   - 트리거·정책·view 정상 작동 여부
   - SW·endpoint 정상 응답

4. 보고서
   - docs/runbooks/PITR-SIMULATION-2026-QN.md
   - 측정 시간·발견 사항·개선 사항

5. 정리
   - staging 프로젝트 삭제
   - feedback_*.md 메모리 추가 (시뮬레이션에서 발견된 룰)
```

### 시뮬레이션 후 plan 업데이트
- 실측 복구 시간 → runbook §1.B 권장 값 업데이트
- 발견된 함정 → "자주 발생하는 PITR 함정" 표 추가

## 6. 자주 발생하는 PITR 함정

| 함정 | 영향 | 예방 |
|---|---|---|
| 복구 시점 너무 이름 → 정상 작업 손실 | 사고 후 정상 데이터도 함께 손실 | 사고 시각 추정 신중·여러 시점 후보 검토 |
| 복구 후 마이그레이션 누락 | R9 같은 fix가 사라짐 | 복구 후 즉시 모든 마이그레이션 재적용 점검 |
| 복구 후 RLS 정책 손실 | data leak 위험 | 복구 후 P1 runbook으로 정책 재검증 |
| Storage objects는 PITR 대상 X | 이미지 등 손실 | `backup-storage.yml` 별도 백업 활용 |
| 트리거 silent fail 재발 | R9 같은 type 충돌 | 복구 후 R9 fix SQL 재적용 |
| 라이브 영향 무시 옵션 A 선택 | 사용자 30~60분 다운타임 | 옵션 B (별도 프로젝트) 권장 |

## 7. 관련 자료

- BACKUP_RECOVERY_PLAN.md §2-2 PITR 개요
- P2-db-migration-failure.md (rollback SQL 우선 시도)
- R9 gift trigger fix (실제 사례 — 백필로 PITR 회피)
- Supabase 공식: https://supabase.com/docs/guides/platform/backups
