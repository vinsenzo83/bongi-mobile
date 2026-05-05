#!/usr/bin/env node
// 4개 페이지를 incentive-admin.html (통합)로 빌드
// 기존 페이지는 그대로 유지 (이 빌더는 새 통합 페이지만 생성)

import fs from 'fs';
import path from 'path';

const PAGES = [
  { key: 'dashboard', label: '📊 대시보드', file: 'incentive-dashboard.html' },
  { key: 'contract',  label: '📋 계약 처리', file: 'incentive-contract.html' },
  { key: 'agents',    label: '👥 상담사 관리', file: 'incentive-agents.html', adminOnly: true },
  { key: 'rules',     label: '⚙️ 정책 관리',   file: 'incentive-rules.html', adminOnly: true },
];

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const DOCS = path.join(ROOT, '..', 'docs');

function extract(html) {
  // <style> 모든 블록
  const cssBlocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]);
  const css = cssBlocks.join('\n');

  // <body> 안 콘텐츠
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/);
  let body = bodyMatch ? bodyMatch[1] : '';

  // <script> 모든 블록 (src 없는 것만)
  const scripts = [...body.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const js = scripts.join('\n');

  // body에서 script 제거
  body = body.replace(/<script(?![^>]*src=)[^>]*>[\s\S]*?<\/script>/g, '');

  // body에서 auth-overlay, header, admin-nav 제거 (통합 페이지에서 별도 처리)
  body = body.replace(/<header[^>]*>[\s\S]*?<\/header>/, '');
  body = body.replace(/<div\s+class="auth-box"[\s\S]*?<\/div>\s*(?=<div\s+id="main-area")/, '');
  body = body.replace(/<!-- 🧭[\s\S]*?<\/script>/g, '');
  body = body.replace(/<div\s+id="admin-nav"[\s\S]*?<\/div>/g, '');
  body = body.replace(/<div\s+id="toast"[^>]*><\/div>/g, ''); // 통합 페이지에 단일 토스트

  // <div id="main-area"> 내부 콘텐츠 추출
  const mainMatch = body.match(/<div\s+id="main-area"[^>]*>([\s\S]*)<\/div>\s*<\/div>\s*$/);
  let mainContent = mainMatch ? mainMatch[1] : body;

  return { css, mainContent, js };
}

function prefixIds(content, js, prefix) {
  // HTML 안의 id="X" 찾기
  const ids = new Set();
  for (const m of content.matchAll(/id="([^"]+)"/g)) ids.add(m[1]);
  for (const m of content.matchAll(/data-field="([^"]+)"/g)) {} // data-field는 prefix 안함

  // JS 안의 getElementById('X') 찾기
  for (const m of js.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)) ids.add(m[1]);

  // 공통/제외할 ID들 (전역 또는 다른 페이지와 공유 안 하는 게 좋음)
  const skip = new Set(['toast', 'edit-modal', 'modal-overlay', 'modal-content', 'modal-body', 'modal-close-btn', 'modal-subtitle', 'modal-footer-info', 'modal-footer-actions']);

  // ID 치환
  let newContent = content;
  let newJs = js;
  for (const id of ids) {
    if (skip.has(id)) continue;
    if (id.startsWith(prefix + '-')) continue; // 이미 prefix
    const re1 = new RegExp(`id="${escapeRegex(id)}"`, 'g');
    const re2 = new RegExp(`for="${escapeRegex(id)}"`, 'g');
    const re3 = new RegExp(`getElementById\\(['"]${escapeRegex(id)}['"]\\)`, 'g');
    const re4 = new RegExp(`querySelector\\(['"]#${escapeRegex(id)}['"]\\)`, 'g');
    const re5 = new RegExp(`querySelectorAll\\(['"]#${escapeRegex(id)}([^'"]*)['"]\\)`, 'g');
    const newId = `${prefix}-${id}`;
    newContent = newContent.replace(re1, `id="${newId}"`).replace(re2, `for="${newId}"`);
    newJs = newJs.replace(re3, `getElementById('${newId}')`).replace(re4, `querySelector('#${newId}')`)
                 .replace(re5, (m, rest) => `querySelectorAll('#${newId}${rest}')`);
  }

  // CSS의 id 셀렉터 prefix는 안 건드림 (CSS는 통합되니 inline style 사용 위주)

  return { content: newContent, js: newJs };
}

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

