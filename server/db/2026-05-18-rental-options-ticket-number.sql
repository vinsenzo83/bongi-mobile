-- 가전 렌탈 티켓 — 옵션 단위 (rental_product_options)
-- 적용일: 2026-05-18
-- 적용처: 라이브(dugaqvvnhsgenhmhuyju) + 데브(sesgdqbmophgmombelmn) 양쪽
-- 목적: 옵션 단위 1,498 조합에 ticket_number 부여 (이전 rental_products.ticket_number는 잘못된 단위 — deprecated)

-- 1. 컬럼 추가
ALTER TABLE rental_product_options
  ADD COLUMN IF NOT EXISTS ticket_number TEXT,
  ADD COLUMN IF NOT EXISTS ticket_active BOOLEAN DEFAULT true;

COMMENT ON COLUMN rental_product_options.ticket_number IS '고객→상담사 핫라인 코드 (R0001~). 옵션 단위 영구 발급';
COMMENT ON COLUMN rental_product_options.ticket_active IS '티켓 활성 여부. 단종 시 false (snapshot 박제)';

-- 2. UNIQUE index (NULL 허용)
CREATE UNIQUE INDEX IF NOT EXISTS idx_rental_options_ticket_unique
  ON rental_product_options(ticket_number) WHERE ticket_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rental_options_ticket_active
  ON rental_product_options(ticket_active) WHERE ticket_active = true;

-- 3. 신규 발급 함수 (R0001 형식, 영구 발급)
CREATE OR REPLACE FUNCTION generate_next_rental_option_ticket()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number FROM 2) AS INTEGER)), 0) + 1
  INTO next_num
  FROM rental_product_options
  WHERE ticket_number ~ '^R\d+$';
  RETURN 'R' || LPAD(next_num::TEXT, 4, '0');
END;
$$;

REVOKE EXECUTE ON FUNCTION generate_next_rental_option_ticket() FROM anon, authenticated;

-- 4. 기존 active 옵션에 R0001~ 일괄 발급 (id 순으로 안정)
WITH numbered AS (
  SELECT o.id, 'R' || LPAD((ROW_NUMBER() OVER (ORDER BY o.id))::TEXT, 4, '0') AS new_ticket
  FROM rental_product_options o
  JOIN rental_products rp ON rp.id = o.product_id
  WHERE o.ticket_number IS NULL AND rp.is_active = true AND o.is_active = true
)
UPDATE rental_product_options ro
SET ticket_number = n.new_ticket,
    ticket_active = COALESCE(ticket_active, true),
    updated_at = NOW()
FROM numbered n
WHERE ro.id = n.id;

-- 5. RLS
ALTER TABLE rental_product_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rental_options_auth_read" ON rental_product_options;
CREATE POLICY "rental_options_auth_read" ON rental_product_options
  FOR SELECT USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "rental_options_admin_write" ON rental_product_options;
CREATE POLICY "rental_options_admin_write" ON rental_product_options
  FOR ALL USING (
    EXISTS (SELECT 1 FROM incentive_agents
      WHERE user_id = (select auth.uid())
        AND role IN ('admin','manager')
        AND deleted_at IS NULL)
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM incentive_agents
      WHERE user_id = (select auth.uid())
        AND role IN ('admin','manager')
        AND deleted_at IS NULL)
  );

DROP POLICY IF EXISTS "rental_options_service_role" ON rental_product_options;
CREATE POLICY "rental_options_service_role" ON rental_product_options
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 검증
-- SELECT COUNT(*) FILTER (WHERE ticket_number IS NOT NULL) AS issued, COUNT(*) AS total FROM rental_product_options;
-- → issued ~1501, total 1512
