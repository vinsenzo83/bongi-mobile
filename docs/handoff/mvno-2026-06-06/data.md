# 봉이 알뜰폰 데이터 모델

> 신규 도메인 — `bongi_mvno_*` prefix
> 인터넷+TV·가전렌탈과 독립 (참조 X)

---

## 1. 요금제 마스터 (bongi_mvno_plans)

운영자가 어드민에서 등록하는 봉이 자체 요금제.

| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | bigint pk | |
| plan_code | text uniq | 자체 코드 (예: 'BONGI-LTE-7GB-19900') |
| name | text | "봉이 음성 LTE 7GB" |
| **mvno_provider** | text | 🆕 'KT엠모바일' / '미디어로그' / 'SK텔링크' / 'LG헬로비전' / 'KT스카이라이프' (MVNO 본사) |
| carrier | text | 'KT' / 'SKT' / 'LGU+' (망 임대 사업자 — MVNO 본사가 임차한 망) |
| **commission_amount** | int | 🆕 봉이 대리점 가입 1건당 수수료 (MVNO 본사와 협상) |
| **commission_type** | text | 🆕 'fixed' / 'percent' / 'tiered' |
| **provider_plan_code** | text | 🆕 MVNO 본사 측 plan_code (봉이 전송용) |
| network_type | text | '5G' / 'LTE' / '3G' |
| monthly_fee | int | 정상 월정액 (원) |
| promo_fee | int | 프로모션 시 월정액 |
| promo_period_months | int | 프로모션 적용 기간 |
| data_gb | numeric | 데이터 (GB) — null=무제한 |
| data_throttle_kbps | int | 소진 후 속도 (kbps) |
| voice_minutes | int | 음성 통화 — null=무제한 |
| sms_count | int | 문자 — null=무제한 |
| contract_months | int | 약정 (0/12/24/36) |
| commitment_discount | int | 약정 할인액 |
| signup_fee | int | 가입비 |
| usim_fee | int | 유심비 (7,700원 표준) |
| sim_type | text | 'nano' / 'esim' / 'both' |
| age_limit_min | int | 가입 가능 최저 연령 |
| target_segment | text | 'youth' / 'senior' / 'family' / 'all' |
| description | text | 한 줄 설명 |
| feature_tags | text[] | ['데이터무제한','5G','약정없음','부가서비스포함'] |
| promo_tags_list | text[] | ['신규할인','쿠폰지급','첫달무료'] |
| is_premium | bool | |
| is_active | bool | |
| display_order | int | |
| metadata | jsonb | 부가서비스·혜택·약관 등 자유 |
| created_at·updated_at | timestamptz | |

### enum 후보 (text CHECK)
- `carrier`: 'KT' / 'SKT' / 'LGU+'
- `network_type`: '5G' / 'LTE' / '3G'
- `sim_type`: 'nano' / 'esim' / 'both'
- `target_segment`: 'youth' / 'senior' / 'family' / 'all'

---

## 2. 프로모션 (bongi_mvno_promos)

요금제별 추가 프로모션 (선택 N건). rental_products.promo_tags_list 패턴과 다르게 별도 테이블로 깔끔.

| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | bigint pk | |
| plan_id → plans | | |
| type | text | 'discount' / 'cashback' / 'gift' / 'usim_free' / 'signup_free' |
| title | text | "첫 3개월 50% 할인" |
| value | int | 할인액 또는 사은품 가격 |
| duration_months | int | 적용 기간 |
| starts_at·ends_at | timestamptz | 한정 기간 |
| condition | text | "MNP 가입자 한정" |
| active | bool | |

---

## 3. 가입 신청 (bongi_mvno_subscriptions)

고객이 가입 form 제출 시 박제.

| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | bigint pk | |
| plan_id → plans | | |
| ticket_number | text | 자동 발급 (예: 'M00001') |
| signup_type | text | 'new'(신규) / 'mnp'(번호이동) / 'usim_only'(유심만) |
| sim_type | text | 'nano' / 'esim' |
| customer_name | text | |
| birth_date | date | |
| gender | text | 'male' / 'female' |
| customer_type | text | 'personal' / 'sole_proprietor' / 'corporate' / 'foreigner' |
| phone_for_contact | text | 상담 연락처 |
| from_carrier | text | MNP 시 이전 통신사 |
| from_phone | text | MNP 시 이전 번호 |
| desired_number | text | 신규/MNP 희망 번호 |
| address | text | 우편번호·주소 |
| email | text | |
| **agreements** | jsonb | 동의 chip 박제 (필수 동의·선택 동의·마케팅 등) |
| **snapshot** | jsonb | 가입 시점 요금제 정책 박제 |
| **promo_snapshot** | jsonb | 적용된 프로모션 박제 |
| status | text | 'pending' / 'verified' / 'processing' / 'activated' / 'cancelled' |
| source | text | 'storefront' / 'admin' / 'tm_call' / 'store_offline' |
| metadata | jsonb | 자유 |
| agent_id → incentive_agents | nullable | 담당 상담사 |
| activated_at | timestamptz | 개통 완료 시점 |
| created_at·updated_at | timestamptz | |

