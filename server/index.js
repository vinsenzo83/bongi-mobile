// 🔴 Sentry 가장 먼저 초기화 (다른 import 전 — instrumentation 적용 위해)
import * as Sentry from '@sentry/node';
import dotenv from 'dotenv';
import { fileURLToPath as _fu } from 'url';
import { dirname as _dn, join as _jn } from 'path';
const __sentry_dir = _dn(_fu(import.meta.url));
dotenv.config({ path: _jn(__sentry_dir, '..', '.env') });
if (process.env.SENTRY_DSN) {
  // PII·금융정보 자동 sanitize 정규식 (이벤트 전체 재귀 탐색)
  const PII_PATTERNS = [
    { re: /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g, replace: '[card-redacted]' },     // 카드번호
    { re: /\b\d{6}[\s\-]?\d{7}\b/g, replace: '[rrn-redacted]' },                              // 주민번호
    { re: /\b\d{2,4}-?\d{2,4}-?\d{4,7}\b/g, replace: '[account-redacted]' },                  // 계좌번호 (느슨)
    { re: /\b01[016789][\s\-]?\d{3,4}[\s\-]?\d{4}\b/g, replace: '[phone-redacted]' },         // 휴대폰
    { re: /([?&](password|card_number|account_number|resident_id|cvv|expiry)=)[^&\s]+/gi, replace: '$1[redacted]' }, // URL 파라미터
  ];
  function sanitizeStr(s) {
    if (typeof s !== 'string') return s;
    let out = s;
    for (const { re, replace } of PII_PATTERNS) out = out.replace(re, replace);
    return out;
  }
  function sanitizeDeep(obj, depth = 0) {
    if (depth > 6 || obj == null) return obj;
    if (typeof obj === 'string') return sanitizeStr(obj);
    if (Array.isArray(obj)) return obj.map(v => sanitizeDeep(v, depth + 1));
    if (typeof obj === 'object') {
      const out = {};
      for (const k of Object.keys(obj)) {
        // 민감 필드명은 키 기준으로도 redact
        if (/password|cvv|card.*number|account.*number|resident.*id|expiry|secret|token/i.test(k)) {
          out[k] = '[redacted]';
        } else {
          out[k] = sanitizeDeep(obj[k], depth + 1);
        }
      }
      return out;
    }
    return obj;
  }
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || process.env.npm_package_version || 'unknown',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0.5,
    sendDefaultPii: false,
    beforeSend(event, _hint) {
      // 라우트 path만 보존 + body·headers·query 제거
      if (event.request) {
        delete event.request.cookies;
        delete event.request.data;
        delete event.request.query_string;
        // URL 에 붙은 쿼리도 통째로 제거 (external_id·토큰 등이 로그에 남지 않게)
        if (typeof event.request.url === 'string') {
          event.request.url = event.request.url.split('?')[0];
        }
        if (event.request.headers) {
          for (const k of Object.keys(event.request.headers)) {
            if (/auth|cookie|token|key/i.test(k)) event.request.headers[k] = '[redacted]';
          }
        }
      }
      // 메시지·예외·breadcrumb 모두 PII 정규식 sanitize
      if (event.message) event.message = sanitizeStr(event.message);
      if (event.exception && event.exception.values) {
        event.exception.values = event.exception.values.map(ex => ({
          ...ex,
          value: sanitizeStr(ex.value),
        }));
      }
      if (event.breadcrumbs) event.breadcrumbs = sanitizeDeep(event.breadcrumbs);
      if (event.extra) event.extra = sanitizeDeep(event.extra);
      return event;
    },
  });
  console.log('🔴 Sentry 활성 (env:', process.env.NODE_ENV || 'dev', ', PII sanitize ON)');
}

