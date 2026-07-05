// cs-crawler 기록 sink — 감지 결과를 어디에 쓸지 추상화
// cs 스키마는 PostgREST(anon API)에 노출돼 있지 않고, 노출하면 RLS off 라 보안 구멍.
// → 프로덕션: 'pg' (직접 Postgres, service 자격). 서버/CI 에서 CS_DATABASE_URL 사용.
// → dev 검증:  'sql' (INSERT/UPSERT SQL 파일 생성 → Supabase MCP execute_sql 로 적용).
import { readFileSync, writeFileSync, existsSync } from 'fs';

const sq = s => s == null ? 'NULL' : "'" + String(s).replace(/'/g, "''") + "'";
const jb = a => "'" + JSON.stringify(a || []).replace(/'/g, "''") + "'::jsonb";
const bo = b => b ? 'true' : 'false';
const nn = n => (n == null || n === '') ? 'NULL' : Number(n);

const STAGE_TABLE = { plans: 'plans_staging', bundles: 'bundles_staging', faqs: 'faqs_staging' };
const NAME_COL   = { plans: 'plan_name', bundles: 'bundle_name', faqs: 'question' };
// sample/added 리스트 상한 — fingerprint 해시는 전체 항목 대상이라 변경감지엔 영향 없음.
// 이 상한은 '사람이 읽는 delta 목록'에만 적용(meta row 슬림 유지).
const SAMPLE_CAP = 60;

function logSql(p, r) {
  return `insert into cs.crawl_log (batch_id,carrier,area,outcome,ok,alert,item_count,prev_count,fingerprint,prev_fingerprint,added,removed,staged,summary,note) values (`
    + `${sq(r.batch_id)},${sq(p.carrier)},${sq(p.area)},${sq(r.outcome)},${bo(r.ok)},${bo(r.alert)},${nn(r.item_count)},${nn(r.prev_count)},`
    + `${sq(r.fingerprint)},${sq(r.prev_fingerprint)},${jb((r.added || []).slice(0, SAMPLE_CAP))},${jb((r.removed || []).slice(0, SAMPLE_CAP))},${nn(r.staged || 0)},${sq(r.summary)},${sq(r.note)});`;
}
function metaSql(p, r) {
  if (['new', 'changed', 'unchanged'].includes(r.outcome)) {
    return `insert into cs.crawl_meta (carrier,area,fingerprint,item_count,sample,last_ok,updated_at) values (`
      + `${sq(p.carrier)},${sq(p.area)},${sq(r.fingerprint)},${nn(r.item_count)},${jb((r.names_full || []).slice(0, SAMPLE_CAP))},true,now()) `
      + `on conflict (carrier,area) do update set fingerprint=excluded.fingerprint,item_count=excluded.item_count,sample=excluded.sample,last_ok=true,updated_at=now();`;
  }
  // 경보(empty/suspicious/error): 기준선 유지, last_ok 만 false (없으면 baseline 생성)
  return `insert into cs.crawl_meta (carrier,area,fingerprint,item_count,last_ok,updated_at) values (`
    + `${sq(p.carrier)},${sq(p.area)},NULL,${nn(r.item_count)},false,now()) `
    + `on conflict (carrier,area) do update set last_ok=false,updated_at=now();`;
}
function stageSql(p, r) {
  const table = STAGE_TABLE[p.area], col = NAME_COL[p.area];
  if (!table || !col) return { sql: null, n: 0 };
  const names = (r.added || []).slice(0, 40);
  if (!names.length) return { sql: null, n: 0 };
  const now = 'now()';
  const marker = '[auto-detect] 목록 변경 감지 — 상세수집/검수 대기';
  const rows = names.map(n => {
    if (p.area === 'plans')   return `(${sq(p.carrier)},${sq(n)},${sq(marker)},${sq(r.batch_id)},${now})`;
    if (p.area === 'bundles') return `(${sq(p.carrier)},${sq(n)},${sq(marker)},${sq(r.batch_id)},${now})`;
    return `(${sq(p.carrier)},'etc',${sq(n)},${sq(marker)},'auto-detect',${sq(r.batch_id)},${now})`;
  });
  const cols = p.area === 'plans' ? '(carrier,plan_name,conditions,batch_id,crawled_at)'
    : p.area === 'bundles' ? '(carrier,bundle_name,discount_rule,batch_id,crawled_at)'
    : '(carrier,topic_code,question,answer,source_url,batch_id,crawled_at)';
  return { sql: `insert into cs.${table} ${cols} values\n  ${rows.join(',\n  ')};`, n: rows.length };
}

// ── PG sink (프로덕션) ─────────────────────────────────────────────
async function pgSink(url) {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  const q = (text) => pool.query(text);
  return {
    async loadMeta() {
      const { rows } = await q('select carrier,area,fingerprint,item_count,sample,last_ok from cs.crawl_meta');
      return new Map(rows.map(r => [`${r.carrier}|${r.area}`, r]));
    },
    async stageDelta(p, r) { const { sql, n } = stageSql(p, r); if (sql) await q(sql); return n; },
    async writeLog(p, r) { await q(logSql(p, r)); },
    async upsertMeta(p, r) { await q(metaSql(p, r)); },
    async finalize() { await pool.end(); },
  };
}

// ── SQL-emit sink (dev/MCP 검증) ──────────────────────────────────
//   loadMeta: --meta-in <file> (MCP 로 export 한 crawl_meta JSON) 에서 읽음
//   기록: 모든 SQL 을 <emitFile> 에 append → 사람이 MCP execute_sql 로 적용
function sqlSink(emitFile, metaIn) {
  const buf = ['-- cs-crawler 감지 결과 — Supabase MCP execute_sql 로 적용 (dev)'];
  return {
    async loadMeta() {
      if (!metaIn || !existsSync(metaIn)) return new Map();
      const arr = JSON.parse(readFileSync(metaIn, 'utf8'));
      return new Map((arr || []).map(r => [`${r.carrier}|${r.area}`, r]));
    },
    async stageDelta(p, r) { const { sql, n } = stageSql(p, r); if (sql) buf.push(sql); return n; },
    async writeLog(p, r) { buf.push(logSql(p, r)); },
    async upsertMeta(p, r) { buf.push(metaSql(p, r)); },
    async finalize() { writeFileSync(emitFile, buf.join('\n') + '\n'); console.error(`\n📄 SQL emit → ${emitFile} (${buf.length - 1} stmt) · MCP execute_sql 로 적용`); },
  };
}

// noop (dry)
function noopSink() {
  return { async loadMeta() { return new Map(); }, async stageDelta() { return 0; }, async writeLog() {}, async upsertMeta() {}, async finalize() {} };
}

export async function makeSink({ dry, emitFile, metaIn, pgUrl }) {
  if (dry) return noopSink();
  if (emitFile) return sqlSink(emitFile, metaIn);
  if (pgUrl) return pgSink(pgUrl);
  console.error('⚠️ sink 미지정(CS_DATABASE_URL 없음, --emit-sql 없음) → dry 로 강등');
  return noopSink();
}
