# 데이터 모델 — incentive_* 테이블 (어드민 핵심)

> 라이브 Supabase (`dugaqvvnhsgenhmhuyju`) 2026-05-17 추출. 모든 테이블 RLS 활성화.

> 총 **27개 incentive_* 테이블** (어드민 도메인). 별도로 bongi_* (고객 사이트), rental_* (렌탈), policy_* 등 60+ 테이블 존재.

> **bongi_tickets**는 incentive_*가 아니지만 어드민(TM 데이터 관리 → 티켓)에서 사용 — 별도 §"부록" 참조.


## 전체 테이블 목록 + row 수

| 테이블 | rows | 용도 |
|---|---|---|
| `incentive_agents` | 11 |  |
| `incentive_calculator_history` | 8 | TM 데이터(요금 계산기 어드민) 1·2·3·4·5·6·8번 섹션 변경 이력. 추후 정산 분쟁 시 추적용. |
| `incentive_calculator_overrides` | 1 | 요금 계산기 어드민 데이터 override (TV·결합·셋톱·설치비·제휴카드·사은품). 모든 admin이 동일 값 보게 통합. |
| `incentive_customer_call_log` | 11 |  |
| `incentive_customer_db` | 3114 |  |
| `incentive_customer_db_access_log` | 3029 |  |
| `incentive_customer_db_requests` | 2 | 콜 DB 분배 요청 — 상담사가 매니저에게 요청, 매니저 승인 시 본인 센터 풀에서 분배 |
| `incentive_customer_happycall_survey` | 0 |  |
| `incentive_customer_import_batch` | 13 |  |
| `incentive_db_sources` | 4 |  |
| `incentive_dealers` | 3 |  |
| `incentive_gift_vouchers` | 7 | 인터넷+TV 사은품(상품권) 마스터 — 계약 처리 시 dropdown 선택. carrier=ALL은 공용 |
| `incentive_ip_whitelist` | 0 | 개인정보(콜 DB) 접근 IP 화이트리스트 — admin 관리 |
| `incentive_manager_exemptions` | 0 |  |
| `incentive_monthly_goals` | 0 |  |
| `incentive_monthly_settlements` | 9 |  |
| `incentive_product_history` | 51 |  |
| `incentive_products` | 63 |  |
| `incentive_role_permissions` | 4 |  |
| `incentive_role_permissions_history` | 3 |  |
| `incentive_rules` | 1 |  |
| `incentive_sales` | 26 |  |
| `incentive_sales_history` | 18 |  |
| `incentive_security_settings` | 6 |  |
| `incentive_settlement_corrections` | 0 |  |
| `incentive_tm_memos` | 0 | TM 상담 메모 — 상담사별 개인 |
| `incentive_tm_scripts` | 1 | TM 상담 스크립트 — 회사 공통 (admin 관리, 모든 상담사 공유) |

---

## `incentive_agents`
- rows: **11** · RLS: **True**
- PK: `id`
- FK: 14개
  -  → `?()`
  -  → `?()`
  -  → `?()`
  -  → `?()`
  -  → `?()`

| 컬럼 | 타입 | default |
|---|---|---|
| `id` | uuid | `gen_random_uuid()` |
| `user_id` | uuid | `` |
| `name` | text | `` |
| `center` | text | `` |
| `role` | text | `'agent'::text` |
| `hire_date` | date | `CURRENT_DATE` |
| `base_salary` | integer | `2300000` |
| `active` | boolean | `true` |
| `created_at` | timestamp with time zone | `now()` |
| `updated_at` | timestamp with time zone | `now()` |
| `deleted_at` | timestamp with time zone | `` |
| `deleted_by_user_id` | uuid | `` |
| `totp_secret` | text | `` |
| `totp_enabled` | boolean | `false` |
| `totp_enabled_at` | timestamp with time zone | `` |

## `incentive_calculator_history`
> TM 데이터(요금 계산기 어드민) 1·2·3·4·5·6·8번 섹션 변경 이력. 추후 정산 분쟁 시 추적용.
- rows: **8** · RLS: **True**
- PK: `id`
- FK: 1개
  -  → `?()`

| 컬럼 | 타입 | default |
|---|---|---|
| `id` | bigint | `nextval('incentive_calculator_history...` |
| `section` | text | `` |
| `action` | text | `` |
| `field` | text | `` |
| `before_value` | text | `` |
| `after_value` | text | `` |
| `changed_by_user_id` | uuid | `` |
| `changed_by_name` | text | `` |
| `changed_at` | timestamp with time zone | `now()` |
| `notes` | text | `` |

