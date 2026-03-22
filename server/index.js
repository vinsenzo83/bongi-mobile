import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import productRoutes from './routes/products.js';
import applicationRoutes from './routes/applications.js';
import storeRoutes from './routes/stores.js';
import crmRoutes from './routes/crm.js';
import ctiRoutes from './routes/cti.js';
import aiRoutes from './routes/ai.js';
import mockRoutes from './routes/mock.js';
import authRoutes from './routes/auth.js';
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
app.use(express.json({ limit: '1mb' }));
app.use(sanitizeBody);
app.use(apiLimiter);

// 정적 서빙
app.use('/admin', express.static(join(__dirname, 'public', 'admin')));

// ── 공개 API (인증 불필요) ──
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/applications', applicationLimiter, applicationRoutes);
app.use('/api/mock', mockRoutes);

// ── 선택적 인증 ──
app.use('/api/ai', optionalAuth, aiRoutes);

// ── 인증 필요 (agent 이상) ──
app.use('/api/crm', authenticateJWT, requireMinRole('agent'), crmRoutes);
app.use('/api/cti', authenticateJWT, requireMinRole('agent'), ctiRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: '봉이모바일 API' });
});

// 전역 에러 핸들러
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`봉이모바일 서버 실행: http://localhost:${PORT}`);
});
