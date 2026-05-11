// ═══════════════════════════════════════════════════════════════════════
// 카드정보 자동 마스킹 cron — 매일 03:30 KST
// ─ contract_completed_at + 7일 경과 + card_masked_at IS NULL + payment_method = '신용카드'
// ─ payment_extra.card.number → ••••-••••-••••-{last4}
// ─ payment_extra.card.expiry → null
// ─ payment_extra.card.holder/company 유지 (재등록·분쟁 참고)
// ─ card_masked_at = now() 기록
// ─ 운영 흐름: 계약완료 후 7일 동안 운영팀이 통신사 자동이체 등록 처리.
//   그 이후엔 카드 평문 보관 위험이 등록 처리 효용보다 크므로 마스킹.
// ═══════════════════════════════════════════════════════════════════════
import { supabase } from '../db/supabase.js';

const MASK_AFTER_DAYS = 7;

function maskCardNumber(number) {
  if (!number) return null;
  const digits = String(number).replace(/\D/g, '');
  if (digits.length < 4) return '••••-••••-••••-••••';
  const last4 = digits.slice(-4);
  return `••••-••••-••••-${last4}`;
}

export async function runCardMaskingJob() {
  const cutoffIso = new Date(Date.now() - MASK_AFTER_DAYS * 86400000).toISOString();
  // 대상: 신용카드 + contract_completed_at + 7일 경과 + 아직 마스킹 안 됨
  const { data: rows, error } = await supabase
    .from('incentive_sales')
    .select('id, payment_extra, contract_completed_at')
    .eq('payment_method', '신용카드')
    .is('card_masked_at', null)
    .lt('contract_completed_at', cutoffIso)
    .not('payment_extra', 'is', null);
  if (error) { console.error('[card-masking] select 에러:', error.message); throw error; }

  let masked = 0, skipped = 0, failed = 0;
  for (const row of (rows || [])) {
    const pe = row.payment_extra || {};
    const card = pe.card || {};
    if (!card.number) { skipped++; continue; }   // 이미 빈 카드 — 마스킹 skip
    const newPe = {
      ...pe,
      card: {
        ...card,
        number: maskCardNumber(card.number),
        expiry: null,   // 유효기간도 제거 (재사용 차단)
      },
    };
    const { error: upErr } = await supabase
      .from('incentive_sales')
      .update({ payment_extra: newPe, card_masked_at: new Date().toISOString() })
      .eq('id', row.id);
    if (upErr) { console.error('[card-masking] update 에러 id=' + row.id, upErr.message); failed++; continue; }
    masked++;
  }
  console.log(`[card-masking] 처리 — 마스킹 ${masked}건 / skip ${skipped} / 실패 ${failed} / 후보 ${rows?.length || 0}건`);
  return { masked, skipped, failed, total: rows?.length || 0 };
}
