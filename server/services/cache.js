// 응답 캐싱 서비스 — 메모리 LRU 캐시
// 반복되는 단독 질문에 대해 Claude API 호출 없이 캐시된 응답 즉시 반환

const MAX_CACHE = 500;
const CACHE_TTL = 5 * 60 * 1000; // 5분 (세션 간 캐시 오염 방지)

// LRU 메모리 캐시 (서버 재시작 시 초기화)
const memoryCache = new Map();

// 캐시 통계
const stats = {
  hits: 0,
  misses: 0,
};

// 질문 정규화 → 캐시 키
function normalizeQuery(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[?!.,~…·•\-]/g, '')
    .replace(/\s+/g, ' ');
}

// 캐싱 적합 여부 판별
// 첫 번째 유저 메시지(단독 질문)만 캐싱 — 대화 맥락이 있으면 캐싱 부적합
export function isCacheable(sessionMessages) {
  const userMessages = sessionMessages.filter(
    (m) => m.role === 'user' && typeof m.content === 'string'
  );
  return userMessages.length === 1;
}

// 캐시 조회
export function getCachedResponse(query) {
  const key = normalizeQuery(query);
  const cached = memoryCache.get(key);

  if (!cached) {
    stats.misses++;
    return null;
  }

  if (Date.now() - cached.timestamp >= CACHE_TTL) {
    memoryCache.delete(key);
    stats.misses++;
    return null;
  }

  // LRU: 조회된 항목을 맨 뒤로 이동 (최근 사용)
  memoryCache.delete(key);
  memoryCache.set(key, cached);

  stats.hits++;
  return cached.response;
}

// 캐시 저장
export function setCachedResponse(query, response) {
  const key = normalizeQuery(query);

  // 이미 존재하면 삭제 후 재삽입 (LRU 갱신)
  if (memoryCache.has(key)) {
    memoryCache.delete(key);
  }

  // 용량 초과 시 가장 오래된(첫 번째) 항목 삭제
  if (memoryCache.size >= MAX_CACHE) {
    const oldestKey = memoryCache.keys().next().value;
    memoryCache.delete(oldestKey);
  }

  memoryCache.set(key, {
    response,
    timestamp: Date.now(),
  });
}

// 캐시 통계 조회
export function getCacheStats() {
  const total = stats.hits + stats.misses;
  return {
    size: memoryCache.size,
    maxSize: MAX_CACHE,
    hits: stats.hits,
    misses: stats.misses,
    hitRate: total > 0 ? Math.round((stats.hits / total) * 10000) / 100 : 0,
    ttlHours: CACHE_TTL / (60 * 60 * 1000),
  };
}

// 캐시 초기화 (테스트/관리용)
export function clearCache() {
  memoryCache.clear();
  stats.hits = 0;
  stats.misses = 0;
}
