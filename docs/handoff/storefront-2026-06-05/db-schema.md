# DB schema — storefront 4 화면에서 사용할 table

> Supabase PostgreSQL · service_role key 필요 (admin endpoint)

---

## 1. rental_categories (카테고리 — 6 활성)

| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | bigint pk | 1·2·6·10·22·23 활성 |
| slug | text | water-purifier·air-purifier·bidet·mattress·aircon·tv |
| name | text | 정수기·공기청정기·비데·매트리스·에어컨·TV |
| product_group | text | '정수기' (정수기·공청·비데·매트리스) / '가전' (에어컨·TV) |
| is_active | bool | true 6개 |
| metadata.icon | jsonb | 이모지 |
| metadata.extra_fields | jsonb | 카테고리별 동적 폼 (출수방식·필터단계 등) |

---

## 2. rental_products (상품 — 435건)

53 컬럼 — 핵심만:

### 기본
- id (bigint pk)
- category_id → categories
- brand (text)
- model (text)
- name (text)
- image_url (text — Supabase Storage public URL)
- product_url (text)
- is_active (bool)

### 그룹 정보
- company_id → rental_companies (가전 그룹은 채널 분리)
- manufacturer (text)
- model_key (text — 변형 묶음 key)

### AI 8 컬럼 (2026-06-03 100% 적재 완료)
- description (text)
- recommended_capacity (text)
- recommended_usage (text[])
- feature_tags (text[])
- specifications (jsonb — 카테고리별)
- size_mm (text)
- weight_kg numeric
- care_cycle (text)
- spec_notes (text)

### 약정·옵션 집계 (trigger 자동 갱신)
- option_count (int)
- months_available (text[])
- care_services (text[])
- monthly_fee_min·max (int)

### 가격·프로모션 (rental_policy V2 연동)
- rebate_max (int)
- rebate_otherco_max (int)
- rebate_half_max (int)
- half_fee_min (int)
- half_periods_available (text — '12,24')
- otherco_supported (bool)
- promo_tags_list (text[]) — '반값할인'·'타사보상'·'상품권'·'cashback'·'가격인상'·'기타'
- promo_type_count (int)
- is_premium (bool)
- tier (text — S/A/B/C)
- market_score (int)

### 티켓 (인터넷+TV와 통합)
- ticket_number (text — 'R0001~')
- ticket_active (bool)

---

## 3. rental_product_options (옵션 — 5,444건)

| 컬럼 | 타입 | 비고 |
|---|---|---|
| id (bigint pk) | | |
| product_id → products | | |
| months | int | 약정 (36·48·60·72·84) |
| care_service | text | 방문·셀프 |
| inspection_cycle | int | 점검 주기 (4·6·12개월) |
| ownership_months | int | 소유권 이전 |
| half_period | int | 반값 적용 기간 |
| monthly_fee | int | 월 요금 |
| half_fee | int | 반값 시 월 요금 |
| normal_price | int | 정가 |
| rebate · rebate_otherco · rebate_half | int | 리베이트 종류 |
| payback | int | 현금 페이백 |
| margin | int | 회사 마진 |
| bundle_rate | numeric | 번들 할인율 |
| as_period_months | int | AS 보장 |
| signup_age_limit | int | 가입 연령 |
| installation_fee | int | 설치비 |
| total_rental_fee | int | 총 렌탈료 |
| commission_rate · commission_basis | numeric·text | 수수료 |
| variant_code · variant_label | text | 변형 (컬러 등) |
| promo_type | text | basic·half·otherco·custom |
| tier | text | S/A/B/C |
| ticket_number | text | 옵션별 R번호 |
| is_active | bool | |

---

## 4. rental_partner_cards (제휴카드)