## `incentive_calculator_overrides`
> 요금 계산기 어드민 데이터 override (TV·결합·셋톱·설치비·제휴카드·사은품). 모든 admin이 동일 값 보게 통합.
- rows: **1** · RLS: **True**
- PK: `section`
- FK: 1개
  -  → `?()`

| 컬럼 | 타입 | default |
|---|---|---|
| `section` | text | `` |
| `data` | jsonb | `'{}'::jsonb` |
| `updated_at` | timestamp with time zone | `now()` |
| `updated_by_user_id` | uuid | `` |
| `updated_by_name` | text | `` |

## `incentive_customer_call_log`
- rows: **11** · RLS: **True**
- PK: `id`
- FK: 2개
  -  → `?()`
  -  → `?()`

| 컬럼 | 타입 | default |
|---|---|---|
| `id` | bigint | `nextval('incentive_customer_call_log_...` |
| `customer_id` | bigint | `` |
| `agent_id` | uuid | `` |
| `called_at` | timestamp with time zone | `now()` |
| `result` | text | `` |
| `notes` | text | `` |
| `callback_at` | timestamp with time zone | `` |
| `reject_reason` | text | `` |

## `incentive_customer_db`
- rows: **3114** · RLS: **True**
- PK: `id`
- FK: 5개
  -  → `?()`
  -  → `?()`
  -  → `?()`
  -  → `?()`
  -  → `?()`

| 컬럼 | 타입 | default |
|---|---|---|
| `id` | bigint | `nextval('incentive_customer_db_id_seq...` |
| `name` | text | `` |
| `phone` | text | `` |
| `age` | integer | `` |
| `gender` | text | `` |
| `region` | text | `` |
| `carrier` | text | `` |
| `notes` | text | `` |
| `consent_status` | text | `'unknown'::text` |
| `data_retention_until` | date | `` |
| `db_source_id` | integer | `` |
| `imported_batch_id` | uuid | `` |
| `imported_at` | timestamp with time zone | `now()` |
| `imported_by_user_id` | uuid | `` |
| `assigned_agent_id` | uuid | `` |
| `assigned_at` | timestamp with time zone | `` |
| `assigned_by_user_id` | uuid | `` |
| `priority_score` | integer | `0` |
| `call_status` | text | `'pending'::text` |
| `last_contacted_at` | timestamp with time zone | `` |
| `call_count` | integer | `0` |
| `next_retry_at` | timestamp with time zone | `` |
| `callback_at` | timestamp with time zone | `` |
| `reject_reason` | text | `` |
| `is_dnt` | boolean | `false` |
| `converted_sale_id` | uuid | `` |
| `archived` | boolean | `false` |
| `archived_at` | timestamp with time zone | `` |
| `archived_reason` | text | `` |
| `deleted_at` | timestamp with time zone | `` |
| `created_at` | timestamp with time zone | `now()` |
| `updated_at` | timestamp with time zone | `now()` |
| `assigned_center` | text | `` |
| `center_assigned_at` | timestamp with time zone | `` |
| `birth_date` | date | `` |
| `activation_date` | date | `` |
| `subscription_type` | text | `` |
| `device_model` | text | `` |
| `device_color` | text | `` |
| `device_serial` | text | `` |
| `plan_name` | text | `` |
| `addon_services` | text | `` |
| `payment_type` | text | `` |
| `subsidy_type` | text | `` |
| `retail_price` | integer | `` |
| `public_subsidy` | integer | `` |
| `extra_subsidy` | integer | `` |
| `cash_price` | integer | `` |
| `installment_principal` | integer | `` |
| `store` | text | `` |
| `store_code` | text | `` |
| `dealer` | text | `` |
| `agency_code` | text | `` |
| `memo_etc` | text | `` |
| `memo_activation` | text | `` |
| `tier` | smallint | `` |
| `category` | text | `` |
| `on_hold_reason` | text | `` |
| `source_data` | jsonb | `` |
| `latest_satisfaction_avg` | numeric | `` |
| `latest_nps` | smallint | `` |
| `last_happycall_at` | timestamp with time zone | `` |
| `upsell_interest_summary` | jsonb | `` |
| `cs_escalated` | boolean | `false` |
| `current_internet_status` | text | `` |
| `current_internet_carrier` | text | `` |
| `current_internet_signup_year` | smallint | `` |
| `current_internet_listened_at` | timestamp with time zone | `` |
| `current_internet_listened_by_agent_id` | uuid | `` |
| `quality_grade` | text | `` |

