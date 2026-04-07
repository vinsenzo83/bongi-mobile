-- 출금 시 원자적 잔액 차감 (Race Condition 방지)
-- balance >= amount 조건이 WHERE절에 있으므로 동시 요청 시 하나만 성공
CREATE OR REPLACE FUNCTION deduct_cash_balance(p_user_id UUID, p_amount INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  rows_affected INTEGER;
BEGIN
  UPDATE bongi_cash_balance
  SET balance = balance - p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id
    AND balance >= p_amount;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected;
END;
$$;

-- 수동 적립/환불 시 원자적 잔액 가산
CREATE OR REPLACE FUNCTION add_cash_balance(p_user_id UUID, p_amount INTEGER)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO bongi_cash_balance (user_id, balance, updated_at)
  VALUES (p_user_id, p_amount, NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET
    balance = bongi_cash_balance.balance + p_amount,
    updated_at = NOW();
END;
$$;
