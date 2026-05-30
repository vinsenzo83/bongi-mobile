-- 인덱스 사용 stats RPC 함수
-- R19 snapshot-index-usage.mjs가 호출
-- 라이브·데브 양쪽 적용

CREATE OR REPLACE FUNCTION snapshot_index_usage()
RETURNS TABLE (
  table_name text,
  index_name text,
  is_unique boolean,
  is_primary boolean,
  idx_scan bigint,
  idx_tup_read bigint,
  idx_tup_fetch bigint,
  index_size_bytes bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT
    s.relname::text AS table_name,
    s.indexrelname::text AS index_name,
    i.indisunique AS is_unique,
    i.indisprimary AS is_primary,
    s.idx_scan,
    s.idx_tup_read,
    s.idx_tup_fetch,
    pg_relation_size(s.indexrelid) AS index_size_bytes
  FROM pg_stat_user_indexes s
  JOIN pg_index i ON i.indexrelid = s.indexrelid
  WHERE s.schemaname = 'public'
  ORDER BY pg_relation_size(s.indexrelid) DESC;
$$;

-- service_role만 호출 가능
REVOKE EXECUTE ON FUNCTION snapshot_index_usage() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION snapshot_index_usage() TO service_role;

COMMENT ON FUNCTION snapshot_index_usage() IS
  'R19 인덱스 사용 stats 주간 스냅샷용 RPC — scripts/snapshot-index-usage.mjs 호출';