import express from 'express';
import compression from 'compression';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
// ── TM CRM 코어 라우트 ──
import authRoutes from './routes/auth.js';
import adminPlatformRoutes from './routes/admin-platform.js';
import incentiveRoutes from './routes/incentive.js';
import deviceInventoryRoutes from './routes/device-inventory.js';
import rentalRoutes from './routes/rental.js';
import policyDocsRoutes from './routes/policy-docs.js';
import customerDbRoutes from './routes/customer-db.js';
import dashboardRoutes from './routes/dashboard.js';
import ctiRoutes from './routes/cti.js';
import cacheRoutes from './routes/cache.js';
import crmRoutes from './routes/crm.js';
// ── 별도 운영 (특판 LP) ──
import specialPromoRoutes from './routes/special-promo.js';
import deskRoutes from './routes/desk.js';
// ── 옛 고객 SPA — 등록 안 됨, 파일만 보존 (추후 필요 시 재활성) ──
// import productRoutes from './routes/products.js';
// import applicationRoutes from './routes/applications.js';
// import storeRoutes from './routes/stores.js';
// import reviewRoutes from './routes/reviews.js';
// import aiRoutes from './routes/ai.js';
// import mockRoutes from './routes/mock.js';
// import chatRoutes from './routes/chat.js';
// import alarmRoutes from './routes/alarms.js';
// import referralRoutes from './routes/referrals.js';
// import cashRoutes from './routes/cash.js';

import { ipAllowlist } from './middleware/ipAllowlist.js';
import { sanitizeBody } from './middleware/sanitize.js';
import { basicAuth } from './middleware/basicAuth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiLimiter, applicationLimiter } from './middleware/rateLimit.js';
import { authenticateJWT, optionalAuth as _optionalAuth } from './middleware/auth.js';
import { requireMinRole } from './middleware/rbac.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001;

// 🔒 필수 환경변수 검증 — 누락 시 서버 시작 차단 (운영 사고 방지)
const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
const _missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (_missing.length > 0) {
  console.error('\n❌ 필수 환경변수 누락:', _missing.join(', '));
  console.error('   .env 또는 .env.staging 확인. 서버 시작 차단.\n');
  process.exit(1);
}

// 보안 헤더 (CSP / X-Frame / 등) — HTML 응답에 한정
app.use((req, res, next) => {
  // HTML/문서 페이지에만 적용 (API JSON·정적 자산 영향 X)
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  // CSP — 봉이 어드민·고객 사이트 공통
  // Kakao Postcode: daumcdn.net (CDN) + daum.net + kakao.com (postcode.map.kakao.com — 신 도메인) 모두 허용
  // 단 postcode.map.kakao.com은 http 응답 → http: 스킴도 frame-src에 명시
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://t1.daumcdn.net https://*.daum.net https://*.kakao.com https://static.cloudflareinsights.com",
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://*.googleapis.com https://*.daum.net https://*.kakao.com",
    "img-src 'self' data: https: http://*.kakao.com",
    "font-src 'self' https://cdn.jsdelivr.net data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.daumcdn.net https://t1.daumcdn.net https://*.daum.net https://*.kakao.com https://cdn.jsdelivr.net https://cloudflareinsights.com https://*.cloudflareinsights.com",
    "frame-src 'self' https://*.daumcdn.net https://t1.daumcdn.net https://*.daum.net https://*.kakao.com http://*.kakao.com",
    "child-src 'self' https://*.daumcdn.net https://t1.daumcdn.net https://*.daum.net https://*.kakao.com http://*.kakao.com",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  res.setHeader('Content-Security-Policy', csp);
  next();
});

// 글로벌 미들웨어
app.use(compression({ threshold: 1024 })); // 1KB 이상 응답 자동 gzip (HTML/JSON ~70% 감소)
// Express ETag 강력 활성화 — JSON 응답에 ETag → If-None-Match 시 304 (body 0byte)
app.set('etag', 'strong');
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGIN || 'https://bongi-mobile.com'
    : ['http://localhost:5173', 'http://localhost:3001'],
}));
app.use(express.json({ limit: '5mb' }));
app.use(sanitizeBody);
app.use(apiLimiter);

