// cs-crawler 알림 유틸 — 콘솔 출력 + (후크) 이메일/슬랙
// MVP: 콘솔 + cs.crawl_log 가 1차 채널. 외부 채널은 후크만 두고 TODO.
const ICON = { new: '🆕', unchanged: '·', changed: '🔔', empty: '⛔', suspicious: '⚠️', error: '❌' };

export function line(r) {
  return `${ICON[r.outcome] || '·'} [${r.carrier} ${r.area}] ${r.outcome} — ${r.summary}`;
}

// 개별 probe 결과 콘솔 출력
export function logResult(r) {
  const msg = line(r);
  if (r.alert) console.error(msg);          // 경보는 stderr
  else console.error('  ' + msg);
}

// 일일 요약 (매 실행 마지막)
export function summarize(results) {
  const by = o => results.filter(r => r.outcome === o).length;
  const changed = results.filter(r => ['changed', 'suspicious', 'new'].includes(r.outcome));
  const alerts = results.filter(r => r.alert);
  const staged = results.reduce((s, r) => s + (r.staged || 0), 0);
  const summary =
    `📊 CS 크롤 요약: 총 ${results.length}개 probe | ` +
    `무변경 ${by('unchanged')} · 변경 ${by('changed')} · 신규 ${by('new')} · ` +
    `경보 ${alerts.length}(빈값 ${by('empty')}/급감 ${by('suspicious')}/오류 ${by('error')}) | ` +
    `staging 적재 ${staged}건 (승인 대기)`;
  console.error('\n' + '='.repeat(72));
  console.error(summary);
  if (changed.length) {
    console.error('— 변경/신규:');
    changed.forEach(r => console.error('   ' + line(r)));
  }
  if (alerts.length) {
    console.error('— ⚠️ 경보(사람 확인 필요):');
    alerts.forEach(r => console.error('   ' + line(r)));
  }
  console.error('='.repeat(72));
  return { summary, alertCount: alerts.length, changedCount: changed.length, staged };
}

// ── 외부 채널 후크 (TODO) ──────────────────────────────────────────────
// 실제 발송은 미구현. 환경변수 설정 시에만 payload 를 만들어 전달할 자리.
export async function notifyExternal(digest, results) {
  const alerts = results.filter(r => r.alert);
  const changed = results.filter(r => ['changed', 'suspicious', 'new'].includes(r.outcome));
  if (!alerts.length && !changed.length) return; // 조용한 날은 발송 안 함

  const text = [digest.summary, ...alerts.map(line), ...changed.map(line)].join('\n');

  // TODO(slack): if (process.env.CS_SLACK_WEBHOOK) await fetch(webhook, {method:'POST', body: JSON.stringify({text})})
  // TODO(email): if (process.env.CS_ALERT_EMAIL) await sendEmail(process.env.CS_ALERT_EMAIL, 'CS 크롤 변경 감지', text)
  if (process.env.CS_SLACK_WEBHOOK || process.env.CS_ALERT_EMAIL) {
    console.error('[notify] 외부 채널 후크 준비됨 — 발송 로직 미구현(TODO). payload 길이:', text.length);
  }
}
