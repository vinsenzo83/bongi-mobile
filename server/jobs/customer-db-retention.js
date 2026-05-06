// ═══════════════════════════════════════════════════════════════════════
// customer-db retention cron — 매일 03:00 KST 자동 실행
// ─ A. converted 후 90일   → archived (resolved)
// ─ B. rejected 후 30일    → archived (cooldown, DNT 제외 = 영구 보존)
// ─ C. archived 후 90일    → deleted_at (soft delete)
// ─ D. deleted_at 후 1095일 → 물리 삭제 (PIPA 보존 만료)
// ═══════════════════════════════════════════════════════════════════════
import { supabase } from '../db/supabase.js';

const POLICY = {
  CONVERTED_TO_ARCHIVE_DAYS: 90,
  REJECTED_TO_ARCHIVE_DAYS: 30,
  ARCHIVE_TO_SOFT_DELETE_DAYS: 90,
  SOFT_DELETE_TO_PURGE_DAYS: 1095, // 3년 (PIPA)
};

const daysAgoIso = (n) => new Date(Date.now() - n * 86400000).toISOString();

async function archiveAgedConverted() {
  const cutoff = daysAgoIso(POLICY.CONVERTED_TO_ARCHIVE_DAYS);
  const { data, error } = await supabase.from('incentive_customer_db')
    .update({ archived: true, archived_at: new Date().toISOString(), archived_reason: 'converted_aged', updated_at: new Date().toISOString() })
    .eq('archived', false).is('deleted_at', null).eq('call_status', 'converted')
    .lt('last_contacted_at', cutoff).select('id');
  if (error) throw error;
  return data?.length || 0;
}

async function archiveAgedRejected() {
  const cutoff = daysAgoIso(POLICY.REJECTED_TO_ARCHIVE_DAYS);
  const { data, error } = await supabase.from('incentive_customer_db')
    .update({ archived: true, archived_at: new Date().toISOString(), archived_reason: 'rejected_aged', updated_at: new Date().toISOString() })
    .eq('archived', false).is('deleted_at', null).eq('call_status', 'rejected').neq('is_dnt', true)
    .lt('last_contacted_at', cutoff).select('id');
  if (error) throw error;
  return data?.length || 0;
}

async function softDeleteAgedArchived() {
  const cutoff = daysAgoIso(POLICY.ARCHIVE_TO_SOFT_DELETE_DAYS);
  const { data, error } = await supabase.from('incentive_customer_db')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('archived', true).is('deleted_at', null)
    .lt('archived_at', cutoff).select('id');
  if (error) throw error;
  return data?.length || 0;
}

async function purgeAgedSoftDeleted() {
  const cutoff = daysAgoIso(POLICY.SOFT_DELETE_TO_PURGE_DAYS);
  const { data: targets, error: e1 } = await supabase.from('incentive_customer_db')
    .select('id').not('deleted_at', 'is', null).lt('deleted_at', cutoff).limit(5000);
  if (e1) throw e1;
  if (!targets?.length) return 0;
  const ids = targets.map(t => t.id);
  // 1) call_log 먼저 정리
  await supabase.from('incentive_customer_call_log').delete().in('customer_id', ids);
  // 2) customer 영구 삭제
  const { error: e2 } = await supabase.from('incentive_customer_db').delete().in('id', ids);
  if (e2) throw e2;
  return ids.length;
}

export async function runRetentionJob() {
  const startedAt = new Date();
  const result = { started_at: startedAt.toISOString(), steps: {} };
  try {
    result.steps.archive_converted = await archiveAgedConverted();
    result.steps.archive_rejected = await archiveAgedRejected();
    result.steps.soft_delete_archived = await softDeleteAgedArchived();
    result.steps.purge_soft_deleted = await purgeAgedSoftDeleted();
    result.ok = true;
  } catch (e) {
    result.ok = false;
    result.error = e.message;
    console.error('[retention] error:', e);
  }
  result.finished_at = new Date().toISOString();
  result.duration_ms = Date.now() - startedAt.getTime();
  console.log('[retention] done:', JSON.stringify(result));
  return result;
}

export const RETENTION_POLICY = POLICY;
