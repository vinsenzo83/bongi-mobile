# P0 — 라이브 다운 runbook

> **목표 회복 시간: 5분**
> 사용 시점: admin.prexymarket.com 접속 불가, 5xx 다발, 핵심 endpoint 모두 실패

## 1. 인지 (~1분)

다음 중 하나라도 만나면 P0:
- Sentry P1/P0 alert 폭증 (10분 내 50건+)
- Railway 대시보드 health red
- 직접 `curl https://admin.prexymarket.com/api/health` HTTP 5xx 또는 timeout
- 사용자 또는 운영팀 다운 보고

```bash
# 즉시 health 확인
curl -s -o /dev/null -w "HTTP %{http_code} / %{time_total}s\n" \
  https://admin.prexymarket.com/api/health
```

## 2. 격리 (~1분)

다른 작업·배포 즉시 중단. 사용자 영향 최소화:
- 진행 중이던 `git push origin master` 있다면 **중지** (악화 가능)
- 진행 중이던 DB 마이그레이션 있다면 **중지**
- 사용자가 봉이 페이지 새로고침 못 하게 안내 (캐시 v 사용 유도)

## 3. 진단 (~1분)

가장 흔한 원인 순서로 빠르게 체크:

### A. Railway 배포 실패
```bash
# Railway 대시보드 → 봉이 service → Deployments
# 가장 최근 deployment status 확인
# "Failed" 또는 "Crashed"면 → 4-A 복구
```

### B. Supabase 다운
```bash
curl -s https://dugaqvvnhsgenhmhuyju.supabase.co/rest/v1/ \
  -H "apikey: <ANON>" | head -c 100
# Supabase 자체 status: https://status.supabase.com/
```

### C. 코드 사고
```bash
git log --oneline -10 origin/master
# 최근 2시간 commit 중 의심 candidate 식별
git diff HEAD~1 HEAD --stat  # 최근 1 commit 변경 범위
```

## 4. 복구 (~2분)

### 4-A. Railway 1-click rollback (가장 빠름)
1. Railway 대시보드 → Deployments
2. 직전 successful deployment **세 점 메뉴** → **Rollback to this deployment**
3. 1분 내 복구

### 4-B. Git revert (코드 사고 확정 시)
```bash
git log --oneline -5 origin/master
git revert <bad-commit-hash> --no-edit
git push origin master
# Railway 자동 재배포 (1-2분)
```

### 4-C. Supabase 다운 (외부 의존)
- Supabase status page 모니터
- 라이브 사용자에게 임시 안내 (downtime banner)
- 복구 후 자체 재시작 불필요 (server는 supabase 회복 시 자동 재연결)

## 5. 검증 (~1분)

복구 후 다음 모두 정상이어야:

```bash
# 1. health
curl -s https://admin.prexymarket.com/api/health
# expect: status=ok · supabase=ok · agents_count=11

# 2. 핵심 endpoint (인증 필요 — 401이 정상)
for path in \
  /api/incentive/agents/me \
  /api/rental/partner-cards \
  /api/incentive/customers/unified; do
  curl -s -o /dev/null -w "$path: HTTP %{http_code}\n" \
    "https://admin.prexymarket.com$path"
done
# expect: 모두 401 (auth required) 또는 200

# 3. 사이드바 메뉴 + SW
curl -s "https://admin.prexymarket.com/docs/sw.js?t=$(date +%s)" | grep SW_VERSION

# 4. Sentry alert 멈춤 확인 (15분 모니터)
```

## 6. Post-mortem (~24시간 안)

`~/.claude/projects/-Users-vinsenzo/memory/` 에 다음 추가:

```markdown
---
name: feedback_<incident-slug>
description: <2026-MM-DD> P0 사고 — <원인 한 줄>
metadata:
  type: feedback
---

<P0 발생 원인 + 재발 방지 룰>

**Why:** <발생 경위·놓친 부분>
**How to apply:** <향후 어떤 시점에 이 룰이 적용되는지>
```

추가 작업:
- 사고 시점 commit 격리 (`feedback_release_audit.md` 참고)
- 회귀 테스트 추가 (`tests/e2e/` 또는 R5 verifier 패턴)
- 사고 알림 채널 점검 (Sentry filter·Slack 등)

## 자주 발생하는 P0 원인

| 원인 | 회복 방법 | 예방 |
|---|---|---|
| Railway build fail (npm·node 버전) | 4-A rollback | CI에서 build pre-check |
| 환경변수 누락 | Railway secret 추가 + redeploy | `.env.example` 유지 |
| Supabase migration 자동 적용 실패 | 4-B revert + 수동 SQL 적용 | dev 먼저 적용 |
| RLS 정책 끔 (server endpoint 0건) | 4-B revert | `feedback_rls_enable_caution.md` 룰 준수 |
| DB connection pool 고갈 | Supabase 대시보드 connection 증설 | 일일 모니터링 |
