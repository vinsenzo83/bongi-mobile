import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = Router();

// GET /api/reviews — 후기 목록 (공개, 카테고리 필터, 페이징)
router.get('/', async (req, res) => {
  try {
    const { category, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    if (!supabase) return res.json({ data: [], total: 0 });

    let query = supabase.from('bongi_reviews').select('*', { count: 'exact' });
    if (category) query = query.eq('category', category);

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + (+limit) - 1);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ data, total: count, page: +page, limit: +limit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reviews — 후기 작성 (인증 필수)
router.post('/', authenticateJWT, async (req, res) => {
  try {
    const { category, product_name, rating, content } = req.body;

    if (!product_name || !rating || !content) {
      return res.status(400).json({ error: '상품명, 별점, 내용은 필수입니다.' });
    }
    if (+rating < 1 || +rating > 5) {
      return res.status(400).json({ error: '별점은 1~5 사이여야 합니다.' });
    }
    if (content.length < 10) {
      return res.status(400).json({ error: '후기는 최소 10자 이상 작성해주세요.' });
    }

    if (!supabase) return res.status(503).json({ error: 'DB 연결 필요' });

    const { data, error } = await supabase
      .from('bongi_reviews')
      .insert({
        user_id: req.user.id,
        category: category || 'general',
        product_name,
        rating: +rating,
        content,
        author_name: req.user.displayName || req.user.email?.split('@')[0] || '익명',
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