## `incentive_customer_db_access_log`
- rows: **3029** · RLS: **True**
- PK: `id`

| 컬럼 | 타입 | default |
|---|---|---|
| `id` | bigint | `nextval('incentive_customer_db_access...` |
| `customer_id` | bigint | `` |
| `accessed_by_user_id` | uuid | `` |
| `accessed_at` | timestamp with time zone | `now()` |
| `action` | text | `` |
| `ip` | text | `` |
| `user_agent` | text | `` |
| `metadata` | jsonb | `` |

## `incentive_customer_db_requests`
> 콜 DB 분배 요청 — 상담사가 매니저에게 요청, 매니저 승인 시 본인 센터 풀에서 분배
- rows: **2** · RLS: **True**
- PK: `id`
- FK: 2개
  -  → `?()`
  -  → `?()`

| 컬럼 | 타입 | default |
|---|---|---|
| `id` | bigint | `nextval('incentive_customer_db_reques...` |
| `agent_id` | uuid | `` |
| `center` | text | `` |
| `requested_count` | integer | `` |
| `reason` | text | `` |
| `status` | text | `'pending'::text` |
| `decided_by` | uuid | `` |
| `decided_at` | timestamp with time zone | `` |
| `decided_note` | text | `` |
| `distributed_count` | integer | `0` |
| `created_at` | timestamp with time zone | `now()` |
| `updated_at` | timestamp with time zone | `now()` |

## `incentive_customer_happycall_survey`
- rows: **0** · RLS: **True**
- PK: `id`
- FK: 3개
  -  → `?()`
  -  → `?()`
  -  → `?()`

| 컬럼 | 타입 | default |
|---|---|---|
| `id` | bigint | `nextval('incentive_customer_happycall...` |
| `customer_id` | bigint | `` |
| `call_log_id` | bigint | `` |
| `surveyed_by_agent_id` | uuid | `` |
| `surveyed_at` | timestamp with time zone | `now()` |
| `device_satisfaction` | smallint | `` |
| `plan_satisfaction` | smallint | `` |
| `signal_quality` | smallint | `` |
| `store_satisfaction` | smallint | `` |
| `nps_score` | smallint | `` |
| `free_comment` | text | `` |
| `upsell_interest` | jsonb | `'{}'::jsonb` |
| `next_action` | text | `` |
| `cs_escalation_reason` | text | `` |
| `created_at` | timestamp with time zone | `now()` |

## `incentive_customer_import_batch`
- rows: **13** · RLS: **True**
- PK: `id`
- FK: 1개
  -  → `?()`

| 컬럼 | 타입 | default |
|---|---|---|
| `id` | uuid | `gen_random_uuid()` |
| `db_source_id` | integer | `` |
| `imported_by_user_id` | uuid | `` |
| `imported_by_name` | text | `` |
| `imported_at` | timestamp with time zone | `now()` |
| `total_count` | integer | `0` |
| `valid_count` | integer | `0` |
| `invalid_count` | integer | `0` |
| `duplicate_count` | integer | `0` |
| `status` | text | `'active'::text` |
| `rolled_back_at` | timestamp with time zone | `` |
| `rolled_back_by_user_id` | uuid | `` |
| `rolled_back_reason` | text | `` |
| `rollback_mode` | text | `` |
| `notes` | text | `` |

## `incentive_db_sources`
- rows: **4** · RLS: **True**
- PK: `id`
- FK: 4개
  -  → `?()`
  -  → `?()`
  -  → `?()`
  -  → `?()`

| 컬럼 | 타입 | default |
|---|---|---|
| `id` | integer | `nextval('incentive_db_sources_id_seq'...` |
| `name` | text | `` |
| `code` | text | `` |
| `color` | text | `` |
| `display_order` | integer | `0` |
| `active` | boolean | `true` |
| `notes` | text | `` |
| `created_at` | timestamp with time zone | `now()` |
| `updated_at` | timestamp with time zone | `now()` |
| `created_by_user_id` | uuid | `` |

