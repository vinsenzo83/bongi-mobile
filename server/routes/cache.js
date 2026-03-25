import { Router } from 'express';
import { getCacheStats, clearCache } from '../services/cache.js';

const router = Router();

// GET /api/cache/stats — 캐시 통계 조회
router.get('/stats', (req, res) => {
  try {
    const stats = getCacheStats();
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/cache/clear — 캐시 초기화 (관리용)
router.post('/clear', (req, res) => {
  try {
    clearCache();
    res.json({ message: '캐시가 초기화되었습니다' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