const tabsHtml = [];
const tabsCss = [];
const tabsJs = [];

for (const p of PAGES) {
  const html = fs.readFileSync(path.join(DOCS, p.file), 'utf8');
  const { css, mainContent, js } = extract(html);
  const { content, js: jsPrefixed } = prefixIds(mainContent, js, p.key);

  tabsCss.push(`/* ─── ${p.key} CSS (only kept once if duplicated; later panel uses inline styles) ─── */\n${css}`);

  tabsHtml.push(`<div class="panel" id="panel-${p.key}" data-init="false" style="display:none">\n${content}\n</div>`);

  // JS — IIFE로 감싸서 격리. init은 외부 호출용으로 노출
  tabsJs.push(`
// ═══════════════════════════════ ${p.key} (${p.label}) ═══════════════════════════════
const Tab_${p.key} = (function() {
  let _initDone = false;
${jsPrefixed}
  // init 함수가 페이지에 있으면 그것을, 없으면 빈 함수
  return {
    init: function() {
      if (_initDone) return;
      _initDone = true;
      try { if (typeof init === 'function') init(); } catch(e) { console.error('${p.key} init err:', e); }
    },
    onLoggedIn: function(agent) {
      try { if (typeof onLoggedIn === 'function') onLoggedIn(agent); } catch(e) { console.error('${p.key} onLoggedIn err:', e); }
    },
  };
})();
`);
}

