# 알뜰폰 DB schema 한눈에

> 자세한 컬럼·마이그레이션 SQL은 `data.md` 참조.
> 본 문서는 ERD + 핵심 관계 요약.

---

## 1. 신규 5 테이블

```
bongi_mvno_carriers (참조용 — KT/SKT/LGU+)
       ▲
       │ carrier (text FK)
       │
bongi_mvno_plans  ────────────► bongi_mvno_promos (1:N — 프로모션)
       ▲                            ▲
       │ plan_id                    │ promo_snapshot 박제
       │                            │
bongi_mvno_subscriptions (가입 신청 — snapshot 박제)
       │
       │ metadata.device_id?
       │
bongi_mvno_devices (단말기 — 옵션)
```

---

## 2. 핵심 관계

- **plans → carriers**: 망 임대 사업자 (KT/SKT/LGU+) 참조
- **plans → promos**: 1 요금제에 N 프로모션
- **subscriptions → plans**: 가입 1건 = 요금제 1개
- **subscriptions.snapshot**: 가입 시점 plan 정책 박제
- **subscriptions.promo_snapshot**: 적용된 promo 박제
- **subscriptions.agreements**: 동의 chip + 약관 전문 박제

---

## 3. 기존 봉이 테이블 — 참조

| 봉이 테이블 | 알뜰폰 관계 |
|---|---|
| `incentive_centers` | 8 직영 매장 (개통 매장 안내) |
| `incentive_agents` | 상담사 (`subscriptions.agent_id`) |
| `incentive_customer_db` | 상담원 가입 시 ingest |
| `auth.users` | storefront 회원 (옵션 — POC는 익명 가입 가능) |

→ **렌탈·인터넷+TV 테이블과 참조 X** (도메인 분리).

---

## 4. 인덱스 권장

```sql
-- list 조회 빈번
CREATE INDEX ON bongi_mvno_plans (carrier, network_type, is_active);
CREATE INDEX ON bongi_mvno_plans (target_segment, is_active);
CREATE INDEX ON bongi_mvno_plans (monthly_fee);

-- 가입 신청 list
CREATE INDEX ON bongi_mvno_subscriptions (status, created_at DESC);
CREATE INDEX ON bongi_mvno_subscriptions (plan_id);
CREATE INDEX ON bongi_mvno_subscriptions (ticket_number);
CREATE INDEX ON bongi_mvno_subscriptions (phone_for_contact);
```

---

## 5. RLS 권장

```sql
-- plans: 공개 read
ALTER TABLE bongi_mvno_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY mvno_plans_anon_read ON bongi_mvno_plans
  FOR SELECT TO anon USING (is_active);
CREATE POLICY mvno_plans_admin_all ON bongi_mvno_plans
  FOR ALL TO authenticated USING (
    (select auth.uid()) IN (
      SELECT user_id FROM incentive_agents WHERE role IN ('admin','manager') AND active
    )
  );

-- subscriptions: anon insert만 (POC 익명 신청), authenticated read·update
ALTER TABLE bongi_mvno_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY mvno_subs_anon_insert ON bongi_mvno_subscriptions
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY mvno_subs_admin_all ON bongi_mvno_subscriptions
  FOR ALL TO authenticated USING (
    (select auth.uid()) IN (
      SELECT user_id FROM incentive_agents WHERE active
    )
  );
```

⚠️ 메모리 룰 `feedback_rls_enable_caution`: 일괄 활성화 금지·1 테이블씩 점검 후 적용.

---

## 6. 트리거

```sql
-- 1. ticket_number M00001~ 자동 부여 (data.md 참조)
-- 2. plan promo_period_months 만료 시 promo_fee → monthly_fee 자동 전환 (cron 또는 trigger 옵션)
-- 3. subscriptions.status 변경 audit log (audit_subscriptions 별도 테이블)
```

---

## 7. R번호 (티켓) 통합 정책

봉이 도메인 R번호:
- `R0001~` — 가전렌탈 (rental_products + rental_product_options)
- `R5000~` — 인터넷+TV (incentive_internet_tickets)
- 🆕 `M00001~` — 알뜰폰 (bongi_mvno_subscriptions)

→ prefix 분리로 충돌 없음. 운영자가 티켓 prefix만 보면 도메인 식별.