// 정적 서빙
// 운영 중인 것만 — TM CRM(docs/)·옛 admin/crm/dashboard 보존·매장 사진(stores)
app.use('/admin', express.static(join(__dirname, 'public', 'admin')));
app.use('/crm', express.static(join(__dirname, 'public', 'crm')));
app.use('/dashboard', express.static(join(__dirname, 'public', 'dashboard')));
app.use('/stores', express.static(join(__dirname, 'public', 'stores')));
app.use('/reports', express.static(join(__dirname, 'public', 'reports')));
app.use('/docs', express.static(join(__dirname, '..', 'docs'), {
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      // HTML: stale-while-revalidate — 30s 즉시, 백그라운드 갱신
      res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=86400');
    } else if (/\.(woff2?|ttf|otf)$/i.test(path)) {
      // 폰트: 1년 immutable
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (/\.(png|jpe?g|webp|svg|ico|gif)$/i.test(path)) {
      // 이미지: 30일
      res.setHeader('Cache-Control', 'public, max-age=2592000');
    } else if (/\.(docx|pdf|xlsx)$/i.test(path)) {
      // 문서: 1주일
      res.setHeader('Cache-Control', 'public, max-age=604800');
    } else if (/\.(js|css)$/i.test(path)) {
      // JS/CSS: 1분 즉시 + 24h stale-while-revalidate
      // (24h 캐시는 핵심 모듈 갱신을 막아 권한 페이지 빈 화면 사고를 일으켰음 — 2026-05-15)
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=86400');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  }
}));
app.use('/api/dashboard', dashboardRoutes);

// 문서 직접 서빙 (SPA 우회)
app.get('/view/:file', (req, res) => {
  const file = req.params.file;
  if (!file.endsWith('.html')) return res.status(400).send('html only');
  const paths = [
    join(__dirname, 'public', 'docs', file),
    join(__dirname, 'public', 'reports', file),
    join(__dirname, 'public', 'admin', file),
    join(__dirname, '..', 'docs', file),
  ];
  for (const p of paths) {
    if (existsSync(p)) return res.sendFile(p);
  }
  res.status(404).send('not found');
});

// /reports — 2026-05-11 미사용 확인 후 제거

// ════════════════════════════════════════════════════════════════
// 봉이 TM CRM — 인증·인센티브·콜DB·계약 처리 전용
// (옛 고객 SPA 라우트는 모두 비활성. 특판 LP는 별도 운영으로 보존)
// ════════════════════════════════════════════════════════════════

// ── 인증 ──
app.use('/api/auth', authRoutes);

// ── 어드민 API (인증 없이 접근 — 어드민 HTML 정적 파일용) ──
app.use('/api/admin/platform', adminPlatformRoutes);

// ── V5 인센티브 (라우터 내부에서 authenticateJWT/optionalAuth 자체 처리) ──
app.use('/api/incentive', incentiveRoutes);
app.use('/api/devices', deviceInventoryRoutes);
app.use('/api/rental', rentalRoutes);
app.use('/api/policy-docs', policyDocsRoutes);
app.use('/api/customer-db', ipAllowlist, authenticateJWT, customerDbRoutes);

// ── 특판 LP (별도 운영 — 파이어니×에이스휴먼파워, project_bongi_special_promo) ──
app.use('/api/special-promo', (req, res, next) => {
  if (req.method === 'POST') {
    return applicationLimiter(req, res, () => next());
  }
  return basicAuth(req, res, next);
}, specialPromoRoutes);

// ── 상담 데스크 (고객측 무인증 + 상담사측 JWT — 라우터 내부에서 분리 처리) ──
app.use('/api/desk', deskRoutes);

// ── 옛 고객 SPA 라우트 비활성 (2026-05-07 TM CRM 분리) ──
// /api/products, /api/stores, /api/applications, /api/mock, /api/reviews,
// /api/referrals, /api/cash, /api/chat, /api/ai, /api/alarms 모두 등록 제거
// (파일은 보존 — 추후 필요 시 재활성)

// ── 인증 필요 (agent 이상) ──
app.use('/api/crm', authenticateJWT, requireMinRole('agent'), crmRoutes);
app.use('/api/cti', authenticateJWT, requireMinRole('agent'), ctiRoutes);
app.use('/api/cache', authenticateJWT, requireMinRole('agent'), cacheRoutes);

import { supabase as _hcSb } from './db/supabase.js';
app.get('/api/health', async (req, res) => {
  const t0 = Date.now();
  const checks = { server: 'ok', uptime_s: Math.round(process.uptime()), node_env: process.env.NODE_ENV || 'development' };
  try {
    if (_hcSb) {
      const { count, error } = await _hcSb.from('incentive_agents').select('id', { count:'exact', head:true });
      checks.supabase = error ? `error: ${error.message}` : 'ok';
      checks.agents_count = count ?? null;
    } else {
      checks.supabase = 'not configured';
    }
  } catch (e) { checks.supabase = 'error: ' + e.message; }
  checks.env_supabase_url = !!process.env.SUPABASE_URL;
  checks.env_service_key = !!(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY);
  checks.cors = process.env.CORS_ORIGIN || 'default';
  checks.duration_ms = Date.now() - t0;
  const ok = checks.supabase === 'ok' && checks.env_supabase_url && checks.env_service_key;
  res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'degraded', service: '봉이 TM CRM API', ...checks });
});

