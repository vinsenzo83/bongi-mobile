# 봉이모바일 백업·복구·롤백 종합 plan

> 작성: 2026-05-30 (R12 라운드)
> 영향: 라이브 admin.prexymarket.com · 데브 dev-admin.prexymarket.com

## 1. 백업 현황 (자동화된 것)

### 1-1. 일일 DB 백업 (GitHub Actions cron)

| 워크플로 | 대상 | 주기 | 위치 |
|---|---|---|---|
| `backup-core-tables.yml` | 라이브 17 핵심 테이블 (incentive_*·rental_*·customer_calls) | **KST 02:00 일일** | `backups/YYYY-MM-DD/` |
| `backup-incentive-overrides.yml` | `incentive_calculator_overrides` JSON | **KST 03:00 일일** | `backups/incentive/YYYY-MM-DD_HHMMSS_KST_*.json` |
| **`backup-storage.yml`** 🆕 | **Storage `product-images` bucket** (objects + manifest) | **KST 04:00 일일** | `backups/storage/YYYY-MM-DD_*.tar.gz` |

- 변경 없으면 빈 커밋 방지 (sha 비교)
- pg_dump `--data-only` 방식 (schema는 별도 마이그레이션 파일이 source of truth)
- **30일치 자동 prune** — 모든 워크플로에 내장 (`tail -n +31 | xargs rm`)
- 모든 워크플로에 `workflow_dispatch` 수동 트리거 있음

### 1-2. Supabase 자체 PITR (Point-in-Time Recovery)

- **무료 tier**: 7일치 자동 백업
- **Pro tier**: 30일 PITR (분 단위 복구 가능)
- 라이브: `dugaqvvnhsgenhmhuyju` 프로젝트 — Supabase 대시보드 → Database → Backups
- 사고 발생 시 분 단위 시점으로 복구 가능

### 1-3. 미적용 (TODO)

- ✅ ~~Supabase Storage `product-images` bucket 백업~~ — **R14 완료** (`backup-storage.yml`)
- ❌ **`.env` Railway 환경변수** 백업 (현재 1Password 등 secret manager 미사용 — 사용자 결정사항)
- ❌ **백업 무결성 검증** 워크플로 (백업 파일이 실제로 복구 가능한지 정기 테스트)

## 2. 롤백 가능 자산

### 2-1. Git 커밋 (master)

오늘 R1~R11 라운드 + 이전 변경 누적 — 모든 commit reversible.
```bash
git revert <commit-hash>                  # 단일 커밋 revert
git revert <oldest>..<newest>             # 범위 revert
git reset --hard <last-known-good>        # ⚠️ 강제 리셋 (협업 시 위험)
```

**최근 무결성 검증된 commit (2026-05-30)**:
- `75643de` R11 lint errors 0 (current master)
- `b1ecce6` R9 gift trigger fix
- `1047da9` R5 권한 우회 fix
- `9618c52` R3 보안 fix (XSS·RLS)

### 2-2. DB 마이그레이션 rollback SQL

`server/db/*-rollback.sql` 형태로 각 마이그레이션마다 rollback 코멘트 포함 (2026-05-18 패턴부터).

오늘 신규 (2026-05-30):
- `server/db/2026-05-30-gifts-source-id-uuid-fix.sql` — § 롤백 코멘트 포함

**rollback 적용 절차**:
1. 라이브 영향 분석 (해당 컬럼·트리거 사용 endpoint 식별)
2. 데브에 rollback SQL 먼저 적용 → endpoint 검증
3. 라이브 적용 → 즉시 health/spot check
4. 회귀 시 → original 마이그레이션 재적용

### 2-3. SW 버전 (캐시 무효화)

`docs/sw.js`의 `SW_VERSION` 숫자만 올리면 브라우저 강제 갱신.
오늘 v138 → v149 (12번 bump). 사고 시 SW_VERSION 다시 올리면 stale client 강제 reload.

## 3. 사고 대응 절차 (Incident Response)

### P0 — 라이브 다운 (모든 endpoint 5xx)

| 단계 | 조치 | 소요 |
|---|---|---|
| 0 | Railway 대시보드 health 확인 + Sentry alert 확인 | 1분 |
| 1 | `git log -10` 최근 커밋 확인 — 사고 시점 직전 commit 식별 | 1분 |
| 2 | Railway에서 **이전 deployment rollback** (UI 1클릭) | 2분 |
| 3 | 또는 `git revert <bad-commit> && git push` | 3분 |
| 4 | health 회복 확인 → Sentry alert resolved | 5분 |
| 5 | post-mortem 작성 → CLAUDE.md `feedback_*` 룰 추가 | 30분 |

