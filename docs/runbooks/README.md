# 사고 대응 runbook

> 사고 발생 시 즉시 펼쳐 단계별로 따라하세요.
> 모든 runbook은 5분 안에 첫 액션이 가능하도록 작성됐습니다.

## 시나리오별 진입점

| 증상 | severity | runbook | 목표 회복 시간 |
|---|---|---|---|
| **라이브 admin.prexymarket.com 접속 불가 / 5xx 다발** | **P0** | [P0-live-down.md](./P0-live-down.md) | **5분** |
| **데이터 leak·권한 우회 발견** (PII 노출 의심) | **P1** | [P1-data-leak.md](./P1-data-leak.md) | **30분** |
| **DB 마이그레이션 실패 / 트리거·정책 깨짐** | **P2** | [P2-db-migration-failure.md](./P2-db-migration-failure.md) | **15분** |
| 백업 무결성 검증 fail (GitHub Issue) | P2 | [P2-db-migration-failure.md](./P2-db-migration-failure.md) §6 | 1시간 |
| Sentry alert 폭증 | P1/P2 | 메시지 패턴 확인 후 분기 | 30분 |
| **데이터 손실 — rollback 불가** (DROP/TRUNCATE 실수 등) | **P0/P2** | [PITR-recovery.md](./PITR-recovery.md) | **15~60분** |

## 공통 원칙

1. **인지 → 격리 → 진단 → 복구 → 검증 → post-mortem** 순서
2. 격리(피해 차단)가 진단보다 우선 — "왜 발생?"보다 "지금 멈춰" 먼저
3. 복구 후 반드시 **검증** (단순 health 응답 ≠ 정상 작동)
4. post-mortem은 24시간 안에 — `feedback_*.md` 메모리에 룰 추가

## 사고 분류 기준

| 등급 | 정의 |
|---|---|
| **P0** | 라이브 서비스 다운·모든 사용자 영향·매출 직접 손실 |
| **P1** | 일부 기능 다운 또는 보안 사고 (data leak·권한 우회) — 일부 사용자 영향 |
| **P2** | 인프라 이슈 (백업·로그·알림) — 사용자 영향 없음, 그러나 미해결 시 P0/P1로 발전 |

## 참고 자료

- 백업·복구 plan: `../specs/BACKUP_RECOVERY_PLAN.md`
- 종합 release: `../specs/RELEASE_2026_05_27_TO_30.md`
- 운영 매뉴얼: `/docs/incentive-manual.html`
- Sentry: 라이브 프로젝트 (DSN은 Railway env)
- Railway 대시보드: 배포·rollback·로그
- Supabase 대시보드: DB·PITR·Storage
