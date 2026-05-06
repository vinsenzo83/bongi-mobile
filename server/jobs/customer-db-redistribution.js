// ═══════════════════════════════════════════════════════════════════════
// customer-db 자동 재배정 cron — 매일 04:00 KST
// ─ A. 분배 후 7일 + call_count=0 (한 번도 시도 안 함) → 풀로 되돌림 (assigned_center 유지)
// ─ B. 분배 후 14일 + call_status in (pending,no_answer) + call_count ≤ 2 → 풀로 되돌림
// ─ 변경 이력은 incentive_customer_call_log에 stamp (result='callback', notes='auto_redistribute')
// ═══════════════════════════════════════════════════════════════════════
import { supabase } from '../db/supabase.js';

const POLICY = {
  STALE_NO_ATTEMPT_DAYS: 7,
  STALE_LOW_ACTIVITY_DAYS: 14,
  LOW_ACTIVITY_MAX_CALLS: 2,
};

const daysAgoIso = (n) => new Date(Date.now() - n * 86400000).toISOString();

async function reclaimNoAttempt() {
  const cutoff = daysAgoIso(POLICY.STALE_NO_ATTEMPT_DAYS);
  const { data: targets } = await supabase.from('incentive_customer_db')
    .select('id, assigned_agent_id, assigned_center')
    .not('assigned_agent_id', 'is', null)
    .eq('call_count', 0)
    .lt('assigned_at', cutoff)
    .eq('archived', false).is('deleted_at', null)
    .limit(5000);
  if (!targets?.length) return 0;
  const ids = targets.map(t => t.id);
  // 풀로 되돌림 — assigned_agent_id NULL, assigned_center 유지 (manager가 다시 분배)
  await supabase.from('incentive_customer_db').update({
    assigned_agent_id: null,
    assigned_at: null,
    updated_at: new Date().toISOString(),
  }).in('id', ids);
  // call_log stamp (이전 분배 agent별)
  const logs = targets.map(t => ({
    customer_id: t.id, agent_id: t.assigned_agent_id, result: 'callback',
    notes: 'auto_redistribute · 7일 미시도 → 풀 복귀',
  }));
  await supabase.from('incentive_customer_call_log').insert(logs);
  return ids.length;
}

async function reclaimLowActivity() {
  const cutoff = daysAgoIso(POLICY.STALE_LOW_ACTIVITY_DAYS);
  const { data: targets } = await supabase.from('incentive_customer_db')
    .select('id, assigned_agent_id, assigned_center, call_count, last_contacted_at')
    .not('assigned_agent_id', 'is', null)
    .gt('call_count', 0).lte('call_count', POLICY.LOW_ACTIVITY_MAX_CALLS)
    .in('call_status', ['pending', 'no_answer'])
    .lt('assigned_at', cutoff)
    .eq('archived', false).is('deleted_at', null)
    .limit(5000);
  if (!targets?.length) return 0;
  // 마지막 컨택이 cutoff 이전인 것만 (서버 측 추가 필터)
  const cutoffMs = Date.now() - POLICY.STALE_LOW_ACTIVITY_DAYS * 86400000;
  const filtered = targets.filter(t => !t.last_contacted_at || new Date(t.last_contacted_at).getTime() < cutoffMs);
  if (!filtered.length) return 0;
  const ids = filtered.map(t => t.id);
  await supabase.from('incentive_customer_db').update({
    assigned_agent_id: null,
    assigned_at: null,
    updated_at: new Date().toISOString(),
  }).in('id', ids);
  const logs = filtered.map(t => ({
    customer_id: t.id, agent_id: t.assigned_agent_id, result: 'callback',
    notes: `auto_redistribute · ${POLICY.STALE_LOW_ACTIVITY_DAYS}일 ${t.call_count}회 시도 → 풀 복귀`,
  }));
  await supabase.from('incentive_customer_call_log').insert(logs);
  return ids.length;
}

export async function runRedistributionJob() {
  const startedAt = new Date();
  const result = { started_at: startedAt.toISOString(), steps: {} };
  try {
    result.steps.reclaim_no_attempt = await reclaimNoAttempt();
    result.steps.reclaim_low_activity = await reclaimLowActivity();
    result.ok = true;
  } catch (e) {
    result.ok = false;
    result.error = e.message;
    console.error('[redistribution] error:', e);
  }
  result.finished_at = new Date().toISOString();
  result.duration_ms = Date.now() - startedAt.getTime();
  console.log('[redistribution] done:', JSON.stringify(result));
  return result;
}

export const REDISTRIBUTION_POLICY = POLICY;