**예방**: 큰 release는 데브 검증 → 단계적 롤아웃 → 라이브 (오늘 라운드 패턴).

### P1 — 데이터 leak·권한 우회 발견

| 단계 | 조치 |
|---|---|
| 0 | 영향 범위 파악 (어느 role·어느 데이터·언제부터) |
| 1 | RLS 정책 임시 강화 (read 차단 또는 인증 강제) |
| 2 | server endpoint에 `requireRole` 추가 (오늘 R5 패턴) |
| 3 | 노출됐을 가능성 있는 데이터 audit (logs·access pattern) |
| 4 | 사용자 통보 (PII 노출 시 PIPA 의무) |

**오늘 fix된 leak**: R3 partner_cards RLS · R5 customers/unified contract leak · R5 partner-cards write role check.

### P2 — DB 마이그레이션 실패

| 단계 | 조치 |
|---|---|
| 0 | `\dt`로 영향 받은 테이블 확인 |
| 1 | rollback SQL 즉시 적용 (마이그레이션 파일 § 롤백 section) |
| 2 | `NOTIFY pgrst, 'reload schema'` (PostgREST cache reload) |
| 3 | endpoint 검증 — service_role select로 row count 확인 |
| 4 | 데이터 손실 시 PITR로 시점 복구 (Supabase 대시보드) |

**오늘 사례**: R6 RLS wrapping 시 partner_cards endpoint 0건 응답 → 즉시 원복 → 검증 방법 오해였음 확인 → wrapping 재적용 (자율적 회복).

## 4. 백업 강화 로드맵

### Short-term (1주)
- [x] ~~Supabase Storage `product-images` bucket 일일 백업 추가~~ — **R14 완료**
  - `scripts/backup-storage.mjs` + `.github/workflows/backup-storage.yml`
- [x] ~~백업 prune 워크플로~~ — **모든 cron에 내장** (`tail -n +31`)
- [ ] `.env` Railway 환경변수 → 1Password 또는 Doppler 통합 (사용자 결정)

### Mid-term (1개월)
- [x] ~~**백업 무결성 검증** 워크플로~~ — **R16 완료** (`verify-backup.yml`)
  - 매주 일요일 KST 05:00 ephemeral postgres에 restore + row count 비교
  - 5% 이상 diff 시 GitHub Issue 자동 생성 (label: backup-failure, priority:high)
- [ ] PITR 복구 시뮬레이션 (분기 1회) — 임의 시점 복구 → 데이터 정합성 검증
- [ ] 사고 대응 runbook 별도 문서 (`docs/runbooks/incident-*.md`)
- [ ] **2026-06-10 unused index 재측정** — `UNUSED_INDEX_BASELINE_2026_05_30.md` 비교 → 진짜 dead 인덱스만 DROP

### Long-term (분기)
- [ ] Disaster Recovery 시뮬레이션 (전체 region 다운 가정)
- [ ] 멀티 region 백업 (Supabase 기본 + AWS S3 cross-region)

## 5. 변경 관리 체크리스트 (PR/Push 전)

큰 DB·서버 변경 시 다음 항목 확인:

- [ ] 마이그레이션 파일에 § 롤백 코멘트 포함
- [ ] 데브 먼저 적용 → endpoint 검증 → 라이브
- [ ] SW_VERSION bump (HTML/JS 변경 시)
- [ ] 양쪽 sync (cherry-pick)
- [ ] R9 같은 무결성 점검 SQL 1회 실행
- [ ] 영향 받는 endpoint health 직후 확인
- [ ] Sentry alert 모니터 (15분)
- [ ] 매뉴얼 sync (운영자 영향 변경 시 — `feedback_manual_sync_required.md` 룰)

## 6. 관련 자료

- `feedback_release_audit.md` — 6~7회 라운드 점검 패턴
- `feedback_rls_enable_caution.md` — RLS 변경 시 단계적 적용
- `project_bongi_seed_sync.md` — 시드 데이터 동기화
- `MANUAL_SYNC_RULE.md` — 매뉴얼 동기화 룰
- `.github/workflows/backup-core-tables.yml` — 일일 cron 1
- `.github/workflows/backup-incentive-overrides.yml` — 일일 cron 2
- `server/db/2026-*-rollback.sql` — 마이그레이션별 롤백
