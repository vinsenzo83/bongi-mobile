// cs-crawler 공통 파싱 유틸

export const clean = s => (s || '').replace(/\s+/g, ' ').trim();

// "109,000원" → 109000
export function won(s) {
  const m = (s || '').match(/([\d,]{4,})\s*원/);
  return m ? parseInt(m[1].replace(/,/g, ''), 10) : null;
}
// 모든 원 금액 추출 (요금제 구간)
export function allWon(s, { min = 9000, max = 300000 } = {}) {
  return [...(s || '').matchAll(/([\d,]{2,3},[\d]{3})\s*원/g)]
    .map(m => parseInt(m[1].replace(/,/g, ''), 10)).filter(n => n >= min && n <= max);
}

// 네트워크 감지
export function network(text) {
  if (/LTE/.test(text) && /5G/.test(text)) return '5G/LTE';
  if (/LTE/.test(text) && !/5G/.test(text)) return 'LTE';
  return '5G';
}

// OTT 키워드
const OTT_KW = ['넷플릭스', '티빙', '유튜브', '디즈니', '웨이브', '왓챠', '지니뮤직', '밀리의서재'];
export function ott(text) { return OTT_KW.filter(k => text.includes(k)); }

// 연령 대상
export function ageTarget(text) {
  if (/만\s*34세|0\s*청년|청년/.test(text)) return '청년';
  if (/시니어|만\s*65세/.test(text)) return '시니어';
  if (/키즈|주니어|유스|만\s*18세|만\s*12세/.test(text)) return '청년';
  if (/복지|장애|국가유공/.test(text)) return '복지';
  return '전체';
}

// 신규가입 종료/중단 감지 → {ended, endDate}
export function detectSalesStatus(text) {
  // "2022년 10월 8일부로 신규가입이 종료" / "2026.7.31까지 가입 가능" 등
  const ended = /신규\s*가입[^.]{0,8}(종료|중단)|가입\s*(이\s*)?(종료|중단)/.test(text);
  const closing = /까지\s*가입\s*가능|이후\s*가입(이)?\s*불가/.test(text);
  // 날짜 추출 (YYYY.MM.DD / YYYY년 MM월 DD일)
  const dm = text.match(/(\d{4})[.\s년]+(\d{1,2})[.\s월]+(\d{1,2})/);
  const endDate = dm ? `${dm[1]}-${String(dm[2]).padStart(2, '0')}-${String(dm[3]).padStart(2, '0')}` : null;
  if (ended) return { status: 'ended', endDate };
  if (closing) return { status: 'closing', endDate };
  return { status: 'active', endDate: null };
}

// 5년 기준 — 종료일이 5년 초과 과거면 '제거 대상', 이내면 보존
export function isStale(endDate, refDate) {
  if (!endDate) return false;
  const cutoff = new Date(refDate); cutoff.setFullYear(cutoff.getFullYear() - 5);
  return new Date(endDate) < cutoff;
}

// 제목/이름 prefix 정리 (LGU "유플러스 " 등)
export function stripCarrierPrefix(name, prefixes = ['유플러스 ', 'KT ', 'SK텔레콤 ']) {
  let n = (name || '').trim();
  for (const p of prefixes) if (n.startsWith(p)) n = n.slice(p.length).trim();
  return n;
}

// SQL escape
export const sq = s => s == null ? 'NULL' : "'" + String(s).replace(/'/g, "''") + "'";
export const jb = a => "'" + JSON.stringify(a || []).replace(/'/g, "''") + "'::jsonb";
