-- 마이그레이션: rental_products에 ticket_number 추가 + 기존 107건 일괄 발급
-- 적용일: 2026-05-17
-- 적용처: 라이브 Supabase (dugaqvvnhsgenhmhuyju) — 데브·로컬은 동일 DB 공유
-- 목적: 가전 렌탈 티켓 시스템 — 고객→상담사 핫라인 상품 식별 코드

-- ─── 1. 컬럼 추가 ───
ALTER TABLE rental_products
  ADD COLUMN IF NOT EXISTS ticket_number TEXT,
  ADD COLUMN IF NOT EXISTS ticket_active BOOLEAN DEFAULT true;

COMMENT ON COLUMN rental_products.ticket_number IS '고객→상담사 핫라인 식별 코드 (R0001~). 영구 발급, 재사용 X, 비활성만 존재';
COMMENT ON COLUMN rental_products.ticket_active IS '티켓 활성 여부. 단종 시 false. snapshot 박제 정책';

-- ─── 2. UNIQUE index (NULL 허용 — 발급 전 row OK) ───
CREATE UNIQUE INDEX IF NOT EXISTS idx_rental_products_ticket_unique
  ON rental_products(ticket_number) WHERE ticket_number IS NOT NULL;

-- ─── 3. 활성 ticket 빠른 조회용 partial index ───
CREATE INDEX IF NOT EXISTS idx_rental_products_ticket_active
  ON rental_products(ticket_active) WHERE ticket_active = true;

-- ─── 4. 기존 107건에 R0001~ 순차 발급 ───
WITH numbered AS (
  SELECT id, 'R' || LPAD((ROW_NUMBER() OVER (ORDER BY id))::TEXT, 4, '0') AS new_ticket
  FROM rental_products
  WHERE ticket_number IS NULL
)
UPDATE rental_products r
SET ticket_number = n.new_ticket,
    ticket_active = COALESCE(ticket_active, true),
    updated_at = NOW()
FROM numbered n
WHERE r.id = n.id;

-- ─── 5. 신상품 발급 함수 (서버에서 호출) ───
-- 가장 큰 R번호 + 1로 발급. 동시성: SERIALIZABLE 권장 또는 UNIQUE constraint이 충돌 시 retry
CREATE OR REPLACE FUNCTION generate_next_rental_ticket()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number FROM 2) AS INTEGER)), 0) + 1
  INTO next_num
  FROM rental_products
  WHERE ticket_number ~ '^R\d{4,}$';

  RETURN 'R' || LPAD(next_num::TEXT, 4, '0');
END;
$$;

REVOKE EXECUTE ON FUNCTION generate_next_rental_ticket() FROM anon, authenticated;

-- 검증 쿼리 (참고)
-- SELECT COUNT(*) AS total, COUNT(ticket_number) AS with_ticket,
--        MIN(ticket_number) first, MAX(ticket_number) last
-- FROM rental_products;
-- → total=107, with_ticket=107, first=R0001, last=R0107