## `incentive_dealers`
- rows: **3** · RLS: **True**
- PK: `id`
- FK: 1개
  -  → `?()`

| 컬럼 | 타입 | default |
|---|---|---|
| `id` | bigint | `nextval('incentive_dealers_id_seq'::r...` |
| `carrier` | text | `` |
| `name` | text | `` |
| `url` | text | `` |
| `active` | boolean | `true` |
| `notes` | text | `` |
| `display_order` | integer | `0` |
| `created_by` | uuid | `` |
| `created_at` | timestamp with time zone | `now()` |
| `updated_at` | timestamp with time zone | `now()` |

## `incentive_gift_vouchers`
> 인터넷+TV 사은품(상품권) 마스터 — 계약 처리 시 dropdown 선택. carrier=ALL은 공용
- rows: **7** · RLS: **True**
- PK: `id`

| 컬럼 | 타입 | default |
|---|---|---|
| `id` | bigint | `nextval('incentive_gift_vouchers_id_s...` |
| `carrier` | text | `` |
| `name` | text | `` |
| `voucher_type` | text | `` |
| `display_order` | integer | `100` |
| `active` | boolean | `true` |
| `notes` | text | `` |
| `created_at` | timestamp with time zone | `now()` |
| `updated_at` | timestamp with time zone | `now()` |

## `incentive_ip_whitelist`
> 개인정보(콜 DB) 접근 IP 화이트리스트 — admin 관리
- rows: **0** · RLS: **True**
- PK: `id`
- FK: 1개
  -  → `?()`

| 컬럼 | 타입 | default |
|---|---|---|
| `id` | bigint | `nextval('incentive_ip_whitelist_id_se...` |
| `label` | text | `` |
| `created_at` | timestamp with time zone | `now()` |
| `active` | boolean | `true` |
| `cidr` | text | `` |
| `scope` | text | `'customer_db'::text` |
| `created_by` | uuid | `` |
| `notes` | text | `` |

## `incentive_manager_exemptions`
- rows: **0** · RLS: **True**
- PK: `id`
- FK: 2개
  -  → `?()`
  -  → `?()`

| 컬럼 | 타입 | default |
|---|---|---|
| `id` | bigint | `nextval('incentive_manager_exemptions...` |
| `agent_id` | uuid | `` |
| `year_month` | text | `` |
| `reason` | text | `` |
| `granted_by_user_id` | uuid | `` |
| `granted_by_name` | text | `` |
| `granted_at` | timestamp with time zone | `now()` |
| `notes` | text | `` |

## `incentive_monthly_goals`
- rows: **0** · RLS: **True**
- PK: `id`
- FK: 1개
  -  → `?()`

| 컬럼 | 타입 | default |
|---|---|---|
| `id` | bigint | `nextval('incentive_monthly_goals_id_s...` |
| `agent_id` | uuid | `` |
| `ym` | text | `` |
| `target_calls` | integer | `0` |
| `target_conversions` | integer | `0` |
| `target_points` | numeric | `0` |
| `notes` | text | `` |
| `created_by` | uuid | `` |
| `created_at` | timestamp with time zone | `now()` |
| `updated_at` | timestamp with time zone | `now()` |

## `incentive_monthly_settlements`
- rows: **9** · RLS: **True**
- PK: `id`
- FK: 2개
  -  → `?()`
  -  → `?()`

| 컬럼 | 타입 | default |
|---|---|---|
| `id` | uuid | `gen_random_uuid()` |
| `agent_id` | uuid | `` |
| `year_month` | character | `` |
| `total_count` | integer | `0` |
| `total_points` | numeric | `0` |
| `premium_count` | integer | `0` |
| `grade_target` | integer | `1` |
| `grade_applied` | integer | `1` |
| `is_penalty` | boolean | `false` |
| `applied_rate` | integer | `` |
| `total_revenue` | integer | `0` |
| `total_payback` | integer | `0` |
| `total_company_payback_burden` | integer | `0` |
| `total_agent_payback_deduct` | integer | `0` |
| `base_salary` | integer | `` |
| `incentive` | integer | `0` |
| `bonus` | integer | `0` |
| `agent_total` | integer | `0` |
| `company_profit` | integer | `0` |
| `profit_rate` | numeric | `0` |
| `finalized_at` | timestamp with time zone | `` |
| `finalized_by` | uuid | `` |
| `created_at` | timestamp with time zone | `now()` |
| `updated_at` | timestamp with time zone | `now()` |

