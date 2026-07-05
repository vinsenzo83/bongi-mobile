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

// ── 외부 채널 (이메일=Resend / Slack) ──────────────────────────────────
// 조용한 날(변경·경보 0)은 발송 안 함. 자격(RESEND_API_KEY) 없으면 조용히 skip.
export async function notifyExternal(digest, results) {
  const alerts = results.filter(r => r.alert);
  const changed = results.filter(r => ['changed', 'suspicious', 'new'].includes(r.outcome));
  if (!alerts.length && !changed.length) return; // 조용한 날은 발송 안 함

  const text = [digest.summary, '', ...alerts.map(line), ...changed.map(line),
    '', '※ 변경분은 staging에 적재됨(승인 대기). 반영은 운영자 검수 후 수동.'].join('\n');
  const subject = `[봉이 CS크론] 변경 ${digest.changedCount} · 경보 ${digest.alertCount} — ${new Date().toISOString().slice(0,10)}`;

  // 이메일 (Resend HTTP API)
  const email = process.env.CS_ALERT_EMAIL;
  const key = process.env.RESEND_API_KEY;
  if (email && key) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.CS_ALERT_FROM || 'CS크론 <onboarding@resend.dev>',
          to: email.split(',').map(s => s.trim()),
          subject,
          text,
        }),
      });
      if (res.ok) console.error(`[notify] 이메일 발송 완료 → ${email}`);
      else console.error(`[notify] 이메일 발송 실패 ${res.status}:`, (await res.text()).slice(0, 200));
    } catch (e) { console.error('[notify] 이메일 예외:', e.message); }
  } else if (email && !key) {
    console.error('[notify] CS_ALERT_EMAIL 설정됨 but RESEND_API_KEY 없음 → 이메일 skip (GHA job 실패 시 GitHub 기본 알림으로 대체)');
  }

  // Slack (옵션)
  if (process.env.CS_SLACK_WEBHOOK) {
    try {
      await fetch(process.env.CS_SLACK_WEBHOOK, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `*${subject}*\n\`\`\`${text}\`\`\`` }),
      });
    } catch (e) { console.error('[notify] Slack 예외:', e.message); }
  }
}
