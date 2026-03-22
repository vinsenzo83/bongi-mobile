import { Router } from 'express';
import { products, categories } from '../data/products.js';

const router = Router();

// 카테고리 목록
router.get('/categories', (req, res) => {
  res.json(categories);
});

// 카테고리별 상품 목록
router.get('/:category', (req, res) => {
  const { category } = req.params;
  const items = products[category];
  if (!items) return res.status(404).json({ error: '카테고리를 찾을 수 없습니다' });
  res.json(items);
});

// 티켓 코드로 상품 조회
router.get('/ticket/:ticket', (req, res) => {
  const { ticket } = req.params;
  for (const cat of Object.values(products)) {
    const item = cat.find(p => p.ticket === ticket.toUpperCase());
    if (item) return res.json(item);
  }
  res.status(404).json({ error: '상품을 찾을 수 없습니다' });
});

export default router;
