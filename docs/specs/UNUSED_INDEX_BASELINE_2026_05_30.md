# Unused Index 분석 baseline (2026-05-30 · R15)

> **이 파일은 1~2주 후 재측정 시 diff용 baseline입니다.**
> 측정 시점: SW v153 · 어드민 4일 운영 후
> 재측정 예정: **2026-06-10 ± 2일** (오늘 신규 인덱스·기능 정착 후)

## 측정 방법

```sql
SELECT s.relname AS table_name, s.indexrelname AS index_name,
  s.idx_scan AS scans,
  pg_size_pretty(pg_relation_size(s.indexrelid)) AS size
FROM pg_stat_user_indexes s
JOIN pg_index i ON i.indexrelid = s.indexrelid
WHERE s.schemaname = 'public'
  AND s.idx_scan = 0
  AND NOT i.indisunique
  AND NOT i.indisprimary
  AND s.indexrelname NOT IN (...)  -- R8에서 추가한 34개 제외
ORDER BY pg_relation_size(s.indexrelid) DESC;
```

## 결과 (상위 30, R8 신규 34개 제외)

### A. CRM 영역 어드민 (18개 · ~1.3MB · **유지 결정**)

| 테이블 | 인덱스 | 사이즈 | 유지 사유 |
|---|---|---|---|
| `incentive_customer_db_access_log` | `idx_access_user` | 336 kB | PIPA 감사 query 미래 사용 |
| `incentive_customer_db_access_log` | `idx_access_customer` | 264 kB | 동일 |
| `rental_product_options` | `idx_rental_options_ticket_active` | 136 kB | 티켓 활성 필터 |
| `incentive_customer_db` | `idx_customer_db_store` | 120 kB | 콜DB 매장별 필터 |
| `incentive_customer_db` | `idx_customer_db_dealer` | 112 kB | 콜DB 딜러별 필터 |
| `incentive_customer_db` | `idx_customer_db_activation` | 112 kB | 콜DB 활성일 필터 |
| `rental_products` | `idx_rental_products_modelkey` | 40 kB | 모델키 검색 |
| `incentive_customer_db` | `idx_customer_db_tags` | 24 kB | 5/27 신규 (tags text[]) |
| `bongi_applications` | `idx_bongi_apps_phone` | 16 kB | 통합 view에서 사용 |
| `incentive_rules_history` | `idx_irh_rule_id_changed_at` | 16 kB | 정책 이력 조회 |
| `incentive_departments` | `idx_departments_active` | 16 kB | 부서 활성 필터 |
| `bongi_used_phone_buyback` | `idx_bongi_used_phone_customer` | 16 kB | 통합 view |
| `incentive_customer_import_batch` | `idx_batch_status` | 16 kB | import 진행 추적 |
| `incentive_internet_tickets` | `idx_internet_tickets_active` | 16 kB | 티켓 활성 |
| `rental_sales` | `idx_rental_sales_customer` | 16 kB | 가전 영업 고객별 |
| `bongi_applications` | `idx_bongi_applications_created` | 16 kB | 시간순 정렬 |
| `bongi_applications` | `idx_bongi_applications_status` | 16 kB | 상태 필터 |

### B. CRM 외 영역 (12개 · ~360KB · **유지 결정** — `feedback_crm_only` 룰)

| 테이블 | 인덱스 |
|---|---|
| `bongi_chat_messages` | `idx_chat_messages_session` |
| `bongi_tickets` | tv·speed·settop·carrier·wifi·active (6개) |
| `policy_documents` | category·slug (2개) |
| `bongi_customers` | status·phone·created (3개) |
| `bongi_special_promo_applications` | created |

## 결정: **모두 유지** + 1~2주 후 재측정

### 유지 이유
1. **A 영역**: 미래 query 패턴에서 사용 가능성 큼. DROP 시 sequential scan → 응답시간 저하 위험.
2. **B 영역**: `feedback_crm_only.md` 룰 — 어드민 외 영역 손대지 않음.
3. **R8 신규 34개**: 방금 추가해 stats 부족. 자연스럽게 차후 측정 시 사용 패턴 확인 가능.

### 1~2주 후 재측정 절차

1. 이 baseline 파일과 동일한 SQL 재실행
2. idx_scan 값 비교 (0 → N+ 이면 실제 사용 중)
3. 여전히 0인 인덱스만 DROP 후보
4. 단 — DROP 전 query plan EXPLAIN으로 영향 확인
5. 양쪽 DB 동시 적용

## 자동화 권고 (백업 강화 다음 단계)

`.github/workflows/index-usage-monitor.yml` — 주 1회 stats 수집 → JSON 저장 → 추세 분석
```yaml
on:
  schedule:
    - cron: '0 17 * * 0'  # 매주 일요일 KST 02:00
```

이러면 인덱스 사용 패턴이 자동 추적되어 분기별 정리가 쉬워집니다.

## 관련

- 측정 시점 commit: `6768776` (master)
- Supabase advisor: 245KB 보고서 (`tool-results/mcp-claude_ai_Supabase-get_advisors-*.txt`)
- 백업 plan: `BACKUP_RECOVERY_PLAN.md`
- release 보고서: `RELEASE_2026_05_27_TO_30.md`
