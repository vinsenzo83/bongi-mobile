// 봉이 TM CRM Service Worker
// 전략:
//   - HTML/CSS/JS: stale-while-revalidate (즉시 캐시 표시 → 백그라운드 갱신)
//   - 폰트/이미지/.docx: cache-first
//   - API (/api/*): network only (캐시 X — 실시간 데이터 보존)
// 버전 변경 시 강제 갱신: SW_VERSION 숫자 올리고 배포

const SW_VERSION = 'v153';
const STATIC_CACHE = 'bongi-static-' + SW_VERSION;
const RUNTIME_CACHE = 'bongi-runtime-' + SW_VERSION;

// install — 스킵: 활성화 즉시 새 SW 적용
self.addEventListener('install', (_e) => { self.skipWaiting(); });

// activate — 옛 캐시 정리
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => !k.endsWith(SW_VERSION)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // POST/PATCH/PUT/DELETE는 네트워크
  // 🆕 chrome-extension·moz-extension·data·blob 등 unsupported scheme 캐싱 차단
  if (!req.url.startsWith('http://') && !req.url.startsWith('https://')) return;
  const url = new URL(req.url);

  // API 호출은 절대 캐시하지 않음 (실시간 데이터 보존)
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return;

  // 다른 origin — cache-first (단 daumcdn·jsdelivr는 SW 우회 — 빈 응답 캐시되면 라이브러리 깨짐)
  if (url.origin !== self.location.origin) {
    // daumcdn.net (CDN) + daum.net + kakao.com (postcode.map.kakao.com) + jsdelivr.net 모두 SW 우회
    if (url.hostname.includes('daumcdn.net') || url.hostname.includes('daum.net') || url.hostname.includes('kakao.com') || url.hostname.includes('jsdelivr.net')) return; // SW 미관여 → 브라우저 직접 fetch
    event.respondWith(cacheFirst(req));
    return;
  }

  // 정적 자산 (.docx, .pdf, image, font, .xlsx) — cache-first (변경 적음)
  if (/\.(docx|pdf|png|jpe?g|webp|svg|ico|woff2?|ttf|xlsx)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // HTML/CSS/JS — stale-while-revalidate (즉시 표시 + 백그라운드 갱신)
  event.respondWith(staleWhileRevalidate(req));
});

async function cacheFirst(req) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (_e) {
    return cached || new Response('', { status: 504 });
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(req);
  // 백그라운드 갱신
  const networkPromise = fetch(req).then(res => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  // 캐시 즉시 반환, 없으면 네트워크 대기
  return cached || networkPromise || new Response('', { status: 504 });
}

// 클라이언트 → SW 메시지: 강제 캐시 무효화
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
});
