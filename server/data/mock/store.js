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

export const customers = loadJson('customers.json');
export const tickets = loadJson('tickets.json');

console.log(`✅ Mock Store 로드: 고객 ${customers.length}명, 티켓 ${tickets.length}개`);