---

## 4. 단말기 (bongi_mvno_devices) — 옵션

요금제와 별도로 단말기도 함께 판매하는 경우.

| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | bigint pk | |
| device_code | text uniq | "iPhone15-128GB-BLACK" |
| brand | text | "Apple" / "Samsung" |
| model | text | "iPhone 15" |
| storage_gb | int | |
| color | text | |
| image_url | text | |
| retail_price | int | 정상 출고가 |
| subsidy_amount | int | 공시 지원금 (옵션) |
| selective_discount_rate | numeric | 선택약정 할인율 (보통 25%) |
| is_active | bool | |

→ 단말기 + 요금제 결합은 `subscription.metadata.device_id`로 연결.

---

## 5. MVNO 본사 (bongi_mvno_providers — 🆕 신규)

봉이가 제휴 계약을 맺은 MVNO 사업자.

| 컬럼 | 타입 | 비고 |
|---|---|---|
| code | text pk | 'KT_MMOBILE' / 'MEDIALOG' / 'SK_TELINK' / 'LG_HELLO' / 'KT_SKYLIFE' |
| name | text | 한글명 (KT엠모바일 / 미디어로그 / SK텔링크 / LG헬로비전 / KT스카이라이프) |
| network_carrier | text | 'KT' / 'SKT' / 'LGU+' (임차 망) |
| contract_status | text | 'planned' / 'active' / 'paused' / 'ended' |
| contract_started_at | date | 대리점 계약 시작일 |
| commission_default | int | 기본 수수료 단가 (요금제별 override 가능) |
| api_endpoint | text | 가입 신청 전송 API (있는 경우) |
| api_key | text | secret |
| logo_url | text | |
| metadata | jsonb | 자유 |
| active | bool | |

### Phase 1 등록 (시드)
```sql
INSERT INTO bongi_mvno_providers (code, name, network_carrier, commission_default, contract_status, active) VALUES
  ('KT_MMOBILE', 'KT엠모바일', 'KT',   28000, 'planned', false),
  ('MEDIALOG',   '미디어로그', 'LGU+', 25000, 'planned', false),
  ('SK_TELINK',  'SK텔링크',  'SKT',  27000, 'planned', false),
  ('LG_HELLO',   'LG헬로비전', 'LGU+', 25000, 'planned', false),
  ('KT_SKYLIFE', 'KT스카이라이프', 'KT', 22000, 'planned', false);
```

→ 계약 체결 시 `contract_status='active'·active=true`로 변경.

## 5b. 망 임대 사업자 (bongi_mvno_carriers) — 참조용 (KT/SKT/LGU+ 3사)

| 컬럼 | 타입 | 비고 |
|---|---|---|
| code | text pk | 'KT' / 'SKT' / 'LGU+' |
| name | text | 한글명 |
| logo_url | text | |

---

## 6. 마이그레이션 SQL (P1)

