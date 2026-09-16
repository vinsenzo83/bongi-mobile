-- ═══════════════════════════════════════════════════════════════
-- 렌탈 제휴카드 할인 — 렌탈사별 카드 · 전월실적 구간별 월 할인(기본 + 카드사 프로모션)
--   원본: 옛 렌탈 시스템 rental_partner_cards(2026-05-27, 59장) → 카드사 공식 페이지로 재확인해 적재
--   상담원 계산기: "이 카드로 자동이체 시 월 N원" 안내, 계약정보에 선택한 카드 기록
-- ═══════════════════════════════════════════════════════════════
create table if not exists rental_cat_cards (
  id               uuid primary key default gen_random_uuid(),
  supplier_id      text not null references rental_cat_suppliers(id),
  card_issuer      text not null,                    -- 신한·KB·현대·롯데·삼성·하나·우리·NH·BC
  card_name        text not null,
  annual_fee       text,                             -- 원문 (국내/해외 구분 등)
  tiers            jsonb not null default '[]',      -- [{min_spend, base, promo, total}] 전월실적 오름차순
  max_discount     int,
  discount_months  int,                              -- 할인 적용 최대 개월 (null = 제한 없음/미기재)
  has_promo        boolean not null default false,   -- 카드사 추가 프로모션 할인 포함 여부
  categories       text[] not null default '{}',     -- 대상 품목 원문 (빈 배열 = 전 품목)
  notes            text,
  card_url         text,                             -- 카드사 공식 상품 페이지
  verify_status    text,                             -- verified | changed | not_found | url_dead | unverified
  verified_at      date,
  is_active        boolean not null default true,
  display_rank     int,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint rental_cat_cards_supplier_issuer_name_key unique (supplier_id, card_issuer, card_name)   -- 같은 카드명을 여러 카드사가 발급(베스트케어: 전북·광주)
);
create index if not exists rental_cat_cards_supplier_idx on rental_cat_cards (supplier_id, is_active);
alter table rental_cat_cards enable row level security;   -- 서버(service role)만
