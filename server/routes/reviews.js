import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = Router();

// Supabase 미연결 시 가드
router.use((req, res, next) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase 미연결. .env에 SUPABASE_URL과 SUPABASE_ANON_KEY를 설정해주세요.' });
  next();
});

// GET /api/reviews — 전체 후기 목록 (공개)
router.get('/', async (req, res) => {
  const { category, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  let query = supabase.from('bongi_reviews').select('*', { count: 'exact' });
  if (category) query = query.eq('category', category);

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ data, total: count, page: Number(page), limit: Number(limit) });
});

// POST /api/reviews — 후기 작성 (인증 필수)
router.post('/', authenticateJWT, async (req, res) => {
  const { category, product_name, rating, content } = req.body;

  if (!product_name || !rating || !content) {
    return res.status(400).json({ error: '상품명, 별점, 내용은 필수입니다.' });
  }
  if (rating < 1 || rating > 5) {
    return res.status(400).json({ error: '별점은 1~5 사이여야 합니다.' });
  }

  const { data, error } = await supabase
    .from('bongi_reviews')
    .insert({
      user_id: req.user.id,
      category: category || 'general',
      product_name,
      rating: Number(rating),
      content,
      author_name: req.user.displayName || req.user.email?.split('@')[0] || '익명',
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

export default router;