```sql
BEGIN;

-- 망 임대 사업자
CREATE TABLE bongi_mvno_carriers (
  code text PRIMARY KEY CHECK (code IN ('KT','SKT','LGU+')),
  name text NOT NULL,
  logo_url text,
  mnp_api_endpoint text,
  created_at timestamptz DEFAULT now()
);
INSERT INTO bongi_mvno_carriers (code, name) VALUES
  ('KT','KT'),('SKT','SK텔레콤'),('LGU+','LG U+');

-- 요금제 마스터
CREATE TABLE bongi_mvno_plans (
  id bigserial PRIMARY KEY,
  plan_code text UNIQUE NOT NULL,
  name text NOT NULL,
  carrier text NOT NULL REFERENCES bongi_mvno_carriers(code),
  network_type text CHECK (network_type IN ('5G','LTE','3G')),
  monthly_fee int NOT NULL,
  promo_fee int,
  promo_period_months int,
  data_gb numeric,
  data_throttle_kbps int,
  voice_minutes int,
  sms_count int,
  contract_months int DEFAULT 0,
  commitment_discount int DEFAULT 0,
  signup_fee int DEFAULT 0,
  usim_fee int DEFAULT 7700,
  sim_type text DEFAULT 'both' CHECK (sim_type IN ('nano','esim','both')),
  age_limit_min int DEFAULT 19,
  target_segment text DEFAULT 'all' CHECK (target_segment IN ('youth','senior','family','all')),
  description text,
  feature_tags text[] DEFAULT '{}',
  promo_tags_list text[] DEFAULT '{}',
  is_premium bool DEFAULT false,
  is_active bool DEFAULT true,
  display_order int DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX ON bongi_mvno_plans (carrier, network_type, is_active);
CREATE INDEX ON bongi_mvno_plans (target_segment);

-- 프로모션
CREATE TABLE bongi_mvno_promos (
  id bigserial PRIMARY KEY,
  plan_id bigint REFERENCES bongi_mvno_plans(id) ON DELETE CASCADE,
  type text CHECK (type IN ('discount','cashback','gift','usim_free','signup_free')),
  title text NOT NULL,
  value int,
  duration_months int,
  starts_at timestamptz,
  ends_at timestamptz,
  condition text,
  active bool DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 가입 신청
CREATE TABLE bongi_mvno_subscriptions (
  id bigserial PRIMARY KEY,
  plan_id bigint REFERENCES bongi_mvno_plans(id),
  ticket_number text UNIQUE,
  signup_type text CHECK (signup_type IN ('new','mnp','usim_only')),
  sim_type text CHECK (sim_type IN ('nano','esim')),
  customer_name text NOT NULL,
  birth_date date,
  gender text CHECK (gender IN ('male','female')),
  customer_type text CHECK (customer_type IN ('personal','sole_proprietor','corporate','foreigner')) DEFAULT 'personal',
  phone_for_contact text NOT NULL,
  from_carrier text,
  from_phone text,
  desired_number text,
  address text,
  email text,
  agreements jsonb DEFAULT '{}',
  snapshot jsonb,
  promo_snapshot jsonb,
  status text CHECK (status IN ('pending','verified','processing','activated','cancelled')) DEFAULT 'pending',
  source text CHECK (source IN ('storefront','admin','tm_call','store_offline')) DEFAULT 'storefront',
  metadata jsonb DEFAULT '{}',
  agent_id uuid REFERENCES incentive_agents(id),
  activated_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX ON bongi_mvno_subscriptions (status, created_at DESC);
CREATE INDEX ON bongi_mvno_subscriptions (plan_id);

-- 단말기 (옵션)
CREATE TABLE bongi_mvno_devices (
  id bigserial PRIMARY KEY,
  device_code text UNIQUE NOT NULL,
  brand text,
  model text,
  storage_gb int,
  color text,
  image_url text,
  retail_price int,
  subsidy_amount int,
  selective_discount_rate numeric,
  is_active bool DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- R번호 자동 부여 (구독 ticket_number)
CREATE OR REPLACE FUNCTION trg_mvno_assign_ticket() RETURNS TRIGGER AS $$
DECLARE next_no int;
BEGIN
  IF NEW.ticket_number IS NULL THEN
    SELECT COALESCE(MAX(SUBSTRING(ticket_number FROM 2)::int), 0) + 1
      INTO next_no FROM bongi_mvno_subscriptions WHERE ticket_number ~ '^M\d+$';
    NEW.ticket_number := 'M' || LPAD(next_no::text, 5, '0');
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_mvno_assign_ticket_ins
BEFORE INSERT ON bongi_mvno_subscriptions
FOR EACH ROW EXECUTE FUNCTION trg_mvno_assign_ticket();

-- RLS (anon은 읽기만, insert는 SUPABASE_SERVICE_KEY 서버만)
ALTER TABLE bongi_mvno_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY mvno_plans_read ON bongi_mvno_plans FOR SELECT USING (is_active);
ALTER TABLE bongi_mvno_promos ENABLE ROW LEVEL SECURITY;
CREATE POLICY mvno_promos_read ON bongi_mvno_promos FOR SELECT USING (active);
ALTER TABLE bongi_mvno_subscriptions ENABLE ROW LEVEL SECURITY;
-- subscriptions는 anon read X. server route만 접근.

COMMIT;
```

---

## 7. mobing.co.kr 가입 form 매핑 — 4 step

mobing receipt URL `?planID=LPZ0018905&promoSeq=8826` 분석:

| step | mobing 패턴 | 봉이 매핑 |
|---|---|---|
| **1** | 요금제 + 프로모션 확인 (planID·promoSeq) | bongi_mvno_plans + bongi_mvno_promos |
| **2** | 가입 유형 (신규/MNP/유심만) | signup_type chip |
| **3** | 가입자 정보 (이름·생년·연락처·주소) | bongi_mvno_subscriptions 컬럼 |
| **4** | 약관 동의 (필수 4종 + 선택 마케팅) | agreements jsonb 박제 |

가입 직후 ticket_number (M00001~) 발급 + status='pending' → 상담사 후속.
