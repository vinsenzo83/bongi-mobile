import { Router } from 'express';
import { products, categories } from '../data/products.js';
import { supabase } from '../db/supabase.js';

const router = Router();

// 중고폰 매입 기종/용량 목록 (Supabase 기반)
router.get('/used-phone-catalog', async (req, res) => {
  try {
    const { data, error } = await supabase.from('bongi_used_phone_prices')
      .select('manufacturer,series,storage').order('manufacturer').order('series').order('storage');
    if (error) throw error;
    const phones = data || [];
    const makers = [...new Set(phones.map(p => p.manufacturer))];
    const seriesMap = {};
    const storageMap = {};
    for (const p of phones) {
      if (!seriesMap[p.manufacturer]) seriesMap[p.manufacturer] = new Set();
      seriesMap[p.manufacturer].add(p.series);
      if (!storageMap[p.series]) storageMap[p.series] = new Set();
      storageMap[p.series].add(p.storage);
    }
    for (const m of Object.keys(seriesMap)) seriesMap[m] = [...seriesMap[m]].sort();
    for (const s of Object.keys(storageMap)) storageMap[s] = [...storageMap[s]].sort();
    res.json({ makers, series: seriesMap, storages: storageMap, total: phones.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

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