| 컬럼 | 타입 | 비고 |
|---|---|---|
| id (bigint pk) | | |
| brand (text) | 카드사 brand (LG전자구독·코웨이 등) |
| card_name (text) | KB 청춘대로 등 |
| card_issuer (text) | KB국민·삼성·현대·신한·NH·롯데·BC |
| categories (text[]) | **한글 name 저장** — 정수기·공청·비데 등 |
| company_id → companies | |
| tier1_min · tier1_base · tier1_total | int | 1구간 (전월 N원·기본 N원·총합) |
| tier2_min · tier2_base · tier2_total | int | 2구간 |
| tier3_min · tier3_base · tier3_total | int | 3구간 |
| is_active (bool) | |
| metadata (jsonb) | 자유 |

---

## 5. rental_sales (계약/신청 박제)

| 컬럼 | 타입 | 비고 |
|---|---|---|
| id (bigint pk) | | |
| product_id → products | | |
| option_id → options | | |
| customer_name·birth_date·gender·phone·email | text·date·text·text·text | 가입자 |
| carrier (text) | SK/KT/LG |
| **customer_type** (text) | 🆕 'personal'/'sole_proprietor'/'corporate'/'foreigner' |
| **agent_phone** (text) | 🆕 대리인 연락처 |
| **agent_relation** (text) | 🆕 대리인 관계 |
| **source** (text) | 🆕 'storefront_self'/'storefront_consult'/'admin'/'tm_call' |
| status (text) | pending·confirmed·done |
| snapshot (jsonb) | 신청 시점 가격·정책 박제 |
| card_snapshot (jsonb) | 신청 시점 카드 정보 박제 |
| metadata (jsonb) | 자유 |
| agent_id → incentive_agents | 담당 상담사 (셀프는 null) |
| ticket_number (text) | 자동 R번호 |
| created_at·updated_at | |

🆕 = P1 마이그레이션에 추가 필요한 컬럼.

```sql
ALTER TABLE rental_sales
  ADD COLUMN IF NOT EXISTS customer_type text CHECK (customer_type IN ('personal','sole_proprietor','corporate','foreigner')),
  ADD COLUMN IF NOT EXISTS agent_phone text,
  ADD COLUMN IF NOT EXISTS agent_relation text,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'admin'
    CHECK (source IN ('admin','storefront_self','storefront_consult','tm_call'));
```

---

## 6. incentive_customer_db (콜DB — 상담원 신청 ingest)

| 컬럼 | 타입 | 비고 |
|---|---|---|
| id (bigint pk) | | |
| phone (text) | 정규화된 010xxxxxxxx |
| name (text) | |
| source (text) | 'storefront_chat' (신규) · 'manual' · 'import' · 'tm_inbound' · 'store_offline' |
| grade (text) | S/A/B/R/C — storefront는 'R' default |
| status (text) | new·assigned·in_progress·completed·discarded |
| assigned_agent_id → incentive_agents | round-robin trigger 자동 |
| memo (text·jsonb) | 7종 메모 |

🆕 source enum 확장 필요 시:
```sql
ALTER TABLE incentive_customer_db
  DROP CONSTRAINT IF EXISTS customer_db_source_check;
ALTER TABLE incentive_customer_db
  ADD CONSTRAINT customer_db_source_check
  CHECK (source IN ('manual','import','tm_inbound','storefront_chat','store_offline'));
```

---

## 7. 자동 trigger

- `trg_auto_issue_ticket` — 상품 옵션 추가 시 R번호 자동 발급
- `trg_sync_option_count` — 옵션 추가/삭제 시 product 집계
- `trg_sync_months_available` — months_available · care_services array sync
- `trg_sync_product_aggregates` — monthly_fee_min/max 등 9컬럼 sync
- `rental_recalc_margins_and_premium` RPC — tier·P·is_premium 일괄 재계산

---

## 8. RPC 함수 (이미 라이브 적용)

- `admin_get_user_emails(user_ids uuid[])` — agent 목록 email 매핑
- `admin_get_user_id_by_email(email_lookup text)` — 편집 시 user_id lookup
- `rental_products_for_recommend()` — 추천용 product list
- `rental_recalc_margins_and_premium()` — 마진·티어 재계산

---

## 9. Storage bucket

- `product-images` (public read) — `{category-slug}/{product_id}.{ext}` 패턴
- (storefront 진입 시 추가 bucket 필요 시 신규 생성)
