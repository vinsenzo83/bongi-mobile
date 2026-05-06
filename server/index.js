import express from 'express';
import compression from 'compression';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import productRoutes from './routes/products.js';
import applicationRoutes from './routes/applications.js';
import storeRoutes from './routes/stores.js';
import crmRoutes from './routes/crm.js';
import reviewRoutes from './routes/reviews.js';
import ctiRoutes from './routes/cti.js';
import aiRoutes from './routes/ai.js';
import mockRoutes from './routes/mock.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import chatRoutes from './routes/chat.js';
import alarmRoutes from './routes/alarms.js';
import referralRoutes from './routes/referrals.js';
import cashRoutes from './routes/cash.js';
import cacheRoutes from './routes/cache.js';
import adminPlatformRoutes from './routes/admin-platform.js';
import specialPromoRoutes from './routes/special-promo.js';
import incentiveRoutes from './routes/incentive.js';
import { sanitizeBody } from './middleware/sanitize.js';
import { basicAuth } from './middleware/basicAuth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiLimiter, applicationLimiter } from './middleware/rateLimit.js';
import { authenticateJWT, optionalAuth } from './middleware/auth.js';
import { requireMinRole } from './middleware/rbac.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001;

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

// 정적 서빙 (어드민 + CRM + 대시보드 + 매장이미지 + 플로우 문서)
app.use('/admin', express.static(join(__dirname, 'public', 'admin')));
app.use('/crm', express.static(join(__dirname, 'public', 'crm')));
app.use('/dashboard', express.static(join(__dirname, 'public', 'dashboard')));
app.use('/stores', express.static(join(__dirname, 'public', 'stores')));
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
      // JS/CSS: 1일 + revalidate
      res.setHeader('Cache-Control', 'public, max-age=86400, must-revalidate');
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

// 보고서 직접 서빙
import { resolve } from 'path';
app.use('/reports', express.static(join(__dirname, 'public', 'reports')));

// ── 공개 API (인증 불필요) ──
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/applications', applicationLimiter, applicationRoutes);
// special-promo: POST(신청)는 공개+rate-limit, 그 외(GET/PATCH/DELETE)는 인증
app.use('/api/special-promo', (req, res, next) => {
  if (req.method === 'POST') {
    return applicationLimiter(req, res, () => next());
  }
  return basicAuth(req, res, next);
}, specialPromoRoutes);
app.use('/api/mock', mockRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/cash', optionalAuth, cashRoutes);

// ── 채팅 (공개, 선택적 인증 — 돈지키미 set_alarm용) ──
app.use('/api/chat', optionalAuth, chatRoutes);

// ── 선택적 인증 ──
app.use('/api/ai', optionalAuth, aiRoutes);

// ── 인증 필요 (일반 유저) ──
app.use('/api/alarms', optionalAuth, alarmRoutes);

// ── 어드민 API (인증 없이 접근 — 어드민 HTML 정적 파일용) ──
app.use('/api/admin/platform', adminPlatformRoutes);

// ── V5 인센티브 (라우터 내부에서 authenticateJWT/optionalAuth 자체 처리) ──
app.use('/api/incentive', incentiveRoutes);

// ── 인증 필요 (agent 이상) ──
app.use('/api/crm', authenticateJWT, requireMinRole('agent'), crmRoutes);
app.use('/api/cti', authenticateJWT, requireMinRole('agent'), ctiRoutes);
app.use('/api/cache', authenticateJWT, requireMinRole('agent'), cacheRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: '리턴AI API' });
});

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

// 프로덕션: 클라이언트 정적 파일 서빙
const clientDist = join(__dirname, '..', 'client', 'dist');
if (existsSync(clientDist)) {
  // /docs, /reports 등은 서버 정적 파일 우선 (SPA보다 먼저)
  app.use('/docs', express.static(join(__dirname, 'public', 'docs')));
  app.use('/reports', express.static(join(__dirname, 'public', 'reports')));
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    // /admin/v5 는 React SPA로 처리 (V5 인센티브 어드민)
    if (req.path.startsWith('/admin/v5')) {
      return res.sendFile(join(clientDist, 'index.html'));
    }
    // API, 어드민(레거시), 정적 경로, .html 파일은 SPA가 처리하지 않음
    if (req.path.startsWith('/api') || req.path.startsWith('/admin') || req.path.startsWith('/crm') || req.path.startsWith('/dashboard') || req.path.startsWith('/docs') || req.path.startsWith('/stores') || req.path.startsWith('/reports') || req.path.endsWith('.html')) {
      return next();
    }
    res.sendFile(join(clientDist, 'index.html'));
  });
}

// 전역 에러 핸들러
app.use(errorHandler);

// 공시지원금 크롤링 스케줄 (매일 09:00 KST)
import cron from 'node-cron';
import { crawlSubsidy } from './services/subsidy-crawler.js';

cron.schedule('0 9 * * *', () => {
  console.log('⏰ 공시지원금 크롤링 시작 (09:00 KST)');
  crawlSubsidy().catch(e => console.error('크롤링 에러:', e.message));
}, { timezone: 'Asia/Seoul' });

app.listen(PORT, () => {
  console.log(`리턴AI 서버 실행: http://localhost:${PORT}`);
});
