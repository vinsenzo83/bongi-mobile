import { Router } from 'express';
import { products, categories } from '../data/products.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = Router();

// 중고폰 매입 기종/용량 목록 (used_phone_prices.json 기반)
let usedPhoneCatalog = null;
function getUsedPhoneCatalog() {
  if (usedPhoneCatalog) return usedPhoneCatalog;
  const raw = JSON.parse(readFileSync(join(__dirname, '..', 'data', 'providers', 'used_phone_prices.json'), 'utf8'));
  const phones = raw.filter(x => ['Apple', '삼성전자', 'LG'].includes(x['제조사']));

  const makers = [...new Set(phones.map(p => p['제조사']))];
  const seriesMap = {};
  const storageMap = {};

  for (const p of phones) {
    const maker = p['제조사'];
    const series = p['시리즈'];
    const storage = p['용량'];
    if (!seriesMap[maker]) seriesMap[maker] = new Set();
    seriesMap[maker].add(series);
    if (!storageMap[series]) storageMap[series] = new Set();
    storageMap[series].add(storage);
  }

  // Set → 정렬된 배열
  for (const m of Object.keys(seriesMap)) seriesMap[m] = [...seriesMap[m]].sort();
  for (const s of Object.keys(storageMap)) storageMap[s] = [...storageMap[s]].sort();

  usedPhoneCatalog = { makers, series: seriesMap, storages: storageMap, total: phones.length };
  return usedPhoneCatalog;
}

router.get('/used-phone-catalog', (req, res) => {
  res.json(getUsedPhoneCatalog());
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
