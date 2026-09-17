/**
 * rental-payout-runner.js — 가이드·MAX 엔진 실행기
 *   트리거: 매주 월 06:00 KST(cron) · 빌리고 엑셀 확정 직후 · 관리자 수동
 *   설정(rental_engine_settings)의 정책으로 buildPayoutPlan → 실행 기록(rental_payout_runs) → 자동 적용이면 조건별 반영(변경 로그에 run_id)
 */
import { supabase } from '../db/supabase.js';
import { loadDataset, resetDatasetCache, buildPayoutPlan, ENGINE_VERSION } from './rental-margin-engine.js';

let running = false;
const CHUNK = 3000;

export async function getEngineSettings() {
  const { data } = await supabase.from('rental_engine_settings').select('*').eq('id', 1).maybeSingle().throwOnError();
  return data || { id: 1, policy: {}, auto_apply: false, cycle: 'weekly_mon_06' };
}

/**
 * @param {{ trigger: 'manual'|'weekly'|'import'|'preview', user?: string, apply?: boolean, policy?: object }} opts
 */
export async function runPayoutEngine({ trigger, user = 'system', apply = false, policy: override } = {}) {
  if (running) return { ok: false, busy: true, error: '엔진이 이미 실행 중입니다' };
  running = true;
  let runId = null;
  try {
    const settings = await getEngineSettings();
    const policy = { ...(settings.policy || {}), ...(override || {}) };
    resetDatasetCache();
    const ds = await loadDataset();
    const plan = buildPayoutPlan(ds, policy);
    if (!plan.ok) return { ok: false, error: plan.errors.join(' · ') };

    const { data: run } = await supabase.from('rental_payout_runs').insert({
      engine_version: ENGINE_VERSION, trigger: apply ? trigger : 'preview', policy: plan.policy, signals: plan.signals, stats: plan.stats,
      summary: plan.summary, categories: plan.categories.map((c) => ({ category: c.category, conditions: c.conditions, now: c.now, rule: c.rule, note: c.note })),
      changed: plan.changes.length, status: 'planned', created_by: user,
    }).select('id').single().throwOnError();
    runId = run.id;

    let applied = 0;
    if (apply && plan.changes.length) {
      const label = `AI 엔진 v${ENGINE_VERSION} · ${trigger} · ${new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })}`;
      for (let i = 0; i < plan.changes.length; i += CHUNK) {
        const items = plan.changes.slice(i, i + CHUNK).map((c) => ({ id: c.id, g: c.guide, m: c.max, r: c.reason }));
        const { data } = await supabase.rpc('rental_cat_apply_payout_batch', { p_items: items, p_label: label, p_run_id: runId }).throwOnError();
        applied += data || 0;
      }
      await supabase.from('rental_payout_runs').update({ status: 'applied', applied_at: new Date().toISOString(), changed: applied }).eq('id', runId).throwOnError();
      resetDatasetCache();
    }
    console.log(`[payout-engine] ${trigger} run=${runId} planned=${plan.changes.length} applied=${applied}`);
    const top = [...plan.changes].sort((a, b) => Math.abs(b.guide - (b.old_guide ?? 0)) - Math.abs(a.guide - (a.old_guide ?? 0))).slice(0, 50);
    return { ok: true, run_id: runId, applied, plan: { ...plan, changes: undefined, changes_count: plan.changes.length, sample_changes: top } };
  } catch (e) {
    console.error('[payout-engine]', e.message);
    if (runId) await supabase.from('rental_payout_runs').update({ status: 'failed', error: String(e.message).slice(0, 500) }).eq('id', runId);
    return { ok: false, error: e.message };
  } finally {
    running = false;
  }
}

/** 자동 적용이 켜져 있을 때만 (cron·엑셀 확정 뒤) */
export async function runIfAuto(trigger) {
  const s = await getEngineSettings().catch(() => null);
  if (!s?.auto_apply) { console.log(`[payout-engine] ${trigger}: 자동 적용 꺼짐 — 건너뜀`); return null; }
  return runPayoutEngine({ trigger, user: `auto:${trigger}`, apply: true });
}
