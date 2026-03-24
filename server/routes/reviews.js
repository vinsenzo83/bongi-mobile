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
        image_url: req.body.image_url || null,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reviews/upload-image — 이미지 업로드 (인증 필수)
router.post('/upload-image', authenticateJWT, async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ error: '이미지 데이터가 필요합니다.' });
    }
    if (!supabase) {
      return res.status(503).json({ error: 'DB 연결 필요' });
    }

    const matches = image.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ error: '올바른 base64 이미지 형식이 아닙니다.' });
    }

    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const maxSize = 3 * 1024 * 1024;
    if (buffer.length > maxSize) {
      return res.status(400).json({ error: '이미지 크기는 3MB 이하여야 합니다.' });
    }

    const fileName = `review_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('review-images')
      .upload(fileName, buffer, {
        contentType: `image/${matches[1]}`,
        upsert: false,
      });

    if (uploadError) {
      return res.status(500).json({ error: uploadError.message });
    }

    const { data: urlData } = supabase.storage
      .from('review-images')
      .getPublicUrl(fileName);

    res.json({ url: urlData.publicUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