## `incentive_product_history`
- rows: **51** · RLS: **True**
- PK: `id`
- FK: 1개
  -  → `?()`

| 컬럼 | 타입 | default |
|---|---|---|
| `id` | integer | `nextval('incentive_product_history_id...` |
| `product_id` | integer | `` |
| `changed_at` | timestamp with time zone | `now()` |
| `changed_by_user_id` | uuid | `` |
| `changed_by_name` | text | `` |
| `field_name` | text | `` |
| `old_value` | text | `` |
| `new_value` | text | `` |
| `snapshot_rebate` | integer | `` |
| `snapshot_payback` | integer | `` |
| `snapshot_point_weight` | numeric | `` |
| `snapshot_margin` | integer | `` |
| `snapshot_tier` | character | `` |
| `snapshot_active` | boolean | `` |
| `notes` | text | `` |

## `incentive_products`
- rows: **63** · RLS: **True**
- PK: `id`
- FK: 2개
  -  → `?()`
  -  → `?()`

| 컬럼 | 타입 | default |
|---|---|---|
| `id` | integer | `nextval('incentive_products_id_seq'::...` |
| `carrier` | text | `` |
| `type` | text | `` |
| `name` | text | `` |
| `speed` | text | `` |
| `tv_tier` | text | `` |
| `rebate` | integer | `` |
| `payback` | integer | `` |
| `point_weight` | numeric | `` |
| `margin` | integer | `(((((rebate)::numeric * 0.9))::intege...` |
| `tier` | character | `
CASE
    WHEN (((((rebate)::numeric ...` |
| `is_premium` | boolean | `(((((rebate)::numeric * 0.9) - (payba...` |
| `active` | boolean | `true` |
| `created_at` | timestamp with time zone | `now()` |
| `updated_at` | timestamp with time zone | `now()` |
| `monthly_fee_min` | integer | `` |
| `monthly_fee_max` | integer | `` |
| `gift_amount` | numeric | `0` |
| `guide_min` | integer | `` |
| `guide_max` | integer | `` |
| `install_fee` | integer | `` |

## `incentive_role_permissions`
- rows: **4** · RLS: **True**
- PK: `role`
- FK: 1개
  -  → `?()`

| 컬럼 | 타입 | default |
|---|---|---|
| `role` | text | `` |
| `menus` | jsonb | `'[]'::jsonb` |
| `updated_at` | timestamp with time zone | `now()` |
| `updated_by_user_id` | uuid | `` |

## `incentive_role_permissions_history`
- rows: **3** · RLS: **True**
- PK: `id`
- FK: 1개
  -  → `?()`

| 컬럼 | 타입 | default |
|---|---|---|
| `id` | bigint | `nextval('incentive_role_permissions_h...` |
| `role` | text | `` |
| `changed_at` | timestamp with time zone | `now()` |
| `changed_by_user_id` | uuid | `` |
| `changed_by_name` | text | `` |
| `before_menus` | jsonb | `` |
| `after_menus` | jsonb | `` |
| `added` | ARRAY | `` |
| `removed` | ARRAY | `` |

## `incentive_rules`
- rows: **1** · RLS: **True**
- PK: `id`

| 컬럼 | 타입 | default |
|---|---|---|
| `id` | integer | `nextval('incentive_rules_id_seq'::reg...` |
| `version` | text | `` |
| `effective_from` | date | `` |
| `base_salary` | integer | `` |
| `bonus_per_premium` | integer | `` |
| `payback_company_limit` | integer | `` |
| `payback_max` | integer | `` |
| `grade_rates` | jsonb | `` |
| `grade_thresholds` | jsonb | `` |
| `premium_margin_threshold` | integer | `250000` |
| `active` | boolean | `true` |
| `notes` | text | `` |
| `created_at` | timestamp with time zone | `now()` |
| `manager_override_rate` | numeric | `` |
| `manager_obligation_count` | integer | `` |
| `manager_penalty_partial_min` | integer | `` |
| `manager_team_profit_rate_min` | numeric | `` |
| `manager_v51_enabled` | boolean | `true` |

## `incentive_sales`
- rows: **26** · RLS: **True**
- PK: `id`
- FK: 5개
  -  → `?()`
  -  → `?()`
  -  → `?()`
  -  → `?()`
  -  → `?()`