// 운영 환경 가드 — production일 때만 추가 보안 확인
{
  const env = process.env.NODE_ENV;
  if (env === 'production') console.log('🔐 운영(라이브) 모드 — error sanitize / SW 활성 / 보안 헤더 적용');
  else if (env === 'staging') console.log('🧪 데브(스테이징) 모드 — 라이브와 동일 보안 + 별도 Supabase');
  else console.log('🛠 개발(로컬) 모드 — error 메시지 그대로 노출 / SW 비활성');
}

// 데브/라이브 모두 sanitize·CSP·보안 헤더 적용 (개발만 완화)
if (process.env.NODE_ENV === 'staging' || process.env.NODE_ENV === 'production') {
  process.env.NODE_ENV_TIGHT = 'true'; // 후속 코드에서 개발 모드 추가 완화 막기
}

// 렌탈 상품 상세 API
import { readFileSync } from 'fs';
const rentalTicketsPath = join(__dirname, 'data', 'providers', 'rental_tickets.json');
let rentalTicketsData = [];
try { rentalTicketsData = JSON.parse(readFileSync(rentalTicketsPath, 'utf8')); } catch {}

app.get('/api/rental/:ticket', (req, res) => {
  const item = rentalTicketsData.find(t => t.ticket === req.params.ticket.toUpperCase());
  if (!item) return res.status(404).json({ error: '상품을 찾을 수 없습니다' });
  res.json(item);
});

app.get('/api/rental', (req, res) => {
  const { category, brand } = req.query;
  let items = rentalTicketsData;
  if (category) items = items.filter(t => t.category === category);
  if (brand) items = items.filter(t => t.brand.toLowerCase().includes(brand.toLowerCase()));
  res.json({ count: items.length, items });
});

// 봉이 어드민 정적 파일 서빙 (server/public/docs/ 옛 사본 제거 — docs/만 사용)
// /reports는 line 216에 이미 마운트됨
// root → 어드민 직접 서빙
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, '..', 'docs', 'incentive-admin.html'));
});

// 전역 에러 핸들러
// Sentry Express 에러 핸들러 (errorHandler보다 먼저 — 미처리 에러 캡처)
if (process.env.SENTRY_DSN) Sentry.setupExpressErrorHandler(app);
app.use(errorHandler);

// 공시지원금 크롤링 스케줄 (매일 09:00 KST)
import cron from 'node-cron';
import { crawlSubsidy } from './services/subsidy-crawler.js';

cron.schedule('0 9 * * *', () => {
  console.log('⏰ 공시지원금 크롤링 시작 (09:00 KST)');
  crawlSubsidy().catch(e => console.error('크롤링 에러:', e.message));
}, { timezone: 'Asia/Seoul' });

// customer-db retention (매일 03:00 KST) — converted/rejected 자동 archive, archived 자동 soft-delete, soft-delete 자동 purge
import { runRetentionJob } from './jobs/customer-db-retention.js';
cron.schedule('0 3 * * *', () => {
  console.log('⏰ customer-db retention 시작 (03:00 KST)');
  runRetentionJob().catch(e => console.error('retention 에러:', e.message));
}, { timezone: 'Asia/Seoul' });

// customer-db 자동 재배정 (매일 04:00 KST) — 미컨택 7일/저활성 14일 → 풀 복귀
import { runRedistributionJob } from './jobs/customer-db-redistribution.js';
cron.schedule('0 4 * * *', () => {
  console.log('⏰ customer-db 자동 재배정 시작 (04:00 KST)');
  runRedistributionJob().catch(e => console.error('redistribution 에러:', e.message));
}, { timezone: 'Asia/Seoul' });

// 카드정보 자동 마스킹 (매일 03:30 KST) — contract_completed_at + 7일 경과 시 payment_extra.card 마스킹
import { runCardMaskingJob } from './jobs/card-masking.js';
cron.schedule('30 3 * * *', () => {
  console.log('⏰ 카드정보 마스킹 시작 (03:30 KST)');
  runCardMaskingJob().catch(e => console.error('card-masking 에러:', e.message));
}, { timezone: 'Asia/Seoul' });

// 정산은 RPC `incentive_calc_monthly_settlement(agent_id, ym)` 즉시 계산 — cron 불필요

app.listen(PORT, () => {
  console.log(`📞 봉이 TM CRM 서버: http://localhost:${PORT}`);
});
