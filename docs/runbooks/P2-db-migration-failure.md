# P2 — DB 마이그레이션 실패 runbook

> **목표 회복 시간: 15분**
> 사용 시점: 마이그레이션 SQL 실패, 트리거·정책 깨짐, view 조회 불가, 백업 무결성 검증 fail

## 1. 인지 (~2분)

다음 중 하나:
- 마이그레이션 SQL 실행 중 ERROR
- PostgREST 응답 `42P10`·`42703`·`42501` 등 schema 관련 코드
- 트리거 silent fail (R9 패턴 — 데이터 sync 안 됨)
- 백업 무결성 검증 (R16 verify-backup.yml) GitHub Issue 자동 생성
- Sentry log에 `supabase` 관련 error 폭증

```bash
# 즉시 health 확인 — supabase 상태
curl -s https://admin.prexymarket.com/api/health | grep supabase
# expect: "supabase":"ok"
```

## 2. 격리 (~2분)

진행 중 마이그레이션 즉시 중단:
- 데브에서 검증 안 한 SQL이라면 라이브 적용 **중지**
- 영향 받은 endpoint 임시 503 응답 (P1 §2-B 패턴)
- 다른 마이그레이션 실행 **정지**

## 3. 진단 (~5분)

### A. 정확한 ERROR 메시지 확인
```sql
-- Supabase MCP 또는 대시보드 SQL editor
-- 영향 받은 테이블·트리거 list
SELECT * FROM pg_proc WHERE proname LIKE '%<func>%';
SELECT * FROM pg_trigger WHERE tgname LIKE '%<trigger>%';
SELECT * FROM pg_policy WHERE polrelid = '<table>'::regclass;
```

### B. 흔한 ERROR 패턴

| 코드 | 의미 | 해결 |
|---|---|---|
| **42P10** | unique constraint 매칭 안 됨 | 인덱스 재생성 (`CREATE UNIQUE INDEX ...`) |
| **42703** | column 없음 | 컬럼 추가 (`ALTER TABLE ... ADD COLUMN`) 또는 이름 일치 확인 |
| **42501** | 권한 없음 | RLS 정책 점검 (R3·R5 패턴) |
| **42883** | type mismatch (operator 없음) | type 캐스팅 (`::text` 등 — R9 패턴) |
| **23502** | NOT NULL 위반 | 컬럼 default 추가 또는 NULL 허용 |
| **23514** | check constraint 위반 | constraint 값 확인 (R9 데브 status case) |
| **42P01** | 테이블 없음 | 테이블 생성 또는 sync 누락 |

### C. 변경 시점 식별
```bash
git log --oneline server/db/ | head -10
# 가장 최근 마이그레이션 commit 식별
git show <commit> -- server/db/
```

## 4. 복구 (~5분)

### A. rollback SQL 적용
```bash
# 해당 마이그레이션의 § 롤백 코멘트 확인
grep -A 20 "롤백" server/db/<해당>.sql
```

```sql
-- 보통 패턴 (마이그레이션 파일 마지막에 코멘트로 있음)
BEGIN;
DROP TRIGGER IF EXISTS <name> ON <table>;
DROP FUNCTION IF EXISTS <func>;
ALTER TABLE <table> DROP COLUMN IF EXISTS <new>;
COMMIT;
```

### B. PostgREST cache 강제 reload
```sql
NOTIFY pgrst, 'reload schema';
```

### C. type 충돌 해결 (R9 패턴)
```sql
-- 양쪽 type 호환 위해 text로 통일
ALTER TABLE <table> ALTER COLUMN <col> TYPE text USING <col>::text;
-- 영향 받는 unique index 재생성
DROP INDEX IF EXISTS <unique_idx>;
CREATE UNIQUE INDEX <unique_idx> ON <table>(<col1>, <col2>);
```

### D. constraint 통일 (R9 데브 status case)
```sql
ALTER TABLE <table> DROP CONSTRAINT IF EXISTS <name>;
ALTER TABLE <table> ADD CONSTRAINT <name>
  CHECK (<col> = ANY (ARRAY['<value1>','<value2>']));
```

### E. 백필 (데이터 손실 시)
```sql
-- 트리거가 silent fail이었다면 누락된 데이터 백필
INSERT INTO <target> (<cols>)
SELECT <values> FROM <source>
WHERE NOT EXISTS (
  SELECT 1 FROM <target> t WHERE t.key = source.key
);
```

## 5. 검증 (~2분)

### A. service_role 직접 select (RLS 우회 정상 작동 확인)
```sql
SELECT count(*) FROM <table>;  -- 예상 row 수와 일치?
SELECT * FROM <view> LIMIT 1;  -- view 조회 OK?
```

### B. 트리거 활성 확인
```sql
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = '<table>';
```

### C. server endpoint health
```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" \
  https://admin.prexymarket.com/api/<endpoint>
# expect: 401 (인증 필요 정상) 또는 200
```

### D. 양쪽 sync 확인
```sql
-- 라이브 + 데브 양쪽에서
SELECT count(*) FROM <table>;
-- 차이가 큰가? (R9에서 발견된 패턴)
```

## 6. 백업 무결성 검증 fail 대응 (R16 워크플로)

GitHub Issue 자동 생성된 경우:
1. Actions 탭 → verify-backup workflow → fail 로그 확인
2. 어느 테이블 diff인지 식별 (5% 이상)
3. 원인 분류:
   - **백업 자체 손상**: backup-core-tables 워크플로 다시 실행 (수동 trigger)
   - **라이브 데이터 손실**: PITR 검토 (Supabase 대시보드)
   - **schema drift**: 마이그레이션 누락 확인
4. 수동 백업 무결성 검증:
   ```bash
   # 로컬에서 가능
   TEST_DATABASE_URL=postgres://...:5432/testdb node scripts/verify-backup.mjs
   ```

## 7. Post-mortem (~24시간 안)

```markdown
---
name: feedback_<incident-slug>
description: <2026-MM-DD> P2 — <테이블/트리거 영역>
metadata: { type: feedback }
---

<재발 방지 룰>

**Why:** <어떤 type·constraint·정책 충돌이 원인>
**How to apply:** <마이그레이션 작성 시 점검할 항목 추가>
```

추가:
- 마이그레이션 § 롤백 코멘트 누락이면 추가
- R2 sync 점검에 type·constraint 비교 추가 (column 이름만이 아닌 type)
- 매뉴얼 sync (운영자 영향 시)

## 자주 발생하는 P2 원인

| 원인 | 복구 | 예방 |
|---|---|---|
| type 충돌 (uuid vs bigint, R9 사례) | `ALTER COLUMN TYPE text USING ::text` | R2 sync 시 type까지 비교 |
| status constraint 영문/한글 차이 (R9) | constraint 통일 | 데브와 라이브 constraint 동일 유지 |
| RLS 정책 wrapping 직접 적용 (R6 사례) | service_role select 검증 후 적용 | 단계적·즉시 검증 |
| unique index type 변경 시 손실 | `CREATE UNIQUE INDEX ... WHERE ...` 재생성 | type 변경 후 index 자동 재생성 패턴 SQL에 포함 |
| 트리거 함수 silent fail | trigger function 캐스팅 명시 | trigger 작성 시 SAVEPOINT/RAISE NOTICE |
| PostgREST cache stale | `NOTIFY pgrst, 'reload schema';` | 마이그레이션 후 자동 NOTIFY 패턴 SQL에 포함 |