| 컬럼 | 타입 | default |
|---|---|---|
| `id` | uuid | `gen_random_uuid()` |
| `agent_id` | uuid | `` |
| `product_id` | integer | `` |
| `customer_name` | text | `` |
| `customer_phone` | text | `` |
| `customer_address` | text | `` |
| `contract_date` | date | `CURRENT_DATE` |
| `installation_date` | date | `` |
| `add_payback` | integer | `0` |
| `company_payback_burden` | integer | `LEAST(add_payback, 30000)` |
| `agent_payback_deduct` | integer | `GREATEST(0, (add_payback - 30000))` |
| `status` | text | `'completed'::text` |
| `cancellation_reason` | text | `` |
| `notes` | text | `` |
| `created_at` | timestamp with time zone | `now()` |
| `updated_at` | timestamp with time zone | `now()` |
| `resident_id` | text | `` |
| `gift_received` | text | `` |
| `tv_count` | integer | `1` |
| `additional_products` | jsonb | `` |
| `wifi_option` | text | `` |
| `quote_summary` | text | `` |
| `installation_time` | text | `` |
| `contract_notes` | text | `` |
| `customer_address_detail` | text | `` |
| `bank_account_holder` | text | `` |
| `bank_name` | text | `` |
| `bank_account_number` | text | `` |
| `quote_full_html` | text | `` |
| `activation_date` | date | `` |
| `contract_pending_at` | timestamp with time zone | `now()` |
| `contract_in_progress_at` | timestamp with time zone | `` |
| `contract_completed_at` | timestamp with time zone | `` |
| `contract_cancelled_at` | timestamp with time zone | `` |
| `monthly_fee` | integer | `` |
| `deleted_at` | timestamp with time zone | `` |
| `deleted_by_user_id` | uuid | `` |
| `deleted_reason` | text | `` |
| `payback_snapshot` | integer | `` |
| `rebate_snapshot` | integer | `` |
| `point_weight_snapshot` | numeric | `` |
| `is_premium_snapshot` | boolean | `` |
| `db_source_id` | integer | `` |
| `dealer_id` | bigint | `` |
| `birth_date` | date | `` |
| `combo_type` | text | `` |
| `combo_members` | jsonb | `'[]'::jsonb` |
| `billing_method` | text | `` |
| `billing_phone` | text | `` |
| `billing_carrier` | text | `` |
| `payment_method` | text | `` |
| `waiting_person` | text | `` |
| `waiting_phone` | text | `` |
| `seller_phone` | text | `` |
| `onestop_yn` | text | `` |
| `current_carrier` | text | `` |
| `payment_extra` | jsonb | `` |
| `card_masked_at` | timestamp with time zone | `` |
| `customer_email` | text | `` |
| `waiting_relation` | text | `` |

## `incentive_sales_history`
- rows: **18** · RLS: **True**
- PK: `id`
- FK: 1개
  -  → `?()`

| 컬럼 | 타입 | default |
|---|---|---|
| `id` | bigint | `nextval('incentive_sales_history_id_s...` |
| `sale_id` | uuid | `` |
| `action` | text | `` |
| `changed_at` | timestamp with time zone | `now()` |
| `changed_by_user_id` | uuid | `` |
| `changed_by_name` | text | `` |
| `changed_by_role` | text | `` |
| `before_data` | jsonb | `` |
| `after_data` | jsonb | `` |
| `changed_fields` | ARRAY | `` |
| `reason` | text | `` |

## `incentive_security_settings`
- rows: **6** · RLS: **True**
- PK: `key`

| 컬럼 | 타입 | default |
|---|---|---|
| `key` | text | `` |
| `value` | jsonb | `` |
| `updated_at` | timestamp with time zone | `now()` |
| `updated_by_user_id` | uuid | `` |

## `incentive_settlement_corrections`
- rows: **0** · RLS: **True**
- PK: `id`
- FK: 2개
  -  → `?()`
  -  → `?()`

| 컬럼 | 타입 | default |
|---|---|---|
| `id` | bigint | `nextval('incentive_settlement_correct...` |
| `agent_id` | uuid | `` |
| `period` | text | `` |
| `reason` | text | `` |
| `status` | text | `'pending'::text` |
| `resolved_by` | uuid | `` |
| `resolved_at` | timestamp with time zone | `` |
| `resolved_note` | text | `` |
| `created_at` | timestamp with time zone | `now()` |
| `updated_at` | timestamp with time zone | `now()` |

