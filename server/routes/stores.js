import { Router } from 'express';
import { stores } from '../data/stores.js';

const router = Router();

router.get('/', (req, res) => {
  res.json(stores);
});

router.get('/:id', (req, res) => {
  const store = stores.find(s => s.id === Number(req.params.id));
  if (!store) return res.status(404).json({ error: '매장을 찾을 수 없습니다' });
  res.json(store);
});

export default router;
