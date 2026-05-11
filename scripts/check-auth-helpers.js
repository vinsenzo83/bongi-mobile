#!/usr/bin/env node
/**
 * docs/ HTML에서 인증 헬퍼 누락 검사
 *
 * 2026-05-11 사건: incentive-permissions·agents·db-sources·products·rules 5개 화면이
 * const API·getToken·login·fetchAgent 정의 없이 호출 → 라이브에서 JSON parse 에러 →
 * 로그인 페이지 먹통.
 *
 * 이 스크립트는 fetch(API + ...)·getToken()·login(·fetchAgent(를 호출하는데
 * 각 헬퍼 정의가 없는 파일을 식별 → CI fail.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';

const DOCS_DIR = new URL('../docs/', import.meta.url).pathname;
const targets = readdirSync(DOCS_DIR).filter(
  (f) => /^(incentive-|tm-counselor|calculator)/.test(f) && f.endsWith('.html')
);

const CHECKS = [
  { name: 'const API', use: /fetch\(\s*API\s*\+/, def: /(?:const|let|var)\s+API\s*=/ },
  { name: 'getToken',  use: /getToken\(\)/,        def: /function\s+getToken\b|(?:const|let|var)\s+getToken\s*=/ },
  { name: 'login',     use: /\blogin\(/,           def: /(?:async\s+)?function\s+login\b/ },
  { name: 'fetchAgent', use: /fetchAgent\(/,       def: /(?:async\s+)?function\s+fetchAgent\b/ },
];

let failed = 0;
const issues = [];

for (const file of targets) {
  const path = join(DOCS_DIR, file);
  const txt = readFileSync(path, 'utf8');

  // <script> 블록 안만 검사 (HTML 텍스트·주석 무시)
  const scripts = [...txt.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');

  for (const { name, use, def } of CHECKS) {
    const used = use.test(scripts);
    const defined = def.test(scripts);
    if (used && !defined) {
      failed++;
      issues.push(`🔴 ${file}: \`${name}\` 호출했지만 정의 없음`);
    }
  }
}

if (failed > 0) {
  console.error('\n❌ 인증 헬퍼 누락 검사 실패\n');
  issues.forEach((i) => console.error('  ' + i));
  console.error(`\n총 ${failed}건 — 이 파일에 const API·getToken·login·fetchAgent 정의 추가 필요`);
  console.error('참조: docs/incentive-admin.html line 280~340 또는 incentive-permissions.html line 314~344\n');
  process.exit(1);
} else {
  console.log(`✅ 인증 헬퍼 검사 통과 (${targets.length}개 파일 점검)`);
  process.exit(0);
}
