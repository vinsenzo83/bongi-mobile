import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
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
import { sanitizeBody } from './middleware/sanitize.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiLimiter, applicationLimiter } from './middleware/rateLimit.js';
import { authenticateJWT, optionalAuth } from './middleware/auth.js';
import { requireMinRole } from './middleware/rbac.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// 글로벌 미들웨어
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGIN || 'https://bongi-mobile.com'
    : ['http://localhost:5173', 'http://localhost:3001'],
}));
app.use(express.json({ limit: '5mb' }));
app.use(sanitizeBody);
app.use(apiLimiter);

// 정적 서빙
app.use('/admin', express.static(join(__dirname, 'public', 'admin')));
app.use('/dashboard', express.static(join(__dirname, 'public', 'dashboard')));
app.use('/api/dashboard', dashboardRoutes);

// ── 공개 API (인증 불필요) ──
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/applications', applicationLimiter, applicationRoutes);
app.use('/api/mock', mockRoutes);
app.use('/api/reviews', reviewRoutes);

// ── 채팅 (공개, 선택적 인증 — 돈지키미 set_alarm용) ──
app.use('/api/chat', optionalAuth, chatRoutes);

// ── 선택적 인증 ──
app.use('/api/ai', optionalAuth, aiRoutes);

// ── 인증 필요 (일반 유저) ──
app.use('/api/alarms', optionalAuth, alarmRoutes);

// ── 인증 필요 (agent 이상) ──
app.use('/api/crm', authenticateJWT, requireMinRole('agent'), crmRoutes);
app.use('/api/cti', authenticateJWT, requireMinRole('agent'), ctiRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: '리턴AI API' });
});

// 프로덕션: 클라이언트 정적 파일 서빙
const clientDist = join(__dirname, '..', 'client', 'dist');
import { existsSync } from 'fs';
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/admin') || req.path.startsWith('/dashboard')) {
      return next();
    }
    res.sendFile(join(clientDist, 'index.html'));
  });
}

// 전역 에러 핸들러
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`리턴AI 서버 실행: http://localhost:${PORT}`);
});