// 최종 파일 생성
const out = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>인센티브 어드민 (통합 V5)</title>
<link rel="stylesheet" as="style" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css">
<style>
* { box-sizing: border-box; margin:0; padding:0; }
html, body { height:100%; overflow:hidden; }
body { font-family: 'Pretendard Variable', sans-serif; background:#0f172a; color:#e2e8f0; display:flex; flex-direction:column; }
.top-bar { background:linear-gradient(135deg,#0f172a,#1e293b); border-bottom:1.5px solid #334155; padding:10px 20px; display:flex; justify-content:space-between; align-items:center; flex-shrink:0; }
.top-bar h1 { font-size:16px; color:#f8fafc; font-weight:800; letter-spacing:-0.02em; }
.top-bar h1 .v { background:#3b82f6; color:#fff; padding:2px 8px; border-radius:4px; font-size:10px; margin-left:6px; }
.top-bar .user { display:flex; gap:10px; align-items:center; }
.top-bar .user-name { font-size:12px; color:#f8fafc; font-weight:700; }
.top-bar .user-meta { font-size:10px; color:#94a3b8; }
.top-bar .role-badge { padding:2px 8px; border-radius:4px; font-size:10px; font-weight:800; }
.top-bar .role-manager { background:#16a34a; color:#fff; }
.top-bar .role-admin { background:#dc2626; color:#fff; }
.top-bar button { background:#475569; color:#fff; border:none; padding:5px 11px; border-radius:5px; cursor:pointer; font-size:11px; font-weight:700; }
.main { flex:1; display:flex; min-height:0; }
aside.sidebar { width:200px; background:#1e293b; border-right:1.5px solid #334155; padding:14px 0; display:flex; flex-direction:column; gap:2px; flex-shrink:0; overflow-y:auto; }
.tab-btn { background:transparent; border:none; color:#cbd5e1; padding:11px 18px; text-align:left; cursor:pointer; font-size:12.5px; font-weight:700; letter-spacing:0.02em; display:flex; align-items:center; gap:10px; border-left:3px solid transparent; transition:all 0.15s; font-family:inherit; }
.tab-btn:hover { background:rgba(59,130,246,0.1); color:#f8fafc; }
.tab-btn.active { background:rgba(59,130,246,0.15); color:#60a5fa; border-left-color:#3b82f6; font-weight:800; }
.tab-btn .icon { font-size:14px; }
.tab-btn.admin-only { display:none; }
body.is-admin .tab-btn.admin-only { display:flex; }
.sidebar-divider { border-top:1px solid #334155; margin:14px 14px; }
.sidebar-link { color:#94a3b8; padding:8px 18px; text-decoration:none; font-size:11px; }
.sidebar-link:hover { color:#f8fafc; }
.content-area { flex:1; min-width:0; background:#0f172a; overflow-y:auto; padding:20px; }
.panel { display:none; }
.panel.active { display:block; }
.panel #main-area, .panel [id$="-main-area"] { display:block !important; }
.auth-overlay { position:fixed; inset:0; background:rgba(15,23,42,0.95); display:flex; justify-content:center; align-items:center; z-index:9999; }
.auth-box { background:linear-gradient(135deg,#1e293b,#334155); border:1.5px solid #475569; border-radius:12px; padding:24px 28px; width:380px; box-shadow:0 20px 60px rgba(0,0,0,0.6); }
.auth-box h2 { font-size:16px; color:#60a5fa; font-weight:800; margin-bottom:14px; }
.auth-box input { width:100%; background:#0f172a; border:1px solid #475569; color:#e2e8f0; padding:10px 12px; border-radius:6px; font-size:13px; margin-bottom:8px; }
.auth-box button { width:100%; background:#3b82f6; color:#fff; border:none; padding:11px; border-radius:6px; font-weight:800; cursor:pointer; font-size:13px; }
.auth-msg { font-size:11px; margin-top:8px; min-height:16px; color:#dc2626; }
.auth-hint { font-size:10px; color:#94a3b8; margin-top:10px; line-height:1.5; }
input[type="date"], input[type="month"] { color-scheme: dark; }
input[type="date"]::-webkit-calendar-picker-indicator, input[type="month"]::-webkit-calendar-picker-indicator { filter: invert(1) brightness(2); cursor:pointer; }

${tabsCss.join('\n\n')}
</style>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js" defer></script>
</head>
<body>

<header class="top-bar">
  <h1>⚡ 인센티브 어드민<span class="v">V5</span></h1>
  <div class="user" id="g-user-info" style="display:none">
    <div>
      <div class="user-name" id="g-user-name">-</div>
      <div class="user-meta"><span class="role-badge" id="g-role-badge">-</span> · <span id="g-user-center">-</span></div>
    </div>
    <button id="g-logout-btn">로그아웃</button>
  </div>
</header>

<div class="main" id="g-main" style="display:none">
  <aside class="sidebar">
${PAGES.map((p, i) => `    <button class="tab-btn${i===0?' active':''}${p.adminOnly?' admin-only':''}" data-tab="${p.key}"><span class="icon">${p.label.split(' ')[0]}</span> ${p.label.split(' ').slice(1).join(' ')}</button>`).join('\n')}
    <div class="sidebar-divider"></div>
    <a class="sidebar-link" href="/docs/tm.html">↗ TM 견적 (관리자)</a>
    <a class="sidebar-link" href="/docs/master-map.html">↗ 전체 문서맵</a>
  </aside>
  <div class="content-area" id="g-content-area">
${tabsHtml.map((h,i) => i===0 ? h.replace('class="panel"', 'class="panel active"') : h).join('\n')}
  </div>
</div>

<div id="toast" style="position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:#16a34a;color:#fff;padding:14px 24px;border-radius:10px;font-size:14px;font-weight:800;box-shadow:0 6px 24px rgba(22,163,74,0.5);z-index:99999;opacity:0;transition:opacity 0.2s;pointer-events:none"></div>

<div class="auth-overlay" id="g-auth-overlay">
  <div class="auth-box">
    <h2>🔐 인센티브 어드민 로그인</h2>
    <input type="email" id="g-auth-email" placeholder="email" autocomplete="username">
    <input type="password" id="g-auth-pass" placeholder="비밀번호" autocomplete="current-password">
    <button id="g-auth-login-btn">로그인</button>
    <div class="auth-msg" id="g-auth-msg"></div>
    <div class="auth-hint">
      manager 또는 admin 권한 필요.<br>
      테스트: <code style="background:#0f172a;padding:1px 5px;border-radius:3px">manager1@bongi.test</code> / <code>admin1@bongi.test</code> (비번 <code>pass1234!</code>)
    </div>
  </div>
</div>

<script>
// ═══════════════════════════════ 공용 인증 + 탭 컨트롤러 ═══════════════════════════════
const G_API = '/api/incentive';
const G_AUTH = '/api/auth';
const G_TOKEN_KEY = 'incentive-auth-token-v1';
const gGetToken = () => localStorage.getItem(G_TOKEN_KEY);
const gSetToken = (t) => localStorage.setItem(G_TOKEN_KEY, t);
const gClearToken = () => localStorage.removeItem(G_TOKEN_KEY);
window.G_currentAgent = null;

async function gLogin(email, password) {
  const res = await fetch(G_AUTH + '/login', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({email, password})
  });
  if (!res.ok) throw new Error((await res.json()).error || '로그인 실패');
  const data = await res.json();
  gSetToken(data.access_token);
  return data;
}

async function gFetchAgent() {
  const tk = gGetToken(); if (!tk) return null;
  const res = await fetch(G_API + '/agents/me', {headers: {Authorization: 'Bearer ' + tk}});
  if (!res.ok) { gClearToken(); return null; }
  return (await res.json()).agent;
}

function gShowToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(window._gToastTimer);
  window._gToastTimer = setTimeout(() => { t.style.opacity = '0'; }, 2500);
}

function gSwitchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + tabName));
  // 첫 활성화 시 init
  const tab = window['Tab_' + tabName];
  if (tab && typeof tab.init === 'function') {
    setTimeout(() => {
      tab.init();
      if (window.G_currentAgent && typeof tab.onLoggedIn === 'function') tab.onLoggedIn(window.G_currentAgent);
    }, 50);
  }
}

function gOnLoggedIn(agent) {
  window.G_currentAgent = agent;
  document.getElementById('g-user-name').textContent = '👤 ' + agent.name;
  document.getElementById('g-user-center').textContent = agent.center;
  const badge = document.getElementById('g-role-badge');
  badge.textContent = agent.role;
  badge.className = 'role-badge role-' + agent.role;
  document.getElementById('g-user-info').style.display = '';
  document.getElementById('g-main').style.display = '';
  document.getElementById('g-auth-overlay').style.display = 'none';
  document.body.classList.toggle('is-admin', agent.role === 'admin');
  // 첫 탭 init
  gSwitchTab('dashboard');
}

async function gInit() {
  const tk = gGetToken();
  if (tk) {
    const agent = await gFetchAgent();
    if (agent && (agent.role === 'manager' || agent.role === 'admin')) { gOnLoggedIn(agent); return; }
    if (agent) {
      document.getElementById('g-auth-msg').textContent = '⚠️ manager/admin 권한 필요 (현재 ' + agent.role + ')';
      gClearToken();
    }
  }
  document.getElementById('g-auth-overlay').style.display = '';
}

document.getElementById('g-auth-login-btn').addEventListener('click', async () => {
  const email = document.getElementById('g-auth-email').value.trim();
  const password = document.getElementById('g-auth-pass').value;
  const msg = document.getElementById('g-auth-msg');
  msg.textContent = '';
  if (!email || !password) { msg.textContent = '이메일/비밀번호 입력'; return; }
  try {
    await gLogin(email, password);
    const agent = await gFetchAgent();
    if (!agent || (agent.role !== 'manager' && agent.role !== 'admin')) {
      msg.textContent = 'manager/admin 권한 필요'; gClearToken(); return;
    }
    gOnLoggedIn(agent);
  } catch (e) { msg.textContent = e.message; }
});
document.getElementById('g-auth-pass').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('g-auth-login-btn').click(); });
document.getElementById('g-logout-btn').addEventListener('click', () => { gClearToken(); location.reload(); });
document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => gSwitchTab(btn.dataset.tab)));

// 페이지 로드 후 init
setTimeout(gInit, 100);
</script>

<!-- ═════════════════ 각 탭 모듈 (IIFE 격리) ═════════════════ -->
<script>
${tabsJs.join('\n')}
</script>

</body>
</html>
`;

const outPath = path.join(DOCS, 'incentive-admin.html');
fs.writeFileSync(outPath, out);
console.log(`✅ ${outPath} 생성 완료 (${out.length} bytes, ${out.split('\n').length} 줄)`);

// server/public 동기화
fs.copyFileSync(outPath, path.join(DOCS, '..', 'server', 'public', 'docs', 'incentive-admin.html'));
console.log('✅ server/public/docs 동기화 완료');