## `incentive_tm_memos`
> TM 상담 메모 — 상담사별 개인
- rows: **0** · RLS: **True**
- PK: `user_id`
- FK: 1개
  -  → `?()`

| 컬럼 | 타입 | default |
|---|---|---|
| `user_id` | uuid | `` |
| `memos` | jsonb | `'[]'::jsonb` |
| `draft` | text | `''::text` |
| `updated_at` | timestamp with time zone | `now()` |

## `incentive_tm_scripts`
> TM 상담 스크립트 — 회사 공통 (admin 관리, 모든 상담사 공유)
- rows: **1** · RLS: **True**
- PK: `id`
- FK: 1개
  -  → `?()`

| 컬럼 | 타입 | default |
|---|---|---|
| `id` | integer | `1` |
| `steps` | jsonb | `'[]'::jsonb` |
| `updated_at` | timestamp with time zone | `now()` |
| `updated_by_user_id` | uuid | `` |
| `updated_by_name` | text | `` |

---

## 부록 — `bongi_tickets` (봉이 메인 사이트 신청 카탈로그)

> incentive_* 도메인 외부. **어드민 견적(105 JS 메모리)과 별개의 시스템**. 봉이 고객 사이트(`bongi-mobile.com`)의 인터넷+TV+렌탈 신청 카탈로그.

### 현재 상태 (2026-05-17 롤백 후 = 원래 상태)
| 항목 | 값 |
|---|---|
| 총 row | **1,053** |
| `is_active=true` | **1,052** (internet 1,002 + rental 50) |
| `is_active=false` | 1 (rental 1) |
| RLS | true |
| PK | `id` (integer, sequence) |
| FK | 4개 (speed_id, tv_id, settop_id, wifi_id) |

### 실제 운영 사용 증거
`bongi_applications` (rows=10) — 고객 신청서 테이블의 `product_ticket` 컬럼:
- `SK0188` (신청완료), `SK0398` (취소)
- `KT0311` (상담중), `KT0146` (신청완료)
- `LG0079` (계약완료)
- `R015` (계약완료, rental)

→ **105 범위 밖 티켓번호로 실제 신청 데이터 존재** = 봉이 메인 사이트가 949개 internet 카탈로그 운영 중.

### 어드민 견적 105개와의 차이

| 항목 | 어드민 견적 (`calculator.html`) | 고객 사이트 (`bongi_tickets`) |
|---|---|---|
| 갯수 | 105 (internet) | 1,002 internet + 50 rental |
| 저장 | DB 없음 (JS 메모리) | bongi_tickets 테이블 |
| 갱신 시점 | 시드 변경(`incentive_calculator_overrides`) 즉시 재생성 | sync API 또는 manual |
| 용도 | TM 상담 견적·요금 계산 | 고객 신청 카탈로그 |
| ticket_number 범위 | SK0001~60 / KT0001~30 / LG0001~15 | SK0001~450 / KT0001~360 / LG0001~192 |

### 핵심 컬럼
| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | integer | PK, sequence |
| `ticket_number` | text | 영구 발급 (재사용 X) |
| `ticket_type` | text | `internet` / `rental` |
| `carrier` | text | **`SKT`/`KT`/`LGU+`** (다른 테이블과 표기 다름 ⚠️) |
| `speed_id`, `tv_id`, `settop_id`, `wifi_id` | integer | FK |
| `total_monthly_fee` | integer | default 0 |
| `rental_*` (5개) | text | rental type 전용 |
| `is_active` | boolean | default true (비활성화로 박제) |
| `created_at`, `updated_at` | timestamptz | now() |

### ⚠️ 절대 금지
- `bongi_tickets`의 internet row를 어드민(105) 기준으로 정리 X — 봉이 메인 사이트 신청 흐름 깨짐
- 작업 전 반드시 `bongi_applications.product_ticket` 사용 데이터 확인
- 매뉴얼의 "105개"는 TM 견적용 한정 표현 (고객 사이트는 별개)

### 2026-05-17 사고 + 롤백
- 19:30: 잘못된 정리 (105 범위 외 internet 비활성화) — 897건 영향
- 20:30: 발견 즉시 롤백 (`updated_at::date='2026-05-17'` 조건으로 안전 복원)
- 결과: 원래 상태와 동일 (active 1,052 / inactive 1)
- 상세: `environments.md` §6
