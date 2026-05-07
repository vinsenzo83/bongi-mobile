// Mock 데이터 공유 저장소 (싱글톤)
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadJson(filename) {
  const path = join(__dirname, filename);
  if (!existsSync(path)) {
    console.warn(`⚠ Mock 데이터 파일 없음: ${filename}`);
    return [];
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    console.error(`❌ Mock 데이터 파싱 실패: ${filename}`, e.message);
    return [];
  }
}

// ⚠️ 옛 React 고객 SPA 시절의 mock 데이터 — 봉이 어드민·인센티브 운영과 무관
// 의존: applications.js / chat-tools.js / mock.js (현재 어드민 미사용)
// 제거 시: 위 3개 라우트도 함께 정리 필요
export const customers = loadJson('customers.json');
export const tickets = loadJson('tickets.json');
